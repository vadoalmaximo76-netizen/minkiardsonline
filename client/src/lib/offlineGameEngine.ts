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
  stars?: number;
  name?: string;
  effect?: string;
  mosseDamageValue?: number;
  mosseCanCounter?: boolean;
  mosseCanBeCountered?: boolean;
}

export interface OfflinePlayer {
  name: string;
  hand: OfflineCard[];
  isCPU: boolean;
  avatar?: string;
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
  messages: { id: string; playerName: string; message: string; timestamp: number }[];
}

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
  const cardId = `${type}-${index}`;
  const name = getCardNameFromUrl(url);
  
  const mod = modifications.find(m => m.cardId === cardId);
  
  const card: OfflineCard = {
    id: cardId,
    type,
    frontImage: url,
    name: mod?.name || name,
    isFaceUp: false,
  };

  if (type === 'personaggi') {
    card.pti = mod?.pti ?? Math.floor(Math.random() * 900) + 100;
    card.stars = mod?.stars ?? Math.floor(Math.random() * 5) + 1;
  } else if (type === 'personaggi_speciali') {
    card.pti = mod?.pti ?? Math.floor(Math.random() * 2000) + 500;
    card.stars = mod?.stars ?? Math.floor(Math.random() * 5) + 1;
  } else if (type === 'mosse') {
    card.mosseDamageValue = mod?.mosseDamageValue ?? Math.floor(Math.random() * 150) + 10;
    card.mosseCanCounter = mod?.mosseCanCounter ?? Math.random() > 0.7;
    card.mosseCanBeCountered = mod?.mosseCanBeCountered ?? Math.random() > 0.5;
  }

  if (mod?.effect) {
    card.effect = mod.effect;
  }

  return card;
}

export function createOfflineGame(playerName: string, cpuName: string = 'CPU'): OfflineGameState {
  const modifications = getStoredModifications();
  
  const personaggiCards = (CARD_DATA.personaggi || []).map((url, i) => createCard(url, 'personaggi', i, modifications));
  const mosseCards = (CARD_DATA.mosse || []).map((url, i) => createCard(url, 'mosse', i, modifications));
  const bonusCards = (CARD_DATA.bonus || []).map((url, i) => createCard(url, 'bonus', i, modifications));
  const specialiCards = (CARD_DATA.personaggi_speciali || []).map((url, i) => createCard(url, 'personaggi_speciali', i, modifications));

  return {
    players: {
      [playerName]: {
        name: playerName,
        hand: [],
        isCPU: false,
        avatar: 'warrior',
      },
      [cpuName]: {
        name: cpuName,
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
    turnOrder: [playerName, cpuName],
    currentTurnIndex: 0,
    isPlaying: true,
    gameEnded: false,
    messages: [],
  };
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
  targetCardId: string
): OfflineGameState {
  const attacker = state.players[attackerName];
  if (!attacker) return state;

  const mosseIndex = attacker.hand.findIndex(c => c.id === mosseCardId);
  if (mosseIndex === -1) return state;

  const mosseCard = attacker.hand[mosseIndex];
  const targetCard = state.field.find(c => c.id === targetCardId);
  
  if (!targetCard || targetCard.owner === attackerName) return state;

  const damage = mosseCard.mosseDamageValue || 50;
  const currentPti = targetCard.pti || 0;
  const newPti = Math.max(0, currentPti - damage);
  targetCard.pti = newPti;

  attacker.hand.splice(mosseIndex, 1);
  state.decks.mosse.push(mosseCard);

  state.messages.push({
    id: `msg-${Date.now()}`,
    playerName: 'Sistema',
    message: `${attackerName} attacca ${targetCard.name || 'il personaggio'} con ${mosseCard.name}! Danno: ${damage} PTI`,
    timestamp: Date.now(),
  });

  if (newPti <= 0) {
    state.field = state.field.filter(c => c.id !== targetCardId);
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
      
      if (!hasCharactersLeft) {
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
  
  const nextPlayer = state.turnOrder[state.currentTurnIndex];
  state.messages.push({
    id: `msg-${Date.now()}`,
    playerName: 'Sistema',
    message: `Turno di ${nextPlayer}`,
    timestamp: Date.now(),
  });

  return { ...state };
}

export function cpuTakeTurn(state: OfflineGameState, cpuName: string): OfflineGameState {
  const cpu = state.players[cpuName];
  if (!cpu || !cpu.isCPU) return state;

  const hasPersonaggio = cpu.hand.some(c => c.type === 'personaggi' || c.type === 'personaggi_speciali');
  const hasPersonaggioOnField = state.field.some(
    c => c.owner === cpuName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
  );
  const hasMosse = cpu.hand.some(c => c.type === 'mosse');

  if (!hasPersonaggio && !hasPersonaggioOnField) {
    const result = drawCard(state, cpuName, 'personaggi');
    state = result.state;
  }

  if (!hasPersonaggioOnField) {
    const personaggio = cpu.hand.find(c => c.type === 'personaggi' || c.type === 'personaggi_speciali');
    if (personaggio) {
      state = playCardToField(state, cpuName, personaggio.id);
    }
  }

  if (!hasMosse) {
    const result = drawCard(state, cpuName, 'mosse');
    state = result.state;
  }

  const mosseCard = cpu.hand.find(c => c.type === 'mosse');
  const enemyTarget = state.field.find(
    c => c.owner !== cpuName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
  );

  if (mosseCard && enemyTarget) {
    state = attackWithMosse(state, cpuName, mosseCard.id, enemyTarget.id);
  }

  state = endTurn(state);

  return state;
}

export function getCurrentPlayerName(state: OfflineGameState): string {
  return state.turnOrder[state.currentTurnIndex];
}

export function isPlayerTurn(state: OfflineGameState, playerName: string): boolean {
  return getCurrentPlayerName(state) === playerName;
}
