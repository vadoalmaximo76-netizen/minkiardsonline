const OFFLINE_PERSONAGGI = [
  { url: "https://i.postimg.cc/fRTF9dfR/al-bano.png", pti: 280, stars: 3 },
  { url: "https://i.postimg.cc/nLXPdt58/alberto-angela.png", pti: 220, stars: 2 },
  { url: "https://i.postimg.cc/d0gSpxPh/amadeus.png", pti: 180, stars: 2 },
  { url: "https://i.postimg.cc/fR2Pjb8j/andrea.png", pti: 200, stars: 2 },
  { url: "https://i.postimg.cc/W3rfvwTX/ape.png", pti: 150, stars: 1 },
  { url: "https://i.postimg.cc/hvBZPQGg/apollo.png", pti: 320, stars: 3 },
  { url: "https://i.postimg.cc/9XdNgbxf/avvoltoio.png", pti: 170, stars: 2 },
  { url: "https://i.postimg.cc/fTMqGdFf/bambola-del-demonio.png", pti: 250, stars: 3 },
  { url: "https://i.postimg.cc/RVGp4Fx5/barbone.png", pti: 130, stars: 1 },
  { url: "https://i.postimg.cc/DwZjZT7W/bear.png", pti: 300, stars: 3 },
  { url: "https://i.postimg.cc/YCsXLsSd/bello-figo-gu.png", pti: 190, stars: 2 },
  { url: "https://i.postimg.cc/zfHxCFb8/berlusconi.png", pti: 270, stars: 3 },
  { url: "https://i.postimg.cc/3NY9HMLx/bigfoot.png", pti: 310, stars: 3 },
  { url: "https://i.postimg.cc/QtL00K15/big-dabol.png", pti: 240, stars: 2 },
  { url: "https://i.postimg.cc/W3rfvwTX/ape.png", pti: 160, stars: 1 },
];

const OFFLINE_MOSSE = [
  { url: "https://i.ibb.co/ZzdFWqBZ/attacco.png", dmg: 2 },
  { url: "https://i.ibb.co/bjg4DpdH/calcio-in-culo.png", dmg: 1 },
  { url: "https://i.ibb.co/kgrxyXKm/calcio-rotante.png", dmg: 2 },
  { url: "https://i.ibb.co/sJC8Z702/calcio-volante.png", dmg: 3 },
  { url: "https://i.ibb.co/W4Wr4wHC/cazzotto-in-testa.png", dmg: 2 },
  { url: "https://i.ibb.co/7JbxVn3n/esplosione-atomica.png", dmg: 5 },
  { url: "https://i.ibb.co/Mk1mtzdy/frog-splash.png", dmg: 3 },
  { url: "https://i.ibb.co/21FPwH1z/fucile-a-pompa.png", dmg: 4 },
  { url: "https://i.ibb.co/ZzX83YXV/puozza-itt-l-sang.png", dmg: 2 },
  { url: "https://i.ibb.co/pBtPYvzg/pugno.png", dmg: 1 },
  { url: "https://i.ibb.co/RGVnrqBZ/pioggia-di-meteoriti.png", dmg: 4 },
  { url: "https://i.ibb.co/rRVR5YQS/sprangata.png", dmg: 3 },
  { url: "https://i.ibb.co/j9vpDLx2/sputo.png", dmg: 1 },
  { url: "https://i.ibb.co/RT3w3zYS/onda-energetica.png", dmg: 3 },
  { url: "https://i.ibb.co/Y7PQDX3y/saetta.png", dmg: 4 },
];

const OFFLINE_BONUS = [
  "https://i.postimg.cc/y8FPVWHV/barriera.png",
  "https://i.postimg.cc/Pxqzz48x/blocco.png",
  "https://i.postimg.cc/TPdrf909/boomerang.png",
  "https://i.postimg.cc/65xGHL8Y/carica.png",
  "https://i.postimg.cc/mktV83hb/doping.png",
  "https://i.postimg.cc/k5qckPDY/eredit.png",
  "https://i.postimg.cc/sgFmd7b6/baratto.png",
  "https://i.postimg.cc/C1DxDXsY/ciclone.png",
  "https://i.postimg.cc/qvX8PYsq/bolla-di-sapone.png",
  "https://i.postimg.cc/XqmLhZy9/divertente.png",
];

export interface OfflineCard {
  id: string;
  type: 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali';
  name: string;
  frontImage: string;
  pti?: number;
  stars?: number;
  mosseDamageValue?: number;
  owner: string;
}

interface OfflinePlayer {
  name: string;
  isCPU: boolean;
  hand: OfflineCard[];
  decks: {
    personaggi: OfflineCard[];
    mosse: OfflineCard[];
    bonus: OfflineCard[];
    personaggi_speciali: OfflineCard[];
  };
}

