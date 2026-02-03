import { CARD_DATA, DECK_BACK_IMAGES, SCENARIO_CARDS } from '../client/src/lib/cardData';
import { db } from './db';
import { matches, gameEvents, personaggi, customCards, cardModifications, users, gameStates, cardSkins, tournamentMatches, tournaments, type InsertMatch, type InsertGameEvent, type InsertCustomCard } from '../shared/schema';
import { eq, ilike, sql, and } from 'drizzle-orm';
import { CPUPlayer } from './cpuPlayer';
import { trackGameEvent } from './missionsAndAchievements';
import { getPersonaggioFromCache } from './personaggiCache';
import { jsonStorage } from './jsonStorage';

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
  youtubeUrl?: string; // URL to YouTube video to show when card is played
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
  // Custom card protection system
  isProtected?: boolean; // True if this card cannot be attacked (from custom AI effects)
  // Advanced custom effect properties
  counterDamage?: number; // Damage dealt when attacked (counter-attack)
  reflectPercent?: number; // Percentage of damage reflected back
  shieldAmount?: number; // Amount of damage absorbed by shield
  frozenTurns?: number; // Number of turns the card is frozen
  isStunned?: boolean; // Card skips next action
  poisonDamage?: number; // Damage per turn from poison
  poisonTurns?: number; // Turns remaining for poison
  burnDamage?: number; // Damage per turn from burn
  hasLifesteal?: boolean; // Attacks heal this card
  lifestealAmount?: number; // Amount of lifesteal damage
  revengeDamage?: number; // Damage dealt when card dies
  // New advanced effect properties
  criticalChance?: number; // Chance for critical hit
  bleedDamage?: number; // Bleed damage per turn
  bleedTurns?: number; // Turns remaining for bleed
  isCursed?: boolean; // Card is cursed
  curseTurns?: number; // Turns remaining for curse
  isImmune?: boolean; // Immune to negative effects
  immuneTurns?: number; // Turns remaining for immunity
  hasBarrier?: boolean; // Blocks first attack
  dodgeChance?: number; // Chance to dodge attacks
  armorAmount?: number; // Damage reduction
  regeneration?: number; // PTI regenerated per turn
  hasTaunt?: boolean; // Forces enemies to attack this card
  isStealthed?: boolean; // Cannot be targeted
  stealthTurns?: number; // Turns remaining for stealth
  isSilenced?: boolean; // Effects disabled
  silenceTurns?: number; // Turns remaining for silence
  isAsleep?: boolean; // Cannot act until hit
  isConfused?: boolean; // May hit allies
  confuseTurns?: number; // Turns remaining for confusion
  hasFear?: boolean; // Cannot attack
  fearTurns?: number; // Turns remaining for fear
  originalOwner?: string; // Original owner (for charm)
  charmTurns?: number; // Turns remaining for charm
  banishTurns?: number; // Turns remaining for banishment
  isSlowed?: boolean; // Reduced action speed
  isLocked?: boolean; // Cannot use abilities
  lockTurns?: number; // Turns remaining for lock
  isTrap?: boolean; // This card is a trap
  appliedSkinUrl?: string | null; // Custom skin URL applied to this card
  // MOSSE damage auto-fill system
  mosseDamageValue?: number | null; // Numeric PTI damage (multiplied by attacker's stars)
  mosseDamageEffect?: string | null; // Special effect: 'death', 'halve_pti', 'zero_stars', 'set_5_pti', 'remove_1_star'
  mosseCharacterOverrides?: any[] | null; // Character-specific damage/effects [{characterId, characterName, usedBy: {damageValue, effect}, usedOn: {damageValue, effect}}]
  mosseRestrictedFrom?: string[] | null; // Array of character names that cannot use this move
  mosseRestrictedAgainst?: string[] | null; // Array of character names that this move cannot be used on
  mosseTargetingMode?: string | null; // 'single', 'highest_pti', 'all_enemies', 'all_characters', 'specific_count', null=manual
  mosseTargetCount?: number | null; // Number of targets when mosseTargetingMode='specific_count'
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
  mosseEffect?: string;   // Special effect like death, halve_pti, zero_stars, set_5_pti, remove_1_star
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
  requiresApproval?: boolean; // Whether new players need creator approval to join
  creatorName?: string; // Name of the room creator
  creatorSocketId?: string; // Socket ID of the room creator
  isPlaying?: boolean; // Whether the game has started (players are playing)
  // Advanced custom effect state
  extraTurnPlayer?: string; // Player who gets an extra turn
  skipTurnPlayers?: string[]; // Players who skip their next turn
  nullifyNextEffect?: string; // Player whose next enemy effect is nullified
  doubleNextEffect?: string; // Player whose next effect is doubled
  pendingEffects?: Map<string, { type: string; cardId: string; timestamp: number; value?: number; maxTargets?: number }>; // Pending interactive effects
  pendingDiceEffects?: Map<string, {
    cardId: string;
    cardName: string;
    correctEffect: string;
    wrongEffect: string;
    involvedCharacters: Array<{ id: string; name: string; owner: string; frontImage: string }>;
    selectedCharacters?: Array<{ id: string; name: string; owner: string; frontImage: string }>; // Characters confirmed by player
    choices: Map<string, string>; // characterId -> choice (1-6, Pari, Dispari)
    initiatorPlayer?: string; // Player who initiated the dice effect
    timestamp: number;
  }>; // Pending dice roll effects
  // New advanced game state properties
  tripleNextEffect?: string; // Player whose next effect is tripled
  banishedCards?: Card[]; // Cards removed from game temporarily
  weatherEffect?: string; // Current weather effect
  weatherTurns?: number; // Turns remaining for weather
  terrainEffect?: string; // Current terrain effect
  counterSpellActive?: string; // Player with counter spell ready
  delayedDeaths?: Array<{
    cardId: string;
    cardName: string;
    owner: string;
    turnsRemaining: number;
    createdAt: number;
  }>; // Cards that will die after X turns
  pendingTargetSelections?: Map<string, {
    cardId: string;
    cardName: string;
    effectText: string;
    owner: string;
    timestamp: number;
  }>; // Pending target selection for custom effects with [BERSAGLIO: scelta]
  pendingAutoDice?: Map<string, {
    cardId: string;
    cardName: string;
    defaultEffects: Record<number, string>;
    initiatorPlayer: string;
    allowedCharacterIds: string[];
    timestamp: number;
  }>; // Pending automatic dice setups
  pendingControlledDice?: Map<string, {
    rollingPlayer: string;
    controllingPlayer: string;
    cardId: string;
    selectedCharId: string;
    selectedCharName: string;
    correctEffect: string;
    wrongEffect: string;
    cpuGuess: number;
    timestamp: number;
  }>; // Pending dice rolls controlled by dice_control effect
  pendingControlledAutoDice?: Map<string, {
    rollingPlayer: string;
    controllingPlayer: string;
    cardId: string;
    selectedCharId: string;
    selectedCharName: string;
    autoEffects: Record<number, string>;
    timestamp: number;
  }>; // Pending auto dice rolls controlled by dice_control effect
}

export class GameManager {
  private games: Map<string, GameState> = new Map();
  private playerToGame: Map<string, string> = new Map();
  private userEmailCache: Map<number, string> = new Map();
  private eventQueue: Array<{ email: string; eventType: string; data: any }> = [];
  private isProcessingQueue = false;
  private lastSaveTime: Map<string, number> = new Map(); // Throttle DB saves per game
  private saveDebounceMs = 2000; // Save at most every 2 seconds per game

