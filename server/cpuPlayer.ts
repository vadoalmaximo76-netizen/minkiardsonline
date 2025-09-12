import OpenAI from "openai";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { personaggi } from '../shared/schema.js';
import { eq, ilike } from 'drizzle-orm';
import { GameManager } from './gameManager.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Database connection for PERSONAGGI lookup
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

interface CardAnalysis {
  cardType: 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali' | string;
  name: string;
  points?: number;
  stars?: number;
  damage?: number;
  effect?: string;
  powers?: string | string[];
  canCounter?: boolean;
  canBeCountered?: boolean;
  powerCost?: number;
  transformations?: {
    evolution?: string;
    taroccata?: string;
    super?: string;
    supreme?: string;
  };
  // New detailed analysis fields
  pti?: number;
  baseDamage?: number;
  characterSpecific?: string;
}

interface GameAnalysis {
  myCharacter: any;
  enemyCharacters: any[];
  handCards: any[];
  fieldSituation: string;
  recommendedAction: {
    type: 'play_card' | 'switch_character' | 'attack' | 'defend' | 'buy_power';
    cardId?: string;
    target?: string;
    reasoning: string;
  };
}

export class CPUPlayer {
  private playerName: string;
  private gameId: string;
  private waitingForResponse: boolean = false;
  private currentQuestion: string = '';
  private conversationHistory: Array<{type: 'question' | 'answer', content: string, timestamp: number}> = [];
  private socketEmitter: any;
  private lastAdvice: any = null;
  private openingSequenceState: {
    phase: 'pick-initial' | 'play-character' | 'pick-replacement' | 'completed';
    pickedCards: string[];
  } = { phase: 'pick-initial', pickedCards: [] };
  
  // NEW: Turn state machine for new CPU behavior
  public turnState: {
    phase: 'draw_needed' | 'play_card' | 'execute_action' | 'turn_end';
    drawnThisTurn: boolean;
    playedThisTurn: boolean;
    executedThisTurn: boolean;
    playedCardId?: string;
    playedCardType?: string;
    needsReplacementDraw?: boolean;
    replacementDeckType?: string;
  } = { 
    phase: 'draw_needed', 
    drawnThisTurn: false, 
    playedThisTurn: false, 
    executedThisTurn: false 
  };
  
  private openaiApiKey: string | undefined;

