import { CARD_DATA, DECK_BACK_IMAGES, SCENARIO_CARDS } from '../client/src/lib/cardData';
import { db } from './db';
import { matches, gameEvents, type InsertMatch, type InsertGameEvent } from '../shared/schema';
import { eq } from 'drizzle-orm';
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
}

interface Player {
  name: string;
  hand: Card[];
  socketId: string;
  isCPU?: boolean;
  cpuInstance?: CPUPlayer;
  usedCardsThisTurn?: string[]; // Track card images used this turn to prevent reuse
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
}

export class GameManager {
  private games: Map<string, GameState> = new Map();
  private playerToGame: Map<string, string> = new Map();

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
      spectators: []
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
      return await this.swapPersonaggiCards(gameId, playerName, instruction);
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
      return await this.resetGame(gameId, playerName, instruction);
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

      const prompt = `Analizza questa istruzione per un gioco di carte italiano chiamato MINKIARDS: "${instruction}"

Determina l'azione richiesta e rispondi in formato JSON:

Azioni supportate:
1. "reverse-turns" - invertire l'ordine dei turni
2. "distribute-cards" - far pescare carte ai giocatori (include numero e tipo: personaggi, mosse, bonus, personaggi_speciali)
3. "cover-cards" - coprire tutte le carte in campo
4. "uncover-cards" - scoprire tutte le carte in campo
5. "unknown" - se non riconosci l'azione

Formato risposta:
{
  "action": "distribute-cards",
  "parameters": {
    "count": 3,
    "cardType": "mosse",
    "target": "all"
  }
}

o per azioni senza parametri:
{
  "action": "reverse-turns"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 200
      });

      const aiResponse = JSON.parse(response.choices[0].message.content || '{"action": "unknown"}');

      switch (aiResponse.action) {
        case 'reverse-turns':
          return await this.reverseTurnOrder(gameId, playerName, instruction);
          
        case 'distribute-cards':
          const { count = 1, cardType = 'mosse' } = aiResponse.parameters || {};
          return await this.distributeCards(gameId, playerName, instruction, count, cardType);
          
        case 'cover-cards':
          return await this.coverAllCards(gameId, playerName, instruction);
          
        case 'uncover-cards':
          return await this.uncoverAllCards(gameId, playerName, instruction);
          
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
    
    if (typeof game.currentPlayerIndex !== 'number') {
      game.currentPlayerIndex = 0;
    }
    game.currentPlayerIndex = reversedOrder.length - 1 - game.currentPlayerIndex;
    
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

    game.field.forEach(card => {
      card.faceDown = false;
    });

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'uncover-field-cards'
    }, playerName);

    console.log(`Game instruction executed: Uncovered all field cards for game ${gameId}`);
    return { 
      message: `👁️ ${playerName} ha scoperto tutte le carte in campo! Le carte sono ora visibili.`
    };
  }

  private async distributeCards(gameId: string, playerName: string, instruction: string, count: number, deckType: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const normalizedDeckType = deckType.toLowerCase().replace(' ', '_') as keyof GameState['decks'];

    // Validate deck type
    if (!game.decks[normalizedDeckType]) {
      throw new Error(`Tipo di carta non valido: ${deckType}`);
    }

    // Distribute cards to all players
    for (const playerName of Object.keys(game.players)) {
      for (let i = 0; i < count; i++) {
        this.pickCard(gameId, normalizedDeckType, playerName);
      }
    }

    await this.recordEvent(gameId, 'instruction-executed', {
      instruction,
      action: 'distribute-cards',
      cardCount: count,
      deckType: normalizedDeckType
    }, playerName);

    console.log(`Game instruction executed: Distributed ${count} ${deckType} cards to all players`);
    return { 
      message: `🎴 ${playerName} ha fatto pescare ${count} carte ${deckType.toUpperCase()} a tutti i giocatori!`
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

  private async completeMatch(gameId: string, winnerPlayer?: string): Promise<void> {
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

    } catch (error) {
      console.error('Failed to complete match:', error);
    }
  }

  removePlayer(socketId: string): void {
    const gameId = this.playerToGame.get(socketId);
    if (gameId) {
      const game = this.games.get(gameId);
      if (game) {
        // Find and remove player
        for (const [playerName, player] of Object.entries(game.players)) {
          if (player.socketId === socketId) {
            delete game.players[playerName];
            break;
          }
        }
      }
      this.playerToGame.delete(socketId);
    }
  }

  getPlayerGameId(socketId: string): string | undefined {
    return this.playerToGame.get(socketId);
  }

  getGameState(gameId: string): GameState | null {
    return this.games.get(gameId) || null;
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
      spectators: gameState.spectators
    };

    // Sanitize players by removing cpuInstance references
    for (const [playerName, player] of Object.entries(gameState.players)) {
      sanitized.players[playerName] = {
        name: player.name,
        hand: player.hand,
        socketId: player.socketId,
        isCPU: player.isCPU
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

  async playCard(gameId: string, cardId: string, playerName: string): Promise<{ card?: any, isPersonaggio?: boolean }> {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return {};

    const player = game.players[playerName];
    const cardIndex = player.hand.findIndex(card => card.id === cardId);
    
    if (cardIndex !== -1) {
      const card = player.hand.splice(cardIndex, 1)[0];
      card.faceDown = false; // Ensure face up when played normally
      game.field.push(card);
      
      // Check if it's a PERSONAGGI card
      const isPersonaggio = card.type === 'personaggi';
      
      // Auto-fill empty notes for PERSONAGGI cards
      if (isPersonaggio && (!card.text || card.text.trim() === '')) {
        card.text = 'PTI:  | Stelle:  ';
      }
      
      // Record play card event
      await this.recordEvent(gameId, 'play-card', {
        cardId: card.id,
        cardType: card.type,
        frontImage: card.frontImage,
        isPersonaggio
      }, playerName);
      
      return { card, isPersonaggio };
    }
    
    return {};
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

  moveToGraveyard(gameId: string, cardId: string, playerName: string): { success: boolean, graveyardCount?: number, cardImage?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    // Find card in field
    const cardIndex = game.field.findIndex(card => card.id === cardId);
    if (cardIndex !== -1) {
      const card = game.field.splice(cardIndex, 1)[0];
      if (card.owner === playerName) {
        card.eliminatedBy = playerName;
        game.graveyard.push(card);

        // Count cards in graveyard for this player
        const graveyardCount = game.graveyard.filter(
          graveyardCard => graveyardCard.eliminatedBy === playerName
        ).length;

        return { success: true, graveyardCount, cardImage: card.frontImage };
      }
    }
    
    return { success: false };
  }

  async transferCard(gameId: string, cardId: string, fromPlayer: string, toPlayer: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game || !game.players[fromPlayer] || !game.players[toPlayer]) return;

    // Find card in field or fromPlayer's hand
    let card: Card | undefined;
    
    // Check field
    let cardIndex = game.field.findIndex(c => c.id === cardId && c.owner === fromPlayer);
    if (cardIndex !== -1) {
      card = game.field.splice(cardIndex, 1)[0];
    } else {
      // Check fromPlayer's hand
      cardIndex = game.players[fromPlayer].hand.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        card = game.players[fromPlayer].hand.splice(cardIndex, 1)[0];
      }
    }

    if (card) {
      card.owner = toPlayer;
      game.players[toPlayer].hand.push(card);
      
      // Record transfer event
      await this.recordEvent(gameId, 'transfer-card', {
        cardId: card.id,
        cardType: card.type,
        fromPlayer,
        toPlayer,
        fromLocation: game.field.find(c => c.id === cardId) ? 'field' : 'hand'
      }, fromPlayer);
    }
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

  private getCardNameFromUrl(url: string): string {
    try {
      const parts = url.split('/');
      const filename = parts[parts.length - 1];
      return filename
        .toLowerCase()
        .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
        .replace(/-/g, ' ')
        .toUpperCase();
    } catch {
      return 'UNKNOWN CARD';
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

  async eliminatePersonaggi(gameId: string, cardId: string, playerName: string): Promise<{ success: boolean, cardImage?: string }> {
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
      
      // Record elimination event
      await this.recordEvent(gameId, 'eliminate-personaggi', {
        cardId: card.id,
        cardType: card.type,
        frontImage: card.frontImage,
        eliminatedBy: playerName
      }, playerName);

      return { success: true, cardImage: card.frontImage };
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

  startGame(gameId: string): string[] | null {
    const gameState = this.games.get(gameId);
    if (!gameState) return null;

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
    const gameState = this.games.get(gameId);
    if (!gameState || gameState.turnOrder.length === 0) return null;

    // Verify it's the current player's turn
    const currentPlayer = gameState.turnOrder[gameState.currentTurnIndex];
    if (currentPlayer !== playerName) return null;

    // Reset usedCardsThisTurn for the current player when their turn ends
    if (gameState.players[playerName]) {
      gameState.players[playerName].usedCardsThisTurn = [];
    }

    // Move to next player
    gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.turnOrder.length;
    const nextPlayer = gameState.turnOrder[gameState.currentTurnIndex];

    // Initialize usedCardsThisTurn for the next player if not exists
    if (gameState.players[nextPlayer] && !gameState.players[nextPlayer].usedCardsThisTurn) {
      gameState.players[nextPlayer].usedCardsThisTurn = [];
    }

    return nextPlayer;
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
  private async swapPersonaggiCards(gameId: string, playerName: string, instruction: string) {
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
      if (player.field && player.field.length > 0) {
        const personaggiOnField = player.field.filter(card => card.cardType === 'personaggi');
        personaggiOnField.forEach(card => {
          fieldPersonaggi.push({ player: playerName, card });
        });
      }
    }

    if (fieldPersonaggi.length < 2) {
      return { message: '❌ Servono almeno 2 PERSONAGGI in campo per lo scambio!' };
    }

    // Swap the first two PERSONAGGI found
    const card1 = fieldPersonaggi[0];
    const card2 = fieldPersonaggi[1];
    
    // Remove cards from current positions
    game.players[card1.player].field = game.players[card1.player].field.filter(c => c.cardId !== card1.card.cardId);
    game.players[card2.player].field = game.players[card2.player].field.filter(c => c.cardId !== card2.card.cardId);
    
    // Add cards to new positions
    game.players[card2.player].field.push(card1.card);
    game.players[card1.player].field.push(card2.card);

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

    // Find PERSONAGGIO card on field
    const personaggioCard = fromPlayerData.field?.find(card => card.cardType === 'personaggi');
    if (!personaggioCard) {
      return { message: `❌ ${fromPlayer} non ha PERSONAGGI in campo!` };
    }

    // Transfer the card
    fromPlayerData.field = fromPlayerData.field.filter(c => c.cardId !== personaggioCard.cardId);
    if (!toPlayerData.field) toPlayerData.field = [];
    toPlayerData.field.push(personaggioCard);

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
    
    if (player.field && player.field.length > 0) {
      removedCards.push(...player.field);
      player.field = [];
    }
    
    if (player.hand && player.hand.length > 0) {
      removedCards.push(...player.hand);
      player.hand = [];
    }

    // Add cards to graveyard
    removedCards.forEach(card => {
      game.graveyard.push({
        ...card,
        eliminatedBy: targetPlayer,
        eliminatedAt: new Date()
      });
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
      const player1 = game.players[players[i]];
      const player2 = game.players[players[i + 1]];
      
      if (player1.field && player1.field.length > 0 && player2.field && player2.field.length > 0) {
        const temp = player1.field[0];
        player1.field[0] = player2.field[0];
        player2.field[0] = temp;
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
      const card = this.drawCardFromDeck(game, cardType);
      if (card) {
        if (!player.hand) player.hand = [];
        player.hand.push(card);
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
      if (player.field) {
        player.field.forEach(card => {
          if (card.cardType === 'personaggi') {
            if (!card.notes) card.notes = '';
            card.notes = card.notes.replace(/PTI:\s*\d+/g, '').trim();
            if (card.notes) card.notes += ` | PTI: ${newPTI}`;
            else card.notes = `PTI: ${newPTI}`;
            updatedCount++;
          }
        });
      }
    }

    return { message: `⚙️ PTI di ${updatedCount} PERSONAGGI impostato a ${newPTI}!` };
  }

  private async resetGame(gameId: string, playerName: string, instruction: string) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    // Reset all player data but keep players in game
    const players = Object.keys(game.players);
    for (const player of players) {
      game.players[player] = {
        hand: [],
        field: [],
        selectedCard: null
      };
    }

    // Reset game state
    game.graveyard = [];
    game.currentPlayerIndex = 0;

    return { message: `🔄 Partita completamente resettata! Tutti i giocatori possono ricominciare.` };
  }
}
