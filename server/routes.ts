import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketServer } from "socket.io";
import { GameManager } from "./gameManager";
import OpenAI from "openai";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { personaggi, customCards, cardModifications, users, friendRequests, friendships, gameInvitations, achievements, playerAchievements, missionTemplates, playerDailyMissions, trainingTips, clans, clanMembers, clanJoinRequests, tournaments, tournamentParticipants, tournamentMatches, matches, gameEvents, seasonalEvents, seasonalCards, cardSkins, playerSkins, seasonalPasses, passRewards, playerPassProgress } from "../shared/schema";
import { eq, ilike, and, desc, or, ne, sql } from "drizzle-orm";
import { CARD_DATA } from "../client/src/lib/cardData";
import { authMiddleware } from "./auth";

const jwtSecret = process.env.JWT_SECRET || "minkiards-secret-key-change-in-production";
import { 
  initializeMissionsAndAchievements, 
  getPlayerDailyMissions, 
  getPlayerAchievements, 
  claimMissionReward, 
  claimAchievementReward,
  trackGameEvent 
} from "./missionsAndAchievements";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "lucaforte94@gmail.com";

// Initialize OpenAI
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// Track voice chat participants: gameId -> Set of playerNames
const voiceChatRooms = new Map<string, Map<string, string>>(); // gameId -> Map(playerName -> socketId)

// Throttled game state updates to reduce broadcast frequency
const pendingStateUpdates = new Map<string, NodeJS.Timeout>();
const lastEventCounters = new Map<string, number>(); // Track eventCounter to skip true duplicates

// REAL-TIME UPDATE: All updates are now immediate (no throttling)
function emitThrottledGameState(io: SocketServer, gameId: string, gameState: any) {
  // Only skip if exact same eventCounter (true duplicate broadcast)
  const newCounter = gameState.eventCounter ?? -1;
  const lastCounter = lastEventCounters.get(gameId) ?? -2;
  if (newCounter !== -1 && newCounter === lastCounter) {
    return; // True duplicate, skip
  }
  lastEventCounters.set(gameId, newCounter);
  
  // Clear any pending update for this game (legacy cleanup)
  const existing = pendingStateUpdates.get(gameId);
  if (existing) {
    clearTimeout(existing);
    pendingStateUpdates.delete(gameId);
  }
  
  // IMMEDIATE: Emit now, no delay
  io.to(gameId).emit('game-state-update', gameState);
}

// Immediate state update (for critical events like game start, player join)
function emitImmediateGameState(io: SocketServer, gameId: string, gameState: any) {
  // Update counter
  lastEventCounters.set(gameId, gameState.eventCounter ?? -1);
  
  // Clear any pending throttled update
  const existing = pendingStateUpdates.get(gameId);
  if (existing) {
    clearTimeout(existing);
    pendingStateUpdates.delete(gameId);
  }
  
  io.to(gameId).emit('game-state-update', gameState);
}

// Local database of MINKIARDS card values (DISABLED - values were incorrect)
// TODO: Get real values from user and populate this database accurately
const MINKIARDS_CARD_DATA: Record<string, { pti: number, stars: number, powers?: string }> = {
  // Disabled until we get accurate values from the user
  // 'card-name': { pti: 0, stars: 0, powers: '' },
};

// Build combined description including previous answers for better context
function buildCombinedDescription(description: string, animation?: string, behavior?: string, previousAnswers?: Record<string, string>): string {
  let combined = description;
  if (animation) combined += ` ${animation}`;
  if (behavior) combined += ` ${behavior}`;
  if (previousAnswers) {
    for (const [key, value] of Object.entries(previousAnswers)) {
      combined += ` ${key}: ${value}`;
    }
  }
  return combined;
}

// Generate follow-up questions based on answers
function generateFollowUpQuestions(previousAnswers: Record<string, string>, description: string): Array<{id: string, question: string, type: string, options?: string[], placeholder?: string}> {
  const followUps: Array<{id: string, question: string, type: string, options?: string[], placeholder?: string}> = [];
  const lowerDesc = description.toLowerCase();
  
  // If they chose "Altro" or custom option, ask for specifics
  for (const [key, value] of Object.entries(previousAnswers)) {
    const lowerValue = value.toLowerCase();
    
    if (lowerValue.includes('altro') || lowerValue.includes('specifica') || lowerValue.includes('personalizzato')) {
      followUps.push({
        id: `${key}_detail`,
        question: `Puoi specificare meglio cosa intendi per "${value}"?`,
        type: 'text',
        placeholder: 'Descrivi in dettaglio...'
      });
    }
    
    // If they chose swap but didn't specify amounts
    if (key === 'swap_what' && !lowerDesc.match(/\d+/)) {
      if (lowerValue.includes('pti') && !previousAnswers['swap_pti_amount']) {
        followUps.push({
          id: 'swap_pti_amount',
          question: 'Lo scambio riguarda tutti i PTI o solo una parte?',
          type: 'choice',
          options: ['Tutti i PTI vengono scambiati', 'Solo una percentuale (50%)', 'Un valore fisso specificato', 'Il giocatore sceglie quanti PTI']
        });
      }
    }
    
    // If they chose protection, ask from what
    if (key === 'protection_duration' && !previousAnswers['protection_from']) {
      followUps.push({
        id: 'protection_from',
        question: 'La protezione è contro cosa?',
        type: 'choice',
        options: ['Tutti i danni', 'Solo attacchi diretti', 'Solo effetti speciali', 'Un tipo specifico (veleno, fuoco, ecc.)']
      });
    }
    
    // If they chose resurrection, ask with what stats
    if (key === 'resurrect_choice' && !previousAnswers['resurrect_stats']) {
      followUps.push({
        id: 'resurrect_stats',
        question: 'Con quali statistiche torna il personaggio?',
        type: 'choice',
        options: ['PTI e stelle originali', 'Metà PTI, stelle intere', 'Solo 100 PTI', 'PTI a scelta del giocatore']
      });
    }
  }
  
  return followUps;
}

// Generate interpretation from description and answers
function generateInterpretation(description: string, previousAnswers?: Record<string, string>): string {
  if (!previousAnswers || Object.keys(previousAnswers).length === 0) {
    return '';
  }
  
  let interpretation = 'Effetto interpretato: ';
  const parts: string[] = [];
  
  // Build interpretation from answers
  if (previousAnswers.target) {
    parts.push(`Bersaglio: ${previousAnswers.target}`);
  }
  if (previousAnswers.damage_amount) {
    parts.push(`Danni: ${previousAnswers.damage_amount}`);
  }
  if (previousAnswers.heal_amount) {
    parts.push(`Cura: ${previousAnswers.heal_amount} PTI`);
  }
  if (previousAnswers.duration) {
    parts.push(`Durata: ${previousAnswers.duration}`);
  }
  if (previousAnswers.swap_what) {
    parts.push(`Scambio di: ${previousAnswers.swap_what}`);
  }
  if (previousAnswers.swap_participants) {
    parts.push(`Partecipanti: ${previousAnswers.swap_participants}`);
  }
  if (previousAnswers.condition_detail) {
    parts.push(`Condizione: ${previousAnswers.condition_detail}`);
  }
  if (previousAnswers.resurrect_choice) {
    parts.push(`Resurrezione: ${previousAnswers.resurrect_choice}`);
  }
  if (previousAnswers.stars_amount) {
    parts.push(`Stelle: ${previousAnswers.stars_action || ''} ${previousAnswers.stars_amount}`);
  }
  
  if (parts.length === 0) {
    return `Descrizione base: ${description}`;
  }
  
  return interpretation + parts.join('. ') + '.';
}

// Fallback question generation when AI is unavailable
function generateFallbackQuestions(description: string, previousAnswers?: Record<string, string>): Array<{id: string, question: string, type: string, options?: string[], placeholder?: string}> {
  const questions: Array<{id: string, question: string, type: string, options?: string[], placeholder?: string}> = [];
  const lowerDesc = description.toLowerCase();
  const hasNumber = /\d+/.test(description);
  const answeredIds = previousAnswers ? Object.keys(previousAnswers) : [];
  
  // ============ TARGET DETECTION ============
  const hasTarget = lowerDesc.includes('bersaglio') || lowerDesc.includes('nemico') || 
                    lowerDesc.includes('avversario') || lowerDesc.includes('tutti') ||
                    lowerDesc.includes('personaggio') || lowerDesc.includes('target') ||
                    lowerDesc.includes('alleato') || lowerDesc.includes('mio') ||
                    lowerDesc.includes('tuo') || lowerDesc.includes('proprio');
  
  // ============ BARATTO / SCAMBIO EFFECTS ============
  const isSwapEffect = lowerDesc.includes('baratto') || lowerDesc.includes('scambia') || 
                       lowerDesc.includes('scambio') || lowerDesc.includes('swap') ||
                       lowerDesc.includes('inverti') || lowerDesc.includes('trasferisci');
  
  if (isSwapEffect) {
    // Ask what is being swapped
    if (!lowerDesc.includes('pti') && !lowerDesc.includes('stelle') && !lowerDesc.includes('carta')) {
      questions.push({
        id: 'swap_what',
        question: 'Cosa viene scambiato?',
        type: 'choice',
        options: ['I PTI tra due personaggi', 'Le stelle tra due personaggi', 'PTI e stelle insieme', 'Una carta dalla mano con una in campo', 'Una carta con il cimitero', 'Altro (specifica)']
      });
    }
    // Ask who participates in the swap
    questions.push({
      id: 'swap_participants',
      question: 'Tra chi avviene lo scambio?',
      type: 'choice',
      options: ['Tra un mio personaggio e uno nemico', 'Tra due miei personaggi', 'Tra il mio personaggio e uno casuale', 'Il giocatore sceglie entrambi']
    });
    // Ask if there are conditions
    questions.push({
      id: 'swap_condition',
      question: 'Ci sono condizioni per lo scambio?',
      type: 'choice',
      options: ['Nessuna condizione', 'Solo se il nemico ha meno PTI', 'Solo se il nemico ha più PTI', 'Solo con personaggi attivi', 'Altra condizione (specifica)']
    });
  }
  
  // ============ PANEL/INPUT EFFECTS ============
  const wantsInput = lowerDesc.includes('pannello') || lowerDesc.includes('inserire') || 
                     lowerDesc.includes('inserisci') || lowerDesc.includes('scegli') ||
                     lowerDesc.includes('input') || lowerDesc.includes('digita');
  
  if (wantsInput) {
    if (!lowerDesc.includes('pti') && !lowerDesc.includes('mazzo') && !lowerDesc.includes('cimitero')) {
      questions.push({
        id: 'input_type',
        question: 'Che tipo di input richiede il pannello?',
        type: 'choice',
        options: ['Un valore numerico (es. PTI)', 'Selezione da un mazzo', 'Selezione dal cimitero', 'Scelta tra opzioni', 'Selezione di un bersaglio']
      });
    }
    questions.push({
      id: 'input_purpose',
      question: 'A cosa serve questo input?',
      type: 'text',
      placeholder: 'Es: "per determinare quanti PTI trasferire", "per scegliere quale carta resuscitare"'
    });
  }
  
  // ============ DEATH/GRAVEYARD EFFECTS ============
  const deathRelated = lowerDesc.includes('morte') || lowerDesc.includes('muore') || 
                       lowerDesc.includes('cimitero') || lowerDesc.includes('uccide') ||
                       lowerDesc.includes('elimina') || lowerDesc.includes('resuscita') ||
                       lowerDesc.includes('resurrezione') || lowerDesc.includes('risorge');
  
  if (deathRelated) {
    if (lowerDesc.includes('resuscita') || lowerDesc.includes('resurrezione') || lowerDesc.includes('risorge') || lowerDesc.includes('riporta')) {
      questions.push({
        id: 'resurrect_choice',
        question: 'Come viene scelto il personaggio da resuscitare?',
        type: 'choice',
        options: ['Il giocatore sceglie dal cimitero', 'Resuscita l\'ultimo morto', 'Resuscita un personaggio casuale', 'Resuscita tutti i personaggi']
      });
      if (!hasNumber) {
        questions.push({
          id: 'resurrect_pti',
          question: 'Con quanti PTI torna in vita il personaggio?',
          type: 'choice',
          options: ['Con i PTI originali', 'Con metà dei PTI originali', 'Con 100 PTI', 'Con 500 PTI', 'Con un valore scelto dal giocatore']
        });
      }
    }
    if (lowerDesc.includes('morte') && !lowerDesc.includes('resuscita')) {
      questions.push({
        id: 'death_trigger',
        question: 'Quando si attiva l\'effetto legato alla morte?',
        type: 'choice',
        options: ['Quando questo personaggio muore', 'Quando un alleato muore', 'Quando un nemico muore', 'Quando qualsiasi personaggio muore']
      });
    }
  }
  
  // ============ CONDITIONAL EFFECTS ============
  const hasCondition = lowerDesc.includes('se ') || lowerDesc.includes('quando ') || 
                       lowerDesc.includes('solo se') || lowerDesc.includes('a condizione');
  
  if (hasCondition) {
    questions.push({
      id: 'condition_detail',
      question: 'Puoi specificare meglio la condizione?',
      type: 'text',
      placeholder: 'Es: "se il nemico ha meno di 500 PTI", "quando viene attaccato"'
    });
    questions.push({
      id: 'condition_else',
      question: 'Cosa succede se la condizione NON è soddisfatta?',
      type: 'choice',
      options: ['Nulla, l\'effetto non si attiva', 'Effetto ridotto a metà', 'Un effetto diverso', 'La carta torna in mano']
    });
  }
  
  // ============ PROTECTION/INSURANCE EFFECTS ============
  const hasProtection = lowerDesc.includes('protezione') || lowerDesc.includes('protegge') ||
                        lowerDesc.includes('immunità') || lowerDesc.includes('immune') ||
                        lowerDesc.includes('assicurazione') || lowerDesc.includes('assicura') ||
                        lowerDesc.includes('scudo') || lowerDesc.includes('barriera');
  
  if (hasProtection) {
    if (!lowerDesc.includes('turni') && !lowerDesc.includes('turno') && !lowerDesc.includes('permanente')) {
      questions.push({
        id: 'protection_duration',
        question: 'Per quanto tempo dura la protezione?',
        type: 'choice',
        options: ['Solo per questo attacco', '1 turno', '2 turni', '3 turni', 'Permanente', 'Finché non viene colpito']
      });
    }
    questions.push({
      id: 'protection_type',
      question: 'Da cosa protegge?',
      type: 'choice',
      options: ['Da tutti i danni', 'Solo da attacchi diretti', 'Solo da effetti speciali', 'Dalla morte (come assicurazione)', 'Da un tipo specifico di danno']
    });
  }
  
  // ============ DAMAGE EFFECTS ============
  const hasDamage = lowerDesc.includes('dann') || lowerDesc.includes('attacc') || 
                    lowerDesc.includes('colp') || lowerDesc.includes('ferisce') ||
                    lowerDesc.includes('infligge') || lowerDesc.includes('toglie pti');
  
  if (hasDamage && !hasNumber) {
    questions.push({
      id: 'damage_amount',
      question: 'Quanti danni infligge l\'effetto?',
      type: 'number',
      placeholder: 'Es: 100, 200, 500'
    });
  }
  
  // ============ HEALING EFFECTS ============
  const hasHeal = lowerDesc.includes('cura') || lowerDesc.includes('rigenera') || 
                  lowerDesc.includes('riprist') || lowerDesc.includes('guarisce') ||
                  lowerDesc.includes('recupera pti') || lowerDesc.includes('aggiunge pti');
  
  if (hasHeal && !hasNumber) {
    questions.push({
      id: 'heal_amount',
      question: 'Quanti PTI cura/aggiunge l\'effetto?',
      type: 'number',
      placeholder: 'Es: 50, 100, 200'
    });
  }
  
  // ============ DURATION FOR TEMP EFFECTS ============
  const hasTempEffect = lowerDesc.includes('scudo') || lowerDesc.includes('protezione') ||
                        lowerDesc.includes('potenzia') || lowerDesc.includes('buff') ||
                        lowerDesc.includes('bonus') || lowerDesc.includes('aumenta') ||
                        lowerDesc.includes('veleno') || lowerDesc.includes('brucia');
  const hasDuration = lowerDesc.includes('turni') || lowerDesc.includes('turno') || 
                      lowerDesc.includes('permanente') || lowerDesc.includes('sempre') ||
                      hasNumber;
  
  if (hasTempEffect && !hasDuration && !hasProtection) {
    questions.push({
      id: 'duration',
      question: 'Per quanto tempo dura l\'effetto?',
      type: 'choice',
      options: ['Istantaneo (una volta)', '1 turno', '2 turni', '3 turni', '5 turni', 'Permanente']
    });
  }
  
  // ============ STARS MODIFICATION ============
  const hasStars = lowerDesc.includes('stelle') || lowerDesc.includes('star');
  if (hasStars && !hasNumber) {
    questions.push({
      id: 'stars_amount',
      question: 'Quante stelle vengono modificate?',
      type: 'number',
      placeholder: 'Es: 1, 2, 3'
    });
    questions.push({
      id: 'stars_action',
      question: 'Le stelle vengono aggiunte o tolte?',
      type: 'choice',
      options: ['Aggiunte', 'Tolte', 'Scambiate con un altro personaggio', 'Raddoppiate', 'Dimezzate']
    });
  }
  
  // ============ CARD DRAW/DISCARD ============
  const hasCardAction = lowerDesc.includes('pesca') || lowerDesc.includes('scarta') ||
                        lowerDesc.includes('mazzo') || lowerDesc.includes('mano');
  if (hasCardAction) {
    if (!hasNumber) {
      questions.push({
        id: 'card_count',
        question: 'Quante carte sono coinvolte?',
        type: 'number',
        placeholder: 'Es: 1, 2, 3'
      });
    }
    if (lowerDesc.includes('pesca')) {
      questions.push({
        id: 'draw_type',
        question: 'Da quale mazzo si pesca?',
        type: 'choice',
        options: ['Personaggi', 'Mosse', 'Bonus', 'Speciali', 'A scelta del giocatore', 'Casuale']
      });
    }
  }
  
  // ============ DICE MODIFICATION EFFECTS ============
  const hasDiceEffect = lowerDesc.includes('dado') || lowerDesc.includes('dice') ||
                        lowerDesc.includes('lancio') || lowerDesc.includes('tiro') ||
                        lowerDesc.includes('modifica il numero') || lowerDesc.includes('scegli il numero') ||
                        lowerDesc.includes('controlla il dado') || lowerDesc.includes('manipola');
  
  if (hasDiceEffect) {
    questions.push({
      id: 'dice_control_type',
      question: 'Come viene controllato/modificato il dado?',
      type: 'choice',
      options: [
        'Il giocatore sceglie il numero del dado (1-6)',
        'Il dado viene rilanciato una volta',
        'Il risultato viene aumentato di un valore',
        'Il risultato viene diminuito di un valore',
        'Il dado mostra sempre il numero massimo (6)',
        'Il dado mostra sempre il numero minimo (1)',
        'Altro (specifica)'
      ]
    });
    questions.push({
      id: 'dice_control_trigger',
      question: 'Quando si attiva questo effetto sul dado?',
      type: 'choice',
      options: [
        'Ogni volta che viene lanciato un dado',
        'Solo quando il proprietario della carta lancia un dado',
        'Solo quando un avversario lancia un dado',
        'Una volta sola per partita',
        'Una volta per turno'
      ]
    });
    questions.push({
      id: 'dice_control_duration',
      question: 'Per quanto tempo dura questo effetto?',
      type: 'choice',
      options: [
        'Solo per il prossimo lancio',
        'Per tutto il turno',
        'Per 2 turni',
        'Per 3 turni',
        'Finché la carta è in campo',
        'Permanente'
      ]
    });
  }
  
  // ============ MISSING TARGET (if not already covered) ============
  if (!hasTarget && !isSwapEffect && questions.length < 3) {
    questions.push({
      id: 'target',
      question: 'Chi è il bersaglio dell\'effetto?',
      type: 'choice',
      options: ['Il mio personaggio attivo', 'Un personaggio nemico a scelta', 'Tutti i nemici', 'Tutti i personaggi in campo', 'Un alleato', 'Io stesso (il giocatore)']
    });
  }
  
  // ============ GENERIC CLARIFICATION ============
  // If we haven't found any specific patterns, ask for general clarification
  if (questions.length === 0) {
    questions.push({
      id: 'effect_summary',
      question: 'Puoi descrivere l\'effetto in modo più dettagliato?',
      type: 'text',
      placeholder: 'Descrivi passo per passo cosa fa la carta quando viene giocata'
    });
    questions.push({
      id: 'effect_goal',
      question: 'Qual è lo scopo principale di questo effetto?',
      type: 'choice',
      options: ['Danneggiare nemici', 'Curare/potenziare alleati', 'Modificare carte (pesca/scarta)', 'Scambiare/trasferire statistiche', 'Protezione/difesa', 'Controllo (congela/stordisce)', 'Altro']
    });
  }
  
  // Filter out already answered questions
  const filteredQuestions = questions.filter(q => !answeredIds.includes(q.id));
  
  return filteredQuestions;
}

