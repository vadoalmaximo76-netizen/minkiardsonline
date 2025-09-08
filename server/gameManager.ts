import { CARD_DATA, DECK_BACK_IMAGES, SCENARIO_CARDS } from '../client/src/lib/cardData';

interface Card {
  id: string;
  type: string;
  frontImage: string;
  backImage: string;
  owner: string;
  text?: string;
  eliminatedBy?: string;
}

interface Player {
  name: string;
  hand: Card[];
  socketId: string;
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
      scenarioCardsActive: false
    };

    // Auto-shuffle all decks when starting a new game
    this.shuffleGameDecks(gameState);
    
    return gameState;
  }

  addPlayer(gameId: string, playerName: string, socketId: string): void {
    if (!this.games.has(gameId)) {
      this.games.set(gameId, this.initializeGame(gameId));
    }

    const game = this.games.get(gameId)!;
    game.players[playerName] = {
      name: playerName,
      hand: [],
      socketId
    };

    this.playerToGame.set(socketId, gameId);
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

  shuffleDeck(gameId: string, deckType: keyof GameState['decks']): void {
    const game = this.games.get(gameId);
    if (!game) return;

    const deck = game.decks[deckType];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  pickCard(gameId: string, deckType: keyof GameState['decks'], playerName: string): boolean {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return false;

    const deck = game.decks[deckType];
    if (deck.length === 0) return false;

    const card = deck.pop()!;
    card.owner = playerName;
    game.players[playerName].hand.push(card);

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

  playCard(gameId: string, cardId: string, playerName: string): void {
    const game = this.games.get(gameId);
    if (!game || !game.players[playerName]) return;

    const player = game.players[playerName];
    const cardIndex = player.hand.findIndex(card => card.id === cardId);
    
    if (cardIndex !== -1) {
      const card = player.hand.splice(cardIndex, 1)[0];
      game.field.push(card);
    }
  }

  returnToHand(gameId: string, cardId: string, playerName: string): void {
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
      game.decks[deckType].push(card);
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

  transferCard(gameId: string, cardId: string, fromPlayer: string, toPlayer: string): void {
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
    }
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
}
