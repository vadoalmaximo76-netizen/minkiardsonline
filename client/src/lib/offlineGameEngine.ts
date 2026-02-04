import { CARD_DATA } from './cardData';

interface CardModification {
  cardId: string;
  name?: string;
  effect?: string;
  pti?: number;
  stars?: number;
  mosseDamageValue?: number;
  mosseCanCounter?: boolean;
  mosseCanBeCountered?: boolean;
}

function getStoredModifications(): CardModification[] {
  try {
    const stored = localStorage.getItem('minkiards_card_modifications');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export interface OfflineCard {
  id: string;
  type: 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali';
  frontImage: string;
  owner?: string;
  isFaceUp?: boolean;
  pti?: number;
  currentPti?: number;
  stars?: number;
  name?: string;
  effect?: string;
  mosseDamageValue?: number;
  mosseCanCounter?: boolean;
  mosseCanBeCountered?: boolean;
  eliminatedBy?: string;
}

export interface OfflinePlayer {
  name: string;
  hand: OfflineCard[];
  isCPU: boolean;
  avatar?: string;
}

export interface GameMessage {
  id: string;
  playerName: string;
  message: string;
  timestamp: number;
  type?: 'info' | 'attack' | 'damage' | 'elimination' | 'victory' | 'draw';
}

export interface OfflineGameState {
  players: { [key: string]: OfflinePlayer };
  decks: {
    personaggi: OfflineCard[];
    mosse: OfflineCard[];
    bonus: OfflineCard[];
    personaggi_speciali: OfflineCard[];
  };
  field: OfflineCard[];
  graveyard: OfflineCard[];
  turnOrder: string[];
  currentTurnIndex: number;
  isPlaying: boolean;
  gameEnded: boolean;
  winner?: string;
  messages: GameMessage[];
  turnNumber: number;
}

export type GameEventType = 
  | 'state-update'
  | 'card-drawn'
  | 'card-played'
  | 'attack'
  | 'damage-dealt'
  | 'character-eliminated'
  | 'turn-changed'
  | 'game-over'
  | 'message';

export interface GameEvent {
  type: GameEventType;
  data: any;
}

type EventListener = (event: GameEvent) => void;

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getCardNameFromUrl(url: string): string {
  try {
    const match = url.match(/\/([^\/]+)\.(png|jpg|jpeg|gif|webp)$/i);
    if (match) {
      return match[1].replace(/-/g, ' ').replace(/_/g, ' ').toUpperCase();
    }
  } catch (e) {}
  return 'Carta';
}

function createCard(url: string, type: OfflineCard['type'], index: number, modifications: CardModification[]): OfflineCard {
  const cardId = `${type}-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const name = getCardNameFromUrl(url);
  
  const mod = modifications.find(m => m.cardId === `${type}-${index}`);
  
  const card: OfflineCard = {
    id: cardId,
    type,
    frontImage: url,
    name: mod?.name || name,
    isFaceUp: false,
  };

  if (type === 'personaggi') {
    const basePti = mod?.pti ?? Math.floor(Math.random() * 1200) + 500;
    card.pti = basePti;
    card.currentPti = basePti;
    card.stars = mod?.stars ?? Math.floor(Math.random() * 4) + 1;
  } else if (type === 'personaggi_speciali') {
    const basePti = mod?.pti ?? Math.floor(Math.random() * 1500) + 800;
    card.pti = basePti;
    card.currentPti = basePti;
    card.stars = mod?.stars ?? Math.floor(Math.random() * 4) + 2;
  } else if (type === 'mosse') {
    card.mosseDamageValue = mod?.mosseDamageValue ?? Math.floor(Math.random() * 120) + 30;
    card.mosseCanCounter = mod?.mosseCanCounter ?? Math.random() > 0.7;
    card.mosseCanBeCountered = mod?.mosseCanBeCountered ?? Math.random() > 0.5;
  }

  if (mod?.effect) {
    card.effect = mod.effect;
  }

  return card;
}

export class OfflineGameEngine {
  private state: OfflineGameState;
  private listeners: Map<GameEventType | '*', Set<EventListener>> = new Map();
  private playerName: string;
  private cpuName: string;

  constructor(playerName: string, cpuName: string = 'CPU') {
    this.playerName = playerName;
    this.cpuName = cpuName;
    this.state = this.createInitialState();
  }

  private createInitialState(): OfflineGameState {
    const modifications = getStoredModifications();
    
    const personaggiCards = (CARD_DATA.personaggi || []).map((url, i) => createCard(url, 'personaggi', i, modifications));
    const mosseCards = (CARD_DATA.mosse || []).map((url, i) => createCard(url, 'mosse', i, modifications));
    const bonusCards = (CARD_DATA.bonus || []).map((url, i) => createCard(url, 'bonus', i, modifications));
    const specialiCards = (CARD_DATA.personaggi_speciali || []).map((url, i) => createCard(url, 'personaggi_speciali', i, modifications));

    return {
      players: {
        [this.playerName]: {
          name: this.playerName,
          hand: [],
          isCPU: false,
          avatar: 'warrior',
        },
        [this.cpuName]: {
          name: this.cpuName,
          hand: [],
          isCPU: true,
          avatar: 'robot',
        },
      },
      decks: {
        personaggi: shuffleArray(personaggiCards),
        mosse: shuffleArray(mosseCards),
        bonus: shuffleArray(bonusCards),
        personaggi_speciali: shuffleArray(specialiCards),
      },
      field: [],
      graveyard: [],
      turnOrder: [this.playerName, this.cpuName],
      currentTurnIndex: 0,
      isPlaying: false,
      gameEnded: false,
      messages: [],
      turnNumber: 1,
    };
  }

  on(eventType: GameEventType | '*', listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
    
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  off(eventType: GameEventType | '*', listener: EventListener): void {
    this.listeners.get(eventType)?.delete(listener);
  }

  private emit(event: GameEvent): void {
    this.listeners.get(event.type)?.forEach(listener => listener(event));
    this.listeners.get('*')?.forEach(listener => listener(event));
  }

  private addMessage(message: string, playerName: string = 'Sistema', type: GameMessage['type'] = 'info'): void {
    const msg: GameMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      playerName,
      message,
      timestamp: Date.now(),
      type,
    };
    this.state.messages.push(msg);
    this.emit({ type: 'message', data: msg });
  }

  private emitStateUpdate(): void {
    this.emit({ type: 'state-update', data: this.getState() });
  }

  getState(): OfflineGameState {
    return { ...this.state };
  }

  getCurrentPlayer(): string {
    return this.state.turnOrder[this.state.currentTurnIndex];
  }

  isPlayerTurn(playerName?: string): boolean {
    const name = playerName || this.playerName;
    return this.getCurrentPlayer() === name;
  }

  startGame(): OfflineGameState {
    this.state.isPlaying = true;
    this.state.gameEnded = false;
    this.state.winner = undefined;
    this.state.turnNumber = 1;
    this.state.currentTurnIndex = 0;
    
    this.addMessage('Partita iniziata! Pesca le tue carte.', 'Sistema', 'info');
    this.addMessage(`È il turno di ${this.getCurrentPlayer()}`, 'Sistema', 'info');
    
    this.emitStateUpdate();
    return this.getState();
  }

  drawCard(playerName: string, deckType: keyof OfflineGameState['decks']): { state: OfflineGameState; card: OfflineCard | null } {
    if (!this.state.isPlaying || this.state.gameEnded) {
      return { state: this.getState(), card: null };
    }

    const deck = this.state.decks[deckType];
    if (deck.length === 0) {
      this.addMessage(`Il mazzo ${deckType.toUpperCase()} è vuoto!`, 'Sistema', 'info');
      return { state: this.getState(), card: null };
    }

    const card = deck.shift()!;
    card.owner = playerName;
    card.isFaceUp = true;

    const player = this.state.players[playerName];
    if (player) {
      player.hand.push(card);
    }

    this.addMessage(`${playerName} ha pescato una carta ${deckType.toUpperCase()}`, 'Sistema', 'draw');
    
    this.emit({ type: 'card-drawn', data: { playerName, card, deckType } });
    this.emitStateUpdate();

    return { state: this.getState(), card };
  }

  playCard(playerName: string, cardId: string): OfflineGameState {
    if (!this.state.isPlaying || this.state.gameEnded) {
      return this.getState();
    }

    const player = this.state.players[playerName];
    if (!player) return this.getState();

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return this.getState();

    const card = player.hand.splice(cardIndex, 1)[0];
    card.owner = playerName;
    card.isFaceUp = true;
    
    if (card.type === 'personaggi' || card.type === 'personaggi_speciali') {
      card.currentPti = card.pti;
    }
    
    this.state.field.push(card);

    this.addMessage(`${playerName} ha giocato ${card.name || 'una carta'} in campo`, 'Sistema', 'info');
    
    this.emit({ type: 'card-played', data: { playerName, card } });
    this.emitStateUpdate();

    return this.getState();
  }

  attack(attackerName: string, mosseCardId: string, targetCardId: string, attackerCardId?: string): OfflineGameState {
    if (!this.state.isPlaying || this.state.gameEnded) {
      return this.getState();
    }

    const attacker = this.state.players[attackerName];
    if (!attacker) return this.getState();

    const mosseIndex = attacker.hand.findIndex(c => c.id === mosseCardId);
    if (mosseIndex === -1) return this.getState();

    const mosseCard = attacker.hand[mosseIndex];
    const targetCard = this.state.field.find(c => c.id === targetCardId);
    
    if (!targetCard || targetCard.owner === attackerName) {
      this.addMessage('Bersaglio non valido!', 'Sistema', 'info');
      return this.getState();
    }

    if (targetCard.type !== 'personaggi' && targetCard.type !== 'personaggi_speciali') {
      this.addMessage('Puoi attaccare solo carte PERSONAGGI!', 'Sistema', 'info');
      return this.getState();
    }

    let attackerStars = 1;
    if (attackerCardId) {
      const attackerCard = this.state.field.find(c => c.id === attackerCardId && c.owner === attackerName);
      if (attackerCard && attackerCard.stars) {
        attackerStars = attackerCard.stars;
      }
    } else {
      const attackerCharacter = this.state.field.find(
        c => c.owner === attackerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
      );
      if (attackerCharacter && attackerCharacter.stars) {
        attackerStars = attackerCharacter.stars;
      }
    }

    const baseDamage = mosseCard.mosseDamageValue || 50;
    const totalDamage = baseDamage * attackerStars;
    const currentPti = targetCard.currentPti || targetCard.pti || 0;
    const newPti = Math.max(0, currentPti - totalDamage);
    targetCard.currentPti = newPti;

    attacker.hand.splice(mosseIndex, 1);
    this.state.graveyard.push(mosseCard);

    this.addMessage(
      `${attackerName} attacca ${targetCard.name || 'il personaggio'} con ${mosseCard.name}! Danno: ${totalDamage} PTI (${baseDamage} x ${attackerStars} stelle)`,
      'Sistema',
      'attack'
    );

    this.emit({ 
      type: 'attack', 
      data: { 
        attackerName, 
        mosseCard, 
        targetCard, 
        damage: totalDamage,
        attackerStars 
      } 
    });

    this.emit({
      type: 'damage-dealt',
      data: {
        targetCardId,
        damage: totalDamage,
        remainingPti: newPti
      }
    });

    if (newPti <= 0) {
      this.eliminateCharacter(targetCard, attackerName);
    }

    this.emitStateUpdate();
    return this.getState();
  }

  private eliminateCharacter(card: OfflineCard, eliminatedBy: string): void {
    card.eliminatedBy = eliminatedBy;
    this.state.field = this.state.field.filter(c => c.id !== card.id);
    this.state.graveyard.push(card);

    this.addMessage(
      `${card.name || 'Il personaggio'} di ${card.owner} è stato eliminato!`,
      'Sistema',
      'elimination'
    );

    this.emit({ type: 'character-eliminated', data: { card, eliminatedBy } });

    this.checkWinCondition();
  }

  private checkWinCondition(): void {
    for (const playerName of this.state.turnOrder) {
      const hasCharactersOnField = this.state.field.some(
        c => c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
      );
      
      const hasCharactersInHand = this.state.players[playerName]?.hand.some(
        c => c.type === 'personaggi' || c.type === 'personaggi_speciali'
      );
      
      const canDrawCharacter = this.state.decks.personaggi.length > 0 || 
                               this.state.decks.personaggi_speciali.length > 0;
      
      if (this.state.turnNumber > 3 && !hasCharactersOnField && !hasCharactersInHand && !canDrawCharacter) {
        const winner = this.state.turnOrder.find(p => p !== playerName)!;
        this.state.gameEnded = true;
        this.state.winner = winner;
        this.state.isPlaying = false;
        
        this.addMessage(`${winner} ha vinto la partita!`, 'Sistema', 'victory');
        this.emit({ type: 'game-over', data: { winner, loser: playerName } });
      }
    }
  }

  endTurn(): OfflineGameState {
    if (!this.state.isPlaying || this.state.gameEnded) {
      return this.getState();
    }

    const previousPlayer = this.getCurrentPlayer();
    this.state.currentTurnIndex = (this.state.currentTurnIndex + 1) % this.state.turnOrder.length;
    
    if (this.state.currentTurnIndex === 0) {
      this.state.turnNumber++;
    }
    
    const nextPlayer = this.getCurrentPlayer();
    this.addMessage(`Fine turno di ${previousPlayer}. Turno di ${nextPlayer}`, 'Sistema', 'info');

    this.emit({ type: 'turn-changed', data: { previousPlayer, nextPlayer, turnNumber: this.state.turnNumber } });
    this.emitStateUpdate();

    return this.getState();
  }

  useBonus(playerName: string, bonusCardId: string, targetCardId?: string): OfflineGameState {
    if (!this.state.isPlaying || this.state.gameEnded) {
      return this.getState();
    }

    const player = this.state.players[playerName];
    if (!player) return this.getState();

    const cardIndex = player.hand.findIndex(c => c.id === bonusCardId);
    if (cardIndex === -1) return this.getState();

    const bonusCard = player.hand.splice(cardIndex, 1)[0];
    
    const cardName = (bonusCard.name || '').toUpperCase();

    if (cardName.includes('MEDICINA') || cardName.includes('CURA')) {
      if (targetCardId) {
        const targetCard = this.state.field.find(c => c.id === targetCardId && c.owner === playerName);
        if (targetCard && (targetCard.type === 'personaggi' || targetCard.type === 'personaggi_speciali')) {
          const healAmount = Math.floor(Math.random() * 300) + 100;
          const maxPti = targetCard.pti || 1000;
          targetCard.currentPti = Math.min(maxPti, (targetCard.currentPti || 0) + healAmount);
          this.addMessage(`${bonusCard.name} ha curato ${targetCard.name} di ${healAmount} PTI!`, 'Sistema', 'info');
        }
      }
    } else if (cardName.includes('DOPING') || cardName.includes('POTENZIAMENTO')) {
      if (targetCardId) {
        const targetCard = this.state.field.find(c => c.id === targetCardId && c.owner === playerName);
        if (targetCard && targetCard.stars) {
          targetCard.stars = Math.min(5, targetCard.stars + 1);
          this.addMessage(`${bonusCard.name} ha potenziato ${targetCard.name}! +1 Stella`, 'Sistema', 'info');
        }
      }
    } else {
      this.addMessage(`${playerName} ha usato ${bonusCard.name || 'una carta bonus'}!`, 'Sistema', 'info');
    }
    
    this.state.graveyard.push(bonusCard);
    this.emitStateUpdate();

    return this.getState();
  }

  getPlayerHand(playerName: string): OfflineCard[] {
    return this.state.players[playerName]?.hand || [];
  }

  getFieldCards(): OfflineCard[] {
    return this.state.field;
  }

  getPlayerCharactersOnField(playerName: string): OfflineCard[] {
    return this.state.field.filter(
      c => c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
    );
  }

  getEnemyCharactersOnField(playerName: string): OfflineCard[] {
    return this.state.field.filter(
      c => c.owner !== playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
    );
  }

  getDeckCount(deckType: keyof OfflineGameState['decks']): number {
    return this.state.decks[deckType].length;
  }

  reset(): void {
    this.state = this.createInitialState();
    this.emitStateUpdate();
  }
}

export function createOfflineGame(playerName: string, cpuName: string = 'CPU'): OfflineGameState {
  const engine = new OfflineGameEngine(playerName, cpuName);
  return engine.getState();
}

export function drawCard(
  state: OfflineGameState,
  playerName: string,
  deckType: keyof OfflineGameState['decks']
): { state: OfflineGameState; card: OfflineCard | null } {
  const deck = state.decks[deckType];
  if (deck.length === 0) {
    return { state, card: null };
  }

  const card = deck.shift()!;
  card.owner = playerName;
  card.isFaceUp = true;
  
  if (card.type === 'personaggi' || card.type === 'personaggi_speciali') {
    card.currentPti = card.pti;
  }

  const player = state.players[playerName];
  if (player) {
    player.hand.push(card);
  }

  state.messages.push({
    id: `msg-${Date.now()}`,
    playerName: 'Sistema',
    message: `${playerName} ha pescato una carta ${deckType.toUpperCase()}`,
    timestamp: Date.now(),
  });

  return { state: { ...state }, card };
}

export function playCardToField(
  state: OfflineGameState,
  playerName: string,
  cardId: string
): OfflineGameState {
  const player = state.players[playerName];
  if (!player) return state;

  const cardIndex = player.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return state;

  const card = player.hand.splice(cardIndex, 1)[0];
  card.owner = playerName;
  card.isFaceUp = true;
  
  if (card.type === 'personaggi' || card.type === 'personaggi_speciali') {
    card.currentPti = card.pti;
  }
  
  state.field.push(card);

  state.messages.push({
    id: `msg-${Date.now()}`,
    playerName: 'Sistema',
    message: `${playerName} ha giocato ${card.name || 'una carta'} in campo`,
    timestamp: Date.now(),
  });

  return { ...state };
}

export function attackWithMosse(
  state: OfflineGameState,
  attackerName: string,
  mosseCardId: string,
  targetCardId: string,
  attackerCardId?: string
): OfflineGameState {
  const attacker = state.players[attackerName];
  if (!attacker) return state;

  const mosseIndex = attacker.hand.findIndex(c => c.id === mosseCardId);
  if (mosseIndex === -1) return state;

  const mosseCard = attacker.hand[mosseIndex];
  const targetCard = state.field.find(c => c.id === targetCardId);
  
  if (!targetCard || targetCard.owner === attackerName) return state;

  let attackerStars = 1;
  if (attackerCardId) {
    const attackerCharacter = state.field.find(c => c.id === attackerCardId);
    if (attackerCharacter?.stars) {
      attackerStars = attackerCharacter.stars;
    }
  } else {
    const attackerCharacter = state.field.find(
      c => c.owner === attackerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
    );
    if (attackerCharacter?.stars) {
      attackerStars = attackerCharacter.stars;
    }
  }

  const baseDamage = mosseCard.mosseDamageValue || 50;
  const totalDamage = baseDamage * attackerStars;
  const currentPti = targetCard.currentPti || targetCard.pti || 0;
  const newPti = Math.max(0, currentPti - totalDamage);
  targetCard.currentPti = newPti;

  attacker.hand.splice(mosseIndex, 1);
  state.graveyard.push(mosseCard);

  state.messages.push({
    id: `msg-${Date.now()}`,
    playerName: 'Sistema',
    message: `${attackerName} attacca ${targetCard.name || 'il personaggio'} con ${mosseCard.name}! Danno: ${totalDamage} PTI (${baseDamage} x ${attackerStars} stelle)`,
    timestamp: Date.now(),
  });

  if (newPti <= 0) {
    state.field = state.field.filter(c => c.id !== targetCardId);
    targetCard.eliminatedBy = attackerName;
    state.graveyard.push(targetCard);

    state.messages.push({
      id: `msg-${Date.now()}`,
      playerName: 'Sistema',
      message: `${targetCard.name || 'Il personaggio'} di ${targetCard.owner} è stato eliminato!`,
      timestamp: Date.now(),
    });

    const targetOwner = targetCard.owner;
    if (targetOwner) {
      const hasCharactersLeft = state.field.some(
        c => c.owner === targetOwner && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
      );
      const hasCharactersInHand = state.players[targetOwner]?.hand.some(
        c => c.type === 'personaggi' || c.type === 'personaggi_speciali'
      );
      
      if (!hasCharactersLeft && !hasCharactersInHand && state.turnNumber > 2) {
        state.gameEnded = true;
        state.winner = attackerName;
        state.messages.push({
          id: `msg-${Date.now()}`,
          playerName: 'Sistema',
          message: `${attackerName} ha vinto la partita!`,
          timestamp: Date.now(),
        });
      }
    }
  }

  return { ...state };
}

export function endTurn(state: OfflineGameState): OfflineGameState {
  state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
  
  if (state.currentTurnIndex === 0) {
    state.turnNumber = (state.turnNumber || 1) + 1;
  }
  
  const nextPlayer = state.turnOrder[state.currentTurnIndex];
  state.messages.push({
    id: `msg-${Date.now()}`,
    playerName: 'Sistema',
    message: `Turno di ${nextPlayer}`,
    timestamp: Date.now(),
  });

  return { ...state };
}

export function getCurrentPlayerName(state: OfflineGameState): string {
  return state.turnOrder[state.currentTurnIndex];
}

export function isPlayerTurn(state: OfflineGameState, playerName: string): boolean {
  return getCurrentPlayerName(state) === playerName;
}
