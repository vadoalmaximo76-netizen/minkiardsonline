import { CARD_DATA, DECK_BACK_IMAGES, SCENARIO_CARDS } from '../client/src/lib/cardData';
import { db } from './db';
import { matches, gameEvents, personaggi, type InsertMatch, type InsertGameEvent } from '../shared/schema';
import { eq, ilike } from 'drizzle-orm';
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
}

interface Player {
  name: string;
  hand: Card[];
  socketId: string | null;
  isCPU?: boolean;
  cpuInstance?: CPUPlayer;
  usedCardsThisTurn?: string[]; // Track card images used this turn to prevent reuse
  disconnectedAt?: Date; // When player disconnected (null if connected)
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
      eliminatedPlayers: new Set<string>()
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
      eliminatedPlayers: Array.from(gameState.eliminatedPlayers) // Convert Set to Array for JSON serialization
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

  // Pick a card and return the card object (for cases where the card is needed immediately)
  async pickCardAndReturn(gameId: string, deckType: keyof GameState['decks'], playerName: string): Promise<Card | null> {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return null;

    const deck = game.decks[deckType];
    if (deck.length === 0) return null;

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
      
      // Auto-analyze cards for ALL players (PERSONAGGI only)
      if (isPersonaggio && (!card.text || card.text.trim() === '')) {
        // Trigger automatic analysis for PERSONAGGI cards (both CPU and human players)
        await this.autoAnalyzePersonaggioCard(gameId, card, playerName);
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

  // FUSION SYSTEM FOR PERSONAGGI CARDS
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

      // Only PERSONAGGI cards can be fused
      if (leaderCard.type !== 'personaggi' || targetCard.type !== 'personaggi') {
        return { success: false, message: 'Only PERSONAGGI cards can be fused' };
      }

      // Check if cards are already fused
      if (leaderCard.isFused || targetCard.isFused) {
        return { success: false, message: 'One or both cards are already fused' };
      }

      // Transfer target card ownership to the player initiating fusion
      targetCard.owner = playerName;

      // Set up fusion relationship
      leaderCard.isFused = true;
      leaderCard.fusedWith = [targetCardId];
      leaderCard.fusionLeader = leaderCardId;

      targetCard.isFused = true;
      targetCard.fusedWith = [leaderCardId];
      targetCard.fusionLeader = leaderCardId;

      // Merge text notes (PTI and stars)
      const mergedText = this.mergeCardNotes(leaderCard.text || '', targetCard.text || '');
      leaderCard.text = mergedText;
      targetCard.text = mergedText;

      // Record fusion event
      await this.recordEvent(gameId, 'fuse-cards', {
        leaderCardId,
        targetCardId,
        leaderImage: leaderCard.frontImage,
        targetImage: targetCard.frontImage,
        newOwner: playerName
      }, playerName);

      console.log(`Cards fused: ${leaderCardId} + ${targetCardId} by ${playerName}`);
      return { success: true };

    } catch (error) {
      console.error('Error fusing cards:', error);
      return { success: false, message: 'Error during fusion' };
    }
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

  moveToGraveyard(gameId: string, cardId: string, playerName: string): { success: boolean, graveyardCount?: number, cardImage?: string, eliminationCheck?: boolean } {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    // Find card in field
    const cardIndex = game.field.findIndex(card => card.id === cardId);
    if (cardIndex !== -1) {
      const card = game.field.splice(cardIndex, 1)[0];
      if (card.owner === playerName) {
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

        return { success: true, graveyardCount, cardImage: card.frontImage, eliminationCheck };
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
      // Get player's cards from game field
      const playerCardsOnField = game.field.filter(card => card.owner === playerName && card.type === 'personaggi');
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

    // Find PERSONAGGIO card on field
    const personaggioCard = game.field.find(card => card.owner === fromPlayer && card.type === 'personaggi');
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
      // Get player's field cards from game.field
      const playerFieldCards = game.field.filter(card => card.owner === playerName && card.type === 'personaggi');
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
    if (finalPTI === 0 && card.type === 'personaggi') {
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
    console.log(`Player ${playerName} marked as eliminated`);
    return true;
  }

  checkForGameVictory(gameId: string): string | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    // Get all non-CPU players who are not eliminated
    const activePlayers = Object.keys(game.players)
      .filter(playerName => 
        !game.players[playerName].isCPU && 
        !game.eliminatedPlayers.has(playerName)
      );

    // If only one active player remains, they win
    if (activePlayers.length === 1) {
      return activePlayers[0];
    }

    return null;
  }
}
