import { CARD_DATA, DECK_BACK_IMAGES, SCENARIO_CARDS } from '../client/src/lib/cardData';
import { db } from './db';
import { matches, gameEvents, personaggi, type InsertMatch, type InsertGameEvent } from '../shared/schema';
import { eq, ilike, sql } from 'drizzle-orm';
import { CPUPlayer } from './cpuPlayer';

interface Card {
  id: string;
  type: string;
  frontImage: string;
  backImage: string;
  owner: string;
  text?: string;
  eliminatedBy?: string;
  faceDown?: boolean;
  section?: string;
  // Fusion system
  fusedWith?: string[]; // Array of card IDs that are fused with this card
  isFused?: boolean; // True if this card is part of a fusion
  fusionLeader?: string; // ID of the card that leads the fusion group
  // Animation trigger
  triggerAnimation?: boolean; // True if this card should trigger a special animation
}

interface Player {
  name: string;
  hand: Card[];
  socketId: string | null;
  isCPU?: boolean;
  cpuInstance?: CPUPlayer;
  usedCardsThisTurn?: string[]; // Track card images used this turn to prevent reuse
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
  pendingTransferRequests: TransferRequest[]; // Pending card transfer requests between human players
  pendingDefense?: PendingDefense; // Current pending defense request (only one at a time)
  voodooLinks: VoodooLink[]; // BAMBOLA VOODOO: Track linked characters
  activeDuel?: DuelState; // Current active duel state
}

export class GameManager {
  private games: Map<string, GameState> = new Map();
  private playerToGame: Map<string, string> = new Map();

  // Public method to update player-to-game mapping
  setPlayerToGame(socketId: string, gameId: string): void {
    this.playerToGame.set(socketId, gameId);
  }

  private createInitialDeck(type: keyof typeof CARD_DATA): Card[] {
    const frontImages = CARD_DATA[type];
    const backImage = DECK_BACK_IMAGES[type];
    
    return frontImages.map((frontImage, index) => ({
      id: `${type}-${index}`,
      type,
      frontImage,
      backImage,
      owner: '',
      text: ''
    }));
  }

