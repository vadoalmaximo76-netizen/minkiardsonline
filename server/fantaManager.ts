import * as fs from 'fs';
import * as path from 'path';
import { CARD_DATA, DECK_BACK_IMAGES } from '../client/src/lib/cardData';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');

function readFantaSessions(): FantaSession[] {
  const filePath = path.join(DATA_DIR, 'fantaSessions.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeFantaSessions(sessions: FantaSession[]): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, 'fantaSessions.json'),
    JSON.stringify(sessions, null, 2),
    'utf-8'
  );
}

export type FantaRarity = 'comune' | 'rara' | 'epica' | 'leggendaria';

export interface FantaCard {
  id: string;
  type: 'personaggi' | 'mosse' | 'bonus';
  frontImage: string;
  name: string;
  rarity: FantaRarity;
  draftCost: number;
}

export interface FantaDeck {
  personaggi: FantaCard[];
  mosse: FantaCard[];
  bonus: FantaCard[];
}

export interface FantaParticipant {
  name: string;
  credits: number;
  deck: FantaDeck;
  isCPU: boolean;
  cpuLevel: 'easy' | 'medium' | 'hard';
  socketId?: string;
}

export interface FantaAuction {
  card: FantaCard;
  currentBid: number;
  currentBidder: string | null;
  countdown: number;
  countdownTimer: ReturnType<typeof setInterval> | null;
  ended: boolean;
  startedAt: number;
}

export interface FantaPendingRequest {
  name: string;
  socketId: string;
  requestedAt: number;
}

export interface FantaSession {
  id: string;
  creatorName: string;
  creatorSocketId?: string;
  participants: Record<string, FantaParticipant>;
  maxParticipants: number;
  cpuCount: number;
  pendingRequests: FantaPendingRequest[];
  status: 'lobby' | 'auction' | 'complete';
  cardQueue: FantaCard[];
  currentCardIndex: number;
  currentAuction: FantaAuction | null;
  recentAwarded: Array<{ card: FantaCard; winner: string }>;
  isPaused: boolean;
  disqualified: string[];
  createdAt: number;
  completedAt?: number;
}

const STARTING_CREDITS = 1000;
const CARDS_NEEDED: Record<'personaggi' | 'mosse' | 'bonus', number> = {
  personaggi: 20,
  mosse: 9,
  bonus: 15,
};
const AUCTION_INITIAL_TIMER = 15;
const AUCTION_BID_RESET_TIMER = 3;

function getCardNameFromUrl(url: string): string {
  const parts = url.split('/');
  const filename = parts[parts.length - 1] || '';
  return decodeURIComponent(filename)
    .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
    .replace(/[-_]/g, ' ')
    .trim();
}

function getRarity(draftCost: number, sortedCosts: number[]): FantaRarity {
  if (sortedCosts.length === 0) return 'comune';
  const idx = sortedCosts.findIndex(c => c >= draftCost);
  const pct = idx >= 0 ? idx / sortedCosts.length : 1;
  if (pct < 0.60) return 'comune';
  if (pct < 0.80) return 'rara';
  if (pct < 0.95) return 'epica';
  return 'leggendaria';
}

function buildCardQueue(mods: any[]): FantaCard[] {
  const deckTypes: Array<'personaggi' | 'mosse' | 'bonus'> = ['personaggi', 'mosse', 'bonus'];
  const queue: FantaCard[] = [];

  for (const type of deckTypes) {
    const urls: string[] = (CARD_DATA as any)[type] || [];
    const typeMods = mods.filter(m => m.deckType === type && !m.isDeleted);
    const modMap = new Map(typeMods.map((m: any) => [m.originalCardId, m]));

    const sortedCosts = typeMods
      .map((m: any) => m.draftCost || 0)
      .sort((a: number, b: number) => a - b);

    urls.forEach((url, idx) => {
      const cardId = `${type}-${idx}`;
      const mod = modMap.get(cardId) as any;
      const draftCost = mod?.draftCost || 0;
      const name = mod?.name || getCardNameFromUrl(url);

      queue.push({
        id: cardId,
        type,
        frontImage: url,
        name,
        rarity: getRarity(draftCost, sortedCosts),
        draftCost,
      });
    });
  }

  queue.sort((a, b) => a.name.localeCompare(b.name, 'it'));

  return queue;
}