  getGame(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }

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
    // Skip training games - no missions/achievements tracking
    if (gameId.startsWith('training-')) return;
    
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
      const modifications = jsonStorage.cardModifications.getAll().filter(m => m.isDeleted);
      return new Set(modifications.map(m => m.originalCardId));
    } catch (error) {
      console.error('Error loading deleted card IDs:', error);
      return new Set();
    }
  }

  async loadCardModifications(): Promise<Map<string, any>> {
    try {
      const modifications = jsonStorage.cardModifications.getAll().filter(m => !m.isDeleted);
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
            this.applyModificationToCard(card, mod);
            console.log(`✏️ Applied modifications to card ${card.id}: name=${mod.name}, effect=${mod.effect ? `"${mod.effect}"` : 'none'}, audioUrl=${mod.audioUrl}, mosseDamageValue=${mod.mosseDamageValue}, mosseDamageEffect=${mod.mosseDamageEffect}`);
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
    // MOSSE-specific fields for damage auto-fill
    if (mod.mosseDamageValue !== null && mod.mosseDamageValue !== undefined) {
      card.mosseDamageValue = mod.mosseDamageValue;
    }
    if (mod.mosseDamageEffect) {
      card.mosseDamageEffect = mod.mosseDamageEffect;
    }
    if (mod.mosseCharacterOverrides) {
      card.mosseCharacterOverrides = mod.mosseCharacterOverrides;
    }
    if (mod.mosseRestrictedFrom) {
      card.mosseRestrictedFrom = mod.mosseRestrictedFrom;
    }
    if (mod.mosseRestrictedAgainst) {
      card.mosseRestrictedAgainst = mod.mosseRestrictedAgainst;
    }
    if (mod.mosseTargetingMode) {
      card.mosseTargetingMode = mod.mosseTargetingMode;
    }
    if (mod.mosseTargetCount !== undefined && mod.mosseTargetCount !== null) {
      card.mosseTargetCount = mod.mosseTargetCount;
    }
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

  // Get all active games with details for the rooms list
  getActiveGames(): Array<{
    gameId: string;
    playerCount: number;
    players: Array<{ name: string; avatar?: string }>;
    createdAt: string;
    creatorName: string;
    creatorSocketId?: string;
    requiresApproval: boolean;
    status: string;
  }> {
    const activeGames: Array<{
      gameId: string;
      playerCount: number;
      players: Array<{ name: string; avatar?: string }>;
      createdAt: string;
      creatorName: string;
      creatorSocketId?: string;
      requiresApproval: boolean;
      status: string;
    }> = [];

    const entries = Array.from(this.games.entries());
    for (const entry of entries) {
      const gameId = entry[0];
      const game = entry[1];
      
      // Skip training games
      if (gameId.startsWith('training-')) continue;
      
      const playerNames = Object.keys(game.players);
      const players = playerNames.map(name => ({
        name,
        avatar: game.players[name]?.avatar
      }));
      
      const isPlaying = game.isPlaying || game.turnOrder.length > 0;
      
      activeGames.push({
        gameId,
        playerCount: playerNames.length,
        players,
        createdAt: game.startTime?.toISOString() || new Date().toISOString(),
        creatorName: game.creatorName || playerNames[0] || 'Unknown',
        creatorSocketId: game.creatorSocketId,
        requiresApproval: isPlaying ? true : (game.requiresApproval || false),
        status: isPlaying ? 'playing' : 'waiting'
      });
    }

    return activeGames;
  }

  async loadPermanentCardsIntoDeck(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    try {
      const permanentCards = jsonStorage.customCards.getAll();
      
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

  async addPlayer(gameId: string, playerName: string, socketId: string, isCPU: boolean = false, authenticatedUserId?: number, isApproved: boolean = false): Promise<{ success: boolean; error?: string; requiresApproval?: boolean }> {
    const isNewGame = !this.games.has(gameId);
    
    if (isNewGame) {
      const deletedCardIds = await this.loadDeletedCardIds();
      this.games.set(gameId, this.initializeGame(gameId, deletedCardIds));
      await this.createMatchRecord(gameId);
      await this.loadPermanentCardsIntoDeck(gameId);
      await this.applyCardModificationsToDecks(gameId);
    }

    const game = this.games.get(gameId)!;
    
    // Set creator info if this is the first player
    if (isNewGame && !isCPU) {
      game.creatorName = playerName;
      game.creatorSocketId = socketId;
      console.log(`Room ${gameId} created by ${playerName}`);
    }
    
    // Check if game is in progress and requires approval for new players
    const isPlaying = game.isPlaying || game.turnOrder.length > 0;
    const existingPlayer = game.players[playerName];
    
    // If game is in progress and this is a new player (not reconnecting), require approval
    if (isPlaying && !existingPlayer && !isCPU && !isApproved) {
      console.log(`🔒 Player ${playerName} needs approval to join game ${gameId} in progress`);
      return { success: false, error: 'Approval required to join game in progress', requiresApproval: true };
    }
    
    // Handle reconnection for existing player
    if (existingPlayer) {
      // SECURITY: Get original userId for this player
      const originalUserId = game.playerUserIds?.get(playerName);
      
      // SECURITY: If player has a userId binding, require matching authenticated user
      if (originalUserId) {
        if (!authenticatedUserId) {
          console.log(`🚫 SECURITY: Unauthenticated reconnection attempt to ${gameId} as ${playerName} (requires auth)`);
          return { success: false, error: 'Authentication required to rejoin as this player' };
        }
        if (originalUserId !== authenticatedUserId) {
          console.log(`🚫 SECURITY: User ${authenticatedUserId} attempted to reconnect as ${playerName} (original userId: ${originalUserId})`);
          return { success: false, error: 'Player identity mismatch - you cannot rejoin as another player' };
        }
      } else {
        // SECURITY: Player without userId binding - allow only if authenticatedUserId is also missing
        // This prevents authenticated users from hijacking guest players
        if (authenticatedUserId) {
          console.log(`🚫 SECURITY: Authenticated user ${authenticatedUserId} attempted to claim guest player ${playerName}`);
          return { success: false, error: 'Cannot claim unbound player session' };
        }
      }
      
      // Player reconnecting - preserve their hand and state, just update socket
      console.log(`🔄 Player ${playerName} reconnecting to ${gameId} - preserving hand with ${existingPlayer.hand.length} cards`);
      existingPlayer.socketId = socketId;
      existingPlayer.disconnectedAt = undefined;
      this.playerToGame.set(socketId, gameId);
      return { success: true };
    }

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
    
    return { success: true };
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
    // Capture full player name (including spaces) up to "può avere"
    const deathModifierMatch = instruction.match(/l'utente\s+(.+?)\s+pu[oò]\s+avere\s+(\d+)\s+mort[io]\s+in\s+(pi[uù]|meno)/i);
    if (deathModifierMatch) {
      const targetPlayerName = deathModifierMatch[1].trim();
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
      
      // Skip training games - no rewards, missions, or points
      if (gameId.startsWith('training-')) {
        console.log(`Training match ${gameId} completed - no rewards awarded`);
        return;
      }
      
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

      // Check if this is a tournament match and update it
      if (gameId.startsWith('tournament-')) {
        await this.updateTournamentMatch(gameId, winnerPlayer);
      }

    } catch (error) {
      console.error('Failed to complete match:', error);
    }
  }

  private async updateTournamentMatch(gameId: string, winnerPlayer?: string): Promise<void> {
    try {
      if (!winnerPlayer) return;

      const game = this.games.get(gameId);
      if (!game) {
        console.log(`Game not found for tournament update: ${gameId}`);
        return;
      }

      // Find the tournament match by gameId
      const match = await db.select().from(tournamentMatches)
        .where(eq(tournamentMatches.gameId, gameId))
        .limit(1);

      if (!match.length) {
        console.log(`No tournament match found for gameId: ${gameId}`);
        return;
      }

      const matchData = match[0];

      // Get winner's userId from game state (more reliable than DB lookup)
      let winnerId = game.playerUserIds.get(winnerPlayer);
      
      // Fallback to DB lookup if not in game state
      if (!winnerId) {
        const winnerUser = await db.select().from(users)
          .where(eq(users.username, winnerPlayer))
          .limit(1);
        if (winnerUser.length) {
          winnerId = winnerUser[0].id;
        }
      }

      if (!winnerId) {
        console.log(`Winner userId not found for: ${winnerPlayer}`);
        return;
      }

      // Validate winner is a participant
      if (matchData.player1Id !== winnerId && matchData.player2Id !== winnerId) {
        console.log(`Winner ${winnerPlayer} (${winnerId}) is not a participant in match ${matchData.id}`);
        return;
      }

      // Update match with winner
      await db.update(tournamentMatches)
        .set({ winnerId, status: 'completed', completedAt: new Date() })
        .where(eq(tournamentMatches.id, matchData.id));

      console.log(`Tournament match ${matchData.id} completed - winner: ${winnerPlayer} (${winnerId})`);

      // Check if all matches in this round are completed
      const roundMatches = await db.select().from(tournamentMatches)
        .where(and(
          eq(tournamentMatches.tournamentId, matchData.tournamentId),
          eq(tournamentMatches.round, matchData.round)
        ));

      const allCompleted = roundMatches.every(m => m.status === 'completed');

      if (allCompleted) {
        const winners = roundMatches.map(m => m.winnerId).filter(Boolean);

        if (winners.length <= 1) {
          // Tournament complete
          await db.update(tournaments)
            .set({ status: 'completed', winnerId: winners[0] || null })
            .where(eq(tournaments.id, matchData.tournamentId));
          console.log(`Tournament ${matchData.tournamentId} completed - winner: ${winners[0]}`);
        } else {
          // Create next round matches
          const nextRound = matchData.round + 1;
          const matchCount = Math.floor(winners.length / 2);

          for (let i = 0; i < matchCount; i++) {
            const p1 = winners[i * 2];
            const p2 = winners[i * 2 + 1] || null;
            const newGameId = p2 ? `tournament-${matchData.tournamentId}-r${nextRound}-m${i + 1}` : null;

            await db.insert(tournamentMatches).values({
              tournamentId: matchData.tournamentId,
              round: nextRound,
              matchNumber: i + 1,
              player1Id: p1,
              player2Id: p2,
              gameId: newGameId,
              status: p2 ? 'pending' : 'completed',
              winnerId: p2 ? null : p1
            });
          }
          console.log(`Tournament ${matchData.tournamentId} advanced to round ${nextRound}`);
        }
      }
    } catch (error) {
      console.error('Failed to update tournament match:', error);
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
      
      // Calculate game duration in minutes
      const durationSeconds = Math.floor((Date.now() - game.startTime.getTime()) / 1000);
      const durationMinutes = Math.max(1, Math.floor(durationSeconds / 60)); // At least 1 minute

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
        const isWinner = playerName === winnerPlayer;

        if (userId) {
          try {
            // Update all user statistics: points, games played, games won, minutes played
            // Check isWinner first (regardless of points) to always count wins correctly
            if (isWinner) {
              await db.execute(
                sql`UPDATE users SET 
                  punti_rankiard = punti_rankiard + ${points},
                  games_played = games_played + 1,
                  games_won = games_won + 1,
                  minutes_played = minutes_played + ${durationMinutes}
                WHERE id = ${userId}`
              );
              console.log(`Awarded ${points} Rankiard points + WIN to ${playerName} (userId: ${userId}) for ${placement}° place, +${durationMinutes} minutes`);
            } else {
              // Non-winner: update points (if any), games played, and minutes
              await db.execute(
                sql`UPDATE users SET 
                  punti_rankiard = punti_rankiard + ${points},
                  games_played = games_played + 1,
                  minutes_played = minutes_played + ${durationMinutes}
                WHERE id = ${userId}`
              );
              console.log(`Awarded ${points} Rankiard points to ${playerName} (userId: ${userId}) for ${placement}° place, +${durationMinutes} minutes`);
            }
          } catch (err) {
            console.error(`Failed to update stats for ${playerName}:`, err);
          }
        } else {
          console.log(`No userId found for ${playerName}, skipping stats update`);
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

  // Get active game ID for a player by their name (used for reconnection after server restart)
  getActiveGameByPlayerName(playerName: string): { gameId: string; handCount: number } | null {
    const gamesArray = Array.from(this.games.entries());
    for (let i = 0; i < gamesArray.length; i++) {
      const [gameId, game] = gamesArray[i];
      if (game.gameEnded) continue;
      const player = game.players[playerName];
      if (player) {
        return { 
          gameId, 
          handCount: player.hand.length 
        };
      }
    }
    return null;
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

  // Get pending interactive effect for a player
  getPendingEffect(gameId: string, playerName: string): { type: string; cardId: string; timestamp: number } | null {
    const game = this.games.get(gameId);
    if (!game || !game.pendingEffects) return null;
    return game.pendingEffects.get(playerName) || null;
  }

  // Get graveyard cards for selection
  getGraveyardCards(gameId: string): Card[] {
    const game = this.games.get(gameId);
    if (!game) return [];
    return game.graveyard;
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
  // Optimized to reduce payload size for slow connections
  getSanitizedGameState(gameId: string): any {
    const gameState = this.games.get(gameId);
    if (!gameState) return null;

    // CRITICAL: Increment eventCounter every time we broadcast state
    // This ensures client doesn't skip updates as "duplicates"
    gameState.eventCounter++;

    // OPTIMIZED: Only send deck counts, NOT full deck contents
    // Full decks are fetched separately via 'get-deck-contents' when SCEGLI modal opens
    // This reduces payload size from ~2MB to ~50KB per update
    const sanitized = {
      deckCounts: {
        personaggi: gameState.decks.personaggi.length,
        mosse: gameState.decks.mosse.length,
        bonus: gameState.decks.bonus.length,
        personaggiSpeciali: gameState.decks.personaggi_speciali.length
      },
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
      eliminatedPlayers: Array.from(gameState.eliminatedPlayers),
      voodooLinks: gameState.voodooLinks || []
    };

    // Sanitize players by removing cpuInstance references
    for (const [playerName, player] of Object.entries(gameState.players)) {
      sanitized.players[playerName] = {
        name: player.name,
        hand: player.hand,
        handCount: player.hand.length,
        socketId: player.socketId,
        isCPU: player.isCPU,
        avatar: player.avatar
      };
    }

    // Throttled save to database - save at most every 2 seconds per game
    const now = Date.now();
    const lastSave = this.lastSaveTime.get(gameId) || 0;
    if (now - lastSave >= this.saveDebounceMs) {
      this.lastSaveTime.set(gameId, now);
      // Fire and forget - don't block the response
      this.saveGameStateToDB(gameId).catch(err => 
        console.error(`Background save failed for ${gameId}:`, err)
      );
    }

    return sanitized;
  }

  // Save game state to database for persistence across server restarts
  async saveGameStateToDB(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game || game.gameEnded) return;

    try {
      // Serialize the game state, converting non-serializable types
      const serializableState = {
        decks: game.decks,
        field: game.field,
        graveyard: game.graveyard,
        scenarioCardsActive: game.scenarioCardsActive,
        matchId: game.matchId,
        eventCounter: game.eventCounter,
        startTime: game.startTime?.toISOString(),
        turnOrder: game.turnOrder,
        currentTurnIndex: game.currentTurnIndex,
        spectators: game.spectators,
        characterLimit: game.characterLimit,
        eliminatedPlayers: Array.from(game.eliminatedPlayers),
        eliminationOrder: game.eliminationOrder,
        gameEnded: game.gameEnded,
        pointsAwarded: game.pointsAwarded,
        voodooLinks: game.voodooLinks,
        persistentDamages: game.persistentDamages,
        parasiticAttachments: game.parasiticAttachments,
        rifugioProtections: game.rifugioProtections,
        barrieraShields: game.barrieraShields,
        delayedDamages: game.delayedDamages,
        playerDeathModifiers: game.playerDeathModifiers ? Object.fromEntries(game.playerDeathModifiers) : {},
        extraTurnPlayer: game.extraTurnPlayer,
        skipTurnPlayers: game.skipTurnPlayers,
        prSpentThisGame: game.prSpentThisGame ? Object.fromEntries(game.prSpentThisGame) : {},
        // Store player info without cpuInstance
        players: Object.fromEntries(
          Object.entries(game.players).map(([name, player]) => [
            name,
            {
              name: player.name,
              socketId: player.socketId,
              isCPU: player.isCPU,
              avatar: player.avatar
            }
          ])
        ),
        // Store player-game mapping
        playerUserIds: game.playerUserIds ? Object.fromEntries(game.playerUserIds) : {}
      };

      // Store player hands separately for easier access
      const playerHands: Record<string, Card[]> = {};
      for (const [playerName, player] of Object.entries(game.players)) {
        playerHands[playerName] = player.hand;
      }

      // Upsert the game state
      await db
        .insert(gameStates)
        .values({
          gameId,
          state: serializableState,
          playerHands: playerHands,
          isActive: true,
          lastUpdated: new Date()
        })
        .onConflictDoUpdate({
          target: gameStates.gameId,
          set: {
            state: serializableState,
            playerHands: playerHands,
            lastUpdated: new Date()
          }
        });

      console.log(`💾 Game state saved to DB for ${gameId} (${Object.keys(playerHands).length} players)`);
    } catch (error) {
      console.error(`❌ Failed to save game state for ${gameId}:`, error);
    }
  }

  // Load all active games from database on server startup
  async loadActiveGamesFromDB(): Promise<void> {
    try {
      // First, mark games older than 7 days as inactive to prevent data bloat
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      await db
        .update(gameStates)
        .set({ isActive: false })
        .where(and(
          eq(gameStates.isActive, true),
          sql`${gameStates.lastUpdated} < ${sevenDaysAgo.toISOString()}`
        ));
      
      // Only load active games from the last 24 hours (limit to 10 to prevent memory issues)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const activeGames = await db
        .select()
        .from(gameStates)
        .where(and(
          eq(gameStates.isActive, true),
          sql`${gameStates.lastUpdated} >= ${oneDayAgo.toISOString()}`
        ))
        .limit(10);

      console.log(`📂 Found ${activeGames.length} active games in database`);

      for (const savedGame of activeGames) {
        try {
          const state = savedGame.state as any;
          const playerHands = savedGame.playerHands as Record<string, Card[]>;
          const playerUserIds = state.playerUserIds || {};

          // Reconstruct the game state - SECURITY: Only restore players with userId binding
          const reconstructedPlayers: Record<string, Player> = {};
          let skippedPlayers = 0;
          
          for (const [playerName, playerInfo] of Object.entries(state.players as Record<string, any>)) {
            // SECURITY: Skip players without userId binding (guest/legacy) - they cannot be securely reconnected
            const hasUserId = playerUserIds[playerName] != null;
            const isCPU = (playerInfo as any).isCPU;
            
            if (!hasUserId && !isCPU) {
              console.log(`⚠️ Skipping guest player ${playerName} in ${savedGame.gameId} - no userId binding for secure reconnection`);
              skippedPlayers++;
              continue;
            }
            
            reconstructedPlayers[playerName] = {
              name: (playerInfo as any).name,
              hand: playerHands[playerName] || [],
              socketId: (playerInfo as any).socketId,
              isCPU: (playerInfo as any).isCPU,
              avatar: (playerInfo as any).avatar
            };
            // Re-register player-to-game mapping
            this.playerToGame.set(playerName, savedGame.gameId);
          }
          
          if (skippedPlayers > 0) {
            console.log(`⚠️ Skipped ${skippedPlayers} guest players in ${savedGame.gameId} - only authenticated players can reconnect after restart`);
          }

          const gameState: GameState = {
            decks: state.decks,
            players: reconstructedPlayers,
            field: state.field || [],
            graveyard: state.graveyard || [],
            scenarioCardsActive: state.scenarioCardsActive || false,
            matchId: state.matchId,
            eventCounter: state.eventCounter || 0,
            startTime: state.startTime ? new Date(state.startTime) : new Date(),
            turnOrder: state.turnOrder || [],
            currentTurnIndex: state.currentTurnIndex || 0,
            spectators: state.spectators || [],
            characterLimit: state.characterLimit || '1',
            eliminatedPlayers: new Set(state.eliminatedPlayers || []),
            eliminationOrder: state.eliminationOrder || [],
            playerUserIds: new Map(Object.entries(state.playerUserIds || {})),
            gameEnded: state.gameEnded || false,
            pointsAwarded: state.pointsAwarded || false,
            pendingTransferRequests: [],
            voodooLinks: state.voodooLinks || [],
            persistentDamages: state.persistentDamages || [],
            parasiticAttachments: state.parasiticAttachments || [],
            rifugioProtections: state.rifugioProtections || [],
            barrieraShields: state.barrieraShields || [],
            delayedDamages: state.delayedDamages || [],
            playerDeathModifiers: new Map(Object.entries(state.playerDeathModifiers || {})),
            prSpentThisGame: new Map(Object.entries(state.prSpentThisGame || {})),
            extraTurnPlayer: state.extraTurnPlayer,
            skipTurnPlayers: state.skipTurnPlayers
          };

          this.games.set(savedGame.gameId, gameState);
          console.log(`✅ Restored game ${savedGame.gameId} with ${Object.keys(reconstructedPlayers).length} players`);
        } catch (err) {
          console.error(`❌ Failed to restore game ${savedGame.gameId}:`, err);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load active games from DB:', error);
    }
  }

  // Mark a game as inactive in the database
  async markGameInactive(gameId: string): Promise<void> {
    try {
      await db
        .update(gameStates)
        .set({ isActive: false })
        .where(eq(gameStates.gameId, gameId));
      console.log(`🔒 Game ${gameId} marked as inactive in DB`);
    } catch (error) {
      console.error(`❌ Failed to mark game ${gameId} as inactive:`, error);
    }
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

  async playCard(gameId: string, cardId: string, playerName: string): Promise<{ card?: any, isPersonaggio?: boolean, duelAutoAttack?: boolean, customAnimation?: string }> {
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
      card.owner = playerName; // IMPORTANT: Set owner when card is played
      
      // If it's a BONUS or MOSSE being placed on the field, initialize turn counter
      if ((card.type === 'bonus' || card.type === 'mosse')) {
        card.turnCounter = 0;
        card.placedBy = playerName;
      }

      game.field.push(card);
      
      // Check if it's a PERSONAGGI or PERSONAGGI_SPECIALI card
      const isPersonaggio = card.type === 'personaggi' || card.type === 'personaggi_speciali';
      
      // Auto-analyze cards for ALL players (PERSONAGGI only) - ALWAYS set PTI from cache
      if (isPersonaggio) {
        // Always run sync analysis to ensure PTI values are set
        this.autoAnalyzePersonaggioCardSync(card, playerName);
        console.log(`📊 Card ${card.id} PTI set: pti=${card.pti}, stars=${card.stars}, name=${card.name}`);
        
        // If cache missed (default values), trigger async lookup in background for humans
        if (card.pti === 1000 && !card.text?.includes('originali')) {
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
      
      // Process custom card effect if present (works for all cards with effects - custom, permanent, or modified)
      // Check both effect field AND text field for effect descriptions
      const effectText = card.effect || '';
      const textContent = card.text || '';
      const combinedEffect = effectText || textContent;
      const hasEffect = this.cardHasCustomEffect(effectText, textContent);
      
      console.log(`📋 Card played: ${card.id} (${card.name || 'unnamed'}), effect: ${effectText ? `"${effectText}"` : 'NONE'}, text: ${textContent ? `"${textContent.substring(0, 50)}..."` : 'NONE'}, hasEffect: ${hasEffect}`);
      let customAnimation: string | undefined;
      if (hasEffect) {
        // Use effect field if available, otherwise use text field as effect
        const effectToProcess = effectText || textContent;
        const cardWithEffect = { ...card, effect: effectToProcess };
        console.log(`✨ Card has effect - triggering processCustomCardEffect for ${card.id}: "${effectToProcess.substring(0, 100)}..."`);
        const effectResult = await this.processCustomCardEffect(gameId, cardWithEffect, playerName);
        customAnimation = effectResult.customAnimation;
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
      
      return { card, isPersonaggio, duelAutoAttack, customAnimation };
    }
    
    return {};
  }

  // Parse effect text using keywords (no AI required) - ENHANCED VERSION with 50+ patterns
  private parseEffectKeywords(effectText: string): Array<{ type: string; target: string; value: number; description: string }> {
    const actions: Array<{ type: string; target: string; value: number; description: string }> = [];
    
    // SUPPORT FOR MULTIPLE EFFECTS: Split by " | " separator and process each effect
    if (effectText.includes(' | ')) {
      const multipleEffects = effectText.split(' | ');
      console.log(`🎴 Multiple effects detected (${multipleEffects.length}): processing each separately`);
      for (const singleEffect of multipleEffects) {
        const singleActions = this.parseEffectKeywords(singleEffect.trim());
        actions.push(...singleActions);
      }
      return actions;
    }
    
    // Extract and parse structured sections from wizard [ANIMAZIONE: ...] [COMPORTAMENTO: ...] [DETTAGLI: ...]
    let cleanText = effectText;
    let detailsData: Record<string, string> = {};
    
    // Extract [DETTAGLI: key: value; key2: value2]
    const detailsMatch = effectText.match(/\[DETTAGLI:\s*([^\]]+)\]/i);
    if (detailsMatch) {
      const detailsStr = detailsMatch[1];
      detailsStr.split(';').forEach(pair => {
        const colonIdx = pair.indexOf(':');
        if (colonIdx > -1) {
          const key = pair.substring(0, colonIdx).trim().toLowerCase();
          const value = pair.substring(colonIdx + 1).trim();
          detailsData[key] = value;
        }
      });
      cleanText = cleanText.replace(/\[DETTAGLI:[^\]]+\]/gi, '');
    }
    
    // Extract [COMPORTAMENTO: ...] content - THIS IS THE ACTUAL EFFECT TO PARSE
    let comportamentoContent = '';
    const comportamentoMatch = effectText.match(/\[COMPORTAMENTO:\s*([^\]]+)\]/i);
    if (comportamentoMatch) {
      comportamentoContent = comportamentoMatch[1].trim();
      console.log(`🎯 Extracted COMPORTAMENTO content: "${comportamentoContent}"`);
    }
    
    // Remove [ANIMAZIONE: ...] tags (visual only)
    cleanText = cleanText.replace(/\[ANIMAZIONE:[^\]]+\]/gi, '');
    // Remove [COMPORTAMENTO: ...] tags from cleanText (we already extracted the content)
    cleanText = cleanText.replace(/\[COMPORTAMENTO:[^\]]+\]/gi, '');
    
    // Use COMPORTAMENTO content as primary parsing source, fallback to cleaned text
    const textToParse = comportamentoContent || cleanText;
    const text = textToParse.toLowerCase();
    
    // Extract all numbers from text (for multi-value effects)
    const extractNumber = (str: string, defaultVal: number = 100): number => {
      const match = str.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : defaultVal;
    };
    
    // Extract multiple numbers
    const extractAllNumbers = (str: string): number[] => {
      const matches = str.match(/\d+/g);
      return matches ? matches.map(n => parseInt(n, 10)) : [];
    };
    
    // Determine target from structured details or text
    const determineTarget = (txt: string): string => {
      // First check structured details
      const targetDetail = detailsData['target'] || detailsData['bersaglio'] || '';
      if (targetDetail) {
        const t = targetDetail.toLowerCase();
        if (t.includes('tutti i nemici') || t.includes('tutti gli avversari')) return 'all_opponents';
        if (t.includes('tutti')) return 'all';
        if (t.includes('casuale') || t.includes('random')) return 'random';
        if (t.includes('alleato') || t.includes('alleati')) return 'allies';
        if (t.includes('nemico') || t.includes('avversario')) return 'opponents';
        if (t.includes('mio personaggio') || t.includes('attivo') || t.includes('personaggio attivo')) return 'self';
      }
      
      if (txt.includes('tutti i nemici') || txt.includes('tutti gli avversari') || txt.includes('ogni avversario')) return 'all_opponents';
      if (txt.includes('tutti') || txt.includes('ogni personaggio') || txt.includes('ognuno')) return 'all';
      if (txt.includes('casuale') || txt.includes('random') || txt.includes('a caso')) return 'random';
      if (txt.includes('alleato') || txt.includes('alleati') || txt.includes('compagno')) return 'allies';
      if (txt.includes('nemico') || txt.includes('avversario') || txt.includes('nemici') || txt.includes('avversari')) return 'opponents';
      if (txt.includes('se stesso') || txt.includes('questo personaggio') || txt.includes('questa carta')) return 'self';
      return 'opponents'; // default
    };
    
    // Extract value from structured details
    const getDetailValue = (keys: string[], defaultVal: number): number => {
      for (const key of keys) {
        if (detailsData[key]) {
          const num = parseInt(detailsData[key], 10);
          if (!isNaN(num)) return num;
        }
      }
      return defaultVal;
    };

    // ============ DAMAGE PATTERNS ============
    if (text.includes('danno') || text.includes('danni') || text.includes('infligge') || text.includes('danneggia') || 
        text.includes('colpisce') || text.includes('attacca') || text.includes('ferisce') || text.includes('distrugge') ||
        text.includes('elimina') || text.includes('uccide') || text.includes('fa male') || text.includes('subisce') ||
        text.includes('fa perdere') || text.includes('toglie') || text.includes('sottrae') || text.includes('leva') ||
        text.includes('causa') || text.includes('provoca') || text.includes('perde pti') || text.includes('perde vita')) {
      const value = getDetailValue(['damage_amount', 'danni', 'danno', 'valore'], extractNumber(text));
      const target = determineTarget(text);
      actions.push({ type: 'damage', target, value, description: `Infligge ${value} danni` });
    }

    // ============ HEAL PATTERNS ============
    if (text.includes('cura') || text.includes('guarisce') || text.includes('ripristina pti') || 
        text.includes('rigenera') || text.includes('recupera') || text.includes('guadagna pti') ||
        text.includes('ottiene pti') || text.includes('vita +') || text.includes('+ pti') ||
        text.includes('aggiunge pti') || text.includes('riguadagna') || text.includes('riacquista') ||
        text.includes('si cura') || text.includes('viene curato') || text.includes('aumenta pti') ||
        text.includes('pti in più') || text.includes('guadagna vita') || text.includes('ripara')) {
      const value = getDetailValue(['heal_amount', 'cura', 'guarigione', 'valore'], extractNumber(text));
      const target = determineTarget(text);
      actions.push({ type: 'heal', target: target === 'opponents' ? 'self' : target, value, description: `Cura ${value} PTI` });
    }

    // ============ DRAW PATTERNS ============
    if (text.includes('pesca') || text.includes('prendi carta') || text.includes('estrai') || 
        text.includes('prendere carta') || text.includes('pescare') || text.includes('tira una carta') ||
        text.includes('carta dal mazzo') || text.includes('aggiungi alla mano') || text.includes('prendi dal mazzo') ||
        text.includes('metti in mano') || text.includes('aggiungi in mano') || text.includes('carta in mano') ||
        text.includes('ottieni carta') || text.includes('guadagna carta') || text.includes('ricevi carta')) {
      const value = extractNumber(text, 1);
      let deckType = 'any';
      if (text.includes('personaggio') || text.includes('personaggi')) deckType = 'personaggi';
      if (text.includes('mosse') || text.includes('mossa')) deckType = 'mosse';
      if (text.includes('bonus')) deckType = 'bonus';
      if (text.includes('special') || text.includes('speciale')) deckType = 'personaggi_speciali';
      actions.push({ type: 'draw', target: 'self', value, description: `Pesca ${value} carte` });
    }

    // ============ DISCARD PATTERNS ============
    if (text.includes('scarta') || text.includes('elimina dalla mano') || text.includes('butta') ||
        text.includes('getta via') || text.includes('rimuovi dalla mano') || text.includes('perde carta') ||
        text.includes('perde una carta') || text.includes('sacrifica') || text.includes('abbandona') ||
        text.includes('lascia') || text.includes('si libera di') || text.includes('rinuncia a')) {
      const value = extractNumber(text, 1);
      const target = determineTarget(text);
      actions.push({ type: 'discard', target, value, description: `Scarta ${value} carte` });
    }

    // ============ STARS PATTERNS ============
    if (text.includes('stella') || text.includes('stelle') || text.includes('star')) {
      const value = extractNumber(text, 1);
      if (text.includes('guadagna') || text.includes('ottiene') || text.includes('+') || text.includes('aggiunge') || text.includes('riceve')) {
        actions.push({ type: 'modify_stars', target: 'self', value, description: `Guadagna ${value} stelle` });
      } else if (text.includes('perde') || text.includes('rimuovi') || text.includes('-') || text.includes('toglie') || text.includes('sottrae')) {
        actions.push({ type: 'modify_stars', target: 'opponents', value: -value, description: `Rimuove ${value} stelle` });
      }
    }

    // ============ PTI MODIFICATION PATTERNS ============
    if ((text.includes('pti') || text.includes('punti')) && !actions.some(a => a.type === 'damage' || a.type === 'heal')) {
      const value = extractNumber(text);
      if (text.includes('aumenta') || text.includes('+') || text.includes('guadagna') || text.includes('aggiunge') || text.includes('bonus')) {
        actions.push({ type: 'heal', target: 'self', value, description: `Aumenta PTI di ${value}` });
      } else if (text.includes('diminuisce') || text.includes('-') || text.includes('riduce') || text.includes('toglie') || text.includes('malus')) {
        actions.push({ type: 'damage', target: 'opponents', value, description: `Riduce PTI di ${value}` });
      }
    }

    // Helper to extract duration from details or text
    const getDuration = (defaultVal: number): number => {
      const durVal = detailsData['duration'] || detailsData['durata'] || '';
      if (durVal) {
        if (durVal.toLowerCase().includes('permanente')) return 999;
        if (durVal.toLowerCase().includes('istantaneo')) return 0;
        const num = parseInt(durVal, 10);
        if (!isNaN(num)) return num;
        const match = durVal.match(/(\d+)/);
        if (match) return parseInt(match[1], 10);
      }
      return extractNumber(text, defaultVal);
    };

    // ============ PROTECTION/IMMUNITY PATTERNS ============
    if (text.includes('non può essere attaccat') || text.includes('immune') || 
        text.includes('invulnerabile') || text.includes('protetto') || text.includes('protezione') ||
        text.includes('non può ricevere dann') || text.includes('intoccabile') ||
        text.includes('cannot be attacked') || text.includes('invincibile') || text.includes('inattaccabile') ||
        text.includes('non subisce') || text.includes('ignora i danni') || text.includes('ignora attacchi') ||
        text.includes('blocca attacchi') || text.includes('blocca danni') || text.includes('resistente') ||
        text.includes('impenetrabile') || text.includes('blindato') || text.includes('corazzato')) {
      const turns = getDuration(1);
      actions.push({ type: 'protection', target: 'self', value: turns || 1, description: turns > 0 ? `Protezione per ${turns} turni` : 'Non può essere attaccato' });
    }

    // ============ COUNTER-ATTACK PATTERNS ============
    if (text.includes('contrattacco') || text.includes('contrattacca') || text.includes('quando viene attaccato') ||
        text.includes('risponde') || text.includes('reagisce') || text.includes('colpisce di ritorno') ||
        text.includes('restituisce il colpo') || text.includes('se attaccato') || text.includes('in risposta')) {
      const value = getDetailValue(['damage_amount', 'valore', 'danni'], extractNumber(text));
      actions.push({ type: 'counter', target: 'self', value, description: `Contrattacco: infligge ${value} danni` });
    }

    // ============ REFLECT PATTERNS ============
    if (text.includes('riflette') || text.includes('restituisce') || text.includes('rimbalza') ||
        text.includes('respinge') || text.includes('devia') || text.includes('rinvia') ||
        text.includes('ritorna indietro') || text.includes('torna al mittente')) {
      const value = getDetailValue(['valore', 'percentuale'], extractNumber(text, 50));
      actions.push({ type: 'reflect', target: 'self', value, description: `Riflette ${value}% dei danni` });
    }

    // ============ STEAL PATTERNS ============
    if ((text.includes('ruba') || text.includes('sottrae') || text.includes('prende') || text.includes('furto')) && 
        (text.includes('carta') || text.includes('carte') || text.includes('mano'))) {
      const value = getDetailValue(['valore', 'carte'], extractNumber(text, 1));
      const target = determineTarget(text);
      actions.push({ type: 'steal', target: target === 'self' ? 'opponents' : target, value, description: `Ruba ${value} carte` });
    }

    // ============ FREEZE PATTERNS ============
    if (text.includes('congela') || text.includes('congelamento') || text.includes('non può agire') ||
        text.includes('ghiaccia') || text.includes('immobilizza') || text.includes('paralizza') ||
        text.includes('blocca') || text.includes('ferma') || text.includes('non può muoversi') ||
        text.includes('non può attaccare') || text.includes('cristallizza') || text.includes('iberna')) {
      const value = getDuration(2);
      const target = determineTarget(text);
      actions.push({ type: 'freeze', target: target === 'self' ? 'opponents' : target, value, description: `Congela per ${value} turni` });
    }

    // ============ STUN PATTERNS ============
    if (text.includes('stordis') || text.includes('stordimento') || text.includes('salta il turno') ||
        text.includes('confonde') || text.includes('tramortisce') || text.includes('svenimento') ||
        text.includes('perde il turno') || text.includes('turno perso') || text.includes('knockout')) {
      const turns = getDuration(1);
      const target = determineTarget(text);
      actions.push({ type: 'stun', target: target === 'self' ? 'opponents' : target, value: turns, description: `Stordisce per ${turns} turno/i` });
    }

    // ============ POISON PATTERNS ============
    if (text.includes('veleno') || text.includes('avvelena') || text.includes('tossico') ||
        text.includes('intossica') || text.includes('infetta') || text.includes('virus') ||
        text.includes('contamina') || text.includes('corrompe') || text.includes('danni nel tempo')) {
      const value = getDetailValue(['damage_amount', 'valore', 'danni'], extractNumber(text, 50));
      const target = determineTarget(text);
      actions.push({ type: 'poison', target: target === 'self' ? 'opponents' : target, value, description: `Veleno: ${value} danni/turno` });
    }

    // ============ BURN PATTERNS ============
    if (text.includes('brucia') || text.includes('bruciatura') || text.includes('fiamme') ||
        text.includes('incendia') || text.includes('fuoco') || text.includes('infuoca') ||
        text.includes('scottatura') || text.includes('incenerisce') || text.includes('carbonizza')) {
      const value = getDetailValue(['damage_amount', 'valore', 'danni'], extractNumber(text, 30));
      const target = determineTarget(text);
      actions.push({ type: 'burn', target: target === 'self' ? 'opponents' : target, value, description: `Bruciatura: ${value} danni/turno` });
    }

    // ============ LIFESTEAL PATTERNS ============
    if (text.includes('furto vita') || text.includes('vita rubata') || text.includes('assorbe vita') ||
        text.includes('drena vita') || text.includes('vampiro') || text.includes('succhia vita') ||
        text.includes('si cura dei danni') || text.includes('converte in vita') || text.includes('risucchia energia') ||
        (text.includes('danni') && text.includes('cura') && text.includes('stesso'))) {
      const value = getDetailValue(['damage_amount', 'valore'], extractNumber(text));
      actions.push({ type: 'lifesteal', target: 'self', value, description: `Furto Vita: ${value}` });
    }

    // ============ SHIELD PATTERNS ============
    if ((text.includes('scudo') || text.includes('barriera') || text.includes('armatura')) && !text.includes('attacco')) {
      const value = getDetailValue(['valore', 'scudo', 'assorbimento'], extractNumber(text, 200));
      actions.push({ type: 'shield', target: 'self', value, description: `Scudo: assorbe ${value} danni` });
    }

    // ============ DRAIN PATTERNS ============
    if (text.includes('assorbe') || text.includes('assorbimento') || text.includes('drain') ||
        text.includes('risucchia') || text.includes('prosciuga') || text.includes('svuota')) {
      const value = getDetailValue(['valore', 'drain'], extractNumber(text));
      const target = determineTarget(text);
      if (!actions.some(a => a.type === 'lifesteal')) {
        actions.push({ type: 'drain', target: target === 'self' ? 'opponents' : target, value, description: `Assorbe ${value}` });
      }
    }

    // ============ REVENGE PATTERNS ============
    if (text.includes('vendetta') || text.includes('quando muore') || text.includes('alla morte') ||
        text.includes('morendo') || text.includes('se muore') || text.includes('ultimo respiro') ||
        text.includes('grido di morte') || text.includes('sacrificio finale') || text.includes('epitaffio')) {
      const value = getDetailValue(['damage_amount', 'valore', 'danni'], extractNumber(text, 200));
      actions.push({ type: 'revenge', target: 'self', value, description: `Vendetta: ${value} danni alla morte` });
    }

    // ============ EXTRA TURN PATTERNS ============
    if (text.includes('turno extra') || text.includes('turno aggiuntivo') || text.includes('gioca di nuovo') ||
        text.includes('altro turno') || text.includes('ripeti turno') || text.includes('turno bonus') ||
        text.includes('gioca ancora') || text.includes('continua a giocare') || text.includes('doppio turno')) {
      actions.push({ type: 'extra_turn', target: 'self', value: 1, description: 'Turno extra' });
    }

    // ============ SKIP TURN PATTERNS ============
    if ((text.includes('salta il turno') || text.includes('perde il turno') || text.includes('turno saltato')) && 
        (text.includes('avversario') || text.includes('nemico'))) {
      const target = determineTarget(text);
      actions.push({ type: 'skip_turn', target: target === 'self' ? 'opponents' : target, value: 1, description: 'L\'avversario salta il turno' });
    }

    // ============ NULLIFY PATTERNS ============
    if (text.includes('nullifica') || text.includes('annulla') || text.includes('nega') ||
        text.includes('cancella') || text.includes('blocca effetto') || text.includes('ignora effetto') ||
        text.includes('disattiva') || text.includes('rimuove effetto') || text.includes('neutralizza')) {
      const target = determineTarget(text);
      actions.push({ type: 'nullify', target: target === 'self' ? 'opponents' : target, value: 1, description: 'Nullifica effetto nemico' });
    }

    // ============ RESURRECT PATTERNS ============
    if (text.includes('resuscita') || text.includes('riporta in vita') || text.includes('cimitero') || 
        text.includes('ripristina carta') || text.includes('richiama') || text.includes('riporta') ||
        text.includes('rianima') || text.includes('revival') || text.includes('ritorna in gioco') ||
        text.includes('recupera dal cimitero') || text.includes('fa tornare') || text.includes('risorge') ||
        text.includes('resuscitare') || text.includes('resurrezione') || text.includes('reincarna')) {
      const requiresChoice = text.includes('scelta') || text.includes('scegli') || 
                             text.includes('pannello') || text.includes('quale carta') ||
                             text.includes('a tua scelta') || text.includes('che vuoi') ||
                             text.includes('che preferisci') || text.includes('seleziona');
      const value = getDetailValue(['valore', 'carte'], extractNumber(text, 1));
      actions.push({ 
        type: requiresChoice ? 'resurrect_choice' : 'resurrect', 
        target: 'self', 
        value, 
        description: requiresChoice ? 'Scegli una carta dal cimitero da resuscitare' : 'Resuscita carta dal cimitero' 
      });
    }

    // ============ POWERUP PATTERNS ============
    if (text.includes('potenzia') || text.includes('potenziamento') || text.includes('boost') ||
        text.includes('rafforza') || text.includes('amplifica') || text.includes('migliora') ||
        text.includes('incrementa') || text.includes('aumenta forza') || text.includes('power up')) {
      const value = getDetailValue(['valore', 'potenziamento', 'pti'], extractNumber(text));
      const target = determineTarget(text);
      actions.push({ type: 'powerup', target: target === 'opponents' ? 'self' : target, value, description: `Potenziamento: +${value} PTI` });
    }

    // ============ WEAKEN PATTERNS ============
    if (text.includes('indebolis') || text.includes('indebolimento') || text.includes('riduce la forza') ||
        text.includes('depotenzia') || text.includes('azzoppa') || text.includes('fiacca') ||
        text.includes('snerva') || text.includes('riduce potenza') || text.includes('meno forte')) {
      const value = getDetailValue(['valore', 'indebolimento'], extractNumber(text));
      const target = determineTarget(text);
      actions.push({ type: 'weaken', target: target === 'self' ? 'opponents' : target, value, description: `Indebolisce: -${value} PTI` });
    }

    // ============ AURA PATTERNS ============
    if (text.includes('aura') || text.includes('alleati guadagnano') || text.includes('carte alleate') ||
        text.includes('buff di gruppo') || text.includes('tutti i tuoi') || text.includes('potenzia alleati') ||
        text.includes('benedice') || text.includes('ispira') || text.includes('rinforza alleati')) {
      const value = getDetailValue(['valore', 'aura'], extractNumber(text, 50));
      actions.push({ type: 'aura', target: 'allies', value, description: `Aura: +${value} PTI agli alleati` });
    }

    // ============ DOUBLE PATTERNS ============
    if (text.includes('raddoppia') || text.includes('doppio') || text.includes('x2') ||
        text.includes('duplica') || text.includes('moltiplica per 2') || text.includes('effetto doppio')) {
      actions.push({ type: 'double', target: 'self', value: 2, description: 'Raddoppia effetto' });
    }

    // ============ TRIPLE PATTERNS ============
    if (text.includes('triplica') || text.includes('triplo') || text.includes('x3') ||
        text.includes('moltiplica per 3') || text.includes('effetto triplo')) {
      actions.push({ type: 'triple', target: 'self', value: 3, description: 'Triplica effetto' });
    }

    // ============ COPY PATTERNS ============
    if (text.includes('copia') || text.includes('imita') || text.includes('clone') ||
        text.includes('duplica effetto') || text.includes('replica') || text.includes('mima')) {
      actions.push({ type: 'copy', target: 'any', value: 1, description: 'Copia effetto di un\'altra carta' });
    }

    // ============ SWAP PATTERNS ============
    if (text.includes('scambia') || text.includes('inverti') || text.includes('swap') ||
        text.includes('cambia') || text.includes('sostituisci')) {
      actions.push({ type: 'swap', target: 'any', value: 1, description: 'Scambia con un\'altra carta' });
    }

    // ============ TRANSFORM PATTERNS ============
    if (text.includes('trasforma') || text.includes('muta') || text.includes('evolve') ||
        text.includes('diventa') || text.includes('si trasforma') || text.includes('metamorfosi')) {
      actions.push({ type: 'transform', target: 'self', value: 1, description: 'Si trasforma in un\'altra carta' });
    }

    // ============ SILENCE PATTERNS ============
    if (text.includes('silenzia') || text.includes('silenzio') || text.includes('muta') ||
        text.includes('disabilita effetti') || text.includes('rimuove abilità') || text.includes('blocca poteri')) {
      actions.push({ type: 'silence', target: 'opponents', value: 1, description: 'Silenzia: rimuove gli effetti nemici' });
    }

    // ============ TAUNT PATTERNS ============
    if (text.includes('provocazione') || text.includes('provoca') || text.includes('taunt') ||
        text.includes('attira') || text.includes('attira attenzione') || text.includes('bersaglio obbligato')) {
      actions.push({ type: 'taunt', target: 'self', value: 1, description: 'Provocazione: deve essere attaccato per primo' });
    }

    // ============ EXECUTE PATTERNS ============
    if (text.includes('esecuzione') || text.includes('elimina se') || text.includes('morte istantanea') ||
        text.includes('uccide se') || text.includes('elimina istantaneamente') || text.includes('finisher')) {
      const threshold = extractNumber(text, 300);
      actions.push({ type: 'execute', target: 'opponents', value: threshold, description: `Esecuzione se PTI < ${threshold}` });
    }

    // ============ RETURN TO HAND PATTERNS ============
    if ((text.includes('ritorna') || text.includes('torna') || text.includes('rimetti') || text.includes('rimanda')) && 
        (text.includes('mano') || text.includes('hand'))) {
      const value = extractNumber(text, 1);
      actions.push({ type: 'return_to_hand', target: 'any', value, description: `Rimanda ${value} carte in mano` });
    }

    // ============ RETURN TO DECK PATTERNS ============
    if ((text.includes('ritorna') || text.includes('torna') || text.includes('rimetti') || text.includes('rimanda') || text.includes('rimescola')) && 
        (text.includes('mazzo') || text.includes('deck'))) {
      const value = extractNumber(text, 1);
      actions.push({ type: 'return_to_deck', target: 'any', value, description: `Rimanda ${value} carte nel mazzo` });
    }

    // ============ REVEAL PATTERNS ============
    if (text.includes('rivela') || text.includes('mostra') || text.includes('scopri') ||
        text.includes('guarda') || text.includes('visualizza')) {
      actions.push({ type: 'reveal', target: 'any', value: 1, description: 'Rivela carte' });
    }

    // ============ RANDOM EFFECT PATTERNS ============
    if (text.includes('effetto casuale') || text.includes('effetto random') || text.includes('a caso')) {
      actions.push({ type: 'random_effect', target: 'any', value: 1, description: 'Effetto casuale' });
    }

    // ============ INHERIT FROM DEAD PATTERNS ============
    if ((text.includes('personaggio morto') || text.includes('carta morta') || text.includes('morto prima') ||
         text.includes('ultimo morto') || text.includes('precedente morto') || text.includes('avvoltoio')) &&
        (text.includes('aggiunge') || text.includes('ottiene') || text.includes('eredita') || 
         text.includes('prende') || text.includes('guadagna') || text.includes('assorbe'))) {
      actions.push({ type: 'inherit_from_dead', target: 'self', value: 1, description: 'Eredita PTI e stelle dal personaggio morto' });
    }

    // ============ CLONE SELF PATTERNS ============
    if (text.includes('si clona') || text.includes('clona se stesso') || text.includes('si duplica') ||
        text.includes('crea una copia di se') || text.includes('crea un clone') || text.includes('si sdoppia')) {
      actions.push({ type: 'clone_self', target: 'self', value: 1, description: 'Si clona sul campo' });
    }

    // ============ HALVE/DOUBLE PATTERNS ============
    if (text.includes('dimezza') && text.includes('pti')) {
      const target = text.includes('avversario') || text.includes('nemico') || text.includes('bersaglio') ? 'enemy_card' : 'self';
      actions.push({ type: 'halve_pti', target, value: 50, description: 'Dimezza i PTI' });
    }
    if (text.includes('dimezza') && text.includes('stelle')) {
      const target = text.includes('avversario') || text.includes('nemico') || text.includes('bersaglio') ? 'enemy_card' : 'self';
      actions.push({ type: 'halve_stars', target, value: 50, description: 'Dimezza le stelle' });
    }
    if (text.includes('raddoppia') && text.includes('pti')) {
      const target = text.includes('avversario') || text.includes('nemico') || text.includes('bersaglio') ? 'enemy_card' : 'self';
      actions.push({ type: 'double_pti', target, value: 200, description: 'Raddoppia i PTI' });
    }
    if (text.includes('raddoppia') && text.includes('stelle')) {
      const target = text.includes('avversario') || text.includes('nemico') || text.includes('bersaglio') ? 'enemy_card' : 'self';
      actions.push({ type: 'double_stars', target, value: 200, description: 'Raddoppia le stelle' });
    }
    if ((text.includes('aggiunge') || text.includes('aggiungi')) && text.includes('metà') && text.includes('pti')) {
      actions.push({ type: 'add_half_pti', target: 'self', value: 50, description: 'Aggiunge la metà dei PTI attuali' });
    }
    if ((text.includes('aggiunge') || text.includes('aggiungi')) && text.includes('metà') && text.includes('stelle')) {
      actions.push({ type: 'add_half_stars', target: 'self', value: 50, description: 'Aggiunge la metà delle stelle attuali' });
    }
    if ((text.includes('0 stelle') || text.includes('zero stelle') || text.includes('azzera stelle') || text.includes('porta le stelle a 0'))) {
      const target = text.includes('avversario') || text.includes('nemico') || text.includes('bersaglio') ? 'enemy_card' : 'self';
      actions.push({ type: 'zero_stars', target, value: 0, description: 'Porta le stelle a 0' });
    }

    // ============ ABSORB PTI PATTERNS ============
    if ((text.includes('assorbe') || text.includes('assorbi') || text.includes('ruba')) && 
        text.includes('pti') && (text.includes('avversario') || text.includes('nemico') || text.includes('aggiunge a te'))) {
      const value = extractNumber(text, 100);
      actions.push({ type: 'absorb_pti', target: 'enemy_card', value, description: `Assorbe ${value} PTI da un avversario` });
    }

    // ============ CONTROL TURN PATTERNS ============
    if ((text.includes('controlla') || text.includes('controlli')) && 
        (text.includes('turno') || text.includes('avversario'))) {
      actions.push({ type: 'control_turn', target: 'opponent', value: 1, description: 'Controlla un avversario al suo turno' });
    }

    // ============ SEND TO DECK PATTERNS ============
    if ((text.includes('manda') || text.includes('rimanda') || text.includes('rispedisci')) && 
        (text.includes('mazzo') || text.includes('deck'))) {
      const target = text.includes('nemica') || text.includes('nemico') || text.includes('avversario') ? 'enemy_card' : 'ally_card';
      actions.push({ type: 'send_to_deck', target, value: 1, description: 'Manda una carta nel mazzo' });
    }

    // ============ REFLECT ATTACK PATTERNS ============
    if ((text.includes('respingi') || text.includes('respinge') || text.includes('rifletti') || text.includes('rimanda')) && 
        (text.includes('attacco') || text.includes('danno') || text.includes('mittente'))) {
      actions.push({ type: 'reflect_attack', target: 'attacker', value: 100, description: 'Respinge l\'attacco al mittente' });
    }

    // ============ INSURANCE/ASSICURAZIONE PATTERN ============
    // "Assicurazione": Subtract PTI now, restore them when character would die
    if ((text.includes('assicurazione') || text.includes('assicura')) ||
        (text.includes('scende a 0') && text.includes('non muore') && text.includes('aggiungendosi')) ||
        (text.includes('tolti') && text.includes('0 pti') && text.includes('resta in campo'))) {
      actions.push({ type: 'insurance_effect', target: 'self', value: 0, description: effectText });
    }

    // ============ PANEL INPUT PATTERNS ============
    // Recognize various ways to request PTI input panel
    // First, remove PTI statistics from text to avoid false positives (e.g. "PTI: 300 | Stelle: 1")
    const textWithoutStats = text.replace(/pti:\s*\d+/gi, '').replace(/pti originali:\s*\d+/gi, '').replace(/stelle:\s*\d+/gi, '');
    
    const wantsPtiPanel = (
      // Direct panel request - must include action words, not just "pannello pti" from dice control descriptions
      (textWithoutStats.includes('pannello') && (textWithoutStats.includes('inserire') || textWithoutStats.includes('inserisci') || textWithoutStats.includes('quantità'))) ||
      // Input request variants
      ((textWithoutStats.includes('inserire') || textWithoutStats.includes('inserisci') || textWithoutStats.includes('digita') || textWithoutStats.includes('scrivi') || textWithoutStats.includes('immetti')) && 
       (textWithoutStats.includes('pti') || textWithoutStats.includes('quantità') || textWithoutStats.includes('valore') || textWithoutStats.includes('punti'))) ||
      // Choice/selection with amount
      ((textWithoutStats.includes('scegli') || textWithoutStats.includes('scelta') || textWithoutStats.includes('chiedi')) && 
       (textWithoutStats.includes('quanti pti') || textWithoutStats.includes('quantità di pti') || textWithoutStats.includes('ammontare'))) ||
      // Show input variants - must be about entering PTI, not just showing a panel
      ((textWithoutStats.includes('mostra') || textWithoutStats.includes('apri') || textWithoutStats.includes('visualizza')) && 
       textWithoutStats.includes('input') && textWithoutStats.includes('pti')) ||
      // Italian common phrases - inserimento required
      (textWithoutStats.includes('campo') && textWithoutStats.includes('inserimento') && textWithoutStats.includes('pti'))
    );
    
    // Don't add PTI panel if this is a dice control effect (pannello for choosing dice, not PTI)
    const isDiceControlEffect = text.includes('dice_control') || text.includes('dado') && (text.includes('scegli') || text.includes('sceglie') || text.includes('decid'));
    
    if (wantsPtiPanel && !actions.some(a => a.type === 'insurance_effect') && !isDiceControlEffect) {
      actions.push({ type: 'show_pti_input_panel', target: 'self', value: 0, description: effectText });
    }

    // ============ GRAVEYARD SELECTION PATTERNS ============
    const wantsGraveyardPanel = (
      // Direct graveyard selection
      ((text.includes('cimitero') || text.includes('morto') || text.includes('morti') || text.includes('graveyard')) && 
       (text.includes('scegli') || text.includes('scelta') || text.includes('riporta') || text.includes('pannello') || 
        text.includes('seleziona') || text.includes('pesca') || text.includes('recupera') || text.includes('resurrezione'))) ||
      // Revival/resurrection requests
      ((text.includes('risorgi') || text.includes('resurrezione') || text.includes('riporta in vita') || text.includes('rivivi')) && 
       (text.includes('carta') || text.includes('personaggio'))) ||
      // Show graveyard for selection
      ((text.includes('mostra') || text.includes('apri') || text.includes('visualizza')) && text.includes('cimitero'))
    );
    
    if (wantsGraveyardPanel) {
      actions.push({ type: 'show_graveyard_selection', target: 'self', value: 1, description: 'Scegli una carta dal cimitero' });
    }

    // ============ DECK SELECTION PATTERNS ============
    const wantsDeckPanel = (
      // Direct deck selection
      ((text.includes('mazzo') || text.includes('mazzi') || text.includes('deck')) && 
       (text.includes('scegli') || text.includes('scelta') || text.includes('pannello') || text.includes('apri') ||
        text.includes('seleziona') || text.includes('pesca') || text.includes('prendi'))) ||
      // Type-specific deck access
      ((text.includes('personaggi') || text.includes('mosse') || text.includes('bonus') || text.includes('speciali')) && 
       text.includes('mazzo') && (text.includes('scegli') || text.includes('pesca') || text.includes('prendi'))) ||
      // Show deck for selection
      ((text.includes('mostra') || text.includes('apri') || text.includes('visualizza')) && 
       (text.includes('mazzo') || text.includes('mazzi')))
    );
    
    if (wantsDeckPanel) {
      actions.push({ type: 'show_deck_selection', target: 'self', value: 1, description: 'Scegli carte dai mazzi' });
    }

    // ============ CYCLE/ROTATE PATTERNS (Ciclone effect) ============
    if ((text.includes('ciclone') || text.includes('ciclo') || 
         (text.includes('utente successivo') && text.includes('carte')) ||
         (text.includes('passa') && text.includes('carte') && text.includes('successivo')) ||
         (text.includes('do le mie carte') && text.includes('utente successivo')) ||
         (text.includes('rotazione') && text.includes('carte'))) &&
        !actions.some(a => a.type === 'cycle_cards')) {
      actions.push({ type: 'cycle_cards', target: 'all', value: 1, description: 'Rotazione carte tra tutti i giocatori' });
    }

    // ============ DICE CONTROL PATTERNS (Modifica dado) ============
    if ((text.includes('dado') || text.includes('dice') || text.includes('lancio')) &&
        (text.includes('modifica') || text.includes('scegli') || text.includes('sceglie') ||
         text.includes('controlla') || text.includes('manipola') || text.includes('decide') ||
         text.includes('annulla') || text.includes('rilancia') || text.includes('cambiar'))) {
      actions.push({ type: 'dice_control', target: 'self', value: 1, description: 'Controllo del dado: il giocatore può scegliere il risultato' });
    }

    // ============ CONDITIONAL PATTERNS ============
    if ((text.includes('se ') || text.includes('quando ') || text.includes('ogni volta che')) &&
        !text.includes('pannello') && !text.includes('inserire') &&
        !actions.some(a => a.type === 'cycle_cards')) {
      // Mark as conditional for special handling (but not if it's a panel effect or cycle effect)
      actions.push({ type: 'conditional', target: 'self', value: 0, description: effectText });
    }

    // ============ NEW ATTACK PATTERNS ============
    if (text.includes('a tutti') && (text.includes('danno') || text.includes('danni'))) {
      const value = extractNumber(text);
      actions.push({ type: 'damage_all', target: 'all', value, description: `Danno a tutti: ${value}` });
    }

    if (text.includes('casuale') && (text.includes('danno') || text.includes('danni') || text.includes('colpisce'))) {
      const value = extractNumber(text);
      actions.push({ type: 'damage_random', target: 'random', value, description: `Danno casuale: ${value}` });
    }

    if (text.includes('esecuzione') || text.includes('elimina istantaneamente') || text.includes('uccide se pti')) {
      const value = extractNumber(text, 300);
      actions.push({ type: 'execute', target: 'opponents', value, description: `Esecuzione sotto ${value} PTI` });
    }

    if (text.includes('penetrazione') || text.includes('ignora scudi') || text.includes('ignora protezioni')) {
      const value = extractNumber(text);
      actions.push({ type: 'pierce', target: 'opponents', value, description: `Penetrazione: ${value} danni` });
    }

    if (text.includes('critico') || text.includes('colpo critico') || text.includes('danni doppi')) {
      const value = extractNumber(text, 50);
      actions.push({ type: 'critical', target: 'self', value, description: `${value}% critico` });
    }

    if (text.includes('sanguinamento') || text.includes('sanguina')) {
      const value = extractNumber(text, 40);
      actions.push({ type: 'bleed', target: 'opponents', value, description: `Sanguinamento: ${value}/turno` });
    }

    if (text.includes('maledizione') || text.includes('maledice')) {
      const value = extractNumber(text, 3);
      actions.push({ type: 'curse', target: 'opponents', value, description: `Maledizione per ${value} turni` });
    }

    if (text.includes('esplosione') || text.includes('esplode') || text.includes('danni ad area')) {
      const value = extractNumber(text, 150);
      actions.push({ type: 'explosion', target: 'opponents', value, description: `Esplosione: ${value} danni` });
    }

    // ============ NEW DEFENSE PATTERNS ============
    if (text.includes('immunità') || text.includes('immune a effetti')) {
      const value = extractNumber(text, 2);
      actions.push({ type: 'immunity', target: 'self', value, description: `Immunità per ${value} turni` });
    }

    if (text.includes('barriera') && !text.includes('scudo')) {
      actions.push({ type: 'barrier', target: 'self', value: 1, description: 'Barriera attiva' });
    }

    if (text.includes('schivata') || text.includes('schiva') || text.includes('evita attacchi')) {
      const value = extractNumber(text, 30);
      actions.push({ type: 'dodge', target: 'self', value, description: `${value}% schivata` });
    }

    if (text.includes('armatura') && !text.includes('scudo')) {
      const value = extractNumber(text, 50);
      actions.push({ type: 'armor', target: 'self', value, description: `Armatura: -${value} danni ricevuti` });
    }

    if (text.includes('rigenerazione') || text.includes('rigenera ogni turno') || text.includes('recupera ogni turno')) {
      const value = extractNumber(text, 50);
      actions.push({ type: 'regeneration', target: 'self', value, description: `Rigenerazione: ${value}/turno` });
    }

    if (text.includes('invisibilità') || text.includes('invisibile') || text.includes('non può essere bersagliato')) {
      const value = extractNumber(text, 2);
      actions.push({ type: 'stealth', target: 'self', value, description: `Invisibile per ${value} turni` });
    }

    // ============ NEW SUPPORT PATTERNS ============
    if ((text.includes('cura') || text.includes('guarisce')) && text.includes('tutti gli alleati')) {
      const value = extractNumber(text);
      actions.push({ type: 'heal_all', target: 'allies', value, description: `Cura di gruppo: ${value} PTI` });
    }

    if (text.includes('buff') || (text.includes('potenzia') && text.includes('alleato'))) {
      const value = extractNumber(text, 100);
      actions.push({ type: 'buff', target: 'allies', value, description: `Buff: +${value} PTI` });
    }

    if (text.includes('purifica') || text.includes('purificazione') || text.includes('rimuove effetti negativi')) {
      actions.push({ type: 'cleanse', target: 'allies', value: 1, description: 'Purificazione' });
    }

    if (text.includes('benedizione') || text.includes('benedice')) {
      const value = extractNumber(text, 50);
      actions.push({ type: 'bless', target: 'self', value, description: `Benedizione: +${value} PTI` });
    }

    if (text.includes('ispirazione') || text.includes('ispira')) {
      const value = extractNumber(text, 30);
      actions.push({ type: 'inspire', target: 'allies', value, description: `Ispirazione: +${value} PTI` });
    }

    if (text.includes('rinascita potenziata') || (text.includes('resuscita') && text.includes('extra'))) {
      const value = extractNumber(text, 200);
      actions.push({ type: 'revive_boost', target: 'self', value, description: `Rinascita: +${value} PTI` });
    }

    // ============ NEW CONTROL PATTERNS ============
    if (text.includes('silenzio') || text.includes('silenzia') || text.includes('disabilita effetti')) {
      const value = extractNumber(text, 2);
      actions.push({ type: 'silence', target: 'opponents', value, description: `Silenzio per ${value} turni` });
    }

    if (text.includes('sonno') || text.includes('addormenta')) {
      actions.push({ type: 'sleep', target: 'opponents', value: 1, description: 'Sonno' });
    }

    if (text.includes('confusione') || (text.includes('confonde') && !text.includes('stordis'))) {
      const value = extractNumber(text, 2);
      actions.push({ type: 'confuse', target: 'opponents', value, description: `Confusione per ${value} turni` });
    }

    if (text.includes('paura') || text.includes('terrorizza') || text.includes('non può attaccare')) {
      const value = extractNumber(text, 2);
      actions.push({ type: 'fear', target: 'opponents', value, description: `Paura per ${value} turni` });
    }

    if (text.includes('charme') || text.includes('controlla') || text.includes('seduce')) {
      const value = extractNumber(text, 1);
      actions.push({ type: 'charm', target: 'opponents', value, description: `Charme per ${value} turni` });
    }

    if (text.includes('esilio') || text.includes('esilia') || text.includes('bandisce')) {
      const value = extractNumber(text, 2);
      actions.push({ type: 'banish', target: 'opponents', value, description: `Esilio per ${value} turni` });
    }

    if (text.includes('rallentamento') || text.includes('rallenta')) {
      actions.push({ type: 'slow', target: 'opponents', value: 1, description: 'Rallentamento' });
    }

    if (text.includes('blocco abilità') || text.includes('blocca abilità') || text.includes('impedisce')) {
      const value = extractNumber(text, 2);
      actions.push({ type: 'lock', target: 'opponents', value, description: `Blocco per ${value} turni` });
    }

    // ============ NEW CARD PATTERNS ============
    if (text.includes('pesca') && (text.includes('specifico') || text.includes('specifica') || text.includes('tipo'))) {
      const value = extractNumber(text, 1);
      actions.push({ type: 'draw_specific', target: 'self', value, description: `Pesca specifica: ${value}` });
    }

    if (text.includes('rivela') || text.includes('mostra mano')) {
      actions.push({ type: 'reveal', target: 'opponents', value: 1, description: 'Rivela mano' });
    }

    if (text.includes('mescola') || text.includes('rimescola')) {
      actions.push({ type: 'shuffle', target: 'any', value: 1, description: 'Mescola' });
    }

    if (text.includes('cerca nel mazzo') || text.includes('cerca carta')) {
      actions.push({ type: 'search', target: 'self', value: 1, description: 'Cerca nel mazzo' });
    }

    if (text.includes('ritorna in mano') || text.includes('riporta in mano')) {
      const value = extractNumber(text, 1);
      actions.push({ type: 'return_hand', target: 'any', value, description: `Ritorna ${value} in mano` });
    }

    if (text.includes('ritorna nel mazzo') || text.includes('riporta nel mazzo') || text.includes('rimetti nel mazzo')) {
      const value = extractNumber(text, 1);
      actions.push({ type: 'return_deck', target: 'any', value, description: `Ritorna ${value} nel mazzo` });
    }

    if (text.includes('milling') || text.includes('scarta dal mazzo')) {
      const value = extractNumber(text, 3);
      actions.push({ type: 'mill', target: 'opponents', value, description: `Mill: ${value} carte` });
    }

    // ============ NEW SPECIAL PATTERNS ============
    if (text.includes('clone') || text.includes('clona') || text.includes('crea copia')) {
      actions.push({ type: 'clone', target: 'self', value: 1, description: 'Clona' });
    }

    if (text.includes('concatenazione') || text.includes('catena') || text.includes('colpisce in sequenza')) {
      const value = extractNumber(text, 3);
      actions.push({ type: 'chain', target: 'opponents', value, description: `Catena: ${value} bersagli` });
    }

    if (text.includes('combo') || text.includes('combinato')) {
      const value = extractNumber(text, 50);
      actions.push({ type: 'combo', target: 'self', value, description: `Combo: +${value}%` });
    }

    if (text.includes('fusione') || text.includes('fonde') || text.includes('unisce')) {
      actions.push({ type: 'fusion', target: 'self', value: 1, description: 'Fusione' });
    }

    if (text.includes('divisione') || text.includes('divide') || text.includes('separa')) {
      const value = extractNumber(text, 2);
      actions.push({ type: 'split', target: 'self', value, description: `Divide in ${value}` });
    }

    if (text.includes('teletrasporto') || text.includes('teletrasporta')) {
      actions.push({ type: 'teleport', target: 'any', value: 1, description: 'Teletrasporto' });
    }

    if (text.includes('viaggio nel tempo') || text.includes('ritorna al turno')) {
      const value = extractNumber(text, 1);
      actions.push({ type: 'time_travel', target: 'all', value, description: `Viaggio nel tempo: ${value} turni` });
    }

    // ============ OTHER PATTERNS ============
    if (text.includes('meteo') || text.includes('clima') || text.includes('condizioni atmosferiche')) {
      const value = extractNumber(text, 3);
      actions.push({ type: 'weather', target: 'all', value, description: 'Meteo cambiato' });
    }

    if (text.includes('terreno') || text.includes('modifica campo')) {
      actions.push({ type: 'terrain', target: 'all', value: 1, description: 'Terreno modificato' });
    }

    if (text.includes('trappola') || text.includes('si attiva quando')) {
      actions.push({ type: 'trap', target: 'self', value: 1, description: 'Trappola' });
    }

    if (text.includes('contromagia') || text.includes('annulla prossima mossa')) {
      actions.push({ type: 'counter_spell', target: 'opponents', value: 1, description: 'Contromagia' });
    }

    if (text.includes('scommessa') || text.includes('50%') || text.includes('rischio')) {
      const value = extractNumber(text, 100);
      actions.push({ type: 'gamble', target: 'self', value, description: `Scommessa: ${value} PTI` });
    }

    if (text.includes('mimetismo') || text.includes('mimetico') || text.includes('copia statistiche')) {
      actions.push({ type: 'mimic', target: 'any', value: 1, description: 'Mimetismo' });
    }

    // ============ SPECIAL/GENERIC PATTERNS (fallback) ============
    if (actions.length === 0 && text.length > 5) {
      actions.push({ type: 'special', target: 'self', value: 0, description: effectText });
    }

    console.log(`🎴 Parsed "${effectText.substring(0, 50)}..." → ${actions.length} actions: ${actions.map(a => a.type).join(', ')}`);
    return actions;
  }

  // Process custom card effect using AI or keyword parsing
  async processCustomCardEffect(gameId: string, card: Card, playerName: string): Promise<{ customAnimation?: string }> {
    const game = this.games.get(gameId);
    if (!game || !card.effect) return {};

    console.log(`🎴 Processing custom card effect for ${card.name || card.id}: "${card.effect}"`);
    
    // Check for BERSAGLIO: scelta (target choice) - must select targets first
    const bersaglioMatch = card.effect.match(/\[BERSAGLIO:\s*scelta\]/i);
    if (bersaglioMatch) {
      console.log(`🎯 Card has BERSAGLIO: scelta - requesting target selection`);
      
      const io = (global as any).io;
      if (!io) {
        console.log('❌ No io instance available for target selection');
        return {};
      }
      
      // Get all characters on field for target selection
      const allFieldChars = game.field.filter((c: Card) => 
        c.type === 'personaggi' || c.type === 'personaggi_speciali'
      );
      
      if (allFieldChars.length === 0) {
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-target-no-chars`,
          playerName: 'Sistema',
          message: `🎯 Non ci sono personaggi in campo da selezionare!`,
          timestamp: Date.now()
        });
        return {};
      }
      
      // Store pending target selection
      if (!game.pendingTargetSelections) {
        game.pendingTargetSelections = new Map();
      }
      
      const cardName = card.name || this.getCardNameFromUrl(card.frontImage || '');
      const selectionId = `target-${Date.now()}`;
      game.pendingTargetSelections.set(selectionId, {
        cardId: card.id,
        cardName,
        effectText: card.effect.replace(/\[BERSAGLIO:\s*scelta\]/i, '').trim(),
        owner: playerName,
        timestamp: Date.now()
      });
      
      // CPU AUTONOMOUS HANDLING: If the player is CPU, auto-select targets immediately
      if (this.isPlayerCPU(gameId, playerName)) {
        console.log(`🤖 CPU ${playerName} auto-selecting targets for BERSAGLIO effect`);
        
        // CPU selects 1-2 random targets (prefer enemies if available)
        const ownChars = allFieldChars.filter((c: Card) => c.owner === playerName);
        const enemyChars = allFieldChars.filter((c: Card) => c.owner !== playerName);
        
        let selectedTargets: Card[] = [];
        
        // Prefer selecting both own and enemy character for "gamble" style effects
        if (ownChars.length > 0 && enemyChars.length > 0) {
          const ownTarget = ownChars[Math.floor(Math.random() * ownChars.length)];
          const enemyTarget = enemyChars[Math.floor(Math.random() * enemyChars.length)];
          selectedTargets = [ownTarget, enemyTarget];
        } else if (enemyChars.length >= 2) {
          // Select 2 random enemies
          const shuffled = [...enemyChars].sort(() => Math.random() - 0.5);
          selectedTargets = shuffled.slice(0, 2);
        } else if (allFieldChars.length >= 2) {
          // Select 2 random from all
          const shuffled = [...allFieldChars].sort(() => Math.random() - 0.5);
          selectedTargets = shuffled.slice(0, 2);
        } else {
          // Just pick 1
          selectedTargets = [allFieldChars[Math.floor(Math.random() * allFieldChars.length)]];
        }
        
        const selectedTargetIds = selectedTargets.map(c => c.id);
        const selectedTargetNames = selectedTargets.map(c => c.name || this.getCardNameFromUrl(c.frontImage || ''));
        
        console.log(`🎯 CPU ${playerName} confirmed target selection: ${selectedTargetIds.length} targets`);
        console.log(`🎯 CPU selected targets: ${selectedTargetNames.join(', ')}`);
        
        // Process the target selection immediately
        setTimeout(async () => {
          await this.processTargetSelection(gameId, selectionId, selectedTargetIds, playerName, io);
        }, 500);
        
        return {};
      }
      
      // Human player: Emit event for custom target selection UI
      io.to(gameId).emit('show-custom-target-selection', {
        selectionId,
        cardId: card.id,
        cardName,
        owner: playerName,
        availableTargets: allFieldChars.map((c: Card) => ({
          id: c.id,
          name: c.name || this.getCardNameFromUrl(c.frontImage || ''),
          owner: c.owner,
          frontImage: c.frontImage || '',
          pti: c.pti,
          stars: c.stars
        }))
      });
      
      return {};
    }
    
    // Extract custom animation from effect text [ANIMAZIONE: ...]
    const animationMatch = card.effect.match(/\[ANIMAZIONE:\s*([^\]]+)\]/i);
    const customAnimation = animationMatch ? animationMatch[1].trim() : undefined;
    if (customAnimation) {
      console.log(`🎬 Custom animation found: "${customAnimation}"`);
    }

    // Check for DICE (DADO) effect - [DADO: Se indovina: X; Se sbaglia: Y]
    const diceMatch = card.effect.match(/\[DADO:\s*Se indovina:\s*([^;]+);\s*Se sbaglia:\s*([^\]]+)\]/i);
    if (diceMatch) {
      const correctEffect = diceMatch[1].trim();
      const wrongEffect = diceMatch[2].trim();
      console.log(`🎲 DICE effect detected! Correct: "${correctEffect}", Wrong: "${wrongEffect}"`);
      
      // Create dice effect and store it
      const diceEffectId = `dice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Get all characters on field that will be involved in the dice roll
      const involvedCharacters = game.field
        .filter((c: Card) => c.type === 'personaggi' || c.type === 'personaggi_speciali')
        .map((c: Card) => ({
          id: c.id,
          name: c.name || this.getCardNameFromUrl(c.frontImage || ''),
          owner: c.owner,
          frontImage: c.frontImage || ''
        }));
      
      if (involvedCharacters.length > 0) {
        const io = (global as any).io;
        const cardOwner = card.owner || playerName;
        const isCPU = this.isPlayerCPU(gameId, cardOwner);
        
        if (isCPU) {
          // CPU auto-handles dice effect: select random character and roll dice
          console.log(`🤖 CPU ${cardOwner} auto-handling dice effect`);
          
          // Check if card has [BERSAGLIO: scelta] - if so, target enemy; otherwise target own character
          const hasTargetChoice = card.effect.toLowerCase().includes('[bersaglio:') || 
                                  card.effect.toLowerCase().includes('bersaglio:');
          
          let selectedChar;
          if (hasTargetChoice) {
            // Card targets an enemy character (like attacks)
            const enemyChars = involvedCharacters.filter((c: any) => c.owner !== cardOwner);
            selectedChar = enemyChars.length > 0 
              ? enemyChars[Math.floor(Math.random() * enemyChars.length)]
              : involvedCharacters[Math.floor(Math.random() * involvedCharacters.length)];
            console.log(`🎲 DADO with target choice - targeting enemy: ${selectedChar.name}`);
          } else {
            // Card affects own character (like gambles/scommesse)
            const ownChars = involvedCharacters.filter((c: any) => c.owner === cardOwner);
            selectedChar = ownChars.length > 0 
              ? ownChars[Math.floor(Math.random() * ownChars.length)]
              : involvedCharacters[Math.floor(Math.random() * involvedCharacters.length)];
            console.log(`🎲 DADO without target - affecting own character: ${selectedChar.name}`);
          }
          
          // CHECK FOR DICE CONTROL: Does any player have a card that controls the dice?
          const diceControl = this.checkDiceControlEffect(gameId, cardOwner);
          
          if (diceControl.hasDiceControl && diceControl.controllingPlayer !== cardOwner) {
            // Someone else controls the dice! Show panel to them and wait
            console.log(`🎲 DICE CONTROL ACTIVE: ${diceControl.controllingPlayer} controls the dice via ${diceControl.cardName}`);
            
            // Store pending dice roll for when controller chooses
            if (!game.pendingControlledDice) game.pendingControlledDice = new Map();
            const pendingId = `controlled-dice-${Date.now()}`;
            game.pendingControlledDice.set(pendingId, {
              rollingPlayer: cardOwner,
              controllingPlayer: diceControl.controllingPlayer!,
              cardId: card.id,
              selectedCharId: selectedChar.id,
              selectedCharName: selectedChar.name,
              correctEffect,
              wrongEffect,
              cpuGuess: Math.floor(Math.random() * 6) + 1,
              timestamp: Date.now()
            });
            
            if (io) {
              io.to(gameId).emit('show-dice-control-panel', {
                pendingId,
                rollingPlayer: cardOwner,
                controllingPlayer: diceControl.controllingPlayer,
                controllingCardId: diceControl.cardId,
                controllingCardName: diceControl.cardName,
                targetCharName: selectedChar.name
              });
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-dice-control`,
                playerName: 'Sistema',
                message: `🎲 ${cardOwner} sta per lanciare il dado, ma ${diceControl.controllingPlayer} (con ${diceControl.cardName}) può controllare il risultato!`,
                timestamp: Date.now()
              });
            }
            // Don't return card yet - wait for dice control response
          } else {
            // No dice control or controller is the one rolling - proceed normally
            const diceRoll = Math.floor(Math.random() * 6) + 1;
            const cpuGuess = Math.floor(Math.random() * 6) + 1;
            const isCorrect = diceRoll === cpuGuess;
            const effectToApply = isCorrect ? correctEffect : wrongEffect;
            
            console.log(`🎲 CPU ${cardOwner}: Rolled ${diceRoll}, guessed ${cpuGuess}, ${isCorrect ? 'CORRECT!' : 'WRONG!'} → "${effectToApply}"`);
            
            // EMIT DICE ANIMATION to all players
            if (io) {
              io.to(gameId).emit('dice-rolled', { result: diceRoll, playerName: cardOwner });
            }
            
            // Apply effect to selected character
            const targetCard = game.field.find((c: Card) => c.id === selectedChar.id);
            if (targetCard) {
              // Parse and apply dice effect
              const effectLower = effectToApply.toLowerCase();
              if (effectLower.includes('raddoppia')) {
                if (effectLower.includes('pti')) targetCard.pti = (targetCard.pti || 0) * 2;
                if (effectLower.includes('stelle')) targetCard.stars = (targetCard.stars || 0) * 2;
                console.log(`🎲 Applied: ${selectedChar.name} doubled stats to ${targetCard.pti} PTI, ${targetCard.stars} stars`);
              } else if (effectLower.includes('dimezza')) {
                if (effectLower.includes('pti')) targetCard.pti = Math.floor((targetCard.pti || 0) / 2);
                if (effectLower.includes('stelle')) targetCard.stars = Math.floor((targetCard.stars || 0) / 2);
                console.log(`🎲 Applied: ${selectedChar.name} halved stats to ${targetCard.pti} PTI, ${targetCard.stars} stars`);
              } else if (effectLower.includes('morte')) {
                targetCard.pti = 0;
                this.moveToGraveyard(gameId, targetCard.id, targetCard.owner || '', cardOwner);
                console.log(`🎲 Applied: ${selectedChar.name} died from dice effect`);
              }
              this.updateCardTextWithPTI(targetCard);
            }
            
            // Send chat message about CPU action
            if (io) {
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-cpu-dice`,
                playerName: 'Sistema',
                message: `🎲 CPU ${cardOwner} ha lanciato il dado! Risultato: ${diceRoll}, ha scelto ${cpuGuess} - ${isCorrect ? '✅ Indovinato!' : '❌ Sbagliato!'} Effetto: "${effectToApply}" applicato a ${selectedChar.name}`,
                timestamp: Date.now()
              });
            }
            
            // Return card to bottom of deck
            this.returnToDeck(gameId, card.id, cardOwner);
          }
        } else {
          // Human player: show character selection panel
          // Store pending dice effect (will be updated when player confirms characters)
          if (!game.pendingDiceEffects) game.pendingDiceEffects = new Map();
          game.pendingDiceEffects.set(diceEffectId, {
            cardId: card.id,
            cardName: card.name || this.getCardNameFromUrl(card.frontImage || ''),
            correctEffect,
            wrongEffect,
            involvedCharacters, // All available characters
            selectedCharacters: [], // Will be set when player confirms
            choices: new Map<string, string>(), // characterId -> choice
            initiatorPlayer: cardOwner,
            timestamp: Date.now()
          });
          
          // Emit character selection event to the initiator player
          if (io) {
            console.log(`🎲 EMITTING show-dice-character-select to room ${gameId} with ${involvedCharacters.length} available characters`);
            io.to(gameId).emit('show-dice-character-select', {
              diceEffectId,
              cardName: card.name || this.getCardNameFromUrl(card.frontImage || ''),
              correctEffect,
              wrongEffect,
              availableCharacters: involvedCharacters,
              initiatorPlayer: cardOwner
            });
          } else {
            console.log('❌ No io instance available for dice character selection event');
          }
        }
      }
      
      return { customAnimation };
    }

    // Check for AUTOMATIC DICE (DADO_AUTOMATICO) effect - [DADO_AUTOMATICO: 1: X; 2: Y; ...]
    const autoDiceMatch = card.effect.match(/\[DADO_AUTOMATICO:\s*([^\]]+)\]/i);
    if (autoDiceMatch) {
      const effectsStr = autoDiceMatch[1].trim();
      console.log(`🎲 AUTOMATIC DICE effect detected! Effects: "${effectsStr}"`);
      
      // Parse effects for each number (1: effect; 2: effect; ...)
      const autoEffects: Record<number, string> = {};
      const effectPairs = effectsStr.split(';');
      for (const pair of effectPairs) {
        const match = pair.match(/(\d):\s*(.+)/);
        if (match) {
          const num = parseInt(match[1]);
          autoEffects[num] = match[2].trim();
        }
      }
      
      // Get all characters on field that can be selected
      const availableCharacters = game.field
        .filter((c: Card) => c.type === 'personaggi' || c.type === 'personaggi_speciali')
        .map((c: Card) => ({
          id: c.id,
          name: c.name || this.getCardNameFromUrl(c.frontImage || ''),
          owner: c.owner,
          frontImage: c.frontImage || '',
          pti: c.pti,
          stars: c.stars
        }));
      
      if (availableCharacters.length > 0) {
        const io = (global as any).io;
        const cardOwner = card.owner || playerName;
        const isCPU = this.isPlayerCPU(gameId, cardOwner);
        
        if (isCPU) {
          // CPU auto-handles automatic dice: select target and roll
          console.log(`🤖 CPU ${cardOwner} auto-handling automatic dice effect`);
          
          // Check if card has [BERSAGLIO: scelta] - if so, target enemy; otherwise target own character
          const hasTargetChoice = card.effect.toLowerCase().includes('[bersaglio:') || 
                                  card.effect.toLowerCase().includes('bersaglio:');
          
          let selectedChar;
          if (hasTargetChoice) {
            // Card targets an enemy character (like attacks)
            const enemyChars = availableCharacters.filter((c: any) => c.owner !== cardOwner);
            selectedChar = enemyChars.length > 0 
              ? enemyChars[Math.floor(Math.random() * enemyChars.length)]
              : availableCharacters[Math.floor(Math.random() * availableCharacters.length)];
            console.log(`🎲 AUTO DADO with target choice - targeting enemy: ${selectedChar.name}`);
          } else {
            // Card affects own character (like gambles/scommesse)
            const ownChars = availableCharacters.filter((c: any) => c.owner === cardOwner);
            selectedChar = ownChars.length > 0 
              ? ownChars[Math.floor(Math.random() * ownChars.length)]
              : availableCharacters[Math.floor(Math.random() * availableCharacters.length)];
            console.log(`🎲 AUTO DADO without target - affecting own character: ${selectedChar.name}`);
          }
          
          // CHECK FOR DICE CONTROL: Does any player have a card that controls the dice?
          const diceControl = this.checkDiceControlEffect(gameId, cardOwner);
          
          if (diceControl.hasDiceControl && diceControl.controllingPlayer !== cardOwner) {
            // Someone else controls the dice! Show panel to them and wait
            console.log(`🎲 DICE CONTROL ACTIVE for AUTO DICE: ${diceControl.controllingPlayer} controls via ${diceControl.cardName}`);
            
            // Store pending auto dice roll for when controller chooses
            if (!game.pendingControlledAutoDice) game.pendingControlledAutoDice = new Map();
            const pendingId = `controlled-auto-dice-${Date.now()}`;
            game.pendingControlledAutoDice.set(pendingId, {
              rollingPlayer: cardOwner,
              controllingPlayer: diceControl.controllingPlayer!,
              cardId: card.id,
              selectedCharId: selectedChar.id,
              selectedCharName: selectedChar.name,
              autoEffects,
              timestamp: Date.now()
            });
            
            if (io) {
              io.to(gameId).emit('show-dice-control-panel', {
                pendingId,
                rollingPlayer: cardOwner,
                controllingPlayer: diceControl.controllingPlayer,
                controllingCardId: diceControl.cardId,
                controllingCardName: diceControl.cardName,
                targetCharName: selectedChar.name,
                isAutoDice: true
              });
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-dice-control-auto`,
                playerName: 'Sistema',
                message: `🎲 ${cardOwner} sta per lanciare il dado automatico, ma ${diceControl.controllingPlayer} (con ${diceControl.cardName}) può controllare il risultato!`,
                timestamp: Date.now()
              });
            }
            // Don't return card yet - wait for dice control response
          } else {
            // No dice control - proceed normally
            const diceRoll = Math.floor(Math.random() * 6) + 1;
            const effectToApply = autoEffects[diceRoll] || 'Nessun effetto';
            
            console.log(`🎲 CPU ${cardOwner}: Auto dice rolled ${diceRoll} → "${effectToApply}"`);
            
            // EMIT DICE ANIMATION to all players
            if (io) {
              io.to(gameId).emit('dice-rolled', { result: diceRoll, playerName: cardOwner });
            }
            
            // Apply effect
            const targetCard = game.field.find((c: Card) => c.id === selectedChar.id);
            if (targetCard) {
              const effectLower = effectToApply.toLowerCase();
              if (effectLower.includes('morte') || effectLower.includes('muore')) {
                const turnsMatch = effectToApply.match(/(\d+)\s*turn/i);
                if (turnsMatch) {
                  const turns = parseInt(turnsMatch[1]);
                  (targetCard as any).deathCountdown = turns;
                  console.log(`🎲 Applied: ${selectedChar.name} will die in ${turns} turns`);
                } else {
                  targetCard.pti = 0;
                  this.moveToGraveyard(gameId, targetCard.id, targetCard.owner || '', cardOwner);
                  console.log(`🎲 Applied: ${selectedChar.name} died from auto dice effect`);
                }
              } else if (effectLower.includes('dimezza')) {
                if (effectLower.includes('pti')) targetCard.pti = Math.floor((targetCard.pti || 0) / 2);
                if (effectLower.includes('stelle')) targetCard.stars = Math.floor((targetCard.stars || 0) / 2);
              } else if (effectLower.includes('perde')) {
                const ptiMatch = effectToApply.match(/(\d+)\s*pti/i);
                const starMatch = effectToApply.match(/(\d+)\s*stell/i);
                if (ptiMatch) targetCard.pti = Math.max(0, (targetCard.pti || 0) - parseInt(ptiMatch[1]));
                if (starMatch) targetCard.stars = Math.max(0, (targetCard.stars || 0) - parseInt(starMatch[1]));
              }
              this.updateCardTextWithPTI(targetCard);
            }
            
            if (io) {
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-cpu-auto-dice`,
                playerName: 'Sistema',
                message: `🎲 CPU ${cardOwner} ha lanciato il dado automatico! Risultato: ${diceRoll} → "${effectToApply}" applicato a ${selectedChar.name}`,
                timestamp: Date.now()
              });
            }
            
            this.returnToDeck(gameId, card.id, cardOwner);
          }
        } else if (io) {
          // Human player: show auto dice setup panel
          if (!game.pendingAutoDice) {
            game.pendingAutoDice = new Map();
          }
          
          const autoDiceId = `auto-dice-${Date.now()}`;
          game.pendingAutoDice.set(autoDiceId, {
            cardId: card.id,
            cardName: card.name || this.getCardNameFromUrl(card.frontImage || ''),
            defaultEffects: autoEffects,
            initiatorPlayer: cardOwner,
            allowedCharacterIds: availableCharacters.map(c => c.id),
            timestamp: Date.now()
          });
          
          // Emit setup event - player will select characters and optionally customize effects
          console.log(`🎲 Emitting show-auto-dice-setup for ${autoDiceId}`);
          io.to(gameId).emit('show-auto-dice-setup', {
            autoDiceId,
            cardName: card.name || this.getCardNameFromUrl(card.frontImage || ''),
            defaultEffects: autoEffects,
            availableCharacters,
            initiatorPlayer: cardOwner
          });
        }
      }
      
      return { customAnimation };
    }

    // Check for COMPORTAMENTO (behavior) effect from Wizard
    const comportamentoMatch = card.effect.match(/\[COMPORTAMENTO:\s*([^\]]*)\]/i);
    if (comportamentoMatch) {
      const behavior = comportamentoMatch[1].trim();
      console.log(`⚡ COMPORTAMENTO effect detected: "${behavior}"`);
      
      const io = (global as any).io;
      
      // Parse and apply effect using keyword parser
      const actions = this.parseEffectKeywords(behavior);
      console.log(`⚡ Parsed ${actions.length} actions from COMPORTAMENTO`);
      
      if (actions.length > 0) {
        for (const action of actions) {
          await this.applyParsedEffect(gameId, action, card, playerName, io);
        }
        
        const cardName = card.name || this.getCardNameFromUrl(card.frontImage || '');
        if (io) {
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-comportamento-activated`,
            playerName: 'Sistema',
            message: `⚡ ${cardName} - Effetto attivato: ${actions.map(a => a.description).join(', ')}`,
            timestamp: Date.now()
          });
          
          // Broadcast updated state
          const gameState = this.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
        }
        
        // Record the effect execution
        await this.recordEvent(gameId, 'custom-card-effect', {
          cardId: card.id,
          cardName: card.name,
          effect: card.effect,
          result: { actions, message: `COMPORTAMENTO effetto attivato: ${actions.map(a => a.description).join(', ')}` }
        }, playerName);
      } else {
        console.log(`⚠️ No actions parsed from COMPORTAMENTO: "${behavior}" - will try AI processing`);
        // Don't return here - let the AI processing handle it below
      }
      
      // Only return early if we successfully processed actions
      if (actions.length > 0) {
        return { customAnimation };
      }
      // Otherwise, continue to AI processing below
    }

    // Check for DETTAGLI (details) effect and process it
    const dettagliMatch = card.effect.match(/\[DETTAGLI:\s*([^\]]*)\]/i);
    if (dettagliMatch) {
      const details = dettagliMatch[1].trim();
      console.log(`⚡ DETTAGLI effect detected: "${details}"`);
      
      // Parse details for structured data and apply
      const io = (global as any).io;
      const actions = this.parseEffectKeywords(details);
      
      if (actions.length > 0) {
        for (const action of actions) {
          await this.applyParsedEffect(gameId, action, card, playerName, io);
        }
      }
    }

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
        return { customAnimation };
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
      console.error('Error processing custom card effect with AI:', error);
      
      // Fallback to keyword-based parsing when AI fails
      console.log('🔧 AI failed - falling back to keyword-based effect parsing');
      const actions = this.parseEffectKeywords(card.effect);
      console.log(`🎴 Fallback keyword-parsed actions:`, actions);
      
      if (actions.length > 0) {
        for (const action of actions) {
          await this.executeCustomEffectAction(gameId, action, playerName, card);
        }
        
        // Record the effect execution
        await this.recordEvent(gameId, 'custom-card-effect', {
          cardId: card.id,
          cardName: card.name,
          effect: card.effect,
          result: { actions, message: `Effetto attivato (fallback): ${actions.map(a => a.description).join(', ')}` }
        }, playerName);
      } else {
        console.log('⚠️ No actions parsed from effect - effect may not be recognized');
      }
      return { customAnimation };
    }
    return { customAnimation };
  }

  // Get the player's "active" character - the leftmost (first) personaggio on field
  // This is the character that receives effects and performs attacks
  private getPlayerActiveCharacter(game: GameState, playerName: string): Card | undefined {
    // Find all personaggi belonging to this player on the field
    const playerPersonaggi = game.field.filter(c => 
      c.owner === playerName && 
      (c.type === 'personaggi' || c.type === 'personaggi_speciali')
    );
    
    // Return the first one (leftmost) - this is the "active" character
    if (playerPersonaggi.length > 0) {
      console.log(`🎯 Active character for ${playerName}: ${playerPersonaggi[0].name || playerPersonaggi[0].id}`);
      return playerPersonaggi[0];
    }
    
    // Fallback: if no owner match, find first personaggio on field (for single player)
    const anyPersonaggio = game.field.find(c => 
      (c.type === 'personaggi' || c.type === 'personaggi_speciali') &&
      c.pti != null
    );
    if (anyPersonaggio) {
      console.log(`🎯 Active character (fallback): ${anyPersonaggio.name || anyPersonaggio.id}`);
      return anyPersonaggio;
    }
    
    return undefined;
  }

  // Execute a single action from custom card effect
  private async executeCustomEffectAction(gameId: string, action: any, playerName: string, card: Card): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    console.log(`🎴 Executing custom effect action: ${action.type} - ${action.description}`);

    switch (action.type) {
      case 'damage':
        if (action.target === 'choice') {
          // Store pending effect for target selection
          if (!game.pendingEffects) game.pendingEffects = new Map();
          game.pendingEffects.set(playerName, {
            type: 'target_choice_damage',
            cardId: card.id,
            value: action.value || 100,
            maxTargets: action.maxTargets || 3,
            timestamp: Date.now()
          });
          console.log(`🎯 Custom effect: Awaiting target selection for ${action.value} damage (max ${action.maxTargets || 3} targets)`);
        } else if (action.target === 'all' || action.target === 'opponents') {
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
        // Find the leftmost (first) character of the player on field - this is the "active" character
        const healTarget = this.getPlayerActiveCharacter(game, playerName);
        
        if (action.target === 'choice') {
          // Store pending effect for target selection
          if (!game.pendingEffects) game.pendingEffects = new Map();
          game.pendingEffects.set(playerName, {
            type: 'target_choice_heal',
            cardId: card.id,
            value: action.value || 100,
            maxTargets: action.maxTargets || 3,
            timestamp: Date.now()
          });
          console.log(`🎯 Custom effect: Awaiting target selection for ${action.value} heal`);
        } else if (action.target === 'self' || action.target === 'allies') {
          if (healTarget) {
            const oldPti = healTarget.pti || 0;
            healTarget.pti = oldPti + (action.value || 0);
            console.log(`💚 Custom effect: ${healTarget.name || healTarget.id} healed ${action.value}, ${oldPti} → ${healTarget.pti} PTI`);
          } else {
            console.log(`💚 HEAL: No active character found on field for ${playerName}!`);
          }
        } else if (action.target === 'all') {
          // Heal all characters on field
          for (const fieldCard of game.field) {
            if ((fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali') && fieldCard.pti != null) {
              fieldCard.pti = (fieldCard.pti || 0) + (action.value || 0);
              console.log(`💚 Custom effect: ${fieldCard.name || fieldCard.id} healed ${action.value}, now at ${fieldCard.pti} PTI`);
            }
          }
        }
        break;

      case 'draw':
        // Make player draw cards
        const drawDeckType = card.type === 'personaggi' || card.type === 'personaggi_speciali' ? 'personaggi' : 'mosse';
        for (let i = 0; i < (action.value || 1); i++) {
          this.pickCard(gameId, drawDeckType, playerName);
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

      case 'protection':
        // Mark the player's active character as protected/immune from attacks
        const protectedChar = this.getPlayerActiveCharacter(game, playerName);
        if (protectedChar) {
          protectedChar.isProtected = true;
          (protectedChar as any).protectionTurns = action.value || 1; // Duration in turns
          console.log(`🛡️ Custom effect: ${protectedChar.name || protectedChar.id} is now PROTECTED for ${action.value || 1} turns!`);
        } else {
          console.log(`🛡️ PROTECTION: No active character found for ${playerName}!`);
        }
        break;

      case 'counter':
        // Mark player's active character as having counter-attack ability
        const counterChar = this.getPlayerActiveCharacter(game, playerName);
        if (counterChar) {
          counterChar.counterDamage = action.value || 50;
          console.log(`↩️ Custom effect: ${counterChar.name || counterChar.id} now has COUNTER-ATTACK (${counterChar.counterDamage} damage)!`);
        } else {
          console.log(`↩️ COUNTER: No active character found for ${playerName}!`);
        }
        break;

      case 'reflect':
        // Mark player's active character as reflecting damage
        const reflectChar = this.getPlayerActiveCharacter(game, playerName);
        if (reflectChar) {
          reflectChar.reflectPercent = action.value || 50;
          console.log(`🪞 Custom effect: ${reflectChar.name || reflectChar.id} now REFLECTS ${reflectChar.reflectPercent}% damage!`);
        } else {
          console.log(`🪞 REFLECT: No active character found for ${playerName}!`);
        }
        break;

      case 'shield':
        // Apply shield to player's active character
        const shieldChar = this.getPlayerActiveCharacter(game, playerName);
        if (shieldChar) {
          shieldChar.shieldAmount = (shieldChar.shieldAmount || 0) + (action.value || 200);
          console.log(`🔰 Custom effect: ${shieldChar.name || shieldChar.id} now has SHIELD (${shieldChar.shieldAmount} absorption)!`);
        } else {
          console.log(`🔰 SHIELD: No active character found for ${playerName}!`);
        }
        break;

      case 'freeze':
        // Freeze target - prevent action for X turns
        if (action.target === 'opponents') {
          for (const fieldCard of game.field) {
            if (fieldCard.owner !== playerName && 
                (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali')) {
              fieldCard.frozenTurns = action.value || 2;
              console.log(`❄️ Custom effect: ${fieldCard.name || fieldCard.id} is FROZEN for ${fieldCard.frozenTurns} turns!`);
            }
          }
        }
        break;

      case 'stun':
        // Stun target - skip next turn
        if (action.target === 'opponents') {
          for (const fieldCard of game.field) {
            if (fieldCard.owner !== playerName && 
                (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali')) {
              fieldCard.isStunned = true;
              console.log(`💫 Custom effect: ${fieldCard.name || fieldCard.id} is STUNNED!`);
            }
          }
        }
        break;

      case 'poison':
        // Apply poison - damage each turn
        if (action.target === 'opponents') {
          for (const fieldCard of game.field) {
            if (fieldCard.owner !== playerName && 
                (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali')) {
              fieldCard.poisonDamage = action.value || 50;
              fieldCard.poisonTurns = 3;
              console.log(`☠️ Custom effect: ${fieldCard.name || fieldCard.id} is POISONED (${fieldCard.poisonDamage}/turn)!`);
            }
          }
        }
        break;

      case 'burn':
        // Apply burn - damage each turn
        if (action.target === 'opponents') {
          for (const fieldCard of game.field) {
            if (fieldCard.owner !== playerName && 
                (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali')) {
              fieldCard.burnDamage = action.value || 30;
              console.log(`🔥 Custom effect: ${fieldCard.name || fieldCard.id} is BURNING (${fieldCard.burnDamage}/turn)!`);
            }
          }
        }
        break;

      case 'lifesteal':
        // Mark player's active character as having lifesteal
        const lifestealChar = this.getPlayerActiveCharacter(game, playerName);
        if (lifestealChar) {
          lifestealChar.hasLifesteal = true;
          lifestealChar.lifestealAmount = action.value || 100;
          console.log(`🧛 Custom effect: ${lifestealChar.name || lifestealChar.id} now has LIFESTEAL!`);
        } else {
          console.log(`🧛 LIFESTEAL: No active character found for ${playerName}!`);
        }
        break;

      case 'revenge':
        // Mark player's active character as having revenge ability
        const revengeChar = this.getPlayerActiveCharacter(game, playerName);
        if (revengeChar) {
          revengeChar.revengeDamage = action.value || 200;
          console.log(`👊 Custom effect: ${revengeChar.name || revengeChar.id} has REVENGE (${revengeChar.revengeDamage} on death)!`);
        } else {
          console.log(`👊 REVENGE: No active character found for ${playerName}!`);
        }
        break;

      case 'powerup':
        // Boost player's active character stats
        const powerupChar = this.getPlayerActiveCharacter(game, playerName);
        if (powerupChar && powerupChar.pti != null) {
          const oldPti = powerupChar.pti;
          powerupChar.pti += action.value || 100;
          console.log(`📈 Custom effect: ${powerupChar.name || powerupChar.id} POWERED UP ${oldPti} → ${powerupChar.pti} PTI!`);
        } else {
          console.log(`📈 POWERUP: No active character found for ${playerName}!`);
        }
        break;

      case 'weaken':
        // Reduce enemy stats
        for (const fieldCard of game.field) {
          if (fieldCard.owner !== playerName && 
              (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali') &&
              fieldCard.pti != null) {
            fieldCard.pti = Math.max(0, fieldCard.pti - (action.value || 100));
            console.log(`📉 Custom effect: ${fieldCard.name || fieldCard.id} WEAKENED to ${fieldCard.pti} PTI!`);
          }
        }
        break;

      case 'aura':
        // Boost all allied cards
        for (const fieldCard of game.field) {
          if (fieldCard.owner === playerName && 
              (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali') &&
              fieldCard.pti != null) {
            fieldCard.pti += action.value || 50;
            console.log(`✴️ Aura effect: ${fieldCard.name || fieldCard.id} boosted to ${fieldCard.pti} PTI!`);
          }
        }
        break;

      case 'extra_turn':
        // Grant extra turn
        console.log(`🔄 Custom effect: ${playerName} gets an EXTRA TURN!`);
        game.extraTurnPlayer = playerName;
        break;

      case 'skip_turn':
        // Mark opponents to skip turn
        for (const pName of game.turnOrder) {
          if (pName !== playerName) {
            game.skipTurnPlayers = game.skipTurnPlayers || [];
            game.skipTurnPlayers.push(pName);
            console.log(`⏭️ Custom effect: ${pName} will SKIP next turn!`);
          }
        }
        break;

      case 'nullify':
        // Block next enemy effect
        game.nullifyNextEffect = playerName;
        console.log(`🚫 Custom effect: Next enemy effect will be NULLIFIED!`);
        break;

      case 'steal':
        // Steal card from opponent hand (random)
        for (const [pName, player] of Object.entries(game.players)) {
          if (pName !== playerName) {
            const hand = (player as any).hand as Card[];
            if (hand.length > 0) {
              const stolenIdx = Math.floor(Math.random() * hand.length);
              const stolenCard = hand.splice(stolenIdx, 1)[0];
              stolenCard.owner = playerName;
              game.players[playerName].hand.push(stolenCard);
              console.log(`🤏 Custom effect: ${playerName} stole ${stolenCard.name || stolenCard.id} from ${pName}!`);
              break;
            }
          }
        }
        break;

      case 'resurrect':
        // Return card from graveyard (auto-select the player's most recently died card)
        if (game.graveyard.length > 0) {
          // Find the player's own card in graveyard (most recent first)
          const playerGraveyardCards = game.graveyard.filter(c => c.eliminatedBy === playerName || c.owner === playerName);
          const resCard = playerGraveyardCards.length > 0 
            ? game.graveyard.splice(game.graveyard.indexOf(playerGraveyardCards[playerGraveyardCards.length - 1]), 1)[0]
            : game.graveyard.pop();
          if (resCard) {
            resCard.owner = playerName;
            game.players[playerName].hand.push(resCard);
            console.log(`👼 Custom effect: ${playerName} RESURRECTED ${resCard.name || resCard.id}!`);
          }
        }
        break;

      case 'resurrect_choice':
        // Emit event to client to show graveyard selection modal
        if (game.graveyard.length > 0) {
          // Store pending effect for this player
          if (!game.pendingEffects) game.pendingEffects = new Map();
          game.pendingEffects.set(playerName, {
            type: 'resurrect_choice',
            cardId: card.id,
            timestamp: Date.now()
          });
          console.log(`👼 Custom effect: ${playerName} needs to choose a card from graveyard!`);
          // Emit event to show graveyard selection - the client will listen for this
          // This is handled in routes.ts via custom-card-effect event with special handling
        } else {
          console.log(`👼 Custom effect: No cards in graveyard to resurrect!`);
        }
        break;

      case 'double':
        // Double next effect
        game.doubleNextEffect = playerName;
        console.log(`✖️ Custom effect: Next effect will be DOUBLED!`);
        break;

      case 'drain':
        // Drain PTI from opponents
        console.log(`🌀 Drain effect: Checking ${game.field.length} cards on field, player=${playerName}`);
        let totalDrained = 0;
        for (const fieldCard of game.field) {
          const isEnemy = fieldCard.owner !== playerName && fieldCard.owner !== undefined;
          const isCharacter = fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali';
          const hasPti = fieldCard.pti != null && fieldCard.pti > 0;
          console.log(`🌀 Field card: ${fieldCard.name || fieldCard.id}, owner=${fieldCard.owner}, isEnemy=${isEnemy}, isChar=${isCharacter}, pti=${fieldCard.pti}`);
          
          if (isEnemy && isCharacter && hasPti && fieldCard.pti != null) {
            const drainAmount = Math.min(fieldCard.pti, action.value || 100);
            fieldCard.pti = fieldCard.pti - drainAmount;
            // CRITICAL: Also update card.text so client can see the change
            this.updateCardTextWithPTI(fieldCard);
            totalDrained += drainAmount;
            
            // Add to own card if found
            const ownCard = game.field.find(c => c.id === card.id);
            if (ownCard) {
              if (ownCard.pti == null) ownCard.pti = 0;
              ownCard.pti += drainAmount;
              // CRITICAL: Also update card.text so client can see the change
              this.updateCardTextWithPTI(ownCard);
              console.log(`🌀 Custom effect: Drained ${drainAmount} PTI from ${fieldCard.name} to ${ownCard.name}! (${ownCard.name} now has ${ownCard.pti} PTI)`);
            } else {
              console.log(`🌀 Custom effect: Drained ${drainAmount} PTI from ${fieldCard.name} (own card not found in field)`);
            }
          }
        }
        if (totalDrained === 0) {
          console.log(`🌀 Drain effect: No valid targets found to drain from`);
        }
        break;

      // === NEW EFFECT HANDLERS ===
      
      case 'damage_all':
        // Damage ALL characters on field (including allies)
        for (const fieldCard of game.field) {
          if ((fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali') && fieldCard.pti != null) {
            fieldCard.pti = Math.max(0, fieldCard.pti - (action.value || 100));
            console.log(`💥 Custom effect: ${fieldCard.name || fieldCard.id} took ${action.value} damage (ALL), now at ${fieldCard.pti} PTI`);
          }
        }
        break;

      case 'damage_random':
        // Damage a random enemy character
        const enemyChars = game.field.filter(c => 
          c.owner !== playerName && 
          (c.type === 'personaggi' || c.type === 'personaggi_speciali') && 
          c.pti != null
        );
        if (enemyChars.length > 0) {
          const randomTarget = enemyChars[Math.floor(Math.random() * enemyChars.length)];
          randomTarget.pti = Math.max(0, (randomTarget.pti || 0) - (action.value || 100));
          console.log(`🎲 Custom effect: ${randomTarget.name || randomTarget.id} took ${action.value} random damage, now at ${randomTarget.pti} PTI`);
        }
        break;

      case 'execute':
        // Instant kill if PTI below threshold
        const threshold = action.value || 300;
        for (const fieldCard of game.field) {
          if (fieldCard.owner !== playerName && 
              (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali') &&
              fieldCard.pti != null && fieldCard.pti < threshold) {
            fieldCard.pti = 0;
            console.log(`⚡ Custom effect: EXECUTED ${fieldCard.name || fieldCard.id} (PTI was below ${threshold})!`);
          }
        }
        break;

      case 'pierce':
        // Damage ignoring shields/protection
        for (const fieldCard of game.field) {
          if (fieldCard.owner !== playerName && 
              (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali') &&
              fieldCard.pti != null) {
            fieldCard.pti = Math.max(0, fieldCard.pti - (action.value || 100));
            console.log(`🗡️ Custom effect: PIERCED ${fieldCard.name || fieldCard.id} for ${action.value} damage (ignores shields)!`);
          }
        }
        break;

      case 'critical':
        // Mark player's active character as having critical chance
        const critChar = this.getPlayerActiveCharacter(game, playerName);
        if (critChar) {
          critChar.criticalChance = action.value || 50;
          console.log(`💢 Custom effect: ${critChar.name || critChar.id} now has ${critChar.criticalChance}% CRITICAL CHANCE!`);
        } else {
          console.log(`💢 CRITICAL: No active character found for ${playerName}!`);
        }
        break;

      case 'bleed':
        // Apply bleed effect
        for (const fieldCard of game.field) {
          if (fieldCard.owner !== playerName && 
              (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali')) {
            fieldCard.bleedDamage = action.value || 40;
            fieldCard.bleedTurns = 3;
            console.log(`🩸 Custom effect: ${fieldCard.name || fieldCard.id} is BLEEDING (${fieldCard.bleedDamage}/turn)!`);
          }
        }
        break;

      case 'curse':
        // Apply curse effect
        for (const fieldCard of game.field) {
          if (fieldCard.owner !== playerName && 
              (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali')) {
            fieldCard.isCursed = true;
            fieldCard.curseTurns = action.value || 3;
            console.log(`🔮 Custom effect: ${fieldCard.name || fieldCard.id} is CURSED for ${fieldCard.curseTurns} turns!`);
          }
        }
        break;

      case 'explosion':
        // Area damage to all enemies
        for (const fieldCard of game.field) {
          if (fieldCard.owner !== playerName && 
              (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali') &&
              fieldCard.pti != null) {
            fieldCard.pti = Math.max(0, fieldCard.pti - (action.value || 150));
            console.log(`💣 Custom effect: EXPLOSION hit ${fieldCard.name || fieldCard.id} for ${action.value} damage!`);
          }
        }
        break;

      case 'immunity':
        // Grant immunity to player's active character
        const immuneChar = this.getPlayerActiveCharacter(game, playerName);
        if (immuneChar) {
          immuneChar.isImmune = true;
          immuneChar.immuneTurns = action.value || 2;
          console.log(`🔒 Custom effect: ${immuneChar.name || immuneChar.id} is now IMMUNE for ${immuneChar.immuneTurns} turns!`);
        } else {
          console.log(`🔒 IMMUNITY: No active character found for ${playerName}!`);
        }
        break;

      case 'barrier':
        // Block first attack for player's active character
        const barrierChar = this.getPlayerActiveCharacter(game, playerName);
        if (barrierChar) {
          barrierChar.hasBarrier = true;
          console.log(`🧱 Custom effect: ${barrierChar.name || barrierChar.id} now has a BARRIER!`);
        } else {
          console.log(`🧱 BARRIER: No active character found for ${playerName}!`);
        }
        break;

      case 'dodge':
        // Grant dodge chance to player's active character
        const dodgeChar = this.getPlayerActiveCharacter(game, playerName);
        if (dodgeChar) {
          dodgeChar.dodgeChance = action.value || 30;
          console.log(`💨 Custom effect: ${dodgeChar.name || dodgeChar.id} now has ${dodgeChar.dodgeChance}% DODGE CHANCE!`);
        } else {
          console.log(`💨 DODGE: No active character found for ${playerName}!`);
        }
        break;

      case 'armor':
        // Reduce all damage received for player's active character
        const armorChar = this.getPlayerActiveCharacter(game, playerName);
        if (armorChar) {
          armorChar.armorAmount = action.value || 50;
          console.log(`🦾 Custom effect: ${armorChar.name || armorChar.id} now has ${armorChar.armorAmount} ARMOR!`);
        } else {
          console.log(`🦾 ARMOR: No active character found for ${playerName}!`);
        }
        break;

      case 'regeneration':
        // Apply regeneration to player's active character
        const regenChar = this.getPlayerActiveCharacter(game, playerName);
        if (regenChar) {
          regenChar.regeneration = action.value || 50;
          console.log(`💗 Custom effect: ${regenChar.name || regenChar.id} now REGENERATES ${regenChar.regeneration} PTI/turn!`);
        } else {
          console.log(`💗 REGENERATION: No active character found for ${playerName}!`);
        }
        break;

      case 'taunt':
        // Force enemies to attack player's active character
        const tauntChar = this.getPlayerActiveCharacter(game, playerName);
        if (tauntChar) {
          tauntChar.hasTaunt = true;
          console.log(`😤 Custom effect: ${tauntChar.name || tauntChar.id} is now TAUNTING!`);
        } else {
          console.log(`😤 TAUNT: No active character found for ${playerName}!`);
        }
        break;

      case 'stealth':
        // Player's active character cannot be targeted
        const stealthChar = this.getPlayerActiveCharacter(game, playerName);
        if (stealthChar) {
          stealthChar.isStealthed = true;
          stealthChar.stealthTurns = action.value || 2;
          console.log(`👻 Custom effect: ${stealthChar.name || stealthChar.id} is now STEALTHED for ${stealthChar.stealthTurns} turns!`);
        } else {
          console.log(`👻 STEALTH: No active character found for ${playerName}!`);
        }
        break;

      case 'heal_all':
        // Heal all allied characters
        for (const fieldCard of game.field) {
          if (fieldCard.owner === playerName && 
              (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali') &&
              fieldCard.pti != null) {
            fieldCard.pti += action.value || 100;
            console.log(`💖 Custom effect: ${fieldCard.name || fieldCard.id} HEALED to ${fieldCard.pti} PTI!`);
          }
        }
        break;

      case 'buff':
        // Boost a single ally
        const allyCards = game.field.filter(c => 
          c.owner === playerName && 
          (c.type === 'personaggi' || c.type === 'personaggi_speciali') &&
          c.pti != null
        );
        if (allyCards.length > 0) {
          const buffTarget = allyCards[0];
          buffTarget.pti = (buffTarget.pti || 0) + (action.value || 100);
          console.log(`⬆️ Custom effect: ${buffTarget.name || buffTarget.id} BUFFED to ${buffTarget.pti} PTI!`);
        }
        break;

      case 'cleanse':
        // Remove negative effects from allies
        for (const fieldCard of game.field) {
          if (fieldCard.owner === playerName) {
            fieldCard.poisonDamage = 0;
            fieldCard.poisonTurns = 0;
            fieldCard.burnDamage = 0;
            fieldCard.bleedDamage = 0;
            fieldCard.bleedTurns = 0;
            fieldCard.isCursed = false;
            fieldCard.frozenTurns = 0;
            fieldCard.isStunned = false;
            fieldCard.isSilenced = false;
            console.log(`✨ Custom effect: ${fieldCard.name || fieldCard.id} CLEANSED!`);
          }
        }
        break;

      case 'bless':
        // Grant PTI bonus and immunity
        const blessCard = game.field.find(c => c.id === card.id);
        if (blessCard && blessCard.pti != null) {
          blessCard.pti += action.value || 50;
          blessCard.isImmune = true;
          blessCard.immuneTurns = 1;
          console.log(`🙏 Custom effect: ${blessCard.name || blessCard.id} BLESSED! +${action.value} PTI and immune for 1 turn!`);
        }
        break;

      case 'inspire':
        // Boost all allies
        for (const fieldCard of game.field) {
          if (fieldCard.owner === playerName && 
              (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali') &&
              fieldCard.pti != null) {
            fieldCard.pti += action.value || 30;
            console.log(`🎺 Custom effect: ${fieldCard.name || fieldCard.id} INSPIRED! +${action.value} PTI!`);
          }
        }
        break;

      case 'revive_boost':
        // Resurrect with extra PTI
        if (game.graveyard.length > 0) {
          const playerCards = game.graveyard.filter(c => c.owner === playerName);
          const resCard = playerCards.length > 0 ? playerCards[playerCards.length - 1] : game.graveyard[game.graveyard.length - 1];
          if (resCard) {
            game.graveyard = game.graveyard.filter(c => c.id !== resCard.id);
            resCard.owner = playerName;
            if (resCard.pti != null) resCard.pti += action.value || 200;
            game.players[playerName].hand.push(resCard);
            console.log(`🌟 Custom effect: ${resCard.name || resCard.id} REVIVED with +${action.value} PTI bonus!`);
          }
        }
        break;

      case 'inherit_from_dead':
        // Inherit PTI and stars from the last dead character
        const lastDeadChar = game.graveyard.filter(c => 
          c.type === 'personaggi' || c.type === 'personaggi_speciali'
        ).pop();
        
        if (lastDeadChar) {
          const activeChar = this.getPlayerActiveCharacter(game, playerName);
          if (activeChar) {
            // Get PTI from dead card text or pti field
            let deadPti = lastDeadChar.pti || 0;
            if (!deadPti && lastDeadChar.text) {
              const ptiMatch = lastDeadChar.text.match(/PTI originali:\s*(\d+)/i) || lastDeadChar.text.match(/PTI:\s*(\d+)/i);
              if (ptiMatch) deadPti = parseInt(ptiMatch[1], 10);
            }
            const deadStars = lastDeadChar.stars || 0;
            
            // Add to active character
            const oldPti = activeChar.pti || 0;
            const oldStars = activeChar.stars || 0;
            activeChar.pti = oldPti + deadPti;
            activeChar.stars = oldStars + deadStars;
            
            // Update card text
            this.updateCardTextWithPTI(activeChar);
            
            console.log(`🦅 INHERIT FROM DEAD: ${activeChar.name} inherited ${deadPti} PTI and ${deadStars} stars from ${lastDeadChar.name}!`);
            console.log(`🦅 ${activeChar.name} now has ${activeChar.pti} PTI and ${activeChar.stars} stars`);
          } else {
            console.log(`🦅 INHERIT FROM DEAD: No active character found for ${playerName}`);
          }
        } else {
          console.log(`🦅 INHERIT FROM DEAD: No dead characters in graveyard`);
        }
        break;

      case 'clone_self':
        // Clone the card that triggered this effect
        const cloneSelfSource = game.field.find(c => c.id === card.id);
        if (cloneSelfSource) {
          const clonedCard: Card = {
            ...cloneSelfSource,
            id: `${cloneSelfSource.id}-clone-${Date.now()}`,
            name: `${cloneSelfSource.name} (Clone)`,
          };
          game.field.push(clonedCard);
          console.log(`🧬 CLONE SELF: Created clone of ${cloneSelfSource.name} on the field!`);
        } else {
          console.log(`🧬 CLONE SELF: Source card not found on field`);
        }
        break;

      // ============ NEW CUSTOM EFFECTS ============
      
      case 'halve_pti':
        // Halve PTI of target
        const halvePtiTargets = action.target === 'enemy_card' 
          ? game.field.filter(c => c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'))
          : game.field.filter(c => c.id === card.id || (c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')));
        for (const target of halvePtiTargets) {
          if (target.pti != null) {
            const oldPti = target.pti;
            target.pti = Math.floor(target.pti / 2);
            this.updateCardTextWithPTI(target);
            console.log(`➗ HALVE PTI: ${target.name} ${oldPti} → ${target.pti}`);
          }
        }
        break;

      case 'halve_stars':
        // Halve stars of target
        const halveStarsTargets = action.target === 'enemy_card' 
          ? game.field.filter(c => c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'))
          : game.field.filter(c => c.id === card.id || (c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')));
        for (const target of halveStarsTargets) {
          const oldStars = this.extractStarsFromNote(target.text || '');
          const newStars = Math.floor(oldStars / 2);
          const currentPti = target.pti || this.extractPTIFromNote(target.text || '');
          target.text = `PTI: ${currentPti} | Stelle: ${newStars}`;
          target.stars = newStars; // CRITICAL: Also update .stars property for damage calculations
          console.log(`⭐➗ HALVE STARS: ${target.name} ${oldStars} → ${newStars}`);
        }
        break;

      case 'double_pti':
        // Double PTI of target
        const doublePtiTargets = action.target === 'enemy_card' 
          ? game.field.filter(c => c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'))
          : game.field.filter(c => c.id === card.id || (c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')));
        for (const target of doublePtiTargets) {
          if (target.pti != null) {
            const oldPti = target.pti;
            target.pti = target.pti * 2;
            this.updateCardTextWithPTI(target);
            console.log(`💪✖️ DOUBLE PTI: ${target.name} ${oldPti} → ${target.pti}`);
          }
        }
        break;

      case 'double_stars':
        // Double stars of target
        const doubleStarsTargets = action.target === 'enemy_card' 
          ? game.field.filter(c => c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'))
          : game.field.filter(c => c.id === card.id || (c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')));
        for (const target of doubleStarsTargets) {
          const oldStars = this.extractStarsFromNote(target.text || '');
          const newStars = oldStars * 2;
          const currentPti = target.pti || this.extractPTIFromNote(target.text || '');
          target.text = `PTI: ${currentPti} | Stelle: ${newStars}`;
          target.stars = newStars; // CRITICAL: Also update .stars property for damage calculations
          console.log(`⭐✖️ DOUBLE STARS: ${target.name} ${oldStars} → ${newStars}`);
        }
        break;

      case 'add_half_pti':
        // Add half of current PTI
        const addHalfPtiChar = this.getPlayerActiveCharacter(game, playerName);
        if (addHalfPtiChar && addHalfPtiChar.pti != null) {
          const halfPti = Math.floor(addHalfPtiChar.pti / 2);
          addHalfPtiChar.pti += halfPti;
          this.updateCardTextWithPTI(addHalfPtiChar);
          console.log(`💪➕ ADD HALF PTI: ${addHalfPtiChar.name} +${halfPti} → ${addHalfPtiChar.pti}`);
        }
        break;

      case 'add_half_stars':
        // Add half of current stars
        const addHalfStarsChar = this.getPlayerActiveCharacter(game, playerName);
        if (addHalfStarsChar) {
          const currentStars = this.extractStarsFromNote(addHalfStarsChar.text || '');
          const halfStars = Math.floor(currentStars / 2);
          const newStars = currentStars + halfStars;
          const currentPti = addHalfStarsChar.pti || this.extractPTIFromNote(addHalfStarsChar.text || '');
          addHalfStarsChar.text = `PTI: ${currentPti} | Stelle: ${newStars}`;
          addHalfStarsChar.stars = newStars; // CRITICAL: Also update .stars property for damage calculations
          console.log(`⭐➕ ADD HALF STARS: ${addHalfStarsChar.name} ${currentStars} + ${halfStars} = ${newStars}`);
        }
        break;

      case 'zero_stars':
        // Set stars to 0
        const zeroStarsTargets = action.target === 'enemy_card' 
          ? game.field.filter(c => c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'))
          : game.field.filter(c => c.id === card.id || (c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')));
        for (const target of zeroStarsTargets) {
          const oldStars = this.extractStarsFromNote(target.text || '');
          const currentPti = target.pti || this.extractPTIFromNote(target.text || '');
          target.text = `PTI: ${currentPti} | Stelle: 0`;
          target.stars = 0; // CRITICAL: Also update .stars property for damage calculations
          console.log(`⭐0️⃣ ZERO STARS: ${target.name} ${oldStars} → 0`);
        }
        break;

      case 'absorb_pti':
        // Absorb PTI from enemy and add to self
        const absorbAmount = action.value || 100;
        const enemyCharsAbsorb = game.field.filter(c => 
          c.owner !== playerName && 
          (c.type === 'personaggi' || c.type === 'personaggi_speciali') &&
          c.pti != null && c.pti > 0
        );
        const absorbChar = this.getPlayerActiveCharacter(game, playerName);
        if (enemyCharsAbsorb.length > 0 && absorbChar) {
          const enemyTarget = enemyCharsAbsorb[0];
          const actualAbsorb = Math.min(enemyTarget.pti || 0, absorbAmount);
          enemyTarget.pti = (enemyTarget.pti || 0) - actualAbsorb;
          this.updateCardTextWithPTI(enemyTarget);
          absorbChar.pti = (absorbChar.pti || 0) + actualAbsorb;
          this.updateCardTextWithPTI(absorbChar);
          console.log(`🧲 ABSORB PTI: ${absorbChar.name} stole ${actualAbsorb} PTI from ${enemyTarget.name}!`);
        }
        break;

      case 'control_turn':
        // Mark opponent for turn control
        const controlOpponents = Object.keys(game.players).filter(p => p !== playerName);
        if (controlOpponents.length > 0) {
          const targetOpponent = controlOpponents[Math.floor(Math.random() * controlOpponents.length)];
          (game as any).controlledPlayer = targetOpponent;
          (game as any).controllingPlayer = playerName;
          console.log(`🎮👤 CONTROL TURN: ${playerName} will control ${targetOpponent}'s next turn!`);
        }
        break;

      case 'send_to_deck':
        // Send a card back to deck
        const sendTargets = action.target === 'enemy_card'
          ? game.field.filter(c => c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'))
          : game.field.filter(c => c.owner === playerName && c.id !== card.id && (c.type === 'personaggi' || c.type === 'personaggi_speciali'));
        if (sendTargets.length > 0) {
          const sendTargetCard = sendTargets[0];
          const sendDeckType = sendTargetCard.type as 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali';
          game.field = game.field.filter(c => c.id !== sendTargetCard.id);
          game.decks[sendDeckType].push(sendTargetCard);
          console.log(`📥 SEND TO DECK: ${sendTargetCard.name} returned to ${sendDeckType} deck!`);
        }
        break;

      case 'reflect_attack':
        // Set up attack reflection for the character
        const reflectAttackChar = this.getPlayerActiveCharacter(game, playerName);
        if (reflectAttackChar) {
          (reflectAttackChar as any).reflectsAttack = true;
          console.log(`🔄⚔️ REFLECT ATTACK: ${reflectAttackChar.name} will reflect the next attack!`);
        }
        break;

      case 'silence':
        // Disable enemy effects
        for (const fieldCard of game.field) {
          if (fieldCard.owner !== playerName && 
              (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali')) {
            fieldCard.isSilenced = true;
            fieldCard.silenceTurns = action.value || 2;
            console.log(`🤐 Custom effect: ${fieldCard.name || fieldCard.id} SILENCED for ${fieldCard.silenceTurns} turns!`);
          }
        }
        break;

      case 'sleep':
        // Target cannot act until hit
        for (const fieldCard of game.field) {
          if (fieldCard.owner !== playerName && 
              (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali')) {
            fieldCard.isAsleep = true;
            console.log(`😴 Custom effect: ${fieldCard.name || fieldCard.id} is now ASLEEP!`);
          }
        }
        break;

      case 'confuse':
        // Target may hit allies
        for (const fieldCard of game.field) {
          if (fieldCard.owner !== playerName && 
              (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali')) {
            fieldCard.isConfused = true;
            fieldCard.confuseTurns = action.value || 2;
            console.log(`😵 Custom effect: ${fieldCard.name || fieldCard.id} is CONFUSED for ${fieldCard.confuseTurns} turns!`);
          }
        }
        break;

      case 'fear':
        // Target cannot attack
        for (const fieldCard of game.field) {
          if (fieldCard.owner !== playerName && 
              (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali')) {
            fieldCard.hasFear = true;
            fieldCard.fearTurns = action.value || 2;
            console.log(`😨 Custom effect: ${fieldCard.name || fieldCard.id} has FEAR for ${fieldCard.fearTurns} turns!`);
          }
        }
        break;

      case 'charm':
        // Control enemy temporarily
        const charmTarget = game.field.find(c => 
          c.owner !== playerName && 
          (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        if (charmTarget) {
          charmTarget.originalOwner = charmTarget.owner;
          charmTarget.owner = playerName;
          charmTarget.charmTurns = action.value || 1;
          console.log(`💕 Custom effect: ${charmTarget.name || charmTarget.id} is CHARMED for ${charmTarget.charmTurns} turns!`);
        }
        break;

      case 'banish':
        // Remove from game temporarily
        const banishTarget = game.field.find(c => 
          c.owner !== playerName && 
          (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        if (banishTarget) {
          game.field = game.field.filter(c => c.id !== banishTarget.id);
          if (!game.banishedCards) game.banishedCards = [];
          banishTarget.banishTurns = action.value || 2;
          game.banishedCards.push(banishTarget);
          console.log(`🌀 Custom effect: ${banishTarget.name || banishTarget.id} is BANISHED for ${banishTarget.banishTurns} turns!`);
        }
        break;

      case 'slow':
        // Reduce action speed
        for (const fieldCard of game.field) {
          if (fieldCard.owner !== playerName && 
              (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali')) {
            fieldCard.isSlowed = true;
            console.log(`🐌 Custom effect: ${fieldCard.name || fieldCard.id} is SLOWED!`);
          }
        }
        break;

      case 'lock':
        // Prevent ability use
        for (const fieldCard of game.field) {
          if (fieldCard.owner !== playerName && 
              (fieldCard.type === 'personaggi' || fieldCard.type === 'personaggi_speciali')) {
            fieldCard.isLocked = true;
            fieldCard.lockTurns = action.value || 2;
            console.log(`🔐 Custom effect: ${fieldCard.name || fieldCard.id} is LOCKED for ${fieldCard.lockTurns} turns!`);
          }
        }
        break;

      case 'reveal':
        // Reveal opponent's hand (logged only)
        for (const [pName, player] of Object.entries(game.players)) {
          if (pName !== playerName) {
            console.log(`👁️ Custom effect: ${pName}'s hand revealed: ${(player as any).hand.map((c: any) => c.name || c.id).join(', ')}`);
          }
        }
        break;

      case 'shuffle':
        // Shuffle cards back into deck (simplified - just log)
        console.log(`🔀 Custom effect: Cards shuffled into deck!`);
        break;

      case 'search':
        // Search deck for specific card (simplified - draw)
        const searchDeckType = card.type === 'personaggi' || card.type === 'personaggi_speciali' ? 'personaggi' : 'mosse';
        this.pickCard(gameId, searchDeckType, playerName);
        console.log(`🔍 Custom effect: Searched and drew a card!`);
        break;

      case 'return_hand':
        // Return card from field to hand
        const returnTarget = game.field.find(c => 
          c.owner !== playerName && 
          (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        if (returnTarget) {
          game.field = game.field.filter(c => c.id !== returnTarget.id);
          game.players[returnTarget.owner || playerName]?.hand.push(returnTarget);
          console.log(`✋ Custom effect: ${returnTarget.name || returnTarget.id} returned to hand!`);
        }
        break;

      case 'return_deck':
        // Return card to deck
        const deckTarget = game.field.find(c => 
          c.owner !== playerName && 
          (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        if (deckTarget) {
          game.field = game.field.filter(c => c.id !== deckTarget.id);
          console.log(`📚 Custom effect: ${deckTarget.name || deckTarget.id} returned to deck!`);
        }
        break;

      case 'mill':
        // Discard from deck to graveyard
        for (const [pName, player] of Object.entries(game.players)) {
          if (pName !== playerName) {
            const millCount = action.value || 3;
            console.log(`⚙️ Custom effect: ${pName} milled ${millCount} cards!`);
          }
        }
        break;

      case 'triple':
        // Triple next effect
        game.tripleNextEffect = playerName;
        console.log(`3️⃣ Custom effect: Next effect will be TRIPLED!`);
        break;

      case 'copy':
        // Copy last played card effect
        console.log(`📋 Custom effect: Copying last played effect!`);
        break;

      case 'clone':
        // Create copy of this card
        const cloneSource = game.field.find(c => c.id === card.id);
        if (cloneSource) {
          const clonedCard = { ...cloneSource, id: `${cloneSource.id}-clone-${Date.now()}` };
          game.players[playerName].hand.push(clonedCard);
          console.log(`👯 Custom effect: Created a CLONE of ${cloneSource.name || cloneSource.id}!`);
        }
        break;

      case 'chain':
        // Hit multiple targets
        const chainCount = action.value || 3;
        const chainTargets = game.field.filter(c => 
          c.owner !== playerName && 
          (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        ).slice(0, chainCount);
        for (const target of chainTargets) {
          if (target.pti != null) {
            target.pti = Math.max(0, target.pti - 50);
            console.log(`⛓️ Custom effect: Chain hit ${target.name || target.id} for 50 damage!`);
          }
        }
        break;

      case 'combo':
        // Enhanced effect when combined
        console.log(`🎰 Custom effect: COMBO bonus activated!`);
        break;

      case 'random_effect':
        // Apply random effect
        const randomEffects = ['damage', 'heal', 'draw', 'powerup'];
        const randEffect = randomEffects[Math.floor(Math.random() * randomEffects.length)];
        console.log(`🎲 Custom effect: Random effect triggered: ${randEffect}!`);
        break;

      case 'conditional':
      case 'triggered':
      case 'passive':
        // These are marker effects, handled specially
        console.log(`📌 Custom effect: Conditional/triggered/passive effect registered!`);
        break;

      case 'fusion':
        // Combine cards - boost the played card with stats from allies
        const fusionCard = game.field.find(c => c.id === card.id);
        if (fusionCard && (fusionCard.type === 'personaggi' || fusionCard.type === 'personaggi_speciali')) {
          // Find another ally character to fuse with
          const allyToFuse = game.field.find(c => 
            c.id !== card.id && 
            c.owner === playerName && 
            (c.type === 'personaggi' || c.type === 'personaggi_speciali')
          );
          if (allyToFuse) {
            // Transfer stats from ally to fusion card
            fusionCard.pti = (fusionCard.pti || 0) + (allyToFuse.pti || 0);
            fusionCard.stars = Math.max(fusionCard.stars || 1, allyToFuse.stars || 1) + 1;
            fusionCard.name = `${fusionCard.name || 'Fusione'} + ${allyToFuse.name || 'Personaggio'}`;
            // Remove the fused ally
            game.field = game.field.filter(c => c.id !== allyToFuse.id);
            game.graveyard.push(allyToFuse);
            console.log(`🔗 Custom effect: FUSION! ${fusionCard.name} now has ${fusionCard.pti} PTI and ${fusionCard.stars} stars!`);
          } else {
            // No ally to fuse - just boost the card
            fusionCard.pti = (fusionCard.pti || 0) + (action.value || 200);
            console.log(`🔗 Custom effect: FUSION power boost! ${fusionCard.name} now has ${fusionCard.pti} PTI!`);
          }
        } else {
          // For non-character cards, just log
          console.log(`🔗 Custom effect: FUSION activated for ${card.name || card.id}!`);
        }
        break;

      case 'split':
        // Split into multiple cards
        console.log(`✂️ Custom effect: Card SPLIT into multiple!`);
        break;

      case 'teleport':
        // Move card position
        console.log(`🌀 Custom effect: Card TELEPORTED!`);
        break;

      case 'time_travel':
        // Time travel: heal all player's characters and reset negative effects
        const turnsBack = action.value || 1;
        const playerChars = game.field.filter(c => 
          c.owner === playerName && 
          (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        
        for (const playerChar of playerChars) {
          // Heal the character based on turns
          const healAmount = turnsBack * 100;
          playerChar.pti = (playerChar.pti || 0) + healAmount;
          
          // Remove negative effects
          playerChar.frozenTurns = 0;
          playerChar.isStunned = false;
          playerChar.poisonDamage = 0;
          playerChar.poisonTurns = 0;
          playerChar.burnDamage = 0;
          playerChar.isCursed = false;
          playerChar.isSilenced = false;
          playerChar.isAsleep = false;
          playerChar.isConfused = false;
          playerChar.hasFear = false;
          playerChar.isSlowed = false;
          playerChar.isLocked = false;
          
          console.log(`⏰ Time Travel: ${playerChar.name || playerChar.id} healed ${healAmount} PTI and cleared all debuffs!`);
        }
        
        // Also resurrect one card from graveyard if available
        const playerGraveCards = game.graveyard.filter(c => c.owner === playerName);
        if (playerGraveCards.length > 0) {
          const resCard = game.graveyard.splice(game.graveyard.indexOf(playerGraveCards[playerGraveCards.length - 1]), 1)[0];
          resCard.owner = playerName;
          game.players[playerName].hand.push(resCard);
          console.log(`⏰ Time Travel: Resurrected ${resCard.name || resCard.id} from graveyard!`);
        }
        
        console.log(`⏰ Custom effect: TIME TRAVEL ${turnsBack} turns activated!`);
        break;

      case 'weather':
        // Change field conditions
        game.weatherEffect = action.description || 'unknown';
        game.weatherTurns = action.value || 3;
        console.log(`🌦️ Custom effect: WEATHER changed for ${game.weatherTurns} turns!`);
        break;

      case 'terrain':
        // Modify terrain
        game.terrainEffect = action.description || 'unknown';
        console.log(`🏔️ Custom effect: TERRAIN modified!`);
        break;

      case 'trap':
        // Set trap
        const trapCard = game.field.find(c => c.id === card.id);
        if (trapCard) {
          trapCard.isTrap = true;
          console.log(`🪤 Custom effect: TRAP set!`);
        }
        break;

      case 'counter_spell':
        // Cancel next enemy action
        game.counterSpellActive = playerName;
        console.log(`🛑 Custom effect: COUNTER SPELL ready!`);
        break;

      case 'gamble':
        // 50/50 chance
        if (Math.random() > 0.5) {
          const gamblerCard = game.field.find(c => c.id === card.id);
          if (gamblerCard && gamblerCard.pti != null) {
            gamblerCard.pti += action.value || 100;
            console.log(`🎰 Custom effect: GAMBLE WON! +${action.value} PTI!`);
          }
        } else {
          const gamblerCard = game.field.find(c => c.id === card.id);
          if (gamblerCard && gamblerCard.pti != null) {
            gamblerCard.pti = Math.max(0, gamblerCard.pti - (action.value || 100));
            console.log(`🎰 Custom effect: GAMBLE LOST! -${action.value} PTI!`);
          }
        }
        break;

      case 'mimic':
        // Copy another card's stats
        const mimicTarget = game.field.find(c => 
          c.id !== card.id && 
          (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        if (mimicTarget) {
          const mimicCard = game.field.find(c => c.id === card.id);
          if (mimicCard && mimicTarget.pti != null) {
            mimicCard.pti = mimicTarget.pti;
            mimicCard.stars = mimicTarget.stars;
            console.log(`🎭 Custom effect: MIMICKED ${mimicTarget.name || mimicTarget.id}'s stats!`);
          }
        }
        break;

      case 'transform':
        // Transform card - change stats and potentially type
        const transformCard = game.field.find(c => c.id === card.id);
        if (transformCard) {
          // Boost stats significantly
          transformCard.pti = (transformCard.pti || 0) + (action.value || 300);
          transformCard.stars = Math.min(5, (transformCard.stars || 1) + 1);
          transformCard.name = `${transformCard.name || 'Carta'} (Trasformato)`;
          // Clear negative effects
          transformCard.frozenTurns = 0;
          transformCard.isStunned = false;
          transformCard.poisonDamage = 0;
          transformCard.isCursed = false;
          transformCard.isSilenced = false;
          console.log(`🦋 Custom effect: TRANSFORMED! ${transformCard.name} now has ${transformCard.pti} PTI and ${transformCard.stars} stars!`);
        }
        break;

      case 'split':
        // Create a copy of the card
        const splitCard = game.field.find(c => c.id === card.id);
        if (splitCard && (splitCard.type === 'personaggi' || splitCard.type === 'personaggi_speciali')) {
          const clonedCard: Card = {
            ...splitCard,
            id: `${splitCard.id}-clone-${Date.now()}`,
            name: `${splitCard.name || 'Clone'} (Clone)`,
            pti: Math.floor((splitCard.pti || 0) / 2),
            stars: splitCard.stars || 1,
            owner: playerName
          };
          game.field.push(clonedCard);
          // Original also loses half PTI
          splitCard.pti = Math.floor((splitCard.pti || 0) / 2);
          console.log(`✂️ Custom effect: SPLIT! Created clone with ${clonedCard.pti} PTI!`);
        }
        break;

      case 'teleport':
        // Teleport - swap with a random enemy card position (represented as stat swap)
        const teleportCard = game.field.find(c => c.id === card.id);
        const teleportTarget = game.field.find(c => 
          c.owner !== playerName && 
          (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        if (teleportCard && teleportTarget) {
          // Swap PTI values
          const tempPti = teleportCard.pti;
          teleportCard.pti = teleportTarget.pti;
          teleportTarget.pti = tempPti;
          console.log(`🌀 Custom effect: TELEPORTED! Swapped PTI with ${teleportTarget.name || teleportTarget.id}!`);
        }
        break;

      case 'copy':
        // Copy enemy card stats
        const copySource = game.field.find(c => 
          c.owner !== playerName && 
          (c.type === 'personaggi' || c.type === 'personaggi_speciali') &&
          c.pti != null
        );
        if (copySource) {
          const copyDest = game.field.find(c => c.id === card.id);
          if (copyDest) {
            copyDest.pti = copySource.pti;
            copyDest.stars = copySource.stars;
            console.log(`📋 Custom effect: COPIED stats from ${copySource.name || copySource.id}!`);
          }
        }
        break;

      case 'sacrifice':
        // Sacrifice: destroy own character to deal massive damage
        const sacrificeCard = game.field.find(c => 
          c.id !== card.id && 
          c.owner === playerName && 
          (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        if (sacrificeCard) {
          const sacrificePti = sacrificeCard.pti || 0;
          // Remove sacrificed card
          game.field = game.field.filter(c => c.id !== sacrificeCard.id);
          game.graveyard.push(sacrificeCard);
          // Deal damage to all enemies equal to sacrificed PTI
          for (const enemyCard of game.field) {
            if (enemyCard.owner !== playerName && 
                (enemyCard.type === 'personaggi' || enemyCard.type === 'personaggi_speciali') &&
                enemyCard.pti != null) {
              enemyCard.pti = Math.max(0, enemyCard.pti - sacrificePti);
              console.log(`💀 Sacrifice damage: ${enemyCard.name || enemyCard.id} took ${sacrificePti} damage!`);
            }
          }
          console.log(`💀 Custom effect: SACRIFICED ${sacrificeCard.name || sacrificeCard.id} for ${sacrificePti} damage!`);
        }
        break;

      case 'swap':
        // Swap PTI with target
        const swapCard = game.field.find(c => c.id === card.id);
        const swapTarget = game.field.find(c => 
          c.owner !== playerName && 
          (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        if (swapCard && swapTarget && swapCard.pti != null && swapTarget.pti != null) {
          const temp = swapCard.pti;
          swapCard.pti = swapTarget.pti;
          swapTarget.pti = temp;
          console.log(`🔄 Custom effect: SWAPPED PTI with ${swapTarget.name || swapTarget.id}!`);
        }
        break;

      case 'destroy':
        // Destroy target card
        const destroyTarget = game.field.find(c => 
          c.owner !== playerName && 
          (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        if (destroyTarget) {
          game.field = game.field.filter(c => c.id !== destroyTarget.id);
          game.graveyard.push(destroyTarget);
          console.log(`💥 Custom effect: DESTROYED ${destroyTarget.name || destroyTarget.id}!`);
        }
        break;

      case 'mill':
        // Discard cards from deck to graveyard
        const millCount = action.value || 5;
        for (const [pName, player] of Object.entries(game.players)) {
          if (pName !== playerName) {
            for (let i = 0; i < millCount; i++) {
              if ((player as any).hand.length > 0) {
                const milledCard = (player as any).hand.pop();
                game.graveyard.push(milledCard);
              }
            }
            console.log(`📚 Custom effect: Milled ${millCount} cards from ${pName}'s hand!`);
          }
        }
        break;

      case 'insurance_effect':
        // "Assicurazione" special effect: show PTI input panel, store as insurance
        // Check if CPU - auto-apply with random value
        const ioInsAuto = (global as any).io;
        if (this.cpuAutoApplyEffect(gameId, playerName, 'insurance', card.id, ioInsAuto)) {
          break; // CPU handled it
        }
        
        if (!game.pendingEffects) {
          game.pendingEffects = new Map();
        }
        game.pendingEffects.set(playerName, {
          type: 'insurance',
          cardId: card.id,
          timestamp: Date.now()
        });
        
        console.log(`🛡️ Insurance effect: Showing PTI input panel for ${playerName}`);
        const ioIns = (global as any).io;
        if (ioIns) {
          ioIns.to(gameId).emit('show-pti-input-panel', {
            cardId: card.id,
            cardName: card.name || this.getCardNameFromUrl(card.frontImage),
            playerName,
            effectDescription: '🛡️ ASSICURAZIONE: Inserisci la quantità di PTI da "assicurare". Questi PTI verranno sottratti al tuo personaggio ora, ma verranno restituiti quando il personaggio sta per morire (scende a 0 PTI).'
          });
        }
        break;

      case 'show_pti_input_panel':
        // Check if CPU - auto-apply with random value
        const ioPtiAuto = (global as any).io;
        if (this.cpuAutoApplyEffect(gameId, playerName, 'pti_input', card.id, ioPtiAuto)) {
          break; // CPU handled it
        }
        
        // Store pending effect info and emit panel event
        if (!game.pendingEffects) {
          game.pendingEffects = new Map();
        }
        game.pendingEffects.set(playerName, {
          type: 'pti_input',
          cardId: card.id,
          timestamp: Date.now()
        });
        
        console.log(`📋 Showing PTI input panel for ${playerName} (applyEffectToCard)`);
        const ioPti = (global as any).io;
        if (ioPti) {
          ioPti.to(gameId).emit('show-pti-input-panel', {
            cardId: card.id,
            cardName: card.name || this.getCardNameFromUrl(card.frontImage),
            playerName,
            effectDescription: action.description
          });
        }
        break;

      case 'show_graveyard_selection':
        // Check if CPU - auto-apply with random selection
        const ioGraveAuto = (global as any).io;
        if (this.cpuAutoApplyEffect(gameId, playerName, 'graveyard_selection', card.id, ioGraveAuto)) {
          break; // CPU handled it
        }
        
        console.log(`📋 Showing graveyard selection for ${playerName} (applyEffectToCard)`);
        const ioGrave = (global as any).io;
        if (ioGrave) {
          const graveyardCardsForSelect = game.graveyard.map((c: Card) => ({
            id: c.id,
            name: c.name || this.getCardNameFromUrl(c.frontImage || ''),
            frontImage: c.frontImage,
            owner: c.owner
          }));
          ioGrave.to(gameId).emit('show-graveyard-selection', {
            reason: 'effect',
            cards: graveyardCardsForSelect,
            message: action.description || 'Scegli una carta dal cimitero'
          });
        }
        break;

      case 'show_deck_selection':
        // Check if CPU - auto-apply with random deck
        const ioDeckAuto = (global as any).io;
        if (this.cpuAutoApplyEffect(gameId, playerName, 'deck_selection', card.id, ioDeckAuto)) {
          break; // CPU handled it
        }
        
        console.log(`📋 Showing deck selection for ${playerName} (applyEffectToCard)`);
        const ioDeck = (global as any).io;
        if (ioDeck) {
          ioDeck.to(gameId).emit('show-deck-selection', {
            cardId: card.id,
            cardName: card.name || this.getCardNameFromUrl(card.frontImage),
            playerName,
            effectDescription: action.description
          });
        }
        break;

      // ============ INTERACTIVE EFFECTS THAT REQUIRE PANEL OR AUTO-APPLY FOR CPU ============
      
      case 'dice_control': {
        // Register dice control effect for the card owner
        const io = (global as any).io;
        const isCPU = this.isPlayerCPU(gameId, playerName);
        if (isCPU) {
          // CPU auto-chooses a random dice number (passive effect - just register it)
          console.log(`🤖 CPU ${playerName} dice control registered (passive effect)`);
        }
        // Mark card as having dice control
        const diceControlCard = game.field.find(c => c.id === card.id);
        if (diceControlCard) {
          (diceControlCard as any).hasDiceControl = true;
          (diceControlCard as any).diceControlOwner = playerName;
        }
        if (io) {
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-dice-control-active`,
            playerName: 'Sistema',
            message: `🎲 ${card.name || 'Carta'} ha attivato il controllo del dado! ${playerName} potrà scegliere il risultato del prossimo lancio.`,
            timestamp: Date.now()
          });
        }
        break;
      }
      
      case 'show_pti_input_panel': {
        const io = (global as any).io;
        if (this.cpuAutoApplyEffect(gameId, playerName, 'pti_input', card.id, io)) {
          break; // CPU handled it
        }
        // Store pending effect info and emit panel event
        if (!game.pendingEffects) {
          game.pendingEffects = new Map();
        }
        game.pendingEffects.set(playerName, {
          type: 'pti_input',
          cardId: card.id,
          timestamp: Date.now()
        });
        console.log(`📋 Showing PTI input panel for ${playerName}`);
        if (io) {
          io.to(gameId).emit('show-pti-input-panel', {
            cardId: card.id,
            cardName: card.name || this.getCardNameFromUrl(card.frontImage || ''),
            playerName,
            effectDescription: action.description
          });
        }
        break;
      }
      
      case 'insurance_effect': {
        const io = (global as any).io;
        if (this.cpuAutoApplyEffect(gameId, playerName, 'insurance', card.id, io)) {
          break; // CPU handled it
        }
        if (!game.pendingEffects) {
          game.pendingEffects = new Map();
        }
        game.pendingEffects.set(playerName, {
          type: 'insurance',
          cardId: card.id,
          timestamp: Date.now()
        });
        console.log(`🛡️ Insurance effect: Showing PTI input panel for ${playerName}`);
        if (io) {
          io.to(gameId).emit('show-pti-input-panel', {
            cardId: card.id,
            cardName: card.name || this.getCardNameFromUrl(card.frontImage || ''),
            playerName,
            effectDescription: '🛡️ ASSICURAZIONE: Inserisci la quantità di PTI da "assicurare".'
          });
        }
        break;
      }
      
      case 'show_graveyard_selection': {
        const io = (global as any).io;
        if (this.cpuAutoApplyEffect(gameId, playerName, 'graveyard_selection', card.id, io)) {
          break; // CPU handled it
        }
        console.log(`📋 Showing graveyard selection for ${playerName}`);
        if (io) {
          const graveyardCardsForSelect = game.graveyard.map((c: Card) => ({
            id: c.id,
            name: c.name || this.getCardNameFromUrl(c.frontImage || ''),
            frontImage: c.frontImage,
            owner: c.owner
          }));
          io.to(gameId).emit('show-graveyard-selection', {
            reason: 'effect',
            cards: graveyardCardsForSelect,
            message: action.description || 'Scegli una carta dal cimitero'
          });
        }
        break;
      }
      
      case 'show_deck_selection': {
        const io = (global as any).io;
        if (this.cpuAutoApplyEffect(gameId, playerName, 'deck_selection', card.id, io)) {
          break; // CPU handled it
        }
        console.log(`📋 Showing deck selection for ${playerName}`);
        if (io) {
          io.to(gameId).emit('show-deck-selection', {
            cardId: card.id,
            cardName: card.name || this.getCardNameFromUrl(card.frontImage || ''),
            playerName,
            effectDescription: action.description
          });
        }
        break;
      }
      
      case 'swap': {
        const io = (global as any).io;
        if (this.cpuAutoApplyEffect(gameId, playerName, 'swap', card.id, io)) {
          break; // CPU handled it
        }
        console.log(`🔄 Showing swap panel for ${playerName} - Baratto effect`);
        const otherPlayers = game.turnOrder.filter((p: string) => p !== playerName);
        if (io) {
          io.to(gameId).emit('show-swap-selection', {
            cardId: card.id,
            cardName: card.name || this.getCardNameFromUrl(card.frontImage || ''),
            playerName,
            otherPlayers,
            effectDescription: action.description
          });
        }
        break;
      }
      
      case 'cycle_cards': {
        // Ciclone effect: Each player passes their field cards to the next player
        const io = (global as any).io;
        console.log(`🌀 CICLONE: Rotating field cards between all players`);
        const turnOrderCycle = game.turnOrder.filter((p: string) => game.players[p]);
        if (turnOrderCycle.length >= 2) {
          const playerFieldCards: { [key: string]: Card[] } = {};
          for (const pName of turnOrderCycle) {
            playerFieldCards[pName] = game.field.filter((c: Card) => c.owner === pName);
          }
          for (let i = 0; i < turnOrderCycle.length; i++) {
            const currentPlayer = turnOrderCycle[i];
            const previousPlayer = turnOrderCycle[(i - 1 + turnOrderCycle.length) % turnOrderCycle.length];
            const cardsToReceive = playerFieldCards[previousPlayer];
            for (const fieldCard of cardsToReceive) {
              fieldCard.owner = currentPlayer;
              console.log(`🌀 ${fieldCard.name || fieldCard.id} transferred from ${previousPlayer} to ${currentPlayer}`);
            }
          }
          if (io) {
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-ciclone`,
              playerName: 'Sistema',
              message: `🌀 CICLONE! Tutti i giocatori hanno passato le loro carte in campo al giocatore successivo!`,
              timestamp: Date.now()
            });
          }
        }
        break;
      }

      default:
        console.log(`❓ Unknown custom effect type: ${action.type}`);
    }
  }

  // NEW: Authoritative MOSSE attack execution
  async executeMossaAttack(gameId: string, attackerName: string, mosseCardId: string, targetCardId: string, damageValue: number, isHandTarget: boolean | number = false, defenseRequestEmitter?: (data: any) => void | string | null, starsToRemove: number = 0, mosseEffect?: string | null): Promise<{ success: boolean; result?: any; error?: string }> {
    // Handle legacy calls where isHandTarget might be starsToRemove number
    if (typeof isHandTarget === 'number') {
      starsToRemove = isHandTarget;
      isHandTarget = false;
      if (typeof defenseRequestEmitter === 'string') {
        mosseEffect = defenseRequestEmitter;
        defenseRequestEmitter = undefined;
      }
    }
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
    
    // FREEZE/STUN CHECK: Frozen or stunned characters cannot attack
    if ((attackerCharacter as any).frozenTurns && (attackerCharacter as any).frozenTurns > 0) {
      console.log(`❄️ ${attackerName}'s character is FROZEN - cannot attack`);
      return { success: false, error: `Il tuo personaggio è congelato! Non può attaccare per ancora ${(attackerCharacter as any).frozenTurns} turni.` };
    }
    if ((attackerCharacter as any).isStunned) {
      console.log(`💫 ${attackerName}'s character is STUNNED - cannot attack`);
      return { success: false, error: 'Il tuo personaggio è stordito! Non può attaccare questo turno.' };
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
    
    // MOSSE RESTRICTION CHECK: Check if this MOSSE is restricted from/against specific characters
    const mosseCardName = this.getCardNameFromUrl(mosseCard.frontImage || '');
    const targetCardName = this.getCardNameFromUrl(targetCard.frontImage || '');
    const attackerCharacterName = this.getCardNameFromUrl(attackerCharacter.frontImage || '');
    
    // Check mosseRestrictedAgainst - this MOSSE cannot be used ON certain characters
    if (mosseCard.mosseRestrictedAgainst && Array.isArray(mosseCard.mosseRestrictedAgainst)) {
      const normalizedTarget = targetCardName.toUpperCase().replace(/[_-]/g, ' ').trim();
      const isRestricted = mosseCard.mosseRestrictedAgainst.some((restrictedName: string) => {
        const normalizedRestricted = restrictedName.toUpperCase().replace(/[_-]/g, ' ').trim();
        return normalizedTarget.includes(normalizedRestricted) || normalizedRestricted.includes(normalizedTarget);
      });
      
      if (isRestricted) {
        console.log(`🚫 MOSSE RESTRICTION: "${mosseCardName}" cannot be used AGAINST "${targetCardName}"`);
        return { success: false, error: `La mossa "${mosseCardName}" non può essere usata contro "${targetCardName}"!` };
      }
    }
    
    // Check mosseRestrictedFrom - certain characters cannot USE this MOSSE
    if (mosseCard.mosseRestrictedFrom && Array.isArray(mosseCard.mosseRestrictedFrom)) {
      const normalizedAttacker = attackerCharacterName.toUpperCase().replace(/[_-]/g, ' ').trim();
      const isRestricted = mosseCard.mosseRestrictedFrom.some((restrictedName: string) => {
        const normalizedRestricted = restrictedName.toUpperCase().replace(/[_-]/g, ' ').trim();
        return normalizedAttacker.includes(normalizedRestricted) || normalizedRestricted.includes(normalizedAttacker);
      });
      
      if (isRestricted) {
        console.log(`🚫 MOSSE RESTRICTION: "${attackerCharacterName}" cannot USE "${mosseCardName}"`);
        return { success: false, error: `Il personaggio "${attackerCharacterName}" non può usare la mossa "${mosseCardName}"!` };
      }
    }
    
    // PROTECTION CHECK: Check if target card has custom protection effect (isProtected)
    if (!isHandTarget) {
      const protectionCheck = this.canCardBeAttacked(gameId, targetCardId, attackerName);
      if (!protectionCheck.canAttack) {
        console.log(`🛡️ PROTECTION: Attack blocked - ${protectionCheck.reason}`);
        return { success: false, error: protectionCheck.reason || 'Questa carta non può essere attaccata!' };
      }
    }
    
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
      isHandTarget: isHandTarget as boolean, // NEW: Pass isHandTarget flag
      deckType: 'mosse',
      starsToRemove: starsToRemove || 0,
      mosseEffect: mosseEffect || undefined
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

  // Helper function to check if a card has custom activatable effects
  private cardHasCustomEffect(effect: string, text: string): boolean {
    const combined = (effect + ' ' + text).toLowerCase();
    
    // Check for formal effect tags
    if (combined.includes('[comportamento:') || 
        combined.includes('[dado:') || 
        combined.includes('[dettagli:') ||
        combined.includes('[animazione:')) {
      return true;
    }
    
    // Check for effect field with content
    if (effect && effect.trim().toLowerCase() !== 'none' && effect.trim() !== '') {
      return true;
    }
    
    // Check for effect-like keywords in text field (Italian keywords)
    const effectKeywords = ['quando', 'effetto', 'attiva', 'assorbe', 'aggiunge', 'infligge', 
                            'protetto', 'immune', 'clona', 'trasforma', 'ruba', 'cura',
                            'danno', 'nemico', 'alleato'];
    for (const keyword of effectKeywords) {
      if (combined.includes(keyword)) {
        return true;
      }
    }
    
    return false;
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

    // Check if card has custom protection effect (from AI-processed effects)
    if (card.isProtected) {
      return { canAttack: false, reason: `${card.name || 'Questa carta'} non può essere attaccato! (Effetto: protezione)` };
    }

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
      
      // FIRST: Check if card has modifications from JSON storage (highest priority)
      const mod = jsonStorage.cardModifications.getByOriginalCardId(card.id);
      if (mod && !mod.isDeleted && (mod.pti !== null || mod.stars !== null)) {
        const pti = mod.pti !== null ? mod.pti : (card.pti || 1000);
        const stars = mod.stars !== null ? mod.stars : (card.stars || 1);
        card.text = `PTI: ${pti} | Stelle: ${stars} | PTI originali: ${pti}`;
        card.pti = pti;
        card.originalPti = pti;
        card.stars = stars;
        card.name = mod.name || cardName;
        console.log(`✅ Card ${card.id} PTI from modifications: pti=${pti}, stars=${stars}`);
        return;
      }
      
      // SECOND: Use synchronous cache lookup for instant response
      const cachedResult = getPersonaggioFromCache(cardName);
      
      if (cachedResult && (cachedResult.pti !== null || cachedResult.stars !== null)) {
        const pti = cachedResult.pti || 1000;
        const stars = cachedResult.stars || 1;
        card.text = `PTI: ${pti} | Stelle: ${stars} | PTI originali: ${pti}`;
        card.pti = pti;
        card.originalPti = pti;
        card.stars = stars;
        card.name = cardName;
      } else {
        card.text = 'PTI: 1000 | Stelle: 1 | PTI originali: 1000';
        card.pti = 1000;
        card.originalPti = 1000;
        card.stars = 1;
        card.name = cardName;
      }
    } catch (error) {
      card.text = 'PTI: 1000 | Stelle: 1 | PTI originali: 1000';
      card.pti = 1000;
      card.originalPti = 1000;
      card.stars = 1;
    }
  }

  // Async version for CPU AI fallback (kept for compatibility)
  private async autoAnalyzePersonaggioCard(gameId: string, card: any, playerName: string) {
    try {
      const cardName = this.getCardNameFromUrl(card.frontImage);
      
      // FIRST: Check if card has modifications from JSON storage (highest priority)
      const mod = jsonStorage.cardModifications.getByOriginalCardId(card.id);
      if (mod && !mod.isDeleted && (mod.pti !== null || mod.stars !== null)) {
        const pti = mod.pti !== null ? mod.pti : (card.pti || 1000);
        const stars = mod.stars !== null ? mod.stars : (card.stars || 1);
        card.text = `PTI: ${pti} | Stelle: ${stars} | PTI originali: ${pti}`;
        card.pti = pti;
        card.originalPti = pti;
        card.stars = stars;
        card.name = mod.name || cardName;
        return;
      }
      
      // SECOND: Try sync cache
      const cachedResult = getPersonaggioFromCache(cardName);
      
      if (cachedResult && (cachedResult.pti !== null || cachedResult.stars !== null)) {
        const pti = cachedResult.pti || 1000;
        const stars = cachedResult.stars || 1;
        card.text = `PTI: ${pti} | Stelle: ${stars} | PTI originali: ${pti}`;
        card.pti = pti;
        card.originalPti = pti;
        card.stars = stars;
        card.name = cardName;
        return;
      }
      
      // THIRD: Fallback for CPU players using AI analysis (async)
      const game = this.games.get(gameId);
      const player = game?.players[playerName];
      
      if (player?.isCPU && player.cpuInstance) {
        const analysis = await player.cpuInstance.analyzeCardImageDetailed(card.frontImage, 'personaggi');
        
        if (analysis && ((analysis.pti && analysis.pti > 0) || (analysis.stars && analysis.stars > 0))) {
          card.text = `PTI: ${analysis.pti} | Stelle: ${analysis.stars} | PTI originali: ${analysis.pti}`;
          card.pti = analysis.pti;
          card.originalPti = analysis.pti;
          card.stars = analysis.stars;
          card.name = cardName;
        } else {
          card.text = 'PTI: 1000 | Stelle: 1 | PTI originali: 1000';
          card.pti = 1000;
          card.originalPti = 1000;
          card.stars = 1;
          card.name = cardName;
        }
      } else {
        card.text = 'PTI: 1000 | Stelle: 1 | PTI originali: 1000';
        card.pti = 1000;
        card.originalPti = 1000;
        card.stars = 1;
        card.name = cardName;
      }
    } catch (error) {
      card.text = 'PTI: 1000 | Stelle: 1 | PTI originali: 1000';
      card.pti = 1000;
      card.originalPti = 1000;
      card.stars = 1;
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

  moveToGraveyard(gameId: string, cardId: string, playerName: string, attacker?: string): { success: boolean, graveyardCount?: number, cardImage?: string, cardType?: string, eliminationCheck?: boolean, sorosActivated?: boolean, sorosImage?: string, sorosActivator?: string, detachedParasites?: string[], insuranceTriggered?: boolean } {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    // INSURANCE CHECK: Before moving to graveyard, check if the card has insurance
    const cardToCheck = game.field.find(c => c.id === cardId);
    if (cardToCheck) {
      const insurancePti = (cardToCheck as any).insurancePti || 0;
      if (insurancePti > 0) {
        // Trigger insurance! Restore PTI instead of dying
        cardToCheck.pti = insurancePti;
        (cardToCheck as any).ptiValue = insurancePti;
        (cardToCheck as any).insurancePti = 0; // Insurance used up
        
        const cardName = cardToCheck.name || this.getCardNameFromUrl(cardToCheck.frontImage);
        console.log(`🛡️ INSURANCE TRIGGERED in moveToGraveyard! ${cardName} restored to ${insurancePti} PTI instead of dying!`);
        
        // Update card text
        const currentStars = cardToCheck.stars || 0;
        cardToCheck.text = `PTI: ${insurancePti} | Stelle: ${currentStars} | 🛡️ Assicurazione usata!`;
        
        // Notify players
        const io = (global as any).io;
        if (io) {
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-insurance-trigger`,
            playerName: 'Sistema',
            message: `🛡️ ASSICURAZIONE ATTIVATA! ${cardName} stava per morire ma ha recuperato ${insurancePti} PTI!`,
            timestamp: Date.now()
          });
        }
        
        return { success: true, insuranceTriggered: true };
      }
    }

    // REVENGE EFFECT: If card has revenge, deal damage to attacker before dying
    if (cardToCheck && (cardToCheck as any).revengeDamage && attacker && attacker !== playerName) {
      const revengeDmg = (cardToCheck as any).revengeDamage;
      const attackerChar = game.field.find((c: Card) => 
        c.owner === attacker && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
      );
      
      if (attackerChar) {
        const attackerPTI = this.extractPTIFromNote(attackerChar.text || '');
        const newAttackerPTI = Math.max(0, attackerPTI - revengeDmg);
        attackerChar.pti = newAttackerPTI;
        this.updateCardTextWithPTI(attackerChar);
        
        const dyingCardName = cardToCheck.name || this.getCardNameFromUrl(cardToCheck.frontImage || '');
        const attackerCharName = attackerChar.name || this.getCardNameFromUrl(attackerChar.frontImage || '');
        
        console.log(`👊 REVENGE TRIGGERED! ${dyingCardName} dealt ${revengeDmg} damage to ${attackerCharName} on death`);
        
        const io = (global as any).io;
        if (io) {
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-revenge-trigger`,
            playerName: 'Sistema',
            message: `👊 VENDETTA! ${dyingCardName} infligge ${revengeDmg} danni a ${attackerCharName} morendo! (PTI: ${attackerPTI} → ${newAttackerPTI})`,
            timestamp: Date.now()
          });
        }
        
        // Check if attacker died from revenge
        if (newAttackerPTI <= 0) {
          console.log(`💀 ${attackerCharName} killed by revenge!`);
          // Use setTimeout to avoid recursive death handling
          setTimeout(() => {
            this.moveToGraveyard(gameId, attackerChar.id, attacker, playerName);
          }, 100);
        }
      }
    }

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
      const cardOwner = card.owner || playerName; // Use card's owner or default to playerName
      
      // BAMBOLA VOODOO: Remove any voodoo links when character dies
      if (card.type === 'personaggi' || card.type === 'personaggi_speciali') {
        this.removeVoodooLink(gameId, cardId);
      }
      
      // FIXED: Always add card to graveyard, set eliminatedBy to who removed it
      card.eliminatedBy = playerName;
      game.graveyard.push(card);
      console.log(`Card ${cardId} moved to graveyard. Owner: ${cardOwner}, Eliminated by: ${playerName}`);

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
        const effectiveLimit = Math.max(1, baseLimit + playerModifier); // Minimum 1 death required
        if (graveyardCount >= effectiveLimit && !game.eliminatedPlayers.has(playerName)) {
          eliminationCheck = true;
        }
      }

      return { success: true, graveyardCount, cardImage: card.frontImage, cardType: card.type, eliminationCheck, sorosActivated: false, detachedParasites };
    }
    
    return { success: false, detachedParasites };
  }

  // Resurrect a specific card selected by the player from the graveyard
  resurrectSelectedCard(gameId: string, cardId: string, playerName: string): { success: boolean; cardName?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    // Find the card in graveyard
    const cardIndex = game.graveyard.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      console.log(`👼 Resurrect failed: Card ${cardId} not found in graveyard`);
      return { success: false };
    }

    // Remove from graveyard and add to player's hand
    const card = game.graveyard.splice(cardIndex, 1)[0];
    card.owner = playerName;
    game.players[playerName].hand.push(card);

    const cardName = card.name || this.getCardNameFromUrl(card.frontImage);
    console.log(`👼 ${playerName} resurrected ${cardName} from graveyard!`);

    // Clear pending effect
    if (game.pendingEffects) {
      game.pendingEffects.delete(playerName);
    }

    return { success: true, cardName };
  }

  processPtiInputEffect(gameId: string, cardId: string, ptiValue: number, playerName: string): { success: boolean; message?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    console.log(`📋 Processing PTI input effect: ${ptiValue} PTI for card ${cardId} by ${playerName}`);

    const playerData = game.players[playerName];
    if (!playerData) {
      console.log(`📋 PTI input effect failed: Player ${playerName} not found`);
      return { success: false };
    }

    // Check pending effect type
    const pendingEffect = game.pendingEffects?.get(playerName);
    const effectType = pendingEffect?.type || 'pti_input';
    
    // Clear pending effect
    if (game.pendingEffects) {
      game.pendingEffects.delete(playerName);
    }

    // Find player's active character on field
    const activeChar = game.field.find((c: any) => 
      c.owner === playerName && 
      (c.type === 'personaggi' || c.type === 'personaggi_speciali')
    );

    // Handle INSURANCE effect (Assicurazione)
    if (effectType === 'insurance') {
      if (!activeChar) {
        console.log(`🛡️ Insurance failed: No active character for ${playerName}`);
        return { success: false, message: 'Nessun personaggio attivo trovato per l\'assicurazione' };
      }

      const currentPti = activeChar.pti || (activeChar as any).ptiValue || 0;
      const charName = activeChar.name || this.getCardNameFromUrl(activeChar.frontImage);
      
      if (ptiValue > currentPti) {
        return { success: false, message: `Non puoi assicurare più PTI di quelli che hai (${currentPti} PTI)` };
      }

      // Subtract PTI from character
      const newPti = currentPti - ptiValue;
      activeChar.pti = newPti;
      (activeChar as any).ptiValue = newPti;
      
      // Store insurance amount on the character
      (activeChar as any).insurancePti = ((activeChar as any).insurancePti || 0) + ptiValue;
      
      // Update card text
      const currentStars = activeChar.stars || 0;
      activeChar.text = `PTI: ${newPti} | Stelle: ${currentStars} | 🛡️ Assicurazione: ${(activeChar as any).insurancePti} PTI`;

      console.log(`🛡️ Insurance applied: ${charName} lost ${ptiValue} PTI (${currentPti} → ${newPti}), insured: ${(activeChar as any).insurancePti} PTI`);
      
      return { 
        success: true, 
        message: `🛡️ ASSICURAZIONE ATTIVATA! ${charName} ha assicurato ${ptiValue} PTI. Quando scenderà a 0 PTI, non morirà ma recupererà ${(activeChar as any).insurancePti} PTI!`
      };
    }

    // Handle regular PTI input effects
    const playerField = game.field.filter((c: any) => c.owner === playerName) || [];
    let card = playerField.find((c: any) => c.id === cardId);
    if (!card) {
      card = game.graveyard?.find((c: any) => c.id === cardId);
    }
    
    const effectDescription = (card as any)?.effect || '';
    const cardName = card?.name || this.getCardNameFromUrl(card?.frontImage || '') || 'Carta';
    const effectLower = effectDescription.toLowerCase();

    let message = '';

    if (effectLower.includes('bonus') || effectLower.includes('potenzia') || effectLower.includes('aumenta')) {
      if (activeChar) {
        const oldPti = activeChar.pti || (activeChar as any).ptiValue || 0;
        activeChar.pti = oldPti + ptiValue;
        (activeChar as any).ptiValue = oldPti + ptiValue;
        const targetName = activeChar.name || this.getCardNameFromUrl(activeChar.frontImage);
        message = `✨ ${cardName}: ${targetName} ha ricevuto +${ptiValue} PTI (${oldPti} → ${activeChar.pti})!`;
      } else {
        message = `📋 ${cardName}: Nessun personaggio trovato per applicare +${ptiValue} PTI`;
      }
    } else if (effectLower.includes('danno') || effectLower.includes('attacca')) {
      const enemyCards = game.field.filter((c: any) => 
        c.owner !== playerName && 
        (c.type === 'personaggi' || c.type === 'personaggi_speciali')
      );

      if (enemyCards.length > 0) {
        const targetCard = enemyCards[0];
        const oldPti = targetCard.pti || (targetCard as any).ptiValue || 0;
        const newPti = Math.max(0, oldPti - ptiValue);
        targetCard.pti = newPti;
        (targetCard as any).ptiValue = newPti;
        const targetName = targetCard.name || this.getCardNameFromUrl(targetCard.frontImage);
        message = `⚔️ ${cardName}: ${targetName} ha subito ${ptiValue} danni (${oldPti} → ${newPti} PTI)!`;

        if (newPti <= 0) {
          this.triggerInsuranceOrDeath(gameId, targetCard, targetCard.owner);
        }
      } else {
        message = `📋 ${cardName}: Nessun bersaglio nemico trovato per infliggere ${ptiValue} danni`;
      }
    } else {
      message = `📋 ${cardName}: Effetto applicato con ${ptiValue} PTI`;
    }

    console.log(`📋 PTI effect result: ${message}`);
    return { success: true, message };
  }

  // Check if character has insurance before death, and trigger it
  private triggerInsuranceOrDeath(gameId: string, card: any, ownerName: string): void {
    const insurancePti = (card as any).insurancePti || 0;
    
    if (insurancePti > 0) {
      // Trigger insurance! Restore PTI instead of dying
      card.pti = insurancePti;
      card.ptiValue = insurancePti;
      (card as any).insurancePti = 0; // Insurance used up
      
      const cardName = card.name || this.getCardNameFromUrl(card.frontImage);
      console.log(`🛡️ INSURANCE TRIGGERED! ${cardName} restored to ${insurancePti} PTI instead of dying!`);
      
      // Update card text
      const currentStars = card.stars || 0;
      card.text = `PTI: ${insurancePti} | Stelle: ${currentStars} | 🛡️ Assicurazione usata!`;
      
      // Notify players
      const io = (global as any).io;
      if (io) {
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-insurance-trigger`,
          playerName: 'Sistema',
          message: `🛡️ ASSICURAZIONE ATTIVATA! ${cardName} stava per morire ma ha recuperato ${insurancePti} PTI!`,
          timestamp: Date.now()
        });
      }
    } else {
      // No insurance, character dies
      this.moveToGraveyard(gameId, card.id, ownerName, 'PTI a 0');
    }
  }

  processDeckSelectionEffect(gameId: string, cardId: string, deckType: string, playerName: string): { success: boolean; message?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    console.log(`🎴 Processing deck selection effect: ${deckType} for card ${cardId} by ${playerName}`);

    const playerData = game.players[playerName];
    if (!playerData) return { success: false };

    const playerFieldDeck = (playerData as any).field || [];
    const card = playerFieldDeck.find((c: any) => c.id === cardId) || game.field?.find((c: any) => c.id === cardId);
    if (!card) {
      console.log(`🎴 Deck selection failed: Card ${cardId} not found on field`);
      return { success: false };
    }

    const cardName = card.name || this.getCardNameFromUrl(card.frontImage);
    
    let targetDeck: any[] | null = null;
    let deckDisplayName = '';

    switch (deckType) {
      case 'personaggi':
        targetDeck = game.decks.personaggi;
        deckDisplayName = 'PERSONAGGI';
        break;
      case 'mosse':
        targetDeck = game.decks.mosse;
        deckDisplayName = 'MOSSE';
        break;
      case 'bonus':
        targetDeck = game.decks.bonus;
        deckDisplayName = 'BONUS';
        break;
      case 'personaggi_speciali':
        targetDeck = game.decks.personaggi_speciali;
        deckDisplayName = 'SPECIALI';
        break;
    }

    if (!targetDeck || targetDeck.length === 0) {
      return { success: true, message: `🎴 Il mazzo ${deckDisplayName} è vuoto!` };
    }

    const drawnCard = targetDeck.shift();
    if (drawnCard) {
      drawnCard.owner = playerName;
      playerData.hand.push(drawnCard);
      const drawnCardName = drawnCard.name || this.getCardNameFromUrl(drawnCard.frontImage);
      console.log(`🎴 ${playerName} drew ${drawnCardName} from ${deckDisplayName} deck`);
      return { success: true, message: `🎴 ${cardName}: ${playerName} ha pescato una carta dal mazzo ${deckDisplayName}!` };
    }

    return { success: false };
  }

  // Process swap/baratto effect - swap all cards between two players
  processSwapEffect(gameId: string, playerName: string, targetPlayer: string, io: any): { success: boolean; message?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    console.log(`🔄 Processing BARATTO swap between ${playerName} and ${targetPlayer}`);

    const player1Data = game.players[playerName];
    const player2Data = game.players[targetPlayer];

    if (!player1Data || !player2Data) {
      console.log(`🔄 Swap failed: Player data not found`);
      return { success: false, message: 'Giocatori non trovati' };
    }

    // Swap hands
    const tempHand = [...player1Data.hand];
    player1Data.hand = [...player2Data.hand];
    player2Data.hand = tempHand;

    // Update card ownership in hands
    for (const card of player1Data.hand) {
      card.owner = playerName;
    }
    for (const card of player2Data.hand) {
      card.owner = targetPlayer;
    }

    // Swap field cards (owned by each player)
    const player1FieldCards = game.field.filter((c: Card) => c.owner === playerName);
    const player2FieldCards = game.field.filter((c: Card) => c.owner === targetPlayer);

    // Update ownership of field cards
    for (const card of player1FieldCards) {
      card.owner = targetPlayer;
    }
    for (const card of player2FieldCards) {
      card.owner = playerName;
    }

    console.log(`🔄 BARATTO completed! ${playerName} now has ${player1Data.hand.length} cards in hand, ${targetPlayer} now has ${player2Data.hand.length} cards in hand`);

    return { 
      success: true, 
      message: `🔄 BARATTO! ${playerName} e ${targetPlayer} hanno scambiato tutte le loro carte!` 
    };
  }

  // Check if any player has a dice control effect active
  checkDiceControlEffect(gameId: string, rollingPlayer: string): { hasDiceControl: boolean; controllingPlayer?: string; cardId?: string; cardName?: string } {
    const game = this.games.get(gameId);
    if (!game) return { hasDiceControl: false };

    // Check all field cards for dice control effect
    for (const card of game.field) {
      if ((card as any).hasDiceControl && (card as any).diceControlOwner) {
        const controllingPlayer = (card as any).diceControlOwner;
        console.log(`🎲 Found dice control on ${card.name || card.id} owned by ${controllingPlayer}`);
        return {
          hasDiceControl: true,
          controllingPlayer,
          cardId: card.id,
          cardName: card.name || this.getCardNameFromUrl(card.frontImage || '')
        };
      }
    }

    return { hasDiceControl: false };
  }

  // Consume the dice control effect after it's used
  consumeDiceControlEffect(gameId: string, controllingPlayer: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    // Find and remove the dice control from the card
    for (const card of game.field) {
      if ((card as any).hasDiceControl && (card as any).diceControlOwner === controllingPlayer) {
        console.log(`🎲 Consuming dice control effect from ${card.name || card.id}`);
        delete (card as any).hasDiceControl;
        delete (card as any).diceControlOwner;
        break;
      }
    }
  }

  // Complete a pending controlled dice roll (from CPU dice effect when another player controls)
  completePendingControlledDice(gameId: string, pendingId: string, selectedNumber: number, io: any): void {
    const game = this.games.get(gameId);
    if (!game || !game.pendingControlledDice) return;
    
    const pendingData = game.pendingControlledDice.get(pendingId);
    if (!pendingData) {
      console.log(`⚠️ No pending controlled dice found for ${pendingId}`);
      return;
    }
    
    const { rollingPlayer, cpuGuess, selectedCharId, selectedCharName, correctEffect, wrongEffect, cardId } = pendingData;
    
    // Determine if CPU guessed correctly
    const isCorrect = selectedNumber === cpuGuess;
    const effectToApply = isCorrect ? correctEffect : wrongEffect;
    
    console.log(`🎲 Completing controlled dice: Result ${selectedNumber}, CPU guessed ${cpuGuess}, ${isCorrect ? 'CORRECT!' : 'WRONG!'} → "${effectToApply}"`);
    
    // Apply effect to selected character
    const targetCard = game.field.find((c: Card) => c.id === selectedCharId);
    if (targetCard) {
      const effectLower = effectToApply.toLowerCase();
      if (effectLower.includes('raddoppia')) {
        if (effectLower.includes('pti')) targetCard.pti = (targetCard.pti || 0) * 2;
        if (effectLower.includes('stelle')) targetCard.stars = (targetCard.stars || 0) * 2;
        console.log(`🎲 Applied: ${selectedCharName} doubled stats to ${targetCard.pti} PTI, ${targetCard.stars} stars`);
      } else if (effectLower.includes('dimezza')) {
        if (effectLower.includes('pti')) targetCard.pti = Math.floor((targetCard.pti || 0) / 2);
        if (effectLower.includes('stelle')) targetCard.stars = Math.floor((targetCard.stars || 0) / 2);
        console.log(`🎲 Applied: ${selectedCharName} halved stats to ${targetCard.pti} PTI, ${targetCard.stars} stars`);
      } else if (effectLower.includes('morte')) {
        targetCard.pti = 0;
        this.moveToGraveyard(gameId, targetCard.id, targetCard.owner || '', rollingPlayer);
        console.log(`🎲 Applied: ${selectedCharName} died from dice effect`);
      }
      this.updateCardTextWithPTI(targetCard);
    }
    
    // Send chat message about completed action
    if (io) {
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-cpu-dice-complete`,
        playerName: 'Sistema',
        message: `🎲 CPU ${rollingPlayer} aveva scelto ${cpuGuess}. Risultato: ${selectedNumber} - ${isCorrect ? '✅ Indovinato!' : '❌ Sbagliato!'} Effetto: "${effectToApply}" applicato a ${selectedCharName}`,
        timestamp: Date.now()
      });
    }
    
    // Return the dice card to bottom of deck
    this.returnToDeck(gameId, cardId, rollingPlayer);
    
    // Clean up pending data
    game.pendingControlledDice.delete(pendingId);
    
    // Broadcast updated state
    io.to(gameId).emit('game-state-update', this.getSanitizedGameState(gameId));
  }

  // Complete a pending controlled auto dice roll (DADO_AUTOMATICO)
  completePendingControlledAutoDice(gameId: string, pendingId: string, selectedNumber: number, io: any): void {
    const game = this.games.get(gameId);
    if (!game || !game.pendingControlledAutoDice) return;
    
    const pendingData = game.pendingControlledAutoDice.get(pendingId);
    if (!pendingData) {
      console.log(`⚠️ No pending controlled auto dice found for ${pendingId}`);
      return;
    }
    
    const { rollingPlayer, selectedCharId, selectedCharName, autoEffects, cardId } = pendingData;
    
    // Check for full multi-target data (stored by confirmAutoDiceSelection)
    const fullData = (game as any).pendingAutoDiceFullData?.get(pendingId);
    const allSelectedCharIds: string[] = fullData?.selectedCharacterIds || [selectedCharId];
    
    // Get the effect for the selected number
    const effectToApply = autoEffects[selectedNumber] || 'Nessun effetto';
    
    console.log(`🎲 Completing controlled auto dice: Result ${selectedNumber} → "${effectToApply}" for ${allSelectedCharIds.length} targets`);
    
    // Get all selected characters
    const selectedCharacters = allSelectedCharIds
      .map(id => game.field.find((c: Card) => c.id === id))
      .filter(Boolean) as Card[];
    
    // Separate characters by owner for effect targeting
    const playerChars = selectedCharacters.filter(c => c.owner === rollingPlayer);
    const enemyChars = selectedCharacters.filter(c => c.owner !== rollingPlayer);
    
    // Determine which characters to affect based on effect text
    const effectLower = effectToApply.toLowerCase();
    let charsToAffect: Card[] = [];
    
    if (effectLower.includes('personaggio che usa questa carta') || 
        effectLower.includes('chi usa questa carta') ||
        effectLower.includes('personaggio proprio') ||
        effectLower.includes('tuo personaggio')) {
      charsToAffect = playerChars;
    } else if (effectLower.includes('personaggio avversario') || 
               effectLower.includes('personaggi avversari') ||
               effectLower.includes('nemico') ||
               effectLower.includes('nemici')) {
      charsToAffect = enemyChars;
    } else if (effectLower.includes('personaggi coinvolti') || 
               effectLower.includes('tutti i personaggi') ||
               effectLower.includes('entrambi')) {
      charsToAffect = selectedCharacters;
    } else {
      charsToAffect = selectedCharacters;
    }
    
    // Apply effect to all affected characters
    const affectedNames: string[] = [];
    for (const targetCard of charsToAffect) {
      const charName = targetCard.name || this.getCardNameFromUrl(targetCard.frontImage || '');
      affectedNames.push(charName);
      
      if (effectLower.includes('morte') || effectLower.includes('muore')) {
        const turnsMatch = effectToApply.match(/(\d+)\s*turn/i);
        if (turnsMatch) {
          const turns = parseInt(turnsMatch[1]);
          (targetCard as any).deathCountdown = turns;
          console.log(`🎲 Applied: ${charName} will die in ${turns} turns`);
        } else {
          console.log(`🎲💀 ${charName} dies from controlled dice effect`);
          this.moveToGraveyard(gameId, targetCard.id, targetCard.owner || '', rollingPlayer);
        }
      } else if (effectLower.includes('dimezza')) {
        if (effectLower.includes('pti')) targetCard.pti = Math.floor((targetCard.pti || 0) / 2);
        if (effectLower.includes('stelle')) targetCard.stars = Math.floor((targetCard.stars || 0) / 2);
      } else if (effectLower.includes('perde')) {
        const ptiMatch = effectToApply.match(/(\d+)\s*pti/i);
        const starMatch = effectToApply.match(/(\d+)\s*stell/i);
        if (ptiMatch) targetCard.pti = Math.max(0, (targetCard.pti || 0) - parseInt(ptiMatch[1]));
        if (starMatch) targetCard.stars = Math.max(0, (targetCard.stars || 0) - parseInt(starMatch[1]));
      }
      this.updateCardTextWithPTI(targetCard);
    }
    
    // Emit dice animation to all players
    if (io) {
      io.to(gameId).emit('dice-rolled', { result: selectedNumber, playerName: rollingPlayer, wasControlled: true });
    }
    
    // Send chat message about completed action
    if (io) {
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-cpu-auto-dice-complete`,
        playerName: 'Sistema',
        message: `🎲 Dado controllato: Risultato ${selectedNumber} → "${effectToApply}" applicato a ${affectedNames.join(', ')}`,
        timestamp: Date.now()
      });
    }
    
    // IMPORTANT: Do NOT return the dice control card to deck - it stays in field!
    // The cardId here is the dice control card (e.g., Mazzamauriegl), not the BONUS card
    // The BONUS card (e.g., Gioco d'azzardo) was already handled when the effect was triggered
    // and should be returned to deck by the calling code, not here
    
    // Clean up pending data
    game.pendingControlledAutoDice.delete(pendingId);
    if ((game as any).pendingAutoDiceFullData) {
      // Get the autoDiceId to clean up the pending auto dice
      const autoDiceId = fullData?.autoDiceId;
      if (autoDiceId && game.pendingAutoDice) {
        game.pendingAutoDice.delete(autoDiceId);
      }
      (game as any).pendingAutoDiceFullData.delete(pendingId);
    }
    
    // Broadcast updated state
    io.to(gameId).emit('game-state-update', this.getSanitizedGameState(gameId));
  }

  // Check if a player is CPU
  isPlayerCPU(gameId: string, playerName: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;
    
    // Handle both Map and plain object cases
    let player: any;
    if (game.players instanceof Map) {
      player = game.players.get(playerName);
    } else if (typeof game.players === 'object') {
      player = (game.players as any)[playerName];
    }
    
    return player?.isCPU === true;
  }

  // CPU automatically applies effect with random value - returns true if handled
  cpuAutoApplyEffect(gameId: string, playerName: string, effectType: string, cardId: string, io: any): boolean {
    if (!this.isPlayerCPU(gameId, playerName)) {
      return false; // Not a CPU player, let frontend handle it
    }

    const game = this.games.get(gameId);
    if (!game) return false;

    console.log(`🤖 CPU ${playerName} auto-applying effect: ${effectType}`);

    switch (effectType) {
      case 'pti_input':
      case 'insurance': {
        // Random PTI value between 50 and 500
        const randomPti = Math.floor(Math.random() * 451) + 50;
        console.log(`🤖 CPU ${playerName} auto-selected PTI: ${randomPti}`);
        const result = this.processPtiInputEffect(gameId, cardId, randomPti, playerName);
        if (result.success && io) {
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-cpu-pti`,
            playerName: 'Sistema',
            message: `🤖 CPU ${playerName} ha inserito ${randomPti} PTI per l'effetto!`,
            timestamp: Date.now()
          });
        }
        return true;
      }

      case 'deck_selection': {
        // Random deck type
        const deckTypes = ['PERSONAGGI', 'MOSSE', 'BONUS', 'PERSONAGGI SPECIALI'];
        const randomDeck = deckTypes[Math.floor(Math.random() * deckTypes.length)];
        console.log(`🤖 CPU ${playerName} auto-selected deck: ${randomDeck}`);
        const result = this.processDeckSelectionEffect(gameId, cardId, randomDeck, playerName);
        if (result.success && io) {
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-cpu-deck`,
            playerName: 'Sistema',
            message: `🤖 CPU ${playerName} ha selezionato il mazzo ${randomDeck}!`,
            timestamp: Date.now()
          });
        }
        return true;
      }

      case 'swap': {
        // Random player to swap with
        const otherPlayers = game.turnOrder.filter((p: string) => p !== playerName);
        if (otherPlayers.length > 0) {
          const randomTarget = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
          console.log(`🤖 CPU ${playerName} auto-selected swap target: ${randomTarget}`);
          const result = this.processSwapEffect(gameId, playerName, randomTarget, io);
          if (result.success && io) {
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-cpu-swap`,
              playerName: 'Sistema',
              message: `🤖 CPU ${playerName} ha scambiato tutte le carte con ${randomTarget}!`,
              timestamp: Date.now()
            });
          }
        }
        return true;
      }

      case 'dice_control': {
        // Random dice number 1-6
        const randomDice = Math.floor(Math.random() * 6) + 1;
        console.log(`🤖 CPU ${playerName} auto-selected dice: ${randomDice}`);
        this.consumeDiceControlEffect(gameId, playerName);
        if (io) {
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-cpu-dice`,
            playerName: 'Sistema',
            message: `🤖 CPU ${playerName} ha controllato il dado e scelto ${randomDice}!`,
            timestamp: Date.now()
          });
        }
        return true;
      }

      case 'graveyard_selection': {
        // Random card from graveyard
        if (game.graveyard.length > 0) {
          const randomCard = game.graveyard[Math.floor(Math.random() * game.graveyard.length)];
          console.log(`🤖 CPU ${playerName} auto-selected graveyard card: ${randomCard.name || randomCard.id}`);
          // Resurrect the card
          const cardIndex = game.graveyard.findIndex((c: Card) => c.id === randomCard.id);
          if (cardIndex !== -1) {
            const resurrectedCard = game.graveyard.splice(cardIndex, 1)[0];
            resurrectedCard.owner = playerName;
            resurrectedCard.pti = 500; // Random starting PTI
            this.updateCardTextWithPTI(resurrectedCard);
            game.field.push(resurrectedCard);
            if (io) {
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-cpu-resurrect`,
                playerName: 'Sistema',
                message: `🤖 CPU ${playerName} ha resuscitato ${resurrectedCard.name || 'una carta'}!`,
                timestamp: Date.now()
              });
            }
          }
        }
        return true;
      }

      case 'target_selection': {
        // Random target from field (enemy characters)
        const enemyCards = game.field.filter((c: Card) => c.owner !== playerName && c.pti !== undefined);
        if (enemyCards.length > 0) {
          const randomTarget = enemyCards[Math.floor(Math.random() * enemyCards.length)];
          console.log(`🤖 CPU ${playerName} auto-selected target: ${randomTarget.name || randomTarget.id}`);
          const result = this.applyEffectToChosenTargets(gameId, [randomTarget.id], playerName);
          if (result.success && io) {
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-cpu-target`,
              playerName: 'Sistema',
              message: result.message || `🤖 CPU ${playerName} ha applicato l'effetto a ${randomTarget.name || 'un bersaglio'}!`,
              timestamp: Date.now()
            });
          }
        }
        return true;
      }

      default:
        console.log(`🤖 CPU ${playerName}: Unknown effect type ${effectType}, skipping auto-apply`);
        return false;
    }
  }

  // Apply effect to player-chosen targets (for 'choice' target effects)
  applyEffectToChosenTargets(gameId: string, targetCardIds: string[], playerName: string): { success: boolean; message?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    // Get pending effect for this player
    const pendingEffect = game.pendingEffects?.get(playerName);
    if (!pendingEffect) {
      console.log(`🎯 No pending effect found for ${playerName}`);
      return { success: false, message: 'Nessun effetto in attesa' };
    }

    const effectType = pendingEffect.type;
    const value = (pendingEffect as any).value || 100;
    const affectedCards: string[] = [];

    for (const cardId of targetCardIds) {
      const card = game.field.find(c => c.id === cardId);
      if (!card) continue;

      if (effectType === 'target_choice_damage') {
        // Apply damage
        if (card.pti != null) {
          card.pti = Math.max(0, card.pti - value);
          this.updateCardTextWithPTI(card);
          affectedCards.push(card.name || cardId);
          console.log(`🎯 Target choice damage: ${card.name || cardId} took ${value} damage, now at ${card.pti} PTI`);
        }
      } else if (effectType === 'target_choice_heal') {
        // Apply heal
        if (card.pti != null) {
          card.pti += value;
          this.updateCardTextWithPTI(card);
          affectedCards.push(card.name || cardId);
          console.log(`🎯 Target choice heal: ${card.name || cardId} healed ${value}, now at ${card.pti} PTI`);
        }
      }
    }

    // Clear pending effect
    game.pendingEffects?.delete(playerName);

    const actionVerb = effectType === 'target_choice_damage' ? 'inflitto' : 'curato';
    const message = `🎯 ${playerName} ha ${actionVerb} ${value} ${effectType === 'target_choice_damage' ? 'danni' : 'PTI'} a: ${affectedCards.join(', ')}`;
    
    return { success: true, message };
  }

  // DICE SYSTEM: Confirm which characters are involved in dice effect (Step 1)
  confirmDiceCharacters(gameId: string, diceEffectId: string, selectedCharacterIds: string[], playerName: string, io: any): void {
    const game = this.games.get(gameId);
    if (!game || !game.pendingDiceEffects) {
      console.log(`🎲 Game or pendingDiceEffects not found for ${gameId}`);
      return;
    }

    const diceEffect = game.pendingDiceEffects.get(diceEffectId);
    if (!diceEffect) {
      console.log(`🎲 Dice effect ${diceEffectId} not found`);
      return;
    }

    // Verify player is the initiator
    if (diceEffect.initiatorPlayer !== playerName) {
      console.log(`🎲 Player ${playerName} is not the initiator (${diceEffect.initiatorPlayer})`);
      return;
    }

    // Filter selected characters from available ones
    const selectedCharacters = diceEffect.involvedCharacters.filter(c => 
      selectedCharacterIds.includes(c.id)
    );
    
    if (selectedCharacters.length === 0) {
      console.log(`🎲 No valid characters selected`);
      return;
    }

    // Update the dice effect with selected characters
    diceEffect.selectedCharacters = selectedCharacters;
    console.log(`🎲 ${playerName} confirmed ${selectedCharacters.length} characters for dice effect`);

    // CPU characters automatically choose
    for (const char of selectedCharacters) {
      if (char.owner.startsWith('CPU')) {
        const randomChoices = ['1', '2', '3', '4', '5', '6', 'Pari', 'Dispari'];
        const cpuChoice = randomChoices[Math.floor(Math.random() * randomChoices.length)];
        diceEffect.choices.set(char.id, cpuChoice);
        console.log(`🎲 CPU ${char.owner}'s character ${char.name} chose: ${cpuChoice}`);
      }
    }

    // Emit dice number selection to all players (Step 2)
    if (io) {
      console.log(`🎲 EMITTING show-dice-selection to room ${gameId} with ${selectedCharacters.length} selected characters`);
      io.to(gameId).emit('show-dice-selection', {
        diceEffectId,
        cardName: diceEffect.cardName,
        correctEffect: diceEffect.correctEffect,
        wrongEffect: diceEffect.wrongEffect,
        involvedCharacters: selectedCharacters
      });
    }

    // Check if all choices are made (all CPUs)
    this.checkDiceChoicesComplete(gameId, diceEffectId);
  }

  // DICE SYSTEM: Submit player choices for dice roll (Step 2)
  submitDiceChoices(gameId: string, diceEffectId: string, choices: Record<string, string>, playerName: string): { success: boolean } {
    const game = this.games.get(gameId);
    if (!game || !game.pendingDiceEffects) return { success: false };

    const diceEffect = game.pendingDiceEffects.get(diceEffectId);
    if (!diceEffect) {
      console.log(`🎲 Dice effect ${diceEffectId} not found`);
      return { success: false };
    }

    // Record player's choices for their characters (use selectedCharacters if available)
    const charactersToCheck = diceEffect.selectedCharacters || diceEffect.involvedCharacters;
    for (const [charId, choice] of Object.entries(choices)) {
      const char = charactersToCheck.find(c => c.id === charId);
      if (char && char.owner === playerName) {
        diceEffect.choices.set(charId, choice);
        console.log(`🎲 ${playerName}'s character ${char.name} chose: ${choice}`);
      }
    }

    // Check if all choices are complete
    this.checkDiceChoicesComplete(gameId, diceEffectId);
    
    return { success: true };
  }

  // TARGET SELECTION: Process player's target selection for custom effects
  async processTargetSelection(gameId: string, selectionId: string, selectedTargetIds: string[], playerName: string, io: any): Promise<{ success: boolean; message?: string }> {
    const game = this.games.get(gameId);
    if (!game || !game.pendingTargetSelections) {
      return { success: false, message: 'Selezione non trovata' };
    }

    const selection = game.pendingTargetSelections.get(selectionId);
    if (!selection) {
      return { success: false, message: 'Selezione scaduta o non valida' };
    }

    // Verify owner
    if (selection.owner !== playerName) {
      return { success: false, message: 'Solo il proprietario può selezionare i bersagli' };
    }

    // Find source card
    const sourceCard = game.field.find((c: Card) => c.id === selection.cardId);
    if (!sourceCard) {
      game.pendingTargetSelections.delete(selectionId);
      return { success: false, message: 'Carta sorgente non trovata' };
    }

    // Find target cards
    const targetCards = selectedTargetIds.map(id => game.field.find((c: Card) => c.id === id)).filter(Boolean) as Card[];
    if (targetCards.length === 0) {
      return { success: false, message: 'Nessun bersaglio valido selezionato' };
    }

    const targetNames = targetCards.map(c => c.name || this.getCardNameFromUrl(c.frontImage || '')).join(', ');
    console.log(`🎯 ${playerName} selected targets: ${targetNames}`);

    // Check if effect contains DADO_AUTOMATICO - if so, trigger auto dice with pre-selected targets
    const autoDiceMatch = selection.effectText.match(/\[DADO_AUTOMATICO:\s*([^\]]+)\]/i);
    if (autoDiceMatch) {
      console.log(`🎲 Effect contains DADO_AUTOMATICO - triggering auto dice setup with selected targets`);
      
      // Parse effects for each number
      const effectsStr = autoDiceMatch[1].trim();
      const autoEffects: Record<number, string> = {};
      const effectPairs = effectsStr.split(';');
      for (const pair of effectPairs) {
        const match = pair.match(/(\d):\s*(.+)/);
        if (match) {
          const num = parseInt(match[1]);
          autoEffects[num] = match[2].trim();
        }
      }
      
      // Store pending auto dice with pre-selected characters
      if (!game.pendingAutoDice) {
        game.pendingAutoDice = new Map();
      }
      
      const autoDiceId = `auto-dice-${Date.now()}`;
      game.pendingAutoDice.set(autoDiceId, {
        cardId: selection.cardId,
        cardName: selection.cardName,
        defaultEffects: autoEffects,
        initiatorPlayer: selection.owner,
        allowedCharacterIds: selectedTargetIds,
        timestamp: Date.now()
      });
      
      // Clear pending target selection first
      game.pendingTargetSelections.delete(selectionId);
      
      // CPU AUTONOMOUS HANDLING: If CPU, automatically confirm the auto dice
      if (this.isPlayerCPU(gameId, playerName)) {
        console.log(`🤖 CPU ${playerName} auto-confirming DADO_AUTOMATICO with ${selectedTargetIds.length} characters`);
        
        // CPU confirms auto dice immediately
        setTimeout(async () => {
          const result = await this.processAutoDiceConfirm(gameId, autoDiceId, selectedTargetIds, null, playerName, io);
          console.log(`🎲 CPU auto dice confirmation result: ${result?.message || 'completed'}`);
        }, 800);
        
        return { success: true, message: `CPU conferma dado automatico con ${targetCards.length} personaggi` };
      }
      
      // Human player: Emit setup event with pre-selected characters
      io.to(gameId).emit('show-auto-dice-setup', {
        autoDiceId,
        cardName: selection.cardName,
        defaultEffects: autoEffects,
        availableCharacters: targetCards.map((c: Card) => ({
          id: c.id,
          name: c.name || this.getCardNameFromUrl(c.frontImage || ''),
          owner: c.owner,
          frontImage: c.frontImage || '',
          pti: c.pti,
          stars: c.stars
        })),
        initiatorPlayer: selection.owner,
        preSelected: true // Flag to indicate characters are pre-selected
      });
      
      return { success: true, message: `Selezionati ${targetCards.length} personaggi per il dado` };
    }

    // Parse and apply effects to selected targets (non-dice effects)
    const actions = this.parseEffectKeywords(selection.effectText);
    
    if (actions.length > 0) {
      for (const action of actions) {
        // Override target to apply to selected cards
        for (const target of targetCards) {
          await this.applyEffectToCard(gameId, action, sourceCard, target, io);
        }
      }
      
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-target-effect`,
        playerName: 'Sistema',
        message: `🎯 ${playerName} ha attivato l'effetto di ${selection.cardName} su: ${targetNames}`,
        timestamp: Date.now()
      });
    } else {
      // Fallback: just notify about target selection
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-target-selected`,
        playerName: 'Sistema',
        message: `🎯 ${playerName} ha scelto i bersagli per ${selection.cardName}: ${targetNames}`,
        timestamp: Date.now()
      });
    }

    // Clear pending selection
    game.pendingTargetSelections.delete(selectionId);

    // Broadcast updated state
    const gameState = this.getSanitizedGameState(gameId);
    io.to(gameId).emit('game-state-update', gameState);

    return { success: true, message: `Effetto applicato a: ${targetNames}` };
  }

  // Apply effect to a single card
  private async applyEffectToCard(gameId: string, action: { type: string; target: string; value: number; description: string }, sourceCard: Card, targetCard: Card, io: any): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    const targetName = targetCard.name || this.getCardNameFromUrl(targetCard.frontImage || '');
    const currentPTI = targetCard.pti || this.extractPTIFromNote(targetCard.text || '');
    const currentStars = targetCard.stars || this.extractStarsFromNote(targetCard.text || '');

    switch (action.type) {
      case 'damage':
      case 'damage_all':
      case 'damage_random':
      case 'pierce':
      case 'explosion':
        const newPTI = Math.max(0, currentPTI - action.value);
        targetCard.pti = newPTI;
        this.updateCardTextWithPTI(targetCard);
        console.log(`🎯 Dealt ${action.value} damage to ${targetName}: ${currentPTI} → ${newPTI}`);
        if (newPTI <= 0) {
          this.moveToGraveyard(gameId, targetCard.id, targetCard.owner, 'Effetto');
        }
        break;

      case 'heal':
      case 'heal_all':
      case 'buff':
      case 'powerup':
      case 'bless':
      case 'inspire':
        const healedPTI = currentPTI + action.value;
        targetCard.pti = healedPTI;
        this.updateCardTextWithPTI(targetCard);
        console.log(`🎯 Healed/Buffed ${action.value} to ${targetName}: ${currentPTI} → ${healedPTI}`);
        break;

      case 'modify_stars':
        const newStars = Math.max(0, currentStars + action.value);
        targetCard.stars = newStars;
        targetCard.text = `PTI: ${currentPTI} | Stelle: ${newStars}`;
        console.log(`🎯 Modified stars of ${targetName}: ${currentStars} → ${newStars}`);
        break;

      case 'kill':
      case 'execute':
        if (action.type === 'execute' && currentPTI >= action.value) {
          console.log(`🎯 Execute failed - ${targetName} PTI ${currentPTI} >= threshold ${action.value}`);
          break;
        }
        console.log(`🎯 Killed ${targetName}`);
        this.moveToGraveyard(gameId, targetCard.id, targetCard.owner, 'Effetto');
        break;

      case 'weaken':
        const weakenedPTI = Math.max(0, currentPTI - action.value);
        targetCard.pti = weakenedPTI;
        this.updateCardTextWithPTI(targetCard);
        console.log(`🎯 Weakened ${targetName}: ${currentPTI} → ${weakenedPTI}`);
        break;

      case 'drain':
      case 'lifesteal':
        const drainedPTI = Math.max(0, currentPTI - action.value);
        targetCard.pti = drainedPTI;
        this.updateCardTextWithPTI(targetCard);
        const sourcePTI = sourceCard.pti || this.extractPTIFromNote(sourceCard.text || '');
        sourceCard.pti = sourcePTI + action.value;
        this.updateCardTextWithPTI(sourceCard);
        console.log(`🎯 Drained ${action.value} from ${targetName} to ${sourceCard.name || 'source'}`);
        break;

      case 'double':
        const doubledPTI = currentPTI * 2;
        const doubledStars = currentStars * 2;
        targetCard.pti = doubledPTI;
        targetCard.stars = doubledStars;
        targetCard.text = `PTI: ${doubledPTI} | Stelle: ${doubledStars}`;
        console.log(`🎯 Doubled ${targetName}: PTI ${currentPTI}→${doubledPTI}, Stars ${currentStars}→${doubledStars}`);
        break;

      case 'halve':
        const halvedPTI = Math.floor(currentPTI / 2);
        const halvedStars = Math.floor(currentStars / 2);
        targetCard.pti = halvedPTI;
        targetCard.stars = halvedStars;
        targetCard.text = `PTI: ${halvedPTI} | Stelle: ${halvedStars}`;
        console.log(`🎯 Halved ${targetName}: PTI ${currentPTI}→${halvedPTI}, Stars ${currentStars}→${halvedStars}`);
        break;

      case 'protection':
      case 'immunity':
      case 'shield':
      case 'barrier':
      case 'stealth':
        (targetCard as any).activeEffects = (targetCard as any).activeEffects || [];
        (targetCard as any).activeEffects.push({ type: action.type, value: action.value, turnsRemaining: action.value });
        console.log(`🎯 Applied ${action.type} to ${targetName} for ${action.value} turns`);
        break;

      case 'poison':
      case 'burn':
      case 'bleed':
      case 'curse':
        (targetCard as any).activeEffects = (targetCard as any).activeEffects || [];
        (targetCard as any).activeEffects.push({ type: action.type, value: action.value, damagePerTurn: action.value });
        console.log(`🎯 Applied ${action.type} to ${targetName}: ${action.value} damage/turn`);
        break;

      case 'freeze':
      case 'stun':
      case 'silence':
      case 'sleep':
      case 'fear':
      case 'confuse':
        (targetCard as any).activeEffects = (targetCard as any).activeEffects || [];
        (targetCard as any).activeEffects.push({ type: action.type, turnsRemaining: action.value });
        console.log(`🎯 Applied ${action.type} to ${targetName} for ${action.value} turns`);
        break;

      case 'counter':
      case 'reflect':
      case 'taunt':
      case 'dodge':
      case 'armor':
      case 'regeneration':
        (targetCard as any).activeEffects = (targetCard as any).activeEffects || [];
        (targetCard as any).activeEffects.push({ type: action.type, value: action.value });
        console.log(`🎯 Applied ${action.type} to ${targetName}: ${action.value}`);
        break;

      case 'aura':
        const allies = game.field.filter((c: Card) => c.owner === targetCard.owner && c.id !== targetCard.id && c.id.startsWith('personaggi'));
        for (const ally of allies) {
          const allyPTI = ally.pti || this.extractPTIFromNote(ally.text || '');
          ally.pti = allyPTI + action.value;
          this.updateCardTextWithPTI(ally);
          console.log(`🎯 Aura buffed ${ally.name || 'ally'}: +${action.value} PTI`);
        }
        break;

      case 'clone_self':
        const clone: Card = {
          ...targetCard,
          id: `${targetCard.id}-clone-${Date.now()}`
        };
        (clone as any).isClone = true;
        game.field.push(clone);
        console.log(`🎯 Cloned ${targetName}`);
        break;

      case 'inherit_from_dead':
        if (game.graveyard.length > 0) {
          const lastDead = game.graveyard[game.graveyard.length - 1];
          const deadPTI = lastDead.pti || this.extractPTIFromNote(lastDead.text || '');
          const deadStars = lastDead.stars || this.extractStarsFromNote(lastDead.text || '');
          targetCard.pti = currentPTI + deadPTI;
          targetCard.stars = currentStars + deadStars;
          targetCard.text = `PTI: ${targetCard.pti} | Stelle: ${targetCard.stars}`;
          console.log(`🎯 ${targetName} inherited from dead: +${deadPTI} PTI, +${deadStars} stars`);
        }
        break;

      default:
        console.log(`🎯 Effect type '${action.type}' recognized but no specific handler - applying as description: ${action.description}`);
        break;
    }
  }

  // AUTO DICE: Process auto dice confirmation with selected characters and custom effects
  async processAutoDiceConfirm(
    gameId: string, 
    autoDiceId: string, 
    selectedCharacterIds: string[], 
    customEffects: Record<number, string> | null,
    playerName: string, 
    io: any
  ): Promise<{ success: boolean; message?: string }> {
    const game = this.games.get(gameId);
    if (!game || !game.pendingAutoDice) {
      return { success: false, message: 'Dado automatico non trovato' };
    }

    const autoDice = game.pendingAutoDice.get(autoDiceId);
    if (!autoDice) {
      return { success: false, message: 'Configurazione dado scaduta o non valida' };
    }

    // Verify owner
    if (autoDice.initiatorPlayer !== playerName) {
      return { success: false, message: 'Solo chi ha attivato la carta può confermare' };
    }

    // Validate selected characters against allowed list (security check)
    const validSelectedIds = selectedCharacterIds.filter(id => 
      autoDice.allowedCharacterIds.includes(id)
    );
    
    if (validSelectedIds.length !== selectedCharacterIds.length) {
      console.log(`🎲 Security: Rejected ${selectedCharacterIds.length - validSelectedIds.length} invalid character IDs`);
    }

    // Get selected characters from field
    const selectedCharacters = validSelectedIds
      .map(id => game.field.find((c: Card) => c.id === id))
      .filter(Boolean) as Card[];

    if (selectedCharacters.length === 0) {
      return { success: false, message: 'Nessun personaggio valido selezionato' };
    }

    // Use custom effects if provided, otherwise use default
    const effectsToUse = customEffects || autoDice.defaultEffects;

    // CRITICAL: Check if player has dice control effect active
    const diceControl = this.checkDiceControlEffect(gameId, playerName);
    
    if (diceControl.hasDiceControl && diceControl.controllingPlayer === playerName) {
      // Player controls their own dice - show control panel
      console.log(`🎲 DICE CONTROL ACTIVE for AUTO DICE: ${diceControl.controllingPlayer} controls via ${diceControl.cardName}`);
      
      // Store pending auto dice control for this player
      const pendingId = `auto-dice-control-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      if (!game.pendingControlledAutoDice) {
        game.pendingControlledAutoDice = new Map();
      }
      // Store all selected characters for later processing
      game.pendingControlledAutoDice.set(pendingId, {
        rollingPlayer: playerName,
        controllingPlayer: diceControl.controllingPlayer!,
        cardId: diceControl.cardId || '',
        selectedCharId: validSelectedIds[0], // Primary target
        selectedCharName: selectedCharacters[0]?.name || 'Personaggio',
        autoEffects: effectsToUse,
        timestamp: Date.now()
      });
      // Also store full data for multi-target support
      (game as any).pendingAutoDiceFullData = (game as any).pendingAutoDiceFullData || new Map();
      (game as any).pendingAutoDiceFullData.set(pendingId, {
        autoDiceId,
        selectedCharacterIds: validSelectedIds,
        effectsToUse
      });
      
      if (io) {
        io.to(gameId).emit('show-dice-control-panel', {
          pendingId,
          rollingPlayer: playerName,
          controllingPlayer: diceControl.controllingPlayer,
          controllingCardId: diceControl.cardId,
          controllingCardName: diceControl.cardName,
          targetCharNames: selectedCharacters.map(c => c.name || 'Personaggio'),
          isAutoDice: true,
          autoDiceId
        });
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-dice-control-auto-self`,
          playerName: 'Sistema',
          message: `🎲 ${playerName} può controllare il dado grazie a ${diceControl.cardName}! Scegli il risultato.`,
          timestamp: Date.now()
        });
      }
      
      // Return success - the actual dice effect will be applied when player chooses
      return { success: true, message: 'Attendi scelta del numero del dado' };
    }

    // Roll the dice
    const diceResult = Math.floor(Math.random() * 6) + 1;
    const effectToApply = effectsToUse[diceResult] || 'Nessun effetto';

    console.log(`🎲 Auto dice rolled: ${diceResult} -> Effect: "${effectToApply}"`);

    // Apply the effect based on target specification in effect text
    const results: Array<{ charId: string; charName: string; effect: string }> = [];
    
    // Separate characters by owner
    const playerChars = selectedCharacters.filter(c => c.owner === playerName);
    const enemyChars = selectedCharacters.filter(c => c.owner !== playerName);
    
    // Normalize effect text for comparison
    const effectLower = effectToApply.toLowerCase();
    
    // Determine which characters to affect based on effect text
    let charsToAffect: Card[] = [];
    let actualEffect = effectToApply;
    
    if (effectLower.includes('personaggio che usa questa carta') || 
        effectLower.includes('chi usa questa carta') ||
        effectLower.includes('personaggio proprio') ||
        effectLower.includes('tuo personaggio')) {
      // Only affect the player's own characters
      charsToAffect = playerChars;
      console.log(`🎲 Effect targets user's characters only: ${playerChars.map(c => c.name || 'unknown').join(', ')}`);
    } else if (effectLower.includes('personaggio avversario') || 
               effectLower.includes('personaggi avversari') ||
               effectLower.includes('nemico') ||
               effectLower.includes('nemici')) {
      // Only affect enemy characters
      charsToAffect = enemyChars;
      console.log(`🎲 Effect targets enemy characters only: ${enemyChars.map(c => c.name || 'unknown').join(', ')}`);
    } else if (effectLower.includes('personaggi coinvolti') || 
               effectLower.includes('tutti i personaggi') ||
               effectLower.includes('entrambi')) {
      // Affect all selected characters
      charsToAffect = selectedCharacters;
      console.log(`🎲 Effect targets all involved characters: ${selectedCharacters.map(c => c.name || 'unknown').join(', ')}`);
    } else {
      // Default: affect all selected characters
      charsToAffect = selectedCharacters;
      console.log(`🎲 No specific target in effect, affecting all: ${selectedCharacters.map(c => c.name || 'unknown').join(', ')}`);
    }

    for (const char of charsToAffect) {
      const charName = char.name || this.getCardNameFromUrl(char.frontImage || '');
      // Apply consequence
      this.applyDiceConsequence(gameId, char.id, actualEffect, false);
      results.push({
        charId: char.id,
        charName,
        effect: actualEffect
      });
    }

    // Emit the result to all players
    io.to(gameId).emit('auto-dice-result', {
      cardName: autoDice.cardName,
      diceResult,
      effect: effectToApply,
      affectedCharacters: results,
      allEffects: effectsToUse
    });

    // Also emit game message
    io.to(gameId).emit('game-message', {
      type: 'dice',
      message: `🎲 DADO AUTOMATICO: ${diceResult}! Effetto: "${effectToApply}" applicato a ${selectedCharacters.length} personaggi.`,
      playerName: autoDice.initiatorPlayer
    });

    // Clear pending auto dice
    game.pendingAutoDice.delete(autoDiceId);

    // Broadcast updated state
    const gameState = this.getSanitizedGameState(gameId);
    io.to(gameId).emit('game-state-update', gameState);

    return { success: true, message: `Dado: ${diceResult} - ${effectToApply}` };
  }

  // DICE SYSTEM: Check if all dice choices are complete and roll if so
  checkDiceChoicesComplete(gameId: string, diceEffectId: string): void {
    const game = this.games.get(gameId);
    if (!game || !game.pendingDiceEffects) return;

    const diceEffect = game.pendingDiceEffects.get(diceEffectId);
    if (!diceEffect) return;

    // Check if all selected characters have made their choice (use selectedCharacters if available)
    const charactersToCheck = diceEffect.selectedCharacters || diceEffect.involvedCharacters;
    const allChosen = charactersToCheck.every(char => diceEffect.choices.has(char.id));
    
    if (!allChosen) {
      const remaining = charactersToCheck.filter(c => !diceEffect.choices.has(c.id)).length;
      console.log(`🎲 Waiting for ${remaining} more character choices`);
      return;
    }

    console.log(`🎲 All choices made! Rolling the dice...`);
    
    // Roll the dice (1-6)
    const diceResult = Math.floor(Math.random() * 6) + 1;
    console.log(`🎲 DICE RESULT: ${diceResult} (${diceResult % 2 === 0 ? 'PARI' : 'DISPARI'})`);

    // Determine winners and losers
    const winners: Array<{ name: string; effect: string; characterId: string }> = [];
    const losers: Array<{ name: string; effect: string; characterId: string }> = [];

    for (const char of diceEffect.involvedCharacters) {
      const choice = diceEffect.choices.get(char.id);
      if (!choice) continue;

      let isCorrect = false;
      if (choice === 'Pari') {
        isCorrect = diceResult % 2 === 0;
      } else if (choice === 'Dispari') {
        isCorrect = diceResult % 2 !== 0;
      } else {
        isCorrect = parseInt(choice) === diceResult;
      }

      if (isCorrect) {
        winners.push({ name: char.name, effect: diceEffect.correctEffect, characterId: char.id });
      } else {
        losers.push({ name: char.name, effect: diceEffect.wrongEffect, characterId: char.id });
      }
    }

    // Apply effects
    for (const winner of winners) {
      this.applyDiceConsequence(gameId, winner.characterId, diceEffect.correctEffect, true);
    }
    for (const loser of losers) {
      this.applyDiceConsequence(gameId, loser.characterId, diceEffect.wrongEffect, false);
    }

    // Emit result to all players
    const io = (global as any).io;
    if (io) {
      io.to(gameId).emit('dice-roll-result', {
        result: diceResult,
        winners: winners.map(w => ({ name: w.name, effect: w.effect })),
        losers: losers.map(l => ({ name: l.name, effect: l.effect }))
      });
      
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-dice-result`,
        playerName: 'Sistema',
        message: `🎲 DADO: ${diceResult} (${diceResult % 2 === 0 ? 'Pari' : 'Dispari'})! Vincitori: ${winners.map(w => w.name).join(', ') || 'Nessuno'}. Perdenti: ${losers.map(l => l.name).join(', ') || 'Nessuno'}.`,
        timestamp: Date.now()
      });
    }

    // Clean up
    game.pendingDiceEffects.delete(diceEffectId);
    
    // Broadcast updated game state
    const gameState = this.getSanitizedGameState(gameId);
    if (io) {
      io.to(gameId).emit('game-state-update', gameState);
    }
  }

  // DICE SYSTEM: Apply consequence based on effect string
  private applyDiceConsequence(gameId: string, characterId: string, effectStr: string, isCorrect: boolean): void {
    const game = this.games.get(gameId);
    if (!game) return;

    const card = game.field.find(c => c.id === characterId);
    if (!card) return;

    const cardName = card.name || this.getCardNameFromUrl(card.frontImage || '');
    console.log(`🎲 Applying ${isCorrect ? 'CORRECT' : 'WRONG'} consequence to ${cardName}: "${effectStr}"`);

    // Parse known effects
    const effectLower = effectStr.toLowerCase();

    if (effectLower.includes('morte') || effectLower.includes('death')) {
      // Death
      console.log(`🎲💀 ${cardName} dies from dice effect`);
      this.moveToGraveyard(gameId, characterId, card.owner, 'DADO');
      return;
    }

    if (effectLower.includes('0 stelle') || effectLower.includes('zero stelle')) {
      // Zero stars
      const oldStars = this.extractStarsFromNote(card.text || '');
      const currentPTI = card.pti || this.extractPTIFromNote(card.text || '');
      card.text = `PTI: ${currentPTI} | Stelle: 0`;
      console.log(`🎲⭐ ${cardName} stars ${oldStars} → 0`);
      return;
    }

    if (effectLower.includes('dimezza') && effectLower.includes('pti') && effectLower.includes('stelle')) {
      // Halve both
      const currentPTI = card.pti || this.extractPTIFromNote(card.text || '');
      const currentStars = this.extractStarsFromNote(card.text || '');
      const newPTI = Math.floor(currentPTI / 2);
      const newStars = Math.floor(currentStars / 2);
      card.pti = newPTI;
      card.text = `PTI: ${newPTI} | Stelle: ${newStars}`;
      console.log(`🎲 ${cardName} halved: PTI ${currentPTI}→${newPTI}, Stars ${currentStars}→${newStars}`);
      return;
    }

    if (effectLower.includes('dimezza') && effectLower.includes('pti')) {
      // Halve PTI
      const currentPTI = card.pti || this.extractPTIFromNote(card.text || '');
      const newPTI = Math.floor(currentPTI / 2);
      card.pti = newPTI;
      this.updateCardTextWithPTI(card);
      console.log(`🎲 ${cardName} PTI halved: ${currentPTI} → ${newPTI}`);
      return;
    }

    if (effectLower.includes('dimezza') && effectLower.includes('stelle')) {
      // Halve stars
      const currentStars = this.extractStarsFromNote(card.text || '');
      const currentPTI = card.pti || this.extractPTIFromNote(card.text || '');
      const newStars = Math.floor(currentStars / 2);
      card.text = `PTI: ${currentPTI} | Stelle: ${newStars}`;
      console.log(`🎲 ${cardName} stars halved: ${currentStars} → ${newStars}`);
      return;
    }

    if (effectLower.includes('raddoppia') && effectLower.includes('pti') && effectLower.includes('stelle')) {
      // Double both
      const currentPTI = card.pti || this.extractPTIFromNote(card.text || '');
      const currentStars = this.extractStarsFromNote(card.text || '');
      const newPTI = currentPTI * 2;
      const newStars = currentStars * 2;
      card.pti = newPTI;
      card.text = `PTI: ${newPTI} | Stelle: ${newStars}`;
      console.log(`🎲 ${cardName} doubled: PTI ${currentPTI}→${newPTI}, Stars ${currentStars}→${newStars}`);
      return;
    }

    if (effectLower.includes('raddoppia') && effectLower.includes('pti')) {
      // Double PTI
      const currentPTI = card.pti || this.extractPTIFromNote(card.text || '');
      const newPTI = currentPTI * 2;
      card.pti = newPTI;
      this.updateCardTextWithPTI(card);
      console.log(`🎲 ${cardName} PTI doubled: ${currentPTI} → ${newPTI}`);
      return;
    }

    if (effectLower.includes('raddoppia') && effectLower.includes('stelle')) {
      // Double stars
      const currentStars = this.extractStarsFromNote(card.text || '');
      const currentPTI = card.pti || this.extractPTIFromNote(card.text || '');
      const newStars = currentStars * 2;
      card.text = `PTI: ${currentPTI} | Stelle: ${newStars}`;
      console.log(`🎲 ${cardName} stars doubled: ${currentStars} → ${newStars}`);
      return;
    }

    // Add half of current PTI
    if ((effectLower.includes('aggiunge') || effectLower.includes('aggiungi')) && 
        effectLower.includes('metà') && effectLower.includes('pti')) {
      const currentPTI = card.pti || this.extractPTIFromNote(card.text || '');
      const halfPTI = Math.floor(currentPTI / 2);
      const newPTI = currentPTI + halfPTI;
      card.pti = newPTI;
      this.updateCardTextWithPTI(card);
      console.log(`🎲 ${cardName} added half PTI: ${currentPTI} + ${halfPTI} = ${newPTI}`);
      return;
    }

    // Add half of current stars
    if ((effectLower.includes('aggiunge') || effectLower.includes('aggiungi')) && 
        effectLower.includes('metà') && effectLower.includes('stelle')) {
      const currentStars = this.extractStarsFromNote(card.text || '');
      const currentPTI = card.pti || this.extractPTIFromNote(card.text || '');
      const halfStars = Math.floor(currentStars / 2);
      const newStars = currentStars + halfStars;
      card.text = `PTI: ${currentPTI} | Stelle: ${newStars}`;
      console.log(`🎲 ${cardName} added half stars: ${currentStars} + ${halfStars} = ${newStars}`);
      return;
    }

    if (effectLower.includes('guadagna') && effectLower.includes('pti')) {
      // Gain PTI - try to extract number
      const match = effectStr.match(/(\d+)/);
      const amount = match ? parseInt(match[1]) : 100;
      const currentPTI = card.pti || this.extractPTIFromNote(card.text || '');
      const newPTI = currentPTI + amount;
      card.pti = newPTI;
      this.updateCardTextWithPTI(card);
      console.log(`🎲 ${cardName} gained ${amount} PTI: ${currentPTI} → ${newPTI}`);
      return;
    }

    if (effectLower.includes('perde') && effectLower.includes('pti')) {
      // Lose PTI
      const match = effectStr.match(/(\d+)/);
      const amount = match ? parseInt(match[1]) : 100;
      const currentPTI = card.pti || this.extractPTIFromNote(card.text || '');
      const newPTI = Math.max(0, currentPTI - amount);
      card.pti = newPTI;
      this.updateCardTextWithPTI(card);
      console.log(`🎲 ${cardName} lost ${amount} PTI: ${currentPTI} → ${newPTI}`);
      if (newPTI <= 0) {
        this.moveToGraveyard(gameId, characterId, card.owner, 'DADO');
      }
      return;
    }

    if (effectLower.includes('guadagna') && effectLower.includes('stell')) {
      // Gain stars
      const match = effectStr.match(/(\d+)/);
      const amount = match ? parseInt(match[1]) : 1;
      const currentStars = this.extractStarsFromNote(card.text || '');
      const currentPTI = card.pti || this.extractPTIFromNote(card.text || '');
      const newStars = currentStars + amount;
      card.text = `PTI: ${currentPTI} | Stelle: ${newStars}`;
      console.log(`🎲 ${cardName} gained ${amount} stars: ${currentStars} → ${newStars}`);
      return;
    }

    if (effectLower.includes('perde') && effectLower.includes('stell')) {
      // Lose stars
      const match = effectStr.match(/(\d+)/);
      const amount = match ? parseInt(match[1]) : 1;
      const currentStars = this.extractStarsFromNote(card.text || '');
      const currentPTI = card.pti || this.extractPTIFromNote(card.text || '');
      const newStars = Math.max(0, currentStars - amount);
      card.text = `PTI: ${currentPTI} | Stelle: ${newStars}`;
      console.log(`🎲 ${cardName} lost ${amount} stars: ${currentStars} → ${newStars}`);
      return;
    }

    if (effectLower.includes('salta') && effectLower.includes('turno')) {
      // Skip turn
      if (!game.skipTurnPlayers) game.skipTurnPlayers = [];
      if (!game.skipTurnPlayers.includes(card.owner)) {
        game.skipTurnPlayers.push(card.owner);
      }
      console.log(`🎲 ${card.owner} will skip next turn (${cardName})`);
      return;
    }

    if (effectLower.includes('turno extra') || effectLower.includes('extra turn')) {
      // Extra turn
      game.extraTurnPlayer = card.owner;
      console.log(`🎲 ${card.owner} gets extra turn (${cardName})`);
      return;
    }

    // Handle "muore tra X turni" / "dies in X turns"
    const dieInTurnsMatch = effectStr.match(/muore tra (\d+) turn/i) || effectStr.match(/dies in (\d+) turn/i);
    if (dieInTurnsMatch) {
      const turns = parseInt(dieInTurnsMatch[1]);
      if (!game.delayedDeaths) game.delayedDeaths = [];
      
      // Check if already has a delayed death timer
      const existingIdx = game.delayedDeaths.findIndex((dd: any) => dd.cardId === characterId);
      if (existingIdx >= 0) {
        // Update existing timer if new one is shorter
        if (turns < game.delayedDeaths[existingIdx].turnsRemaining) {
          game.delayedDeaths[existingIdx].turnsRemaining = turns;
          console.log(`🎲💀 ${cardName} delayed death updated to ${turns} turns`);
        }
      } else {
        game.delayedDeaths.push({
          cardId: characterId,
          cardName,
          owner: card.owner,
          turnsRemaining: turns,
          createdAt: Date.now()
        });
        console.log(`🎲💀 ${cardName} will die in ${turns} turns`);
      }
      
      // Add visual indicator to card text
      const currentPTI = card.pti || this.extractPTIFromNote(card.text || '');
      const currentStars = this.extractStarsFromNote(card.text || '');
      card.text = `PTI: ${currentPTI} | Stelle: ${currentStars} | ☠️ Muore tra ${turns} turni`;
      return;
    }

    // If effect is "Nessun effetto" or unrecognized
    if (effectLower.includes('nessun effetto') || effectLower === 'none') {
      console.log(`🎲 No effect applied to ${cardName}`);
      return;
    }

    console.log(`🎲 Custom/unknown dice effect for ${cardName}: "${effectStr}" - no automatic parsing`);
  }

  // CUSTOM EFFECT: Manually activate a custom effect on a field card
  async activateCustomEffect(gameId: string, cardId: string, playerName: string, io: any): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    // Find the card on field
    const card = game.field.find((c: Card) => c.id === cardId);
    if (!card) {
      console.log(`⚡ Card ${cardId} not found on field`);
      return;
    }

    // Verify ownership
    if (card.owner !== playerName) {
      console.log(`⚡ ${playerName} cannot activate effect on card owned by ${card.owner}`);
      return;
    }

    const cardText = card.text || '';
    const cardEffect = card.effect || '';
    const combinedText = cardText + ' ' + cardEffect;
    const cardName = card.name || this.getCardNameFromUrl(card.frontImage || '');
    console.log(`⚡ Activating custom effect for ${cardName}: text="${cardText}", effect="${cardEffect}"`);

    // Check for BERSAGLIO: scelta (target choice) - must select targets first
    const bersaglioMatch = combinedText.match(/\[BERSAGLIO:\s*scelta\]/i);
    if (bersaglioMatch) {
      console.log(`🎯 Card has BERSAGLIO: scelta - requesting target selection`);
      
      // Get all characters on field for target selection
      const allFieldChars = game.field.filter((c: Card) => 
        c.type === 'personaggi' || c.type === 'personaggi_speciali'
      );
      
      if (allFieldChars.length === 0) {
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-target-no-chars`,
          playerName: 'Sistema',
          message: `🎯 Non ci sono personaggi in campo da selezionare!`,
          timestamp: Date.now()
        });
        return;
      }
      
      // Store pending target selection
      if (!game.pendingTargetSelections) {
        game.pendingTargetSelections = new Map();
      }
      
      const selectionId = `target-${Date.now()}`;
      game.pendingTargetSelections.set(selectionId, {
        cardId,
        cardName,
        effectText: combinedText.replace(/\[BERSAGLIO:\s*scelta\]/i, '').trim(),
        owner: playerName,
        timestamp: Date.now()
      });
      
      // CPU AUTONOMOUS HANDLING: If the player is CPU, auto-select targets immediately
      if (this.isPlayerCPU(gameId, playerName)) {
        console.log(`🤖 CPU ${playerName} auto-selecting targets for BERSAGLIO effect (activateCustomEffect)`);
        
        // CPU selects 1-2 random targets (prefer enemies if available)
        const ownChars = allFieldChars.filter((c: Card) => c.owner === playerName);
        const enemyChars = allFieldChars.filter((c: Card) => c.owner !== playerName);
        
        let selectedTargets: Card[] = [];
        
        // Prefer selecting both own and enemy character for "gamble" style effects
        if (ownChars.length > 0 && enemyChars.length > 0) {
          const ownTarget = ownChars[Math.floor(Math.random() * ownChars.length)];
          const enemyTarget = enemyChars[Math.floor(Math.random() * enemyChars.length)];
          selectedTargets = [ownTarget, enemyTarget];
        } else if (enemyChars.length >= 2) {
          const shuffled = [...enemyChars].sort(() => Math.random() - 0.5);
          selectedTargets = shuffled.slice(0, 2);
        } else if (allFieldChars.length >= 2) {
          const shuffled = [...allFieldChars].sort(() => Math.random() - 0.5);
          selectedTargets = shuffled.slice(0, 2);
        } else {
          selectedTargets = [allFieldChars[Math.floor(Math.random() * allFieldChars.length)]];
        }
        
        const selectedTargetIds = selectedTargets.map(c => c.id);
        const selectedTargetNames = selectedTargets.map(c => c.name || this.getCardNameFromUrl(c.frontImage || ''));
        
        console.log(`🎯 CPU ${playerName} confirmed target selection: ${selectedTargetIds.length} targets`);
        console.log(`🎯 CPU selected targets: ${selectedTargetNames.join(', ')}`);
        
        // Process the target selection immediately
        setTimeout(async () => {
          await this.processTargetSelection(gameId, selectionId, selectedTargetIds, playerName, io);
        }, 500);
        
        return;
      }
      
      // Human player: Emit event for custom target selection UI
      io.to(gameId).emit('show-custom-target-selection', {
        selectionId,
        cardId,
        cardName,
        owner: playerName,
        availableTargets: allFieldChars.map((c: Card) => ({
          id: c.id,
          name: c.name || this.getCardNameFromUrl(c.frontImage || ''),
          owner: c.owner,
          frontImage: c.frontImage || '',
          pti: c.pti,
          stars: c.stars
        }))
      });
      return;
    }

    // Check for DADO (dice) effect
    const dadoMatch = combinedText.match(/\[DADO:\s*([^\]]*)\]/i);
    if (dadoMatch) {
      const dadoDetails = dadoMatch[1];
      console.log(`🎲 Card has DADO effect: ${dadoDetails}`);
      
      // Parse correct/wrong effects
      let correctEffect = 'Nessun effetto';
      let wrongEffect = 'Nessun effetto';
      
      const correctMatch = dadoDetails.match(/Se indovina:\s*([^;]+)/i);
      const wrongMatch = dadoDetails.match(/Se sbaglia:\s*([^;\]]+)/i);
      
      if (correctMatch) correctEffect = correctMatch[1].trim();
      if (wrongMatch) wrongEffect = wrongMatch[1].trim();
      
      // Get all characters on field for dice selection
      const allFieldChars = game.field.filter((c: Card) => 
        c.type === 'personaggi' || c.type === 'personaggi_speciali'
      );
      
      if (allFieldChars.length === 0) {
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-dice-no-chars`,
          playerName: 'Sistema',
          message: `🎲 Non ci sono personaggi in campo per l'effetto dado!`,
          timestamp: Date.now()
        });
        return;
      }
      
      // Create dice effect entry
      const diceEffectId = `dice-${Date.now()}`;
      if (!game.pendingDiceEffects) {
        game.pendingDiceEffects = new Map();
      }
      
      game.pendingDiceEffects.set(diceEffectId, {
        cardId,
        cardName,
        correctEffect,
        wrongEffect,
        involvedCharacters: allFieldChars.map((c: Card) => ({
          id: c.id,
          name: c.name || this.getCardNameFromUrl(c.frontImage || ''),
          owner: c.owner,
          frontImage: c.frontImage || ''
        })),
        choices: new Map<string, string>(),
        timestamp: Date.now()
      });
      
      // Auto-fill CPU choices
      for (const char of allFieldChars) {
        if (char.owner.startsWith('CPU')) {
          const options = ['1', '2', '3', '4', '5', '6', 'Pari', 'Dispari'];
          const cpuChoice = options[Math.floor(Math.random() * options.length)];
          game.pendingDiceEffects.get(diceEffectId)!.choices.set(char.id, cpuChoice);
          console.log(`🎲 CPU character ${char.name || char.id} auto-chose: ${cpuChoice}`);
        }
      }
      
      // Emit dice selection request to players
      io.to(gameId).emit('show-dice-selection', {
        diceEffectId,
        cardName,
        correctEffect,
        wrongEffect,
        involvedCharacters: allFieldChars.map((c: Card) => ({
          id: c.id,
          name: c.name || this.getCardNameFromUrl(c.frontImage || ''),
          owner: c.owner,
          frontImage: c.frontImage || ''
        }))
      });
      
      // Check if all choices are already complete (all CPUs)
      this.checkDiceChoicesComplete(gameId, diceEffectId);
      return;
    }

    // Check for COMPORTAMENTO (behavior) effect
    const comportamentoMatch = combinedText.match(/\[COMPORTAMENTO:\s*([^\]]*)\]/i);
    if (comportamentoMatch) {
      const behavior = comportamentoMatch[1].trim();
      console.log(`⚡ Card has COMPORTAMENTO effect: ${behavior}`);
      
      // Parse and apply effect using keyword parser
      const actions = this.parseEffectKeywords(behavior);
      
      if (actions.length > 0) {
        for (const action of actions) {
          await this.applyParsedEffect(gameId, action, card, playerName, io);
        }
        
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-effect-activated`,
          playerName: 'Sistema',
          message: `⚡ ${playerName} ha attivato l'effetto di ${cardName}: ${behavior}`,
          timestamp: Date.now()
        });
      } else {
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-effect-unknown`,
          playerName: 'Sistema',
          message: `⚡ Effetto "${behavior}" non riconosciuto automaticamente per ${cardName}`,
          timestamp: Date.now()
        });
      }
      
      // Broadcast updated game state
      const gameState = this.getSanitizedGameState(gameId);
      io.to(gameId).emit('game-state-update', gameState);
      return;
    }

    // Check for DETTAGLI effect
    const dettagliMatch = combinedText.match(/\[DETTAGLI:\s*([^\]]*)\]/i);
    if (dettagliMatch) {
      const details = dettagliMatch[1].trim();
      console.log(`⚡ Card has DETTAGLI effect: ${details}`);
      
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-effect-details`,
        playerName: 'Sistema',
        message: `⚡ ${cardName} - Dettagli effetto: ${details}`,
        timestamp: Date.now()
      });
    }

    // Fallback: Use keyword parser for all other effects
    console.log(`⚡ Using keyword parser for effect: "${combinedText.substring(0, 100)}..."`);
    const actions = this.parseEffectKeywords(combinedText);
    
    if (actions.length > 0) {
      console.log(`⚡ Parsed ${actions.length} actions from effect text`);
      for (const action of actions) {
        await this.applyParsedEffect(gameId, action, card, playerName, io);
      }
      
      // Notify about effect activation
      const actionDescriptions = actions.map(a => a.description).join(', ');
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-effect-activated`,
        playerName: 'Sistema',
        message: `⚡ ${cardName} - Effetto attivato: ${actionDescriptions}`,
        timestamp: Date.now()
      });
      
      // Broadcast updated state
      const gameState = this.getSanitizedGameState(gameId);
      io.to(gameId).emit('game-state-update', gameState);
    } else {
      console.log(`⚡ No actions parsed from effect text`);
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-effect-no-action`,
        playerName: 'Sistema',
        message: `⚡ ${cardName} - Effetto riconosciuto ma nessuna azione automatica disponibile`,
        timestamp: Date.now()
      });
    }
  }

  // Apply a parsed effect action
  private async applyParsedEffect(gameId: string, action: { type: string; target: string; value: number; description: string }, sourceCard: Card, playerName: string, io: any): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    console.log(`⚡ Applying parsed effect: ${action.type} to ${action.target} with value ${action.value}`);

    const getTargetCards = (): Card[] => {
      switch (action.target) {
        case 'all_enemies':
          return game.field.filter((c: Card) => 
            c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
          );
        case 'all_allies':
          return game.field.filter((c: Card) => 
            c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
          );
        case 'all':
          return game.field.filter((c: Card) => 
            c.type === 'personaggi' || c.type === 'personaggi_speciali'
          );
        case 'self':
          return [sourceCard];
        default:
          return [];
      }
    };

    const targets = getTargetCards();

    switch (action.type) {
      case 'damage':
        for (const target of targets) {
          const oldPTI = target.pti || this.extractPTIFromNote(target.text || '');
          const newPTI = Math.max(0, oldPTI - action.value);
          target.pti = newPTI;
          this.updateCardTextWithPTI(target);
          console.log(`⚡ Dealt ${action.value} damage to ${target.name}: ${oldPTI} → ${newPTI}`);
          if (newPTI <= 0) {
            this.moveToGraveyard(gameId, target.id, target.owner, 'Effetto');
          }
        }
        break;
      case 'heal':
        for (const target of targets) {
          const oldPTI = target.pti || this.extractPTIFromNote(target.text || '');
          const newPTI = oldPTI + action.value;
          target.pti = newPTI;
          this.updateCardTextWithPTI(target);
          console.log(`⚡ Healed ${action.value} PTI to ${target.name}: ${oldPTI} → ${newPTI}`);
        }
        break;
      case 'boost_pti':
        for (const target of targets) {
          const oldPTI = target.pti || this.extractPTIFromNote(target.text || '');
          const newPTI = oldPTI + action.value;
          target.pti = newPTI;
          this.updateCardTextWithPTI(target);
        }
        break;
      case 'reduce_pti':
        for (const target of targets) {
          const oldPTI = target.pti || this.extractPTIFromNote(target.text || '');
          const newPTI = Math.max(0, oldPTI - action.value);
          target.pti = newPTI;
          this.updateCardTextWithPTI(target);
          if (newPTI <= 0) {
            this.moveToGraveyard(gameId, target.id, target.owner, 'Effetto');
          }
        }
        break;
      
      case 'show_pti_input_panel':
        // Check if CPU - auto-apply with random value
        if (this.cpuAutoApplyEffect(gameId, playerName, 'pti_input', sourceCard.id, io)) {
          break; // CPU handled it
        }
        // Emit event to show PTI input panel to the player
        console.log(`📋 Showing PTI input panel for ${playerName}`);
        io.to(gameId).emit('show-pti-input-panel', {
          cardId: sourceCard.id,
          cardName: sourceCard.name || this.getCardNameFromUrl(sourceCard.frontImage || ''),
          playerName,
          effectDescription: action.description
        });
        break;
      
      case 'show_graveyard_selection':
        // Check if CPU - auto-apply with random selection
        if (this.cpuAutoApplyEffect(gameId, playerName, 'graveyard_selection', sourceCard.id, io)) {
          break; // CPU handled it
        }
        // Emit event to show graveyard selection panel
        console.log(`📋 Showing graveyard selection panel for ${playerName}`);
        const graveyardCards = game.graveyard.map((c: Card) => ({
          id: c.id,
          name: c.name || this.getCardNameFromUrl(c.frontImage || ''),
          frontImage: c.frontImage,
          owner: c.owner,
          pti: c.pti,
          stars: c.stars
        }));
        io.to(gameId).emit('show-graveyard-selection', {
          cardId: sourceCard.id,
          cardName: sourceCard.name || this.getCardNameFromUrl(sourceCard.frontImage || ''),
          playerName,
          graveyardCards
        });
        break;
      
      case 'show_deck_selection':
        // Check if CPU - auto-apply with random deck
        if (this.cpuAutoApplyEffect(gameId, playerName, 'deck_selection', sourceCard.id, io)) {
          break; // CPU handled it
        }
        // Emit event to show deck selection panel
        console.log(`📋 Showing deck selection panel for ${playerName}`);
        io.to(gameId).emit('show-deck-selection', {
          cardId: sourceCard.id,
          cardName: sourceCard.name || this.getCardNameFromUrl(sourceCard.frontImage || ''),
          playerName,
          effectDescription: action.description
        });
        break;
      
      case 'clone_self':
        // Clone the source card onto the field
        const cloneId = `${sourceCard.id}-clone-${Date.now()}`;
        const clonedCard: Card = {
          ...sourceCard,
          id: cloneId
        };
        (clonedCard as any).isClone = true;
        game.field.push(clonedCard);
        console.log(`🧬 Cloned ${sourceCard.name || 'card'} onto the field`);
        break;
      
      case 'clone':
        // Same as clone_self
        const cloneId2 = `${sourceCard.id}-clone2-${Date.now()}`;
        const clonedCard2: Card = {
          ...sourceCard,
          id: cloneId2
        };
        (clonedCard2 as any).isClone = true;
        game.field.push(clonedCard2);
        console.log(`👯 Created clone of ${sourceCard.name || 'card'}`);
        break;
      
      case 'inherit_from_dead':
        // Inherit PTI and stars from the last dead character
        if (game.graveyard.length > 0) {
          const lastDead = game.graveyard[game.graveyard.length - 1];
          const deadPTI = lastDead.pti || this.extractPTIFromNote(lastDead.text || '');
          const deadStars = lastDead.stars || this.extractStarsFromNote(lastDead.text || '');
          const currentPTI = sourceCard.pti || this.extractPTIFromNote(sourceCard.text || '');
          const currentStars = sourceCard.stars || this.extractStarsFromNote(sourceCard.text || '');
          sourceCard.pti = currentPTI + deadPTI;
          sourceCard.stars = currentStars + deadStars;
          sourceCard.text = `PTI: ${sourceCard.pti} | Stelle: ${sourceCard.stars}`;
          console.log(`🦅 ${sourceCard.name || 'Card'} inherited +${deadPTI} PTI, +${deadStars} stars from ${lastDead.name || 'dead character'}`);
        }
        break;
      
      case 'conditional':
        // Conditional effects are just logged, they're passive/triggered
        console.log(`📌 Conditional effect registered: ${action.description.substring(0, 50)}...`);
        break;
      
      case 'swap':
        // Check if CPU - auto-apply with random target
        if (this.cpuAutoApplyEffect(gameId, playerName, 'swap', sourceCard.id, io)) {
          break; // CPU handled it
        }
        // Show swap/baratto panel to select player to swap with
        console.log(`🔄 Showing swap panel for ${playerName} - Baratto effect`);
        const otherPlayers = game.turnOrder.filter((p: string) => p !== playerName);
        io.to(gameId).emit('show-swap-selection', {
          cardId: sourceCard.id,
          cardName: sourceCard.name || this.getCardNameFromUrl(sourceCard.frontImage || ''),
          playerName,
          otherPlayers,
          effectDescription: action.description
        });
        break;
      
      case 'transform':
        // Transform card into a different random card (for now just boost stats)
        console.log(`🔮 Transform effect for ${sourceCard.name || 'card'}`);
        // For now, mark the card as transformed - actual transformation handled by specific card logic
        (sourceCard as any).isTransformed = true;
        break;
      
      case 'dice_control':
        // Register this card as having dice control ability
        console.log(`🎲 DICE CONTROL: Registering dice control effect for ${playerName}`);
        (sourceCard as any).hasDiceControl = true;
        (sourceCard as any).diceControlOwner = playerName;
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-dice-control-active`,
          playerName: 'Sistema',
          message: `🎲 ${sourceCard.name || 'Carta'} ha attivato il controllo del dado! ${playerName} potrà scegliere il risultato del prossimo lancio.`,
          timestamp: Date.now()
        });
        break;

      case 'cycle_cards':
        // Ciclone effect: Each player passes their field cards to the next player
        console.log(`🌀 CICLONE: Rotating field cards between all players`);
        const turnOrder = game.turnOrder.filter((p: string) => game.players[p]);
        if (turnOrder.length >= 2) {
          // Store original field cards for each player
          const playerFieldCards: { [key: string]: Card[] } = {};
          for (const pName of turnOrder) {
            playerFieldCards[pName] = game.field.filter((c: Card) => c.owner === pName);
          }
          
          // Rotate ownership: each player gets cards from previous player
          for (let i = 0; i < turnOrder.length; i++) {
            const currentPlayer = turnOrder[i];
            const previousPlayer = turnOrder[(i - 1 + turnOrder.length) % turnOrder.length];
            const cardsToReceive = playerFieldCards[previousPlayer];
            
            for (const card of cardsToReceive) {
              card.owner = currentPlayer;
              console.log(`🌀 ${card.name || card.id} transferred from ${previousPlayer} to ${currentPlayer}`);
            }
          }
          
          // Send chat message about the rotation
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-ciclone`,
            playerName: 'Sistema',
            message: `🌀 CICLONE! Tutti i giocatori hanno passato le loro carte in campo al giocatore successivo!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'protection':
        // Mark player's active character as protected
        const protectedChar = this.getPlayerActiveCharacter(game, playerName);
        if (protectedChar) {
          (protectedChar as any).isProtected = true;
          (protectedChar as any).protectionTurns = action.value || 1;
          console.log(`🛡️ ${protectedChar.name} is now PROTECTED for ${action.value || 1} turns`);
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-protection`,
            playerName: 'Sistema',
            message: `🛡️ ${protectedChar.name} è ora PROTETTO e non può essere attaccato!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'counter':
        // Mark player's active character as having counter-attack
        const counterChar = this.getPlayerActiveCharacter(game, playerName);
        if (counterChar) {
          (counterChar as any).counterDamage = action.value || 50;
          console.log(`↩️ ${counterChar.name} now has COUNTER-ATTACK (${action.value} damage)`);
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-counter`,
            playerName: 'Sistema',
            message: `↩️ ${counterChar.name} ha attivato il CONTRATTACCO: infliggerà ${action.value} danni a chi lo attacca!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'reflect':
        // Mark player's active character as reflecting damage
        const reflectChar = this.getPlayerActiveCharacter(game, playerName);
        if (reflectChar) {
          (reflectChar as any).reflectPercent = action.value || 50;
          console.log(`🪞 ${reflectChar.name} now REFLECTS ${action.value}% damage`);
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-reflect`,
            playerName: 'Sistema',
            message: `🪞 ${reflectChar.name} riflette il ${action.value}% dei danni ricevuti!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'shield':
        // Apply shield to player's active character
        const shieldChar = this.getPlayerActiveCharacter(game, playerName);
        if (shieldChar) {
          (shieldChar as any).shieldAmount = ((shieldChar as any).shieldAmount || 0) + (action.value || 200);
          console.log(`🔰 ${shieldChar.name} now has SHIELD (${(shieldChar as any).shieldAmount} absorption)`);
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-shield`,
            playerName: 'Sistema',
            message: `🔰 ${shieldChar.name} ha attivato uno SCUDO che assorbe ${action.value} danni!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'freeze':
        // Freeze opponent characters
        const freezeTargets = game.field.filter((c: Card) => 
          c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        for (const target of freezeTargets) {
          (target as any).frozenTurns = action.value || 2;
          console.log(`❄️ ${target.name} is FROZEN for ${action.value} turns`);
        }
        if (freezeTargets.length > 0) {
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-freeze`,
            playerName: 'Sistema',
            message: `❄️ ${freezeTargets.map(c => c.name).join(', ')} ${freezeTargets.length > 1 ? 'sono CONGELATI' : 'è CONGELATO'} per ${action.value || 2} turni!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'stun':
        // Stun opponent characters
        const stunTargets = game.field.filter((c: Card) => 
          c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        for (const target of stunTargets) {
          (target as any).isStunned = true;
          console.log(`💫 ${target.name} is STUNNED`);
        }
        if (stunTargets.length > 0) {
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-stun`,
            playerName: 'Sistema',
            message: `💫 ${stunTargets.map(c => c.name).join(', ')} ${stunTargets.length > 1 ? 'sono STORDITI' : 'è STORDITO'}!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'poison':
        // Apply poison to opponent characters
        const poisonTargets = game.field.filter((c: Card) => 
          c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        for (const target of poisonTargets) {
          (target as any).poisonDamage = action.value || 50;
          (target as any).poisonTurns = 3;
          console.log(`☠️ ${target.name} is POISONED (${action.value}/turn)`);
        }
        if (poisonTargets.length > 0) {
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-poison`,
            playerName: 'Sistema',
            message: `☠️ ${poisonTargets.map(c => c.name).join(', ')} ${poisonTargets.length > 1 ? 'sono AVVELENATI' : 'è AVVELENATO'} (${action.value} danni/turno)!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'burn':
        // Apply burn to opponent characters
        const burnTargets = game.field.filter((c: Card) => 
          c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        for (const target of burnTargets) {
          (target as any).burnDamage = action.value || 30;
          console.log(`🔥 ${target.name} is BURNING (${action.value}/turn)`);
        }
        if (burnTargets.length > 0) {
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-burn`,
            playerName: 'Sistema',
            message: `🔥 ${burnTargets.map(c => c.name).join(', ')} ${burnTargets.length > 1 ? 'stanno BRUCIANDO' : 'sta BRUCIANDO'} (${action.value} danni/turno)!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'lifesteal':
        // Mark player's active character as having lifesteal
        const lifestealChar = this.getPlayerActiveCharacter(game, playerName);
        if (lifestealChar) {
          (lifestealChar as any).hasLifesteal = true;
          (lifestealChar as any).lifestealAmount = action.value || 100;
          console.log(`🧛 ${lifestealChar.name} now has LIFESTEAL`);
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-lifesteal`,
            playerName: 'Sistema',
            message: `🧛 ${lifestealChar.name} ha attivato il FURTO VITA: curerà ${action.value} PTI quando attacca!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'revenge':
        // Mark player's active character as having revenge ability
        const revengeChar = this.getPlayerActiveCharacter(game, playerName);
        if (revengeChar) {
          (revengeChar as any).hasRevenge = true;
          (revengeChar as any).revengeDamage = action.value || 200;
          console.log(`💀 ${revengeChar.name} now has REVENGE (${action.value} on death)`);
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-revenge`,
            playerName: 'Sistema',
            message: `💀 ${revengeChar.name} ha attivato la VENDETTA: infliggerà ${action.value} danni quando muore!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'powerup':
        // Boost player's active character PTI
        const powerupChar = this.getPlayerActiveCharacter(game, playerName);
        if (powerupChar) {
          const oldPTI = powerupChar.pti || this.extractPTIFromNote(powerupChar.text || '');
          const newPTI = oldPTI + action.value;
          powerupChar.pti = newPTI;
          this.updateCardTextWithPTI(powerupChar);
          console.log(`💪 ${powerupChar.name} powered up: ${oldPTI} → ${newPTI} PTI`);
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-powerup`,
            playerName: 'Sistema',
            message: `💪 ${powerupChar.name} ha guadagnato +${action.value} PTI! (${oldPTI} → ${newPTI})`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'weaken':
        // Reduce opponent characters' PTI
        const weakenTargets = game.field.filter((c: Card) => 
          c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        for (const target of weakenTargets) {
          const oldPTI = target.pti || this.extractPTIFromNote(target.text || '');
          const newPTI = Math.max(0, oldPTI - action.value);
          target.pti = newPTI;
          this.updateCardTextWithPTI(target);
          console.log(`📉 ${target.name} weakened: ${oldPTI} → ${newPTI} PTI`);
        }
        if (weakenTargets.length > 0) {
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-weaken`,
            playerName: 'Sistema',
            message: `📉 ${weakenTargets.map(c => c.name).join(', ')} ${weakenTargets.length > 1 ? 'hanno perso' : 'ha perso'} ${action.value} PTI!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'aura':
        // Boost all allied characters
        const auraTargets = game.field.filter((c: Card) => 
          c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        for (const target of auraTargets) {
          const oldPTI = target.pti || this.extractPTIFromNote(target.text || '');
          const newPTI = oldPTI + action.value;
          target.pti = newPTI;
          this.updateCardTextWithPTI(target);
          console.log(`✨ ${target.name} boosted by aura: ${oldPTI} → ${newPTI} PTI`);
        }
        if (auraTargets.length > 0) {
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-aura`,
            playerName: 'Sistema',
            message: `✨ AURA! Tutti gli alleati hanno guadagnato +${action.value} PTI!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'draw':
        // Make player draw cards
        const player = game.players[playerName];
        if (player) {
          const deckTypes = ['personaggi', 'mosse', 'bonus', 'personaggi_speciali'] as const;
          const availableDecks = deckTypes.filter(d => game.decks[d]?.length > 0);
          for (let i = 0; i < (action.value || 1); i++) {
            if (availableDecks.length > 0) {
              const randomDeck = availableDecks[Math.floor(Math.random() * availableDecks.length)];
              this.pickCard(gameId, randomDeck, playerName);
            }
          }
          console.log(`🎴 ${playerName} drew ${action.value || 1} cards`);
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-draw`,
            playerName: 'Sistema',
            message: `🎴 ${playerName} ha pescato ${action.value || 1} carte!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'discard':
        // Discard cards from opponents' hands
        for (const [opponentName, opponent] of Object.entries(game.players)) {
          if (opponentName === playerName) continue;
          const discardCount = Math.min(action.value || 1, (opponent as any).hand.length);
          for (let i = 0; i < discardCount; i++) {
            if ((opponent as any).hand.length > 0) {
              const randomIndex = Math.floor(Math.random() * (opponent as any).hand.length);
              const discardedCard = (opponent as any).hand.splice(randomIndex, 1)[0];
              game.graveyard.push(discardedCard);
              console.log(`🗑️ ${opponentName} discarded ${discardedCard.name || discardedCard.id}`);
            }
          }
        }
        io?.to(gameId).emit('chat-message', {
          id: `${Date.now()}-discard`,
          playerName: 'Sistema',
          message: `🗑️ Gli avversari hanno scartato ${action.value || 1} carte!`,
          timestamp: Date.now()
        });
        break;
      
      case 'modify_stars':
        // Modify stars on target
        if (action.target === 'self') {
          const starChar = this.getPlayerActiveCharacter(game, playerName);
          if (starChar) {
            const oldStars = starChar.stars || 0;
            starChar.stars = Math.max(0, oldStars + action.value);
            this.updateCardTextWithPTI(starChar);
            console.log(`⭐ ${starChar.name} stars: ${oldStars} → ${starChar.stars}`);
            io?.to(gameId).emit('chat-message', {
              id: `${Date.now()}-stars`,
              playerName: 'Sistema',
              message: `⭐ ${starChar.name} ora ha ${starChar.stars} stelle!`,
              timestamp: Date.now()
            });
          }
        }
        break;
      
      case 'extra_turn':
        // Grant player an extra turn
        (game as any).extraTurnPlayer = playerName;
        console.log(`🔄 ${playerName} granted an EXTRA TURN`);
        io?.to(gameId).emit('chat-message', {
          id: `${Date.now()}-extra-turn`,
          playerName: 'Sistema',
          message: `🔄 ${playerName} ha guadagnato un TURNO EXTRA!`,
          timestamp: Date.now()
        });
        break;
      
      case 'skip_turn':
        // Make opponents skip their next turn
        for (const opponentName of Object.keys(game.players)) {
          if (opponentName !== playerName) {
            (game.players[opponentName] as any).skipNextTurn = true;
            console.log(`⏭️ ${opponentName} will skip next turn`);
          }
        }
        io?.to(gameId).emit('chat-message', {
          id: `${Date.now()}-skip-turn`,
          playerName: 'Sistema',
          message: `⏭️ Gli avversari salteranno il prossimo turno!`,
          timestamp: Date.now()
        });
        break;
      
      case 'nullify':
        // Remove all effects from opponent characters
        const nullifyTargets = game.field.filter((c: Card) => 
          c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        for (const target of nullifyTargets) {
          delete (target as any).isProtected;
          delete (target as any).counterDamage;
          delete (target as any).reflectPercent;
          delete (target as any).shieldAmount;
          delete (target as any).frozenTurns;
          delete (target as any).isStunned;
          delete (target as any).poisonDamage;
          delete (target as any).burnDamage;
          console.log(`🚫 All effects removed from ${target.name}`);
        }
        if (nullifyTargets.length > 0) {
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-nullify`,
            playerName: 'Sistema',
            message: `🚫 Tutti gli effetti nemici sono stati NULLIFICATI!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'resurrect':
      case 'resurrect_choice':
        // Resurrect a card from graveyard
        if (game.graveyard.length > 0) {
          const charCards = game.graveyard.filter((c: Card) => 
            c.type === 'personaggi' || c.type === 'personaggi_speciali'
          );
          if (charCards.length > 0) {
            const resurrectedCard = charCards[charCards.length - 1];
            const index = game.graveyard.findIndex((c: Card) => c.id === resurrectedCard.id);
            if (index !== -1) {
              game.graveyard.splice(index, 1);
              resurrectedCard.owner = playerName;
              resurrectedCard.pti = 500; // Resurrect with 500 PTI
              game.field.push(resurrectedCard);
              this.updateCardTextWithPTI(resurrectedCard);
              console.log(`⚰️ ${resurrectedCard.name} resurrected with 500 PTI`);
              io?.to(gameId).emit('chat-message', {
                id: `${Date.now()}-resurrect`,
                playerName: 'Sistema',
                message: `⚰️ ${resurrectedCard.name} è stato RESUSCITATO con 500 PTI!`,
                timestamp: Date.now()
              });
            }
          }
        }
        break;
      
      case 'steal':
        // Steal a random card from opponent's hand
        for (const [opponentName, opponent] of Object.entries(game.players)) {
          if (opponentName === playerName) continue;
          if ((opponent as any).hand.length > 0) {
            const randomIndex = Math.floor(Math.random() * (opponent as any).hand.length);
            const stolenCard = (opponent as any).hand.splice(randomIndex, 1)[0];
            stolenCard.owner = playerName;
            game.players[playerName].hand.push(stolenCard);
            console.log(`🕵️ ${playerName} stole ${stolenCard.name} from ${opponentName}`);
            io?.to(gameId).emit('chat-message', {
              id: `${Date.now()}-steal`,
              playerName: 'Sistema',
              message: `🕵️ ${playerName} ha rubato una carta da ${opponentName}!`,
              timestamp: Date.now()
            });
            break; // Only steal from one opponent
          }
        }
        break;
      
      case 'double':
        // Double the effect of the next action (mark flag)
        (game as any).doubleNextEffect = true;
        console.log(`✖️2️⃣ Next effect will be DOUBLED`);
        break;
      
      case 'drain':
        // Drain PTI from opponents and heal self
        const drainTargets = game.field.filter((c: Card) => 
          c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        let totalDrained = 0;
        for (const target of drainTargets) {
          const oldPTI = target.pti || this.extractPTIFromNote(target.text || '');
          const drainAmount = Math.min(action.value, oldPTI);
          target.pti = Math.max(0, oldPTI - drainAmount);
          this.updateCardTextWithPTI(target);
          totalDrained += drainAmount;
          if (target.pti <= 0) {
            this.moveToGraveyard(gameId, target.id, target.owner, 'Drain');
          }
        }
        // Heal player's active character
        const drainHealChar = this.getPlayerActiveCharacter(game, playerName);
        if (drainHealChar && totalDrained > 0) {
          const oldPTI = drainHealChar.pti || this.extractPTIFromNote(drainHealChar.text || '');
          drainHealChar.pti = oldPTI + totalDrained;
          this.updateCardTextWithPTI(drainHealChar);
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-drain`,
            playerName: 'Sistema',
            message: `🩸 ${drainHealChar.name} ha assorbito ${totalDrained} PTI dai nemici!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'halve_pti':
        // Halve PTI of target
        if (action.target === 'self') {
          const targetChar = this.getPlayerActiveCharacter(game, playerName);
          if (targetChar) {
            const oldPTI = targetChar.pti || this.extractPTIFromNote(targetChar.text || '');
            targetChar.pti = Math.floor(oldPTI / 2);
            this.updateCardTextWithPTI(targetChar);
            io?.to(gameId).emit('chat-message', {
              id: `${Date.now()}-halve-pti`,
              playerName: 'Sistema',
              message: `📉 ${targetChar.name} PTI dimezzati: ${oldPTI} → ${targetChar.pti}`,
              timestamp: Date.now()
            });
          }
        } else {
          const targetChars = game.field.filter((c: Card) => 
            c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
          );
          for (const target of targetChars) {
            const oldPTI = target.pti || this.extractPTIFromNote(target.text || '');
            target.pti = Math.floor(oldPTI / 2);
            this.updateCardTextWithPTI(target);
          }
          if (targetChars.length > 0) {
            io?.to(gameId).emit('chat-message', {
              id: `${Date.now()}-halve-pti`,
              playerName: 'Sistema',
              message: `📉 PTI nemici dimezzati!`,
              timestamp: Date.now()
            });
          }
        }
        break;
      
      case 'double_pti':
        // Double PTI of target
        if (action.target === 'self' || action.target === 'allies') {
          const targetChar = this.getPlayerActiveCharacter(game, playerName);
          if (targetChar) {
            const oldPTI = targetChar.pti || this.extractPTIFromNote(targetChar.text || '');
            targetChar.pti = oldPTI * 2;
            this.updateCardTextWithPTI(targetChar);
            io?.to(gameId).emit('chat-message', {
              id: `${Date.now()}-double-pti`,
              playerName: 'Sistema',
              message: `📈 ${targetChar.name} PTI raddoppiati: ${oldPTI} → ${targetChar.pti}`,
              timestamp: Date.now()
            });
          }
        }
        break;
      
      case 'halve_stars':
        // Halve stars of target
        const starHalveChar = this.getPlayerActiveCharacter(game, playerName);
        if (starHalveChar && starHalveChar.stars) {
          const oldStars = starHalveChar.stars;
          starHalveChar.stars = Math.floor(oldStars / 2);
          this.updateCardTextWithPTI(starHalveChar);
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-halve-stars`,
            playerName: 'Sistema',
            message: `⭐ ${starHalveChar.name} stelle dimezzate: ${oldStars} → ${starHalveChar.stars}`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'double_stars':
        // Double stars of target
        const starDoubleChar = this.getPlayerActiveCharacter(game, playerName);
        if (starDoubleChar && starDoubleChar.stars) {
          const oldStars = starDoubleChar.stars;
          starDoubleChar.stars = oldStars * 2;
          this.updateCardTextWithPTI(starDoubleChar);
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-double-stars`,
            playerName: 'Sistema',
            message: `⭐ ${starDoubleChar.name} stelle raddoppiate: ${oldStars} → ${starDoubleChar.stars}`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'add_half_pti':
        // Add half of current PTI
        const halfAddChar = this.getPlayerActiveCharacter(game, playerName);
        if (halfAddChar) {
          const oldPTI = halfAddChar.pti || this.extractPTIFromNote(halfAddChar.text || '');
          const bonus = Math.floor(oldPTI / 2);
          halfAddChar.pti = oldPTI + bonus;
          this.updateCardTextWithPTI(halfAddChar);
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-add-half`,
            playerName: 'Sistema',
            message: `💪 ${halfAddChar.name} guadagna +${bonus} PTI (metà di ${oldPTI})!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'execute':
        // Execute characters with low PTI
        const executeTargets = game.field.filter((c: Card) => 
          c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        for (const target of executeTargets) {
          const targetPTI = target.pti || this.extractPTIFromNote(target.text || '');
          if (targetPTI < action.value) {
            this.moveToGraveyard(gameId, target.id, target.owner || '', 'Esecuzione');
            io?.to(gameId).emit('chat-message', {
              id: `${Date.now()}-execute`,
              playerName: 'Sistema',
              message: `💀 ${target.name} ESEGUITO! (aveva solo ${targetPTI} PTI)`,
              timestamp: Date.now()
            });
          }
        }
        break;
      
      case 'silence':
        // Remove all abilities from opponent characters
        const silenceTargets = game.field.filter((c: Card) => 
          c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        for (const target of silenceTargets) {
          (target as any).isSilenced = true;
          delete (target as any).counterDamage;
          delete (target as any).reflectPercent;
          delete (target as any).hasLifesteal;
          delete (target as any).hasRevenge;
        }
        if (silenceTargets.length > 0) {
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-silence`,
            playerName: 'Sistema',
            message: `🤫 Personaggi nemici SILENZIATI - tutte le abilità disattivate!`,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'taunt':
        // Mark character as taunt - must be attacked first
        const tauntChar = this.getPlayerActiveCharacter(game, playerName);
        if (tauntChar) {
          (tauntChar as any).hasTaunt = true;
          io?.to(gameId).emit('chat-message', {
            id: `${Date.now()}-taunt`,
            playerName: 'Sistema',
            message: `🎯 ${tauntChar.name} ha PROVOCAZIONE - deve essere attaccato per primo!`,
            timestamp: Date.now()
          });
        }
        break;
      
      default:
        console.log(`⚡ Unknown effect type: ${action.type}`);
        break;
    }
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

  updateCardTextWithPTI(card: Card): void {
    if (card.pti == null) return;
    
    const ptiValue = card.pti;
    const starsValue = card.stars || 0;
    
    // Update the text to reflect current PTI and stars
    if (card.text) {
      // Replace existing PTI value in text
      if (card.text.match(/PTI:\s*\d+/i)) {
        card.text = card.text.replace(/PTI:\s*\d+/i, `PTI: ${ptiValue}`);
      } else {
        // Add PTI to text if not present
        card.text = `PTI: ${ptiValue}\n${card.text}`;
      }
      
      // Also update stars in text
      if (card.text.match(/Stelle:\s*\d+/i)) {
        card.text = card.text.replace(/Stelle:\s*\d+/i, `Stelle: ${starsValue}`);
      } else if (starsValue > 0) {
        // Add stars after PTI line
        card.text = card.text.replace(/(PTI:\s*\d+)/i, `$1\nStelle: ${starsValue}`);
      }
    } else {
      // Create new text with PTI and stars
      card.text = `PTI: ${ptiValue}`;
      if (starsValue > 0) {
        card.text += `\nStelle: ${starsValue}`;
      }
    }
    
    console.log(`📝 Updated card ${card.name || card.id} text with PTI: ${ptiValue}, Stelle: ${starsValue}`);
  }

  updateCardText(gameId: string, cardId: string, text: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    // Find card in any location and update text
    const findAndUpdateCard = (cards: Card[]) => {
      const card = cards.find(c => c.id === cardId);
      if (card) {
        card.text = text;
        // CRITICAL: Sync .stars property from text to ensure damage calculations use current stars
        const starsMatch = text.match(/[Ss]telle:\s*(-?\d+)/i);
        if (starsMatch) {
          card.stars = parseInt(starsMatch[1]);
        }
        
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

  applyCardSkin(gameId: string, cardId: string, skinImageUrl: string | null, playerName: string, skinPti?: number | null, skinStars?: number | null): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const findAndApplySkin = (cards: Card[]) => {
      const card = cards.find(c => c.id === cardId);
      if (card) {
        // Only allow skin application by the card owner
        if (card.owner !== playerName) {
          console.log(`Skin application denied: ${playerName} is not the owner of card ${cardId}`);
          return false;
        }
        card.appliedSkinUrl = skinImageUrl;
        
        // Apply PTI and Stars if provided (for personaggi/speciali cards)
        if ((card.type === 'personaggi' || card.type === 'personaggi_speciali') && (skinPti || skinStars)) {
          let newText = card.text || '';
          
          if (skinPti) {
            // Update or add PTI
            if (/PTI:\s*\d+/i.test(newText)) {
              newText = newText.replace(/PTI:\s*\d+/gi, `PTI: ${skinPti}`);
            } else {
              newText = `PTI: ${skinPti}${newText ? '\n' + newText : ''}`;
            }
          }
          
          if (skinStars) {
            // Update or add Stars
            if (/stelle:\s*\d+/i.test(newText)) {
              newText = newText.replace(/stelle:\s*\d+/gi, `Stelle: ${skinStars}`);
            } else {
              newText = newText + `\nStelle: ${skinStars}`;
            }
          }
          
          card.text = newText.trim();
          console.log(`Applied skin stats to card ${cardId}: PTI=${skinPti}, Stars=${skinStars}`);
        }
        
        console.log(`Applied skin to card ${cardId}: ${skinImageUrl ? 'custom skin' : 'removed skin'}`);
        return true;
      }
      return false;
    };

    // Check field
    if (findAndApplySkin(game.field)) return true;

    // Check all players' hands
    for (const player of Object.values(game.players)) {
      if (findAndApplySkin(player.hand)) return true;
    }

    return false;
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
    cards: Array<{ name: string, data: string, pti: number | null, stars: number | null, effect?: string | null, audioUrl?: string | null, youtubeUrl?: string | null, isPermanent: boolean, mosseDamageValue?: number | null, mosseDamageEffect?: string | null, mosseCharacterOverrides?: any[] | null, mosseRestrictedFrom?: string[] | null, mosseRestrictedAgainst?: string[] | null, mosseTargetingMode?: string | null, mosseTargetCount?: number | null }>,
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
          audioUrl: cardData.audioUrl || undefined,
          youtubeUrl: cardData.youtubeUrl || undefined,
          mosseDamageValue: deckType === 'mosse' ? cardData.mosseDamageValue : null,
          mosseDamageEffect: deckType === 'mosse' ? cardData.mosseDamageEffect : null,
          mosseCharacterOverrides: deckType === 'mosse' ? cardData.mosseCharacterOverrides : null,
          mosseRestrictedFrom: deckType === 'mosse' ? cardData.mosseRestrictedFrom : null,
          mosseRestrictedAgainst: deckType === 'mosse' ? cardData.mosseRestrictedAgainst : null,
          mosseTargetingMode: deckType === 'mosse' ? cardData.mosseTargetingMode : null,
          mosseTargetCount: deckType === 'mosse' ? cardData.mosseTargetCount : null
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
            jsonStorage.customCards.create({
              name: cardData.name,
              deckType: deckType,
              imageData: cardData.data,
              pti: cardData.pti,
              stars: cardData.stars,
              effect: cardData.effect || null,
              audioUrl: cardData.audioUrl || null,
              youtubeUrl: cardData.youtubeUrl || null,
              mosseDamageValue: deckType === 'mosse' ? cardData.mosseDamageValue ?? null : null,
              mosseDamageEffect: deckType === 'mosse' ? cardData.mosseDamageEffect ?? null : null,
              mosseCharacterOverrides: deckType === 'mosse' ? cardData.mosseCharacterOverrides ?? null : null,
              mosseRestrictedFrom: deckType === 'mosse' ? cardData.mosseRestrictedFrom ?? null : null,
              mosseRestrictedAgainst: deckType === 'mosse' ? cardData.mosseRestrictedAgainst ?? null : null,
              mosseTargetingMode: deckType === 'mosse' ? cardData.mosseTargetingMode ?? null : null,
              mosseTargetCount: deckType === 'mosse' ? cardData.mosseTargetCount ?? null : null,
              createdBy: playerName
            });
            console.log(`Permanent card "${cardData.name}" saved to JSON with audioUrl: ${cardData.audioUrl}, youtubeUrl: ${cardData.youtubeUrl}`);
            
            // Automatically create a skin for this permanent custom card
            try {
              jsonStorage.cardSkins.create({
                name: `Skin - ${cardData.name}`,
                description: `Skin personalizzata per ${cardData.name}`,
                rarity: 'common',
                price: 0,
                cardName: cardData.name,
                cardType: deckType,
                skinImageUrl: cardData.data,
                skinPti: null,
                skinStars: null,
                borderStyle: null,
                backgroundGradient: null,
                glowColor: null,
                frameImageUrl: null,
                isAvailable: true
              });
              console.log(`Auto-created skin for permanent card "${cardData.name}"`);
            } catch (skinError) {
              console.error('Error creating skin for permanent card:', skinError);
            }
          } catch (jsonError) {
            console.error('Error saving permanent card to JSON:', jsonError);
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
        const effectiveLimit = Math.max(1, baseLimit + playerModifier); // Minimum 1 death required
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

    // Process delayed deaths - decrement timers and kill cards when timer reaches 0
    if (gameState.delayedDeaths && gameState.delayedDeaths.length > 0) {
      const deathsToProcess: typeof gameState.delayedDeaths = [];
      
      for (const dd of gameState.delayedDeaths) {
        dd.turnsRemaining--;
        
        // Update card text with new turn count
        const card = gameState.field.find(c => c.id === dd.cardId);
        if (card) {
          if (dd.turnsRemaining <= 0) {
            deathsToProcess.push(dd);
          } else {
            const currentPTI = card.pti || this.extractPTIFromNote(card.text || '');
            const currentStars = this.extractStarsFromNote(card.text || '');
            card.text = `PTI: ${currentPTI} | Stelle: ${currentStars} | ☠️ Muore tra ${dd.turnsRemaining} turni`;
          }
        }
      }
      
      // Process deaths
      for (const dd of deathsToProcess) {
        console.log(`💀 Delayed death triggered for ${dd.cardName}`);
        this.moveToGraveyard(gameId, dd.cardId, dd.owner, 'MORTE_RITARDATA');
        
        // Emit notification
        const io = (global as any).io;
        if (io) {
          io.to(gameId).emit('game-message', {
            type: 'death',
            message: `💀 ${dd.cardName} è morto! (morte ritardata)`,
            playerName: dd.owner
          });
        }
      }
      
      // Remove processed deaths from list
      gameState.delayedDeaths = gameState.delayedDeaths.filter(dd => dd.turnsRemaining > 0);
    }

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

    // PROCESS STATUS EFFECTS: poison, burn, frozen, stun for this player's characters
    const io = (global as any).io;
    const playerCards = gameState.field.filter((c: Card) => 
      c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
    );
    
    for (const card of playerCards) {
      // Process POISON tick
      if ((card as any).poisonDamage && (card as any).poisonTurns > 0) {
        const poisonDmg = (card as any).poisonDamage;
        const oldPTI = card.pti || this.extractPTIFromNote(card.text || '');
        const newPTI = Math.max(0, oldPTI - poisonDmg);
        card.pti = newPTI;
        this.updateCardTextWithPTI(card);
        (card as any).poisonTurns--;
        
        console.log(`☠️ POISON TICK: ${card.name} took ${poisonDmg} poison damage, ${(card as any).poisonTurns} turns remaining`);
        
        if (io) {
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-poison-tick`,
            playerName: 'Sistema',
            message: `☠️ ${card.name} subisce ${poisonDmg} danni da veleno! (PTI: ${oldPTI} → ${newPTI})`,
            timestamp: Date.now()
          });
        }
        
        // Remove poison if turns expired
        if ((card as any).poisonTurns <= 0) {
          delete (card as any).poisonDamage;
          delete (card as any).poisonTurns;
        }
        
        // Check death
        if (newPTI <= 0) {
          this.moveToGraveyard(gameId, card.id, playerName, 'VELENO');
        }
      }
      
      // Process BURN tick
      if ((card as any).burnDamage) {
        const burnDmg = (card as any).burnDamage;
        const oldPTI = card.pti || this.extractPTIFromNote(card.text || '');
        const newPTI = Math.max(0, oldPTI - burnDmg);
        card.pti = newPTI;
        this.updateCardTextWithPTI(card);
        
        console.log(`🔥 BURN TICK: ${card.name} took ${burnDmg} burn damage`);
        
        if (io) {
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-burn-tick`,
            playerName: 'Sistema',
            message: `🔥 ${card.name} subisce ${burnDmg} danni da bruciatura! (PTI: ${oldPTI} → ${newPTI})`,
            timestamp: Date.now()
          });
        }
        
        // Check death
        if (newPTI <= 0) {
          this.moveToGraveyard(gameId, card.id, playerName, 'BRUCIATURA');
        }
      }
      
      // Process FROZEN countdown
      if ((card as any).frozenTurns && (card as any).frozenTurns > 0) {
        (card as any).frozenTurns--;
        console.log(`❄️ FREEZE: ${card.name} thawing, ${(card as any).frozenTurns} turns remaining`);
        
        if ((card as any).frozenTurns <= 0) {
          delete (card as any).frozenTurns;
          if (io) {
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-freeze-ended`,
              playerName: 'Sistema',
              message: `❄️ ${card.name} non è più congelato!`,
              timestamp: Date.now()
            });
          }
        }
      }
      
      // Process STUN (remove after turn)
      if ((card as any).isStunned) {
        delete (card as any).isStunned;
        console.log(`💫 STUN: ${card.name} is no longer stunned`);
        if (io) {
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-stun-ended`,
            playerName: 'Sistema',
            message: `💫 ${card.name} non è più stordito!`,
            timestamp: Date.now()
          });
        }
      }
      
      // Process PROTECTION countdown
      if ((card as any).isProtected && (card as any).protectionTurns) {
        (card as any).protectionTurns--;
        if ((card as any).protectionTurns <= 0) {
          delete (card as any).isProtected;
          delete (card as any).protectionTurns;
          if (io) {
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-protection-ended`,
              playerName: 'Sistema',
              message: `🛡️ ${card.name} non è più protetto!`,
              timestamp: Date.now()
            });
          }
        }
      }
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
    const { attacker, defender, targetCardId, mosseCardId, damage, isHandTarget, starsToRemove = 0, isFurtoAttack = false, mosseEffect } = pendingDefense;

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

      // CRITICAL: Reset CPU's waitingForAttackResolution flag when defense succeeds
      if (attacker.startsWith('CPU-')) {
        const cpuInstance = game?.players[attacker]?.cpuInstance;
        if (cpuInstance) {
          cpuInstance.resolveAttack();
          console.log(`🎯 CPU ${attacker}: Attack blocked by defense - CPU attack resolved`);
        }
      }

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
      await this.processMosseDamage(gameId, attacker, targetCardId, damage, mosseCardId, io, false, isHandTarget || false, isFurtoAttack, false, starsToRemove, mosseEffect);
      
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

    // CRITICAL: Reset CPU's waitingForAttackResolution flag after defense resolution
    if (game.players[attacker]?.isCPU && game.players[attacker]?.cpuInstance) {
      const cpuInstance = game.players[attacker].cpuInstance;
      cpuInstance.resolveAttack();
      console.log(`🤖 CPU ${attacker} attack resolved after defense resolution`);
    }

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

      // CRITICAL: Resolve CPU attacker's waiting state after counter-attack
      const cpuInstance = game?.players[attacker]?.cpuInstance;
      if (cpuInstance) {
        cpuInstance.resolveAttack();
        console.log(`🤖 CPU ${attacker} attack resolved after counter-attack (defender won)`);
      }

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

      // CRITICAL: Resolve CPU attacker's waiting state after counter-attack
      const cpuInstanceAttacker = game?.players[attacker]?.cpuInstance;
      if (cpuInstanceAttacker) {
        cpuInstanceAttacker.resolveAttack();
        console.log(`🤖 CPU ${attacker} attack resolved after counter-attack (attacker won)`);
      }

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

      // CRITICAL: Resolve CPU attacker's waiting state after clash tie
      const cpuInstanceTie = game?.players[attacker]?.cpuInstance;
      if (cpuInstanceTie) {
        cpuInstanceTie.resolveAttack();
        console.log(`🤖 CPU ${attacker} attack resolved after clash tie`);
      }

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

    // CRITICAL: Resolve CPU attacker's waiting state after clash ends
    const cpuInstanceClash = game?.players[attacker]?.cpuInstance;
    if (cpuInstanceClash) {
      cpuInstanceClash.resolveAttack();
      console.log(`🤖 CPU ${attacker} attack resolved after clash battle`);
    }

    game.activeClashBattle = undefined;
    const updatedGameState = this.getSanitizedGameState(gameId);
    io.to(gameId).emit('game-state-update', updatedGameState);
  }

  // Get active clash battle for a game
  getActiveClashBattle(gameId: string): ClashBattle | undefined {
    const game = this.games.get(gameId);
    return game?.activeClashBattle;
  }

  // EXTRACTED AND HARDENED: Damage processing method (preserves ALL legacy logic + BAMBOLA VOODOO + ATTACCO DISONESTO + FURTO + STAR REMOVAL + SPECIAL EFFECTS)
  async processMosseDamage(gameId: string, attackerName: string, targetCardId: string, damageValue: number, mosseCardId: string, io: any, isVoodooReflection: boolean = false, isHandTarget: boolean = false, isFurtoAttack: boolean = false, isPersistentTick: boolean = false, starsToRemove: number = 0, mosseEffect?: string): Promise<void> {
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
      // Regular attack: target is on field - use real game.field reference for mutations
      targetCard = game?.field?.find((c: any) => c.id === targetCardId);
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
            player.hand[handCardIndex].stars = newStars; // CRITICAL: Update .stars property
          }
        }
      } else {
        this.updateCardText(gameId, targetCardId, updatedNotes);
        // CRITICAL: Also update .stars property on field card
        const fieldCard = game?.field?.find((c: Card) => c.id === targetCardId);
        if (fieldCard) fieldCard.stars = newStars;
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
        // CRITICAL: Update attacker's .stars property
        attackerCharacter.stars = attackerNewStars;

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

    // ========== CUSTOM EFFECT INTEGRATION: SHIELD, REFLECT, COUNTER, LIFESTEAL ==========
    let effectiveDamage = damageValue;
    
    // SHIELD EFFECT: Absorb damage up to shield amount
    if ((targetCard as any).shieldAmount && (targetCard as any).shieldAmount > 0) {
      const shield = (targetCard as any).shieldAmount;
      const absorbed = Math.min(shield, effectiveDamage);
      (targetCard as any).shieldAmount = shield - absorbed;
      effectiveDamage -= absorbed;
      
      console.log(`🛡️ SHIELD EFFECT: ${targetCard.name} absorbed ${absorbed} damage, ${(targetCard as any).shieldAmount} shield remaining`);
      
      io.to(gameId).emit('chat-message', {
        id: `${Date.now()}-shield-absorb`,
        playerName: 'Sistema',
        message: `🛡️ ${targetCard.name || 'Personaggio'} assorbe ${absorbed} danni con lo scudo! (Scudo rimasto: ${(targetCard as any).shieldAmount})`,
        timestamp: Date.now()
      });
      
      // Remove shield if depleted
      if ((targetCard as any).shieldAmount <= 0) {
        delete (targetCard as any).shieldAmount;
      }
    }
    
    // REFLECT EFFECT: Reflect percentage of damage back to attacker
    if ((targetCard as any).reflectPercent && (targetCard as any).reflectPercent > 0 && !isVoodooReflection) {
      const reflectAmount = Math.floor(effectiveDamage * ((targetCard as any).reflectPercent / 100));
      
      if (reflectAmount > 0) {
        // Find attacker's character
        const attackerChar = game?.field.find((c: Card) => c.owner === attackerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'));
        
        if (attackerChar) {
          const attackerPTI = this.extractPTIFromNote(attackerChar.text || '');
          const newAttackerPTI = Math.max(0, attackerPTI - reflectAmount);
          attackerChar.pti = newAttackerPTI;
          this.updateCardTextWithPTI(attackerChar);
          
          console.log(`🪞 REFLECT EFFECT: ${targetCard.name} reflected ${reflectAmount} damage to ${attackerChar.name}`);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-reflect-damage`,
            playerName: 'Sistema',
            message: `🪞 ${targetCard.name || 'Personaggio'} riflette ${reflectAmount} danni a ${attackerChar.name || 'Attaccante'}! (PTI: ${attackerPTI} → ${newAttackerPTI})`,
            timestamp: Date.now()
          });
          
          // Check if attacker died from reflected damage
          if (newAttackerPTI <= 0) {
            this.moveToGraveyard(gameId, attackerChar.id, attackerName, targetOwner);
          }
        }
      }
    }
    
    // COUNTER EFFECT: Deal counter damage to attacker
    if ((targetCard as any).counterDamage && (targetCard as any).counterDamage > 0 && !isVoodooReflection) {
      const counterDmg = (targetCard as any).counterDamage;
      
      // Find attacker's character
      const attackerChar = game?.field.find((c: Card) => c.owner === attackerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'));
      
      if (attackerChar) {
        const attackerPTI = this.extractPTIFromNote(attackerChar.text || '');
        const newAttackerPTI = Math.max(0, attackerPTI - counterDmg);
        attackerChar.pti = newAttackerPTI;
        this.updateCardTextWithPTI(attackerChar);
        
        console.log(`⚔️ COUNTER EFFECT: ${targetCard.name} counter-attacked for ${counterDmg} damage`);
        
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-counter-damage`,
          playerName: 'Sistema',
          message: `⚔️ ${targetCard.name || 'Personaggio'} contrattacca per ${counterDmg} danni! (PTI attaccante: ${attackerPTI} → ${newAttackerPTI})`,
          timestamp: Date.now()
        });
        
        // Check if attacker died from counter damage
        if (newAttackerPTI <= 0) {
          this.moveToGraveyard(gameId, attackerChar.id, attackerName, targetOwner);
        }
      }
    }
    
    // LIFESTEAL EFFECT: Heal attacker for percentage of damage dealt
    // Check if attacker's character has lifesteal (set by applyParsedEffect as hasLifesteal/lifestealAmount)
    const attackerCharForLifesteal = game?.field.find((c: Card) => c.owner === attackerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'));
    
    if (attackerCharForLifesteal && (attackerCharForLifesteal as any).hasLifesteal) {
      const lifestealPercent = (attackerCharForLifesteal as any).lifestealAmount || 100;
      const healAmount = Math.floor(effectiveDamage * (lifestealPercent / 100));
      
      if (healAmount > 0) {
        const attackerPTI = this.extractPTIFromNote(attackerCharForLifesteal.text || '');
        const newAttackerPTI = attackerPTI + healAmount;
        attackerCharForLifesteal.pti = newAttackerPTI;
        this.updateCardTextWithPTI(attackerCharForLifesteal);
        
        const attackerName2 = attackerCharForLifesteal.name || this.getCardNameFromUrl(attackerCharForLifesteal.frontImage || '');
        console.log(`🩸 LIFESTEAL EFFECT: ${attackerName2} healed for ${healAmount} PTI`);
        
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-lifesteal-heal`,
          playerName: 'Sistema',
          message: `🩸 ${attackerName2 || 'Attaccante'} ruba ${healAmount} PTI! (PTI: ${attackerPTI} → ${newAttackerPTI})`,
          timestamp: Date.now()
        });
      }
    }
    // ========== END CUSTOM EFFECT INTEGRATION ==========
    
    // ========== MOSSE SPECIAL EFFECT HANDLING ==========
    let forceInstantDeath = false;
    let additionalStarsToRemove = 0;
    let effectMessage = '';
    
    if (mosseEffect) {
      switch (mosseEffect) {
        case 'death':
          // Instant death - character dies regardless of PTI
          forceInstantDeath = true;
          effectMessage = '💀 MORTE ISTANTANEA!';
          console.log(`💀 SPECIAL EFFECT: Instant death triggered for ${targetCard.frontImage}`);
          break;
          
        case 'halve_pti':
          // Halve the target's PTI (override normal damage)
          currentPTI = Math.floor(currentPTI / 2);
          effectiveDamage = 0; // Don't apply additional damage
          effectMessage = `➗ PTI DIMEZZATI! (${currentPTI * 2} → ${currentPTI})`;
          console.log(`➗ SPECIAL EFFECT: Halved PTI for ${targetCard.frontImage}: ${currentPTI}`);
          break;
          
        case 'zero_stars':
          // Set stars to 0
          additionalStarsToRemove = 999; // Will be capped to current stars
          effectMessage = '⭐ STELLE AZZERATE!';
          console.log(`⭐ SPECIAL EFFECT: Zero stars for ${targetCard.frontImage}`);
          break;
          
        case 'set_5_pti':
          // Set PTI to exactly 5
          effectiveDamage = Math.max(0, currentPTI - 5);
          effectMessage = '5️⃣ PTI IMPOSTATI A 5!';
          console.log(`5️⃣ SPECIAL EFFECT: Set PTI to 5 for ${targetCard.frontImage}`);
          break;
          
        case 'remove_1_star':
          // Remove exactly 1 star
          additionalStarsToRemove = 1;
          effectMessage = '⭐ -1 STELLA!';
          console.log(`⭐ SPECIAL EFFECT: Remove 1 star from ${targetCard.frontImage}`);
          break;
      }
      
      // Broadcast effect message
      if (effectMessage) {
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-mosse-effect`,
          playerName: 'Sistema',
          message: `⚡ EFFETTO SPECIALE: ${effectMessage}`,
          timestamp: Date.now()
        });
      }
    }
    
    // Combine star removal from both manual input and special effects
    const totalStarsToRemove = starsToRemove + additionalStarsToRemove;
    // ========== END MOSSE SPECIAL EFFECT HANDLING ==========
    
    // PRESERVE: Calculate new PTI after damage (using effective damage after shield)
    // If instant death effect, set newPTI to 0
    const newPTI = forceInstantDeath ? 0 : Math.max(0, currentPTI - effectiveDamage);
    
    // Track damage dealt for missions/achievements (fire-and-forget)
    this.trackPlayerEvent(gameId, attackerName, 'damage_dealt', { amount: effectiveDamage }).catch(() => {});
    
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

    // STAR REMOVAL: Apply star damage if specified (including special effect star removal)
    let starsRemovedMessage = '';
    let newStarsAfterRemoval: number | null = null;
    if (totalStarsToRemove > 0) {
      const currentStars = this.extractStarsFromNote(updatedNotes);
      const actualStarsRemoved = Math.min(totalStarsToRemove, currentStars);
      newStarsAfterRemoval = Math.max(0, currentStars - totalStarsToRemove);
      updatedNotes = updatedNotes.replace(/Stelle:\s*\d+/i, `Stelle: ${newStarsAfterRemoval}`);
      
      // If no stars field exists, add it
      if (!updatedNotes.match(/Stelle:/i)) {
        updatedNotes = `${updatedNotes} | Stelle: ${newStarsAfterRemoval}`;
      }
      
      starsRemovedMessage = ` | ⭐ Stelle: ${currentStars} → ${newStarsAfterRemoval}`;
      console.log(`⭐ STAR REMOVAL: ${targetOwner}'s card lost ${actualStarsRemoved} stars: ${currentStars} → ${newStarsAfterRemoval}`);
    }

    // PRESERVE: Update the card in the game state (works for both hand and field)
    if (isHandTarget) {
      // For hand targets, update directly in player's hand
      const player = game?.players?.[targetOwner];
      if (player) {
        const handCardIndex = player.hand.findIndex((c: Card) => c.id === targetCardId);
        if (handCardIndex !== -1) {
          player.hand[handCardIndex].text = updatedNotes;
          // CRITICAL: Also update .stars property if stars were removed
          if (newStarsAfterRemoval !== null) {
            player.hand[handCardIndex].stars = newStarsAfterRemoval;
          }
        }
      }
    } else {
      // For field targets, use existing method
      this.updateCardText(gameId, targetCardId, updatedNotes);
      // CRITICAL: Also update .stars property on field card if stars were removed
      if (newStarsAfterRemoval !== null) {
        const fieldCard = game?.field?.find((c: Card) => c.id === targetCardId);
        if (fieldCard) fieldCard.stars = newStarsAfterRemoval;
      }
    }
    
    console.log(`${isHandTarget ? '🎯 ATTACCO DISONESTO: ' : ''}${targetOwner}'s ${targetCard.frontImage} took ${damageValue} damage: ${currentPTI} → ${newPTI} PTI${starsToRemove > 0 ? `, -${starsToRemove} stars` : ''}`);
    
    // PRESERVE: Mark action as completed for CPU turn flow
    if (attackerName.startsWith('CPU-')) {
      console.log(`MOSSE action completed for CPU ${attackerName}`);
      // CRITICAL: Reset the CPU's waitingForAttackResolution flag so it can take its next turn
      const cpuInstance = game?.players[attackerName]?.cpuInstance;
      if (cpuInstance) {
        cpuInstance.resolveAttack();
        console.log(`🎯 CPU ${attackerName}: Attack resolved - CPU can now end turn or continue`);
      }
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
              const effectiveLimit = Math.max(1, baseLimit + playerModifier); // Minimum 1 death required
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
      // Mark game as inactive in database
      this.markGameInactive(gameId).catch(err => console.error('Failed to mark game inactive:', err));
      return winner;
    }

    // Also check: if only one HUMAN player remains and all CPUs are eliminated, human wins
    const activeHumans = allActivePlayers.filter(p => !game.players[p].isCPU);
    const activeCPUs = allActivePlayers.filter(p => game.players[p].isCPU);
    
    if (activeHumans.length === 1 && activeCPUs.length === 0) {
      const winner = activeHumans[0];
      game.gameEnded = true;
      console.log(`Game victory declared for human ${winner} (all CPUs eliminated) - game marked as ended`);
      // Mark game as inactive in database
      this.markGameInactive(gameId).catch(err => console.error('Failed to mark game inactive:', err));
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
              
              // Execute the attack using the gameManager method (correct parameter order)
              const attackResult = await this.executeMossaAttack(
                gameId,
                attackAction.data.attackerName || playerName,
                attackAction.data.mosseCardId,
                attackAction.data.targetCardId,
                attackAction.data.damage || 100
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
          
          // Execute the attack using the gameManager method (correct parameter order)
          const attackResult = await this.executeMossaAttack(
            gameId,
            attackAction.data.attackerName || playerName,
            attackAction.data.mosseCardId,
            attackAction.data.targetCardId,
            attackAction.data.damage || 100
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
