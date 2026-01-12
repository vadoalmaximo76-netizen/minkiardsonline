import { CARD_DATA, DECK_BACK_IMAGES, SCENARIO_CARDS } from '../client/src/lib/cardData';
import { db } from './db';
import { matches, gameEvents, personaggi, customCards, cardModifications, users, type InsertMatch, type InsertGameEvent, type InsertCustomCard } from '../shared/schema';
import { eq, ilike, sql } from 'drizzle-orm';
import { CPUPlayer } from './cpuPlayer';
import { trackGameEvent } from './missionsAndAchievements';
import { getPersonaggioFromCache } from './personaggiCache';

interface Card {
  id: string;
  type: string;
  frontImage: string;
  backImage: string;
  owner: string;
  name?: string; // Custom card name (for permanent/custom cards)
  text?: string;
  effect?: string; // AI-processed effect description for custom cards
  eliminatedBy?: string;
  faceDown?: boolean;
  section?: string;
  turnCounter?: number;
  placedBy?: string;
  pti?: number | null;
  stars?: number | null;
  // Fusion system
  fusedWith?: string[]; // Array of card IDs that are fused with this card
  isFused?: boolean; // True if this card is part of a fusion
  fusionLeader?: string; // ID of the card that leads the fusion group
  // Animation trigger
  triggerAnimation?: boolean; // True if this card should trigger a special animation
  // Parasitic attachment system (PARASSITA/SAIBAIM)
  attachedTo?: string; // ID of the card this parasitic card is attached to
  attachedBy?: string[]; // IDs of parasitic cards attached to this character
  canReattach?: boolean; // False after detachment (cannot reattach)
  originalStars?: number; // Store original stars for PARASSITA (copies target's stars)
  // MOSSE card usage tracking
  used?: boolean; // Whether this MOSSE card has been used this turn
  usedBy?: string; // Player who used this MOSSE card
  // Audio for custom cards
  audioUrl?: string; // URL to audio file to play when card is placed on field
  // POTERI system - copied powers
  copiedPower?: string; // Name of character whose power was copied (e.g., 'CIMICE', 'PARASSITA')
  // RIFUGIO shelter protection system
  protectedByRifugio?: string; // ID of RIFUGIO card protecting this character
  rifugioProtecting?: string; // ID of character this RIFUGIO is protecting
  rifugioPTI?: number; // Current PTI of this RIFUGIO card
  // BARRIERA shield system
  isBarrieraShield?: boolean; // True if this is a BARRIERA shield card
  barrieraOriginalId?: string; // For clones: ID of the original BARRIERA
  barrieraShieldIndex?: number; // 0, 1, or 2 for the three shields
  barrieraPTI?: number; // PTI for this BARRIERA shield (50)
  barrieraProtecting?: string; // ID of character this BARRIERA is protecting
  // OSTAGGIO (Hostage) system
  isHostage?: boolean; // True if this character is held hostage
  hostagedBy?: string; // Player name who used OSTAGGIO
  hostageOstaggioCardId?: string; // ID of the OSTAGGIO card holding this character
  hostageOriginalOwner?: string; // Original owner of the hostage character
  hostageOriginalFieldIndex?: number; // Original position on the field
  hostageTurnsRemaining?: number; // Turns remaining before release (counts captor's turns only)
  isOstaggioCard?: boolean; // True if this MOSSE card is OSTAGGIO and is active on field
  ostaggioHoldingCardId?: string; // ID of the character card this OSTAGGIO is holding
}

interface Player {
  name: string;
  hand: Card[];
  socketId: string | null;
  isCPU?: boolean;
  cpuInstance?: CPUPlayer;
  usedCardsThisTurn?: string[]; // Track card images used this turn to prevent reuse
  usedMosseOnBarrieraThisTurn?: boolean; // Track if player has attacked BARRIERA this turn (one BARRIERA attack per turn)
  disconnectedAt?: Date; // When player disconnected (null if connected)
  eliminationCount?: number; // Track how many opponent personaggi cards this player has eliminated (for SOROS activation)
  avatar?: string; // Player's chosen avatar ID
}

interface TransferRequest {
  id: string;
  cardId: string;
  fromPlayer: string;
  toPlayer: string;
  timestamp: Date;
  message: string;
}

interface PendingDefense {
  attackId: string;
  attacker: string;
  defender: string;
  damage: number;
  targetCardId: string;   // the character being attacked
  mosseCardId: string;    // the attack (MOSSE) card used
  deckType: string;
  isHandTarget?: boolean; // NEW: Whether this is ATTACCO DISONESTO (target in hand)
  starsToRemove?: number; // Stars to remove from target alongside PTI damage
  isFurtoAttack?: boolean; // Whether this is a FURTO attack
  createdAt: Date;
  timeoutId?: NodeJS.Timeout;
}

interface VoodooLink {
  card1Id: string;
  card2Id: string;
  activatedBy: string;
  bonusCardId: string; // The BAMBOLA VOODOO card that created this link
}

interface DuelState {
  duelCardId: string; // The DUELLO bonus card that initiated this duel
  character1Id: string; // First character in the duel
  character2Id: string; // Second character in the duel
  player1: string; // Owner of character1
  player2: string; // Owner of character2
  currentTurn: string; // Whose turn it is to play a MOSSE card
  consecutiveTurns: number; // If player defended, they get 2 turns
  active: boolean; // Whether the duel is currently active
}

interface PersistentDamage {
  id: string;
  attacker: string;
  attackerCardId: string; // The character that launched the attack
  defender: string;
  targetCardId: string;
  damage: number;
  type: 'VIRUS' | 'INFLUENZA' | 'PUOZZA';
  lastTickTurn?: number;
}

interface DelayedDamage {
  id: string;
  attackerName: string;
  defenderName: string;
  targetCardId: string;
  damageValue: number;
  mosseCardId: string;
  turnsRemaining: number; // Countdown of defender's turns until damage is applied
  createdAt: number;
}

interface ParasiticAttachment {
  id: string;
  parasiticCardId: string; // PARASSITA or SAIBAIM card
  parasiticCardName: 'PARASSITA' | 'SAIBAIM';
  targetCardId: string; // The character it's attached to
  ownerPlayer: string; // The player who owns the parasitic card
  targetPlayer: string; // The player who owns the target
  turnsAttached: number; // How many turns since attachment
  originalPosition: number; // Index in field for returning after detachment
  active: boolean; // False after detachment or explosion
}

interface ClashBattle {
  id: string;
  attacker: string; // Player who initiated original attack
  defender: string; // Player who counter-attacked
  attackerTaps: number; // Attacker's tap count
  defenderTaps: number; // Defender's tap count
  damageValue: number; // The equal damage value both sides have
  attackerMosseCardId: string; // Original attack MOSSE card
  defenderMosseCardId: string; // Defense MOSSE card
  targetCardId: string; // Original attack target
  defenderTargetCardId: string; // Defender's target (attacker's character)
  startTime: number; // When clash started
  duration: number; // Duration in ms (10 seconds = 10000)
  active: boolean;
}

interface RifugioProtection {
  id: string;
  rifugioCardId: string; // The RIFUGIO bonus card on field
  protectedCharacterId: string; // The character being protected
  ownerPlayer: string; // The player who owns both RIFUGIO and protected character
  currentPTI: number; // Current health of RIFUGIO (starts at 1000)
  maxPTI: number; // Always 1000
  protectionActive: boolean; // False when protected character uses MOSSE
  usedMosseThisTurn: boolean; // Track if character used MOSSE this turn
}

interface BarrieraShield {
  id: string;
  originalCardId: string; // ID of the original BARRIERA card that was played
  shieldCardIds: string[]; // IDs of the 3 BARRIERA copies on field
  protectedCharacterId: string; // The character being protected
  ownerPlayer: string; // The player who owns BARRIERA
  shieldsPTI: number[]; // PTI for each of the 3 shields [50, 50, 50]
  active: boolean; // True while at least one shield has PTI > 0
}

interface GameState {
  decks: {
    personaggi: Card[];
    mosse: Card[];
    bonus: Card[];
    personaggi_speciali: Card[];
  };
  players: Record<string, Player>;
  field: Card[];
  graveyard: Card[];
  scenarioCardsActive: boolean;
  matchId?: number; // Database match ID for event recording
  eventCounter: number; // Sequential event counter
  startTime: Date; // Match start time
  turnOrder: string[]; // Player turn order
  currentTurnIndex: number; // Index of current player in turn order
  spectators: string[]; // Players who left the game but are still spectating
  characterLimit: string; // '1', '2', '3', '5', 'unlimited'
  eliminatedPlayers: Set<string>; // Players eliminated from the game
  eliminationOrder: string[]; // Order in which players were eliminated (first eliminated = last place)
  playerUserIds: Map<string, number>; // Map player names to user IDs for points assignment
  gameEnded: boolean; // Prevent multiple victory notifications
  pointsAwarded: boolean; // Prevent duplicate Rankiard points awards
  pendingTransferRequests: TransferRequest[]; // Pending card transfer requests between human players
  pendingDefense?: PendingDefense; // Current pending defense request (only one at a time)
  voodooLinks: VoodooLink[]; // BAMBOLA VOODOO: Track linked characters
  activeDuel?: DuelState; // Current active duel state
  prSpentThisGame: Map<string, number>; // Track Rankiard points spent by each player during this game (resets each game)
  persistentDamages: PersistentDamage[]; // Persistent damage effects (VIRUS, etc.)
  parasiticAttachments: ParasiticAttachment[]; // PARASSITA/SAIBAIM attachment tracking
  activeClashBattle?: ClashBattle; // Current active clash battle
  rifugioProtections: RifugioProtection[]; // RIFUGIO shelter protection tracking
  barrieraShields: BarrieraShield[]; // BARRIERA shield protection tracking
  delayedDamages: DelayedDamage[]; // Delayed damage effects from defense
  playerDeathModifiers: Map<string, number>; // Per-player death limit modifiers (+/- deaths)
}

export class GameManager {
  private games: Map<string, GameState> = new Map();
  private playerToGame: Map<string, string> = new Map();
  private userEmailCache: Map<number, string> = new Map();
  private eventQueue: Array<{ email: string; eventType: string; data: any }> = [];
  private isProcessingQueue = false;

  private async getUserEmail(userId: number): Promise<string | null> {
    // Check cache first
    const cached = this.userEmailCache.get(userId);
    if (cached) return cached;
    
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const email = user[0]?.email || null;
      if (email) {
        this.userEmailCache.set(userId, email);
      }
      return email;
    } catch (error) {
      console.error('Failed to get user email:', error);
      return null;
    }
  }

  // Non-blocking event tracking - queues events for background processing
  private trackPlayerEventAsync(gameId: string, playerName: string, eventType: string, data: any = {}): void {
    const game = this.games.get(gameId);
    if (!game) return;
    
    const userId = game.playerUserIds.get(playerName);
    if (!userId) return;
    
    // Use cached email if available, otherwise queue with userId for later resolution
    const cachedEmail = this.userEmailCache.get(userId);
    if (cachedEmail) {
      this.eventQueue.push({ email: cachedEmail, eventType, data });
      this.processEventQueue();
    } else {
      // Resolve email in background and queue
      this.getUserEmail(userId).then(email => {
        if (email) {
          this.eventQueue.push({ email, eventType, data });
          this.processEventQueue();
        }
      }).catch(() => {});
    }
  }

  // Process queued events in background
  private async processEventQueue(): Promise<void> {
    if (this.isProcessingQueue || this.eventQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    // Process in batches of 5
    while (this.eventQueue.length > 0) {
      const batch = this.eventQueue.splice(0, 5);
      await Promise.all(
        batch.map(event => 
          trackGameEvent(event.email, event.eventType, event.data).catch(() => {})
        )
      );
    }
    
    this.isProcessingQueue = false;
  }

  private async trackPlayerEvent(gameId: string, playerName: string, eventType: string, data: any = {}): Promise<{ completedAchievements: any[], completedMissions: any[] }> {
    try {
      const game = this.games.get(gameId);
      if (!game) return { completedAchievements: [], completedMissions: [] };
      
      const userId = game.playerUserIds.get(playerName);
      if (!userId) return { completedAchievements: [], completedMissions: [] };
      
      const email = await this.getUserEmail(userId);
      if (!email) return { completedAchievements: [], completedMissions: [] };
      
      return await trackGameEvent(email, eventType, data);
    } catch (error) {
      console.error('Failed to track event:', error);
      return { completedAchievements: [], completedMissions: [] };
    }
  }

  // Public method to update player-to-game mapping
  setPlayerToGame(socketId: string, gameId: string): void {
    this.playerToGame.set(socketId, gameId);
  }

  // Get the game creator (first human player who joined)
  getGameCreator(gameId: string): string | null {
    const game = this.games.get(gameId);
    if (!game) return null;
    
    // Find the first human player (not CPU)
    for (const playerName of game.turnOrder) {
      if (!playerName.startsWith('CPU-')) {
        return playerName;
      }
    }
    return null;
  }

  private createInitialDeck(type: keyof typeof CARD_DATA, deletedCardIds: Set<string> = new Set()): Card[] {
    const frontImages = CARD_DATA[type];
    const backImage = DECK_BACK_IMAGES[type];
    
    return frontImages
      .map((frontImage, index) => ({
        id: `${type}-${index}`,
        type,
        frontImage,
        backImage,
        owner: '',
        text: ''
      }))
      .filter(card => !deletedCardIds.has(card.id));
  }

  async loadDeletedCardIds(): Promise<Set<string>> {
    try {
      const modifications = await db.select().from(cardModifications).where(eq(cardModifications.isDeleted, true));
      return new Set(modifications.map(m => m.originalCardId));
    } catch (error) {
      console.error('Error loading deleted card IDs:', error);
      return new Set();
    }
  }

  async loadCardModifications(): Promise<Map<string, any>> {
    try {
      const modifications = await db.select().from(cardModifications).where(eq(cardModifications.isDeleted, false));
      const modMap = new Map<string, any>();
      modifications.forEach(mod => {
        modMap.set(mod.originalCardId, mod);
      });
      return modMap;
    } catch (error) {
      console.error('Error loading card modifications:', error);
      return new Map();
    }
  }

  async applyCardModificationsToDecks(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    try {
      const modifications = await this.loadCardModifications();
      
      for (const deckType of ['personaggi', 'mosse', 'bonus', 'personaggi_speciali'] as const) {
        const deck = game.decks[deckType];
        deck.forEach((card, index) => {
          const mod = modifications.get(card.id);
          if (mod) {
            if (mod.name) card.name = mod.name;
            if (mod.imageUrl) card.frontImage = mod.imageUrl;
            if (mod.pti !== null && mod.pti !== undefined) card.pti = mod.pti;
            if (mod.stars !== null && mod.stars !== undefined) card.stars = mod.stars;
            if (mod.effect) card.effect = mod.effect;
            if (mod.audioUrl) card.audioUrl = mod.audioUrl;
            console.log(`Applied modifications to card ${card.id}: name=${mod.name}, audioUrl=${mod.audioUrl}`);
          }
        });
      }
    } catch (error) {
      console.error('Error applying card modifications:', error);
    }
  }

  // Apply modifications to a single card (used by refresh)
  private applyModificationToCard(card: Card, mod: any): void {
    if (mod.name) card.name = mod.name;
    if (mod.imageUrl) card.frontImage = mod.imageUrl;
    if (mod.pti !== null && mod.pti !== undefined) card.pti = mod.pti;
    if (mod.stars !== null && mod.stars !== undefined) card.stars = mod.stars;
    if (mod.effect) card.effect = mod.effect;
    // Always update audioUrl (including clearing it if null/undefined)
    card.audioUrl = mod.audioUrl || undefined;
  }

  // Refresh card metadata for all active games (called after admin modifications)
  async refreshCardMetadataForAllGames(): Promise<string[]> {
    const refreshedGameIds: string[] = [];
    
    try {
      const modifications = await this.loadCardModifications();
      
      this.games.forEach((game: GameState, gameId: string) => {
        // Apply modifications to all cards in decks
        for (const deckType of ['personaggi', 'mosse', 'bonus', 'personaggi_speciali'] as const) {
          game.decks[deckType].forEach((card: Card) => {
            const mod = modifications.get(card.id);
            if (mod) {
              this.applyModificationToCard(card, mod);
            }
          });
        }
        
        // Apply modifications to all player hands
        const players = game.players as Record<string, Player>;
        Object.values(players).forEach((player: Player) => {
          player.hand.forEach((card: Card) => {
            const mod = modifications.get(card.id);
            if (mod) {
              this.applyModificationToCard(card, mod);
              console.log(`Refreshed card ${card.id} in ${player.name}'s hand: audioUrl=${mod.audioUrl}`);
            }
          });
        });
        
        // Apply modifications to cards on field
        game.field.forEach((card: Card) => {
          const mod = modifications.get(card.id);
          if (mod) {
            this.applyModificationToCard(card, mod);
          }
        });
        
        // Apply modifications to cards in graveyard
        game.graveyard.forEach((card: Card) => {
          const mod = modifications.get(card.id);
          if (mod) {
            this.applyModificationToCard(card, mod);
          }
        });
        
        refreshedGameIds.push(gameId);
        console.log(`Refreshed card metadata for game ${gameId}`);
      });
    } catch (error) {
      console.error('Error refreshing card metadata:', error);
    }
    
    return refreshedGameIds;
  }

  // Get all active game IDs (for broadcasting updates)
  getActiveGameIds(): string[] {
    return Array.from(this.games.keys());
  }

  async loadPermanentCardsIntoDeck(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    try {
      const permanentCards = await db.select().from(customCards);
      
      permanentCards.forEach((cardRecord) => {
        const cardId = `permanent-${cardRecord.deckType}-${cardRecord.id}`;
        
        const targetDeck = game.decks[cardRecord.deckType as keyof typeof game.decks];
        if (targetDeck && !targetDeck.some(c => c.id === cardId)) {
          const isCharacterCard = cardRecord.deckType === 'personaggi' || cardRecord.deckType === 'personaggi_speciali';
          
          // For character cards, text only contains PTI and stars (not the name)
          let cardText = '';
          if (isCharacterCard) {
            const ptiText = cardRecord.pti != null ? `PTI: ${cardRecord.pti}` : '';
            const starsText = cardRecord.stars != null ? `Stelle: ${cardRecord.stars}` : '';
            cardText = [ptiText, starsText].filter(Boolean).join(' | ');
          }
          
          const card: Card = {
            id: cardId,
            type: cardRecord.deckType as 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali',
            frontImage: cardRecord.imageData,
            backImage: this.getBackImageForDeck(cardRecord.deckType),
            owner: '',
            name: cardRecord.name || undefined, // Store the custom name separately
            text: cardText,
            pti: isCharacterCard ? cardRecord.pti : null,
            stars: isCharacterCard ? cardRecord.stars : null,
            effect: cardRecord.effect || undefined, // Store AI-processed effect
            audioUrl: cardRecord.audioUrl || undefined // Store audio URL for playback
          };

          targetDeck.push(card);
        }
      });

      if (permanentCards.length > 0) {
        console.log(`Loaded ${permanentCards.length} permanent custom cards into game ${gameId}`);
        // Re-shuffle all decks after adding permanent cards so they're properly mixed in
        this.shuffleGameDecks(game);
      }
    } catch (error) {
      console.error('Error loading permanent cards:', error);
    }
  }

  private initializeGame(gameId: string, deletedCardIds: Set<string> = new Set()): GameState {
    const gameState = {
      decks: {
        personaggi: this.createInitialDeck('personaggi', deletedCardIds),
        mosse: this.createInitialDeck('mosse', deletedCardIds),
        bonus: this.createInitialDeck('bonus', deletedCardIds),
        personaggi_speciali: this.createInitialDeck('personaggi_speciali', deletedCardIds)
      },
      players: {},
      field: [],
      graveyard: [],
      scenarioCardsActive: false,
      eventCounter: 0,
      startTime: new Date(),
      turnOrder: [],
      currentTurnIndex: 0,
      spectators: [],
      characterLimit: 'unlimited',
      eliminatedPlayers: new Set<string>(),
      eliminationOrder: [],
      playerUserIds: new Map<string, number>(),
      gameEnded: false,
      pointsAwarded: false,
      pendingTransferRequests: [],
      voodooLinks: [],
      prSpentThisGame: new Map<string, number>(),
      persistentDamages: [],
      parasiticAttachments: [],
      rifugioProtections: [],
      barrieraShields: [],
      delayedDamages: [],
      playerDeathModifiers: new Map<string, number>()
    };

    // Auto-shuffle all decks when starting a new game
    this.shuffleGameDecks(gameState);
    
    return gameState;
  }

  async addPlayer(gameId: string, playerName: string, socketId: string, isCPU: boolean = false): Promise<void> {
    if (!this.games.has(gameId)) {
      const deletedCardIds = await this.loadDeletedCardIds();
      this.games.set(gameId, this.initializeGame(gameId, deletedCardIds));
      await this.createMatchRecord(gameId);
      await this.loadPermanentCardsIntoDeck(gameId);
      await this.applyCardModificationsToDecks(gameId);
    }

    const game = this.games.get(gameId)!;
    const player: Player = {
      name: playerName,
      hand: [],
      socketId,
      isCPU,
      usedCardsThisTurn: [] // Initialize tracking of used cards
    };

    if (isCPU) {
      player.cpuInstance = new CPUPlayer(playerName, gameId);
      player.cpuInstance.resetOpeningSequence(); // Reset opening sequence for new game
      player.cpuInstance.setGameManager(this); // Pass game manager reference for card usage tracking
    }

    game.players[playerName] = player;

    // Add player to turn order if not already present
    if (!game.turnOrder.includes(playerName)) {
      game.turnOrder.push(playerName);
      console.log(`Player ${playerName} added to turn order. Current turn order:`, game.turnOrder);
    }

    this.playerToGame.set(socketId, gameId);
    
    // Record player join event
    await this.recordEvent(gameId, 'player-join', { playerName, isCPU }, playerName);
  }

  private async createMatchRecord(gameId: string): Promise<void> {
    try {
      const game = this.games.get(gameId);
      if (!game) return;

      // Temporarily disabled due to database connection issues
      // Will be re-enabled once SSL issues are resolved
      console.log('Match record creation temporarily disabled for gameId:', gameId);
      
      // const [match] = await db.insert(matches).values({
      //   gameId,
      //   players: [],
      //   startedAt: game.startTime,
      //   gameMode: 'standard',
      //   totalEvents: 0
      // }).returning();

      // game.matchId = match.id;
    } catch (error) {
      console.error('Failed to create match record:', error);
    }
  }

  async processGameInstruction(gameId: string, playerName: string, instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    console.log(`Processing game instruction from ${playerName}: "${instruction}"`);

    // Use AI to understand and process the instruction
    try {
      const result = await this.processInstructionWithAI(gameId, playerName, instruction);
      if (result) {
        return result;
      }
    } catch (error) {
      console.error('AI instruction processing failed, falling back to pattern matching:', error);
    }

    // Fallback to pattern matching for known instructions
    const lowercaseInstruction = instruction.toLowerCase();

    // More flexible pattern matching for turn reversal
    if ((lowercaseInstruction.includes('inverti') || lowercaseInstruction.includes('cambia') || lowercaseInstruction.includes('reverse')) && 
        (lowercaseInstruction.includes('turni') || lowercaseInstruction.includes('ordine'))) {
      return await this.reverseTurnOrder(gameId, playerName, instruction);
    }

    // More flexible pattern matching for covering cards
    if ((lowercaseInstruction.includes('copri') || lowercaseInstruction.includes('nascondi')) && 
        lowercaseInstruction.includes('carte')) {
      return await this.coverAllCards(gameId, playerName, instruction);
    }

    // More flexible pattern matching for uncovering cards
    if ((lowercaseInstruction.includes('scopri') || lowercaseInstruction.includes('mostra') || lowercaseInstruction.includes('rivela')) && 
        lowercaseInstruction.includes('carte')) {
      return await this.uncoverAllCards(gameId, playerName, instruction);
    }

    // NEW: Pattern for playing cards on field (tutti mettono in campo i BONUS/MOSSE/PERSONAGGI)
    if ((lowercaseInstruction.includes('mettono in campo') || lowercaseInstruction.includes('giocano') || 
         lowercaseInstruction.includes('mette in campo') || lowercaseInstruction.includes('gioca')) && 
        (lowercaseInstruction.includes('bonus') || lowercaseInstruction.includes('mosse') || 
         lowercaseInstruction.includes('personaggi'))) {
      
      let cardType: 'personaggi' | 'mosse' | 'bonus' = 'personaggi';
      if (lowercaseInstruction.includes('bonus')) cardType = 'bonus';
      else if (lowercaseInstruction.includes('mosse')) cardType = 'mosse';
      else if (lowercaseInstruction.includes('personaggi')) cardType = 'personaggi';
      
      // Check if it's for all players or specific player
      const gameState = this.getGameState(gameId);
      const players = gameState ? Object.keys(gameState.players) : [];
      const specificPlayer = players.find(p => lowercaseInstruction.includes(p.toLowerCase()));
      
      if (lowercaseInstruction.includes('tutti')) {
        return await this.playAllCardsOnField(gameId, cardType, instruction);
      } else if (specificPlayer) {
        return await this.playPlayerCardOnField(gameId, specificPlayer, cardType, instruction);
      }
    }

    // NEW: Pattern for showing cards to specific players (L'utente X mostra la carta Y a utente Z)
    if ((lowercaseInstruction.includes('mostra la carta') || lowercaseInstruction.includes('mostra carta')) && 
        (lowercaseInstruction.includes(' a ') || lowercaseInstruction.includes("all'utente"))) {
      
      const gameState = this.getGameState(gameId);
      const players = gameState ? Object.keys(gameState.players) : [];
      
      // Extract player names and card type
      const showingPlayer = players.find(p => {
        const lowerName = p.toLowerCase();
        const words = lowerName.split(/[-_\s]/);
        return words.some(word => lowercaseInstruction.includes(word));
      });
      
      // Extract target player (after "a " or "all'utente")
      let afterA = '';
      if (lowercaseInstruction.includes(' a ')) {
        afterA = lowercaseInstruction.split(' a ')[1];
      } else if (lowercaseInstruction.includes("all'utente")) {
        afterA = lowercaseInstruction.split("all'utente")[1];
      }
      
      const targetPlayer = afterA ? players.find(p => {
        const lowerName = p.toLowerCase();
        const words = lowerName.split(/[-_\s]/);
        return words.some(word => afterA.includes(word));
      }) : null;
      
      // Extract card type
      let cardType: 'personaggi' | 'mosse' | 'bonus' | null = null;
      if (lowercaseInstruction.includes('bonus')) cardType = 'bonus';
      else if (lowercaseInstruction.includes('mosse')) cardType = 'mosse';
      else if (lowercaseInstruction.includes('personaggi')) cardType = 'personaggi';
      
      if (showingPlayer && targetPlayer && cardType) {
        return await this.showCardToPlayer(gameId, showingPlayer, targetPlayer, cardType, instruction);
      }
    }

    // More flexible card distribution patterns
    const distributionPatterns = [
      /(\d+)\s*carte?\s*(personaggi|mosse|bonus|personaggi_speciali)/i,
      /(\d+)\s*(personaggi|mosse|bonus|personaggi_speciali)/i,
      /(personaggi|mosse|bonus|personaggi_speciali)\s*(\d+)/i,
      /(\d+)\s*carte/i
    ];

    for (const pattern of distributionPatterns) {
      const match = instruction.match(pattern);
      if (match && (lowercaseInstruction.includes('tutti') || lowercaseInstruction.includes('partecipanti') || 
                   lowercaseInstruction.includes('giocatori') || lowercaseInstruction.includes('utenti') ||
                   lowercaseInstruction.includes('pescano') || lowercaseInstruction.includes('prendono'))) {
        
        let count = 1;
        let deckType = 'mosse';
        
        if (pattern.source.includes('\\d+')) {
          const numberMatch = instruction.match(/(\d+)/);
          if (numberMatch) count = parseInt(numberMatch[1]);
        }
        
        const typeMatch = instruction.match(/(personaggi|mosse|bonus|personaggi_speciali)/i);
        if (typeMatch) {
          deckType = typeMatch[1].toLowerCase().replace(' ', '_');
        }
        
        return await this.distributeCards(gameId, playerName, instruction, count, deckType);
      }
    }

    // Advanced swap/transfer patterns
    if ((lowercaseInstruction.includes('scambi') || lowercaseInstruction.includes('scambia')) && 
        lowercaseInstruction.includes('personaggi') && 
        (lowercaseInstruction.includes('tutti') || lowercaseInstruction.includes('tra'))) {
      return await this.swapPersonaggiCardsInstruction(gameId, playerName, instruction);
    }

    // Player-specific transfer patterns
    const gameState = this.getGameState(gameId);
    const players = gameState ? Object.keys(gameState.players) : [];
    
    // Check for player mentions and transfer actions
    const transferKeywords = ['passa', 'va', 'trasferisce', 'scambia', 'dai', 'manda'];
    const hasTransferKeyword = transferKeywords.some(keyword => lowercaseInstruction.includes(keyword));
    
    if (hasTransferKeyword && lowercaseInstruction.includes('personaggi')) {
      const mentionedPlayers = players.filter(player => 
        lowercaseInstruction.includes(player.toLowerCase())
      );
      
      if (mentionedPlayers.length >= 2) {
        return await this.transferPersonaggioCard(gameId, mentionedPlayers[0], mentionedPlayers[1], instruction);
      }
    }

    // Elimination patterns
    if ((lowercaseInstruction.includes('elimina') || lowercaseInstruction.includes('rimuovi') ||
         lowercaseInstruction.includes('espelli') || lowercaseInstruction.includes('togli')) && 
        (lowercaseInstruction.includes('utente') || lowercaseInstruction.includes('giocatore'))) {
      
      const mentionedPlayer = players.find(p => lowercaseInstruction.includes(p.toLowerCase()));
      if (mentionedPlayer) {
        return await this.penalizePlayer(gameId, mentionedPlayer, instruction);
      }
    }

    // Card position changes (field swaps)
    if ((lowercaseInstruction.includes('cambia') || lowercaseInstruction.includes('sposta')) && 
        (lowercaseInstruction.includes('posizioni') || lowercaseInstruction.includes('campo'))) {
      return await this.swapFieldPositions(gameId, playerName, instruction);
    }

    // Individual player card distribution
    const playerCardMatch = players.find(player => {
      const playerWords = player.toLowerCase().split(/[-_\s]/);
      return playerWords.some(word => lowercaseInstruction.includes(word)) && 
             (lowercaseInstruction.includes('pesca') || lowercaseInstruction.includes('prendi') || 
              lowercaseInstruction.includes('ricevi') || lowercaseInstruction.includes('dai'));
    });

    if (playerCardMatch) {
      const numbers = instruction.match(/\d+/g);
      const count = numbers && numbers[0] ? parseInt(numbers[0]) : 1;
      
      let cardType: 'personaggi' | 'mosse' | 'bonus' = 'personaggi';
      if (lowercaseInstruction.includes('mosse')) cardType = 'mosse';
      else if (lowercaseInstruction.includes('bonus')) cardType = 'bonus';
      
      return await this.distributeCardsToPlayer(gameId, playerCardMatch, cardType, count, instruction);
    }

    // PTI/Stats modification patterns
    const ptiMatch = instruction.match(/(?:imposta|setta|cambia).*?pti\s*(\d+)/i);
    if (ptiMatch) {
      const newPTI = parseInt(ptiMatch[1]);
      return await this.setAllPersonaggiPTI(gameId, newPTI, instruction);
    }

    // Game state management
    if (lowercaseInstruction.includes('reset') || 
        (lowercaseInstruction.includes('ricomincia') && lowercaseInstruction.includes('partita'))) {
      return await this.resetGameInstruction(gameId, playerName, instruction);
    }

    // Death limit modifier patterns: "L'utente X può avere 1/2 morto/morti in più/meno"
    const deathModifierMatch = instruction.match(/l'utente\s+(\S+)\s+pu[oò]\s+avere\s+(\d+)\s+mort[io]\s+in\s+(pi[uù]|meno)/i);
    if (deathModifierMatch) {
      const targetPlayerName = deathModifierMatch[1];
      const modifierValue = parseInt(deathModifierMatch[2]);
      const modifierDirection = deathModifierMatch[3].toLowerCase().includes('pi') ? 1 : -1;
      const actualModifier = modifierValue * modifierDirection;
      
      // Find matching player (case-insensitive)
      const matchingPlayer = players.find(p => p.toLowerCase() === targetPlayerName.toLowerCase());
      if (matchingPlayer) {
        return await this.modifyPlayerDeathLimit(gameId, playerName, matchingPlayer, actualModifier, instruction);
      }
    }

    // If no pattern matched, ask clarifying questions
    console.log(`Unrecognized game instruction: "${instruction}"`);
    return await this.askClarifyingQuestion(gameId, playerName, instruction);
  }

  private async askClarifyingQuestion(gameId: string, playerName: string, instruction: string) {
    const lowercaseInstruction = instruction.toLowerCase();
    
    // Get current game state for context-aware suggestions
    const gameState = this.getGameState(gameId);
    const players = gameState ? Object.keys(gameState.players) : [];
    const currentPlayerNames = players.length > 0 ? players.join(", ") : "giocatori";
    
    // Advanced keyword analysis with action detection
    const actionKeywords = {
      transfer: ['scambi', 'scambia', 'passa', 'trasferis', 'dai', 'manda', 'cambia', 'switch'],
      eliminate: ['elimina', 'rimuovi', 'espelli', 'butta', 'togli', 'uccidi', 'morti', 'muore'],
      distribute: ['pesca', 'prendi', 'dai', 'distribuisci', 'assegna', 'ricevi'],
      control: ['inverti', 'cambia turno', 'salta', 'passa turno', 'controllo'],
      visibility: ['copri', 'scopri', 'nascondi', 'mostra', 'rivela', 'gira'],
      modify: ['modifica', 'aggiorna', 'imposta', 'setta', 'cambia valore', 'PTI', 'stelle', 'stats'],
      game: ['fine', 'termina', 'reset', 'ricomincia', 'nuovo', 'vittoria', 'vince']
    };

    const entityKeywords = {
      cards: ['carte', 'personaggi', 'mosse', 'bonus', 'speciali'],
      players: ['utenti', 'giocatori', 'tutti', 'partecipanti', 'cpu', 'umani'],
      locations: ['campo', 'mano', 'deck', 'cimitero', 'graveyard', 'mazzo']
    };

    // Analyze instruction intent
    let detectedAction = null;
    let detectedEntities = [];
    
    for (const [action, keywords] of Object.entries(actionKeywords)) {
      if (keywords.some(keyword => lowercaseInstruction.includes(keyword))) {
        detectedAction = action;
        break;
      }
    }
    
    for (const [entity, keywords] of Object.entries(entityKeywords)) {
      if (keywords.some(keyword => lowercaseInstruction.includes(keyword))) {
        detectedEntities.push(entity);
      }
    }

    // Context-aware responses based on detected intent
    if (detectedAction === 'transfer' && detectedEntities.includes('cards')) {
      return {
        isQuestion: true,
        message: `🔄 Vuoi trasferire delle carte tra giocatori!\n\n**Opzioni disponibili:**\n• "Scambia i PERSONAGGI tra ${currentPlayerNames}"\n• "Il PERSONAGGIO di [nome] va a [altro nome]"\n• "Tutti si scambiano le carte in mano"\n• "Ruota i PERSONAGGI in campo"\n\n**Giocatori attuali:** ${currentPlayerNames}\n\nSpecifica esattamente cosa vuoi scambiare e tra chi!`
      };
    }

    if (detectedAction === 'eliminate' && detectedEntities.includes('players')) {
      return {
        isQuestion: true,
        message: `⚠️ Vuoi eliminare un giocatore!\n\n**Attenzione:** Non posso rimuovere giocatori dalla partita, ma posso:\n• Azzerare le carte di un giocatore: "Togli tutte le carte a [nome]"\n• Mandare le carte al cimitero: "Il PERSONAGGIO di [nome] muore"\n• Penalizzare: "Tutti pescano 3 carte tranne [nome]"\n\n**Giocatori attuali:** ${currentPlayerNames}\n\nCosa vuoi fare esattamente?`
      };
    }

    if (detectedAction === 'distribute' && detectedEntities.includes('cards')) {
      const numbers = instruction.match(/\d+/g);
      const suggestedNumber = numbers && numbers[0] ? numbers[0] : '1';
      
      return {
        isQuestion: true,
        message: `🎴 Vuoi far pescare delle carte!\n\n**Formato corretto:**\n• "Tutti pescano ${suggestedNumber} PERSONAGGI"\n• "${currentPlayerNames.split(',')[0]?.trim() || 'Nome'} pesca 2 MOSSE"\n• "I giocatori prendono 3 BONUS"\n\n**Tipi disponibili:** PERSONAGGI, MOSSE, BONUS, SPECIALI\n**Giocatori:** ${currentPlayerNames}\n\nSpecifica: chi, quante, che tipo!`
      };
    }

    if (detectedAction === 'control') {
      return {
        isQuestion: true,
        message: `🎮 Vuoi gestire i turni!\n\n**Opzioni disponibili:**\n• "Inverti l'ordine dei turni"\n• "Salta il turno di [nome]"\n• "Passa il turno a [nome]"\n• "Cambia l'ordine: [nome1], [nome2]..."\n\n**Giocatori attuali:** ${currentPlayerNames}\n\nSpecifica come vuoi modificare i turni!`
      };
    }

    if (detectedAction === 'visibility') {
      return {
        isQuestion: true,
        message: `👁️ Vuoi gestire la visibilità delle carte!\n\n**Opzioni disponibili:**\n• "Copri tutte le carte in campo"\n• "Scopri i PERSONAGGI di tutti"\n• "Nascondi le carte di [nome]"\n• "Mostra le carte in mano a tutti"\n\n**Posizioni:** campo, mano, deck\n**Giocatori:** ${currentPlayerNames}\n\nSpecifica cosa vuoi nascondere/mostrare!`
      };
    }

    if (detectedAction === 'modify') {
      return {
        isQuestion: true,
        message: `⚙️ Vuoi modificare le statistiche delle carte!\n\n**Opzioni disponibili:**\n• "Imposta PTI 5 al PERSONAGGIO di [nome]"\n• "Aggiungi 2 stelle alla carta [nome carta]"\n• "Modifica le note della carta: [testo]"\n• "Azzera i PTI di tutti i PERSONAGGI"\n\n**Statistiche:** PTI (vita), stelle (danno), note\n\nSpecifica quale carta e cosa modificare!`
      };
    }

    if (detectedAction === 'game') {
      return {
        isQuestion: true,
        message: `🏁 Vuoi gestire lo stato della partita!\n\n**Opzioni disponibili:**\n• "Dichiarare vincitore: [nome]"\n• "Reset completo della partita"\n• "Termina la partita"\n• "Nuovo round per tutti"\n\n**Nota:** Alcune azioni potrebbero cancellare il progresso!\n\nConfermi cosa vuoi fare?`
      };
    }

    // Player name detection
    const mentionedPlayers = players.filter(player => 
      lowercaseInstruction.includes(player.toLowerCase())
    );
    
    if (mentionedPlayers.length > 0) {
      return {
        isQuestion: true,
        message: `👤 Hai menzionato: **${mentionedPlayers.join(', ')}**\n\n**Cosa vuoi fare con questi giocatori?**\n• Trasferire carte: "Il PERSONAGGIO di ${mentionedPlayers[0]} va a ${players.find(p => p !== mentionedPlayers[0]) || 'altro giocatore'}"\n• Far pescare: "${mentionedPlayers[0]} pesca 2 MOSSE"\n• Gestire turni: "Salta il turno di ${mentionedPlayers[0]}"\n• Modificare carte: "Copri le carte di ${mentionedPlayers[0]}"\n\n**Tutti i giocatori:** ${currentPlayerNames}\n\nSii più specifico sull'azione!`
      };
    }

    // Card type detection
    const cardTypes = ['personaggi', 'mosse', 'bonus', 'speciali'];
    const mentionedCardTypes = cardTypes.filter(type => 
      lowercaseInstruction.includes(type)
    );
    
    if (mentionedCardTypes.length > 0) {
      return {
        isQuestion: true,
        message: `🃏 Hai menzionato: **${mentionedCardTypes.join(', ').toUpperCase()}**\n\n**Cosa vuoi fare con queste carte?**\n• Far pescare: "Tutti pescano 2 ${mentionedCardTypes[0].toUpperCase()}"\n• Trasferire: "Scambia i ${mentionedCardTypes[0].toUpperCase()} tra tutti"\n• Gestire: "Copri tutti i ${mentionedCardTypes[0].toUpperCase()} in campo"\n• Modificare: "Azzera i PTI dei ${mentionedCardTypes[0].toUpperCase()}"\n\n**Giocatori:** ${currentPlayerNames}\n\nSpecifica l'azione esatta!`
      };
    }

    // Generic intelligent help
    return {
      isQuestion: true,
      message: `🤔 Analizzo: "${instruction}"\n\n**Non ho capito l'azione. Ti aiuto:**\n\n🎯 **Azioni comuni:**\n• **Pescare:** "Tutti pescano 2 PERSONAGGI"\n• **Scambiare:** "Scambia i PERSONAGGI tra tutti"\n• **Gestire:** "Inverti i turni" / "Copri le carte"\n• **Modificare:** "Imposta PTI 5 al personaggio di [nome]"\n\n📋 **Elementi disponibili:**\n• **Giocatori:** ${currentPlayerNames}\n• **Carte:** PERSONAGGI, MOSSE, BONUS, SPECIALI\n• **Posizioni:** campo, mano, deck, cimitero\n\n💡 **Scrivi in modo chiaro:** CHI fa COSA a QUALE CARTA/GIOCATORE\n\nRiformula la tua istruzione!`
    };
  }

  private async processInstructionWithAI(gameId: string, playerName: string, instruction: string) {
    try {
      // Skip AI if we know we have quota issues, rely on pattern matching
      // Use Replit's native AI integration key first, fallback to user's key
      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return null;
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey });

      // Get current game state for context
      const game = this.games.get(gameId);
      if (!game) return null;
      
      const gameState = {
        players: Object.keys(game.players),
        field: game.field.map(c => ({ id: c.id, type: c.type, text: c.text || '', owner: c.owner })),
        graveyard: game.graveyard.map(c => ({ id: c.id, type: c.type, owner: c.owner })),
        deckCounts: {
          personaggi: game.decks.personaggi.length,
          mosse: game.decks.mosse.length,
          bonus: game.decks.bonus.length,
          personaggi_speciali: game.decks.personaggi_speciali.length
        }
      };

      const prompt = `Sei un interprete di istruzioni per MINKIARDS, un gioco di carte italiano. Analizza questa istruzione e converti in azione JSON:

**ISTRUZIONE:** "${instruction}"

**STATO CORRENTE:**
- Giocatori: ${gameState.players.join(', ')}
- Carte in campo: ${gameState.field.length}
- Carte cimitero: ${gameState.graveyard.length}
- Mazzi disponibili: ${Object.entries(gameState.deckCounts).map(([k,v]) => `${k} (${v})`).join(', ')}

**AZIONI SUPPORTATE (comprendine TUTTE le variazioni e sinonimi):**

**GESTIONE TURNI:**
- "reverse-turns" - invertire ordine turni
- "skip-turn" - saltare turno giocatore specifico {playerName}
- "set-turn" - impostare di chi è il turno {playerName}

**DISTRIBUZIONE CARTE:**
- "distribute-cards" - far pescare carte {count, cardType, target: "all"|playerName}
- "give-cards" - dare carte specifiche {cardIds, fromPlayer, toPlayer}

**GESTIONE CAMPO:**
- "cover-cards" - coprire carte {target: "all"|"field"|playerName}
- "uncover-cards" - scoprire carte {target: "all"|"field"|playerName}
- "move-card" - spostare carta specifica {cardId, from: "field"|"hand"|"graveyard", to: "field"|"hand"|"graveyard"|"deck", targetPlayer?}

**MODIFICHE CARTE:**
- "modify-pti" - modificare PTI {cardId, newPTI, operation: "set"|"add"|"subtract"}
- "modify-notes" - modificare note carta {cardId, newNotes}
- "eliminate-card" - eliminare carta specifica {cardId}

**TRASFERIMENTI:**
- "transfer-card" - trasferire carte tra giocatori {cardId?, cardType?, fromPlayer, toPlayer, count?}
- "swap-cards" - scambiare carte {player1, player2, cardType?}

**AZIONI GLOBALI:**
- "shuffle-deck" - mescolare mazzo {deckType}
- "reset-game" - resettare partita
- "eliminate-player" - eliminare giocatore {playerName}

**ESEMPI:**
- "Marco pesca 2 personaggi" → {"action": "distribute-cards", "parameters": {"count": 2, "cardType": "personaggi", "target": "Marco"}}
- "Il personaggio di Luca va a Sara" → {"action": "transfer-card", "parameters": {"cardType": "personaggi", "fromPlayer": "Luca", "toPlayer": "Sara"}}
- "Azzera PTI del barbone" → {"action": "modify-pti", "parameters": {"cardId": "identifica dalle note/campo", "newPTI": 0, "operation": "set"}}
- "Scambia le mosse tra tutti" → {"action": "swap-cards", "parameters": {"cardType": "mosse"}}

**IMPORTANTE:** 
- Identifica giocatori, tipi carte e azioni dalle parole chiave italiane
- Se menzioni carta specifica, cerca di identificarla dal campo/nome
- Se non specifichi target, applica a "all"
- Se azione non è chiara, usa "unknown"

Rispondi SOLO in JSON:`;

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 500
      });

      const aiResponse = JSON.parse(response.choices[0].message.content || '{"action": "unknown"}');

      switch (aiResponse.action) {
        case 'reverse-turns':
          return await this.reverseTurnOrder(gameId, playerName, instruction);
          
        case 'distribute-cards':
          const { count = 1, cardType = 'mosse', target = 'all' } = aiResponse.parameters || {};
          return await this.distributeCards(gameId, playerName, instruction, count, cardType, target);
          
        case 'cover-cards':
          const { target: coverTarget = 'all' } = aiResponse.parameters || {};
          return await this.coverAllCards(gameId, playerName, instruction);
          
        case 'uncover-cards':
          const { target: uncoverTarget = 'all' } = aiResponse.parameters || {};
          return await this.uncoverAllCards(gameId, playerName, instruction);
          
        case 'move-card':
          const { cardId, from, to, targetPlayer } = aiResponse.parameters || {};
          return await this.moveCard(gameId, playerName, instruction, cardId, from, to, targetPlayer);
          
        case 'modify-pti':
          const { cardId: ptiCardId, newPTI, operation = 'set' } = aiResponse.parameters || {};
          return await this.modifyCardPTI(gameId, playerName, instruction, ptiCardId, newPTI, operation);
          
        case 'transfer-card':
          const { cardId: transferCardId, cardType: transferType, fromPlayer, toPlayer, count: transferCount = 1 } = aiResponse.parameters || {};
          return await this.transferCard(gameId, playerName, instruction, transferCardId, transferType, fromPlayer, toPlayer, transferCount);
          
        case 'swap-cards':
          const { player1, player2, cardType: swapType } = aiResponse.parameters || {};
          return await this.swapCards(gameId, playerName, instruction, player1, player2, swapType);
          
        case 'eliminate-card':
          const { cardId: elimCardId } = aiResponse.parameters || {};
          return await this.eliminateCard(gameId, playerName, instruction, elimCardId);
          
        case 'eliminate-player':
          const { playerName: elimPlayerName } = aiResponse.parameters || {};
          return await this.eliminatePlayer(gameId, playerName, instruction, elimPlayerName);
          
        case 'skip-turn':
          const { playerName: skipPlayerName } = aiResponse.parameters || {};
          return await this.skipPlayerTurn(gameId, playerName, instruction, skipPlayerName);
          
        case 'set-turn':
          const { playerName: setTurnPlayer } = aiResponse.parameters || {};
          return await this.setPlayerTurn(gameId, playerName, instruction, setTurnPlayer);
          
        case 'modify-notes':
          const { cardId: notesCardId, newNotes } = aiResponse.parameters || {};
          return await this.modifyCardNotes(gameId, playerName, instruction, notesCardId, newNotes);
          
        case 'shuffle-deck':
          const { deckType } = aiResponse.parameters || {};
          return await this.shuffleDeckInstruction(gameId, playerName, instruction, deckType);
          
        case 'reset-game':
          return await this.resetGameInstruction(gameId, playerName, instruction);
          
        case 'give-cards':
          const { cardIds, fromPlayer: giveFromPlayer, toPlayer: giveToPlayer } = aiResponse.parameters || {};
          return await this.giveSpecificCards(gameId, playerName, instruction, cardIds, giveFromPlayer, giveToPlayer);
          
        default:
          return null; // Fall back to pattern matching
      }
    } catch (error) {
      console.error('AI processing error:', error);
      return null; // Fall back to pattern matching
    }
  }

  private async modifyPlayerDeathLimit(gameId: string, issuerName: string, targetPlayer: string, modifier: number, instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');
    
    if (!game.players[targetPlayer]) {
      return { message: `❌ Giocatore "${targetPlayer}" non trovato nella partita.` };
    }
    
    // Set or update the death modifier for this player
    const currentModifier = game.playerDeathModifiers.get(targetPlayer) || 0;
    game.playerDeathModifiers.set(targetPlayer, modifier);
    
    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'modify-death-limit',
      targetPlayer,
      modifier,
      previousModifier: currentModifier
    }, issuerName);
    
    const baseLimit = game.characterLimit === 'unlimited' ? '∞' : game.characterLimit;
    const effectiveLimit = game.characterLimit === 'unlimited' ? 'illimitato' : 
      (parseInt(game.characterLimit) + modifier).toString();
    
    const directionText = modifier > 0 ? `${modifier} morto/i in più` : `${Math.abs(modifier)} morto/i in meno`;
    
    console.log(`Death limit modifier set for ${targetPlayer}: ${modifier} (base: ${baseLimit}, effective: ${effectiveLimit})`);
    
    return { 
      message: `⚖️ ${issuerName} ha modificato il limite di morti per ${targetPlayer}: ${directionText}!\n📊 Limite base: ${baseLimit} → Limite effettivo: ${effectiveLimit}`
    };
  }

  private async reverseTurnOrder(gameId: string, playerName: string, instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const playerNames = Object.keys(game.players);
    const reversedOrder = playerNames.reverse();
    
    if (typeof game.currentTurnIndex !== 'number') {
      game.currentTurnIndex = 0;
    }
    game.currentTurnIndex = reversedOrder.length - 1 - game.currentTurnIndex;
    
    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'reverse-turn-order',
      newOrder: reversedOrder
    }, playerName);

    console.log(`Game instruction executed: Reversed turn order for game ${gameId}`);
    return { 
      message: `⚡ ${playerName} ha invertito l'ordine dei turni! Nuovo ordine: ${reversedOrder.join(' → ')}`
    };
  }

  private async coverAllCards(gameId: string, playerName: string, instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    game.field.forEach(card => {
      card.faceDown = true;
    });

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'cover-field-cards'
    }, playerName);

    console.log(`Game instruction executed: Covered all field cards for game ${gameId}`);
    return { 
      message: `🙈 ${playerName} ha coperto tutte le carte in campo! Le carte sono ora nascoste.`
    };
  }

  private async uncoverAllCards(gameId: string, playerName: string, instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    // Uncover all field cards
    game.field.forEach(card => {
      card.faceDown = false;
    });

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'uncover-field-cards',
      cardsUncovered: game.field.length
    }, playerName);

    console.log(`Game instruction executed: Uncovered ${game.field.length} field cards for game ${gameId}`);
    return { 
      message: `👁️ ${playerName} ha scoperto tutte le carte in campo! ${game.field.length} carte sono ora visibili.`
    };
  }

  private async distributeCards(gameId: string, playerName: string, instruction: string, count: number, deckType: string, target: string = 'all') {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const normalizedDeckType = deckType.toLowerCase().replace(' ', '_') as keyof GameState['decks'];

    // Validate deck type
    if (!game.decks[normalizedDeckType]) {
      throw new Error(`Tipo di carta non valido: ${deckType}`);
    }

    // Determine target players
    let targetPlayers: string[];
    if (target === 'all') {
      targetPlayers = Object.keys(game.players);
    } else if (game.players[target]) {
      targetPlayers = [target];
    } else {
      throw new Error(`Giocatore non trovato: ${target}`);
    }

    // Distribute cards to target players
    for (const targetPlayer of targetPlayers) {
      for (let i = 0; i < count; i++) {
        this.pickCard(gameId, normalizedDeckType, targetPlayer);
      }
    }

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'distribute-cards',
      cardCount: count,
      deckType: normalizedDeckType
    }, playerName);

    const targetDescription = target === 'all' ? 'tutti i giocatori' : target;
    console.log(`Game instruction executed: Distributed ${count} ${deckType} cards to ${targetDescription}`);
    return { 
      message: `🎴 ${playerName} ha fatto pescare ${count} carte ${deckType.toUpperCase()} a ${targetDescription}!`
    };
  }

  private async recordEvent(gameId: string, eventType: string, eventData: any, playerName: string): Promise<void> {
    try {
      const game = this.games.get(gameId);
      if (!game) return;

      game.eventCounter++;

      // Temporarily log events to console instead of database
      console.log('Game Event:', {
        gameId,
        eventType,
        eventData,
        playerName,
        eventOrder: game.eventCounter,
        timestamp: new Date()
      });

      // Database recording temporarily disabled due to SSL issues
      // Will be re-enabled once database connection is stable
      
    } catch (error) {
      console.error('Failed to record event:', error);
    }
  }

  async completeMatch(gameId: string, winnerPlayer?: string): Promise<void> {
    try {
      const game = this.games.get(gameId);
      if (!game) return;
      
      // Prevent duplicate point awards - check if points already awarded
      if (game.pointsAwarded) {
        console.log(`Match ${gameId} points already awarded, skipping duplicate completeMatch call`);
        return;
      }
      
      // Mark points as awarded to prevent duplicate calls
      game.pointsAwarded = true;

      const duration = Math.floor((Date.now() - game.startTime.getTime()) / 1000);
      const playerList = Object.keys(game.players);

      // Only update database if matchId exists
      if (game.matchId) {
        await db.update(matches)
          .set({
            endedAt: new Date(),
            winnerPlayer,
            duration,
            players: playerList
          })
          .where(eq(matches.id, game.matchId));
      }

      await this.awardRankiardPoints(game, winnerPlayer);
      console.log(`Rankiard points awarded for match ${gameId}, winner: ${winnerPlayer}`);

      // Track game events for missions/achievements (non-blocking)
      const humanPlayers = Object.keys(game.players).filter(p => !game.players[p].isCPU);
      for (const player of humanPlayers) {
        this.trackPlayerEventAsync(gameId, player, 'game_played', {});
      }
      if (winnerPlayer && !game.players[winnerPlayer]?.isCPU) {
        this.trackPlayerEventAsync(gameId, winnerPlayer, 'game_won', {});
      }

    } catch (error) {
      console.error('Failed to complete match:', error);
    }
  }

  private calculateRankiardPoints(characterLimit: string, placement: number): number {
    const pointsTable: Record<string, number[]> = {
      '5': [20, 12, 8, 4, 2, 0],
      '3': [12, 8, 6, 3, 1, 0],
      '2': [8, 5, 3, 2, 1, 0],
      '1': [5, 3, 2, 1, 0],
      'unlimited': [5, 3, 2, 1, 0]
    };

    const table = pointsTable[characterLimit] || pointsTable['unlimited'];
    if (placement < 1) return 0;
    if (placement > table.length) return 0;
    return table[placement - 1];
  }

  private async awardRankiardPoints(game: GameState, winnerPlayer?: string): Promise<void> {
    try {
      const allPlayers = Object.keys(game.players).filter(p => !game.players[p].isCPU);
      const characterLimit = game.characterLimit;

      const finalRanking: string[] = [];
      if (winnerPlayer) {
        finalRanking.push(winnerPlayer);
      }

      const eliminatedReversed = [...game.eliminationOrder].reverse();
      for (const player of eliminatedReversed) {
        if (!finalRanking.includes(player) && !game.players[player]?.isCPU) {
          finalRanking.push(player);
        }
      }

      for (const player of allPlayers) {
        if (!finalRanking.includes(player)) {
          finalRanking.push(player);
        }
      }

      console.log(`Rankiard Points - Game Type: ${characterLimit} personaggi, Final Ranking:`, finalRanking);

      for (let i = 0; i < finalRanking.length; i++) {
        const playerName = finalRanking[i];
        const placement = i + 1;
        const points = this.calculateRankiardPoints(characterLimit, placement);
        const userId = game.playerUserIds.get(playerName);

        if (userId && points > 0) {
          try {
            await db.execute(
              sql`UPDATE users SET punti_rankiard = punti_rankiard + ${points} WHERE id = ${userId}`
            );
            console.log(`Awarded ${points} Rankiard points to ${playerName} (userId: ${userId}) for ${placement}° place`);
          } catch (err) {
            console.error(`Failed to award points to ${playerName}:`, err);
          }
        } else if (points > 0) {
          console.log(`No userId found for ${playerName}, skipping points award`);
        }
      }
    } catch (error) {
      console.error('Failed to award Rankiard points:', error);
    }
  }

  setPlayerUserId(gameId: string, playerName: string, userId: number): void {
    const game = this.games.get(gameId);
    if (game) {
      game.playerUserIds.set(playerName, userId);
      console.log(`Set userId ${userId} for player ${playerName} in game ${gameId}`);
    }
  }

  removePlayer(socketId: string): void {
    // Use markPlayerDisconnected instead of removing player completely
    this.markPlayerDisconnected(socketId);
  }

  markPlayerDisconnected(socketId: string): void {
    const gameId = this.playerToGame.get(socketId);
    if (gameId) {
      const game = this.games.get(gameId);
      if (game) {
        // Mark player as disconnected instead of removing
        for (const [playerName, player] of Object.entries(game.players)) {
          if (player.socketId === socketId) {
            player.socketId = null; // Mark as disconnected
            player.disconnectedAt = new Date();
            console.log(`Player ${playerName} disconnected from game ${gameId}, marked as offline`);
            break;
          }
        }
      }
      // Keep the mapping for rejoin - don't delete it immediately
      // this.playerToGame.delete(socketId);
    }
  }

  getGameIdBySocketId(socketId: string): string | undefined {
    return this.playerToGame.get(socketId);
  }

  getPlayerGameId(socketId: string): string | undefined {
    return this.playerToGame.get(socketId);
  }

  // Clean up old socket mappings when player reconnects
  cleanupOldSocketMapping(oldSocketId: string): void {
    if (oldSocketId) {
      this.playerToGame.delete(oldSocketId);
    }
  }

  getGameState(gameId: string): GameState | null {
    return this.games.get(gameId) || null;
  }

  setPlayerAvatar(gameId: string, playerName: string, avatarId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return false;
    
    // Validate avatar ID against whitelist
    const validAvatarIds = [
      'dragon', 'lion', 'wolf', 'eagle', 'shark', 'tiger', 'bear', 'fox',
      'owl', 'snake', 'unicorn', 'phoenix', 'wizard', 'knight', 'ninja',
      'robot', 'alien', 'skull', 'crown', 'star', 'fire', 'lightning',
      'diamond', 'heart'
    ];
    if (!validAvatarIds.includes(avatarId)) {
      console.log(`Invalid avatar ID rejected: ${avatarId}`);
      return false;
    }
    
    game.players[playerName].avatar = avatarId;
    console.log(`Player ${playerName} set avatar to ${avatarId}`);
    return true;
  }

  // Get sanitized game state for Socket.IO transmission (removes circular references)
  getSanitizedGameState(gameId: string): any {
    const gameState = this.games.get(gameId);
    if (!gameState) return null;

    // Create a deep copy of the game state without circular references
    const sanitized = {
      decks: gameState.decks,
      players: {} as Record<string, any>,
      field: gameState.field,
      graveyard: gameState.graveyard,
      scenarioCardsActive: gameState.scenarioCardsActive,
      matchId: gameState.matchId,
      eventCounter: gameState.eventCounter,
      startTime: gameState.startTime,
      turnOrder: gameState.turnOrder,
      currentTurnIndex: gameState.currentTurnIndex,
      spectators: gameState.spectators,
      characterLimit: gameState.characterLimit,
      eliminatedPlayers: Array.from(gameState.eliminatedPlayers), // Convert Set to Array for JSON serialization
      voodooLinks: gameState.voodooLinks || [] // BAMBOLA VOODOO: Include active voodoo links
    };

    // Sanitize players by removing cpuInstance references
    for (const [playerName, player] of Object.entries(gameState.players)) {
      sanitized.players[playerName] = {
        name: player.name,
        hand: player.hand,
        socketId: player.socketId,
        isCPU: player.isCPU,
        avatar: player.avatar
        // Note: cpuInstance is intentionally omitted to prevent circular references
      };
    }

    return sanitized;
  }

  shuffleDeck(gameId: string, deckType: keyof GameState['decks']): void {
    const game = this.games.get(gameId);
    if (!game) return;

    const deck = game.decks[deckType];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  async pickCard(gameId: string, deckType: keyof GameState['decks'], playerName: string): Promise<boolean> {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return false;

    const deck = game.decks[deckType];
    if (deck.length === 0) return false;

    // Check CPU invariants before drawing
    if (!this.canCPUDraw(gameId, playerName, deckType)) {
      console.log(`❌ CPU ${playerName} cannot draw ${deckType} - already has 1 in hand`);
      return false;
    }

    const card = deck.pop()!;
    card.owner = playerName;
    game.players[playerName].hand.push(card);

    // Record pick card event
    await this.recordEvent(gameId, 'pick-card', {
      cardId: card.id,
      deckType,
      cardType: card.type,
      frontImage: card.frontImage
    }, playerName);

    return true;
  }

  // Pick a card and return the card object (for cases where the card is needed immediately)
  async pickCardAndReturn(gameId: string, deckType: keyof GameState['decks'], playerName: string): Promise<Card | null> {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return null;

    const deck = game.decks[deckType];
    if (deck.length === 0) return null;

    // Check CPU invariants before drawing
    if (!this.canCPUDraw(gameId, playerName, deckType)) {
      console.log(`❌ CPU ${playerName} cannot draw ${deckType} - already has 1 in hand`);
      return null;
    }

    const card = deck.pop()!;
    card.owner = playerName;
    game.players[playerName].hand.push(card);

    // Record pick card event
    await this.recordEvent(gameId, 'pick-card', {
      cardId: card.id,
      deckType,
      cardType: card.type,
      frontImage: card.frontImage
    }, playerName);

    return card;
  }

  // Pick multiple cards for opening sequence
  async pickOpeningCards(gameId: string, types: string[], playerName: string): Promise<boolean> {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return false;

    console.log(`Picking opening cards for ${playerName}:`, types);
    
    for (const deckType of types) {
      const deck = game.decks[deckType as keyof GameState['decks']];
      if (deck && deck.length > 0) {
        const card = deck.pop()!;
        card.owner = playerName;
        game.players[playerName].hand.push(card);

        // Record each pick card event
        await this.recordEvent(gameId, 'pick-card', {
          cardId: card.id,
          deckType,
          cardType: card.type,
          frontImage: card.frontImage
        }, playerName);
      }
    }

    return true;
  }

  // INVARIANT HELPERS FOR CPU CARD LIMITS
  countCardsInHand(gameId: string, playerName: string, cardType: string): number {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return 0;
    
    const hand = game.players[playerName].hand;
    return hand.filter(card => {
      if (cardType === 'personaggi') {
        return card.type === 'personaggi' || card.type === 'personaggi_speciali';
      }
      return card.type === cardType;
    }).length;
  }

  countCardsOnField(gameId: string, playerName: string, cardType: string): number {
    const game = this.games.get(gameId);
    if (!game) return 0;
    
    return game.field.filter(card => {
      if (card.owner !== playerName) return false;
      if (cardType === 'personaggi') {
        return card.type === 'personaggi' || card.type === 'personaggi_speciali';
      }
      return card.type === cardType;
    }).length;
  }

  canCPUDraw(gameId: string, playerName: string, cardType: string): boolean {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName] || !game.players[playerName].isCPU) {
      return true; // Non-CPU players can always draw
    }
    
    const handsCount = this.countCardsInHand(gameId, playerName, cardType);
    return handsCount < 1; // CPU can only draw if they have 0 of this type
  }

  canCPUPlayOnField(gameId: string, playerName: string, cardType: string): boolean {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName] || !game.players[playerName].isCPU) {
      return true; // Non-CPU players can always play
    }
    
    const fieldCount = this.countCardsOnField(gameId, playerName, cardType);
    return fieldCount < 1; // CPU can only play if they have 0 of this type on field
  }

  hasPlayedActionThisTurn(gameId: string, playerName: string): boolean {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return false;
    
    const usedCards = game.players[playerName].usedCardsThisTurn || [];
    return usedCards.length > 0;
  }

  chooseSpecificCard(gameId: string, deckType: keyof GameState['decks'], cardId: string, playerName: string): boolean {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return false;

    const deck = game.decks[deckType];
    const cardIndex = deck.findIndex(card => card.id === cardId);
    
    if (cardIndex === -1) return false;

    const card = deck.splice(cardIndex, 1)[0];
    card.owner = playerName;
    game.players[playerName].hand.push(card);

    return true;
  }

  async playCard(gameId: string, cardId: string, playerName: string): Promise<{ card?: any, isPersonaggio?: boolean, duelAutoAttack?: boolean }> {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return {};

    // DUELLO: Check if there's an active duel
    if (game.activeDuel && game.activeDuel.active) {
      const duel = game.activeDuel;
      
      // Only duelists can play cards during a duel
      if (playerName !== duel.player1 && playerName !== duel.player2) {
        console.log(`⚔️ DUELLO: ${playerName} cannot play - only duelists (${duel.player1} and ${duel.player2}) can act`);
        return {};
      }
      
      // Check if it's this player's turn in the duel
      if (playerName !== duel.currentTurn) {
        console.log(`⚔️ DUELLO: It's not ${playerName}'s turn (current turn: ${duel.currentTurn})`);
        return {};
      }
    }

    const player = game.players[playerName];
    const cardIndex = player.hand.findIndex(card => card.id === cardId);
    
    if (cardIndex !== -1) {
      const card = player.hand.splice(cardIndex, 1)[0];
      card.faceDown = false; // Ensure face up when played normally
      
      // If it's a BONUS or MOSSE being placed on the field, initialize turn counter
      if ((card.type === 'bonus' || card.type === 'mosse')) {
        card.turnCounter = 0;
        card.placedBy = playerName;
      }

      game.field.push(card);
      
      // Check if it's a PERSONAGGI or PERSONAGGI_SPECIALI card
      const isPersonaggio = card.type === 'personaggi' || card.type === 'personaggi_speciali';
      
      // Auto-analyze cards for ALL players (PERSONAGGI only) - try sync cache first
      if (isPersonaggio && (!card.text || card.text.trim() === '')) {
        // Use synchronous cache lookup for instant response
        this.autoAnalyzePersonaggioCardSync(card, playerName);
        
        // If cache missed (default values), trigger async lookup in background for humans
        if (card.text === 'PTI: 1000 | Stelle: 1 | PTI originali: 1000') {
          const player = game.players[playerName];
          if (!player?.isCPU) {
            // Async fallback for human players - will update card when data arrives
            this.autoAnalyzePersonaggioCard(gameId, card, playerName).catch(() => {});
          }
        }
      }
      
      // Use card.name for custom cards if available, otherwise extract from URL
      const cardName = card.name || this.getCardNameFromUrl(card.frontImage);
      const cardsWithAnimations = [
        'BAMBOLA VOODOO', 'BAMBOLA-VOODOO', 'UNA TEMPESTA BABY', 'ACCETTATA',
        'ACCHIAPPT CHESSA', 'AGO DI PINO', 'ATTACCO KAMIKAZE', 'BOMBA SENZA DETONATORE',
        'BOMBA', 'CANZONE NEOMELODICA', 'CIAVATTA', 'DUELLO', 'ESPLOSIONE ATOMICA',
        'FUCILE A POMPA', 'FURTO', 'INFLUENZA', 'LU TRATTORE', 'MAZZA DA BASEBALL',
        'MINA VAGANTE', 'MOTOSEGA', 'OMBELICO LANCIAFIAMME', 'ONDA ENERGETICA',
        'PADELLATA IN FACCIA', 'PARTITA DI TENNIS', 'PIOGGIA DI METEORITI', 'PRETA',
        'PUGNO', 'ROULETTE RUSSA', 'SAETTA'
      ];
      
      if (cardsWithAnimations.some(animCard => cardName.toUpperCase().includes(animCard))) {
        console.log(`🎬 Card animation triggered for: ${cardName}`);
        // This will be emitted via broadcast in routes.ts
        card.triggerAnimation = true;
      }
      
      // Record play card event (non-blocking)
      this.recordEvent(gameId, 'play-card', {
        cardId: card.id,
        cardType: card.type,
        frontImage: card.frontImage,
        isPersonaggio,
        triggerAnimation: card.triggerAnimation || false,
        cardName: cardName
      }, playerName);
      
      // Track for missions/achievements (non-blocking)
      this.trackPlayerEventAsync(gameId, playerName, 'card_played', { cardType: card.type });
      
      // Process custom card effect if present
      if (card.effect && card.id.startsWith('permanent-')) {
        await this.processCustomCardEffect(gameId, card, playerName);
      }
      
      // DUELLO: Auto-activate MOSSE cards during duel
      let duelAutoAttack = false;
      if (game.activeDuel && game.activeDuel.active && card.type === 'mosse') {
        const duel = game.activeDuel;
        console.log(`⚔️ DUELLO: ${playerName} played MOSSE card during duel - auto-activating attack`);
        
        // Determine opponent's character in the duel
        const opponentCharacterId = playerName === duel.player1 ? duel.character2Id : duel.character1Id;
        
        // NOTE: We mark this as a duel auto-attack but don't execute here
        // The attack will be triggered via socket event after card is played
        duelAutoAttack = true;
        console.log(`⚔️ DUELLO: Will auto-target character ${opponentCharacterId}`);
      }
      
      return { card, isPersonaggio, duelAutoAttack };
    }
    
    return {};
  }

  // Parse effect text using keywords (no AI required)
  private parseEffectKeywords(effectText: string): Array<{ type: string; target: string; value: number; description: string }> {
    const actions: Array<{ type: string; target: string; value: number; description: string }> = [];
    const text = effectText.toLowerCase();
    
    // Extract numbers from text
    const extractNumber = (str: string): number => {
      const match = str.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 100;
    };

    // DAMAGE patterns
    if (text.includes('danno') || text.includes('infligge') || text.includes('danneggia') || 
        text.includes('colpisce') || text.includes('attacca') || text.includes('ferisce')) {
      const value = extractNumber(text);
      let target = 'opponents';
      if (text.includes('tutti') || text.includes('ogni')) target = 'all';
      if (text.includes('casuale') || text.includes('random')) target = 'random';
      actions.push({ type: 'damage', target, value, description: `Infligge ${value} danni` });
    }

    // HEAL patterns
    if (text.includes('cura') || text.includes('guarisce') || text.includes('ripristina') || 
        text.includes('rigenera') || text.includes('recupera')) {
      const value = extractNumber(text);
      let target = 'self';
      if (text.includes('tutti') || text.includes('alleati')) target = 'all';
      actions.push({ type: 'heal', target, value, description: `Cura ${value} PTI` });
    }

    // DRAW patterns
    if (text.includes('pesca') || text.includes('prendi carta') || text.includes('estrai')) {
      const value = extractNumber(text) || 1;
      actions.push({ type: 'draw', target: 'self', value, description: `Pesca ${value} carte` });
    }

    // DISCARD patterns
    if (text.includes('scarta') || text.includes('elimina dalla mano') || text.includes('rimuovi')) {
      const value = extractNumber(text) || 1;
      let target = 'opponents';
      if (text.includes('avversari') || text.includes('nemici')) target = 'opponents';
      actions.push({ type: 'discard', target, value, description: `Scarta ${value} carte` });
    }

    // STARS patterns
    if (text.includes('stella') || text.includes('stelle')) {
      const value = extractNumber(text) || 1;
      if (text.includes('guadagna') || text.includes('ottiene') || text.includes('+')) {
        actions.push({ type: 'modify_stars', target: 'self', value, description: `Guadagna ${value} stelle` });
      } else if (text.includes('perde') || text.includes('rimuovi') || text.includes('-')) {
        actions.push({ type: 'modify_stars', target: 'opponents', value: -value, description: `Rimuove ${value} stelle` });
      }
    }

    // PTI modification patterns
    if ((text.includes('pti') || text.includes('punti')) && !text.includes('danno') && !text.includes('cura')) {
      const value = extractNumber(text);
      if (text.includes('aumenta') || text.includes('+') || text.includes('guadagna')) {
        actions.push({ type: 'heal', target: 'self', value, description: `Aumenta PTI di ${value}` });
      } else if (text.includes('diminuisce') || text.includes('-') || text.includes('riduce')) {
        actions.push({ type: 'damage', target: 'opponents', value, description: `Riduce PTI di ${value}` });
      }
    }

    // Special/Generic patterns
    if (actions.length === 0 && text.length > 5) {
      actions.push({ type: 'special', target: 'self', value: 0, description: effectText });
    }

    return actions;
  }

  // Process custom card effect using AI or keyword parsing
  async processCustomCardEffect(gameId: string, card: Card, playerName: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game || !card.effect) return;

    console.log(`🎴 Processing custom card effect for ${card.name || card.id}: "${card.effect}"`);

    try {
      // Use Replit's native AI integration key first, fallback to user's key
      const replitKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      const userKey = process.env.OPENAI_API_KEY;
      const apiKey = replitKey || userKey;
      
      console.log(`🔑 AI Key check: Replit native=${replitKey ? 'YES' : 'NO'}, User key=${userKey ? 'YES' : 'NO'}`);
      
      if (!apiKey) {
        console.log('🔧 No OpenAI API key - using keyword-based effect parsing');
        
        // Use keyword-based parsing instead
        const actions = this.parseEffectKeywords(card.effect);
        console.log(`🎴 Keyword-parsed actions:`, actions);
        
        if (actions.length > 0) {
          for (const action of actions) {
            await this.executeCustomEffectAction(gameId, action, playerName, card);
          }
          
          // Record the effect execution
          await this.recordEvent(gameId, 'custom-card-effect', {
            cardId: card.id,
            cardName: card.name,
            effect: card.effect,
            result: { actions, message: `Effetto attivato: ${actions.map(a => a.description).join(', ')}` }
          }, playerName);
        }
        return;
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey });

      // Build game context
      const gameContext = {
        players: Object.keys(game.players),
        field: game.field.map(c => ({ 
          id: c.id, 
          type: c.type, 
          name: c.name || this.getCardNameFromUrl(c.frontImage),
          owner: c.owner,
          pti: c.pti,
          stars: c.stars
        })),
        currentPlayer: playerName,
        cardPlayed: {
          id: card.id,
          name: card.name,
          type: card.type,
          pti: card.pti,
          stars: card.stars
        }
      };

      const prompt = `Sei il sistema di gioco MINKIARDS. Una carta personalizzata è stata giocata con questo effetto:

**EFFETTO:** "${card.effect}"

**CARTA GIOCATA:**
- Nome: ${card.name || 'Carta Personalizzata'}
- Tipo: ${card.type}
- Giocatore: ${playerName}
${card.pti ? `- PTI: ${card.pti}` : ''}
${card.stars ? `- Stelle: ${card.stars}` : ''}

**STATO PARTITA:**
- Giocatori: ${gameContext.players.join(', ')}
- Carte in campo: ${JSON.stringify(gameContext.field)}

Analizza l'effetto e determina le azioni da eseguire. Rispondi in JSON con:
{
  "actions": [
    {
      "type": "damage" | "heal" | "draw" | "discard" | "modify_pti" | "modify_stars" | "special",
      "target": "all" | "self" | "opponents" | "specific_card_id" | "random",
      "value": number,
      "description": "descrizione dell'azione"
    }
  ],
  "message": "messaggio da mostrare ai giocatori"
}

Se l'effetto richiede interazione utente (scelta target), usa type "special" con description dettagliata.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 500
      });

      const effectResult = JSON.parse(response.choices[0].message.content || '{"actions": [], "message": "Effetto non processato"}');
      
      console.log(`🎴 Custom card effect result:`, effectResult);

      // Execute each action
      for (const action of effectResult.actions || []) {
        await this.executeCustomEffectAction(gameId, action, playerName, card);
      }

      // Record the effect execution
      await this.recordEvent(gameId, 'custom-card-effect', {
        cardId: card.id,
        cardName: card.name,
        effect: card.effect,
        result: effectResult
      }, playerName);

    } catch (error) {
      console.error('Error processing custom card effect:', error);
    }
  }

  // Execute a single action from custom card effect
  private async executeCustomEffectAction(gameId: string, action: any, playerName: string, card: Card): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    console.log(`🎴 Executing custom effect action: ${action.type} - ${action.description}`);

    switch (action.type) {
      case 'damage':
        if (action.target === 'all' || action.target === 'opponents') {
          // Apply damage to all opponent characters
          for (const fieldCard of game.field) {
            if (fieldCard.owner !== playerName && 
                (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali') &&
                fieldCard.pti != null) {
              fieldCard.pti = Math.max(0, fieldCard.pti - (action.value || 0));
              console.log(`💥 Custom effect: ${fieldCard.name || fieldCard.id} took ${action.value} damage, now at ${fieldCard.pti} PTI`);
            }
          }
        }
        break;

      case 'heal':
        if (action.target === 'self') {
          // Find player's character on field
          const playerChar = game.field.find(c => 
            c.owner === playerName && 
            (c.type === 'personaggi' || c.type === 'personaggi_speciali')
          );
          if (playerChar && playerChar.pti != null) {
            playerChar.pti = (playerChar.pti || 0) + (action.value || 0);
            console.log(`💚 Custom effect: ${playerChar.name || playerChar.id} healed ${action.value}, now at ${playerChar.pti} PTI`);
          }
        }
        break;

      case 'draw':
        // Make player draw cards
        const deckType = card.type === 'personaggi' || card.type === 'personaggi_speciali' ? 'personaggi' : 'mosse';
        for (let i = 0; i < (action.value || 1); i++) {
          this.pickCard(gameId, deckType, playerName);
        }
        console.log(`🎴 Custom effect: ${playerName} drew ${action.value || 1} cards`);
        break;

      case 'discard':
        // Discard cards from hand or field
        if (action.target === 'opponents' || action.target === 'all') {
          // Discard random cards from each opponent's hand
          for (const [opponentName, opponent] of Object.entries(game.players)) {
            if (opponentName === playerName && action.target === 'opponents') continue;
            const discardCount = Math.min(action.value || 1, opponent.hand.length);
            for (let i = 0; i < discardCount; i++) {
              if (opponent.hand.length > 0) {
                const randomIndex = Math.floor(Math.random() * opponent.hand.length);
                const discardedCard = opponent.hand.splice(randomIndex, 1)[0];
                game.graveyard.push(discardedCard);
                console.log(`🗑️ Custom effect: ${opponentName} discarded ${discardedCard.name || discardedCard.id}`);
              }
            }
          }
        } else if (action.target === 'self') {
          // Player discards from own hand
          const player = game.players[playerName];
          const discardCount = Math.min(action.value || 1, player.hand.length);
          for (let i = 0; i < discardCount; i++) {
            if (player.hand.length > 0) {
              const randomIndex = Math.floor(Math.random() * player.hand.length);
              const discardedCard = player.hand.splice(randomIndex, 1)[0];
              game.graveyard.push(discardedCard);
              console.log(`🗑️ Custom effect: ${playerName} discarded ${discardedCard.name || discardedCard.id}`);
            }
          }
        } else if (action.target) {
          // Discard specific card by ID
          const targetCard = game.field.find(c => c.id === action.target);
          if (targetCard) {
            game.field = game.field.filter(c => c.id !== action.target);
            game.graveyard.push(targetCard);
            console.log(`🗑️ Custom effect: Discarded ${targetCard.name || targetCard.id} from field`);
          }
        }
        break;

      case 'modify_pti':
        if (action.target && action.target !== 'all') {
          const targetCard = game.field.find(c => c.id === action.target);
          if (targetCard && targetCard.pti != null) {
            targetCard.pti = action.value || 0;
            console.log(`⚡ Custom effect: ${targetCard.name || targetCard.id} PTI set to ${targetCard.pti}`);
          }
        }
        break;

      case 'modify_stars':
        if (action.target && action.target !== 'all') {
          const targetCard = game.field.find(c => c.id === action.target);
          if (targetCard && targetCard.stars != null) {
            targetCard.stars = action.value || 0;
            console.log(`⭐ Custom effect: ${targetCard.name || targetCard.id} stars set to ${targetCard.stars}`);
          }
        }
        break;

      case 'special':
        console.log(`🌟 Special custom effect: ${action.description}`);
        // Special effects that require manual handling or user interaction
        break;

      default:
        console.log(`❓ Unknown custom effect type: ${action.type}`);
    }
  }

  // NEW: Authoritative MOSSE attack execution
  async executeMossaAttack(gameId: string, attackerName: string, mosseCardId: string, targetCardId: string, damageValue: number, isHandTarget: boolean = false, defenseRequestEmitter?: (data: any) => void): Promise<{ success: boolean; result?: any; error?: string }> {
    const game = this.games.get(gameId);
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    // REMOVED: Turn validation - MOSSE attacks now work outside of turn order per user request

    // Validate attacker exists
    const attacker = game.players[attackerName];
    if (!attacker) {
      return { success: false, error: 'Attacker not found' };
    }

    // Find MOSSE card on field (should be played first)
    const mosseCard = game.field.find(c => c.id === mosseCardId && c.owner === attackerName && c.type === 'mosse');
    if (!mosseCard) {
      return { success: false, error: 'MOSSE card not found on field or not owned by attacker' };
    }

    // OSTAGGIO CHECK: Find attacker's character on field and check if it's hostaged
    const attackerCharacter = game.field.find(c => 
      c.owner === attackerName && 
      (c.type === 'personaggi' || c.type === 'personaggi_speciali') &&
      !c.isHostage
    );
    if (!attackerCharacter) {
      // Check if player has a hostaged character
      const hostagedCharacter = game.field.find(c => 
        c.owner === attackerName && 
        (c.type === 'personaggi' || c.type === 'personaggi_speciali') &&
        c.isHostage
      );
      if (hostagedCharacter) {
        console.log(`⛓️ ${attackerName}'s character is hostaged - cannot use MOSSE to attack`);
        return { success: false, error: 'Il tuo personaggio è in ostaggio! Non può usare carte MOSSE finché non viene liberato. Metti in campo un altro personaggio.' };
      }
      // No character on field at all
      return { success: false, error: 'Devi avere un personaggio in campo per usare carte MOSSE.' };
    }

    // Find target card - either on field OR in hand (for ATTACCO DISONESTO)
    let targetCard: any;
    let targetOwnerName: string = '';
    
    if (isHandTarget) {
      // For ATTACCO DISONESTO: target must be in opponent's hand
      for (const [playerName, player] of Object.entries(game.players)) {
        if (playerName === attackerName) continue; // Can't attack own hand
        const handCard = player.hand.find((c: Card) => c.id === targetCardId);
        if (handCard && (handCard.type === 'personaggi' || handCard.type === 'personaggi_speciali')) {
          targetCard = handCard;
          targetOwnerName = playerName;
          break;
        }
      }
      if (!targetCard) {
        return { success: false, error: 'Invalid target: character not found in any opponent\'s hand' };
      }
    } else {
      // Regular attack: target must be on field
      targetCard = game.field.find(c => c.id === targetCardId);
      if (!targetCard || (targetCard.type !== 'personaggi' && targetCard.type !== 'personaggi_speciali')) {
        return { success: false, error: 'Invalid target: must be a character on field' };
      }
      targetOwnerName = targetCard.owner;
    }

    const attackTypeLabel = isHandTarget ? '🎯 ATTACCO DISONESTO' : '⚔️ MOSSE';
    console.log(`${attackTypeLabel}: ${attackerName} uses ${mosseCardId} to attack ${targetOwnerName}'s ${targetCardId}`);
    
    // BARRIERA BYPASS: If target is protected by BARRIERA, skip defense dialog and auto-apply damage
    if (!isHandTarget) {
      const barrieraProtection = this.isProtectedByBarriera(gameId, targetCardId);
      if (barrieraProtection) {
        const activeShield = this.getActiveBarrieraShieldCard(gameId, targetCardId);
        if (activeShield) {
          // ONE MOSSE PER TURN ON BARRIERA: Check if player already attacked BARRIERA this turn
          if (attacker.usedMosseOnBarrieraThisTurn) {
            console.log(`❌ ${attackerName} ha già attaccato BARRIERA questo turno - attacco bloccato`);
            return { success: false, error: 'Puoi attaccare BARRIERA solo una volta per turno. Aspetta il tuo prossimo turno.' };
          }
          
          const targetName = this.getCardNameFromUrl(targetCard.frontImage || '');
          console.log(`🛡️ BARRIERA BYPASS: ${targetName} is protected - auto-applying ${damageValue} damage to shield (no defense dialog)`);
          
          // Track card usage
          if (!attacker.usedCardsThisTurn) {
            attacker.usedCardsThisTurn = [];
          }
          attacker.usedCardsThisTurn.push(mosseCard.frontImage);
          
          // ONE MOSSE PER TURN ON BARRIERA: Mark that this player has attacked BARRIERA this turn
          attacker.usedMosseOnBarrieraThisTurn = true;
          console.log(`✅ ${attackerName} ha attaccato BARRIERA questo turno - nessun altro attacco a BARRIERA permesso fino al prossimo turno`);
          
          // Record event
          await this.recordEvent(gameId, 'mosse-attack', {
            attackerName,
            mosseCardId,
            targetCardId,
            targetOwner: targetOwnerName,
            isHandTarget: false,
            outcome: 'barriera_auto_absorbed'
          }, attackerName);
          
          // Return MOSSE to deck (needs io from caller - mark for cleanup)
          // NOTE: damageBarriera will be called when attack result is processed
          
          return {
            success: true,
            result: {
              targetCardId,
              targetOwner: targetOwnerName,
              mosseCardId,
              attackerName,
              isHandTarget: false,
              requiresDefenseResponse: false, // BARRIERA auto-absorbs - no defense needed
              barrieraAbsorbed: true,
              barrieraShieldId: activeShield.id, // Shield to apply damage to
              damageValue: damageValue, // Damage to apply
              message: `${attackerName} attacca ${targetName} ma la BARRIERA assorbe automaticamente il danno!`
            }
          };
        }
      }
    }
    
    // OSTAGGIO SPECIAL HANDLING: Detect OSTAGGIO card and apply special effects
    if (this.isOstaggioCard(mosseCard) && !isHandTarget) {
      console.log(`⛓️ OSTAGGIO detected: ${attackerName} using OSTAGGIO on ${targetCardId}`);
      
      // Track card usage
      if (!attacker.usedCardsThisTurn) {
        attacker.usedCardsThisTurn = [];
      }
      attacker.usedCardsThisTurn.push(mosseCard.frontImage);
      
      // Record event
      await this.recordEvent(gameId, 'mosse-attack', {
        attackerName,
        mosseCardId,
        targetCardId,
        targetOwner: targetOwnerName,
        isHandTarget: false,
        outcome: 'ostaggio_applied'
      }, attackerName);
      
      // Return special result indicating OSTAGGIO attack
      // The actual application will be handled by routes.ts after damage input
      return {
        success: true,
        result: {
          targetCardId,
          targetOwner: targetOwnerName,
          mosseCardId,
          attackerName,
          isHandTarget: false,
          requiresDefenseResponse: false, // OSTAGGIO bypasses defense
          isOstaggioAttack: true,
          damageValue: damageValue,
          message: `${attackerName} usa OSTAGGIO! Il personaggio non può difendersi!`
        }
      };
    }
    
    // HOSTAGE TARGET CHECK: Hostaged characters cannot defend
    if (targetCard.isHostage) {
      console.log(`⛓️ Target ${targetCardId} is hostage - no defense allowed, damage applied directly`);
      
      // Track card usage
      if (!attacker.usedCardsThisTurn) {
        attacker.usedCardsThisTurn = [];
      }
      attacker.usedCardsThisTurn.push(mosseCard.frontImage);
      
      // Return result indicating hostage attack (no defense)
      return {
        success: true,
        result: {
          targetCardId,
          targetOwner: targetOwnerName,
          mosseCardId,
          attackerName,
          isHandTarget: false,
          requiresDefenseResponse: false, // Hostage cannot defend
          isHostageTarget: true,
          damageValue: damageValue,
          message: `${attackerName} attacca un personaggio in ostaggio! Nessuna difesa possibile!`
        }
      };
    }
    
    // NUOVO SISTEMA: Non eliminare automaticamente, richiedere input umano per il danno
    // Track card usage to prevent reuse
    if (!attacker.usedCardsThisTurn) {
      attacker.usedCardsThisTurn = [];
    }
    attacker.usedCardsThisTurn.push(mosseCard.frontImage);

    // Record attack initiation event (maintain backward compatibility)
    await this.recordEvent(gameId, 'mosse-attack', {
      attackerName,
      mosseCardId,
      targetCardId,
      targetOwner: targetOwnerName,
      isHandTarget: isHandTarget,
      outcome: 'awaiting_damage_input'
    }, attackerName);

    console.log(`${attackTypeLabel} attack initiated: ${attackerName} targeting ${targetOwnerName}'s ${targetCardId}${isHandTarget ? ' (in hand)' : ''} - awaiting defense response`);

    // NEW: Interactive defense system - create pending defense request
    const attackId = `attack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const defenseCreated = this.setPendingDefense(gameId, {
      attackId,
      attacker: attackerName,
      defender: targetOwnerName,
      damage: damageValue, // Proper damage value from attacker input
      targetCardId: targetCardId, // Character being attacked
      mosseCardId: mosseCardId, // MOSSE card used for attack
      isHandTarget: isHandTarget, // NEW: Pass isHandTarget flag
      deckType: 'mosse'
    });

    if (!defenseCreated) {
      console.log(`Failed to create pending defense for attack ${attackId}`);
      return { success: false, error: 'Failed to create defense request' };
    }

    // CRITICAL: Emit defense:request if callback is provided
    if (defenseRequestEmitter) {
      console.log(`🛡️ ${attackerName}: Emitting defense:request to ${targetOwnerName} via callback`);
      defenseRequestEmitter({
        gameId,
        attackId,
        attackerName,
        defenderName: targetOwnerName,
        mosseCardId,
        targetCardId,
        isHandTarget: isHandTarget,
        message: isHandTarget ? `${attackerName} sta usando ATTACCO DISONESTO! Un tuo personaggio in mano è sotto attacco!` : `${attackerName} ti sta attaccando! Vuoi respingere l'attacco?`
      });
    }

    return { 
      success: true, 
      result: {
        targetCardId: targetCardId,
        targetOwner: targetOwnerName,
        mosseCardId: mosseCardId,
        attackerName: attackerName,
        isHandTarget: isHandTarget,
        requiresDefenseResponse: true,
        attackId: attackId,
        message: isHandTarget ? `${attackerName} usa ATTACCO DISONESTO contro ${targetOwnerName}! In attesa della risposta di difesa...` : `${attackerName} attacca ${targetOwnerName}! In attesa della risposta di difesa...`
      }
    };
  }

  async playCardFaceDown(gameId: string, cardId: string, playerName: string): Promise<{ card?: any }> {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return {};

    const player = game.players[playerName];
    const cardIndex = player.hand.findIndex(card => card.id === cardId);
    
    if (cardIndex !== -1) {
      const card = player.hand.splice(cardIndex, 1)[0];
      card.faceDown = true; // Mark as face down
      game.field.push(card);
      
      // Record play card face down event
      await this.recordEvent(gameId, 'play-card-face-down', {
        cardId: card.id,
        cardType: card.type,
        faceDown: true
      }, playerName);
      
      return { card };
    }
    
    return {};
  }

  // Helper function to extract card name from URL
  private getCardNameFromUrl(url: string): string {
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

  // RIFUGIO SHELTER PROTECTION SYSTEM
  
  // Check if a card is RIFUGIO
  isRifugioCard(card: Card): boolean {
    const cardName = (card.name || this.getCardNameFromUrl(card.frontImage)).toUpperCase();
    return cardName.includes('RIFUGIO');
  }
  
  // Get valid targets for RIFUGIO (own PERSONAGGI on field)
  getRifugioTargets(gameId: string, ownerPlayerName: string): Card[] {
    const game = this.games.get(gameId);
    if (!game) return [];
    
    // Get own characters on field that aren't already ACTIVELY protected
    // Characters with inactive protection (exited shelter) can be re-protected
    const activelyProtectedIds = game.rifugioProtections
      .filter(r => r.protectionActive)
      .map(r => r.protectedCharacterId);
    
    return game.field.filter(card => 
      (card.type === 'personaggi' || card.type === 'personaggi_speciali') &&
      card.owner === ownerPlayerName &&
      !activelyProtectedIds.includes(card.id)
    );
  }
  
  // Activate RIFUGIO protection on a character
  activateRifugio(gameId: string, rifugioCardId: string, targetCharacterId: string, ownerPlayer: string, io: any): { success: boolean; message?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false, message: 'Game not found' };
    
    const rifugioCard = game.field.find(c => c.id === rifugioCardId);
    const targetCard = game.field.find(c => c.id === targetCharacterId);
    
    if (!rifugioCard) return { success: false, message: 'RIFUGIO not found on field' };
    if (!targetCard) return { success: false, message: 'Target character not found on field' };
    
    // Verify ownership
    if (rifugioCard.owner !== ownerPlayer || targetCard.owner !== ownerPlayer) {
      return { success: false, message: 'You can only protect your own characters' };
    }
    
    // Check if character has an existing protection record
    const existingProtection = game.rifugioProtections.find(r => r.protectedCharacterId === targetCharacterId);
    
    if (existingProtection) {
      // If protection exists but is inactive (character exited shelter), reactivate it
      if (!existingProtection.protectionActive && existingProtection.currentPTI > 0) {
        existingProtection.protectionActive = true;
        existingProtection.usedMosseThisTurn = false;
        
        // Update RIFUGIO card markers
        rifugioCard.rifugioProtecting = targetCharacterId;
        
        // Mark protected character
        targetCard.protectedByRifugio = rifugioCardId;
        
        const targetName = this.getCardNameFromUrl(targetCard.frontImage);
        
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-rifugio-reactivated`,
          playerName: 'Sistema',
          message: `🏠✨ ${targetName} è tornato nel RIFUGIO! Protezione riattivata con ${existingProtection.currentPTI} PTI.`,
          timestamp: Date.now()
        });
        
        io.to(gameId).emit('rifugio-activated', {
          rifugioCardId,
          protectedCharacterId: targetCharacterId,
          ownerPlayer,
          rifugioPTI: existingProtection.currentPTI
        });
        
        console.log(`🏠✨ RIFUGIO reactivated: ${targetName} returned to shelter with ${existingProtection.currentPTI} PTI`);
        
        return { success: true };
      } else if (existingProtection.protectionActive) {
        return { success: false, message: 'Character is already protected by a RIFUGIO' };
      }
    }
    
    // Create new protection
    const protection: RifugioProtection = {
      id: `rifugio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      rifugioCardId,
      protectedCharacterId: targetCharacterId,
      ownerPlayer,
      currentPTI: 1000,
      maxPTI: 1000,
      protectionActive: true,
      usedMosseThisTurn: false
    };
    
    game.rifugioProtections.push(protection);
    
    // Mark RIFUGIO card with protection data
    rifugioCard.rifugioProtecting = targetCharacterId;
    rifugioCard.rifugioPTI = 1000;
    
    // Set the card text to include PTI so it can be attacked by CPU
    const targetName = this.getCardNameFromUrl(targetCard.frontImage);
    rifugioCard.text = `PTI: 1000\nPTI originali: 1000\nProtegge: ${targetName}`;
    
    // Mark protected character
    targetCard.protectedByRifugio = rifugioCardId;
    
    io.to(gameId).emit('chat-message', {
      id: `${Date.now()}-rifugio-activated`,
      playerName: 'Sistema',
      message: `🏠 ${ownerPlayer} ha attivato RIFUGIO per proteggere ${targetName}! Il rifugio ha 1000 PTI.`,
      timestamp: Date.now()
    });
    
    io.to(gameId).emit('rifugio-activated', {
      rifugioCardId,
      protectedCharacterId: targetCharacterId,
      ownerPlayer,
      rifugioPTI: 1000
    });
    
    console.log(`🏠 RIFUGIO activated: protecting ${targetName} for ${ownerPlayer}`);
    
    return { success: true };
  }
  
  // Check if a character is protected by RIFUGIO (and protection is active)
  isProtectedByRifugio(gameId: string, characterId: string): RifugioProtection | null {
    const game = this.games.get(gameId);
    if (!game) return null;
    
    const protection = game.rifugioProtections.find(r => 
      r.protectedCharacterId === characterId && r.protectionActive && r.currentPTI > 0
    );
    
    return protection || null;
  }
  
  // Deal damage to RIFUGIO (returns true if destroyed)
  damageRifugio(gameId: string, rifugioCardId: string, damage: number, attackerName: string, io: any): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;
    
    const protection = game.rifugioProtections.find(r => r.rifugioCardId === rifugioCardId);
    if (!protection) return false;
    
    const rifugioCard = game.field.find(c => c.id === rifugioCardId);
    if (!rifugioCard) return false;
    
    protection.currentPTI -= damage;
    rifugioCard.rifugioPTI = protection.currentPTI;
    
    // Update card text with new PTI value
    const protectedCardForText = game.field.find(c => c.id === protection.protectedCharacterId);
    const protectedNameForText = protectedCardForText ? this.getCardNameFromUrl(protectedCardForText.frontImage) : 'personaggio';
    rifugioCard.text = `PTI: ${Math.max(0, protection.currentPTI)}\nPTI originali: 1000\nProtegge: ${protectedNameForText}`;
    
    io.to(gameId).emit('rifugio-damaged', {
      rifugioCardId,
      damage,
      remainingPTI: protection.currentPTI,
      attackerName
    });
    
    console.log(`🏠 RIFUGIO damaged: ${damage} PTI, remaining: ${protection.currentPTI}`);
    
    if (protection.currentPTI <= 0) {
      // RIFUGIO destroyed - return to deck
      const protectedCard = game.field.find(c => c.id === protection.protectedCharacterId);
      const protectedName = protectedCard ? this.getCardNameFromUrl(protectedCard.frontImage) : 'personaggio';
      
      // Remove protection
      game.rifugioProtections = game.rifugioProtections.filter(r => r.id !== protection.id);
      
      // Clear protection markers
      if (protectedCard) {
        delete protectedCard.protectedByRifugio;
      }
      
      // Move RIFUGIO back to deck
      this.returnToDeck(gameId, rifugioCardId, protection.ownerPlayer);
      
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-rifugio-destroyed`,
        playerName: 'Sistema',
        message: `🏠💥 RIFUGIO è stato distrutto! ${protectedName} non è più protetto e può essere attaccato!`,
        timestamp: Date.now()
      });
      
      io.to(gameId).emit('rifugio-destroyed', {
        rifugioCardId,
        protectedCharacterId: protection.protectedCharacterId,
        ownerPlayer: protection.ownerPlayer
      });
      
      console.log(`🏠💥 RIFUGIO destroyed and returned to deck`);
      
      return true; // Destroyed
    }
    
    return false; // Still active
  }
  
  // Called when a character protected by RIFUGIO uses a MOSSE - breaks protection until next turn
  breakRifugioProtection(gameId: string, characterId: string, io: any): void {
    const game = this.games.get(gameId);
    if (!game) return;
    
    const protection = game.rifugioProtections.find(r => r.protectedCharacterId === characterId);
    if (!protection || !protection.protectionActive) return;
    
    protection.protectionActive = false;
    protection.usedMosseThisTurn = true;
    
    const protectedCard = game.field.find(c => c.id === characterId);
    const protectedName = protectedCard ? this.getCardNameFromUrl(protectedCard.frontImage) : 'personaggio';
    
    // Remove the protectedByRifugio marker so the label disappears
    if (protectedCard) {
      delete protectedCard.protectedByRifugio;
    }
    
    // Clear rifugioProtecting on the RIFUGIO card so PROTEGGI button reappears
    const rifugioCard = game.field.find(c => c.id === protection.rifugioCardId);
    if (rifugioCard) {
      delete rifugioCard.rifugioProtecting;
      console.log(`🏠 Cleared rifugioProtecting on RIFUGIO card - PROTEGGI button now available`);
    }
    
    io.to(gameId).emit('chat-message', {
      id: `${Date.now()}-rifugio-broken`,
      playerName: 'Sistema',
      message: `🏠⚔️ ${protectedName} ha usato una mossa! Non è più protetto da RIFUGIO fino al prossimo turno.`,
      timestamp: Date.now()
    });
    
    io.to(gameId).emit('rifugio-protection-broken', {
      protectedCharacterId: characterId,
      rifugioCardId: protection.rifugioCardId
    });
    
    // Emit game state update so client sees the broken protection
    io.to(gameId).emit('game-state-update', this.getSanitizedGameState(gameId));
    
    console.log(`🏠⚔️ RIFUGIO protection broken for ${protectedName} - used MOSSE`);
  }
  
  // Called at start of player's turn - restore RIFUGIO protection if character didn't use MOSSE
  restoreRifugioProtection(gameId: string, playerName: string, io: any): void {
    const game = this.games.get(gameId);
    if (!game) return;
    
    console.log(`🏠 restoreRifugioProtection called for ${playerName}`);
    console.log(`🏠 Total rifugioProtections: ${game.rifugioProtections.length}`);
    
    const playerProtections = game.rifugioProtections.filter(r => r.ownerPlayer === playerName);
    console.log(`🏠 ${playerName}'s protections: ${playerProtections.length}`);
    
    for (const protection of playerProtections) {
      console.log(`🏠 Protection status: protectionActive=${protection.protectionActive}, currentPTI=${protection.currentPTI}, usedMosseThisTurn=${protection.usedMosseThisTurn}`);
      
      if (!protection.protectionActive && protection.currentPTI > 0) {
        // Restore protection if character didn't use MOSSE this turn
        protection.protectionActive = true;
        protection.usedMosseThisTurn = false;
        
        const protectedCard = game.field.find(c => c.id === protection.protectedCharacterId);
        const protectedName = protectedCard ? this.getCardNameFromUrl(protectedCard.frontImage) : 'personaggio';
        
        // Restore the protectedByRifugio marker so the label reappears
        if (protectedCard) {
          protectedCard.protectedByRifugio = protection.rifugioCardId;
          console.log(`🏠 Restored protectedByRifugio marker on ${protectedName}`);
        }
        
        // Restore rifugioProtecting on the RIFUGIO card so PROTEGGI button hides again
        const rifugioCard = game.field.find(c => c.id === protection.rifugioCardId);
        if (rifugioCard) {
          rifugioCard.rifugioProtecting = protection.protectedCharacterId;
          console.log(`🏠 Restored rifugioProtecting on RIFUGIO card - PROTEGGI button now hidden`);
        }
        
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-rifugio-restored`,
          playerName: 'Sistema',
          message: `🏠✨ ${protectedName} è di nuovo protetto da RIFUGIO!`,
          timestamp: Date.now()
        });
        
        io.to(gameId).emit('rifugio-protection-restored', {
          protectedCharacterId: protection.protectedCharacterId,
          rifugioCardId: protection.rifugioCardId
        });
        
        // Emit game state update so client sees the restored protection
        io.to(gameId).emit('game-state-update', this.getSanitizedGameState(gameId));
        
        console.log(`🏠✨ RIFUGIO protection restored for ${protectedName}`);
      }
    }
  }
  
  // Get RIFUGIO protection data for a character (for UI)
  getRifugioProtectionData(gameId: string, characterId: string): { isProtected: boolean; rifugioPTI: number; rifugioCardId?: string } | null {
    const protection = this.isProtectedByRifugio(gameId, characterId);
    if (!protection) return null;
    
    return {
      isProtected: true,
      rifugioPTI: protection.currentPTI,
      rifugioCardId: protection.rifugioCardId
    };
  }

  // BARRIERA SHIELD SYSTEM
  
  // Check if a card is BARRIERA
  isBarrieraCard(card: Card): boolean {
    const cardName = (card.name || this.getCardNameFromUrl(card.frontImage)).toUpperCase();
    return cardName.includes('BARRIERA');
  }
  
  // Get player's PERSONAGGI on field for BARRIERA target selection
  getBarrieraTargets(gameId: string, ownerPlayerName: string): Card[] {
    const game = this.games.get(gameId);
    if (!game) return [];
    
    // Get own characters on field that aren't already protected by BARRIERA
    const protectedIds = game.barrieraShields
      .filter(b => b.active)
      .map(b => b.protectedCharacterId);
    
    return game.field.filter(card => 
      (card.type === 'personaggi' || card.type === 'personaggi_speciali') &&
      card.owner === ownerPlayerName &&
      !protectedIds.includes(card.id)
    );
  }
  
  // Activate BARRIERA: creates 3 copies on field with 50 PTI each
  activateBarriera(gameId: string, barrieraCardId: string, targetCharacterId: string, ownerPlayer: string, io: any): { success: boolean; message?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false, message: 'Game not found' };
    
    const barrieraCard = game.field.find(c => c.id === barrieraCardId);
    const targetCard = game.field.find(c => c.id === targetCharacterId);
    
    if (!barrieraCard) return { success: false, message: 'BARRIERA not found on field' };
    if (!targetCard) return { success: false, message: 'Target character not found on field' };
    
    // Verify ownership
    if (barrieraCard.owner !== ownerPlayer || targetCard.owner !== ownerPlayer) {
      return { success: false, message: 'You can only protect your own characters' };
    }
    
    // Check if character is already protected by BARRIERA
    const existingProtection = game.barrieraShields.find(b => b.protectedCharacterId === targetCharacterId && b.active);
    if (existingProtection) {
      return { success: false, message: 'Character is already protected by BARRIERA' };
    }
    
    const targetName = this.getCardNameFromUrl(targetCard.frontImage);
    
    // Transform the original BARRIERA into the first shield
    barrieraCard.isBarrieraShield = true;
    barrieraCard.barrieraOriginalId = barrieraCardId;
    barrieraCard.barrieraShieldIndex = 0;
    barrieraCard.barrieraPTI = 50;
    barrieraCard.barrieraProtecting = targetCharacterId;
    barrieraCard.text = `PTI: 50\nProtegge: ${targetName}`;
    barrieraCard.pti = 50;
    barrieraCard.stars = 0;
    
    const shieldCardIds = [barrieraCardId];
    
    // Create 2 clone cards
    for (let i = 1; i <= 2; i++) {
      const cloneId = `${barrieraCardId}-clone-${i}`;
      const cloneCard: Card = {
        id: cloneId,
        type: 'bonus',
        frontImage: barrieraCard.frontImage,
        backImage: barrieraCard.backImage,
        owner: ownerPlayer,
        name: 'BARRIERA',
        text: `PTI: 50\nProtegge: ${targetName}`,
        pti: 50,
        stars: 0,
        isBarrieraShield: true,
        barrieraOriginalId: barrieraCardId,
        barrieraShieldIndex: i,
        barrieraPTI: 50,
        barrieraProtecting: targetCharacterId
      };
      game.field.push(cloneCard);
      shieldCardIds.push(cloneId);
    }
    
    // Mark target character as protected
    targetCard.protectedByRifugio = undefined; // Clear any RIFUGIO protection
    
    // Create BARRIERA shield record
    const shield: BarrieraShield = {
      id: `barriera-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      originalCardId: barrieraCardId,
      shieldCardIds,
      protectedCharacterId: targetCharacterId,
      ownerPlayer,
      shieldsPTI: [50, 50, 50],
      active: true
    };
    
    game.barrieraShields.push(shield);
    
    io.to(gameId).emit('chat-message', {
      id: `${Date.now()}-barriera-activated`,
      playerName: 'Sistema',
      message: `🛡️🛡️🛡️ ${ownerPlayer} ha attivato BARRIERA per proteggere ${targetName}! Sono apparse 3 barriere con 50 PTI ciascuna!`,
      timestamp: Date.now()
    });
    
    io.to(gameId).emit('barriera-activated', {
      barrieraCardId,
      shieldCardIds,
      protectedCharacterId: targetCharacterId,
      ownerPlayer
    });
    
    io.to(gameId).emit('game-state-update', this.getSanitizedGameState(gameId));
    
    console.log(`🛡️ BARRIERA activated: 3 shields protecting ${targetName} for ${ownerPlayer}`);
    
    return { success: true };
  }
  
  // Check if a character is protected by BARRIERA
  isProtectedByBarriera(gameId: string, characterId: string): BarrieraShield | null {
    const game = this.games.get(gameId);
    if (!game) return null;
    
    const shield = game.barrieraShields.find(b => 
      b.protectedCharacterId === characterId && 
      b.active &&
      b.shieldsPTI.some(pti => pti > 0)
    );
    
    return shield || null;
  }
  
  // Get the first active BARRIERA shield card to redirect attacks to
  getActiveBarrieraShieldCard(gameId: string, protectedCharacterId: string): Card | null {
    const game = this.games.get(gameId);
    if (!game) return null;
    
    const shield = this.isProtectedByBarriera(gameId, protectedCharacterId);
    if (!shield) return null;
    
    // Find the first shield that still has PTI
    for (let i = 0; i < shield.shieldCardIds.length; i++) {
      if (shield.shieldsPTI[i] > 0) {
        const shieldCard = game.field.find(c => c.id === shield.shieldCardIds[i]);
        if (shieldCard) return shieldCard;
      }
    }
    
    return null;
  }
  
  // Apply damage to a BARRIERA shield (auto-accept, no defense)
  damageBarriera(gameId: string, shieldCardId: string, damage: number, attackerName: string, io: any): { destroyed: boolean; allShieldsDestroyed: boolean } {
    const game = this.games.get(gameId);
    if (!game) return { destroyed: false, allShieldsDestroyed: false };
    
    // Find the shield record that contains this card
    const shield = game.barrieraShields.find(b => b.shieldCardIds.includes(shieldCardId) && b.active);
    if (!shield) return { destroyed: false, allShieldsDestroyed: false };
    
    const shieldIndex = shield.shieldCardIds.indexOf(shieldCardId);
    if (shieldIndex === -1) return { destroyed: false, allShieldsDestroyed: false };
    
    const shieldCard = game.field.find(c => c.id === shieldCardId);
    if (!shieldCard) return { destroyed: false, allShieldsDestroyed: false };
    
    const oldPTI = shield.shieldsPTI[shieldIndex];
    shield.shieldsPTI[shieldIndex] = Math.max(0, oldPTI - damage);
    
    // Update card display
    if (shieldCard.barrieraPTI !== undefined) {
      shieldCard.barrieraPTI = shield.shieldsPTI[shieldIndex];
    }
    shieldCard.pti = shield.shieldsPTI[shieldIndex];
    
    const protectedCard = game.field.find(c => c.id === shield.protectedCharacterId);
    const protectedName = protectedCard ? this.getCardNameFromUrl(protectedCard.frontImage) : 'personaggio';
    
    // Update text
    shieldCard.text = `PTI: ${shield.shieldsPTI[shieldIndex]}\nProtegge: ${protectedName}`;
    
    console.log(`🛡️ BARRIERA shield ${shieldIndex + 1} took ${damage} damage: ${oldPTI} → ${shield.shieldsPTI[shieldIndex]} PTI`);
    
    io.to(gameId).emit('chat-message', {
      id: `${Date.now()}-barriera-damage`,
      playerName: 'Sistema',
      message: `🛡️💥 BARRIERA ha assorbito ${damage} danni! PTI rimanenti: ${shield.shieldsPTI[shieldIndex]}`,
      timestamp: Date.now()
    });
    
    // Check if this specific shield is destroyed
    const thisShieldDestroyed = shield.shieldsPTI[shieldIndex] <= 0;
    
    if (thisShieldDestroyed) {
      // Remove the destroyed shield card from field
      game.field = game.field.filter(c => c.id !== shieldCardId);
      
      const remainingShields = shield.shieldsPTI.filter(pti => pti > 0).length;
      
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-barriera-destroyed`,
        playerName: 'Sistema',
        message: `🛡️💀 Una BARRIERA è stata distrutta! Barriere rimanenti: ${remainingShields}`,
        timestamp: Date.now()
      });
      
      console.log(`🛡️💀 BARRIERA shield ${shieldIndex + 1} destroyed! ${remainingShields} shields remaining`);
    }
    
    // Check if ALL shields are destroyed
    const allShieldsDestroyed = shield.shieldsPTI.every(pti => pti <= 0);
    
    if (allShieldsDestroyed) {
      shield.active = false;
      
      // Return the ORIGINAL card to deck (not the clones)
      this.returnToDeck(gameId, shield.originalCardId, shield.ownerPlayer);
      
      // Remove all remaining shield cards from field (the clones disappear)
      for (const cardId of shield.shieldCardIds) {
        game.field = game.field.filter(c => c.id !== cardId);
      }
      
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-barriera-all-destroyed`,
        playerName: 'Sistema',
        message: `🛡️💀💀💀 Tutte le BARRIERE sono state distrutte! ${protectedName} può essere attaccato di nuovo! Una BARRIERA torna nel mazzo.`,
        timestamp: Date.now()
      });
      
      io.to(gameId).emit('barriera-destroyed', {
        protectedCharacterId: shield.protectedCharacterId,
        ownerPlayer: shield.ownerPlayer
      });
      
      console.log(`🛡️💀💀💀 All BARRIERA shields destroyed! ${protectedName} is now vulnerable`);
    }
    
    io.to(gameId).emit('game-state-update', this.getSanitizedGameState(gameId));
    
    return { destroyed: thisShieldDestroyed, allShieldsDestroyed };
  }

  // OSTAGGIO (HOSTAGE) SYSTEM
  
  // Check if a MOSSE card is OSTAGGIO
  isOstaggioCard(card: Card): boolean {
    const cardName = (card.name || this.getCardNameFromUrl(card.frontImage)).toUpperCase();
    return cardName.includes('OSTAGGIO');
  }
  
  // Get all hostaged characters for a captor player
  getHostagedCharacters(gameId: string, captorName: string): Card[] {
    const game = this.games.get(gameId);
    if (!game) return [];
    
    return game.field.filter(card => 
      card.isHostage && card.hostagedBy === captorName
    );
  }
  
  // Check if a character is held hostage
  isCharacterHostage(gameId: string, cardId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;
    
    const card = game.field.find(c => c.id === cardId);
    return card?.isHostage === true;
  }
  
  // Apply OSTAGGIO effect to a target character
  applyOstaggio(
    gameId: string, 
    ostaggioCardId: string, 
    targetCardId: string, 
    captorPlayer: string,
    damageValue: number,
    io: any
  ): { success: boolean; died?: boolean; message?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false, message: 'Game not found' };
    
    const ostaggioCard = game.field.find(c => c.id === ostaggioCardId);
    const targetCard = game.field.find(c => c.id === targetCardId);
    
    if (!ostaggioCard) return { success: false, message: 'OSTAGGIO card not found on field' };
    if (!targetCard) return { success: false, message: 'Target character not found on field' };
    
    // Can only take hostage from opponents
    if (targetCard.owner === captorPlayer) {
      return { success: false, message: 'Cannot take your own character hostage' };
    }
    
    // Can't hostage already hostaged characters
    if (targetCard.isHostage) {
      return { success: false, message: 'Character is already held hostage' };
    }
    
    const targetName = this.getCardNameFromUrl(targetCard.frontImage);
    const originalOwner = targetCard.owner;
    const originalFieldIndex = game.field.indexOf(targetCard);
    
    // Get target's current PTI
    const ptiMatch = targetCard.text?.match(/PTI:\s*(\d+)/i);
    let currentPTI = ptiMatch ? parseInt(ptiMatch[1], 10) : 0;
    
    // Apply damage first
    const newPTI = currentPTI - damageValue;
    
    // Update PTI in card text
    if (targetCard.text) {
      targetCard.text = targetCard.text.replace(/PTI:\s*\d+/i, `PTI: ${Math.max(0, newPTI)}`);
    }
    
    // Special death condition: if PTI was less than 300 before hostage OR becomes 0 after damage
    if (currentPTI < 300 || newPTI <= 0) {
      // Character dies immediately
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-ostaggio-death`,
        playerName: 'Sistema',
        message: `⛓️💀 ${targetName} aveva meno di 300 PTI o è stato eliminato - muore direttamente sotto OSTAGGIO!`,
        timestamp: Date.now()
      });
      
      // Move to graveyard
      this.moveToGraveyard(gameId, targetCardId, originalOwner, captorPlayer);
      
      // Return OSTAGGIO to deck since target died
      this.returnToDeck(gameId, ostaggioCardId, captorPlayer);
      
      io.to(gameId).emit('hostage-died', {
        targetCardId,
        targetName,
        captorPlayer,
        originalOwner
      });
      
      console.log(`⛓️💀 OSTAGGIO: ${targetName} died immediately (PTI < 300 or eliminated)`);
      return { success: true, died: true, message: `${targetName} è morto sotto OSTAGGIO!` };
    }
    
    // Mark OSTAGGIO card as active and staying on field
    ostaggioCard.isOstaggioCard = true;
    ostaggioCard.ostaggioHoldingCardId = targetCardId;
    ostaggioCard.text = `⛓️ Tiene in ostaggio: ${targetName}\nTurni rimanenti: 3`;
    
    // Mark target as hostage
    targetCard.isHostage = true;
    targetCard.hostagedBy = captorPlayer;
    targetCard.hostageOstaggioCardId = ostaggioCardId;
    targetCard.hostageOriginalOwner = originalOwner;
    targetCard.hostageOriginalFieldIndex = originalFieldIndex;
    targetCard.hostageTurnsRemaining = 3;
    
    // Move hostage card next to OSTAGGIO card on field
    const ostaggioIndex = game.field.indexOf(ostaggioCard);
    if (ostaggioIndex !== -1) {
      // Remove target from current position
      game.field = game.field.filter(c => c.id !== targetCardId);
      // Insert right after OSTAGGIO card
      game.field.splice(ostaggioIndex + 1, 0, targetCard);
    }
    
    io.to(gameId).emit('chat-message', {
      id: `${Date.now()}-ostaggio-applied`,
      playerName: 'Sistema',
      message: `⛓️ ${captorPlayer} prende ${targetName} in OSTAGGIO per 3 turni! ${damageValue} danni inflitti. Il personaggio non può attaccare né difendersi!`,
      timestamp: Date.now()
    });
    
    io.to(gameId).emit('hostage-applied', {
      ostaggioCardId,
      targetCardId,
      targetName,
      captorPlayer,
      originalOwner,
      turnsRemaining: 3,
      damageDealt: damageValue
    });
    
    console.log(`⛓️ OSTAGGIO: ${captorPlayer} took ${targetName} hostage for 3 turns (${damageValue} damage dealt)`);
    return { success: true, died: false, message: `${targetName} è ora in ostaggio!` };
  }
  
  // Process hostage turn countdown (called when captor's turn ends)
  processHostageTurns(gameId: string, captorPlayerName: string, io: any): void {
    const game = this.games.get(gameId);
    if (!game) return;
    
    // Find all characters held hostage by this player
    const hostages = game.field.filter(c => c.isHostage && c.hostagedBy === captorPlayerName);
    
    for (const hostage of hostages) {
      if (hostage.hostageTurnsRemaining && hostage.hostageTurnsRemaining > 0) {
        hostage.hostageTurnsRemaining--;
        
        // Update OSTAGGIO card text
        const ostaggioCard = game.field.find(c => c.id === hostage.hostageOstaggioCardId);
        if (ostaggioCard) {
          const hostageName = this.getCardNameFromUrl(hostage.frontImage);
          ostaggioCard.text = `⛓️ Tiene in ostaggio: ${hostageName}\nTurni rimanenti: ${hostage.hostageTurnsRemaining}`;
        }
        
        io.to(gameId).emit('hostage-updated', {
          targetCardId: hostage.id,
          turnsRemaining: hostage.hostageTurnsRemaining,
          captorPlayer: captorPlayerName
        });
        
        console.log(`⛓️ OSTAGGIO: ${this.getCardNameFromUrl(hostage.frontImage)} has ${hostage.hostageTurnsRemaining} turns remaining`);
        
        // Check if hostage should be released
        if (hostage.hostageTurnsRemaining <= 0) {
          this.releaseHostage(gameId, hostage.id, io);
        }
      }
    }
  }
  
  // Release a hostage character
  releaseHostage(gameId: string, hostageCardId: string, io: any): { success: boolean; message?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false, message: 'Game not found' };
    
    const hostageCard = game.field.find(c => c.id === hostageCardId);
    if (!hostageCard || !hostageCard.isHostage) {
      return { success: false, message: 'Card is not a hostage' };
    }
    
    const hostageName = this.getCardNameFromUrl(hostageCard.frontImage);
    const originalOwner = hostageCard.hostageOriginalOwner || hostageCard.owner;
    const ostaggioCardId = hostageCard.hostageOstaggioCardId;
    const captorPlayer = hostageCard.hostagedBy;
    
    // Clear hostage state
    delete hostageCard.isHostage;
    delete hostageCard.hostagedBy;
    delete hostageCard.hostageOstaggioCardId;
    delete hostageCard.hostageOriginalOwner;
    delete hostageCard.hostageOriginalFieldIndex;
    delete hostageCard.hostageTurnsRemaining;
    
    // Restore original owner
    hostageCard.owner = originalOwner;
    
    // Find and clear OSTAGGIO card, return to deck
    if (ostaggioCardId) {
      const ostaggioCard = game.field.find(c => c.id === ostaggioCardId);
      if (ostaggioCard) {
        delete ostaggioCard.isOstaggioCard;
        delete ostaggioCard.ostaggioHoldingCardId;
        ostaggioCard.text = '';
        
        // Return OSTAGGIO to captor's deck
        if (captorPlayer) {
          this.returnToDeck(gameId, ostaggioCardId, captorPlayer);
        }
      }
    }
    
    io.to(gameId).emit('chat-message', {
      id: `${Date.now()}-hostage-released`,
      playerName: 'Sistema',
      message: `⛓️🔓 ${hostageName} è stato liberato dall'OSTAGGIO e torna a disposizione di ${originalOwner}!`,
      timestamp: Date.now()
    });
    
    io.to(gameId).emit('hostage-released', {
      targetCardId: hostageCardId,
      targetName: hostageName,
      originalOwner,
      captorPlayer
    });
    
    console.log(`⛓️🔓 OSTAGGIO: ${hostageName} released, returned to ${originalOwner}`);
    return { success: true, message: `${hostageName} è stato liberato!` };
  }

  // INTERRUPT SPECIAL EFFECT - Generic interrupt for special effect cards
  interruptSpecialEffect(gameId: string, cardId: string, playerName: string, io: any): { success: boolean; message?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false, message: 'Game not found' };
    
    const card = game.field.find(c => c.id === cardId);
    if (!card) return { success: false, message: 'Card not found on field' };
    
    // Check if player owns the card or is game master
    const isMaster = game.turnOrder?.[0] === playerName;
    if (card.owner !== playerName && !isMaster) {
      return { success: false, message: 'Non puoi interrompere una carta che non ti appartiene' };
    }
    
    const cardName = (card.name || this.getCardNameFromUrl(card.frontImage)).toUpperCase();
    console.log(`🛑 INTERROMPI: ${playerName} interrupting ${cardName} (${cardId})`);
    
    // Handle OSTAGGIO interruption
    if (cardName.includes('OSTAGGIO') && card.isOstaggioCard) {
      // Find the hostage
      const hostage = game.field.find(c => c.hostageOstaggioCardId === cardId);
      if (hostage) {
        // releaseHostage already handles returning OSTAGGIO card to deck
        this.releaseHostage(gameId, hostage.id, io);
      } else {
        // No hostage found, just return the OSTAGGIO card to deck
        this.returnToDeck(gameId, cardId, card.owner);
      }
      
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-effect-interrupted`,
        playerName: 'Sistema',
        message: `🛑 ${playerName} ha interrotto l'effetto di OSTAGGIO!`,
        timestamp: Date.now()
      });
      
      return { success: true, message: 'OSTAGGIO interrotto' };
    }
    
    // Handle BAMBOLA VOODOO interruption
    if (cardName.includes('BAMBOLA') || cardName.includes('VOODOO')) {
      // Remove voodoo links involving this card
      if (game.voodooLinks) {
        const link = game.voodooLinks.find(l => l.bonusCardId === cardId);
        if (link) {
          this.removeVoodooLink(gameId, link.card1Id);
        }
      }
      
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-effect-interrupted`,
        playerName: 'Sistema',
        message: `🛑 ${playerName} ha interrotto l'effetto di BAMBOLA VOODOO!`,
        timestamp: Date.now()
      });
      
      this.returnToDeck(gameId, cardId, card.owner);
      return { success: true, message: 'BAMBOLA VOODOO interrotto' };
    }
    
    // Handle VIRUS/INFLUENZA interruption (persistent damage)
    if (cardName.includes('VIRUS') || cardName.includes('INFLUENZA')) {
      if (game.persistentDamages) {
        // Filter by type matching the card name and by the card owner (attacker)
        const typeName = cardName.includes('VIRUS') ? 'VIRUS' : 'INFLUENZA';
        const removedCount = game.persistentDamages.filter(d => d.type === typeName && d.attacker === card.owner).length;
        game.persistentDamages = game.persistentDamages.filter(d => !(d.type === typeName && d.attacker === card.owner));
        console.log(`🛑 INTERROMPI: Removed ${removedCount} ${typeName} persistent damage entries from ${card.owner}`);
      }
      
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-effect-interrupted`,
        playerName: 'Sistema',
        message: `🛑 ${playerName} ha interrotto l'effetto di ${cardName}!`,
        timestamp: Date.now()
      });
      
      this.returnToDeck(gameId, cardId, card.owner);
      return { success: true, message: `${cardName} interrotto` };
    }
    
    // Handle PARASSITA/SAIBAIM interruption (parasitic cards)
    if (cardName.includes('PARASSITA') || cardName.includes('SAIBAIM')) {
      // Detach the parasitic card
      this.detachParasiticCard(gameId, cardId, 'manual');
      
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-effect-interrupted`,
        playerName: 'Sistema',
        message: `🛑 ${playerName} ha interrotto l'effetto di ${cardName}!`,
        timestamp: Date.now()
      });
      
      this.returnToDeck(gameId, cardId, card.owner);
      return { success: true, message: `${cardName} interrotto` };
    }
    
    // Handle DUELLO interruption
    if (cardName.includes('DUELLO')) {
      if (game.activeDuel && game.activeDuel.active) {
        game.activeDuel.active = false;
        delete game.activeDuel;
      }
      
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-effect-interrupted`,
        playerName: 'Sistema',
        message: `🛑 ${playerName} ha interrotto il DUELLO!`,
        timestamp: Date.now()
      });
      
      this.returnToDeck(gameId, cardId, card.owner);
      return { success: true, message: 'DUELLO interrotto' };
    }
    
    // Generic interruption for any other special effect card
    io.to(gameId).emit('chat-message', {
      id: `${Date.now()}-effect-interrupted`,
      playerName: 'Sistema',
      message: `🛑 ${playerName} ha interrotto l'effetto di ${cardName}!`,
      timestamp: Date.now()
    });
    
    this.returnToDeck(gameId, cardId, card.owner);
    return { success: true, message: `${cardName} interrotto` };
  }

  // PARASITIC CARD SYSTEM (PARASSITA/SAIBAIM)
  
  // Check if a card is PARASSITA or SAIBAIM
  isParasiticCard(card: Card): 'PARASSITA' | 'SAIBAIM' | null {
    const cardName = (card.name || this.getCardNameFromUrl(card.frontImage)).toUpperCase();
    if (cardName.includes('PARASSITA')) return 'PARASSITA';
    if (cardName.includes('SAIBAIM')) return 'SAIBAIM';
    return null;
  }

  // Get all valid targets for a parasitic card (opponent's PERSONAGGI on field)
  getParasiticTargets(gameId: string, ownerPlayerName: string): Card[] {
    const game = this.games.get(gameId);
    if (!game) return [];
    
    return game.field.filter(card => 
      (card.type === 'personaggi' || card.type === 'personaggi_speciali') &&
      card.owner !== ownerPlayerName &&
      !card.attachedTo // Don't allow targeting cards that are themselves attached
    );
  }

  // Get the best target for CPU (highest stars)
  getCPUParasiticTarget(gameId: string, ownerPlayerName: string): Card | null {
    const targets = this.getParasiticTargets(gameId, ownerPlayerName);
    if (targets.length === 0) return null;
    
    // Sort by stars (highest first)
    targets.sort((a, b) => {
      const starsA = this.extractStarsFromNote(a.text || '');
      const starsB = this.extractStarsFromNote(b.text || '');
      return starsB - starsA;
    });
    
    return targets[0];
  }

  // Attach a parasitic card to a target
  async attachParasiticCard(
    gameId: string, 
    parasiticCardId: string, 
    targetCardId: string, 
    playerName: string
  ): Promise<{ success: boolean; message?: string; attachment?: ParasiticAttachment }> {
    const game = this.games.get(gameId);
    if (!game) return { success: false, message: 'Game not found' };

    const parasiticCard = game.field.find(c => c.id === parasiticCardId);
    const targetCard = game.field.find(c => c.id === targetCardId);

    if (!parasiticCard) {
      return { success: false, message: 'Parasitic card not found on field' };
    }

    if (!targetCard) {
      return { success: false, message: 'Target card not found on field' };
    }

    // Check if card can reattach (false after first detachment)
    if (parasiticCard.canReattach === false) {
      return { success: false, message: 'This card cannot attach anymore (already detached once)' };
    }

    const parasiticType = this.isParasiticCard(parasiticCard);
    if (!parasiticType) {
      return { success: false, message: 'Card is not PARASSITA or SAIBAIM' };
    }

    // Validate target is opponent's PERSONAGGI
    if (targetCard.type !== 'personaggi' && targetCard.type !== 'personaggi_speciali') {
      return { success: false, message: 'Can only attach to PERSONAGGI cards' };
    }

    if (targetCard.owner === playerName) {
      return { success: false, message: 'Cannot attach to your own characters' };
    }

    // Store original field position for returning later
    const originalPosition = game.field.findIndex(c => c.id === parasiticCardId);

    // Create attachment record
    const attachment: ParasiticAttachment = {
      id: `attach-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      parasiticCardId,
      parasiticCardName: parasiticType,
      targetCardId,
      ownerPlayer: playerName,
      targetPlayer: targetCard.owner,
      turnsAttached: 0,
      originalPosition,
      active: true
    };

    game.parasiticAttachments.push(attachment);

    // Update card references
    parasiticCard.attachedTo = targetCardId;
    if (!targetCard.attachedBy) targetCard.attachedBy = [];
    targetCard.attachedBy.push(parasiticCardId);

    // For PARASSITA: copy target's stars
    if (parasiticType === 'PARASSITA') {
      const targetStars = this.extractStarsFromNote(targetCard.text || '');
      parasiticCard.originalStars = this.extractStarsFromNote(parasiticCard.text || '');
      const currentPTI = this.extractPTIFromNote(parasiticCard.text || '');
      parasiticCard.text = `PTI: ${currentPTI} | Stelle: ${targetStars}`;
      console.log(`🦠 PARASSITA copied ${targetStars} stars from target`);
    }

    // Record event
    await this.recordEvent(gameId, 'parasitic-attach', {
      parasiticCardId,
      parasiticType,
      targetCardId,
      targetOwner: targetCard.owner
    }, playerName);

    console.log(`🦠 ${parasiticType} (${parasiticCardId}) attached to ${targetCardId} owned by ${targetCard.owner}`);

    return { success: true, attachment };
  }

  // Detach parasitic card (when target dies or needs to return)
  async detachParasiticCard(
    gameId: string, 
    parasiticCardId: string,
    reason: 'target_death' | 'manual' = 'target_death'
  ): Promise<{ success: boolean; message?: string }> {
    const game = this.games.get(gameId);
    if (!game) return { success: false, message: 'Game not found' };

    const attachment = game.parasiticAttachments.find(
      a => a.parasiticCardId === parasiticCardId && a.active
    );

    if (!attachment) {
      return { success: false, message: 'No active attachment found' };
    }

    const parasiticCard = game.field.find(c => c.id === parasiticCardId);
    const targetCard = game.field.find(c => c.id === attachment.targetCardId);

    if (parasiticCard) {
      // Clear attachment reference
      parasiticCard.attachedTo = undefined;
      parasiticCard.canReattach = false; // Cannot reattach after detachment
      
      // For PARASSITA: restore original stars
      if (attachment.parasiticCardName === 'PARASSITA' && parasiticCard.originalStars !== undefined) {
        const currentPTI = this.extractPTIFromNote(parasiticCard.text || '');
        parasiticCard.text = `PTI: ${currentPTI} | Stelle: ${parasiticCard.originalStars}`;
        parasiticCard.originalStars = undefined;
      }
    }

    if (targetCard && targetCard.attachedBy) {
      targetCard.attachedBy = targetCard.attachedBy.filter(id => id !== parasiticCardId);
      if (targetCard.attachedBy.length === 0) {
        targetCard.attachedBy = undefined;
      }
    }

    // Mark attachment as inactive
    attachment.active = false;

    // Record event
    await this.recordEvent(gameId, 'parasitic-detach', {
      parasiticCardId,
      parasiticType: attachment.parasiticCardName,
      targetCardId: attachment.targetCardId,
      reason
    }, attachment.ownerPlayer);

    console.log(`🦠 ${attachment.parasiticCardName} (${parasiticCardId}) detached from ${attachment.targetCardId} (reason: ${reason})`);

    return { success: true };
  }

  // DELAYED DAMAGE SYSTEM
  
  // Add a delayed damage entry
  addDelayedDamage(
    gameId: string,
    attackerName: string,
    defenderName: string,
    targetCardId: string,
    damageValue: number,
    mosseCardId: string,
    turnsToDelay: number
  ): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;
    
    if (!game.delayedDamages) {
      game.delayedDamages = [];
    }
    
    const delayedDamage: DelayedDamage = {
      id: `delay-${Date.now()}-${targetCardId}`,
      attackerName,
      defenderName,
      targetCardId,
      damageValue,
      mosseCardId,
      turnsRemaining: turnsToDelay,
      createdAt: Date.now()
    };
    
    game.delayedDamages.push(delayedDamage);
    console.log(`⏳ DELAYED DAMAGE: ${damageValue} PTI from ${attackerName} to ${defenderName}'s card, triggers in ${turnsToDelay} turns`);
    
    return true;
  }
  
  // Process delayed damages at the end of a player's turn
  processDelayedDamages(
    gameId: string,
    playerName: string,
    io: any
  ): { appliedDamages: { targetCardId: string; damage: number }[] } {
    const game = this.games.get(gameId);
    if (!game || !game.delayedDamages) return { appliedDamages: [] };
    
    const appliedDamages: { targetCardId: string; damage: number }[] = [];
    
    // Process delayed damages for this player (defender)
    for (const delayed of game.delayedDamages) {
      if (delayed.defenderName !== playerName) continue;
      
      // Decrease turn counter
      delayed.turnsRemaining--;
      console.log(`⏳ DELAYED DAMAGE: ${delayed.damageValue} PTI to ${playerName}, ${delayed.turnsRemaining} turns remaining`);
      
      // If turns reached 0, apply the damage
      if (delayed.turnsRemaining <= 0) {
        const targetCard = game.field.find(c => c.id === delayed.targetCardId);
        
        if (targetCard) {
          const currentPTI = this.extractPTIFromNote(targetCard.text || '');
          const newPTI = Math.max(0, currentPTI - delayed.damageValue);
          
          // Update PTI
          const stars = this.extractStarsFromNote(targetCard.text || '');
          targetCard.text = `PTI: ${newPTI}${stars > 0 ? ` | Stelle: ${stars}` : ''}`;
          
          appliedDamages.push({ targetCardId: delayed.targetCardId, damage: delayed.damageValue });
          
          const cardName = targetCard.name || this.getCardNameFromUrl(targetCard.frontImage);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-delayed-damage`,
            playerName: 'Sistema',
            message: `⏳💥 DANNO RITARDATO! ${cardName} di ${playerName} subisce ${delayed.damageValue} PTI! (PTI: ${currentPTI} → ${newPTI})`,
            timestamp: Date.now()
          });
          
          console.log(`⏳💥 DELAYED DAMAGE APPLIED: ${delayed.damageValue} PTI to ${cardName}, new PTI: ${newPTI}`);
          
          // Check if character died
          if (newPTI <= 0) {
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-delayed-death`,
              playerName: 'Sistema',
              message: `💀 ${cardName} di ${playerName} è stato eliminato dal danno ritardato!`,
              timestamp: Date.now()
            });
            
            this.moveToGraveyard(gameId, delayed.targetCardId, playerName, delayed.attackerName);
          }
        }
      }
    }
    
    // Remove expired delayed damages
    game.delayedDamages = game.delayedDamages.filter(d => d.turnsRemaining > 0);
    
    return { appliedDamages };
  }

  // Process parasitic card turn effects (called at start of owner's turn)
  async processParasiticTurnEffects(
    gameId: string, 
    playerName: string,
    eventEmitter?: (event: string, data: any) => void
  ): Promise<{ explosions: string[]; drains: { cardId: string; ptiDrained: number }[] }> {
    const game = this.games.get(gameId);
    if (!game) return { explosions: [], drains: [] };

    const explosions: string[] = [];
    const drains: { cardId: string; ptiDrained: number }[] = [];

    // Find all active attachments owned by this player
    const playerAttachments = game.parasiticAttachments.filter(
      a => a.ownerPlayer === playerName && a.active
    );

    for (const attachment of playerAttachments) {
      // Increment turn counter
      attachment.turnsAttached++;

      const parasiticCard = game.field.find(c => c.id === attachment.parasiticCardId);
      const targetCard = game.field.find(c => c.id === attachment.targetCardId);

      if (!parasiticCard || !targetCard) {
        // Card no longer exists, deactivate attachment
        attachment.active = false;
        continue;
      }

      if (attachment.parasiticCardName === 'SAIBAIM') {
        // SAIBAIM: Explode after 3 turns
        if (attachment.turnsAttached >= 3) {
          console.log(`💥 SAIBAIM (${attachment.parasiticCardId}) exploding after 3 turns!`);
          
          // Kill both SAIBAIM and target
          explosions.push(attachment.parasiticCardId);
          explosions.push(attachment.targetCardId);

          // Move both to graveyard
          await this.sendCardToGraveyard(gameId, attachment.parasiticCardId, playerName, 'explosion');
          await this.sendCardToGraveyard(gameId, attachment.targetCardId, playerName, 'explosion');

          attachment.active = false;

          // Emit explosion event for animation
          if (eventEmitter) {
            eventEmitter('saibaim-explosion', {
              saibaim: attachment.parasiticCardId,
              target: attachment.targetCardId,
              targetOwner: attachment.targetPlayer
            });
          }
        } else {
          // Update turn counter text on card
          const currentPTI = this.extractPTIFromNote(parasiticCard.text || '');
          const currentStars = this.extractStarsFromNote(parasiticCard.text || '');
          const turnsLeft = 3 - attachment.turnsAttached;
          parasiticCard.text = `PTI: ${currentPTI} | Stelle: ${currentStars} | ESPLODE IN ${turnsLeft} TURNI`;
        }
      } else if (attachment.parasiticCardName === 'PARASSITA') {
        // PARASSITA: Drain 100 PTI from target, add to self
        const targetPTI = this.extractPTIFromNote(targetCard.text || '');
        const targetStars = this.extractStarsFromNote(targetCard.text || '');
        const parasitePTI = this.extractPTIFromNote(parasiticCard.text || '');
        const parasiteStars = this.extractStarsFromNote(parasiticCard.text || '');

        const drainAmount = Math.min(100, targetPTI); // Can't drain more than target has

        if (drainAmount > 0) {
          // Update target PTI
          targetCard.text = `PTI: ${targetPTI - drainAmount} | Stelle: ${targetStars}`;
          // Update parasite PTI
          parasiticCard.text = `PTI: ${parasitePTI + drainAmount} | Stelle: ${parasiteStars}`;

          drains.push({ cardId: attachment.parasiticCardId, ptiDrained: drainAmount });

          console.log(`🦠 PARASSITA drained ${drainAmount} PTI from ${attachment.targetCardId} (now: ${targetPTI - drainAmount} PTI)`);

          // Check if target died from drain
          if (targetPTI - drainAmount <= 0) {
            console.log(`💀 Target ${attachment.targetCardId} killed by PARASSITA drain!`);
            await this.sendCardToGraveyard(gameId, attachment.targetCardId, playerName, 'parasitic_drain');
            await this.detachParasiticCard(gameId, attachment.parasiticCardId, 'target_death');
          }

          // Emit drain event for animation
          if (eventEmitter) {
            eventEmitter('parassita-drain', {
              parassita: attachment.parasiticCardId,
              target: attachment.targetCardId,
              targetOwner: attachment.targetPlayer,
              ptiDrained: drainAmount
            });
          }
        }
      }
    }

    return { explosions, drains };
  }

  // Check if a card can be attacked (for immunity system)
  canCardBeAttacked(gameId: string, cardId: string, attackerOwner: string): { canAttack: boolean; reason?: string } {
    const game = this.games.get(gameId);
    if (!game) return { canAttack: true };

    const card = game.field.find(c => c.id === cardId);
    if (!card) return { canAttack: true };

    // Check if card is a parasitic card that's attached
    if (card.attachedTo) {
      const attachment = game.parasiticAttachments.find(
        a => a.parasiticCardId === cardId && a.active
      );
      
      if (attachment) {
        if (attachment.parasiticCardName === 'PARASSITA') {
          // PARASSITA cannot be attacked by anyone while attached
          return { canAttack: false, reason: 'PARASSITA non può essere attaccato mentre è agganciato!' };
        } else if (attachment.parasiticCardName === 'SAIBAIM') {
          // SAIBAIM cannot be attacked by the target it's attached to
          if (attackerOwner === attachment.targetPlayer) {
            return { canAttack: false, reason: 'SAIBAIM non può essere attaccato dal personaggio a cui è agganciato!' };
          }
        }
      }
    }

    return { canAttack: true };
  }

  // MEDICINA SOMMINISTRA - Cure VIRUS/INFLUENZA and eliminate PARASSITA
  async somministraMedicina(gameId: string, medicinaCardId: string, playerName: string): Promise<{ 
    success: boolean; 
    virusCleared: number; 
    influenzaCleared: number; 
    parassitaEliminated: string[];
    message?: string 
  }> {
    const game = this.games.get(gameId);
    if (!game) return { success: false, virusCleared: 0, influenzaCleared: 0, parassitaEliminated: [], message: 'Game not found' };

    let virusCleared = 0;
    let influenzaCleared = 0;
    const parassitaEliminated: string[] = [];

    // Clear all VIRUS and INFLUENZA persistent damage effects
    if (game.persistentDamages && game.persistentDamages.length > 0) {
      const originalLength = game.persistentDamages.length;
      game.persistentDamages = game.persistentDamages.filter(d => {
        if (d.type === 'VIRUS') {
          virusCleared++;
          console.log(`💊 MEDICINA cleared VIRUS effect from ${d.targetCardId}`);
          return false;
        }
        if (d.type === 'INFLUENZA') {
          influenzaCleared++;
          console.log(`💊 MEDICINA cleared INFLUENZA effect from ${d.targetCardId}`);
          return false;
        }
        return true;
      });
      console.log(`💊 MEDICINA cleared ${originalLength - game.persistentDamages.length} persistent damage effects`);
    }

    // Find and eliminate all PARASSITA cards on field
    const parassitaCards = game.field.filter(card => {
      const cardName = this.getCardNameFromUrl(card.frontImage).toUpperCase();
      return cardName.includes('PARASSITA');
    });

    for (const parassita of parassitaCards) {
      console.log(`💊 MEDICINA eliminating PARASSITA: ${parassita.id}`);
      
      // Detach if attached
      if (parassita.attachedTo) {
        await this.detachParasiticCard(gameId, parassita.id, 'manual');
      }
      
      // Send to graveyard
      await this.sendCardToGraveyard(gameId, parassita.id, parassita.owner, 'medicina');
      parassitaEliminated.push(parassita.id);
    }

    // Return MEDICINA card to deck after use (not graveyard)
    this.returnToDeck(gameId, medicinaCardId, playerName);

    console.log(`💊 MEDICINA SOMMINISTRA complete: ${virusCleared} VIRUS, ${influenzaCleared} INFLUENZA cleared, ${parassitaEliminated.length} PARASSITA eliminated`);

    return { 
      success: true, 
      virusCleared, 
      influenzaCleared, 
      parassitaEliminated 
    };
  }

  // Look up PERSONAGGI data from database
  // Synchronous cache-first lookup for PERSONAGGI data
  private getPersonaggioFromDatabaseSync(cardName: string): { pti: number | null, stars: number | null } | null {
    // Use the in-memory cache from routes.ts for instant lookup
    const cached = getPersonaggioFromCache(cardName);
    if (cached) return cached;
    return null;
  }

  private async getPersonaggioFromDatabase(cardName: string): Promise<{ pti: number | null, stars: number | null } | null> {
    // Try cache first (instant)
    const cached = getPersonaggioFromCache(cardName);
    if (cached) return cached;
    
    // Fallback to database only if cache miss (rare)
    try {
      console.log(`🔍 Cache miss, looking up ${cardName} in PERSONAGGI database...`);
      
      // First try exact match
      let result = await db.select().from(personaggi).where(eq(personaggi.name, cardName.toUpperCase())).limit(1);
      
      // If no exact match, try fuzzy search
      if (result.length === 0) {
        result = await db.select().from(personaggi).where(ilike(personaggi.name, `%${cardName.toUpperCase()}%`)).limit(1);
      }
      
      if (result.length > 0) {
        console.log(`✅ Found in database: ${result[0].name} - PTI: ${result[0].pti}, Stelle: ${result[0].stars}`);
        return {
          pti: result[0].pti,
          stars: result[0].stars
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error querying PERSONAGGI database:', error);
      return null;
    }
  }

  // FUSION SYSTEM FOR PERSONAGGI CARDS - UNLIMITED FUSION
  async fuseCards(gameId: string, leaderCardId: string, targetCardId: string, playerName: string): Promise<{ success: boolean, message?: string }> {
    try {
      const game = this.games.get(gameId);
      if (!game) return { success: false, message: 'Game not found' };

      // Find both cards in the field
      const leaderCard = game.field.find(card => card.id === leaderCardId);
      const targetCard = game.field.find(card => card.id === targetCardId);

      if (!leaderCard || !targetCard) {
        return { success: false, message: 'One or both cards not found on field' };
      }

      // Only PERSONAGGI and PERSONAGGI_SPECIALI cards can be fused
      if ((leaderCard.type !== 'personaggi' && leaderCard.type !== 'personaggi_speciali') || 
          (targetCard.type !== 'personaggi' && targetCard.type !== 'personaggi_speciali')) {
        return { success: false, message: 'Only PERSONAGGI and PERSONAGGI_SPECIALI cards can be fused' };
      }

      // VALIDATION: Prevent fusing cards that are already in the same fusion group
      const leaderFusionId = leaderCard.fusionLeader || leaderCardId;
      const targetFusionId = targetCard.fusionLeader || targetCardId;
      
      if (leaderCard.isFused && targetCard.isFused && leaderFusionId === targetFusionId) {
        console.log(`❌ Fusion rejected: Cards ${leaderCardId} and ${targetCardId} are already fused together`);
        return { success: false, message: 'Queste carte sono già fuse insieme!' };
      }

      // Transfer target card ownership to the player initiating fusion
      targetCard.owner = playerName;

      // Determine which cards are already in fusion groups
      const leaderGroup = leaderCard.isFused ? this.getFusionGroup(game, leaderCardId) : [leaderCard];
      const targetGroup = targetCard.isFused ? this.getFusionGroup(game, targetCardId) : [targetCard];
      
      // Merge both groups into one
      const allCardsInFusion = [...leaderGroup, ...targetGroup];
      const allCardIds = allCardsInFusion.map(c => c.id);
      
      // Determine the fusion leader (use the leaderCard as the leader)
      const fusionLeaderId = leaderCard.fusionLeader || leaderCardId;
      
      // Update all cards in the merged fusion group
      for (const card of allCardsInFusion) {
        card.isFused = true;
        card.fusionLeader = fusionLeaderId;
        card.fusedWith = allCardIds.filter(id => id !== card.id);
      }

      // Merge text notes (PTI and stars) - sum all cards in the fusion
      const allTexts = allCardsInFusion.map(c => c.text || '');
      const mergedText = this.mergeMultipleCardNotes(allTexts);
      
      // Apply merged text to all cards in the fusion
      for (const card of allCardsInFusion) {
        card.text = mergedText;
      }

      // Record fusion event
      await this.recordEvent(gameId, 'fuse-cards', {
        leaderCardId,
        targetCardId,
        leaderImage: leaderCard.frontImage,
        targetImage: targetCard.frontImage,
        newOwner: playerName,
        totalCardsInFusion: allCardsInFusion.length
      }, playerName);

      console.log(`Cards fused: ${leaderCardId} + ${targetCardId} by ${playerName} (total ${allCardsInFusion.length} cards in fusion)`);
      return { success: true };

    } catch (error) {
      console.error('Error fusing cards:', error);
      return { success: false, message: 'Error during fusion' };
    }
  }

  // Helper to get all cards in a fusion group
  private getFusionGroup(game: any, cardId: string): any[] {
    const card = game.field.find((c: any) => c.id === cardId);
    if (!card || !card.isFused) return [card];
    
    const fusionLeaderId = card.fusionLeader || cardId;
    const fusedCards = game.field.filter((c: any) => 
      c.id === fusionLeaderId || c.fusionLeader === fusionLeaderId
    );
    
    return fusedCards;
  }

  // Helper to merge multiple card notes (sum PTI and stars from all cards)
  private mergeMultipleCardNotes(notes: string[]): string {
    let totalPTI = 0;
    let totalStars = 0;
    
    for (const note of notes) {
      totalPTI += this.extractPTIFromNote(note);
      totalStars += this.extractStarsFromNote(note);
    }
    
    return `PTI: ${totalPTI} | Stelle: ${totalStars}`;
  }

  async separateCards(gameId: string, cardId: string, playerName: string): Promise<{ success: boolean, message?: string }> {
    try {
      const game = this.games.get(gameId);
      if (!game) return { success: false, message: 'Game not found' };

      // Find the card to separate
      const card = game.field.find(c => c.id === cardId);
      if (!card) {
        return { success: false, message: 'Card not found on field' };
      }

      // Check if card is fused
      if (!card.isFused || !card.fusedWith) {
        return { success: false, message: 'Card is not fused' };
      }

      // Find the other fused card(s)
      const fusedCardIds = card.fusedWith;
      const fusedCards = game.field.filter(c => fusedCardIds.includes(c.id));

      // Separate all cards in the fusion
      const allCards = [card, ...fusedCards];
      
      for (const fusedCard of allCards) {
        // Reset fusion properties
        fusedCard.isFused = false;
        fusedCard.fusedWith = undefined;
        fusedCard.fusionLeader = undefined;
        
        // Restore individual notes (split the merged PTI/stars)
        fusedCard.text = this.splitCardNotes(fusedCard.text || '', fusedCard.id);
      }

      // Record separation event
      await this.recordEvent(gameId, 'separate-cards', {
        cardId,
        fusedCardIds,
        separatedBy: playerName
      }, playerName);

      console.log(`Cards separated: ${cardId} and ${fusedCardIds.join(', ')} by ${playerName}`);
      return { success: true };

    } catch (error) {
      console.error('Error separating cards:', error);
      return { success: false, message: 'Error during separation' };
    }
  }

  async duplicateCard(gameId: string, cardId: string, playerName: string): Promise<{ success: boolean, message?: string, duplicatedCardId?: string }> {
    try {
      const game = this.games.get(gameId);
      if (!game) return { success: false, message: 'Game not found' };

      // Find the card to duplicate (can be in field or ANY player's hand)
      let originalCard = game.field.find(card => card.id === cardId);
      let isInField = true;
      
      if (!originalCard) {
        // Check in ALL players' hands (not just requesting player)
        for (const [pName, player] of Object.entries(game.players)) {
          if ((player as any).hand) {
            const foundCard = (player as any).hand.find((card: any) => card.id === cardId);
            if (foundCard) {
              originalCard = foundCard;
              isInField = false;
              break;
            }
          }
        }
      }

      if (!originalCard) {
        return { success: false, message: 'Card not found' };
      }

      // Only PERSONAGGI and PERSONAGGI_SPECIALI cards can be duplicated
      if (originalCard.type !== 'personaggi' && originalCard.type !== 'personaggi_speciali') {
        return { success: false, message: 'Only PERSONAGGI and PERSONAGGI_SPECIALI cards can be duplicated' };
      }

      // ALLOW duplicating any card (including opponent's cards)
      // The duplicate keeps the ORIGINAL OWNER - it's a copy for the opponent, not for you
      console.log(`Duplicating card owned by ${originalCard.owner} (requested by ${playerName})`);

      // Create the duplicate card with same properties - KEEP ORIGINAL OWNER
      const duplicatedCard = {
        id: `${originalCard.type}-duplicate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: originalCard.type as 'personaggi' | 'personaggi_speciali',
        frontImage: originalCard.frontImage,
        backImage: originalCard.backImage,
        owner: originalCard.owner, // KEEP ORIGINAL OWNER - duplicate belongs to same player
        text: originalCard.text || '', // Copy the notes with PTI and stars
        faceDown: originalCard.faceDown || false
      };

      // Add duplicate to the same location as original (field or hand)
      if (isInField) {
        game.field.push(duplicatedCard);
      } else {
        const player = game.players[playerName];
        if (player && player.hand) {
          player.hand.push(duplicatedCard);
        }
      }

      // Record duplication event
      await this.recordEvent(gameId, 'duplicate-card', {
        originalCardId: cardId,
        duplicatedCardId: duplicatedCard.id,
        cardType: originalCard.type,
        frontImage: originalCard.frontImage,
        location: isInField ? 'field' : 'hand'
      }, playerName);

      console.log(`Card duplicated: ${cardId} -> ${duplicatedCard.id} by ${playerName} (location: ${isInField ? 'field' : 'hand'})`);
      return { success: true, duplicatedCardId: duplicatedCard.id };

    } catch (error) {
      console.error('Error duplicating card:', error);
      return { success: false, message: 'Error during duplication' };
    }
  }

  // Get player's available Rankiard points for this game (total - spent)
  getAvailableRankiardPoints(gameId: string, playerName: string): number {
    const game = this.games.get(gameId);
    if (!game) return 0;
    
    const userId = game.playerUserIds.get(playerName);
    if (!userId) return 0;
    
    // Get total points from database (we'll need to query this)
    // For now, return 0 - the actual value will be passed from client
    const spent = game.prSpentThisGame.get(playerName) || 0;
    return -spent; // Return negative of spent, actual total comes from client
  }

  // Get how many PR points a player has spent this game
  getPRSpentThisGame(gameId: string, playerName: string): number {
    const game = this.games.get(gameId);
    if (!game) return 0;
    return game.prSpentThisGame.get(playerName) || 0;
  }

  // Add PR (Rankiard Points) to a character - subtracts from player's available points for this game
  addPRToCard(gameId: string, cardId: string, prAmount: number, playerName: string, userTotalPoints: number): { success: boolean, message?: string, newPTI?: number, prSpent?: number } {
    try {
      const game = this.games.get(gameId);
      if (!game) return { success: false, message: 'Game not found' };

      // Calculate available points (total - already spent this game)
      const alreadySpent = game.prSpentThisGame.get(playerName) || 0;
      const availablePoints = userTotalPoints - alreadySpent;

      // Check if player has enough points
      if (prAmount > availablePoints) {
        return { success: false, message: `Non hai abbastanza punti Rankiard! Disponibili: ${availablePoints}` };
      }

      // Find the card in the field
      const card = game.field.find(c => c.id === cardId);
      if (!card) {
        return { success: false, message: 'Card not found in field' };
      }

      // Only PERSONAGGI and PERSONAGGI_SPECIALI cards can have PTI added
      if (card.type !== 'personaggi' && card.type !== 'personaggi_speciali') {
        return { success: false, message: 'Solo i PERSONAGGI possono ricevere PTI' };
      }

      // Extract current PTI from card notes
      const currentPTI = this.extractPTIFromNote(card.text || '');
      const currentStars = this.extractStarsFromNote(card.text || '');
      
      // Calculate new PTI (PR points become PTI)
      const newPTI = currentPTI + prAmount;
      
      // Update card notes with new PTI value
      card.text = `PTI: ${newPTI} | Stelle: ${currentStars}`;
      
      // Track the PR spent for this game
      game.prSpentThisGame.set(playerName, alreadySpent + prAmount);
      
      console.log(`PR converted to PTI for card ${cardId}: ${prAmount} PR -> +${prAmount} PTI (total: ${newPTI}). Player ${playerName} spent: ${alreadySpent + prAmount}`);
      
      return { success: true, newPTI, prSpent: alreadySpent + prAmount };

    } catch (error) {
      console.error('Error adding PR to card:', error);
      return { success: false, message: 'Error adding PR' };
    }
  }

  // Add PTI to a character card
  addPTIToCard(gameId: string, cardId: string, ptiAmount: number, playerName: string): { success: boolean, message?: string, newPTI?: number } {
    try {
      const game = this.games.get(gameId);
      if (!game) return { success: false, message: 'Game not found' };

      // Find the card in the field
      const card = game.field.find(c => c.id === cardId);
      if (!card) {
        return { success: false, message: 'Card not found in field' };
      }

      // Only PERSONAGGI and PERSONAGGI_SPECIALI cards can have PTI added
      if (card.type !== 'personaggi' && card.type !== 'personaggi_speciali') {
        return { success: false, message: 'Solo i PERSONAGGI possono ricevere PTI' };
      }

      // Extract current PTI from card notes
      const currentPTI = this.extractPTIFromNote(card.text || '');
      const currentStars = this.extractStarsFromNote(card.text || '');
      
      // Calculate new PTI
      const newPTI = currentPTI + ptiAmount;
      
      // Update card notes with new PTI value
      card.text = `PTI: ${newPTI} | Stelle: ${currentStars}`;
      
      console.log(`PTI added to card ${cardId}: ${currentPTI} + ${ptiAmount} = ${newPTI}`);
      
      return { success: true, newPTI };

    } catch (error) {
      console.error('Error adding PTI to card:', error);
      return { success: false, message: 'Error adding PTI' };
    }
  }

  // Modify card stats (PTI and Stars) - can add or subtract
  modifyCardStats(gameId: string, cardId: string, ptiAmount: number, stelleAmount: number, playerName: string): { success: boolean, message?: string, newPTI?: number, newStelle?: number } {
    try {
      const game = this.games.get(gameId);
      if (!game) return { success: false, message: 'Game not found' };

      // Find the card in the field
      const card = game.field.find(c => c.id === cardId);
      if (!card) {
        return { success: false, message: 'Card not found in field' };
      }

      // Only PERSONAGGI and PERSONAGGI_SPECIALI cards can have stats modified
      if (card.type !== 'personaggi' && card.type !== 'personaggi_speciali') {
        return { success: false, message: 'Solo i PERSONAGGI possono avere statistiche modificate' };
      }

      // Extract current values from card notes
      const currentPTI = this.extractPTIFromNote(card.text || '');
      const currentStars = this.extractStarsFromNote(card.text || '');
      
      // Calculate new values (capped at minimum 0)
      const newPTI = Math.max(0, currentPTI + ptiAmount);
      const newStelle = Math.max(0, currentStars + stelleAmount);
      
      // Update card notes with new values
      card.text = `PTI: ${newPTI} | Stelle: ${newStelle}`;
      
      console.log(`Stats modified for card ${cardId}: PTI ${currentPTI} -> ${newPTI}, Stelle ${currentStars} -> ${newStelle}`);
      
      return { success: true, newPTI, newStelle };

    } catch (error) {
      console.error('Error modifying card stats:', error);
      return { success: false, message: 'Error modifying stats' };
    }
  }

  // Helper method to merge card notes (sum PTI and stars)
  private mergeCardNotes(note1: string, note2: string): string {
    const pti1 = this.extractPTIFromNote(note1);
    const pti2 = this.extractPTIFromNote(note2);
    const stars1 = this.extractStarsFromNote(note1);
    const stars2 = this.extractStarsFromNote(note2);

    const totalPTI = pti1 + pti2;
    const totalStars = stars1 + stars2;

    return `PTI: ${totalPTI} | Stelle: ${totalStars}`;
  }

  // Helper method to split card notes (restore individual values)
  private splitCardNotes(mergedNote: string, cardId: string): string {
    // For now, split equally. In a more advanced version, 
    // we could store original values before fusion
    const totalPTI = this.extractPTIFromNote(mergedNote);
    const totalStars = this.extractStarsFromNote(mergedNote);
    
    const halfPTI = Math.floor(totalPTI / 2);
    const halfStars = Math.floor(totalStars / 2);

    return `PTI: ${halfPTI} | Stelle: ${halfStars}`;
  }

  // Helper method to extract PTI from note text
  private extractPTIFromNote(note: string): number {
    const match = note.match(/PTI:\s*(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  }

  // Helper method to extract Stars from note text
  private extractStarsFromNote(note: string): number {
    const match = note.match(/Stelle:\s*(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  }

  // AUTO-ANALYZE PERSONAGGI CARDS FOR ALL PLAYERS (using cache - synchronous)
  private autoAnalyzePersonaggioCardSync(card: any, playerName: string): void {
    try {
      const cardName = this.getCardNameFromUrl(card.frontImage);
      
      // Use synchronous cache lookup for instant response
      const cachedResult = getPersonaggioFromCache(cardName);
      
      if (cachedResult && (cachedResult.pti !== null || cachedResult.stars !== null)) {
        const pti = cachedResult.pti || 1000;
        const stars = cachedResult.stars || 1;
        card.text = `PTI: ${pti} | Stelle: ${stars} | PTI originali: ${pti}`;
      } else {
        card.text = 'PTI: 1000 | Stelle: 1 | PTI originali: 1000';
      }
    } catch (error) {
      card.text = 'PTI: 1000 | Stelle: 1 | PTI originali: 1000';
    }
  }

  // Async version for CPU AI fallback (kept for compatibility)
  private async autoAnalyzePersonaggioCard(gameId: string, card: any, playerName: string) {
    try {
      const cardName = this.getCardNameFromUrl(card.frontImage);
      
      // Try sync cache first
      const cachedResult = getPersonaggioFromCache(cardName);
      
      if (cachedResult && (cachedResult.pti !== null || cachedResult.stars !== null)) {
        const pti = cachedResult.pti || 1000;
        const stars = cachedResult.stars || 1;
        card.text = `PTI: ${pti} | Stelle: ${stars} | PTI originali: ${pti}`;
        return;
      }
      
      // Fallback for CPU players using AI analysis (async)
      const game = this.games.get(gameId);
      const player = game?.players[playerName];
      
      if (player?.isCPU && player.cpuInstance) {
        const analysis = await player.cpuInstance.analyzeCardImageDetailed(card.frontImage, 'personaggi');
        
        if (analysis && ((analysis.pti && analysis.pti > 0) || (analysis.stars && analysis.stars > 0))) {
          card.text = `PTI: ${analysis.pti} | Stelle: ${analysis.stars} | PTI originali: ${analysis.pti}`;
        } else {
          card.text = 'PTI: 1000 | Stelle: 1 | PTI originali: 1000';
        }
      } else {
        card.text = 'PTI: 1000 | Stelle: 1 | PTI originali: 1000';
      }
    } catch (error) {
      card.text = 'PTI: 1000 | Stelle: 1 | PTI originali: 1000';
    }
  }


  async revealCard(gameId: string, cardId: string, playerName: string): Promise<{ card?: any, isPersonaggio?: boolean }> {
    const game = this.games.get(gameId);
    if (!game) return {};

    // Find the card in the field
    const cardIndex = game.field.findIndex(card => card.id === cardId && card.owner === playerName);
    
    if (cardIndex !== -1) {
      const card = game.field[cardIndex];
      
      // Only reveal if it's face down and owned by the player
      if (card.faceDown) {
        card.faceDown = false; // Reveal the card
        
        // Check if it's a PERSONAGGI card
        const isPersonaggio = card.type === 'personaggi' || card.type === 'personaggi_speciali';
        
        // Record reveal card event
        await this.recordEvent(gameId, 'reveal-card', {
          cardId: card.id,
          cardType: card.type,
          frontImage: card.frontImage,
          isPersonaggio
        }, playerName);
        
        return { card, isPersonaggio };
      }
    }
    
    return {};
  }

  async returnToHand(gameId: string, cardId: string, playerName: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return;

    // Find card in field or graveyard
    let cardIndex = game.field.findIndex(card => card.id === cardId);
    let card: Card | undefined;

    if (cardIndex !== -1) {
      card = game.field.splice(cardIndex, 1)[0];
    } else {
      cardIndex = game.graveyard.findIndex(card => card.id === cardId);
      if (cardIndex !== -1) {
        card = game.graveyard.splice(cardIndex, 1)[0];
      }
    }

    if (card && card.owner === playerName) {
      game.players[playerName].hand.push(card);
      
      // Record return to hand event
      await this.recordEvent(gameId, 'return-to-hand', {
        cardId: card.id,
        cardType: card.type,
        fromLocation: cardIndex !== -1 ? 'field' : 'graveyard'
      }, playerName);
    }
  }

  // Check if a card type has been used this turn (by frontImage)
  hasCardTypeBeenUsed(gameId: string, frontImage: string, playerName: string): boolean {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) {
      console.log(`hasCardTypeBeenUsed: game or player not found for ${gameId}, ${playerName}`);
      return false;
    }
    
    const player = game.players[playerName];
    const hasBeenUsed = player.usedCardsThisTurn?.includes(frontImage) || false;
    console.log(`hasCardTypeBeenUsed: ${playerName}, ${frontImage} = ${hasBeenUsed}, usedCards: ${JSON.stringify(player.usedCardsThisTurn)}`);
    return hasBeenUsed;
  }

  // Mark a card type as used this turn (by frontImage)
  markCardTypeAsUsed(gameId: string, frontImage: string, playerName: string): void {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) {
      console.log(`markCardTypeAsUsed: game or player not found for ${gameId}, ${playerName}`);
      return;
    }
    
    const player = game.players[playerName];
    if (!player.usedCardsThisTurn) {
      player.usedCardsThisTurn = [];
    }
    
    if (!player.usedCardsThisTurn.includes(frontImage)) {
      player.usedCardsThisTurn.push(frontImage);
      console.log(`${playerName} marked card type ${frontImage} as used this turn. UsedCards: ${JSON.stringify(player.usedCardsThisTurn)}`);
    }
  }

  // Legacy method for backward compatibility
  hasCardBeenUsed(gameId: string, cardId: string, playerName: string): boolean {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return false;
    
    // Find the card to get its frontImage
    const card = game.field.find(c => c.id === cardId) || 
                 game.players[playerName].hand.find(c => c.id === cardId);
    
    if (card) {
      return this.hasCardTypeBeenUsed(gameId, card.frontImage, playerName);
    }
    
    return false;
  }

  // Legacy method for backward compatibility  
  markCardAsUsed(gameId: string, cardId: string, playerName: string): void {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return;
    
    // Find the card to get its frontImage
    const card = game.field.find(c => c.id === cardId) || 
                 game.players[playerName].hand.find(c => c.id === cardId);
    
    if (card) {
      this.markCardTypeAsUsed(gameId, card.frontImage, playerName);
    }
  }

  returnToDeck(gameId: string, cardId: string, playerName: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    // Remove persistent damages if the attacker character is returned to deck (except for PUOZZA)
    if (game.persistentDamages) {
      game.persistentDamages = game.persistentDamages.filter(d => {
        if (d.attackerCardId === cardId && d.type !== 'PUOZZA') {
          console.log(`Persistent damage ${d.type} removed because attacker ${cardId} returned to deck`);
          return false;
        }
        return true;
      });
    }

    // Find card in field, hand, or graveyard
    let card: Card | undefined;
    
    // Check field
    let cardIndex = game.field.findIndex(c => c.id === cardId);
    if (cardIndex !== -1) {
      card = game.field.splice(cardIndex, 1)[0];
    }

    // Check player's hand
    if (!card && game.players[playerName]) {
      cardIndex = game.players[playerName].hand.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        card = game.players[playerName].hand.splice(cardIndex, 1)[0];
      }
    }

    // Check graveyard
    if (!card) {
      cardIndex = game.graveyard.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        card = game.graveyard.splice(cardIndex, 1)[0];
      }
    }

    if (card && card.owner === playerName) {
      // Reset card ownership and add back to deck
      card.owner = '';
      card.text = '';
      card.eliminatedBy = '';
      
      const deckType = card.type as keyof GameState['decks'];
      // Add to BOTTOM of deck using unshift instead of push
      game.decks[deckType].unshift(card);
      
      console.log(`Returned ${card.type} card ${cardId} to BOTTOM of deck for ${playerName}`);
    }
  }

  moveToGraveyard(gameId: string, cardId: string, playerName: string, attacker?: string): { success: boolean, graveyardCount?: number, cardImage?: string, cardType?: string, eliminationCheck?: boolean, sorosActivated?: boolean, sorosImage?: string, sorosActivator?: string, detachedParasites?: string[] } {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    // Remove persistent damages if the target character is moved to graveyard
    if (game.persistentDamages) {
      const originalLength = game.persistentDamages.length;
      game.persistentDamages = game.persistentDamages.filter(d => d.targetCardId !== cardId);
      if (game.persistentDamages.length < originalLength) {
        console.log(`Persistent damages removed because target ${cardId} moved to graveyard`);
      }
    }

    // PARASITIC CARDS: If this card has parasitic attachments, detach them
    const detachedParasites: string[] = [];
    if (game.parasiticAttachments) {
      const attachmentsToDetach = game.parasiticAttachments.filter(
        a => a.targetCardId === cardId && a.active
      );
      
      for (const attachment of attachmentsToDetach) {
        const parasiticCard = game.field.find(c => c.id === attachment.parasiticCardId);
        if (parasiticCard) {
          // Clear attachment reference
          parasiticCard.attachedTo = undefined;
          parasiticCard.canReattach = false; // Cannot reattach after detachment
          
          // For PARASSITA: restore original stars
          if (attachment.parasiticCardName === 'PARASSITA' && parasiticCard.originalStars !== undefined) {
            const currentPTI = this.extractPTIFromNote(parasiticCard.text || '');
            parasiticCard.text = `PTI: ${currentPTI} | Stelle: ${parasiticCard.originalStars}`;
            parasiticCard.originalStars = undefined;
          }
          
          detachedParasites.push(attachment.parasiticCardId);
          console.log(`🦠 ${attachment.parasiticCardName} (${attachment.parasiticCardId}) detached because target ${cardId} died`);
        }
        
        attachment.active = false;
      }
    }

    // Find card in field
    const cardIndex = game.field.findIndex(card => card.id === cardId);
    if (cardIndex !== -1) {
      const card = game.field.splice(cardIndex, 1)[0];
      if (card.owner === playerName) {
        // BAMBOLA VOODOO: Remove any voodoo links when character dies
        if (card.type === 'personaggi' || card.type === 'personaggi_speciali') {
          this.removeVoodooLink(gameId, cardId);
        }
        
        card.eliminatedBy = playerName;
        game.graveyard.push(card);

        // Count PERSONAGGI cards in graveyard for this player (only personaggi count for elimination)
        const graveyardCount = game.graveyard.filter(
          graveyardCard => graveyardCard.eliminatedBy === playerName && (graveyardCard.type === 'personaggi' || graveyardCard.type === 'personaggi_speciali')
        ).length;

        // NEW: Track elimination count for SOROS activation
        let sorosActivated = false;
        if ((card.type === 'personaggi' || card.type === 'personaggi_speciali') && attacker) {
          // Increment elimination count for the attacker
          const attackerPlayer = game.players[attacker];
          if (attackerPlayer) {
            if (!attackerPlayer.eliminationCount) {
              attackerPlayer.eliminationCount = 0;
            }
            
            attackerPlayer.eliminationCount++;
            console.log(`🗡️ ${attacker} has eliminated ${attackerPlayer.eliminationCount} personaggi`);
            
            // Track elimination for missions/achievements (fire-and-forget)
            this.trackPlayerEvent(gameId, attacker, 'elimination', {}).catch(() => {});
            
            // SOROS activation at 6 eliminations
            if (attackerPlayer.eliminationCount === 6 && !sorosActivated) {
              sorosActivated = true;
              console.log(`🎭 SOROS ACTIVATED! ${attacker} has eliminated 6 personaggi!`);
              
              // Find SOROS in personaggi_speciali deck
              const sorosIndex = game.decks.personaggi_speciali.findIndex((c: Card) => 
                c.frontImage && c.frontImage.includes('soros')
              );
              
              if (sorosIndex !== -1) {
                const soros = game.decks.personaggi_speciali.splice(sorosIndex, 1)[0];
                soros.owner = attacker;
                game.field.push(soros);
                console.log(`🎭 SOROS automatically played on field for ${attacker}!`);
                
                // Return flag indicating SOROS was activated (routes.ts will emit to all players)
                return { success: true, graveyardCount, cardImage: card.frontImage, cardType: card.type, eliminationCheck: false, sorosActivated: true, sorosImage: soros.frontImage, sorosActivator: attacker, detachedParasites };
              }
            }
          }
        }

        // Check if player should be eliminated (only if it's a personaggi card)
        let eliminationCheck = false;
        if ((card.type === 'personaggi' || card.type === 'personaggi_speciali') && game.characterLimit !== 'unlimited') {
          const baseLimit = parseInt(game.characterLimit);
          const playerModifier = game.playerDeathModifiers.get(playerName) || 0;
          const effectiveLimit = baseLimit + playerModifier;
          if (graveyardCount >= effectiveLimit && !game.eliminatedPlayers.has(playerName)) {
            eliminationCheck = true;
          }
        }

        return { success: true, graveyardCount, cardImage: card.frontImage, cardType: card.type, eliminationCheck, sorosActivated: false, detachedParasites };
      }
    }
    
    return { success: false, detachedParasites };
  }

  // CIMICE DEATH EFFECT: When CIMICE dies, removes 500 PTI from ALL other field characters
  async processCimiceDeathEffect(gameId: string, cimiceCardId: string, io: any): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;
    
    console.log(`🪲 CIMICE died! Removing 500 PTI from all other field characters (excluding ${cimiceCardId})`);
    
    const affectedCards: Array<{ id: string; name: string; owner: string; oldPTI: number; newPTI: number }> = [];
    
    // Get all field characters EXCEPT CIMICE (explicit filter to be safe)
    const fieldCharacters = game.field.filter((c: Card) => 
      c.id !== cimiceCardId && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
    );
    
    for (const card of fieldCharacters) {
      // Extra safety: skip any card that is CIMICE by name or has CIMICE power (shouldn't damage itself)
      const cardName = this.getCardNameFromUrl(card.frontImage || '').toUpperCase();
      if (cardName.includes('CIMICE') || card.copiedPower === 'CIMICE') {
        console.log(`🪲 Skipping CIMICE power card (${card.id}) - should not damage itself`);
        continue;
      }
      
      const cardPTI = this.extractPTIFromNote(card.text || '');
      const cardStars = this.extractStarsFromNote(card.text || '');
      const newPTI = Math.max(0, cardPTI - 500);
      // Preserve the "Potere di" notation if present
      const powerMatch = card.text?.match(/\|\s*Potere di\s+\w+/i);
      card.text = `PTI: ${newPTI} | Stelle: ${cardStars}${powerMatch ? ` ${powerMatch[0]}` : ''}`;
      
      affectedCards.push({
        id: card.id,
        name: this.getCardNameFromUrl(card.frontImage || ''),
        owner: card.owner,
        oldPTI: cardPTI,
        newPTI
      });
      
      console.log(`🪲 CIMICE death effect: ${this.getCardNameFromUrl(card.frontImage || '')} PTI ${cardPTI} → ${newPTI}`);
    }
    
    // Emit CIMICE death effect event for client animation
    io.to(gameId).emit('cimice-effect', {
      type: 'death',
      cimiceCardId,
      damagePerCard: 500,
      affectedCards,
      message: 'CIMICE è morta! Tutti gli altri personaggi perdono 500 PTI!'
    });
    
    io.to(gameId).emit('chat-message', {
      id: `${Date.now()}-cimice-death-effect`,
      playerName: 'SISTEMA',
      message: `🪲💀 CIMICE è morta! Tutti i personaggi in campo perdono 500 PTI!`,
      timestamp: Date.now()
    });
    
    // Check if any cards died from CIMICE death effect (cascade deaths)
    for (const affected of affectedCards) {
      if (affected.newPTI <= 0) {
        console.log(`💀 ${affected.name} killed by CIMICE death effect!`);
        this.moveToGraveyard(gameId, affected.id, affected.owner, 'CIMICE');
      }
    }
    
    // Broadcast updated game state after CIMICE death effect
    const updatedState = this.getSanitizedGameState(gameId);
    io.to(gameId).emit('game-state-update', updatedState);
  }

  // Wrapper for sendCardToGraveyard used by parasitic card system
  async sendCardToGraveyard(gameId: string, cardId: string, killerPlayer: string, reason: string): Promise<{ success: boolean }> {
    const game = this.games.get(gameId);
    if (!game) return { success: false };
    
    // Find the card to get its owner
    const card = game.field.find(c => c.id === cardId);
    if (!card) return { success: false };
    
    const result = this.moveToGraveyard(gameId, cardId, card.owner, killerPlayer);
    
    if (result.success) {
      console.log(`📦 Card ${cardId} sent to graveyard (reason: ${reason})`);
    }
    
    return { success: result.success };
  }


  async swapPersonaggiCards(gameId: string, player1: string, card1Id: string, player2: string, card2Id: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game || !game.players[player1] || !game.players[player2]) return;

    // Helper function to find and remove card from field or hand, tracking location
    const findAndRemoveCard = (cardId: string, owner: string): { card: Card; wasInField: boolean } | undefined => {
      // Check field first
      let cardIndex = game.field.findIndex(c => c.id === cardId && c.owner === owner);
      if (cardIndex !== -1) {
        const card = game.field.splice(cardIndex, 1)[0];
        return { card, wasInField: true };
      }
      
      // Check player's hand
      cardIndex = game.players[owner].hand.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        const card = game.players[owner].hand.splice(cardIndex, 1)[0];
        return { card, wasInField: false };
      }
      
      return undefined;
    };

    // Find both cards and track their original locations
    const card1Result = findAndRemoveCard(card1Id, player1);
    const card2Result = findAndRemoveCard(card2Id, player2);

    if (card1Result && card2Result && 
        (card1Result.card.type === 'personaggi' || card1Result.card.type === 'personaggi_speciali') && 
        (card2Result.card.type === 'personaggi' || card2Result.card.type === 'personaggi_speciali')) {
      
      const card1 = card1Result.card;
      const card2 = card2Result.card;
      
      // Swap ownership
      card1.owner = player2;
      card2.owner = player1;

      // Place cards in their original locations but with new owners
      if (card1Result.wasInField) {
        // Card1 was in field, so put it back in field with new owner (player2)
        game.field.push(card1);
      } else {
        // Card1 was in hand, so put it in new owner's hand (player2)
        game.players[player2].hand.push(card1);
      }

      if (card2Result.wasInField) {
        // Card2 was in field, so put it back in field with new owner (player1)
        game.field.push(card2);
      } else {
        // Card2 was in hand, so put it in new owner's hand (player1)
        game.players[player1].hand.push(card2);
      }

      // Record swap event
      await this.recordEvent(gameId, 'swap-personaggi-cards', {
        player1,
        card1Id: card1.id,
        card1Name: this.getCardNameFromUrl(card1.frontImage),
        card1Location: card1Result.wasInField ? 'field' : 'hand',
        player2,
        card2Id: card2.id,
        card2Name: this.getCardNameFromUrl(card2.frontImage),
        card2Location: card2Result.wasInField ? 'field' : 'hand'
      }, player1);
    } else {
      // If cards couldn't be found or aren't PERSONAGGI, put them back
      if (card1Result) {
        const card = card1Result.card;
        if (card1Result.wasInField) {
          game.field.push(card);
        } else {
          game.players[player1].hand.push(card);
        }
      }
      if (card2Result) {
        const card = card2Result.card;
        if (card2Result.wasInField) {
          game.field.push(card);
        } else {
          game.players[player2].hand.push(card);
        }
      }
    }
  }

  // Generic swap method for all card types (PERSONAGGI, MOSSE, BONUS, PERSONAGGI_SPECIALI)
  async swapCardsBetweenPlayers(gameId: string, player1: string, card1Id: string, player2: string, card2Id: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game || !game.players[player1] || !game.players[player2]) return;

    // Helper function to find and remove card from field or hand, tracking location
    const findAndRemoveCard = (cardId: string, owner: string): { card: Card; wasInField: boolean } | undefined => {
      // Check field first
      let cardIndex = game.field.findIndex(c => c.id === cardId && c.owner === owner);
      if (cardIndex !== -1) {
        const card = game.field.splice(cardIndex, 1)[0];
        return { card, wasInField: true };
      }
      
      // Check player's hand
      cardIndex = game.players[owner].hand.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        const card = game.players[owner].hand.splice(cardIndex, 1)[0];
        return { card, wasInField: false };
      }
      
      return undefined;
    };

    // Find both cards and track their original locations
    const card1Result = findAndRemoveCard(card1Id, player1);
    const card2Result = findAndRemoveCard(card2Id, player2);

    // Check that both cards exist (can be any type - universal swap)
    if (card1Result && card2Result) {
      
      const card1 = card1Result.card;
      const card2 = card2Result.card;
      
      // Swap ownership
      card1.owner = player2;
      card2.owner = player1;

      // Place cards in their original locations but with new owners
      if (card1Result.wasInField) {
        // Card1 was in field, so put it back in field with new owner (player2)
        game.field.push(card1);
      } else {
        // Card1 was in hand, so put it in new owner's hand (player2)
        game.players[player2].hand.push(card1);
      }

      if (card2Result.wasInField) {
        // Card2 was in field, so put it back in field with new owner (player1)
        game.field.push(card2);
      } else {
        // Card2 was in hand, so put it in new owner's hand (player1)
        game.players[player1].hand.push(card2);
      }

      // Record swap event
      await this.recordEvent(gameId, 'swap-cards', {
        player1,
        card1Id: card1.id,
        card1Name: this.getCardNameFromUrl(card1.frontImage),
        card1Type: card1.type,
        card1Location: card1Result.wasInField ? 'field' : 'hand',
        player2,
        card2Id: card2.id,
        card2Name: this.getCardNameFromUrl(card2.frontImage),
        card2Type: card2.type,
        card2Location: card2Result.wasInField ? 'field' : 'hand'
      }, player1);
    } else {
      // If cards couldn't be found or aren't of the same type, put them back
      if (card1Result) {
        const card = card1Result.card;
        if (card1Result.wasInField) {
          game.field.push(card);
        } else {
          game.players[player1].hand.push(card);
        }
      }
      if (card2Result) {
        const card = card2Result.card;
        if (card2Result.wasInField) {
          game.field.push(card);
        } else {
          game.players[player2].hand.push(card);
        }
      }
    }
  }

  async addCPUPlayer(gameId: string): Promise<string> {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    // Generate CPU player name
    const cpuNames = ['CPU-Alessio', 'CPU-Marco', 'CPU-Giulia', 'CPU-Francesco', 'CPU-Sara'];
    const existingPlayers = Object.keys(game.players);
    const availableNames = cpuNames.filter(name => !existingPlayers.includes(name));
    
    if (availableNames.length === 0) {
      throw new Error('No more CPU slots available');
    }

    const cpuName = availableNames[0];
    const fakeSocketId = `cpu-${Date.now()}-${Math.random()}`;
    
    await this.addPlayer(gameId, cpuName, fakeSocketId, true);
    
    // If there's already a turn order, add CPU to it
    if (game.turnOrder && game.turnOrder.length > 0) {
      game.turnOrder.push(cpuName);
    }
    
    return cpuName;
  }

  async processCPUTurn(gameId: string, cpuPlayerName: string, socketEmitter?: any): Promise<any> {
    const game = this.games.get(gameId);
    if (!game) return null;

    const cpuPlayer = game.players[cpuPlayerName];
    if (!cpuPlayer?.isCPU || !cpuPlayer.cpuInstance) return null;

    try {
      // Set socket emitter for chat functionality
      if (socketEmitter) {
        cpuPlayer.cpuInstance.setSocketEmitter(socketEmitter);
      }
      
      const action = await cpuPlayer.cpuInstance.takeTurn(game);
      return action;
    } catch (error) {
      console.error(`Error processing CPU turn for ${cpuPlayerName}:`, error);
      return null;
    }
  }

  // Handle human response to CPU question
  processCPUResponse(gameId: string, humanMessage: string, humanPlayerName: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    // Find if any CPU is waiting for a response
    for (const player of Object.values(game.players)) {
      if (player.isCPU && player.cpuInstance) {
        const processed = player.cpuInstance.processHumanResponse(humanMessage);
        if (processed) {
          return true;
        }
      }
    }
    return false;
  }

  // Get CPU waiting for response
  getCPUWaitingForResponse(gameId: string): string | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    for (const [playerName, player] of Object.entries(game.players)) {
      if (player.isCPU && player.cpuInstance && player.cpuInstance.isWaitingForResponse) {
        return playerName;
      }
    }
    return null;
  }

  // Handle human chat messages and let CPU players respond
  async processCPUChatResponses(gameId: string, humanMessage: string, humanPlayerName: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    const lowerMessage = humanMessage.toLowerCase();
    let commandHandledByAnyCPU = false;
    
    // Find which CPU is explicitly mentioned (if any) and track default
    let mentionedCPU: string | null = null;
    let defaultCPU: string | null = null;
    
    for (const [cpuPlayerName, player] of Object.entries(game.players)) {
      if (player.isCPU && player.cpuInstance && cpuPlayerName !== humanPlayerName) {
        // Track first available CPU as default
        if (!defaultCPU) {
          defaultCPU = cpuPlayerName;
        }
        // Check if this specific CPU is mentioned by name
        if (lowerMessage.includes(cpuPlayerName.toLowerCase())) {
          mentionedCPU = cpuPlayerName;
        }
      }
    }
    
    // Determine target CPU: specific mention > generic "cpu" mention > default (for all messages)
    const hasGenericCPUMention = lowerMessage.includes('cpu') && !mentionedCPU;
    // Always use defaultCPU for handlePlayerMessage to ensure special commands work without mentions
    const targetCPU = mentionedCPU || defaultCPU;

    let generalChatHandled = false;
    
    // Let all CPU players in this game potentially respond to the human message
    for (const [cpuPlayerName, player] of Object.entries(game.players)) {
      if (player.isCPU && player.cpuInstance && cpuPlayerName !== humanPlayerName) {
        try {
          const isTargetCPU = cpuPlayerName === targetCPU;
          // More precise mention detection: specific name OR generic "cpu" when this IS the target
          const isSpecificallyMentioned = lowerMessage.includes(cpuPlayerName.toLowerCase());
          const isGenericMention = hasGenericCPUMention && isTargetCPU;
          const shouldRespond = isSpecificallyMentioned || isGenericMention;
          
          // The target CPU (mentioned or default) tries handlePlayerMessage for special commands
          if (isTargetCPU && !commandHandledByAnyCPU) {
            const gameState = this.getSanitizedGameState(gameId);
            const handledCommand = await player.cpuInstance.handlePlayerMessage(humanMessage, humanPlayerName, gameState);
            if (handledCommand) {
              console.log(`CPU ${cpuPlayerName} handled special command from ${humanPlayerName}`);
              commandHandledByAnyCPU = true;
              continue; // This CPU handled it, skip general chat
            }
          }
          
          // Fall back to general chat responses only if:
          // 1. No special command was handled
          // 2. This CPU is specifically mentioned (by name or generic "cpu" for target)
          // 3. No other CPU has already responded via general chat
          if (!commandHandledByAnyCPU && shouldRespond && !generalChatHandled) {
            player.cpuInstance.processHumanChat(humanMessage, humanPlayerName);
            generalChatHandled = true; // Only one CPU responds via general chat
          }
        } catch (error) {
          console.error(`Error in CPU ${cpuPlayerName} chat processing:`, error);
        }
      }
    }
  }

  getCPUPlayers(gameId: string): string[] {
    const game = this.games.get(gameId);
    if (!game) return [];

    return Object.values(game.players)
      .filter(player => player.isCPU)
      .map(player => player.name);
  }

  // POTERI system - Copy special power from another character
  copyPowerToCard(gameId: string, cardId: string, playerName: string, powerSource: string): { success: boolean; cardName?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false };
    
    // Find the card on field
    const card = game.field.find(c => c.id === cardId);
    if (!card) {
      console.log(`✨ POTERI: Card ${cardId} not found on field`);
      return { success: false };
    }
    
    // Verify ownership
    if (card.owner !== playerName) {
      console.log(`✨ POTERI: Card ${cardId} does not belong to ${playerName}`);
      return { success: false };
    }
    
    // Set the copied power
    card.copiedPower = powerSource.toUpperCase();
    
    // Update the card text to show the copied power
    const currentText = card.text || '';
    const cardName = this.getCardNameFromUrl(card.frontImage || '');
    
    // Remove any existing "Potere di" notation
    const cleanedText = currentText.replace(/\s*\|\s*Potere di\s+\w+/gi, '');
    
    // Add the new power notation
    card.text = `${cleanedText} | Potere di ${powerSource}`;
    
    console.log(`✨ POTERI: ${cardName} now has the power of ${powerSource}`);
    console.log(`✨ POTERI: Updated text: ${card.text}`);
    
    return { success: true, cardName };
  }

  updateCardText(gameId: string, cardId: string, text: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    // Find card in any location and update text
    const findAndUpdateCard = (cards: Card[]) => {
      const card = cards.find(c => c.id === cardId);
      if (card) {
        card.text = text;
        
        // If this card is part of a fusion, update all fused cards
        if (card.isFused && card.fusionLeader) {
          // Find all cards in the fusion group
          const fusedCards = cards.filter(c => 
            c.isFused && c.fusionLeader === card.fusionLeader
          );
          
          // Update text for all fused cards
          fusedCards.forEach(fusedCard => {
            if (fusedCard.id !== cardId) {
              fusedCard.text = text;
            }
          });
        }
        
        return true;
      }
      return false;
    };

    // Check field
    if (findAndUpdateCard(game.field)) return;

    // Check graveyard
    if (findAndUpdateCard(game.graveyard)) return;

    // Check all players' hands
    for (const player of Object.values(game.players)) {
      if (findAndUpdateCard(player.hand)) return;
    }
  }

  // Transfer request management for human-to-human transfers
  createTransferRequest(gameId: string, cardId: string, fromPlayer: string, toPlayer: string): string {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    // Check if both players are human (not CPU)
    const fromPlayerData = game.players[fromPlayer];
    const toPlayerData = game.players[toPlayer];
    
    if (!fromPlayerData || !toPlayerData) {
      throw new Error('Player not found');
    }

    if (fromPlayerData.isCPU || toPlayerData.isCPU) {
      throw new Error('Transfer requests are only for human-to-human transfers');
    }

    // Check if card exists in fromPlayer's hand
    const card = fromPlayerData.hand.find(c => c.id === cardId);
    if (!card) {
      throw new Error('Card not found in player hand');
    }

    // Create transfer request
    const requestId = `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const transferRequest: TransferRequest = {
      id: requestId,
      cardId,
      fromPlayer,
      toPlayer,
      timestamp: new Date(),
      message: `${fromPlayer} vuole trasferire una carta ${card.type.toUpperCase()} a ${toPlayer}`
    };

    game.pendingTransferRequests.push(transferRequest);
    return requestId;
  }

  acceptTransferRequest(gameId: string, requestId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const requestIndex = game.pendingTransferRequests.findIndex(req => req.id === requestId);
    if (requestIndex === -1) {
      throw new Error('Transfer request not found');
    }

    const request = game.pendingTransferRequests[requestIndex];
    
    // Check if card still exists in fromPlayer's hand
    const fromPlayerData = game.players[request.fromPlayer];
    const toPlayerData = game.players[request.toPlayer];
    
    if (!fromPlayerData || !toPlayerData) {
      // Remove invalid request
      game.pendingTransferRequests.splice(requestIndex, 1);
      throw new Error('Player not found');
    }

    const cardIndex = fromPlayerData.hand.findIndex(c => c.id === request.cardId);
    if (cardIndex === -1) {
      // Remove invalid request
      game.pendingTransferRequests.splice(requestIndex, 1);
      throw new Error('Card no longer available');
    }

    // Execute the transfer
    const card = fromPlayerData.hand.splice(cardIndex, 1)[0];
    toPlayerData.hand.push(card);
    
    // Remove the request
    game.pendingTransferRequests.splice(requestIndex, 1);
    
    return true;
  }

  declineTransferRequest(gameId: string, requestId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const requestIndex = game.pendingTransferRequests.findIndex(req => req.id === requestId);
    if (requestIndex === -1) {
      throw new Error('Transfer request not found');
    }

    // Simply remove the request
    game.pendingTransferRequests.splice(requestIndex, 1);
    return true;
  }

  getPendingTransferRequests(gameId: string, playerName: string): TransferRequest[] {
    const game = this.games.get(gameId);
    if (!game) return [];

    // Return requests where this player is the recipient
    return game.pendingTransferRequests.filter(req => req.toPlayer === playerName);
  }

  private shuffleGameDecks(game: GameState): void {
    // Shuffle each deck type
    for (const deckType of Object.keys(game.decks) as Array<keyof GameState['decks']>) {
      const deck = game.decks[deckType];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
  }

  resetGame(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    // Clear all player hands
    for (const player of Object.values(game.players)) {
      player.hand = [];
    }

    // Clear field and graveyard
    game.field = [];
    game.graveyard = [];

    // Recreate all decks with full cards
    game.decks = {
      personaggi: this.createInitialDeck('personaggi'),
      mosse: this.createInitialDeck('mosse'),
      bonus: this.createInitialDeck('bonus'),
      personaggi_speciali: this.createInitialDeck('personaggi_speciali')
    };

    // Reset scenario cards to inactive
    game.scenarioCardsActive = false;

    // Auto-shuffle all decks when resetting the game
    this.shuffleGameDecks(game);
  }

  private createScenarioCards(): Card[] {
    const backImage = DECK_BACK_IMAGES.bonus;
    
    return SCENARIO_CARDS.map((frontImage, index) => ({
      id: `scenario-${index}`,
      type: 'bonus',
      frontImage,
      backImage,
      owner: '',
      text: ''
    }));
  }

  async addCustomCards(
    gameId: string, 
    deckType: string, 
    cards: Array<{ name: string, data: string, pti: number | null, stars: number | null, effect?: string | null, audioUrl?: string | null, isPermanent: boolean }>,
    playerName: string
  ): Promise<{ success: boolean }> {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    try {
      const isCharacterDeck = deckType === 'personaggi' || deckType === 'personaggi_speciali';
      
      for (let i = 0; i < cards.length; i++) {
        const cardData = cards[i];
        
        // For character cards, text only contains PTI and stars (not the name)
        let cardText = '';
        if (isCharacterDeck) {
          const ptiText = cardData.pti != null ? `PTI: ${cardData.pti}` : '';
          const starsText = cardData.stars != null ? `Stelle: ${cardData.stars}` : '';
          cardText = [ptiText, starsText].filter(Boolean).join(' | ');
        }
        
        const card: Card = {
          id: `custom-${deckType}-${Date.now()}-${i}`,
          type: deckType as 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali',
          frontImage: cardData.data,
          backImage: this.getBackImageForDeck(deckType),
          owner: '',
          name: cardData.name || undefined, // Store the custom name separately
          text: cardText,
          pti: isCharacterDeck ? cardData.pti : null,
          stars: isCharacterDeck ? cardData.stars : null,
          effect: cardData.effect || undefined,
          audioUrl: cardData.audioUrl || undefined
        };
        
        if (deckType === 'personaggi') {
          game.decks.personaggi.push(card);
        } else if (deckType === 'mosse') {
          game.decks.mosse.push(card);
        } else if (deckType === 'bonus') {
          game.decks.bonus.push(card);
        } else if (deckType === 'personaggi_speciali') {
          game.decks.personaggi_speciali.push(card);
        }

        if (cardData.isPermanent) {
          try {
            const customCardRecord: InsertCustomCard = {
              name: cardData.name,
              deckType: deckType,
              imageData: cardData.data,
              pti: cardData.pti,
              stars: cardData.stars,
              effect: cardData.effect || null,
              audioUrl: cardData.audioUrl || null,
              createdBy: playerName
            };
            await db.insert(customCards).values(customCardRecord);
            console.log(`Permanent card "${cardData.name}" saved to database with audioUrl: ${cardData.audioUrl}`);
          } catch (dbError) {
            console.error('Error saving permanent card to database:', dbError);
          }
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error adding custom cards:', error);
      return { success: false };
    }
  }

  private getBackImageForDeck(deckType: string): string {
    const backImages = {
      'personaggi': "https://i.imgur.com/r1rfUAB.png",
      'mosse': "https://i.imgur.com/6MUXCZO.png", 
      'bonus': "https://i.imgur.com/lEROr3r.png",
      'personaggi_speciali': "https://i.imgur.com/ipVd57A.png"
    };
    return backImages[deckType as keyof typeof backImages] || backImages.personaggi;
  }

  toggleScenarioCards(gameId: string, active: boolean): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    game.scenarioCardsActive = active;

    if (active) {
      // Add scenario cards to bonus deck
      const scenarioCards = this.createScenarioCards();
      game.decks.bonus.push(...scenarioCards);
      // Shuffle the bonus deck after adding scenario cards
      this.shuffleDeck(gameId, 'bonus');
    } else {
      // Remove scenario cards from bonus deck
      game.decks.bonus = game.decks.bonus.filter(card => !card.id.startsWith('scenario-'));
    }

    return true;
  }

  removeCardToGraveyard(gameId: string, deckType: string, cardId: string, playerName: string, section: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    try {
      // Find and remove card from the specified deck
      let cardToRemove = null;
      let deckArray = null;

      if (deckType === 'personaggi') {
        deckArray = game.decks.personaggi;
      } else if (deckType === 'mosse') {
        deckArray = game.decks.mosse;
      } else if (deckType === 'bonus') {
        deckArray = game.decks.bonus;
      } else if (deckType === 'personaggi_speciali') {
        deckArray = game.decks.personaggi_speciali;
      }

      if (!deckArray) return false;

      const cardIndex = deckArray.findIndex(card => card.id === cardId);
      if (cardIndex === -1) return false;

      cardToRemove = deckArray.splice(cardIndex, 1)[0];

      // Add section property to the card to distinguish it
      cardToRemove.eliminatedBy = playerName;
      cardToRemove.section = section;

      // Add to graveyard
      game.graveyard.push(cardToRemove);

      return true;
    } catch (error) {
      console.error('Error removing card to graveyard:', error);
      return false;
    }
  }

  async eliminatePersonaggi(gameId: string, cardId: string, playerName: string): Promise<{ success: boolean, cardImage?: string, cardType?: string, eliminationCheck?: boolean, hasCimicePower?: boolean }> {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    try {
      // Find the card in the field
      const cardIndex = game.field.findIndex(card => card.id === cardId && (card.type === 'personaggi' || card.type === 'personaggi_speciali'));
      if (cardIndex === -1) return { success: false };

      const card = game.field[cardIndex];
      
      // Check if card has CIMICE power (native or copied) before removing
      const cardName = this.getCardNameFromUrl(card.frontImage || '').toUpperCase();
      const hasCimicePower = cardName.includes('CIMICE') || card.copiedPower === 'CIMICE';
      
      // Now remove the card
      game.field.splice(cardIndex, 1);
      
      // Mark as eliminated and add to graveyard
      card.eliminatedBy = playerName;
      game.graveyard.push(card);
      
      // Count PERSONAGGI cards in graveyard for this player (only personaggi count for elimination)
      const graveyardCount = game.graveyard.filter(
        graveyardCard => graveyardCard.eliminatedBy === playerName && graveyardCard.type === 'personaggi'
      ).length;

      // Check if player should be eliminated (only if it's a personaggi card)
      let eliminationCheck = false;
      if ((card.type === 'personaggi' || card.type === 'personaggi_speciali') && game.characterLimit !== 'unlimited') {
        const baseLimit = parseInt(game.characterLimit);
        const playerModifier = game.playerDeathModifiers.get(playerName) || 0;
        const effectiveLimit = baseLimit + playerModifier;
        if (graveyardCount >= effectiveLimit && !game.eliminatedPlayers.has(playerName)) {
          eliminationCheck = true;
        }
      }
      
      // Record elimination event
      await this.recordEvent(gameId, 'eliminate-personaggi', {
        cardId: card.id,
        cardType: card.type,
        frontImage: card.frontImage,
        eliminatedBy: playerName
      }, playerName);

      return { success: true, cardImage: card.frontImage, cardType: card.type, eliminationCheck, hasCimicePower };
    } catch (error) {
      console.error('Error eliminating personaggi card:', error);
      return { success: false };
    }
  }

  async placeSuperDiceCard(gameId: string, playerName: string, cardData: { name: string, image: string, type: string }): Promise<{ success: boolean }> {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    try {
      // Create a new card object for the super dice card
      const newCard = {
        id: `super-dice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        frontImage: cardData.image,
        backImage: this.getBackImageForType(cardData.type),
        owner: playerName,
        type: cardData.type as 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali',
        faceDown: false,
        text: ''
      };

      // Add the card directly to the field
      game.field.push(newCard);

      // Record the super dice placement event
      await this.recordEvent(gameId, 'place-super-dice-card', {
        cardId: newCard.id,
        cardName: cardData.name,
        cardType: cardData.type,
        frontImage: cardData.image
      }, playerName);

      return { success: true };
    } catch (error) {
      console.error('Error placing super dice card:', error);
      return { success: false };
    }
  }

  private getBackImageForType(type: string): string {
    const backImages = {
      'personaggi': 'https://i.imgur.com/r1rfUAB.png',
      'mosse': 'https://i.imgur.com/6MUXCZO.png',
      'bonus': 'https://i.imgur.com/lEROr3r.png',
      'personaggi_speciali': 'https://i.imgur.com/ipVd57A.png'
    };
    return backImages[type as keyof typeof backImages] || backImages.bonus;
  }

  moveCardPosition(gameId: string, cardId: string, direction: 'left' | 'right'): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const cardIndex = game.field.findIndex(card => card.id === cardId);
    if (cardIndex === -1) return false;

    const card = game.field[cardIndex];
    const playerCards = game.field.filter(c => c.owner === card.owner);
    const playerCardIndex = playerCards.findIndex(c => c.id === cardId);
    
    if (playerCardIndex === -1) return false;

    // Check if move is valid
    if (direction === 'left' && playerCardIndex === 0) return false;
    if (direction === 'right' && playerCardIndex === playerCards.length - 1) return false;

    // Find the target card to swap with
    const targetIndex = direction === 'left' ? playerCardIndex - 1 : playerCardIndex + 1;
    const targetCard = playerCards[targetIndex];
    
    // Find both cards in the main field array
    const sourceFieldIndex = game.field.findIndex(c => c.id === cardId);
    const targetFieldIndex = game.field.findIndex(c => c.id === targetCard.id);
    
    // Swap positions
    [game.field[sourceFieldIndex], game.field[targetFieldIndex]] = 
    [game.field[targetFieldIndex], game.field[sourceFieldIndex]];

    return true;
  }

  startGame(gameId: string, characterLimit: string = 'unlimited'): string[] | null {
    const gameState = this.games.get(gameId);
    if (!gameState) return null;

    // Set character limit for the game
    gameState.characterLimit = characterLimit;
    gameState.eliminatedPlayers = new Set<string>();

    // Get all player names and randomize order
    const playerNames = Object.keys(gameState.players);
    if (playerNames.length < 2) return null; // Need at least 2 players

    // Shuffle player order randomly
    const playerOrder = [...playerNames];
    for (let i = playerOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerOrder[i], playerOrder[j]] = [playerOrder[j], playerOrder[i]];
    }

    // Set the turn order and reset current turn index
    gameState.turnOrder = playerOrder;
    gameState.currentTurnIndex = 0;

    return playerOrder;
  }

  endTurn(gameId: string, playerName: string): string | null {
    // CRITICAL FIX: Reset CPU turn state when turn ends
    const game = this.getGameState(gameId);
    if (game && game.players[playerName]?.cpuInstance) {
      game.players[playerName].cpuInstance.resetTurnState();
      console.log(`🔧 CPU ${playerName}: Turn state reset on endTurn()`);
    }
    const gameState = this.games.get(gameId);
    if (!gameState || gameState.turnOrder.length === 0) return null;

    // Verify it's the current player's turn
    const currentPlayer = gameState.turnOrder[gameState.currentTurnIndex];
    if (currentPlayer !== playerName) return null;

    // Check CPU turn requirements: must have played an action this turn
    const player = gameState.players[playerName];
    if (player && player.isCPU && !this.hasPlayedActionThisTurn(gameId, playerName)) {
      console.log(`❌ CPU ${playerName} cannot end turn without playing an action`);
      return null; // CPU cannot end turn without executing an action
    }

    // Reset usedCardsThisTurn and usedMosseOnBarrieraThisTurn for the current player when their turn ends
    if (gameState.players[playerName]) {
      gameState.players[playerName].usedCardsThisTurn = [];
      gameState.players[playerName].usedMosseOnBarrieraThisTurn = false;
    }

    // Check if there's an active duel
    if (gameState.activeDuel && gameState.activeDuel.active) {
      const duel = gameState.activeDuel;
      console.log(`⚔️ DUELLO: Ending turn during duel (current: ${playerName})`);
      
      // In duel, alternate between the two duelists only
      if (duel.consecutiveTurns && duel.consecutiveTurns > 0) {
        // Player has consecutive turns
        duel.consecutiveTurns--;
        console.log(`⚔️ DUELLO: ${playerName} has ${duel.consecutiveTurns} consecutive turns remaining`);
        return playerName; // Same player's turn continues
      }
      
      // Switch to the other duelist
      const nextPlayer = playerName === duel.player1 ? duel.player2 : duel.player1;
      duel.currentTurn = nextPlayer;
      
      // Update game turn order to match duel turn
      const nextPlayerIndex = gameState.turnOrder.indexOf(nextPlayer);
      if (nextPlayerIndex !== -1) {
        gameState.currentTurnIndex = nextPlayerIndex;
      }
      
      // Initialize usedCardsThisTurn and reset usedMosseOnBarrieraThisTurn for the next player
      if (gameState.players[nextPlayer]) {
        if (!gameState.players[nextPlayer].usedCardsThisTurn) {
          gameState.players[nextPlayer].usedCardsThisTurn = [];
        }
        gameState.players[nextPlayer].usedMosseOnBarrieraThisTurn = false;
      }
      
      console.log(`⚔️ DUELLO: Turn switched to ${nextPlayer}`);
      return nextPlayer;
    }

    // No active duel - use normal turn order logic
    // Move to next non-eliminated player
    const startIndex = gameState.currentTurnIndex;
    let attempts = 0;
    do {
      gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.turnOrder.length;
      const nextPlayer = gameState.turnOrder[gameState.currentTurnIndex];
      
      // Check if player is eliminated
      if (!gameState.eliminatedPlayers.has(nextPlayer)) {
        // Increment turn counters for cards on field owned by the NEXT player
        gameState.field.forEach(card => {
          if ((card.type === 'bonus' || card.type === 'mosse') && card.placedBy === nextPlayer) {
            card.turnCounter = (card.turnCounter || 0) + 1;
            
            // Update the card text to include turn count
            // Remove previous turn count if it exists (e.g., " | 1 TURNO", " | 2 TURNI", etc.)
            let cleanText = (card.text || '').replace(/\s\|\s\d+\sTURN[IO]/gi, '').trim();
            // Handle the case where the text IS just the turn count
            if (/^\d+\sTURN[IO]$/i.test(cleanText)) {
              cleanText = '';
            }
            const suffix = card.turnCounter === 1 ? '1 TURNO' : `${card.turnCounter} TURNI`;
            card.text = cleanText ? `${cleanText} | ${suffix}` : suffix;
          }
        });
        
        // NOTE: PARASITIC CARD effects (PARASSITA drain, SAIBAIM explosion) are processed
        // by processParasiticTurnEffects() which is called from routes.ts after endTurn()

        // Found a non-eliminated player
        // Initialize usedCardsThisTurn and reset usedMosseOnBarrieraThisTurn for the next player
        if (gameState.players[nextPlayer]) {
          if (!gameState.players[nextPlayer].usedCardsThisTurn) {
            gameState.players[nextPlayer].usedCardsThisTurn = [];
          }
          gameState.players[nextPlayer].usedMosseOnBarrieraThisTurn = false;
        }
        return nextPlayer;
      }
      
      attempts++;
    } while (gameState.currentTurnIndex !== startIndex && attempts < gameState.turnOrder.length);

    // All players eliminated or no valid next player
    console.log(`⚠️ No non-eliminated players found in turn order`);
    return null;
  }

  // Force end turn - bypasses all turn validation checks (for admin/universal turn control)
  forceEndTurn(gameId: string): string | null {
    const gameState = this.games.get(gameId);
    if (!gameState || gameState.turnOrder.length === 0) return null;

    const currentPlayerName = gameState.turnOrder[gameState.currentTurnIndex];
    if (!currentPlayerName) return null;

    console.log(`🔨 Force ending turn for ${currentPlayerName} (bypassing validation)`);

    // Reset usedCardsThisTurn and usedMosseOnBarrieraThisTurn for the current player when their turn ends
    if (gameState.players[currentPlayerName]) {
      gameState.players[currentPlayerName].usedCardsThisTurn = [];
      gameState.players[currentPlayerName].usedMosseOnBarrieraThisTurn = false;
    }

    // Check if there's an active duel
    if (gameState.activeDuel && gameState.activeDuel.active) {
      const duel = gameState.activeDuel;
      console.log(`⚔️ DUELLO: Force ending turn during duel (current: ${currentPlayerName})`);
      
      // In duel, alternate between the two duelists only
      if (duel.consecutiveTurns && duel.consecutiveTurns > 0) {
        // Player has consecutive turns
        duel.consecutiveTurns--;
        console.log(`⚔️ DUELLO: ${currentPlayerName} has ${duel.consecutiveTurns} consecutive turns remaining`);
        return currentPlayerName; // Same player's turn continues
      }
      
      // Switch to the other duelist
      const nextPlayer = currentPlayerName === duel.player1 ? duel.player2 : duel.player1;
      duel.currentTurn = nextPlayer;
      
      // Update game turn order to match duel turn
      const nextPlayerIndex = gameState.turnOrder.indexOf(nextPlayer);
      if (nextPlayerIndex !== -1) {
        gameState.currentTurnIndex = nextPlayerIndex;
      }
      
      // Initialize usedCardsThisTurn and reset usedMosseOnBarrieraThisTurn for the next player
      if (gameState.players[nextPlayer]) {
        if (!gameState.players[nextPlayer].usedCardsThisTurn) {
          gameState.players[nextPlayer].usedCardsThisTurn = [];
        }
        gameState.players[nextPlayer].usedMosseOnBarrieraThisTurn = false;
      }
      
      console.log(`⚔️ DUELLO: Turn switched to ${nextPlayer}`);
      return nextPlayer;
    }

    // No active duel - use normal turn order logic
    // Move to next non-eliminated player
    const startIndex = gameState.currentTurnIndex;
    let attempts = 0;
    do {
      gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.turnOrder.length;
      const nextPlayer = gameState.turnOrder[gameState.currentTurnIndex];
      
      // Check if player is eliminated
      if (!gameState.eliminatedPlayers.has(nextPlayer)) {
        // Increment turn counters for cards on field owned by the NEXT player
        gameState.field.forEach(card => {
          if ((card.type === 'bonus' || card.type === 'mosse') && card.placedBy === nextPlayer) {
            card.turnCounter = (card.turnCounter || 0) + 1;
            
            // Update the card text to include turn count
            // Remove previous turn count if it exists (e.g., " | 1 TURNO", " | 2 TURNI", etc.)
            let cleanText = (card.text || '').replace(/\s\|\s\d+\sTURN[IO]/gi, '').trim();
            // Handle the case where the text IS just the turn count
            if (/^\d+\sTURN[IO]$/i.test(cleanText)) {
              cleanText = '';
            }
            const suffix = card.turnCounter === 1 ? '1 TURNO' : `${card.turnCounter} TURNI`;
            card.text = cleanText ? `${cleanText} | ${suffix}` : suffix;
          }
        });

        // Found a non-eliminated player
        // Initialize usedCardsThisTurn and reset usedMosseOnBarrieraThisTurn for the next player
        if (gameState.players[nextPlayer]) {
          if (!gameState.players[nextPlayer].usedCardsThisTurn) {
            gameState.players[nextPlayer].usedCardsThisTurn = [];
          }
          gameState.players[nextPlayer].usedMosseOnBarrieraThisTurn = false;
        }
        return nextPlayer;
      }
      
      attempts++;
    } while (gameState.currentTurnIndex !== startIndex && attempts < gameState.turnOrder.length);

    // All players eliminated or no valid next player
    console.log(`⚠️ No non-eliminated players found in turn order (forceEndTurn)`);
    return null;
  }

  leaveGame(gameId: string, playerName: string): boolean {
    const gameState = this.games.get(gameId);
    if (!gameState) return false;

    // Check if player exists
    if (!gameState.players[playerName]) return false;

    // Move player to spectators
    gameState.spectators.push(playerName);

    // Remove player from turn order
    const turnIndex = gameState.turnOrder.indexOf(playerName);
    if (turnIndex !== -1) {
      gameState.turnOrder.splice(turnIndex, 1);
      
      // Adjust current turn index if necessary
      if (gameState.currentTurnIndex >= turnIndex && gameState.currentTurnIndex > 0) {
        gameState.currentTurnIndex--;
      }
      
      // Wrap around if we're at the end
      if (gameState.currentTurnIndex >= gameState.turnOrder.length && gameState.turnOrder.length > 0) {
        gameState.currentTurnIndex = 0;
      }
    }

    // Keep the player in the players object so they can spectate,
    // but clear their hand and move all their cards back to decks
    const player = gameState.players[playerName];
    
    // Move all cards from player's hand back to appropriate decks
    for (const card of player.hand) {
      const deckType = card.type as keyof typeof gameState.decks;
      card.owner = '';
      card.text = '';
      gameState.decks[deckType].push(card);
    }
    
    // Clear player's hand
    player.hand = [];

    // Move player's field cards back to decks  
    const playerFieldCards = gameState.field.filter(card => card.owner === playerName);
    for (const card of playerFieldCards) {
      const deckType = card.type as keyof typeof gameState.decks;
      card.owner = '';
      card.text = '';
      card.faceDown = false;
      gameState.decks[deckType].push(card);
    }
    
    // Remove player's cards from field
    gameState.field = gameState.field.filter(card => card.owner !== playerName);

    // Move player's graveyard cards back to decks
    const playerGraveyardCards = gameState.graveyard.filter(card => card.owner === playerName);
    for (const card of playerGraveyardCards) {
      const deckType = card.type as keyof typeof gameState.decks;
      card.owner = '';
      card.text = '';
      card.eliminatedBy = undefined;
      gameState.decks[deckType].push(card);
    }
    
    // Remove player's cards from graveyard
    gameState.graveyard = gameState.graveyard.filter(card => card.owner !== playerName);

    return true;
  }

  // Advanced instruction implementation methods
  private async swapPersonaggiCardsInstruction(gameId: string, playerName: string, instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const players = Object.keys(game.players);
    if (players.length < 2) {
      return { message: '❌ Servono almeno 2 giocatori per scambiare i PERSONAGGI!' };
    }

    // Find all PERSONAGGI cards on the field
    const fieldPersonaggi: Array<{player: string, card: any}> = [];
    
    for (const playerName of players) {
      const player = game.players[playerName];
      // Get player's cards from game field (both PERSONAGGI and PERSONAGGI_SPECIALI)
      const playerCardsOnField = game.field.filter(card => card.owner === playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali'));
      playerCardsOnField.forEach(card => {
        fieldPersonaggi.push({ player: playerName, card });
      });
    }

    if (fieldPersonaggi.length < 2) {
      return { message: '❌ Servono almeno 2 PERSONAGGI in campo per lo scambio!' };
    }

    // Swap the first two PERSONAGGI found
    const card1 = fieldPersonaggi[0];
    const card2 = fieldPersonaggi[1];
    
    // Update ownership in game field
    const card1FieldIndex = game.field.findIndex(c => c.id === card1.card.id);
    const card2FieldIndex = game.field.findIndex(c => c.id === card2.card.id);
    
    if (card1FieldIndex !== -1) {
      game.field[card1FieldIndex].owner = card2.player;
    }
    if (card2FieldIndex !== -1) {
      game.field[card2FieldIndex].owner = card1.player;
    }

    return { message: `🔄 PERSONAGGI scambiati tra ${card1.player} e ${card2.player}!` };
  }

  private async transferPersonaggioCard(gameId: string, fromPlayer: string, toPlayer: string, instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const fromPlayerData = game.players[fromPlayer];
    const toPlayerData = game.players[toPlayer];
    
    if (!fromPlayerData || !toPlayerData) {
      return { message: `❌ Giocatori non trovati: ${fromPlayer}, ${toPlayer}` };
    }

    // Find PERSONAGGIO or PERSONAGGI_SPECIALI card on field
    const personaggioCard = game.field.find(card => card.owner === fromPlayer && (card.type === 'personaggi' || card.type === 'personaggi_speciali'));
    if (!personaggioCard) {
      return { message: `❌ ${fromPlayer} non ha PERSONAGGI in campo!` };
    }

    // Transfer the card ownership
    personaggioCard.owner = toPlayer;

    return { message: `🔄 PERSONAGGIO trasferito da ${fromPlayer} a ${toPlayer}!` };
  }

  private async penalizePlayer(gameId: string, targetPlayer: string, instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const player = game.players[targetPlayer];
    if (!player) {
      return { message: `❌ Giocatore ${targetPlayer} non trovato!` };
    }

    // Move all player's cards to graveyard
    const removedCards = [];
    
    // Get player's cards from game field and move them back to decks
    const playerFieldCards = game.field.filter(card => card.owner === targetPlayer);
    removedCards.push(...playerFieldCards);
    game.field = game.field.filter(card => card.owner !== targetPlayer);
    
    if (player.hand && player.hand.length > 0) {
      removedCards.push(...player.hand);
      player.hand = [];
    }

    // Add cards to graveyard
    removedCards.forEach((card: Card) => {
      card.eliminatedBy = targetPlayer;
      game.graveyard.push(card);
    });

    return { message: `⚠️ ${targetPlayer} penalizzato: ${removedCards.length} carte rimosse!` };
  }

  private async swapFieldPositions(gameId: string, playerName: string, instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const players = Object.keys(game.players);
    let swapCount = 0;

    // Swap field cards between all players
    for (let i = 0; i < players.length - 1; i++) {
      const player1Name = players[i];
      const player2Name = players[i + 1];
      
      const player1Cards = game.field.filter(card => card.owner === player1Name);
      const player2Cards = game.field.filter(card => card.owner === player2Name);
      
      if (player1Cards.length > 0 && player2Cards.length > 0) {
        // Swap ownership of first cards
        player1Cards[0].owner = player2Name;
        player2Cards[0].owner = player1Name;
        swapCount++;
      }
    }

    return { message: `🔄 Posizioni delle carte in campo cambiate! (${swapCount} scambi)` };
  }

  private async distributeCardsToPlayer(gameId: string, targetPlayer: string, cardType: 'personaggi' | 'mosse' | 'bonus', count: number, instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const player = game.players[targetPlayer];
    if (!player) {
      return { message: `❌ Giocatore ${targetPlayer} non trovato!` };
    }

    let distributed = 0;
    for (let i = 0; i < count; i++) {
      const success = await this.pickCard(gameId, cardType, targetPlayer);
      if (success) {
        distributed++;
      }
    }

    return { message: `🎴 ${targetPlayer} ha pescato ${distributed} carta/e ${cardType.toUpperCase()}!` };
  }

  private async setAllPersonaggiPTI(gameId: string, newPTI: number, instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    let updatedCount = 0;
    const players = Object.keys(game.players);

    for (const playerName of players) {
      const player = game.players[playerName];
      // Get player's field cards from game.field (both PERSONAGGI and PERSONAGGI_SPECIALI)
      const playerFieldCards = game.field.filter(card => card.owner === playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali'));
      playerFieldCards.forEach((card: Card) => {
        if (!card.text) card.text = '';
        card.text = card.text.replace(/PTI:\s*\d+/g, '').trim();
        if (card.text) card.text += ` | PTI: ${newPTI}`;
        else card.text = `PTI: ${newPTI}`;
        updatedCount++;
      });
    }

    return { message: `⚙️ PTI di ${updatedCount} PERSONAGGI impostato a ${newPTI}!` };
  }

  private async resetGameInstruction(gameId: string, playerName: string, instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    // Reset all player data but keep players in game
    const players = Object.keys(game.players);
    for (const player of players) {
      game.players[player].hand = [];
      // Clear other player data while preserving the Player interface structure
      if (game.players[player].usedCardsThisTurn) {
        game.players[player].usedCardsThisTurn = [];
      }
      game.players[player].usedMosseOnBarrieraThisTurn = false;
    }

    // Reset game state
    game.graveyard = [];
    game.currentTurnIndex = 0;

    return { message: `🔄 Partita completamente resettata! Tutti i giocatori possono ricominciare.` };
  }

  // Enhanced instruction system methods
  private async moveCard(gameId: string, playerName: string, instruction: string, cardId: string, from: string, to: string, targetPlayer?: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    // Find the card
    let card: Card | undefined;
    let sourceLocation: string = '';

    // Remove from source
    if (from === 'field') {
      const index = game.field.findIndex(c => c.id === cardId);
      if (index !== -1) {
        card = game.field.splice(index, 1)[0];
        sourceLocation = 'campo';
      }
    } else if (from === 'graveyard') {
      const index = game.graveyard.findIndex(c => c.id === cardId);
      if (index !== -1) {
        card = game.graveyard.splice(index, 1)[0];
        sourceLocation = 'cimitero';
      }
    } else if (from === 'hand' && targetPlayer && game.players[targetPlayer]) {
      const index = game.players[targetPlayer].hand.findIndex(c => c.id === cardId);
      if (index !== -1) {
        card = game.players[targetPlayer].hand.splice(index, 1)[0];
        sourceLocation = `mano di ${targetPlayer}`;
      }
    }

    if (!card) {
      throw new Error(`Carta ${cardId} non trovata in ${from}`);
    }

    // Add to destination
    let destLocation: string = '';
    if (to === 'field') {
      game.field.push(card);
      destLocation = 'campo';
    } else if (to === 'graveyard') {
      game.graveyard.push(card);
      destLocation = 'cimitero';
    } else if (to === 'hand' && targetPlayer && game.players[targetPlayer]) {
      game.players[targetPlayer].hand.push(card);
      destLocation = `mano di ${targetPlayer}`;
    } else if (to === 'deck') {
      // Return to appropriate deck
      const deckType = card.type as keyof GameState['decks'];
      if (game.decks[deckType]) {
        game.decks[deckType].push(card);
        destLocation = `mazzo ${deckType}`;
      }
    }

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'move-card',
      cardId,
      from: sourceLocation,
      to: destLocation
    }, playerName);

    return { message: `🔄 ${playerName} ha spostato una carta da ${sourceLocation} a ${destLocation}` };
  }

  private async modifyCardPTI(gameId: string, playerName: string, instruction: string, cardId: string, newPTI: number, operation: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    // Find card in field or hands
    let card: Card | undefined;
    for (const fieldCard of game.field) {
      if (fieldCard.id === cardId || (fieldCard.text && fieldCard.text.toLowerCase().includes(cardId.toLowerCase()))) {
        card = fieldCard;
        break;
      }
    }

    if (!card) {
      // Search in hands by name or ID
      for (const player of Object.values(game.players)) {
        for (const handCard of player.hand) {
          if (handCard.id === cardId || (handCard.text && handCard.text.toLowerCase().includes(cardId.toLowerCase()))) {
            card = handCard;
            break;
          }
        }
        if (card) break;
      }
    }

    if (!card) {
      throw new Error(`Carta ${cardId} non trovata`);
    }

    // Extract current PTI from text/notes
    let currentPTI = 0;
    const ptiMatch = card.text?.match(/PTI[:\s]*(\d+)/i);
    if (ptiMatch) {
      currentPTI = parseInt(ptiMatch[1]);
    }

    // Calculate new PTI
    let finalPTI = newPTI;
    if (operation === 'add') {
      finalPTI = currentPTI + newPTI;
    } else if (operation === 'subtract') {
      finalPTI = Math.max(0, currentPTI - newPTI);
    }

    // Update card text with new PTI
    if (card.text) {
      card.text = card.text.replace(/PTI[:\s]*\d+/i, `PTI: ${finalPTI}`);
    } else {
      card.text = `PTI: ${finalPTI}`;
    }

    // Auto-eliminate if PTI reaches 0 - USE PROPER ELIMINATION CHECK
    let eliminationCheck = false;
    if (finalPTI === 0 && (card.type === 'personaggi' || card.type === 'personaggi_speciali')) {
      // Use moveToGraveyard which properly checks character limit for player elimination
      const result = this.moveToGraveyard(gameId, card.id, playerName);
      if (result.success && result.eliminationCheck) {
        // Player has reached character limit
        console.log(`Player ${playerName} reached character limit after PTI modification`);
        eliminationCheck = true;
      }
    }

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'modify-pti',
      cardId: card.id,
      newPTI: finalPTI,
      operation
    }, playerName);

    return { 
      message: `⚡ ${playerName} ha modificato PTI della carta: ${finalPTI} ${finalPTI === 0 ? '(carta eliminata!)' : ''}`,
      eliminationCheck
    };
  }

  private async transferCard(gameId: string, playerName: string, instruction: string, cardId: string | undefined, cardType: string | undefined, fromPlayer: string, toPlayer: string, count: number) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    if (!game.players[fromPlayer] || !game.players[toPlayer]) {
      throw new Error(`Giocatore non trovato: ${fromPlayer} o ${toPlayer}`);
    }

    let transferredCards = 0;
    
    if (cardId) {
      // Transfer specific card
      const cardIndex = game.players[fromPlayer].hand.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        const card = game.players[fromPlayer].hand.splice(cardIndex, 1)[0];
        game.players[toPlayer].hand.push(card);
        transferredCards = 1;
      }
    } else if (cardType) {
      // Transfer cards of specific type
      const normalizedType = cardType.toLowerCase().replace(' ', '_');
      for (let i = 0; i < count; i++) {
        const cardIndex = game.players[fromPlayer].hand.findIndex(c => c.type === normalizedType);
        if (cardIndex !== -1) {
          const card = game.players[fromPlayer].hand.splice(cardIndex, 1)[0];
          game.players[toPlayer].hand.push(card);
          transferredCards++;
        } else {
          break; // No more cards of this type
        }
      }
    }

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'transfer-card',
      fromPlayer,
      toPlayer,
      cardType,
      count: transferredCards
    }, playerName);

    return { message: `🔄 ${playerName} ha trasferito ${transferredCards} carte da ${fromPlayer} a ${toPlayer}` };
  }

  private async swapCards(gameId: string, playerName: string, instruction: string, player1?: string, player2?: string, cardType?: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const players = Object.keys(game.players);
    
    // If no specific players mentioned, swap between all players
    if (!player1 || !player2) {
      // Shuffle cards of specified type between all players
      if (cardType) {
        const normalizedType = cardType.toLowerCase().replace(' ', '_');
        const allCardsOfType: Card[] = [];
        
        // Collect all cards of this type
        for (const player of players) {
          const cardsToSwap = game.players[player].hand.filter(c => c.type === normalizedType);
          allCardsOfType.push(...cardsToSwap);
          game.players[player].hand = game.players[player].hand.filter(c => c.type !== normalizedType);
        }

        // Shuffle and redistribute
        for (let i = allCardsOfType.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allCardsOfType[i], allCardsOfType[j]] = [allCardsOfType[j], allCardsOfType[i]];
        }

        // Redistribute evenly
        let playerIndex = 0;
        for (const card of allCardsOfType) {
          game.players[players[playerIndex]].hand.push(card);
          playerIndex = (playerIndex + 1) % players.length;
        }

        await this.recordEvent(gameId, 'instruction-executed', {
          instruction,
          action: 'swap-cards',
          cardType,
          playerCount: players.length
        }, playerName);

        return { message: `🔄 ${playerName} ha mescolato le carte ${cardType.toUpperCase()} tra tutti i giocatori!` };
      }
    } else {
      // Swap specific cards between two players
      if (!game.players[player1] || !game.players[player2]) {
        throw new Error(`Giocatore non trovato: ${player1} o ${player2}`);
      }

      if (cardType) {
        const normalizedType = cardType.toLowerCase().replace(' ', '_');
        const cards1 = game.players[player1].hand.filter(c => c.type === normalizedType);
        const cards2 = game.players[player2].hand.filter(c => c.type === normalizedType);

        // Remove cards from original hands
        game.players[player1].hand = game.players[player1].hand.filter(c => c.type !== normalizedType);
        game.players[player2].hand = game.players[player2].hand.filter(c => c.type !== normalizedType);

        // Swap them
        game.players[player1].hand.push(...cards2);
        game.players[player2].hand.push(...cards1);

        await this.recordEvent(gameId, 'instruction-executed', {
          instruction,
          action: 'swap-cards',
          player1,
          player2,
          cardType
        }, playerName);

        return { message: `🔄 ${playerName} ha scambiato le carte ${cardType.toUpperCase()} tra ${player1} e ${player2}` };
      }
    }

    return { message: `❌ Parametri non validi per lo scambio carte` };
  }

  private async eliminateCard(gameId: string, playerName: string, instruction: string, cardId: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    let card: Card | undefined;
    let location = '';

    // Find and remove card from field
    const fieldIndex = game.field.findIndex(c => c.id === cardId || (c.text && c.text.toLowerCase().includes(cardId.toLowerCase())));
    if (fieldIndex !== -1) {
      card = game.field.splice(fieldIndex, 1)[0];
      location = 'campo';
    } else {
      // Find in hands
      for (const [pName, player] of Object.entries(game.players)) {
        const handIndex = player.hand.findIndex(c => c.id === cardId || (c.text && c.text.toLowerCase().includes(cardId.toLowerCase())));
        if (handIndex !== -1) {
          card = player.hand.splice(handIndex, 1)[0];
          location = `mano di ${pName}`;
          break;
        }
      }
    }

    if (!card) {
      throw new Error(`Carta ${cardId} non trovata`);
    }

    // Add to graveyard
    card.eliminatedBy = playerName;
    game.graveyard.push(card);

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'eliminate-card',
      cardId: card.id,
      originalLocation: location
    }, playerName);

    return { message: `💀 ${playerName} ha eliminato una carta dal ${location}` };
  }

  private async eliminatePlayer(gameId: string, playerName: string, instruction: string, elimPlayerName: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    if (!game.players[elimPlayerName]) {
      throw new Error(`Giocatore ${elimPlayerName} non trovato`);
    }

    // Move all player's cards to graveyard
    const playerCards = [...game.players[elimPlayerName].hand];
    for (const card of playerCards) {
      card.eliminatedBy = playerName;
      game.graveyard.push(card);
    }
    game.players[elimPlayerName].hand = [];

    // Move player's field cards to graveyard
    const playerFieldCards = game.field.filter(c => c.owner === elimPlayerName);
    for (const card of playerFieldCards) {
      card.eliminatedBy = playerName;
      game.graveyard.push(card);
    }
    game.field = game.field.filter(c => c.owner !== elimPlayerName);

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'eliminate-player',
      eliminatedPlayer: elimPlayerName,
      cardsCount: playerCards.length + playerFieldCards.length
    }, playerName);

    return { message: `💀 ${playerName} ha eliminato ${elimPlayerName} dalla partita!` };
  }

  private async skipPlayerTurn(gameId: string, playerName: string, instruction: string, skipPlayerName: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    if (!game.players[skipPlayerName]) {
      throw new Error(`Giocatore ${skipPlayerName} non trovato`);
    }

    // Simple turn skip implementation
    const players = Object.keys(game.players);
    const currentIndex = players.indexOf(skipPlayerName);
    if (currentIndex !== -1) {
      game.currentTurnIndex = (currentIndex + 1) % players.length;
    }

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'skip-turn',
      skippedPlayer: skipPlayerName
    }, playerName);

    return { message: `⏭️ ${playerName} ha saltato il turno di ${skipPlayerName}` };
  }

  private async setPlayerTurn(gameId: string, playerName: string, instruction: string, setTurnPlayer: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    if (!game.players[setTurnPlayer]) {
      throw new Error(`Giocatore ${setTurnPlayer} non trovato`);
    }

    const players = Object.keys(game.players);
    const playerIndex = players.indexOf(setTurnPlayer);
    if (playerIndex !== -1) {
      game.currentTurnIndex = playerIndex;
    }

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'set-turn',
      newTurnPlayer: setTurnPlayer
    }, playerName);

    return { message: `🎯 ${playerName} ha impostato il turno di ${setTurnPlayer}` };
  }

  private async modifyCardNotes(gameId: string, playerName: string, instruction: string, cardId: string, newNotes: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    // Find card
    let card: Card | undefined;
    for (const fieldCard of game.field) {
      if (fieldCard.id === cardId || (fieldCard.text && fieldCard.text.toLowerCase().includes(cardId.toLowerCase()))) {
        card = fieldCard;
        break;
      }
    }

    if (!card) {
      // Search in hands
      for (const player of Object.values(game.players)) {
        for (const handCard of player.hand) {
          if (handCard.id === cardId || (handCard.text && handCard.text.toLowerCase().includes(cardId.toLowerCase()))) {
            card = handCard;
            break;
          }
        }
        if (card) break;
      }
    }

    if (!card) {
      throw new Error(`Carta ${cardId} non trovata`);
    }

    card.text = newNotes;

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'modify-notes',
      cardId: card.id,
      newNotes
    }, playerName);

    return { message: `📝 ${playerName} ha modificato le note di una carta` };
  }

  private async shuffleDeckInstruction(gameId: string, playerName: string, instruction: string, deckType: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const normalizedDeckType = deckType.toLowerCase().replace(' ', '_') as keyof GameState['decks'];
    
    if (!game.decks[normalizedDeckType]) {
      throw new Error(`Tipo mazzo non valido: ${deckType}`);
    }

    // Shuffle the deck
    const deck = game.decks[normalizedDeckType];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'shuffle-deck',
      deckType: normalizedDeckType
    }, playerName);

    return { message: `🔀 ${playerName} ha mescolato il mazzo ${deckType.toUpperCase()}` };
  }

  private async giveSpecificCards(gameId: string, playerName: string, instruction: string, cardIds: string[], fromPlayer: string, toPlayer: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    if (!game.players[fromPlayer] || !game.players[toPlayer]) {
      throw new Error(`Giocatore non trovato: ${fromPlayer} o ${toPlayer}`);
    }

    let transferredCount = 0;
    for (const cardId of cardIds || []) {
      const cardIndex = game.players[fromPlayer].hand.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        const card = game.players[fromPlayer].hand.splice(cardIndex, 1)[0];
        game.players[toPlayer].hand.push(card);
        transferredCount++;
      }
    }

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'give-cards',
      fromPlayer,
      toPlayer,
      cardIds,
      transferredCount
    }, playerName);

    return { message: `🎁 ${playerName} ha trasferito ${transferredCount} carte specifiche da ${fromPlayer} a ${toPlayer}` };
  }

  // Add methods for elimination system
  markPlayerEliminated(gameId: string, playerName: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    // Check if player is already eliminated (idempotent behavior)
    if (game.eliminatedPlayers.has(playerName)) {
      console.log(`Player ${playerName} already eliminated, skipping duplicate elimination`);
      return false;
    }

    game.eliminatedPlayers.add(playerName);
    game.eliminationOrder.push(playerName);
    console.log(`Player ${playerName} marked as eliminated (position ${game.eliminationOrder.length})`);
    return true;
  }

  // Remove player from game and return their cards to decks
  removePlayerFromGame(gameId: string, playerName: string): boolean {
    const game = this.games.get(gameId);
    if (!game) {
      console.error(`[removePlayerFromGame] Game ${gameId} not found`);
      return false;
    }

    if (!game.players[playerName]) {
      console.error(`[removePlayerFromGame] Player ${playerName} not found in game`);
      return false;
    }

    console.log(`[removePlayerFromGame] Removing ${playerName} from game ${gameId}`);

    // 1. Return all cards from player's hand to their respective decks
    const playerHand = game.players[playerName].hand || [];
    playerHand.forEach(card => {
      const deckType = card.type as keyof typeof game.decks;
      if (game.decks[deckType]) {
        // Reset card ownership and add back to deck
        card.owner = '';
        card.text = '';
        game.decks[deckType].push(card);
        console.log(`[removePlayerFromGame] Returned ${card.id} to ${deckType} deck`);
      }
    });

    // 2. Return all cards from field that belong to this player
    const playerFieldCards = game.field.filter(card => card.owner === playerName);
    playerFieldCards.forEach(card => {
      const deckType = card.type as keyof typeof game.decks;
      if (game.decks[deckType]) {
        // Reset card ownership and add back to deck
        card.owner = '';
        card.text = '';
        game.decks[deckType].push(card);
        console.log(`[removePlayerFromGame] Returned field card ${card.id} to ${deckType} deck`);
      }
    });

    // Remove the cards from the field
    game.field = game.field.filter(card => card.owner !== playerName);

    // 3. Remove player from turn order
    const turnIndex = game.turnOrder.indexOf(playerName);
    if (turnIndex !== -1) {
      game.turnOrder.splice(turnIndex, 1);
      console.log(`[removePlayerFromGame] Removed ${playerName} from turn order`);
      
      // Adjust current turn index if needed
      if (game.currentTurnIndex >= game.turnOrder.length && game.turnOrder.length > 0) {
        game.currentTurnIndex = 0;
      }
    }

    // 4. Add to spectators list
    if (!game.spectators.includes(playerName)) {
      game.spectators.push(playerName);
      console.log(`[removePlayerFromGame] Added ${playerName} to spectators`);
    }

    // 5. Mark as eliminated
    game.eliminatedPlayers.add(playerName);

    // 6. Remove from active players (but keep player object for reconnection as spectator)
    // Instead of deleting, mark them as spectator by clearing their data
    game.players[playerName].hand = [];
    
    console.log(`[removePlayerFromGame] Successfully removed ${playerName} from game. They can remain as spectator.`);
    return true;
  }

  // DEFENSE SYSTEM: Helper methods for managing pending defense requests
  getPlayerSocketId(gameId: string, playerName: string): string | null {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return null;
    return game.players[playerName].socketId;
  }

  getPlayerNameFromSocket(socketId: string): string | null {
    // Find player across all games by socketId
    for (const [gameId, game] of Array.from(this.games.entries())) {
      for (const [playerName, player] of Object.entries(game.players)) {
        if ((player as any).socketId === socketId) {
          return playerName;
        }
      }
    }
    return null;
  }

  setPendingDefense(gameId: string, defense: Omit<PendingDefense, 'createdAt'>): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    // Clear any existing pending defense first (only one at a time)
    this.clearPendingDefense(gameId);

    game.pendingDefense = {
      ...defense,
      createdAt: new Date()
    };
    
    console.log(`Defense request created: ${defense.attacker} → ${defense.defender} (${defense.damage} damage)`);
    return true;
  }

  clearPendingDefense(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    if (game.pendingDefense?.timeoutId) {
      clearTimeout(game.pendingDefense.timeoutId);
    }
    
    game.pendingDefense = undefined;
    console.log(`Defense request cleared for game ${gameId}`);
  }

  // Helper method to emit defense:request when Socket.IO is available
  async emitDefenseRequest(gameId: string, io: any): Promise<boolean> {
    const pendingDefense = this.getPendingDefense(gameId);
    if (!pendingDefense) {
      console.log(`No pending defense found for game ${gameId}`);
      return false;
    }

    const game = this.games.get(gameId);
    if (!game) {
      console.log(`Game ${gameId} not found`);
      return false;
    }

    const defender = game.players[pendingDefense.defender];
    
    // CPU AUTO-DEFENSE: Check for specific BONUS cards to auto-block
    if (defender?.isCPU || pendingDefense.defender.startsWith('CPU-')) {
      const defenseBonusCards = [
        "ALTA SALVA", "BOOMERANG", "CONTRO SKRAZZKOOM", "CONVERSIONE", 
        "DIFESA VIGLIACCA", "E NN T MITT SCUORN", "E TAGG TRATTAT", 
        "FOLATA DI VENTO", "RESPINTA", "E NN T MITT SSCUORN"
      ];

      // Extract card name from frontImage URL if name is undefined
      const getCardName = (card: any): string => {
        if (card.name) return card.name;
        if (card.frontImage) {
          // Extract name from URL like https://i.postimg.cc/xxx/alta-salva.png -> alta salva
          const match = card.frontImage.match(/\/([^\/]+)\.(png|jpg|jpeg|gif)$/i);
          if (match) {
            return match[1].replace(/-/g, ' ').toUpperCase();
          }
        }
        return '';
      };

      // Debug: Log CPU hand to check card names
      console.log(`🤖 CPU ${pendingDefense.defender} hand:`, defender.hand.map((c: any) => ({ type: c.type, name: getCardName(c) })));

      const bonusInHand = defender.hand.find((c: any) => {
        if (c.type !== 'bonus') return false;
        const cardName = getCardName(c);
        return cardName && defenseBonusCards.some(defCard => cardName.includes(defCard));
      });

      if (bonusInHand) {
        const bonusCardName = getCardName(bonusInHand);
        console.log(`🤖 CPU defender ${pendingDefense.defender} HAS defense BONUS: ${bonusCardName} - auto-defending!`);
        
        io.to(gameId).emit('chat-message', {
          playerName: 'Sistema',
          message: `🤖 ${pendingDefense.defender} (CPU) usa ${bonusCardName} per respingere l'attacco!`,
          timestamp: Date.now()
        });

        // Put the card on the field immediately
        const cardToField = { ...bonusInHand, owner: pendingDefense.defender, isFaceUp: true };
        game.field.push(cardToField);
        defender.hand = defender.hand.filter((c: any) => c.id !== bonusInHand.id);

        // Emit game state update to show card on field
        const updatedGameState = this.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', updatedGameState);

        // ATOMIC RESOLUTION: Set defends=true before calling processDefenseResponse
        setTimeout(async () => {
          console.log(`🤖 CPU ${pendingDefense.defender}: Resolving defense TRUE`);
          await this.processDefenseResponse(gameId, pendingDefense.attackId, true, io, 'cpu');
        }, 1000);

        return true;
      }

      console.log(`🤖 CPU defender ${pendingDefense.defender} DOES NOT HAVE defense cards, auto-resolving with defends=false`);
      
      // Send system message about CPU decision
      io.to(gameId).emit('chat-message', {
        playerName: 'Sistema',
        message: `🤖 ${pendingDefense.defender} (CPU) accetta l'attacco automaticamente.`,
        timestamp: Date.now()
      });

      // Auto-resolve after 1 second delay for realism
      setTimeout(async () => {
        await this.processDefenseResponse(gameId, pendingDefense.attackId, false, io, 'cpu');
      }, 1000);

      return true;
    }

    const defenderSocketId = this.getPlayerSocketId(gameId, pendingDefense.defender);
    if (!defenderSocketId) {
      console.log(`Defender ${pendingDefense.defender} not found or offline - auto-resolving with defends=false`);
      
      // Send system message about offline player
      io.to(gameId).emit('chat-message', {
        playerName: 'Sistema',
        message: `⚠️ ${pendingDefense.defender} è offline - l'attacco procede automaticamente.`,
        timestamp: Date.now()
      });

      // Auto-resolve immediately for offline players
      await this.processDefenseResponse(gameId, pendingDefense.attackId, false, io, 'offline');
      return true;
    }

    console.log(`🛡️ EMITTING defense:request to ${pendingDefense.defender} (socket: ${defenderSocketId})`);
    
    // Find cards for displaying in the dialog
    const mosseCard = game.field.find(c => c.id === pendingDefense.mosseCardId);
    console.log(`🛡️ MOSSE Card found:`, mosseCard ? { id: mosseCard.id, image: mosseCard.frontImage ? '✓' : '✗' } : '✗ NOT FOUND');
    
    const attackerCard = game.field.find(c => c.owner === pendingDefense.attacker && (c.type === 'personaggi' || c.type === 'personaggi_speciali'));
    console.log(`🛡️ Attacker Card found:`, attackerCard ? { id: attackerCard.id, image: attackerCard.frontImage ? '✓' : '✗' } : '✗ NOT FOUND');
    
    const defenderCard = game.field.find(c => c.id === pendingDefense.targetCardId);
    console.log(`🛡️ Defender Card found:`, defenderCard ? { id: defenderCard.id, image: defenderCard.frontImage ? '✓' : '✗' } : '✗ NOT FOUND');
    
    const defenseRequestData = {
      gameId,
      attackId: pendingDefense.attackId,
      attackerName: pendingDefense.attacker,
      defenderName: pendingDefense.defender,
      mosseCardId: pendingDefense.mosseCardId,
      targetCardId: pendingDefense.targetCardId,
      damageValue: pendingDefense.damage,
      message: `${pendingDefense.attacker} ti sta attaccando! Vuoi respingere l'attacco?`,
      mosseCardImage: mosseCard?.frontImage,
      attackerCardImage: attackerCard?.frontImage,
      defenderCardImage: defenderCard?.frontImage,
      attackerCardText: attackerCard?.text,
      defenderCardText: defenderCard?.text
    };
    
    console.log(`🛡️ DEFENSE REQUEST DATA:`, defenseRequestData);
    
    // Emit targeted defense:request to the defender
    io.to(defenderSocketId).emit('defense:request', defenseRequestData);
    
    // Also send a system message to the room
    io.to(gameId).emit('chat-message', {
      playerName: 'Sistema',
      message: `🛡️ ${pendingDefense.attacker} attacca ${pendingDefense.defender}! In attesa della decisione di difesa...`,
      timestamp: Date.now()
    });

    // SERVER-SIDE TIMEOUT: Auto-resolve after 30 seconds if no response
    const timeoutId = setTimeout(async () => {
      console.log(`⏰ Defense timeout for ${pendingDefense.defender} - auto-resolving with defends=false`);
      
      // Send system message about timeout
      io.to(gameId).emit('chat-message', {
        playerName: 'Sistema',
        message: `⏰ ${pendingDefense.defender} non ha risposto in tempo - l'attacco procede automaticamente.`,
        timestamp: Date.now()
      });

      await this.processDefenseResponse(gameId, pendingDefense.attackId, false, io, 'timeout');
    }, 30000); // 30 seconds

    // Store timeout ID for cleanup
    const updatedGame = this.games.get(gameId);
    if (updatedGame?.pendingDefense) {
      updatedGame.pendingDefense.timeoutId = timeoutId;
    }

    return true;
  }

  getPendingDefense(gameId: string): PendingDefense | undefined {
    const game = this.games.get(gameId);
    return game?.pendingDefense;
  }

  // UNIFIED DEFENSE RESPONSE HANDLER: Processes defense responses and continues attack flow
  async processDefenseResponse(gameId: string, attackId: string, defends: boolean, io: any, resolveSource: 'client' | 'cpu' | 'offline' | 'timeout' = 'client'): Promise<boolean> {
    // PRODUCTION-READY: Enhanced validation and atomic guards
    const game = this.games.get(gameId);
    if (!game) {
      console.error(`[DEFENSE-RESOLVE] Game ${gameId} not found for defense response`, {
        gameId, attackId, defends, resolveSource, timestamp: new Date().toISOString()
      });
      return false;
    }

    // ATOMIC GUARD: Get pending defense and validate
    const pendingDefense = game.pendingDefense;
    if (!pendingDefense || pendingDefense.attackId !== attackId) {
      console.warn(`[DEFENSE-RESOLVE] No matching pending defense found`, {
        gameId, attackId, defends, resolveSource, 
        hasPending: !!pendingDefense, 
        expectedAttackId: pendingDefense?.attackId,
        timestamp: new Date().toISOString()
      });
      return false;
    }

    // IDEMPOTENCY: Clear timeout immediately if present
    const clearedTimeout = !!pendingDefense.timeoutId;
    if (pendingDefense.timeoutId) {
      clearTimeout(pendingDefense.timeoutId);
    }

    // ATOMIC GUARD: Immediately set pendingDefense to undefined to prevent duplicate processing
    game.pendingDefense = undefined;

    // Retain local copy for processing
    const { attacker, defender, targetCardId, mosseCardId, damage, isHandTarget, starsToRemove = 0, isFurtoAttack = false } = pendingDefense;

    // STRUCTURED LOGGING: Log resolution details
    console.log(`[DEFENSE-RESOLVE] Processing defense resolution`, {
      gameId, attackId, defends, resolveSource, 
      attacker, defender, targetCardId, mosseCardId, damage,
      clearedTimeout, timestamp: new Date().toISOString()
    });

    if (defends) {
      // DEFENSE SUCCESSFUL: Block attack and return MOSSE card
      console.log(`[DEFENSE-RESOLVE] Defense successful`, {
        defender, attacker, attackId, resolveSource, timestamp: new Date().toISOString()
      });

      // Broadcast defense success with resolution source
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-defense-success`,
        playerName: 'Sistema',
        message: `🛡️ ${defender} ha respinto l'attacco di ${attacker}! (${resolveSource})`,
        timestamp: Date.now()
      });

      // Return MOSSE card to deck bottom (push card by mosseCardId)
      console.log(`[DEFENSE-RESOLVE] Returning MOSSE card to deck bottom`, {
        mosseCardId, attacker, reason: 'successful_defense', timestamp: new Date().toISOString()
      });
      this.returnToDeck(gameId, mosseCardId, attacker);

      // DUELLO: Special turn handling during duel
      if (game.activeDuel && game.activeDuel.active) {
        console.log(`⚔️ DUELLO: Defender ${defender} blocked attack - granting 2 consecutive turns`);
        game.activeDuel.currentTurn = defender; // Switch turn to defender
        game.activeDuel.consecutiveTurns = 2; // Grant 2 bonus turns
        
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-duel-bonus-turns`,
          playerName: 'Sistema',
          message: `⚔️ DUELLO: ${defender} ottiene 2 turni consecutivi per aver respinto l'attacco!`,
          timestamp: Date.now()
        });
        
        io.to(gameId).emit('next-turn', { nextPlayer: defender });
      } else {
        // Normal turn ending (no duel)
        const nextPlayer = this.endTurn(gameId, attacker);
        if (nextPlayer) {
          io.to(gameId).emit('next-turn', { nextPlayer });
        }
      }

      // Send updated game state
      const updatedGameState = this.getSanitizedGameState(gameId);
      io.to(gameId).emit('game-state-update', updatedGameState);

      // Notify about MOSSE card return
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-defense-return`,
        playerName: 'Sistema',
        message: `📤 La carta MOSSE di ${attacker} è stata rimessa nel mazzo a causa della difesa.`,
        timestamp: Date.now()
      });

    } else {
      // DEFENSE FAILED: Apply stored damage directly using existing processMosseDamage
      console.log(`[DEFENSE-RESOLVE] Defense failed, applying damage`, {
        defender, attacker, damage, targetCardId, resolveSource, timestamp: new Date().toISOString()
      });

      // Broadcast defense failure with resolution source
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-defense-failed`,
        playerName: 'Sistema',
        message: `${defender} ha accettato l'attacco di ${attacker}! (${resolveSource})`,
        timestamp: Date.now()
      });

      // Apply damage using existing processMosseDamage to targetCardId owned by defender
      await this.processMosseDamage(gameId, attacker, targetCardId, damage, mosseCardId, io, false, isHandTarget || false, isFurtoAttack, false, starsToRemove);
      
      // DUELLO: Switch turn to opponent after attack is accepted
      if (game.activeDuel && game.activeDuel.active) {
        console.log(`⚔️ DUELLO: Switching turn after attack accepted`);
        this.switchDuelTurn(gameId);
        const nextPlayer = game.activeDuel.currentTurn;
        
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-duel-turn-switch`,
          playerName: 'Sistema',
          message: `⚔️ DUELLO: Turno di ${nextPlayer}`,
          timestamp: Date.now()
        });
        
        io.to(gameId).emit('next-turn', { nextPlayer });
      }
    }

    // Always broadcast attack:resolved event
    io.to(gameId).emit('attack:resolved', {
      attackId, attacker, defender, defends, resolveSource, 
      timestamp: Date.now()
    });

    console.log(`[DEFENSE-RESOLVE] Defense resolution completed`, {
      gameId, attackId, defends, resolveSource, attacker, defender, 
      timestamp: new Date().toISOString()
    });

    return true;
  }

  // COUNTER-ATTACK PROCESSING: When defender uses MOSSE to counter, subtract damage values
  async processCounterAttack(
    gameId: string, 
    attackId: string, 
    defenderMosseCardId: string,
    defenderDamage: number,
    defenderTargetCardId: string, // Attacker's character that will receive counter damage
    io: any
  ): Promise<{ success: boolean; result?: 'attacker_wins' | 'defender_wins' | 'clash'; netDamage?: number }> {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    const pendingDefense = game.pendingDefense;
    if (!pendingDefense || pendingDefense.attackId !== attackId) {
      console.warn(`[COUNTER-ATTACK] No matching pending defense for ${attackId}`);
      return { success: false };
    }

    // Clear timeout
    if (pendingDefense.timeoutId) {
      clearTimeout(pendingDefense.timeoutId);
    }

    const { attacker, defender, damage: attackDamage, targetCardId, mosseCardId, isHandTarget } = pendingDefense;

    console.log(`⚔️ COUNTER-ATTACK: ${defender} counters with ${defenderDamage} vs ${attacker}'s ${attackDamage}`);

    // Clear pending defense
    game.pendingDefense = undefined;

    // Compare damages
    if (attackDamage === defenderDamage) {
      // EQUAL DAMAGE: Start clash battle
      console.log(`⚡ CLASH BATTLE: Equal damage (${attackDamage}) - starting tap battle!`);
      
      const clashId = `clash-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      game.activeClashBattle = {
        id: clashId,
        attacker,
        defender,
        attackerTaps: 0,
        defenderTaps: 0,
        damageValue: attackDamage,
        attackerMosseCardId: mosseCardId,
        defenderMosseCardId: defenderMosseCardId,
        targetCardId, // Defender's character
        defenderTargetCardId, // Attacker's character
        startTime: Date.now(),
        duration: 10000, // 10 seconds
        active: true
      };

      // Emit clash battle start to all players
      io.to(gameId).emit('clash-battle-start', {
        clashId,
        attacker,
        defender,
        damageValue: attackDamage,
        duration: 10000
      });

      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-clash-start`,
        playerName: 'Sistema',
        message: `⚡ SCONTRO! ${attacker} e ${defender} si affrontano con ${attackDamage} PTI ciascuno! Premi il tasto più velocemente!`,
        timestamp: Date.now()
      });

      // CPU AUTO-TAP: If either participant is CPU, automatically tap for them
      const attackerIsCPU = attacker.startsWith('CPU');
      const defenderIsCPU = defender.startsWith('CPU');
      
      if (attackerIsCPU || defenderIsCPU) {
        // Generate random number of taps between 15-25
        const cpuTaps = Math.floor(Math.random() * 11) + 15; // 15-25 taps
        const tapInterval = 10000 / cpuTaps; // Spread taps over 10 seconds
        
        if (attackerIsCPU) {
          console.log(`🤖 CPU ${attacker} will auto-tap ${cpuTaps} times`);
          for (let i = 0; i < cpuTaps; i++) {
            setTimeout(() => {
              const result = this.handleClashTap(gameId, attacker);
              if (result.success) {
                io.to(gameId).emit('clash-tap-update', {
                  clashId,
                  attackerTaps: result.attackerTaps,
                  defenderTaps: result.defenderTaps
                });
                
                // Check for overwhelm (20 tap lead)
                const overwhelmCheck = this.checkClashOverwhelm(gameId);
                if (overwhelmCheck.winner) {
                  this.resolveClashBattle(gameId, clashId, io);
                }
              }
            }, Math.random() * tapInterval + (i * tapInterval * 0.8));
          }
        }
        
        if (defenderIsCPU) {
          console.log(`🤖 CPU ${defender} will auto-tap ${cpuTaps} times`);
          for (let i = 0; i < cpuTaps; i++) {
            setTimeout(() => {
              const result = this.handleClashTap(gameId, defender);
              if (result.success) {
                io.to(gameId).emit('clash-tap-update', {
                  clashId,
                  attackerTaps: result.attackerTaps,
                  defenderTaps: result.defenderTaps
                });
                
                // Check for overwhelm (20 tap lead)
                const overwhelmCheck = this.checkClashOverwhelm(gameId);
                if (overwhelmCheck.winner) {
                  this.resolveClashBattle(gameId, clashId, io);
                }
              }
            }, Math.random() * tapInterval + (i * tapInterval * 0.8));
          }
        }
      }

      // Set timeout to resolve clash after 10 seconds
      setTimeout(async () => {
        await this.resolveClashBattle(gameId, clashId, io);
      }, 10500);

      return { success: true, result: 'clash' };
    } else if (defenderDamage > attackDamage) {
      // DEFENDER WINS: Apply net damage to attacker's character
      const netDamage = defenderDamage - attackDamage;
      console.log(`🛡️ COUNTER WIN: ${defender} deals ${netDamage} net damage to ${attacker}`);

      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-counter-win`,
        playerName: 'Sistema',
        message: `🛡️ ${defender} respinge con successo! ${attacker} subisce ${netDamage} danni (${defenderDamage} - ${attackDamage})!`,
        timestamp: Date.now()
      });

      // Return attacker's MOSSE to deck
      this.returnToDeck(gameId, mosseCardId, attacker);
      
      // Apply net damage to attacker's character (no star removal in counter-attacks)
      await this.processMosseDamage(gameId, defender, defenderTargetCardId, netDamage, defenderMosseCardId, io, false, false, false, false, 0);

      // Send game state update
      const updatedGameState = this.getSanitizedGameState(gameId);
      io.to(gameId).emit('game-state-update', updatedGameState);

      return { success: true, result: 'defender_wins', netDamage };
    } else {
      // ATTACKER WINS: Apply net damage to defender's character
      const netDamage = attackDamage - defenderDamage;
      console.log(`⚔️ ATTACK WIN: ${attacker} deals ${netDamage} net damage to ${defender}`);

      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-attack-win`,
        playerName: 'Sistema',
        message: `⚔️ ${attacker} sfonda la difesa! ${defender} subisce ${netDamage} danni (${attackDamage} - ${defenderDamage})!`,
        timestamp: Date.now()
      });

      // Return defender's MOSSE to deck
      this.returnToDeck(gameId, defenderMosseCardId, defender);
      
      // Apply net damage to defender's character (no star removal in counter-attacks)
      await this.processMosseDamage(gameId, attacker, targetCardId, netDamage, mosseCardId, io, false, isHandTarget || false, false, false, 0);

      // Send game state update
      const updatedGameState = this.getSanitizedGameState(gameId);
      io.to(gameId).emit('game-state-update', updatedGameState);

      return { success: true, result: 'attacker_wins', netDamage };
    }
  }

  // CLASH BATTLE: Handle tap from participant
  handleClashTap(gameId: string, playerName: string): { success: boolean; attackerTaps: number; defenderTaps: number } {
    const game = this.games.get(gameId);
    if (!game?.activeClashBattle?.active) {
      return { success: false, attackerTaps: 0, defenderTaps: 0 };
    }

    const clash = game.activeClashBattle;
    
    // Only attacker and defender can tap
    if (playerName === clash.attacker) {
      clash.attackerTaps++;
    } else if (playerName === clash.defender) {
      clash.defenderTaps++;
    } else {
      return { success: false, attackerTaps: clash.attackerTaps, defenderTaps: clash.defenderTaps };
    }

    return { success: true, attackerTaps: clash.attackerTaps, defenderTaps: clash.defenderTaps };
  }

  // CLASH BATTLE: Check if one side completely overwhelmed
  checkClashOverwhelm(gameId: string): { winner: string | null; loser: string | null } {
    const game = this.games.get(gameId);
    if (!game?.activeClashBattle?.active) {
      return { winner: null, loser: null };
    }

    const clash = game.activeClashBattle;
    const diff = clash.attackerTaps - clash.defenderTaps;
    
    // Win by 20 tap lead = complete overwhelm
    if (diff >= 20) {
      return { winner: clash.attacker, loser: clash.defender };
    } else if (diff <= -20) {
      return { winner: clash.defender, loser: clash.attacker };
    }

    return { winner: null, loser: null };
  }

  // CLASH BATTLE: Resolve at end of time or when overwhelmed
  async resolveClashBattle(gameId: string, clashId: string, io: any): Promise<void> {
    const game = this.games.get(gameId);
    if (!game?.activeClashBattle || game.activeClashBattle.id !== clashId || !game.activeClashBattle.active) {
      console.log(`[CLASH] Battle ${clashId} already resolved or not found`);
      return;
    }

    const clash = game.activeClashBattle;
    clash.active = false;

    const { attacker, defender, attackerTaps, defenderTaps, damageValue, attackerMosseCardId, defenderMosseCardId, targetCardId, defenderTargetCardId } = clash;

    console.log(`⚡ CLASH RESOLVED: ${attacker}(${attackerTaps}) vs ${defender}(${defenderTaps})`);

    let winner: string;
    let loser: string;
    let winnerMosseCardId: string;
    let loserMosseCardId: string;
    let targetToHit: string;

    if (attackerTaps > defenderTaps) {
      winner = attacker;
      loser = defender;
      winnerMosseCardId = attackerMosseCardId;
      loserMosseCardId = defenderMosseCardId;
      targetToHit = targetCardId; // Hit defender's character
    } else if (defenderTaps > attackerTaps) {
      winner = defender;
      loser = attacker;
      winnerMosseCardId = defenderMosseCardId;
      loserMosseCardId = attackerMosseCardId;
      targetToHit = defenderTargetCardId; // Hit attacker's character
    } else {
      // TIE: Neither takes damage, both MOSSE returned
      console.log(`⚡ CLASH TIE: Both return MOSSE to deck`);
      
      this.returnToDeck(gameId, attackerMosseCardId, attacker);
      this.returnToDeck(gameId, defenderMosseCardId, defender);

      io.to(gameId).emit('clash-battle-end', {
        clashId,
        winner: null,
        attackerTaps,
        defenderTaps,
        isTie: true
      });

      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-clash-tie`,
        playerName: 'Sistema',
        message: `⚡ PAREGGIO! ${attacker}(${attackerTaps}) e ${defender}(${defenderTaps}) pareggiano - nessun danno inflitto!`,
        timestamp: Date.now()
      });

      game.activeClashBattle = undefined;
      const updatedGameState = this.getSanitizedGameState(gameId);
      io.to(gameId).emit('game-state-update', updatedGameState);
      return;
    }

    // Winner deals full damage, loser's MOSSE returns to deck
    console.log(`⚡ CLASH WINNER: ${winner} beats ${loser} (${attackerTaps} vs ${defenderTaps})`);

    this.returnToDeck(gameId, loserMosseCardId, loser);

    io.to(gameId).emit('clash-battle-end', {
      clashId,
      winner,
      loser,
      attackerTaps,
      defenderTaps,
      isTie: false
    });

    io.to(gameId).emit('chat-message', {
      id: `${Date.now()}-clash-winner`,
      playerName: 'Sistema',
      message: `⚡ ${winner} VINCE LO SCONTRO! (${attackerTaps} vs ${defenderTaps}) e infligge ${damageValue} danni a ${loser}!`,
      timestamp: Date.now()
    });

    // Apply full damage from winner (no star removal in clash battles)
    await this.processMosseDamage(gameId, winner, targetToHit, damageValue, winnerMosseCardId, io, false, false, false, false, 0);

    game.activeClashBattle = undefined;
    const updatedGameState = this.getSanitizedGameState(gameId);
    io.to(gameId).emit('game-state-update', updatedGameState);
  }

  // Get active clash battle for a game
  getActiveClashBattle(gameId: string): ClashBattle | undefined {
    const game = this.games.get(gameId);
    return game?.activeClashBattle;
  }

  // EXTRACTED AND HARDENED: Damage processing method (preserves ALL legacy logic + BAMBOLA VOODOO + ATTACCO DISONESTO + FURTO + STAR REMOVAL)
  async processMosseDamage(gameId: string, attackerName: string, targetCardId: string, damageValue: number, mosseCardId: string, io: any, isVoodooReflection: boolean = false, isHandTarget: boolean = false, isFurtoAttack: boolean = false, isPersistentTick: boolean = false, starsToRemove: number = 0): Promise<void> {
    const game = this.games.get(gameId);
    const gameState = this.getSanitizedGameState(gameId);
    
    // Find target card - either on field or in hand (for ATTACCO DISONESTO)
    let targetCard: any;
    let targetOwner: string = '';
    
    if (isHandTarget) {
      // ATTACCO DISONESTO: target is in opponent's hand
      for (const [playerName, player] of Object.entries(game?.players || {})) {
        if (playerName === attackerName) continue;
        const handCard = player.hand.find((c: Card) => c.id === targetCardId);
        if (handCard && (handCard.type === 'personaggi' || handCard.type === 'personaggi_speciali')) {
          targetCard = handCard;
          targetOwner = playerName;
          break;
        }
      }
    } else {
      // Regular attack: target is on field
      targetCard = gameState?.field?.find((c: any) => c.id === targetCardId);
      targetOwner = targetCard?.owner || '';
    }
    
    if (!targetCard || !targetOwner || (targetCard.type !== 'personaggi' && targetCard.type !== 'personaggi_speciali')) {
      console.log(`Target card ${targetCardId} not found${isHandTarget ? ' in hand' : ' on field'} or not a character`);
      return;
    }

    // PARASITIC CARD ATTACK IMMUNITY CHECK
    // Check if targetCard has attached parasitic cards (is being parasitized)
    // PARASSITA: Cannot be attacked by anyone while attached
    // SAIBAIM: Cannot be attacked by its target while attached
    const attachedParasites = game?.field?.filter((c: Card) => c.attachedTo === targetCardId) || [];
    for (const parasite of attachedParasites) {
      const parasiteName = this.getCardNameFromUrl(parasite.frontImage || '').toUpperCase();
      
      if (parasiteName.includes('PARASSITA')) {
        // PARASSITA cannot be attacked while attached - check if trying to attack the PARASSITA itself
        if (targetCardId === parasite.id) {
          console.log(`🦠 ATTACK BLOCKED: PARASSITA ${parasite.id} cannot be attacked while attached`);
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-parassita-immune`,
            playerName: 'Sistema',
            message: `🦠 PARASSITA non può essere attaccato mentre è agganciato!`,
            timestamp: Date.now()
          });
          return;
        }
      }
    }
    
    // Check if the target card IS a PARASSITA or SAIBAIM that's attached
    const targetCardName = this.getCardNameFromUrl(targetCard.frontImage || '').toUpperCase();
    if (targetCard.attachedTo) {
      if (targetCardName.includes('PARASSITA')) {
        // PARASSITA cannot be attacked by anyone while attached
        console.log(`🦠 ATTACK BLOCKED: PARASSITA ${targetCardId} cannot be attacked while attached`);
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-parassita-immune`,
          playerName: 'Sistema',
          message: `🦠 PARASSITA non può essere attaccato mentre è agganciato!`,
          timestamp: Date.now()
        });
        return;
      } else if (targetCardName.includes('SAIBAIM')) {
        // SAIBAIM cannot be attacked by its target
        const attachedTargetCard = game?.field?.find((c: Card) => c.id === targetCard.attachedTo);
        if (attachedTargetCard && attachedTargetCard.owner === attackerName) {
          console.log(`🦠 ATTACK BLOCKED: SAIBAIM ${targetCardId} cannot be attacked by its target ${attackerName}`);
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-saibaim-immune`,
            playerName: 'Sistema',
            message: `🦠 SAIBAIM non può essere attaccato dal personaggio a cui è agganciato!`,
            timestamp: Date.now()
          });
          return;
        }
      }
    }

    // BARRIERA PROTECTION CHECK: If target is protected by BARRIERA, redirect attack to BARRIERA shield (auto-damage, no defense)
    if (!isHandTarget && !isVoodooReflection) {
      const barrieraProtection = this.isProtectedByBarriera(gameId, targetCardId);
      if (barrieraProtection) {
        const targetName = this.getCardNameFromUrl(targetCard.frontImage || '');
        const activeShield = this.getActiveBarrieraShieldCard(gameId, targetCardId);
        
        if (activeShield) {
          console.log(`🛡️ ATTACK REDIRECTED: ${targetName} is protected by BARRIERA - auto-applying ${damageValue} damage to shield`);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-barriera-redirect`,
            playerName: 'Sistema',
            message: `🛡️ ${targetName} è protetto da BARRIERA! L'attacco viene assorbito automaticamente dalla barriera.`,
            timestamp: Date.now()
          });
          
          // BARRIERA auto-accepts damage (no defense dialog)
          this.damageBarriera(gameId, activeShield.id, damageValue, attackerName, io);
          
          // Return MOSSE to deck after use
          this.returnToDeck(gameId, mosseCardId, attackerName);
          
          // Update game state
          const updatedGameState = this.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', updatedGameState);
          
          return; // Attack absorbed by BARRIERA
        }
      }
    }

    // RIFUGIO PROTECTION CHECK: If target is protected by RIFUGIO, redirect attack to RIFUGIO
    if (!isHandTarget && !isVoodooReflection) {
      const rifugioProtection = this.isProtectedByRifugio(gameId, targetCardId);
      if (rifugioProtection) {
        const targetName = this.getCardNameFromUrl(targetCard.frontImage || '');
        console.log(`🏠 ATTACK REDIRECTED: ${targetName} is protected by RIFUGIO - redirecting ${damageValue} damage`);
        
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-rifugio-redirect`,
          playerName: 'Sistema',
          message: `🏠 ${targetName} è protetto da RIFUGIO! L'attacco viene assorbito dal rifugio.`,
          timestamp: Date.now()
        });
        
        // Apply damage to RIFUGIO instead
        this.damageRifugio(gameId, rifugioProtection.rifugioCardId, damageValue, attackerName, io);
        
        // Return MOSSE to deck after use
        this.returnToDeck(gameId, mosseCardId, attackerName);
        
        // Update game state
        const updatedGameState = this.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', updatedGameState);
        
        return; // Don't apply damage to protected character
      }
    }

    // CIMICE ATTACK EFFECT: When attacked, removes 50 PTI from ALL other field characters
    // Also triggers for cards with copied CIMICE power
    const hasCimicePower = targetCardName.includes('CIMICE') || targetCard.copiedPower === 'CIMICE';
    if (hasCimicePower && !isVoodooReflection && !isPersistentTick) {
      console.log(`🪲 CIMICE power triggered (${targetCard.copiedPower ? 'copied' : 'native'})! Removing 50 PTI from all other field characters (excluding ${targetCardId})`);
      
      const affectedCards: Array<{ id: string; name: string; owner: string; oldPTI: number; newPTI: number }> = [];
      
      // Get all field characters except CIMICE itself (explicit ID and name check)
      const otherFieldCharacters = game?.field?.filter((c: Card) => 
        c.id !== targetCardId && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
      ) || [];
      
      for (const card of otherFieldCharacters) {
        // Extra safety: skip any card that is CIMICE by name or has CIMICE power (shouldn't damage itself)
        const cardNameCheck = this.getCardNameFromUrl(card.frontImage || '').toUpperCase();
        if (cardNameCheck.includes('CIMICE') || card.copiedPower === 'CIMICE') {
          console.log(`🪲 Skipping CIMICE power card (${card.id}) - should not damage itself`);
          continue;
        }
        
        const cardPTI = this.extractPTIFromNote(card.text || '');
        const cardStars = this.extractStarsFromNote(card.text || '');
        const newPTI = Math.max(0, cardPTI - 50);
        // Preserve the "Potere di" notation if present
        const powerMatch = card.text?.match(/\|\s*Potere di\s+\w+/i);
        card.text = `PTI: ${newPTI} | Stelle: ${cardStars}${powerMatch ? ` ${powerMatch[0]}` : ''}`;
        
        affectedCards.push({
          id: card.id,
          name: this.getCardNameFromUrl(card.frontImage || ''),
          owner: card.owner,
          oldPTI: cardPTI,
          newPTI
        });
        
        console.log(`🪲 CIMICE effect: ${this.getCardNameFromUrl(card.frontImage || '')} PTI ${cardPTI} → ${newPTI}`);
      }
      
      // Emit CIMICE attack effect event for client animation
      io.to(gameId).emit('cimice-effect', {
        type: 'attack',
        cimiceCardId: targetCardId,
        damagePerCard: 50,
        affectedCards,
        message: 'CIMICE è stata attaccata! Tutti gli altri personaggi perdono 50 PTI!'
      });
      
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-cimice-attack-effect`,
        playerName: 'SISTEMA',
        message: `🪲 CIMICE attaccata! Tutti gli altri personaggi in campo perdono 50 PTI!`,
        timestamp: Date.now()
      });
      
      // Check if any cards died from CIMICE attack effect
      for (const affected of affectedCards) {
        if (affected.newPTI <= 0) {
          console.log(`💀 ${affected.name} killed by CIMICE attack effect!`);
          this.moveToGraveyard(gameId, affected.id, affected.owner, targetOwner);
        }
      }
      
      // Broadcast updated game state after CIMICE attack effect
      const updatedState = this.getSanitizedGameState(gameId);
      io.to(gameId).emit('game-state-update', updatedState);
    }

    // PERSISTENT DAMAGE REGISTRATION (VIRUS, INFLUENZA, PUOZZA ITT L SANG)
    if (!isPersistentTick && !isVoodooReflection && !isHandTarget) {
      const mosseCard = game?.field?.find(c => c.id === mosseCardId);
      const mosseFrontImage = mosseCard?.frontImage || '';
      const mosseName = this.getCardNameFromUrl(mosseFrontImage).toUpperCase();
      
      let type: 'VIRUS' | 'INFLUENZA' | 'PUOZZA' | null = null;
      if (mosseName.includes('VIRUS')) type = 'VIRUS';
      else if (mosseName.includes('INFLUENZA')) type = 'INFLUENZA';
      else if (mosseName.includes('PUOZZA') && mosseName.includes('SANG')) type = 'PUOZZA';

      if (type) {
        // Find attacker character (source of persistent effect)
        const attackerChar = game?.field.find(c => c.owner === attackerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'));
        
        if (attackerChar || type === 'PUOZZA') {
          if (!game?.persistentDamages) game!.persistentDamages = [];
          
          // Check if this target already has this specific persistent damage type from this attacker
          const existing = game!.persistentDamages.find(d => 
            d.targetCardId === targetCardId && d.type === type && d.attacker === attackerName
          );

          if (!existing) {
            game!.persistentDamages.push({
              id: `${type}-${Date.now()}-${targetCardId}`,
              attacker: attackerName,
              attackerCardId: attackerChar?.id || '',
              defender: targetOwner,
              targetCardId: targetCardId,
              damage: damageValue,
              type: type
            });
            
            console.log(`🦠 Persistent damage registered: ${type} from ${attackerName} to ${targetOwner} (Target: ${targetCardId})`);
          } else {
            console.log(`🦠 Persistent damage ${type} already active on ${targetCardId} from ${attackerName}`);
          }
        }
      }
    }

    // SEMPAFAAGARA logic: special recursive damage loop
    // Find the MOSSE card on field to get its actual frontImage URL
    const mosseCard = game?.field?.find(c => c.id === mosseCardId);
    const mosseFrontImage = mosseCard?.frontImage || mosseCardId;
    const mosseName = this.getCardNameFromUrl(mosseFrontImage).toUpperCase();
    console.log(`[PROCESS-DAMAGE] Checking SEMPAFAAGARA: "${mosseName}" (frontImage: ${mosseFrontImage})`);
    if (mosseName.includes('SEMPAFAAGARA') && !isVoodooReflection) {
      console.log(`🌀 SEMPAFAAGARA: Starting recursive damage loop between ${attackerName} and ${targetOwner}`);
      
      let attackerChar = game?.field.find(c => c.owner === attackerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'));
      let defenderChar = targetCard;
      
      if (!attackerChar) {
        console.log('SEMPAFAAGARA: Attacker character not found');
        return;
      }

      // Pre-calculate all damage steps for animation
      const steps: Array<{ target: 'attacker' | 'defender'; damage: number; newPTI: number; eliminated: boolean }> = [];
      let simAttackerPTI = this.extractPTIFromNote(attackerChar.text || '');
      let simDefenderPTI = this.extractPTIFromNote(defenderChar.text || '');
      let currentDamage = damageValue;
      let turn: 'attacker' | 'defender' = 'defender';
      let eliminatedCharId: string | null = null;
      let eliminatedOwner: string | null = null;
      let eliminatedBy: string | null = null;

      while (true) {
        if (turn === 'defender') {
          simDefenderPTI = Math.max(0, simDefenderPTI - currentDamage);
          steps.push({ target: 'defender', damage: currentDamage, newPTI: simDefenderPTI, eliminated: simDefenderPTI <= 0 });
          if (simDefenderPTI <= 0) {
            eliminatedCharId = defenderChar.id;
            eliminatedOwner = targetOwner;
            eliminatedBy = attackerName;
            break;
          }
        } else {
          simAttackerPTI = Math.max(0, simAttackerPTI - currentDamage);
          steps.push({ target: 'attacker', damage: currentDamage, newPTI: simAttackerPTI, eliminated: simAttackerPTI <= 0 });
          if (simAttackerPTI <= 0) {
            eliminatedCharId = attackerChar.id;
            eliminatedOwner = attackerName;
            eliminatedBy = targetOwner;
            break;
          }
        }
        currentDamage *= 2;
        turn = turn === 'defender' ? 'attacker' : 'defender';
      }

      // Emit animation event with all steps
      io.to(gameId).emit('recursive-damage-animation', {
        type: 'SEMPAFAAGARA',
        attackerName,
        defenderName: targetOwner,
        attackerCard: {
          id: attackerChar.id,
          frontImage: attackerChar.frontImage,
          name: this.getCardNameFromUrl(attackerChar.frontImage),
          initialPTI: this.extractPTIFromNote(attackerChar.text || '')
        },
        defenderCard: {
          id: defenderChar.id,
          frontImage: defenderChar.frontImage,
          name: this.getCardNameFromUrl(defenderChar.frontImage),
          initialPTI: this.extractPTIFromNote(defenderChar.text || '')
        },
        steps
      });

      // Apply final damage after animation delay
      const animationDuration = steps.length * 2000 + 2000;
      setTimeout(() => {
        // Apply final PTI values
        attackerChar!.text = (attackerChar!.text || '').replace(/PTI:\s*\d+/i, `PTI: ${simAttackerPTI}`);
        defenderChar.text = (defenderChar.text || '').replace(/PTI:\s*\d+/i, `PTI: ${simDefenderPTI}`);
        
        // Move eliminated character to graveyard
        if (eliminatedCharId && eliminatedOwner && eliminatedBy) {
          this.moveToGraveyard(gameId, eliminatedCharId, eliminatedOwner, eliminatedBy);
        }
        
        // Sync state
        const updatedGameState = this.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', updatedGameState);
      }, animationDuration);
      
      return;
    }

    // PARTITA DI TENNIS logic: special escalating damage loop (+50 each hit)
    if (mosseName.includes('PARTITA') && mosseName.includes('TENNIS') && !isVoodooReflection) {
      console.log(`🎾 PARTITA DI TENNIS: Starting escalating damage loop between ${attackerName} and ${targetOwner}`);
      
      let attackerChar = game?.field.find(c => c.owner === attackerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'));
      let defenderChar = targetCard;
      
      if (!attackerChar) {
        console.log('PARTITA DI TENNIS: Attacker character not found');
        return;
      }

      // Pre-calculate all damage steps for animation
      const steps: Array<{ target: 'attacker' | 'defender'; damage: number; newPTI: number; eliminated: boolean }> = [];
      let simAttackerPTI = this.extractPTIFromNote(attackerChar.text || '');
      let simDefenderPTI = this.extractPTIFromNote(defenderChar.text || '');
      let currentDamage = damageValue;
      let turn: 'attacker' | 'defender' = 'defender';
      let eliminatedCharId: string | null = null;
      let eliminatedOwner: string | null = null;
      let eliminatedBy: string | null = null;

      while (true) {
        if (turn === 'defender') {
          simDefenderPTI = Math.max(0, simDefenderPTI - currentDamage);
          steps.push({ target: 'defender', damage: currentDamage, newPTI: simDefenderPTI, eliminated: simDefenderPTI <= 0 });
          if (simDefenderPTI <= 0) {
            eliminatedCharId = defenderChar.id;
            eliminatedOwner = targetOwner;
            eliminatedBy = attackerName;
            break;
          }
        } else {
          simAttackerPTI = Math.max(0, simAttackerPTI - currentDamage);
          steps.push({ target: 'attacker', damage: currentDamage, newPTI: simAttackerPTI, eliminated: simAttackerPTI <= 0 });
          if (simAttackerPTI <= 0) {
            eliminatedCharId = attackerChar.id;
            eliminatedOwner = attackerName;
            eliminatedBy = targetOwner;
            break;
          }
        }
        currentDamage += 50;
        turn = turn === 'defender' ? 'attacker' : 'defender';
      }

      // Emit animation event with all steps
      io.to(gameId).emit('recursive-damage-animation', {
        type: 'PARTITA_DI_TENNIS',
        attackerName,
        defenderName: targetOwner,
        attackerCard: {
          id: attackerChar.id,
          frontImage: attackerChar.frontImage,
          name: this.getCardNameFromUrl(attackerChar.frontImage),
          initialPTI: this.extractPTIFromNote(attackerChar.text || '')
        },
        defenderCard: {
          id: defenderChar.id,
          frontImage: defenderChar.frontImage,
          name: this.getCardNameFromUrl(defenderChar.frontImage),
          initialPTI: this.extractPTIFromNote(defenderChar.text || '')
        },
        steps
      });

      // Apply final damage after animation delay
      const animationDuration = steps.length * 2000 + 2000;
      setTimeout(() => {
        // Apply final PTI values
        attackerChar!.text = (attackerChar!.text || '').replace(/PTI:\s*\d+/i, `PTI: ${simAttackerPTI}`);
        defenderChar.text = (defenderChar.text || '').replace(/PTI:\s*\d+/i, `PTI: ${simDefenderPTI}`);
        
        // Move eliminated character to graveyard
        if (eliminatedCharId && eliminatedOwner && eliminatedBy) {
          this.moveToGraveyard(gameId, eliminatedCharId, eliminatedOwner, eliminatedBy);
        }
        
        // Sync state
        const updatedGameState = this.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', updatedGameState);
      }, animationDuration);
      
      return;
    }

    // REGULAR DAMAGE LOGIC (original code starts here)
    let currentNotes = targetCard.text || '';
    let updatedNotes = currentNotes;
    let shouldDie = false;

    // FURTO ATTACK: Steal stars instead of dealing PTI damage
    if (isFurtoAttack) {
      console.log(`⭐ FURTO ATTACK: ${attackerName} is stealing ${damageValue} stars from ${targetOwner}'s character`);
      
      // Extract current stars from card notes
      const starsMatch = currentNotes.match(/[Ss]telle:\s*(-?\d+)/i);
      let currentStars = starsMatch ? parseInt(starsMatch[1]) : 0;
      
      // Calculate new stars after theft
      const starsToSteal = Math.min(damageValue, Math.max(0, currentStars));
      const newStars = currentStars - damageValue;
      
      // Update card notes with new stars
      if (starsMatch) {
        updatedNotes = currentNotes.replace(/[Ss]telle:\s*-?\d+/i, `Stelle: ${newStars}`);
      } else {
        updatedNotes = currentNotes ? `${currentNotes}\nStelle: ${newStars}` : `Stelle: ${newStars}`;
      }
      
      // Update the card in the game state
      if (isHandTarget) {
        const player = game?.players?.[targetOwner];
        if (player) {
          const handCardIndex = player.hand.findIndex((c: Card) => c.id === targetCardId);
          if (handCardIndex !== -1) {
            player.hand[handCardIndex].text = updatedNotes;
          }
        }
      } else {
        this.updateCardText(gameId, targetCardId, updatedNotes);
      }
      
      console.log(`⭐ FURTO: ${targetOwner}'s ${targetCard.frontImage} lost ${damageValue} stars (stole ${starsToSteal}): ${currentStars} → ${newStars} Stelle`);
      
      // ADD STOLEN STARS AND PTI TO ATTACKER'S CHARACTER
      const attackerCharacter = gameState?.field?.find((c: any) => 
        c.owner === attackerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
      );
      
      let attackerNewStars = 0;
      let attackerNewPTI = 0;
      let ptiGained = 0;

      if (attackerCharacter) {
        const attackerNotes = attackerCharacter.text || '';
        
        // Handle Stars
        const attackerStarsMatch = attackerNotes.match(/[Ss]telle:\s*(-?\d+)/i);
        const attackerCurrentStars = attackerStarsMatch ? parseInt(attackerStarsMatch[1]) : 0;
        attackerNewStars = attackerCurrentStars + starsToSteal;
        
        let attackerUpdatedNotes = attackerNotes;
        if (attackerStarsMatch) {
          attackerUpdatedNotes = attackerUpdatedNotes.replace(/[Ss]telle:\s*-?\d+/i, `Stelle: ${attackerNewStars}`);
        } else {
          attackerUpdatedNotes = attackerUpdatedNotes ? `${attackerUpdatedNotes}\nStelle: ${attackerNewStars}` : `Stelle: ${attackerNewStars}`;
        }

        // Handle PTI (if target dies)
        if (newStars < 0) {
          ptiGained = 100;
          const ptiMatch = attackerUpdatedNotes.match(/PTI:\s*(\d+)/i);
          const currentPTI = ptiMatch ? parseInt(ptiMatch[1]) : 0;
          attackerNewPTI = currentPTI + ptiGained;

          if (ptiMatch) {
            attackerUpdatedNotes = attackerUpdatedNotes.replace(/PTI:\s*\d+/i, `PTI: ${attackerNewPTI}`);
          } else {
            attackerUpdatedNotes = attackerUpdatedNotes ? `${attackerUpdatedNotes}\nPTI: ${attackerNewPTI}` : `PTI: ${attackerNewPTI}`;
          }
        }
        
        this.updateCardText(gameId, attackerCharacter.id, attackerUpdatedNotes);
        console.log(`⭐ FURTO: ${attackerName}'s ${attackerCharacter.frontImage} gained ${starsToSteal} stars and ${ptiGained} PTI`);
      }
      
      // Broadcast the FURTO result
      let gainedMsg = '';
      if (attackerCharacter) {
        gainedMsg = ` | ${attackerName}: +${starsToSteal} ⭐`;
        if (ptiGained > 0) gainedMsg += ` e +${ptiGained} PTI!`;
      }

      if (newStars < 0) {
        // Character dies if stars go below 0
        shouldDie = true;
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-furto-death`,
          playerName: 'Sistema',
          message: `⭐💀 FURTO LETALE! ${attackerName} ruba ${damageValue} stelle a ${targetCard.owner}! Stelle: ${currentStars} → ${newStars} - IL PERSONAGGIO MUORE!${gainedMsg}`,
          timestamp: Date.now()
        });
      } else if (newStars === 0) {
        // Character can't use MOSSE if stars = 0
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-furto-blocked`,
          playerName: 'Sistema',
          message: `⭐🚫 FURTO! ${attackerName} ruba ${damageValue} stelle a ${targetCard.owner}! Stelle: ${currentStars} → ${newStars} - NON PUÒ PIÙ USARE MOSSE!${gainedMsg}`,
          timestamp: Date.now()
        });
      } else {
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-furto`,
          playerName: 'Sistema',
          message: `⭐ FURTO! ${attackerName} ruba ${damageValue} stelle a ${targetCard.owner}! Stelle: ${currentStars} → ${newStars}${gainedMsg}`,
          timestamp: Date.now()
        });
      }
      
      // If character should die from FURTO, handle death below
      if (shouldDie) {
        // For ATTACCO DISONESTO + FURTO: move card from hand to graveyard
        if (isHandTarget) {
          const player = game?.players?.[targetOwner];
          if (player) {
            const handCardIndex = player.hand.findIndex((c: Card) => c.id === targetCardId);
            if (handCardIndex !== -1) {
              const deadCard = player.hand.splice(handCardIndex, 1)[0];
              deadCard.eliminatedBy = attackerName;
              game?.graveyard?.push(deadCard);
              console.log(`⭐ FURTO LETALE: ${targetCard.frontImage} di ${targetOwner} è morto (stelle < 0) e va nel cimitero`);
            }
          }
        } else {
          // Regular field death from FURTO
          const result = this.moveToGraveyard(gameId, targetCardId, targetOwner, attackerName);
          
          if (result.sorosActivated && result.sorosImage && result.sorosActivator) {
            console.log(`🎭 SOROS ACTIVATED! Broadcasting to all players in room ${gameId}`);
            io.to(gameId).emit('soros-activated', {
              activator: result.sorosActivator,
              cardImage: result.sorosImage
            });
          }
          
          if (result.eliminationCheck) {
            const eliminationSuccess = this.markPlayerEliminated(gameId, targetOwner);
            if (eliminationSuccess) {
              console.log(`Player ${targetOwner} automatically eliminated due to character limit (FURTO)`);
            }
          }
        }
        
        // Broadcast updated game state and return early
        const updatedGameState = this.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', updatedGameState);
      }
      
      // Mark action as completed for CPU turn flow
      if (attackerName.startsWith('CPU-')) {
        console.log(`MOSSE FURTO action completed for CPU ${attackerName}`);
      }
      
      // FURTO also needs to mark the MOSSE card as used
      const mosseCard = game?.field?.find((c: any) => c.id === mosseCardId);
      if (mosseCard) {
        mosseCard.used = true;
        mosseCard.usedBy = attackerName;
        console.log(`MOSSE card ${mosseCardId} (FURTO) used by ${attackerName}`);
      }
      
      // Broadcast updated game state
      const updatedGameState = this.getSanitizedGameState(gameId);
      io.to(gameId).emit('game-state-update', updatedGameState);
      
      return; // FURTO handling complete, skip normal PTI damage
    }

    // REGULAR ATTACK: Extract current PTI from card notes (exact legacy logic)
    const ptiMatch = currentNotes.match(/PTI:\s*(\d+)/i);
    let currentPTI = ptiMatch ? parseInt(ptiMatch[1]) : 0;
    
    // FIX FOR ATTACCO DISONESTO: If card in hand has no PTI set, look it up from database
    if (isHandTarget && !ptiMatch) {
      console.log(`🎯 ATTACCO DISONESTO: Target card ${targetCardId} has no PTI in text. Looking up from database...`);
      
      // Try to get PTI from database
      const cardName = this.getCardNameFromUrl(targetCard.frontImage || '');
      const dbData = await this.getPersonaggioFromDatabase(cardName);
      
      if (dbData && dbData.pti !== null) {
        // Found in database - set the PTI and stars on the card
        currentPTI = dbData.pti;
        const starsValue = dbData.stars || 0;
        targetCard.text = `PTI: ${currentPTI} | Stelle: ${starsValue}`;
        currentNotes = targetCard.text;
        updatedNotes = currentNotes;
        
        // Update the card in the player's hand
        const player = game?.players?.[targetOwner];
        if (player) {
          const handCardIndex = player.hand.findIndex((c: Card) => c.id === targetCardId);
          if (handCardIndex !== -1) {
            player.hand[handCardIndex].text = targetCard.text;
          }
        }
        
        console.log(`✅ ATTACCO DISONESTO: Found ${cardName} in database - PTI: ${currentPTI}, Stelle: ${starsValue}`);
      } else {
        console.log(`⚠️ ATTACCO DISONESTO: Card ${cardName} not found in database. Using default PTI of 100.`);
        // Default PTI if not found in database
        currentPTI = 100;
        targetCard.text = `PTI: ${currentPTI} | Stelle: 0`;
        currentNotes = targetCard.text;
        updatedNotes = currentNotes;
        
        const player = game?.players?.[targetOwner];
        if (player) {
          const handCardIndex = player.hand.findIndex((c: Card) => c.id === targetCardId);
          if (handCardIndex !== -1) {
            player.hand[handCardIndex].text = targetCard.text;
          }
        }
      }
    }
    
    // DEBUG LOGGING for ATTACCO DISONESTO
    if (isHandTarget) {
      console.log(`🎯 ATTACCO DISONESTO DEBUG:`, {
        targetCardId,
        targetOwner,
        currentNotes: targetCard.text,
        currentPTI,
        damageValue,
        targetCardFrontImage: targetCard?.frontImage
      });
    }

    // PRESERVE: Calculate new PTI after damage
    const newPTI = Math.max(0, currentPTI - damageValue);
    
    // Track damage dealt for missions/achievements (fire-and-forget)
    this.trackPlayerEvent(gameId, attackerName, 'damage_dealt', { amount: damageValue }).catch(() => {});
    
    // DEBUG LOGGING for damage calculation
    if (isHandTarget) {
      console.log(`🎯 ATTACCO DISONESTO DAMAGE CALC:`, {
        currentPTI,
        damageValue,
        newPTI,
        willDie: newPTI <= 0
      });
    }

    // PRESERVE: Update card notes with new PTI
    if (ptiMatch) {
      updatedNotes = currentNotes.replace(/PTI:\s*\d+/i, `PTI: ${newPTI}`);
    } else {
      updatedNotes = currentNotes ? `${currentNotes}\nPTI: ${newPTI}` : `PTI: ${newPTI}`;
    }

    // STAR REMOVAL: Apply star damage if specified
    let starsRemovedMessage = '';
    if (starsToRemove > 0) {
      const currentStars = this.extractStarsFromNote(updatedNotes);
      const newStars = Math.max(0, currentStars - starsToRemove);
      updatedNotes = updatedNotes.replace(/Stelle:\s*\d+/i, `Stelle: ${newStars}`);
      
      // If no stars field exists, add it
      if (!updatedNotes.match(/Stelle:/i)) {
        updatedNotes = `${updatedNotes} | Stelle: ${newStars}`;
      }
      
      starsRemovedMessage = ` | ⭐ Stelle: ${currentStars} → ${newStars}`;
      console.log(`⭐ STAR REMOVAL: ${targetOwner}'s card lost ${starsToRemove} stars: ${currentStars} → ${newStars}`);
    }

    // PRESERVE: Update the card in the game state (works for both hand and field)
    if (isHandTarget) {
      // For hand targets, update directly in player's hand
      const player = game?.players?.[targetOwner];
      if (player) {
        const handCardIndex = player.hand.findIndex((c: Card) => c.id === targetCardId);
        if (handCardIndex !== -1) {
          player.hand[handCardIndex].text = updatedNotes;
        }
      }
    } else {
      // For field targets, use existing method
      this.updateCardText(gameId, targetCardId, updatedNotes);
    }
    
    console.log(`${isHandTarget ? '🎯 ATTACCO DISONESTO: ' : ''}${targetOwner}'s ${targetCard.frontImage} took ${damageValue} damage: ${currentPTI} → ${newPTI} PTI${starsToRemove > 0 ? `, -${starsToRemove} stars` : ''}`);
    
    // PRESERVE: Mark action as completed for CPU turn flow
    if (attackerName.startsWith('CPU-')) {
      console.log(`MOSSE action completed for CPU ${attackerName}`);
    }
    
    // PRESERVE: Broadcast the damage result
    io.to(gameId).emit('chat-message', {
      id: `${Date.now()}-damage`,
      playerName: 'Sistema',
      message: `⚔️ ${attackerName} attacca ${targetCard.owner}! Danno: ${damageValue} | PTI: ${currentPTI} → ${newPTI}${starsRemovedMessage}`,
      timestamp: Date.now()
    });

    // BAMBOLA VOODOO: Check if this card is linked and apply damage to linked card too
    // GUARD: Only process voodoo reflection if this is NOT already a reflection (prevent infinite loop)
    if (!isVoodooReflection) {
      const voodooLink = game?.voodooLinks?.find(link => 
        link.card1Id === targetCardId || link.card2Id === targetCardId
      );
      
      if (voodooLink) {
        const linkedCardId = voodooLink.card1Id === targetCardId ? voodooLink.card2Id : voodooLink.card1Id;
        const linkedCard = gameState?.field?.find((c: any) => c.id === linkedCardId);
        
        if (linkedCard && (linkedCard.type === 'personaggi' || linkedCard.type === 'personaggi_speciali')) {
          console.log(`🔮 BAMBOLA VOODOO: Reflecting ${damageValue} damage to linked card ${linkedCardId} (one-time reflection)`);
          
          // Extract linked card's PTI
          const linkedNotes = linkedCard.text || '';
          const linkedPtiMatch = linkedNotes.match(/PTI:\s*(\d+)/i);
          let linkedCurrentPTI = linkedPtiMatch ? parseInt(linkedPtiMatch[1]) : 0;
          const linkedNewPTI = Math.max(0, linkedCurrentPTI - damageValue);
          
          // Update linked card notes
          let linkedUpdatedNotes = linkedNotes;
          if (linkedPtiMatch) {
            linkedUpdatedNotes = linkedNotes.replace(/PTI:\s*\d+/i, `PTI: ${linkedNewPTI}`);
          } else {
            linkedUpdatedNotes = linkedNotes ? `${linkedNotes}\nPTI: ${linkedNewPTI}` : `PTI: ${linkedNewPTI}`;
          }
          
          this.updateCardText(gameId, linkedCardId, linkedUpdatedNotes);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-voodoo`,
            playerName: 'Sistema',
            message: `🔮 BAMBOLA VOODOO! Il danno si riflette su ${linkedCard.owner}! PTI: ${linkedCurrentPTI} → ${linkedNewPTI}`,
            timestamp: Date.now()
          });
          
          // If linked card dies, it should also be eliminated
          if (linkedNewPTI <= 0) {
            setTimeout(() => {
              this.moveToGraveyard(gameId, linkedCardId, linkedCard.owner);
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-voodoo-death`,
                playerName: 'Sistema',
                message: `🔮💀 BAMBOLA VOODOO! Il personaggio di ${linkedCard.owner} muore insieme a quello di ${targetCard.owner}!`,
                timestamp: Date.now()
              });
              const updatedGameState = this.getSanitizedGameState(gameId);
              io.to(gameId).emit('game-state-update', updatedGameState);
            }, 1500);
          }
        } else {
          console.log(`🔮 BAMBOLA VOODOO: Linked card ${linkedCardId} not found or not a character - removing stale link`);
          this.removeVoodooLink(gameId, linkedCardId);
        }
      }
    } else {
      console.log(`🔮 BAMBOLA VOODOO: Skipping reflection (this is already a reflected attack)`);
    }

    // PRESERVE: Check if character dies (PTI <= 0) - exact legacy logic
    if (newPTI <= 0) {
      // For ATTACCO DISONESTO: move card from hand to graveyard immediately
      if (isHandTarget) {
        const player = game?.players?.[targetOwner];
        if (player) {
          const handCardIndex = player.hand.findIndex((c: Card) => c.id === targetCardId);
          if (handCardIndex !== -1) {
            const deadCard = player.hand.splice(handCardIndex, 1)[0];
            // CRITICAL FIX: eliminatedBy should be the OWNER (victim), not the attacker
            // Deaths count against the player who owned the card, not who killed it
            deadCard.eliminatedBy = targetOwner;
            game?.graveyard?.push(deadCard);
            console.log(`🎯 ATTACCO DISONESTO: ${targetCard.frontImage} di ${targetOwner} è morto e va nel cimitero (morte contata per ${targetOwner})`);
            
            // Check for player elimination after ATTACCO DISONESTO kill
            const graveyardCount = game?.graveyard?.filter(
              (c: Card) => c.eliminatedBy === targetOwner && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
            ).length || 0;
            
            if (game && game.characterLimit !== 'unlimited') {
              const baseLimit = parseInt(game.characterLimit);
              const playerModifier = game.playerDeathModifiers.get(targetOwner) || 0;
              const effectiveLimit = baseLimit + playerModifier;
              if (graveyardCount >= effectiveLimit && !game.eliminatedPlayers.has(targetOwner)) {
                console.log(`Player ${targetOwner} has reached character limit via ATTACCO DISONESTO - automatically eliminating`);
                
                const eliminationSuccess = this.markPlayerEliminated(gameId, targetOwner);
                if (eliminationSuccess) {
                  console.log(`Player ${targetOwner} automatically eliminated due to character limit (ATTACCO DISONESTO)`);
                  io.to(gameId).emit('player-eliminated', { playerName: targetOwner });
                  
                  io.to(gameId).emit('chat-message', {
                    id: `${Date.now()}-auto-elimination-disonesto`,
                    playerName: 'Sistema',
                    message: `${targetOwner} è stato eliminato! Ha perso tutti i suoi personaggi per ATTACCO DISONESTO.`,
                    timestamp: Date.now()
                  });
                  
                  const winner = this.checkForGameVictory(gameId);
                  if (winner) {
                    console.log(`Game won by: ${winner}`);
                    io.to(gameId).emit('game-victory', { winner });
                    this.completeMatch(gameId, winner);
                  }
                }
              }
            }
            
    // Track elimination count for SOROS activation (attacker gets credit)
    const attackerPlayer = game?.players?.[attackerName];
    if (attackerPlayer) {
      if (!attackerPlayer.eliminationCount) {
        attackerPlayer.eliminationCount = 0;
      }
      attackerPlayer.eliminationCount++;
      console.log(`🗡️ ATTACCO DISONESTO: ${attackerName} has eliminated ${attackerPlayer.eliminationCount} personaggi`);
    }

    // Remove persistent damages if the target character died
    if (game.persistentDamages) {
      game.persistentDamages = game.persistentDamages.filter(d => d.targetCardId !== targetCardId);
    }

          }
        }
      } else {
        // CIMICE DEATH EFFECT: Check if dying card is CIMICE or has copied CIMICE power before moving to graveyard
        const dyingCardName = this.getCardNameFromUrl(targetCard.frontImage || '').toUpperCase();
        const hasCimicePower = dyingCardName.includes('CIMICE') || targetCard.copiedPower === 'CIMICE';
        
        // Regular field death: move to graveyard with attacker info for SOROS activation
        const result = this.moveToGraveyard(gameId, targetCardId, targetOwner, attackerName);
        
        // Trigger CIMICE death effect after card is in graveyard (for native CIMICE or copied power)
        if (hasCimicePower) {
          console.log(`🪲 CIMICE power death triggered (${targetCard.copiedPower ? 'copied' : 'native'})`);
          await this.processCimiceDeathEffect(gameId, targetCardId, io);
        }
        
        // HANDLE SOROS ACTIVATION
        if (result.sorosActivated && result.sorosImage && result.sorosActivator) {
          console.log(`🎭 SOROS ACTIVATED! Broadcasting to all players in room ${gameId}`);
          io.to(gameId).emit('soros-activated', {
            activator: result.sorosActivator,
            cardImage: result.sorosImage
          });
        }
        
        // CHECK FOR PLAYER ELIMINATION after character death
        if (result.eliminationCheck) {
          console.log(`Player ${targetOwner} has reached character limit via MOSSE damage - automatically eliminating`);
          
          const eliminationSuccess = this.markPlayerEliminated(gameId, targetOwner);
          if (eliminationSuccess) {
            console.log(`Player ${targetOwner} automatically eliminated due to character limit`);
            io.to(gameId).emit('player-eliminated', { playerName: targetOwner });
            
            // Send elimination message
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-auto-elimination`,
              playerName: 'Sistema',
              message: `${targetOwner} è stato eliminato! Ha perso tutti i suoi personaggi.`,
              timestamp: Date.now()
            });
            
            // Check for game victory
            const winner = this.checkForGameVictory(gameId);
            if (winner) {
              console.log(`Game won by: ${winner}`);
              io.to(gameId).emit('game-victory', { winner });
              // Award Rankiard points
              this.completeMatch(gameId, winner);
            }
          }
        }
      }
      
      // PRESERVE: PTI ABSORPTION SYSTEM (exact legacy implementation)
      const updatedGameState = this.getSanitizedGameState(gameId);
      const attackerCharacters = updatedGameState?.field?.filter((c: any) => 
        c.owner === attackerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
      ) || [];
      
      let attackerCharacter = null;
      if (attackerCharacters.length > 0) {
        attackerCharacter = attackerCharacters.reduce((best: any, current: any) => {
          const bestPti = (best.text || '').match(/PTI:\s*(\d+)/i)?.[1] || 0;
          const currentPti = (current.text || '').match(/PTI:\s*(\d+)/i)?.[1] || 0;
          return parseInt(currentPti) > parseInt(bestPti) ? current : best;
        });
      }
      
      // PRESERVE: HARDENED PTI ABSORPTION (fixed: absorb when character dies regardless of previous PTI)
      if (attackerCharacter && newPTI <= 0) {
        const attackerNotes = attackerCharacter.text || '';
        const attackerPtiMatch = attackerNotes.match(/PTI:\s*(\d+)/i);
        let attackerCurrentPTI = attackerPtiMatch ? parseInt(attackerPtiMatch[1]) : 100;
        
        // PRESERVE: Fixed +100 PTI per elimination
        const absorbedPTI = 100;
        const newAttackerPTI = Math.min(9999, attackerCurrentPTI + absorbedPTI);
        
        if (absorbedPTI > 0 && newAttackerPTI > attackerCurrentPTI) {
          let updatedAttackerNotes = attackerNotes;
          if (attackerPtiMatch) {
            updatedAttackerNotes = attackerNotes.replace(/PTI:\s*\d+/i, `PTI: ${newAttackerPTI}`);
          } else {
            updatedAttackerNotes = attackerNotes + `\nPTI: ${newAttackerPTI}`;
          }
          
          this.updateCardText(gameId, attackerCharacter.id, updatedAttackerNotes);
          
          console.log(`PTI ABSORPTION AUDIT: ${attackerName} [${attackerCharacter.id}] gains +100 PTI for eliminating ${targetCard.owner} [${targetCardId}] (${attackerCurrentPTI} → ${newAttackerPTI})`);
          
          // PRESERVE: PTI absorption notification
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-absorption`,
            playerName: 'Sistema',
            message: `🔥 ${attackerName} guadagna +100 PTI per aver eliminato il personaggio! (${attackerCurrentPTI} → ${newAttackerPTI} PTI)`,
            timestamp: Date.now()
          });
          
          console.log(`PTI_ABSORPTION_EVENT: ${attackerName} gained +100 PTI for eliminating ${targetCard.owner}`);
        } else {
          console.log(`PTI ABSORPTION SKIPPED: Invalid data (absorbedPTI=${absorbedPTI}, newPTI=${newAttackerPTI})`);
        }
      } else if (!attackerCharacter) {
        console.log(`PTI ABSORPTION SKIPPED: No attacker character found for ${attackerName}`);
      }

      // DUELLO: End duel if the dead character was involved in an active duel
      if (game?.activeDuel && game.activeDuel.active) {
        if (this.isInDuel(gameId, targetCardId)) {
          const duel = game.activeDuel;
          const winnerPlayer = targetCard.id === duel.character1Id ? duel.player2 : duel.player1;
          
          console.log(`⚔️ DUELLO: Character ${targetCardId} died - ending duel. Winner: ${winnerPlayer}`);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-duel-end`,
            playerName: 'Sistema',
            message: `⚔️ DUELLO TERMINATO! ${winnerPlayer} vince per eliminazione dell'avversario!`,
            timestamp: Date.now()
          });
          
          this.endDuel(gameId, `Character death (${targetCardId})`);
          
          // Broadcast duel ended event
          io.to(gameId).emit('duel-ended', {
            winner: winnerPlayer,
            reason: 'character_death'
          });
        }
      }

      // Send updated game state IMMEDIATELY
      const finalGameState = this.getSanitizedGameState(gameId);
      io.to(gameId).emit('game-state-update', finalGameState);
      
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-death`,
        playerName: 'Sistema', 
        message: `💀 Il personaggio di ${targetCard.owner} è morto! (PTI: ${newPTI})`,
        timestamp: Date.now()
      });
    } else {
      // Send updated game state for PTI change
      const updatedGameState = this.getSanitizedGameState(gameId);
      io.to(gameId).emit('game-state-update', updatedGameState);
    }
    
    // MOSSE return system: CPU auto-return with replacement, humans manual
    console.log(`MOSSE card ${mosseCardId} used by ${attackerName}`);
    
    if (attackerName.startsWith('CPU-')) {
      // CPU AUTO-MANAGEMENT: Synchronous return and draw to avoid race conditions
      console.log(`🤖 CPU ${attackerName}: Auto-returning MOSSE card ${mosseCardId} to deck bottom`);
      this.returnToDeck(gameId, mosseCardId, attackerName);
      
      // Draw replacement MOSSE card synchronously
      const replacementCard = await this.pickCard(gameId, 'mosse', attackerName);
      if (replacementCard) {
        console.log(`🤖 CPU ${attackerName}: Auto-drew replacement MOSSE card`);
      } else {
        console.log(`⚠️ CPU ${attackerName}: Failed to draw replacement MOSSE card`);
      }
      
      // Delayed notification for UI feedback (doesn't affect game state)
      setTimeout(() => {
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-cpu-mosse-management`,
          playerName: 'Sistema',
          message: `🤖 ${attackerName} ha rimesso la carta MOSSE nel mazzo e pescato una nuova carta.`,
          timestamp: Date.now()
        });
        
        // Broadcast updated game state
        const updatedGameState = this.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', updatedGameState);
      }, 1000);
    } else {
      // HUMAN MANUAL RETURN: Emit reminder after delay
      setTimeout(() => {
        io.to(gameId).emit('mosse-return-required', {
          cardId: mosseCardId,
          playerName: attackerName,
          cardType: 'mosse',
          message: `${attackerName} deve rimettere manualmente la carta MOSSE nel mazzo (in fondo)`
        });
      }, 2000);
      
      console.log(`MOSSE card ${mosseCardId} used by ${attackerName} - awaiting manual return to deck bottom`);
    }
  }

  checkForGameVictory(gameId: string): string | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    // Prevent multiple victory notifications - check if game has already ended
    if (game.gameEnded) {
      return null;
    }

    // Get ALL active players (including CPU) who are not eliminated
    const allActivePlayers = Object.keys(game.players)
      .filter(playerName => !game.eliminatedPlayers.has(playerName));

    console.log(`Victory check: ${allActivePlayers.length} active players remaining:`, allActivePlayers);

    // If only one active player remains (human or CPU), they win
    if (allActivePlayers.length === 1) {
      const winner = allActivePlayers[0];
      // Mark game as ended to prevent multiple victory notifications
      game.gameEnded = true;
      console.log(`Game victory declared for ${winner} - game marked as ended`);
      return winner;
    }

    // Also check: if only one HUMAN player remains and all CPUs are eliminated, human wins
    const activeHumans = allActivePlayers.filter(p => !game.players[p].isCPU);
    const activeCPUs = allActivePlayers.filter(p => game.players[p].isCPU);
    
    if (activeHumans.length === 1 && activeCPUs.length === 0) {
      const winner = activeHumans[0];
      game.gameEnded = true;
      console.log(`Game victory declared for human ${winner} (all CPUs eliminated) - game marked as ended`);
      return winner;
    }

    return null;
  }

  // BAMBOLA VOODOO: Activate voodoo link between two characters
  activateVoodooLink(gameId: string, bonusCardId: string, card1Id: string, card2Id: string, activatedBy: string): { success: boolean; message: string } {
    const game = this.games.get(gameId);
    if (!game) {
      return { success: false, message: 'Game not found' };
    }

    const gameState = this.getSanitizedGameState(gameId);
    
    // SECURITY: Verify bonus card exists and is owned by activator
    const bonusCard = gameState?.field?.find((c: any) => c.id === bonusCardId);
    if (!bonusCard || bonusCard.type !== 'bonus' || bonusCard.owner !== activatedBy) {
      console.warn(`🔮 VOODOO SECURITY: Invalid bonus card ${bonusCardId} for ${activatedBy}`);
      return { success: false, message: 'Bonus card not found or not owned by you' };
    }
    
    // SECURITY: Verify both cards exist ON FIELD (not in hand or graveyard)
    const card1 = gameState?.field?.find((c: any) => c.id === card1Id);
    const card2 = gameState?.field?.find((c: any) => c.id === card2Id);
    
    if (!card1 || !card2) {
      console.warn(`🔮 VOODOO SECURITY: Cards not on field - card1: ${!!card1}, card2: ${!!card2}`);
      return { success: false, message: 'One or both cards not found on field' };
    }
    
    // SECURITY: Verify both cards are PERSONAGGI/PERSONAGGI_SPECIALI types only
    if ((card1.type !== 'personaggi' && card1.type !== 'personaggi_speciali') ||
        (card2.type !== 'personaggi' && card2.type !== 'personaggi_speciali')) {
      console.warn(`🔮 VOODOO SECURITY: Invalid card types - card1: ${card1.type}, card2: ${card2.type}`);
      return { success: false, message: 'Both cards must be PERSONAGGI or PERSONAGGI_SPECIALI' };
    }
    
    // SECURITY: Verify cards are different
    if (card1Id === card2Id) {
      console.warn(`🔮 VOODOO SECURITY: Attempting to link card to itself: ${card1Id}`);
      return { success: false, message: 'Cannot link a card to itself' };
    }

    // Check if either card is already linked
    const existingLink = game.voodooLinks?.find(link => 
      link.card1Id === card1Id || link.card2Id === card1Id ||
      link.card1Id === card2Id || link.card2Id === card2Id
    );
    
    if (existingLink) {
      console.warn(`🔮 VOODOO SECURITY: Card already linked - card1: ${card1Id}, card2: ${card2Id}`);
      return { success: false, message: 'One or both characters are already linked' };
    }

    // Create the voodoo link
    if (!game.voodooLinks) {
      game.voodooLinks = [];
    }
    
    game.voodooLinks.push({
      card1Id,
      card2Id,
      activatedBy,
      bonusCardId
    });

    console.log(`🔮 BAMBOLA VOODOO activated: ${card1.owner} (${card1Id}) <-> ${card2.owner} (${card2Id}) by ${activatedBy} using ${bonusCardId}`);
    
    return { 
      success: true, 
      message: `🔮 BAMBOLA VOODOO attivata! ${card1.owner} e ${card2.owner} sono ora collegati!` 
    };
  }

  // PERSISTENT DAMAGE: Process persistent damage at the start of the ATTACKER's turn
  processPersistentDamages(gameId: string, currentPlayer: string, io: any): void {
    const game = this.games.get(gameId);
    if (!game || !game.persistentDamages || game.persistentDamages.length === 0) return;

    console.log(`🔥 Processing persistent damages for game ${gameId}. Current turn owner: ${currentPlayer}. Total effects: ${game.persistentDamages.length}`);

    // Tick for ALL active persistent damages where the ATTACKER IS the currentPlayer
    // Per user request: "i danni devono essere inflitti automaticamente ogni volta che è il turno dell'utente che ha attivato quegli attacchi"
    const activeDamages = [...game.persistentDamages].filter(d => d.attacker === currentPlayer);
    
    console.log(`🔥 Active damages for attacker ${currentPlayer}: ${activeDamages.length}`);
    
    for (const damageEffect of activeDamages) {
      // 1. Check if the defender character is still on the field
      const targetCard = game.field.find(c => c.id === damageEffect.targetCardId);
      if (!targetCard) {
        // Remove persistent damage if target is gone
        game.persistentDamages = game.persistentDamages.filter(d => d.id !== damageEffect.id);
        continue;
      }

      // 2. Check if the attacker character is still on the field (Except for PUOZZA ITT L SANG)
      if (damageEffect.type !== 'PUOZZA') {
        const attackerCard = game.field.find(c => c.id === damageEffect.attackerCardId);
        if (!attackerCard || attackerCard.owner !== damageEffect.attacker) {
          // Attacker is gone or moved - skip damage tick for this turn
          console.log(`Persistent damage ${damageEffect.type} for ${damageEffect.attacker} skipped: Attacker card ${damageEffect.attackerCardId} not on field`);
          continue;
        }
      }

      // 3. Apply damage
      let damageToApply = damageEffect.damage;
      
      // Special logic for PUOZZA: Double damage each turn
      if (damageEffect.type === 'PUOZZA') {
        damageEffect.damage *= 2;
        damageToApply = damageEffect.damage;
      }

      console.log(`🔥 Persistent damage tick: ${damageEffect.type} from ${damageEffect.attacker} dealing ${damageToApply} to ${damageEffect.defender}`);
      
      // Broadcast damage tick
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-persistent-damage`,
        playerName: 'Sistema',
        message: `🔥 ${damageEffect.type}: ${damageEffect.defender} subisce ${damageToApply} danni periodici!`,
        timestamp: Date.now()
      });

      // Call processMosseDamage but with isPersistentTick=true to avoid double registration
      this.processMosseDamage(gameId, damageEffect.attacker, damageEffect.targetCardId, damageToApply, '', io, false, false, false, true);
    }
  }

  // BAMBOLA VOODOO: Remove voodoo link (when one character dies or link is broken)
  removeVoodooLink(gameId: string, cardId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || !game.voodooLinks) {
      return false;
    }

    const linkIndex = game.voodooLinks.findIndex(link => 
      link.card1Id === cardId || link.card2Id === cardId
    );
    
    if (linkIndex !== -1) {
      const removedLink = game.voodooLinks.splice(linkIndex, 1)[0];
      console.log(`🔮 BAMBOLA VOODOO link removed: ${removedLink.card1Id} <-> ${removedLink.card2Id}`);
      return true;
    }
    
    return false;
  }

  // BAMBOLA VOODOO: Get all active voodoo links for a game
  getVoodooLinks(gameId: string): VoodooLink[] {
    const game = this.games.get(gameId);
    return game?.voodooLinks || [];
  }

  // DUELLO: Start a duel between two characters
  async startDuel(gameId: string, duelCardId: string, initiatorPlayer: string, opponentCharacterId: string): Promise<{ success: boolean; message: string }> {
    const game = this.games.get(gameId);
    if (!game) {
      return { success: false, message: 'Game not found' };
    }

    // Find the opponent character
    const opponentChar = game.field.find(card => card.id === opponentCharacterId);
    if (!opponentChar) {
      return { success: false, message: 'Opponent character not found on field' };
    }

    if (opponentChar.type !== 'personaggi' && opponentChar.type !== 'personaggi_speciali') {
      return { success: false, message: 'Opponent must be a PERSONAGGI card' };
    }

    // Find initiator's character in the field
    const initiatorChars = game.field.filter(card => 
      (card.type === 'personaggi' || card.type === 'personaggi_speciali') && 
      card.owner === initiatorPlayer
    );

    if (initiatorChars.length === 0) {
      return { success: false, message: 'Initiator must have a character on the field' };
    }

    // For now, use the first character of the initiator (could be enhanced to let player choose)
    const initiatorChar = initiatorChars[0];

    // Check if duel card exists and is owned by initiator
    const duelCard = game.field.find(card => card.id === duelCardId);
    if (!duelCard || duelCard.owner !== initiatorPlayer) {
      return { success: false, message: 'DUELLO card not found or not owned by initiator' };
    }

    // Create the duel state
    game.activeDuel = {
      duelCardId,
      character1Id: initiatorChar.id,
      character2Id: opponentChar.id,
      player1: initiatorPlayer,
      player2: opponentChar.owner,
      currentTurn: initiatorPlayer, // Initiator goes first
      consecutiveTurns: 0,
      active: true
    };

    // Auto-draw MOSSE cards for both players
    const player1DrewCard = await this.pickCard(gameId, 'mosse', initiatorPlayer);
    const player2DrewCard = await this.pickCard(gameId, 'mosse', opponentChar.owner);

    if (!player1DrewCard || !player2DrewCard) {
      console.warn(`⚔️ DUELLO: One or both players couldn't draw MOSSE card`);
    }

    console.log(`⚔️ DUELLO started: ${initiatorPlayer} (${initiatorChar.id}) vs ${opponentChar.owner} (${opponentChar.id})`);
    console.log(`⚔️ DUELLO: Both players drew a MOSSE card`);
    
    return { 
      success: true, 
      message: `⚔️ DUELLO iniziato! ${initiatorPlayer} vs ${opponentChar.owner}! Entrambi i giocatori hanno pescato una carta MOSSE.`
    };
  }

  // DUELLO: End the duel
  endDuel(gameId: string, reason: string): void {
    const game = this.games.get(gameId);
    if (!game || !game.activeDuel) {
      return;
    }

    console.log(`⚔️ DUELLO ended: ${reason}`);
    game.activeDuel = undefined;
  }

  // DUELLO: Get current duel state
  getDuelState(gameId: string): DuelState | undefined {
    const game = this.games.get(gameId);
    return game?.activeDuel;
  }

  // DUELLO: Check if a character is in an active duel
  isInDuel(gameId: string, characterId: string): boolean {
    const duel = this.getDuelState(gameId);
    if (!duel || !duel.active) return false;
    
    return duel.character1Id === characterId || duel.character2Id === characterId;
  }

  // DUELLO: Switch turn in duel
  switchDuelTurn(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game || !game.activeDuel) return;

    const duel = game.activeDuel;
    
    // Decrement consecutive turns if any remain
    if (duel.consecutiveTurns > 0) {
      duel.consecutiveTurns--;
      console.log(`⚔️ DUELLO: Consecutive turn used, ${duel.consecutiveTurns} remaining for ${duel.currentTurn}`);
    }
    
    // Switch turn when no consecutive turns remain
    if (duel.consecutiveTurns === 0) {
      duel.currentTurn = duel.currentTurn === duel.player1 ? duel.player2 : duel.player1;
      console.log(`⚔️ DUELLO: Turn switches to ${duel.currentTurn}`);
    }
  }

  // NEW: Play all players' cards of specific type on field
  private async playAllCardsOnField(gameId: string, cardType: 'personaggi' | 'mosse' | 'bonus', instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    let playedCount = 0;
    const players = Object.keys(game.players);

    for (const playerName of players) {
      const player = game.players[playerName];
      const cardInHand = player.hand.find(c => c.type === cardType);
      
      if (cardInHand) {
        // Play card immediately for all players (human and CPU)
        await this.playCard(gameId, cardInHand.id, playerName);
        playedCount++;
        console.log(`${playerName} played ${cardType} card as instructed`);
        
        // SPECIAL: If CPU played MOSSE card, execute attack immediately
        if (cardType === 'mosse' && playerName.startsWith('CPU-') && player.cpuInstance) {
          console.log(`${playerName} executing MOSSE attack immediately after instruction`);
          const gameState = this.getGameState(gameId);
          if (gameState) {
            // Call CPU method to execute MOSSE attack
            const attackAction = await player.cpuInstance.executeMovesCardAndDrawReplacement(
              cardInHand.id,
              gameState,
              'mosse'
            );
            
            if (attackAction && attackAction.type === 'mosse-attack') {
              console.log(`${playerName} MOSSE attack executed:`, attackAction.data);
              
              // Execute the attack using the gameManager method
              const attackResult = await this.executeMossaAttack(
                gameId,
                attackAction.data.mosseCardId,
                attackAction.data.targetCardId,
                attackAction.data.attackerName,
                attackAction.data.targetOwner,
                attackAction.data.damage
              );
              
              console.log(`${playerName} attack result:`, attackResult);
            }
          }
        }
      }
    }

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'play-all-cards',
      cardType,
      playedCount
    }, 'Sistema');

    return { message: `🎴 ${playedCount} giocatori hanno messo in campo la loro carta ${cardType.toUpperCase()}!` };
  }

  // NEW: Play specific player's card on field
  private async playPlayerCardOnField(gameId: string, playerName: string, cardType: 'personaggi' | 'mosse' | 'bonus', instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const player = game.players[playerName];
    if (!player) {
      return { message: `❌ Giocatore ${playerName} non trovato!` };
    }

    const cardInHand = player.hand.find(c => c.type === cardType);
    if (!cardInHand) {
      return { message: `❌ ${playerName} non ha una carta ${cardType.toUpperCase()} in mano!` };
    }

    // Play card immediately for all players (human and CPU)
    await this.playCard(gameId, cardInHand.id, playerName);
    console.log(`${playerName} played ${cardType} card as instructed`);
    
    // PARASITIC CARDS: Check if PARASSITA or SAIBAIM was played and auto-attach for CPU
    const playedCard = game.field.find(c => c.id === cardInHand.id);
    if (playedCard && (playedCard.type === 'personaggi' || playedCard.type === 'personaggi_speciali')) {
      const parasiticType = this.isParasiticCard(playedCard);
      if (parasiticType && playedCard.canReattach !== false) {
        console.log(`🦠 ${parasiticType} played by ${playerName} via instruction - auto-attaching`);
        
        const targets = this.getParasiticTargets(gameId, playerName);
        if (targets.length > 0) {
          // Auto-select target (highest stars)
          const target = this.getCPUParasiticTarget(gameId, playerName);
          if (target) {
            console.log(`🦠 ${playerName} auto-targeting ${target.id} with ${parasiticType}`);
            const attachResult = await this.attachParasiticCard(gameId, playedCard.id, target.id, playerName);
            
            if (attachResult.success) {
              console.log(`🦠 ${parasiticType} attached to ${target.id} via instruction`);
            }
          }
        } else {
          console.log(`🦠 ${parasiticType} played but no valid targets available`);
        }
      }
    }
    
    // SPECIAL: If CPU played MOSSE card, execute attack immediately
    if (cardType === 'mosse' && playerName.startsWith('CPU-') && player.cpuInstance) {
      console.log(`${playerName} executing MOSSE attack immediately after instruction`);
      const gameState = this.getGameState(gameId);
      if (gameState) {
        // Call CPU method to execute MOSSE attack
        const attackAction = await player.cpuInstance.executeMovesCardAndDrawReplacement(
          cardInHand.id,
          gameState,
          'mosse'
        );
        
        if (attackAction && attackAction.type === 'mosse-attack') {
          console.log(`${playerName} MOSSE attack executed:`, attackAction.data);
          
          // Execute the attack using the gameManager method
          const attackResult = await this.executeMossaAttack(
            gameId,
            attackAction.data.mosseCardId,
            attackAction.data.targetCardId,
            attackAction.data.attackerName,
            attackAction.data.targetOwner,
            attackAction.data.damage
          );
          
          console.log(`${playerName} attack result:`, attackResult);
        }
      }
    }

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'play-player-card',
      playerName,
      cardType
    }, 'Sistema');

    return { message: `🎴 ${playerName} ha messo in campo la sua carta ${cardType.toUpperCase()}!` };
  }

  // NEW: Show card from one player to another
  private async showCardToPlayer(gameId: string, showingPlayer: string, targetPlayer: string, cardType: 'personaggi' | 'mosse' | 'bonus', instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const player = game.players[showingPlayer];
    if (!player) {
      return { message: `❌ Giocatore ${showingPlayer} non trovato!` };
    }

    const target = game.players[targetPlayer];
    if (!target) {
      return { message: `❌ Giocatore destinatario ${targetPlayer} non trovato!` };
    }

    const cardInHand = player.hand.find(c => c.type === cardType);
    if (!cardInHand) {
      return { message: `❌ ${showingPlayer} non ha una carta ${cardType.toUpperCase()} in mano!` };
    }

    // Execute show card immediately for all players (human and CPU)
    console.log(`${showingPlayer} showing ${cardType} card to ${targetPlayer} as instructed`);

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'show-card',
      showingPlayer,
      targetPlayer,
      cardType
    }, 'Sistema');

    return { 
      success: true,
      message: `👁️ ${showingPlayer} mostra la sua carta ${cardType.toUpperCase()} a ${targetPlayer}!`,
      showCard: {
        cardId: cardInHand.id,
        cardImage: cardInHand.frontImage,
        showingPlayer,
        targetPlayer,
        targetSocketId: target.socketId
      }
    };
  }
}