function cpuBidAmount(
  participant: FantaParticipant,
  card: FantaCard,
  currentBid: number
): number | null {
  const { cpuLevel, credits, deck } = participant;
  const typeDeck = deck[card.type];
  if (typeDeck.length >= CARDS_NEEDED[card.type]) return null;
  if (credits <= 0) return null;

  // Calculate how many cards still needed across all types
  const cardsNeeded =
    Math.max(0, CARDS_NEEDED.personaggi - deck.personaggi.length) +
    Math.max(0, CARDS_NEEDED.mosse - deck.mosse.length) +
    Math.max(0, CARDS_NEEDED.bonus - deck.bonus.length);

  if (cardsNeeded <= 0) return null;

  // Budget per remaining card — conservative: CPU must pace itself
  const budgetPerCard = credits / cardsNeeded;

  // Rarity multiplier on top of base budget
  const rarityMultiplier: Record<FantaRarity, number> = {
    comune:      cpuLevel === 'easy' ? 0.5  : cpuLevel === 'medium' ? 0.7  : 0.9,
    rara:        cpuLevel === 'easy' ? 0.8  : cpuLevel === 'medium' ? 1.1  : 1.5,
    epica:       cpuLevel === 'easy' ? 1.1  : cpuLevel === 'medium' ? 1.5  : 2.0,
    leggendaria: cpuLevel === 'easy' ? 1.4  : cpuLevel === 'medium' ? 2.0  : 3.0,
  };

  const maxForCard = Math.floor(budgetPerCard * rarityMultiplier[card.rarity]);
  if (maxForCard <= currentBid) return null;

  // Interest check — whether CPU bothers bidding at all
  const interestChance: Record<FantaRarity, number> = {
    comune:      cpuLevel === 'easy' ? 0.30 : cpuLevel === 'medium' ? 0.45 : 0.60,
    rara:        cpuLevel === 'easy' ? 0.50 : cpuLevel === 'medium' ? 0.65 : 0.80,
    epica:       cpuLevel === 'easy' ? 0.65 : cpuLevel === 'medium' ? 0.80 : 0.92,
    leggendaria: cpuLevel === 'easy' ? 0.75 : cpuLevel === 'medium' ? 0.88 : 0.97,
  };
  if (Math.random() > interestChance[card.rarity]) return null;

  // Place a small increment above current bid
  const increment = cpuLevel === 'easy' ? 1 : cpuLevel === 'medium' ? 2 : 4;
  const bid = currentBid + increment + Math.floor(Math.random() * 3);

  if (bid > credits) return null;
  if (bid > maxForCard) return null;
  if (bid <= currentBid) return null;
  return bid;
}

export class FantaManager {
  private sessions: Map<string, FantaSession> = new Map();

  constructor() {
    const stored = readFantaSessions();
    for (const s of stored) {
      s.currentAuction = null;
      this.sessions.set(s.id, s);
    }
  }

  private persist(): void {
    const arr = Array.from(this.sessions.values()).map(s => ({
      ...s,
      currentAuction: s.currentAuction
        ? { ...s.currentAuction, countdownTimer: null }
        : null,
    }));
    writeFantaSessions(arr);
  }