  private initializeGame(gameId: string): GameState {
    const gameState = {
      decks: {
        personaggi: this.createInitialDeck('personaggi'),
        mosse: this.createInitialDeck('mosse'),
        bonus: this.createInitialDeck('bonus'),
        personaggi_speciali: this.createInitialDeck('personaggi_speciali')
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
      pendingTransferRequests: [],
      voodooLinks: []
    };

    // Auto-shuffle all decks when starting a new game
    this.shuffleGameDecks(gameState);
    
    return gameState;
  }

  async addPlayer(gameId: string, playerName: string, socketId: string, isCPU: boolean = false): Promise<void> {
    if (!this.games.has(gameId)) {
      this.games.set(gameId, this.initializeGame(gameId));
      // Create match record when first player joins
      await this.createMatchRecord(gameId);
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
      if (!process.env.OPENAI_API_KEY) {
        return null;
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      if (!game || !game.matchId) return;

      const duration = Math.floor((Date.now() - game.startTime.getTime()) / 1000);
      const playerList = Object.keys(game.players);

      await db.update(matches)
        .set({
          endedAt: new Date(),
          winnerPlayer,
          duration,
          players: playerList
        })
        .where(eq(matches.id, game.matchId));

      await this.awardRankiardPoints(game, winnerPlayer);

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
      game.field.push(card);
      
      // Check if it's a PERSONAGGI or PERSONAGGI_SPECIALI card
      const isPersonaggio = card.type === 'personaggi' || card.type === 'personaggi_speciali';
      
      // Auto-analyze cards for ALL players (PERSONAGGI only)
      if (isPersonaggio && (!card.text || card.text.trim() === '')) {
        // Trigger automatic analysis for PERSONAGGI cards (both CPU and human players)
        await this.autoAnalyzePersonaggioCard(gameId, card, playerName);
      }
      
      // Check if card has special animation
      const cardName = this.getCardNameFromUrl(card.frontImage);
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
      
      // Record play card event
      await this.recordEvent(gameId, 'play-card', {
        cardId: card.id,
        cardType: card.type,
        frontImage: card.frontImage,
        isPersonaggio,
        triggerAnimation: card.triggerAnimation || false,
        cardName: cardName
      }, playerName);
      
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
      if (!targetCard || (targetCard.type !== 'personaggi' && targetCard.type !== 'personaggi_speciali') || targetCard.owner === attackerName) {
        return { success: false, error: 'Invalid target: must be enemy character on field' };
      }
      targetOwnerName = targetCard.owner;
    }

    const attackTypeLabel = isHandTarget ? '🎯 ATTACCO DISONESTO' : '⚔️ MOSSE';
    console.log(`${attackTypeLabel}: ${attackerName} uses ${mosseCardId} to attack ${targetOwnerName}'s ${targetCardId}`);
    
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

  // Look up PERSONAGGI data from database
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

      // Find the card to duplicate (can be in field or hand)
      let originalCard = game.field.find(card => card.id === cardId);
      let isInField = true;
      
      if (!originalCard) {
        // Check in player's hand
        const player = game.players[playerName];
        if (player && player.hand) {
          originalCard = player.hand.find(card => card.id === cardId);
          isInField = false;
        }
      }

      if (!originalCard) {
        return { success: false, message: 'Card not found' };
      }

      // Only PERSONAGGI and PERSONAGGI_SPECIALI cards can be duplicated
      if (originalCard.type !== 'personaggi' && originalCard.type !== 'personaggi_speciali') {
        return { success: false, message: 'Only PERSONAGGI and PERSONAGGI_SPECIALI cards can be duplicated' };
      }

      // Only card owner can duplicate
      if (originalCard.owner !== playerName) {
        return { success: false, message: 'You can only duplicate your own cards' };
      }

      // Create the duplicate card with same properties
      const duplicatedCard = {
        id: `${originalCard.type}-duplicate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: originalCard.type as 'personaggi' | 'personaggi_speciali',
        frontImage: originalCard.frontImage,
        backImage: originalCard.backImage,
        owner: playerName,
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

  // AUTO-ANALYZE PERSONAGGI CARDS FOR ALL PLAYERS (using database lookup)
  private async autoAnalyzePersonaggioCard(gameId: string, card: any, playerName: string) {
    try {
      console.log(`Auto-analyzing PERSONAGGI card for ${playerName}: ${card.frontImage}`);
      
      // Extract card name from URL
      const cardName = this.getCardNameFromUrl(card.frontImage);
      
      // First try database lookup for exact data
      const dbResult = await this.getPersonaggioFromDatabase(cardName);
      
      if (dbResult && (dbResult.pti !== null || dbResult.stars !== null)) {
        // Found exact data in database
        const pti = dbResult.pti || 1000;
        const stars = dbResult.stars || 1;
        
        let autoText = `PTI: ${pti} | Stelle: ${stars}`;
        
        card.text = autoText;
        console.log(`${playerName} auto-analyzed from database: ${autoText}`);
        
      } else {
        // Fallback for CPU players using AI analysis
        const game = this.games.get(gameId);
        const player = game?.players[playerName];
        
        if (player?.isCPU && player.cpuInstance) {
          // Use CPU's detailed analysis method as fallback
          const analysis = await player.cpuInstance.analyzeCardImageDetailed(card.frontImage, 'personaggi');
          
          if (analysis && ((analysis.pti && analysis.pti > 0) || (analysis.stars && analysis.stars > 0))) {
            let autoText = '';
            if (analysis.pti && analysis.pti > 0) autoText += `PTI: ${analysis.pti}`;
            if (analysis.stars && analysis.stars > 0) {
              if (autoText) autoText += ' | ';
              autoText += `Stelle: ${analysis.stars}`;
            }
            
            card.text = autoText;
            console.log(`CPU ${playerName} auto-analyzed with AI fallback: ${autoText}`);
          } else {
            card.text = 'PTI: 1000 | Stelle: 1';
            console.log(`Auto-analysis failed for CPU ${playerName}, using default values`);
          }
        } else {
          // For human players, use reasonable defaults if not in database
          card.text = 'PTI: 1000 | Stelle: 1';
          console.log(`Human player ${playerName}: card not in database, using default values`);
        }
      }
    } catch (error) {
      console.error(`Error in auto-analysis for ${playerName}:`, error);
      // Fallback text on error
      card.text = 'PTI: 1000 | Stelle: 1';
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
        const isPersonaggio = card.type === 'personaggi';
        
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

  moveToGraveyard(gameId: string, cardId: string, playerName: string, attacker?: string): { success: boolean, graveyardCount?: number, cardImage?: string, eliminationCheck?: boolean, sorosActivated?: boolean, sorosImage?: string, sorosActivator?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

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
          graveyardCard => graveyardCard.eliminatedBy === playerName && graveyardCard.type === 'personaggi'
        ).length;

        // NEW: Track elimination count for SOROS activation
        let sorosActivated = false;
        if (card.type === 'personaggi' && attacker) {
          // Increment elimination count for the attacker
          const attackerPlayer = game.players[attacker];
          if (attackerPlayer) {
            if (!attackerPlayer.eliminationCount) {
              attackerPlayer.eliminationCount = 0;
            }
            
            attackerPlayer.eliminationCount++;
            console.log(`🗡️ ${attacker} has eliminated ${attackerPlayer.eliminationCount} personaggi`);
            
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
                return { success: true, graveyardCount, cardImage: card.frontImage, eliminationCheck: false, sorosActivated: true, sorosImage: soros.frontImage, sorosActivator: attacker };
              }
            }
          }
        }

        // Check if player should be eliminated (only if it's a personaggi card)
        let eliminationCheck = false;
        if (card.type === 'personaggi' && game.characterLimit !== 'unlimited') {
          const limit = parseInt(game.characterLimit);
          if (graveyardCount >= limit && !game.eliminatedPlayers.has(playerName)) {
            eliminationCheck = true;
          }
        }

        return { success: true, graveyardCount, cardImage: card.frontImage, eliminationCheck, sorosActivated: false };
      }
    }
    
    return { success: false };
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
        card1Result.card.type === 'personaggi' && card2Result.card.type === 'personaggi') {
      
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
  processCPUChatResponses(gameId: string, humanMessage: string, humanPlayerName: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    // Let all CPU players in this game potentially respond to the human message
    for (const [cpuPlayerName, player] of Object.entries(game.players)) {
      if (player.isCPU && player.cpuInstance && cpuPlayerName !== humanPlayerName) {
        try {
          player.cpuInstance.processHumanChat(humanMessage, humanPlayerName);
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

  addCustomCards(gameId: string, deckType: string, images: Array<{ name: string, data: string }>): { success: boolean } {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    try {
      images.forEach((image, index) => {
        const card = {
          id: `custom-${deckType}-${Date.now()}-${index}`,
          type: deckType as 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali',
          frontImage: image.data, // Base64 data URL
          backImage: this.getBackImageForDeck(deckType),
          owner: '',
          text: ''
        };
        
        // Add to appropriate deck
        if (deckType === 'personaggi') {
          game.decks.personaggi.push(card);
        } else if (deckType === 'mosse') {
          game.decks.mosse.push(card);
        } else if (deckType === 'bonus') {
          game.decks.bonus.push(card);
        } else if (deckType === 'personaggi_speciali') {
          game.decks.personaggi_speciali.push(card);
        }
      });
      
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

  async eliminatePersonaggi(gameId: string, cardId: string, playerName: string): Promise<{ success: boolean, cardImage?: string, eliminationCheck?: boolean }> {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    try {
      // Find the card in the field
      const cardIndex = game.field.findIndex(card => card.id === cardId && card.type === 'personaggi');
      if (cardIndex === -1) return { success: false };

      const card = game.field.splice(cardIndex, 1)[0];
      
      // Mark as eliminated and add to graveyard
      card.eliminatedBy = playerName;
      game.graveyard.push(card);
      
      // Count PERSONAGGI cards in graveyard for this player (only personaggi count for elimination)
      const graveyardCount = game.graveyard.filter(
        graveyardCard => graveyardCard.eliminatedBy === playerName && graveyardCard.type === 'personaggi'
      ).length;

      // Check if player should be eliminated (only if it's a personaggi card)
      let eliminationCheck = false;
      if (card.type === 'personaggi' && game.characterLimit !== 'unlimited') {
        const limit = parseInt(game.characterLimit);
        if (graveyardCount >= limit && !game.eliminatedPlayers.has(playerName)) {
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

      return { success: true, cardImage: card.frontImage, eliminationCheck };
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

    // Reset usedCardsThisTurn for the current player when their turn ends
    if (gameState.players[playerName]) {
      gameState.players[playerName].usedCardsThisTurn = [];
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
      
      // Initialize usedCardsThisTurn for the next player if not exists
      if (gameState.players[nextPlayer] && !gameState.players[nextPlayer].usedCardsThisTurn) {
        gameState.players[nextPlayer].usedCardsThisTurn = [];
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
        // Found a non-eliminated player
        // Initialize usedCardsThisTurn for the next player if not exists
        if (gameState.players[nextPlayer] && !gameState.players[nextPlayer].usedCardsThisTurn) {
          gameState.players[nextPlayer].usedCardsThisTurn = [];
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

    // Reset usedCardsThisTurn for the current player when their turn ends
    if (gameState.players[currentPlayerName]) {
      gameState.players[currentPlayerName].usedCardsThisTurn = [];
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
      
      // Initialize usedCardsThisTurn for the next player if not exists
      if (gameState.players[nextPlayer] && !gameState.players[nextPlayer].usedCardsThisTurn) {
        gameState.players[nextPlayer].usedCardsThisTurn = [];
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
        // Found a non-eliminated player
        // Initialize usedCardsThisTurn for the next player if not exists
        if (gameState.players[nextPlayer] && !gameState.players[nextPlayer].usedCardsThisTurn) {
          gameState.players[nextPlayer].usedCardsThisTurn = [];
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
    
    // CPU AUTO-DEFENSE: Immediately resolve for CPU players (they can't show DefenseDialog)
    if (defender?.isCPU || pendingDefense.defender.startsWith('CPU-')) {
      console.log(`🤖 CPU defender detected: ${pendingDefense.defender} - auto-resolving defense with defends=false`);
      
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
    const { attacker, defender, targetCardId, mosseCardId, damage, isHandTarget } = pendingDefense;

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
      await this.processMosseDamage(gameId, attacker, targetCardId, damage, mosseCardId, io, false, isHandTarget || false);
      
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

  // EXTRACTED AND HARDENED: Damage processing method (preserves ALL legacy logic + BAMBOLA VOODOO + ATTACCO DISONESTO)
  async processMosseDamage(gameId: string, attackerName: string, targetCardId: string, damageValue: number, mosseCardId: string, io: any, isVoodooReflection: boolean = false, isHandTarget: boolean = false): Promise<void> {
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

    // PRESERVE: Extract current PTI from card notes (exact legacy logic)
    const currentNotes = targetCard.text || '';
    const ptiMatch = currentNotes.match(/PTI:\s*(\d+)/i);
    let currentPTI = ptiMatch ? parseInt(ptiMatch[1]) : 0;

    // PRESERVE: Calculate new PTI after damage
    const newPTI = Math.max(0, currentPTI - damageValue);

    // PRESERVE: Update card notes with new PTI
    let updatedNotes = currentNotes;
    if (ptiMatch) {
      updatedNotes = currentNotes.replace(/PTI:\s*\d+/i, `PTI: ${newPTI}`);
    } else {
      updatedNotes = currentNotes ? `${currentNotes}\nPTI: ${newPTI}` : `PTI: ${newPTI}`;
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
    
    console.log(`${isHandTarget ? '🎯 ATTACCO DISONESTO: ' : ''}${targetOwner}'s ${targetCard.frontImage} took ${damageValue} damage: ${currentPTI} → ${newPTI} PTI`);
    
    // PRESERVE: Mark action as completed for CPU turn flow
    if (attackerName.startsWith('CPU-')) {
      console.log(`MOSSE action completed for CPU ${attackerName}`);
    }
    
    // PRESERVE: Broadcast the damage result
    io.to(gameId).emit('chat-message', {
      id: `${Date.now()}-damage`,
      playerName: 'Sistema',
      message: `⚔️ ${attackerName} attacca ${targetCard.owner}! Danno: ${damageValue} | PTI: ${currentPTI} → ${newPTI}`,
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
            deadCard.eliminatedBy = attackerName;
            game?.graveyard?.push(deadCard);
            console.log(`🎯 ATTACCO DISONESTO: ${targetCard.frontImage} di ${targetOwner} è morto e va nel cimitero`);
          }
        }
      } else {
        // Regular field death: move to graveyard with attacker info for SOROS activation
        const result = this.moveToGraveyard(gameId, targetCardId, targetOwner, attackerName);
        
        // HANDLE SOROS ACTIVATION
        if (result.sorosActivated && result.sorosImage && result.sorosActivator) {
          console.log(`🎭 SOROS ACTIVATED! Broadcasting to all players in room ${gameId}`);
          io.to(gameId).emit('soros-activated', {
            activator: result.sorosActivator,
            cardImage: result.sorosImage
          });
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

    // Get all non-CPU players who are not eliminated
    const activePlayers = Object.keys(game.players)
      .filter(playerName => 
        !game.players[playerName].isCPU && 
        !game.eliminatedPlayers.has(playerName)
      );

    // If only one active player remains, they win
    if (activePlayers.length === 1) {
      // Mark game as ended to prevent multiple victory notifications
      game.gameEnded = true;
      console.log(`Game victory declared for ${activePlayers[0]} - game marked as ended`);
      return activePlayers[0];
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