  constructor(playerName: string, gameId: string, socketEmitter?: any) {
    this.playerName = playerName;
    this.gameId = gameId;
    this.socketEmitter = socketEmitter;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  // Reset opening sequence for new game
  resetOpeningSequence() {
    this.openingSequenceState = { 
      phase: 'pick-initial', 
      pickedCards: [] 
    };
    console.log(`CPU ${this.playerName} opening sequence reset for new game`);
  }

  // NEW: Turn state management methods
  resetTurnState() {
    this.turnState = {
      phase: 'draw_needed',
      drawnThisTurn: false,
      playedThisTurn: false,
      executedThisTurn: false
    };
    console.log(`CPU ${this.playerName} turn state reset`);
  }

  markActionExecuted(actionType: 'draw' | 'play' | 'execute', cardId?: string, cardType?: string) {
    switch (actionType) {
      case 'draw':
        this.turnState.drawnThisTurn = true;
        this.turnState.phase = 'play_card';
        break;
      case 'play':
        this.turnState.playedThisTurn = true;
        this.turnState.playedCardId = cardId;
        this.turnState.playedCardType = cardType;
        this.turnState.phase = 'execute_action';
        break;
      case 'execute':
        this.turnState.executedThisTurn = true;
        this.turnState.phase = 'turn_end';
        break;
    }
    console.log(`CPU ${this.playerName} marked ${actionType} as completed. New phase: ${this.turnState.phase}`);
  }

  // NEW: Deterministic target selection for MOSSE attacks
  pickEnemyTarget(): { cardId: string; owner: string; name: string } | null {
    // Use existing gameManager property and this.gameId
    if (!this.gameManager) {
      console.error(`CPU ${this.playerName}: No gameManager instance available for target selection`);
      return null;
    }
    const gameState = this.gameManager.getGameState(this.gameId);
    if (!gameState) return null;

    // Find all enemy characters on field
    const enemies = gameState.field.filter((card: any) => 
      (card.type === 'personaggi' || card.type === 'personaggi_speciali') && 
      card.owner !== this.playerName && 
      !card.eliminatedBy && 
      !card.faceDown
    );

    if (enemies.length === 0) return null;

    // Choose target: lowest PTI if available, else first
    let target = enemies[0];
    
    // Try to find lowest PTI target if we have metadata
    for (const enemy of enemies) {
      if (enemy.notes && enemy.notes.includes('PTI:')) {
        const ptiMatch = enemy.notes.match(/PTI:\s*(\d+)/);
        if (ptiMatch) {
          const currentPti = parseInt(ptiMatch[1]);
          
          if (target.notes && target.notes.includes('PTI:')) {
            const targetPtiMatch = target.notes.match(/PTI:\s*(\d+)/);
            if (targetPtiMatch) {
              const targetPti = parseInt(targetPtiMatch[1]);
              if (currentPti < targetPti) {
                target = enemy;
              }
            }
          } else {
            target = enemy; // Prefer enemy with known PTI
          }
        }
      }
    }

    // Extract name from frontImage URL
    let targetName = 'personaggio nemico';
    if (target.frontImage) {
      try {
        const url = new URL(target.frontImage);
        const pathname = url.pathname;
        const filename = pathname.split('/').pop() || '';
        targetName = filename.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase();
      } catch {
        targetName = 'personaggio nemico';
      }
    }

    console.log(`CPU ${this.playerName} selected target: ${target.id} (${targetName}) owned by ${target.owner}`);
    
    return {
      cardId: target.id,
      owner: target.owner,
      name: targetName
    };
  }

  canEndTurn(): boolean {
    return this.turnState.executedThisTurn && this.turnState.phase === 'turn_end';
  }

  setSocketEmitter(emitter: any) {
    this.socketEmitter = emitter;
  }
  
  // NEW: Pending order system for executing user commands
  private pendingOrder: any = null;

  get isWaitingForResponse(): boolean {
    return this.waitingForResponse;
  }

  // Detailed card analysis with MINKIARDS rules
  async analyzeCardImageDetailed(imageUrl: string, cardType: string): Promise<CardAnalysis> {
    try {
      if (!this.openaiApiKey) {
        const cardName = this.getCardNameFromUrl(imageUrl);
        const fallbackAnalysis = await this.getFallbackCardAnalysis(cardName, cardType);
        return { 
          name: cardName, 
          cardType, 
          effect: fallbackAnalysis.effect,
          pti: fallbackAnalysis.pti,
          stars: fallbackAnalysis.stars,
          powers: fallbackAnalysis.powers,
          baseDamage: fallbackAnalysis.baseDamage
        };
      }

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are an expert at reading MINKIARDS Italian trading cards. Look carefully at this card image and extract ALL visible information.

            CRITICAL READING INSTRUCTIONS:

            For PERSONAGGI cards:
            - Character NAME: Read the main title text at the top
            - PTI (Punti Totali di Impatto): Look for a NUMBER in the BOTTOM LEFT corner (typically 700-2000)  
            - STELLE (Stars): Look for STAR SYMBOLS or NUMBER in the BOTTOM RIGHT corner (typically 1-5)
            - POTERI (Powers): Read any RED or COLORED text describing special abilities
            - TRANSFORMATION: Look for colored dots (E, S, PS markers)
            - VISUAL DETAILS: Describe the character appearance to confirm identity

            For MOSSE cards:
            - MOVE NAME: Title text
            - DAMAGE VALUE: Find negative numbers (like -80, -120, -150)
            - COUNTER SYMBOLS: Green + (can counter), Red - (can be countered)  
            - CHARACTER SPECIFIC: Any character names mentioned

            For BONUS cards:
            - EFFECT NAME: Main title
            - PTI BONUS: Any +numbers for point increases
            - SPECIAL EFFECTS: Game rule changes

            IMPORTANT: Be precise with numbers! PTI and Stars are crucial for gameplay.
            If you cannot clearly see a number, estimate based on the character's apparent strength.

            Return accurate JSON with all extracted data:`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this ${cardType} card following MINKIARDS rules:`
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
        max_tokens: 500
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      return {
        name: analysis.name || this.getCardNameFromUrl(imageUrl),
        cardType,
        effect: analysis.effect || 'Standard effect',
        pti: analysis.pti || 0,
        stars: analysis.stars || 0,
        powers: Array.isArray(analysis.powers) ? analysis.powers.join(', ') : (analysis.powers || ''),
        baseDamage: analysis.baseDamage || 0,
        canCounter: analysis.canCounter || false,
        canBeCountered: analysis.canBeCountered !== false,
        characterSpecific: analysis.characterSpecific
      };

    } catch (error) {
      console.error('Error analyzing card image:', error);
      // Use intelligent fallback based on card name/URL patterns
      const cardName = this.getCardNameFromUrl(imageUrl);
      const fallbackAnalysis = await this.getFallbackCardAnalysis(cardName, cardType);
      return { 
        name: cardName, 
        cardType, 
        effect: fallbackAnalysis.effect,
        pti: fallbackAnalysis.pti,
        stars: fallbackAnalysis.stars,
        powers: fallbackAnalysis.powers,
        baseDamage: fallbackAnalysis.baseDamage
      };
    }
  }

  // Look up PERSONAGGI data from database first
  private async getPersonaggioFromDatabase(cardName: string): Promise<{ pti: number | null, stars: number | null } | null> {
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

  // Intelligent fallback analysis for when OpenAI is not available
  private async getFallbackCardAnalysis(cardName: string, cardType: string): Promise<{ effect: string, pti: number, stars: number, powers: string, baseDamage: number }> {
    const name = cardName.toLowerCase();
    
    if (cardType === 'personaggi' || cardType === 'personaggi_speciali') {
      // First check database for exact data
      const dbResult = await this.getPersonaggioFromDatabase(cardName);
      if (dbResult && (dbResult.pti !== null || dbResult.stars !== null)) {
        const pti = dbResult.pti || 1000; // Default if null
        const stars = dbResult.stars || 1; // Default if null
        return {
          effect: `Personaggio verificato dal database`,
          pti,
          stars,
          powers: 'Poteri specifici del personaggio',
          baseDamage: 0
        };
      }
      // Intelligent PERSONAGGI card analysis based on name patterns
      let pti = 1000; // Default PTI
      let stars = 1; // Default stars
      let powers = '';
      
      // Character-specific analysis based on common MINKIARDS card patterns
      if (name.includes('goku') || name.includes('vegeta') || name.includes('saiyan')) {
        pti = 1800; stars = 4; powers = 'Guerriero Saiyan';
      } else if (name.includes('superman') || name.includes('hulk') || name.includes('incredibile')) {
        pti = 2000; stars = 5; powers = 'Forza sovrumana';
      } else if (name.includes('the rock') || name.includes('rock') || name.includes('dwayne')) {
        pti = 1700; stars = 4; powers = 'Forza fisica'; 
      } else if (name.includes('batman') || (name.includes('iron') && name.includes('man'))) {
        pti = 1400; stars = 3; powers = 'Tecnologia avanzata';
      } else if (name.includes('homer') || name.includes('simpson')) {
        pti = 800; stars = 2; powers = 'Resistenza al dolore';
      } else if (name.includes('mario') || name.includes('luigi')) {
        pti = 1200; stars = 2; powers = 'Salto potenziato';
      } else if (name.includes('pikachu') || name.includes('pokemon')) {
        pti = 1000; stars = 3; powers = 'Attacco elettrico';
      } else if (name.includes('spider') && name.includes('man')) {
        pti = 1300; stars = 3; powers = 'Agilità sovrumana';
      } else if (name.includes('dragon') || name.includes('drago')) {
        pti = 2200; stars = 5; powers = 'Soffio di fuoco';
      } else if (name.includes('naruto') || name.includes('sasuke')) {
        pti = 1500; stars = 3; powers = 'Tecniche ninja';
      } else if (name.includes('king') || name.includes('re')) {
        pti = 1600; stars = 4; powers = 'Leadership';
      } else if (name.includes('warrior') || name.includes('guerriero')) {
        pti = 1400; stars = 3; powers = 'Esperienza di combattimento';
      } else if (name.includes('holly') || name.includes('terence')) {
        pti = 1300; stars = 3; powers = 'Stile western';
      } else if (name.includes('gidi') || name.includes('gideon')) {
        pti = 1100; stars = 2; powers = 'Abilità speciali';
      } else if (name.includes('emis') || name.includes('killa')) {
        pti = 1000; stars = 3; powers = 'Rap battle';
      } else if (name.includes('tony') || name.includes('tammaro')) {
        pti = 900; stars = 2; powers = 'Melodia neomelodica';
      } else {
        // Default ranges based on name characteristics
        const nameLength = name.length;
        if (nameLength > 15) {
          pti = 1600; stars = 4; // Longer names = stronger characters
        } else if (nameLength > 10) {
          pti = 1300; stars = 3;
        } else if (nameLength > 6) {
          pti = 1100; stars = 2;
        }
        powers = 'Abilità speciale';
      }
      
      return {
        effect: `Personaggio: ${powers}`,
        pti,
        stars,
        powers,
        baseDamage: 0
      };
      
    } else if (cardType === 'mosse') {
      // MOSSE card fallback
      let damage = -80; // Default damage
      
      if (name.includes('potente') || name.includes('forte') || name.includes('devastante')) {
        damage = -120;
      } else if (name.includes('leggero') || name.includes('veloce') || name.includes('rapido')) {
        damage = -50;
      } else if (name.includes('fatale') || name.includes('mortale') || name.includes('definitivo')) {
        damage = -150;
      }
      
      return {
        effect: `Mossa di attacco: ${Math.abs(damage)} danni base`,
        pti: 0,
        stars: 0,
        powers: '',
        baseDamage: damage
      };
      
    } else if (cardType === 'bonus') {
      // BONUS card fallback
      return {
        effect: 'Carta bonus: effetto speciale',
        pti: 0,
        stars: 0,
        powers: 'Potenziamento',
        baseDamage: 0
      };
    }
    
    // Generic fallback
    return {
      effect: 'Carta con effetto standard',
      pti: cardType === 'personaggi' ? 1000 : 0,
      stars: cardType === 'personaggi' ? 1 : 0,
      powers: '',
      baseDamage: 0
    };
  }

  // Analyze a card image using OpenAI Vision API
  async analyzeCardImage(imageUrl: string): Promise<CardAnalysis> {
    try {
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `You are an expert MINKIARDS card game analyzer following the official rules. Extract precise information:

PERSONAGGI CARDS:
- Points (PTI): Look for numbers in bottom left (e.g., "2800", "1500")
- Stars: Look for star symbols in bottom right (count them: ⭐⭐⭐ = 3 stars)
- Name: Character name in the header
- Powers: Red text describing special abilities
- Transformations: Colored dots with letters (E=evolution, T=taroccata, S=super, PS=supreme)

MOSSE CARDS:
- Damage value: Negative number (e.g., "-80", "-120")
- Counter indicators: + green (can counter), - red (can be countered)
- Special conditions: Look for "Per tutti" or specific character restrictions

BONUS CARDS:
- Effects: Special abilities or power-ups
- Conditions: When/how they can be used

Extract EXACT numbers and text as they appear on the card. Return JSON format only.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Read this MINKIARDS card carefully and extract ALL visible information, especially PTI and stars for characters, damage values for moves:"
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
        max_tokens: 700
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      console.log(`CPU ${this.playerName} analyzed card ${imageUrl}:`, analysis);
      return analysis;
    } catch (error) {
      console.error('Error analyzing card image:', error);
      return {
        cardType: 'personaggi',
        name: 'Unknown Card',
        points: 1000,
        stars: 1
      };
    }
  }

  // Auto-update card notes when CPU plays a PERSONAGGI card
  async autoUpdateCardNotes(cardId: string, cardImage: string, gameState: any) {
    try {
      console.log(`CPU ${this.playerName} auto-updating notes for card ${cardId}`);
      
      // Analyze the card image to extract PTI and stars
      const cardAnalysis = await this.analyzeCardImage(cardImage);
      
      if (cardAnalysis.cardType === 'personaggi' || cardAnalysis.cardType === 'personaggi_speciali') {
        const pti = cardAnalysis.points || 1000;
        const stars = cardAnalysis.stars || 1;
        const powers = cardAnalysis.effect || cardAnalysis.powers || '';
        
        // Create comprehensive notes
        const notes = `PTI: ${pti} | Stelle: ${stars}` + (powers ? ` | Poteri: ${powers}` : '');
        
        console.log(`CPU ${this.playerName} setting notes for ${cardAnalysis.name}: ${notes}`);
        
        // Update the card notes on the server
        if (this.socketEmitter) {
          this.socketEmitter.emit('update-card-notes', {
            cardId: cardId,
            notes: notes,
            playerName: this.playerName
          });
        }
        
        // Send chat message about the analysis
        this.sendChatMessage(`Ho analizzato ${cardAnalysis.name}: ${pti} PTI, ${stars} stelle!`);
        
        return { pti, stars, powers, name: cardAnalysis.name };
      }
    } catch (error) {
      console.error(`Error auto-updating notes for CPU ${this.playerName}:`, error);
    }
    
    return null;
  }

  // Calculate and apply damage when a character is attacked
  async handleCharacterAttacked(attackedCardId: string, damageValue: number, attackerStars: number, gameState: any) {
    try {
      console.log(`CPU ${this.playerName} handling character attack: card ${attackedCardId}, damage ${damageValue}, attacker stars ${attackerStars}`);
      
      // Find the attacked card in the field
      const attackedCard = gameState.field.find((card: any) => card.id === attackedCardId && card.owner === this.playerName);
      
      if (!attackedCard) {
        console.log(`CPU ${this.playerName}: Attacked card not found or not owned by CPU`);
        return;
      }
      
      // Calculate total damage: damage value × attacker stars
      const totalDamage = Math.abs(damageValue) * attackerStars;
      
      // Parse current PTI and stars from notes or use defaults
      let currentPTI = 1000; // default
      let attackedStars = 1; // default stars for damage calculation
      if (attackedCard.notes || attackedCard.text) {
        const notes = attackedCard.notes || attackedCard.text || '';
        const ptiMatch = notes.match(/PTI:\s*(\d+)/);
        const starsMatch = notes.match(/Stelle:\s*(\d+)/);
        
        if (ptiMatch) {
          currentPTI = parseInt(ptiMatch[1]);
        }
        if (starsMatch) {
          attackedStars = parseInt(starsMatch[1]);
        }
      }
      
      // Calculate new PTI after damage
      const newPTI = Math.max(0, currentPTI - totalDamage);
      
      console.log(`CPU ${this.playerName}: ${attackedCard.id} PTI: ${currentPTI} → ${newPTI} (damage: ${totalDamage})`);
      
      // Update the notes with new PTI, preserving stars and powers
      let updatedNotes = (attackedCard.notes || attackedCard.text || '').replace(/PTI:\s*\d+/, `PTI: ${newPTI}`);
      
      // If notes don't exist, create them with stars
      if (!updatedNotes.includes('Stelle:')) {
        updatedNotes = updatedNotes.replace(/PTI:\s*\d+/, `PTI: ${newPTI} | Stelle: ${attackedStars}`);
      }
      
      // Send update to server
      if (this.socketEmitter) {
        this.socketEmitter.emit('update-card-notes', {
          cardId: attackedCardId,
          notes: updatedNotes,
          playerName: this.playerName
        });
      }
      
      // Send chat message about the damage
      if (newPTI > 0) {
        this.sendChatMessage(`Il mio personaggio ha subito ${totalDamage} danni! PTI rimanenti: ${newPTI}`);
      } else {
        this.sendChatMessage(`Nooo! Il mio personaggio è stato eliminato con ${totalDamage} danni!`);
      }
      
      return { newPTI, totalDamage, eliminated: newPTI === 0 };
      
    } catch (error) {
      console.error(`Error handling character attack for CPU ${this.playerName}:`, error);
    }
    
    return null;
  }

  // Monitor and analyze move cards to extract damage values  
  async analyzeMoveCard(cardImage: string) {
    try {
      const analysis = await this.analyzeCardImage(cardImage);
      
      if (analysis.cardType === 'mosse') {
        const damage = analysis.damage || 0;
        console.log(`CPU ${this.playerName} analyzed move card: ${analysis.name}, damage: ${damage}`);
        return { name: analysis.name, damage, canCounter: analysis.canCounter, canBeCountered: analysis.canBeCountered };
      }
    } catch (error) {
      console.error(`Error analyzing move card for CPU ${this.playerName}:`, error);
    }
    
    return null;
  }

  // Reference to game manager for checking used cards
  private gameManager?: any;
  
  setGameManager(gameManager: any) {
    this.gameManager = gameManager;
  }

  // Analyze current game state and decide next move with conversation context
  async analyzeGameState(gameState: any): Promise<GameAnalysis> {
    try {
      // Get CPU player's information
      const cpuPlayer = gameState.players[this.playerName];
      if (!cpuPlayer) {
        throw new Error('CPU player not found in game state');
      }

      // Find CPU's character on the field
      const myCharacter = gameState.field.find((card: any) => card.owner === this.playerName);
      
      // Find enemy characters on the field
      const enemyCharacters = gameState.field.filter((card: any) => 
        card.owner !== this.playerName && card.type === 'personaggi'
      );

      // Analyze hand cards with detailed MINKIARDS rules
      const handAnalyses = await Promise.all(
        cpuPlayer.hand.map((card: any) => this.analyzeCardImageDetailed(card.frontImage, card.type))
      );

      // Get conversation context for enhanced decision making
      const conversationContext = this.getConversationContext();

      // Analyze field cards for strategic planning
      const myFieldCards = gameState.field.filter((c: any) => c.owner === this.playerName);
      const fieldAnalyses = await Promise.all(
        myFieldCards.map((card: any) => this.analyzeCardImageDetailed(card.frontImage, card.type))
      );

      // Create detailed game situation description
      const situationDesc = `
        MY CHARACTER: ${myCharacter ? `${this.getCardNameFromUrl(myCharacter.frontImage)} (PTI: ${myCharacter.text || 'unknown'}, Stars: unknown)` : 'NONE - MUST PLAY ONE!'}
        ENEMY CHARACTERS: ${enemyCharacters.map((c: any) => `${this.getCardNameFromUrl(c.frontImage)} (Owner: ${c.owner})`).join(', ')}
        MY HAND: ${handAnalyses.map(a => `${a.name} (${a.cardType}) - ${a.effect || 'Standard effect'}`).join(', ')}
        MY FIELD CARDS: ${fieldAnalyses.map(a => `${a.name} (${a.cardType})`).join(', ')}
        TOTAL CARDS ON FIELD: ${gameState.field.length}
        CONVERSATION CONTEXT: ${conversationContext || 'Nessuna conversazione precedente'}
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are an expert MINKIARDS player that can communicate in Italian. Based on the complete game rules:
            
            CORE RULES:
            - WITHOUT a character (personaggio) on field, you CANNOT perform any actions
            - Goal: Eliminate enemy characters by reducing their PTI (points) to 0
            - ONE card per turn OR character substitution (not both)
            - When placing a character, immediately draw another of same type
            
            CHARACTERS (PERSONAGGI):
            - PTI (points) = character's life/health
            - Stars (stelle) = damage multiplier for moves
            - Powers can be bought from "Banca dei poteri" by spending PTI
            - Multiple powers cost exponentially more (2x, 3x, 4x, etc.)
            - Can substitute field character with hand character (costs your turn)
            
            MOVES (MOSSE):
            - Damage = base value × attacker's stars
            - Cannot use moves if character has 0 stars
            - Can counter/block attacks with equal/higher damage moves
            - After use, card returns to bottom of deck
            - Must announce target before using
            
            BONUS CARDS:
            - Can strengthen your characters (+PTI, +powers, etc.)
            - Can change game dynamics (shields, special effects)
            - Apply only to your own characters unless stated otherwise
            
            CARD USAGE SEQUENCE:
            1. Play card on field first
            2. Use the card for its effect
            3. Card returns to its deck
            4. Automatically draw replacement of same type
            
            STRATEGIC CONSIDERATIONS:
            - Balance PTI spending on powers vs survival
            - Counter-attack opportunities with green (+) moves
            - Timing of shields and defensive bonuses
            - Character switching for better stats/powers
            
            Consider previous conversation with human players to adapt your strategy.
            If humans have given you specific instructions or clarifications, prioritize those.
            
            Analyze the current situation and recommend the best action. Consider:
            1. Do I have a character on field? If not, MUST play one immediately
            2. Can I deal lethal damage to eliminate an enemy character?
            3. Should I strengthen my character with bonus cards (+PTI)?
            4. Should I buy powers from "Banca dei poteri" using PTI?
            5. Do I need defensive measures (shields, blocks)?
            6. Should I switch to a stronger character from hand?
            7. Can I counter-attack with higher damage moves?
            8. Are there special card effects I should utilize?
            9. Any specific human guidance from previous conversation?
            
            Remember: Only ONE action per turn - either play/use a card OR switch characters.
            All moves must be calculated: base damage × my character's stars.
            
            Respond with JSON containing your detailed analysis and recommended action.`
          },
          {
            role: "user",
            content: `Current game state: ${situationDesc}
            
            Available actions:
            - Play a card from hand
            - Switch character (if I have one in hand)
            - Buy a power (if my character has enough points)
            
            What should I do and why? Consider any previous human guidance.`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        myCharacter,
        enemyCharacters,
        handCards: cpuPlayer.hand,
        fieldSituation: situationDesc,
        recommendedAction: analysis.recommendedAction || {
          type: 'play_card',
          reasoning: 'Default action - play first available card'
        }
      };

    } catch (error) {
      console.error('Error analyzing game state:', error);
      // Fallback strategy
      return {
        myCharacter: null,
        enemyCharacters: [],
        handCards: [],
        fieldSituation: 'Error analyzing game',
        recommendedAction: {
          type: 'play_card',
          reasoning: 'Fallback action due to analysis error'
        }
      };
    }
  }

  // Execute the decided action
  async executeAction(gameState: any, action: GameAnalysis['recommendedAction']) {
    const cpuPlayer = gameState.players[this.playerName];
    if (!cpuPlayer) {
      console.log(`CPU ${this.playerName} not found in game state`);
      return null;
    }
    
    if (!cpuPlayer.hand || cpuPlayer.hand.length === 0) {
      console.log(`CPU ${this.playerName} has no cards in hand`);
      return null;
    }

    console.log(`CPU ${this.playerName} executing action: ${action.type}, has ${cpuPlayer.hand.length} cards`);

    switch (action.type) {
      case 'play_card':
        // Play the specified card or the first available card
        let cardToPlay = null;
        
        if (action.cardId) {
          cardToPlay = cpuPlayer.hand.find((c: any) => c.id === action.cardId);
        }
        
        if (!cardToPlay && cpuPlayer.hand.length > 0) {
          cardToPlay = cpuPlayer.hand[0];
        }
        
        if (cardToPlay) {
          console.log(`CPU ${this.playerName} playing card: ${cardToPlay.id}`);
          
          // Auto-analyze PERSONAGGI cards when played
          if ((cardToPlay.type === 'personaggi' || cardToPlay.type === 'personaggi_speciali') && cardToPlay.frontImage) {
            // Schedule auto-update after a delay to allow the card to be played first
            setTimeout(async () => {
              await this.autoUpdateCardNotes(cardToPlay.id, cardToPlay.frontImage, gameState);
            }, 2000);
          }
          
          return {
            type: 'play-card',
            data: {
              cardId: cardToPlay.id,
              playerName: this.playerName
            }
          };
        }
        break;

      case 'attack':
        // Check if we have a MOSSE card on the field to use for attack
        const mosseOnField = gameState.field.find((c: any) => 
          c.owner === this.playerName && c.type === 'mosse'
        );
        const targetCard = gameState.field.find((c: any) => c.id === action.target);
        
        if (mosseOnField && targetCard) {
          // Check if this MOSSE card type has already been used this turn
          console.log(`CPU ${this.playerName}: Checking if MOSSE card ${mosseOnField.frontImage} has been used this turn`);
          
          if (this.gameManager && this.gameManager.hasCardTypeBeenUsed(this.gameId, mosseOnField.frontImage, this.playerName)) {
            console.log(`CPU ${this.playerName}: MOSSE card ${mosseOnField.frontImage} already used this turn, cannot attack`);
            this.sendChatMessage(`Non posso riutilizzare la stessa carta MOSSE nello stesso turno!`);
            
            // Try to play a different MOSSE card from hand instead
            const unusedMoveCard = cpuPlayer.hand.find((c: any) => 
              c.type === 'mosse' && 
              (!this.gameManager || !this.gameManager.hasCardTypeBeenUsed(this.gameId, c.frontImage, this.playerName))
            );
            
            if (unusedMoveCard) {
              const cardName = this.getCardNameFromUrl(unusedMoveCard.frontImage);
              this.sendChatMessage(`Gioco una carta MOSSE diversa: "${cardName}".`);
              
              return {
                type: 'play-card',
                data: {
                  cardId: unusedMoveCard.id,
                  playerName: this.playerName
                }
              };
            } else {
              this.sendChatMessage(`Non ho altre carte MOSSE disponibili. Passo il turno.`);
              return null;
            }
          }
          
          // Use the MOSSE card that's already on the field for attack
          const cardName = this.getCardNameFromUrl(mosseOnField.frontImage);
          const targetName = this.getCardNameFromUrl(targetCard.frontImage);
          
          this.sendChatMessage(`Uso la carta MOSSE "${cardName}" per attaccare ${targetName}!`);
          
          // Emit the attack immediately
          if (this.socketEmitter) {
            this.socketEmitter.emit('mosse-attack', {
              mosseCardId: mosseOnField.id,
              targetCardId: action.target,
              attackerName: this.playerName,
              targetOwner: targetCard.owner
            });
          }
          
          return {
            type: 'mosse-attack',
            data: {
              mosseCardId: mosseOnField.id,
              targetCardId: action.target,
              attackerName: this.playerName,
              targetOwner: targetCard.owner,
              cardName,
              targetName
            }
          };
        } else {
          // Need to play a MOSSE card first from hand, but check if it's already been used
          const unusedMoveCard = cpuPlayer.hand.find((c: any) => 
            c.type === 'mosse' && 
            (!this.gameManager || !this.gameManager.hasCardTypeBeenUsed(this.gameId, c.frontImage, this.playerName))
          );
          
          if (unusedMoveCard) {
            const cardName = this.getCardNameFromUrl(unusedMoveCard.frontImage);
            this.sendChatMessage(`Prima devo giocare la carta MOSSE "${cardName}" sul campo.`);
            
            return {
              type: 'play-card',
              data: {
                cardId: unusedMoveCard.id,
                playerName: this.playerName
              }
            };
          } else {
            this.sendChatMessage(`Tutte le mie carte MOSSE sono già state usate questo turno.`);
            return null;
          }
        }
        break;

      case 'switch_character':
        // Switch to a character from hand
        const characterCard = cpuPlayer.hand.find((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali');
        if (characterCard) {
          console.log(`CPU ${this.playerName} switching to character: ${characterCard.id}`);
          this.sendChatMessage("Cambio il mio personaggio in campo!");
          return {
            type: 'play-card',
            data: {
              cardId: characterCard.id,
              playerName: this.playerName
            }
          };
        }
        break;
      
      // Removed pass_turn case as it's not a supported action type
    }

    console.log(`CPU ${this.playerName} could not execute action, returning null`);
    return null;
  }

  // Send chat message to game
  sendChatMessage(message: string) {
    if (this.socketEmitter) {
      const chatMessage = {
        id: `${Date.now()}-${Math.random()}`,
        playerName: this.playerName,
        message,
        timestamp: Date.now()
      };
      this.socketEmitter.to(this.gameId).emit('chat-message', chatMessage);
      console.log(`CPU ${this.playerName} says: ${message}`);
    }
  }

  // Check if CPU needs clarification about a card or situation
  async needsClarification(gameState: any, cardAnalysis?: CardAnalysis): Promise<{needsClarification: boolean, question: string}> {
    if (this.waitingForResponse) {
      return { needsClarification: false, question: '' };
    }

    try {
      const situation = cardAnalysis ? 
        `Sto analizzando la carta "${cardAnalysis.name}" con effetto: "${cardAnalysis.effect || 'Nessun effetto speciale rilevato'}"` :
        `Sto valutando la situazione di gioco attuale`;

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `Sei un CPU che gioca a MINKIARDS. Devi decidere se hai bisogno di chiarimenti dal giocatore umano.
            
            Fai domande quando:
            - L'effetto di una carta non è chiaro dalle regole standard
            - Ci sono ambiguità su come applicare un potere o trasformazione
            - Non sei sicuro dell'interpretazione di una situazione di gioco
            - Vuoi confermare una strategia prima di procedere
            
            NON fare domande per:
            - Azioni semplici come giocare carte base
            - Regole standard che già conosci
            - Situazioni evidenti
            
            Rispondi con JSON: {"needsClarification": boolean, "question": "domanda in italiano"}
            
            Storia conversazione precedente: ${JSON.stringify(this.conversationHistory.slice(-3))}`
          },
          {
            role: "user",
            content: `${situation}
            
            Giocatori in partita: ${Object.keys(gameState.players).join(', ')}
            Mie carte in mano: ${gameState.players[this.playerName]?.hand?.length || 0}
            Carte sul campo: ${gameState.field?.length || 0}
            
            Ho bisogno di chiarimenti prima di procedere?`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 200
      });

      const result = JSON.parse(response.choices[0].message.content || '{"needsClarification": false, "question": ""}');
      return result;
    } catch (error) {
      console.error('Error checking clarification need:', error);
      return { needsClarification: false, question: '' };
    }
  }

  // Process human response to CPU question
  processHumanResponse(response: string) {
    if (this.waitingForResponse && this.currentQuestion) {
      this.conversationHistory.push({
        type: 'answer',
        content: response,
        timestamp: Date.now()
      });
      
      this.waitingForResponse = false;
      this.currentQuestion = '';
      
      // Send confirmation message
      this.sendChatMessage(`Grazie per la spiegazione! Ora procedo con la mia mossa.`);
      return true;
    }
    return false;
  }

  // Ask a question and wait for response
  async askQuestion(question: string): Promise<boolean> {
    this.currentQuestion = question;
    this.waitingForResponse = true;
    
    this.conversationHistory.push({
      type: 'question',
      content: question,
      timestamp: Date.now()
    });
    
    this.sendChatMessage(question);
    return true;
  }

  // Get context from conversation history for decision making
  getConversationContext(): string {
    return this.conversationHistory
      .slice(-5) // Last 5 exchanges
      .map(entry => `${entry.type === 'question' ? 'CPU ha chiesto' : 'Umano ha risposto'}: ${entry.content}`)
      .join('\n');
  }

  // Simple game analysis without AI (fallback) - follows MINKIARDS rules strictly
  analyzeGameStateSimple(gameState: any): GameAnalysis {
    const cpuPlayer = gameState.players[this.playerName];
    if (!cpuPlayer) {
      return this.getDefaultAnalysis();
    }

    const myCharacter = gameState.field.find((card: any) => card.owner === this.playerName && card.type === 'personaggi');
    const enemyCharacters = gameState.field.filter((card: any) => card.owner !== this.playerName && card.type === 'personaggi');

    // MINKIARDS RULES IMPLEMENTATION:
    // RULE 1: WITHOUT a character on field, you CANNOT perform any actions except playing a character
    // RULE 2: ONE card per turn OR character substitution (not both)
    // RULE 3: Card sequence: play → use → return to deck → auto-draw replacement
    // RULE 4: Attack damage = base damage × attacker stars (need stars > 0 to attack)
    let recommendedAction;

    // RULE 1: Must have character on field to do anything
    if (!myCharacter) {
      const characterCard = cpuPlayer.hand.find((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali');
      if (characterCard) {
        recommendedAction = {
          type: 'play_card' as const,
          cardId: characterCard.id,
          reasoning: 'REGOLA FONDAMENTALE: devo avere un personaggio in campo per giocare'
        };
      } else {
        // No character in hand - will be handled by shouldDrawCards system
        recommendedAction = {
          type: 'play_card' as const,
          reasoning: 'Attendo di pescare un personaggio tramite shouldDrawCards'
        };
      }
    } else {
      // I have a character on field - can perform actions
      const moveCard = cpuPlayer.hand.find((c: any) => c.type === 'mosse');
      const bonusCard = cpuPlayer.hand.find((c: any) => c.type === 'bonus');
      const handCharacterCard = cpuPlayer.hand.find((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali');
      
      // Parse character stats from notes (same as other parts of codebase)
      const characterText = myCharacter.notes || myCharacter.text || '';
      const ptiMatch = characterText.match(/PTI[:\s]*(\d+)/i);
      const starsMatch = characterText.match(/(?:stelle|stars)[:\s]*(\d+)/i);
      const currentPTI = ptiMatch ? parseInt(ptiMatch[1]) : 100; // fallback PTI
      const currentStars = starsMatch ? parseInt(starsMatch[1]) : 0; // RULE: no stars = cannot attack
      
      // Check if character is dying (proportional to PTI, not fixed threshold)
      const ptiThreshold = Math.max(50, Math.floor(currentPTI * 0.25)); // 25% of current PTI or minimum 50
      if (currentPTI <= ptiThreshold && handCharacterCard) {
        // Strategic character replacement when current one is weak
        recommendedAction = {
          type: 'switch_character' as const,
          cardId: handCharacterCard.id,
          reasoning: `Il mio personaggio ha PTI bassi (${currentPTI}), lo sostituisco strategicamente`
        };
      }
      // RULE 4: Attack only if we have stars > 0 and enemies exist
      else if (moveCard && enemyCharacters.length > 0 && currentStars > 0) {
        // Find weakest enemy for targeting
        const targetEnemy = enemyCharacters[0]; // Simplified target selection
        recommendedAction = {
          type: 'attack' as const,
          cardId: moveCard.id,
          target: targetEnemy.id,
          reasoning: `Attacco con ${currentStars} stelle contro ${targetEnemy.owner}`
        };
      }
      // Use BONUS cards to strengthen character (proportional threshold)
      else if (bonusCard && currentPTI < Math.max(150, currentPTI * 0.5)) { // Use BONUS when PTI below 50% or 150
        recommendedAction = {
          type: 'play_card' as const,
          cardId: bonusCard.id,
          reasoning: 'Rafforzo il mio personaggio con carta BONUS'
        };
      }
      // Character substitution for critically low stats  
      else if (handCharacterCard && currentPTI < Math.max(30, Math.floor(currentPTI * 0.15))) {
        recommendedAction = {
          type: 'switch_character' as const,
          cardId: handCharacterCard.id,
          reasoning: 'Sostituisco il personaggio con uno più forte'
        };
      }
      // Fallback: play any available card
      else if (cpuPlayer.hand.length > 0) {
        const availableCard = bonusCard || moveCard || handCharacterCard || cpuPlayer.hand[0];
        recommendedAction = {
          type: 'play_card' as const,
          cardId: availableCard.id,
          reasoning: 'Gioco una carta disponibile seguendo le regole'
        };
      } else {
        // No valid actions - end turn
        recommendedAction = {
          type: 'play_card' as const,
          reasoning: 'Fine turno - nessuna azione valida disponibile'
        };
      }
    }

    return {
      myCharacter,
      enemyCharacters,
      handCards: cpuPlayer.hand,
      fieldSituation: `${gameState.field.length} carte in campo`,
      recommendedAction
    };
  }

  getDefaultAnalysis(): GameAnalysis {
    return {
      myCharacter: null,
      enemyCharacters: [],
      handCards: [],
      fieldSituation: 'Analisi non disponibile',
      recommendedAction: {
        type: 'play_card',
        reasoning: 'Azione di default'
      }
    };
  }

  // Random chat responses following MINKIARDS rules
  getRandomChatResponse(situation: string): string {
    const responses = {
      thinking: [
        "Analizzo la situazione seguendo le regole MINKIARDS...",
        "Controllo i miei PTI e le stelle",
        "Strategia: personaggio prima, poi azione!",
        "Devo rispettare la sequenza di gioco"
      ],
      playing_character: [
        "Metto in campo il personaggio - regola fondamentale!",
        "Senza personaggio non posso fare nulla",
        "Ora posso finalmente agire!",
        "Personaggio in campo: check!"
      ],
      attacking: [
        "Attacco calcolando: danno base × mie stelle!",
        "Le mie stelle mi permettono di attaccare!",
        "Danno preciso seguendo le regole!",
        "Carta MOSSE in azione!"
      ],
      no_actions: [
        "Devo prima seguire le regole base",
        "Passo il turno",
        "Tocca a voi",
        "Aspetto il momento giusto"
      ],
      greeting: [
        "Ciao a tutti! Pronto a giocare?",
        "Salve! Che la partita abbia inizio!",
        "Ciao! Vediamo chi vincerà",
        "Buongiorno! Sono pronto per la sfida"
      ]
    };

    const situationResponses = responses[situation as keyof typeof responses] || responses.thinking;
    return situationResponses[Math.floor(Math.random() * situationResponses.length)];
  }

  // NEW CPU TURN LOGIC: State machine for pesca → gioca → esegui azione → fine turno
  async takeTurn(gameState: any) {
    try {
      console.log(`CPU ${this.playerName} is thinking... Current phase: ${this.turnState.phase}`);
      
      // If waiting for response, don't take action
      if (this.waitingForResponse) {
        console.log(`CPU ${this.playerName} is waiting for human response`);
        return null;
      }
      
      const cpuPlayer = gameState.players[this.playerName];
      if (!cpuPlayer) {
        console.log(`CPU ${this.playerName} not found in game state`);
        return null;
      }
      
      // NEW: Process pending orders from human players first
      if (this.pendingOrder) {
        console.log(`CPU ${this.playerName} processing pending order:`, this.pendingOrder);
        const orderAction = this.processPendingOrder(gameState);
        this.pendingOrder = null; // Clear after processing
        if (orderAction) {
          return orderAction;
        }
      }
      
      // NEW: Check for dead characters (PTI: 0) and move to graveyard automatically
      const deadCharacterAction = this.checkAndEliminateDeadCharacters(gameState);
      if (deadCharacterAction) {
        console.log(`CPU ${this.playerName} found dead character to eliminate`);
        return deadCharacterAction;
      }
      
      // Check if this is the opening sequence (no cards in hand, no character on field)
      const isOpeningSequence = this.isOpeningSequence(cpuPlayer, gameState);
      if (isOpeningSequence) {
        console.log(`CPU ${this.playerName} executing opening sequence`);
        return await this.executeOpeningSequence(gameState);
      }
      
      // MINKIARDS FUNDAMENTAL RULE: Must have character on field to do ANY action except playing a character
      const hasCharacter = gameState.field.find((card: any) => 
        card.owner === this.playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali')
      );
      
      if (!hasCharacter) {
        // First priority: Play character from hand if available
        const characterInHand = cpuPlayer.hand.find((c: any) => 
          c.type === 'personaggi' || c.type === 'personaggi_speciali'
        );
        
        if (characterInHand) {
          this.sendChatMessage(`Devo mettere un personaggio in campo!`);
          this.markActionExecuted('execute'); // This counts as an action
          return {
            type: 'play-card',
            data: {
              cardId: characterInHand.id,
              playerName: this.playerName
            }
          };
        }
        
        // Second priority: Draw a character if no character in hand
        this.sendChatMessage(`Non ho un personaggio! Devo pescarne uno.`);
        return {
          type: 'pick-card',
          data: {
            deckType: 'personaggi',
            playerName: this.playerName
          }
        };
      }

      // NEW STATE MACHINE LOGIC
      switch (this.turnState.phase) {
        case 'draw_needed':
          return this.handleDrawPhase(cpuPlayer, gameState);
          
        case 'play_card':
          return this.handlePlayPhase(cpuPlayer, gameState);
          
        case 'execute_action':
          return await this.handleExecutePhase(cpuPlayer, gameState);
          
        case 'turn_end':
          if (this.canEndTurn()) {
            this.sendChatMessage(`Finisco il turno!`);
            this.resetTurnState(); // Reset for next turn
            return { type: 'end-turn', data: { playerName: this.playerName } };
          } else {
            console.log(`CPU ${this.playerName} cannot end turn - missing execution`);
            this.turnState.phase = 'draw_needed'; // Reset to beginning
            return this.handleDrawPhase(cpuPlayer, gameState);
          }
          
        default:
          console.log(`CPU ${this.playerName} unknown phase: ${this.turnState.phase}`);
          this.resetTurnState();
          return this.handleDrawPhase(cpuPlayer, gameState);
      }
      
    } catch (error) {
      console.error(`Error in CPU ${this.playerName} turn:`, error);
      this.sendChatMessage(this.getRandomChatResponse('no_actions'));
      this.resetTurnState();
      return null;
    }
  }

  // Handle the draw phase: ensure CPU has exactly 1 card per type
  handleDrawPhase(cpuPlayer: any, gameState: any): any {
    const needsToDraw = this.shouldDrawCards(cpuPlayer, gameState);
    if (needsToDraw.shouldDraw && needsToDraw.deckType) {
      this.sendChatMessage(`Pesco una carta ${needsToDraw.deckType.toUpperCase()} - devo avere 1 per tipo!`);
      return {
        type: 'pick-card',
        data: {
          deckType: needsToDraw.deckType,
          playerName: this.playerName
        }
      };
    }
    
    // All cards are optimal, move to play phase
    console.log(`CPU ${this.playerName} hand composition optimal - moving to play phase`);
    this.turnState.phase = 'play_card';
    return this.handlePlayPhase(cpuPlayer, gameState);
  }

  // Handle the play phase: select and play a card
  handlePlayPhase(cpuPlayer: any, gameState: any): any {
    const cardToPlay = this.selectCardToPlay(cpuPlayer, gameState);
    if (cardToPlay) {
      const cardName = this.getCardNameFromUrl(cardToPlay.frontImage);
      this.sendChatMessage(`Gioco "${cardName}" in campo!`);
      this.markActionExecuted('play', cardToPlay.id, cardToPlay.type);
      
      return {
        type: 'play-card',
        data: {
          cardId: cardToPlay.id,
          playerName: this.playerName
        }
      };
    }
    
    // No card to play, end turn
    this.sendChatMessage(`Non ho carte da giocare, finisco il turno.`);
    this.markActionExecuted('execute'); // Mark as executed to allow turn end
    this.turnState.phase = 'turn_end';
    return { type: 'end-turn', data: { playerName: this.playerName } };
  }

  // Handle the execute phase: execute the action of the played card
  async handleExecutePhase(cpuPlayer: any, gameState: any): Promise<any> {
    const playedCardType = this.turnState.playedCardType;
    const playedCardId = this.turnState.playedCardId;
    
    if (!playedCardType || !playedCardId) {
      console.log(`CPU ${this.playerName} no played card to execute`);
      this.markActionExecuted('execute');
      this.turnState.phase = 'turn_end';
      return this.handleTurnEnd();
    }

    // CRITICAL FIX: Execute action and handle potential attack return value
    console.log(`CPU ${this.playerName} executing action for ${playedCardType} card`);
    
    const deckType = playedCardType === 'personaggi_speciali' ? 'personaggi' : playedCardType;
    
    // Execute based on card type
    switch (playedCardType) {
      case 'mosse':
        // CRITICAL FIX: Handle attack action return value
        const attackAction = await this.executeMovesCardAndDrawReplacement(playedCardId, gameState, deckType);
        if (attackAction) {
          console.log(`CPU ${this.playerName} executing MOSSE attack action`);
          return attackAction; // Return the attack action to be processed immediately
        }
        break;
        
      case 'bonus':
        await this.executeBonusCardAndDrawReplacement(playedCardId, gameState, deckType);
        break;
        
      case 'personaggi':
      case 'personaggi_speciali':
        // Character cards are automatically analyzed when played
        this.sendChatMessage(`Personaggio attivato e analizzato!`);
        await this.drawReplacementAndEndTurn(deckType);
        break;
        
      default:
        this.sendChatMessage(`Carta ${playedCardType} attivata!`);
        await this.drawReplacementAndEndTurn(deckType);
    }
    
    // After handling all cases, ensure we end the turn (for non-attacking cards)
    this.markActionExecuted('execute');
    this.turnState.phase = 'turn_end';
    
    return this.handleTurnEnd();
  }

  // Handle turn end
  handleTurnEnd(): any {
    if (this.canEndTurn()) {
      this.sendChatMessage(`Ho completato le mie azioni, finisco il turno!`);
      this.resetTurnState(); // Reset for next turn
      return { type: 'end-turn', data: { playerName: this.playerName } };
    } else {
      // Should not happen with the new logic, but safety fallback
      this.resetTurnState();
      return null;
    }
  }

  // NEW: Execute MOSSE card with authoritative server-side attack
  async executeMovesCardAndDrawReplacement(cardId: string, gameState: any, deckType: string): Promise<any> {
    // Validate gameManager availability
    if (!this.gameManager) {
      console.error(`CPU ${this.playerName}: No gameManager for MOSSE attack execution`);
      this.sendChatMessage(`Errore interno: impossibile eseguire attacco.`);
      this.markActionExecuted('execute');
      return null;
    }

    // Set replacement draw flags
    this.turnState.needsReplacementDraw = true;
    this.turnState.replacementDeckType = deckType === 'personaggi_speciali' ? 'personaggi' : deckType;

    // Use deterministic target selection  
    const target = this.pickEnemyTarget();
    if (!target) {
      console.log(`CPU ${this.playerName}: No valid targets for MOSSE attack`);
      this.sendChatMessage(`Nessun nemico da attaccare, carta MOSSE attivata comunque.`);
      this.markActionExecuted('execute');
      await this.drawReplacementAndEndTurn('mosse');
      return null;
    }
    
    // STRICT NULL GUARD: Verify target before proceeding
    if (!target.name || !target.cardId || !target.owner) {
      console.error(`CPU ${this.playerName}: Invalid target data:`, target);
      this.sendChatMessage(`Errore: target non valido per l'attacco.`);
      this.markActionExecuted('execute');
      await this.drawReplacementAndEndTurn('mosse');
      return null;
    }

    // SEQUENZA COMPLETA RICHIESTA: Implementazione della sequenza specifica per carte MOSSE
    
    // STEP 1: PIAZZA AUTORIZZATIVAMENTE la carta MOSSE in campo (se non è già presente)
    let mosseCard = gameState.field.find((c: any) => c.id === cardId && c.owner === this.playerName);
    if (!mosseCard) {
      console.log(`CPU ${this.playerName}: STEP 1 - Carta MOSSE ${cardId} non in campo, la piazzo ora`);
      
      // Trova la carta MOSSE nella mano del CPU
      const cpuPlayer = gameState.players[this.playerName];
      const mosseCardInHand = cpuPlayer?.hand?.find((c: any) => c.id === cardId && c.type === 'mosse');
      
      if (!mosseCardInHand) {
        console.error(`CPU ${this.playerName}: MOSSE card ${cardId} not found in hand - cannot execute sequence`);
        this.sendChatMessage(`Errore: carta MOSSE non trovata in mano.`);
        this.markActionExecuted('execute');
        await this.drawReplacementAndEndTurn('mosse');
        return null;
      }
      
      // Piazza la carta MOSSE in campo usando il gameManager
      if (!this.gameManager) {
        console.error(`CPU ${this.playerName}: No gameManager available for placing MOSSE card`);
        this.sendChatMessage(`Errore interno: impossibile piazzare carta.`);
        this.markActionExecuted('execute');
        await this.drawReplacementAndEndTurn('mosse');
        return null;
      }
      
      try {
        const playResult = await this.gameManager.playCard(this.gameId, cardId, this.playerName);
        if (!playResult) {
          console.error(`CPU ${this.playerName}: Failed to place MOSSE card ${cardId} on field`);
          this.sendChatMessage(`Impossibile piazzare la carta MOSSE in campo.`);
          this.markActionExecuted('execute');
          await this.drawReplacementAndEndTurn('mosse');
          return null;
        }
        
        console.log(`CPU ${this.playerName}: STEP 1 COMPLETED - MOSSE card ${cardId} successfully placed on field`);
        
        // CRITICAL: Mark the play action as executed for turn FSM
        this.markActionExecuted('play', cardId, 'mosse');
        
        // Aggiorna il game state per riflettere la carta appena piazzata
        const updatedGameState = this.gameManager.getSanitizedGameState(this.gameId);
        mosseCard = updatedGameState.field.find((c: any) => c.id === cardId && c.owner === this.playerName);
        
      } catch (error) {
        console.error(`CPU ${this.playerName}: Error placing MOSSE card:`, error);
        this.sendChatMessage(`Errore nel piazzamento della carta MOSSE.`);
        this.markActionExecuted('execute');
        await this.drawReplacementAndEndTurn('mosse');
        return null;
      }
    } else {
      console.log(`CPU ${this.playerName}: STEP 1 - Carta MOSSE ${cardId} già in campo`);
    }
    
    // STEP 2: Scelta del personaggio avversario (già fatto con pickEnemyTarget)
    // STEP 3: SIMULA: Preme sulla carta MOSSE, poi su "ATTACCA" e sul personaggio avversario
    console.log(`CPU ${this.playerName}: SEQUENZA MOSSE AUTORATIVA - Selecting card ${cardId}, pressing ATTACCA, targeting ${target.name} (${target.cardId})`);
    
    // STEP 4: Messaggio in chat nel formato richiesto: "Uso la carta [nome carta] su [nome personaggio avversario] di [nome utente avversario]"
    let mosseCardName = 'MOSSE';
    
    // MIGLIORATA: Estrazione nome carta con fallback robusto
    if (mosseCard && mosseCard.frontImage) {
      try {
        const urlParts = mosseCard.frontImage.split('/');
        const filename = urlParts[urlParts.length - 1];
        const cardName = filename.replace(/\.(png|jpg|jpeg|gif)$/i, '').replace(/[-_]/g, ' ').trim();
        if (cardName.length > 2) {
          mosseCardName = cardName.charAt(0).toUpperCase() + cardName.slice(1).toLowerCase();
        }
      } catch (error) {
        console.log(`CPU ${this.playerName}: Could not extract card name from ${mosseCard.frontImage}, using default`);
      }
    }
    
    this.sendChatMessage(`Uso la carta ${mosseCardName} su ${target.name} di ${target.owner}`);
    
    // Execute server-side attack (attendendo input utente come da nuova implementazione)
    const attackResult = await this.gameManager.executeMossaAttack(
      this.gameId,
      this.playerName,
      cardId,
      target.cardId
    );

    // Non dichiariamo più risultato automatico - il sistema ora richiede input utente
    if (attackResult.success) {
      console.log(`CPU ${this.playerName}: MOSSE attack initiated successfully - awaiting manual damage input`);
    } else {
      console.error(`CPU ${this.playerName}: MOSSE attack failed - ${attackResult.error}`);
      this.sendChatMessage(`Attacco fallito: ${attackResult.error}`);
    }

    // STEP 5: Preme su "FINE TURNO" - Completa la sequenza nello stesso turno come richiesto
    this.markActionExecuted('execute');
    
    // CRITICAL FIX: Completa la sequenza nello stesso turno con sostituzione carta MOSSE e fine turno
    await this.drawReplacementAndEndTurn('mosse');
    
    return null; // Sequenza MOSSE completata
  }

  // CRITICAL FIX: Execute BONUS card action and draw replacement  
  async executeBonusCardAndDrawReplacement(cardId: string, gameState: any, deckType: string): Promise<void> {
    this.sendChatMessage(`Carta BONUS attivata!`);
    
    // Draw replacement card
    await this.drawReplacementAndEndTurn(deckType);
  }

  // CRITICAL FIX: Draw replacement card via existing gameManager
  async drawReplacementAndEndTurn(deckType: string): Promise<void> {
    console.log(`CPU ${this.playerName} drawing replacement ${deckType} card to maintain hand composition`);
    
    this.sendChatMessage(`Pesco una carta di ricambio e termino il turno!`);
    
    // Use existing gameManager instance (not new one)
    if (!this.gameManager) {
      console.error(`CPU ${this.playerName}: No gameManager for replacement draw`);
      return;
    }
    
    // Pick replacement card directly through existing gameManager
    try {
      const pickResult = await this.gameManager.pickCard(this.gameId, deckType as 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali', this.playerName);
      if (pickResult) {
        console.log(`CPU ${this.playerName} successfully drew replacement ${deckType} card`);
        
        // Notify all players about the updated game state
        if (this.socketEmitter) {
          const gameState = this.gameManager.getSanitizedGameState(this.gameId);
          this.socketEmitter.to(this.gameId).emit('game-state-update', gameState);
        }
      } else {
        console.log(`CPU ${this.playerName} failed to draw replacement ${deckType} card`);
      }
    } catch (error) {
      console.error(`Error drawing replacement card for CPU ${this.playerName}:`, error);
    }
    
    // Mark turn as ready to end
    this.turnState.phase = 'turn_end';
  }


  
  // Select which card to play based on strategic priorities
  selectCardToPlay(cpuPlayer: any, gameState: any): any {
    const hand = cpuPlayer.hand || [];
    const myCharacter = gameState.field.find((card: any) => card.owner === this.playerName && card.type === 'personaggi');
    const enemies = gameState.field.filter((card: any) => card.owner !== this.playerName && card.type === 'personaggi');
    
    // Check what cards I already have on field to avoid duplicates
    const myFieldCards = gameState.field.filter((card: any) => card.owner === this.playerName);
    const hasPersonaggioOnField = myFieldCards.some((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali');
    const hasMosseOnField = myFieldCards.some((c: any) => c.type === 'mosse');  
    const hasBonusOnField = myFieldCards.some((c: any) => c.type === 'bonus');
    
    console.log(`CPU ${this.playerName} field check: PERSONAGGI=${hasPersonaggioOnField}, MOSSE=${hasMosseOnField}, BONUS=${hasBonusOnField}`);
    
    // Priority 1: If no character on field, play PERSONAGGI first
    if (!hasPersonaggioOnField) {
      const personaggio = hand.find((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali');
      if (personaggio) {
        console.log(`CPU ${this.playerName} playing PERSONAGGI (no character on field)`);
        return personaggio;
      }
    }
    
    // Priority 2: If character is low on PTI and no BONUS on field, play BONUS to heal
    if (myCharacter && !hasBonusOnField) {
      const characterText = myCharacter.notes || myCharacter.text || '';
      const ptiMatch = characterText.match(/PTI[:\s]*(\d+)/i);
      const currentPTI = ptiMatch ? parseInt(ptiMatch[1]) : 100;
      
      if (currentPTI <= 200) {
        const bonus = hand.find((c: any) => c.type === 'bonus');
        if (bonus) {
          console.log(`CPU ${this.playerName} playing BONUS (low PTI: ${currentPTI})`);
          return bonus;
        }
      }
    }
    
    // Priority 3: If enemies present, can attack, and no MOSSE on field, play MOSSE
    if (enemies.length > 0 && myCharacter && !hasMosseOnField) {
      const characterText = myCharacter.notes || myCharacter.text || '';
      const starsMatch = characterText.match(/(?:stelle|stars)[:\s]*(\d+)/i);
      const currentStars = starsMatch ? parseInt(starsMatch[1]) : 0;
      
      if (currentStars > 0) {
        const mosse = hand.find((c: any) => c.type === 'mosse');
        if (mosse) {
          console.log(`CPU ${this.playerName} playing MOSSE (can attack with ${currentStars} stars)`);
          return mosse;
        }
      }
    }
    
    // Priority 4: Play any card to maintain flow, but avoid field duplicates
    if (!hasBonusOnField) {
      const bonus = hand.find((c: any) => c.type === 'bonus');
      if (bonus) {
        console.log(`CPU ${this.playerName} playing BONUS (no BONUS on field)`);
        return bonus;
      }
    }
    
    if (!hasMosseOnField) {
      const mosse = hand.find((c: any) => c.type === 'mosse');
      if (mosse) {
        console.log(`CPU ${this.playerName} playing MOSSE (no MOSSE on field)`);
        return mosse;
      }
    }
    
    // Priority 5: If all types are on field, prefer using existing cards instead of playing new ones
    // This handles the case where CPU has all card types on field and in hand
    
    // First, try to use MOSSE if there are enemies and we have MOSSE on field
    if (enemies.length > 0 && hasMosseOnField && myCharacter) {
      const characterText = myCharacter.notes || myCharacter.text || '';
      const starsMatch = characterText.match(/(?:stelle|stars)[:\s]*(\d+)/i);
      const currentStars = starsMatch ? parseInt(starsMatch[1]) : 0;
      
      if (currentStars > 0) {
        // Find existing MOSSE card on field to use
        const existingMosse = myFieldCards.find((c: any) => c.type === 'mosse');
        if (existingMosse) {
          console.log(`CPU ${this.playerName} using existing MOSSE on field to attack (${currentStars} stars)`);
          return existingMosse; // Return existing card to use it
        }
      }
    }
    
    // Second, try to use BONUS if character needs healing and we have BONUS on field
    if (myCharacter && hasBonusOnField) {
      const characterText = myCharacter.notes || myCharacter.text || '';
      const ptiMatch = characterText.match(/PTI[:\s]*(\d+)/i);
      const currentPTI = ptiMatch ? parseInt(ptiMatch[1]) : 100;
      
      if (currentPTI <= 300) {
        // Find existing BONUS card on field to use
        const existingBonus = myFieldCards.find((c: any) => c.type === 'bonus');
        if (existingBonus) {
          console.log(`CPU ${this.playerName} using existing BONUS on field to heal (PTI: ${currentPTI})`);
          return existingBonus; // Return existing card to use it
        }
      }
    }
    
    // Final fallback: play ANY card if we have space, even if it creates "duplicates"
    // In MINKIARDS, cards get used and returned to deck, so duplicates are temporary
    const anyCard = hand.find((c: any) => c.type === 'mosse' || c.type === 'bonus');
    if (anyCard) {
      console.log(`CPU ${this.playerName} playing ${anyCard.type} card (maintenance turn)`);
      return anyCard;
    }
    
    console.log(`CPU ${this.playerName} has no actionable cards this turn`);
    return null;
  }

  // MINKIARDS RULES: Always maintain exactly 1 card of each type (PERSONAGGI, MOSSE, BONUS) in hand
  shouldDrawCards(cpuPlayer: any, gameState: any): { shouldDraw: boolean, deckType?: string } {
    const hand = cpuPlayer.hand || [];
    const myCharacter = gameState.field.find((card: any) => card.owner === this.playerName && card.type === 'personaggi');
    
    // Count cards of each type in hand to avoid duplicates
    const personaggiInHand = hand.filter((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali').length;
    const mosseInHand = hand.filter((c: any) => c.type === 'mosse').length;
    const bonusInHand = hand.filter((c: any) => c.type === 'bonus').length;
    
    console.log(`CPU ${this.playerName} hand count: PERSONAGGI=${personaggiInHand}, MOSSE=${mosseInHand}, BONUS=${bonusInHand}`);
    
    // MINKIARDS RULE 1: Must have 1 PERSONAGGI card in hand (if no character on field)
    // Don't draw more than 1 PERSONAGGI
    if (personaggiInHand === 0 && !myCharacter) {
      return { shouldDraw: true, deckType: 'personaggi' };
    }
    
    // MINKIARDS RULE 2: Always maintain exactly 1 MOSSE card in hand
    // Don't draw more than 1 MOSSE  
    if (mosseInHand === 0) {
      return { shouldDraw: true, deckType: 'mosse' };
    }
    
    // MINKIARDS RULE 3: Always maintain exactly 1 BONUS card in hand
    // Don't draw more than 1 BONUS
    if (bonusInHand === 0) {
      return { shouldDraw: true, deckType: 'bonus' };
    }
    
    // If we have exactly 1 of each required type, don't draw more
    console.log(`CPU ${this.playerName} has optimal hand composition - no drawing needed`);
    return { shouldDraw: false };
  }
  
  // NEW: Check for PERSONAGGI cards with PTI: 0 and automatically eliminate them
  checkAndEliminateDeadCharacters(gameState: any): any {
    // Find CPU's PERSONAGGI cards on the field with PTI: 0
    const myCharacters = gameState.field.filter((card: any) => 
      card.owner === this.playerName && 
      (card.type === 'personaggi' || card.type === 'personaggi_speciali')
    );
    
    for (const character of myCharacters) {
      const notes = character.notes || character.text || '';
      
      // Check if notes contain "PTI: 0" (even with other text)
      const ptiMatch = notes.match(/PTI:\s*0\b/i);
      if (ptiMatch) {
        console.log(`CPU ${this.playerName} found dead character ${character.id} with PTI: 0`);
        this.sendChatMessage(`Il mio personaggio è morto (PTI: 0). Lo metto nel cimitero.`);
        
        return {
          type: 'eliminate-dead-character',
          data: {
            cardId: character.id,
            playerName: this.playerName,
            reason: 'PTI reached 0'
          }
        };
      }
    }
    
    return null;
  }
  
  // NEW: Process pending orders from human players
  processPendingOrder(gameState: any): any {
    if (!this.pendingOrder) return null;
    
    const order = this.pendingOrder;
    console.log(`CPU ${this.playerName} executing pending order:`, order);
    
    switch (order.type) {
      case 'show-card':
        return this.executeShowCardAction(order, gameState);
      case 'pick-card':
        return this.executePickCardAction(order, gameState);
      case 'play-card':
        return this.executePlayCardAction(order, gameState);
      case 'attack':
        return this.executeAttackAction(order, gameState);
      default:
        console.log(`CPU ${this.playerName} unknown order type:`, order.type);
        return null;
    }
  }
  
  // Execute show card action
  executeShowCardAction(order: any, gameState: any): any {
    const cpuPlayer = gameState.players[this.playerName];
    if (!cpuPlayer || !cpuPlayer.hand) return null;
    
    const requestedCard = cpuPlayer.hand.find((card: any) => card.type === order.cardType);
    if (requestedCard) {
      this.sendChatMessage(`Ecco la mia carta ${order.cardType.toUpperCase()} per ${order.senderName}!`);
      return {
        type: 'show-card-to-player',
        data: {
          cardId: requestedCard.id,
          cardImage: requestedCard.frontImage,
          fromPlayer: this.playerName,
          toPlayer: order.senderName,
          orderMessage: order.message
        }
      };
    } else {
      this.sendChatMessage(`Mi dispiace ${order.senderName}, non ho carte di tipo ${order.cardType.toUpperCase()}!`);
      return null;
    }
  }
  
  // Execute pick card action
  executePickCardAction(order: any, gameState: any): any {
    this.sendChatMessage(`Pesco ${order.deckType.toUpperCase()} come richiesto da ${order.senderName}!`);
    return {
      type: 'pick-card',
      data: {
        deckType: order.deckType,
        playerName: this.playerName
      }
    };
  }
  
  // Execute play card action
  executePlayCardAction(order: any, gameState: any): any {
    const cpuPlayer = gameState.players[this.playerName];
    if (!cpuPlayer || !cpuPlayer.hand) return null;
    
    let cardToPlay;
    if (order.cardType) {
      cardToPlay = cpuPlayer.hand.find((card: any) => card.type === order.cardType);
    } else {
      cardToPlay = cpuPlayer.hand[0]; // Play any card
    }
    
    if (cardToPlay) {
      this.sendChatMessage(`Gioco ${cardToPlay.type.toUpperCase()} come richiesto da ${order.senderName}!`);
      return {
        type: 'play-card',
        data: {
          cardId: cardToPlay.id,
          playerName: this.playerName
        }
      };
    } else {
      this.sendChatMessage(`Non ho carte ${order.cardType ? order.cardType.toUpperCase() : 'disponibili'} da giocare!`);
      return null;
    }
  }
  
  // Execute attack action
  executeAttackAction(order: any, gameState: any): any {
    const cpuPlayer = gameState.players[this.playerName];
    const enemies = gameState.field.filter((card: any) => card.owner !== this.playerName && card.type === 'personaggi');
    
    if (!cpuPlayer || !cpuPlayer.hand) return null;
    
    const mosseCard = cpuPlayer.hand.find((card: any) => card.type === 'mosse');
    if (mosseCard && enemies.length > 0) {
      this.sendChatMessage(`Attacco come richiesto da ${order.senderName}!`);
      return {
        type: 'mosse-attack',
        data: {
          mosseCardId: mosseCard.id,
          targetCardId: enemies[0].id,
          attackerName: this.playerName,
          targetOwner: enemies[0].owner
        }
      };
    } else {
      this.sendChatMessage(`Non posso attaccare! ${!mosseCard ? 'Nessuna carta MOSSE' : 'Nessun nemico'}`);
      return null;
    }
  }
  
  // Analyze hand to check if player can play according to rules
  analyzeHandForGameRules(hand: any[]): {canPlay: boolean, hasPersonaggi: boolean, hasMosse: boolean, hasBonus: boolean, missingTypes: string[]} {
    const hasPersonaggi = hand.some(card => card.type === 'personaggi' || card.type === 'personaggi_speciali');
    const hasMosse = hand.some(card => card.type === 'mosse');
    const hasBonus = hand.some(card => card.type === 'bonus');
    
    const missingTypes = [];
    if (!hasPersonaggi) missingTypes.push('PERSONAGGI');
    if (!hasMosse) missingTypes.push('MOSSE');
    if (!hasBonus) missingTypes.push('BONUS');
    
    const canPlay = hasPersonaggi && hasMosse && hasBonus;
    
    console.log(`CPU ${this.playerName} hand analysis: PERSONAGGI=${hasPersonaggi}, MOSSE=${hasMosse}, BONUS=${hasBonus}, canPlay=${canPlay}`);
    
    return {
      canPlay,
      hasPersonaggi,
      hasMosse,
      hasBonus,
      missingTypes
    };
  }
  
  // Ask human players for advice
  askForAdvice(handAnalysis: any) {
    const questions = [
      `Ho solo ${handAnalysis.missingTypes.length > 0 ? 'alcune' : 'tutte le'} carte necessarie. Cosa mi consigli di fare?`,
      `Mi mancano carte di tipo: ${handAnalysis.missingTypes.join(', ')}. Quale dovrei pescare prima?`,
      `Non riesco a giocare perché mi servono 3 tipi di carte diverse. Aiutami con la strategia!`,
      `So che per giocare servono PERSONAGGI, MOSSE e BONUS. Mi mancano: ${handAnalysis.missingTypes.join(', ')}. Che faccio?`
    ];
    
    const question = questions[Math.floor(Math.random() * questions.length)];
    this.currentQuestion = question;
    this.waitingForResponse = true;
    
    this.sendChatMessage(question);
    
    // Set timeout to stop waiting for response after 30 seconds
    setTimeout(() => {
      if (this.waitingForResponse) {
        this.waitingForResponse = false;
        this.sendChatMessage("Ok, proverò da solo allora!");
      }
    }, 30000);
  }
  
  // Decide card to pick based on game rules
  decideCardToPickBasedOnRules(gameState: any, handAnalysis: any): any {
    const availableDecks = [];
    
    if (gameState.decks.personaggi && gameState.decks.personaggi.length > 0) {
      availableDecks.push('personaggi');
    }
    if (gameState.decks.mosse && gameState.decks.mosse.length > 0) {
      availableDecks.push('mosse');
    }
    if (gameState.decks.bonus && gameState.decks.bonus.length > 0) {
      availableDecks.push('bonus');
    }
    if (gameState.decks.personaggi_speciali && gameState.decks.personaggi_speciali.length > 0) {
      availableDecks.push('personaggi_speciali');
    }
    
    if (availableDecks.length === 0) return null;
    
    // Priority based on missing types
    let preferredDeck;
    
    if (!handAnalysis.hasPersonaggi && availableDecks.includes('personaggi')) {
      preferredDeck = 'personaggi';
    } else if (!handAnalysis.hasPersonaggi && availableDecks.includes('personaggi_speciali')) {
      preferredDeck = 'personaggi_speciali';
    } else if (!handAnalysis.hasMosse && availableDecks.includes('mosse')) {
      preferredDeck = 'mosse';
    } else if (!handAnalysis.hasBonus && availableDecks.includes('bonus')) {
      preferredDeck = 'bonus';
    } else {
      // Pick any available deck
      preferredDeck = availableDecks[0];
    }
    
    return {
      type: 'pick-card',
      data: {
        deckType: preferredDeck,
        playerName: this.playerName
      }
    };
  }
  
  // Decide which type of card to pick (fallback method)
  decideCardToPick(gameState: any): any {
    const cpuPlayer = gameState.players[this.playerName];
    if (!cpuPlayer) return null;
    
    const handAnalysis = this.analyzeHandForGameRules(cpuPlayer.hand || []);
    return this.decideCardToPickBasedOnRules(gameState, handAnalysis);
  }

  // Helper function to extract card name from URL
  getCardNameFromUrl(url: string): string {
    if (!url) return "Carta Sconosciuta";
    
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename
      .toLowerCase()
      .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Check if this is the opening sequence
  isOpeningSequence(cpuPlayer: any, gameState: any): boolean {
    // Opening sequence is active if phase is not completed
    const isInOpeningSequence = this.openingSequenceState.phase !== 'completed';
    
    // Reset opening sequence if CPU already has a character on field from previous games
    const hasCharacterOnField = gameState.field.some((card: any) => 
      card.owner === this.playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali')
    );
    
    if (hasCharacterOnField && this.openingSequenceState.phase === 'pick-initial') {
      console.log(`CPU ${this.playerName} already has character on field, skipping opening sequence`);
      this.openingSequenceState.phase = 'completed';
      return false;
    }
    
    console.log(`CPU ${this.playerName} opening check: phase=${this.openingSequenceState.phase}, isInSequence=${isInOpeningSequence}, hasCharacterOnField=${hasCharacterOnField}`);
    
    return isInOpeningSequence;
  }

  // Execute the opening sequence according to MINKIARDS rules
  async executeOpeningSequence(gameState: any): Promise<any> {
    const cpuPlayer = gameState.players[this.playerName];
    
    switch (this.openingSequenceState.phase) {
      case 'pick-initial':
        return this.executeInitialCardPicking(gameState);
        
      case 'play-character':
        return this.executePlayCharacter(gameState);
        
      case 'pick-replacement':
        return this.executePickReplacement(gameState);
        
      default:
        console.log(`CPU ${this.playerName} opening sequence completed - starting regular turn logic`);
        this.openingSequenceState.phase = 'completed';
        
        // CRITICAL FIX: Reset turn state and start normal turn logic
        this.resetTurnState();
        this.turnState.phase = 'draw_needed';
        
        // Start the normal turn logic immediately
        return this.handleDrawPhase(gameState.players[this.playerName], gameState);
    }
  }

  // Phase 1: Pick initial 3 cards (PERSONAGGI, MOSSE, BONUS) - all at once
  executeInitialCardPicking(gameState: any): any {
    const neededTypes = ['personaggi', 'mosse', 'bonus'];
    const remainingTypes = neededTypes.filter(type => 
      !this.openingSequenceState.pickedCards.includes(type)
    );
    
    console.log(`CPU ${this.playerName} executing initial card picking. Remaining types:`, remainingTypes);
    
    // Check if we need to pick all 3 cards at once
    if (remainingTypes.length === 3) {
      this.sendChatMessage("Inizio partita! Pesco le mie 3 carte iniziali: PERSONAGGI, MOSSE e BONUS.");
      
      // Mark all types as picked and move to next phase
      this.openingSequenceState.pickedCards = ['personaggi', 'mosse', 'bonus'];
      this.openingSequenceState.phase = 'play-character';
      
      // Return action to pick all 3 cards
      return {
        type: 'pick-opening-cards',
        data: {
          types: ['personaggi', 'mosse', 'bonus'],
          playerName: this.playerName
        }
      };
    }
    
    // If we somehow end up here, move to next phase
    this.openingSequenceState.phase = 'play-character';
    return null;
  }

  // Phase 2: Play the PERSONAGGI card
  executePlayCharacter(gameState: any): any {
    const cpuPlayer = gameState.players[this.playerName];
    
    // Find a PERSONAGGI card in hand
    const personaggioCard = cpuPlayer.hand?.find((card: any) => 
      card.type === 'personaggi' || card.type === 'personaggi_speciali'
    );
    
    if (personaggioCard) {
      console.log(`CPU ${this.playerName} playing initial character: ${personaggioCard.id}`);
      this.sendChatMessage("Metto in campo il mio personaggio!");
      
      // Move to next phase
      this.openingSequenceState.phase = 'pick-replacement';
      
      return {
        type: 'play-card',
        data: {
          cardId: personaggioCard.id,
          playerName: this.playerName
        }
      };
    }
    
    // If no character to play, move to next phase
    this.openingSequenceState.phase = 'pick-replacement';
    return null;
  }

  // Phase 3: Pick replacement PERSONAGGI card
  executePickReplacement(gameState: any): any {
    // Check if CPU already has a PERSONAGGI card in hand
    const cpuPlayer = gameState.players[this.playerName];
    const hasPersonaggioInHand = cpuPlayer.hand?.some((card: any) => 
      card.type === 'personaggi' || card.type === 'personaggi_speciali'
    );

    // If CPU already has a personaggio in hand, complete opening and start normal gameplay
    if (hasPersonaggioInHand) {
      console.log(`CPU ${this.playerName} already has personaggio in hand, starting normal gameplay`);
      this.sendChatMessage("Ho già le carte, ora gioco attivamente!");
      this.openingSequenceState.phase = 'completed';
      
      // CRITICAL FIX: Reset turn state and start normal turn logic
      this.resetTurnState();
      this.turnState.phase = 'draw_needed';
      
      // Start the normal turn logic immediately
      return this.handleDrawPhase(cpuPlayer, gameState);
    }

    // Check if PERSONAGGI deck has cards and CPU can draw
    if (gameState.decks.personaggi && gameState.decks.personaggi.length > 0) {
      console.log(`CPU ${this.playerName} picking replacement character`);
      this.sendChatMessage("Pesco un nuovo personaggio e finisco il turno!");
      
      // Complete the opening sequence
      this.openingSequenceState.phase = 'completed';
      
      return {
        type: 'pick-card',
        data: {
          deckType: 'personaggi',
          playerName: this.playerName
        }
      };
    }
    
    // If no cards to pick, just complete the sequence
    this.openingSequenceState.phase = 'completed';
    this.sendChatMessage("Sequenza di apertura completata!");
    return null;
  }

  // Generate strategy announcement with more variety
  private getStrategyAnnouncement(analysis: GameAnalysis): string {
    const action = analysis.recommendedAction;
    
    switch (action.type) {
      case 'play_card':
        if (action.reasoning.includes('personaggio')) {
          return this.getRandomChatResponse('playing_character');
        }
        return analysis.handCards.length > 3 
          ? "Ho molte opzioni, scelgo questa carta" 
          : "Gioco questa carta strategicamente";
      case 'attack':
        return this.getRandomChatResponse('attacking');
      case 'switch_character':
        return "Cambio tattica, nuovo personaggio in arrivo!";
      case 'buy_power':
        return "Investo in un potere speciale!";
      default:
        return this.getRandomChatResponse('thinking');
    }
  }

  // Process human chat messages to respond appropriately and follow advice
  processHumanChat(message: string, senderName: string): boolean {
    console.log(`CPU ${this.playerName} processing human chat: "${message}" from ${senderName}`);
    const lowerMessage = message.toLowerCase();
    
    // If waiting for response to our question, process the advice
    if (this.waitingForResponse) {
      console.log(`CPU ${this.playerName} was waiting for response, processing advice`);
      this.processAdvice(message, senderName);
      return true;
    }
    
    // NEW: Execute direct orders from human players
    const orderResult = this.executeDirectOrder(message, senderName, lowerMessage);
    if (orderResult) {
      return true;
    }
    
    // Respond to greetings
    if (lowerMessage.includes('ciao') || lowerMessage.includes('salve') || lowerMessage.includes('buongiorno')) {
      console.log(`CPU ${this.playerName} responding to greeting`);
      setTimeout(() => {
        this.sendChatMessage(`Ciao ${senderName}! Dimmi, conosci bene le regole di MINKIARDS?`);
      }, 1000 + Math.random() * 2000);
      return true;
    }
    
    // Respond to advice/instructions (even when not explicitly waiting)
    if (lowerMessage.includes('pesca') || lowerMessage.includes('prendi') || lowerMessage.includes('carta')) {
      this.processAdvice(message, senderName);
      return true;
    }
    
    if (lowerMessage.includes('gioca') || lowerMessage.includes('usa') || lowerMessage.includes('attacca')) {
      this.processAdvice(message, senderName);
      return true;
    }
    
    // Respond to questions about strategy
    if (lowerMessage.includes('strategia') || lowerMessage.includes('cosa fai') || lowerMessage.includes('che farai')) {
      setTimeout(() => {
        const responses = [
          "Sto imparando le regole: servono 3 tipi di carte per giocare bene!",
          "Vorrei capire meglio quando è il momento giusto per attaccare",
          "Mi stai insegnando molto su questo gioco!",
          "Hai qualche consiglio per la mia prossima mossa?"
        ];
        this.sendChatMessage(responses[Math.floor(Math.random() * responses.length)]);
      }, 1000 + Math.random() * 2000);
      return true;
    }
    
    // Respond to direct questions to the CPU
    if (lowerMessage.includes(this.playerName.toLowerCase()) || lowerMessage.includes('cpu')) {
      console.log(`CPU ${this.playerName} responding to direct question`);
      setTimeout(() => {
        const responses = [
          "Sì? Hai un consiglio per me?",
          "Ti ascolto! Cosa devo fare?",
          "Dimmi, cosa mi consigli?",
          "Sono qui, aiutami a migliorare!"
        ];
        this.sendChatMessage(responses[Math.floor(Math.random() * responses.length)]);
      }, 500 + Math.random() * 1500);
      return true;
    }
    
    // Always respond to any human message with a simple response (fallback)
    if (Math.random() < 0.4) { // 40% chance to respond to any message
      console.log(`CPU ${this.playerName} giving random response to message`);
      setTimeout(() => {
        const responses = [
          "Interessante!",
          "Capisco...",
          "Grazie per il suggerimento!",
          "Sto imparando molto da voi!",
          "Buona strategia!",
          "Dici davvero?",
          "Hmm, ci penserò!"
        ];
        this.sendChatMessage(responses[Math.floor(Math.random() * responses.length)]);
      }, 2000 + Math.random() * 3000);
      return true;
    }
    
    console.log(`CPU ${this.playerName} finished processing chat message, no specific response triggered`);
    return false;
  }
    
  // Process advice from human players
  processAdvice(message: string, senderName: string): void {
    const lowerMessage = message.toLowerCase();
    this.conversationHistory.push({
      type: 'answer',
      content: message,
      timestamp: Date.now()
    });
    
    // Extract deck type from advice
    let advisedDeck = null;
    if (lowerMessage.includes('personaggi') || lowerMessage.includes('personaggio')) {
      advisedDeck = 'personaggi';
    } else if (lowerMessage.includes('mosse') || lowerMessage.includes('mossa')) {
      advisedDeck = 'mosse';
    } else if (lowerMessage.includes('bonus')) {
      advisedDeck = 'bonus';
    } else if (lowerMessage.includes('speciali') || lowerMessage.includes('speciale')) {
      advisedDeck = 'personaggi_speciali';
    }
    
    // Respond to the advice
    setTimeout(() => {
      if (advisedDeck) {
        this.sendChatMessage(`Perfetto ${senderName}! Proverò a pescare da ${advisedDeck}. Grazie del consiglio!`);
        // Store the advice for next turn
        this.lastAdvice = {
          type: 'pick-card',
          deckType: advisedDeck,
          from: senderName,
          timestamp: Date.now()
        };
      } else if (lowerMessage.includes('gioca') || lowerMessage.includes('attacca')) {
        this.sendChatMessage(`Hai ragione ${senderName}! Seguirò il tuo consiglio nella prossima mossa.`);
        this.lastAdvice = {
          type: 'play-aggressive',
          from: senderName,
          timestamp: Date.now()
        };
      } else if (lowerMessage.includes('aspetta') || lowerMessage.includes('calma') || lowerMessage.includes('pazienza')) {
        this.sendChatMessage(`Ok ${senderName}, sarò più paziente e aspetterò il momento giusto.`);
        this.lastAdvice = {
          type: 'wait',
          from: senderName,
          timestamp: Date.now()
        };
      } else {
        this.sendChatMessage(`Grazie ${senderName}! Terrò a mente il tuo consiglio.`);
        this.lastAdvice = {
          type: 'general',
          advice: message,
          from: senderName,
          timestamp: Date.now()
        };
      }
      
      // Stop waiting for response if we were
      if (this.waitingForResponse) {
        this.waitingForResponse = false;
      }
    }, 1000 + Math.random() * 2000);
  }
  
  // NEW: Execute direct orders from human players
  executeDirectOrder(message: string, senderName: string, lowerMessage: string): boolean {
    console.log(`CPU ${this.playerName} checking for direct orders from ${senderName}: "${message}"`);
    
    // Order: Show specific card type
    if (lowerMessage.includes('mostra') || lowerMessage.includes('fammi vedere') || lowerMessage.includes('fai vedere')) {
      let cardType = '';
      if (lowerMessage.includes('bonus')) cardType = 'bonus';
      else if (lowerMessage.includes('mosse') || lowerMessage.includes('mossa')) cardType = 'mosse';
      else if (lowerMessage.includes('personaggi') || lowerMessage.includes('personaggio')) cardType = 'personaggi';
      
      if (cardType) {
        this.executeShowCard(cardType, senderName);
        return true;
      }
    }
    
    // Order: Pick/Draw a card
    if ((lowerMessage.includes('pesca') || lowerMessage.includes('prendi')) && lowerMessage.includes('carta')) {
      let deckType = '';
      if (lowerMessage.includes('bonus')) deckType = 'bonus';
      else if (lowerMessage.includes('mosse') || lowerMessage.includes('mossa')) deckType = 'mosse';
      else if (lowerMessage.includes('personaggi') || lowerMessage.includes('personaggio')) deckType = 'personaggi';
      else if (lowerMessage.includes('speciali')) deckType = 'personaggi_speciali';
      
      if (deckType) {
        this.executePickCard(deckType, senderName);
        return true;
      }
    }
    
    // Order: Play a card
    if (lowerMessage.includes('gioca') && (lowerMessage.includes('carta') || lowerMessage.includes('mano'))) {
      let cardType = '';
      if (lowerMessage.includes('bonus')) cardType = 'bonus';
      else if (lowerMessage.includes('mosse') || lowerMessage.includes('mossa')) cardType = 'mosse';
      else if (lowerMessage.includes('personaggi') || lowerMessage.includes('personaggio')) cardType = 'personaggi';
      
      this.executePlayCard(cardType, senderName);
      return true;
    }
    
    // Order: Attack with MOSSE
    if (lowerMessage.includes('attacca') || lowerMessage.includes('usa') && (lowerMessage.includes('mosse') || lowerMessage.includes('mossa'))) {
      this.executeAttack(senderName);
      return true;
    }
    
    // Order: End turn
    if (lowerMessage.includes('fine turno') || lowerMessage.includes('finisci il turno') || lowerMessage.includes('passa il turno')) {
      console.log(`CPU ${this.playerName} received end turn command from ${senderName}`);
      this.sendChatMessage(`D'accordo ${senderName}, finisco il mio turno!`);
      
      // Reset turn state and force turn end
      this.resetTurnState();
      this.pendingOrder = {
        type: 'end-turn',
        senderName: senderName,
        message: `${this.playerName} termina il turno su richiesta di ${senderName}`
      };
      
      return true;
    }
    
    return false;
  }
  
  // Execute show card order
  executeShowCard(cardType: string, senderName: string): void {
    console.log(`CPU ${this.playerName} executing show card order: ${cardType} to ${senderName}`);
    
    // Get current game state to find the card
    setTimeout(() => {
      this.sendChatMessage(`Certo ${senderName}! Ti mostro la mia carta ${cardType.toUpperCase()}.`);
      
      // Store the order for processing during next CPU turn
      this.pendingOrder = {
        type: 'show-card',
        cardType: cardType,
        senderName: senderName,
        message: `${this.playerName} sta mostrando la sua carta ${cardType.toUpperCase()} su richiesta di ${senderName}`
      };
      
      console.log(`CPU ${this.playerName} stored pending show card order:`, this.pendingOrder);
    }, 1000);
  }
  
  // Execute pick card order
  executePickCard(deckType: string, senderName: string): void {
    console.log(`CPU ${this.playerName} executing pick card order: ${deckType} requested by ${senderName}`);
    
    setTimeout(() => {
      this.sendChatMessage(`D'accordo ${senderName}! Pesco una carta dal mazzo ${deckType.toUpperCase()}.`);
      
      // Store the order for processing during next CPU turn
      this.pendingOrder = {
        type: 'pick-card',
        deckType: deckType,
        senderName: senderName
      };
      
      console.log(`CPU ${this.playerName} stored pending pick card order:`, this.pendingOrder);
    }, 1000);
  }
  
  // Execute play card order
  executePlayCard(cardType: string, senderName: string): void {
    console.log(`CPU ${this.playerName} executing play card order: ${cardType} requested by ${senderName}`);
    
    setTimeout(() => {
      this.sendChatMessage(`Come desideri ${senderName}! Gioco la mia carta ${cardType ? cardType.toUpperCase() : 'dalla mano'}.`);
      
      // Store the order for processing during next CPU turn
      this.pendingOrder = {
        type: 'play-card',
        cardType: cardType,
        senderName: senderName
      };
      
      console.log(`CPU ${this.playerName} stored pending play card order:`, this.pendingOrder);
    }, 1000);
  }
  
  // Execute attack order
  executeAttack(senderName: string): void {
    console.log(`CPU ${this.playerName} executing attack order requested by ${senderName}`);
    
    setTimeout(() => {
      this.sendChatMessage(`Va bene ${senderName}! Userò la mia carta MOSSE per attaccare!`);
      
      // Store the order for processing during next CPU turn
      this.pendingOrder = {
        type: 'attack',
        senderName: senderName
      };
      
      console.log(`CPU ${this.playerName} stored pending attack order:`, this.pendingOrder);
    }, 1000);
  }
}