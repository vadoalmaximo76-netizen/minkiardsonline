import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketServer } from "socket.io";
import { GameManager } from "./gameManager";
import OpenAI from "openai";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { db, legacyDb, isDatabaseAvailable, isLegacyDbAvailable } from "./db";
import { personaggi, customCards, cardModifications, users, friendRequests, friendships, gameInvitations, playerAchievements, playerDailyMissions, trainingTips, clans, clanMembers, clanJoinRequests, tournaments, tournamentParticipants, tournamentMatches, matches, gameEvents, seasonalEvents, seasonalCards, playerSkins, seasonalPasses, passRewards, playerPassProgress, conversations, privateMessages, pushSubscriptions, cardCollection, userDraftCredits, draftDecks, creditPurchases } from "../shared/schema";
import { jsonStorage } from "./jsonStorage";
import { eq, ilike, and, desc, or, ne, sql, inArray } from "drizzle-orm";
import { CARD_DATA } from "../client/src/lib/cardData";
import { authMiddleware, ADMIN_FALLBACK, JWT_SECRET } from "./auth";
import { setPlayerOnline, rateLimit as redisRateLimit, isRedisConfigured, updateLeaderboard as redisUpdateLeaderboard, cacheGet, cacheSet } from "./redis";
import { getOptimizedCardUrl, isCloudinaryConfigured } from "./cloudinary";
import { captureError } from "./sentry";
import { emitSync } from "./dbSync";

const jwtSecret = JWT_SECRET;

async function checkAdminAccess(user: { userId: number; email: string | null }): Promise<boolean> {
  if (user.userId === ADMIN_FALLBACK.id && user.email === ADMIN_FALLBACK.email) {
    return true;
  }
  
  if (user.email?.toLowerCase() === ADMIN_FALLBACK.email.toLowerCase()) {
    return true;
  }
  
  if (!isDatabaseAvailable()) {
    return user.email?.toLowerCase() === ADMIN_FALLBACK.email.toLowerCase();
  }
  
  try {
    const currentUser = await db.select().from(users).where(eq(users.email, user.email || '')).limit(1);
    return currentUser.length > 0 && currentUser[0].isAdmin === true;
  } catch (dbError) {
    return user.email?.toLowerCase() === ADMIN_FALLBACK.email.toLowerCase();
  }
}
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

