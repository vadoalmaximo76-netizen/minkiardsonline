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
  private waitingForAttackResolution: boolean = false; // NEW: Wait for MOSSE attack to complete before ending turn
  private attackResolutionSafetyTimer: ReturnType<typeof setTimeout> | null = null; // Safety timer to prevent deadlock
  private currentQuestion: string = '';
  private conversationHistory: Array<{type: 'question' | 'answer', content: string, timestamp: number}> = [];
  private socketEmitter: any;
  private lastAdvice: any = null;
  public lastAttackRequiresDefense: boolean = false; // Flag for defense:request emission
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
  private gymLeaderMessages: Record<string, string[]> | null = null;
  private attackMode: 'free_for_all' | 'hunt_human' = 'free_for_all';

  setAttackMode(mode: 'free_for_all' | 'hunt_human') {
    this.attackMode = mode;
  }

  getAttackMode(): 'free_for_all' | 'hunt_human' {
    return this.attackMode;
  }

  constructor(playerName: string, gameId: string, socketEmitter?: any) {
    this.playerName = playerName;
    this.gameId = gameId;
    this.socketEmitter = socketEmitter;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  setLeaderMessages(messages: Record<string, string[]>) {
    this.gymLeaderMessages = messages;
  }

  pickLeaderMessage(occasion: string): string | null {
    if (!this.gymLeaderMessages) return null;
    const msgs = this.gymLeaderMessages[occasion];
    if (!Array.isArray(msgs) || msgs.length === 0) return null;
    const filtered = msgs.filter((m: string) => typeof m === 'string' && m.trim() !== '');
    if (filtered.length === 0) return null;
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  // Reset opening sequence for new game
  resetOpeningSequence() {
    this.openingSequenceState = { 
      phase: 'pick-initial', 
      pickedCards: [] 
    };
    console.log(`CPU ${this.playerName} opening sequence reset for new game`);
  }

  // NEW: Mark that attack has been resolved and CPU can continue
  resolveAttack() {
    this.waitingForAttackResolution = false;
    // CRITICAL: Continue turn instead of ending it - CPU should keep playing
    this.turnState.executedThisTurn = true;
    // DO NOT set phase to 'turn_end' - let takeTurn() decide what to do next
    console.log(`🎯 CPU ${this.playerName}: Attack resolved - continuing turn to play more cards`);
  }

  // PUBLIC GETTER: Check if CPU is waiting for attack resolution
  isWaitingForAttack(): boolean {
    return this.waitingForAttackResolution;
  }

  // Parse a preset/fixed damage value from a card's effect text.
  // Returns { damage: number, effect: string | null } if the card has a deterministic
  // damage that doesn't require manual input, otherwise { damage: null, effect: null }.
  private parsePresetDamageFromEffect(effect: string | null | undefined, cardName: string | null | undefined): { damage: number | null; effect: string | null } {
    const text = [effect, cardName].filter(Boolean).join(' ');
    if (!text) return { damage: null, effect: null };

    // Special effect patterns (no numeric damage, but auto-submittable)
    if (/\bmorte\b.*personaggio|personaggio.*\bmorte\b|\buccide\b|\bmorte\s+istantanea\b/i.test(text)) {
      return { damage: 0, effect: 'death' };
    }
    if (/dimezza\s+(?:i\s+)?pti|pti\s+dimezz/i.test(text)) {
      return { damage: 0, effect: 'halve_pti' };
    }

    // Numeric flat-damage patterns (order matters — most specific first)
    const numericPatterns = [
      /infligi[e]?\s+(\d+)\s*pti/i,           // "Infligge 200 PTI"
      /causa\s+(\d+)\s*pti/i,                  // "Causa 200 PTI"
      /(\d+)\s*pti\s+(?:di\s+)?danno/i,       // "200 PTI di danno"
      /danno\s*(?:fisso|preimpostato)\s*:?\s*(\d+)/i, // "danno fisso: 200"
    ];

    for (const pattern of numericPatterns) {
      const match = text.match(pattern);
      if (match) {
        return { damage: parseInt(match[1], 10), effect: null };
      }
    }

    return { damage: null, effect: null };
  }

  // NEW: Turn state management methods
  resetTurnState() {
    this.turnState = {
      phase: 'draw_needed',
      drawnThisTurn: false,
      playedThisTurn: false,
      executedThisTurn: false
    };
    // CRITICAL: Reset attack flag so CPU can play in next turn
    this._clearAttackSafetyTimer();
    this.waitingForAttackResolution = false;
    console.log(`CPU ${this.playerName} turn state reset (attack flag cleared)`);
  }

  private _clearAttackSafetyTimer() {
    if (this.attackResolutionSafetyTimer !== null) {
      clearTimeout(this.attackResolutionSafetyTimer);
      this.attackResolutionSafetyTimer = null;
    }
  }

  private _setWaitingForAttackResolution(value: boolean) {
    this.waitingForAttackResolution = value;
    if (value) {
      // Start a 15-second safety timer: if attack never resolves, unblock the CPU
      this._clearAttackSafetyTimer();
      this.attackResolutionSafetyTimer = setTimeout(() => {
        if (this.waitingForAttackResolution) {
          console.warn(`⚠️ CPU ${this.playerName}: attack resolution safety timer fired — unblocking CPU after 15s`);
          this.waitingForAttackResolution = false;
          this.attackResolutionSafetyTimer = null;
        }
      }, 15000);
    } else {
      this._clearAttackSafetyTimer();
    }
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
    // verbose: marked completed
  }

  // NEW: Deterministic target selection for MOSSE attacks
  private extractPtiFromCard(card: any): number {
    const notes = card.notes || card.text || '';
    const m = notes.match(/PTI[:\s]*(\d+)/i);
    return m ? parseInt(m[1]) : (card.pti ?? 100);
  }

  private extractStarsFromCard(card: any): number {
    const notes = card.notes || card.text || '';
    const m = notes.match(/(?:stelle|stars)[:\s]*(\d+)/i);
    return m ? parseInt(m[1]) : (card.stars ?? 1);
  }

  pickEnemyTarget(): { cardId: string; owner: string; name: string } | null {
    if (!this.gameManager) return null;
    const gameState = this.gameManager.getGameState(this.gameId);
    if (!gameState) return null;

    let enemies = gameState.field.filter((card: any) => 
      (card.type === 'personaggi' || card.type === 'personaggi_speciali') && 
      card.owner !== this.playerName && 
      !card.eliminatedBy && 
      !card.faceDown
    );

    // Hunt-human mode: CPU targets only human players, ignoring other CPUs
    if (this.attackMode === 'hunt_human') {
      const humanEnemies = enemies.filter((card: any) => {
        const player = gameState.players?.[card.owner];
        return player && !player.isCPU;
      });
      if (humanEnemies.length > 0) {
        enemies = humanEnemies;
        console.log(`🎯 [hunt_human] CPU ${this.playerName} targeting human-only (${humanEnemies.length} targets)`);
      }
    }

    if (enemies.length === 0) return null;

    const myChar = gameState.field.find((c: any) =>
      c.owner === this.playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
    );
    const myDmg = myChar ? this.getMyAttackDamage(gameState) : 50;

    let target = enemies[0];
    let bestScore = -Infinity;

    for (const enemy of enemies) {
      const pti = this.extractPtiFromCard(enemy);
      const stars = this.extractStarsFromCard(enemy);
      const canKill = pti > 0 && pti <= myDmg;
      const threatScore = stars * 50 + pti;
      const score = canKill ? 100000 + threatScore : threatScore;

      if (score > bestScore) {
        bestScore = score;
        target = enemy;
      }
    }

    let targetName = 'personaggio nemico';
    if (target.frontImage) {
      try {
        const url = new URL(target.frontImage);
        const filename = url.pathname.split('/').pop() || '';
        targetName = filename.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase();
      } catch {
        targetName = 'personaggio nemico';
      }
    }

    console.log(`🤖 CPU ${this.playerName} target: ${targetName} (PTI=${this.extractPtiFromCard(target)}, ★=${this.extractStarsFromCard(target)}, killable=${this.extractPtiFromCard(target) <= myDmg})`);
    
    return { cardId: target.id, owner: target.owner, name: targetName };
  }

  private getMyAttackDamage(gameState: any): number {
    const mosseOnField = gameState.field.find((c: any) => c.owner === this.playerName && c.type === 'mosse');
    if (mosseOnField && mosseOnField.mosseDamageValue) return mosseOnField.mosseDamageValue;
    const mosseInHand = (gameState.players[this.playerName]?.hand || []).find((c: any) => c.type === 'mosse');
    if (mosseInHand && mosseInHand.mosseDamageValue) return mosseInHand.mosseDamageValue;
    return 50;
  }

  // NEW: Pick enemy character from HAND (for ATTACCO DISONESTO)
  pickEnemyHandTarget(): { cardId: string; owner: string; name: string; isHandCard: true } | null {
    if (!this.gameManager) {
      console.error(`CPU ${this.playerName}: No gameManager for hand target selection`);
      return null;
    }
    const gameState = this.gameManager.getGameState(this.gameId);
    if (!gameState) return null;

    // Find all enemy players
    const enemyPlayers = Object.values(gameState.players).filter((p: any) => p.name !== this.playerName);
    if (enemyPlayers.length === 0) return null;

    // Collect all personaggi/personaggi_speciali from enemy hands
    let handTargets: any[] = [];
    for (const enemy of enemyPlayers) {
      const enemyHand = (enemy as any).hand || [];
      const characterCards = enemyHand.filter((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali');
      for (const card of characterCards) {
        handTargets.push({
          card,
          owner: (enemy as any).name
        });
      }
    }

    if (handTargets.length === 0) {
      console.log(`CPU ${this.playerName}: No hand targets found for ATTACCO DISONESTO`);
      return null;
    }

    // Pick random hand target (could be optimized)
    const selectedTarget = handTargets[Math.floor(Math.random() * handTargets.length)];
    const targetName = this.getCardNameFromUrl(selectedTarget.card.frontImage);

    console.log(`🎯 CPU ${this.playerName}: ATTACCO DISONESTO selected hand target: ${selectedTarget.card.id} (${targetName}) from ${selectedTarget.owner}'s hand`);
    
    return {
      cardId: selectedTarget.card.id,
      owner: selectedTarget.owner,
      name: targetName,
      isHandCard: true
    };
  }

  canEndTurn(): boolean {
    return this.turnState.executedThisTurn && this.turnState.phase === 'turn_end';
  }

  isInOpeningSequence(): boolean {
    return this.openingSequenceState.phase !== 'completed';
  }

  completeOpeningSequence(): void {
    this.openingSequenceState.phase = 'completed';
    this.openingSequenceState.pickedCards = ['personaggi', 'mosse', 'bonus'];
    this.resetTurnState();
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
      // DB lookup
      
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
        // DB found
        return {
          pti: result[0].pti,
          stars: result[0].stars
        };
      }
      
      // DB not found
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
      // card analyzed
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
      // auto-updating notes
      
      // Analyze the card image to extract PTI and stars
      const cardAnalysis = await this.analyzeCardImage(cardImage);
      
      if (cardAnalysis.cardType === 'personaggi' || cardAnalysis.cardType === 'personaggi_speciali') {
        const pti = cardAnalysis.points || 1000;
        const stars = cardAnalysis.stars || 1;
        const powers = cardAnalysis.effect || cardAnalysis.powers || '';
        
        // Create comprehensive notes
        const notes = `PTI: ${pti} | Stelle: ${stars}` + (powers ? ` | Poteri: ${powers}` : '');
        
        // notes set
        
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
      
      // Send chat message about the damage (use custom leader messages if available)
      if (newPTI > 0) {
        const customMsg = this.pickLeaderMessage('takeMossa');
        this.sendChatMessage(customMsg ?? `Il mio personaggio ha subito ${totalDamage} danni! PTI rimanenti: ${newPTI}`);
      } else {
        const customMsg = this.pickLeaderMessage('ownPersonaggioDies');
        this.sendChatMessage(customMsg ?? `Nooo! Il mio personaggio è stato eliminato con ${totalDamage} danni!`);
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
        // move card analyzed
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
      const myCharacter = gameState.field.find((card: any) => card.owner === this.playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali'));
      
      // Find enemy characters on the field
      const enemyCharacters = gameState.field.filter((card: any) => 
        card.owner !== this.playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali')
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
      // CPU not in game state
      return null;
    }
    
    if (!cpuPlayer.hand || cpuPlayer.hand.length === 0) {
      // CPU has no cards
      return null;
    }

    // executing action

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
          
          const cardName = this.getCardNameFromUrl(mosseOnField.frontImage);
          const targetName = this.getCardNameFromUrl(targetCard.frontImage);
          
          const isFurto = cardName.toUpperCase() === 'FURTO' || cardName.toUpperCase().includes('FURTO');
          
          let cpuDamageValue = (mosseOnField as any).mosseDamageValue || 0;
          const cpuAttackerChar = gameState?.field?.find((c: any) => 
            c.owner === this.playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
          );
          const cpuAttackerStars = cpuAttackerChar?.stars ?? 1;
          if (cpuDamageValue > 0) {
            cpuDamageValue = cpuDamageValue * cpuAttackerStars;
          } else if (isFurto) {
            cpuDamageValue = cpuAttackerStars;
          }
          
          if (isFurto) {
            this.sendChatMessage(`Uso FURTO per rubare ${cpuDamageValue} stelle a ${targetName}!`);
          } else {
            this.sendChatMessage(`Uso la carta MOSSE "${cardName}" per attaccare ${targetName}!`);
          }
          
          if (this.socketEmitter) {
            this.socketEmitter.emit('mosse-attack', {
              mosseCardId: mosseOnField.id,
              targetCardId: action.target,
              attackerName: this.playerName,
              targetOwner: targetCard.owner,
              damageValue: cpuDamageValue || undefined,
              isFurtoAttack: isFurto,
              mosseEffect: (mosseOnField as any).mosseDamageEffect || undefined
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
              targetName,
              isFurtoAttack: isFurto,
              damageValue: cpuDamageValue || undefined
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

    // could not execute
    return null;
  }

  // Send chat message to game
  sendChatMessage(message: string, forceEvenInGymMode: boolean = false) {
    // In gym mode with custom messages, suppress all standard CPU chatter
    if (this.gymLeaderMessages && !forceEvenInGymMode) return;
    if (this.socketEmitter) {
      const chatMessage = {
        id: `${Date.now()}-${Math.random()}`,
        playerName: this.playerName,
        message,
        timestamp: Date.now()
      };
      this.socketEmitter.to(this.gameId).emit('chat-message', chatMessage);
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

    const myCharacter = gameState.field.find((card: any) => card.owner === this.playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali'));
    const enemyCharacters = gameState.field.filter((card: any) => card.owner !== this.playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali'));

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
      // CRITICAL FIX: Always reset stale attack/response flags at the start of a new turn
      // These flags should NEVER persist across turns - they only apply within a single turn's action
      if (this.waitingForAttackResolution) {
        console.log(`🔧 CPU ${this.playerName}: Clearing stale waitingForAttackResolution flag at turn start`);
        this.waitingForAttackResolution = false;
      }
      if (this.waitingForResponse) {
        console.log(`🔧 CPU ${this.playerName}: Clearing stale waitingForResponse flag at turn start`);
        this.waitingForResponse = false;
      }
      
      // Reset turn state if stale (from previous turn)
      if (this.turnState.phase !== 'draw_needed' || this.turnState.playedThisTurn) {
        console.log(`🔧 CPU ${this.playerName}: New turn detected - resetting stale state (phase=${this.turnState.phase}, played=${this.turnState.playedThisTurn})`);
        this.resetTurnState();
      }
      
      // verbose: thinking
      
      // If waiting for response, don't take action
      if (this.waitingForResponse) {
        // verbose: waiting
        return null;
      }
      
      // NEW: If waiting for attack resolution, don't take action
      if (this.waitingForAttackResolution) {
        // verbose: waiting for attack
        return null;
      }
      
      // REMOVED: Attack resolution no longer forces turn end - CPU continues playing
      
      let cpuPlayer = gameState.players[this.playerName];
      if (!cpuPlayer) {
        // CPU not in game state
        return null;
      }
      
      // DUELLO: Check if CPU is in an active duel and handle automatically
      if (gameState.activeDuel && gameState.activeDuel.active) {
        const duel = gameState.activeDuel;
        const isInDuel = (duel.player1 && duel.player1 === this.playerName) || 
                          (duel.player2 && duel.player2 === this.playerName);
        
        // If CPU is in duel but it's not their turn, wait (no-op)
        if (isInDuel && duel.currentTurn !== this.playerName) {
          console.log(`⚔️ DUELLO: CPU ${this.playerName} waiting for opponent's turn`);
          return null;
        }
        
        if (isInDuel && duel.currentTurn === this.playerName) {
          console.log(`⚔️ DUELLO: CPU ${this.playerName} is in active duel - auto-executing MOSSE attack`);
          
          // Get opponent's character in the duel (simple and correct)
          const opponentCharacterId = duel.player1 === this.playerName ? duel.character2Id : duel.character1Id;
          
          // SAFETY: Check if CPU still has a character on the field
          const cpuCharOnField = gameState.field.find((c: any) =>
            c.owner === this.playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
          );
          if (!cpuCharOnField) {
            console.log(`⚔️ DUELLO: CPU ${this.playerName} has no character on field - ending duel and falling through to normal turn`);
            // Force-end the duel server-side
            if (this.gameManager) {
              const ioG = (global as any).io;
              const opponentPlayer = duel.player1 === this.playerName ? duel.player2 : duel.player1;
              this.gameManager.endDuel(this.gameId, `CPU ${this.playerName} has no character on field`);
              if (ioG) {
                ioG.to(this.gameId).emit('duel-ended', { winner: opponentPlayer, reason: 'character_death' });
                const gs = this.gameManager.getSanitizedGameState(this.gameId);
                if (gs) ioG.to(this.gameId).emit('game-state-update', gs);
              }
            }
            // Fall through to normal turn to play a new personaggio
          } else if (!opponentCharacterId || !gameState.field.find((c: any) => c.id === opponentCharacterId)) {
            // Opponent's duel character is gone — end the duel
            console.log(`⚔️ DUELLO: Opponent duel character ${opponentCharacterId} no longer on field - ending duel`);
            if (this.gameManager) {
              const ioG = (global as any).io;
              this.gameManager.endDuel(this.gameId, `Opponent duel character ${opponentCharacterId} gone`);
              if (ioG) {
                ioG.to(this.gameId).emit('duel-ended', { winner: this.playerName, reason: 'character_death' });
                const gs = this.gameManager.getSanitizedGameState(this.gameId);
                if (gs) ioG.to(this.gameId).emit('game-state-update', gs);
              }
            }
            // Fall through to normal turn
          } else {
          
          // Check if CPU has MOSSE card
          const mosseInHand = cpuPlayer.hand.find((c: any) => c.type === 'mosse');
          const mosseOnField = gameState.field.find((c: any) => 
            c.owner === this.playerName && c.type === 'mosse'
          );
          
          if (!mosseInHand && !mosseOnField) {
            // Need to draw MOSSE card first
            this.sendChatMessage(`⚔️ DUELLO: Pesco una carta MOSSE per attaccare!`);
            return {
              type: 'pick-card',
              data: {
                deckType: 'mosse',
                playerName: this.playerName
              }
            };
          } else if (mosseInHand && !mosseOnField) {
            // Need to play MOSSE card on field
            this.sendChatMessage(`⚔️ DUELLO: Gioco la mia carta MOSSE!`);
            this.markActionExecuted('play', mosseInHand.id, 'mosse');
            return {
              type: 'play-card',
              data: {
                cardId: mosseInHand.id,
                playerName: this.playerName
              }
            };
          } else if (mosseOnField) {
            // MOSSE card is on field - execute attack with forced duel target
            console.log(`⚔️ DUELLO: CPU ${this.playerName} executing MOSSE attack on ${opponentCharacterId}`);
            const duelAttackAction = await this.executeMovesCardAndDrawReplacement(mosseOnField.id, gameState, 'mosse', opponentCharacterId);
            // Attack executed atomically (returns null) — schedule endTurn to advance duel turn
            if (!duelAttackAction && this.gameManager && this.socketEmitter) {
              const io = this.socketEmitter;
              const gm = this.gameManager;
              const gid = this.gameId;
              const pName = this.playerName;
              const mosseId = mosseOnField.id;
              setTimeout(() => {
                const freshGs = gm.getGameState(gid);
                if (!freshGs) return;
                const stillOnField = freshGs.field.find((c: any) => c.id === mosseId && c.owner === pName);
                if (stillOnField) gm.returnToDeck(gid, mosseId, pName);
                const duelState = gm.getDuelState(gid);
                if (duelState && duelState.active) {
                  const nxt = gm.endTurn(gid, pName);
                  if (nxt) {
                    io.to(gid).emit('next-turn', { nextPlayer: nxt });
                    const gs = gm.getSanitizedGameState(gid);
                    if (gs) io.to(gid).emit('game-state-update', gs);
                    const fg = gm.getGameState(gid);
                    if (fg && fg.players[nxt]?.isCPU) {
                      setTimeout(() => gm.processCPUTurn(gid, nxt, io), 2000);
                    }
                  }
                }
              }, 2000);
            }
            return duelAttackAction;
          }
          } // end else (CPU has character on field, duel characters still valid)
        }
      }
      
      // DUELLO: Check if CPU has a DUELLO card and should initiate a duel
      if (!gameState.activeDuel || !gameState.activeDuel.active) {
        const duelloInHand = cpuPlayer.hand.find((c: any) => {
          const name = this.getCardNameFromUrl(c.frontImage || '').toUpperCase();
          return name.includes('DUELLO') && (c.type === 'bonus' || c.type === 'mosse');
        });
        
        if (duelloInHand) {
          const hasCharOnField = gameState.field.some((c: any) =>
            c.owner === this.playerName &&
            (c.type === 'personaggi' || c.type === 'personaggi_speciali') &&
            !c.isHostage
          );
          const opponentChars = gameState.field.filter((c: any) =>
            c.owner !== this.playerName &&
            (c.type === 'personaggi' || c.type === 'personaggi_speciali') &&
            !c.isHostage
          );
          
          if (hasCharOnField && opponentChars.length > 0) {
            const bestTarget = opponentChars.reduce((best: any, curr: any) =>
              (curr.pti || 0) < (best.pti || 0) ? curr : best
            , opponentChars[0]);
            
            console.log(`⚔️ DUELLO: CPU ${this.playerName} initiating duel with DUELLO card ${duelloInHand.id} targeting ${bestTarget.id}`);
            this.sendChatMessage(`⚔️ Sfido a DUELLO! Preparati!`);
            
            return {
              type: 'start-duel',
              data: {
                duelCardId: duelloInHand.id,
                initiatorPlayer: this.playerName,
                opponentCharacterId: bestTarget.id
              }
            };
          }
        }
      }
      
      // NEW: Process pending orders from human players first
      if (this.pendingOrder) {
        // processing pending order
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
      if (this.openingSequenceState.phase !== 'completed') {
        // Reset opening sequence if CPU already has a USABLE character on field (not hostaged)
        const hasUsableCharacterOnField = gameState.field.some((card: any) => 
          card.owner === this.playerName && 
          (card.type === 'personaggi' || card.type === 'personaggi_speciali') &&
          !card.isHostage
        );
        
        if (hasUsableCharacterOnField && this.openingSequenceState.phase === 'pick-initial') {
          // skipping opening sequence
          this.openingSequenceState.phase = 'completed';
        } else {
          // opening sequence phase
          
          switch (this.openingSequenceState.phase) {
            case 'pick-initial':
              return this.executeInitialCardPicking(gameState);
            case 'play-character':
              return this.executePlayCharacter(gameState);
            case 'pick-replacement':
              return await this.executePickReplacement(gameState);
            default:
              this.openingSequenceState.phase = 'completed';
          }
        }
      }
      
      // MINKIARDS FUNDAMENTAL RULE: Must have USABLE character on field (not hostaged) to do ANY action except playing a character
      const usableCharacter = gameState.field.find((card: any) => 
        card.owner === this.playerName && 
        (card.type === 'personaggi' || card.type === 'personaggi_speciali') &&
        !card.isHostage // Hostaged characters cannot act
      );
      
      // Check if CPU has a hostaged character (for messaging)
      const hostagedCharacter = gameState.field.find((card: any) => 
        card.owner === this.playerName && 
        (card.type === 'personaggi' || card.type === 'personaggi_speciali') &&
        card.isHostage
      );
      
      if (!usableCharacter) {
        // First priority: Play character from hand if available
        const characterInHand = cpuPlayer.hand.find((c: any) => 
          c.type === 'personaggi' || c.type === 'personaggi_speciali'
        );
        
        if (characterInHand) {
          if (hostagedCharacter) {
            this.sendChatMessage(`Il mio personaggio è in ostaggio! Devo mettere un altro personaggio in campo!`);
          } else {
            this.sendChatMessage(`Devo mettere un personaggio in campo!`);
          }
          // DO NOT mark action as executed - placing a character when you have none usable
          // is a MANDATORY action, not a strategic turn action. The CPU should still be able
          // to play MOSSE/BONUS cards after placing the replacement character.
          return {
            type: 'play-card',
            data: {
              cardId: characterInHand.id,
              playerName: this.playerName
            }
          };
        }
        
        // Second priority: Draw a character if no character in hand
        if (hostagedCharacter) {
          this.sendChatMessage(`Il mio personaggio è in ostaggio e non ho altri personaggi! Devo pescarne uno.`);
        } else {
          this.sendChatMessage(`Non ho un personaggio! Devo pescarne uno.`);
        }
        return {
          type: 'pick-card',
          data: {
            deckType: 'personaggi',
            playerName: this.playerName
          }
        };
      }

      // CRITICAL FIX: After MOSSE attack is resolved, END THE TURN
      // CPU can only play ONE action card (MOSSE or BONUS) per turn
      if (this.turnState.executedThisTurn && this.waitingForAttackResolution) {
        console.log(`🎯 CPU ${this.playerName}: MOSSE attack emitted - waiting for resolution before ending turn`);
        return null;
      }
      
      // If attack was resolved, END TURN - CPU can only play ONE card per turn
      if (this.turnState.executedThisTurn && !this.waitingForAttackResolution) {
        console.log(`🎯 CPU ${this.playerName}: Attack resolved - ONE CARD PER TURN RULE - ending turn`);
        this.sendChatMessage(`Ho completato la mia azione, finisco il turno!`);
        this.resetTurnState();
        return { type: 'end-turn', data: { playerName: this.playerName } };
      }
      
      // NEW OPTIMIZED TURN LOGIC: Execute ALL phases in one turn
      // verbose: complete turn
      
      // Phase 1: Draw ALL missing card types (not just one)
      if (this.gameManager) {
        let needsMoreDraws = true;
        let drawAttempts = 0;
        while (needsMoreDraws && drawAttempts < 3) {
          drawAttempts++;
          const currentState = this.gameManager.getSanitizedGameState(this.gameId);
          cpuPlayer = currentState.players[this.playerName];
          const drawAction = this.handleDrawPhase(cpuPlayer, currentState);
          if (drawAction && drawAction.type === 'pick-card') {
            await this.gameManager.pickCard(this.gameId, drawAction.data.deckType, this.playerName);
          } else {
            needsMoreDraws = false;
          }
        }
        const finalState = this.gameManager.getSanitizedGameState(this.gameId);
        cpuPlayer = finalState.players[this.playerName];
        gameState = finalState;
      }
      
      // Phase 2: Play a card
      const playAction = await this.handlePlayPhase(cpuPlayer, gameState);
      if (!playAction) {
        // MOSSE attack was handled atomically, CPU is waiting for resolution
        if (this.waitingForAttackResolution) {
          console.log(`🎯 CPU ${this.playerName}: MOSSE attack emitted atomically - returning to wait for resolution`);
          return null; // Trigger next takeTurn check for waitingForAttackResolution
        }
        // If not a MOSSE, must have played card via routes path
      }
      
      if (playAction && playAction.type === 'play-card') {
        // The card will be played by routes.ts — mark turnState as played so next takeTurn knows
        const cardType = playAction.data.cardType || 'unknown';
        this.markActionExecuted('play', playAction.data.cardId, cardType);
        // play action selected
      } else if (playAction && playAction.type === 'end-turn') {
        // No card to play, end turn
        this.sendChatMessage(`Non ho carte da giocare, finisco il turno.`);
        this.resetTurnState();
        return { type: 'end-turn', data: { playerName: this.playerName } };
      } else {
        // playAction is null - already handled (MOSSE) or no action
        if (this.waitingForAttackResolution) {
          return null; // Will be called again when attack is resolved
        }
        this.sendChatMessage(`Non ho carte da giocare, finisco il turno.`);
        this.resetTurnState();
        return { type: 'end-turn', data: { playerName: this.playerName } };
      }
      
      // Phase 3: Execute the action (this handles MOSSE attacks, BONUS effects, etc.)
      // SKIP if we're waiting for MOSSE attack resolution
      if (!this.waitingForAttackResolution && playAction) {
        const executeAction = await this.handleExecutePhase(cpuPlayer, gameState);
      }
      
      // Phase 4: End turn  
      this.sendChatMessage(`Ho completato le mie azioni, finisco il turno!`);
      this.resetTurnState();
      
      // Return the play action (will be null for MOSSE, action for others, or end-turn if no play)
      return playAction || { type: 'end-turn', data: { playerName: this.playerName } };
      
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
    // verbose: hand optimal
    this.turnState.phase = 'play_card';
    return null; // Return null to indicate no draw needed, caller will call handlePlayPhase separately
  }

  // Handle the play phase: select and play a card
  async handlePlayPhase(cpuPlayer: any, gameState: any): Promise<any> {
    const cardToPlay = this.selectCardToPlay(cpuPlayer, gameState);
    if (cardToPlay) {
      const cardName = this.getCardNameFromUrl(cardToPlay.frontImage);
      
      // CRITICAL: For MOSSE cards, handle attack requirements
      if (cardToPlay.type === 'mosse') {
        const myCharacter = gameState.field.find((card: any) => card.owner === this.playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali'));
        if (myCharacter) {
          const characterText = myCharacter.notes || myCharacter.text || '';
          const starsMatch = characterText.match(/(?:stelle|stars)[:\s]*(\d+)/i);
          const currentStars = starsMatch ? parseInt(starsMatch[1]) : 1;
          const ptiMatch = characterText.match(/PTI[:\s]*(\d+)/i);
          const currentPTI = ptiMatch ? parseInt(ptiMatch[1]) : 100;
          
          if ((starsMatch && currentStars <= 0) || (ptiMatch && currentPTI <= 0) || characterText === "0") {
            console.log(`🎯 CPU ${this.playerName}: ABORTING MOSSE play - Character has 0 stars or PTI`);
            this.sendChatMessage(`Non posso usare la mossa "${cardName}" perché il mio personaggio non ha stelle o PTI!`);
            this.turnState.phase = 'turn_end';
            return { type: 'end-turn', data: { playerName: this.playerName } };
          }
        } else {
          console.log(`🎯 CPU ${this.playerName}: ABORTING MOSSE play - No character on field`);
          this.turnState.phase = 'turn_end';
          return { type: 'end-turn', data: { playerName: this.playerName } };
        }

        console.log(`🎯 CPU ${this.playerName}: Playing MOSSE card ${cardToPlay.id} - executing attack ATOMICALLY`);
        
        // CRITICAL: Mark that we've played a card this turn - ONE CARD PER TURN RULE
        this.turnState.playedThisTurn = true;
        console.log(`🎯 CPU ${this.playerName}: Setting playedThisTurn=true (ONE CARD PER TURN)`);
        
        // Play the card DIRECTLY via gameManager (atomic)
        await this.gameManager?.playCard(this.gameId, cardToPlay.id, this.playerName);
        
        // CRITICAL: Draw replacement MOSSE immediately after playing one from hand
        if (this.gameManager) {
          const replacementDrawn = await this.gameManager.pickCard(this.gameId, 'mosse', this.playerName);
          if (replacementDrawn) {
            console.log(`🎴 CPU ${this.playerName}: Drew replacement MOSSE after playing one`);
          } else {
            console.log(`⚠️ CPU ${this.playerName}: Could not draw replacement MOSSE (deck empty or already has one)`);
          }
        }
        
        // Check if this MOSSE card has a custom effect that was already processed
        // during playCard() (e.g., [BERSAGLIO: scelta], [DADO:], timed effects, etc.)
        // If so, the effect IS the card's action - do NOT also try a regular MOSSE attack
        const cardEffect = cardToPlay.effect || '';
        const hasCustomEffect = cardEffect && (
          /\[BERSAGLIO:/i.test(cardEffect) ||
          /\[DADO[_:]?/i.test(cardEffect) ||
          /\[DADO_AUTOMATICO:/i.test(cardEffect) ||
          /scommessa/i.test(cardEffect) ||
          /roulette/i.test(cardEffect) ||
          /dopo\s+\d+\s+turni/i.test(cardEffect) ||
          /tra\s+\d+\s+turni/i.test(cardEffect)
        );
        const hasDamageValue = cardToPlay.mosseDamageValue !== null && cardToPlay.mosseDamageValue !== undefined && cardToPlay.mosseDamageValue > 0;
        
        if (hasCustomEffect && !hasDamageValue) {
          console.log(`🎯 CPU ${this.playerName}: MOSSE card has custom effect (no damage value) - effect already processed, skipping regular attack`);
          
          if (this.gameManager) {
            this.gameManager.markCardTypeAsUsed(this.gameId, cardToPlay.frontImage || cardToPlay.id, this.playerName);
          }
          
          this.markActionExecuted('execute');
          this.turnState.phase = 'turn_end';
          
          if (this.socketEmitter && this.gameManager) {
            const updatedState = this.gameManager.getSanitizedGameState(this.gameId);
            this.socketEmitter.to(this.gameId).emit('game-state-update', updatedState);
          }
          
          this.sendChatMessage(`Effetto della mossa attivato!`);
          this.resetTurnState();
          return { type: 'end-turn', data: { playerName: this.playerName } };
        }
        
        // Check if this is ATTACCO DISONESTO (index 6 in mosse array)
        const isAtcaccoDisonesto = cardToPlay.frontImage === 'https://i.ibb.co/PZR61NhJ/attacco-disonesto.png';
        
        // NOW emit the attack immediately after card is on field
        let target;
        if (isAtcaccoDisonesto) {
          console.log(`🎯 CPU ${this.playerName}: ATTACCO DISONESTO detected - using hand target`);
          target = this.pickEnemyHandTarget();
        } else {
          target = this.pickEnemyTarget();
        }
        
        if (target) {
          console.log(`🎯 CPU ${this.playerName}: Card played - emitting attack NOW (atomic with play)`);
          await this.emitMossaAttackRequest(cardToPlay, target, gameState);
          // Attack emission sets waitingForAttackResolution = true
        }
        
        // Notify clients of updated game state
        if (this.socketEmitter && this.gameManager) {
          const updatedState = this.gameManager.getSanitizedGameState(this.gameId);
          this.socketEmitter.to(this.gameId).emit('game-state-update', updatedState);
        }
        
        return null; // CPU has already handled the card play - routes.ts doesn't need to do anything
      }
      
      // Non-MOSSE cards: Mark played and return play action for routes.ts to handle
      // CRITICAL: Mark that we've played a card this turn - ONE CARD PER TURN RULE
      this.turnState.playedThisTurn = true;
      console.log(`🎯 CPU ${this.playerName}: Setting playedThisTurn=true for ${cardToPlay.type} (ONE CARD PER TURN)`);
      
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
    
    // DUELLO: If MOSSE card was played during duel, execute attack immediately
    if (gameState.activeDuel && gameState.activeDuel.active && playedCardType === 'mosse') {
      const duel = gameState.activeDuel;
      const isInDuel = (duel.player1 && duel.player1 === this.playerName) || 
                        (duel.player2 && duel.player2 === this.playerName);
      
      if (isInDuel) {
        console.log(`⚔️ DUELLO: CPU ${this.playerName} executing MOSSE attack immediately after playing card`);
        
        // Get opponent's character in the duel (simple and correct)
        const opponentCharacterId: string = (duel.player1 && duel.player1 === this.playerName) ? duel.character2Id! : duel.character1Id!;
        
        return await this.executeMovesCardAndDrawReplacement(playedCardId!, gameState, 'mosse', opponentCharacterId);
      }
    }
    
    if (!playedCardType || !playedCardId) {
      // verbose: no card to execute
      this.markActionExecuted('execute');
      this.turnState.phase = 'turn_end';
      return this.handleTurnEnd();
    }

    // CRITICAL FIX: Execute action and handle potential attack return value
    // verbose: executing action
    
    const deckType = playedCardType === 'personaggi_speciali' ? 'personaggi' : playedCardType;
    
    // Execute based on card type
    switch (playedCardType) {
      case 'mosse':
        // CRITICAL FIX: Handle attack action return value
        console.log(`🎯 CPU ${this.playerName}: CALLING 5-STEP MOSSE SEQUENCE for cardId=${playedCardId}`);
        const attackAction = await this.executeMovesCardAndDrawReplacement(playedCardId, gameState, deckType);
        if (attackAction) {
          console.log(`🎯 CPU ${this.playerName}: MOSSE SEQUENCE COMPLETED - returning attack action`);
          return attackAction; // Return the attack action to be processed immediately
        }
        console.log(`🎯 CPU ${this.playerName}: MOSSE SEQUENCE returned null`);
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
  async executeMovesCardAndDrawReplacement(cardId: string, gameState: any, deckType: string, forcedTargetId?: string): Promise<any> {
    console.log(`🎯 CPU ${this.playerName}: STARTING 5-STEP MOSSE SEQUENCE for card ${cardId}${forcedTargetId ? ` with forced target ${forcedTargetId}` : ''}`);
    
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

    // Use forced target if provided (for duels), otherwise pick automatically
    let target;
    if (forcedTargetId) {
      console.log(`⚔️ DUELLO: Using forced target ${forcedTargetId}`);
      const targetCard = gameState.field.find((c: any) => c.id === forcedTargetId);
      if (targetCard) {
        target = {
          cardId: targetCard.id,
          owner: targetCard.owner,
          name: this.getCardNameFromUrl(targetCard.frontImage)
        };
      } else {
        console.error(`⚔️ DUELLO: Forced target ${forcedTargetId} not found on field`);
        this.sendChatMessage(`Errore: target del duello non trovato.`);
        this.markActionExecuted('execute');
        await this.drawReplacementAndEndTurn('mosse');
        return null;
      }
    } else {
      target = this.pickEnemyTarget();
    }
    
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
    
    // NEW: Instead of executing attack, emit a damage request to the game creator
    // The attack will be completed when they provide the damage value
    console.log(`🎯 CPU ${this.playerName}: Requesting damage input from game creator for MOSSE attack`);
    
    if (this.socketEmitter) {
      // Get the first player (game creator) to request damage from
      const gameState = this.gameManager?.getSanitizedGameState(this.gameId);
      const gameCreator = gameState?.turnOrder?.[0];
      
      if (gameCreator) {
        // Get attacker and defender character cards from field
        const attackerCard = gameState?.field.find((c: any) => c.owner === this.playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'));
        const defenderCard = gameState?.field.find((c: any) => c.id === target.cardId);
        
        // DEBUG removed
        // DEBUG removed
        // DEBUG removed
        
        // Calculate suggested damage based on mosse card settings and attacker stars
        const attackerStars = attackerCard?.stars ?? 1;
        const attackerName = attackerCard ? this.getCardNameFromUrl(attackerCard.frontImage) : null;
        const targetName = target.name;
        
        // Check for character-specific overrides
        const charOverride = this.getCharacterOverride(mosseCard, attackerName, targetName);
        
        let suggestedDamage: number | null = null;
        let effectiveDamageValue = mosseCard?.mosseDamageValue || null;
        let effectiveEffect = mosseCard?.mosseDamageEffect || null;
        
        if (charOverride.overrideType) {
          // Use character-specific override
          if (charOverride.damageValue !== null) {
            effectiveDamageValue = charOverride.damageValue;
            suggestedDamage = charOverride.damageValue * attackerStars;
            console.log(`🎯 CPU ${this.playerName}: Character override applied (${charOverride.overrideType}): ${charOverride.damageValue} × ${attackerStars} = ${suggestedDamage}`);
          } else if (mosseCard?.mosseDamageValue) {
            suggestedDamage = mosseCard.mosseDamageValue * attackerStars;
          }
          if (charOverride.effect) {
            effectiveEffect = charOverride.effect;
          }
        } else if (mosseCard?.mosseDamageValue) {
          suggestedDamage = mosseCard.mosseDamageValue * attackerStars;
        }

        // PRESET FALLBACK (legacy): if no damage yet, try effect text / mosseDamageEffect
        if (suggestedDamage === null) {
          if (effectiveEffect) {
            suggestedDamage = 0;
            console.log(`🎯 CPU ${this.playerName}: LEGACY - mosseDamageEffect="${effectiveEffect}" → auto-submit damage=0`);
          } else {
            const parsed = this.parsePresetDamageFromEffect(mosseCard?.effect, mosseCardName);
            if (parsed.damage !== null) {
              suggestedDamage = parsed.damage;
              console.log(`🎯 CPU ${this.playerName}: LEGACY - parsed preset damage ${suggestedDamage} PTI from effect text`);
            } else if (parsed.effect) {
              suggestedDamage = 0;
              effectiveEffect = parsed.effect;
              console.log(`🎯 CPU ${this.playerName}: LEGACY - parsed preset effect "${parsed.effect}" from effect text → auto-submit damage=0`);
            }
          }
        }
        
        // AUTO-SUBMIT: If damage is pre-calculated, execute the attack directly
        if (suggestedDamage !== null && suggestedDamage !== undefined && this.gameManager) {
          console.log(`🎯 CPU ${this.playerName}: AUTO-SUBMITTING attack (legacy path) with damage ${suggestedDamage}`);
          
          this.socketEmitter.to(this.gameId).emit('card-attacked', {
            mosseCardId: cardId,
            targetCardId: target.cardId,
            attackerName: this.playerName,
            targetOwner: target.owner,
            damageValue: suggestedDamage,
            timestamp: Date.now()
          });
          
          const attackResult = await this.gameManager.executeMossaAttack(
            this.gameId,
            this.playerName,
            cardId,
            target.cardId,
            suggestedDamage,
            false,                    // isHandTarget
            undefined,                // defenseRequestEmitter
            0,                        // starsToRemove
            effectiveEffect || null   // mosseEffect
          );
          
          if (attackResult.success) {
            this.socketEmitter.to(this.gameId).emit('card-attacked', {
              mosseCardId: cardId,
              targetCardId: target.cardId,
              attackerName: this.playerName,
              targetOwner: target.owner,
              damageValue: suggestedDamage,
              timestamp: Date.now()
            });
            
            if (attackResult.result?.requiresDefenseResponse) {
              const pendingDefense = this.gameManager.getPendingDefense(this.gameId);
              if (pendingDefense) {
                pendingDefense.damage = suggestedDamage;
                pendingDefense.mosseCardId = cardId;
                (pendingDefense as any).starsToRemove = 0;
              }
              
              const emissionSuccess = await this.gameManager.emitDefenseRequest(this.gameId, this.socketEmitter);
              if (!emissionSuccess) {
                console.log(`⚠️ CPU ${this.playerName}: Failed to emit defense request (legacy) - processing damage directly`);
                await this.gameManager.processMosseDamage(this.gameId, this.playerName, target.cardId, suggestedDamage, cardId, this.socketEmitter, false, false, false, false, 0);
              }
            }
          }
          
          const updatedState = this.gameManager.getSanitizedGameState(this.gameId);
          if (updatedState) {
            this.socketEmitter.to(this.gameId).emit('game-state-update', updatedState);
          }
          
          this._setWaitingForAttackResolution(true);
        } else {
          // FALLBACK: No pre-calculated damage - show dialog for manual input
          this.socketEmitter.to(this.gameId).emit('cpu-damage-request', {
            cpuName: this.playerName,
            cpuCharacterName: this.playerName,
            mosseCardId: cardId,
            mosseCardName: mosseCardName,
            mosseCardImage: mosseCard?.frontImage || '',
            targetCardId: target.cardId,
            targetCardName: target.name,
            targetOwner: target.owner,
            gameCreator: gameCreator,
            timestamp: Date.now(),
            mosseDamageValue: effectiveDamageValue,
            mosseDamageEffect: effectiveEffect,
            suggestedDamage: suggestedDamage,
            attackerStars: attackerStars,
            mosseCharacterOverrides: mosseCard?.mosseCharacterOverrides || null,
            attackerCharacter: attackerCard ? {
              id: attackerCard.id,
              name: attackerName,
              image: attackerCard.frontImage,
              notes: attackerCard.text || ''
            } : null,
            defenderCharacter: defenderCard ? {
              id: defenderCard.id,
              name: target.name,
              image: defenderCard.frontImage,
              notes: defenderCard.text || ''
            } : null
          });
          
          this._setWaitingForAttackResolution(true);
          console.log(`🎯 CPU ${this.playerName}: Damage request emitted to game creator ${gameCreator}`);
        }
      }
    }

    return null; // Attack has been emitted
  }

  // NEW: Emit MOSSE attack request ATOMICALLY (called from play phase)
  async emitMossaAttackRequest(mosseCard: any, target: any, gameState: any): Promise<void> {
    if (!this.socketEmitter || !this.gameManager) {
      console.error(`CPU ${this.playerName}: No socketEmitter or gameManager for attack emission`);
      return;
    }

    const gameCreator = gameState?.turnOrder?.[0];
    const attackerCard = gameState?.field.find((c: any) => c.owner === this.playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'));
    const defenderCard = gameState?.field.find((c: any) => c.id === target.cardId);
    
    let mosseCardName = this.getCardNameFromUrl(mosseCard.frontImage);
    const isHandTarget = (target as any).isHandCard === true;
    
    console.log(`🎯 CPU ${this.playerName}: ATOMIC ATTACK EMISSION - card ${mosseCard.id} to ${target.name}${isHandTarget ? ' (HAND TARGET)' : ''}`);
    
    // Calculate suggested damage based on mosse card settings and attacker stars
    // CRITICAL: Use current stars from .stars property OR parse from text as fallback
    let attackerStars = attackerCard?.stars ?? 1;
    if (attackerCard?.text) {
      const starsMatch = attackerCard.text.match(/[Ss]telle[:\s]*(\d+)/i);
      if (starsMatch) {
        const textStars = parseInt(starsMatch[1]);
        if (textStars !== attackerStars) {
          console.log(`⚠️ CPU ${this.playerName}: Star mismatch! .stars=${attackerStars}, text=${textStars} - using text value`);
          attackerStars = textStars;
        }
      }
    }
    const attackerName = attackerCard ? this.getCardNameFromUrl(attackerCard.frontImage) : null;
    const targetName = target.name;
    
    // Check for character-specific overrides
    const charOverride = this.getCharacterOverride(mosseCard, attackerName, targetName);
    
    let suggestedDamage: number | null = null;
    let effectiveDamageValue = mosseCard.mosseDamageValue || null;
    let effectiveEffect = mosseCard.mosseDamageEffect || null;
    
    if (charOverride.overrideType) {
      // Use character-specific override
      if (charOverride.damageValue !== null) {
        effectiveDamageValue = charOverride.damageValue;
        suggestedDamage = charOverride.damageValue * attackerStars;
        console.log(`🎯 CPU ${this.playerName}: ATOMIC - Character override (${charOverride.overrideType}): ${charOverride.damageValue} × ${attackerStars} = ${suggestedDamage}`);
      } else if (mosseCard.mosseDamageValue) {
        suggestedDamage = mosseCard.mosseDamageValue * attackerStars;
      }
      if (charOverride.effect) {
        effectiveEffect = charOverride.effect;
      }
    } else if (mosseCard.mosseDamageValue) {
      suggestedDamage = mosseCard.mosseDamageValue * attackerStars;
    }

    // PRESET FALLBACK: if no damage yet, try parsing it from the effect text or mosseDamageEffect
    if (suggestedDamage === null) {
      if (effectiveEffect) {
        // Special effect without numeric damage → auto-submit with 0
        suggestedDamage = 0;
        console.log(`🎯 CPU ${this.playerName}: ATOMIC - mosseDamageEffect="${effectiveEffect}" → auto-submit damage=0`);
      } else {
        const parsed = this.parsePresetDamageFromEffect(mosseCard.effect, mosseCardName);
        if (parsed.damage !== null) {
          suggestedDamage = parsed.damage;
          console.log(`🎯 CPU ${this.playerName}: ATOMIC - parsed preset damage ${suggestedDamage} PTI from effect text`);
        } else if (parsed.effect) {
          suggestedDamage = 0;
          effectiveEffect = parsed.effect;
          console.log(`🎯 CPU ${this.playerName}: ATOMIC - parsed preset effect "${parsed.effect}" from effect text → auto-submit damage=0`);
        }
      }
    }
    
    // AUTO-SUBMIT: If we have pre-calculated damage, execute the attack directly on the server
    // without requiring the game creator to manually confirm via the dialog
    if (suggestedDamage !== null && suggestedDamage !== undefined && this.gameManager) {
      console.log(`🎯 CPU ${this.playerName}: AUTO-SUBMITTING attack with pre-calculated damage ${suggestedDamage} (${effectiveDamageValue} × ${attackerStars} stars)`);
      
      const chatMsg = effectiveEffect
        ? `Uso ${mosseCardName} su ${target.name}! Effetto: ${effectiveEffect === 'death' ? 'MORTE ISTANTANEA' : effectiveEffect === 'halve_pti' ? 'DIMEZZA PTI' : effectiveEffect}!`
        : `Attacco ${target.name} con ${mosseCardName}! Danno: ${suggestedDamage} PTI!`;
      this.sendChatMessage(chatMsg);
      
      // Broadcast attack animation to all players
      this.socketEmitter.to(this.gameId).emit('card-attacked', {
        mosseCardId: mosseCard.id,
        targetCardId: target.cardId,
        attackerName: this.playerName,
        targetOwner: target.owner,
        damageValue: suggestedDamage,
        timestamp: Date.now()
      });
      
      // Execute the attack directly via gameManager (correct parameter order)
      const attackResult = await this.gameManager.executeMossaAttack(
        this.gameId,
        this.playerName,
        mosseCard.id,
        target.cardId,
        suggestedDamage,
        isHandTarget,           // boolean: is this an ATTACCO DISONESTO (hand target)?
        undefined,              // defenseRequestEmitter: not needed, defense handled via socket
        0,                      // starsToRemove
        effectiveEffect || null // mosseEffect
      );
      
      if (attackResult.success) {
        console.log(`🎯 CPU ${this.playerName}: AUTO-ATTACK SUCCESS against ${target.name}`);
        
        this.socketEmitter.to(this.gameId).emit('card-attacked', {
          mosseCardId: mosseCard.id,
          targetCardId: target.cardId,
          attackerName: this.playerName,
          targetOwner: target.owner,
          damageValue: suggestedDamage,
          timestamp: Date.now()
        });

        // BARRIERA HANDLING: If the attack was absorbed by a shield, apply damage and end turn
        if (attackResult.result?.barrieraAbsorbed) {
          const barrieraDamage = attackResult.result.damageValue ?? suggestedDamage ?? 0;
          console.log(`🛡️ CPU ${this.playerName}: Attack auto-absorbed by BARRIERA - applying ${barrieraDamage} damage to shield`);

          this.socketEmitter.to(this.gameId).emit('chat-message', {
            id: `${Date.now()}-cpu-barriera-absorb`,
            playerName: 'Sistema',
            message: `🛡️ BARRIERA assorbe automaticamente ${barrieraDamage} danni dell'attacco di ${this.playerName}!`,
            timestamp: Date.now()
          });

          this.gameManager.damageBarriera(this.gameId, attackResult.result.barrieraShieldId, barrieraDamage, this.playerName, this.socketEmitter);
          this.gameManager.returnToDeck(this.gameId, mosseCard.id, this.playerName);

          const barrieraState = this.gameManager.getSanitizedGameState(this.gameId);
          if (barrieraState) {
            this.socketEmitter.to(this.gameId).emit('game-state-update', barrieraState);
          }

          // End turn: one attack on BARRIERA per turn
          this.resetTurnState();
          setTimeout(() => {
            this.gameManager.processDelayedDamages(this.gameId, this.playerName, this.socketEmitter);
            const nextPlayer = this.gameManager.endTurn(this.gameId, this.playerName);
            if (nextPlayer) {
              console.log(`🎯 CPU ${this.playerName}: Turn ended after BARRIERA attack, next: ${nextPlayer}`);
              this.socketEmitter.to(this.gameId).emit('next-turn', { nextPlayer });
              const freshGame = this.gameManager.getGameState(this.gameId);
              if (freshGame && freshGame.players[nextPlayer]?.isCPU) {
                setTimeout(() => {
                  this.gameManager.processCPUTurn(this.gameId, nextPlayer, this.socketEmitter);
                }, 1500);
              }
            }
          }, 800);
          return;
        }
        
        // SAGOMA ABSORBED: attack absorbed by shadow clone - end turn immediately
        if (attackResult.result?.sagomaAbsorbed) {
          console.log(`👥 CPU ${this.playerName}: Attack absorbed by SAGOMA - ending turn`);
          this.gameManager.returnToDeck(this.gameId, mosseCard.id, this.playerName);
          const sagState = this.gameManager.getSanitizedGameState(this.gameId);
          if (sagState) this.socketEmitter.to(this.gameId).emit('game-state-update', sagState);
          this.resetTurnState();
          setTimeout(() => {
            this.gameManager.processDelayedDamages(this.gameId, this.playerName, this.socketEmitter);
            const nextSagPlayer = this.gameManager.endTurn(this.gameId, this.playerName);
            if (nextSagPlayer) {
              console.log(`🎯 CPU ${this.playerName}: Turn ended after SAGOMA absorption, next: ${nextSagPlayer}`);
              this.socketEmitter.to(this.gameId).emit('next-turn', { nextPlayer: nextSagPlayer });
              const freshGameSag = this.gameManager.getGameState(this.gameId);
              if (freshGameSag && freshGameSag.players[nextSagPlayer]?.isCPU) {
                setTimeout(() => {
                  this.gameManager.processCPUTurn(this.gameId, nextSagPlayer, this.socketEmitter);
                }, 1500);
              }
            }
          }, 800);
          return;
        }

        if (attackResult.result?.requiresDefenseResponse) {
          console.log(`🛡️ CPU ${this.playerName}: Attack requires defense response from ${target.owner}`);
          const pendingDefense = this.gameManager.getPendingDefense(this.gameId);
          if (pendingDefense) {
            pendingDefense.damage = suggestedDamage;
            pendingDefense.mosseCardId = mosseCard.id;
            (pendingDefense as any).starsToRemove = 0;
            console.log(`📝 CPU stored damage ${suggestedDamage} for pending defense ${pendingDefense.attackId}`);
          }
          
          const emissionSuccess = await this.gameManager.emitDefenseRequest(this.gameId, this.socketEmitter);
          if (!emissionSuccess) {
            console.log(`⚠️ CPU ${this.playerName}: Failed to emit defense request - processing damage directly`);
            await this.gameManager.processMosseDamage(this.gameId, this.playerName, target.cardId, suggestedDamage, mosseCard.id, this.socketEmitter, false, false, false, false, 0);
          }
        }
      } else {
        console.log(`🎯 CPU ${this.playerName}: AUTO-ATTACK FAILED: ${attackResult.error}`);
      }
      
      const updatedState = this.gameManager.getSanitizedGameState(this.gameId);
      if (updatedState) {
        this.socketEmitter.to(this.gameId).emit('game-state-update', updatedState);
      }
      
      this._setWaitingForAttackResolution(true);
      console.log(`🎯 CPU ${this.playerName}: AUTO-ATTACK COMPLETE - waiting for defense resolution`);
      return;
    }
    
    // FALLBACK: No pre-calculated damage - show dialog to game creator for manual input
    console.log(`🎯 CPU ${this.playerName}: No pre-calculated damage - requesting from game creator`);
    this.socketEmitter.to(this.gameId).emit('cpu-damage-request', {
      cpuName: this.playerName,
      cpuCharacterName: this.playerName,
      mosseCardId: mosseCard.id,
      mosseCardName: mosseCardName,
      mosseCardImage: mosseCard?.frontImage || '',
      targetCardId: target.cardId,
      targetCardName: target.name,
      targetOwner: target.owner,
      gameCreator: gameCreator,
      timestamp: Date.now(),
      isHandTarget: isHandTarget,
      mosseDamageValue: effectiveDamageValue,
      mosseDamageEffect: effectiveEffect,
      suggestedDamage: suggestedDamage,
      attackerStars: attackerStars,
      mosseCharacterOverrides: mosseCard?.mosseCharacterOverrides || null,
      attackerCharacter: attackerCard ? {
        id: attackerCard.id,
        name: attackerName,
        image: attackerCard.frontImage,
        notes: attackerCard.text || ''
      } : null,
      defenderCharacter: defenderCard ? {
        id: defenderCard.id,
        name: target.name,
        image: defenderCard.frontImage,
        notes: defenderCard.text || ''
      } : null
    });
    
    // Set flag to wait for attack resolution
    this._setWaitingForAttackResolution(true);
    console.log(`🎯 CPU ${this.playerName}: DAMAGE REQUEST SENT - waiting for game creator input`);
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
  // ONE CARD PER TURN RULE: CPU can only play one action card (MOSSE or BONUS) per turn
  selectCardToPlay(cpuPlayer: any, gameState: any): any {
    if (this.turnState.playedThisTurn) {
      console.log(`CPU ${this.playerName}: Already played a card this turn - ONE CARD PER TURN rule`);
      return null;
    }
    
    const hand = cpuPlayer.hand || [];
    const myCharacter = gameState.field.find((card: any) => card.owner === this.playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali'));
    const enemies = gameState.field.filter((card: any) => card.owner !== this.playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali'));

    // In hunt_human mode only human-owned characters count as valid attack targets
    const effectiveEnemies = this.attackMode === 'hunt_human'
      ? enemies.filter((e: any) => {
          const ePlayer = gameState.players[e.owner];
          return ePlayer && !ePlayer.isCPU;
        })
      : enemies;

    const myFieldCards = gameState.field.filter((card: any) => card.owner === this.playerName);
    const hasPersonaggioOnField = myFieldCards.some((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali');
    
    const mosseInHand = hand.filter((c: any) => c.type === 'mosse');
    const bonusInHand = hand.filter((c: any) => c.type === 'bonus');
    const personaggiInHand = hand.filter((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali');
    
    // hand composition: P=${personaggiInHand.length}, M=${mosseInHand.length}, B=${bonusInHand.length}
    
    if (!hasPersonaggioOnField) {
      if (personaggiInHand.length > 0) {
        console.log(`CPU ${this.playerName} playing PERSONAGGI (no character on field)`);
        return personaggiInHand[0];
      }
    }

    if (myCharacter) {
      const characterText = myCharacter.notes || myCharacter.text || '';
      const starsMatch = characterText.match(/(?:stelle|stars)[:\s]*(\d+)/i);
      const currentStars = starsMatch ? parseInt(starsMatch[1]) : 1;
      const ptiMatch = characterText.match(/PTI[:\s]*(\d+)/i);
      const currentPTI = ptiMatch ? parseInt(ptiMatch[1]) : 100;

      if ((starsMatch && currentStars <= 0) || (ptiMatch && currentPTI <= 0) || characterText === "0") {
        const replacement = personaggiInHand.find((c: any) => {
          const replacementText = c.text || '';
          const rStarsMatch = replacementText.match(/(?:stelle|stars)[:\s]*(\d+)/i);
          const rStars = rStarsMatch ? parseInt(rStarsMatch[1]) : 1;
          const rPtiMatch = replacementText.match(/PTI[:\s]*(\d+)/i);
          const rPti = rPtiMatch ? parseInt(rPtiMatch[1]) : 100;
          return rStars > 0 && rPti > 0 && replacementText !== "0";
        });

        if (replacement) {
          console.log(`CPU ${this.playerName} replacing character with 0 stars/PTI`);
          this.sendChatMessage(`Il mio personaggio non ha più stelle o PTI! Lo sostituisco con ${this.getCardNameFromUrl(replacement.frontImage)}.`);
          if (this.gameManager) {
            this.gameManager.returnToHand(this.gameId, myCharacter.id, this.playerName);
          }
          return replacement;
        } else {
          console.log(`CPU ${this.playerName} character has 0 stars/PTI, but NO valid replacement in hand`);
        }
      }
    }
    
    if (myCharacter) {
      const currentPTI = this.extractPtiFromCard(myCharacter);
      const currentStars = this.extractStarsFromCard(myCharacter);
      const isDead = currentPTI <= 0 || currentStars <= 0;
      
      if (!isDead && effectiveEnemies.length > 0) {
        const weakestEnemy = effectiveEnemies.reduce((w: any, e: any) => {
          const ePti = this.extractPtiFromCard(e);
          const wPti = this.extractPtiFromCard(w);
          return ePti < wPti ? e : w;
        }, effectiveEnemies[0]);
        const weakestPti = this.extractPtiFromCard(weakestEnemy);

        const bestMosse = mosseInHand.length > 0 ? mosseInHand.reduce((best: any, c: any) => {
          const dmg = c.mosseDamageValue || 0;
          const bestDmg = best.mosseDamageValue || 0;
          return dmg > bestDmg ? c : best;
        }, mosseInHand[0]) : null;

        if (bestMosse) {
          const dmg = bestMosse.mosseDamageValue || 0;
          if (dmg >= weakestPti && weakestPti > 0) {
            console.log(`🤖 CPU ${this.playerName}: MOSSE can kill (dmg=${dmg} ≥ enemy PTI=${weakestPti})`);
            return bestMosse;
          }
        }

        if (currentPTI <= 50 && bonusInHand.length > 0) {
          const healBonus = bonusInHand.find((c: any) => {
            const eff = (c.effect || '').toLowerCase();
            return eff.includes('aumenta') || eff.includes('pti') || eff.includes('cura') || eff.includes('stelle');
          });
          if (healBonus) {
            console.log(`🤖 CPU ${this.playerName}: Low PTI (${currentPTI}), playing heal/buff BONUS`);
            return healBonus;
          }
        }

        if (bestMosse) {
          console.log(`🤖 CPU ${this.playerName}: Playing MOSSE (dmg=${bestMosse.mosseDamageValue || '?'})`);
          return bestMosse;
        }
      }
      
      if (!isDead && bonusInHand.length > 0) {
        return bonusInHand[0];
      }
      
      if (!isDead && mosseInHand.length > 0) {
        return mosseInHand[0];
      }
    }
    
    const anyCard = hand.find((c: any) => c.type === 'mosse' || c.type === 'bonus');
    if (anyCard) return anyCard;
    
    return null;
  }

  // MINKIARDS RULES: Always maintain exactly 1 card of each type (PERSONAGGI, MOSSE, BONUS) in hand
  shouldDrawCards(cpuPlayer: any, gameState: any): { shouldDraw: boolean, deckType?: string } {
    const hand = cpuPlayer.hand || [];
    const myCharacter = gameState.field.find((card: any) => card.owner === this.playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali'));
    
    // Count cards of each type in hand to avoid duplicates
    const personaggiInHand = hand.filter((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali').length;
    const mosseInHand = hand.filter((c: any) => c.type === 'mosse').length;
    const bonusInHand = hand.filter((c: any) => c.type === 'bonus').length;
    
    // hand count checked
    
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
    // optimal hand - no draw needed
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
    // executing pending order
    
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
        // unknown order type
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
    const enemies = gameState.field.filter((card: any) => card.owner !== this.playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali'));
    
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
    
    // hand analysis done
    
    return {
      canPlay,
      hasPersonaggi,
      hasMosse,
      hasBonus,
      missingTypes
    };
  }
  
  // Get card name from URL
  private getCardNameFromUrl(imageUrl: string): string {
    try {
      if (!imageUrl) return 'Carta';
      const url = new URL(imageUrl);
      const pathname = url.pathname;
      const filename = pathname.split('/').pop() || '';
      return filename.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase();
    } catch {
      // Fallback for non-URL strings or failed URL parsing
      return imageUrl?.split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase() || 'Carta';
    }
  }

  // Get character-specific damage/effect overrides for MOSSE cards
  private getCharacterOverride(
    mosseCard: any,
    attackerCardName: string | null,
    targetCardName: string | null
  ): { damageValue: number | null; effect: string | null; overrideType: 'usedBy' | 'usedOn' | 'both' | null } {
    const result = { damageValue: null as number | null, effect: null as string | null, overrideType: null as 'usedBy' | 'usedOn' | 'both' | null };
    
    if (!mosseCard?.mosseCharacterOverrides || !Array.isArray(mosseCard.mosseCharacterOverrides)) {
      return result;
    }
    
    const overrides = mosseCard.mosseCharacterOverrides;
    
    // Normalize names for comparison
    const normalizeCardName = (name: string | null): string => {
      if (!name) return '';
      return name.toUpperCase().replace(/[_-]/g, ' ').trim();
    };
    
    const attackerNorm = normalizeCardName(attackerCardName);
    const targetNorm = normalizeCardName(targetCardName);
    
    // Check for usedBy override (when attacker matches)
    if (attackerNorm) {
      const usedByOverride = overrides.find((o: any) => {
        const charNorm = normalizeCardName(o.characterName || o.characterId);
        return charNorm === attackerNorm && o.usedBy && (o.usedBy.damageValue !== null || o.usedBy.effect);
      });
      if (usedByOverride?.usedBy) {
        result.damageValue = usedByOverride.usedBy.damageValue;
        result.effect = usedByOverride.usedBy.effect;
        result.overrideType = 'usedBy';
      }
    }
    
    // Check for usedOn override (when target matches) - takes priority over usedBy
    if (targetNorm) {
      const usedOnOverride = overrides.find((o: any) => {
        const charNorm = normalizeCardName(o.characterName || o.characterId);
        return charNorm === targetNorm && o.usedOn && (o.usedOn.damageValue !== null || o.usedOn.effect);
      });
      if (usedOnOverride?.usedOn) {
        if (result.overrideType === 'usedBy') {
          result.overrideType = 'both';
        } else {
          result.overrideType = 'usedOn';
        }
        if (usedOnOverride.usedOn.damageValue !== null) {
          result.damageValue = usedOnOverride.usedOn.damageValue;
        }
        if (usedOnOverride.usedOn.effect) {
          result.effect = usedOnOverride.usedOn.effect;
        }
      }
    }
    
    return result;
  }

  // Handle player chat messages for specific CPU functions
  async handlePlayerMessage(message: string, senderName: string, gameState: any): Promise<boolean> {
    const text = message.toLowerCase();
    // processing command
    
    // Function 1: Random number generator - simplified regex for better matching
    // Matches: "dimmi un numero da 1 a 10", "spara un numero tra 1 e 100", etc.
    if (text.includes('numero') && (text.includes('da') || text.includes('tra'))) {
      const numberMatch = text.match(/(\d+)\s*(?:a|e|al?)\s*(\d+)/);
      if (numberMatch) {
        const minValue = parseInt(numberMatch[1]);
        const maxValue = parseInt(numberMatch[2]);
        const resultValue = Math.floor(Math.random() * (Math.abs(maxValue - minValue) + 1)) + Math.min(minValue, maxValue);
        
        console.log(`CPU ${this.playerName} matched number request: ${minValue} to ${maxValue}, result: ${resultValue}`);
        this.sendChatMessage(`Certo ${senderName}! Il numero che ho scelto tra ${minValue} e ${maxValue} è: ${resultValue}.`);
        return true;
      }
    }

    // Function 2: Hand character stars inquiry - simplified matching
    if (text.includes('stelle') && (text.includes('mano') || text.includes('possiedi') || text.includes('hai'))) {
      const cpuPlayer = gameState?.players?.[this.playerName];
      const characterInHand = cpuPlayer?.hand?.find((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali');
      
      console.log(`CPU ${this.playerName} matched stars inquiry, character in hand:`, characterInHand ? 'found' : 'none');
      
      if (characterInHand) {
        const characterName = this.getCardNameFromUrl(characterInHand.frontImage);
        const cardText = characterInHand.text || characterInHand.notes || '';
        const starsMatch = cardText.match(/(?:stelle|stars)[:\s]*(\d+)/i);
        const stars = starsMatch ? starsMatch[1] : "non specificate";
        
        this.sendChatMessage(`${senderName}, il personaggio che ho in mano è ${characterName} e ha ${stars} stelle.`);
      } else {
        this.sendChatMessage(`${senderName}, al momento non ho personaggi in mano.`);
      }
      return true;
    }

    // no command matched
    return false;
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
  async executePickReplacement(gameState: any): Promise<any> {
    // Check if CPU already has a PERSONAGGI card in hand
    const cpuPlayer = gameState.players[this.playerName];
    const hasPersonaggioInHand = cpuPlayer.hand?.some((card: any) => 
      card.type === 'personaggi' || card.type === 'personaggi_speciali'
    );

    // If CPU already has a personaggio in hand, complete opening and start normal gameplay
    if (hasPersonaggioInHand) {
      // has personaggio, normal gameplay
      this.sendChatMessage("Ho già le carte, ora gioco attivamente!");
      this.openingSequenceState.phase = 'completed';
      
      // CRITICAL FIX: Reset turn state and start normal turn logic
      this.resetTurnState();
      this.turnState.phase = 'draw_needed';
      
      // Start the normal turn logic immediately
      const drawAction = this.handleDrawPhase(cpuPlayer, gameState);
      
      // IMPORTANT: If handleDrawPhase returns null, we need to proceed to play phase
      if (drawAction === null) {
        // no draw needed
        // CRITICAL FIX: Use handlePlayPhase instead of selectCardToPlay
        // handlePlayPhase handles MOSSE attacks atomically with proper target selection
        return await this.handlePlayPhase(cpuPlayer, gameState);
      }
      
      return drawAction;
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
    // processing chat
    const lowerMessage = message.toLowerCase();
    
    // If waiting for response to our question, process the advice
    if (this.waitingForResponse) {
      // processing advice
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
      // responding to greeting
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
    
    // Respond to direct questions to the CPU or any other message - use AI for intelligent responses
    if (lowerMessage.includes(this.playerName.toLowerCase()) || lowerMessage.includes('cpu') || Math.random() < 0.7) {
      console.log(`CPU ${this.playerName} generating AI response to: "${message}"`);
      this.generateAIResponse(message, senderName);
      return true;
    }
    
    // chat processed, no response
    return false;
  }
  
  // Generate intelligent AI response using OpenAI
  private async generateAIResponse(message: string, senderName: string): Promise<void> {
    try {
      // Get game context for more relevant responses
      const gameState = this.gameManager?.getGameState(this.gameId);
      let gameContext = '';
      
      if (gameState) {
        const myHand = gameState.players[this.playerName]?.hand || [];
        const myField = gameState.players[this.playerName]?.field || [];
        const myCharactersInHand = myHand.filter((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali').length;
        const myMosseInHand = myHand.filter((c: any) => c.type === 'mosse').length;
        const myBonusInHand = myHand.filter((c: any) => c.type === 'bonus').length;
        
        gameContext = `Stato attuale: Ho ${myHand.length} carte in mano (${myCharactersInHand} personaggi, ${myMosseInHand} mosse, ${myBonusInHand} bonus). Ho ${myField.length} carte sul campo.`;
      }
      
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `Sei ${this.playerName}, un giocatore CPU nel gioco di carte MINKIARDS. Rispondi sempre in italiano in modo naturale, amichevole e conciso (massimo 2 frasi). 
            
Regole di MINKIARDS:
- Ci sono 4 tipi di carte: PERSONAGGI (personaggi base), MOSSE (attacchi), BONUS (potenziamenti), PERSONAGGI SPECIALI
- I personaggi hanno PTI (punti) e Stelle (1-5)
- Le MOSSE si usano per attaccare i personaggi nemici
- I BONUS potenziano i propri personaggi
- Vince chi elimina tutti i personaggi nemici

${gameContext}

Rispondi in modo appropriato al messaggio del giocatore. Puoi fare battute, dare consigli, commentare il gioco, o semplicemente conversare.`
          },
          {
            role: "user",
            content: `${senderName} dice: "${message}"`
          }
        ],
        max_completion_tokens: 150
      });
      
      const aiResponse = response.choices[0]?.message?.content;
      if (aiResponse) {
        console.log(`CPU ${this.playerName} AI response: "${aiResponse}"`);
        setTimeout(() => {
          this.sendChatMessage(aiResponse);
        }, 1000 + Math.random() * 2000);
      }
    } catch (error) {
      console.error(`CPU ${this.playerName} AI response error:`, error);
      // Intelligent fallback responses based on message content (special commands are handled by handlePlayerMessage)
      setTimeout(() => {
        const lowerMessage = message.toLowerCase();
        let fallbackResponse = "";
        
        // Contextual responses based on keywords
        if (lowerMessage.includes('ciao') || lowerMessage.includes('salve')) {
          fallbackResponse = `Ciao ${senderName}! Piacere di giocare con te!`;
        } else if (lowerMessage.includes('come stai') || lowerMessage.includes('come va')) {
          fallbackResponse = `Bene grazie! Sto giocando con grande concentrazione!`;
        } else if (lowerMessage.includes('?')) {
          // It's a question
          const questionResponses = [
            `Bella domanda ${senderName}! Dipende dalla situazione...`,
            `Hmm, ci devo pensare un attimo!`,
            `Non sono sicuro, ma ci proverò!`,
            `Buona osservazione! Vediamo come va la partita.`
          ];
          fallbackResponse = questionResponses[Math.floor(Math.random() * questionResponses.length)];
        } else if (lowerMessage.includes('attacca') || lowerMessage.includes('gioca')) {
          fallbackResponse = `Hai ragione ${senderName}! Aspetto il momento giusto per colpire!`;
        } else if (lowerMessage.includes('carta') || lowerMessage.includes('mano')) {
          fallbackResponse = `Sto valutando le mie carte con attenzione!`;
        } else {
          // Generic responses
          const genericResponses = [
            `Interessante ${senderName}!`,
            `Capisco il tuo punto di vista!`,
            `Grazie per il messaggio!`,
            `Hmm, ci penserò!`,
            `Vediamo come va la partita!`
          ];
          fallbackResponse = genericResponses[Math.floor(Math.random() * genericResponses.length)];
        }
        
        this.sendChatMessage(fallbackResponse);
      }, 1000 + Math.random() * 1500);
    }
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
    // checking direct orders
    
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
      
      // stored show order
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
      
      // stored pick order
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
      
      // stored play order
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
      
      // stored attack order
    }, 1000);
  }
  
  // NEW: Set pending order directly (for system commands)
  setPendingOrder(order: any): void {
    this.pendingOrder = order;
    // received pending order
  }
}