  createSession(creatorName: string, cpuCount: number = 0, cpuLevel: 'easy' | 'medium' | 'hard' = 'medium', maxParticipants: number = cpuCount + 1, creatorSocketId?: string): FantaSession {
    const id = `fanta-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const participants: Record<string, FantaParticipant> = {};
    const actualMax = Math.max(maxParticipants, cpuCount + 1);

    participants[creatorName] = {
      name: creatorName,
      credits: STARTING_CREDITS,
      deck: { personaggi: [], mosse: [], bonus: [] },
      isCPU: false,
      cpuLevel: 'medium',
      socketId: creatorSocketId,
    };

    for (let i = 0; i < cpuCount; i++) {
      const cpuName = `CPU ${i + 1}`;
      participants[cpuName] = {
        name: cpuName,
        credits: STARTING_CREDITS,
        deck: { personaggi: [], mosse: [], bonus: [] },
        isCPU: true,
        cpuLevel,
      };
    }

    const session: FantaSession = {
      id,
      creatorName,
      creatorSocketId,
      participants,
      maxParticipants: actualMax,
      cpuCount,
      pendingRequests: [],
      status: 'lobby',
      cardQueue: [],
      currentCardIndex: 0,
      currentAuction: null,
      recentAwarded: [],
      isPaused: false,
      disqualified: [],
      createdAt: Date.now(),
    };

    this.sessions.set(id, session);
    this.persist();
    return session;
  }

  getSession(id: string): FantaSession | undefined {
    return this.sessions.get(id);
  }

  getLobbySession(): FantaSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'lobby');
  }

  joinSession(fantaId: string, playerName: string, socketId?: string): { success: boolean; error?: string } {
    const session = this.sessions.get(fantaId);
    if (!session) return { success: false, error: 'Sessione non trovata' };
    if (session.status !== 'lobby') return { success: false, error: 'La sessione è già iniziata' };

    if (!session.participants[playerName]) {
      const humanParticipants = Object.values(session.participants).filter(p => !p.isCPU).length;
      if (humanParticipants >= session.maxParticipants) {
        return { success: false, error: 'Sessione al completo' };
      }
      session.participants[playerName] = {
        name: playerName,
        credits: STARTING_CREDITS,
        deck: { personaggi: [], mosse: [], bonus: [] },
        isCPU: false,
        cpuLevel: 'medium',
        socketId,
      };
    } else {
      session.participants[playerName].socketId = socketId;
    }

    this.persist();
    return { success: true };
  }

  requestJoin(fantaId: string, playerName: string, socketId: string, io: any): { success: boolean; error?: string } {
    const session = this.sessions.get(fantaId);
    if (!session) return { success: false, error: 'Sessione non trovata' };
    if (session.status !== 'lobby') return { success: false, error: 'La sessione è già iniziata' };
    if (session.participants[playerName]) return { success: false, error: 'Sei già in questa sessione' };
    if (session.pendingRequests.find(r => r.name === playerName)) return { success: false, error: 'Richiesta già inviata' };

    const humanParticipants = Object.values(session.participants).filter(p => !p.isCPU).length;
    if (humanParticipants >= session.maxParticipants) {
      return { success: false, error: 'Sessione al completo' };
    }

    session.pendingRequests.push({ name: playerName, socketId, requestedAt: Date.now() });
    this.persist();

    if (session.creatorSocketId) {
      io.to(session.creatorSocketId).emit('fanta:join-request', {
        fantaId,
        playerName,
        pendingRequests: session.pendingRequests,
      });
    }

    return { success: true };
  }

  approveJoin(fantaId: string, playerName: string, io: any): { success: boolean; error?: string } {
    const session = this.sessions.get(fantaId);
    if (!session) return { success: false, error: 'Sessione non trovata' };

    const reqIdx = session.pendingRequests.findIndex(r => r.name === playerName);
    if (reqIdx === -1) return { success: false, error: 'Richiesta non trovata' };

    const req = session.pendingRequests[reqIdx];
    session.pendingRequests.splice(reqIdx, 1);

    const humanParticipants = Object.values(session.participants).filter(p => !p.isCPU).length;
    if (humanParticipants >= session.maxParticipants) {
      io.to(req.socketId).emit('fanta:join-rejected', { fantaId, reason: 'Sessione al completo' });
      this.persist();
      return { success: false, error: 'Sessione al completo' };
    }

    session.participants[playerName] = {
      name: playerName,
      credits: STARTING_CREDITS,
      deck: { personaggi: [], mosse: [], bonus: [] },
      isCPU: false,
      cpuLevel: 'medium',
      socketId: req.socketId,
    };
    this.persist();

    const sess = this.getSafeSession(fantaId);
    io.to(req.socketId).emit('fanta:join-approved', { fantaId, session: sess });
    io.to(fantaId).emit('fanta:session-updated', { session: sess });

    return { success: true };
  }

  rejectJoin(fantaId: string, playerName: string, io: any): { success: boolean; error?: string } {
    const session = this.sessions.get(fantaId);
    if (!session) return { success: false, error: 'Sessione non trovata' };

    const reqIdx = session.pendingRequests.findIndex(r => r.name === playerName);
    if (reqIdx === -1) return { success: false, error: 'Richiesta non trovata' };

    const req = session.pendingRequests[reqIdx];
    session.pendingRequests.splice(reqIdx, 1);
    this.persist();

    io.to(req.socketId).emit('fanta:join-rejected', { fantaId, reason: 'Richiesta rifiutata dal creatore' });
    if (session.creatorSocketId) {
      io.to(session.creatorSocketId).emit('fanta:join-request', {
        fantaId,
        playerName: null,
        pendingRequests: session.pendingRequests,
      });
    }

    return { success: true };
  }

  invitePlayer(fantaId: string, targetName: string, io: any): { success: boolean; error?: string } {
    const session = this.sessions.get(fantaId);
    if (!session) return { success: false, error: 'Sessione non trovata' };
    if (session.status !== 'lobby') return { success: false, error: 'La sessione è già iniziata' };

    io.emit('fanta:invite-broadcast', {
      fantaId,
      targetName,
      creatorName: session.creatorName,
      sessionCode: fantaId.slice(-6),
    });

    return { success: true };
  }

  updateSocketId(fantaId: string, playerName: string, socketId: string): void {
    const session = this.sessions.get(fantaId);
    if (!session) return;
    if (session.participants[playerName]) {
      session.participants[playerName].socketId = socketId;
    }
    if (session.creatorName === playerName) {
      session.creatorSocketId = socketId;
    }
  }

  startAuctionPhase(fantaId: string, mods: any[], io: any): { success: boolean; error?: string } {
    const session = this.sessions.get(fantaId);
    if (!session) return { success: false, error: 'Sessione non trovata' };
    if (session.status !== 'lobby') return { success: false, error: 'Asta già iniziata' };

    session.cardQueue = buildCardQueue(mods);
    session.currentCardIndex = 0;
    session.status = 'auction';
    this.persist();

    this.advanceToNextCard(fantaId, io);
    return { success: true };
  }

  private isComplete(session: FantaSession): boolean {
    for (const p of Object.values(session.participants)) {
      if (session.disqualified.includes(p.name)) continue;
      if (
        p.deck.personaggi.length < CARDS_NEEDED.personaggi ||
        p.deck.mosse.length < CARDS_NEEDED.mosse ||
        p.deck.bonus.length < CARDS_NEEDED.bonus
      ) {
        return false;
      }
    }
    return true;
  }

  private allHaveEnough(session: FantaSession, type: 'personaggi' | 'mosse' | 'bonus'): boolean {
    for (const p of Object.values(session.participants)) {
      if (session.disqualified.includes(p.name)) continue;
      if (p.deck[type].length < CARDS_NEEDED[type]) return false;
    }
    return true;
  }

  private checkDisqualification(session: FantaSession, io: any): void {
    for (const p of Object.values(session.participants)) {
      if (session.disqualified.includes(p.name)) continue;
      const deckComplete =
        p.deck.personaggi.length >= CARDS_NEEDED.personaggi &&
        p.deck.mosse.length >= CARDS_NEEDED.mosse &&
        p.deck.bonus.length >= CARDS_NEEDED.bonus;
      if (!deckComplete && p.credits <= 0) {
        session.disqualified.push(p.name);
        io.to(session.id).emit('fanta:disqualified', {
          playerName: p.name,
          reason: 'Crediti esauriti senza aver completato la squadra',
          disqualified: session.disqualified,
        });
      }
    }
  }

  private advanceToNextCard(fantaId: string, io: any): void {
    const session = this.sessions.get(fantaId);
    if (!session || session.status !== 'auction') return;

    if (this.isComplete(session)) {
      this.completeAuction(fantaId, io);
      return;
    }

    while (session.currentCardIndex < session.cardQueue.length) {
      const card = session.cardQueue[session.currentCardIndex];
      if (!this.allHaveEnough(session, card.type)) {
        this.startCardAuction(fantaId, card, io);
        return;
      }
      session.currentCardIndex++;
    }

    this.completeAuction(fantaId, io);
  }

  private startCardAuction(fantaId: string, card: FantaCard, io: any): void {
    const session = this.sessions.get(fantaId);
    if (!session) return;

    if (session.currentAuction?.countdownTimer) {
      clearInterval(session.currentAuction.countdownTimer);
    }

    session.currentAuction = {
      card,
      currentBid: 0,
      currentBidder: null,
      countdown: AUCTION_INITIAL_TIMER,
      countdownTimer: null,
      ended: false,
      startedAt: Date.now(),
    };

    io.to(fantaId).emit('fanta:card-up', {
      card,
      timer: AUCTION_INITIAL_TIMER,
      deckProgress: this.getDeckProgress(session),
      credits: this.getCreditsMap(session),
    });

    this.startCountdown(fantaId, io);
    this.scheduleCPUBids(fantaId, io);
  }

  private startCountdown(fantaId: string, io: any): void {
    const session = this.sessions.get(fantaId);
    if (!session?.currentAuction) return;

    const auction = session.currentAuction;
    if (auction.countdownTimer) clearInterval(auction.countdownTimer);

    auction.countdownTimer = setInterval(() => {
      const s = this.sessions.get(fantaId);
      if (!s?.currentAuction || s.currentAuction.ended) {
        clearInterval(auction.countdownTimer!);
        return;
      }
      if (s.isPaused) return;
      s.currentAuction.countdown--;
      io.to(fantaId).emit('fanta:countdown', { seconds: s.currentAuction.countdown });

      if (s.currentAuction.countdown <= 0) {
        clearInterval(s.currentAuction.countdownTimer!);
        s.currentAuction.countdownTimer = null;
        this.endCardAuction(fantaId, io);
      }
    }, 1000);
  }

  pauseAuction(fantaId: string, io: any): { success: boolean; error?: string } {
    const session = this.sessions.get(fantaId);
    if (!session || session.status !== 'auction') return { success: false, error: 'Nessuna asta in corso' };
    if (session.isPaused) return { success: false, error: 'Asta già in pausa' };
    session.isPaused = true;
    io.to(fantaId).emit('fanta:paused', { isPaused: true });
    return { success: true };
  }

  resumeAuction(fantaId: string, io: any): { success: boolean; error?: string } {
    const session = this.sessions.get(fantaId);
    if (!session || session.status !== 'auction') return { success: false, error: 'Nessuna asta in corso' };
    if (!session.isPaused) return { success: false, error: 'Asta non in pausa' };
    session.isPaused = false;
    io.to(fantaId).emit('fanta:paused', { isPaused: false });
    return { success: true };
  }

  private scheduleCPUBids(fantaId: string, io: any): void {
    const session = this.sessions.get(fantaId);
    if (!session?.currentAuction) return;

    const cpus = Object.values(session.participants).filter(
      p => p.isCPU && !session.disqualified.includes(p.name)
    );
    for (const cpu of cpus) {
      const delay = 2000 + Math.random() * 4000;
      setTimeout(() => {
        const s = this.sessions.get(fantaId);
        if (!s?.currentAuction || s.currentAuction.ended || s.isPaused) return;
        if (s.disqualified.includes(cpu.name)) return;
        const latestCpu = s.participants[cpu.name];
        if (!latestCpu) return;
        const bid = cpuBidAmount(latestCpu, s.currentAuction.card, s.currentAuction.currentBid);
        if (bid !== null) {
          this.placeBid(fantaId, cpu.name, bid, io);
        }
      }, delay);
    }
  }

  placeBid(fantaId: string, playerName: string, amount: number, io: any): { success: boolean; error?: string } {
    const session = this.sessions.get(fantaId);
    if (!session?.currentAuction || session.currentAuction.ended) {
      return { success: false, error: 'Nessuna asta in corso' };
    }
    if (session.isPaused) {
      return { success: false, error: 'Asta in pausa' };
    }

    const auction = session.currentAuction;
    const participant = session.participants[playerName];
    if (!participant) return { success: false, error: 'Giocatore non trovato' };
    if (session.disqualified.includes(playerName)) {
      return { success: false, error: 'Sei stato squalificato' };
    }

    if (amount <= auction.currentBid) {
      return { success: false, error: `L'offerta deve essere superiore a ${auction.currentBid}` };
    }
    if (amount > participant.credits) {
      return { success: false, error: `Crediti insufficienti (hai ${participant.credits})` };
    }