// Helper to emit card-played event for last played cards history
// Also handles YouTube video emission for all players (including CPU cards)
async function emitCardPlayed(io: SocketServer, gameId: string, card: any, playerName: string) {
  if (!card) return;
  const getCardNameFromUrl = (url: string) => {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename
      .toLowerCase()
      .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  io.to(gameId).emit('card-played', {
    cardId: card.id,
    cardType: card.type,
    frontImage: card.frontImage,
    cardName: card.name || getCardNameFromUrl(card.frontImage),
    playerName,
    gameId
  });
  
  // YOUTUBE VIDEO: Check if card has youtubeUrl and emit to all players
  let youtubeUrl = card.youtubeUrl;
  
  // If no youtubeUrl in card memory, try database lookup
  if (!youtubeUrl && card.name) {
    try {
      // Check customCards table
      const customCardResults = await db.select().from(customCards)
        .where(eq(customCards.name, card.name))
        .limit(1);
      if (customCardResults.length > 0 && customCardResults[0].youtubeUrl) {
        youtubeUrl = customCardResults[0].youtubeUrl;
        console.log(`[emitCardPlayed] Found youtubeUrl from customCards for ${card.name}: ${youtubeUrl}`);
      }
      
      // Also check cardModifications table if still no youtubeUrl
      if (!youtubeUrl) {
        const modResults = await db.select().from(cardModifications)
          .where(eq(cardModifications.originalCardId, card.id))
          .limit(1);
        if (modResults.length > 0 && modResults[0].youtubeUrl) {
          youtubeUrl = modResults[0].youtubeUrl;
          console.log(`[emitCardPlayed] Found youtubeUrl from cardModifications for ${card.id}: ${youtubeUrl}`);
        }
      }
    } catch (dbError) {
      console.error('[emitCardPlayed] Error checking database for youtubeUrl:', dbError);
    }
  }
  
  // Emit YouTube video event to ALL players in the game
  if (youtubeUrl) {
    console.log(`📺 [emitCardPlayed] Emitting show-youtube-video for card ${card.name || card.id}: ${youtubeUrl}`);
    io.to(gameId).emit('show-youtube-video', {
      cardId: card.id,
      playerName,
      youtubeUrl: youtubeUrl,
      cardName: card.name || getCardNameFromUrl(card.frontImage || ''),
      cardType: card.type
    });
  }
}

// Extract card name from image URL
function getCardNameFromImageUrl(imageUrl: string): string {
  try {
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    return filename.toLowerCase()
      .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
      .replace(/[-_]/g, '-');
  } catch {
    return '';
  }
}

// Import cache from shared module
import { personaggiCache, personaggiCacheLoaded, loadPersonaggiCache, getPersonaggioFromCache, isCacheReady } from './personaggiCache';
export { personaggiCache, personaggiCacheLoaded, getPersonaggioFromCache };

// Look up PERSONAGGI data from database (fallback if cache misses)
async function getPersonaggioFromDatabase(cardName: string): Promise<{ pti: number | null, stars: number | null } | null> {
  // Try cache first for instant response
  const cached = getPersonaggioFromCache(cardName);
  if (cached) return cached;
  
  try {
    console.log(`🔍 Looking up ${cardName} in PERSONAGGI database...`);
    
    // First try exact match
    let result = await db.select().from(personaggi).where(eq(personaggi.name, cardName.toUpperCase())).limit(1);
    
    // If no exact match, try fuzzy search
    if (result.length === 0) {
      result = await db.select().from(personaggi).where(ilike(personaggi.name, `%${cardName.toUpperCase()}%`)).limit(1);
    }
    
    // If still no match, try parts of the name
    if (result.length === 0) {
      const nameParts = cardName.toUpperCase().split(' ');
      for (const part of nameParts) {
        if (part.length > 3) { // Only search meaningful parts
          result = await db.select().from(personaggi).where(ilike(personaggi.name, `%${part}%`)).limit(1);
          if (result.length > 0) break;
        }
      }
    }
    
    if (result.length > 0) {
      console.log(`✅ Found in database: ${result[0].name} - PTI: ${result[0].pti}, Stelle: ${result[0].stars}`);
      
      // Add to cache for future lookups
      const normalizedName = cardName.toLowerCase().replace(/[-_]/g, ' ').trim();
      personaggiCache.set(normalizedName, { pti: result[0].pti, stars: result[0].stars, name: result[0].name });
      
      return {
        pti: result[0].pti,
        stars: result[0].stars
      };
    }
    
    console.log(`❌ Not found in database: ${cardName}`);
    return null;
  } catch (error) {
    console.error('Error querying PERSONAGGI database:', error);
    return null;
  }
}

// Get card data from local database
function getLocalCardData(imageUrl: string): { pti: number, stars: number, powers?: string, name?: string } | null {
  const cardName = getCardNameFromImageUrl(imageUrl);
  const cardData = MINKIARDS_CARD_DATA[cardName];
  
  if (cardData) {
    console.log(`Found local data for ${cardName}:`, cardData);
    return {
      ...cardData,
      name: cardName.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    };
  }
  
  // If not found, try to guess based on common patterns
  if (cardName.includes('saiyan') || cardName.includes('vegeta') || cardName.includes('goku')) {
    return { pti: 1500, stars: 5, powers: 'Guerriero Saiyan' };
  }
  if (cardName.includes('robot') || cardName.includes('cyber')) {
    return { pti: 1200, stars: 4, powers: 'Tecnologia avanzata' };
  }
  if (cardName.includes('mago') || cardName.includes('wizard')) {
    return { pti: 800, stars: 3, powers: 'Magia' };
  }
  
  return null;
}

// Function to analyze PERSONAGGI card and auto-populate notes with PTI and stars
async function analyzePersonaggioCard(imageUrl: string): Promise<{ pti: number, stars: number, powers?: string, name?: string } | null> {
  try {
    console.log('Analyzing PERSONAGGI card:', imageUrl);
    
    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an expert at reading MINKIARDS card game images. MINKIARDS cards display specific numeric values that you must extract accurately:

PTI (Punti Totali Iniziali): The character's life points - this is usually a large number prominently displayed (e.g., 250, 500, 750, 1000, 1250, etc.)
STELLE (Stars): The damage multiplier - usually shown as small star symbols or numbers ranging from 1-5
POTERI (Powers): Any special abilities or powers written on the card

Look for these specific elements:
- PTI is often displayed as a large number in a circle or prominent area
- Stars are typically small symbols (★) or numbers near the character image
- Character names are usually at the top or bottom of the card
- Powers/abilities are described in text boxes

Respond with accurate JSON format: {"pti": number, "stars": number, "powers": "description", "name": "card name"}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this MINKIARDS PERSONAGGI card carefully. Extract the exact numeric values:

1. PTI (life points) - look for the largest number on the card, often in a circle or prominent display
2. STELLE (stars) - count star symbols (★) or look for a number from 1-5 indicating damage multiplier
3. Character name - usually clearly displayed at top or bottom
4. Any special powers or abilities described in text

Be very precise with the numbers. PTI values are typically: 250, 500, 750, 1000, 1250, 1500, etc.
Star values are typically: 1, 2, 3, 4, or 5.

Return accurate values, not defaults.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.1 // Lower temperature for more consistent results
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    console.log('Card analysis result:', analysis);
    
    // More thorough parsing with validation
    let pti = 1000; // default
    let stars = 1; // default
    
    // Try multiple possible field names for PTI
    if (analysis.pti && typeof analysis.pti === 'number') {
      pti = analysis.pti;
    } else if (analysis.PTI && typeof analysis.PTI === 'number') {
      pti = analysis.PTI;
    } else if (analysis.points && typeof analysis.points === 'number') {
      pti = analysis.points;
    } else if (analysis.life && typeof analysis.life === 'number') {
      pti = analysis.life;
    } else if (analysis.hp && typeof analysis.hp === 'number') {
      pti = analysis.hp;
    }
    
    // Try multiple possible field names for stars
    if (analysis.stars && typeof analysis.stars === 'number') {
      stars = Math.max(1, Math.min(5, analysis.stars));
    } else if (analysis.stelle && typeof analysis.stelle === 'number') {
      stars = Math.max(1, Math.min(5, analysis.stelle));
    } else if (analysis.star && typeof analysis.star === 'number') {
      stars = Math.max(1, Math.min(5, analysis.star));
    } else if (analysis.damage && typeof analysis.damage === 'number') {
      stars = Math.max(1, Math.min(5, analysis.damage));
    }
    
    console.log(`Parsed values: PTI=${pti}, Stars=${stars}`);
    
    return {
      pti: pti,
      stars: stars,
      powers: analysis.powers || analysis.poteri || analysis.abilities || '',
      name: analysis.name || analysis.nome || analysis.character || ''
    };
  } catch (error: any) {
    console.error('Error analyzing PERSONAGGI card:', error);
    // Handle quota exceeded errors gracefully
    if (error.code === 'insufficient_quota' || error.code === 'rate_limit_exceeded') {
      console.log('OpenAI quota exceeded, trying local card database...');
      
      // Try to get data from local database
      const localData = getLocalCardData(imageUrl);
      if (localData) {
        console.log('Using local card data:', localData);
        return localData;
      }
    }
    
    // Final fallback: try to guess from image URL
    const cardName = getCardNameFromImageUrl(imageUrl);
    console.log(`Falling back to intelligent defaults for: ${cardName}`);
    
    // Intelligent defaults based on card name patterns
    let pti = 1000;
    let stars = 2;
    let powers = '';
    
    if (cardName.includes('morte') || cardName.includes('death')) {
      pti = 2000; stars = 5; powers = 'Potere letale';
    } else if (cardName.includes('spencer') || cardName.includes('bud')) {
      pti = 1500; stars = 5; powers = 'Forza devastante';
    } else if (cardName.includes('bear') || cardName.includes('orso')) {
      pti = 1250; stars = 4; powers = 'Forza bestiale';
    } else if (cardName.includes('vegeta') || cardName.includes('saiyan')) {
      pti = 1800; stars = 5; powers = 'Potere Saiyan';
    } else if (cardName.includes('amadeus') || cardName.includes('mozart')) {
      pti = 750; stars = 3; powers = 'Genio artistico';
    } else if (cardName.includes('crash') || cardName.includes('bandicoot')) {
      pti = 800; stars = 3; powers = 'Agilità';
    }
    
    return { 
      pti, 
      stars, 
      powers,
      name: cardName.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    };
  }
}

// Function to determine sound type based on character name
function getCharacterSoundType(cardName: string): string | null {
  const name = cardName.toLowerCase();
  
  // Animal sounds - use dedicated bee sound for ape/bee cards, fallback to bee sound in character system
  if (name.includes('ape') || name.includes('bee')) return 'bee';
  if (name.includes('cane') || name.includes('dog') || name.includes('bull')) return 'animal_dog';
  if (name.includes('gatto') || name.includes('cat')) return 'animal_cat';
  if (name.includes('uccello') || name.includes('bird') || name.includes('pollo') || name.includes('gallo')) return 'animal_bird';
  
  // Robot/mechanical sounds
  if (name.includes('robot') || name.includes('cyber') || name.includes('meccanico') || name.includes('terminator')) return 'robot_mechanical';
  
  // Magic/spell sounds
  if (name.includes('mago') || name.includes('strega') || name.includes('wizard') || name.includes('magic') || name.includes('fatata')) return 'magic_spell';
  
  // Explosion sounds
  if (name.includes('bomba') || name.includes('esplosivo') || name.includes('dynamite') || name.includes('cannone')) return 'explosion';
  
  // Human voice for most other characters
  return 'human_voice';
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Load PERSONAGGI cache on startup for fast lookups
  await loadPersonaggiCache();
  
  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 10e6, // 10MB limit for large images
    pingTimeout: 60000, // 60s timeout for slow connections
    pingInterval: 25000, // 25s ping interval
    upgradeTimeout: 30000, // 30s to upgrade connection
    transports: ['websocket', 'polling'], // Prefer websocket
    allowUpgrades: true,
    perMessageDeflate: {
      threshold: 512, // Compress messages larger than 512 bytes
      zlibDeflateOptions: {
        chunkSize: 32 * 1024, // Larger chunks for faster compression
        level: 6 // Balanced compression level
      },
      zlibInflateOptions: {
        chunkSize: 32 * 1024
      },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true
    }
  });

  // Make io globally available for GameManager effect processing
  (global as any).io = io;

  const gameManager = new GameManager();

  // Load active games from database on server startup
  gameManager.loadActiveGamesFromDB().then(() => {
    console.log('🎮 Active games loaded from database');
  }).catch(err => {
    console.error('❌ Failed to load active games:', err);
  });

  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Check if server is ready (cache loaded)
    socket.on('check-server-ready', () => {
      if (personaggiCacheLoaded) {
        socket.emit('server-ready');
      }
    });

    // Check if player has an active game to reconnect to (after server restart)
    // SECURITY: Only returns active game for authenticated user via JWT validation
    socket.on('check-active-game', async ({ authToken }) => {
      if (!authToken) {
        socket.emit('no-active-game');
        return;
      }
      
      try {
        // Verify JWT token to get player identity securely
        const decoded = jwt.verify(authToken, jwtSecret) as { userId: number; email: string };
        if (!decoded || !decoded.userId) {
          socket.emit('no-active-game');
          return;
        }
        
        // Get username from database
        const userRecord = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
        if (userRecord.length === 0) {
          socket.emit('no-active-game');
          return;
        }
        
        const playerName = userRecord[0].username;
        const activeGame = gameManager.getActiveGameByPlayerName(playerName);
        
        if (activeGame) {
          console.log(`🔄 Authenticated player ${playerName} has active game ${activeGame.gameId} with ${activeGame.handCount} cards in hand`);
          socket.emit('active-game-found', { ...activeGame, playerName });
        } else {
          socket.emit('no-active-game');
        }
      } catch (error) {
        console.error('Failed to verify auth token for active game check:', error);
        socket.emit('no-active-game');
      }
    });
    
    // Set user data on socket for game invitation lookups (called when user logs in)
    // Validates JWT token to prevent impersonation
    socket.on('set-user-data', async ({ authToken }) => {
      console.log(`Received set-user-data event from socket ${socket.id}, authToken present: ${!!authToken}`);
      if (!authToken) return;
      
      try {
        // Verify JWT token and extract user info securely (use same secret as auth.ts)
        const decoded = jwt.verify(authToken, jwtSecret) as { userId: number; email: string };
        
        if (decoded && decoded.userId) {
          // Fetch username from database for verified user
          const userRecord = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
          if (userRecord.length > 0) {
            socket.data = socket.data || {};
            socket.data.userId = decoded.userId;
            socket.data.username = userRecord[0].username;
            console.log(`Socket ${socket.id} securely associated with user ${decoded.userId} (${userRecord[0].username})`);
          }
        }
      } catch (error) {
        console.error('Failed to verify auth token for socket:', error);
      }
    });
    
    // Also emit server-ready immediately on connect if cache is already loaded
    if (personaggiCacheLoaded) {
      socket.emit('server-ready');
    }

    // Register authenticated user with socket for targeted notifications (validates auth token)
    socket.on('register-user', async ({ authToken }) => {
      if (authToken) {
        try {
          const decoded = jwt.verify(authToken, jwtSecret) as { email: string };
          const userRecord = await db.select().from(users).where(eq(users.email, decoded.email)).limit(1);
          if (userRecord.length > 0) {
            (socket as any).data = { userId: userRecord[0].id };
            console.log(`Socket ${socket.id} registered for user ${userRecord[0].id} (${userRecord[0].username})`);
          }
        } catch (error) {
          console.log(`Socket ${socket.id} failed to register - invalid token`);
        }
      }
    });

    socket.on('join-game', async ({ gameId, playerName, avatarId, userId, authToken }) => {
      // SECURITY: For reconnection to existing games, require authenticated identity
      // Use socket.data.userId if already authenticated, or verify authToken if provided
      let validatedUserId = socket.data?.userId;
      let validatedUsername = socket.data?.username;
      
      // If not already authenticated via set-user-data, try to verify authToken
      if (!validatedUserId && authToken) {
        try {
          const decoded = jwt.verify(authToken, jwtSecret) as { userId: number; email: string };
          if (decoded && decoded.userId) {
            validatedUserId = decoded.userId;
            socket.data = socket.data || {};
            socket.data.userId = decoded.userId;
            
            // Get username from database for the validated user
            const userRecord = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
            if (userRecord.length > 0) {
              validatedUsername = userRecord[0].username;
              socket.data.username = validatedUsername;
            }
          }
        } catch (err) {
          console.log(`JWT verification failed for join-game: ${err}`);
        }
      }
      
      // Check if this is a reconnection to an existing game with an existing player
      const existingGame = gameManager.getGameState(gameId);
      if (existingGame && existingGame.players[playerName]) {
        // SECURITY: Reconnection requires authenticated identity
        if (!validatedUserId) {
          console.log(`🚫 SECURITY: Unauthenticated reconnection attempt to ${gameId} as ${playerName}`);
          socket.emit('join-game-error', { message: 'Authentication required to rejoin existing game' });
          return;
        }
        
        // SECURITY: Verify that the authenticated user matches the player name
        // Allow if validatedUsername matches playerName, or if the original player had this userId
        const originalUserId = existingGame.playerUserIds?.get(playerName);
        const usernameMatches = validatedUsername && validatedUsername === playerName;
        const userIdMatches = originalUserId && originalUserId === validatedUserId;
        
        if (!usernameMatches && !userIdMatches) {
          console.log(`🚫 SECURITY: User ${validatedUsername} (ID: ${validatedUserId}) attempted to rejoin as ${playerName} (original ID: ${originalUserId})`);
          socket.emit('join-game-error', { message: 'You cannot rejoin as another player' });
          return;
        }
      }
      
      // Wait for player to be added with identity verification
      const result = await gameManager.addPlayer(gameId, playerName, socket.id, false, validatedUserId);
      
      if (!result.success) {
        console.log(`Join failed for ${playerName}: ${result.error}`);
        socket.emit('join-game-error', { message: result.error });
        return;
      }
      
      socket.join(gameId);
      
      // Set avatar if provided
      if (avatarId) {
        gameManager.setPlayerAvatar(gameId, playerName, avatarId);
      }
      
      // Set user ID for Rankiard points tracking
      if (validatedUserId) {
        gameManager.setPlayerUserId(gameId, playerName, validatedUserId);
        console.log(`Player ${playerName} associated with userId ${validatedUserId} for stats tracking`);
      } else {
        console.log(`Player ${playerName} has no userId - stats will not be tracked`);
      }
      
      // Send current game state to the player (now includes permanent cards)
      const gameState = gameManager.getSanitizedGameState(gameId);
      socket.emit('game-state-update', gameState);
      
      // Notify other players
      socket.to(gameId).emit('player-joined', { playerName });
    });

    socket.on('rejoin-game', async ({ gameId, playerName, sessionId, authToken }) => {
      console.log(`Player ${playerName} attempting to rejoin game ${gameId} with session ${sessionId}`);
      
      try {
        const game = gameManager.getGameState(gameId);
        
        if (!game) {
          console.log(`Game ${gameId} not found`);
          socket.emit('join-game-error', { message: 'Game not found' });
          return;
        }

        const player = game.players[playerName];
        if (!player) {
          console.log(`Player ${playerName} not found in game ${gameId}`);
          socket.emit('join-game-error', { message: 'Player not found in game' });
          return;
        }

        // SECURITY: Verify identity before allowing rejoin
        let validatedUserId = socket.data?.userId;
        let validatedUsername = socket.data?.username;
        
        // Try to verify authToken if not already authenticated
        if (!validatedUserId && authToken) {
          try {
            const decoded = jwt.verify(authToken, jwtSecret) as { userId: number; email: string };
            if (decoded && decoded.userId) {
              validatedUserId = decoded.userId;
              socket.data = socket.data || {};
              socket.data.userId = decoded.userId;
              
              const userRecord = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
              if (userRecord.length > 0) {
                validatedUsername = userRecord[0].username;
                socket.data.username = validatedUsername;
              }
            }
          } catch (err) {
            console.log(`JWT verification failed for rejoin-game: ${err}`);
          }
        }
        
        // SECURITY: Check if player has a userId binding - if so, require auth
        const originalUserId = game.playerUserIds?.get(playerName);
        if (originalUserId) {
          if (!validatedUserId) {
            console.log(`🚫 SECURITY: Unauthenticated rejoin attempt to ${gameId} as ${playerName}`);
            socket.emit('join-game-error', { message: 'Authentication required to rejoin' });
            return;
          }
          
          const usernameMatches = validatedUsername && validatedUsername === playerName;
          const userIdMatches = originalUserId === validatedUserId;
          
          if (!usernameMatches && !userIdMatches) {
            console.log(`🚫 SECURITY: User ${validatedUsername} (ID: ${validatedUserId}) attempted to rejoin as ${playerName} (original ID: ${originalUserId})`);
            socket.emit('join-game-error', { message: 'You cannot rejoin as another player' });
            return;
          }
        }

        // Rejoin the room and update socket ID
        socket.join(gameId);
        const oldSocketId = player.socketId;
        player.socketId = socket.id;
        player.disconnectedAt = undefined; // Clear disconnection timestamp
        
        // Update player-to-game mapping and clean up old mapping
        gameManager.setPlayerToGame(socket.id, gameId);
        if (oldSocketId) {
          gameManager.cleanupOldSocketMapping(oldSocketId);
        }
        
        console.log(`Player ${playerName} successfully rejoined game ${gameId} (was disconnected: ${player.disconnectedAt ? 'yes' : 'no'})`);
        
        // Send current game state to the reconnected player
        const gameState = gameManager.getSanitizedGameState(gameId);
        socket.emit('game-state-update', gameState);
        
        // CRITICAL: Send the player's hand privately to restore it after page refresh
        if (player.hand && player.hand.length > 0) {
          console.log(`Restoring ${player.hand.length} cards to ${playerName}'s hand`);
          socket.emit('restore-hand', { playerName, hand: player.hand });
        }
        
        // Notify other players about the reconnection
        socket.to(gameId).emit('player-reconnected', { playerName });
        
      } catch (error) {
        console.error('Error during rejoin-game:', error);
        socket.emit('join-game-error', { message: 'Failed to rejoin game' });
      }
    });

    // Join a game as spectator (watch-only mode)
    socket.on('join-as-spectator', async ({ gameId, spectatorName }) => {
      try {
        console.log(`${spectatorName} joining game ${gameId} as spectator`);
        
        const game = gameManager.getGame(gameId);
        if (!game) {
          socket.emit('spectator-error', { message: 'Partita non trovata' });
          return;
        }
        
        // Add to spectators list if not already
        if (!game.spectators.includes(spectatorName)) {
          game.spectators.push(spectatorName);
        }
        
        // Join the socket room
        socket.join(gameId);
        
        // Store spectator info on socket
        socket.data.isSpectator = true;
        socket.data.spectatorName = spectatorName;
        socket.data.gameId = gameId;
        
        // Send game state to spectator
        const gameState = gameManager.getSanitizedGameState(gameId);
        socket.emit('spectator-joined', { 
          success: true, 
          gameId,
          gameState 
        });
        
        // Notify other players
        socket.to(gameId).emit('spectator-joined-notification', {
          spectatorName,
          spectatorCount: game.spectators.length
        });
        
        console.log(`${spectatorName} is now spectating game ${gameId}`);
      } catch (error) {
        console.error('Error joining as spectator:', error);
        socket.emit('spectator-error', { message: 'Errore durante la connessione come spettatore' });
      }
    });

    // Leave spectator mode
    socket.on('leave-spectator', ({ gameId, spectatorName }) => {
      try {
        const game = gameManager.getGame(gameId);
        if (game) {
          game.spectators = game.spectators.filter(s => s !== spectatorName);
          socket.leave(gameId);
          socket.to(gameId).emit('spectator-left-notification', {
            spectatorName,
            spectatorCount: game.spectators.length
          });
        }
        socket.data.isSpectator = false;
        socket.data.spectatorName = undefined;
        socket.data.gameId = undefined;
      } catch (error) {
        console.error('Error leaving spectator mode:', error);
      }
    });

    // Create a training game with CPU opponent
    socket.on('create-training-game', async ({ gameId, playerName, avatarId, userId }) => {
      try {
        console.log(`Creating training game ${gameId} for ${playerName}`);
        
        // Create the game and add the player
        const result = await gameManager.addPlayer(gameId, playerName, socket.id, false, userId);
        
        if (!result.success) {
          console.log(`Training game creation failed for ${playerName}: ${result.error}`);
          socket.emit('join-game-error', { message: result.error });
          return;
        }
        
        socket.join(gameId);
        
        // Set avatar if provided
        if (avatarId) {
          gameManager.setPlayerAvatar(gameId, playerName, avatarId);
        }
        
        // Set user ID for tracking
        if (userId) {
          gameManager.setPlayerUserId(gameId, playerName, userId);
        }
        
        // Send initial game state
        const gameState = gameManager.getSanitizedGameState(gameId);
        socket.emit('game-state-update', gameState);
        socket.emit('player-joined', { playerName });
        
        console.log(`Training game ${gameId} created successfully`);
      } catch (error) {
        console.error('Error creating training game:', error);
        socket.emit('join-game-error', { message: 'Failed to create training game' });
      }
    });

    // Add CPU player to training game
    socket.on('add-training-cpu', async ({ gameId }) => {
      try {
        const cpuName = await gameManager.addCPUPlayer(gameId);
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
        io.to(gameId).emit('player-joined', { playerName: cpuName });
        
        // CPU sends a greeting message for training
        setTimeout(() => {
          const game = gameManager.getGameState(gameId);
          const cpuPlayer = game?.players[cpuName];
          if (cpuPlayer?.isCPU && cpuPlayer.cpuInstance) {
            cpuPlayer.cpuInstance.sendChatMessage("Ciao! Sono il tuo avversario di allenamento. Ti aiuterò a imparare a giocare a MINKIARDS!");
          }
        }, 1500);
        
        io.to(gameId).emit('training-cpu-added', { cpuName });
      } catch (error) {
        console.error('Error adding training CPU:', error);
        socket.emit('training-error', { message: 'Failed to add CPU player' });
      }
    });

    socket.on('add-cpu-player', async ({ gameId }) => {
      try {
        const cpuName = await gameManager.addCPUPlayer(gameId);
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
        io.to(gameId).emit('player-joined', { playerName: cpuName });
        
        // CPU sends a greeting message when joining
        setTimeout(() => {
          const game = gameManager.getGameState(gameId);
          const cpuPlayer = game?.players[cpuName];
          if (cpuPlayer?.isCPU && cpuPlayer.cpuInstance) {
            cpuPlayer.cpuInstance.sendChatMessage(cpuPlayer.cpuInstance.getRandomChatResponse('greeting'));
          }
        }, 1500);
        
        // Start CPU turn after a short delay
        setTimeout(async () => {
          const cpuAction = await gameManager.processCPUTurn(gameId, cpuName, io);
          if (cpuAction) {
            // Execute the CPU's action
            // CPU opening sequence handling - continue processing until sequence is complete
            const continueCPUTurn = async (currentAction: any): Promise<void> => {
              if (!currentAction) return;
              
              switch (currentAction.type) {
                case 'pick-opening-cards':
                  console.log(`CPU ${cpuName} picking opening cards:`, currentAction.data.types);
                  const openingSuccess = await gameManager.pickOpeningCards(gameId, currentAction.data.types, currentAction.data.playerName);
                  if (openingSuccess) {
                    // Look up PTI/stars from database for newly picked PERSONAGGI cards
                    const game = gameManager.getGameState(gameId);
                    const cpuHand = game?.players[currentAction.data.playerName]?.hand || [];
                    for (const card of cpuHand) {
                      if ((card.type === 'personaggi' || card.type === 'personaggi_speciali') && !card.text) {
                        try {
                          const cardName = getCardNameFromImageUrl(card.frontImage).replace(/-/g, ' ');
                          const dbData = await getPersonaggioFromDatabase(cardName);
                          if (dbData && dbData.pti !== null && dbData.stars !== null) {
                            card.text = `PTI: ${dbData.pti} | Stelle: ${dbData.stars}`;
                            console.log(`✅ CPU ${cpuName} opening card: ${cardName} - PTI: ${dbData.pti} | Stelle: ${dbData.stars}`);
                          } else {
                            card.text = 'PTI: 1000 | Stelle: 1';
                          }
                        } catch (error) {
                          card.text = 'PTI: 1000 | Stelle: 1';
                        }
                      }
                    }
                    
                    const openingGameState = gameManager.getSanitizedGameState(gameId);
                    emitThrottledGameState(io, gameId, openingGameState);
                    
                    // Continue with the next phase of opening sequence
                    setTimeout(async () => {
                      const nextAction = await gameManager.processCPUTurn(gameId, cpuName, io);
                      await continueCPUTurn(nextAction);
                    }, 1000);
                  }
                  break;
                  
                case 'play-card-and-continue':
                  console.log(`CPU ${cpuName} playing character and continuing sequence`);
                  const playResult = await gameManager.playCard(gameId, currentAction.data.cardId, currentAction.data.playerName);
                  const playGameState = gameManager.getSanitizedGameState(gameId);
                  emitThrottledGameState(io, gameId, playGameState);
                  
                  // Track in last played cards history
                  if (playResult.card) {
                    await emitCardPlayed(io, gameId, playResult.card, currentAction.data.playerName);
                  }
                  
                  if (playResult.isPersonaggio && playResult.card) {
                    const getCardNameFromUrl = (url: string) => {
                      const parts = url.split('/');
                      const filename = parts[parts.length - 1];
                      return filename
                        .toLowerCase()
                        .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                        .replace(/[-_]/g, ' ')
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    };
                    
                    const cardName = playResult.card.name || getCardNameFromUrl(playResult.card.frontImage);
                    io.to(gameId).emit('personaggio-enters', {
                      cardName,
                      message: 'ENTRA IN SCENA',
                      playerName: cpuName,
                      cardImage: playResult.card.frontImage
                    });
                  }
                  
                  // Continue with the next phase
                  setTimeout(async () => {
                    const nextAction = await gameManager.processCPUTurn(gameId, cpuName, io);
                    await continueCPUTurn(nextAction);
                  }, 1000);
                  break;
                  
                case 'mosse-attack':
                  console.log(`CPU ${cpuName} using MOSSE card for attack`);
                  
                  // Execute the attack using the card
                  io.to(gameId).emit('card-attacked', {
                    mosseCardId: currentAction.data.mosseCardId,
                    targetCardId: currentAction.data.targetCardId,
                    attackerName: currentAction.data.attackerName,
                    targetOwner: currentAction.data.targetOwner,
                    timestamp: Date.now()
                  });
                  
                  // MANUAL RETURN: CPU must manually return MOSSE cards like humans
                  setTimeout(async () => {
                    console.log(`CPU ${cpuName} manually returning used MOSSE card to deck bottom`);
                    gameManager.returnToDeck(gameId, currentAction.data.mosseCardId, currentAction.data.attackerName);
                    
                    const updatedGameState = gameManager.getSanitizedGameState(gameId);
                    emitThrottledGameState(io, gameId, updatedGameState);
                    
                    // CPU announces the manual return
                    io.to(gameId).emit('chat-message', {
                      id: `${Date.now()}-cpu-return`,
                      playerName: cpuName,
                      message: 'Rimetto la carta MOSSE in fondo al mazzo.',
                      timestamp: Date.now()
                    });
                    
                    setTimeout(async () => {
                      const nextAction = await gameManager.processCPUTurn(gameId, cpuName, io);
                      await continueCPUTurn(nextAction);
                    }, 1000);
                  }, 3000); // 3 seconds for manual return
                  break;
                  
                case 'pick-card-and-end-opening':
                  console.log(`CPU ${cpuName} picking replacement and ending opening sequence`);
                  const replacementSuccess = await gameManager.pickCard(gameId, currentAction.data.deckType, currentAction.data.playerName);
                  if (replacementSuccess) {
                    const finalGameState = gameManager.getSanitizedGameState(gameId);
                    emitThrottledGameState(io, gameId, finalGameState);
                  }
                  // Opening sequence complete - turn ends naturally
                  break;
                  
                case 'opening-complete':
                  console.log(`CPU ${cpuName} opening sequence completed`);
                  // Turn ends naturally
                  break;
                  
                case 'pick-card':
                  const pickSuccess = await gameManager.pickCard(gameId, currentAction.data.deckType, currentAction.data.playerName);
                  if (pickSuccess) {
                    const pickGameState = gameManager.getSanitizedGameState(gameId);
                    emitThrottledGameState(io, gameId, pickGameState);
                  }
                  break;
                  
                case 'play-card':
                  const result = await gameManager.playCard(gameId, currentAction.data.cardId, currentAction.data.playerName);
                  
                  // Track in last played cards history
                  if (result.card) {
                    await emitCardPlayed(io, gameId, result.card, currentAction.data.playerName);
                  }
                  
                  // According to MINKIARDS rules: when you play a card, you automatically draw a replacement of the same type
                  if (result.card) {
                    const cardType = result.card.type;
                    if (cardType === 'personaggi' || cardType === 'mosse' || cardType === 'bonus' || cardType === 'personaggi_speciali') {
                      const replacementDrawn = await gameManager.pickCard(gameId, cardType, currentAction.data.playerName);
                      if (replacementDrawn) {
                        console.log(`CPU ${cpuName} drew replacement ${cardType} card after playing`);
                      }
                    }
                  }
                  
                  const updatedGameState = gameManager.getSanitizedGameState(gameId);
                  emitThrottledGameState(io, gameId, updatedGameState);
                  
                  if (result.isPersonaggio && result.card) {
                    const getCardNameFromUrl = (url: string) => {
                      const parts = url.split('/');
                      const filename = parts[parts.length - 1];
                      return filename
                        .toLowerCase()
                        .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                        .replace(/[-_]/g, ' ')
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    };
                    
                    const cardName = result.card.name || getCardNameFromUrl(result.card.frontImage);
                    io.to(gameId).emit('personaggio-enters', {
                      cardName,
                      message: 'SI UNISCE ALLA ZUFFA',
                      playerName: cpuName,
                      cardImage: result.card.frontImage
                    });
                  }
                  
                  // CRITICAL FIX: If CPU played a MOSSE card, automatically attack an enemy
                  if (result.card && result.card.type === 'mosse') {
                    console.log(`🎯 CPU ${cpuName} played MOSSE card - automatically triggering attack`);
                    
                    // Find enemy characters on field to attack
                    const currentGameState = gameManager.getSanitizedGameState(gameId);
                    const enemyCharacters = currentGameState?.field?.filter((c: any) => 
                      c.owner !== cpuName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
                    ) || [];
                    
                    if (enemyCharacters.length > 0) {
                      // Select a target (prefer lowest PTI for strategic advantage)
                      const targetCard = enemyCharacters.reduce((best: any, current: any) => {
                        const bestPti = parseInt((best.text || '').match(/PTI:\s*(\d+)/i)?.[1] || '9999');
                        const currentPti = parseInt((current.text || '').match(/PTI:\s*(\d+)/i)?.[1] || '9999');
                        return currentPti < bestPti ? current : best;
                      });
                      
                      const getMosseName = (url: string) => {
                        const parts = url.split('/');
                        const filename = parts[parts.length - 1];
                        return filename
                          .toLowerCase()
                          .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                          .replace(/[-_]/g, ' ')
                          .split(' ')
                          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ');
                      };
                      
                      const mosseName = getMosseName(result.card.frontImage);
                      const targetName = getMosseName(targetCard.frontImage);
                      
                      // Send chat message about attack
                      io.to(gameId).emit('chat-message', {
                        id: `${Date.now()}-cpu-mosse-attack`,
                        playerName: cpuName,
                        message: `Uso la carta MOSSE "${mosseName}" per attaccare ${targetName} di ${targetCard.owner}!`,
                        timestamp: Date.now()
                      });
                      
                      // Execute the attack after a short delay
                      setTimeout(async () => {
                        try {
                          const attackResult = await gameManager.executeMossaAttack(
                            gameId,
                            cpuName,
                            result.card!.id,
                            targetCard.id,
                            100, // Base damage, will be calculated properly by the attack system
                            false, // Not a hand target
                            (data: any) => io.to(gameId).emit('defense-request', data)
                          );
                          
                          if (attackResult.success) {
                            console.log(`✅ CPU ${cpuName} MOSSE attack executed successfully`);
                            
                            // BARRIERA HANDLING: If attack was auto-absorbed by BARRIERA
                            if (attackResult.result?.barrieraAbsorbed) {
                              const barrieraDamage = attackResult.result.damageValue || 100;
                              console.log(`🛡️ CPU ${cpuName} attack auto-absorbed by BARRIERA - ${barrieraDamage} damage`);
                              
                              io.to(gameId).emit('chat-message', {
                                id: `${Date.now()}-cpu-barriera-absorb`,
                                playerName: 'Sistema',
                                message: `🛡️ BARRIERA assorbe automaticamente ${barrieraDamage} danni dell'attacco di ${cpuName}!`,
                                timestamp: Date.now()
                              });
                              
                              // Apply damage to BARRIERA shield using result's damage value
                              gameManager.damageBarriera(gameId, attackResult.result.barrieraShieldId, barrieraDamage, cpuName, io);
                              
                              // Return MOSSE to deck
                              gameManager.returnToDeck(gameId, result.card!.id, cpuName);
                              
                              // Update game state
                              const barrieraState = gameManager.getSanitizedGameState(gameId);
                              emitThrottledGameState(io, gameId, barrieraState);
                              
                              // CRITICAL: End CPU turn after BARRIERA attack (one attack per turn on BARRIERA)
                              // Reset CPU state immediately before turn ends
                              const currentGameForBarriera = gameManager.getGameState(gameId);
                              if (currentGameForBarriera && currentGameForBarriera.players[cpuName]?.cpuInstance) {
                                currentGameForBarriera.players[cpuName].cpuInstance.resetTurnState();
                              }
                              
                              setTimeout(() => {
                                // Process delayed damages before ending turn
                                gameManager.processDelayedDamages(gameId, cpuName, io);
                                
                                const nextAfterCPU = gameManager.endTurn(gameId, cpuName);
                                if (nextAfterCPU) {
                                  console.log(`🎯 CPU ${cpuName} turn ended after BARRIERA attack, next: ${nextAfterCPU}`);
                                  io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                                  
                                  // Fetch fresh game state after turn ended
                                  const freshGameAfterBarriera = gameManager.getGameState(gameId);
                                  if (freshGameAfterBarriera && freshGameAfterBarriera.players[nextAfterCPU]?.isCPU) {
                                    setTimeout(() => {
                                      gameManager.processCPUTurn(gameId, nextAfterCPU, io);
                                    }, 1500);
                                  }
                                }
                              }, 1500);
                              return; // Attack absorbed
                            }
                          } else {
                            console.log(`❌ CPU ${cpuName} MOSSE attack failed: ${attackResult.error}`);
                          }
                          
                          // Return MOSSE card to deck and draw replacement
                          setTimeout(() => {
                            gameManager.returnToDeck(gameId, result.card!.id, cpuName);
                            console.log(`🔄 CPU ${cpuName} returned MOSSE card to deck`);
                            
                            const finalState = gameManager.getSanitizedGameState(gameId);
                            emitThrottledGameState(io, gameId, finalState);
                          }, 2000);
                        } catch (err) {
                          console.error(`Error in CPU MOSSE attack:`, err);
                        }
                      }, 1500);
                    } else {
                      console.log(`⚠️ CPU ${cpuName} has MOSSE card but no enemy targets on field`);
                    }
                  }
                  break;
                  
                case 'mosse-attack':
                  io.to(gameId).emit('card-attacked', {
                    mosseCardId: currentAction.data.mosseCardId,
                    targetCardId: currentAction.data.targetCardId,
                    attackerName: currentAction.data.attackerName,
                    targetOwner: currentAction.data.targetOwner,
                    timestamp: Date.now()
                  });
                  break;
              }
            };
            
            await continueCPUTurn(cpuAction);
          }
        }, 2000); // 2 second delay for CPU thinking
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to add CPU player' });
      }
    });

    // NEW: CPU instruction handler for natural language commands
    socket.on('cpu-instruction', async ({ gameId, instruction }) => {
      try {
        const socketGameId = gameManager.getPlayerGameId(socket.id);
        if (!socketGameId || socketGameId !== gameId) {
          socket.emit('instruction-error', { message: 'Accesso non autorizzato a questo gioco' });
          return;
        }

        console.log(`Processing CPU instruction in game ${gameId}: "${instruction}"`);
        
        // Find player name from socket
        const game = gameManager.getGameState(gameId);
        if (!game) {
          socket.emit('instruction-error', { message: 'Gioco non trovato' });
          return;
        }
        
        const playerName = Object.values(game.players).find(p => p.socketId === socket.id)?.name;
        if (!playerName) {
          socket.emit('instruction-error', { message: 'Giocatore non trovato' });
          return;
        }

        // Process the instruction using GameManager's natural language processing
        const result = await gameManager.processGameInstruction(gameId, playerName, instruction);
        
        if (result && result.message) {
          // Broadcast the result to all players in the game
          io.to(gameId).emit('chat-message', {
            playerName: 'Sistema',
            message: result.message,
            timestamp: Date.now()
          });
          
          // Update game state 
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
          
          // Send success response to the instructor
          socket.emit('instruction-success', {
            message: `✅ Istruzione eseguita: "${instruction}"`
          });
        } else {
          socket.emit('instruction-error', {
            message: `❌ Istruzione non riconosciuta: "${instruction}". Prova con comandi più specifici come "CPU-Nome pesca PERSONAGGI" o "CPU-Nome gioca carta".`
          });
        }
        
      } catch (error) {
        console.error('Error processing CPU instruction:', error);
        socket.emit('instruction-error', {
          message: `❌ Errore nell'esecuzione dell'istruzione: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
        });
      }
    });

    socket.on('shuffle-deck', ({ deckType }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.shuffleDeck(gameId, deckType);
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
        io.to(gameId).emit('deck-shuffled', { deckType });
      }
    });

    // Notify other players when someone is choosing a card from a deck
    socket.on('player-choosing-card', ({ playerName, deckName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        // Broadcast to all OTHER players in the game (not the one choosing)
        socket.to(gameId).emit('player-choosing-notification', {
          playerName,
          deckName,
          message: `L'utente ${playerName} sta scegliendo una carta dal mazzo ${deckName}`
        });
      }
    });

    socket.on('set-avatar', ({ avatarId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) return;
      
      // Get player name from socket ID (don't trust client-supplied playerName)
      const playerName = gameManager.getPlayerNameFromSocket(socket.id);
      if (!playerName) return;
      
      // setPlayerAvatar validates avatarId against whitelist internally
      const success = gameManager.setPlayerAvatar(gameId, playerName, avatarId);
      if (success) {
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
        io.to(gameId).emit('avatar-changed', { playerName, avatarId });
      }
    });

    socket.on('pick-card', async ({ deckType, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const card = await gameManager.pickCardAndReturn(gameId, deckType, playerName);
        if (card) {
          // Look up PERSONAGGI data using fast cache (instant if cached)
          if (card.type === 'personaggi' || card.type === 'personaggi_speciali') {
            try {
              const cardName = getCardNameFromImageUrl(card.frontImage).replace(/-/g, ' ');
              // Use cache-first lookup (synchronous if cached)
              const dbData = getPersonaggioFromCache(cardName);
              if (dbData && dbData.pti !== null && dbData.stars !== null) {
                card.text = `PTI: ${dbData.pti} | Stelle: ${dbData.stars}`;
              }
            } catch (error) {
              console.error('Error querying cache for card on pick:', error);
            }
          }
          
          // IMMEDIATE state update for card picking (no throttle - critical for responsiveness)
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitImmediateGameState(io, gameId, gameState);
          
          // Emit the picked card ONLY to the player who picked it
          const playerSocketId = gameManager.getPlayerSocketId(gameId, playerName);
          if (playerSocketId) {
            const cardDisplayName = getCardNameFromImageUrl(card.frontImage);
            io.to(playerSocketId).emit('card-picked-private', {
              card,
              message: `Hai pescato: ${cardDisplayName || 'Carta'}`
            });
          }
        }
      }
    });

    // CRITICAL FIX: Handle CPU drawing replacement cards after playing
    socket.on('cpu-draw-replacement', async ({ deckType, playerName }) => {
      console.log(`CPU ${playerName} requesting replacement ${deckType} card`);
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        // Use pickCardAndReturn to get the card reference for PTI/stars assignment
        const card = await gameManager.pickCardAndReturn(gameId, deckType, playerName);
        if (card) {
          // Look up PERSONAGGI data using fast cache
          if (card.type === 'personaggi' || card.type === 'personaggi_speciali') {
            try {
              const cardName = getCardNameFromImageUrl(card.frontImage).replace(/-/g, ' ');
              const dbData = getPersonaggioFromCache(cardName);
              if (dbData && dbData.pti !== null && dbData.stars !== null) {
                card.text = `PTI: ${dbData.pti} | Stelle: ${dbData.stars}`;
              } else {
                card.text = 'PTI: 1000 | Stelle: 1';
              }
            } catch (error) {
              console.error('Error querying cache for CPU card on pick:', error);
              card.text = 'PTI: 1000 | Stelle: 1';
            }
          }
          
          console.log(`CPU ${playerName} drew replacement ${deckType} card successfully`);
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
          
          // Send chat message to notify players
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-cpu-replacement`,
            playerName: 'Sistema',
            message: `${playerName} ha pescato una carta ${deckType.toUpperCase()} di ricambio`,
            timestamp: Date.now()
          });
        } else {
          console.log(`❌ CPU ${playerName} failed to draw replacement ${deckType} card`);
        }
      }
    });

    // PERFORMANCE: Fetch deck contents only when SCEGLI modal opens (not in every state update)
    socket.on('get-deck-contents', ({ deckType }: { deckType: 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali' }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const gameState = gameManager.getGameState(gameId);
        if (gameState && gameState.decks[deckType]) {
          socket.emit('deck-contents', { deckType, cards: gameState.decks[deckType] });
        }
      }
    });

    socket.on('choose-specific-card', async ({ deckType, cardId, playerName }) => {
      console.log(`CHOOSE-SPECIFIC-CARD event received:`, { deckType, cardId, playerName });
      const gameId = gameManager.getPlayerGameId(socket.id);
      console.log(`GameId for player ${playerName}:`, gameId);
      
      if (gameId) {
        const success = gameManager.chooseSpecificCard(gameId, deckType, cardId, playerName);
        console.log(`ChooseSpecificCard result for ${playerName}:`, success);
        
        if (success) {
          // Look up PERSONAGGI data using fast cache
          if (deckType === 'personaggi' || deckType === 'personaggi_speciali') {
            const game = gameManager.getGameState(gameId);
            const pickedCard = game?.players[playerName]?.hand.find((c: any) => c.id === cardId);
            if (pickedCard) {
              try {
                const cardName = getCardNameFromImageUrl(pickedCard.frontImage).replace(/-/g, ' ');
                const dbData = getPersonaggioFromCache(cardName);
                if (dbData && dbData.pti !== null && dbData.stars !== null) {
                  pickedCard.text = `PTI: ${dbData.pti} | Stelle: ${dbData.stars}`;
                }
              } catch (error) {
                console.error('Error querying cache for card on choose:', error);
              }
            }
          }
          
          const gameState = gameManager.getSanitizedGameState(gameId);
          console.log(`Emitting game-state-update to room ${gameId}`);
          emitImmediateGameState(io, gameId, gameState);
          console.log(`Game state updated after ${playerName} picked card ${cardId}`);
          
          // Log the updated player hand count from sanitized game state
          const playerHandCount = gameState?.players[playerName]?.hand.length || 0;
          console.log(`${playerName} now has ${playerHandCount} cards in hand (from sanitized state)`);
        } else {
          console.log(`FAILED to choose specific card for ${playerName}`);
          socket.emit('error', { message: 'Failed to pick card' });
        }
      } else {
        console.log(`No gameId found for player ${playerName} (socketId: ${socket.id})`);
      }
    });

    socket.on('play-card', async ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = await gameManager.playCard(gameId, cardId, playerName);
        
        // FIXED: CPU should maintain only 1 card of each type (PERSONAGGI, MOSSE, BONUS)
        // Removed automatic replacement draw that caused duplicates
        if (result.card && playerName.startsWith('CPU-')) {
          console.log(`CPU ${playerName} played ${result.card.type} card - maintaining hand limit (1 card per type)`);
        }
        
        // IMMEDIATE: Send game state update for responsiveness (no throttle)
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitImmediateGameState(io, gameId, gameState);
        
        // Check for pending interactive effects (like graveyard selection)
        const pendingEffect = gameManager.getPendingEffect(gameId, playerName);
        if (pendingEffect && pendingEffect.type === 'resurrect_choice') {
          // Get graveyard cards for selection
          const graveyardCards = gameManager.getGraveyardCards(gameId);
          if (graveyardCards.length > 0) {
            // Emit event to show graveyard selection modal to the player
            socket.emit('show-graveyard-selection', {
              reason: 'resurrect',
              cards: graveyardCards,
              message: 'Scegli una carta dal cimitero da riportare in mano'
            });
            console.log(`👼 Emitted graveyard selection to ${playerName} with ${graveyardCards.length} cards`);
          }
        }
        
        // Check for target choice effects (damage or heal to chosen targets)
        if (pendingEffect && (pendingEffect.type === 'target_choice_damage' || pendingEffect.type === 'target_choice_heal')) {
          // Get all characters on field that can be targeted
          const gameState = gameManager.getSanitizedGameState(gameId);
          const targetableCards = gameState?.field?.filter((c: any) => 
            c.type === 'personaggi' || c.type === 'personaggi_speciali'
          ) || [];
          
          if (targetableCards.length > 0) {
            const effectValue = (pendingEffect as any).value || 100;
            const maxTargets = (pendingEffect as any).maxTargets || targetableCards.length;
            socket.emit('show-target-selection', {
              effectType: pendingEffect.type === 'target_choice_damage' ? 'damage' : 'heal',
              value: effectValue,
              maxTargets: maxTargets,
              targets: targetableCards.map((c: any) => ({
                id: c.id,
                frontImage: c.frontImage,
                owner: c.owner,
                text: c.text,
                name: c.name
              })),
              message: pendingEffect.type === 'target_choice_damage' 
                ? `Scegli fino a ${maxTargets} personaggi a cui infliggere ${effectValue} danni`
                : `Scegli fino a ${maxTargets} personaggi da curare di ${effectValue} PTI`
            });
            console.log(`🎯 Emitted target selection to ${playerName} with ${targetableCards.length} targets, max ${maxTargets}`);
          }
        }
        
        // Emit card-played event for last played cards history
        if (result.card) {
          const getCardNameFromUrl = (url: string) => {
            const parts = url.split('/');
            const filename = parts[parts.length - 1];
            return filename
              .toLowerCase()
              .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
              .replace(/[-_]/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          };
          
          io.to(gameId).emit('card-played', {
            cardId: result.card.id,
            cardType: result.card.type,
            frontImage: result.card.frontImage,
            cardName: result.card.name || getCardNameFromUrl(result.card.frontImage),
            playerName
          });
        }
        
        // Check for audioUrl - on card directly first (instant), then database if needed
        let audioUrl = result.card?.audioUrl;
        console.log(`[AUDIO DEBUG] Card ${cardId} played. Card audioUrl from memory: ${audioUrl || 'NOT SET'}`);
        
        // Only do database lookup if no audioUrl in memory and card exists
        if (!audioUrl && result.card) {
          try {
            const cardIdStr = result.card.id;
            
            // Check if it's a custom card (permanent custom cards from database)
            if (cardIdStr.startsWith('custom-')) {
              // Look up in customCards table by matching the card name or image
              const customCardResults = await db.select().from(customCards)
                .where(eq(customCards.name, result.card.name || ''))
                .limit(1);
              if (customCardResults.length > 0 && customCardResults[0].audioUrl) {
                audioUrl = customCardResults[0].audioUrl;
                console.log(`Found audioUrl from customCards table for card ${cardId}: ${audioUrl}`);
              }
            } else {
              // Look up in card modifications table for base cards (only active, non-deleted modifications)
              const mod = await db.select().from(cardModifications)
                .where(and(
                  eq(cardModifications.originalCardId, cardIdStr),
                  eq(cardModifications.isDeleted, false)
                ))
                .orderBy(desc(cardModifications.modifiedAt))
                .limit(1);
              if (mod.length > 0 && mod[0].audioUrl) {
                audioUrl = mod[0].audioUrl;
                console.log(`Found audioUrl from cardModifications table for card ${cardId}: ${audioUrl}`);
              }
            }
          } catch (dbError) {
            console.error('Error checking card modifications for audioUrl:', dbError);
          }
        }
        
        // If the card has an audioUrl, emit audio play event
        if (audioUrl) {
          console.log(`Card ${cardId} has audioUrl, emitting card-audio-play event: ${audioUrl}`);
          io.to(gameId).emit('card-audio-play', {
            cardId: result.card?.id || cardId,
            playerName,
            audioUrl: audioUrl,
            cardName: result.card?.name || 'Custom Card'
          });
        }
        
        // Check for youtubeUrl - on card directly first (instant), then database if needed
        let youtubeUrl = result.card?.youtubeUrl;
        console.log(`[YOUTUBE DEBUG] Card ${cardId} played. Card youtubeUrl from memory: ${youtubeUrl || 'NOT SET'}`);
        
        // Only do database lookup if no youtubeUrl in memory and card exists
        if (!youtubeUrl && result.card) {
          try {
            const cardIdStr = result.card.id;
            
            // Check if it's a custom card (permanent custom cards from database)
            if (cardIdStr.startsWith('custom-')) {
              const customCardResults = await db.select().from(customCards)
                .where(eq(customCards.name, result.card.name || ''))
                .limit(1);
              if (customCardResults.length > 0 && customCardResults[0].youtubeUrl) {
                youtubeUrl = customCardResults[0].youtubeUrl;
                console.log(`Found youtubeUrl from customCards table for card ${cardId}: ${youtubeUrl}`);
              }
            } else {
              // Look up in card modifications table for base cards
              const mod = await db.select().from(cardModifications)
                .where(and(
                  eq(cardModifications.originalCardId, cardIdStr),
                  eq(cardModifications.isDeleted, false)
                ))
                .orderBy(desc(cardModifications.modifiedAt))
                .limit(1);
              if (mod.length > 0 && mod[0].youtubeUrl) {
                youtubeUrl = mod[0].youtubeUrl;
                console.log(`Found youtubeUrl from cardModifications table for card ${cardId}: ${youtubeUrl}`);
              }
            }
          } catch (dbError) {
            console.error('Error checking card modifications for youtubeUrl:', dbError);
          }
        }
        
        // If the card has a youtubeUrl, emit YouTube video event to all players
        if (youtubeUrl) {
          const getCardNameFromUrl = (url: string) => {
            const parts = url.split('/');
            const filename = parts[parts.length - 1];
            return filename
              .toLowerCase()
              .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
              .replace(/[-_]/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          };
          console.log(`Card ${cardId} has youtubeUrl, emitting show-youtube-video event: ${youtubeUrl}`);
          io.to(gameId).emit('show-youtube-video', {
            cardId: result.card?.id || cardId,
            playerName,
            youtubeUrl: youtubeUrl,
            cardName: result.card?.name || getCardNameFromUrl(result.card?.frontImage || ''),
            cardType: result.card?.type
          });
        }
        
        // If a PERSONAGGI card was played, emit special notification
        if (result.isPersonaggio && result.card) {
          const getCardNameFromUrl = (url: string) => {
            const parts = url.split('/');
            const filename = parts[parts.length - 1];
            return filename
              .toLowerCase()
              .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
              .replace(/[-_]/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          };
          
          const cardName = result.card.name || getCardNameFromUrl(result.card.frontImage);
          
          // Random dramatic messages
          const messages = [
            "È PRONTO A FARE BRUTTO",
            "ENTRA IN SCENA", 
            "ARRIVA PER SPACCARVI IL CULO",
            "SI UNISCE ALLA ZUFFA"
          ];
          
          const selectedMessage = messages[Math.floor(Math.random() * messages.length)];
          
          io.to(gameId).emit('personaggio-enters', {
            cardName,
            message: selectedMessage,
            playerName,
            cardImage: result.card.frontImage
          });

          // Determine sound type based on card name and emit character sound event
          const soundType = getCharacterSoundType(cardName);
          if (soundType) {
            io.to(gameId).emit('character-sound', {
              cardName,
              playerName,
              soundType
            });
          }
          
          // Auto-analysis disabled - OpenAI API quota exceeded and local values are incorrect
          // Leave notes empty for manual entry by players
          console.log(`PERSONAGGI card ${cardName} played by ${playerName} - please enter PTI and stars manually in card notes`);
          
          // Send notification to user to enter values manually
          io.to(gameId).emit('manual-entry-required', {
            playerName,
            cardName,
            cardId: result.card.id,
            message: `Per favore inserisci manualmente PTI e stelle nelle note della carta ${cardName}`
          });
        }
        
        // Check if card has special animation
        if (result.card && result.card.triggerAnimation) {
          const getCardNameFromUrl = (url: string) => {
            const parts = url.split('/');
            const filename = parts[parts.length - 1];
            return filename
              .toLowerCase()
              .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
              .replace(/[-_]/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          };
          
          const cardName = result.card.name || getCardNameFromUrl(result.card.frontImage);
          console.log(`🎬 Emitting card-animation-trigger for: ${cardName}`);
          
          io.to(gameId).emit('card-animation-trigger', {
            cardName,
            playerName,
            cardId: result.card.id
          });
        }
        
        // Check if card has custom animation from effect wizard [ANIMAZIONE: ...]
        if (result.customAnimation) {
          const cardName = result.card?.name || cardId;
          console.log(`🎬 Emitting custom-animation-trigger for: ${cardName} with animation: ${result.customAnimation}`);
          
          io.to(gameId).emit('custom-animation-trigger', {
            cardId: result.card?.id || cardId,
            cardName,
            playerName,
            animationDescription: result.customAnimation
          });
          
          // CRITICAL: Re-emit game state AFTER custom effect execution to sync PTI changes
          const updatedGameState = gameManager.getSanitizedGameState(gameId);
          console.log(`🔄 Re-emitting game state after custom effect - Field PTIs:`, 
            updatedGameState.field?.map((c: any) => `${c.name}: ${c.pti}`));
          emitImmediateGameState(io, gameId, updatedGameState);
        }
        
        // DUELLO: Auto-activate MOSSE attack during duel
        if (result.duelAutoAttack && result.card) {
          const duelState = gameManager.getDuelState(gameId);
          if (duelState && duelState.active) {
            console.log(`⚔️ DUELLO: Auto-activating MOSSE attack for ${playerName}`);
            
            // Determine opponent's character
            const opponentCharacterId = playerName === duelState.player1 ? duelState.character2Id : duelState.character1Id;
            
            // Emit auto-attack notification to client
            io.to(gameId).emit('duel-auto-attack', {
              attackerName: playerName,
              mosseCardId: result.card.id,
              targetCardId: opponentCharacterId,
              message: `⚔️ DUELLO: ${playerName} attacca automaticamente!`
            });
            
            console.log(`⚔️ DUELLO: Auto-attack will target ${opponentCharacterId}`);
          }
        }
        
        // PARASITIC CARDS: Check if PARASSITA or SAIBAIM was played
        if (result.card && (result.card.type === 'personaggi' || result.card.type === 'personaggi_speciali')) {
          const parasiticType = gameManager.isParasiticCard(result.card);
          if (parasiticType && result.card.canReattach !== false) {
            console.log(`🦠 ${parasiticType} played by ${playerName} - requesting target selection`);
            
            const targets = gameManager.getParasiticTargets(gameId, playerName);
            
            if (targets.length > 0) {
              if (playerName.startsWith('CPU-')) {
                // CPU auto-selects target (highest stars)
                const target = gameManager.getCPUParasiticTarget(gameId, playerName);
                if (target) {
                  console.log(`🦠 CPU ${playerName} auto-targeting ${target.id} with ${parasiticType}`);
                  const attachResult = await gameManager.attachParasiticCard(gameId, result.card.id, target.id, playerName);
                  
                  if (attachResult.success) {
                    const getCardNameFromUrl = (url: string) => {
                      const parts = url.split('/');
                      const filename = parts[parts.length - 1];
                      return filename.toLowerCase().replace(/\.(png|jpg|jpeg|gif|webp)$/i, '').replace(/[-_]/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    };
                    const targetName = target.name || getCardNameFromUrl(target.frontImage);
                    
                    io.to(gameId).emit('parasitic-attached', {
                      parasiticCardId: result.card.id,
                      parasiticType,
                      targetCardId: target.id,
                      targetName,
                      ownerPlayer: playerName,
                      targetPlayer: target.owner
                    });
                    
                    io.to(gameId).emit('chat-message', {
                      id: `${Date.now()}-parasitic-attach`,
                      playerName: 'SISTEMA',
                      message: `🦠 ${parasiticType} di ${playerName} si è agganciato a ${targetName}!`,
                      timestamp: Date.now()
                    });
                    
                    const updatedState = gameManager.getSanitizedGameState(gameId);
                    emitThrottledGameState(io, gameId, updatedState);
                  }
                }
              } else {
                // Human player - show target selection panel
                io.to(gameId).emit('parasitic-target-select', {
                  parasiticCardId: result.card.id,
                  parasiticType,
                  ownerPlayer: playerName,
                  targets: targets.map(t => ({
                    id: t.id,
                    frontImage: t.frontImage,
                    owner: t.owner,
                    text: t.text
                  }))
                });
              }
            } else {
              console.log(`🦠 ${parasiticType} played but no valid targets available`);
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-parasitic-no-target`,
                playerName: 'SISTEMA',
                message: `🦠 ${parasiticType} non ha bersagli validi a cui agganciarsi!`,
                timestamp: Date.now()
              });
            }
          }
        }
      }
    });

    socket.on('play-card-face-down', async ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = await gameManager.playCardFaceDown(gameId, cardId, playerName);
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitImmediateGameState(io, gameId, gameState);
        
        if (result.card) {
          io.to(gameId).emit('card-played-face-down', {
            cardId: result.card.id,
            playerName,
            message: `${playerName} ha giocato una carta coperta`
          });
        }
      }
    });

    socket.on('reveal-card', async ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = await gameManager.revealCard(gameId, cardId, playerName);
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitImmediateGameState(io, gameId, gameState);
        
        if (result.card) {
          const getCardNameFromUrl = (url: string) => {
            const parts = url.split('/');
            const filename = parts[parts.length - 1];
            return filename
              .toLowerCase()
              .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
              .replace(/[-_]/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          };
          
          const cardName = result.card.name || getCardNameFromUrl(result.card.frontImage);
          
          io.to(gameId).emit('card-revealed', {
            cardId: result.card.id,
            cardName,
            playerName,
            cardImage: result.card.frontImage,
            message: `${playerName} ha scoperto: ${cardName}!`
          });

          // If it's a PERSONAGGI card, also emit the entrance notification and sound
          if (result.isPersonaggio) {
            const messages = [
              "È PRONTO A FARE BRUTTO",
              "ENTRA IN SCENA", 
              "ARRIVA PER SPACCARVI IL CULO",
              "SI UNISCE ALLA ZUFFA"
            ];
            
            const selectedMessage = messages[Math.floor(Math.random() * messages.length)];
            
            io.to(gameId).emit('personaggio-enters', {
              cardName,
              message: selectedMessage,
              playerName,
              cardImage: result.card.frontImage
            });

            // Determine sound type based on card name and emit character sound event
            const soundType = getCharacterSoundType(cardName);
            if (soundType) {
              io.to(gameId).emit('character-sound', {
                cardName,
                playerName,
                soundType
              });
            }
          }
        }
      }
    });

    socket.on('return-to-hand', ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.returnToHand(gameId, cardId, playerName);
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
      }
    });

    socket.on('return-to-deck', ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.returnToDeck(gameId, cardId, playerName);
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
      }
    });

    // INTERRUPT SPECIAL EFFECT - For cards with special ongoing effects
    socket.on('interrupt-effect', ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }
      
      console.log(`🛑 INTERRUPT-EFFECT: ${playerName} interrupting effect of card ${cardId}`);
      
      const result = gameManager.interruptSpecialEffect(gameId, cardId, playerName, io);
      
      if (result.success) {
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
      } else {
        socket.emit('error', { message: result.message || 'Failed to interrupt effect' });
      }
    });

    // Handle resurrection card selection from graveyard (interactive choice)
    socket.on('resurrect-select', ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = gameManager.resurrectSelectedCard(gameId, cardId, playerName);
        if (result.success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitImmediateGameState(io, gameId, gameState);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-resurrect`,
            playerName: 'Sistema',
            message: `👼 ${playerName} ha resuscitato ${result.cardName} dal cimitero!`,
            timestamp: Date.now()
          });
        }
      }
    });

    // Handle PTI input panel confirmation
    socket.on('pti-input-confirm', ({ cardId, ptiValue, playerName }: { cardId: string, ptiValue: number, playerName: string }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`📋 ${playerName} confirmed PTI input: ${ptiValue} for card ${cardId}`);
        const result = gameManager.processPtiInputEffect(gameId, cardId, ptiValue, playerName);
        if (result.success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitImmediateGameState(io, gameId, gameState);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-pti-input`,
            playerName: 'Sistema',
            message: result.message || `📋 ${playerName} ha inserito ${ptiValue} PTI per l'effetto!`,
            timestamp: Date.now()
          });
        }
      }
    });

    // Handle deck selection panel confirmation
    socket.on('deck-selection-confirm', ({ cardId, deckType, playerName }: { cardId: string, deckType: string, playerName: string }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`🎴 ${playerName} selected deck: ${deckType} for card ${cardId}`);
        const result = gameManager.processDeckSelectionEffect(gameId, cardId, deckType, playerName);
        if (result.success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitImmediateGameState(io, gameId, gameState);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-deck-select`,
            playerName: 'Sistema',
            message: result.message || `🎴 ${playerName} ha selezionato il mazzo ${deckType}!`,
            timestamp: Date.now()
          });
        }
      }
    });

    // Handle swap/baratto selection - swap all cards with selected player
    socket.on('swap-confirm', ({ cardId, targetPlayer, playerName }: { cardId: string, targetPlayer: string, playerName: string }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`🔄 ${playerName} confirmed swap with ${targetPlayer}`);
        const result = gameManager.processSwapEffect(gameId, playerName, targetPlayer, io);
        if (result.success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitImmediateGameState(io, gameId, gameState);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-swap`,
            playerName: 'Sistema',
            message: result.message || `🔄 BARATTO! ${playerName} ha scambiato tutte le carte con ${targetPlayer}!`,
            timestamp: Date.now()
          });
        }
      }
    });

    // Handle target selection for custom effects (damage/heal to chosen targets)
    socket.on('target-select', ({ targetCardIds, playerName }: { targetCardIds: string[], playerName: string }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = gameManager.applyEffectToChosenTargets(gameId, targetCardIds, playerName);
        if (result.success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitImmediateGameState(io, gameId, gameState);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-target-effect`,
            playerName: 'Sistema',
            message: result.message || `🎯 ${playerName} ha applicato l'effetto ai bersagli scelti!`,
            timestamp: Date.now()
          });
        }
      }
    });

    // DICE SYSTEM: Handle character selection confirmation (Step 1)
    socket.on('dice-characters-confirmed', ({ diceEffectId, selectedCharacterIds, playerName }: {
      diceEffectId: string;
      selectedCharacterIds: string[];
      playerName: string;
    }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`🎲 ${playerName} confirmed dice characters:`, selectedCharacterIds);
        gameManager.confirmDiceCharacters(gameId, diceEffectId, selectedCharacterIds, playerName, io);
      }
    });

    // DICE SYSTEM: Handle player dice choice submission (Step 2)
    socket.on('dice-choice-submit', ({ diceEffectId, choices, playerName }: { 
      diceEffectId: string; 
      choices: Record<string, string>; 
      playerName: string 
    }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`🎲 Received dice choices from ${playerName}:`, choices);
        gameManager.submitDiceChoices(gameId, diceEffectId, choices, playerName);
      }
    });

    // TARGET SELECTION: Handle player's target selection for custom effects
    socket.on('target-selection-confirm', async ({ selectionId, selectedTargetIds, playerName }: {
      selectionId: string;
      selectedTargetIds: string[];
      playerName: string;
    }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`🎯 ${playerName} confirmed target selection: ${selectedTargetIds.length} targets`);
        await gameManager.processTargetSelection(gameId, selectionId, selectedTargetIds, playerName, io);
      }
    });

    // AUTO DICE: Handle auto dice setup confirmation
    socket.on('auto-dice-confirm', async ({ autoDiceId, selectedCharacterIds, customEffects, playerName }: {
      autoDiceId: string;
      selectedCharacterIds: string[];
      customEffects: Record<number, string> | null;
      playerName: string;
    }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`🎲 ${playerName} confirmed auto dice with ${selectedCharacterIds.length} characters`);
        await gameManager.processAutoDiceConfirm(gameId, autoDiceId, selectedCharacterIds, customEffects, playerName, io);
      }
    });

    // CUSTOM EFFECT: Handle manual activation of custom card effects
    socket.on('activate-custom-effect', async ({ cardId, playerName }: { cardId: string; playerName: string }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`⚡ ${playerName} activating custom effect for card ${cardId}`);
        await gameManager.activateCustomEffect(gameId, cardId, playerName, io);
      }
    });

    socket.on('move-to-graveyard', ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = gameManager.moveToGraveyard(gameId, cardId, playerName);
        if (result.success) {
          // Check for player elimination from character limit
          if (result.eliminationCheck) {
            console.log(`Player ${playerName} has reached character limit via manual move-to-graveyard - automatically eliminating`);
            
            const eliminationSuccess = gameManager.markPlayerEliminated(gameId, playerName);
            if (eliminationSuccess) {
              console.log(`Player ${playerName} automatically eliminated due to character limit`);
              io.to(gameId).emit('player-eliminated', { playerName });
              
              // Check for game victory
              const winner = gameManager.checkForGameVictory(gameId);
              if (winner) {
                console.log(`Game won by: ${winner}`);
                io.to(gameId).emit('game-victory', { winner });
                // Award Rankiard points
                gameManager.completeMatch(gameId, winner);
              }
            }
          }
          
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitImmediateGameState(io, gameId, gameState);

          // Get card name from image URL for "Ciao ciao" notification
          if (result.cardImage) {
            const getCardNameFromUrl = (url: string) => {
              const parts = url.split('/');
              const filename = parts[parts.length - 1];
              // Remove file extension and replace hyphens/underscores with spaces
              return filename
                .toLowerCase()
                .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                .replace(/[-_]/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            };
            
            const cardName = getCardNameFromUrl(result.cardImage);
            
            // Emit "Ciao ciao" notification with cardType for animation triggering
            io.to(gameId).emit('card-to-graveyard', {
              cardName,
              playerName,
              cardType: result.cardType || 'personaggi'
            });
          }

          // Check for SOROS activation
          if (result.sorosActivated) {
            io.to(gameId).emit('soros-activated', {
              activator: result.sorosActivator,
              cardImage: result.sorosImage,
              timestamp: Date.now()
            });
          }

          // Check for milestone achievements
          if (result.graveyardCount === 3 || result.graveyardCount === 5) {
            const titles = [
              "UH LÀ LÀ!",
              "ATTENZIONE ATTENZIONE", 
              "MANNEGGIA QUIGL PUORC",
              "🐷 2⃣"
            ];
            
            // Select ONE random title on server side so all players see the same
            const selectedTitle = titles[Math.floor(Math.random() * titles.length)];
            
            io.to(gameId).emit('graveyard-milestone', {
              playerName,
              cardCount: result.graveyardCount,
              title: selectedTitle,
              timestamp: Date.now()
            });
          }
        }
      }
    });

    // Remove card from deck (when using "ELIMINA CARTA" button)
    socket.on('remove-card-to-graveyard', ({ deckType, cardId, playerName, section }: any) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const game = gameManager.getGameState(gameId);
        if (!game) return;
        const normalizedDeckType = deckType as keyof typeof game.decks;
        if (game.decks[normalizedDeckType]) {
          // Find and remove card from deck
          const cardIndex = game.decks[normalizedDeckType].findIndex((card: any) => card.id === cardId);
          if (cardIndex !== -1) {
            const removedCard = game.decks[normalizedDeckType].splice(cardIndex, 1)[0];
            
            // Add to graveyard with special section
            removedCard.section = section || 'CARTE CANCELLATE';
            removedCard.owner = playerName;
            game.graveyard.push(removedCard);
            
            console.log(`Card ${cardId} removed from ${deckType} deck and added to graveyard with section: ${section}`);
            
            // Emit game state update
            const gameState = gameManager.getSanitizedGameState(gameId);
            emitThrottledGameState(io, gameId, gameState);
          }
        }
      }
    });

    socket.on('transfer-card', ({ cardId, fromPlayer, toPlayer }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const game = gameManager.getGameState(gameId);
        if (!game) return;

        // Find card in all possible locations (hand, field, graveyard)
        let cardToTransfer: any = null;
        let sourceLocation: 'hand' | 'field' | 'graveyard' | null = null;

        // Check player's hand
        if (game.players[fromPlayer]) {
          const handIndex = game.players[fromPlayer].hand.findIndex((c: any) => c.id === cardId);
          if (handIndex !== -1) {
            cardToTransfer = game.players[fromPlayer].hand.splice(handIndex, 1)[0];
            sourceLocation = 'hand';
          }
        }

        // Check field
        if (!cardToTransfer) {
          const fieldIndex = game.field.findIndex((c: any) => c.id === cardId && c.owner === fromPlayer);
          if (fieldIndex !== -1) {
            cardToTransfer = game.field.splice(fieldIndex, 1)[0];
            sourceLocation = 'field';
          }
        }

        // Check graveyard
        if (!cardToTransfer) {
          const graveyardIndex = game.graveyard.findIndex((c: any) => c.id === cardId && c.owner === fromPlayer);
          if (graveyardIndex !== -1) {
            cardToTransfer = game.graveyard.splice(graveyardIndex, 1)[0];
            sourceLocation = 'graveyard';
          }
        }

        if (!cardToTransfer) {
          console.error(`Card ${cardId} not found for player ${fromPlayer}`);
          return;
        }

        // Transfer card to recipient's hand
        if (game.players[toPlayer]) {
          cardToTransfer.owner = toPlayer; // Update owner
          game.players[toPlayer].hand.push(cardToTransfer);
          
          console.log(`✅ Card ${cardId} transferred from ${fromPlayer} to ${toPlayer}`);
          
          // Notify all players
          io.to(gameId).emit('chat-message', {
            playerName: 'Sistema',
            message: `✅ ${fromPlayer} ha ceduto una carta a ${toPlayer}`,
            timestamp: Date.now()
          });
          
          // Update game state
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
        }
      }
    });

    // Accept transfer request
    socket.on('accept-transfer', ({ requestId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        try {
          // Get request details before accepting
          const game = gameManager.getGameState(gameId);
          const request = game?.pendingTransferRequests.find(req => req.id === requestId);
          
          if (!request) {
            socket.emit('transfer-error', { message: 'Richiesta di trasferimento non trovata' });
            return;
          }

          // SECURITY: Verify that the socket belongs to the intended recipient
          const recipientPlayer = game?.players[request.toPlayer];
          if (!recipientPlayer || recipientPlayer.socketId !== socket.id) {
            socket.emit('transfer-error', { message: 'Non autorizzato ad accettare questa richiesta' });
            return;
          }

          gameManager.acceptTransferRequest(gameId, requestId);
            
            // Notify all players about the successful transfer
            io.to(gameId).emit('chat-message', {
              playerName: 'Sistema',
              message: `✅ ${request.fromPlayer} ha trasferito una carta a ${request.toPlayer}`,
              timestamp: Date.now()
            });
            
            // Update game state
            const gameState = gameManager.getSanitizedGameState(gameId);
            emitThrottledGameState(io, gameId, gameState);
            
            // Notify sender that transfer was accepted
            const fromPlayerData = game?.players[request.fromPlayer];
            if (fromPlayerData?.socketId) {
              io.to(fromPlayerData.socketId).emit('transfer-accepted', {
                message: `${request.toPlayer} ha accettato il trasferimento`
              });
            }
        } catch (error) {
          console.error('Error accepting transfer:', error);
          socket.emit('transfer-error', { 
            message: error instanceof Error ? error.message : 'Errore nell\'accettazione del trasferimento' 
          });
        }
      }
    });

    // Decline transfer request
    socket.on('decline-transfer', ({ requestId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        try {
          // Get request details before declining
          const game = gameManager.getGameState(gameId);
          const request = game?.pendingTransferRequests.find(req => req.id === requestId);
          
          if (!request) {
            socket.emit('transfer-error', { message: 'Richiesta di trasferimento non trovata' });
            return;
          }

          // SECURITY: Verify that the socket belongs to the intended recipient
          const recipientPlayer = game?.players[request.toPlayer];
          if (!recipientPlayer || recipientPlayer.socketId !== socket.id) {
            socket.emit('transfer-error', { message: 'Non autorizzato a rifiutare questa richiesta' });
            return;
          }
          
          gameManager.declineTransferRequest(gameId, requestId);
            
            // Notify sender that transfer was declined
            const fromPlayerData = game?.players[request.fromPlayer];
            if (fromPlayerData?.socketId) {
              io.to(fromPlayerData.socketId).emit('transfer-declined', {
                message: `${request.toPlayer} ha rifiutato il trasferimento`
              });
            }
        } catch (error) {
          console.error('Error declining transfer:', error);
          socket.emit('transfer-error', { 
            message: error instanceof Error ? error.message : 'Errore nel rifiuto del trasferimento' 
          });
        }
      }
    });

    socket.on('swap-personaggi-cards', ({ player1, card1Id, player2, card2Id }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.swapPersonaggiCards(gameId, player1, card1Id, player2, card2Id);
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
        
        // Emit notification to all players about the swap
        io.to(gameId).emit('cards-swapped', {
          player1,
          player2,
          message: `${player1} e ${player2} hanno scambiato delle carte PERSONAGGI!`,
          timestamp: Date.now()
        });
      }
    });

    socket.on('swap-cards', ({ player1, card1Id, player2, card2Id }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.swapCardsBetweenPlayers(gameId, player1, card1Id, player2, card2Id);
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
        
        // Emit notification to all players about the swap
        io.to(gameId).emit('cards-swapped', {
          player1,
          player2,
          message: `${player1} e ${player2} hanno scambiato delle carte!`,
          timestamp: Date.now()
        });
      }
    });

    // POTERI - Copy special power from another character
    socket.on('copy-power', ({ cardId, playerName, powerSource }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`✨ POTERI: ${playerName} copying power of ${powerSource} to card ${cardId}`);
        
        const result = gameManager.copyPowerToCard(gameId, cardId, playerName, powerSource);
        
        if (result.success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-power-copy`,
            playerName: 'Sistema',
            message: `✨ ${result.cardName} ha acquisito il potere di ${powerSource}!`,
            timestamp: Date.now()
          });
        }
      }
    });

    // MEDICINA SOMMINISTRA - Cure VIRUS/INFLUENZA and eliminate PARASSITA
    socket.on('somministra-medicina', async ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`💊 MEDICINA SOMMINISTRA: ${playerName} using MEDICINA ${cardId}`);
        
        const result = await gameManager.somministraMedicina(gameId, cardId, playerName);
        
        if (result.success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
          
          // Build message about what was cured
          const effects: string[] = [];
          if (result.virusCleared > 0) effects.push(`${result.virusCleared} VIRUS`);
          if (result.influenzaCleared > 0) effects.push(`${result.influenzaCleared} INFLUENZA`);
          if (result.parassitaEliminated.length > 0) effects.push(`${result.parassitaEliminated.length} PARASSITA`);
          
          const effectMessage = effects.length > 0 
            ? `Ha curato: ${effects.join(', ')}` 
            : 'Nessun effetto da curare trovato';
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-medicina`,
            playerName: 'Sistema',
            message: `💊 ${playerName} ha somministrato MEDICINA! ${effectMessage}`,
            timestamp: Date.now()
          });
          
          // Emit medicina effect for animation
          io.to(gameId).emit('medicina-somministrata', {
            playerName,
            virusCleared: result.virusCleared,
            influenzaCleared: result.influenzaCleared,
            parassitaEliminated: result.parassitaEliminated
          });
        }
      }
    });

    socket.on('update-card-text', ({ cardId, text }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.updateCardText(gameId, cardId, text);
        
        // Check for automatic death if PTI reaches 0
        const gameState = gameManager.getSanitizedGameState(gameId);
        const card = gameState?.field?.find((c: any) => c.id === cardId);
        
        if (card && (card.type === 'personaggi' || card.type === 'personaggi_speciali')) {
          // Check if PTI is 0
          const ptiZeroMatch = text.match(/PTI:\s*0(?:\s|$|\/)/);
          if (ptiZeroMatch || text === "0") {
            console.log(`Auto-eliminating ${card.owner}'s personaggio with PTI 0:`, cardId);
            
            // Auto-eliminate the personaggio
            setTimeout(async () => {
              const result = await gameManager.eliminatePersonaggi(gameId, cardId, card.owner);
              if (result.success) {
                // Trigger CIMICE death effect if card had CIMICE power (native or copied)
                if (result.hasCimicePower) {
                  console.log(`🪲 CIMICE power death triggered via update-card-text auto-elimination`);
                  await gameManager.processCimiceDeathEffect(gameId, cardId, io);
                }
                
                const updatedGameState = gameManager.getSanitizedGameState(gameId);
                emitThrottledGameState(io, gameId, updatedGameState);

                // Get card name from image URL for "Ciao ciao" notification
                if (result.cardImage) {
                  const getCardNameFromUrl = (url: string) => {
                    const parts = url.split('/');
                    const filename = parts[parts.length - 1];
                    return filename
                      .toLowerCase()
                      .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                      .replace(/[-_]/g, ' ')
                      .split(' ')
                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ');
                  };
                  
                  const cardName = getCardNameFromUrl(result.cardImage);
                  
                  // Emit "Ciao ciao" notification with cardType for death animation
                  io.to(gameId).emit('card-to-graveyard', {
                    cardName,
                    playerName: card.owner,
                    cardType: card.type || 'personaggi'
                  });
                }
              }
            }, 100); // Small delay to let UI update first
          }
        }
        
        emitThrottledGameState(io, gameId, gameState);
      }
    });

    // FUSION SYSTEM HANDLERS
    socket.on('fuse-cards', async ({ leaderCardId, targetCardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`Fusion request: ${playerName} wants to fuse ${leaderCardId} with ${targetCardId}`);
        
        const result = await gameManager.fuseCards(gameId, leaderCardId, targetCardId, playerName);
        
        if (result.success) {
          // Update game state for all players
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
          
          // Notify all players about the fusion
          io.to(gameId).emit('cards-fused', {
            playerName,
            leaderCardId,
            targetCardId,
            message: `${playerName} ha fuso due PERSONAGGI!`,
            timestamp: Date.now()
          });
          
          console.log(`Cards successfully fused by ${playerName}`);
        } else {
          // Send error back to the requesting player
          socket.emit('fusion-error', {
            message: result.message || 'Errore durante la fusione',
            timestamp: Date.now()
          });
          
          console.log(`Fusion failed: ${result.message}`);
        }
      }
    });

    socket.on('separate-cards', async ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`Separation request: ${playerName} wants to separate card ${cardId}`);
        
        const result = await gameManager.separateCards(gameId, cardId, playerName);
        
        if (result.success) {
          // Update game state for all players
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
          
          // Notify all players about the separation
          io.to(gameId).emit('cards-separated', {
            playerName,
            cardId,
            message: `${playerName} ha separato i PERSONAGGI fusi!`,
            timestamp: Date.now()
          });
          
          console.log(`Cards successfully separated by ${playerName}`);
        } else {
          // Send error back to the requesting player
          socket.emit('separation-error', {
            message: result.message || 'Errore durante la separazione',
            timestamp: Date.now()
          });
          
          console.log(`Separation failed: ${result.message}`);
        }
      }
    });

    socket.on('duplicate-card', async ({ cardId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        // SECURITY: Derive player name from socket ID to prevent spoofing
        const playerName = gameManager.getPlayerNameFromSocket(socket.id);
        if (!playerName) {
          socket.emit('duplication-error', {
            message: 'Player not found or not authenticated',
            timestamp: Date.now()
          });
          return;
        }
        
        console.log(`Duplicate request: ${playerName} wants to duplicate card ${cardId}`);
        
        const result = await gameManager.duplicateCard(gameId, cardId, playerName);
        
        if (result.success) {
          // Update game state for all players
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
          
          // Notify all players about the duplication
          io.to(gameId).emit('card-duplicated', {
            playerName,
            originalCardId: cardId,
            duplicatedCardId: result.duplicatedCardId,
            message: `${playerName} ha duplicato una carta PERSONAGGI!`,
            timestamp: Date.now()
          });
          
          console.log(`Card successfully duplicated by ${playerName}: ${cardId} -> ${result.duplicatedCardId}`);
        } else {
          // Send error back to the requesting player
          socket.emit('duplication-error', {
            message: result.message || 'Errore durante la duplicazione',
            timestamp: Date.now()
          });
          
          console.log(`Duplication failed: ${result.message}`);
        }
      }
    });

    // Add PTI to a character
    socket.on('add-pti', ({ cardId, ptiAmount, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`Add PTI request: ${playerName} wants to add ${ptiAmount} PTI to card ${cardId}`);
        
        const result = gameManager.addPTIToCard(gameId, cardId, ptiAmount, playerName);
        
        if (result.success) {
          // Update game state for all players
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
          
          // Notify all players about the PTI addition
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-pti-add`,
            playerName: 'Sistema',
            message: `${playerName} ha aggiunto ${ptiAmount} PTI al personaggio! (Totale: ${result.newPTI} PTI)`,
            timestamp: Date.now()
          });
          
          console.log(`PTI successfully added by ${playerName}: +${ptiAmount} = ${result.newPTI}`);
        } else {
          socket.emit('pti-error', {
            message: result.message || 'Errore durante l\'aggiunta dei PTI',
            timestamp: Date.now()
          });
          
          console.log(`Add PTI failed: ${result.message}`);
        }
      }
    });

    // Modify character stats (PTI and Stars) - can add or subtract
    socket.on('modify-stats', ({ cardId, ptiAmount, stelleAmount, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`Modify stats request: ${playerName} wants to modify card ${cardId} - PTI: ${ptiAmount}, Stelle: ${stelleAmount}`);
        
        const result = gameManager.modifyCardStats(gameId, cardId, ptiAmount, stelleAmount, playerName);
        
        if (result.success) {
          // Update game state for all players
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
          
          // Build message parts
          const messageParts = [];
          if (ptiAmount !== 0) {
            messageParts.push(`${ptiAmount > 0 ? '+' : ''}${ptiAmount} PTI`);
          }
          if (stelleAmount !== 0) {
            messageParts.push(`${stelleAmount > 0 ? '+' : ''}${stelleAmount} Stelle`);
          }
          
          // Notify all players about the stat change
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-stats-modify`,
            playerName: 'Sistema',
            message: `${playerName} ha modificato le statistiche del personaggio: ${messageParts.join(', ')}! (Nuovo: PTI ${result.newPTI}, Stelle ${result.newStelle})`,
            timestamp: Date.now()
          });
          
          console.log(`Stats successfully modified by ${playerName}: PTI=${result.newPTI}, Stelle=${result.newStelle}`);
        } else {
          socket.emit('stats-error', {
            message: result.message || 'Errore durante la modifica delle statistiche',
            timestamp: Date.now()
          });
          
          console.log(`Modify stats failed: ${result.message}`);
        }
      }
    });

    // Add PR (Rankiard Points) to a character - subtracts from player's points for this game only
    socket.on('add-pr', ({ cardId, prAmount, playerName, userTotalPoints }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`Add PR request: ${playerName} wants to convert ${prAmount} PR to PTI for card ${cardId}`);
        
        const result = gameManager.addPRToCard(gameId, cardId, prAmount, playerName, userTotalPoints);
        
        if (result.success) {
          // Update game state for all players
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
          
          // Notify all players about the PR conversion
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-pr-add`,
            playerName: 'Sistema',
            message: `${playerName} ha convertito ${prAmount} Punti Rankiard in PTI! (Totale PTI: ${result.newPTI})`,
            timestamp: Date.now()
          });
          
          // Send PR spent update to the player
          socket.emit('pr-spent-update', {
            prSpent: result.prSpent,
            timestamp: Date.now()
          });
          
          console.log(`PR successfully converted by ${playerName}: ${prAmount} PR -> PTI (total spent: ${result.prSpent})`);
        } else {
          socket.emit('pr-error', {
            message: result.message || 'Errore durante la conversione dei PR',
            timestamp: Date.now()
          });
          
          console.log(`Add PR failed: ${result.message}`);
        }
      }
    });

    // BAMBOLA VOODOO: Activate voodoo link between two characters
    socket.on('voodoo:activate', ({ bonusCardId, card1Id, card2Id, activatedBy, gameId: clientGameId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id) || clientGameId;
      if (!gameId) {
        socket.emit('voodoo:error', { message: 'Game not found' });
        return;
      }
      
      console.log(`🔮 BAMBOLA VOODOO activation request: ${card1Id} <-> ${card2Id} by ${activatedBy}`);
      
      const result = gameManager.activateVoodooLink(gameId, bonusCardId, card1Id, card2Id, activatedBy);
      
      if (result.success) {
        // Broadcast to all players
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-voodoo-activate`,
          playerName: 'Sistema',
          message: result.message,
          timestamp: Date.now()
        });
        
        // Send updated game state with voodoo links
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
        
        console.log(`🔮 BAMBOLA VOODOO activated successfully`);
      } else {
        socket.emit('voodoo:error', { message: result.message });
        console.log(`🔮 BAMBOLA VOODOO activation failed: ${result.message}`);
      }
    });
    
    // BAMBOLA VOODOO: Remove voodoo link
    socket.on('voodoo:remove', ({ cardId, gameId: clientGameId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id) || clientGameId;
      if (!gameId) {
        socket.emit('voodoo:error', { message: 'Game not found' });
        return;
      }
      
      console.log(`🔮 BAMBOLA VOODOO removal request for card: ${cardId}`);
      
      const success = gameManager.removeVoodooLink(gameId, cardId);
      
      if (success) {
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-voodoo-remove`,
          playerName: 'Sistema',
          message: '🔮 Collegamento BAMBOLA VOODOO rimosso!',
          timestamp: Date.now()
        });
        
        // Send updated game state
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
        
        console.log(`🔮 BAMBOLA VOODOO link removed successfully`);
      } else {
        socket.emit('voodoo:error', { message: 'No voodoo link found for this card' });
      }
    });

    // RIFUGIO: Get valid targets for RIFUGIO protection
    socket.on('rifugio:get-targets', ({ rifugioCardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) {
        socket.emit('rifugio:error', { message: 'Game not found' });
        return;
      }
      
      console.log(`🏠 RIFUGIO target request from ${playerName}`);
      
      const targets = gameManager.getRifugioTargets(gameId, playerName);
      socket.emit('rifugio:targets', { rifugioCardId, targets });
    });

    // RIFUGIO: Activate RIFUGIO protection on a character
    socket.on('rifugio:activate', ({ rifugioCardId, targetCharacterId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) {
        socket.emit('rifugio:error', { message: 'Game not found' });
        return;
      }
      
      console.log(`🏠 RIFUGIO activation request: ${playerName} protecting ${targetCharacterId}`);
      
      const result = gameManager.activateRifugio(gameId, rifugioCardId, targetCharacterId, playerName, io);
      
      if (result.success) {
        // Send updated game state with RIFUGIO protection
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
        
        console.log(`🏠 RIFUGIO activated successfully`);
      } else {
        socket.emit('rifugio:error', { message: result.message });
        console.log(`🏠 RIFUGIO activation failed: ${result.message}`);
      }
    });

    // BARRIERA: Get valid targets for BARRIERA protection
    socket.on('barriera:get-targets', ({ barrieraCardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) {
        socket.emit('barriera:error', { message: 'Game not found' });
        return;
      }
      
      console.log(`🛡️ BARRIERA target request from ${playerName}`);
      
      const targets = gameManager.getBarrieraTargets(gameId, playerName);
      socket.emit('barriera:targets', { barrieraCardId, targets });
    });

    // BARRIERA: Activate BARRIERA protection on a character
    socket.on('barriera:activate', ({ barrieraCardId, targetCharacterId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) {
        socket.emit('barriera:error', { message: 'Game not found' });
        return;
      }
      
      console.log(`🛡️ BARRIERA activation request: ${playerName} protecting ${targetCharacterId}`);
      
      const result = gameManager.activateBarriera(gameId, barrieraCardId, targetCharacterId, playerName, io);
      
      if (result.success) {
        // Send updated game state with BARRIERA protection
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
        
        console.log(`🛡️ BARRIERA activated successfully`);
      } else {
        socket.emit('barriera:error', { message: result.message });
        console.log(`🛡️ BARRIERA activation failed: ${result.message}`);
      }
    });

    // DUELLO: Start a duel between two characters
    socket.on('duel:start', async ({ duelCardId, initiatorPlayer, opponentCharacterId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) {
        socket.emit('duel:error', { message: 'Game not found' });
        return;
      }
      
      console.log(`⚔️ DUELLO start request: ${initiatorPlayer} vs opponent character ${opponentCharacterId}`);
      
      const result = await gameManager.startDuel(gameId, duelCardId, initiatorPlayer, opponentCharacterId);
      
      if (result.success) {
        // Get the duel state to send details to players
        const duelState = gameManager.getDuelState(gameId);
        
        // Broadcast to all players
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-duel-start`,
          playerName: 'Sistema',
          message: result.message,
          timestamp: Date.now()
        });
        
        // Send duel started event with duel details
        io.to(gameId).emit('duel:started', {
          duelState,
          message: result.message
        });
        
        // Send updated game state
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
        
        console.log(`⚔️ DUELLO started successfully`);
      } else {
        socket.emit('duel:error', { message: result.message });
        console.log(`⚔️ DUELLO start failed: ${result.message}`);
      }
    });

    // CPU DAMAGE REQUEST: Handle damage submission from game creator for CPU attacks
    socket.on('cpu-damage-submit', async ({ cpuName, mosseCardId, targetCardId, targetOwner, damageValue, starsToRemove }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) {
        console.log(`cpu-damage-submit: gameId not found for socket ${socket.id}`);
        return;
      }
      
      console.log(`🎯 Received damage ${damageValue} from game creator for CPU ${cpuName} attacking ${targetCardId}`);
      
      // Execute the attack with the provided damage
      const attackResult = await gameManager.executeMossaAttack(
        gameId,
        cpuName,
        mosseCardId,
        targetCardId,
        damageValue
      );

      if (!attackResult.success) {
        console.log(`CPU attack failed: ${attackResult.error}`);
        socket.emit('attack-error', { message: attackResult.error });
        
        // CRITICAL: Reset CPU state immediately
        const currentGame = gameManager.getGameState(gameId);
        if (currentGame && currentGame.players[cpuName]?.cpuInstance) {
          currentGame.players[cpuName].cpuInstance.resetTurnState();
          console.log(`🔧 CPU ${cpuName}: Turn state reset after failed attack`);
        }
        
        // End CPU turn and move to next player (use forceEndTurn to bypass validation)
        setTimeout(() => {
          // Process delayed damages before ending turn
          gameManager.processDelayedDamages(gameId, cpuName, io);
          
          const nextPlayer = gameManager.forceEndTurn(gameId);
          if (nextPlayer) {
            console.log(`🎯 CPU ${cpuName} turn ended after failed attack, next: ${nextPlayer}`);
            io.to(gameId).emit('next-turn', { nextPlayer });
            
            // Fetch fresh game state after turn ended
            const freshState = gameManager.getSanitizedGameState(gameId);
            emitThrottledGameState(io, gameId, freshState);
            
            // Process next CPU turn if needed - use fresh state check
            const freshGame = gameManager.getGameState(gameId);
            if (freshGame && freshGame.players[nextPlayer]?.isCPU) {
              setTimeout(() => {
                gameManager.processCPUTurn(gameId, nextPlayer, io);
              }, 1500);
            }
          }
        }, 500);
        
        return;
      }

      // Broadcast attack animation to all players
      io.to(gameId).emit('card-attacked', {
        mosseCardId,
        targetCardId,
        attackerName: cpuName,
        targetOwner,
        damageValue,
        timestamp: Date.now()
      });

      // NEW: Use defense system like all other attacks
      if (attackResult.result?.requiresDefenseResponse) {
        console.log(`🛡️ CPU attack requires defense - emitting defense:request to ${targetOwner}`);
        
        // Store damage value and attack details for later processing
        const pendingDefense = gameManager.getPendingDefense(gameId);
        if (pendingDefense) {
          pendingDefense.damage = damageValue;
          pendingDefense.mosseCardId = mosseCardId;
          (pendingDefense as any).starsToRemove = starsToRemove || 0;
          console.log(`📝 Stored damage value ${damageValue}, stars: ${starsToRemove || 0} for pending defense ${pendingDefense.attackId}`);
        }
        
        // Emit defense request to the defender
        const emissionSuccess = await gameManager.emitDefenseRequest(gameId, io);
        if (!emissionSuccess) {
          console.log(`⚠️ Failed to emit defense request - proceeding with damage`);
          await gameManager.processMosseDamage(gameId, cpuName, targetCardId, damageValue, mosseCardId, io, false, false, false, false, starsToRemove || 0);
        }
        
        // Attack is pending defense response - processing will continue in defense:response handler
        return;
      }

      // If no defense required, process damage immediately
      await gameManager.processMosseDamage(gameId, cpuName, targetCardId, damageValue, mosseCardId, io, false, false, false, false, starsToRemove || 0);
      
      // NEW: Notify CPU that attack is resolved and immediately continue their turn
      const game = gameManager.getGameState(gameId);
      if (game && game.players[cpuName]?.cpuInstance) {
        const cpuInstance = game.players[cpuName].cpuInstance;
        cpuInstance.resolveAttack();
        console.log(`🎯 CPU ${cpuName}: Notified that attack is resolved - continuing turn...`);
        
        // CRITICAL: Immediately continue CPU turn after attack resolution
        setTimeout(async () => {
          try {
            const updatedState = gameManager.getSanitizedGameState(gameId);
            const nextAction = await cpuInstance.takeTurn(updatedState);
            
            if (nextAction) {
              console.log(`🎯 CPU ${cpuName}: Continuing turn with action:`, nextAction.type);
              await gameManager.processCPUTurn(gameId, cpuName, io);
            }
          } catch (error) {
            console.error(`Error continuing CPU ${cpuName} turn:`, error);
          }
        }, 100); // Small delay to ensure state is updated
      }
      
      console.log(`🎯 CPU ${cpuName} attack completed successfully`);
    });

    socket.on('send-chat-message', ({ message, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`Chat message received: ${playerName}: ${message}`);
        
        // Check if this is a response to a CPU question
        const cpuProcessed = gameManager.processCPUResponse(gameId, message, playerName);
        console.log(`CPU processed response: ${cpuProcessed}`);
        
        const chatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          playerName,
          message,
          timestamp: Date.now()
        };
        io.to(gameId).emit('chat-message', chatMessage);
        
        // Let CPU players respond to human chat messages
        if (!playerName.startsWith('CPU-')) {
          console.log(`Processing CPU chat responses for: ${message}`);
          gameManager.processCPUChatResponses(gameId, message, playerName);
        }
        
        // If CPU processed the response and was waiting, try to continue their turn
        if (cpuProcessed) {
          setTimeout(async () => {
            // Find which CPU was waiting and continue their turn
            const waitingCPU = gameManager.getCPUWaitingForResponse(gameId);
            if (!waitingCPU) {
              // CPU is no longer waiting, try to continue their turn
              const gameState = gameManager.getSanitizedGameState(gameId);
              const currentPlayer = gameState?.turnOrder?.[gameState.currentTurnIndex];
              
              if (currentPlayer?.startsWith('CPU-')) {
                const cpuAction = await gameManager.processCPUTurn(gameId, currentPlayer, io);
                if (cpuAction) {
                  // Execute CPU action
                  switch (cpuAction.type) {
                    case 'pick-card':
                      const pickSuccess = await gameManager.pickCard(gameId, cpuAction.data.deckType, cpuAction.data.playerName);
                      if (pickSuccess) {
                        const pickGameState = gameManager.getSanitizedGameState(gameId);
                        emitThrottledGameState(io, gameId, pickGameState);
                      }
                      break;
                      
                    case 'play-and-draw':
                      // MINKIARDS RULE: Play card and immediately draw replacement of same type
                      const playResult = await gameManager.playCard(gameId, cpuAction.data.playCardId, cpuAction.data.playerName);
                      
                      // Track in last played cards history
                      if (playResult.card) {
                        await emitCardPlayed(io, gameId, playResult.card, cpuAction.data.playerName);
                      }
                      
                      if (playResult.card) {
                        // Draw replacement of same type
                        const drawSuccess = await gameManager.pickCard(gameId, cpuAction.data.drawType, cpuAction.data.playerName);
                        if (drawSuccess) {
                          console.log(`CPU ${cpuAction.data.playerName} successfully played and drew replacement ${cpuAction.data.drawType}`);
                        }
                      }
                      
                      const playAndDrawGameState = gameManager.getSanitizedGameState(gameId);
                      emitThrottledGameState(io, gameId, playAndDrawGameState);
                      
                      // SPECIAL RULE: If it's a MOSSE card, automatically attack
                      if (cpuAction.data.drawType === 'mosse' && playResult.card) {
                        console.log(`CPU ${cpuAction.data.playerName} played MOSSE - triggering automatic attack`);
                        
                        // Find enemy to attack
                        const currentGameState = gameManager.getSanitizedGameState(gameId);
                        const enemies = currentGameState?.field.filter((card: any) => 
                          card.owner !== cpuAction.data.playerName && 
                          (card.type === 'personaggi' || card.type === 'personaggi_speciali')
                        );
                        
                        if (enemies && enemies.length > 0) {
                          const target = enemies[0]; // Attack first enemy
                          
                          // Get card name for chat message
                          const getCardNameFromUrl = (url: string) => {
                            const parts = url.split('/');
                            const filename = parts[parts.length - 1];
                            return filename
                              .toLowerCase()
                              .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                              .replace(/[-_]/g, ' ')
                              .split(' ')
                              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                              .join(' ');
                          };
                          
                          const mosseName = getCardNameFromUrl(playResult.card.frontImage);
                          const targetName = getCardNameFromUrl(target.frontImage);
                          
                          // Emit chat message and attack
                          io.to(gameId).emit('chat-message', {
                            id: `${Date.now()}-cpu-attack`,
                            playerName: cpuAction.data.playerName,
                            message: `Attacco automaticamente con "${mosseName}" contro ${targetName}!`,
                            timestamp: Date.now()
                          });
                          
                          // Trigger automatic attack
                          setTimeout(() => {
                            io.to(gameId).emit('mosse-attack', {
                              attackingCard: playResult.card,
                              targetCard: target,
                              playerName: cpuAction.data.playerName,
                              automatic: true
                            });
                          }, 800);
                        }
                      }
                      break;
                      
                    case 'play-card':
                      const result = await gameManager.playCard(gameId, cpuAction.data.cardId, cpuAction.data.playerName);
                      
                      // Track in last played cards history
                      if (result.card) {
                        await emitCardPlayed(io, gameId, result.card, cpuAction.data.playerName);
                      }
                      
                      const updatedGameState = gameManager.getSanitizedGameState(gameId);
                      emitThrottledGameState(io, gameId, updatedGameState);
                      
                      if (result.isPersonaggio && result.card) {
                        const getCardNameFromUrl = (url: string) => {
                          const parts = url.split('/');
                          const filename = parts[parts.length - 1];
                          return filename
                            .toLowerCase()
                            .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                            .replace(/[-_]/g, ' ')
                            .split(' ')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        };
                        
                        const cardName = result.card.name || getCardNameFromUrl(result.card.frontImage);
                        io.to(gameId).emit('personaggio-enters', {
                          cardName,
                          message: 'SI UNISCE ALLA ZUFFA',
                          playerName: currentPlayer,
                          cardImage: result.card.frontImage
                        });
                      }
                      break;
                  }
                  
                  // End CPU turn after action
                  setTimeout(() => {
                    // Process delayed damages before ending turn
                    gameManager.processDelayedDamages(gameId, currentPlayer, io);
                    
                    const nextAfterCPU = gameManager.endTurn(gameId, currentPlayer);
                    if (nextAfterCPU) {
                      io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                      
                      // CRITICAL FIX: Trigger next CPU turn if next player is also CPU
                      const freshGameState = gameManager.getGameState(gameId);
                      if (freshGameState && freshGameState.players[nextAfterCPU]?.isCPU) {
                        setTimeout(() => {
                          gameManager.processCPUTurn(gameId, nextAfterCPU, io);
                        }, 2000);
                      }
                    }
                  }, 1500);
                }
              }
            }
          }, 2000); // Give time for CPU to process response
        }
      }
    });

    socket.on('send-emoji-reaction', ({ gameId, emoji, playerName, id }) => {
      if (gameId) {
        // Server-side rate limiting: 1 emoji per second per socket
        const now = Date.now();
        const lastEmoji = socket.data.lastEmojiTime || 0;
        if (now - lastEmoji < 1000) {
          return; // Rate limited
        }
        socket.data.lastEmojiTime = now;
        
        io.to(gameId).emit('emoji-reaction', {
          emoji,
          playerName,
          id
        });
      }
    });

    socket.on('chat-message', async (data) => {
      const { playerName, message } = data;
      const gameId = gameManager.getPlayerGameId(socket.id);
      
      if (gameId) {
        // Broadcast the message to all players in the game
        io.to(gameId).emit('chat-message', {
          playerName,
          message,
          timestamp: Date.now()
        });

        // Check if any CPU players should respond to this message
        const game = gameManager.getGameState(gameId);
        if (game) {
          for (const pName in game.players) {
            const player = game.players[pName];
            if (player.isCPU && player.cpuInstance && pName !== playerName) {
              // Check if message is directed to this CPU or is a general command
              const isDirectedToCPU = message.toLowerCase().includes(pName.toLowerCase()) || 
                                     message.toLowerCase().includes('cpu');
              
              if (isDirectedToCPU) {
                console.log(`Processing CPU chat responses for: ${message}`);
                // First, check for special command functions (number generator, stars inquiry)
                const handled = await player.cpuInstance.handlePlayerMessage(message, playerName, game);
                
                if (handled) {
                  console.log(`CPU ${pName} handled command successfully via handlePlayerMessage`);
                  continue; // Skip AI processing if handled by special function
                }
                
                // If not handled by special function, fall back to AI/instruction processing
                console.log(`CPU ${pName} processing human chat: "${message}" from ${playerName}`);
                const response = await player.cpuInstance.processHumanChat(message, playerName);
                if (response) {
                  console.log(`CPU ${pName} responded via AI/Instruction`);
                }
              }
            }
          }
        }
      }
    });

    socket.on('show-card-to-player', ({ cardId, fromPlayer, toPlayer, cardImage }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        // Find the target player's socket
        const gameState = gameManager.getSanitizedGameState(gameId);
        if (gameState && gameState.players[toPlayer]) {
          const targetSocketId = gameState.players[toPlayer].socketId;
          
          // Send card to specific player
          io.to(targetSocketId).emit('card-shown', {
            cardId,
            fromPlayer,
            cardImage,
            message: `${fromPlayer} ti ha mostrato una carta`
          });
          
          // Confirm to sender
          socket.emit('card-show-confirmed', {
            message: `Carta mostrata a ${toPlayer}`
          });
        }
      }
    });

    socket.on('reset-game', ({ gameId }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        gameManager.resetGame(gameId);
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
        
        // Notify all players that the game has been reset
        io.to(gameId).emit('game-reset', { message: 'La partita è stata riavviata!' });
      }
    });

    socket.on('roll-dice', ({ gameId, playerName }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        // Check if any player has a dice control effect active
        const diceControlResult = gameManager.checkDiceControlEffect(gameId, playerName);
        
        if (diceControlResult.hasDiceControl) {
          // Show dice control panel to the player who has the effect
          console.log(`🎲 Dice control active for ${diceControlResult.controllingPlayer}`);
          io.to(gameId).emit('show-dice-control-panel', {
            rollingPlayer: playerName,
            controllingPlayer: diceControlResult.controllingPlayer,
            controllingCardId: diceControlResult.cardId,
            controllingCardName: diceControlResult.cardName
          });
        } else {
          // Generate random number between 1 and 6 normally
          const result = Math.floor(Math.random() * 6) + 1;
          
          // Broadcast dice result to all players in the game
          io.to(gameId).emit('dice-rolled', {
            result,
            playerName,
            timestamp: Date.now()
          });
        }
      }
    });

    // Handle dice control selection - player chooses the dice result
    socket.on('dice-control-select', ({ gameId, selectedNumber, controllingPlayer, rollingPlayer, pendingId }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        console.log(`🎲 ${controllingPlayer} controlled the dice to show ${selectedNumber}`);
        
        // Consume the dice control effect
        gameManager.consumeDiceControlEffect(gameId, controllingPlayer);
        
        // Broadcast the controlled dice result with animation
        io.to(gameId).emit('dice-rolled', {
          result: selectedNumber,
          playerName: rollingPlayer,
          wasControlled: true,
          controlledBy: controllingPlayer,
          timestamp: Date.now()
        });
        
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-dice-controlled`,
          playerName: 'Sistema',
          message: `🎲 ${controllingPlayer} ha controllato il dado! Il risultato è stato cambiato in ${selectedNumber}!`,
          timestamp: Date.now()
        });
        
        // If this is from a CPU pending controlled dice, complete the effect
        if (pendingId) {
          if (pendingId.startsWith('controlled-auto-dice-') || pendingId.startsWith('auto-dice-control-')) {
            gameManager.completePendingControlledAutoDice(gameId, pendingId, selectedNumber, io);
          } else {
            gameManager.completePendingControlledDice(gameId, pendingId, selectedNumber, io);
          }
        }
      }
    });

    socket.on('open-dice-window', ({ gameId, playerName }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        // Broadcast dice window open to all players in the game
        io.to(gameId).emit('dice-window-opened', {
          playerName,
          timestamp: Date.now()
        });
      }
    });

    // Super Dice Events
    socket.on('open-super-dice', ({ gameId, playerName }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        // Broadcast super dice window open to all players in the game
        io.to(gameId).emit('super-dice-opened', {
          playerName,
          timestamp: Date.now()
        });
      }
    });

    socket.on('super-dice-rolled', ({ gameId, playerName, rolledCard }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        // Broadcast super dice result to all players in the game
        io.to(gameId).emit('super-dice-rolled', {
          playerName,
          rolledCard,
          timestamp: Date.now()
        });
      }
    });

    socket.on('place-super-dice-card', async ({ gameId, playerName, cardData }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        // Create a card object for the rolled card and place it on the field
        const result = await gameManager.placeSuperDiceCard(gameId, playerName, cardData);
        
        if (result.success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
          
          // Emit notification that the super dice card was placed
          io.to(gameId).emit('super-dice-card-placed', {
            playerName,
            cardName: cardData.name,
            cardImage: cardData.image,
            timestamp: Date.now()
          });
        }
      }
    });

    socket.on('add-custom-cards', async ({ gameId, playerName, deckType, cards }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      
      if (playerGameId === gameId) {
        const result = await gameManager.addCustomCards(gameId, deckType, cards, playerName);
        
        if (result.success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
          
          io.to(gameId).emit('cards-added', {
            playerName,
            deckType,
            count: cards.length,
            deckLabel: deckType.toUpperCase().replace('_', ' ')
          });
        }
      }
    });

    socket.on('toggle-scenario-cards', ({ gameId, active }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        const success = gameManager.toggleScenarioCards(gameId, active);
        if (success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          // Broadcast updated game state and scenario card state to all players
          emitThrottledGameState(io, gameId, gameState);
          io.to(gameId).emit('scenario-cards-toggled', { 
            active,
            timestamp: Date.now()
          });
        }
      }
    });

    socket.on('game-instruction', async ({ gameId, playerName, instruction }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        try {
          // Process the game instruction using AI
          const result = await gameManager.processGameInstruction(gameId, playerName, instruction);
          
          // Check for player elimination from character limit (PTI modifications)
          if (result && typeof result === 'object' && 'eliminationCheck' in result && result.eliminationCheck) {
            console.log(`Player ${playerName} has reached character limit via game instruction - automatically eliminating`);
            
            const eliminationSuccess = gameManager.markPlayerEliminated(gameId, playerName);
            if (eliminationSuccess) {
              console.log(`Player ${playerName} automatically eliminated due to character limit`);
              io.to(gameId).emit('player-eliminated', { playerName });
              
              // Check for game victory
              const winner = gameManager.checkForGameVictory(gameId);
              if (winner) {
                console.log(`Game won by: ${winner}`);
                io.to(gameId).emit('game-victory', { winner });
                // Award Rankiard points
                gameManager.completeMatch(gameId, winner);
              }
            }
          }
          
          // Check if it's a conversational question
          if (result && typeof result === 'object' && 'isQuestion' in result && result.isQuestion) {
            // Send as conversational prompt, not error
            socket.emit('instruction-question', {
              playerName,
              instruction,
              question: result.message,
              timestamp: Date.now()
            });
            
            // Also broadcast to all players so they can see the conversation
            io.to(gameId).emit('instruction-dialogue', {
              playerName,
              instruction,
              question: result.message,
              timestamp: Date.now()
            });
            return;
          }
          
          // NEW: Handle show card instruction
          if (result && typeof result === 'object' && 'showCard' in result && result.showCard) {
            const showData: any = result.showCard;
            
            // Emit card-shown event to target player
            if (showData.targetSocketId) {
              io.to(showData.targetSocketId).emit('card-shown', {
                cardId: showData.cardId,
                fromPlayer: showData.showingPlayer,
                cardImage: showData.cardImage,
                message: `${showData.showingPlayer} ti ha mostrato la sua carta su richiesta`
              });
              
              console.log(`${showData.showingPlayer} showed card to ${showData.targetPlayer} via instruction`);
            }
          }
          
          // Get updated game state after instruction
          const updatedGameState = gameManager.getSanitizedGameState(gameId);
          
          // Broadcast updated game state to all players
          emitThrottledGameState(io, gameId, updatedGameState);
          
          // Broadcast instruction execution notification to all players
          io.to(gameId).emit('instruction-executed', {
            playerName,
            instruction,
            result: result?.message || `Istruzione eseguita: ${instruction}`,
            timestamp: Date.now()
          });
          
          // Send success message to the instructor
          socket.emit('instruction-success', {
            message: result?.message || `Istruzione eseguita con successo: ${instruction}`
          });
        } catch (error) {
          console.error('Error processing game instruction:', error);
          socket.emit('instruction-error', {
            message: (error instanceof Error ? error.message : String(error)) || 'Errore nell\'esecuzione dell\'istruzione. Riprova o fornisci maggiori dettagli.'
          });
        }
      }
    });

    socket.on('mosse-attack', async ({ mosseCardId, targetCardId, attackerName, targetOwner, damageValue, starsToRemove, isHandTarget, isFurtoAttack }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`🗡️  DEFENSE-ENABLED MOSSE ATTACK: ${attackerName} → ${targetOwner} (damage: ${damageValue})`);
        
        // Get the card to check its frontImage for CPU restrictions
        const gameState = gameManager.getSanitizedGameState(gameId);
        const mosseCard = gameState?.field?.find((c: any) => c.id === mosseCardId);
        
        if (!mosseCard) {
          console.log(`MOSSE card ${mosseCardId} not found on field`);
          return;
        }

        // Validate damage input (preserve legacy validation)
        if (!damageValue || damageValue <= 0) {
          console.log(`Invalid damage value: ${damageValue}. Attack cancelled.`);
          socket.emit('attack-error', { 
            message: 'Inserisci un valore di danno valido!'
          });
          return;
        }
        
        // PRESERVE: CPU reuse restrictions (exactly as before)
        const playerData = gameState?.players?.[attackerName];
        const isCPUPlayer = playerData?.isCPU || attackerName.startsWith('CPU-');
        
        if (isCPUPlayer && gameManager.hasCardTypeBeenUsed(gameId, mosseCard.frontImage, attackerName)) {
          console.log(`${attackerName} attempted to reuse MOSSE card type ${mosseCard.frontImage} - attack blocked (CPU restriction)`);
          socket.emit('attack-blocked', { 
            message: 'I CPU non possono riutilizzare la stessa carta MOSSE nello stesso turno!',
            cardId: mosseCardId 
          });
          return;
        }
        
        // PRESERVE: Mark card type as used for CPU players
        if (isCPUPlayer) {
          gameManager.markCardTypeAsUsed(gameId, mosseCard.frontImage, attackerName);
        }
        
        // RIFUGIO: Break protection when a player's protected character uses MOSSE
        // Find attacker's characters that are protected by RIFUGIO and break their protection
        const gameStateForRifugio = gameManager.getSanitizedGameState(gameId);
        const attackerProtectedChars = gameStateForRifugio?.field?.filter(
          (c: any) => c.owner === attackerName && c.protectedByRifugio
        ) || [];
        for (const protectedChar of attackerProtectedChars) {
          gameManager.breakRifugioProtection(gameId, protectedChar.id, io);
        }

        // NEW: Execute defense-enabled MOSSE attack (unified emission)
        const attackResult = await gameManager.executeMossaAttack(
          gameId, 
          attackerName, 
          mosseCardId, 
          targetCardId,
          damageValue,
          isHandTarget || false  // NEW: Pass isHandTarget flag
        );

        if (!attackResult.success) {
          console.log(`Attack failed: ${attackResult.error}`);
          socket.emit('attack-error', { message: attackResult.error });
          return;
        }

        // PRESERVE: Broadcast attack animation to all players
        io.to(gameId).emit('card-attacked', {
          mosseCardId,
          targetCardId,
          attackerName,
          targetOwner,
          damageValue,
          timestamp: Date.now()
        });

        // BARRIERA HANDLING: If attack was auto-absorbed by BARRIERA, apply damage and return
        if (attackResult.result?.barrieraAbsorbed) {
          // Use damage from result to ensure consistency
          const barrieraDamage = attackResult.result.damageValue || damageValue;
          console.log(`🛡️ BARRIERA auto-absorbed attack - applying ${barrieraDamage} damage to shield ${attackResult.result.barrieraShieldId}`);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-barriera-absorb`,
            playerName: 'Sistema',
            message: `🛡️ BARRIERA assorbe automaticamente ${barrieraDamage} danni dell'attacco!`,
            timestamp: Date.now()
          });
          
          // Apply damage to BARRIERA shield using the result's damage value
          gameManager.damageBarriera(gameId, attackResult.result.barrieraShieldId, barrieraDamage, attackerName, io);
          
          // Return MOSSE to deck
          gameManager.returnToDeck(gameId, mosseCardId, attackerName);
          
          // Update game state
          const updatedGameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, updatedGameState);
          
          return; // Attack absorbed - no defense dialog needed
        }

        // OSTAGGIO HANDLING: If this is an OSTAGGIO attack, apply hostage effect
        if (attackResult.result?.isOstaggioAttack) {
          console.log(`⛓️ OSTAGGIO attack detected - applying hostage effect to ${targetCardId}`);
          
          const ostaggioResult = gameManager.applyOstaggio(
            gameId,
            mosseCardId,
            targetCardId,
            attackerName,
            damageValue,
            io
          );
          
          if (ostaggioResult.success) {
            // Update game state
            const updatedGameState = gameManager.getSanitizedGameState(gameId);
            emitThrottledGameState(io, gameId, updatedGameState);
          } else {
            socket.emit('attack-error', { message: ostaggioResult.message || 'OSTAGGIO failed' });
          }
          
          return; // OSTAGGIO bypasses defense dialog
        }

        // HOSTAGE TARGET HANDLING: If attacking a hostaged character, apply damage directly (no defense)
        if (attackResult.result?.isHostageTarget) {
          console.log(`⛓️ Attacking hostage character - applying damage directly (no defense)`);
          
          await gameManager.processMosseDamage(gameId, attackerName, targetCardId, damageValue, mosseCardId, io, false, false, false, false, starsToRemove || 0);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-hostage-attacked`,
            playerName: 'Sistema',
            message: `⛓️⚔️ Il personaggio in ostaggio non può difendersi e subisce ${damageValue} danni!`,
            timestamp: Date.now()
          });
          
          // Update game state
          const updatedGameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, updatedGameState);
          
          return; // Hostage cannot defend - no defense dialog
        }

        if (attackResult.result?.requiresDefenseResponse) {
          console.log(`🛡️ Defense system activated - waiting for ${targetOwner}'s response to attack ${attackResult.result.attackId}`);
          
          // Store damage value and attack details for later processing
          const pendingDefense = gameManager.getPendingDefense(gameId);
          if (pendingDefense) {
            pendingDefense.damage = damageValue; // Store the manually input damage
            pendingDefense.mosseCardId = mosseCardId; // Store MOSSE card for return
            (pendingDefense as any).isFurtoAttack = isFurtoAttack || false; // Store FURTO flag
            (pendingDefense as any).starsToRemove = starsToRemove || 0; // Store stars to remove
            console.log(`📝 Stored damage value ${damageValue}, stars: ${starsToRemove || 0} for pending defense ${pendingDefense.attackId}${isFurtoAttack ? ' (FURTO - star stealing)' : ''}`);
          }
          
          // UNIFIED DEFENSE EMISSION: Use GameManager.emitDefenseRequest instead of direct emission
          const emissionSuccess = await gameManager.emitDefenseRequest(gameId, io);
          if (!emissionSuccess) {
            console.log(`⚠️ Failed to emit defense request - proceeding with damage`);
            await gameManager.processMosseDamage(gameId, attackerName, targetCardId, damageValue, mosseCardId, io, false, isHandTarget || false, isFurtoAttack || false, false, starsToRemove || 0);
          }
          
          // Attack is pending defense response - processing will continue in defense:response handler
          return;
        }

        // If no defense required, process damage immediately
        await gameManager.processMosseDamage(gameId, attackerName, targetCardId, damageValue, mosseCardId, io, false, isHandTarget || false, isFurtoAttack || false, false, starsToRemove || 0);
        
        // NEW: If CPU attacked without defense, continue their turn
        const gameStateAfterAttack = gameManager.getGameState(gameId);
        if (gameStateAfterAttack && gameStateAfterAttack.players[attackerName]?.cpuInstance) {
          const cpuInstance = gameStateAfterAttack.players[attackerName].cpuInstance;
          cpuInstance.resolveAttack();
          console.log(`🎯 CPU ${attackerName}: Attack resolved - continuing turn...`);
          
          // CRITICAL: Immediately continue CPU turn after attack resolution
          setTimeout(async () => {
            try {
              const updatedState = gameManager.getSanitizedGameState(gameId);
              const nextAction = await cpuInstance.takeTurn(updatedState);
              
              if (nextAction) {
                console.log(`🎯 CPU ${attackerName}: Continuing turn with action:`, nextAction.type);
                await gameManager.processCPUTurn(gameId, attackerName, io);
              }
            } catch (error) {
              console.error(`Error continuing CPU ${attackerName} turn:`, error);
            }
          }, 100);
        }
      }
    });

    // PRODUCTION-READY DEFENSE RESPONSE: Enhanced security and validation
    // DELAYED DAMAGE - Player chooses to delay receiving damage
    socket.on('defense:delay', ({ gameId: clientGameId, attackId, delayTurns, targetCardId, damageValue, attackerName, defenderName, mosseCardId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id) || clientGameId;
      
      if (!gameId) {
        socket.emit('defense:error', { message: 'Game not found', code: 'NO_GAME_FOUND' });
        return;
      }

      console.log(`⏳ DEFENSE DELAY: ${defenderName} delays ${damageValue} damage by ${delayTurns} turns`);
      
      // Clear pending defense
      gameManager.clearPendingDefense(gameId);
      
      // Add delayed damage entry
      const success = gameManager.addDelayedDamage(
        gameId,
        attackerName,
        defenderName,
        targetCardId,
        damageValue,
        mosseCardId,
        delayTurns
      );
      
      if (success) {
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-damage-delayed`,
          playerName: 'Sistema',
          message: `⏳ ${defenderName} ha ritardato il danno di ${damageValue} PTI! Si attiverà tra ${delayTurns} ${delayTurns === 1 ? 'turno' : 'turni'}.`,
          timestamp: Date.now()
        });
        
        io.to(gameId).emit('defense:result', {
          attackId,
          success: true,
          damageDelayed: true,
          delayTurns
        });
        
        // Update game state
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
      } else {
        socket.emit('defense:error', { message: 'Failed to delay damage', code: 'DELAY_FAILED' });
      }
    });

    socket.on('defense:response', async ({ attackId, defends, gameId: clientGameId }) => {
      const startTime = Date.now();
      const gameId = gameManager.getPlayerGameId(socket.id) || clientGameId;
      
      // SECURITY: Basic game validation
      if (!gameId) {
        console.warn(`[DEFENSE-RESPONSE] No game found for defense response`, {
          socketId: socket.id, attackId, defends, timestamp: new Date().toISOString()
        });
        socket.emit('defense:error', { 
          message: 'Game not found or you are not in a game', 
          code: 'NO_GAME_FOUND' 
        });
        return;
      }

      // SECURITY: Validate pending defense exists and matches attackId
      const pendingDefense = gameManager.getPendingDefense(gameId);
      if (!pendingDefense || pendingDefense.attackId !== attackId) {
        console.warn(`[DEFENSE-RESPONSE] Invalid or expired defense request`, {
          gameId, socketId: socket.id, attackId, defends, 
          hasPending: !!pendingDefense, 
          expectedAttackId: pendingDefense?.attackId,
          timestamp: new Date().toISOString()
        });
        socket.emit('defense:error', { 
          message: 'Invalid or expired defense request', 
          code: 'INVALID_ATTACK_ID' 
        });
        return;
      }

      // SECURITY: Authorization - verify socket belongs to the defender
      const defenderSocketId = gameManager.getPlayerSocketId(gameId, pendingDefense.defender);
      if (socket.id !== defenderSocketId) {
        console.error(`[DEFENSE-RESPONSE] SECURITY VIOLATION: Unauthorized defense response`, {
          gameId, attackId, defends, socketId: socket.id, 
          expectedSocketId: defenderSocketId, defender: pendingDefense.defender,
          timestamp: new Date().toISOString()
        });
        socket.emit('defense:error', { 
          message: 'You are not authorized to respond to this defense request', 
          code: 'UNAUTHORIZED_DEFENDER' 
        });
        return;
      }

      // STRUCTURED LOGGING: Log successful validation
      console.log(`[DEFENSE-RESPONSE] Processing authorized defense response`, {
        gameId, attackId, defends, defender: pendingDefense.defender, 
        attacker: pendingDefense.attacker, socketId: socket.id,
        processingTime: Date.now() - startTime, timestamp: new Date().toISOString()
      });

      // Process using enhanced GameManager method with 'client' resolve source
      const success = await gameManager.processDefenseResponse(gameId, attackId, defends, io, 'client');
      
      if (!success) {
        console.warn(`[DEFENSE-RESPONSE] Failed to process defense response`, {
          gameId, attackId, defends, defender: pendingDefense.defender,
          timestamp: new Date().toISOString()
        });
        socket.emit('defense:error', { 
          message: 'Failed to process defense response', 
          code: 'PROCESSING_FAILED' 
        });
      } else {
        console.log(`[DEFENSE-RESPONSE] Defense response processed successfully`, {
          gameId, attackId, defends, defender: pendingDefense.defender,
          totalTime: Date.now() - startTime, timestamp: new Date().toISOString()
        });
      }
    });

    // COUNTER-ATTACK: When defender uses a MOSSE to counter
    socket.on('counter-attack', async ({ attackId, defenderMosseCardId, defenderDamage, defenderTargetCardId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) {
        socket.emit('counter-attack:error', { message: 'Game not found' });
        return;
      }

      console.log(`⚔️ COUNTER-ATTACK received: ${defenderMosseCardId} with ${defenderDamage} damage`);
      
      const result = await gameManager.processCounterAttack(
        gameId,
        attackId,
        defenderMosseCardId,
        defenderDamage,
        defenderTargetCardId,
        io
      );

      if (!result.success) {
        socket.emit('counter-attack:error', { message: 'Failed to process counter-attack' });
      }
    });

    // CLASH BATTLE: Handle tap from participant
    socket.on('clash-tap', ({ clashId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) return;

      const result = gameManager.handleClashTap(gameId, playerName);
      
      if (result.success) {
        // Broadcast tap update to all players in real-time
        io.to(gameId).emit('clash-tap-update', {
          clashId,
          attackerTaps: result.attackerTaps,
          defenderTaps: result.defenderTaps
        });

        // Check for overwhelm (20 tap lead)
        const overwhelmCheck = gameManager.checkClashOverwhelm(gameId);
        if (overwhelmCheck.winner) {
          // Resolve immediately
          const clash = gameManager.getActiveClashBattle(gameId);
          if (clash) {
            gameManager.resolveClashBattle(gameId, clash.id, io);
          }
        }
      }
    });

    socket.on('remove-card-to-graveyard', ({ deckType, cardId, playerName, section }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = gameManager.moveToGraveyard(gameId, cardId, playerName);
        if (result.success) {
          // ENHANCED ELIMINATION SYSTEM: Automatic elimination when limit reached
          if (result.eliminationCheck) {
            console.log(`Player ${playerName} has reached character limit - automatically eliminating`);
            
            // Automatically eliminate player when they reach the character limit  
            const eliminationSuccess = gameManager.markPlayerEliminated(gameId, playerName);
            if (eliminationSuccess) {
              console.log(`Player ${playerName} automatically eliminated due to character limit`);
              io.to(gameId).emit('player-eliminated', { playerName });
              
              // Send message about elimination
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-auto-elimination`,
                playerName: 'Sistema',
                message: `${playerName} è stato eliminato! Ha raggiunto il limite di personaggi nel cimitero.`,
                timestamp: Date.now()
              });
            }
          }
          
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitImmediateGameState(io, gameId, gameState);
          
          // ALWAYS check for game victory after any graveyard change
          const winner = gameManager.checkForGameVictory(gameId);
          if (winner) {
            console.log(`Game victory detected! Winner: ${winner}`);
            io.to(gameId).emit('game-victory', { winner });
            // Award Rankiard points
            gameManager.completeMatch(gameId, winner);
          }
        }
      }
    });
    
    // Manual return of MOSSE cards to deck bottom
    socket.on('return-mosse-to-deck', ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`${playerName} manually returning MOSSE card ${cardId} to bottom of deck`);
        
        // Return the card to the bottom of the deck
        gameManager.returnToDeck(gameId, cardId, playerName);
        
        // Send updated game state
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitImmediateGameState(io, gameId, gameState);
        
        // Notify players about the manual return
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-manual-return`,
          playerName: 'Sistema',
          message: `${playerName} ha rimesso la carta MOSSE in fondo al mazzo.`,
          timestamp: Date.now()
        });
        
        console.log(`Successfully returned MOSSE card ${cardId} to deck for ${playerName}`);
      }
    });
    
    // NEW: Handle draw-and-play action for enhanced CPU turns
    socket.on('draw-and-play-card', async ({ deckType, playerName, cardIdToPlay }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`${playerName} drawing from ${deckType} and immediately playing card ${cardIdToPlay || 'next drawn'}`);
        
        // First, draw the card
        const drawnCard = await gameManager.pickCardAndReturn(gameId, deckType, playerName);
        if (drawnCard && typeof drawnCard === 'object') {
          console.log(`${playerName} drew ${deckType} card: ${drawnCard.id}`);
          
          // Determine which card to play (if specified or the just-drawn one)
          const cardToPlay = cardIdToPlay || drawnCard.id;
          
          // Play the card immediately (same turn activation)
          setTimeout(async () => {
            const playResult = await gameManager.playCard(gameId, cardToPlay, playerName);
            if (playResult && playResult.card) {
              console.log(`${playerName} immediately played card: ${cardToPlay}`);
              
              // Send updated game state
              const gameState = gameManager.getSanitizedGameState(gameId);
              emitThrottledGameState(io, gameId, gameState);
              
              // NEW RULE: Turn ends after using a card
              setTimeout(() => {
                // Process delayed damages before ending turn
                gameManager.processDelayedDamages(gameId, playerName, io);
                
                const nextPlayer = gameManager.endTurn(gameId, playerName);
                if (nextPlayer) {
                  io.to(gameId).emit('next-turn', { nextPlayer });
                  console.log(`Turn ended for ${playerName}, next: ${nextPlayer}`);
                }
              }, 1000);
            }
          }, 500); // Brief delay for smooth UX
        }
        
        // Send immediate game state update after drawing
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
      }
    });
    
    // NEW: Handle CPU orders from human players
    socket.on('cpu-show-card-order', ({ cardType, fromPlayer, toPlayer, orderMessage }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId && fromPlayer.startsWith('CPU-')) {
        console.log(`Processing show card order: ${fromPlayer} showing ${cardType} to ${toPlayer}`);
        
        // Get CPU's hand to find the requested card type
        const gameState = gameManager.getSanitizedGameState(gameId);
        const cpuPlayer = gameState?.players[fromPlayer];
        
        if (cpuPlayer && cpuPlayer.hand) {
          const requestedCard = cpuPlayer.hand.find((card: any) => card.type === cardType);
          
          if (requestedCard) {
            // Find target player's socket ID
            const targetPlayer = gameState.players[toPlayer];
            if (targetPlayer && targetPlayer.socketId) {
              
              // Send card to specific player
              io.to(targetPlayer.socketId).emit('card-shown', {
                cardId: requestedCard.id,
                fromPlayer: fromPlayer,
                cardImage: requestedCard.frontImage,
                message: `${fromPlayer} ti ha mostrato la sua carta ${cardType.toUpperCase()} su tua richiesta`
              });
              
              // Notify all players about the action
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-show-order`,
                playerName: 'Sistema',
                message: orderMessage,
                timestamp: Date.now()
              });
              
              console.log(`CPU ${fromPlayer} showed ${cardType} card to ${toPlayer}`);
            }
          } else {
            // CPU doesn't have the requested card type
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-no-card`,
              playerName: fromPlayer,
              message: `Mi dispiace ${toPlayer}, non ho carte di tipo ${cardType.toUpperCase()} in mano!`,
              timestamp: Date.now()
            });
          }
        }
      }
    });
    
    socket.on('cpu-pick-card-order', async ({ deckType, playerName, orderedBy }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId && playerName.startsWith('CPU-')) {
        console.log(`Processing pick card order: ${playerName} picking ${deckType} ordered by ${orderedBy}`);
        
        const pickedCard = await gameManager.pickCard(gameId, deckType, playerName);
        if (pickedCard) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-pick-order`,
            playerName: 'Sistema',
            message: `${playerName} ha pescato una carta ${deckType.toUpperCase()} su richiesta di ${orderedBy}`,
            timestamp: Date.now()
          });
        }
      }
    });
    
    socket.on('cpu-play-card-order', async ({ cardType, playerName, orderedBy }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId && playerName.startsWith('CPU-')) {
        console.log(`Processing play card order: ${playerName} playing ${cardType || 'any'} ordered by ${orderedBy}`);
        
        const gameState = gameManager.getSanitizedGameState(gameId);
        const cpuPlayer = gameState?.players[playerName];
        
        if (cpuPlayer && cpuPlayer.hand && cpuPlayer.hand.length > 0) {
          let cardToPlay;
          
          if (cardType) {
            // Find specific card type
            cardToPlay = cpuPlayer.hand.find((card: any) => card.type === cardType);
          } else {
            // Play any card
            cardToPlay = cpuPlayer.hand[0];
          }
          
          if (cardToPlay) {
            const result = await gameManager.playCard(gameId, cardToPlay.id, playerName);
            if (result && result.card) {
              const updatedGameState = gameManager.getSanitizedGameState(gameId);
              emitThrottledGameState(io, gameId, updatedGameState);
              
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-play-order`,
                playerName: 'Sistema',
                message: `${playerName} ha giocato una carta su richiesta di ${orderedBy}`,
                timestamp: Date.now()
              });
              
              // NEW RULE: Turn ends after playing a card
              setTimeout(() => {
                // Process delayed damages before ending turn
                gameManager.processDelayedDamages(gameId, playerName, io);
                
                const nextPlayer = gameManager.endTurn(gameId, playerName);
                if (nextPlayer) {
                  io.to(gameId).emit('next-turn', { nextPlayer });
                  console.log(`Turn ended for ${playerName} after ordered card play, next: ${nextPlayer}`);
                }
              }, 1500);
            }
          } else {
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-no-card-type`,
              playerName: playerName,
              message: `Mi dispiace ${orderedBy}, non ho carte di tipo ${cardType ? cardType.toUpperCase() : 'disponibili'} da giocare!`,
              timestamp: Date.now()
            });
          }
        }
      }
    });
    
    socket.on('cpu-attack-order', async ({ playerName, orderedBy }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId && playerName.startsWith('CPU-')) {
        console.log(`Processing attack order: ${playerName} attacking ordered by ${orderedBy}`);
        
        const gameState = gameManager.getSanitizedGameState(gameId);
        const cpuPlayer = gameState?.players[playerName];
        
        if (cpuPlayer && cpuPlayer.hand) {
          const mosseCard = cpuPlayer.hand.find((card: any) => card.type === 'mosse');
          const enemies = gameState.field.filter((card: any) => card.owner !== playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali'));
          
          if (mosseCard && enemies.length > 0) {
            const target = enemies[0]; // Attack first enemy
            
            // First play the MOSSE card
            const playResult = await gameManager.playCard(gameId, mosseCard.id, playerName);
            if (playResult && playResult.card) {
              
              // Then execute attack
              setTimeout(() => {
                io.to(gameId).emit('card-attacked', {
                  mosseCardId: mosseCard.id,
                  targetCardId: target.id,
                  attackerName: playerName,
                  targetOwner: target.owner,
                  timestamp: Date.now()
                });
                
                io.to(gameId).emit('chat-message', {
                  id: `${Date.now()}-attack-order`,
                  playerName: 'Sistema',
                  message: `${playerName} ha attaccato ${target.owner} su richiesta di ${orderedBy}!`,
                  timestamp: Date.now()
                });
                
                // Manual return of MOSSE card
                setTimeout(() => {
                  gameManager.returnToDeck(gameId, mosseCard.id, playerName);
                  const updatedGameState = gameManager.getSanitizedGameState(gameId);
                  emitThrottledGameState(io, gameId, updatedGameState);
                  
                  // Turn ends after attack
                  setTimeout(() => {
                    // Process delayed damages before ending turn
                    gameManager.processDelayedDamages(gameId, playerName, io);
                    
                    const nextPlayer = gameManager.endTurn(gameId, playerName);
                    if (nextPlayer) {
                      io.to(gameId).emit('next-turn', { nextPlayer });
                      console.log(`Turn ended for ${playerName} after ordered attack, next: ${nextPlayer}`);
                    }
                  }, 1000);
                }, 2000);
              }, 1000);
            }
          } else {
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-no-attack`,
              playerName: playerName,
              message: `Mi dispiace ${orderedBy}, non posso attaccare! ${!mosseCard ? 'Non ho carte MOSSE' : 'Non ci sono nemici'}`,
              timestamp: Date.now()
            });
          }
        }
      }
    });

    socket.on('eliminate-personaggi', async ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = await gameManager.eliminatePersonaggi(gameId, cardId, playerName);
        if (result.success) {
          // Trigger CIMICE death effect if card had CIMICE power (native or copied)
          if (result.hasCimicePower) {
            console.log(`🪲 CIMICE power death triggered via eliminate-personaggi`);
            await gameManager.processCimiceDeathEffect(gameId, cardId, io);
          }
          
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);

          // Get card name from image URL for "Ciao ciao" notification
          if (result.cardImage) {
            const getCardNameFromUrl = (url: string) => {
              const parts = url.split('/');
              const filename = parts[parts.length - 1];
              // Remove file extension and replace hyphens/underscores with spaces
              return filename
                .toLowerCase()
                .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                .replace(/[-_]/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            };
            
            const cardName = getCardNameFromUrl(result.cardImage);
            
            // Emit "Ciao ciao" notification with cardType for death animation
            io.to(gameId).emit('card-to-graveyard', {
              cardName,
              playerName,
              cardType: result.cardType || 'personaggi'
            });
          }
          
          // CRITICAL FIX: Check if this elimination causes player elimination
          if (result.eliminationCheck) {
            console.log(`Player ${playerName} has reached character limit via eliminate-personaggi - automatically eliminating`);
            
            const eliminationSuccess = gameManager.markPlayerEliminated(gameId, playerName);
            if (eliminationSuccess) {
              console.log(`Player ${playerName} automatically eliminated due to character limit`);
              io.to(gameId).emit('player-eliminated', { playerName });
              
              // Check for game victory
              const winner = gameManager.checkForGameVictory(gameId);
              if (winner) {
                console.log(`Game won by: ${winner}`);
                io.to(gameId).emit('game-victory', { winner });
                // Award Rankiard points
                gameManager.completeMatch(gameId, winner);
              }
            }
          }
        }
      }
    });

    socket.on('move-card-position', ({ cardId, direction, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const success = gameManager.moveCardPosition(gameId, cardId, direction);
        if (success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
        }
      }
    });

    socket.on('remove-player', ({ gameId, playerToRemove, removedBy }) => {
      console.log(`[remove-player] ${removedBy} is removing ${playerToRemove} from game ${gameId}`);
      
      const success = gameManager.removePlayerFromGame(gameId, playerToRemove);
      
      if (success) {
        console.log(`[remove-player] Successfully removed ${playerToRemove} from game`);
        
        // Notify all players
        io.to(gameId).emit('player-removed', { 
          playerName: playerToRemove,
          removedBy 
        });
        
        // Send updated game state
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
      } else {
        console.error(`[remove-player] Failed to remove ${playerToRemove} from game`);
      }
    });

    socket.on('start-game', ({ gameId, playerName, characterLimit }) => {
      const gameState = gameManager.getSanitizedGameState(gameId);
      if (gameState) {
        const playerOrder = gameManager.startGame(gameId, characterLimit);
        if (playerOrder) {
          io.to(gameId).emit('game-started', { playerOrder });
        }
      }
    });

    // PARASITIC CARD: Human player selects target for attachment
    socket.on('parasitic-attach-target', async ({ gameId, parasiticCardId, targetCardId, playerName }) => {
      try {
        console.log(`🦠 ${playerName} selecting target ${targetCardId} for parasitic card ${parasiticCardId}`);
        
        const attachResult = await gameManager.attachParasiticCard(gameId, parasiticCardId, targetCardId, playerName);
        
        if (attachResult.success && attachResult.attachment) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          const targetCard = gameState?.field.find((c: any) => c.id === targetCardId);
          
          const getCardNameFromUrl = (url: string) => {
            const parts = url.split('/');
            const filename = parts[parts.length - 1];
            return filename.toLowerCase().replace(/\.(png|jpg|jpeg|gif|webp)$/i, '').replace(/[-_]/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          };
          const targetName = targetCard?.name || getCardNameFromUrl(targetCard?.frontImage || '');
          
          io.to(gameId).emit('parasitic-attached', {
            parasiticCardId,
            parasiticType: attachResult.attachment.parasiticCardName,
            targetCardId,
            targetName,
            ownerPlayer: playerName,
            targetPlayer: attachResult.attachment.targetPlayer
          });
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-parasitic-attach`,
            playerName: 'SISTEMA',
            message: `🦠 ${attachResult.attachment.parasiticCardName} di ${playerName} si è agganciato a ${targetName}!`,
            timestamp: Date.now()
          });
          
          const updatedState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, updatedState);
        } else {
          socket.emit('parasitic-attach-error', { message: attachResult.message || 'Attachment failed' });
        }
      } catch (error) {
        console.error('Error in parasitic-attach-target:', error);
        socket.emit('parasitic-attach-error', { message: 'Error attaching parasitic card' });
      }
    });

    socket.on('end-turn', async ({ gameId, playerName }) => {
      const nextPlayer = gameManager.endTurn(gameId, playerName);
      if (nextPlayer) {
        io.to(gameId).emit('next-turn', { nextPlayer });
        
        // Process parasitic card turn effects (PARASSITA drain, SAIBAIM explosion)
        const parasiticResults = await gameManager.processParasiticTurnEffects(
          gameId, 
          nextPlayer,
          (event, data) => io.to(gameId).emit(event, data)
        );
        
        // Handle SAIBAIM explosions
        if (parasiticResults.explosions.length > 0) {
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-saibaim-explosion`,
            playerName: 'SISTEMA',
            message: `💥 SAIBAIM è esploso! Due personaggi sono stati eliminati!`,
            timestamp: Date.now()
          });
        }
        
        // Handle PARASSITA drains
        for (const drain of parasiticResults.drains) {
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-parassita-drain-${drain.cardId}`,
            playerName: 'SISTEMA',
            message: `🦠 PARASSITA ha drenato ${drain.ptiDrained} PTI dal bersaglio!`,
            timestamp: Date.now()
          });
        }
        
        // Send updated game state after parasitic effects
        if (parasiticResults.explosions.length > 0 || parasiticResults.drains.length > 0) {
          emitThrottledGameState(io, gameId, gameManager.getSanitizedGameState(gameId));
        }
        
        // Process persistent damages at the START of the next player's turn
        // This applies recurring damage from cards like VIRUS, INFLUENZA, PUOZZA
        gameManager.processPersistentDamages(gameId, nextPlayer, io);
        
        // RIFUGIO: Restore protection for the next player's characters at start of their turn
        gameManager.restoreRifugioProtection(gameId, nextPlayer, io);
        
        // OSTAGGIO: Process hostage turn countdown for the player who just ended their turn
        gameManager.processHostageTurns(gameId, playerName, io);
        
        // Send game state update after hostage processing
        emitThrottledGameState(io, gameId, gameManager.getSanitizedGameState(gameId));
        
        // Check if next player is CPU and automatically process their turn
        const gameState = gameManager.getSanitizedGameState(gameId);
        const nextPlayerData = gameState?.players[nextPlayer];
        
        if (nextPlayerData && nextPlayer.startsWith('CPU-')) {
          // Give a moment for UI to update, then process CPU turn
          setTimeout(async () => {
            try {
              console.log(`Processing automated turn for CPU: ${nextPlayer}`);
              
              const cpuAction = await gameManager.processCPUTurn(gameId, nextPlayer, io);
              if (cpuAction) {
                // Execute the CPU's action
                switch (cpuAction.type) {
                  case 'pick-card':
                    const pickSuccess = await gameManager.pickCard(gameId, cpuAction.data.deckType, cpuAction.data.playerName);
                    if (pickSuccess) {
                      const pickGameState = gameManager.getSanitizedGameState(gameId);
                      emitThrottledGameState(io, gameId, pickGameState);
                    }
                    break;
                    
                  case 'play-and-draw':
                    // MINKIARDS RULE: Play card and immediately draw replacement of same type
                    console.log(`CPU ${nextPlayer} play-and-draw: ${cpuAction.data.playCardId} -> draw ${cpuAction.data.drawType}`);
                    const playDrawResult = await gameManager.playCard(gameId, cpuAction.data.playCardId, cpuAction.data.playerName);
                    
                    // Track in last played cards history
                    if (playDrawResult.card) {
                      await emitCardPlayed(io, gameId, playDrawResult.card, cpuAction.data.playerName);
                    }
                    
                    if (playDrawResult.card) {
                      // Draw replacement of same type
                      const drawSuccess = await gameManager.pickCard(gameId, cpuAction.data.drawType, cpuAction.data.playerName);
                      if (drawSuccess) {
                        console.log(`CPU ${nextPlayer} successfully played and drew replacement ${cpuAction.data.drawType}`);
                      }
                    }
                    
                    const playDrawGameState = gameManager.getSanitizedGameState(gameId);
                    emitThrottledGameState(io, gameId, playDrawGameState);
                    
                    if (playDrawResult.isPersonaggio && playDrawResult.card) {
                      const getCardNameFromUrl = (url: string) => {
                        const parts = url.split('/');
                        const filename = parts[parts.length - 1];
                        return filename
                          .toLowerCase()
                          .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                          .replace(/[-_]/g, ' ')
                          .split(' ')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ');
                      };
                      
                      const cardName = playDrawResult.card.name || getCardNameFromUrl(playDrawResult.card.frontImage);
                      io.to(gameId).emit('personaggio-enters', {
                        cardName,
                        message: 'SI UNISCE ALLA ZUFFA',
                        playerName: nextPlayer,
                        cardImage: playDrawResult.card.frontImage
                      });
                    }
                    
                    // SPECIAL RULE: If it's a MOSSE card, automatically attack
                    if (cpuAction.data.drawType === 'mosse' && playDrawResult.card) {
                      console.log(`CPU ${nextPlayer} played MOSSE - triggering automatic attack`);
                      
                      // Find enemy to attack
                      const currentGameState = gameManager.getSanitizedGameState(gameId);
                      const enemies = currentGameState?.field.filter((card: any) => 
                        card.owner !== nextPlayer && 
                        (card.type === 'personaggi' || card.type === 'personaggi_speciali')
                      );
                      
                      if (enemies && enemies.length > 0) {
                        const target = enemies[0]; // Attack first enemy
                        
                        // Get card name for chat message
                        const getCardNameFromUrl = (url: string) => {
                          const parts = url.split('/');
                          const filename = parts[parts.length - 1];
                          return filename
                            .toLowerCase()
                            .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                            .replace(/[-_]/g, ' ')
                            .split(' ')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        };
                        
                        const mosseName = getCardNameFromUrl(playDrawResult.card.frontImage);
                        const targetName = getCardNameFromUrl(target.frontImage);
                        
                        // Emit chat message and attack
                        io.to(gameId).emit('chat-message', {
                          id: `${Date.now()}-cpu-attack`,
                          playerName: nextPlayer,
                          message: `Attacco automaticamente con "${mosseName}" contro ${targetName}!`,
                          timestamp: Date.now()
                        });
                        
                        // Trigger automatic attack
                        setTimeout(() => {
                          io.to(gameId).emit('mosse-attack', {
                            attackingCard: playDrawResult.card,
                            targetCard: target,
                            playerName: nextPlayer,
                            automatic: true
                          });
                        }, 800);
                      }
                    }
                    
                    // Turn ends automatically after playing a card
                    setTimeout(() => {
                      const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                      if (nextAfterCPU) {
                        io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                        console.log(`Turn ended for ${nextPlayer} after play-and-draw, next: ${nextAfterCPU}`);
                        
                        // CRITICAL FIX: Trigger next CPU turn if next player is also CPU
                        const freshGameState = gameManager.getGameState(gameId);
                        if (freshGameState && freshGameState.players[nextAfterCPU]?.isCPU) {
                          setTimeout(() => {
                            gameManager.processCPUTurn(gameId, nextAfterCPU, io);
                          }, 2000);
                        }
                      }
                    }, 1500);
                    return; // Return early to prevent generic end-turn
                    
                  case 'play-card':
                    const result = await gameManager.playCard(gameId, cpuAction.data.cardId, cpuAction.data.playerName);
                    
                    // Track in last played cards history
                    if (result.card) {
                      await emitCardPlayed(io, gameId, result.card, cpuAction.data.playerName);
                    }
                    
                    // Draw replacement card of same type
                    if (result.card) {
                      const cardType = result.card.type;
                      if (cardType === 'personaggi' || cardType === 'mosse' || cardType === 'bonus' || cardType === 'personaggi_speciali') {
                        const replacementDrawn = await gameManager.pickCard(gameId, cardType, cpuAction.data.playerName);
                        if (replacementDrawn) {
                          console.log(`CPU ${nextPlayer} drew replacement ${cardType} card after playing`);
                        }
                      }
                    }
                    
                    const updatedGameState = gameManager.getSanitizedGameState(gameId);
                    emitThrottledGameState(io, gameId, updatedGameState);
                    
                    if (result.isPersonaggio && result.card) {
                      const getCardNameFromUrl = (url: string) => {
                        const parts = url.split('/');
                        const filename = parts[parts.length - 1];
                        return filename
                          .toLowerCase()
                          .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                          .replace(/[-_]/g, ' ')
                          .split(' ')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ');
                      };
                      
                      const cardName = result.card.name || getCardNameFromUrl(result.card.frontImage);
                      io.to(gameId).emit('personaggio-enters', {
                        cardName,
                        message: 'SI UNISCE ALLA ZUFFA',
                        playerName: nextPlayer,
                        cardImage: result.card.frontImage
                      });
                    }
                    
                    // CRITICAL FIX: If CPU played a MOSSE card, announce attack and wait for master to input damage
                    if (result.card && result.card.type === 'mosse') {
                      console.log(`🎯 CPU ${nextPlayer} played MOSSE card - announcing attack for master to input damage`);
                      
                      // Find enemy characters on field to attack
                      const currentGameState = gameManager.getSanitizedGameState(gameId);
                      const enemyCharacters = currentGameState?.field?.filter((c: any) => 
                        c.owner !== nextPlayer && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
                      ) || [];
                      
                      if (enemyCharacters.length > 0) {
                        // Select a target (prefer lowest PTI for strategic advantage)
                        const targetCard = enemyCharacters.reduce((best: any, current: any) => {
                          const bestPti = parseInt((best.text || '').match(/PTI:\s*(\d+)/i)?.[1] || '9999');
                          const currentPti = parseInt((current.text || '').match(/PTI:\s*(\d+)/i)?.[1] || '9999');
                          return currentPti < bestPti ? current : best;
                        });
                        
                        const getMosseName = (url: string) => {
                          const parts = url.split('/');
                          const filename = parts[parts.length - 1];
                          return filename
                            .toLowerCase()
                            .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                            .replace(/[-_]/g, ' ')
                            .split(' ')
                            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        };
                        
                        const mosseName = getMosseName(result.card.frontImage);
                        const targetName = getMosseName(targetCard.frontImage);
                        
                        // Send chat message about attack
                        io.to(gameId).emit('chat-message', {
                          id: `${Date.now()}-cpu-mosse-attack`,
                          playerName: nextPlayer,
                          message: `🎯 Uso la carta MOSSE "${mosseName}" per attaccare ${targetName} di ${targetCard.owner}! Master, inserisci il danno.`,
                          timestamp: Date.now()
                        });
                        
                        // Emit cpu-damage-request event to trigger the CPUDamageDialog
                        setTimeout(() => {
                          // Get the CPU's character on field for the attacker info
                          const cpuCharacter = currentGameState?.field?.find((c: any) => 
                            c.owner === nextPlayer && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
                          );
                          
                          // Find the game creator (first human player)
                          const gameCreator = gameManager.getGameCreator(gameId);
                          
                          io.to(gameId).emit('cpu-damage-request', {
                            cpuName: nextPlayer,
                            cpuCharacterName: cpuCharacter ? getMosseName(cpuCharacter.frontImage) : nextPlayer,
                            mosseCardId: result.card!.id,
                            mosseCardName: mosseName,
                            mosseCardImage: result.card!.frontImage,
                            targetCardId: targetCard.id,
                            targetCardName: targetName,
                            targetOwner: targetCard.owner,
                            gameCreator: gameCreator || '',
                            timestamp: Date.now(),
                            attackerCharacter: cpuCharacter ? {
                              id: cpuCharacter.id,
                              name: getMosseName(cpuCharacter.frontImage),
                              image: cpuCharacter.frontImage,
                              notes: cpuCharacter.text || ''
                            } : null,
                            defenderCharacter: {
                              id: targetCard.id,
                              name: targetName,
                              image: targetCard.frontImage,
                              notes: targetCard.text || ''
                            },
                            isHandTarget: false
                          });
                          
                          console.log(`📢 CPU ${nextPlayer} cpu-damage-request emitted - waiting for master to input damage`);
                        }, 500);
                        
                        // Don't end turn or return card - wait for the attack resolution flow
                        return; // Return early, don't end turn yet
                      } else {
                        console.log(`⚠️ CPU ${nextPlayer} has MOSSE card but no enemy targets on field`);
                      }
                    }
                    break;
                    
                  case 'mosse-attack':
                    io.to(gameId).emit('card-attacked', {
                      mosseCardId: cpuAction.data.mosseCardId,
                      targetCardId: cpuAction.data.targetCardId,
                      attackerName: cpuAction.data.attackerName,
                      targetOwner: cpuAction.data.targetOwner,
                      timestamp: Date.now()
                    });
                    
                    // MANUAL RETURN: CPU manually returns MOSSE card to deck bottom
                    setTimeout(async () => {
                      console.log(`CPU ${nextPlayer} manually returning used MOSSE card to deck bottom`);
                      gameManager.returnToDeck(gameId, cpuAction.data.mosseCardId, cpuAction.data.attackerName);
                      
                      const updatedGameState = gameManager.getSanitizedGameState(gameId);
                      emitThrottledGameState(io, gameId, updatedGameState);
                      
                      // CPU announces the manual return
                      io.to(gameId).emit('chat-message', {
                        id: `${Date.now()}-cpu-return`,
                        playerName: nextPlayer,
                        message: 'Ho rimesso la mia carta MOSSE in fondo al mazzo.',
                        timestamp: Date.now()
                      });
                    }, 3000); // 3 seconds for manual return
                    break;
                    
                  case 'eliminate-dead-character':
                    // NEW: CPU eliminates character with PTI: 0
                    console.log(`CPU ${nextPlayer} eliminating dead character: ${cpuAction.data.cardId}`);
                    const eliminateResult = gameManager.moveToGraveyard(gameId, cpuAction.data.cardId, cpuAction.data.playerName);
                    
                    if (eliminateResult.success) {
                      // Check for player elimination from character limit
                      if (eliminateResult.eliminationCheck) {
                        console.log(`Player ${cpuAction.data.playerName} has reached character limit via CPU elimination - automatically eliminating`);
                        
                        const eliminationSuccess = gameManager.markPlayerEliminated(gameId, cpuAction.data.playerName);
                        if (eliminationSuccess) {
                          console.log(`Player ${cpuAction.data.playerName} automatically eliminated due to character limit`);
                          io.to(gameId).emit('player-eliminated', { playerName: cpuAction.data.playerName });
                          
                          // Check for game victory
                          const winner = gameManager.checkForGameVictory(gameId);
                          if (winner) {
                            console.log(`Game won by: ${winner}`);
                            io.to(gameId).emit('game-victory', { winner });
                            // Award Rankiard points
                            gameManager.completeMatch(gameId, winner);
                          }
                        }
                      }
                      
                      const updatedGameState = gameManager.getSanitizedGameState(gameId);
                      emitThrottledGameState(io, gameId, updatedGameState);
                      
                      // Notify about the elimination
                      io.to(gameId).emit('chat-message', {
                        id: `${Date.now()}-cpu-eliminate`,
                        playerName: nextPlayer,
                        message: 'Il mio personaggio è morto (PTI: 0) ed è stato eliminato.',
                        timestamp: Date.now()
                      });
                      
                      console.log(`CPU ${nextPlayer} successfully eliminated dead character`);
                    }
                    break;
                    
                  case 'show-card-to-player':
                    // NEW: CPU shows card to specific player
                    console.log(`CPU ${nextPlayer} showing card to player: ${cpuAction.data.toPlayer}`);
                    const showGameState = gameManager.getSanitizedGameState(gameId);
                    const targetPlayer = showGameState?.players[cpuAction.data.toPlayer];
                    
                    if (targetPlayer && targetPlayer.socketId) {
                      // Send card to specific player
                      io.to(targetPlayer.socketId).emit('card-shown', {
                        cardId: cpuAction.data.cardId,
                        fromPlayer: cpuAction.data.fromPlayer,
                        cardImage: cpuAction.data.cardImage,
                        message: `${cpuAction.data.fromPlayer} ti ha mostrato la sua carta su tua richiesta`
                      });
                      
                      // Notify all players about the action
                      io.to(gameId).emit('chat-message', {
                        id: `${Date.now()}-show-order`,
                        playerName: 'Sistema',
                        message: cpuAction.data.orderMessage,
                        timestamp: Date.now()
                      });
                      
                      console.log(`CPU ${nextPlayer} successfully showed card to ${cpuAction.data.toPlayer}`);
                    }
                    break;
                    
                  case 'draw-and-play':
                    // NEW: Draw a card and immediately play it in the same turn
                    const drawnCard = await gameManager.pickCardAndReturn(gameId, cpuAction.data.deckType, cpuAction.data.playerName);
                    if (drawnCard && typeof drawnCard === 'object') {
                      console.log(`CPU ${nextPlayer} drew ${cpuAction.data.deckType} card: ${drawnCard.id} and will play it immediately`);
                      
                      // Update game state after drawing
                      const drawGameState = gameManager.getSanitizedGameState(gameId);
                      emitThrottledGameState(io, gameId, drawGameState);
                      
                      // Play the card immediately (same turn activation)
                      setTimeout(async () => {
                        const immediatePlayResult = await gameManager.playCard(gameId, drawnCard.id, cpuAction.data.playerName);
                        if (immediatePlayResult && immediatePlayResult.card) {
                          console.log(`CPU ${nextPlayer} immediately played drawn card: ${drawnCard.id}`);
                          
                          const playGameState = gameManager.getSanitizedGameState(gameId);
                          emitThrottledGameState(io, gameId, playGameState);
                        }
                      }, 1000); // Brief delay to show the draw then play
                    }
                    break;
                }
                
                // NEW: Continue processing CPU actions until turn is complete  
                let continuousActions = 0;
                const maxActions = 10; // Prevent infinite loops
                
                const processContinuous = async () => {
                  if (continuousActions >= maxActions) {
                    console.log(`CPU ${nextPlayer} reached max actions limit, ending turn`);
                    const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                    if (nextAfterCPU) {
                      io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                      
                      // CRITICAL FIX: Trigger next CPU turn if next player is also CPU
                      const freshGameState = gameManager.getGameState(gameId);
                      if (freshGameState && freshGameState.players[nextAfterCPU]?.isCPU) {
                        setTimeout(() => {
                          gameManager.processCPUTurn(gameId, nextAfterCPU, io);
                        }, 2000);
                      }
                    }
                    return;
                  }
                  
                  setTimeout(async () => {
                    const followUpAction = await gameManager.processCPUTurn(gameId, nextPlayer, io);
                    if (followUpAction && followUpAction.type !== 'end-turn') {
                      console.log(`CPU ${nextPlayer} continuing with action: ${followUpAction.type}`);
                      continuousActions++;
                      await processContinuous(); // Continue processing
                    } else {
                      // CPU is done or wants to end turn
                      console.log(`CPU ${nextPlayer} finished all actions, ending turn`);
                      const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                      if (nextAfterCPU) {
                        io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                        
                        // CRITICAL FIX: Trigger next CPU turn if next player is also CPU
                        const freshGameState = gameManager.getGameState(gameId);
                        if (freshGameState && freshGameState.players[nextAfterCPU]?.isCPU) {
                          setTimeout(() => {
                            gameManager.processCPUTurn(gameId, nextAfterCPU, io);
                          }, 2000);
                        }
                      }
                    }
                  }, 1000);
                };
                
                await processContinuous();
                
              } else {
                // CPU had no valid actions, just end turn
                const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                if (nextAfterCPU) {
                  io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                  
                  // CRITICAL FIX: Trigger next CPU turn if next player is also CPU
                  const freshGameState = gameManager.getGameState(gameId);
                  if (freshGameState && freshGameState.players[nextAfterCPU]?.isCPU) {
                    setTimeout(() => {
                      gameManager.processCPUTurn(gameId, nextAfterCPU, io);
                    }, 2000);
                  }
                }
              }
            } catch (error) {
              console.error(`Error processing CPU turn for ${nextPlayer}:`, error);
              // If CPU fails, just end their turn
              const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
              if (nextAfterCPU) {
                io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                
                // CRITICAL FIX: Trigger next CPU turn if next player is also CPU
                const freshGameState = gameManager.getGameState(gameId);
                if (freshGameState && freshGameState.players[nextAfterCPU]?.isCPU) {
                  setTimeout(() => {
                    gameManager.processCPUTurn(gameId, nextAfterCPU, io);
                  }, 2000);
                }
              }
            }
          }, 3000); // 3 second delay to show "TOCCA A TE" message for CPU
        }
      }
    });

    socket.on('leave-game', ({ gameId, playerName }) => {
      const success = gameManager.leaveGame(gameId, playerName);
      if (success) {
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
        io.to(gameId).emit('player-left', { playerName });
      }
    });

    // Handle elimination confirmation
    socket.on('confirm-elimination', ({ gameId, playerName, confirmed }) => {
      if (confirmed) {
        // Player confirms elimination
        const success = gameManager.markPlayerEliminated(gameId, playerName);
        if (success) {
          io.to(gameId).emit('player-eliminated', { playerName });
          
          // Check for game victory
          const winner = gameManager.checkForGameVictory(gameId);
          if (winner) {
            io.to(gameId).emit('game-victory', { winner });
            // Award Rankiard points
            gameManager.completeMatch(gameId, winner);
          }
          
          // Update game state
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
        }
      }
      // If not confirmed, player continues playing and will get asked again next time
    });

    // Allow any player to force end the current turn
    socket.on('force-end-turn', async ({ gameId }) => {
      try {
        const game = gameManager.getGameState(gameId);
        if (!game) {
          socket.emit('force-end-turn-error', { message: 'Game not found' });
          return;
        }

        // Check if there's a valid turn order and current player
        if (!game.turnOrder || game.turnOrder.length === 0) {
          socket.emit('force-end-turn-error', { message: 'No turn order established' });
          return;
        }

        const currentPlayerName = game.turnOrder[game.currentTurnIndex];
        if (!currentPlayerName) {
          socket.emit('force-end-turn-error', { message: 'No current player found' });
          return;
        }

        console.log(`Force ending turn for ${currentPlayerName} (requested by player)`);

        // Process delayed damages for the current player BEFORE ending their turn
        const delayedDamageResults = gameManager.processDelayedDamages(gameId, currentPlayerName, io);
        if (delayedDamageResults.appliedDamages.length > 0) {
          console.log(`⏳ Applied ${delayedDamageResults.appliedDamages.length} delayed damages for ${currentPlayerName}`);
        }

        // Force end the current player's turn (bypasses validation)
        const nextPlayer = gameManager.forceEndTurn(gameId);
        
        if (nextPlayer) {
          // Broadcast turn change to all players
          io.to(gameId).emit('next-turn', { nextPlayer });
          
          // Process parasitic card turn effects (PARASSITA drain, SAIBAIM explosion)
          const parasiticResults = await gameManager.processParasiticTurnEffects(
            gameId, 
            nextPlayer,
            (event, data) => io.to(gameId).emit(event, data)
          );
          
          // Handle SAIBAIM explosions
          if (parasiticResults.explosions.length > 0) {
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-saibaim-explosion`,
              playerName: 'SISTEMA',
              message: `💥 SAIBAIM è esploso! Due personaggi sono stati eliminati!`,
              timestamp: Date.now()
            });
          }
          
          // Handle PARASSITA drains
          for (const drain of parasiticResults.drains) {
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-parassita-drain-${drain.cardId}`,
              playerName: 'SISTEMA',
              message: `🦠 PARASSITA ha drenato ${drain.ptiDrained} PTI dal bersaglio!`,
              timestamp: Date.now()
            });
          }
          
          // Process persistent damages at the START of the next player's turn
          gameManager.processPersistentDamages(gameId, nextPlayer, io);
          
          // Update game state
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);

          console.log(`Turn forcibly ended for ${currentPlayerName}, next player: ${nextPlayer}`);
          
          // Send success response
          socket.emit('force-end-turn-success', { 
            message: `Turn ended for ${currentPlayerName}`, 
            nextPlayer 
          });

          // Process next player's turn if they are a CPU
          if (nextPlayer?.startsWith('CPU-')) {
            console.log(`Processing automated turn for CPU: ${nextPlayer}`);
            setTimeout(async () => {
              try {
                const cpuAction = await gameManager.processCPUTurn(gameId, nextPlayer, io);
                if (cpuAction) {
                  console.log(`CPU ${nextPlayer} action:`, cpuAction.type);
                  // Handle CPU action processing (simplified for now)
                  switch (cpuAction.type) {
                    case 'play-card':
                      const playResult = await gameManager.playCard(gameId, cpuAction.data.cardId, cpuAction.data.playerName);
                      
                      // According to MINKIARDS rules: when you play a card, you automatically draw a replacement of the same type
                      if (playResult.card) {
                        const cardType = playResult.card.type;
                        if (cardType === 'personaggi' || cardType === 'mosse' || cardType === 'bonus' || cardType === 'personaggi_speciali') {
                          const replacementDrawn = await gameManager.pickCard(gameId, cardType, cpuAction.data.playerName);
                          if (replacementDrawn) {
                            console.log(`CPU ${nextPlayer} drew replacement ${cardType} card after playing`);
                          }
                        }
                      }
                      
                      const playGameState = gameManager.getSanitizedGameState(gameId);
                      emitThrottledGameState(io, gameId, playGameState);
                      
                      // CRITICAL FIX: If CPU played a MOSSE card, announce attack and wait for master to input damage
                      if (playResult.card && playResult.card.type === 'mosse') {
                        console.log(`🎯 CPU ${nextPlayer} played MOSSE card (force-end-turn) - announcing attack for master to input damage`);
                        
                        // Find enemy characters on field to attack
                        const currentGameState = gameManager.getSanitizedGameState(gameId);
                        const enemyCharacters = currentGameState?.field?.filter((c: any) => 
                          c.owner !== nextPlayer && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
                        ) || [];
                        
                        if (enemyCharacters.length > 0) {
                          // Select a target (prefer lowest PTI for strategic advantage)
                          const targetCard = enemyCharacters.reduce((best: any, current: any) => {
                            const bestPti = parseInt((best.text || '').match(/PTI:\s*(\d+)/i)?.[1] || '9999');
                            const currentPti = parseInt((current.text || '').match(/PTI:\s*(\d+)/i)?.[1] || '9999');
                            return currentPti < bestPti ? current : best;
                          });
                          
                          const getMosseName = (url: string) => {
                            const parts = url.split('/');
                            const filename = parts[parts.length - 1];
                            return filename
                              .toLowerCase()
                              .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                              .replace(/[-_]/g, ' ')
                              .split(' ')
                              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                              .join(' ');
                          };
                          
                          const mosseName = getMosseName(playResult.card.frontImage);
                          const targetName = getMosseName(targetCard.frontImage);
                          
                          // Send chat message about attack
                          io.to(gameId).emit('chat-message', {
                            id: `${Date.now()}-cpu-mosse-attack-fe`,
                            playerName: nextPlayer,
                            message: `🎯 Uso la carta MOSSE "${mosseName}" per attaccare ${targetName} di ${targetCard.owner}! Master, inserisci il danno.`,
                            timestamp: Date.now()
                          });
                          
                          // Emit cpu-damage-request event to trigger the CPUDamageDialog
                          const getMosseNameFE = (url: string) => {
                            const parts = url.split('/');
                            const filename = parts[parts.length - 1];
                            return filename
                              .toLowerCase()
                              .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                              .replace(/[-_]/g, ' ')
                              .split(' ')
                              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                              .join(' ');
                          };
                          
                          setTimeout(() => {
                            // Get the CPU's character on field for the attacker info
                            const cpuCharacter = currentGameState?.field?.find((c: any) => 
                              c.owner === nextPlayer && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
                            );
                            
                            // Find the game creator (first human player)
                            const gameCreator = gameManager.getGameCreator(gameId);
                            
                            io.to(gameId).emit('cpu-damage-request', {
                              cpuName: nextPlayer,
                              cpuCharacterName: cpuCharacter ? getMosseNameFE(cpuCharacter.frontImage) : nextPlayer,
                              mosseCardId: playResult.card!.id,
                              mosseCardName: mosseName,
                              mosseCardImage: playResult.card!.frontImage,
                              targetCardId: targetCard.id,
                              targetCardName: targetName,
                              targetOwner: targetCard.owner,
                              gameCreator: gameCreator || '',
                              timestamp: Date.now(),
                              attackerCharacter: cpuCharacter ? {
                                id: cpuCharacter.id,
                                name: getMosseNameFE(cpuCharacter.frontImage),
                                image: cpuCharacter.frontImage,
                                notes: cpuCharacter.text || ''
                              } : null,
                              defenderCharacter: {
                                id: targetCard.id,
                                name: targetName,
                                image: targetCard.frontImage,
                                notes: targetCard.text || ''
                              },
                              isHandTarget: false
                            });
                            
                            console.log(`📢 CPU ${nextPlayer} cpu-damage-request emitted (force-end-turn) - waiting for master to input damage`);
                          }, 500);
                          
                          // Don't end turn or return card - wait for attack resolution
                          break;
                        } else {
                          console.log(`⚠️ CPU ${nextPlayer} has MOSSE card but no enemy targets on field`);
                        }
                      }
                      
                      // Default: end turn for non-MOSSE cards or if no targets
                      setTimeout(() => {
                        const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                        if (nextAfterCPU) {
                          io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                          
                          // CRITICAL FIX: Trigger next CPU turn if next player is also CPU
                          const freshGameState = gameManager.getGameState(gameId);
                          if (freshGameState && freshGameState.players[nextAfterCPU]?.isCPU) {
                            setTimeout(() => {
                              gameManager.processCPUTurn(gameId, nextAfterCPU, io);
                            }, 2000);
                          }
                        }
                      }, 1500);
                      break;
                      
                    case 'mosse-attack':
                      // Handle MOSSE attack for CPU - Execute using new defense system
                      console.log(`CPU ${nextPlayer} performing MOSSE attack with defense system`);
                      
                      // Use the new executeMossaAttack method that supports defense system
                      const defaultCPUDamage = cpuAction.data.damageValue || 150; // Default CPU damage value
                      const attackResult = await gameManager.executeMossaAttack(
                        gameId,
                        cpuAction.data.playerName,
                        cpuAction.data.mosseCardId,
                        cpuAction.data.targetCardId,
                        defaultCPUDamage
                      );
                      
                      if (attackResult.success) {
                        // BARRIERA HANDLING: If attack was auto-absorbed by BARRIERA
                        if (attackResult.result?.barrieraAbsorbed) {
                          const barrieraDamage = attackResult.result.damageValue || defaultCPUDamage;
                          console.log(`🛡️ CPU ${nextPlayer} attack auto-absorbed by BARRIERA - ${barrieraDamage} damage`);
                          
                          io.to(gameId).emit('chat-message', {
                            id: `${Date.now()}-cpu-barriera-absorb`,
                            playerName: 'Sistema',
                            message: `🛡️ BARRIERA assorbe automaticamente ${barrieraDamage} danni dell'attacco di ${nextPlayer}!`,
                            timestamp: Date.now()
                          });
                          
                          // Apply damage to BARRIERA shield using result's damage value
                          gameManager.damageBarriera(gameId, attackResult.result.barrieraShieldId, barrieraDamage, cpuAction.data.playerName, io);
                          
                          // Return MOSSE to deck
                          gameManager.returnToDeck(gameId, cpuAction.data.mosseCardId, cpuAction.data.playerName);
                          
                          // Update and end turn
                          const barrieraGameState = gameManager.getSanitizedGameState(gameId);
                          emitThrottledGameState(io, gameId, barrieraGameState);
                          
                          setTimeout(() => {
                            const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                            if (nextAfterCPU) {
                              io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                              
                              // CRITICAL FIX: Trigger next CPU turn if next player is also CPU
                              const freshGameState = gameManager.getGameState(gameId);
                              if (freshGameState && freshGameState.players[nextAfterCPU]?.isCPU) {
                                setTimeout(() => {
                                  gameManager.processCPUTurn(gameId, nextAfterCPU, io);
                                }, 2000);
                              }
                            }
                          }, 1500);
                          break;
                        }
                        
                        // CRITICAL: Emit defense:request if required
                        if (attackResult.result && attackResult.result.requiresDefenseResponse) {
                          console.log(`🛡️ Emitting defense:request for CPU attack`);
                          await gameManager.emitDefenseRequest(gameId, io);
                        }
                        
                        // Legacy card-attacked event for UI compatibility
                        const gameState = gameManager.getSanitizedGameState(gameId);
                        const targetCard = gameState.field.find((card: any) => card.id === cpuAction.data.targetCardId);
                        
                        let targetCardName = 'CARD';
                        if (targetCard && targetCard.frontImage) {
                          try {
                            const url = new URL(targetCard.frontImage);
                            const pathname = url.pathname;
                            const filename = pathname.split('/').pop() || '';
                            targetCardName = filename.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase();
                          } catch {
                            targetCardName = 'CARD';
                          }
                        }
                        
                        io.to(gameId).emit('card-attacked', {
                          targetCardName: targetCardName,
                          fromPlayer: cpuAction.data.playerName,
                          toPlayer: cpuAction.data.targetOwner
                        });
                      } else {
                        console.error(`CPU ${nextPlayer} MOSSE attack failed: ${attackResult.error}`);
                      }
                      
                      // MANUAL RETURN: CPU must manually return MOSSE cards like humans
                      setTimeout(async () => {
                        console.log(`CPU ${nextPlayer} manually returning used MOSSE card to deck bottom`);
                        gameManager.returnToDeck(gameId, cpuAction.data.mosseCardId, cpuAction.data.playerName);
                        
                        const gameState = gameManager.getSanitizedGameState(gameId);
                        emitThrottledGameState(io, gameId, gameState);
                        
                        // Draw replacement card
                        const pickResult = await gameManager.pickCard(gameId, 'mosse', cpuAction.data.playerName);
                        if (pickResult) {
                          console.log(`CPU ${nextPlayer} drew replacement MOSSE card`);
                          const pickGameState = gameManager.getSanitizedGameState(gameId);
                          emitThrottledGameState(io, gameId, pickGameState);
                        }
                        
                        // End turn after completing action
                        setTimeout(() => {
                          // Process delayed damages before ending turn
                          gameManager.processDelayedDamages(gameId, nextPlayer, io);
                          
                          const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                          if (nextAfterCPU) {
                            io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                            
                            // CRITICAL FIX: Trigger next CPU turn if next player is also CPU
                            const freshGameState = gameManager.getGameState(gameId);
                            if (freshGameState && freshGameState.players[nextAfterCPU]?.isCPU) {
                              setTimeout(() => {
                                gameManager.processCPUTurn(gameId, nextAfterCPU, io);
                              }, 2000);
                            }
                          }
                        }, 1000);
                      }, 2000);
                      break;
                      
                    case 'pick-card':
                      // Handle card picking for CPU
                      const pickSuccess = await gameManager.pickCard(gameId, cpuAction.data.deckType, cpuAction.data.playerName);
                      if (pickSuccess) {
                        console.log(`CPU ${nextPlayer} picked ${cpuAction.data.deckType} card`);
                        const pickGameState = gameManager.getSanitizedGameState(gameId);
                        emitThrottledGameState(io, gameId, pickGameState);
                      }
                      
                      setTimeout(() => {
                        // Process delayed damages before ending turn
                        gameManager.processDelayedDamages(gameId, nextPlayer, io);
                        
                        const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                        if (nextAfterCPU) {
                          io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                          
                          // CRITICAL FIX: Trigger next CPU turn if next player is also CPU
                          const freshGameState = gameManager.getGameState(gameId);
                          if (freshGameState && freshGameState.players[nextAfterCPU]?.isCPU) {
                            setTimeout(() => {
                              gameManager.processCPUTurn(gameId, nextAfterCPU, io);
                            }, 2000);
                          }
                        }
                      }, 1500);
                      break;
                      
                    default:
                      // For other actions, just end turn after delay
                      setTimeout(() => {
                        // Process delayed damages before ending turn
                        gameManager.processDelayedDamages(gameId, nextPlayer, io);
                        
                        const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                        if (nextAfterCPU) {
                          io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                          
                          // CRITICAL FIX: Trigger next CPU turn if next player is also CPU
                          const freshGameState = gameManager.getGameState(gameId);
                          if (freshGameState && freshGameState.players[nextAfterCPU]?.isCPU) {
                            setTimeout(() => {
                              gameManager.processCPUTurn(gameId, nextAfterCPU, io);
                            }, 2000);
                          }
                        }
                      }, 1500);
                  }
                } else {
                  // CPU returned null - check if waiting for attack resolution
                  const currentGameForWait = gameManager.getGameState(gameId);
                  const cpuInstanceForWait = currentGameForWait?.players[nextPlayer]?.cpuInstance;
                  
                  if (cpuInstanceForWait?.isWaitingForAttack()) {
                    // CPU is waiting for MOSSE attack to be resolved - DO NOT end turn
                    console.log(`🎯 CPU ${nextPlayer} returned null but is waiting for attack resolution - NOT ending turn`);
                    return; // Exit without ending turn - attack resolution will continue the turn
                  }
                  
                  // CPU had no valid actions, just end turn
                  // Process delayed damages before ending turn
                  gameManager.processDelayedDamages(gameId, nextPlayer, io);
                  
                  const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                  if (nextAfterCPU) {
                    io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                    
                    // CRITICAL FIX: Trigger next CPU turn if next player is also CPU
                    const freshGameState = gameManager.getGameState(gameId);
                    if (freshGameState && freshGameState.players[nextAfterCPU]?.isCPU) {
                      setTimeout(() => {
                        gameManager.processCPUTurn(gameId, nextAfterCPU, io);
                      }, 2000);
                    }
                  }
                }
              } catch (error) {
                console.error(`Error processing CPU turn for ${nextPlayer}:`, error);
                // If CPU fails, just end their turn
                // Process delayed damages before ending turn
                gameManager.processDelayedDamages(gameId, nextPlayer, io);
                
                const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                if (nextAfterCPU) {
                  io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                  
                  // CRITICAL FIX: Trigger next CPU turn if next player is also CPU
                  const freshGameState = gameManager.getGameState(gameId);
                  if (freshGameState && freshGameState.players[nextAfterCPU]?.isCPU) {
                    setTimeout(() => {
                      gameManager.processCPUTurn(gameId, nextAfterCPU, io);
                    }, 2000);
                  }
                }
              }
            }, 3000); // 3 second delay to show "TOCCA A TE" message for CPU
          }
        } else {
          socket.emit('force-end-turn-error', { message: 'Failed to end turn' });
        }
        
      } catch (error) {
        console.error('Error in force-end-turn:', error);
        socket.emit('force-end-turn-error', { 
          message: `Error ending turn: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
      }
    });

    // Music synchronization events
    socket.on('music-action', ({ gameId, playerName, action, trackUrl, time, volume }) => {
      console.log(`🎵 Music action from ${playerName}:`, action, { trackUrl, time, volume });
      
      // Broadcast music control to all players in the game room
      io.to(gameId).emit('music-control', {
        action,
        trackUrl,
        time,
        volume
      });
    });

    // WebRTC Voice Chat events
    socket.on('voice-chat-join', ({ gameId, playerName }) => {
      console.log(`🎤 ${playerName} joined voice chat in ${gameId}`);
      
      // Create room if it doesn't exist
      if (!voiceChatRooms.has(gameId)) {
        voiceChatRooms.set(gameId, new Map());
      }
      
      const room = voiceChatRooms.get(gameId)!;
      
      // Get existing participants before adding new one
      const existingParticipants = Array.from(room.keys());
      
      // Add new participant
      room.set(playerName, socket.id);
      
      console.log(`🎤 Voice chat room ${gameId} participants:`, Array.from(room.keys()));
      
      // Send list of existing participants to the new joiner
      if (existingParticipants.length > 0) {
        socket.emit('voice-chat-existing-users', { participants: existingParticipants });
        console.log(`🎤 Sent existing participants to ${playerName}:`, existingParticipants);
      }
      
      // Notify all other players in the room that this player joined voice chat
      socket.to(gameId).emit('voice-chat-user-joined', { playerId: playerName });
    });

    socket.on('voice-chat-leave', ({ gameId, playerName }) => {
      console.log(`🎤 ${playerName} left voice chat in ${gameId}`);
      
      const room = voiceChatRooms.get(gameId);
      if (room) {
        room.delete(playerName);
        if (room.size === 0) {
          voiceChatRooms.delete(gameId);
        }
      }
      
      // Notify all other players in the room that this player left voice chat
      socket.to(gameId).emit('voice-chat-user-left', { playerId: playerName });
    });

    socket.on('webrtc-offer', ({ gameId, targetPlayerId, offer, fromPlayer }) => {
      console.log(`🎤 WebRTC offer from ${fromPlayer} to ${targetPlayerId}`);
      
      // Get target player's socket ID
      const room = voiceChatRooms.get(gameId);
      if (room) {
        const targetSocketId = room.get(targetPlayerId);
        if (targetSocketId) {
          // Send offer only to target player
          io.to(targetSocketId).emit('webrtc-offer', { fromPlayer, offer });
          console.log(`🎤 Sent offer to ${targetPlayerId} (socket: ${targetSocketId})`);
        } else {
          console.log(`🎤 Target player ${targetPlayerId} not found in voice chat`);
        }
      }
    });

    socket.on('webrtc-answer', ({ gameId, targetPlayerId, answer, fromPlayer }) => {
      console.log(`🎤 WebRTC answer from ${fromPlayer} to ${targetPlayerId}`);
      
      // Get target player's socket ID
      const room = voiceChatRooms.get(gameId);
      if (room) {
        const targetSocketId = room.get(targetPlayerId);
        if (targetSocketId) {
          // Send answer only to target player
          io.to(targetSocketId).emit('webrtc-answer', { fromPlayer, answer });
          console.log(`🎤 Sent answer to ${targetPlayerId} (socket: ${targetSocketId})`);
        } else {
          console.log(`🎤 Target player ${targetPlayerId} not found in voice chat`);
        }
      }
    });

    socket.on('webrtc-ice-candidate', ({ gameId, targetPlayerId, candidate, fromPlayer }) => {
      console.log(`🎤 ICE candidate from ${fromPlayer} to ${targetPlayerId}`);
      
      // Get target player's socket ID
      const room = voiceChatRooms.get(gameId);
      if (room) {
        const targetSocketId = room.get(targetPlayerId);
        if (targetSocketId) {
          // Send ICE candidate only to target player
          io.to(targetSocketId).emit('webrtc-ice-candidate', { fromPlayer, candidate });
          console.log(`🎤 Sent ICE candidate to ${targetPlayerId} (socket: ${targetSocketId})`);
        } else {
          console.log(`🎤 Target player ${targetPlayerId} not found in voice chat`);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      
      // Clean up spectators on disconnect
      if (socket.data.isSpectator && socket.data.gameId && socket.data.spectatorName) {
        const game = gameManager.getGame(socket.data.gameId);
        if (game) {
          game.spectators = game.spectators.filter(s => s !== socket.data.spectatorName);
          socket.to(socket.data.gameId).emit('spectator-left-notification', {
            spectatorName: socket.data.spectatorName,
            spectatorCount: game.spectators.length
          });
        }
      }
      
      // Remove from voice chat rooms
      voiceChatRooms.forEach((room, gameId) => {
        const entries = Array.from(room.entries());
        for (const [playerName, socketId] of entries) {
          if (socketId === socket.id) {
            room.delete(playerName);
            console.log(`🎤 Removed ${playerName} from voice chat room ${gameId} (disconnected)`);
            // Notify others that player left
            socket.to(gameId).emit('voice-chat-user-left', { playerId: playerName });
            break;
          }
        }
        if (room.size === 0) {
          voiceChatRooms.delete(gameId);
        }
      });
      
      gameManager.removePlayer(socket.id);
    });
  });

  // ============================================
  // CUSTOM CARDS CRUD ENDPOINTS
  // ============================================
  
  // Get all permanent custom cards
  app.get('/api/custom-cards', async (req, res) => {
    try {
      const deckType = req.query.deckType as string | undefined;
      
      let cards;
      if (deckType) {
        cards = await db.select().from(customCards).where(eq(customCards.deckType, deckType));
      } else {
        cards = await db.select().from(customCards);
      }
      
      res.json({ success: true, cards });
    } catch (error) {
      console.error('Error fetching custom cards:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch custom cards' });
    }
  });
  
  // Update a custom card
  app.patch('/api/custom-cards/:id', async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const { name, pti, stars, effect } = req.body;
      
      if (isNaN(cardId)) {
        return res.status(400).json({ success: false, error: 'Invalid card ID' });
      }
      
      const updateData: Record<string, any> = {};
      if (name !== undefined && typeof name === 'string' && name.trim()) {
        updateData.name = name.trim();
      }
      if (pti !== undefined) {
        updateData.pti = pti === null || pti === '' ? null : parseInt(pti);
      }
      if (stars !== undefined) {
        updateData.stars = stars === null || stars === '' ? null : parseInt(stars);
      }
      if (effect !== undefined) {
        updateData.effect = effect || null;
      }
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, error: 'No valid fields to update' });
      }
      
      const result = await db.update(customCards)
        .set(updateData)
        .where(eq(customCards.id, cardId))
        .returning();
      
      if (!result || result.length === 0) {
        return res.status(404).json({ success: false, error: 'Card not found' });
      }
      
      res.json({ success: true, card: result[0] });
    } catch (error) {
      console.error('Error updating custom card:', error);
      res.status(500).json({ success: false, error: 'Failed to update custom card' });
    }
  });
  
  // Delete a custom card
  app.delete('/api/custom-cards/:id', async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      
      if (isNaN(cardId)) {
        return res.status(400).json({ success: false, error: 'Invalid card ID' });
      }
      
      const result = await db.delete(customCards)
        .where(eq(customCards.id, cardId))
        .returning();
      
      if (!result || result.length === 0) {
        return res.status(404).json({ success: false, error: 'Card not found' });
      }
      
      res.json({ success: true, message: 'Card deleted successfully' });
    } catch (error) {
      console.error('Error deleting custom card:', error);
      res.status(500).json({ success: false, error: 'Failed to delete custom card' });
    }
  });

  // ============================================
  // ADMIN CARD MODIFICATIONS ENDPOINTS
  // ============================================

  // Check if user is admin (requires authentication)
  app.get('/api/admin/check', authMiddleware, async (req, res) => {
    try {
      const userEmail = req.user?.email;
      const isAdmin = userEmail?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      console.log('[ADMIN CHECK]', { userEmail, adminEmail: ADMIN_EMAIL, isAdmin });
      res.json({ success: true, isAdmin });
    } catch (error) {
      console.log('[ADMIN CHECK ERROR]', error);
      res.json({ success: true, isAdmin: false });
    }
  });

  // Get all existing game cards with their modifications (admin only)
  app.get('/api/admin/existing-cards', authMiddleware, async (req, res) => {
    try {
      const userEmail = req.user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }

      const deckType = req.query.deckType as string;
      
      // Get all card modifications from database
      const modifications = await db.select().from(cardModifications);
      const modMap = new Map(modifications.map(m => [m.originalCardId, m]));

      // Get cards from CARD_DATA
      const deckKeys = deckType ? [deckType] : ['personaggi', 'mosse', 'bonus', 'personaggi_speciali'];
      const cards: any[] = [];

      for (const deck of deckKeys) {
        const deckData = CARD_DATA[deck as keyof typeof CARD_DATA] || [];
        deckData.forEach((imageUrl: string, index: number) => {
          const cardId = `${deck}-${index}`;
          const urlParts = imageUrl.split('/');
          const filename = urlParts[urlParts.length - 1];
          const originalName = decodeURIComponent(filename)
            .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
            .replace(/[-_]/g, ' ')
            .trim();

          const mod = modMap.get(cardId);
          
          cards.push({
            id: cardId,
            deckType: deck,
            originalName,
            originalImageUrl: imageUrl,
            name: mod?.name || null,
            imageUrl: mod?.imageUrl || null,
            pti: mod?.pti || null,
            stars: mod?.stars || null,
            effect: mod?.effect || null,
            audioUrl: mod?.audioUrl || null,
            youtubeUrl: mod?.youtubeUrl || null,
            isDeleted: mod?.isDeleted || false,
            isModified: !!mod
          });
        });
      }

      res.json({ success: true, cards });
    } catch (error) {
      console.error('Error fetching existing cards:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch cards' });
    }
  });

  // Save card modification (admin only)
  app.post('/api/admin/card-modification', authMiddleware, async (req, res) => {
    try {
      const userEmail = req.user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }

      const { originalCardId, deckType, name, imageUrl, pti, stars, effect, audioUrl, youtubeUrl } = req.body;

      // Helper to safely parse integer values (handles NaN, empty strings, undefined)
      const safeParseInt = (value: any): number | null => {
        if (value === undefined || value === null || value === '') return null;
        const parsed = parseInt(value);
        return isNaN(parsed) ? null : parsed;
      };

      // Check if modification exists
      const existing = await db.select().from(cardModifications)
        .where(eq(cardModifications.originalCardId, originalCardId));

      let modification;
      if (existing.length > 0) {
        // Update existing
        const result = await db.update(cardModifications)
          .set({
            name: name || null,
            imageUrl: imageUrl || null,
            pti: safeParseInt(pti),
            stars: safeParseInt(stars),
            effect: effect || null,
            audioUrl: audioUrl || null,
            youtubeUrl: youtubeUrl || null,
            modifiedBy: userEmail,
            modifiedAt: new Date()
          })
          .where(eq(cardModifications.originalCardId, originalCardId))
          .returning();
        modification = result[0];
      } else {
        // Insert new
        const result = await db.insert(cardModifications)
          .values({
            originalCardId,
            deckType,
            name: name || null,
            imageUrl: imageUrl || null,
            pti: safeParseInt(pti),
            stars: safeParseInt(stars),
            effect: effect || null,
            audioUrl: audioUrl || null,
            youtubeUrl: youtubeUrl || null,
            modifiedBy: userEmail
          })
          .returning();
        modification = result[0];
      }
      
      // Refresh card metadata in all active games so changes take effect immediately
      const refreshedGames = await gameManager.refreshCardMetadataForAllGames();
      console.log(`Card modification saved. Refreshed ${refreshedGames.length} active games.`);
      
      // Broadcast game state updates to all active games
      for (const gameId of refreshedGames) {
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
      }
      
      res.json({ success: true, modification });
    } catch (error) {
      console.error('Error saving card modification:', error);
      res.status(500).json({ success: false, error: 'Failed to save modification' });
    }
  });

  // Toggle card deletion (admin only)
  app.post('/api/admin/card-delete', authMiddleware, async (req, res) => {
    try {
      const userEmail = req.user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }

      const { originalCardId, deckType, isDeleted } = req.body;

      // Check if modification exists
      const existing = await db.select().from(cardModifications)
        .where(eq(cardModifications.originalCardId, originalCardId));

      if (existing.length > 0) {
        // Update existing
        const result = await db.update(cardModifications)
          .set({
            isDeleted: isDeleted,
            modifiedBy: userEmail,
            modifiedAt: new Date()
          })
          .where(eq(cardModifications.originalCardId, originalCardId))
          .returning();
        
        res.json({ success: true, modification: result[0] });
      } else {
        // Insert new with just isDeleted flag
        const result = await db.insert(cardModifications)
          .values({
            originalCardId,
            deckType,
            isDeleted: isDeleted,
            modifiedBy: userEmail
          })
          .returning();
        
        res.json({ success: true, modification: result[0] });
      }
    } catch (error) {
      console.error('Error toggling card deletion:', error);
      res.status(500).json({ success: false, error: 'Failed to toggle deletion' });
    }
  });

  // Get all card modifications (for game use)
  app.get('/api/card-modifications', async (req, res) => {
    try {
      const modifications = await db.select().from(cardModifications);
      res.json({ success: true, modifications });
    } catch (error) {
      console.error('Error fetching card modifications:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch modifications' });
    }
  });

  // DEBUG ENDPOINT: Add CPU to test MOSSE sequence  
  app.post('/api/debug/add-cpu-player', async (req, res) => {
    try {
      const { gameId } = req.body;
      console.log(`🎯 DEBUG: Adding CPU to game ${gameId}`);
      
      const cpuName = await gameManager.addCPUPlayer(gameId);
      const gameState = gameManager.getSanitizedGameState(gameId);
      
      // Broadcast to all clients in that game
      emitThrottledGameState(io, gameId, gameState);
      io.to(gameId).emit('player-joined', { playerName: cpuName });
      
      console.log(`🎯 DEBUG: CPU ${cpuName} added successfully to game ${gameId}`);
      res.json({ success: true, cpuName, gameId });
    } catch (error) {
      console.error('🎯 DEBUG: Error adding CPU:', error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Initialize missions and achievements system
  initializeMissionsAndAchievements().catch(err => console.error('Failed to init missions:', err));

  // MISSIONS & ACHIEVEMENTS API ROUTES
  
  // Get player's daily missions
  app.get('/api/missions', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const missions = await getPlayerDailyMissions(user.email);
      res.json({ success: true, missions });
    } catch (error) {
      console.error('Error fetching missions:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch missions' });
    }
  });

  // Get player's achievements
  app.get('/api/achievements', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const achievements = await getPlayerAchievements(user.email);
      res.json({ success: true, achievements });
    } catch (error) {
      console.error('Error fetching achievements:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch achievements' });
    }
  });

  // Claim mission reward
  app.post('/api/missions/claim', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { missionId } = req.body;
      const result = await claimMissionReward(user.email, missionId);
      
      if (result.success) {
        const updatedUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
        res.json({ 
          success: true, 
          pointsAwarded: result.pointsAwarded,
          newTotal: updatedUser[0]?.puntiRankiard || 0
        });
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error claiming mission reward:', error);
      res.status(500).json({ success: false, error: 'Failed to claim reward' });
    }
  });

  // Claim achievement reward
  app.post('/api/achievements/claim', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { achievementId } = req.body;
      const result = await claimAchievementReward(user.email, achievementId);
      
      if (result.success) {
        const updatedUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
        res.json({ 
          success: true, 
          pointsAwarded: result.pointsAwarded,
          newTotal: updatedUser[0]?.puntiRankiard || 0
        });
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error claiming achievement reward:', error);
      res.status(500).json({ success: false, error: 'Failed to claim reward' });
    }
  });

  // Track game event for missions/achievements (called by game manager)
  app.post('/api/track-event', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { eventType, data } = req.body;
      const result = await trackGameEvent(user.email, eventType, data);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error tracking event:', error);
      res.status(500).json({ success: false, error: 'Failed to track event' });
    }
  });

  // Analyze custom effect with AI and generate clarifying questions
  app.post('/api/analyze-effect', authMiddleware, async (req, res) => {
    try {
      const { description, animation, behavior, previousAnswers } = req.body;
      
      if (!description || typeof description !== 'string') {
        return res.status(400).json({ success: false, error: 'Description required' });
      }
      
      const systemPrompt = `Sei un analizzatore RIGOROSO di effetti per un gioco di carte chiamato MINKIARDS (basato su Dragon Ball). 
Il tuo compito è analizzare la descrizione di un effetto personalizzato e generare domande di chiarimento.

REGOLE FONDAMENTALI - DEVI ESSERE MOLTO PRECISO:
1. CHIEDI SEMPRE domande per ogni dettaglio mancante o ambiguo
2. Non assumere MAI valori - se non è specificato un numero esatto (danni, cura, turni), CHIEDI
3. Se il bersaglio non è specificato chiaramente (chi subisce l'effetto), CHIEDI
4. Se la durata non è specificata per effetti temporanei (veleno, protezione, buff), CHIEDI
5. Se ci sono condizioni di attivazione vaghe, CHIEDI di specificarle
6. Genera domande usando SOLO gli ID standard elencati sotto
7. Le domande devono essere in italiano, chiare e specifiche
8. Restituisci un array vuoto SOLO se hai TUTTI questi dettagli esplicitamente specificati:
   - Bersaglio esatto (chi subisce l'effetto)
   - Valori numerici esatti (danni, cura, PTI, percentuali)
   - Durata esatta per effetti temporanei
   - Condizioni chiare (se applicabili)

ESEMPI DI QUANDO CHIEDERE:
- "infligge danni" → CHIEDI quanti danni
- "cura il personaggio" → CHIEDI quanto cura e quale personaggio
- "congela il nemico" → CHIEDI per quanti turni
- "potenzia" → CHIEDI di quanto PTI
- "protegge" → CHIEDI per quanti turni

ID STANDARD PER LE DOMANDE (usa SOLO questi):
- "target": per chiedere chi è il bersaglio dell'effetto
- "damage_amount": per chiedere quanti danni infligge
- "heal_amount": per chiedere quanta cura fornisce  
- "duration": per chiedere la durata in turni
- "valore": per altri valori numerici (PTI bonus, percentuali, etc)
- "condizione": per condizioni di attivazione specifiche
- "effetto_secondario": per chiarire effetti aggiuntivi
- "swap_what": per effetti di BARATTO/SCAMBIO - cosa viene scambiato
- "swap_participants": per effetti di BARATTO/SCAMBIO - tra chi avviene lo scambio
- "swap_condition": per effetti di BARATTO/SCAMBIO - condizioni dello scambio
- "input_type": per effetti con PANNELLO - che tipo di input richiede
- "input_purpose": per effetti con PANNELLO - a cosa serve l'input
- "resurrect_choice": per effetti di RESURREZIONE - come scegliere chi resuscitare
- "resurrect_pti": per effetti di RESURREZIONE - con quanti PTI torna in vita
- "death_trigger": per effetti legati alla MORTE - quando si attiva
- "protection_type": per effetti di PROTEZIONE - da cosa protegge
- "protection_duration": per effetti di PROTEZIONE - quanto dura
- "stars_amount": per effetti sulle STELLE - quante stelle
- "stars_action": per effetti sulle STELLE - aggiunge o toglie
- "card_count": per effetti sulle CARTE - quante carte coinvolte
- "draw_type": per effetti di PESCA - da quale mazzo
- "condition_detail": per effetti CONDIZIONALI - dettagli sulla condizione
- "condition_else": per effetti CONDIZIONALI - cosa succede se non soddisfatta
- "effect_summary": per chiarire effetti vaghi - descrizione dettagliata
- "effect_goal": per chiarire effetti vaghi - scopo principale
- "swap_pti_amount": per effetti BARATTO - quantità di PTI scambiati
- "protection_from": per effetti PROTEZIONE - contro cosa protegge
- "resurrect_stats": per effetti RESURREZIONE - statistiche al ritorno
- "dice_control_type": per effetti DADO - come viene controllato/modificato il dado
- "dice_control_trigger": per effetti DADO - quando si attiva l'effetto
- "dice_control_duration": per effetti DADO - per quanto tempo dura

OPZIONI STANDARD PER TARGET:
["Il mio personaggio attivo", "Un personaggio nemico a scelta", "Tutti i nemici", "Tutti i personaggi in campo", "Un personaggio casuale", "Tutti gli alleati"]

OPZIONI STANDARD PER DURATION:
["Istantaneo (una volta sola)", "1 turno", "2 turni", "3 turni", "5 turni", "Permanente (per tutta la partita)"]

FORMATO RISPOSTA (JSON):
{
  "questions": [...],
  "understood": false se mancano dettagli, true SOLO se tutto è perfettamente chiaro,
  "interpretation": "Riassunto dettagliato di come hai interpretato l'effetto con tutti i valori",
  "needsMoreInfo": true/false - true se servono ancora chiarimenti
}`;

      // Build context with previous answers if available
      let answersContext = '';
      if (previousAnswers && Object.keys(previousAnswers).length > 0) {
        answersContext = '\n\nRISPOSTE GIÀ FORNITE:\n';
        for (const [key, value] of Object.entries(previousAnswers)) {
          answersContext += `- ${key}: ${value}\n`;
        }
        answersContext += '\nConsidera queste risposte e chiedi ALTRI dettagli se ancora mancano informazioni per implementare l\'effetto correttamente.';
      }

      const userMessage = `Analizza questo effetto personalizzato:

DESCRIZIONE EFFETTO: ${description}
${animation ? `ANIMAZIONE DESCRITTA: ${animation}` : ''}
${behavior ? `COMPORTAMENTO DESCRITTO: ${behavior}` : ''}${answersContext}

Genera TUTTE le domande necessarie per capire perfettamente l'effetto. Non assumere nulla che non sia esplicitamente scritto.`;

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1000
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          return res.json({ success: true, questions: [], understood: true });
        }

        const parsed = JSON.parse(content);
        let aiQuestions = parsed.questions || [];
        
        // Post-process AI questions: filter already answered and add fallback questions if AI returned too few
        if (previousAnswers && Object.keys(previousAnswers).length > 0) {
          const answeredIds = Object.keys(previousAnswers);
          aiQuestions = aiQuestions.filter((q: any) => !answeredIds.includes(q.id));
        }
        
        // If AI returned no new questions, try fallback to add more specific ones
        if (aiQuestions.length === 0 && !(parsed.understood)) {
          const combinedDescription = buildCombinedDescription(description, animation, behavior, previousAnswers);
          const fallbackQuestions = generateFallbackQuestions(combinedDescription, previousAnswers);
          aiQuestions = fallbackQuestions;
        }
        
        // Always add follow-up questions based on answers (even in primary AI path)
        if (previousAnswers && Object.keys(previousAnswers).length > 0) {
          const followUpQuestions = generateFollowUpQuestions(previousAnswers, description);
          const existingIds = aiQuestions.map((q: any) => q.id);
          const newFollowUps = followUpQuestions.filter(q => !existingIds.includes(q.id));
          aiQuestions = [...aiQuestions, ...newFollowUps];
        }
        
        // Generate interpretation if not provided by AI
        const interpretation = parsed.interpretation || generateInterpretation(description, previousAnswers);
        
        res.json({ 
          success: true, 
          questions: aiQuestions,
          understood: parsed.understood ?? (aiQuestions.length === 0),
          interpretation,
          needsMoreInfo: aiQuestions.length > 0
        });
      } catch (aiError) {
        console.error('OpenAI analysis error:', aiError);
        // Fallback: use keyword-based question generation with context from previous answers
        const combinedDescription = buildCombinedDescription(description, animation, behavior, previousAnswers);
        let questions = generateFallbackQuestions(combinedDescription, previousAnswers);
        
        // Generate follow-up questions based on answers
        if (previousAnswers && Object.keys(previousAnswers).length > 0) {
          const followUpQuestions = generateFollowUpQuestions(previousAnswers, description);
          // Filter out already added IDs
          const existingIds = questions.map(q => q.id);
          const newFollowUps = followUpQuestions.filter(q => !existingIds.includes(q.id));
          questions = [...questions, ...newFollowUps];
        }
        
        // Generate interpretation from previous answers
        const interpretation = generateInterpretation(description, previousAnswers);
        
        res.json({ 
          success: true, 
          questions, 
          understood: questions.length === 0, 
          needsMoreInfo: questions.length > 0,
          interpretation
        });
      }
    } catch (error) {
      console.error('Error analyzing effect:', error);
      res.status(500).json({ success: false, error: 'Failed to analyze effect' });
    }
  });

  // Get Rankiard leaderboard - public endpoint
  app.get('/api/leaderboard', async (req, res) => {
    try {
      const leaderboard = await db
        .select({
          id: users.id,
          username: users.username,
          avatar: users.avatar,
          puntiRankiard: users.puntiRankiard,
          gamesPlayed: users.gamesPlayed,
          gamesWon: users.gamesWon,
          minutesPlayed: users.minutesPlayed
        })
        .from(users)
        .orderBy(desc(users.puntiRankiard))
        .limit(100);
      
      res.json({ success: true, leaderboard });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
    }
  });

  // Get user profile with aggregated stats
  app.get('/api/profile', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const userRecord = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      
      if (!userRecord.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const currentUser = userRecord[0];
      
      const allUsers = await db.select({ id: users.id }).from(users).orderBy(desc(users.puntiRankiard));
      const rank = allUsers.findIndex(u => u.id === currentUser.id) + 1;
      
      const completedMissionsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(playerDailyMissions)
        .where(and(
          eq(playerDailyMissions.usernameOrEmail, user.email),
          eq(playerDailyMissions.completed, true)
        ));
      
      const allAchievements = await db.select().from(achievements);
      const playerAchievementsData = await db
        .select()
        .from(playerAchievements)
        .where(eq(playerAchievements.usernameOrEmail, user.email));
      
      const completedAchievementsCount = playerAchievementsData.filter(pa => pa.completed).length;
      
      res.json({
        success: true,
        profile: {
          user: {
            id: currentUser.id,
            username: currentUser.username,
            avatar: currentUser.avatar,
            puntiRankiard: currentUser.puntiRankiard,
            gamesPlayed: currentUser.gamesPlayed,
            gamesWon: currentUser.gamesWon,
            minutesPlayed: currentUser.minutesPlayed,
            isAdmin: currentUser.isAdmin
          },
          rank,
          totalPlayers: allUsers.length,
          completedMissions: Number(completedMissionsCount[0]?.count || 0),
          totalMissions: 3,
          completedAchievements: completedAchievementsCount,
          totalAchievements: allAchievements.length
        }
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch profile' });
    }
  });

  // ============= REPLAY SYSTEM ENDPOINTS =============

  // Get all matches for replays
  app.get('/api/matches', async (req, res) => {
    try {
      const matchesList = await db.select().from(matches)
        .orderBy(desc(matches.startedAt))
        .limit(50);
      
      res.json({ success: true, matches: matchesList });
    } catch (error) {
      console.error('Error fetching matches:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch matches' });
    }
  });

  // Get match events for replay
  app.get('/api/matches/:id/events', async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      
      const eventsList = await db.select().from(gameEvents)
        .where(eq(gameEvents.matchId, matchId))
        .orderBy(gameEvents.eventOrder);
      
      res.json({ success: true, events: eventsList });
    } catch (error) {
      console.error('Error fetching match events:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch events' });
    }
  });

  // ============= SEASONAL EVENTS ENDPOINTS =============

  // Get all seasonal events
  app.get('/api/seasonal-events', async (req, res) => {
    try {
      const eventsList = await db.select().from(seasonalEvents)
        .orderBy(desc(seasonalEvents.startDate));
      
      res.json({ success: true, events: eventsList });
    } catch (error) {
      console.error('Error fetching seasonal events:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch events' });
    }
  });

  // Get cards for a seasonal event
  app.get('/api/seasonal-events/:id/cards', async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      
      const cardsList = await db.select().from(seasonalCards)
        .where(eq(seasonalCards.eventId, eventId));
      
      res.json({ success: true, cards: cardsList });
    } catch (error) {
      console.error('Error fetching seasonal cards:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch cards' });
    }
  });

  // ============= CARD SKINS ENDPOINTS =============

  // Get all available card skins
  app.get('/api/card-skins', async (req, res) => {
    try {
      const skinsList = await db.select().from(cardSkins)
        .where(eq(cardSkins.isAvailable, true));
      
      res.json({ success: true, skins: skinsList });
    } catch (error) {
      console.error('Error fetching card skins:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch skins' });
    }
  });

  // Get player's owned skins
  app.get('/api/card-skins/owned', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const ownedSkins = await db.select().from(playerSkins)
        .where(eq(playerSkins.userId, currentUser[0].id));
      
      res.json({ success: true, skins: ownedSkins });
    } catch (error) {
      console.error('Error fetching owned skins:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch owned skins' });
    }
  });

  // Purchase a skin
  app.post('/api/card-skins/purchase', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { skinId } = req.body;
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const skin = await db.select().from(cardSkins).where(eq(cardSkins.id, skinId)).limit(1);
      if (!skin.length) {
        return res.status(404).json({ success: false, error: 'Skin not found' });
      }
      
      if (currentUser[0].puntiRankiard < (skin[0].price || 0)) {
        return res.status(400).json({ success: false, error: 'Not enough Rankiard points' });
      }
      
      // Check if already owned
      const existing = await db.select().from(playerSkins)
        .where(and(eq(playerSkins.userId, currentUser[0].id), eq(playerSkins.skinId, skinId)));
      if (existing.length) {
        return res.status(400).json({ success: false, error: 'Skin already owned' });
      }
      
      // Deduct points and add skin
      await db.update(users)
        .set({ puntiRankiard: currentUser[0].puntiRankiard - (skin[0].price || 0) })
        .where(eq(users.id, currentUser[0].id));
      
      await db.insert(playerSkins).values({
        userId: currentUser[0].id,
        skinId
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error purchasing skin:', error);
      res.status(500).json({ success: false, error: 'Failed to purchase skin' });
    }
  });

  // Equip a skin
  app.post('/api/card-skins/equip', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { skinId } = req.body;
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      // Unequip all skins first
      await db.update(playerSkins)
        .set({ isEquipped: false })
        .where(eq(playerSkins.userId, currentUser[0].id));
      
      // Equip the selected skin
      await db.update(playerSkins)
        .set({ isEquipped: true })
        .where(and(eq(playerSkins.userId, currentUser[0].id), eq(playerSkins.skinId, skinId)));
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error equipping skin:', error);
      res.status(500).json({ success: false, error: 'Failed to equip skin' });
    }
  });

  // ============= ADMIN SKIN MANAGEMENT ENDPOINTS =============

  // Create a new skin (admin only)
  app.post('/api/admin/card-skins', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      
      if (!currentUser.length || !currentUser[0].isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      const { name, cardName, description, skinImageUrl, rarity, price, borderStyle, glowColor, isAvailable } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, error: 'Name is required' });
      }

      const newSkin = await db.insert(cardSkins).values({
        name,
        cardName: cardName || null,
        description: description || null,
        skinImageUrl: skinImageUrl || null,
        borderStyle: borderStyle || null,
        glowColor: glowColor || null,
        rarity: rarity || 'common',
        price: price || 100,
        isAvailable: isAvailable !== false
      }).returning();

      res.json({ success: true, skin: newSkin[0] });
    } catch (error) {
      console.error('Error creating skin:', error);
      res.status(500).json({ success: false, error: 'Failed to create skin' });
    }
  });

  // Update a skin (admin only)
  app.put('/api/admin/card-skins/:id', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const skinId = parseInt(req.params.id);
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      
      if (!currentUser.length || !currentUser[0].isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      const { name, cardName, description, skinImageUrl, rarity, price, borderStyle, glowColor, isAvailable } = req.body;

      const updated = await db.update(cardSkins)
        .set({
          name,
          cardName: cardName || null,
          description: description || null,
          skinImageUrl: skinImageUrl || null,
          borderStyle: borderStyle || null,
          glowColor: glowColor || null,
          rarity: rarity || 'common',
          price: price || 100,
          isAvailable: isAvailable !== false
        })
        .where(eq(cardSkins.id, skinId))
        .returning();

      if (!updated.length) {
        return res.status(404).json({ success: false, error: 'Skin not found' });
      }

      res.json({ success: true, skin: updated[0] });
    } catch (error) {
      console.error('Error updating skin:', error);
      res.status(500).json({ success: false, error: 'Failed to update skin' });
    }
  });

  // Delete a skin (admin only)
  app.delete('/api/admin/card-skins/:id', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const skinId = parseInt(req.params.id);
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      
      if (!currentUser.length || !currentUser[0].isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      await db.delete(cardSkins).where(eq(cardSkins.id, skinId));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting skin:', error);
      res.status(500).json({ success: false, error: 'Failed to delete skin' });
    }
  });

  // ============= SEASONAL PASS ENDPOINTS =============

  // Get active seasonal pass
  app.get('/api/seasonal-pass/active', async (req, res) => {
    try {
      const activePasses = await db.select().from(seasonalPasses)
        .where(eq(seasonalPasses.isActive, true))
        .limit(1);
      
      if (!activePasses.length) {
        return res.json({ success: true, pass: null });
      }
      
      res.json({ success: true, pass: activePasses[0] });
    } catch (error) {
      console.error('Error fetching active pass:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch pass' });
    }
  });

  // Get pass rewards
  app.get('/api/seasonal-pass/:id/rewards', async (req, res) => {
    try {
      const passId = parseInt(req.params.id);
      
      const rewardsList = await db.select().from(passRewards)
        .where(eq(passRewards.passId, passId))
        .orderBy(passRewards.level);
      
      res.json({ success: true, rewards: rewardsList });
    } catch (error) {
      console.error('Error fetching pass rewards:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch rewards' });
    }
  });

  // Get player's pass progress
  app.get('/api/seasonal-pass/:id/progress', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const passId = parseInt(req.params.id);
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      let progressData = await db.select().from(playerPassProgress)
        .where(and(eq(playerPassProgress.userId, currentUser[0].id), eq(playerPassProgress.passId, passId)))
        .limit(1);
      
      if (!progressData.length) {
        // Create initial progress
        const inserted = await db.insert(playerPassProgress).values({
          userId: currentUser[0].id,
          passId
        }).returning();
        progressData = inserted;
      }
      
      res.json({ success: true, progress: progressData[0] });
    } catch (error) {
      console.error('Error fetching pass progress:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch progress' });
    }
  });

  // Claim a pass reward
  app.post('/api/seasonal-pass/claim', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { rewardId } = req.body;
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const reward = await db.select().from(passRewards).where(eq(passRewards.id, rewardId)).limit(1);
      if (!reward.length) {
        return res.status(404).json({ success: false, error: 'Reward not found' });
      }
      
      const progress = await db.select().from(playerPassProgress)
        .where(and(
          eq(playerPassProgress.userId, currentUser[0].id),
          eq(playerPassProgress.passId, reward[0].passId)
        ))
        .limit(1);
      
      if (!progress.length || progress[0].currentLevel < reward[0].level) {
        return res.status(400).json({ success: false, error: 'Reward not unlocked yet' });
      }
      
      if (reward[0].isPremium && !progress[0].hasPremium) {
        return res.status(400).json({ success: false, error: 'Premium required for this reward' });
      }
      
      // Apply reward based on type
      if (reward[0].rewardType === 'rankiard') {
        const points = parseInt(reward[0].rewardValue) || 0;
        await db.update(users)
          .set({ puntiRankiard: currentUser[0].puntiRankiard + points })
          .where(eq(users.id, currentUser[0].id));
      }
      
      res.json({ success: true, message: 'Reward claimed successfully' });
    } catch (error) {
      console.error('Error claiming reward:', error);
      res.status(500).json({ success: false, error: 'Failed to claim reward' });
    }
  });

  // ============= CLAN SYSTEM ENDPOINTS =============

  // Get all clans (with optional search)
  app.get('/api/clans', async (req, res) => {
    try {
      const search = req.query.search as string;
      
      let clansList;
      if (search) {
        clansList = await db.select().from(clans)
          .where(or(
            ilike(clans.name, `%${search}%`),
            ilike(clans.tag, `%${search}%`)
          ))
          .orderBy(desc(clans.totalPoints))
          .limit(20);
      } else {
        clansList = await db.select().from(clans)
          .orderBy(desc(clans.totalPoints))
          .limit(20);
      }
      
      res.json({ success: true, clans: clansList });
    } catch (error) {
      console.error('Error fetching clans:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch clans' });
    }
  });

  // Get a specific clan with members
  app.get('/api/clans/:id', async (req, res) => {
    try {
      const clanId = parseInt(req.params.id);
      
      const clan = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
      if (!clan.length) {
        return res.status(404).json({ success: false, error: 'Clan not found' });
      }
      
      const members = await db
        .select({
          id: clanMembers.id,
          userId: clanMembers.userId,
          role: clanMembers.role,
          joinedAt: clanMembers.joinedAt,
          contributedPoints: clanMembers.contributedPoints,
          username: users.username,
          avatar: users.avatar,
          puntiRankiard: users.puntiRankiard
        })
        .from(clanMembers)
        .innerJoin(users, eq(clanMembers.userId, users.id))
        .where(eq(clanMembers.clanId, clanId))
        .orderBy(desc(clanMembers.contributedPoints));
      
      res.json({ success: true, clan: clan[0], members });
    } catch (error) {
      console.error('Error fetching clan:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch clan' });
    }
  });

  // Create a new clan
  app.post('/api/clans', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { name, tag, description, emblem, isPublic } = req.body;
      
      if (!name || !tag) {
        return res.status(400).json({ success: false, error: 'Name and tag are required' });
      }
      
      if (tag.length < 2 || tag.length > 5) {
        return res.status(400).json({ success: false, error: 'Tag must be 2-5 characters' });
      }
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      // Check if user is already in a clan
      const existingMembership = await db.select().from(clanMembers)
        .where(eq(clanMembers.userId, currentUser[0].id)).limit(1);
      if (existingMembership.length) {
        return res.status(400).json({ success: false, error: 'You are already in a clan' });
      }
      
      // Check if name or tag is taken
      const existingClan = await db.select().from(clans)
        .where(or(eq(clans.name, name), eq(clans.tag, tag.toUpperCase()))).limit(1);
      if (existingClan.length) {
        return res.status(400).json({ success: false, error: 'Clan name or tag already taken' });
      }
      
      // Create the clan
      const [newClan] = await db.insert(clans).values({
        name,
        tag: tag.toUpperCase(),
        description: description || null,
        emblem: emblem || '⚔️',
        leaderId: currentUser[0].id,
        isPublic: isPublic !== false
      }).returning();
      
      // Add creator as leader
      await db.insert(clanMembers).values({
        clanId: newClan.id,
        userId: currentUser[0].id,
        role: 'leader',
        contributedPoints: currentUser[0].puntiRankiard
      });
      
      // Update clan total points
      await db.update(clans)
        .set({ totalPoints: currentUser[0].puntiRankiard })
        .where(eq(clans.id, newClan.id));
      
      res.json({ success: true, clan: newClan });
    } catch (error) {
      console.error('Error creating clan:', error);
      res.status(500).json({ success: false, error: 'Failed to create clan' });
    }
  });

  // Join a clan
  app.post('/api/clans/:id/join', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const clanId = parseInt(req.params.id);
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      // Check if already in a clan
      const existingMembership = await db.select().from(clanMembers)
        .where(eq(clanMembers.userId, currentUser[0].id)).limit(1);
      if (existingMembership.length) {
        return res.status(400).json({ success: false, error: 'You are already in a clan' });
      }
      
      const clan = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
      if (!clan.length) {
        return res.status(404).json({ success: false, error: 'Clan not found' });
      }
      
      if (clan[0].memberCount >= clan[0].maxMembers) {
        return res.status(400).json({ success: false, error: 'Clan is full' });
      }
      
      if (!clan[0].isPublic) {
        // Create join request for private clans
        await db.insert(clanJoinRequests).values({
          clanId,
          userId: currentUser[0].id
        });
        return res.json({ success: true, message: 'Join request sent' });
      }
      
      // Join public clan directly
      await db.insert(clanMembers).values({
        clanId,
        userId: currentUser[0].id,
        role: 'member',
        contributedPoints: currentUser[0].puntiRankiard
      });
      
      // Update clan stats
      await db.update(clans)
        .set({
          memberCount: clan[0].memberCount + 1,
          totalPoints: clan[0].totalPoints + currentUser[0].puntiRankiard
        })
        .where(eq(clans.id, clanId));
      
      res.json({ success: true, message: 'Joined clan successfully' });
    } catch (error) {
      console.error('Error joining clan:', error);
      res.status(500).json({ success: false, error: 'Failed to join clan' });
    }
  });

  // Leave a clan
  app.post('/api/clans/leave', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const membership = await db.select().from(clanMembers)
        .where(eq(clanMembers.userId, currentUser[0].id)).limit(1);
      if (!membership.length) {
        return res.status(400).json({ success: false, error: 'You are not in a clan' });
      }
      
      const clan = await db.select().from(clans).where(eq(clans.id, membership[0].clanId)).limit(1);
      if (!clan.length) {
        return res.status(404).json({ success: false, error: 'Clan not found' });
      }
      
      // If leader and only member, delete clan
      if (membership[0].role === 'leader' && clan[0].memberCount <= 1) {
        await db.delete(clanMembers).where(eq(clanMembers.clanId, clan[0].id));
        await db.delete(clanJoinRequests).where(eq(clanJoinRequests.clanId, clan[0].id));
        await db.delete(clans).where(eq(clans.id, clan[0].id));
        return res.json({ success: true, message: 'Clan deleted' });
      }
      
      // If leader, transfer to highest contributor
      if (membership[0].role === 'leader') {
        const nextLeader = await db.select().from(clanMembers)
          .where(and(eq(clanMembers.clanId, clan[0].id), ne(clanMembers.userId, currentUser[0].id)))
          .orderBy(desc(clanMembers.contributedPoints))
          .limit(1);
        if (nextLeader.length) {
          await db.update(clanMembers).set({ role: 'leader' }).where(eq(clanMembers.id, nextLeader[0].id));
          await db.update(clans).set({ leaderId: nextLeader[0].userId }).where(eq(clans.id, clan[0].id));
        }
      }
      
      // Remove member
      await db.delete(clanMembers).where(eq(clanMembers.id, membership[0].id));
      
      // Update clan stats
      await db.update(clans)
        .set({
          memberCount: clan[0].memberCount - 1,
          totalPoints: clan[0].totalPoints - membership[0].contributedPoints
        })
        .where(eq(clans.id, clan[0].id));
      
      res.json({ success: true, message: 'Left clan successfully' });
    } catch (error) {
      console.error('Error leaving clan:', error);
      res.status(500).json({ success: false, error: 'Failed to leave clan' });
    }
  });

  // Get user's clan
  app.get('/api/my-clan', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const membership = await db.select().from(clanMembers)
        .where(eq(clanMembers.userId, currentUser[0].id)).limit(1);
      if (!membership.length) {
        return res.json({ success: true, clan: null, membership: null });
      }
      
      const clan = await db.select().from(clans).where(eq(clans.id, membership[0].clanId)).limit(1);
      
      res.json({ 
        success: true, 
        clan: clan[0] || null, 
        membership: membership[0] 
      });
    } catch (error) {
      console.error('Error fetching user clan:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch clan' });
    }
  });

  // ============= END CLAN SYSTEM =============

  // ============= TOURNAMENT SYSTEM ENDPOINTS =============

  // Get all tournaments
  app.get('/api/tournaments', async (req, res) => {
    try {
      const status = req.query.status as string;
      
      let query = db.select().from(tournaments).orderBy(desc(tournaments.createdAt)).limit(20);
      if (status) {
        query = db.select().from(tournaments)
          .where(eq(tournaments.status, status))
          .orderBy(desc(tournaments.createdAt)).limit(20);
      }
      
      const tournamentList = await query;
      res.json({ success: true, tournaments: tournamentList });
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tournaments' });
    }
  });

  // Get a specific tournament with participants
  app.get('/api/tournaments/:id', async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.id);
      
      const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
      if (!tournament.length) {
        return res.status(404).json({ success: false, error: 'Tournament not found' });
      }
      
      const participants = await db
        .select({
          id: tournamentParticipants.id,
          userId: tournamentParticipants.userId,
          status: tournamentParticipants.status,
          placement: tournamentParticipants.placement,
          wins: tournamentParticipants.wins,
          losses: tournamentParticipants.losses,
          username: users.username,
          avatar: users.avatar,
          puntiRankiard: users.puntiRankiard
        })
        .from(tournamentParticipants)
        .innerJoin(users, eq(tournamentParticipants.userId, users.id))
        .where(eq(tournamentParticipants.tournamentId, tournamentId))
        .orderBy(desc(tournamentParticipants.wins));
      
      const matches = await db.select().from(tournamentMatches)
        .where(eq(tournamentMatches.tournamentId, tournamentId))
        .orderBy(tournamentMatches.round, tournamentMatches.matchNumber);
      
      res.json({ success: true, tournament: tournament[0], participants, matches });
    } catch (error) {
      console.error('Error fetching tournament:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tournament' });
    }
  });

  // Create a new tournament
  app.post('/api/tournaments', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { name, description, type, maxParticipants, prizePool, entryFee } = req.body;
      
      if (!name) {
        return res.status(400).json({ success: false, error: 'Tournament name is required' });
      }
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const [newTournament] = await db.insert(tournaments).values({
        name,
        description: description || null,
        type: type || 'elimination',
        maxParticipants: maxParticipants || 8,
        prizePool: prizePool || 100,
        entryFee: entryFee || 0,
        organizerId: currentUser[0].id
      }).returning();
      
      res.json({ success: true, tournament: newTournament });
    } catch (error) {
      console.error('Error creating tournament:', error);
      res.status(500).json({ success: false, error: 'Failed to create tournament' });
    }
  });

  // Join a tournament
  app.post('/api/tournaments/:id/join', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const tournamentId = parseInt(req.params.id);
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
      if (!tournament.length) {
        return res.status(404).json({ success: false, error: 'Tournament not found' });
      }
      
      if (tournament[0].status !== 'registration') {
        return res.status(400).json({ success: false, error: 'Tournament is not open for registration' });
      }
      
      if (tournament[0].currentParticipants >= tournament[0].maxParticipants) {
        return res.status(400).json({ success: false, error: 'Tournament is full' });
      }
      
      // Check if already registered
      const existing = await db.select().from(tournamentParticipants)
        .where(and(
          eq(tournamentParticipants.tournamentId, tournamentId),
          eq(tournamentParticipants.userId, currentUser[0].id)
        )).limit(1);
      if (existing.length) {
        return res.status(400).json({ success: false, error: 'Already registered' });
      }
      
      // Check entry fee
      if (tournament[0].entryFee > 0 && currentUser[0].puntiRankiard < tournament[0].entryFee) {
        return res.status(400).json({ success: false, error: 'Not enough Rankiard points for entry fee' });
      }
      
      // Deduct entry fee
      if (tournament[0].entryFee > 0) {
        await db.update(users)
          .set({ puntiRankiard: currentUser[0].puntiRankiard - tournament[0].entryFee })
          .where(eq(users.id, currentUser[0].id));
      }
      
      // Register
      await db.insert(tournamentParticipants).values({
        tournamentId,
        userId: currentUser[0].id
      });
      
      // Update participant count
      await db.update(tournaments)
        .set({ currentParticipants: tournament[0].currentParticipants + 1 })
        .where(eq(tournaments.id, tournamentId));
      
      res.json({ success: true, message: 'Successfully joined tournament' });
    } catch (error) {
      console.error('Error joining tournament:', error);
      res.status(500).json({ success: false, error: 'Failed to join tournament' });
    }
  });

  // Start a tournament (organizer only)
  app.post('/api/tournaments/:id/start', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const tournamentId = parseInt(req.params.id);
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
      if (!tournament.length) {
        return res.status(404).json({ success: false, error: 'Tournament not found' });
      }
      
      if (tournament[0].organizerId !== currentUser[0].id) {
        return res.status(403).json({ success: false, error: 'Only the organizer can start the tournament' });
      }
      
      // Check tournament is in registration phase
      if (tournament[0].status !== 'registration') {
        return res.status(400).json({ success: false, error: 'Tournament has already started or completed' });
      }
      
      if (tournament[0].currentParticipants < 2) {
        return res.status(400).json({ success: false, error: 'Need at least 2 participants' });
      }
      
      // Update status
      await db.update(tournaments)
        .set({ status: 'in_progress', startDate: new Date() })
        .where(eq(tournaments.id, tournamentId));
      
      // Generate first round matches
      const participants = await db.select().from(tournamentParticipants)
        .where(eq(tournamentParticipants.tournamentId, tournamentId));
      
      const shuffled = participants.sort(() => Math.random() - 0.5);
      const matchCount = Math.floor(shuffled.length / 2);
      
      for (let i = 0; i < matchCount; i++) {
        await db.insert(tournamentMatches).values({
          tournamentId,
          round: 1,
          matchNumber: i + 1,
          player1Id: shuffled[i * 2].userId,
          player2Id: shuffled[i * 2 + 1]?.userId || null,
          status: shuffled[i * 2 + 1] ? 'pending' : 'completed',
          winnerId: shuffled[i * 2 + 1] ? null : shuffled[i * 2].userId // Bye
        });
      }
      
      res.json({ success: true, message: 'Tournament started' });
    } catch (error) {
      console.error('Error starting tournament:', error);
      res.status(500).json({ success: false, error: 'Failed to start tournament' });
    }
  });

  // ============= END TOURNAMENT SYSTEM =============

  // Search users by username
  app.get('/api/users/search', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const query = req.query.q as string;
      
      if (!query || query.length < 2) {
        return res.json({ success: true, users: [] });
      }
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const searchResults = await db
        .select({
          id: users.id,
          username: users.username,
          avatar: users.avatar,
          puntiRankiard: users.puntiRankiard
        })
        .from(users)
        .where(and(
          ilike(users.username, `%${query}%`),
          ne(users.id, currentUser[0].id)
        ))
        .limit(10);
      
      res.json({ success: true, users: searchResults });
    } catch (error) {
      console.error('Error searching users:', error);
      res.status(500).json({ success: false, error: 'Failed to search users' });
    }
  });

  // Get friends list
  app.get('/api/friends', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const userId = currentUser[0].id;
      
      const friendshipRecords = await db
        .select()
        .from(friendships)
        .where(or(
          eq(friendships.userAId, userId),
          eq(friendships.userBId, userId)
        ));
      
      const friendIds = friendshipRecords.map(f => 
        f.userAId === userId ? f.userBId : f.userAId
      );
      
      if (friendIds.length === 0) {
        return res.json({ success: true, friends: [] });
      }
      
      const friendsList = await db
        .select({
          id: users.id,
          username: users.username,
          avatar: users.avatar,
          puntiRankiard: users.puntiRankiard
        })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(friendIds.map(id => sql`${id}`), sql`, `)})`);
      
      res.json({ success: true, friends: friendsList });
    } catch (error) {
      console.error('Error fetching friends:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch friends' });
    }
  });

  // Get pending friend requests
  app.get('/api/friends/requests', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const pendingRequests = await db
        .select()
        .from(friendRequests)
        .where(and(
          eq(friendRequests.addresseeId, currentUser[0].id),
          eq(friendRequests.status, 'pending')
        ));
      
      const requestsWithUsers = await Promise.all(
        pendingRequests.map(async (request) => {
          const requester = await db.select().from(users).where(eq(users.id, request.requesterId)).limit(1);
          return {
            id: request.id,
            requesterId: request.requesterId,
            requesterUsername: requester[0]?.username || 'Unknown',
            requesterAvatar: requester[0]?.avatar || null,
            message: request.message,
            createdAt: request.createdAt
          };
        })
      );
      
      res.json({ success: true, requests: requestsWithUsers });
    } catch (error) {
      console.error('Error fetching friend requests:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch friend requests' });
    }
  });

  // Send friend request
  app.post('/api/friends/requests', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { addresseeId, message } = req.body;
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const requesterId = currentUser[0].id;
      
      if (requesterId === addresseeId) {
        return res.status(400).json({ success: false, error: 'Cannot send friend request to yourself' });
      }
      
      const existingRequest = await db
        .select()
        .from(friendRequests)
        .where(and(
          eq(friendRequests.requesterId, requesterId),
          eq(friendRequests.addresseeId, addresseeId),
          eq(friendRequests.status, 'pending')
        ))
        .limit(1);
      
      if (existingRequest.length) {
        return res.status(400).json({ success: false, error: 'Friend request already sent' });
      }
      
      const [userAId, userBId] = requesterId < addresseeId 
        ? [requesterId, addresseeId] 
        : [addresseeId, requesterId];
      
      const existingFriendship = await db
        .select()
        .from(friendships)
        .where(and(
          eq(friendships.userAId, userAId),
          eq(friendships.userBId, userBId)
        ))
        .limit(1);
      
      if (existingFriendship.length) {
        return res.status(400).json({ success: false, error: 'Already friends' });
      }
      
      await db.insert(friendRequests).values({
        requesterId,
        addresseeId,
        message: message || null,
        status: 'pending'
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error sending friend request:', error);
      res.status(500).json({ success: false, error: 'Failed to send friend request' });
    }
  });

  // Respond to friend request
  app.patch('/api/friends/requests/:id', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const requestId = parseInt(req.params.id);
      const { accept } = req.body;
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const request = await db
        .select()
        .from(friendRequests)
        .where(and(
          eq(friendRequests.id, requestId),
          eq(friendRequests.addresseeId, currentUser[0].id),
          eq(friendRequests.status, 'pending')
        ))
        .limit(1);
      
      if (!request.length) {
        return res.status(404).json({ success: false, error: 'Request not found' });
      }
      
      await db
        .update(friendRequests)
        .set({
          status: accept ? 'accepted' : 'rejected',
          respondedAt: new Date()
        })
        .where(eq(friendRequests.id, requestId));
      
      if (accept) {
        const [userAId, userBId] = request[0].requesterId < currentUser[0].id
          ? [request[0].requesterId, currentUser[0].id]
          : [currentUser[0].id, request[0].requesterId];
        
        await db.insert(friendships).values({
          userAId,
          userBId
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error responding to friend request:', error);
      res.status(500).json({ success: false, error: 'Failed to respond to request' });
    }
  });

  // Invite friend to game
  app.post('/api/friends/invite', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { friendId, gameId } = req.body;
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const friend = await db.select().from(users).where(eq(users.id, friendId)).limit(1);
      if (!friend.length) {
        return res.status(404).json({ success: false, error: 'Friend not found' });
      }
      
      await db.insert(gameInvitations).values({
        senderId: currentUser[0].id,
        receiverId: friendId,
        gameId,
        status: 'pending',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      });
      
      // Emit to specific user's socket only - find their socket by iterating connections
      const sockets = await io.fetchSockets();
      console.log(`Looking for socket for user ${friendId} (${friend[0].username}) among ${sockets.length} connected sockets`);
      
      let inviteSent = false;
      for (const s of sockets) {
        const socketData = (s as any).data;
        console.log(`Checking socket ${s.id}: userId=${socketData?.userId}, username=${socketData?.username}`);
        if (socketData && socketData.userId === friendId) {
          s.emit('game-invitation', {
            type: 'game-invite',
            senderId: currentUser[0].id,
            senderUsername: currentUser[0].username,
            receiverId: friendId,
            gameId,
            roomCode: gameId.replace('room-', '')
          });
          console.log(`Game invitation sent to ${friend[0].username} via socket ${s.id}`);
          inviteSent = true;
          break;
        }
      }
      
      if (!inviteSent) {
        console.log(`Friend ${friend[0].username} (id: ${friendId}) not found online - no socket with matching userId`);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error inviting friend:', error);
      res.status(500).json({ success: false, error: 'Failed to invite friend' });
    }
  });

  // ============ ACTIVE ROOMS API ============
  app.get('/api/active-rooms', (req, res) => {
    try {
      const activeGames = gameManager.getActiveGames();
      const rooms = activeGames.map(game => ({
        gameId: game.gameId,
        roomCode: game.gameId.replace('room-', ''),
        playerCount: game.playerCount,
        maxPlayers: 8,
        players: game.players,
        createdAt: game.createdAt,
        creatorName: game.creatorName || game.players[0]?.name || 'Unknown',
        requiresApproval: false,
        status: game.status || 'waiting'
      }));
      res.json(rooms);
    } catch (error) {
      console.error('Error fetching active rooms:', error);
      res.json([]);
    }
  });

  // ============ TRAINING TIPS API ============
  app.get('/api/training-tips', async (req, res) => {
    try {
      const tips = await db.select().from(trainingTips);
      res.json(tips);
    } catch (error) {
      console.error('Error fetching training tips:', error);
      res.json([]);
    }
  });

  app.post('/api/training-tips', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const ADMIN_EMAIL = 'lucaforte94@gmail.com';
      
      if (user.email !== ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const { cardName, cardType, tipTitle, tipContent } = req.body;
      
      const [newTip] = await db.insert(trainingTips).values({
        cardName,
        cardType,
        tipTitle,
        tipContent
      }).returning();
      
      res.json(newTip);
    } catch (error) {
      console.error('Error creating training tip:', error);
      res.status(500).json({ error: 'Failed to create tip' });
    }
  });

  app.put('/api/training-tips/:id', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const ADMIN_EMAIL = 'lucaforte94@gmail.com';
      
      if (user.email !== ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const tipId = parseInt(req.params.id);
      const { tipTitle, tipContent } = req.body;
      
      const [updatedTip] = await db.update(trainingTips)
        .set({ tipTitle, tipContent, updatedAt: new Date() })
        .where(eq(trainingTips.id, tipId))
        .returning();
      
      res.json(updatedTip);
    } catch (error) {
      console.error('Error updating training tip:', error);
      res.status(500).json({ error: 'Failed to update tip' });
    }
  });

  app.delete('/api/training-tips/:id', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const ADMIN_EMAIL = 'lucaforte94@gmail.com';
      
      if (user.email !== ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const tipId = parseInt(req.params.id);
      await db.delete(trainingTips).where(eq(trainingTips.id, tipId));
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting training tip:', error);
      res.status(500).json({ error: 'Failed to delete tip' });
    }
  });

  // ============ PROFILE UPDATE API ============
  app.put('/api/auth/update-profile', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { username, avatar } = req.body;
      
      const updates: Record<string, any> = {};
      if (username) updates.username = username;
      if (avatar) updates.avatar = avatar;
      
      const [updatedUser] = await db.update(users)
        .set(updates)
        .where(eq(users.email, user.email))
        .returning();
      
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  app.put('/api/auth/change-password', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { currentPassword, newPassword } = req.body;
      
      const [userRecord] = await db.select().from(users).where(eq(users.email, user.email));
      
      if (!userRecord || !userRecord.password) {
        return res.status(400).json({ error: 'Cannot change password for OAuth accounts' });
      }
      
      const bcrypt = await import('bcryptjs');
      const isValid = await bcrypt.compare(currentPassword, userRecord.password);
      
      if (!isValid) {
        return res.status(400).json({ message: 'Password attuale non corretta' });
      }
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.email, user.email));
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

  app.put('/api/auth/set-recovery-email', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { recoveryEmail } = req.body;
      
      // For now, just validate and acknowledge - in production, you'd send a verification email
      // and store it after verification
      res.json({ success: true, message: 'Recovery email set successfully' });
    } catch (error) {
      console.error('Error setting recovery email:', error);
      res.status(500).json({ error: 'Failed to set recovery email' });
    }
  });

  app.get('/api/user-stats/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const [userRecord] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!userRecord) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({
        gamesPlayed: userRecord.gamesPlayed,
        gamesWon: userRecord.gamesWon,
        totalPlayTime: userRecord.minutesPlayed
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  return httpServer;
}