export interface OfflineGameState {
  players: Record<string, OfflinePlayer>;
  field: OfflineCard[];
  graveyard: OfflineCard[];
  turnOrder: string[];
  currentTurnIndex: number;
  gameEnded: boolean;
  winner: string | null;
  messages: Array<{ id: string; timestamp: number; message: string }>;
}

function getCardName(url: string): string {
  const filename = url.split('/').pop() || '';
  return filename.replace(/\.[^.]+$/, '').replace(/-/g, ' ').replace(/_/g, ' ').toUpperCase();
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let _idCounter = 0;
function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_idCounter}`;
}

function addMessage(state: OfflineGameState, message: string): OfflineGameState {
  return {
    ...state,
    messages: [
      ...state.messages,
      { id: uid('msg'), timestamp: Date.now(), message }
    ]
  };
}

function buildPersonaggiDeck(owner: string): OfflineCard[] {
  return shuffle(OFFLINE_PERSONAGGI).map(c => ({
    id: uid('pg'),
    type: 'personaggi' as const,
    name: getCardName(c.url),
    frontImage: c.url,
    pti: c.pti,
    stars: c.stars,
    owner,
  }));
}

function buildMosseDeck(owner: string): OfflineCard[] {
  return shuffle(OFFLINE_MOSSE).map(c => ({
    id: uid('ms'),
    type: 'mosse' as const,
    name: getCardName(c.url),
    frontImage: c.url,
    mosseDamageValue: c.dmg,
    owner,
  }));
}

function buildBonusDeck(owner: string): OfflineCard[] {
  return shuffle(OFFLINE_BONUS).map(url => ({
    id: uid('bn'),
    type: 'bonus' as const,
    name: getCardName(url),
    frontImage: url,
    owner,
  }));
}

function checkWinCondition(state: OfflineGameState): OfflineGameState {
  for (const playerName of state.turnOrder) {
    const player = state.players[playerName];
    const hasPersonaggi =
      player.hand.some(c => c.type === 'personaggi' || c.type === 'personaggi_speciali') ||
      state.field.some(c => c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')) ||
      player.decks.personaggi.length > 0 ||
      player.decks.personaggi_speciali.length > 0;

    if (!hasPersonaggi) {
      const winner = state.turnOrder.find(p => p !== playerName) || state.turnOrder[0];
      let s = addMessage(state, `💀 ${playerName} non ha più personaggi! Vince ${winner}!`);
      return { ...s, gameEnded: true, winner };
    }
  }
  return state;
}

export function createOfflineGame(playerName: string, cpuName: string): OfflineGameState {
  const state: OfflineGameState = {
    players: {
      [playerName]: {
        name: playerName,
        isCPU: false,
        hand: [],
        decks: {
          personaggi: buildPersonaggiDeck(playerName),
          mosse: buildMosseDeck(playerName),
          bonus: buildBonusDeck(playerName),
          personaggi_speciali: [],
        },
      },
      [cpuName]: {
        name: cpuName,
        isCPU: true,
        hand: [],
        decks: {
          personaggi: buildPersonaggiDeck(cpuName),
          mosse: buildMosseDeck(cpuName),
          bonus: buildBonusDeck(cpuName),
          personaggi_speciali: [],
        },
      },
    },
    field: [],
    graveyard: [],
    turnOrder: [playerName, cpuName],
    currentTurnIndex: 0,
    gameEnded: false,
    winner: null,
    messages: [{ id: uid('msg'), timestamp: Date.now(), message: '🎮 Partita offline iniziata!' }],
  };
  return state;
}

export function drawCard(
  state: OfflineGameState,
  playerName: string,
  deckType: 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali'
): { state: OfflineGameState } {
  const player = state.players[playerName];
  if (!player) return { state };

  const deck = player.decks[deckType];
  if (!deck || deck.length === 0) {
    const s = addMessage(state, `📭 Mazzo ${deckType} esaurito per ${playerName}!`);
    return { state: s };
  }

  const [card, ...rest] = deck;
  const newState: OfflineGameState = {
    ...state,
    players: {
      ...state.players,
      [playerName]: {
        ...player,
        hand: [...player.hand, card],
        decks: { ...player.decks, [deckType]: rest },
      },
    },
  };
  return { state: addMessage(newState, `🃏 ${playerName} pesca una carta ${deckType}: ${card.name}`) };
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

  const card = player.hand[cardIndex];
  if (card.type !== 'personaggi' && card.type !== 'personaggi_speciali') return state;

  const newHand = [...player.hand];
  newHand.splice(cardIndex, 1);

  const newState: OfflineGameState = {
    ...state,
    players: {
      ...state.players,
      [playerName]: { ...player, hand: newHand },
    },
    field: [...state.field, card],
  };
  return addMessage(newState, `⚔️ ${playerName} gioca ${card.name} sul campo! (PTI: ${card.pti}, ⭐${card.stars})`);
}

export function attackWithMosse(
  state: OfflineGameState,
  attackerName: string,
  mosseCardId: string,
  targetCardId: string
): OfflineGameState {
  const attacker = state.players[attackerName];
  if (!attacker || state.gameEnded) return state;

  const mosseIndex = attacker.hand.findIndex(c => c.id === mosseCardId);
  if (mosseIndex === -1) return state;
  const mosse = attacker.hand[mosseIndex];

  const targetIndex = state.field.findIndex(c => c.id === targetCardId);
  if (targetIndex === -1) return state;
  const target = state.field[targetIndex];

  const attackerChar = state.field.find(
    c => c.owner === attackerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
  );

  const stars = attackerChar?.stars ?? 1;
  const baseDmg = mosse.mosseDamageValue ?? 1;
  const totalDmg = baseDmg * stars;

  const newTargetPTI = Math.max(0, (target.pti ?? 100) - totalDmg);

  let newHand = [...attacker.hand];
  newHand.splice(mosseIndex, 1);

  let newField = [...state.field];
  let newGraveyard = [...state.graveyard];

  let s: OfflineGameState = {
    ...state,
    players: { ...state.players, [attackerName]: { ...attacker, hand: newHand } },
  };

  s = addMessage(s, `💥 ${attackerName} usa ${mosse.name} su ${target.name}! Danni: ${totalDmg} (${baseDmg}×⭐${stars}). PTI: ${target.pti} → ${newTargetPTI}`);

  if (newTargetPTI <= 0) {
    newField = newField.filter(c => c.id !== targetCardId);
    newGraveyard = [...newGraveyard, { ...target, pti: 0 }];
    s = {
      ...s,
      field: newField,
      graveyard: newGraveyard,
    };
    s = addMessage(s, `💀 ${target.name} è stato eliminato!`);
    s = checkWinCondition(s);
  } else {
    newField[targetIndex] = { ...target, pti: newTargetPTI };
    s = { ...s, field: newField };
  }

  return s;
}

export function endTurn(state: OfflineGameState): OfflineGameState {
  if (state.gameEnded) return state;
  const nextIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
  const nextPlayer = state.turnOrder[nextIndex];
  const s = { ...state, currentTurnIndex: nextIndex };
  return addMessage(s, `🔄 Turno di ${nextPlayer}`);
}

export function cpuTakeTurn(state: OfflineGameState, cpuName: string): OfflineGameState {
  if (state.gameEnded) return state;

  let s = state;

  const cpuFieldChars = s.field.filter(
    c => c.owner === cpuName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
  );

  if (cpuFieldChars.length === 0) {
    const pgInHand = s.players[cpuName]?.hand.find(
      c => c.type === 'personaggi' || c.type === 'personaggi_speciali'
    );
    if (pgInHand) {
      s = playCardToField(s, cpuName, pgInHand.id);
    } else {
      const result = drawCard(s, cpuName, 'personaggi');
      s = result.state;
      const newPg = s.players[cpuName]?.hand.find(
        c => c.type === 'personaggi' || c.type === 'personaggi_speciali'
      );
      if (newPg) s = playCardToField(s, cpuName, newPg.id);
    }
  }

  if (s.gameEnded) return endTurn(s);

  const mosseInHand = s.players[cpuName]?.hand.find(c => c.type === 'mosse');
  if (!mosseInHand) {
    const result = drawCard(s, cpuName, 'mosse');
    s = result.state;
  }

  const mosseCard = s.players[cpuName]?.hand.find(c => c.type === 'mosse');
  if (mosseCard) {
    const opponents = s.turnOrder.filter(p => p !== cpuName);
    for (const opp of opponents) {
      const targets = s.field.filter(
        c => c.owner === opp && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
      );
      if (targets.length > 0) {
        const weakest = targets.reduce((a, b) => (a.pti ?? 999) < (b.pti ?? 999) ? a : b);
        s = attackWithMosse(s, cpuName, mosseCard.id, weakest.id);
        break;
      }
    }
  }

  if (s.gameEnded) return s;
  return endTurn(s);
}

export function getCurrentPlayerName(state: OfflineGameState): string {
  return state.turnOrder[state.currentTurnIndex % state.turnOrder.length];
}

export function isPlayerTurn(state: OfflineGameState, playerName: string): boolean {
  return getCurrentPlayerName(state) === playerName && !state.gameEnded;
}