    const typeDeck = participant.deck[auction.card.type];
    if (typeDeck.length >= CARDS_NEEDED[auction.card.type]) {
      return { success: false, error: 'Hai già il massimo di carte per questo tipo' };
    }

    auction.currentBid = amount;
    auction.currentBidder = playerName;
    auction.countdown = AUCTION_BID_RESET_TIMER;

    io.to(fantaId).emit('fanta:bid-update', {
      bidder: playerName,
      amount,
      countdown: AUCTION_BID_RESET_TIMER,
      credits: this.getCreditsMap(session),
    });

    this.startCountdown(fantaId, io);

    if (!participant.isCPU) {
      const cpus = Object.values(session.participants).filter(p => p.isCPU && p.name !== playerName);
      for (const cpu of cpus) {
        const delay = 1500 + Math.random() * 3000;
        setTimeout(() => {
          const s = this.sessions.get(fantaId);
          if (!s?.currentAuction || s.currentAuction.ended) return;
          if (s.currentAuction.currentBidder === playerName || s.currentAuction.currentBidder !== cpu.name) {
            const bid = cpuBidAmount(cpu, s.currentAuction.card, s.currentAuction.currentBid);
            if (bid !== null) {
              this.placeBid(fantaId, cpu.name, bid, io);
            }
          }
        }, delay);
      }
    }