// Rematch voting state
const rematchVotes = new Map<string, Set<string>>(); // gameId -> Set(playerName)
const rematchTimers = new Map<string, NodeJS.Timeout>(); // gameId -> expiry timer

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
  
  // If no youtubeUrl in card memory, try JSON storage lookup
  if (!youtubeUrl && card.name) {
    try {
      // Check customCards JSON storage
      const customCards = jsonStorage.customCards.getAll();
      const customCardMatch = customCards.find(c => c.name === card.name);
      if (customCardMatch && customCardMatch.youtubeUrl) {
        youtubeUrl = customCardMatch.youtubeUrl;
        console.log(`[emitCardPlayed] Found youtubeUrl from customCards JSON for ${card.name}: ${youtubeUrl}`);
      }
      
      // Also check cardModifications JSON storage if still no youtubeUrl
      if (!youtubeUrl) {
        const mod = jsonStorage.cardModifications.getByOriginalCardId(card.id);
        if (mod && mod.youtubeUrl) {
          youtubeUrl = mod.youtubeUrl;
          console.log(`[emitCardPlayed] Found youtubeUrl from cardModifications JSON for ${card.id}: ${youtubeUrl}`);
        }
      }
    } catch (jsonError) {
      console.error('[emitCardPlayed] Error checking JSON storage for youtubeUrl:', jsonError);
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

async function executeCpuDuelAttackSequence(
  io: SocketServer,
  gameId: string,
  gameManager: any,
  cpuName: string,
  duelCardId: string,
  initiatorPlayer: string,
  opponentCharacterId: string
) {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  const getCardName = (url: string) => {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.(png|jpg|jpeg|gif|webp)$/i, '').replace(/[-_]/g, ' ');
  };
  
  const getStars = (card: any) => {
    let stars = card?.stars ?? 1;
    if (card?.text) {
      const m = card.text.match(/[Ss]telle[:\s]*(\d+)/i);
      if (m) stars = parseInt(m[1]);
    }
    return stars;
  };
  
  await delay(1500);
  
  const gs1 = gameManager.getGameState(gameId);
  const duelCardOnField = gs1?.field.find((c: any) => c.id === duelCardId);
  const duelState1 = gameManager.getDuelState(gameId);
  if (!duelState1 || !duelState1.active) {
    console.log(`⚔️ DUELLO: Duel already ended before CPU attack, ending turn`);
    const nxt = gameManager.endTurn(gameId, cpuName);
    if (nxt) {
      io.to(gameId).emit('next-turn', { nextPlayer: nxt });
      const gs = gameManager.getGameState(gameId);
      if (gs && gs.players[nxt]?.isCPU) {
        setTimeout(() => gameManager.processCPUTurn(gameId, nxt, io), 2000);
      }
    }
    return;
  }
  
  if (duelCardOnField) {
    const cpuChar = gs1?.field.find((c: any) =>
      c.owner === initiatorPlayer &&
      (c.type === 'personaggi' || c.type === 'personaggi_speciali')
    );
    const duelloDmg = (duelCardOnField.mosseDamageValue || 100) * getStars(cpuChar);
    
    console.log(`⚔️ DUELLO: CPU ${cpuName} attacking with DUELLO card, damage=${duelloDmg}`);
    io.to(gameId).emit('chat-message', {
      id: `${Date.now()}-duel-card-attack`,
      playerName: cpuName,
      message: `⚔️ Attacco con la carta DUELLO! Danno: ${duelloDmg}`,
      timestamp: Date.now()
    });
    
    const duelAttackResult = await gameManager.executeMossaAttack(
      gameId, initiatorPlayer, duelCardId, opponentCharacterId, duelloDmg
    );
    
    if (duelAttackResult.success && duelAttackResult.result?.requiresDefenseResponse) {
      await gameManager.emitDefenseRequest(gameId, io);
    }
    
    gameManager.returnToDeck(gameId, duelCardId, initiatorPlayer);
    emitThrottledGameState(io, gameId, gameManager.getSanitizedGameState(gameId));
  }
  
  await delay(2000);
  
  const duelState2 = gameManager.getDuelState(gameId);
  if (!duelState2 || !duelState2.active) {
    console.log(`⚔️ DUELLO: Duel ended after DUELLO attack, skipping follow-up MOSSE`);
    const nxt = gameManager.endTurn(gameId, cpuName);
    if (nxt) {
      io.to(gameId).emit('next-turn', { nextPlayer: nxt });
      const gs = gameManager.getGameState(gameId);
      if (gs && gs.players[nxt]?.isCPU) {
        setTimeout(() => gameManager.processCPUTurn(gameId, nxt, io), 2000);
      }
    }
    return;
  }
  
  const gs2 = gameManager.getGameState(gameId);
  const cpuPlayerData = gs2?.players[initiatorPlayer];
  const mosseInHand = cpuPlayerData?.hand?.find((c: any) => c.type === 'mosse');
  
  if (mosseInHand) {
    console.log(`⚔️ DUELLO: CPU ${cpuName} playing follow-up MOSSE card ${mosseInHand.id}`);
    const mossePlayResult = await gameManager.playCard(gameId, mosseInHand.id, initiatorPlayer);
    if (mossePlayResult.card) {
      await emitCardPlayed(io, gameId, mossePlayResult.card, initiatorPlayer);
      emitThrottledGameState(io, gameId, gameManager.getSanitizedGameState(gameId));
      
      await delay(1500);
      
      const duelState3 = gameManager.getDuelState(gameId);
      if (!duelState3 || !duelState3.active) {
        console.log(`⚔️ DUELLO: Duel ended before follow-up MOSSE attack, ending turn`);
        const nxt = gameManager.endTurn(gameId, cpuName);
        if (nxt) {
          io.to(gameId).emit('next-turn', { nextPlayer: nxt });
          const gs = gameManager.getGameState(gameId);
          if (gs && gs.players[nxt]?.isCPU) {
            setTimeout(() => gameManager.processCPUTurn(gameId, nxt, io), 2000);
          }
        }
        return;
      }
      
      const gs3 = gameManager.getGameState(gameId);
      const mosseOnField = gs3?.field.find((c: any) => c.id === mosseInHand.id && c.owner === initiatorPlayer);
      if (mosseOnField) {
        const cpuChar2 = gs3?.field.find((c: any) =>
          c.owner === initiatorPlayer &&
          (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        const mosseDmg = (mosseOnField.mosseDamageValue || 100) * getStars(cpuChar2);
        const mosseName = getCardName(mosseOnField.frontImage || '');
        
        console.log(`⚔️ DUELLO: CPU ${cpuName} attacking with follow-up MOSSE "${mosseName}", damage=${mosseDmg}`);
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-duel-mosse-attack`,
          playerName: cpuName,
          message: `⚔️ Attacco con ${mosseName}! Danno: ${mosseDmg}`,
          timestamp: Date.now()
        });
        
        const mosseAttackResult = await gameManager.executeMossaAttack(
          gameId, initiatorPlayer, mosseInHand.id, opponentCharacterId, mosseDmg
        );
        
        if (mosseAttackResult.success && mosseAttackResult.result?.requiresDefenseResponse) {
          await gameManager.emitDefenseRequest(gameId, io);
        }
        
        gameManager.returnToDeck(gameId, mosseInHand.id, initiatorPlayer);
        emitThrottledGameState(io, gameId, gameManager.getSanitizedGameState(gameId));
      }
    }
  } else {
    console.log(`⚔️ DUELLO: CPU ${cpuName} has no MOSSE card in hand for follow-up`);
  }
  
  await delay(1500);
  const nxt = gameManager.endTurn(gameId, cpuName);
  if (nxt) {
    io.to(gameId).emit('next-turn', { nextPlayer: nxt });
    const gs = gameManager.getGameState(gameId);
    if (gs && gs.players[nxt]?.isCPU) {
      setTimeout(() => gameManager.processCPUTurn(gameId, nxt, io), 2000);
    }
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
  
  if (!isDatabaseAvailable()) {
    return null;
  }
  
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
    pingTimeout: 120000, // 120s timeout for slow/mobile connections
    pingInterval: 15000, // 15s ping to keep connection alive through proxies
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
        let userRecord: any[] = [];
        if (isDatabaseAvailable()) {
          userRecord = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
        } else {
          const jsonUser = jsonStorage.users.getAll().find((u: any) => u.id === decoded.userId);
          if (jsonUser) userRecord = [jsonUser];
        }
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
        const decoded = jwt.verify(authToken, jwtSecret) as { userId: number; email: string };
        
        if (decoded && decoded.userId) {
          let userRecord: any[] = [];
          if (isDatabaseAvailable()) {
            userRecord = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
          } else {
            const jsonUser = jsonStorage.users.getAll().find((u: any) => u.id === decoded.userId);
            if (jsonUser) userRecord = [jsonUser];
          }
          if (userRecord.length > 0) {
            socket.data = socket.data || {};
            socket.data.userId = decoded.userId;
            socket.data.username = userRecord[0].username;
            console.log(`Socket ${socket.id} securely associated with user ${decoded.userId} (${userRecord[0].username})`);
            
            const playerName = userRecord[0].username;
            const activeGame = gameManager.getActiveGameByPlayerName(playerName);
            if (activeGame) {
              const game = gameManager.getGameState(activeGame.gameId);
              if (game && game.players[playerName]) {
                const player = game.players[playerName];
                const oldSocketId = player.socketId;
                
                if (!oldSocketId || oldSocketId !== socket.id) {
                  console.log(`🔄 Auto-rejoining ${playerName} to game ${activeGame.gameId} on set-user-data (old socket: ${oldSocketId}, new: ${socket.id})`);
                  socket.join(activeGame.gameId);
                  player.socketId = socket.id;
                  player.disconnectedAt = undefined;
                  
                  gameManager.setPlayerToGame(socket.id, activeGame.gameId);
                  if (oldSocketId) {
                    gameManager.cleanupOldSocketMapping(oldSocketId);
                  }
                  
                  const gameState = gameManager.getSanitizedGameState(activeGame.gameId);
                  socket.emit('game-state-update', gameState);
                  
                  if (player.hand && player.hand.length > 0) {
                    console.log(`🔄 Restoring ${player.hand.length} cards to ${playerName}'s hand after auto-rejoin`);
                    socket.emit('restore-hand', { playerName, hand: player.hand });
                  }
                  
                  socket.to(activeGame.gameId).emit('player-reconnected', { playerName });
                }
              }
            }
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
          let userRecord: any[] = [];
          if (isDatabaseAvailable()) {
            userRecord = await db.select().from(users).where(eq(users.email, decoded.email)).limit(1);
          } else {
            const jsonUser = jsonStorage.users.getAll().find((u: any) => u.email === decoded.email);
            if (jsonUser) userRecord = [jsonUser];
          }
          if (userRecord.length > 0) {
            (socket as any).data = { userId: userRecord[0].id };
            console.log(`Socket ${socket.id} registered for user ${userRecord[0].id} (${userRecord[0].username})`);
          }
        } catch (error) {
          console.log(`Socket ${socket.id} failed to register - invalid token`);
        }
      }
    });

    socket.on('join-game', async ({ gameId, playerName, avatarId, userId, authToken, isDraftMode }) => {
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
            let userRecord: any[] = [];
            if (isDatabaseAvailable()) {
              userRecord = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
            } else {
              const jsonUser = jsonStorage.users.getAll().find((u: any) => u.id === decoded.userId);
              if (jsonUser) userRecord = [jsonUser];
            }
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
        const originalUserId = existingGame.playerUserIds?.get(playerName);

        if (!originalUserId && !validatedUserId) {
          // Guest slot (no userId binding) + guest trying to reconnect → allow by name
          console.log(`✅ GUEST REJOIN: ${playerName} reconnecting to guest slot in ${gameId}`);
        } else if (!validatedUserId) {
          // Authenticated player's slot, but no auth provided → block
          console.log(`🚫 SECURITY: Unauthenticated reconnection attempt to ${gameId} as ${playerName}`);
          socket.emit('join-game-error', { message: 'Authentication required to rejoin existing game' });
          return;
        } else {
          // Authenticated user → verify identity matches the original player
          const usernameMatches = validatedUsername && validatedUsername === playerName;
          const userIdMatches = originalUserId && originalUserId === validatedUserId;

          if (!usernameMatches && !userIdMatches) {
            console.log(`🚫 SECURITY: User ${validatedUsername} (ID: ${validatedUserId}) attempted to rejoin as ${playerName} (original ID: ${originalUserId})`);
            socket.emit('join-game-error', { message: 'You cannot rejoin as another player' });
            return;
          }
        }
      }
      
      // Wait for player to be added with identity verification
      const result = await gameManager.addPlayer(gameId, playerName, socket.id, false, validatedUserId, false, !!isDraftMode);
      
      if (!result.success) {
        console.log(`Join failed for ${playerName}: ${result.error}`);
        
        // If approval is required, tell the client to request approval
        if (result.requiresApproval) {
          socket.emit('join-requires-approval', { 
            gameId, 
            message: 'Questa partita è già iniziata. Devi richiedere l\'approvazione del creatore per entrare.' 
          });
          return;
        }
        
        socket.emit('join-game-error', { message: result.error });
        return;
      }
      
      socket.join(gameId);
      
      if (isRedisConfigured()) {
        setPlayerOnline(playerName).catch(() => {});
      }
      
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
              
              let userRecord: any[] = [];
              if (isDatabaseAvailable()) {
                userRecord = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
              } else {
                const jsonUser = jsonStorage.users.getAll().find((u: any) => u.id === decoded.userId);
                if (jsonUser) userRecord = [jsonUser];
              }
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
          game.spectators = game.spectators.filter((s: string) => s !== spectatorName);
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

    // Request to join an active room (requires creator approval)
    socket.on('request-join-room', ({ gameId, playerName, userId, avatarId }) => {
      try {
        console.log(`${playerName} requesting to join game ${gameId}`);
        
        const game = gameManager.getGame(gameId);
        if (!game) {
          socket.emit('join-request-denied', { gameId, message: 'Partita non trovata' });
          return;
        }
        
        // Find the creator's socket - fallback to first player in turnOrder if creatorName not set
        const creatorName = game.creatorName || game.turnOrder[0];
        if (!creatorName) {
          socket.emit('join-request-denied', { gameId, message: 'Creatore non trovato' });
          return;
        }
        
        const creatorPlayer = game.players[creatorName];
        
        if (!creatorPlayer || !creatorPlayer.socketId) {
          socket.emit('join-request-denied', { gameId, message: 'Il creatore non è online' });
          return;
        }
        
        // Store the requester's socket info for later
        socket.data.pendingJoinRequest = { gameId, playerName, userId, avatarId };
        
        // Send join request to the creator
        console.log(`Sending join request to creator ${creatorName} at socket ${creatorPlayer.socketId}`);
        io.to(creatorPlayer.socketId).emit('join-request-received', {
          gameId,
          requesterName: playerName,
          requesterSocketId: socket.id,
          requesterUserId: userId,
          requesterAvatarId: avatarId
        });
        
        console.log(`Join request sent to creator ${creatorName} for game ${gameId}`);
      } catch (error) {
        console.error('Error processing join request:', error);
        socket.emit('join-request-denied', { gameId, message: 'Errore durante la richiesta' });
      }
    });

    // Creator approves a join request
    socket.on('approve-join-request', async ({ gameId, requesterSocketId, requesterName, requesterUserId, requesterAvatarId }) => {
      try {
        console.log(`Join request approval attempt for ${requesterName} in game ${gameId} by socket ${socket.id}`);
        
        // SECURITY: Verify the approver is the game creator
        const game = gameManager.getGame(gameId);
        if (!game) {
          console.log(`🚫 SECURITY: Game ${gameId} not found for approval`);
          return;
        }
        
        const creatorName = game.creatorName || game.turnOrder[0];
        const creatorPlayer = game.players[creatorName];
        
        if (!creatorPlayer || creatorPlayer.socketId !== socket.id) {
          console.log(`🚫 SECURITY: Socket ${socket.id} attempted to approve join request but is not the creator (creator socket: ${creatorPlayer?.socketId})`);
          socket.emit('error', { message: 'Solo il creatore della stanza può approvare le richieste' });
          return;
        }
        
        // Verify the requester has a pending join request
        const requesterSocket = io.sockets.sockets.get(requesterSocketId);
        if (!requesterSocket) {
          console.log(`Requester socket ${requesterSocketId} not found - they may have disconnected`);
          return;
        }
        
        const pendingRequest = requesterSocket.data?.pendingJoinRequest;
        if (!pendingRequest || pendingRequest.gameId !== gameId || pendingRequest.playerName !== requesterName) {
          console.log(`🚫 SECURITY: No valid pending request found for ${requesterName} in game ${gameId}`);
          socket.emit('error', { message: 'Richiesta non valida o scaduta' });
          return;
        }
        
        console.log(`Join request approved for ${requesterName} in game ${gameId}`);
        
        // Clear the pending request
        requesterSocket.data.pendingJoinRequest = undefined;
        
        // Add the player to the game with isApproved=true
        const result = await gameManager.addPlayer(gameId, requesterName, requesterSocketId, false, requesterUserId, true);
        
        if (!result.success) {
          console.log(`Failed to add approved player ${requesterName}: ${result.error}`);
          requesterSocket.emit('join-request-denied', { 
            gameId, 
            message: result.error || 'Impossibile unirsi alla partita' 
          });
          return;
        }
        
        // Join the socket room
        requesterSocket.join(gameId);
        
        // Set avatar if provided
        if (requesterAvatarId) {
          gameManager.setPlayerAvatar(gameId, requesterName, requesterAvatarId);
        }
        
        // Set user ID for stats tracking
        if (requesterUserId) {
          gameManager.setPlayerUserId(gameId, requesterName, requesterUserId);
        }
        
        // Notify the requester they've been approved
        requesterSocket.emit('join-request-approved', { 
          gameId,
          message: 'La tua richiesta è stata approvata!' 
        });
        
        // Send game state to the new player
        const gameState = gameManager.getSanitizedGameState(gameId);
        requesterSocket.emit('game-state-update', gameState);
        
        // Notify other players
        io.to(gameId).emit('player-joined', { playerName: requesterName });
        
        console.log(`Player ${requesterName} successfully joined game ${gameId} after approval`);
      } catch (error) {
        console.error('Error approving join request:', error);
      }
    });

    // Creator denies a join request
    socket.on('deny-join-request', ({ gameId, requesterSocketId, requesterName }) => {
      try {
        console.log(`Join request denial attempt for ${requesterName} in game ${gameId} by socket ${socket.id}`);
        
        // SECURITY: Verify the denier is the game creator
        const game = gameManager.getGame(gameId);
        if (!game) {
          console.log(`🚫 SECURITY: Game ${gameId} not found for denial`);
          return;
        }
        
        const creatorName = game.creatorName || game.turnOrder[0];
        const creatorPlayer = game.players[creatorName];
        
        if (!creatorPlayer || creatorPlayer.socketId !== socket.id) {
          console.log(`🚫 SECURITY: Socket ${socket.id} attempted to deny join request but is not the creator`);
          socket.emit('error', { message: 'Solo il creatore della stanza può rifiutare le richieste' });
          return;
        }
        
        console.log(`Join request denied for ${requesterName} in game ${gameId}`);
        
        // Find the requester's socket and notify them
        const requesterSocket = io.sockets.sockets.get(requesterSocketId);
        if (requesterSocket) {
          requesterSocket.emit('join-request-denied', { 
            gameId,
            message: 'La tua richiesta è stata rifiutata.' 
          });
          requesterSocket.data.pendingJoinRequest = undefined;
        }
      } catch (error) {
        console.error('Error denying join request:', error);
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
                    damageValue: currentAction.data.damageValue || 0,
                    timestamp: Date.now()
                  });
                  
                  // CHARACTER ATTACK AUDIO for CPU
                  try {
                    const cpuAttackState = gameManager.getGameState(gameId);
                    if (cpuAttackState) {
                      const cpuAttacker = cpuAttackState.field.find((c: any) => 
                        (c.type === 'personaggi' || c.type === 'personaggi_speciali') && c.owner === currentAction.data.attackerName
                      );
                      if (cpuAttacker && (cpuAttacker.attackLowAudioUrl || cpuAttacker.attackHighAudioUrl)) {
                        const cpuMosse = cpuAttackState.field.find((c: any) => c.id === currentAction.data.mosseCardId) ||
                          cpuAttackState.decks?.mosse?.find((c: any) => c.id === currentAction.data.mosseCardId);
                        const cpuBaseDmg = cpuMosse?.mosseDamageValue ?? (currentAction.data.damageValue || 0);
                        const cpuAudioUrl = cpuBaseDmg >= 150 ? cpuAttacker.attackHighAudioUrl : cpuAttacker.attackLowAudioUrl;
                        if (cpuAudioUrl) {
                          io.to(gameId).emit('character-attack-audio', {
                            cardId: cpuAttacker.id, playerName: currentAction.data.attackerName,
                            audioUrl: cpuAudioUrl, cardName: cpuAttacker.name || 'CPU Character', baseDamage: cpuBaseDmg
                          });
                        }
                      }
                    }
                  } catch (err) { console.error('Error emitting CPU attack audio:', err); }
                  
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
                  
                case 'start-duel':
                  console.log(`⚔️ CPU ${cpuName} starting a DUELLO`);
                  const duelPlayResult = await gameManager.playCard(gameId, currentAction.data.duelCardId, currentAction.data.initiatorPlayer);
                  if (duelPlayResult.card) {
                    await emitCardPlayed(io, gameId, duelPlayResult.card, currentAction.data.initiatorPlayer);
                  }
                  emitThrottledGameState(io, gameId, gameManager.getSanitizedGameState(gameId));
                  const duelStartResult = await gameManager.startDuel(gameId, currentAction.data.duelCardId, currentAction.data.initiatorPlayer, currentAction.data.opponentCharacterId);
                  if (duelStartResult.success) {
                    const duelStartState = gameManager.getDuelState(gameId);
                    io.to(gameId).emit('chat-message', {
                      id: `${Date.now()}-duel-start`,
                      playerName: 'Sistema',
                      message: duelStartResult.message,
                      timestamp: Date.now()
                    });
                    io.to(gameId).emit('duel:started', {
                      duelState: duelStartState,
                      message: duelStartResult.message
                    });
                    emitThrottledGameState(io, gameId, gameManager.getSanitizedGameState(gameId));
                    executeCpuDuelAttackSequence(io, gameId, gameManager, cpuName, currentAction.data.duelCardId, currentAction.data.initiatorPlayer, currentAction.data.opponentCharacterId);
                  } else {
                    console.log(`⚔️ DUELLO: CPU ${cpuName} failed to start duel: ${duelStartResult.message}`);
                  }
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
                    damageValue: currentAction.data.damageValue || 0,
                    timestamp: Date.now()
                  });
                  
                  // CHARACTER ATTACK AUDIO for CPU
                  try {
                    const cpuAttState2 = gameManager.getGameState(gameId);
                    if (cpuAttState2) {
                      const cpuAtt2 = cpuAttState2.field.find((c: any) => 
                        (c.type === 'personaggi' || c.type === 'personaggi_speciali') && c.owner === currentAction.data.attackerName
                      );
                      if (cpuAtt2 && (cpuAtt2.attackLowAudioUrl || cpuAtt2.attackHighAudioUrl)) {
                        const cpuM2 = cpuAttState2.field.find((c: any) => c.id === currentAction.data.mosseCardId) ||
                          cpuAttState2.decks?.mosse?.find((c: any) => c.id === currentAction.data.mosseCardId);
                        const cpuBd2 = cpuM2?.mosseDamageValue ?? (currentAction.data.damageValue || 0);
                        const cpuAu2 = cpuBd2 >= 150 ? cpuAtt2.attackHighAudioUrl : cpuAtt2.attackLowAudioUrl;
                        if (cpuAu2) {
                          io.to(gameId).emit('character-attack-audio', {
                            cardId: cpuAtt2.id, playerName: currentAction.data.attackerName,
                            audioUrl: cpuAu2, cardName: cpuAtt2.name || 'CPU Character', baseDamage: cpuBd2
                          });
                        }
                      }
                    }
                  } catch (err) { console.error('Error emitting CPU attack audio:', err); }
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
        if (gameState) {
          if (gameState.isDraftMode) {
            const playerName = gameManager.getPlayerNameFromSocket(socket.id);
            const personalDeck = playerName && (gameState as any).playerDraftDecks?.[playerName]?.[deckType];
            if (personalDeck && personalDeck.length > 0) {
              socket.emit('deck-contents', { deckType, cards: personalDeck });
              return;
            }
            if (!personalDeck || personalDeck.length === 0) {
              socket.emit('deck-contents', { deckType, cards: [] });
              return;
            }
          }
          if (gameState.decks[deckType]) {
            socket.emit('deck-contents', { deckType, cards: gameState.decks[deckType] });
          }
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
              // Look up in customCards JSON storage by matching the card name
              const customCards = jsonStorage.customCards.getAll();
              const customCardMatch = customCards.find(c => c.name === (result.card.name || ''));
              if (customCardMatch && customCardMatch.audioUrl) {
                audioUrl = customCardMatch.audioUrl;
                console.log(`Found audioUrl from customCards JSON for card ${cardId}: ${audioUrl}`);
              }
            } else {
              // Look up in card modifications JSON storage for base cards
              const mod = jsonStorage.cardModifications.getByOriginalCardId(cardIdStr);
              if (mod && !mod.isDeleted && mod.audioUrl) {
                audioUrl = mod.audioUrl;
                console.log(`Found audioUrl from cardModifications JSON for card ${cardId}: ${audioUrl}`);
              }
            }
          } catch (jsonError) {
            console.error('Error checking JSON storage for audioUrl:', jsonError);
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
            
            // Check if it's a custom card (permanent custom cards from JSON storage)
            if (cardIdStr.startsWith('custom-')) {
              const customCards = jsonStorage.customCards.getAll();
              const customCardMatch = customCards.find(c => c.name === (result.card.name || ''));
              if (customCardMatch && customCardMatch.youtubeUrl) {
                youtubeUrl = customCardMatch.youtubeUrl;
                console.log(`Found youtubeUrl from customCards JSON for card ${cardId}: ${youtubeUrl}`);
              }
            } else {
              // Look up in card modifications JSON storage for base cards
              const mod = jsonStorage.cardModifications.getByOriginalCardId(cardIdStr);
              if (mod && !mod.isDeleted && mod.youtubeUrl) {
                youtubeUrl = mod.youtubeUrl;
                console.log(`Found youtubeUrl from cardModifications JSON for card ${cardId}: ${youtubeUrl}`);
              }
            }
          } catch (jsonError) {
            console.error('Error checking JSON storage for youtubeUrl:', jsonError);
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
        
        // DUELLO: Auto-activate MOSSE attack during duel (fully automatic for all players)
        if (result.duelAutoAttack && result.card) {
          const duelState = gameManager.getDuelState(gameId);
          if (duelState && duelState.active) {
            console.log(`⚔️ DUELLO: Auto-activating MOSSE attack for ${playerName}`);
            
            const opponentCharacterId = playerName === duelState.player1 ? duelState.character2Id : duelState.character1Id;
            const mosseCard = result.card as any;
            const targetCard = gameManager.getGameState(gameId)?.field.find((c: any) => c.id === opponentCharacterId);
            
            if (targetCard) {
              const attackerChar = gameManager.getGameState(gameId)?.field.find((c: any) =>
                c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
              );
              const attackerStars = attackerChar?.stars ?? 1;
              const baseDamage = mosseCard.mosseDamageValue || 100;
              const totalDamage = baseDamage * attackerStars;
              
              console.log(`⚔️ DUELLO: ${playerName} auto-attacking with damage ${baseDamage} x ${attackerStars} stelle = ${totalDamage}`);
              
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-duel-attack`,
                playerName,
                message: `⚔️ DUELLO: Attacco con ${totalDamage} danni!`,
                timestamp: Date.now()
              });
              
              setTimeout(async () => {
                try {
                  const attackResult = await gameManager.executeMossaAttack(
                    gameId, playerName, mosseCard.id, opponentCharacterId,
                    totalDamage, false, undefined, 0, mosseCard.mosseDamageEffect || null
                  );
                  
                  if (attackResult.success) {
                    io.to(gameId).emit('card-attacked', {
                      mosseCardId: mosseCard.id,
                      targetCardId: opponentCharacterId,
                      attackerName: playerName,
                      targetOwner: targetCard.owner,
                      damageValue: totalDamage,
                      timestamp: Date.now()
                    });
                    
                    if (attackResult.result?.requiresDefenseResponse) {
                      const pendingDefense = gameManager.getPendingDefense(gameId);
                      if (pendingDefense) {
                        pendingDefense.damage = totalDamage;
                        pendingDefense.mosseCardId = mosseCard.id;
                        (pendingDefense as any).starsToRemove = 0;
                      }
                      await gameManager.emitDefenseRequest(gameId, io);
                    } else {
                      gameManager.returnToDeck(gameId, mosseCard.id, playerName);
                    }
                  } else {
                    gameManager.returnToDeck(gameId, mosseCard.id, playerName);
                    console.log(`⚔️ DUELLO: Attack failed: ${attackResult.error}`);
                  }
                  
                  const updatedState = gameManager.getSanitizedGameState(gameId);
                  emitImmediateGameState(io, gameId, updatedState);
                } catch (err) {
                  console.error(`⚔️ DUELLO: Error executing auto-attack:`, err);
                }
              }, 800);
            }
            
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

    // Handle PTI distribution panel confirmation (Giovanni Muciaccia effect)
    socket.on('pti-distribution-confirm', ({ cardId, ptiValue, starsValue, playerName }: { cardId: string, ptiValue: number, starsValue: number, playerName: string }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`🎭 ${playerName} confirmed PTI distribution: ${ptiValue} PTI, ${starsValue} stelle for card ${cardId}`);
        const game = gameManager.getGame(gameId);
        if (game) {
          const fieldCard = game.field.find((c: any) => c.id === cardId);
          if (fieldCard) {
            const safePti = Math.max(0, Math.floor(ptiValue || 0));
            const safeStars = Math.max(0, Math.floor(starsValue || 0));
            const totalUsed = safePti + (safeStars * 100);
            if (totalUsed !== 1000) {
              socket.emit('chat-message', {
                id: `${Date.now()}-distribute-error`,
                playerName: 'Sistema',
                message: `❌ Il budget deve essere esattamente 1000! Hai usato ${totalUsed}/1000. Riprova.`,
                timestamp: Date.now()
              });
              return;
            }
            fieldCard.pti = safePti;
            fieldCard.stars = safeStars;
            (fieldCard as any).ptiDistributed = true;
            (fieldCard as any).originalPti = safePti;
            fieldCard.text = `PTI: ${safePti} | Stelle: ${safeStars} | PTI originali: ${safePti}`;
            
            const gameState = gameManager.getSanitizedGameState(gameId);
            emitImmediateGameState(io, gameId, gameState);
            
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-pti-distributed`,
              playerName: 'Sistema',
              message: `🎭 ${playerName} assegna a ${fieldCard.name || 'Giovanni Muciaccia'}: ${ptiValue} PTI e ${starsValue} stelle!`,
              timestamp: Date.now()
            });
          }
        }
      }
    });

    // Handle deck selection panel confirmation
    socket.on('deck-selection-confirm', ({ cardId, deckType, playerName }: { cardId: string, deckType: string, playerName: string }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`🎴 ${playerName} selected deck: ${deckType} for card ${cardId}`);
        const deckContents = gameManager.getDeckContentsForSelection(gameId, deckType, playerName);
        if (deckContents.success && deckContents.cards && deckContents.cards.length > 0) {
          gameManager.setPendingDeckPick(gameId, playerName, cardId, deckType);
          socket.emit('show-deck-card-picker', {
            cardId,
            deckType,
            deckDisplayName: deckContents.deckDisplayName,
            cards: deckContents.cards,
            playerName
          });
        } else {
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-deck-empty`,
            playerName: 'Sistema',
            message: deckContents.message || `🎴 Il mazzo è vuoto!`,
            timestamp: Date.now()
          });
        }
      }
    });

    socket.on('deck-card-pick-confirm', ({ selectedCardId, deckType, cardId, playerName }: { selectedCardId: string, deckType: string, cardId: string, playerName: string }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const pending = gameManager.getPendingDeckPick(gameId, playerName);
        if (!pending || pending.deckType !== deckType) {
          console.log(`🚫 ${playerName} tried deck-card-pick without valid pending selection`);
          return;
        }
        console.log(`🎴 ${playerName} picked specific card ${selectedCardId} from ${deckType}`);
        const result = gameManager.processSpecificCardSelection(gameId, selectedCardId, deckType, playerName);
        gameManager.clearPendingDeckPick(gameId, playerName);
        if (result.success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitImmediateGameState(io, gameId, gameState);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-deck-pick`,
            playerName: 'Sistema',
            message: result.message || `🎴 ${playerName} ha scelto una carta dal mazzo ${deckType}!`,
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

    // ============ AUCTION SYSTEM SOCKET HANDLERS ============

    socket.on('auction-select-card', async ({ cardId, playerName }: { cardId: string, playerName: string }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) return;

      const game = gameManager.getGameState(gameId);
      if (!game) return;

      const deckIndex = game.decks.personaggi.findIndex((c: any) => c.id === cardId);
      if (deckIndex === -1) return;

      const card = game.decks.personaggi.splice(deckIndex, 1)[0];
      
      const success = gameManager.startAuction(gameId, card, playerName, io);
      if (!success) {
        game.decks.personaggi.push(card);
        return;
      }

      const auction = gameManager.getActiveAuction(gameId);
      if (!auction) return;

      const playerRankiards: Record<string, number> = {};
      for (const [pName, participant] of Object.entries(auction.participants)) {
        if ((participant as any).isCPU) {
          playerRankiards[pName] = 30;
        } else {
          const userId = game.playerUserIds?.get(pName);
          if (userId) {
            try {
              const result = await db.select({ puntiRankiard: users.puntiRankiard }).from(users).where(eq(users.id, userId));
              if (result[0]) {
                const sessionSpent = gameManager.getPRSpentThisGame(gameId, pName);
                const available = Math.max(0, result[0].puntiRankiard - sessionSpent);
                playerRankiards[pName] = available;
                auction.participants[pName].maxPoints = available;
                auction.participants[pName].remainingPoints = available;
              }
            } catch (e) {
              playerRankiards[pName] = 0;
            }
          }
        }
      }

      io.to(gameId).emit('auction-started', {
        auctionId: auction.auctionId,
        cardName: card.name || getCardNameFromImageUrl(card.frontImage),
        cardImage: card.frontImage,
        cardPti: auction.cardPti,
        cardStars: auction.cardStars,
        initiator: playerName,
        playerRankiards,
        currentBid: 0,
        currentBidder: null,
        countdown: 3
      });

      setTimeout(() => {
        const currentAuction = gameManager.getActiveAuction(gameId);
        if (currentAuction && !currentAuction.ended) {
          triggerCPUAuctionBids(gameId, io);
        }
      }, 2000);
    });

    socket.on('auction-place-bid', ({ bidAmount, playerName }: { bidAmount: number, playerName: string }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) return;

      const result = gameManager.placeBid(gameId, playerName, bidAmount, io);
      if (result.success) {
        const auction = gameManager.getActiveAuction(gameId);
        if (auction) {
          io.to(gameId).emit('auction-bid-update', {
            bidder: playerName,
            amount: bidAmount,
            countdown: 3
          });
        }
      } else {
        socket.emit('auction-bid-error', { message: result.message });
      }
    });

    function triggerCPUAuctionBids(gameId: string, io: any) {
      const auction = gameManager.getActiveAuction(gameId);
      if (!auction || auction.ended) return;

      const game = gameManager.getGameState(gameId);
      if (!game) return;

      const cpuParticipants = Object.entries(auction.participants)
        .filter(([_, p]) => (p as any).isCPU && (p as any).remainingPoints > 0);

      for (const [cpuName, cpuData] of cpuParticipants) {
        const cpuFieldChars = game.field.filter((c: any) => c.owner === cpuName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'));
        const cpuMaxPti = cpuFieldChars.reduce((max: number, c: any) => Math.max(max, c.pti || 0), 0);

        const isDesirable = auction.cardPti > cpuMaxPti;
        const maxBid = (cpuData as any).remainingPoints;
        const currentBid = auction.currentBid;

        if (currentBid >= maxBid) continue;

        const bidIncrement = isDesirable ? Math.ceil(Math.random() * 5) + 2 : Math.ceil(Math.random() * 3) + 1;
        const newBid = Math.min(currentBid + bidIncrement, maxBid);

        const delay = isDesirable ? 1500 + Math.random() * 1500 : 2000 + Math.random() * 2500;

        setTimeout(() => {
          const currentAuction = gameManager.getActiveAuction(gameId);
          if (!currentAuction || currentAuction.ended) return;
          if (currentAuction.currentBidder === cpuName) return;

          const actualBid = Math.min(Math.max(currentAuction.currentBid + bidIncrement, newBid), maxBid);
          if (actualBid <= currentAuction.currentBid) return;

          const bidResult = gameManager.placeBid(gameId, cpuName, actualBid, io);
          if (bidResult.success) {
            io.to(gameId).emit('auction-bid-update', {
              bidder: cpuName,
              amount: actualBid,
              countdown: 3
            });
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-cpu-bid`,
              playerName: cpuName,
              message: `Offro ${actualBid} punti Rankiard!`,
              timestamp: Date.now()
            });

            if (isDesirable && (cpuData as any).remainingPoints > actualBid) {
              setTimeout(() => triggerCPUAuctionBids(gameId, io), 3500 + Math.random() * 2000);
            }
          }
        }, delay);
      }
    }

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
            gameManager.processEliminationAfterDeath(gameId, playerName, io, 'manual-graveyard');
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

                if (result.eliminationCheck) {
                  gameManager.processEliminationAfterDeath(gameId, card.owner, io, 'update-card-text');
                }
              }
            }, 100); // Small delay to let UI update first
          }
        }
        
        emitThrottledGameState(io, gameId, gameState);
      }
    });

    // Apply skin to card
    socket.on('apply-card-skin', async ({ cardId, skinImageUrl, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        let skinPti: number | null = null;
        let skinStars: number | null = null;
        
        // If applying a skin, look up its PTI and Stars from JSON storage
        if (skinImageUrl) {
          try {
            const allSkins = jsonStorage.cardSkins.getAll();
            const skinData = allSkins.find(s => s.skinImageUrl === skinImageUrl);
            
            if (skinData) {
              skinPti = skinData.skinPti;
              skinStars = skinData.skinStars;
            }
          } catch (error) {
            console.error('Error fetching skin data:', error);
          }
        }
        
        const success = gameManager.applyCardSkin(gameId, cardId, skinImageUrl, playerName, skinPti, skinStars);
        if (success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitThrottledGameState(io, gameId, gameState);
        }
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
    socket.on('cpu-damage-submit', async ({ cpuName, mosseCardId, targetCardId, targetOwner, damageValue, starsToRemove, mosseEffect }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) {
        console.log(`cpu-damage-submit: gameId not found for socket ${socket.id}`);
        return;
      }
      
      console.log(`🎯 Received damage ${damageValue} from game creator for CPU ${cpuName} attacking ${targetCardId}, effect: ${mosseEffect || 'none'}`);
      
      // Execute the attack with the provided damage and effect
      const attackResult = await gameManager.executeMossaAttack(
        gameId,
        cpuName,
        mosseCardId,
        targetCardId,
        damageValue,
        starsToRemove || 0,
        mosseEffect || null
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

      // CHARACTER ATTACK AUDIO for CPU
      try {
        const cpuAttState3 = gameManager.getGameState(gameId);
        if (cpuAttState3) {
          const cpuAtt3 = cpuAttState3.field.find((c: any) => 
            (c.type === 'personaggi' || c.type === 'personaggi_speciali') && c.owner === cpuName
          );
          if (cpuAtt3 && (cpuAtt3.attackLowAudioUrl || cpuAtt3.attackHighAudioUrl)) {
            const cpuM3 = cpuAttState3.field.find((c: any) => c.id === mosseCardId) ||
              cpuAttState3.decks?.mosse?.find((c: any) => c.id === mosseCardId);
            const cpuBd3 = cpuM3?.mosseDamageValue ?? damageValue;
            const cpuAu3 = cpuBd3 >= 150 ? cpuAtt3.attackHighAudioUrl : cpuAtt3.attackLowAudioUrl;
            if (cpuAu3) {
              io.to(gameId).emit('character-attack-audio', {
                cardId: cpuAtt3.id, playerName: cpuName,
                audioUrl: cpuAu3, cardName: cpuAtt3.name || 'CPU Character', baseDamage: cpuBd3
              });
            }
          }
        }
      } catch (err) { console.error('Error emitting CPU attack audio:', err); }

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
                      
                    case 'start-duel':
                      console.log(`⚔️ CPU ${currentPlayer} starting a DUELLO (chat-response path)`);
                      const duelPlayRes = await gameManager.playCard(gameId, cpuAction.data.duelCardId, cpuAction.data.initiatorPlayer);
                      if (duelPlayRes.card) {
                        await emitCardPlayed(io, gameId, duelPlayRes.card, cpuAction.data.initiatorPlayer);
                      }
                      emitThrottledGameState(io, gameId, gameManager.getSanitizedGameState(gameId));
                      const duelRes = await gameManager.startDuel(gameId, cpuAction.data.duelCardId, cpuAction.data.initiatorPlayer, cpuAction.data.opponentCharacterId);
                      if (duelRes.success) {
                        const dState = gameManager.getDuelState(gameId);
                        io.to(gameId).emit('chat-message', {
                          id: `${Date.now()}-duel-start`,
                          playerName: 'Sistema',
                          message: duelRes.message,
                          timestamp: Date.now()
                        });
                        io.to(gameId).emit('duel:started', {
                          duelState: dState,
                          message: duelRes.message
                        });
                        emitThrottledGameState(io, gameId, gameManager.getSanitizedGameState(gameId));
                        executeCpuDuelAttackSequence(io, gameId, gameManager, currentPlayer, cpuAction.data.duelCardId, cpuAction.data.initiatorPlayer, cpuAction.data.opponentCharacterId);
                        return;
                      } else {
                        console.log(`⚔️ DUELLO: CPU ${currentPlayer} failed to start duel: ${duelRes.message}`);
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

    socket.on('send-emoji-reaction', ({ gameId, emoji, playerName, id, soundEffect }) => {
      if (gameId) {
        const now = Date.now();
        const lastEmoji = socket.data.lastEmojiTime || 0;
        const minInterval = soundEffect ? 2000 : 1000;
        if (now - lastEmoji < minInterval) {
          return;
        }
        socket.data.lastEmojiTime = now;
        
        io.to(gameId).emit('emoji-reaction', {
          emoji,
          playerName,
          id,
          ...(soundEffect ? { soundEffect } : {})
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
        const result = await gameManager.placeSuperDiceCard(gameId, playerName, cardData);
        
        if (result.success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          emitImmediateGameState(io, gameId, gameState);

          const realCardName = result.cardId 
            ? (gameState?.field?.find((c: any) => c.id === result.cardId)?.name || cardData.name)
            : cardData.name;
          const realCardImage = result.cardId
            ? (gameState?.field?.find((c: any) => c.id === result.cardId)?.frontImage || cardData.image)
            : cardData.image;
          
          io.to(gameId).emit('super-dice-card-placed', {
            playerName,
            cardName: realCardName,
            cardImage: realCardImage,
            timestamp: Date.now()
          });

          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-super-dice-placed`,
            playerName: 'Sistema',
            message: `🎲 SUPER DADO: ${playerName} ha pescato ${realCardName} dal mazzo e l'ha piazzata in campo!`,
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
            gameManager.processEliminationAfterDeath(gameId, playerName, io, 'game-instruction');
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

    socket.on('mosse-attack', async ({ mosseCardId, targetCardId, attackerName, targetOwner, damageValue, starsToRemove, isHandTarget, isFurtoAttack, mosseEffect }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`🗡️  DEFENSE-ENABLED MOSSE ATTACK: ${attackerName} → ${targetOwner} (damage: ${damageValue}, effect: ${mosseEffect || 'none'})`);
        
        // Get the card to check its frontImage for CPU restrictions
        const gameState = gameManager.getSanitizedGameState(gameId);
        const mosseCard = gameState?.field?.find((c: any) => c.id === mosseCardId);
        
        if (!mosseCard) {
          // Multi-target attacks: MOSSE card may have been moved to graveyard after first target
          const fullGameForGraveyard = gameManager.getGameState(gameId);
          const graveyardCard = fullGameForGraveyard?.graveyard?.find((c: any) => c.id === mosseCardId);
          if (graveyardCard) {
            console.log(`🗡️ MOSSE card ${mosseCardId} found in graveyard (multi-target continuation) - proceeding with attack`);
            
            // Check if this MOSSE has a timed effect - if so, add this target to the deferred actions
            const fullGameForTimed = gameManager.getGameState(gameId);
            if (fullGameForTimed?.timedEffects) {
              const timedForThisCard = fullGameForTimed.timedEffects.find(
                (te: any) => te.sourceCardId === mosseCardId && te.sourcePlayer === attackerName
              );
              if (timedForThisCard) {
                console.log(`⏳ MOSSE DELAYED (multi-target continuation): Adding ${targetOwner}'s ${targetCardId} to deferred damage`);
                timedForThisCard.actions.push({
                  type: 'damage',
                  target: targetOwner === attackerName ? 'self' : 'opponents',
                  value: damageValue,
                  description: `Danno ritardato: ${damageValue} PTI`,
                  targetCardId: targetCardId
                });
                if (starsToRemove && starsToRemove > 0) {
                  timedForThisCard.actions.push({
                    type: 'remove_stars',
                    target: targetOwner === attackerName ? 'self' : 'opponents',
                    value: starsToRemove,
                    description: `Rimuovi ${starsToRemove} stelle`,
                    targetCardId: targetCardId
                  });
                }
                const updatedState = gameManager.getSanitizedGameState(gameId);
                io.to(gameId).emit('game-state-update', updatedState);
                return;
              }
            }
            
            // No timed effect - proceed directly to attack execution without card-on-field checks
            const attackResult = await gameManager.executeMossaAttack(
              gameId, attackerName, mosseCardId, targetCardId,
              damageValue, isHandTarget || false, undefined,
              starsToRemove || 0, mosseEffect || null, isFurtoAttack || false
            );
            if (attackResult.success) {
              io.to(gameId).emit('card-attacked', {
                mosseCardId, targetCardId, attackerName, targetOwner,
                damageValue, timestamp: Date.now()
              });
              const updatedState = gameManager.getSanitizedGameState(gameId);
              io.to(gameId).emit('game-state-update', updatedState);
            } else {
              console.log(`Multi-target attack failed: ${attackResult.error}`);
            }
            return;
          }
          console.log(`MOSSE card ${mosseCardId} not found on field or graveyard`);
          return;
        }

        // Validate damage input - allow 0 damage if there's a special effect
        if ((!damageValue || damageValue <= 0) && !mosseEffect) {
          console.log(`Invalid damage value: ${damageValue} and no effect. Attack cancelled.`);
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

        // CHECK: If the MOSSE card has a timed effect registered, defer damage instead of attacking now
        const fullGame = gameManager.getGameState(gameId);
        if (fullGame) {
          if (!fullGame.timedEffects) fullGame.timedEffects = [];
          const timedForThisCard = fullGame.timedEffects.find(
            (te: any) => te.sourceCardId === mosseCardId && te.sourcePlayer === attackerName
          );
          if (timedForThisCard) {
            // Idempotency: check if damage was already deferred for this card
            if ((timedForThisCard as any).damageDeferred) {
              console.log(`⏳ MOSSE DELAYED: ${mosseCardId} damage already deferred - skipping duplicate`);
              return;
            }
            (timedForThisCard as any).damageDeferred = true;
            
            console.log(`⏳ MOSSE DELAYED: ${attackerName}'s ${mosseCardId} has a timed effect - deferring ${damageValue} damage for ${timedForThisCard.turnsRemaining} turns`);
            
            // Replace placeholder actions with real damage targeting the specific card
            timedForThisCard.actions = timedForThisCard.actions.filter(
              (a: any) => a.type !== 'special'
            );
            timedForThisCard.actions.push({
              type: 'damage',
              target: 'opponents',
              value: damageValue,
              description: `Danno ritardato: ${damageValue} PTI`,
              targetCardId: targetCardId
            });
            if (starsToRemove && starsToRemove > 0) {
              timedForThisCard.actions.push({
                type: 'remove_stars',
                target: 'opponents',
                value: starsToRemove,
                description: `Rimuovi ${starsToRemove} stelle`
              });
            }
            
            // Move MOSSE card to graveyard
            gameManager.moveToGraveyard(gameId, mosseCardId, attackerName, 'MOSSE_RITARDATA');
            
            // Auto-draw replacement
            const drawnSuccess = await gameManager.pickCard(gameId, 'mosse', attackerName);
            if (drawnSuccess) {
              console.log(`[AUTO-DRAW] ${attackerName} drew replacement MOSSE after delayed attack`);
            }
            
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-mosse-delayed`,
              playerName: 'Sistema',
              message: `⏳ ${attackerName} ha usato una mossa ritardata! ${damageValue} PTI di danno verranno inflitti tra ${timedForThisCard.turnsRemaining} turni!`,
              timestamp: Date.now()
            });
            
            const updatedState = gameManager.getSanitizedGameState(gameId);
            io.to(gameId).emit('game-state-update', updatedState);
            return;
          }
          
          // FALLBACK: Check if MOSSE card has delay pattern in its effect/text but timed effect wasn't registered yet
          const mosseFieldCard = fullGame.field?.find((c: any) => c.id === mosseCardId);
          const mosseEffectText = (mosseFieldCard?.effect || '') + ' ' + (mosseFieldCard?.text || '') + ' ' + (mosseFieldCard?.name || '');
          const delayMatch = mosseEffectText.match(/(?:dopo|tra)\s+(\d+)\s+turni?/i) || 
                             mosseEffectText.match(/si\s+attiva\s+(?:dopo|tra)\s+(\d+)\s+turni?/i) ||
                             mosseEffectText.match(/ritard[oa].*?(\d+)\s+turni?/i);
          if (delayMatch) {
            const delayTurns = parseInt(delayMatch[1], 10);
            console.log(`⏳ MOSSE DELAYED (fallback): Creating timed effect for ${mosseCardId} with ${delayTurns} turn delay`);
            
            const timedActions: any[] = [{
              type: 'damage',
              target: 'opponents',
              value: damageValue,
              targetCardId: targetCardId,
              description: `Danno ritardato: ${damageValue} PTI`
            }];
            if (starsToRemove && starsToRemove > 0) {
              timedActions.push({
                type: 'remove_stars',
                target: 'opponents',
                value: starsToRemove,
                description: `Rimuovi ${starsToRemove} stelle`
              });
            }
            
            const fallbackTimedEffect = {
              id: `timed-${Date.now()}-${attackerName}`,
              sourcePlayer: attackerName,
              sourceCardId: mosseCardId,
              sourceCardName: mosseFieldCard?.name || (mosseFieldCard?.frontImage || '').split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/-/g, ' ') || 'Mossa',
              turnsRemaining: delayTurns,
              actions: timedActions,
              createdAt: Date.now(),
              damageDeferred: true
            } as any;
            fullGame.timedEffects.push(fallbackTimedEffect);
            
            gameManager.moveToGraveyard(gameId, mosseCardId, attackerName, 'MOSSE_RITARDATA');
            const drawnFallback = await gameManager.pickCard(gameId, 'mosse', attackerName);
            if (drawnFallback) console.log(`[AUTO-DRAW] ${attackerName} drew replacement MOSSE after delayed attack`);
            
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-mosse-delayed`,
              playerName: 'Sistema',
              message: `⏳ ${attackerName} ha usato una mossa ritardata! ${damageValue} PTI di danno verranno inflitti tra ${delayTurns} turni!`,
              timestamp: Date.now()
            });
            
            const updatedState = gameManager.getSanitizedGameState(gameId);
            io.to(gameId).emit('game-state-update', updatedState);
            return;
          }
        }

        const attackResult = await gameManager.executeMossaAttack(
          gameId, 
          attackerName, 
          mosseCardId, 
          targetCardId,
          damageValue,
          isHandTarget || false,
          undefined,
          starsToRemove || 0,
          mosseEffect || null,
          isFurtoAttack || false
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

        // CHARACTER ATTACK AUDIO: Emit audio based on MOSSE damage threshold
        try {
          const attackGameState = gameManager.getGameState(gameId);
          if (attackGameState) {
            const attackerCharacter = attackGameState.field.find((c: any) => 
              (c.type === 'personaggi' || c.type === 'personaggi_speciali') && c.owner === attackerName
            );
            if (attackerCharacter && (attackerCharacter.attackLowAudioUrl || attackerCharacter.attackHighAudioUrl)) {
              const mosseCardOnField = attackGameState.field.find((c: any) => c.id === mosseCardId) || 
                attackGameState.decks?.mosse?.find((c: any) => c.id === mosseCardId);
              const baseDamage = mosseCardOnField?.mosseDamageValue ?? damageValue;
              const attackAudioUrl = baseDamage >= 150 ? attackerCharacter.attackHighAudioUrl : attackerCharacter.attackLowAudioUrl;
              if (attackAudioUrl) {
                const cardName = attackerCharacter.name || 'Character';
                io.to(gameId).emit('character-attack-audio', {
                  cardId: attackerCharacter.id,
                  playerName: attackerName,
                  audioUrl: attackAudioUrl,
                  cardName,
                  baseDamage
                });
              }
            }
          }
        } catch (err) {
          console.error('Error emitting character attack audio:', err);
        }

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
            await gameManager.processMosseDamage(gameId, attackerName, targetCardId, damageValue, mosseCardId, io, false, isHandTarget || false, isFurtoAttack || false, false, starsToRemove || 0, mosseEffect);
          }
          
          // Attack is pending defense response - processing will continue in defense:response handler
          return;
        }

        // If no defense required, process damage immediately
        await gameManager.processMosseDamage(gameId, attackerName, targetCardId, damageValue, mosseCardId, io, false, isHandTarget || false, isFurtoAttack || false, false, starsToRemove || 0, mosseEffect);
        
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

    socket.on('defense:response', async ({ attackId, defends, gameId: clientGameId, counterAttackOptions, defenseCardId, redirectTargetCardId }: { 
      attackId: string; 
      defends: boolean; 
      gameId?: string; 
      counterAttackOptions?: { counterAttack?: boolean; counterCardId?: string; counterDamage?: number };
      defenseCardId?: string;
      redirectTargetCardId?: string;
    }) => {
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
        counterAttackOptions, processingTime: Date.now() - startTime, 
        timestamp: new Date().toISOString()
      });
      
      // SECURITY: Validate counter-attack options if provided
      let validatedCounterOptions: { counterAttack?: boolean; counterCardId?: string; counterDamage?: number } | undefined;
      if (counterAttackOptions?.counterAttack && defends) {
        // Validate that the attack can be countered (mosseCanBeCountered)
        const attackCanBeCountered = (pendingDefense as any).mosseCanBeCountered === true;
        if (!attackCanBeCountered) {
          console.warn(`[DEFENSE-RESPONSE] Counter-attack rejected: attack cannot be countered`, {
            gameId, attackId, timestamp: new Date().toISOString()
          });
          socket.emit('defense:error', { 
            message: 'This attack cannot be countered', 
            code: 'ATTACK_NOT_COUNTERABLE' 
          });
          return;
        }
        
        // Validate defender's MOSSE has mosseCanCounter property
        const counterCardId = counterAttackOptions.counterCardId;
        if (counterCardId) {
          const gameState = gameManager.getGameState(gameId);
          const defenderPlayer = gameState?.players?.[pendingDefense.defender];
          let counterCard = defenderPlayer?.hand?.find((c: any) => c.id === counterCardId);
          if (!counterCard) {
            const gameFullState = gameManager.getGameState(gameId);
            counterCard = gameFullState?.field?.find((c: any) => c.id === counterCardId && c.owner === pendingDefense.defender);
          }
          if (!counterCard || counterCard.mosseCanCounter !== true) {
            console.warn(`[DEFENSE-RESPONSE] Counter-attack rejected: MOSSE cannot counter`, {
              gameId, attackId, counterCardId, timestamp: new Date().toISOString()
            });
            socket.emit('defense:error', { 
              message: 'Your MOSSE cannot counter attacks', 
              code: 'MOSSE_CANNOT_COUNTER' 
            });
            return;
          }
        }
        
        // Validate counter damage meets or exceeds attack damage
        const attackDamage = pendingDefense.damage || 0;
        const counterDamage = counterAttackOptions.counterDamage || 0;
        if (counterDamage < attackDamage) {
          console.warn(`[DEFENSE-RESPONSE] Counter-attack rejected: insufficient damage`, {
            gameId, attackId, counterDamage, attackDamage, timestamp: new Date().toISOString()
          });
          socket.emit('defense:error', { 
            message: `Counter damage (${counterDamage}) must be >= attack damage (${attackDamage})`, 
            code: 'INSUFFICIENT_COUNTER_DAMAGE' 
          });
          return;
        }
        
        validatedCounterOptions = counterAttackOptions;
        console.log(`[DEFENSE-RESPONSE] Counter-attack validated`, {
          gameId, attackId, counterDamage, attackDamage, timestamp: new Date().toISOString()
        });
      }

      // Process using enhanced GameManager method with 'client' resolve source
      const success = await gameManager.processDefenseResponse(gameId, attackId, defends, io, 'client', validatedCounterOptions, defenseCardId, redirectTargetCardId);
      
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
      
      // SECURITY: Validate pending defense and eligibility
      const pendingDefense = gameManager.getPendingDefense(gameId);
      if (!pendingDefense || pendingDefense.attackId !== attackId) {
        socket.emit('counter-attack:error', { message: 'Invalid or expired attack', code: 'INVALID_ATTACK' });
        return;
      }
      
      // Validate that the attack can be countered (mosseCanBeCountered)
      const attackCanBeCountered = (pendingDefense as any).mosseCanBeCountered === true;
      if (!attackCanBeCountered) {
        console.warn(`[COUNTER-ATTACK] Counter rejected: attack cannot be countered`, { gameId, attackId });
        socket.emit('counter-attack:error', { message: 'This attack cannot be countered', code: 'ATTACK_NOT_COUNTERABLE' });
        return;
      }
      
      const result = await gameManager.processCounterAttack(
        gameId,
        attackId,
        defenderMosseCardId,
        defenderDamage,
        defenderTargetCardId,
        io
      );

      if (!result.success) {
        socket.emit('counter-attack:error', { 
          message: result.error || 'Failed to process counter-attack',
          code: result.error ? 'VALIDATION_FAILED' : 'PROCESSING_FAILED'
        });
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
            gameManager.processEliminationAfterDeath(gameId, playerName, io, 'remove-card-to-graveyard');
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
                  damageValue: 0,
                  timestamp: Date.now()
                });
                
                // CHARACTER ATTACK AUDIO
                try {
                  const ordAttState = gameManager.getGameState(gameId);
                  if (ordAttState) {
                    const ordAtt = ordAttState.field.find((c: any) => 
                      (c.type === 'personaggi' || c.type === 'personaggi_speciali') && c.owner === playerName
                    );
                    if (ordAtt && (ordAtt.attackLowAudioUrl || ordAtt.attackHighAudioUrl)) {
                      const ordM = ordAttState.field.find((c: any) => c.id === mosseCard.id) ||
                        ordAttState.decks?.mosse?.find((c: any) => c.id === mosseCard.id);
                      const ordBd = ordM?.mosseDamageValue ?? 0;
                      const ordAu = ordBd >= 150 ? ordAtt.attackHighAudioUrl : ordAtt.attackLowAudioUrl;
                      if (ordAu) {
                        io.to(gameId).emit('character-attack-audio', {
                          cardId: ordAtt.id, playerName: playerName,
                          audioUrl: ordAu, cardName: ordAtt.name || 'Character', baseDamage: ordBd
                        });
                      }
                    }
                  }
                } catch (err) { console.error('Error emitting attack audio:', err); }
                
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
          
          if (result.eliminationCheck) {
            gameManager.processEliminationAfterDeath(gameId, playerName, io, 'eliminate-personaggi');
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
          // Start turn timer for the first player
          if (playerOrder.length > 0) {
            gameManager.startTurnTimer(gameId, playerOrder[0]);
          }
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
        
        // OSTAGGIO: Process hostage turn countdown - counts ALL turns (any player ending), not just captor's turns
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
                          
                          // Calculate suggested damage based on mosse card settings and attacker stars
                          // CRITICAL: Use current stars from .stars property OR parse from text as fallback
                          let attackerStars = cpuCharacter?.stars ?? 1;
                          if (cpuCharacter?.text) {
                            const starsMatch = cpuCharacter.text.match(/[Ss]telle[:\s]*(\d+)/i);
                            if (starsMatch) {
                              attackerStars = parseInt(starsMatch[1]);
                            }
                          }
                          let suggestedDamage: number | null = null;
                          const mosseCard = result.card!;
                          if ((mosseCard as any).mosseDamageValue) {
                            suggestedDamage = (mosseCard as any).mosseDamageValue * attackerStars;
                          }
                          
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
                            // MOSSE damage auto-fill
                            mosseDamageValue: (mosseCard as any).mosseDamageValue || null,
                            mosseDamageEffect: (mosseCard as any).mosseDamageEffect || null,
                            suggestedDamage: suggestedDamage,
                            attackerStars: attackerStars,
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
                      damageValue: cpuAction.data.damageValue || 0,
                      timestamp: Date.now()
                    });
                    
                    // CHARACTER ATTACK AUDIO for CPU
                    try {
                      const cpuAttState4 = gameManager.getGameState(gameId);
                      if (cpuAttState4) {
                        const cpuAtt4 = cpuAttState4.field.find((c: any) => 
                          (c.type === 'personaggi' || c.type === 'personaggi_speciali') && c.owner === cpuAction.data.attackerName
                        );
                        if (cpuAtt4 && (cpuAtt4.attackLowAudioUrl || cpuAtt4.attackHighAudioUrl)) {
                          const cpuM4 = cpuAttState4.field.find((c: any) => c.id === cpuAction.data.mosseCardId) ||
                            cpuAttState4.decks?.mosse?.find((c: any) => c.id === cpuAction.data.mosseCardId);
                          const cpuBd4 = cpuM4?.mosseDamageValue ?? (cpuAction.data.damageValue || 0);
                          const cpuAu4 = cpuBd4 >= 150 ? cpuAtt4.attackHighAudioUrl : cpuAtt4.attackLowAudioUrl;
                          if (cpuAu4) {
                            io.to(gameId).emit('character-attack-audio', {
                              cardId: cpuAtt4.id, playerName: cpuAction.data.attackerName,
                              audioUrl: cpuAu4, cardName: cpuAtt4.name || 'CPU Character', baseDamage: cpuBd4
                            });
                          }
                        }
                      }
                    } catch (err) { console.error('Error emitting CPU attack audio:', err); }
                    
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
                        gameManager.processEliminationAfterDeath(gameId, cpuAction.data.playerName, io, 'CPU-elimination');
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
                    
                  case 'start-duel':
                    console.log(`⚔️ CPU ${nextPlayer} starting a DUELLO (end-turn path)`);
                    const etDuelPlayResult = await gameManager.playCard(gameId, cpuAction.data.duelCardId, cpuAction.data.initiatorPlayer);
                    if (etDuelPlayResult.card) {
                      await emitCardPlayed(io, gameId, etDuelPlayResult.card, cpuAction.data.initiatorPlayer);
                    }
                    emitThrottledGameState(io, gameId, gameManager.getSanitizedGameState(gameId));
                    
                    const etDuelStartResult = await gameManager.startDuel(gameId, cpuAction.data.duelCardId, cpuAction.data.initiatorPlayer, cpuAction.data.opponentCharacterId);
                    if (etDuelStartResult.success) {
                      const etDuelState = gameManager.getDuelState(gameId);
                      io.to(gameId).emit('chat-message', {
                        id: `${Date.now()}-duel-start`,
                        playerName: 'Sistema',
                        message: etDuelStartResult.message,
                        timestamp: Date.now()
                      });
                      io.to(gameId).emit('duel:started', {
                        duelState: etDuelState,
                        message: etDuelStartResult.message
                      });
                      emitThrottledGameState(io, gameId, gameManager.getSanitizedGameState(gameId));
                      
                      executeCpuDuelAttackSequence(io, gameId, gameManager, nextPlayer, cpuAction.data.duelCardId, cpuAction.data.initiatorPlayer, cpuAction.data.opponentCharacterId);
                      return;
                    } else {
                      console.log(`⚔️ DUELLO: CPU ${nextPlayer} failed to start duel: ${etDuelStartResult.message}`);
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
                      
                      if (followUpAction.type === 'start-duel') {
                        console.log(`⚔️ CPU ${nextPlayer} starting a DUELLO (follow-up action)`);
                        const fuDuelPlayResult = await gameManager.playCard(gameId, followUpAction.data.duelCardId, followUpAction.data.initiatorPlayer);
                        if (fuDuelPlayResult.card) {
                          await emitCardPlayed(io, gameId, fuDuelPlayResult.card, followUpAction.data.initiatorPlayer);
                        }
                        emitThrottledGameState(io, gameId, gameManager.getSanitizedGameState(gameId));
                        
                        const fuDuelStartResult = await gameManager.startDuel(gameId, followUpAction.data.duelCardId, followUpAction.data.initiatorPlayer, followUpAction.data.opponentCharacterId);
                        if (fuDuelStartResult.success) {
                          const fuDuelState = gameManager.getDuelState(gameId);
                          io.to(gameId).emit('chat-message', {
                            id: `${Date.now()}-duel-start`,
                            playerName: 'Sistema',
                            message: fuDuelStartResult.message,
                            timestamp: Date.now()
                          });
                          io.to(gameId).emit('duel:started', {
                            duelState: fuDuelState,
                            message: fuDuelStartResult.message
                          });
                          emitThrottledGameState(io, gameId, gameManager.getSanitizedGameState(gameId));
                          executeCpuDuelAttackSequence(io, gameId, gameManager, nextPlayer, followUpAction.data.duelCardId, followUpAction.data.initiatorPlayer, followUpAction.data.opponentCharacterId);
                          return;
                        } else {
                          console.log(`⚔️ DUELLO: CPU ${nextPlayer} failed to start duel (follow-up): ${fuDuelStartResult.message}`);
                        }
                      }
                      
                      await processContinuous();
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
                            
                            // Calculate suggested damage based on mosse card settings and attacker stars
                            // CRITICAL: Use current stars from .stars property OR parse from text as fallback
                            let attackerStarsFE = cpuCharacter?.stars ?? 1;
                            if (cpuCharacter?.text) {
                              const starsMatch = cpuCharacter.text.match(/[Ss]telle[:\s]*(\d+)/i);
                              if (starsMatch) {
                                attackerStarsFE = parseInt(starsMatch[1]);
                              }
                            }
                            let suggestedDamageFE: number | null = null;
                            const mosseCardFE = playResult.card!;
                            if ((mosseCardFE as any).mosseDamageValue) {
                              suggestedDamageFE = (mosseCardFE as any).mosseDamageValue * attackerStarsFE;
                            }
                            
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
                              // MOSSE damage auto-fill
                              mosseDamageValue: (mosseCardFE as any).mosseDamageValue || null,
                              mosseDamageEffect: (mosseCardFE as any).mosseDamageEffect || null,
                              suggestedDamage: suggestedDamageFE,
                              attackerStars: attackerStarsFE,
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
                          toPlayer: cpuAction.data.targetOwner,
                          attackerName: cpuAction.data.playerName,
                          targetOwner: cpuAction.data.targetOwner,
                          damageValue: 0
                        });
                        
                        // CHARACTER ATTACK AUDIO for CPU
                        try {
                          const cpuAttState5 = gameManager.getGameState(gameId);
                          if (cpuAttState5) {
                            const cpuAtt5 = cpuAttState5.field.find((c: any) => 
                              (c.type === 'personaggi' || c.type === 'personaggi_speciali') && c.owner === cpuAction.data.playerName
                            );
                            if (cpuAtt5 && (cpuAtt5.attackLowAudioUrl || cpuAtt5.attackHighAudioUrl)) {
                              const cpuM5 = cpuAttState5.field.find((c: any) => c.id === cpuAction.data.mosseCardId) ||
                                cpuAttState5.decks?.mosse?.find((c: any) => c.id === cpuAction.data.mosseCardId);
                              const cpuBd5 = cpuM5?.mosseDamageValue ?? 0;
                              const cpuAu5 = cpuBd5 >= 150 ? cpuAtt5.attackHighAudioUrl : cpuAtt5.attackLowAudioUrl;
                              if (cpuAu5) {
                                io.to(gameId).emit('character-attack-audio', {
                                  cardId: cpuAtt5.id, playerName: cpuAction.data.playerName,
                                  audioUrl: cpuAu5, cardName: cpuAtt5.name || 'CPU Character', baseDamage: cpuBd5
                                });
                              }
                            }
                          }
                        } catch (err) { console.error('Error emitting CPU attack audio:', err); }
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
                      
                    case 'start-duel':
                      console.log(`⚔️ CPU ${nextPlayer} starting a DUELLO (force-end-turn path)`);
                      const feDuelPlayResult = await gameManager.playCard(gameId, cpuAction.data.duelCardId, cpuAction.data.initiatorPlayer);
                      if (feDuelPlayResult.card) {
                        await emitCardPlayed(io, gameId, feDuelPlayResult.card, cpuAction.data.initiatorPlayer);
                      }
                      emitThrottledGameState(io, gameId, gameManager.getSanitizedGameState(gameId));
                      
                      const feDuelStartResult = await gameManager.startDuel(gameId, cpuAction.data.duelCardId, cpuAction.data.initiatorPlayer, cpuAction.data.opponentCharacterId);
                      if (feDuelStartResult.success) {
                        const feDuelState = gameManager.getDuelState(gameId);
                        io.to(gameId).emit('chat-message', {
                          id: `${Date.now()}-duel-start`,
                          playerName: 'Sistema',
                          message: feDuelStartResult.message,
                          timestamp: Date.now()
                        });
                        io.to(gameId).emit('duel:started', {
                          duelState: feDuelState,
                          message: feDuelStartResult.message
                        });
                        emitThrottledGameState(io, gameId, gameManager.getSanitizedGameState(gameId));
                        executeCpuDuelAttackSequence(io, gameId, gameManager, nextPlayer, cpuAction.data.duelCardId, cpuAction.data.initiatorPlayer, cpuAction.data.opponentCharacterId);
                        return;
                      } else {
                        console.log(`⚔️ DUELLO: CPU ${nextPlayer} failed to start duel: ${feDuelStartResult.message}`);
                      }
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

    // ─── REMATCH SYSTEM ──────────────────────────────────────────────────────
    socket.on('request-rematch', ({ gameId, playerName }: { gameId: string, playerName: string }) => {
      const game = gameManager.getGame(gameId);
      if (!game) return;
      if (!rematchVotes.has(gameId)) rematchVotes.set(gameId, new Set());
      const votes = rematchVotes.get(gameId)!;
      votes.add(playerName);
      // Broadcast vote count to all in room
      const humanPlayers = Object.values(game.players).filter(p => !p.cpuInstance);
      io.to(gameId).emit('rematch-vote-update', { votes: votes.size, total: humanPlayers.length, voters: Array.from(votes) });
      console.log(`[REMATCH] ${playerName} voted rematch in ${gameId} (${votes.size}/${humanPlayers.length})`);
      if (votes.size >= humanPlayers.length) {
        // All human players voted — start rematch
        const rematchId = `${gameId}-rematch-${Date.now()}`;
        rematchVotes.delete(gameId);
        if (rematchTimers.has(gameId)) { clearTimeout(rematchTimers.get(gameId)!); rematchTimers.delete(gameId); }
        io.to(gameId).emit('rematch-ready', { newGameId: rematchId });
        console.log(`[REMATCH] All players agreed — new game: ${rematchId}`);
      } else {
        // Set a 60s expiry for votes
        if (!rematchTimers.has(gameId)) {
          const timer = setTimeout(() => {
            rematchVotes.delete(gameId);
            rematchTimers.delete(gameId);
            io.to(gameId).emit('rematch-expired');
          }, 60000);
          rematchTimers.set(gameId, timer as any);
        }
      }
    });

    socket.on('decline-rematch', ({ gameId, playerName }: { gameId: string, playerName: string }) => {
      rematchVotes.delete(gameId);
      if (rematchTimers.has(gameId)) { clearTimeout(rematchTimers.get(gameId)!); rematchTimers.delete(gameId); }
      io.to(gameId).emit('rematch-declined', { declinedBy: playerName });
      console.log(`[REMATCH] ${playerName} declined rematch in ${gameId}`);
    });
    // ─────────────────────────────────────────────────────────────────────────

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
  // CHARACTER NAMES ENDPOINT (for MOSSE overrides)
  // ============================================
  
  // Get all character names from cache for MOSSE character-specific settings
  app.get('/api/characters', async (req, res) => {
    try {
      // Get characters from the personaggiCache (all built-in characters with names)
      const characters: { id: string; name: string }[] = [];
      const seenNames = new Set<string>();
      
      personaggiCache.forEach((value, key) => {
        // Only add if we haven't seen this name (avoid duplicates from normalized keys)
        if (!seenNames.has(value.name)) {
          seenNames.add(value.name);
          characters.push({
            id: key,
            name: value.name
          });
        }
      });
      
      // Also get permanent custom character cards
      const permanentCharacters = await db.select({
        id: customCards.id,
        name: customCards.name
      }).from(customCards).where(
        sql`${customCards.deckType} IN ('personaggi', 'personaggi_speciali')`
      );
      
      permanentCharacters.forEach(c => {
        if (!seenNames.has(c.name)) {
          seenNames.add(c.name);
          characters.push({
            id: `permanent_${c.id}`,
            name: c.name
          });
        }
      });
      
      // Sort by name
      characters.sort((a, b) => a.name.localeCompare(b.name));
      
      res.json({ success: true, characters });
    } catch (error) {
      console.error('Error fetching characters:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch characters' });
    }
  });

  // ============================================
  // CUSTOM CARDS CRUD ENDPOINTS
  // ============================================
  
  // Get all permanent custom cards (JSON storage)
  app.get('/api/custom-cards', async (req, res) => {
    try {
      const deckType = req.query.deckType as string | undefined;
      
      let cards;
      if (deckType) {
        cards = jsonStorage.customCards.getByDeckType(deckType);
      } else {
        cards = jsonStorage.customCards.getAll();
      }
      
      res.json({ success: true, cards });
    } catch (error) {
      console.error('Error fetching custom cards:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch custom cards' });
    }
  });
  
  // Update a custom card (JSON storage)
  app.patch('/api/custom-cards/:id', async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const { name, imageData, pti, stars, effect, audioUrl, attackLowAudioUrl, attackHighAudioUrl, youtubeUrl, mosseDamageValue, mosseDamageEffect, mosseCharacterOverrides, mosseRestrictedFrom, mosseRestrictedAgainst, mosseTargetingMode, mosseTargetCount, mosseCanCounter, mosseCanBeCountered } = req.body;
      
      if (isNaN(cardId)) {
        return res.status(400).json({ success: false, error: 'Invalid card ID' });
      }
      
      const updateData: Record<string, any> = {};
      if (name !== undefined && typeof name === 'string' && name.trim()) {
        updateData.name = name.trim();
      }
      if (imageData !== undefined && typeof imageData === 'string' && imageData.trim()) {
        updateData.imageData = imageData.trim();
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
      if (audioUrl !== undefined) {
        updateData.audioUrl = audioUrl || null;
      }
      if (attackLowAudioUrl !== undefined) {
        updateData.attackLowAudioUrl = attackLowAudioUrl || null;
      }
      if (attackHighAudioUrl !== undefined) {
        updateData.attackHighAudioUrl = attackHighAudioUrl || null;
      }
      if (youtubeUrl !== undefined) {
        updateData.youtubeUrl = youtubeUrl || null;
      }
      if (mosseDamageValue !== undefined) {
        updateData.mosseDamageValue = mosseDamageValue === null || mosseDamageValue === '' ? null : parseInt(mosseDamageValue);
      }
      if (mosseDamageEffect !== undefined) {
        updateData.mosseDamageEffect = mosseDamageEffect || null;
      }
      if (mosseCharacterOverrides !== undefined) {
        updateData.mosseCharacterOverrides = mosseCharacterOverrides || null;
      }
      if (mosseRestrictedFrom !== undefined) {
        updateData.mosseRestrictedFrom = mosseRestrictedFrom || null;
      }
      if (mosseRestrictedAgainst !== undefined) {
        updateData.mosseRestrictedAgainst = mosseRestrictedAgainst || null;
      }
      if (mosseTargetingMode !== undefined) {
        updateData.mosseTargetingMode = mosseTargetingMode || null;
      }
      if (mosseTargetCount !== undefined) {
        updateData.mosseTargetCount = mosseTargetCount === null || mosseTargetCount === '' ? null : parseInt(mosseTargetCount);
      }
      if (mosseCanCounter !== undefined) {
        updateData.mosseCanCounter = !!mosseCanCounter;
      }
      if (mosseCanBeCountered !== undefined) {
        updateData.mosseCanBeCountered = !!mosseCanBeCountered;
      }
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, error: 'No valid fields to update' });
      }
      
      const result = jsonStorage.customCards.update(cardId, updateData);
      
      if (!result) {
        return res.status(404).json({ success: false, error: 'Card not found' });
      }
      
      emitSync('custom_cards', 'update', updateData, { id: cardId });
      res.json({ success: true, card: result });
    } catch (error) {
      console.error('Error updating custom card:', error);
      res.status(500).json({ success: false, error: 'Failed to update custom card' });
    }
  });
  
  // Delete a custom card (JSON storage)
  app.delete('/api/custom-cards/:id', async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      
      if (isNaN(cardId)) {
        return res.status(400).json({ success: false, error: 'Invalid card ID' });
      }
      
      const deleted = jsonStorage.customCards.delete(cardId);
      
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Card not found' });
      }
      
      emitSync('custom_cards', 'delete', {}, { id: cardId });
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
      
      // Get all card modifications from JSON storage
      const modifications = jsonStorage.cardModifications.getAll();
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
            attackLowAudioUrl: mod?.attackLowAudioUrl || null,
            attackHighAudioUrl: mod?.attackHighAudioUrl || null,
            youtubeUrl: mod?.youtubeUrl || null,
            mosseDamageValue: mod?.mosseDamageValue || null,
            mosseDamageEffect: mod?.mosseDamageEffect || null,
            mosseCharacterOverrides: mod?.mosseCharacterOverrides || null,
            mosseRestrictedFrom: mod?.mosseRestrictedFrom || null,
            mosseRestrictedAgainst: mod?.mosseRestrictedAgainst || null,
            mosseTargetingMode: mod?.mosseTargetingMode || null,
            mosseTargetCount: mod?.mosseTargetCount || null,
            mosseCanCounter: mod?.mosseCanCounter || false,
            mosseCanBeCountered: mod?.mosseCanBeCountered || false,
            evolvesInto: mod?.evolvesInto || null,
            evolutionVariants: mod?.evolutionVariants || null,
            transformsInto: mod?.transformsInto || null,
            transformsFrom: mod?.transformsFrom || null,
            cheatsInto: mod?.cheatsInto || null,
            specialCategory: mod?.specialCategory || null,
            evolvedMoves: mod?.evolvedMoves || null,
            superAttacco: mod?.superAttacco || null,
            isDeleted: mod?.isDeleted || false,
            isModified: !!mod,
            draftCost: (mod as any)?.draftCost ?? 0
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

      const { originalCardId, deckType, name, imageUrl, pti, stars, effect, audioUrl, attackLowAudioUrl, attackHighAudioUrl, youtubeUrl, mosseDamageValue, mosseDamageEffect, mosseCharacterOverrides, mosseRestrictedFrom, mosseRestrictedAgainst, mosseTargetingMode, mosseTargetCount, mosseCanCounter, mosseCanBeCountered, evolvesInto, evolutionVariants, transformsInto, transformsFrom, cheatsInto, specialCategory, evolvedMoves, superAttacco } = req.body;

      // Helper to safely parse integer values (handles NaN, empty strings, undefined)
      const safeParseInt = (value: any): number | null => {
        if (value === undefined || value === null || value === '') return null;
        const parsed = parseInt(value);
        return isNaN(parsed) ? null : parsed;
      };

      // Upsert modification using JSON storage
      const modification = jsonStorage.cardModifications.upsert(originalCardId, {
        deckType,
        name: name || null,
        imageUrl: imageUrl || null,
        pti: safeParseInt(pti),
        stars: safeParseInt(stars),
        effect: effect || null,
        audioUrl: audioUrl || null,
        attackLowAudioUrl: attackLowAudioUrl || null,
        attackHighAudioUrl: attackHighAudioUrl || null,
        youtubeUrl: youtubeUrl || null,
        mosseDamageValue: safeParseInt(mosseDamageValue),
        mosseDamageEffect: mosseDamageEffect || null,
        mosseCharacterOverrides: mosseCharacterOverrides || null,
        mosseRestrictedFrom: mosseRestrictedFrom || null,
        mosseRestrictedAgainst: mosseRestrictedAgainst || null,
        mosseTargetingMode: mosseTargetingMode || null,
        mosseTargetCount: safeParseInt(mosseTargetCount),
        mosseCanCounter: !!mosseCanCounter,
        mosseCanBeCountered: !!mosseCanBeCountered,
        evolvesInto: evolvesInto || null,
        evolutionVariants: evolutionVariants || null,
        transformsInto: transformsInto || null,
        transformsFrom: transformsFrom || null,
        cheatsInto: cheatsInto || null,
        specialCategory: specialCategory || null,
        evolvedMoves: evolvedMoves || null,
        superAttacco: superAttacco || null,
        modifiedBy: userEmail || null
      });
      
      emitSync('card_modifications', 'update', { ...modification, originalCardId }, { originalCardId });
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

  app.post('/api/admin/card-modifications-bulk', authMiddleware, async (req, res) => {
    try {
      const userEmail = req.user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }

      const { modifications } = req.body;
      if (!Array.isArray(modifications) || modifications.length === 0) {
        return res.status(400).json({ success: false, error: 'No modifications provided' });
      }

      const safeParseInt = (value: any): number | null => {
        if (value === undefined || value === null || value === '') return null;
        const parsed = parseInt(value);
        return isNaN(parsed) ? null : parsed;
      };

      for (const mod of modifications) {
        jsonStorage.cardModifications.upsert(mod.originalCardId, {
          deckType: mod.deckType,
          name: mod.name || null,
          imageUrl: mod.imageUrl || null,
          pti: safeParseInt(mod.pti),
          stars: safeParseInt(mod.stars),
          effect: mod.effect || null,
          audioUrl: mod.audioUrl || null,
          attackLowAudioUrl: mod.attackLowAudioUrl || null,
          attackHighAudioUrl: mod.attackHighAudioUrl || null,
          youtubeUrl: mod.youtubeUrl || null,
          mosseDamageValue: safeParseInt(mod.mosseDamageValue),
          mosseDamageEffect: mod.mosseDamageEffect || null,
          mosseCharacterOverrides: mod.mosseCharacterOverrides || null,
          mosseRestrictedFrom: mod.mosseRestrictedFrom || null,
          mosseRestrictedAgainst: mod.mosseRestrictedAgainst || null,
          mosseTargetingMode: mod.mosseTargetingMode || null,
          mosseTargetCount: safeParseInt(mod.mosseTargetCount),
          mosseCanCounter: !!mod.mosseCanCounter,
          mosseCanBeCountered: !!mod.mosseCanBeCountered,
          evolvesInto: mod.evolvesInto || null,
          evolutionVariants: mod.evolutionVariants || null,
          transformsInto: mod.transformsInto || null,
          transformsFrom: mod.transformsFrom || null,
          cheatsInto: mod.cheatsInto || null,
          specialCategory: mod.specialCategory || null,
          evolvedMoves: mod.evolvedMoves || null,
          superAttacco: mod.superAttacco || null,
          modifiedBy: userEmail || null,
          draftCost: safeParseInt(mod.draftCost) ?? 0
        });
        emitSync('card_modifications', 'update', { originalCardId: mod.originalCardId, ...mod }, { originalCardId: mod.originalCardId });
      }

      const refreshedGames = await gameManager.refreshCardMetadataForAllGames();
      console.log(`Bulk card modifications saved (${modifications.length}). Refreshed ${refreshedGames.length} active games.`);

      for (const gameId of refreshedGames) {
        const gameState = gameManager.getSanitizedGameState(gameId);
        emitThrottledGameState(io, gameId, gameState);
      }

      res.json({ success: true, count: modifications.length });
    } catch (error) {
      console.error('Error bulk saving card modifications:', error);
      res.status(500).json({ success: false, error: 'Failed to bulk save modifications' });
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

      // Upsert modification using JSON storage
      const modification = jsonStorage.cardModifications.upsert(originalCardId, {
        deckType,
        isDeleted: isDeleted,
        modifiedBy: userEmail || null
      });
      
      emitSync('card_modifications', 'update', { originalCardId, deckType, isDeleted, modifiedBy: userEmail || null }, { originalCardId });
      res.json({ success: true, modification });
    } catch (error) {
      console.error('Error toggling card deletion:', error);
      res.status(500).json({ success: false, error: 'Failed to toggle deletion' });
    }
  });

  // Get all card modifications (JSON storage)
  app.get('/api/card-modifications', async (req, res) => {
    try {
      const modifications = jsonStorage.cardModifications.getAll();
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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }
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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }
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
      if (!isDatabaseAvailable()) {
        const allUsers = jsonStorage.users.getAll();
        const leaderboard = allUsers.map((u: any) => ({ id: u.id, username: u.username, avatar: u.avatar, puntiRankiard: u.puntiRankiard || 0, gamesPlayed: 0, gamesWon: 0, minutesPlayed: 0 })).sort((a: any, b: any) => (b.puntiRankiard || 0) - (a.puntiRankiard || 0)).slice(0, 100);
        return res.json({ success: true, leaderboard });
      }
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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }
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
      
      const allAchievements = jsonStorage.achievements.getAll();
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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }
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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }
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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }
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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }
      const eventId = parseInt(req.params.id);
      
      const cardsList = await db.select().from(seasonalCards)
        .where(eq(seasonalCards.eventId, eventId));
      
      res.json({ success: true, cards: cardsList });
    } catch (error) {
      console.error('Error fetching seasonal cards:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch cards' });
    }
  });

  // ============= ADMIN SEASONAL EVENTS ENDPOINTS =============

  // Create a new seasonal event (admin only)
  app.post('/api/admin/seasonal-events', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }
      const user = (req as any).user;
      const isAdmin = await checkAdminAccess(user);
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      const { name, description, startDate, endDate, bannerImage, isActive } = req.body;

      if (!name || !startDate || !endDate) {
        return res.status(400).json({ success: false, error: 'Name, start date and end date are required' });
      }

      const newEvent = await db.insert(seasonalEvents).values({
        name,
        description: description || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        bannerImage: bannerImage || null,
        isActive: isActive !== false
      }).returning();

      emitSync('seasonal_events', 'insert', { name, description: description || null, startDate: new Date(startDate), endDate: new Date(endDate), bannerImage: bannerImage || null, isActive: isActive !== false });
      res.json({ success: true, event: newEvent[0] });
    } catch (error) {
      console.error('Error creating seasonal event:', error);
      res.status(500).json({ success: false, error: 'Failed to create event' });
    }
  });

  // Update a seasonal event (admin only)
  app.put('/api/admin/seasonal-events/:id', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const eventId = parseInt(req.params.id);
      const isAdmin = await checkAdminAccess(user);
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      const { name, description, startDate, endDate, bannerImage, isActive } = req.body;

      const updated = await db.update(seasonalEvents)
        .set({
          name,
          description: description || null,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          bannerImage: bannerImage || null,
          isActive: isActive !== false
        })
        .where(eq(seasonalEvents.id, eventId))
        .returning();

      if (!updated.length) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      emitSync('seasonal_events', 'update', { name, description: description || null, startDate: new Date(startDate), endDate: new Date(endDate), bannerImage: bannerImage || null, isActive: isActive !== false }, eq(seasonalEvents.id, eventId));
      res.json({ success: true, event: updated[0] });
    } catch (error) {
      console.error('Error updating seasonal event:', error);
      res.status(500).json({ success: false, error: 'Failed to update event' });
    }
  });

  // Delete a seasonal event (admin only)
  app.delete('/api/admin/seasonal-events/:id', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const eventId = parseInt(req.params.id);
      const isAdmin = await checkAdminAccess(user);
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      // Also delete associated seasonal cards
      await db.delete(seasonalCards).where(eq(seasonalCards.eventId, eventId));
      emitSync('seasonal_cards', 'delete', {}, eq(seasonalCards.eventId, eventId));
      await db.delete(seasonalEvents).where(eq(seasonalEvents.id, eventId));
      emitSync('seasonal_events', 'delete', {}, eq(seasonalEvents.id, eventId));
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting seasonal event:', error);
      res.status(500).json({ success: false, error: 'Failed to delete event' });
    }
  });

  // Add a card to a seasonal event (admin only)
  app.post('/api/admin/seasonal-events/:id/cards', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }
      const user = (req as any).user;
      const eventId = parseInt(req.params.id);
      const isAdmin = await checkAdminAccess(user);
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      const { name, deckType, imageUrl, pti, stars, effect, rarity } = req.body;

      if (!name || !deckType) {
        return res.status(400).json({ success: false, error: 'Name and deck type are required' });
      }

      const newCard = await db.insert(seasonalCards).values({
        eventId,
        name,
        deckType,
        imageUrl: imageUrl || null,
        pti: pti || null,
        stars: stars || null,
        effect: effect || null,
        rarity: rarity || 'rare'
      }).returning();

      emitSync('seasonal_cards', 'insert', { eventId, name, deckType, imageUrl: imageUrl || null, pti: pti || null, stars: stars || null, effect: effect || null, rarity: rarity || 'rare' });
      res.json({ success: true, card: newCard[0] });
    } catch (error) {
      console.error('Error adding seasonal card:', error);
      res.status(500).json({ success: false, error: 'Failed to add card' });
    }
  });

  // Delete a seasonal card (admin only)
  app.delete('/api/admin/seasonal-cards/:id', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const cardId = parseInt(req.params.id);
      const isAdmin = await checkAdminAccess(user);
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      await db.delete(seasonalCards).where(eq(seasonalCards.id, cardId));
      emitSync('seasonal_cards', 'delete', {}, eq(seasonalCards.id, cardId));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting seasonal card:', error);
      res.status(500).json({ success: false, error: 'Failed to delete card' });
    }
  });

  // ============= CARD SKINS ENDPOINTS =============

  // Get all card names for skin assignment (organized by deck)
  app.get('/api/all-card-names', async (req, res) => {
    try {
      // Helper function to extract card name from URL
      const extractCardName = (url: string): string => {
        try {
          const urlObj = new URL(url);
          const pathname = urlObj.pathname;
          const filename = pathname.split('/').pop() || '';
          return filename.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase();
        } catch {
          return url;
        }
      };

      // Get card data from CARD_DATA
      const cardNames: { [key: string]: string[] } = {
        personaggi: [],
        mosse: [],
        bonus: [],
        personaggi_speciali: [],
        carte_personalizzate: []
      };

      // Extract names from CARD_DATA
      CARD_DATA.bonus.forEach(url => {
        const name = extractCardName(url);
        if (name && !cardNames.bonus.includes(name)) {
          cardNames.bonus.push(name);
        }
      });

      CARD_DATA.mosse.forEach(url => {
        const name = extractCardName(url);
        if (name && !cardNames.mosse.includes(name)) {
          cardNames.mosse.push(name);
        }
      });

      CARD_DATA.personaggi.forEach(url => {
        const name = extractCardName(url);
        if (name && !cardNames.personaggi.includes(name)) {
          cardNames.personaggi.push(name);
        }
      });

      CARD_DATA.personaggi_speciali.forEach(url => {
        const name = extractCardName(url);
        if (name && !cardNames.personaggi_speciali.includes(name)) {
          cardNames.personaggi_speciali.push(name);
        }
      });

      // Get permanent custom cards from JSON storage
      const permanentCards = jsonStorage.customCards.getAll();
      permanentCards.forEach(card => {
        if (card.name && !cardNames.carte_personalizzate.includes(card.name.toUpperCase())) {
          cardNames.carte_personalizzate.push(card.name.toUpperCase());
        }
      });

      // Sort all arrays alphabetically
      Object.keys(cardNames).forEach(key => {
        cardNames[key].sort();
      });

      res.json({ success: true, cardNames });
    } catch (error) {
      console.error('Error fetching card names:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch card names' });
    }
  });

  // Get all available card skins (JSON storage)
  app.get('/api/card-skins', async (req, res) => {
    try {
      const skinsList = jsonStorage.cardSkins.getAvailable();
      
      res.json({ success: true, skins: skinsList });
    } catch (error) {
      console.error('Error fetching card skins:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch skins' });
    }
  });

  // Get player's owned skins
  app.get('/api/card-skins/owned', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const { skinId } = req.body;
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const skin = jsonStorage.cardSkins.getById(skinId);
      if (!skin) {
        return res.status(404).json({ success: false, error: 'Skin not found' });
      }
      
      if (currentUser[0].puntiRankiard < (skin.price || 0)) {
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
        .set({ puntiRankiard: currentUser[0].puntiRankiard - (skin.price || 0) })
        .where(eq(users.id, currentUser[0].id));
      emitSync('users', 'update', { puntiRankiard: currentUser[0].puntiRankiard - (skin.price || 0) }, eq(users.id, currentUser[0].id));
      
      await db.insert(playerSkins).values({
        userId: currentUser[0].id,
        skinId
      });
      emitSync('player_skins', 'insert', { userId: currentUser[0].id, skinId });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error purchasing skin:', error);
      res.status(500).json({ success: false, error: 'Failed to purchase skin' });
    }
  });

  // Equip a skin
  app.post('/api/card-skins/equip', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      emitSync('player_skins', 'update', { isEquipped: false }, eq(playerSkins.userId, currentUser[0].id));
      
      // Equip the selected skin
      await db.update(playerSkins)
        .set({ isEquipped: true })
        .where(and(eq(playerSkins.userId, currentUser[0].id), eq(playerSkins.skinId, skinId)));
      emitSync('player_skins', 'update', { isEquipped: true }, and(eq(playerSkins.userId, currentUser[0].id), eq(playerSkins.skinId, skinId)));
      
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
      const isAdmin = await checkAdminAccess(user);
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      const { name, cardName, cardType, description, skinImageUrl, skinPti, skinStars, rarity, price, borderStyle, glowColor, isAvailable } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, error: 'Name is required' });
      }

      const newSkin = jsonStorage.cardSkins.create({
        name,
        cardName: cardName || null,
        cardType: cardType || null,
        description: description || null,
        skinImageUrl: skinImageUrl || null,
        skinPti: skinPti ? parseInt(skinPti) : null,
        skinStars: skinStars ? parseInt(skinStars) : null,
        borderStyle: borderStyle || null,
        backgroundGradient: null,
        frameImageUrl: null,
        glowColor: glowColor || null,
        rarity: rarity || 'common',
        price: price || 100,
        isAvailable: isAvailable !== false
      });

      emitSync('card_skins', 'insert', newSkin);
      res.json({ success: true, skin: newSkin });
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
      const isAdmin = await checkAdminAccess(user);
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      const { name, cardName, cardType, description, skinImageUrl, skinPti, skinStars, rarity, price, borderStyle, glowColor, isAvailable } = req.body;

      const updated = jsonStorage.cardSkins.update(skinId, {
        name,
        cardName: cardName || null,
        cardType: cardType || null,
        description: description || null,
        skinImageUrl: skinImageUrl || null,
        skinPti: skinPti ? parseInt(skinPti) : null,
        skinStars: skinStars ? parseInt(skinStars) : null,
        borderStyle: borderStyle || null,
        glowColor: glowColor || null,
        rarity: rarity || 'common',
        price: price || 100,
        isAvailable: isAvailable !== false
      });

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Skin not found' });
      }

      emitSync('card_skins', 'update', updated, { id: skinId });
      res.json({ success: true, skin: updated });
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
      const isAdmin = await checkAdminAccess(user);
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      jsonStorage.cardSkins.delete(skinId);
      emitSync('card_skins', 'delete', {}, { id: skinId });
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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
        emitSync('player_pass_progress', 'insert', { userId: currentUser[0].id, passId });
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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
        emitSync('users', 'update', { puntiRankiard: currentUser[0].puntiRankiard + points }, eq(users.id, currentUser[0].id));
      }
      
      res.json({ success: true, message: 'Reward claimed successfully' });
    } catch (error) {
      console.error('Error claiming reward:', error);
      res.status(500).json({ success: false, error: 'Failed to claim reward' });
    }
  });

  // ============= ADMIN SEASONAL PASS ENDPOINTS =============

  // Get all seasonal passes (admin only)
  app.get('/api/admin/seasonal-passes', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const isAdmin = await checkAdminAccess(user);
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      const passesList = await db.select().from(seasonalPasses)
        .orderBy(desc(seasonalPasses.startDate));
      
      res.json({ success: true, passes: passesList });
    } catch (error) {
      console.error('Error fetching seasonal passes:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch passes' });
    }
  });

  // Create a new seasonal pass (admin only)
  app.post('/api/admin/seasonal-passes', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const isAdmin = await checkAdminAccess(user);
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      const { name, description, startDate, endDate, maxLevel, isActive } = req.body;

      if (!name || !startDate || !endDate) {
        return res.status(400).json({ success: false, error: 'Name, start date and end date are required' });
      }

      const newPass = await db.insert(seasonalPasses).values({
        name,
        description: description || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        maxLevel: maxLevel || 50,
        isActive: isActive !== false
      }).returning();

      emitSync('seasonal_passes', 'insert', { name, description: description || null, startDate: new Date(startDate), endDate: new Date(endDate), maxLevel: maxLevel || 50, isActive: isActive !== false });
      res.json({ success: true, pass: newPass[0] });
    } catch (error) {
      console.error('Error creating seasonal pass:', error);
      res.status(500).json({ success: false, error: 'Failed to create pass' });
    }
  });

  // Update a seasonal pass (admin only)
  app.put('/api/admin/seasonal-passes/:id', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const passId = parseInt(req.params.id);
      const isAdmin = await checkAdminAccess(user);
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      const { name, description, startDate, endDate, maxLevel, isActive } = req.body;

      const updated = await db.update(seasonalPasses)
        .set({
          name,
          description: description || null,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          maxLevel: maxLevel || 50,
          isActive: isActive !== false
        })
        .where(eq(seasonalPasses.id, passId))
        .returning();

      if (!updated.length) {
        return res.status(404).json({ success: false, error: 'Pass not found' });
      }

      emitSync('seasonal_passes', 'update', { name, description: description || null, startDate: new Date(startDate), endDate: new Date(endDate), maxLevel: maxLevel || 50, isActive: isActive !== false }, eq(seasonalPasses.id, passId));
      res.json({ success: true, pass: updated[0] });
    } catch (error) {
      console.error('Error updating seasonal pass:', error);
      res.status(500).json({ success: false, error: 'Failed to update pass' });
    }
  });

  // Delete a seasonal pass (admin only)
  app.delete('/api/admin/seasonal-passes/:id', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const passId = parseInt(req.params.id);
      const isAdmin = await checkAdminAccess(user);
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      // Also delete associated rewards
      await db.delete(passRewards).where(eq(passRewards.passId, passId));
      emitSync('pass_rewards', 'delete', {}, eq(passRewards.passId, passId));
      await db.delete(seasonalPasses).where(eq(seasonalPasses.id, passId));
      emitSync('seasonal_passes', 'delete', {}, eq(seasonalPasses.id, passId));
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting seasonal pass:', error);
      res.status(500).json({ success: false, error: 'Failed to delete pass' });
    }
  });

  // Add a reward to a seasonal pass (admin only)
  app.post('/api/admin/seasonal-passes/:id/rewards', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const passId = parseInt(req.params.id);
      const isAdmin = await checkAdminAccess(user);
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      const { level, rewardType, rewardValue, isPremium } = req.body;

      if (!level || !rewardType || !rewardValue) {
        return res.status(400).json({ success: false, error: 'Level, reward type and reward value are required' });
      }

      const newReward = await db.insert(passRewards).values({
        passId,
        level,
        rewardType,
        rewardValue,
        isPremium: isPremium || false
      }).returning();

      emitSync('pass_rewards', 'insert', { passId, level, rewardType, rewardValue, isPremium: isPremium || false });
      res.json({ success: true, reward: newReward[0] });
    } catch (error) {
      console.error('Error adding pass reward:', error);
      res.status(500).json({ success: false, error: 'Failed to add reward' });
    }
  });

  // Delete a pass reward (admin only)
  app.delete('/api/admin/pass-rewards/:id', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const rewardId = parseInt(req.params.id);
      const isAdmin = await checkAdminAccess(user);
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      await db.delete(passRewards).where(eq(passRewards.id, rewardId));
      emitSync('pass_rewards', 'delete', {}, eq(passRewards.id, rewardId));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting pass reward:', error);
      res.status(500).json({ success: false, error: 'Failed to delete reward' });
    }
  });

  // ============= CLAN SYSTEM ENDPOINTS =============

  // Get all clans (with optional search)
  app.get('/api/clans', async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      emitSync('clans', 'insert', { name, tag: tag.toUpperCase(), description: description || null, emblem: emblem || '⚔️', leaderId: currentUser[0].id, isPublic: isPublic !== false });
      
      // Add creator as leader
      await db.insert(clanMembers).values({
        clanId: newClan.id,
        userId: currentUser[0].id,
        role: 'leader',
        contributedPoints: currentUser[0].puntiRankiard
      });
      emitSync('clan_members', 'insert', { clanId: newClan.id, userId: currentUser[0].id, role: 'leader', contributedPoints: currentUser[0].puntiRankiard });
      
      // Update clan total points
      await db.update(clans)
        .set({ totalPoints: currentUser[0].puntiRankiard })
        .where(eq(clans.id, newClan.id));
      emitSync('clans', 'update', { totalPoints: currentUser[0].puntiRankiard }, eq(clans.id, newClan.id));
      
      res.json({ success: true, clan: newClan });
    } catch (error) {
      console.error('Error creating clan:', error);
      res.status(500).json({ success: false, error: 'Failed to create clan' });
    }
  });

  // Join a clan
  app.post('/api/clans/:id/join', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
        emitSync('clan_join_requests', 'insert', { clanId, userId: currentUser[0].id });
        return res.json({ success: true, message: 'Join request sent' });
      }
      
      // Join public clan directly
      await db.insert(clanMembers).values({
        clanId,
        userId: currentUser[0].id,
        role: 'member',
        contributedPoints: currentUser[0].puntiRankiard
      });
      emitSync('clan_members', 'insert', { clanId, userId: currentUser[0].id, role: 'member', contributedPoints: currentUser[0].puntiRankiard });
      
      // Update clan stats
      await db.update(clans)
        .set({
          memberCount: clan[0].memberCount + 1,
          totalPoints: clan[0].totalPoints + currentUser[0].puntiRankiard
        })
        .where(eq(clans.id, clanId));
      emitSync('clans', 'update', { memberCount: clan[0].memberCount + 1, totalPoints: clan[0].totalPoints + currentUser[0].puntiRankiard }, eq(clans.id, clanId));
      
      res.json({ success: true, message: 'Joined clan successfully' });
    } catch (error) {
      console.error('Error joining clan:', error);
      res.status(500).json({ success: false, error: 'Failed to join clan' });
    }
  });

  // Leave a clan
  app.post('/api/clans/leave', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
        emitSync('clan_members', 'delete', {}, eq(clanMembers.clanId, clan[0].id));
        await db.delete(clanJoinRequests).where(eq(clanJoinRequests.clanId, clan[0].id));
        emitSync('clan_join_requests', 'delete', {}, eq(clanJoinRequests.clanId, clan[0].id));
        await db.delete(clans).where(eq(clans.id, clan[0].id));
        emitSync('clans', 'delete', {}, eq(clans.id, clan[0].id));
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
          emitSync('clan_members', 'update', { role: 'leader' }, eq(clanMembers.id, nextLeader[0].id));
          await db.update(clans).set({ leaderId: nextLeader[0].userId }).where(eq(clans.id, clan[0].id));
          emitSync('clans', 'update', { leaderId: nextLeader[0].userId }, eq(clans.id, clan[0].id));
        }
      }
      
      // Remove member
      await db.delete(clanMembers).where(eq(clanMembers.id, membership[0].id));
      emitSync('clan_members', 'delete', {}, eq(clanMembers.id, membership[0].id));
      
      // Update clan stats
      await db.update(clans)
        .set({
          memberCount: clan[0].memberCount - 1,
          totalPoints: clan[0].totalPoints - membership[0].contributedPoints
        })
        .where(eq(clans.id, clan[0].id));
      emitSync('clans', 'update', { memberCount: clan[0].memberCount - 1, totalPoints: clan[0].totalPoints - membership[0].contributedPoints }, eq(clans.id, clan[0].id));
      
      res.json({ success: true, message: 'Left clan successfully' });
    } catch (error) {
      console.error('Error leaving clan:', error);
      res.status(500).json({ success: false, error: 'Failed to leave clan' });
    }
  });

  // Get user's clan
  app.get('/api/my-clan', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const status = req.query.status as string;
      
      const tournamentList = await (status
        ? db.select().from(tournaments).where(eq(tournaments.status, status)).orderBy(desc(tournaments.createdAt)).limit(20)
        : db.select().from(tournaments).orderBy(desc(tournaments.createdAt)).limit(20)
      );
      res.json({ success: true, tournaments: tournamentList });
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tournaments' });
    }
  });

  // Get a specific tournament with participants
  app.get('/api/tournaments/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      
      emitSync('tournaments', 'insert', { name, description: description || null, type: type || 'elimination', maxParticipants: maxParticipants || 8, prizePool: prizePool || 100, entryFee: entryFee || 0, organizerId: currentUser[0].id });
      res.json({ success: true, tournament: newTournament });
    } catch (error) {
      console.error('Error creating tournament:', error);
      res.status(500).json({ success: false, error: 'Failed to create tournament' });
    }
  });

  // Join a tournament
  app.post('/api/tournaments/:id/join', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
        emitSync('users', 'update', { puntiRankiard: currentUser[0].puntiRankiard - tournament[0].entryFee }, eq(users.id, currentUser[0].id));
      }
      
      // Register
      await db.insert(tournamentParticipants).values({
        tournamentId,
        userId: currentUser[0].id
      });
      emitSync('tournament_participants', 'insert', { tournamentId, userId: currentUser[0].id });
      
      // Update participant count
      await db.update(tournaments)
        .set({ currentParticipants: tournament[0].currentParticipants + 1 })
        .where(eq(tournaments.id, tournamentId));
      emitSync('tournaments', 'update', { currentParticipants: tournament[0].currentParticipants + 1 }, eq(tournaments.id, tournamentId));
      
      res.json({ success: true, message: 'Successfully joined tournament' });
    } catch (error) {
      console.error('Error joining tournament:', error);
      res.status(500).json({ success: false, error: 'Failed to join tournament' });
    }
  });

  // Close tournament registration (organizer only)
  app.post('/api/tournaments/:id/close-registration', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const tournamentId = parseInt(req.params.id);

      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(401).json({ success: false, error: 'User not found' });
      }

      const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
      if (!tournament.length) {
        return res.status(404).json({ success: false, error: 'Tournament not found' });
      }

      if (tournament[0].organizerId !== currentUser[0].id) {
        return res.status(403).json({ success: false, error: 'Only the organizer can close registration' });
      }

      if (tournament[0].status !== 'registration') {
        return res.status(400).json({ success: false, error: 'Tournament is not in registration phase' });
      }

      if (tournament[0].currentParticipants < 2) {
        return res.status(400).json({ success: false, error: 'Need at least 2 participants to close registration' });
      }

      await db.update(tournaments)
        .set({ status: 'closed' })
        .where(eq(tournaments.id, tournamentId));
      emitSync('tournaments', 'update', { status: 'closed' }, eq(tournaments.id, tournamentId));

      res.json({ success: true, message: 'Registration closed successfully' });
    } catch (error) {
      console.error('Error closing registration:', error);
      res.status(500).json({ success: false, error: 'Failed to close registration' });
    }
  });

  // Start a tournament (organizer only)
  app.post('/api/tournaments/:id/start', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      
      // Check tournament is in registration or closed phase
      if (tournament[0].status !== 'registration' && tournament[0].status !== 'closed') {
        return res.status(400).json({ success: false, error: 'Tournament has already started or completed' });
      }
      
      if (tournament[0].currentParticipants < 2) {
        return res.status(400).json({ success: false, error: 'Need at least 2 participants' });
      }
      
      // Update status
      await db.update(tournaments)
        .set({ status: 'in_progress', startDate: new Date() })
        .where(eq(tournaments.id, tournamentId));
      emitSync('tournaments', 'update', { status: 'in_progress', startDate: new Date() }, eq(tournaments.id, tournamentId));
      
      // Generate first round matches
      const participants = await db.select().from(tournamentParticipants)
        .where(eq(tournamentParticipants.tournamentId, tournamentId));
      
      const shuffled = participants.sort(() => Math.random() - 0.5);
      const matchCount = Math.floor(shuffled.length / 2);
      
      for (let i = 0; i < matchCount; i++) {
        const hasBothPlayers = !!shuffled[i * 2 + 1];
        const gameId = hasBothPlayers ? `tournament-${tournamentId}-r1-m${i + 1}` : null;
        
        await db.insert(tournamentMatches).values({
          tournamentId,
          round: 1,
          matchNumber: i + 1,
          player1Id: shuffled[i * 2].userId,
          player2Id: shuffled[i * 2 + 1]?.userId || null,
          gameId: gameId,
          status: hasBothPlayers ? 'pending' : 'completed',
          winnerId: hasBothPlayers ? null : shuffled[i * 2].userId // Bye
        });
        emitSync('tournament_matches', 'insert', { tournamentId, round: 1, matchNumber: i + 1, player1Id: shuffled[i * 2].userId, player2Id: shuffled[i * 2 + 1]?.userId || null, gameId, status: hasBothPlayers ? 'pending' : 'completed', winnerId: hasBothPlayers ? null : shuffled[i * 2].userId });
      }
      
      // Broadcast tournament started to all connected clients
      io.emit('tournament-started', {
        tournamentId,
        tournamentName: tournament[0].name,
        participantIds: shuffled.map(p => p.userId),
        message: `Il torneo "${tournament[0].name}" è iniziato!`
      });
      
      res.json({ success: true, message: 'Tournament started' });
    } catch (error) {
      console.error('Error starting tournament:', error);
      res.status(500).json({ success: false, error: 'Failed to start tournament' });
    }
  });

  // Join a tournament match (creates the game room if needed)
  app.post('/api/tournaments/matches/:matchId/join', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const matchId = parseInt(req.params.matchId);
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const match = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, matchId)).limit(1);
      if (!match.length) {
        return res.status(404).json({ success: false, error: 'Match not found' });
      }
      
      const matchData = match[0];
      
      // Check if user is a participant in this match
      if (matchData.player1Id !== currentUser[0].id && matchData.player2Id !== currentUser[0].id) {
        return res.status(403).json({ success: false, error: 'Not a participant in this match' });
      }
      
      // Check match status
      if (matchData.status === 'completed') {
        return res.status(400).json({ success: false, error: 'Match already completed' });
      }
      
      // Get tournament info
      const tournament = await db.select().from(tournaments).where(eq(tournaments.id, matchData.tournamentId)).limit(1);
      if (!tournament.length || tournament[0].status !== 'in_progress') {
        return res.status(400).json({ success: false, error: 'Tournament not in progress' });
      }
      
      const gameId = matchData.gameId || `tournament-${matchData.tournamentId}-r${matchData.round}-m${matchData.matchNumber}`;
      
      // Update match with gameId and status if needed
      const updateFields: Record<string, any> = {};
      if (!matchData.gameId) {
        updateFields.gameId = gameId;
      }
      if (matchData.status === 'pending') {
        updateFields.status = 'in_progress';
      }
      if (Object.keys(updateFields).length > 0) {
        await db.update(tournamentMatches)
          .set(updateFields)
          .where(eq(tournamentMatches.id, matchId));
        emitSync('tournament_matches', 'update', updateFields, eq(tournamentMatches.id, matchId));
      }
      
      res.json({ 
        success: true, 
        gameId,
        matchId,
        tournamentId: matchData.tournamentId,
        round: matchData.round,
        matchNumber: matchData.matchNumber
      });
    } catch (error) {
      console.error('Error joining tournament match:', error);
      res.status(500).json({ success: false, error: 'Failed to join match' });
    }
  });

  // Report tournament match result
  app.post('/api/tournaments/matches/:matchId/report', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const matchId = parseInt(req.params.matchId);
      const { winnerId } = req.body;
      
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const match = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, matchId)).limit(1);
      if (!match.length) {
        return res.status(404).json({ success: false, error: 'Match not found' });
      }
      
      const matchData = match[0];
      
      // Check tournament is in progress
      const tournament = await db.select().from(tournaments).where(eq(tournaments.id, matchData.tournamentId)).limit(1);
      if (!tournament.length || tournament[0].status !== 'in_progress') {
        return res.status(400).json({ success: false, error: 'Tournament not in progress' });
      }
      
      // Only organizer or participants can report
      const isOrganizer = tournament[0].organizerId === currentUser[0].id;
      const isParticipant = matchData.player1Id === currentUser[0].id || matchData.player2Id === currentUser[0].id;
      if (!isOrganizer && !isParticipant) {
        return res.status(403).json({ success: false, error: 'Not authorized to report this match' });
      }
      
      // Validate winner
      if (winnerId !== matchData.player1Id && winnerId !== matchData.player2Id) {
        return res.status(400).json({ success: false, error: 'Invalid winner' });
      }
      
      // Update match
      await db.update(tournamentMatches)
        .set({ winnerId, status: 'completed', completedAt: new Date() })
        .where(eq(tournamentMatches.id, matchId));
      emitSync('tournament_matches', 'update', { winnerId, status: 'completed', completedAt: new Date() }, eq(tournamentMatches.id, matchId));
      
      // Check if all matches in this round are completed
      const roundMatches = await db.select().from(tournamentMatches)
        .where(and(
          eq(tournamentMatches.tournamentId, matchData.tournamentId),
          eq(tournamentMatches.round, matchData.round)
        ));
      
      const allCompleted = roundMatches.every(m => m.status === 'completed' || m.id === matchId);
      
      if (allCompleted) {
        // Collect winners
        const winners = roundMatches.map(m => m.id === matchId ? winnerId : m.winnerId).filter(Boolean);
        
        if (winners.length <= 1) {
          // Tournament complete
          await db.update(tournaments)
            .set({ status: 'completed', winnerId: winners[0] || null })
            .where(eq(tournaments.id, matchData.tournamentId));
          emitSync('tournaments', 'update', { status: 'completed', winnerId: winners[0] || null }, eq(tournaments.id, matchData.tournamentId));
          
          io.emit('tournament-completed', {
            tournamentId: matchData.tournamentId,
            winnerId: winners[0]
          });
        } else {
          // Create next round matches
          const nextRound = matchData.round + 1;
          const matchCount = Math.floor(winners.length / 2);
          
          for (let i = 0; i < matchCount; i++) {
            const p1 = winners[i * 2];
            const p2 = winners[i * 2 + 1] || null;
            const gameId = p2 ? `tournament-${matchData.tournamentId}-r${nextRound}-m${i + 1}` : null;
            
            await db.insert(tournamentMatches).values({
              tournamentId: matchData.tournamentId,
              round: nextRound,
              matchNumber: i + 1,
              player1Id: p1,
              player2Id: p2,
              gameId,
              status: p2 ? 'pending' : 'completed',
              winnerId: p2 ? null : p1
            });
            emitSync('tournament_matches', 'insert', { tournamentId: matchData.tournamentId, round: nextRound, matchNumber: i + 1, player1Id: p1, player2Id: p2, gameId, status: p2 ? 'pending' : 'completed', winnerId: p2 ? null : p1 });
          }
          
          io.emit('tournament-round-advanced', {
            tournamentId: matchData.tournamentId,
            round: nextRound
          });
        }
      }
      
      res.json({ success: true, message: 'Match result reported' });
    } catch (error) {
      console.error('Error reporting match result:', error);
      res.status(500).json({ success: false, error: 'Failed to report match' });
    }
  });

  // ============= END TOURNAMENT SYSTEM =============

  // Search users by username
  app.get('/api/users/search', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      emitSync('friend_requests', 'insert', { requesterId, addresseeId, message: message || null, status: 'pending' });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error sending friend request:', error);
      res.status(500).json({ success: false, error: 'Failed to send friend request' });
    }
  });

  // Respond to friend request
  app.patch('/api/friends/requests/:id', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      emitSync('friend_requests', 'update', { status: accept ? 'accepted' : 'rejected', respondedAt: new Date() }, eq(friendRequests.id, requestId));
      
      if (accept) {
        const [userAId, userBId] = request[0].requesterId < currentUser[0].id
          ? [request[0].requesterId, currentUser[0].id]
          : [currentUser[0].id, request[0].requesterId];
        
        await db.insert(friendships).values({
          userAId,
          userBId
        });
        emitSync('friendships', 'insert', { userAId, userBId });
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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      emitSync('game_invitations', 'insert', { senderId: currentUser[0].id, receiverId: friendId, gameId, status: 'pending', expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
      
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

      // Send push notification to the invited player (works even if offline)
      sendPushToUser(friendId, {
        title: '🎮 Invito partita MINKIARDS',
        body: `${currentUser[0].username} ti ha invitato in una partita! Codice: ${gameId.replace('room-', '')}`,
        url: `/?gameId=${gameId}`,
        tag: `game-invite-${gameId}`
      }).catch(() => {});

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
        requiresApproval: game.requiresApproval,
        creatorSocketId: game.creatorSocketId,
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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const tips = await db.select().from(trainingTips);
      res.json(tips);
    } catch (error) {
      console.error('Error fetching training tips:', error);
      res.json([]);
    }
  });

  app.post('/api/training-tips', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      
      if (!currentUser.length || !currentUser[0].isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const { cardName, cardType, tipTitle, tipContent } = req.body;
      
      const [newTip] = await db.insert(trainingTips).values({
        cardName,
        cardType,
        tipTitle,
        tipContent
      }).returning();
      
      emitSync('training_tips', 'insert', { cardName, cardType, tipTitle, tipContent });
      res.json(newTip);
    } catch (error) {
      console.error('Error creating training tip:', error);
      res.status(500).json({ error: 'Failed to create tip' });
    }
  });

  app.put('/api/training-tips/:id', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      
      if (!currentUser.length || !currentUser[0].isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const tipId = parseInt(req.params.id);
      const { tipTitle, tipContent } = req.body;
      
      const [updatedTip] = await db.update(trainingTips)
        .set({ tipTitle, tipContent, updatedAt: new Date() })
        .where(eq(trainingTips.id, tipId))
        .returning();
      
      emitSync('training_tips', 'update', { tipTitle, tipContent, updatedAt: new Date() }, eq(trainingTips.id, tipId));
      res.json(updatedTip);
    } catch (error) {
      console.error('Error updating training tip:', error);
      res.status(500).json({ error: 'Failed to update tip' });
    }
  });

  app.delete('/api/training-tips/:id', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      
      if (!currentUser.length || !currentUser[0].isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const tipId = parseInt(req.params.id);
      await db.delete(trainingTips).where(eq(trainingTips.id, tipId));
      emitSync('training_tips', 'delete', {}, eq(trainingTips.id, tipId));
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting training tip:', error);
      res.status(500).json({ error: 'Failed to delete tip' });
    }
  });

  // ============ TUTORIAL STEPS API ============
  app.get('/api/tutorial-steps', async (req, res) => {
    try {
      const steps = jsonStorage.tutorialSteps.getActive();
      res.json({ success: true, steps });
    } catch (error) {
      console.error('Error fetching tutorial steps:', error);
      res.json({ success: true, steps: [] });
    }
  });

  app.post('/api/tutorial-steps', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      
      if (!currentUser.length || !currentUser[0].isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const { stepId, trigger, title, content, sortOrder, isActive } = req.body;
      
      const newStep = jsonStorage.tutorialSteps.create({
        stepId,
        trigger,
        title,
        content,
        sortOrder: sortOrder || 0,
        isActive: isActive !== false
      });
      
      emitSync('tutorial_steps', 'insert', newStep);
      res.json({ success: true, step: newStep });
    } catch (error) {
      console.error('Error creating tutorial step:', error);
      res.status(500).json({ error: 'Failed to create tutorial step' });
    }
  });

  app.put('/api/tutorial-steps/:id', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      
      if (!currentUser.length || !currentUser[0].isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const stepId = parseInt(req.params.id);
      const { trigger, title, content, sortOrder, isActive } = req.body;
      
      const updates: Record<string, any> = {};
      if (trigger !== undefined) updates.trigger = trigger;
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;
      if (isActive !== undefined) updates.isActive = isActive;
      
      const updatedStep = jsonStorage.tutorialSteps.update(stepId, updates);
      
      if (!updatedStep) {
        return res.status(404).json({ error: 'Tutorial step not found' });
      }
      
      emitSync('tutorial_steps', 'update', updates, { id: stepId });
      res.json({ success: true, step: updatedStep });
    } catch (error) {
      console.error('Error updating tutorial step:', error);
      res.status(500).json({ error: 'Failed to update tutorial step' });
    }
  });

  app.delete('/api/tutorial-steps/:id', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      
      if (!currentUser.length || !currentUser[0].isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const stepId = parseInt(req.params.id);
      const deleted = jsonStorage.tutorialSteps.delete(stepId);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Tutorial step not found' });
      }
      
      emitSync('tutorial_steps', 'delete', {}, { id: stepId });
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting tutorial step:', error);
      res.status(500).json({ error: 'Failed to delete tutorial step' });
    }
  });

  app.post('/api/tutorial-steps/initialize', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const currentUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      
      if (!currentUser.length || !currentUser[0].isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const existingSteps = jsonStorage.tutorialSteps.getAll();
      if (existingSteps.length > 0) {
        return res.json({ success: true, message: 'Steps already initialized', count: existingSteps.length });
      }
      
      const defaultSteps = [
        { stepId: 'welcome', trigger: 'game_start', title: 'Benvenuto in MINKIARDS!', content: 'Questa è una partita di allenamento. Ti guiderò passo passo per imparare a giocare. Clicca "Avanti" per continuare.', sortOrder: 0, isActive: true },
        { stepId: 'deck_overview', trigger: 'game_start', title: 'I Mazzi di Carte', content: 'Hai 4 mazzi: PERSONAGGI (rosso), MOSSE (blu), BONUS (verde) e SPECIALI (viola). Ogni mazzo ha un ruolo diverso nel gioco.', sortOrder: 1, isActive: true },
        { stepId: 'draw_card', trigger: 'game_start', title: 'Pescare le Carte', content: 'Clicca su un mazzo per pescare una carta. Inizia pescando una carta PERSONAGGI - sono i tuoi combattenti!', sortOrder: 2, isActive: true },
        { stepId: 'play_character', trigger: 'card_drawn', title: 'Giocare un Personaggio', content: 'Ottimo! Hai pescato una carta. Ora clicca sulla carta nella tua mano e poi su uno slot vuoto del campo per posizionarla.', sortOrder: 3, isActive: true },
        { stepId: 'character_stats', trigger: 'character_played', title: 'Statistiche Personaggio', content: 'Ogni personaggio ha PTI (punti vita) e Stelle (potenza). Quando i PTI arrivano a 0, il personaggio muore.', sortOrder: 4, isActive: true },
        { stepId: 'mosse_attack', trigger: 'character_played', title: 'Usare le MOSSE', content: 'Pesca una carta MOSSE per attaccare! Seleziona la MOSSA, poi il tuo personaggio, infine il bersaglio nemico.', sortOrder: 5, isActive: true },
        { stepId: 'bonus_cards', trigger: 'mosse_played', title: 'Carte BONUS', content: 'Le carte BONUS potenziano i tuoi personaggi. Usale strategicamente per aumentare PTI o stelle!', sortOrder: 6, isActive: true },
        { stepId: 'end_turn', trigger: 'bonus_played', title: 'Fine del Turno', content: 'Quando hai finito, clicca "FINE TURNO" per passare al prossimo giocatore.', sortOrder: 7, isActive: true },
        { stepId: 'victory', trigger: 'turn_ended', title: 'Obiettivo', content: 'Elimina tutti i personaggi avversari per vincere! Buona fortuna!', sortOrder: 8, isActive: true }
      ];
      
      for (const step of defaultSteps) {
        jsonStorage.tutorialSteps.create(step);
        emitSync('tutorial_steps', 'insert', step);
      }
      
      res.json({ success: true, message: 'Tutorial steps initialized', count: defaultSteps.length });
    } catch (error) {
      console.error('Error initializing tutorial steps:', error);
      res.status(500).json({ error: 'Failed to initialize tutorial steps' });
    }
  });

  // ============ PROFILE UPDATE API ============
  app.put('/api/auth/update-profile', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const { username, avatar } = req.body;
      
      const updates: Record<string, any> = {};
      if (username) updates.username = username;
      if (avatar) updates.avatar = avatar;
      
      const [updatedUser] = await db.update(users)
        .set(updates)
        .where(eq(users.email, user.email))
        .returning();
      
      emitSync('users', 'update', updates, eq(users.email, user.email));
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  app.put('/api/auth/change-password', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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
      emitSync('users', 'update', { password: hashedPassword }, eq(users.email, user.email));
      
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
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

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

  // ============ USER SEARCH API ============
  app.get('/api/search-users', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const query = req.query.query as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }
      
      const results = await db.select({
        id: users.id,
        username: users.username,
        avatar: users.avatar
      })
      .from(users)
      .where(ilike(users.username, `%${query}%`))
      .limit(10);
      
      res.json(results);
    } catch (error) {
      console.error('Error searching users:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  });

  // ============ PRIVATE MESSAGING API ============
  
  // Get all conversations for a user
  app.get('/api/messages/conversations', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const [currentUser] = await db.select().from(users).where(eq(users.email, user.email));
      
      if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const userConversations = await db.select()
        .from(conversations)
        .where(or(
          eq(conversations.participant1Id, currentUser.id),
          eq(conversations.participant2Id, currentUser.id)
        ))
        .orderBy(desc(conversations.lastMessageAt));
      
      // Get participant info and unread counts for each conversation
      const conversationsWithDetails = await Promise.all(userConversations.map(async (conv) => {
        const otherUserId = conv.participant1Id === currentUser.id ? conv.participant2Id : conv.participant1Id;
        const [otherUser] = await db.select().from(users).where(eq(users.id, otherUserId));
        
        const unreadCount = await db.select({ count: sql<number>`count(*)` })
          .from(privateMessages)
          .where(and(
            eq(privateMessages.conversationId, conv.id),
            ne(privateMessages.senderId, currentUser.id),
            eq(privateMessages.isRead, false)
          ));
        
        const [lastMessage] = await db.select()
          .from(privateMessages)
          .where(eq(privateMessages.conversationId, conv.id))
          .orderBy(desc(privateMessages.createdAt))
          .limit(1);
        
        return {
          ...conv,
          otherUser: otherUser ? { id: otherUser.id, username: otherUser.username, avatar: otherUser.avatar } : null,
          unreadCount: Number(unreadCount[0]?.count || 0),
          lastMessage: lastMessage || null
        };
      }));
      
      res.json(conversationsWithDetails);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });
  
  // Get messages for a specific conversation
  app.get('/api/messages/conversation/:conversationId', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const [currentUser] = await db.select().from(users).where(eq(users.email, user.email));
      const conversationId = parseInt(req.params.conversationId);
      
      if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Verify user is part of this conversation
      const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
      if (!conv || (conv.participant1Id !== currentUser.id && conv.participant2Id !== currentUser.id)) {
        return res.status(403).json({ error: 'Not authorized to view this conversation' });
      }
      
      const messages = await db.select()
        .from(privateMessages)
        .where(eq(privateMessages.conversationId, conversationId))
        .orderBy(privateMessages.createdAt);
      
      // Mark messages as read
      await db.update(privateMessages)
        .set({ isRead: true })
        .where(and(
          eq(privateMessages.conversationId, conversationId),
          ne(privateMessages.senderId, currentUser.id)
        ));
      emitSync('private_messages', 'update', { isRead: true }, and(eq(privateMessages.conversationId, conversationId), ne(privateMessages.senderId, currentUser.id)));
      
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });
  
  // Start a new conversation or get existing one
  app.post('/api/messages/conversation', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const { recipientId } = req.body;
      const [currentUser] = await db.select().from(users).where(eq(users.email, user.email));
      
      if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      if (currentUser.id === recipientId) {
        return res.status(400).json({ error: 'Cannot message yourself' });
      }
      
      // Check if conversation already exists
      const existingConv = await db.select()
        .from(conversations)
        .where(or(
          and(eq(conversations.participant1Id, currentUser.id), eq(conversations.participant2Id, recipientId)),
          and(eq(conversations.participant1Id, recipientId), eq(conversations.participant2Id, currentUser.id))
        ))
        .limit(1);
      
      if (existingConv.length > 0) {
        return res.json(existingConv[0]);
      }
      
      // Create new conversation
      const [newConv] = await db.insert(conversations)
        .values({
          participant1Id: currentUser.id,
          participant2Id: recipientId,
          lastMessageAt: new Date()
        })
        .returning();
      
      emitSync('conversations', 'insert', { participant1Id: currentUser.id, participant2Id: recipientId, lastMessageAt: new Date() });
      res.json(newConv);
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  });
  
  // Send a message
  app.post('/api/messages/send', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const { conversationId, content } = req.body;
      const [currentUser] = await db.select().from(users).where(eq(users.email, user.email));
      
      if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Verify user is part of this conversation
      const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
      if (!conv || (conv.participant1Id !== currentUser.id && conv.participant2Id !== currentUser.id)) {
        return res.status(403).json({ error: 'Not authorized to send in this conversation' });
      }
      
      // Create message
      const [newMessage] = await db.insert(privateMessages)
        .values({
          conversationId,
          senderId: currentUser.id,
          content,
          isRead: false
        })
        .returning();
      emitSync('private_messages', 'insert', { conversationId, senderId: currentUser.id, content, isRead: false });
      
      // Update conversation last message timestamp
      await db.update(conversations)
        .set({ lastMessageAt: new Date() })
        .where(eq(conversations.id, conversationId));
      emitSync('conversations', 'update', { lastMessageAt: new Date() }, eq(conversations.id, conversationId));
      
      // Get recipient for notification
      const recipientId = conv.participant1Id === currentUser.id ? conv.participant2Id : conv.participant1Id;
      
      // Emit socket event for real-time update
      io.emit('new-private-message', {
        conversationId,
        message: newMessage,
        senderUsername: currentUser.username,
        recipientId
      });

      // Send push notification to recipient (works even if offline)
      sendPushToUser(recipientId, {
        title: `💬 Messaggio da ${currentUser.username}`,
        body: content.length > 80 ? content.substring(0, 77) + '...' : content,
        url: '/profile',
        tag: `dm-${conversationId}`
      }).catch(() => {});

      res.json(newMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });
  
  // Get unread message count
  app.get('/api/messages/unread-count', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const [currentUser] = await db.select().from(users).where(eq(users.email, user.email));
      
      if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get all conversations this user is part of
      const userConvs = await db.select()
        .from(conversations)
        .where(or(
          eq(conversations.participant1Id, currentUser.id),
          eq(conversations.participant2Id, currentUser.id)
        ));
      
      const convIds = userConvs.map(c => c.id);
      
      if (convIds.length === 0) {
        return res.json({ unreadCount: 0 });
      }
      
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(privateMessages)
        .where(and(
          inArray(privateMessages.conversationId, convIds),
          ne(privateMessages.senderId, currentUser.id),
          eq(privateMessages.isRead, false)
        ));
      
      res.json({ unreadCount: Number(result[0]?.count || 0) });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  });

  // ============ PUSH NOTIFICATIONS API ============

  // Expose VAPID public key to clients
  app.get('/api/vapid-public-key', (req, res) => {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    if (vapidPublicKey) {
      res.json({ publicKey: vapidPublicKey });
    } else {
      res.status(503).json({ error: 'VAPID not configured' });
    }
  });

  // Helper: send push notification to a specific user by userId
  async function sendPushToUser(userId: number, payload: { title: string; body: string; url?: string; tag?: string }): Promise<void> {
    if (!isDatabaseAvailable()) return;
    try {
      const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
      if (!vapidPublicKey || !vapidPrivateKey) return;
      const webpush = require('web-push');
      webpush.setVapidDetails('mailto:vadoalmaximo76@gmail.com', vapidPublicKey, vapidPrivateKey);
      const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      const jsonPayload = JSON.stringify(payload);
      for (const sub of subs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, jsonPayload);
        } catch (e: any) {
          if (e.statusCode === 410 || e.statusCode === 404) {
            // Subscription expired — remove it
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
          }
        }
      }
    } catch (e) {
      console.error('[Push] sendPushToUser error:', e);
    }
  }

  // Subscribe to push notifications
  app.post('/api/push/subscribe', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const { subscription } = req.body;
      const [currentUser] = await db.select().from(users).where(eq(users.email, user.email));
      
      if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Check if subscription already exists
      const existing = await db.select()
        .from(pushSubscriptions)
        .where(and(
          eq(pushSubscriptions.userId, currentUser.id),
          eq(pushSubscriptions.endpoint, subscription.endpoint)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        return res.json({ success: true, message: 'Already subscribed' });
      }
      
      // Save subscription
      await db.insert(pushSubscriptions).values({
        userId: currentUser.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      });
      emitSync('push_subscriptions', 'insert', { userId: currentUser.id, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error subscribing to push:', error);
      res.status(500).json({ error: 'Failed to subscribe' });
    }
  });
  
  // Unsubscribe from push notifications
  app.post('/api/push/unsubscribe', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const user = (req as any).user;
      const { endpoint } = req.body;
      const [currentUser] = await db.select().from(users).where(eq(users.email, user.email));
      
      if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      await db.delete(pushSubscriptions)
        .where(and(
          eq(pushSubscriptions.userId, currentUser.id),
          eq(pushSubscriptions.endpoint, endpoint)
        ));
      emitSync('push_subscriptions', 'delete', {}, and(eq(pushSubscriptions.userId, currentUser.id), eq(pushSubscriptions.endpoint, endpoint)));
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      res.status(500).json({ error: 'Failed to unsubscribe' });
    }
  });

  // ========== CARD VERSION & ADMIN ENDPOINTS FOR PWA ==========
  
  // Get current card version
  app.get('/api/card-version', async (req, res) => {
    try {
      const versionData = jsonStorage.cardVersion.get();
      res.json({ version: versionData?.version || 1, updatedAt: versionData?.updatedAt });
    } catch (error) {
      res.json({ version: 1 });
    }
  });

  // Get all cards for admin panel
  app.get('/api/admin/cards', authMiddleware, async (req, res) => {
    try {
      const userEmail = (req as any).user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const allCards: any[] = [];
      
      Object.entries(CARD_DATA).forEach(([type, urls]) => {
        (urls as string[]).forEach((url: string, index: number) => {
          const name = url.match(/\/([^\/]+)\.(png|jpg|jpeg|gif|webp)$/i)?.[1]?.replace(/-/g, ' ').toUpperCase() || '';
          allCards.push({
            id: `${type}-${index}`,
            type,
            name,
            frontImage: url
          });
        });
      });

      const modifications = jsonStorage.cardModifications.getAll();
      allCards.forEach(card => {
        const mod = modifications.find((m: any) => m.cardId === card.id);
        if (mod) {
          Object.assign(card, mod);
        }
      });

      res.json({ cards: allCards });
    } catch (error) {
      console.error('Error loading cards:', error);
      res.status(500).json({ error: 'Failed to load cards' });
    }
  });

  // Get all card modifications
  app.get('/api/admin/card-modifications', authMiddleware, async (req, res) => {
    try {
      const userEmail = (req as any).user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const modifications = jsonStorage.cardModifications.getAll();
      res.json({ modifications });
    } catch (error) {
      console.error('Error loading modifications:', error);
      res.status(500).json({ error: 'Failed to load modifications' });
    }
  });

  // Save card modification
  app.post('/api/admin/card-modifications', authMiddleware, async (req, res) => {
    try {
      const userEmail = (req as any).user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const modification = req.body;
      if (!modification.cardId) {
        return res.status(400).json({ error: 'Card ID required' });
      }

      jsonStorage.cardModifications.upsert(modification.cardId, modification);
      emitSync('card_modifications', 'update', modification, { originalCardId: modification.cardId });
      res.json({ success: true, modification });
    } catch (error) {
      console.error('Error saving modification:', error);
      res.status(500).json({ error: 'Failed to save modification' });
    }
  });

  // Publish card update (increment version and notify all users)
  app.post('/api/admin/publish-card-update', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        return res.status(503).json({ success: false, error: "Database non disponibile in modalità offline" });
      }

      const userEmail = (req as any).user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { note } = req.body;
      const currentVersion = jsonStorage.cardVersion.get()?.version || 1;
      const newVersion = currentVersion + 1;
      
      jsonStorage.cardVersion.set({
        version: newVersion,
        updatedAt: new Date().toISOString(),
        note: note || ''
      });

      // Send push notification to all subscribed users
      const allSubscriptions = await db.select().from(pushSubscriptions);
      const webpush = require('web-push');
      
      const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
      
      if (vapidPublicKey && vapidPrivateKey) {
        webpush.setVapidDetails(
          'mailto:vadoalmaximo76@gmail.com',
          vapidPublicKey,
          vapidPrivateKey
        );

        const payload = JSON.stringify({
          title: 'Aggiornamento Carte MINKIARDS',
          body: `Versione ${newVersion} disponibile! ${note || ''}`,
          type: 'card-update',
          url: '/',
          tag: `card-update-v${newVersion}`
        });

        let sent = 0;
        for (const sub of allSubscriptions) {
          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            }, payload);
            sent++;
          } catch (e) {
            // Subscription may be invalid, continue
          }
        }

        console.log(`[CARD UPDATE] Published v${newVersion}, notified ${sent}/${allSubscriptions.length} users`);
      }

      // Emit socket event for connected users
      io.emit('card-update-available', { version: newVersion, note });

      res.json({ success: true, newVersion, notified: allSubscriptions.length });
    } catch (error) {
      console.error('Error publishing update:', error);
      res.status(500).json({ error: 'Failed to publish update' });
    }
  });

  app.get('/api/contextual-tooltips', async (req, res) => {
    try {
      const tooltipsPath = path.join(process.cwd(), 'server', 'data', 'contextualTooltips.json');
      if (fs.existsSync(tooltipsPath)) {
        const data = JSON.parse(fs.readFileSync(tooltipsPath, 'utf-8'));
        res.json({ success: true, tooltips: data.filter((t: any) => t.isActive) });
      } else {
        res.json({ success: true, tooltips: [] });
      }
    } catch (error) {
      res.json({ success: true, tooltips: [] });
    }
  });

  app.post('/api/admin/migrate-users-bulk', authMiddleware, async (req, res) => {
    try {
      const userEmail = (req as any).user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      if (!isLegacyDbAvailable() || !legacyDb) {
        return res.status(400).json({ success: false, error: 'Legacy DB non disponibile. DATABASE_URL e EXTERNAL_DATABASE_URL sono identici o il vecchio DB non è raggiungibile.' });
      }
      if (!isDatabaseAvailable() || !db) {
        return res.status(503).json({ success: false, error: 'Database esterno non disponibile.' });
      }

      const legacyUsers = await legacyDb.select().from(users);
      let migrated = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const legacyUser of legacyUsers) {
        try {
          // Check if user already exists in external DB (by email or googleId)
          const existing = legacyUser.email
            ? await db.select().from(users).where(eq(users.email, legacyUser.email)).limit(1)
            : legacyUser.googleId
              ? await db.select().from(users).where(eq(users.googleId, legacyUser.googleId)).limit(1)
              : [];

          if (existing.length > 0) {
            skipped++;
            continue;
          }

          await db.insert(users).values({
            username: legacyUser.username,
            email: legacyUser.email,
            password: legacyUser.password,
            googleId: legacyUser.googleId,
            avatar: legacyUser.avatar,
            puntiRankiard: legacyUser.puntiRankiard,
            gamesPlayed: legacyUser.gamesPlayed,
            gamesWon: legacyUser.gamesWon,
            minutesPlayed: legacyUser.minutesPlayed,
            tutorialCompleted: legacyUser.tutorialCompleted,
            isAdmin: legacyUser.isAdmin,
          });

          migrated++;
          console.log(`[BulkMigration] ✅ Migrated user: ${legacyUser.email || legacyUser.username}`);
        } catch (userError: any) {
          const msg = `Failed to migrate ${legacyUser.email || legacyUser.username}: ${userError?.message}`;
          errors.push(msg);
          console.error(`[BulkMigration] ❌ ${msg}`);
        }
      }

      console.log(`[BulkMigration] Complete — total: ${legacyUsers.length}, migrated: ${migrated}, skipped: ${skipped}, errors: ${errors.length}`);
      res.json({ success: true, total: legacyUsers.length, migrated, skipped, errors });
    } catch (error: any) {
      console.error('[BulkMigration] Fatal error:', error);
      res.status(500).json({ success: false, error: error?.message || 'Errore interno' });
    }
  });

  app.post('/api/admin/ocr-bonus-cards', authMiddleware, async (req, res) => {
    try {
      const userEmail = (req as any).user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const { ocrAllMissingBonusCards, ocrSingleCard, saveOcrResultsToModifications, isOcrRunning } = await import('./ocrBonusCards');
      const { cardId } = req.body || {};

      if (cardId) {
        const cardDataContent = fs.readFileSync(path.join(process.cwd(), 'client/src/lib/cardData.ts'), 'utf-8');
        const bonusMatch = cardDataContent.match(/bonus:\s*\[([\s\S]*?)\]/);
        if (!bonusMatch) {
          return res.status(400).json({ success: false, error: 'Impossibile trovare le carte BONUS' });
        }
        const urls = (bonusMatch[1].match(/"https?:\/\/[^"]+"/g) || []).map((u: string) => u.replace(/"/g, ''));
        const index = parseInt(cardId.replace('bonus-', ''));
        if (isNaN(index) || index < 0 || index >= urls.length) {
          return res.status(400).json({ success: false, error: `Card ID non valido: ${cardId}` });
        }

        const result = await ocrSingleCard(cardId, urls[index]);
        if (result.success) {
          const { saved } = saveOcrResultsToModifications([result]);
          return res.json({ success: true, result, saved });
        }
        return res.json({ success: false, result });
      }

      if (isOcrRunning()) {
        return res.status(409).json({ success: false, error: 'OCR già in esecuzione. Attendere il completamento.' });
      }

      res.json({ success: true, message: 'OCR avviato in background' });

      ocrAllMissingBonusCards((done, total) => {
        console.log(`🔄 OCR Progress: ${done}/${total}`);
      }).then(({ results, successCount, failCount, needsReviewCount }) => {
        const { saved, pendingReview, skipped } = saveOcrResultsToModifications(results);
        console.log(`✅ OCR completato: ${successCount} successi, ${failCount} falliti, ${saved} salvati, ${pendingReview} da rivedere, ${skipped} saltati`);
      }).catch(err => {
        console.error('❌ OCR errore:', err);
      });
    } catch (error: any) {
      console.error('OCR endpoint error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/admin/ocr-pending-review', authMiddleware, async (req, res) => {
    try {
      const userEmail = (req as any).user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      const cardDataContent = fs.readFileSync(path.join(process.cwd(), 'client/src/lib/cardData.ts'), 'utf-8');
      const bonusMatch = cardDataContent.match(/bonus:\s*\[([\s\S]*?)\]/);
      const bonusUrls = bonusMatch ? (bonusMatch[1].match(/"https?:\/\/[^"]+"/g) || []).map((u: string) => u.replace(/"/g, '')) : [];

      const mods = jsonStorage.cardModifications.getAll();
      const pending = mods.filter((m: any) => m.ocrPendingReview === true && m.ocrText);
      res.json({ success: true, pending: pending.map((m: any) => {
        const index = parseInt((m.originalCardId || '').replace('bonus-', ''));
        const url = bonusUrls[index] || '';
        const fileName = decodeURIComponent(url.split('/').pop() || '').replace(/\.(png|jpg|jpeg|gif|webp)$/i, '').replace(/[-_]/g, ' ').trim();
        return {
          cardId: m.originalCardId,
          cardName: fileName || m.originalCardId,
          imageUrl: url,
          ocrText: m.ocrText,
          ocrConfidence: m.ocrConfidence || 0,
          currentEffect: m.effect || null,
        };
      })});
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/admin/ocr-approve', authMiddleware, async (req, res) => {
    try {
      const userEmail = (req as any).user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      const { cardId, approvedText } = req.body;
      if (!cardId) {
        return res.status(400).json({ success: false, error: 'cardId richiesto' });
      }

      const effectText = approvedText || (jsonStorage.cardModifications.getByOriginalCardId(cardId) as any)?.ocrText;
      if (!effectText) {
        return res.status(400).json({ success: false, error: 'Nessun testo OCR trovato' });
      }

      const modData: Record<string, any> = {
        effect: effectText,
        ocrPendingReview: false,
        modifiedBy: userEmail,
      };
      jsonStorage.cardModifications.upsert(cardId, modData);
      emitSync('card_modifications', 'update', { originalCardId: cardId, ...modData }, { originalCardId: cardId });

      res.json({ success: true, cardId, effect: effectText });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/admin/contextual-tooltips', authMiddleware, async (req, res) => {
    try {
      const userEmail = req.user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }
      const tooltipsPath = path.join(process.cwd(), 'server', 'data', 'contextualTooltips.json');
      if (fs.existsSync(tooltipsPath)) {
        const data = JSON.parse(fs.readFileSync(tooltipsPath, 'utf-8'));
        res.json({ success: true, tooltips: data });
      } else {
        res.json({ success: true, tooltips: [] });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to load tooltips' });
    }
  });

  app.put('/api/admin/contextual-tooltips', authMiddleware, async (req, res) => {
    try {
      const userEmail = req.user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }
      const { tooltips } = req.body;
      if (!Array.isArray(tooltips)) {
        return res.status(400).json({ success: false, error: 'Invalid data' });
      }
      const tooltipsPath = path.join(process.cwd(), 'server', 'data', 'contextualTooltips.json');
      fs.writeFileSync(tooltipsPath, JSON.stringify(tooltips, null, 2));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to save tooltips' });
    }
  });

  app.post('/api/admin/contextual-tooltips', authMiddleware, async (req, res) => {
    try {
      const userEmail = req.user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }
      const { tooltip } = req.body;
      if (!tooltip || !tooltip.id || !tooltip.trigger || !tooltip.title || !tooltip.message) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }
      const tooltipsPath = path.join(process.cwd(), 'server', 'data', 'contextualTooltips.json');
      let tooltips: any[] = [];
      if (fs.existsSync(tooltipsPath)) {
        tooltips = JSON.parse(fs.readFileSync(tooltipsPath, 'utf-8'));
      }
      const existingIndex = tooltips.findIndex((t: any) => t.id === tooltip.id);
      if (existingIndex >= 0) {
        tooltips[existingIndex] = { ...tooltips[existingIndex], ...tooltip };
      } else {
        tooltips.push(tooltip);
      }
      fs.writeFileSync(tooltipsPath, JSON.stringify(tooltips, null, 2));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to save tooltip' });
    }
  });

  app.delete('/api/admin/contextual-tooltips/:id', authMiddleware, async (req, res) => {
    try {
      const userEmail = req.user?.email;
      if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }
      const tooltipId = req.params.id;
      const tooltipsPath = path.join(process.cwd(), 'server', 'data', 'contextualTooltips.json');
      let tooltips: any[] = [];
      if (fs.existsSync(tooltipsPath)) {
        tooltips = JSON.parse(fs.readFileSync(tooltipsPath, 'utf-8'));
      }
      tooltips = tooltips.filter((t: any) => t.id !== tooltipId);
      fs.writeFileSync(tooltipsPath, JSON.stringify(tooltips, null, 2));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to delete tooltip' });
    }
  });

  // Get card update for PWA download
  app.get('/api/card-update', async (req, res) => {
    try {
      const versionData = jsonStorage.cardVersion.get();
      const modifications = jsonStorage.cardModifications.getAll();
      
      res.json({
        version: versionData?.version || 1,
        updatedAt: versionData?.updatedAt,
        note: versionData?.note,
        modifications
      });
    } catch (error) {
      console.error('Error getting card update:', error);
      res.status(500).json({ error: 'Failed to get update' });
    }
  });

  // =================== AI NARRATOR API ===================

  app.post('/api/narrator/comment', authMiddleware, async (req, res) => {
    const { eventType, eventData } = req.body;
    try {
      if (!eventType) return res.status(400).json({ error: 'Missing event type' });

      let prompt = '';
      switch (eventType) {
        case 'card_played':
          prompt = `Un giocatore di nome "${eventData.playerName}" ha giocato la carta "${eventData.cardName}" (tipo: ${eventData.cardType}) sul campo di battaglia. Genera un commento breve e drammatico in italiano come un telecronista sportivo eccitato. Massimo 2 frasi, stile Dragon Ball.`;
          break;
        case 'card_eliminated':
          prompt = `Il personaggio "${eventData.cardName}" con ${eventData.pti} PTI è stato eliminato dalla partita! Genera un commento breve e drammatico in italiano come un telecronista sportivo. Massimo 2 frasi, stile Dragon Ball.`;
          break;
        case 'player_eliminated':
          prompt = `Il giocatore "${eventData.playerName}" è stato completamente eliminato dalla partita! Ha perso tutti i suoi personaggi. Genera un commento breve e drammatico in italiano come un telecronista sportivo. Massimo 2 frasi.`;
          break;
        case 'evolution':
          prompt = `Il personaggio "${eventData.oldName}" si è evoluto in "${eventData.newName}"! Genera un commento breve ed eccitato in italiano come un telecronista sportivo. Massimo 2 frasi, stile Dragon Ball.`;
          break;
        case 'game_start':
          prompt = `La partita di MINKIARDS sta per iniziare con ${eventData.playerCount} giocatori! Genera un'introduzione breve e carica di energia in italiano come un telecronista sportivo. Massimo 2 frasi.`;
          break;
        case 'big_damage':
          prompt = `"${eventData.attackerCard}" ha inflitto ${eventData.damage} danni a "${eventData.targetCard}"! Un colpo devastante! Genera un commento breve e drammatico in italiano come un telecronista sportivo. Massimo 2 frasi, stile Dragon Ball.`;
          break;
        case 'attack':
          prompt = `"${eventData.attackerName}" di ${eventData.fromPlayer} attacca "${eventData.targetName}" di ${eventData.toPlayer} con ${eventData.damage} danni! Genera un commento breve e drammatico in italiano come un telecronista sportivo. Massimo 2 frasi, stile Dragon Ball.`;
          break;
        case 'defense_block':
          prompt = `${eventData.defenderPlayer} ha respinto l'attacco${eventData.defenseCardName ? ` usando "${eventData.defenseCardName}"` : ''}! ${eventData.message || ''} Genera un commento breve e drammatico in italiano come un telecronista sportivo che commenta una difesa spettacolare. Massimo 2 frasi, stile Dragon Ball.`;
          break;
        case 'effect_applied':
          prompt = `La carta "${eventData.cardName}" ha attivato il suo effetto${eventData.effectDescription ? `: ${eventData.effectDescription}` : ''}! Giocata da ${eventData.playerName}. Genera un commento breve e drammatico in italiano come un telecronista sportivo. Massimo 2 frasi, stile Dragon Ball.`;
          break;
        default:
          prompt = `Evento di gioco: ${eventType}. ${JSON.stringify(eventData || {})}. Genera un commento breve e drammatico in italiano come un telecronista sportivo di un gioco di carte. Massimo 2 frasi.`;
      }

      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: [
          { role: 'system', content: 'Sei un telecronista sportivo eccitato che commenta una partita di carte MINKIARDS (ispirato a Dragon Ball). Rispondi sempre in italiano con commenti brevi, drammatici e coinvolgenti. Massimo 2 frasi. Non usare hashtag.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 150,
      });

      const comment = response.choices[0]?.message?.content?.trim() || '';
      res.json({ comment });
    } catch (error: any) {
      console.error('Narrator API error:', error?.message || error);
      
      const fallbackComments: Record<string, string[]> = {
        card_played: [
          `Che mossa di ${eventData?.playerName || 'il giocatore'}! ${eventData?.cardName || 'Una carta'} scende in campo!`,
          `${eventData?.playerName || 'Il giocatore'} gioca ${eventData?.cardName || 'una carta'}! La partita si accende!`,
          `Ecco ${eventData?.cardName || 'la carta'}! ${eventData?.playerName || 'Il giocatore'} non si tira indietro!`,
          `Incredibile! ${eventData?.playerName || 'Il giocatore'} cala ${eventData?.cardName || 'una carta'} sul campo di battaglia!`,
        ],
        player_eliminated: [
          `${eventData?.playerName || 'Un giocatore'} è fuori! Eliminazione brutale!`,
          `È finita per ${eventData?.playerName || 'un giocatore'}! Che sconfitta devastante!`,
          `${eventData?.playerName || 'Il giocatore'} cade! Il campo di battaglia si fa sempre più stretto!`,
        ],
        card_eliminated: [
          `${eventData?.cardName || 'Il personaggio'} è stato distrutto! Che colpo fatale!`,
          `Addio ${eventData?.cardName || 'guerriero'}! La battaglia è stata impietosa!`,
        ],
        evolution: [
          `EVOLUZIONE! ${eventData?.oldName || 'Il personaggio'} si trasforma in ${eventData?.newName || 'una forma più potente'}!`,
          `Che potenza! L'evoluzione è completa! Nessuno può fermarlo ora!`,
        ],
        big_damage: [
          `COLPO DEVASTANTE! ${eventData?.damage || ''} danni! Che potenza incredibile!`,
          `Un attacco da ${eventData?.damage || ''} danni! Il campo trema!`,
        ],
        attack: [
          `${eventData?.attackerName || 'L\'attaccante'} scatena un attacco da ${eventData?.damage || '?'} danni contro ${eventData?.targetName || 'il bersaglio'}! Il campo trema!`,
          `Che attacco fulminante! ${eventData?.fromPlayer || 'Il giocatore'} colpisce con ${eventData?.damage || '?'} danni!`,
          `${eventData?.attackerName || 'Il guerriero'} non si trattiene! ${eventData?.damage || '?'} danni diretti a ${eventData?.targetName || 'il nemico'}!`,
        ],
        defense_block: [
          `RESPINTO! ${eventData?.defenderPlayer || 'Il difensore'} blocca l'attacco con una mossa magistrale!`,
          `Che difesa incredibile! L'attacco è stato completamente neutralizzato!`,
          `Nessuno passa! ${eventData?.defenderPlayer || 'Il giocatore'} respinge il colpo con stile!`,
        ],
        effect_applied: [
          `L'effetto di "${eventData?.cardName || 'la carta'}" si attiva! Che mossa strategica da ${eventData?.playerName || 'il giocatore'}!`,
          `EFFETTO SPECIALE! "${eventData?.cardName || 'La carta'}" scatena il suo potere sul campo!`,
          `Incredibile! L'effetto di "${eventData?.cardName || 'la carta'}" cambia le sorti della battaglia!`,
        ],
        game_start: [
          `Si parte! La battaglia di MINKIARDS ha inizio! Chi vincerà?`,
          `Benvenuti alla battaglia! I giocatori sono pronti, che vinca il migliore!`,
        ],
      };
      const comments = fallbackComments[eventType] || fallbackComments['card_played']!;
      const fallback = comments[Math.floor(Math.random() * comments.length)];
      res.json({ comment: fallback });
    }
  });

  // =================== CLOUD TTS API (Edge TTS) ===================

  const CLOUD_VOICES = [
    { name: 'it-IT-IsabellaNeural', label: 'Isabella', lang: 'it-IT', gender: 'Femminile' },
    { name: 'it-IT-DiegoNeural', label: 'Diego', lang: 'it-IT', gender: 'Maschile' },
    { name: 'it-IT-ElsaNeural', label: 'Elsa', lang: 'it-IT', gender: 'Femminile' },
    { name: 'it-IT-GiuseppeNeural', label: 'Giuseppe', lang: 'it-IT', gender: 'Maschile' },
    { name: 'it-IT-BenignoNeural', label: 'Benigno', lang: 'it-IT', gender: 'Maschile' },
    { name: 'it-IT-CalimeroNeural', label: 'Calimero', lang: 'it-IT', gender: 'Maschile' },
    { name: 'it-IT-CataldoNeural', label: 'Cataldo', lang: 'it-IT', gender: 'Maschile' },
    { name: 'it-IT-FabiolaNeural', label: 'Fabiola', lang: 'it-IT', gender: 'Femminile' },
    { name: 'it-IT-FiammaNeural', label: 'Fiamma', lang: 'it-IT', gender: 'Femminile' },
    { name: 'it-IT-GianniNeural', label: 'Gianni', lang: 'it-IT', gender: 'Maschile' },
    { name: 'it-IT-ImeldaNeural', label: 'Imelda', lang: 'it-IT', gender: 'Femminile' },
    { name: 'it-IT-IrmaNeural', label: 'Irma', lang: 'it-IT', gender: 'Femminile' },
    { name: 'it-IT-LisandroNeural', label: 'Lisandro', lang: 'it-IT', gender: 'Maschile' },
    { name: 'it-IT-PalmiraNeural', label: 'Palmira', lang: 'it-IT', gender: 'Femminile' },
    { name: 'it-IT-PierinaNeural', label: 'Pierina', lang: 'it-IT', gender: 'Femminile' },
    { name: 'it-IT-RinaldoNeural', label: 'Rinaldo', lang: 'it-IT', gender: 'Maschile' },
    { name: 'en-US-AriaNeural', label: 'Aria (EN)', lang: 'en-US', gender: 'Female' },
    { name: 'en-US-GuyNeural', label: 'Guy (EN)', lang: 'en-US', gender: 'Male' },
    { name: 'en-GB-SoniaNeural', label: 'Sonia (EN-GB)', lang: 'en-GB', gender: 'Female' },
    { name: 'es-ES-ElviraNeural', label: 'Elvira (ES)', lang: 'es-ES', gender: 'Female' },
    { name: 'fr-FR-DeniseNeural', label: 'Denise (FR)', lang: 'fr-FR', gender: 'Female' },
    { name: 'de-DE-KatjaNeural', label: 'Katja (DE)', lang: 'de-DE', gender: 'Female' },
    { name: 'ja-JP-NanamiNeural', label: 'Nanami (JP)', lang: 'ja-JP', gender: 'Female' },
  ];

  app.get('/api/tts/voices', (_req, res) => {
    res.json(CLOUD_VOICES);
  });

  app.post('/api/tts/speak', async (req, res) => {
    try {
      const { text, voice } = req.body;
      if (!text || !voice) return res.status(400).json({ error: 'Missing text or voice' });
      if (text.length > 500) return res.status(400).json({ error: 'Text too long (max 500 chars)' });

      const validVoice = CLOUD_VOICES.find(v => v.name === voice);
      if (!validVoice) return res.status(400).json({ error: 'Invalid voice name' });

      const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

      const { audioStream } = await tts.toStream(text);

      const chunks: Buffer[] = [];
      let responded = false;
      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      const finalize = () => {
        if (responded) return;
        responded = true;
        const audioBuffer = Buffer.concat(chunks);
        if (audioBuffer.length < 100) {
          console.error('Edge TTS: empty or too small audio output for voice', voice);
          res.status(500).json({ error: 'TTS produced no audio' });
          return;
        }
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.length.toString(),
          'Cache-Control': 'public, max-age=3600',
        });
        res.send(audioBuffer);
      };
      audioStream.on('end', finalize);
      audioStream.on('close', finalize);
      audioStream.on('error', (err: any) => {
        if (responded) return;
        responded = true;
        console.error('Edge TTS stream error:', err?.message || err);
        res.status(500).json({ error: 'TTS generation failed' });
      });
    } catch (error: any) {
      console.error('Edge TTS error:', error?.message || error);
      res.status(500).json({ error: 'TTS service unavailable' });
    }
  });

  // =================== CARD COLLECTION API ===================

  // Get user's card collection
  app.get('/api/collection', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) return res.json([]);
      const userId = (req as any).user.userId;
      const collection = await db.select().from(cardCollection).where(eq(cardCollection.userId, userId));
      res.json(collection);
    } catch (error) {
      console.error('Error fetching collection:', error);
      res.status(500).json({ error: 'Failed to fetch collection' });
    }
  });

  // Track a card drawn/played (called from game events)
  app.post('/api/collection/track', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) return res.json({ success: true });
      const userId = (req as any).user.userId;
      const { cardName, cardDeckType, cardImageUrl } = req.body;
      if (!cardName || !cardDeckType) return res.status(400).json({ error: 'Missing card data' });

      const existing = await db.select().from(cardCollection)
        .where(and(eq(cardCollection.userId, userId), eq(cardCollection.cardName, cardName), eq(cardCollection.cardDeckType, cardDeckType)));

      if (existing.length > 0) {
        await db.update(cardCollection)
          .set({ timesDrawn: sql`${cardCollection.timesDrawn} + 1`, lastDrawnAt: new Date(), cardImageUrl: cardImageUrl || existing[0].cardImageUrl })
          .where(eq(cardCollection.id, existing[0].id));
        emitSync('card_collection', 'update', { lastDrawnAt: new Date(), cardImageUrl: cardImageUrl || existing[0].cardImageUrl }, eq(cardCollection.id, existing[0].id));
      } else {
        await db.insert(cardCollection).values({ userId, cardName, cardDeckType, cardImageUrl: cardImageUrl || null, timesDrawn: 1 });
        emitSync('card_collection', 'insert', { userId, cardName, cardDeckType, cardImageUrl: cardImageUrl || null, timesDrawn: 1 });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking collection:', error);
      res.status(500).json({ error: 'Failed to track card' });
    }
  });

  // Get collection stats
  app.get('/api/collection/stats', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) return res.json({ total: 0, byType: {}, badges: [] });
      const userId = (req as any).user.userId;
      const collection = await db.select().from(cardCollection).where(eq(cardCollection.userId, userId));

      const totalCards = Object.values(CARD_DATA).flat().length;
      const byType: Record<string, { collected: number; total: number }> = {};
      for (const [deckType, cards] of Object.entries(CARD_DATA)) {
        const collectedInType = collection.filter(c => c.cardDeckType === deckType).length;
        byType[deckType] = { collected: collectedInType, total: cards.length };
      }

      const badges: string[] = [];
      const collectedCount = collection.length;
      if (collectedCount >= 10) badges.push('collector_10');
      if (collectedCount >= 50) badges.push('collector_50');
      if (collectedCount >= 100) badges.push('collector_100');
      if (collectedCount >= 200) badges.push('collector_200');
      for (const [deckType, stats] of Object.entries(byType)) {
        if (stats.collected === stats.total && stats.total > 0) {
          badges.push(`complete_${deckType}`);
        }
      }
      const completionPercent = totalCards > 0 ? Math.round((collectedCount / totalCards) * 100) : 0;

      res.json({ total: collectedCount, totalCards, completionPercent, byType, badges });
    } catch (error) {
      console.error('Error fetching collection stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // === FREESOUND API ROUTES ===
  app.get('/api/freesound/search', async (req, res) => {
    try {
      const { searchSounds } = await import('./freesound');
      const query = req.query.q as string;
      if (!query) return res.status(400).json({ error: 'Query parameter q is required' });
      const sort = (req.query.sort as any) || 'rating_desc';
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const results = await searchSounds(query, { pageSize, sort });
      res.json(results);
    } catch (error) {
      console.error('Freesound search error:', error);
      res.status(500).json({ error: 'Failed to search sounds' });
    }
  });

  app.get('/api/freesound/game-sound/:category', async (req, res) => {
    try {
      const { getGameSound } = await import('./freesound');
      const category = req.params.category as any;
      const url = await getGameSound(category);
      res.json({ url });
    } catch (error) {
      console.error('Freesound game-sound error:', error);
      res.status(500).json({ error: 'Failed to get game sound' });
    }
  });

  // === CLOUDINARY CLOUD NAME ROUTE (fast, no redirect) ===
  app.get('/api/cloudinary-cloud-name', (req, res) => {
    res.json({ cloudName: process.env.CLOUDINARY_CLOUD_NAME || null });
  });

  // === CLOUDINARY IMAGE OPTIMIZATION ROUTE ===
  app.get('/api/optimize-image', (req, res) => {
    try {
      const url = req.query.url as string;
      const size = (req.query.size as string) || 'card';
      if (!url) return res.status(400).json({ error: 'URL parameter is required' });
      if (!isCloudinaryConfigured()) return res.json({ optimized: url });
      const optimized = getOptimizedCardUrl(url, size as any);
      res.json({ optimized });
    } catch (error) {
      res.json({ optimized: req.query.url });
    }
  });

  // === REDIS-ENHANCED LEADERBOARD ROUTES ===
  app.get('/api/redis-leaderboard/:name', async (req, res) => {
    try {
      const { getLeaderboard, isRedisConfigured } = await import('./redis');
      if (!isRedisConfigured()) return res.json({ success: false, error: 'Redis not configured' });
      const limit = parseInt(req.query.limit as string) || 50;
      const leaderboard = await getLeaderboard(req.params.name, limit);
      res.json({ success: true, leaderboard });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
    }
  });

  app.post('/api/redis-leaderboard/:name', async (req, res) => {
    try {
      const { updateLeaderboard, isRedisConfigured } = await import('./redis');
      if (!isRedisConfigured()) return res.json({ success: false });
      const { playerName, score } = req.body;
      if (!playerName || score === undefined) return res.status(400).json({ error: 'playerName and score required' });
      await updateLeaderboard(req.params.name, playerName, score);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to update leaderboard' });
    }
  });

  app.get('/api/online-count', async (_req, res) => {
    try {
      const { getOnlinePlayerCount, isRedisConfigured } = await import('./redis');
      if (!isRedisConfigured()) return res.json({ count: null });
      const count = await getOnlinePlayerCount();
      res.json({ count });
    } catch (error) {
      res.json({ count: null });
    }
  });

  // ===== DRAFT MODE API =====

  // Helper: get or create user's draft credits record
  async function getOrCreateDraftCredits(userId: number) {
    const existing = await db.select().from(userDraftCredits).where(eq(userDraftCredits.userId, userId)).limit(1);
    if (existing.length > 0) return existing[0];
    const [newRecord] = await db.insert(userDraftCredits).values({ userId, freeCredits: 500, paidCredits: 0 }).returning();
    return newRecord;
  }

  // GET /api/draft/status - credits + deck summary
  app.get('/api/draft/status', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) return res.status(503).json({ error: 'DB non disponibile' });
      const user = (req as any).user;
      const [currentUser] = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser) return res.status(404).json({ error: 'User not found' });
      const credits = await getOrCreateDraftCredits(currentUser.id);
      const deckRows = await db.select().from(draftDecks).where(eq(draftDecks.userId, currentUser.id)).limit(1);
      const deck = deckRows[0] || null;
      res.json({
        userId: currentUser.id,
        freeCredits: credits.freeCredits,
        paidCredits: credits.paidCredits,
        totalCredits: credits.freeCredits + credits.paidCredits,
        puntiRankiard: currentUser.puntiRankiard,
        deck: deck ? {
          personaggiCount: (deck.personaggiCards as string[]).length,
          mosseCount: (deck.mosseCards as string[]).length,
          bonusCount: (deck.bonusCards as string[]).length,
          isComplete: deck.isComplete,
          totalCostSpent: deck.totalCostSpent,
          savedAt: deck.savedAt,
        } : null
      });
    } catch (error) {
      res.status(500).json({ error: 'Errore nel recupero stato draft' });
    }
  });

  // GET /api/draft/deck - get user's full draft deck
  app.get('/api/draft/deck', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) return res.status(503).json({ error: 'DB non disponibile' });
      const user = (req as any).user;
      const [currentUser] = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser) return res.status(404).json({ error: 'User not found' });
      const deckRows = await db.select().from(draftDecks).where(eq(draftDecks.userId, currentUser.id)).limit(1);
      if (!deckRows.length) return res.json({ personaggiCards: [], mosseCards: [], bonusCards: [], isComplete: false, totalCostSpent: 0 });
      res.json(deckRows[0]);
    } catch (error) {
      res.status(500).json({ error: 'Errore nel recupero mazzo draft' });
    }
  });

  // PUT /api/draft/deck - save user's draft deck
  app.put('/api/draft/deck', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) return res.status(503).json({ error: 'DB non disponibile' });
      const user = (req as any).user;
      const [currentUser] = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser) return res.status(404).json({ error: 'User not found' });
      const { personaggiCards, mosseCards, bonusCards } = req.body;
      if (!Array.isArray(personaggiCards) || !Array.isArray(mosseCards) || !Array.isArray(bonusCards)) {
        return res.status(400).json({ error: 'Formato mazzo non valido' });
      }
      const isComplete = personaggiCards.length >= 33 && mosseCards.length >= 33 && bonusCards.length >= 33;
      // Calculate total cost: base cards use cardModifications, custom cards use customCards table
      const allCardIds = [...personaggiCards, ...mosseCards, ...bonusCards];
      const allMods = jsonStorage.cardModifications.getAll();
      const costMap = new Map(allMods.map((m: any) => [m.originalCardId, (m.draftCost as number) || 0]));
      const allCustom = jsonStorage.customCards.getAll() as any[];
      const customCostMap = new Map(allCustom.map((c: any) => [`custom-${c.id}`, (c.draftCost as number) || 0]));
      const totalCostSpent = allCardIds.reduce((sum, id) => {
        if (id.startsWith('custom-')) return sum + (customCostMap.get(id) || 0);
        return sum + (costMap.get(id) || 0);
      }, 0);
      // Check if user has enough credits
      const credits = await getOrCreateDraftCredits(currentUser.id);
      const totalAvailable = credits.freeCredits + credits.paidCredits + currentUser.puntiRankiard;
      if (totalCostSpent > totalAvailable) {
        return res.status(400).json({ error: 'Crediti insufficienti per salvare questo mazzo', totalCostSpent, totalAvailable });
      }
      // Upsert deck
      const existing = await db.select().from(draftDecks).where(eq(draftDecks.userId, currentUser.id)).limit(1);
      if (existing.length > 0) {
        await db.update(draftDecks).set({ personaggiCards, mosseCards, bonusCards, isComplete, totalCostSpent, savedAt: new Date() })
          .where(eq(draftDecks.userId, currentUser.id));
      } else {
        await db.insert(draftDecks).values({ userId: currentUser.id, personaggiCards, mosseCards, bonusCards, isComplete, totalCostSpent });
      }
      res.json({ success: true, isComplete, totalCostSpent });
    } catch (error) {
      console.error('Error saving draft deck:', error);
      res.status(500).json({ error: 'Errore nel salvataggio mazzo draft' });
    }
  });

  // GET /api/draft/cards - all cards with their draft costs
  app.get('/api/draft/cards', async (req, res) => {
    try {
      // Use jsonStorage as primary source (same as admin panel)
      const modifications = jsonStorage.cardModifications.getAll();
      const modMap = new Map(modifications.map((m: any) => [m.originalCardId, m]));

      const cards: any[] = [];
      const deckTypes = ['personaggi', 'mosse', 'bonus'] as const;

      // 1. Base game cards
      for (const deckType of deckTypes) {
        const deckUrls: string[] = (CARD_DATA as any)[deckType] || [];
        deckUrls.forEach((imageUrl: string, index: number) => {
          const cardId = `${deckType}-${index}`;
          const mod = modMap.get(cardId);

          if (mod?.isDeleted) return;

          // Extract display name from URL filename
          const urlParts = imageUrl.split('/');
          const filename = urlParts[urlParts.length - 1];
          const defaultName = decodeURIComponent(filename)
            .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
            .replace(/[-_]/g, ' ')
            .trim();

          cards.push({
            id: cardId,
            deckType,
            name: mod?.name || defaultName,
            imageUrl: mod?.imageUrl || imageUrl,
            pti: mod?.pti ?? null,
            stars: mod?.stars ?? null,
            draftCost: (mod as any)?.draftCost ?? 0,
          });
        });
      }

      // 2. Permanently created custom cards (personaggi/mosse/bonus only)
      const allCustomCards = jsonStorage.customCards.getAll();
      for (const cc of allCustomCards as any[]) {
        if (!['personaggi', 'mosse', 'bonus'].includes(cc.deckType)) continue;
        cards.push({
          id: `custom-${cc.id}`,
          deckType: cc.deckType,
          name: cc.name,
          imageUrl: cc.imageData, // base64 or URL
          pti: cc.pti ?? null,
          stars: cc.stars ?? null,
          draftCost: cc.draftCost ?? 0,
          isCustom: true,
        });
      }

      res.json(cards);
    } catch (error) {
      console.error('Error fetching draft cards:', error);
      res.status(500).json({ error: 'Errore nel recupero carte draft' });
    }
  });

  // GET /api/draft/my-purchases - get user's own purchase history
  app.get('/api/draft/my-purchases', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) return res.json([]);
      const user = (req as any).user;
      const [currentUser] = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser) return res.json([]);
      const myPurchases = await db.select().from(creditPurchases)
        .where(eq(creditPurchases.userId, currentUser.id))
        .orderBy(desc(creditPurchases.createdAt));
      res.json(myPurchases);
    } catch (error) {
      res.json([]);
    }
  });

  // POST /api/draft/purchase-credits - request credit purchase (admin must approve)
  app.post('/api/draft/purchase-credits', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) return res.status(503).json({ error: 'DB non disponibile' });
      const user = (req as any).user;
      const [currentUser] = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser) return res.status(404).json({ error: 'User not found' });
      const PACKAGES: Record<string, { credits: number; priceEurCents: number }> = {
        '100':  { credits: 100,  priceEurCents: 100 },
        '500':  { credits: 500,  priceEurCents: 500 },
        '1000': { credits: 1000, priceEurCents: 1000 },
        '1500': { credits: 1500, priceEurCents: 1200 },
        '2000': { credits: 2000, priceEurCents: 1500 },
        '5000': { credits: 5000, priceEurCents: 4000 },
      };
      const { packageId, paymentNote } = req.body;
      const pkg = PACKAGES[packageId];
      if (!pkg) return res.status(400).json({ error: 'Pacchetto non valido' });
      const [purchase] = await db.insert(creditPurchases).values({
        userId: currentUser.id,
        packageId,
        creditsAmount: pkg.credits,
        priceEur: pkg.priceEurCents,
        status: 'pending',
        paymentNote: paymentNote || null,
      }).returning();
      res.json({ success: true, purchaseId: purchase.id, message: 'Acquisto registrato. I crediti saranno aggiunti dopo approvazione admin.' });
    } catch (error) {
      res.status(500).json({ error: 'Errore nella creazione acquisto' });
    }
  });

  // GET /api/admin/draft/purchases - list all purchases (admin only)
  app.get('/api/admin/draft/purchases', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) return res.status(503).json({ error: 'DB non disponibile' });
      const user = (req as any).user;
      const [currentUser] = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser || !currentUser.isAdmin) return res.status(403).json({ error: 'Admin required' });
      const purchases = await db.select({
        id: creditPurchases.id,
        userId: creditPurchases.userId,
        packageId: creditPurchases.packageId,
        creditsAmount: creditPurchases.creditsAmount,
        priceEur: creditPurchases.priceEur,
        status: creditPurchases.status,
        paymentNote: creditPurchases.paymentNote,
        adminNote: creditPurchases.adminNote,
        createdAt: creditPurchases.createdAt,
        processedAt: creditPurchases.processedAt,
        username: users.username,
        email: users.email,
      }).from(creditPurchases).leftJoin(users, eq(creditPurchases.userId, users.id))
        .orderBy(desc(creditPurchases.createdAt));
      res.json(purchases);
    } catch (error) {
      res.status(500).json({ error: 'Errore nel recupero acquisti' });
    }
  });

  // POST /api/admin/draft/purchases/:id/approve
  app.post('/api/admin/draft/purchases/:id/approve', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) return res.status(503).json({ error: 'DB non disponibile' });
      const user = (req as any).user;
      const [currentUser] = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser || !currentUser.isAdmin) return res.status(403).json({ error: 'Admin required' });
      const purchaseId = parseInt(req.params.id);
      const [purchase] = await db.select().from(creditPurchases).where(eq(creditPurchases.id, purchaseId)).limit(1);
      if (!purchase) return res.status(404).json({ error: 'Acquisto non trovato' });
      if (purchase.status !== 'pending') return res.status(400).json({ error: 'Acquisto già processato' });
      const { adminNote } = req.body;
      // Add credits to user
      const credits = await getOrCreateDraftCredits(purchase.userId);
      await db.update(userDraftCredits).set({ paidCredits: credits.paidCredits + purchase.creditsAmount, updatedAt: new Date() })
        .where(eq(userDraftCredits.userId, purchase.userId));
      // Update purchase status
      await db.update(creditPurchases).set({ status: 'approved', adminNote: adminNote || null, processedAt: new Date() })
        .where(eq(creditPurchases.id, purchaseId));
      res.json({ success: true, message: `${purchase.creditsAmount} crediti aggiunti all'utente` });
    } catch (error) {
      res.status(500).json({ error: 'Errore nell\'approvazione acquisto' });
    }
  });

  // POST /api/admin/draft/purchases/:id/reject
  app.post('/api/admin/draft/purchases/:id/reject', authMiddleware, async (req, res) => {
    try {
      if (!isDatabaseAvailable()) return res.status(503).json({ error: 'DB non disponibile' });
      const user = (req as any).user;
      const [currentUser] = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (!currentUser || !currentUser.isAdmin) return res.status(403).json({ error: 'Admin required' });
      const purchaseId = parseInt(req.params.id);
      const { adminNote } = req.body;
      await db.update(creditPurchases).set({ status: 'rejected', adminNote: adminNote || null, processedAt: new Date() })
        .where(eq(creditPurchases.id, purchaseId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Errore nel rifiuto acquisto' });
    }
  });

  return httpServer;
}