    return { success: true };
  }

  skipCard(fantaId: string, io: any): { success: boolean; error?: string } {
    const session = this.sessions.get(fantaId);
    if (!session || session.status !== 'auction') return { success: false, error: 'Nessuna asta in corso' };

    if (session.currentAuction) {
      if (session.currentAuction.countdownTimer) {
        clearInterval(session.currentAuction.countdownTimer);
        session.currentAuction.countdownTimer = null;
      }
      const skippedCard = session.currentAuction.card;
      session.currentAuction = null;
      io.to(fantaId).emit('fanta:card-skipped', { card: skippedCard });
    }

    session.currentCardIndex++;
    this.persist();
    setTimeout(() => this.advanceToNextCard(fantaId, io), 800);
    return { success: true };
  }

  searchCard(fantaId: string, query: string, io: any): { success: boolean; error?: string } {
    const session = this.sessions.get(fantaId);
    if (!session || session.status !== 'auction') return { success: false, error: 'Nessuna asta in corso' };

    const lq = query.toLowerCase().trim();
    const foundIdx = session.cardQueue.findIndex(
      (c, i) => i > session.currentCardIndex && c.name.toLowerCase().includes(lq)
    );

    if (foundIdx === -1) return { success: false, error: 'Carta non trovata' };

    if (session.currentAuction) {
      if (session.currentAuction.countdownTimer) {
        clearInterval(session.currentAuction.countdownTimer);
        session.currentAuction.countdownTimer = null;
      }
      session.currentAuction = null;
    }

    const [found] = session.cardQueue.splice(foundIdx, 1);
    session.cardQueue.splice(session.currentCardIndex, 0, found);
    this.persist();
    this.startCardAuction(fantaId, found, io);
    return { success: true };
  }

  private endCardAuction(fantaId: string, io: any): void {
    const session = this.sessions.get(fantaId);
    if (!session?.currentAuction || session.currentAuction.ended) return;

    const auction = session.currentAuction;
    auction.ended = true;

    if (auction.currentBidder && auction.currentBid > 0) {
      const winner = session.participants[auction.currentBidder];
      if (winner) {
        winner.credits -= auction.currentBid;
        winner.deck[auction.card.type].push(auction.card);

        session.recentAwarded.unshift({ card: auction.card, winner: auction.currentBidder });
        if (session.recentAwarded.length > 10) session.recentAwarded.pop();

        io.to(fantaId).emit('fanta:card-awarded', {
          winner: auction.currentBidder,
          card: auction.card,
          amount: auction.currentBid,
          creditsRemaining: winner.credits,
          deckProgress: this.getDeckProgress(session),
          credits: this.getCreditsMap(session),
          disqualified: session.disqualified,
        });

        this.checkDisqualification(session, io);
      }
    } else {
      io.to(fantaId).emit('fanta:card-skipped', { card: auction.card, reason: 'no-bids' });
    }

    session.currentAuction = null;
    session.currentCardIndex++;
    this.persist();

    if (this.isComplete(session)) {
      setTimeout(() => this.completeAuction(fantaId, io), 1500);
    } else {
      setTimeout(() => this.advanceToNextCard(fantaId, io), 2000);
    }
  }

  private completeAuction(fantaId: string, io: any): void {
    const session = this.sessions.get(fantaId);
    if (!session) return;
    session.status = 'complete';
    session.completedAt = Date.now();
    this.persist();

    const decks: Record<string, FantaDeck> = {};
    for (const [name, p] of Object.entries(session.participants)) {
      decks[name] = p.deck;
    }

    io.to(fantaId).emit('fanta:auction-complete', { decks, fantaId });
  }

  private getDeckProgress(session: FantaSession): Record<string, { personaggi: number; mosse: number; bonus: number }> {
    const result: Record<string, { personaggi: number; mosse: number; bonus: number }> = {};
    for (const [name, p] of Object.entries(session.participants)) {
      result[name] = {
        personaggi: p.deck.personaggi.length,
        mosse: p.deck.mosse.length,
        bonus: p.deck.bonus.length,
      };
    }
    return result;
  }

  private getCreditsMap(session: FantaSession): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [name, p] of Object.entries(session.participants)) {
      result[name] = p.credits;
    }
    return result;
  }

  getFantaDeck(playerName: string): FantaDeck | null {
    for (const session of this.sessions.values()) {
      if (session.status === 'complete' && session.participants[playerName]) {
        return session.participants[playerName].deck;
      }
    }
    return null;
  }

  getFantaDeckForSession(fantaId: string, playerName: string): FantaDeck | null {
    const session = this.sessions.get(fantaId);
    if (!session || session.status !== 'complete') return null;
    return session.participants[playerName]?.deck || null;
  }

  getSafeSession(fantaId: string): Omit<FantaSession, 'currentAuction'> & { currentAuction: Omit<FantaAuction, 'countdownTimer'> | null } | undefined {
    const session = this.sessions.get(fantaId);
    if (!session) return undefined;
    return {
      ...session,
      currentAuction: session.currentAuction
        ? { ...session.currentAuction, countdownTimer: null }
        : null,
    };
  }

  deleteSession(fantaId: string): void {
    this.sessions.delete(fantaId);
    this.persist();
  }
}

export const fantaManager = new FantaManager();
