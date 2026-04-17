import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Shield, Star, Lock, CheckCircle, Swords, Trophy, ChevronRight, Sparkles, Heart, Target, Users, BookOpen, X, ClipboardList } from 'lucide-react';
import gsap from 'gsap';
import { CardInfoSheet } from './CardInfoSheet';
import { GuestWall } from './GuestWall';
import { GameBoard } from './GameBoard';
import { socket } from '../lib/socket';
import { useGameState } from '../lib/stores/useGameState';
import { CARD_DATA } from '../lib/cardData';
import { pauseHomeMusic, resumeHomeMusic } from './SpotifyPlayer';
import { InjuredPersonaggiDisclaimer } from './InjuredPersonaggiDisclaimer';
import { StarterDeckSelection, StarterDeckOption } from './StarterDeckSelection';
import { StoryWorldMap, StoryLocality, StoryCollectible } from './StoryWorldMap';
import { GymLeader } from '../types/gym';
import { useIsLandscape } from '../hooks/use-is-landscape';

export type { GymLeader };

interface GymModeProps {
  playerName: string;
  userId?: number;
  avatarId?: string | null;
  onBack: () => void;
  pendingGymGame?: { gameId: string; gymLeaderCpuName?: string; gymLeaderId?: number };
  onResumeGymGame?: (gameId: string) => void;
  onClearPendingGymGame?: () => void;
  onLogin?: () => void;
}

type Phase = 'map' | 'deck-select' | 'intro' | 'battle' | 'victory' | 'defeat' | 'card-pick';

type CardDataKey = keyof typeof CARD_DATA;

function getCardDataUrls(key: string): string[] | undefined {
  if (key in CARD_DATA) return CARD_DATA[key as CardDataKey] as string[];
  return undefined;
}

function getCardImageFromId(cardId: string): string {
  if (cardId.startsWith('custom-')) {
    const num = cardId.replace('custom-', '');
    return `/api/card-image/${num}`;
  }
  const parts = cardId.split('-');
  const idx = parseInt(parts[parts.length - 1]);
  const deckKey = parts.slice(0, parts.length - 1).join('_');
  const mappedKey = deckKey === 'personaggi_speciali' ? 'personaggi_speciali' : deckKey;
  const urls = getCardDataUrls(mappedKey);
  if (urls && !isNaN(idx) && idx >= 0 && idx < urls.length) return urls[idx];
  return '';
}

function getCardNameFromUrl(url: string): string {
  if (!url) return '';
  try {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename
      .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch {
    return '';
  }
}

function getCardNameFromId(cardId: string): string {
  const imgUrl = getCardImageFromId(cardId);
  if (imgUrl) return getCardNameFromUrl(imgUrl);
  if (cardId.startsWith('custom-')) return `Carta ${cardId.replace('custom-', '')}`;
  return cardId;
}

function getCardDeckLabel(cardId: string): string {
  if (cardId.startsWith('personaggi_speciali')) return 'Speciale';
  if (cardId.startsWith('personaggi')) return 'Personaggio';
  if (cardId.startsWith('mosse')) return 'Mossa';
  if (cardId.startsWith('bonus')) return 'Bonus';
  if (cardId.startsWith('custom-')) return 'Carta';
  return 'Carta';
}

function extractYoutubeVideoId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const v = u.searchParams.get('v');
    if (v) return v;
    const pathId = u.pathname.split('/').filter(Boolean).pop();
    if (pathId && /^[\w-]{11}$/.test(pathId)) return pathId;
  } catch {}
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

const DIFFICULTY_LABEL: Record<string, { label: string; color: string }> = {
  easy: { label: 'Facile', color: 'text-green-400' },
  medium: { label: 'Medio', color: 'text-yellow-400' },
  hard: { label: 'Difficile', color: 'text-red-400' },
};

/* ── Story-Mode 2D path layout ───────────────────────────────────── */
const GYM_PATH_NODE_H = 138;
const GYM_PATH_TOP_PAD = 14;

const GYM_PATH_STYLES = `
  @keyframes gymPathDraw {
    from { stroke-dashoffset: 1600; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes gymNodePulse {
    0%,100% { transform: scale(1);    opacity: 0.85; }
    70%      { transform: scale(1.75); opacity: 0; }
  }
  @keyframes gymNodeSpin {
    to { transform: rotate(360deg); }
  }
  @keyframes gymNodePop {
    0%   { transform: scale(0.45) translateY(10px); opacity: 0; }
    65%  { transform: scale(1.06) translateY(-2px); }
    100% { transform: scale(1)    translateY(0);    opacity: 1; }
  }
  @keyframes gymCardShimmer {
    0%   { background-position: -400% center; }
    100% { background-position:  400% center; }
  }
  @keyframes gymBadgeBounce {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-2px); }
  }
  @keyframes gymNodeGlow {
    0%,100% { filter: drop-shadow(0 0 6px #f59e0b) drop-shadow(0 0 14px #f59e0b88); }
    50%      { filter: drop-shadow(0 0 14px #f59e0b) drop-shadow(0 0 28px #f59e0bcc); }
  }
  .gym-path-node-pop { animation: gymNodePop 0.42s cubic-bezier(0.34,1.56,0.64,1) both; }

  @keyframes gymPhaseFlash {
    0%   { opacity: 1; }
    35%  { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes gymBossEntry {
    0%   { transform: scale(0.78); opacity: 0; filter: drop-shadow(0 0 0px rgba(251,191,36,0)); }
    60%  { transform: scale(1.04); opacity: 1; filter: drop-shadow(0 0 32px rgba(251,191,36,0.7)); }
    100% { transform: scale(1);    opacity: 1; filter: drop-shadow(0 0 12px rgba(251,191,36,0.3)); }
  }
  @keyframes gymIntroSlideUp {
    0%   { transform: translateY(22px); opacity: 0; }
    100% { transform: translateY(0);    opacity: 1; }
  }
  @keyframes gymConfettiFall {
    0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
    80%  { opacity: 1; }
    100% { transform: translateY(100vh) rotate(var(--conf-spin)); opacity: 0; }
  }
  @keyframes gymDefeatRedFlash {
    0%   { opacity: 0.55; }
    30%  { opacity: 0.55; }
    100% { opacity: 0; }
  }
  @keyframes gymBossShake {
    0%,100% { transform: translateX(0); }
    15%      { transform: translateX(-10px); }
    30%      { transform: translateX(10px); }
    45%      { transform: translateX(-8px); }
    60%      { transform: translateX(8px); }
    75%      { transform: translateX(-4px); }
    88%      { transform: translateX(4px); }
  }
  @keyframes gymCardDealIn {
    0%   { transform: translateY(20px); opacity: 0; }
    100% { transform: translateY(0);    opacity: 1; }
  }
  @keyframes gymBadgeGlowPulse {
    0%,100% { box-shadow: 0 0 20px 4px rgba(234,179,8,0.45); }
    50%      { box-shadow: 0 0 52px 18px rgba(234,179,8,0.80), 0 0 90px 30px rgba(234,179,8,0.30); }
  }
  @keyframes gymIntroBgFadeIn {
    0%   { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes gymIntroBurst {
    0%   { transform: rotate(var(--ba)) translateX(0px)    scale(1.2); opacity: 0.9; }
    100% { transform: rotate(var(--ba)) translateX(var(--bd)) scale(0.2); opacity: 0; }
  }
`;

/* ── Pre-computed confetti particle data (deterministic, no Math.random in render) ── */
const CONFETTI_DATA = Array.from({ length: 26 }, (_, i) => ({
  x: ((i * 1237 + 83) * 31) % 100,
  color: ['#fbbf24','#f59e0b','#ffffff','#fde68a','#f97316','#fef3c7','#fcd34d'][i % 7],
  delay: ((i * 79 + 17) % 700),
  size: 6 + (i % 5) * 2,
  spin: ((i * 137) % 540) - 270,
  duration: 1200 + (i % 6) * 150,
}));

/* ── Pre-computed intro boss-arrival burst particles (deterministic) ── */
const INTRO_BURST_DATA = Array.from({ length: 14 }, (_, i) => ({
  angle: Math.round((i / 14) * 360),
  dist: 38 + (i % 4) * 20,
  color: ['#fbbf24','#f59e0b','#fde68a','#fcd34d','#ffffff'][i % 5],
  size:  5 + (i % 4) * 3,
  delay: (i % 4) * 35,
}));

const GYM_NODE_PCT_RIGHT = 58;
const GYM_NODE_PCT_LEFT  = 42;

// ── Infermeria Panel ──────────────────────────────────────────────────────────
const INFERMERIA_REVIVE_COST = 50;

interface InfermeriaInjuredCard {
  cardId: string;
  name: string;
  imageUrl: string | null;
  gamesRemaining: number;
}

interface InfermeriaPanelProps {
  authToken: string;
  userCredits: number;
  onCreditsUpdated: (newCredits: number) => void;
  onClose: () => void;
}

function InfermeriaPanel({ authToken, userCredits, onCreditsUpdated, onClose }: InfermeriaPanelProps) {
  const [injured, setInjured] = React.useState<InfermeriaInjuredCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [reviving, setReviving] = React.useState<Set<string>>(new Set());
  const [localCredits, setLocalCredits] = React.useState(userCredits);
  const infermeriaLandscape = useIsLandscape();

  React.useEffect(() => { setLocalCredits(userCredits); }, [userCredits]);

  React.useEffect(() => {
    setLoading(true);
    fetch('/api/injured-personaggi', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json())
      .then(data => {
        if (data.success) setInjured(data.injured || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authToken]);

  const handleRevive = async (cardId: string) => {
    if (localCredits < INFERMERIA_REVIVE_COST) return;
    setReviving(prev => new Set(prev).add(cardId));
    try {
      const res = await fetch('/api/revive-personaggio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ cardId }),
      });
      const data = await res.json();
      if (data.success) {
        const newCreds = data.newCredits;
        setLocalCredits(newCreds);
        onCreditsUpdated(newCreds);
        setInjured(prev => prev.filter(c => c.cardId !== cardId));
      } else {
        alert(data.error || 'Impossibile curare il personaggio');
      }
    } catch {
      alert('Errore di rete');
    } finally {
      setReviving(prev => { const s = new Set(prev); s.delete(cardId); return s; });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-gray-950 border-t border-red-500/30 rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: infermeriaLandscape ? '85vh' : '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🩹</span>
            <div>
              <h3 className="text-white font-black text-base">Infermeria</h3>
              <p className="text-white/40 text-xs mt-0.5">Personaggi attualmente infortunati</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-yellow-400 font-bold text-sm">⭐ {localCredits}</span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-3 text-white/50">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              <span className="text-sm">Caricamento...</span>
            </div>
          ) : injured.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">💪</div>
              <p className="text-white/60 text-sm font-bold">Nessun personaggio infortunato</p>
              <p className="text-white/30 text-xs mt-1">Tutti i tuoi personaggi sono in perfetta forma!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {injured.map(card => {
                const canRevive = localCredits >= INFERMERIA_REVIVE_COST;
                const isReviving = reviving.has(card.cardId);
                return (
                  <div
                    key={card.cardId}
                    className="flex items-center gap-3 bg-black/40 rounded-xl p-3 border border-red-500/20"
                  >
                    <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800 border border-white/10 relative">
                      {card.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          className="w-full h-full object-cover grayscale opacity-60"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">🃏</div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="text-base">💀</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{card.name}</p>
                      <p className="text-red-400 text-xs mt-0.5">⛔ Infortunato</p>
                      <p className="text-white/35 text-[10px] mt-0.5">Indisponibile fino alla cura</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <button
                        onClick={() => handleRevive(card.cardId)}
                        disabled={!canRevive || isReviving}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all
                          ${canRevive && !isReviving
                            ? 'bg-yellow-500 hover:bg-yellow-400 text-black cursor-pointer shadow-lg shadow-yellow-500/20'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                      >
                        {isReviving ? (
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin inline-block" />
                          </span>
                        ) : (
                          <>⭐ {INFERMERIA_REVIVE_COST} — Cura</>
                        )}
                      </button>
                      {!canRevive && (
                        <p className="text-red-500/70 text-[10px] mt-1">Rankiard insuff.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GymPathSVG({ count }: { count: number }) {
  const totalH = GYM_PATH_TOP_PAD + count * GYM_PATH_NODE_H + 24;
  const pts = Array.from({ length: count }, (_, i) => ({
    x: i % 2 === 0 ? GYM_NODE_PCT_RIGHT : GYM_NODE_PCT_LEFT,
    y: GYM_PATH_TOP_PAD + i * GYM_PATH_NODE_H + GYM_PATH_NODE_H / 2,
  }));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], n = pts[i];
    const my = (p.y + n.y) / 2;
    d += ` C ${p.x} ${my}, ${n.x} ${my}, ${n.x} ${n.y}`;
  }
  return (
    <svg
      width="100%" height={totalH}
      viewBox={`0 0 100 ${totalH}`}
      preserveAspectRatio="none"
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}
    >
      <defs>
        <linearGradient id="gymGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#4ade80" stopOpacity="0.9" />
          <stop offset="45%"  stopColor="#f59e0b" stopOpacity="1" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.35" />
        </linearGradient>
        <filter id="gymGlow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d={d} fill="none" stroke="rgba(245,158,11,0.04)" strokeWidth={8} strokeLinecap="round" />
      <path
        d={d} fill="none" stroke="url(#gymGrad)" strokeWidth={1.4}
        strokeLinecap="round" strokeDasharray="5 3.5" filter="url(#gymGlow)"
        style={{ animation: 'gymPathDraw 2s ease-out forwards', strokeDashoffset: 1600 }}
      />
    </svg>
  );
}

export function GymMode({ playerName, userId, avatarId, onBack, pendingGymGame, onResumeGymGame, onClearPendingGymGame, onLogin }: GymModeProps) {
  const [leaders, setLeaders] = useState<GymLeader[]>([]);
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('map');
  const [selectedLeader, setSelectedLeader] = useState<GymLeader | null>(null);
  const [gameId, setGameIdLocal] = useState<string | null>(null);
  const [justWon, setJustWon] = useState(false);
  const [storyDeckIds, setStoryDeckIds] = useState<string[]>([]);
  const [deckFetchStatus, setDeckFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [cardPickLoading, setCardPickLoading] = useState(false);
  const [scheaCardId, setScheaCardId] = useState<string | null>(null);
  const [battleYoutubeVideoId, setBattleYoutubeVideoId] = useState<string | null>(null);
  const [musicActive, setMusicActive] = useState(false);
  const [pickedCardId, setPickedCardId] = useState<string | null>(null);
  const [victoryStep, setVictoryStep] = useState(0);
  const [pendingBattle, setPendingBattle] = useState<{ leader: GymLeader; deckIds: string[] } | null>(null);
  const [userCredits, setUserCredits] = useState(0);
  const [isReplayBattle, setIsReplayBattle] = useState(false);
  const [lostLeaderIds, setLostLeaderIds] = useState<number[]>([]);
  const [showDeckPanel, setShowDeckPanel] = useState(false);
  const [deckPanelScheaCardId, setDeckPanelScheaCardId] = useState<string | null>(null);
  const [chosenFaction, setChosenFaction] = useState<string | null>(null);
  const [showWizardCardReveal, setShowWizardCardReveal] = useState(false);
  const [cardEffects, setCardEffects] = useState<Record<string, string>>({});
  const [introTaunt, setIntroTaunt] = useState<string | null>(null);
  const [defeatMsgVisible, setDefeatMsgVisible] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [showInfermeria, setShowInfermeria] = useState(false);
  const [showSecretRoom, setShowSecretRoom] = useState(false);
  const [secretRoomRevealing, setSecretRoomRevealing] = useState(false);
  const [showRedFlash, setShowRedFlash] = useState(false);
  const [taIncoming, setTaIncoming] = useState<{ stepCount: number; attackerName: string } | null>(null);
  const transitionRef = useRef<HTMLDivElement>(null);
  const transitionFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const secretRoomEverRevealedRef = useRef(
    userId ? localStorage.getItem(`secretRoomRevealed_${userId}`) === 'true' : false
  );
  const secretRevealMarksRef = useRef<HTMLDivElement>(null);
  const secretRevealTitleRef = useRef<HTMLDivElement>(null);
  const [storyViewMode, setStoryViewMode] = useState<'3d' | '2d'>(() => {
    try { return (localStorage.getItem('storyViewMode') as '3d' | '2d') || '3d'; } catch { return '3d'; }
  });
  const [hoveredLeaderId, setHoveredLeaderId] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [localities, setLocalities] = useState<StoryLocality[]>([]);
  const [collectibles, setCollectibles] = useState<StoryCollectible[]>([]);
  const [stage13Status, setStage13Status] = useState<any>(null);
  const [showStage13Modal, setShowStage13Modal] = useState(false);
  const [stage13BuildName, setStage13BuildName] = useState('');
  const [stage13BuildColor, setStage13BuildColor] = useState('#7c3aed');
  const [stage13BuildMusicUrl, setStage13BuildMusicUrl] = useState('');
  const [stage13BuildLoading, setStage13BuildLoading] = useState(false);
  const [stage13BuildError, setStage13BuildError] = useState<string | null>(null);
  const [stage13BuildSuccess, setStage13BuildSuccess] = useState(false);
  const [showStage13StealModal, setShowStage13StealModal] = useState(false);
  const [stage13LoserDeck, setStage13LoserDeck] = useState<any[]>([]);
  const [stage13StealLoading, setStage13StealLoading] = useState(false);
  const [stage13StealError, setStage13StealError] = useState<string | null>(null);
  const [stage13StealSuccess, setStage13StealSuccess] = useState(false);

  const selectedLeaderRef = useRef<GymLeader | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const battleStartingRef = useRef(false);
  const isReplayBattleRef = useRef(false);
  const expectedCpusRef = useRef(0);
  const cpusAddedRef = useRef(0);
  const mapScrollRef = useRef<HTMLDivElement | null>(null);
  const quadratoAutoTriggeredRef = useRef(false);

  const isLandscape = useIsLandscape();

  const { setGameId, setPlayerName, generateSessionId, clearSession: reset, setSelectedCard } = useGameState();

  const authToken = localStorage.getItem('authToken');

  const fetchLeaders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gym-leaders', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (!res.ok) {
        console.error(`[GymMode] fetchLeaders: HTTP ${res.status} ${res.statusText}`);
        return;
      }
      const data = await res.json();
      if (data.success) {
        console.log(`[GymMode] fetchLeaders: ${data.gymLeaders?.length ?? 0} leader caricati, ${data.completedIds?.length ?? 0} completati`);
        setLeaders(data.gymLeaders || []);
        setCompletedIds(data.completedIds || []);
        if (data.chosenFaction) setChosenFaction(data.chosenFaction);
      } else {
        console.error('[GymMode] fetchLeaders: risposta non success:', data);
      }
    } catch (err) {
      console.error('[GymMode] fetchLeaders: errore di rete:', err);
    }
    finally { setLoading(false); }
  }, [authToken]);

  const fetchLocalities = useCallback(async () => {
    try {
      const res = await fetch('/api/story-localities');
      const data = await res.json();
      if (data.success && Array.isArray(data.localities)) {
        setLocalities(data.localities);
      }
    } catch { /* silently ignore */ }
  }, []);

  const fetchCollectibles = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/story-mode/collectibles', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.collectibles)) {
        setCollectibles(data.collectibles);
      }
    } catch { /* silently ignore */ }
  }, [authToken]);

  const fetchCardEffects = useCallback(async () => {
    try {
      const res = await fetch('/api/card-modifications');
      const data = await res.json();
      if (data.success && Array.isArray(data.modifications)) {
        const map: Record<string, string> = {};
        for (const mod of data.modifications) {
          if (mod.originalCardId && mod.effect) {
            map[mod.originalCardId] = mod.effect;
          }
        }
        setCardEffects(map);
      }
    } catch {}
  }, []);

  const fetchStoryDeck = useCallback(async () => {
    if (!authToken) return;
    setDeckFetchStatus('loading');
    try {
      const res = await fetch('/api/story-mode/deck', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setStoryDeckIds(data.cardIds || []);
        setDeckFetchStatus('success');
      } else {
        setDeckFetchStatus('error');
      }
    } catch {
      setDeckFetchStatus('error');
    }
  }, [authToken]);

  const fetchUserCredits = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.profile?.user?.puntiRankiard !== undefined) setUserCredits(data.profile.user.puntiRankiard);
    } catch {}
  }, [authToken]);

  const fetchStage13Status = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/story-mode/stage13/status', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setStage13Status(data);
        // Auto-open steal modal if boss has a completed challenge waiting for card steal
        if (data.completedChallengeWaitingSteal && !showStage13StealModal && !stage13StealSuccess) {
          setShowStage13StealModal(true);
          // Fetch loser's deck
          try {
            const deckRes = await fetch(`/api/story-mode/stage13/loser-deck/${data.completedChallengeWaitingSteal.id}`, {
              headers: { Authorization: `Bearer ${authToken}` },
            });
            const deckData = await deckRes.json();
            if (deckData.success) setStage13LoserDeck(deckData.cards || []);
          } catch {}
        }
      }
    } catch {}
  }, [authToken, showStage13StealModal, stage13StealSuccess]);

  useEffect(() => {
    fetchLeaders();
    fetchStoryDeck();
    fetchUserCredits();
    fetchCardEffects();
    fetchLocalities();
    fetchCollectibles();
    fetchStage13Status();
  }, [fetchLeaders, fetchStoryDeck, fetchUserCredits, fetchCardEffects, fetchLocalities, fetchCollectibles, fetchStage13Status]);

  useEffect(() => {
    secretRoomEverRevealedRef.current = userId
      ? localStorage.getItem(`secretRoomRevealed_${userId}`) === 'true'
      : false;
  }, [userId]);

  // Show deck selection screen when user has no story deck and first leader has starterDeckOptions
  useEffect(() => {
    if (loading) return;
    if (phase !== 'map') return;
    if (deckFetchStatus !== 'success') return;
    if (storyDeckIds.length > 0) return;
    if (leaders.length === 0) return;
    const firstLeader = [...leaders].sort((a, b) => a.orderIndex - b.orderIndex)[0];
    if (
      firstLeader &&
      Array.isArray(firstLeader.starterDeckOptions) &&
      firstLeader.starterDeckOptions.length > 0
    ) {
      setPhase('deck-select');
    }
  }, [loading, leaders, storyDeckIds, phase, deckFetchStatus]);

  const regularLeaders = leaders.filter(l => !l.isHidden);
  // Faction-specific Quadrato boss: prefer the hidden leader that matches the player's faction.
  // Fallback to gymName='Quadrato' (covers both Cicchetti/Fabrizio), then name='Quadrato'.
  const quadratoLeader =
    (chosenFaction ? leaders.find(l => l.isHidden && l.requiredFaction === chosenFaction) : null) ??
    leaders.find(l => l.isHidden && l.gymName === 'Quadrato') ??
    leaders.find(l => l.isHidden && l.name === 'Quadrato') ??
    null;
  const quadratoCompleted = quadratoLeader ? completedIds.includes(quadratoLeader.id) : false;

  // 2D mode: auto-trigger Quadrato after all pre-final stages are complete (before Bronx/Zody)
  useEffect(() => {
    if (phase !== 'map') return;
    if (storyViewMode !== '2d') return;
    if (loading) return;
    const qLeader =
      (chosenFaction ? leaders.find(l => l.isHidden && l.requiredFaction === chosenFaction) : null) ??
      leaders.find(l => l.isHidden && l.gymName === 'Quadrato') ??
      leaders.find(l => l.isHidden && l.name === 'Quadrato') ??
      null;
    if (!qLeader) return;
    if (completedIds.includes(qLeader.id)) { quadratoAutoTriggeredRef.current = false; return; }
    if (quadratoAutoTriggeredRef.current) return;
    const regular = leaders.filter(l => !l.isHidden && l.isActive && !l.requiredFaction);
    if (regular.length === 0) return;
    // Find the max orderIndex (final group, e.g. Bronx/Zody at 12)
    const maxOrdIdx = Math.max(...regular.map(l => l.orderIndex));
    const preFinalRegular = regular.filter(l => l.orderIndex < maxOrdIdx);
    if (preFinalRegular.length === 0) return;
    const allPreFinalDone = preFinalRegular.every(l => completedIds.includes(l.id));
    if (!allPreFinalDone) return;
    quadratoAutoTriggeredRef.current = true;
    setTimeout(() => {
      setSelectedLeader(qLeader);
      selectedLeaderRef.current = qLeader;
      setPhase('intro');
    }, 800);
  }, [phase, storyViewMode, loading, leaders, completedIds, chosenFaction]);

  useEffect(() => {
    selectedLeaderRef.current = selectedLeader;
  }, [selectedLeader]);

  useEffect(() => {
    if (phase === 'intro' && selectedLeader) {
      const msgs = selectedLeader.leaderMessages?.gameStart;
      if (Array.isArray(msgs) && msgs.length > 0) {
        setIntroTaunt(msgs[Math.floor(Math.random() * msgs.length)]);
      } else {
        setIntroTaunt(null);
      }
    } else {
      setIntroTaunt(null);
    }
  }, [phase, selectedLeader]);

  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  useEffect(() => {
    const handleGameVictory = ({ winner }: { winner: string }) => {
      const gid = gameIdRef.current;
      if (!gid) return;
      const actuallyWon = winner && winner.toLowerCase() === playerName.toLowerCase();
      if (actuallyWon) {
        setJustWon(true);
        const leader = selectedLeaderRef.current;
        const isReplay = isReplayBattleRef.current;
        // Card-pick reward only on FIRST win — skip it when replaying a completed stage
        if (!isReplay && leader && leader.customDeck && leader.customDeck.length > 0) {
          setPhase('card-pick');
        } else {
          setPhase('victory');
        }
      } else {
        setPhase('defeat');
      }
    };
    socket.on('game-victory', handleGameVictory);
    return () => { socket.off('game-victory', handleGameVictory); };
  }, [playerName]);

  useEffect(() => {
    const handleTaAttackStep = ({ stepCount, attackerName }: { stepCount: number; attackerName: string }) => {
      setTaIncoming({ stepCount, attackerName });
      setTimeout(() => setTaIncoming(null), 700);
    };
    socket.on('ta-attack-step', handleTaAttackStep);
    return () => { socket.off('ta-attack-step', handleTaAttackStep); };
  }, []);

  useEffect(() => {
    const handleCpuAdded = ({ cpuName }: { cpuName: string }) => {
      const leader = selectedLeaderRef.current;
      const gid = gameIdRef.current;
      if (!gid || !leader) return;

      cpusAddedRef.current += 1;
      const expected = expectedCpusRef.current;
      console.log(`[GymMode] CPU added (${cpuName}) ${cpusAddedRef.current}/${expected}`);

      // Start the game only after ALL CPUs have been added
      if (cpusAddedRef.current >= expected) {
        const livesLimit = leader.livesCount > 0 ? String(leader.livesCount) : '3';
        console.log(`[GymMode] All ${expected} CPUs ready — starting game ${gid} characterLimit=${livesLimit}`);
        setTimeout(() => {
          socket.emit('start-game', {
            gameId: gid,
            playerName,
            characterLimit: livesLimit,
          });
        }, 400);
      }
    };
    socket.on('training-cpu-added', handleCpuAdded);
    return () => { socket.off('training-cpu-added', handleCpuAdded); };
  }, [playerName]);

  useEffect(() => {
    if (phase === 'victory' && justWon && selectedLeader && authToken) {
      const isQuadratoFight = quadratoLeader && selectedLeader.id === quadratoLeader.id;
      const idsToComplete = isQuadratoFight
        ? [selectedLeader.id, ...leaders.filter(l => l.isHidden && l.id !== selectedLeader.id && l.orderIndex === selectedLeader.orderIndex).map(l => l.id)]
        : [selectedLeader.id];
      Promise.all(idsToComplete.map(id =>
        fetch(`/api/gym-leaders/${id}/complete`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        })
      )).then(() => {
        setCompletedIds(prev => {
          const next = [...prev];
          for (const id of idsToComplete) { if (!next.includes(id)) next.push(id); }
          return next;
        });
        setJustWon(false);
      }).catch(() => {});
    }
  }, [phase, justWon, selectedLeader, authToken, quadratoLeader, leaders]);

  useEffect(() => {
    if (phase !== 'victory') { setVictoryStep(0); return; }
    setVictoryStep(1);
    const t1 = setTimeout(() => setVictoryStep(2), 700);
    const t2 = setTimeout(() => setVictoryStep(3), 2000);
    const t3 = setTimeout(() => setVictoryStep(4), 3500);
    const t4 = setTimeout(() => setVictoryStep(5), 4800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'defeat') { setDefeatMsgVisible(false); return; }
    const t = setTimeout(() => setDefeatMsgVisible(true), 600);
    return () => clearTimeout(t);
  }, [phase]);

  /* Phase transition: instant-black overlay, then fade to reveal new content */
  useLayoutEffect(() => {
    const el = transitionRef.current;
    if (!el) return;
    el.style.transition = 'none';
    el.style.opacity = '1';
  }, [phase]);

  useEffect(() => {
    const el = transitionRef.current;
    if (!el) return;
    if (transitionFadeRef.current) clearTimeout(transitionFadeRef.current);
    transitionFadeRef.current = setTimeout(() => {
      if (el) {
        el.style.transition = 'opacity 350ms ease-out';
        el.style.opacity = '0';
      }
    }, 160);
    return () => { if (transitionFadeRef.current) clearTimeout(transitionFadeRef.current); };
  }, [phase]);

  /* Defeat: brief red flash on entering defeat screen */
  useEffect(() => {
    if (phase !== 'defeat') { setShowRedFlash(false); return; }
    if (redFlashTimerRef.current) clearTimeout(redFlashTimerRef.current);
    setShowRedFlash(true);
    redFlashTimerRef.current = setTimeout(() => setShowRedFlash(false), 350);
    return () => { if (redFlashTimerRef.current) clearTimeout(redFlashTimerRef.current); };
  }, [phase]);

  /* Inject cinematic keyframes into document head — always available across all phases */
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.id = 'gym-mode-keyframes';
    styleEl.textContent = GYM_PATH_STYLES;
    document.head.appendChild(styleEl);
    return () => { styleEl.remove(); };
  }, []);

  // ── Secret Room GSAP reveal animation ────────────────────────────────────
  useEffect(() => {
    if (!secretRoomRevealing) return;
    const marks = secretRevealMarksRef.current;
    const title = secretRevealTitleRef.current;
    if (!marks || !title) {
      // Fallback: no DOM yet, open directly
      setSecretRoomRevealing(false);
      setShowSecretRoom(true);
      return;
    }
    gsap.set(title, { scale: 0.4, opacity: 0, rotate: -10 });
    const tl = gsap.timeline({
      onComplete: () => {
        setSecretRoomRevealing(false);
        setShowSecretRoom(true);
      },
    });
    tl.to(marks, { scale: 2.2, opacity: 0, duration: 0.35, ease: 'power2.in' })
      .to(title, { scale: 1, opacity: 1, rotate: 0, duration: 0.65, ease: 'elastic.out(1, 0.45)' }, '-=0.05')
      .to({}, { duration: 0.5 });
  }, [secretRoomRevealing]);

  const startBattle = useCallback(async (leader: GymLeader) => {
    battleStartingRef.current = false;
    setSelectedLeader(leader);
    selectedLeaderRef.current = leader;

    let currentDeckIds: string[] = [];
    if (authToken) {
      try {
        const deckRes = await fetch('/api/story-mode/deck', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const deckData = await deckRes.json();
        if (deckData.success) {
          currentDeckIds = deckData.cardIds || [];
          setStoryDeckIds(currentDeckIds);
        }
      } catch {}
    }

    // Legacy playerStartingDeck fallback is intentionally removed.
    // When starterDeckOptions is configured, the deck-select phase handles initialization.
    // When neither is configured, the deck stays empty until the user wins and picks cards.

    setPendingBattle({ leader, deckIds: currentDeckIds });
  }, [authToken]);

  const doStartBattle = useCallback((leader: GymLeader, filteredDeckIds: string[]) => {
    if (battleStartingRef.current) return;
    battleStartingRef.current = true;
    setPendingBattle(null);

    reset();

    if (authToken) {
      fetch('/api/decrement-injured-personaggi', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
    }

    const newGameId = `gym-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setGameIdLocal(newGameId);
    gameIdRef.current = newGameId;

    setGameId(newGameId);
    setPlayerName(playerName);
    generateSessionId();

    // Count how many CPUs we'll add and reset the counter
    const totalCpus = Math.max(1, leader.cpuCount || 1);
    expectedCpusRef.current = totalCpus;
    cpusAddedRef.current = 0;

    socket.emit('create-training-game', {
      gameId: newGameId,
      playerName,
      avatarId,
      userId,
      helpEnabled: false,
      isGymMode: true,
      playerDeck: filteredDeckIds.length > 0 ? filteredDeckIds : undefined,
      livesCount: leader.livesCount || 3,
    });

    const attackMode = leader.attackMode || 'free_for_all';

    // Add primary boss CPU after 800ms
    setTimeout(() => {
      socket.emit('add-training-cpu', {
        gameId: newGameId,
        isGymMode: true,
        customDeck: leader.customDeck && leader.customDeck.length > 0 ? leader.customDeck : undefined,
        cpuLevel: leader.cpuLevel,
        leaderName: leader.name,
        leaderImageUrl: leader.leaderImageUrl || undefined,
        leaderMessages: leader.leaderMessages || undefined,
        attackMode,
        gymLeaderId: leader.id,
      });
    }, 800);

    // Add additional CPUs with 400ms spacing
    if (totalCpus > 1) {
      for (let i = 0; i < totalCpus - 1; i++) {
        const cfg = Array.isArray(leader.cpuConfigs) ? leader.cpuConfigs[i] : undefined;
        const delay = 800 + (i + 1) * 500;
        setTimeout(() => {
          socket.emit('add-training-cpu', {
            gameId: newGameId,
            isGymMode: true,
            customDeck: cfg?.customDeck && cfg.customDeck.length > 0 ? cfg.customDeck : (leader.customDeck && leader.customDeck.length > 0 ? leader.customDeck : undefined),
            cpuLevel: cfg?.cpuLevel || leader.cpuLevel || 'hard',
            leaderName: cfg?.name || undefined,
            leaderImageUrl: cfg?.imageUrl || undefined,
            leaderMessages: cfg?.leaderMessages || undefined,
            attackMode,
          });
        }, delay);
      }
    }

    const ytId = leader.youtubeMusicUrl ? extractYoutubeVideoId(leader.youtubeMusicUrl) : null;
    setBattleYoutubeVideoId(ytId);

    pauseHomeMusic();
    setPhase('battle');
  }, [playerName, avatarId, userId, setGameId, setPlayerName, generateSessionId, authToken, reset]);

  // Resume an already-existing gym game without re-creating it: just rejoin + show battle HUD
  const handleInternalResume = useCallback((leader: GymLeader, gameIdToResume: string) => {
    setSelectedLeader(leader);
    selectedLeaderRef.current = leader;
    setGameIdLocal(gameIdToResume);
    gameIdRef.current = gameIdToResume;

    setGameId(gameIdToResume);
    setPlayerName(playerName);
    generateSessionId();
    setSelectedCard(null);

    const ytId = leader.youtubeMusicUrl ? extractYoutubeVideoId(leader.youtubeMusicUrl) : null;
    setBattleYoutubeVideoId(ytId);
    pauseHomeMusic();

    // CRITICAL: Show battle IMMEDIATELY without waiting for game-state-update
    // The server auto-rejoin (via set-user-data) happens in background and sends game-state-update
    // But we don't need to wait for it - the game state is already in our local cache from GameBoard
    // So we can show the battle UI immediately and let it sync asynchronously
    console.log('[GymMode] Showing battle immediately for resumed game', gameIdToResume);
    setPhase('battle');
  }, [playerName, setGameId, setPlayerName, generateSessionId, setSelectedCard]);

  const handleBackFromBattle = () => {
    if (gameId) {
      socket.emit('leave-game', { gameId });
    }
    setGameIdLocal(null);
    setBattleYoutubeVideoId(null);
    setMusicActive(false);
    setPhase('map');
    setSelectedLeader(null);
    resumeHomeMusic();
    fetchLeaders();
    setTimeout(() => reset(), 150);
  };

  const handleReset = async () => {
    if (!authToken || resetLoading) return;
    setResetLoading(true);
    setResetError(null);
    try {
      const res = await fetch('/api/story-mode/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setCompletedIds([]);
        setStoryDeckIds([]);
        setLostLeaderIds([]);
        setChosenFaction(null);
        setShowResetConfirm(false);
        fetchUserCredits();
        setPhase('deck-select');
      } else {
        setResetError(data.error || 'Errore durante il reset. Riprova.');
      }
    } catch {
      setResetError('Errore di rete. Controlla la connessione e riprova.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleChallengeLeader = (leader: GymLeader) => {
    const replay = completedIds.includes(leader.id);
    isReplayBattleRef.current = replay;
    setIsReplayBattle(replay);
    setSelectedLeader(leader);

    // Cinematic flash before transitioning to intro phase
    const el = transitionRef.current;
    if (el) {
      el.style.transition = 'none';
      el.style.background = 'radial-gradient(ellipse at center, rgba(255,210,60,0.95) 0%, rgba(220,50,10,0.85) 35%, #000 70%)';
      el.style.opacity = '0';
      gsap.timeline()
        .to(el, { opacity: 1, duration: 0.15, ease: 'power3.in' })
        .call(() => {
          el.style.background = '#000';
          setPhase('intro');
        });
    } else {
      setPhase('intro');
    }
  };

  const handlePickCard = async (cardId: string) => {
    if (!authToken || cardPickLoading) return;
    setCardPickLoading(true);
    try {
      const res = await fetch('/api/story-mode/deck/add-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ cardId }),
      });
      const data = await res.json();
      if (data.success) {
        setStoryDeckIds(data.cardIds || []);
      }
    } catch {}
    finally {
      setCardPickLoading(false);
      if (justWon && selectedLeader && authToken) {
        const isQFight = quadratoLeader && selectedLeader.id === quadratoLeader.id;
        const idsToMark = isQFight
          ? [selectedLeader.id, ...leaders.filter(l => l.isHidden && l.id !== selectedLeader.id && l.orderIndex === selectedLeader.orderIndex).map(l => l.id)]
          : [selectedLeader.id];
        Promise.all(idsToMark.map(id =>
          fetch(`/api/gym-leaders/${id}/complete`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` },
          })
        )).then(() => {
          setCompletedIds(prev => {
            const next = [...prev];
            for (const id of idsToMark) { if (!next.includes(id)) next.push(id); }
            return next;
          });
          setJustWon(false);
        }).catch(() => {});
      }
      setPickedCardId(cardId);
      setPhase('victory');
    }
  };

  const getLeaderStatus = (leader: GymLeader) => {
    if (completedIds.includes(leader.id)) return 'completed';
    const allBefore = leaders
      .filter(l => l.orderIndex < leader.orderIndex)
      .every(l => completedIds.includes(l.id));
    if (allBefore) return 'available';
    return 'locked';
  };

  /* Wizard reward card: Bullox → bonus-51 (Evoluzione gialla), Horsy → bonus-53 (Evoluzione verde) */
  const wizardCardId   = chosenFaction === 'bullox' ? 'bonus-51' : 'bonus-53';
  const wizardCardImg  = chosenFaction === 'bullox'
    ? 'https://i.postimg.cc/nzwGjs2N/evoluzione-giallo.png'
    : 'https://i.postimg.cc/J0f3x99q/evoluzione-verde.png';
  const wizardCardName = chosenFaction === 'bullox' ? 'Evoluzione Gialla' : 'Evoluzione Verde';
  const wizardCardReceived = storyDeckIds.includes(wizardCardId);

  const handleWizardCard = useCallback(async () => {
    if (!authToken || wizardCardReceived) return;
    try {
      const res = await fetch('/api/story-mode/deck/add-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ cardId: wizardCardId }),
      });
      if (res.ok) {
        setStoryDeckIds(prev => [...prev, wizardCardId]);
        setShowWizardCardReveal(true);
      }
    } catch (e) {
      console.error('[GymMode] wizard card add failed:', e);
    }
  }, [authToken, wizardCardId, wizardCardReceived]);

  const currentLeader = regularLeaders.find(l => getLeaderStatus(l) === 'available');
  const activeLeaders = regularLeaders.filter(l => l.isActive).sort((a, b) => a.orderIndex - b.orderIndex);
  // Stage 13 status confirms server-side that all regular leaders (Stage 1-12) are completed.
  // The secret room is unlocked only once Stage 13 status is loaded and story is confirmed complete.
  const allLeadersCompleted =
    stage13Status !== null &&
    !!stage13Status?.storyCompleted &&
    activeLeaders.length > 0 &&
    activeLeaders.every(l => completedIds.includes(l.id));

  // ── INJURED DISCLAIMER — shown at root level regardless of current phase ───
  if (pendingBattle) {
    return (
      <InjuredPersonaggiDisclaimer
        authToken={authToken || ''}
        relevantCardIds={pendingBattle.deckIds}
        userCredits={userCredits}
        onCreditsUpdated={(c) => setUserCredits(c)}
        onConfirm={(filteredIds) => doStartBattle(pendingBattle.leader, filteredIds)}
        onCancel={() => { setPendingBattle(null); setPhase('map'); setSelectedLeader(null); }}
      />
    );
  }

  // ── GUEST WALL ────────────────────────────────────────────────────────────
  if (!authToken) {
    return (
      <div style={{ position: 'fixed', inset: 0 }}>
        <GuestWall onLogin={onLogin || (() => {})} featureName="la Story Mode" />
        <button
          onClick={onBack}
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 110,
            background: 'rgba(255,255,255,0.07)',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
          }}
        >
          <ArrowLeft width={16} height={16} />
          Indietro
        </button>
      </div>
    );
  }

  // ── DECK SELECTION ────────────────────────────────────────────────────────
  if (phase === 'deck-select') {
    const firstLeader = [...leaders].sort((a, b) => a.orderIndex - b.orderIndex)[0];
    const opts: StarterDeckOption[] = firstLeader?.starterDeckOptions || [];
    return (
      <StarterDeckSelection
        options={opts}
        playerName={playerName}
        gymLeaderId={firstLeader?.id ?? 0}
        authToken={authToken ?? ''}
        onSelected={(cardIds) => {
          setStoryDeckIds(cardIds);
          setPhase('map');
        }}
      />
    );
  }

  // ── BATTLE ────────────────────────────────────────────────────────────────
  if (phase === 'battle' && gameId && selectedLeader) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Phase transition flash */}
        <div ref={transitionRef} className="fixed inset-0 z-[300] bg-black pointer-events-none" style={{ opacity: 0 }} />
        {battleYoutubeVideoId && musicActive && (
          <iframe
            key={battleYoutubeVideoId}
            src={`https://www.youtube.com/embed/${battleYoutubeVideoId}?autoplay=1&loop=1&playlist=${battleYoutubeVideoId}&controls=0`}
            allow="autoplay"
            style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            title="battle-music"
          />
        )}
        <div className="fixed top-4 left-4 z-[60] flex items-center gap-2 flex-wrap">
          <button
            onClick={handleBackFromBattle}
            className="px-3 py-2 bg-black/80 hover:bg-black/95 text-white rounded-xl text-sm font-semibold flex items-center gap-2 border border-white/20 backdrop-blur-sm shadow-lg"
          >
            <ArrowLeft className="w-4 h-4" /> Abbandona
          </button>
          <div className="bg-black/80 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2 flex items-center gap-2 shadow-lg">
            {selectedLeader.leaderImageUrl ? (
              <img src={selectedLeader.leaderImageUrl} alt={selectedLeader.name} className="w-6 h-6 rounded-full object-cover border border-yellow-400/40" />
            ) : (
              <Shield className="w-4 h-4 text-yellow-400" />
            )}
            <div>
              <span className="text-white text-xs font-black">{selectedLeader.gymName}</span>
              <span className="text-white/40 text-xs ml-1.5">vs {selectedLeader.name}</span>
            </div>
          </div>
          {(selectedLeader.cpuCount ?? 1) > 1 && (
            <div className="bg-black/80 backdrop-blur-sm border border-purple-500/30 rounded-xl px-3 py-2 flex items-center gap-1.5 shadow-lg">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-white text-xs font-bold">{selectedLeader.cpuCount} CPU</span>
            </div>
          )}
          {selectedLeader.attackMode === 'hunt_human' && (
            <div className="bg-black/80 backdrop-blur-sm border border-red-500/30 rounded-xl px-2.5 py-2 flex items-center gap-1 shadow-lg">
              <Target className="w-3.5 h-3.5 text-red-400" />
              <span className="text-red-300 text-[10px] font-black">TUTTI vs TE</span>
            </div>
          )}
          <div className="bg-black/80 backdrop-blur-sm border border-red-500/30 rounded-xl px-3 py-2 flex items-center gap-1 shadow-lg">
            {Array.from({ length: selectedLeader.livesCount || 3 }).map((_, i) => (
              <Heart key={i} className="w-3.5 h-3.5 text-red-400 fill-red-400" />
            ))}
          </div>
          {battleYoutubeVideoId && (
            <button
              onClick={() => setMusicActive(a => !a)}
              title={musicActive ? 'Disattiva musica' : 'Attiva musica'}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border backdrop-blur-sm transition-colors shadow-lg ${
                musicActive
                  ? 'bg-red-600/80 hover:bg-red-700/90 text-white border-red-400/40'
                  : 'bg-black/80 hover:bg-black/95 text-white/60 hover:text-white border-white/20'
              }`}
            >
              {musicActive ? '🎵 On' : '🎵 Off'}
            </button>
          )}
        </div>
        {/* TARGET ACQUIRED per-step incoming indicator — shown during active battle */}
        {taIncoming && (
          <div className="fixed inset-0 z-[160] pointer-events-none flex items-start justify-center pt-24">
            <div
              className="bg-red-900/90 border border-red-500 rounded-2xl px-6 py-3 text-white font-bold text-lg shadow-2xl shadow-red-900/70"
              style={{ animation: 'gymDefeatRedFlash 700ms ease-out forwards', textShadow: '0 0 12px #ff0000' }}
            >
              🎯 Colpo {taIncoming.stepCount} in arrivo da {taIncoming.attackerName}!
            </div>
          </div>
        )}
        <GameBoard isGymMode={true} />
      </div>
    );
  }

  // ── CARD PICK ─────────────────────────────────────────────────────────────
  if (phase === 'card-pick' && selectedLeader && selectedLeader.customDeck && selectedLeader.customDeck.length > 0) {
    const pickableCards = selectedLeader.customDeck;
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{
          background: selectedLeader.backgroundImageUrl
            ? `linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0.97)), url(${selectedLeader.backgroundImageUrl}) center/cover`
            : 'linear-gradient(135deg, #1a0a2e 0%, #0a1a2e 100%)',
        }}
      >
        {/* Phase transition flash */}
        <div ref={transitionRef} className="fixed inset-0 z-[300] bg-black pointer-events-none" style={{ opacity: 0 }} />
        <div className="flex-shrink-0 text-center pt-10 pb-4 px-4" style={{ animation: 'gymIntroSlideUp 500ms ease-out both' }}>
          <div className="text-5xl mb-2">✨</div>
          <h2 className="text-yellow-300 font-black text-2xl mb-1">Scegli una carta!</h2>
          <p className="text-white/60 text-sm">
            Hai sconfitto il Boss <span className="text-yellow-300 font-bold">{selectedLeader.name}</span> dello Stage <span className="text-yellow-200 font-bold">{selectedLeader.gymName}</span>!
          </p>
          <p className="text-white/40 text-xs mt-2">Scegli una carta da aggiungere al tuo mazzo Story Mode • {storyDeckIds.length} carte nel mazzo</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="flex flex-col gap-4 max-w-sm mx-auto">
            {pickableCards.map((cardId, idx) => {
              const imgUrl = getCardImageFromId(cardId);
              const label = getCardDeckLabel(cardId);
              const copiesInDeck = storyDeckIds.filter(id => id === cardId).length;
              return (
                <button
                  key={`${cardId}-${idx}`}
                  onClick={() => setScheaCardId(cardId)}
                  disabled={cardPickLoading}
                  className="relative flex items-stretch gap-3 rounded-xl overflow-hidden border-2 border-white/20 hover:border-yellow-400 hover:shadow-lg hover:shadow-yellow-400/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed bg-gray-900/80 text-left"
                  style={{ animation: 'gymCardDealIn 380ms ease-out both', animationDelay: `${idx * 80}ms` }}
                >
                  {/* Card thumbnail */}
                  <div className="flex-shrink-0 w-20 aspect-[2/3] relative overflow-hidden">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-800">
                        <Shield className="w-8 h-8 text-white/20" />
                      </div>
                    )}
                  </div>
                  {/* Card info */}
                  <div className="flex-1 flex flex-col justify-center py-3 pr-3 gap-1.5">
                    <span className="text-white font-black text-sm leading-tight">{getCardNameFromId(cardId)}</span>
                    <span className="text-yellow-400/70 text-[10px] font-bold uppercase tracking-wide">{label}</span>
                    <p className="text-white/55 text-[10px] leading-snug line-clamp-2">
                      {cardEffects[cardId]
                        ? cardEffects[cardId].split('[')[0].trim()
                        : label === 'Personaggio' || label === 'Speciale'
                          ? 'Combattente con PTI e stelle'
                          : label === 'Mossa'
                            ? 'Tecnica da usare in battaglia'
                            : 'Carta speciale che cambia le sorti del gioco'}
                    </p>
                    {copiesInDeck > 0 && (
                      <span className="inline-flex items-center gap-1 bg-blue-900/60 border border-blue-500/40 text-blue-300 text-[10px] font-bold rounded-full px-2 py-0.5 w-fit">
                        Hai già {copiesInDeck} {copiesInDeck === 1 ? 'copia' : 'copie'}
                      </span>
                    )}
                    {copiesInDeck === 0 && (
                      <span className="inline-flex items-center gap-1 bg-green-900/40 border border-green-500/30 text-green-400 text-[10px] font-bold rounded-full px-2 py-0.5 w-fit">
                        Nuova!
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-yellow-400/80 text-xs font-bold">
                      <span>Tocca per scegliere</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                  {cardPickLoading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scheda carta overlay */}
        {scheaCardId && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full sm:max-w-md bg-gray-900 border border-indigo-500/40 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <ClipboardList size={15} className="text-indigo-400" />
                  <span className="text-white font-bold text-sm">Scheda carta</span>
                </div>
                <button
                  onClick={() => setScheaCardId(null)}
                  className="text-white/40 hover:text-white transition-colors p-1"
                >
                  <X size={16} />
                </button>
              </div>
              {/* Sheet */}
              <div className="flex-1 overflow-y-auto p-4">
                <CardInfoSheet cardId={scheaCardId} compact />
              </div>
              {/* Action buttons */}
              <div className="px-4 py-3 border-t border-white/10 flex gap-2 shrink-0">
                <button
                  onClick={() => setScheaCardId(null)}
                  className="flex-1 py-2 rounded-lg border border-white/20 text-white/60 text-sm font-bold hover:bg-white/5 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={() => { const id = scheaCardId; setScheaCardId(null); handlePickCard(id!); }}
                  disabled={cardPickLoading}
                  className="flex-2 py-2 px-4 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-black transition-colors disabled:opacity-50"
                >
                  ✅ Scegli questa carta
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── VICTORY ───────────────────────────────────────────────────────────────
  if (phase === 'victory' && selectedLeader) {
    const pickedImgUrl = pickedCardId ? getCardImageFromId(pickedCardId) : null;
    const pickedLabel = pickedCardId ? getCardDeckLabel(pickedCardId) : null;
    return (
      <div
        className="fixed inset-0 z-50 overflow-y-auto"
        style={{
          background: selectedLeader.backgroundImageUrl
            ? `linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0.97)), url(${selectedLeader.backgroundImageUrl}) center/cover`
            : 'linear-gradient(135deg, #0d0820 0%, #0a1a0e 100%)',
        }}
      >
        {/* Phase transition flash */}
        <div ref={transitionRef} className="fixed inset-0 z-[300] bg-black pointer-events-none" style={{ opacity: 0 }} />
        {/* Confetti burst — appears when victoryStep >= 1 */}
        {victoryStep >= 1 && !isReplayBattle && CONFETTI_DATA.map((c, i) => (
          <div
            key={i}
            className="fixed top-0 pointer-events-none z-[100]"
            style={{
              left: `${c.x}%`,
              width: c.size,
              height: c.size * 0.6,
              backgroundColor: c.color,
              borderRadius: 2,
              animationDelay: `${c.delay}ms`,
              animationDuration: `${c.duration}ms`,
              animationFillMode: 'both',
              animationName: 'gymConfettiFall',
              animationTimingFunction: 'ease-in',
              '--conf-spin': `${c.spin}deg`,
            } as React.CSSProperties}
          />
        ))}
        <div className="min-h-full flex flex-col items-center justify-center px-6 py-12 gap-6">
          <div
            className="text-center transition-all duration-700"
            style={{ opacity: victoryStep >= 1 ? 1 : 0, transform: victoryStep >= 1 ? 'translateY(0)' : 'translateY(-30px)' }}
          >
            <div className="text-7xl mb-3">🏆</div>
            <h2 className="text-yellow-300 font-black text-4xl tracking-wide drop-shadow-lg">VITTORIA!</h2>
            <p className="text-white/60 mt-2 text-sm">
              Hai sconfitto <span className="text-yellow-200 font-bold">{selectedLeader.name}</span> dello Stage <span className="text-yellow-200 font-bold">{selectedLeader.gymName}</span>!
            </p>
            {isReplayBattle ? (
              <div className="bg-white/10 border border-white/20 rounded-xl px-5 py-2 mt-3 inline-block">
                <p className="text-white/60 font-bold text-sm">Nessun premio — avversario già battuto</p>
              </div>
            ) : (
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl px-5 py-2 mt-3 inline-block">
                <p className="text-yellow-300 font-black text-xl">+{selectedLeader.rewardCredits} Rankiard</p>
              </div>
            )}
          </div>

          <div
            className="flex flex-col items-center text-center transition-all duration-700"
            style={{ opacity: victoryStep >= 2 ? 1 : 0, transform: victoryStep >= 2 ? 'scale(1)' : 'scale(0.3)' }}
          >
            {selectedLeader.badgeImageUrl ? (
              <>
                <div
                  className="rounded-full mb-3"
                  style={{
                    boxShadow: victoryStep >= 2 ? (isReplayBattle ? '0 0 20px 6px rgba(150,150,150,0.4)' : '0 0 40px 12px rgba(234,179,8,0.6), 0 0 80px 20px rgba(234,179,8,0.25)') : 'none',
                    transition: 'box-shadow 0.8s ease',
                    animation: !isReplayBattle && victoryStep >= 2 ? 'gymBadgeGlowPulse 1.2s ease-in-out 3' : undefined,
                  }}
                >
                  <img src={selectedLeader.badgeImageUrl} alt="medaglia" className={`w-28 h-28 object-cover rounded-full border-4 ${isReplayBattle ? 'border-white/30 opacity-60' : 'border-yellow-400'}`} />
                </div>
                <p className={`font-black text-lg tracking-wide ${isReplayBattle ? 'text-white/50' : 'text-yellow-300'}`}>
                  {isReplayBattle ? '🔄 Già conquistata' : '⭐ Medaglia conquistata!'}
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center mb-3 ${isReplayBattle ? 'bg-white/10 border-white/30' : 'bg-yellow-500/20 border-yellow-400'}`}
                  style={{ boxShadow: victoryStep >= 2 ? (isReplayBattle ? 'none' : '0 0 40px 12px rgba(234,179,8,0.5)') : 'none', transition: 'box-shadow 0.8s ease' }}>
                  <Star className={`w-12 h-12 ${isReplayBattle ? 'text-white/30' : 'text-yellow-300'}`} />
                </div>
                <p className={`font-black text-lg ${isReplayBattle ? 'text-white/50' : 'text-yellow-300'}`}>
                  {isReplayBattle ? '🔄 Stage già completato' : '⭐ Stage completato!'}
                </p>
              </div>
            )}
          </div>

          {pickedImgUrl && (
            <div
              className="flex flex-col items-center text-center transition-all duration-700"
              style={{ opacity: victoryStep >= 3 ? 1 : 0, transform: victoryStep >= 3 ? 'translateY(0)' : 'translateY(20px)' }}
            >
              <p className="text-white/50 text-xs mb-2">Carta ottenuta</p>
              <div className="w-20 h-28 rounded-xl overflow-hidden border-2 border-yellow-400/60 shadow-lg shadow-yellow-400/20">
                <img src={pickedImgUrl} alt={pickedLabel || ''} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <p className="text-yellow-300 text-xs font-bold mt-1">{pickedLabel}</p>
            </div>
          )}

          {/* Mini-summary post-victory */}
          <div
            className="w-full max-w-xs transition-all duration-700"
            style={{ opacity: victoryStep >= 4 ? 1 : 0, transform: victoryStep >= 4 ? 'translateY(0)' : 'translateY(20px)' }}
          >
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-white/50 text-[10px] font-black uppercase tracking-widest mb-3 text-center">Riepilogo</p>
              <div className="flex justify-around gap-3">
                <div className="text-center">
                  <p className="text-yellow-300 font-black text-2xl leading-tight">
                    {completedIds.includes(selectedLeader.id)
                      ? completedIds.length
                      : completedIds.length + 1}
                  </p>
                  <p className="text-white/40 text-[10px] mt-0.5">Vittorie</p>
                </div>
                <div className="w-px bg-white/10" />
                <div className="text-center">
                  <p className="text-blue-300 font-black text-2xl leading-tight">
                    {Math.max(0, activeLeaders.length - (completedIds.includes(selectedLeader.id) ? completedIds.length : completedIds.length + 1))}
                  </p>
                  <p className="text-white/40 text-[10px] mt-0.5">Boss rimasti</p>
                </div>
                <div className="w-px bg-white/10" />
                <div className="text-center">
                  <p className="text-green-300 font-black text-2xl leading-tight">{storyDeckIds.length}</p>
                  <p className="text-white/40 text-[10px] mt-0.5">Carte mazzo</p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="transition-all duration-700"
            style={{ opacity: victoryStep >= 5 ? 1 : 0, transform: victoryStep >= 5 ? 'translateY(0)' : 'translateY(10px)', pointerEvents: victoryStep >= 5 ? 'auto' : 'none' }}
          >
            <button
              disabled={victoryStep < 5}
              onClick={async () => {
                onClearPendingGymGame?.();
                fetchLeaders();
                fetchUserCredits();
                // Check if user just completed all 12 gyms → show Stage 13 modal
                try {
                  const res = await fetch('/api/story-mode/stage13/status', {
                    headers: { Authorization: `Bearer ${authToken}` },
                  });
                  const data = await res.json();
                  if (data.success) {
                    setStage13Status(data);
                    if (data.storyCompleted && (data.canBuild || data.visibleStage)) {
                      setShowStage13Modal(true);
                      setStage13BuildSuccess(false);
                      setStage13BuildError(null);
                      setSelectedLeader(null);
                      setPhase('map');
                      return;
                    }
                  }
                } catch {}
                setPhase('map');
                setSelectedLeader(null);
              }}
              className="px-8 py-3.5 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-lg rounded-2xl transition-all shadow-xl shadow-yellow-500/30 active:scale-95 disabled:cursor-not-allowed"
            >
              Torna alla Mappa
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── DEFEAT ────────────────────────────────────────────────────────────────
  if (phase === 'defeat' && selectedLeader) {
    const gameLoseMsgs = selectedLeader.leaderMessages?.gameLose;
    const defeatMsg = Array.isArray(gameLoseMsgs) && gameLoseMsgs.length > 0
      ? gameLoseMsgs[Math.floor(Math.random() * gameLoseMsgs.length)]
      : null;

    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
        style={{
          background: selectedLeader.backgroundImageUrl
            ? `linear-gradient(to bottom, rgba(0,0,0,0.88), rgba(20,0,0,0.97)), url(${selectedLeader.backgroundImageUrl}) center/cover`
            : 'linear-gradient(135deg, #1a0000 0%, #0a000e 100%)',
        }}
      >
        {/* Phase transition flash */}
        <div ref={transitionRef} className="fixed inset-0 z-[300] bg-black pointer-events-none" style={{ opacity: 0 }} />
        {/* Red vignette flash */}
        {showRedFlash && (
          <div className="fixed inset-0 z-[150] pointer-events-none bg-red-700" style={{ animation: 'gymDefeatRedFlash 350ms ease-out forwards' }} />
        )}
        {/* Boss avatar with shake — shown above other content */}
        {selectedLeader.leaderImageUrl && (
          <div
            className="mb-2"
            style={{ animation: 'gymBossShake 480ms ease-out 150ms both' }}
          >
            <img
              src={selectedLeader.leaderImageUrl}
              alt={selectedLeader.name}
              className="w-20 h-20 object-cover rounded-2xl border-2 border-red-500/50 shadow-lg shadow-red-900/40"
            />
          </div>
        )}
        <div className="text-7xl mb-4">💀</div>
        <h2 className="text-red-400 font-black text-4xl tracking-wide drop-shadow-lg mb-2">SCONFITTA</h2>
        <p className="text-white/50 text-sm text-center mb-8">
          Il Boss <span className="text-red-300 font-bold">{selectedLeader.name}</span> ti ha battuto.<br />Riprova!
        </p>
        <button
          onClick={() => {
            if (gameId) {
              socket.emit('leave-game', { gameId });
            }
            // Null out gameId immediately so any delayed server events (e.g. game-victory) are ignored
            setGameIdLocal(null);
            gameIdRef.current = null;
            if (selectedLeader) {
              setLostLeaderIds(prev => prev.includes(selectedLeader.id) ? prev : [...prev, selectedLeader.id]);
            }
            onClearPendingGymGame?.();
            battleStartingRef.current = false;
            setPhase('map');
            setSelectedLeader(null);
            fetchLeaders();
          }}
          className="px-8 py-3.5 bg-gray-700 hover:bg-gray-600 text-white font-black text-lg rounded-2xl transition-all active:scale-95 shadow-xl"
        >
          Torna alla Mappa
        </button>

        {/* Boss gameLose message bubble — slides up after 600 ms */}
        {defeatMsg && (
          <div
            className="fixed bottom-8 left-3 z-50 flex items-end gap-0 max-w-[88vw] transition-all duration-500 pointer-events-none"
            style={{
              transform: defeatMsgVisible ? 'translateY(0)' : 'translateY(32px)',
              opacity: defeatMsgVisible ? 1 : 0,
              filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.7))',
            }}
          >
            {/* Boss photo */}
            <div className="flex-shrink-0 relative z-10" style={{ marginBottom: -4, marginRight: -6 }}>
              <div
                className="rounded-full border-2 border-amber-400/70 overflow-hidden"
                style={{
                  width: 72, height: 72,
                  boxShadow: '0 0 18px rgba(245,158,11,0.55), 0 0 36px rgba(245,158,11,0.20)',
                  background: 'linear-gradient(135deg,#1a0a00,#2a1200)',
                }}
              >
                {selectedLeader.leaderImageUrl ? (
                  <img
                    src={selectedLeader.leaderImageUrl}
                    alt={selectedLeader.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Shield size={28} className="text-amber-400/60" />
                  </div>
                )}
              </div>
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ border: '1.5px solid rgba(245,158,11,0.4)', animation: 'gymNodePulse 2s ease-out infinite' }}
              />
            </div>
            {/* Speech bubble */}
            <div
              className="relative rounded-2xl rounded-bl-sm"
              style={{
                background: 'linear-gradient(135deg,rgba(0,0,0,0.92),rgba(15,8,0,0.95))',
                border: '1.5px solid rgba(245,158,11,0.45)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(245,158,11,0.1)',
                backdropFilter: 'blur(16px)',
                padding: '10px 14px',
                maxWidth: 220,
              }}
            >
              {/* Tail */}
              <div style={{
                position: 'absolute', bottom: 8, left: -7,
                width: 0, height: 0,
                borderTop: '7px solid transparent',
                borderBottom: '7px solid transparent',
                borderRight: '8px solid rgba(245,158,11,0.45)',
              }} />
              <div className="font-black text-xs mb-1" style={{ color: '#fbbf24', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                ⚔️ {selectedLeader.name}
              </div>
              <div className="text-sm font-semibold leading-snug" style={{ color: 'rgba(255,235,180,0.92)' }}>
                {defeatMsg}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── INTRO ─────────────────────────────────────────────────────────────────
  if (phase === 'intro' && selectedLeader) {
    const cpuCount = selectedLeader.cpuCount ?? 1;
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{
          background: selectedLeader.backgroundImageUrl
            ? `linear-gradient(to bottom, rgba(0,0,0,0.75), rgba(0,0,0,0.96)), url(${selectedLeader.backgroundImageUrl}) center/cover`
            : 'linear-gradient(135deg, #0d0820 0%, #0a1a2e 100%)',
        }}
      >
        {/* Phase transition flash */}
        <div ref={transitionRef} className="fixed inset-0 z-[300] bg-black pointer-events-none" style={{ opacity: 0 }} />
        {/* Background fades in from black (background-first reveal) */}
        <div className="fixed inset-0 bg-black pointer-events-none" style={{ animationName: 'gymIntroBgFadeIn', animationDuration: '550ms', animationDelay: '0ms', animationFillMode: 'forwards', zIndex: 10 }} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-5" style={{ position: 'relative', zIndex: 20 }}>
            {/* Boss image — cinematic scale-in with glow burst */}
            {selectedLeader.leaderImageUrl ? (
              <div className="relative" style={{ animation: 'gymBossEntry 700ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
                <img
                  src={selectedLeader.leaderImageUrl}
                  alt={selectedLeader.name}
                  className="w-36 h-36 object-cover rounded-3xl border-4 border-yellow-400/40 shadow-2xl shadow-yellow-400/10"
                />
                {/* Boss-arrival particle burst — fires after boss lands (~600ms) */}
                {INTRO_BURST_DATA.map((p, i) => (
                  <div
                    key={i}
                    className="absolute pointer-events-none"
                    style={{
                      top: '50%', left: '50%',
                      width: p.size, height: p.size,
                      borderRadius: '50%',
                      backgroundColor: p.color,
                      marginTop: -p.size / 2, marginLeft: -p.size / 2,
                      transformOrigin: '50% 50%',
                      animationName: 'gymIntroBurst',
                      animationDuration: '700ms',
                      animationDelay: `${590 + p.delay}ms`,
                      animationFillMode: 'both',
                      animationTimingFunction: 'ease-out',
                      '--ba': `${p.angle}deg`,
                      '--bd': `${p.dist}px`,
                    } as React.CSSProperties}
                  />
                ))}
                <div className="absolute -bottom-2 -right-2 bg-orange-600 text-white text-[10px] font-black rounded-full px-2 py-0.5 border-2 border-gray-900">
                  BOSS
                </div>
              </div>
            ) : (
              <div className="relative w-36 h-36 rounded-3xl bg-gray-800 border-4 border-yellow-400/30 flex items-center justify-center" style={{ animation: 'gymBossEntry 700ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
                <Shield className="w-16 h-16 text-yellow-400/40" />
                {INTRO_BURST_DATA.map((p, i) => (
                  <div
                    key={i}
                    className="absolute pointer-events-none"
                    style={{
                      top: '50%', left: '50%',
                      width: p.size, height: p.size,
                      borderRadius: '50%',
                      backgroundColor: p.color,
                      marginTop: -p.size / 2, marginLeft: -p.size / 2,
                      animationName: 'gymIntroBurst',
                      animationDuration: '700ms',
                      animationDelay: `${590 + p.delay}ms`,
                      animationFillMode: 'both',
                      animationTimingFunction: 'ease-out',
                      '--ba': `${p.angle}deg`,
                      '--bd': `${p.dist}px`,
                    } as React.CSSProperties}
                  />
                ))}
              </div>
            )}

            {/* Boss opening taunt — speech bubble slides up ~500ms after boss image lands (~700ms entry + 500ms delay) */}
            {introTaunt && (
              <div
                className="flex items-start gap-2 max-w-xs w-full"
                style={{ animation: 'gymIntroSlideUp 480ms ease-out 1200ms both' }}
              >
                {/* Tail + bubble layout */}
                <div className="flex items-start gap-0 w-full">
                  {/* Bubble */}
                  <div
                    className="relative rounded-2xl rounded-tl-sm flex-1"
                    style={{
                      background: 'linear-gradient(135deg,rgba(0,0,0,0.88),rgba(10,5,0,0.92))',
                      border: '1.5px solid rgba(245,158,11,0.40)',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(245,158,11,0.08)',
                      backdropFilter: 'blur(14px)',
                      padding: '10px 14px',
                    }}
                  >
                    {/* Top-left tail */}
                    <div style={{
                      position: 'absolute', top: 10, left: -7,
                      width: 0, height: 0,
                      borderTop: '7px solid transparent',
                      borderBottom: '7px solid transparent',
                      borderRight: '8px solid rgba(245,158,11,0.40)',
                    }} />
                    <div className="font-black text-[10px] mb-1 flex items-center gap-1" style={{ color: '#fbbf24', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                      💬 {selectedLeader.name}
                    </div>
                    <p className="text-sm font-semibold leading-snug italic" style={{ color: 'rgba(255,235,180,0.90)' }}>
                      "{introTaunt}"
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stage name — slides up with delay */}
            <div style={{ animation: 'gymIntroSlideUp 480ms ease-out 220ms both' }}>
              <p className="text-yellow-400/70 text-xs font-black uppercase tracking-widest mb-1">Stage {selectedLeader.orderIndex}</p>
              <h2 className="text-white font-black text-3xl mb-1">{selectedLeader.gymName}</h2>
              <p className="text-white/50 text-sm">Boss: <span className="text-yellow-300 font-bold">{selectedLeader.name}</span></p>
            </div>

            {/* Tags — slide up with further delay */}
            <div className="flex flex-wrap justify-center gap-2" style={{ animation: 'gymIntroSlideUp 480ms ease-out 380ms both' }}>
              <span className={`text-xs px-3 py-1 rounded-full font-bold bg-gray-800/80 border border-white/10 ${DIFFICULTY_LABEL[selectedLeader.cpuLevel]?.color || 'text-white'}`}>
                {selectedLeader.cpuLevel === 'easy' ? '🟢' : selectedLeader.cpuLevel === 'medium' ? '🟡' : '🔴'} {DIFFICULTY_LABEL[selectedLeader.cpuLevel]?.label || selectedLeader.cpuLevel}
              </span>
              {cpuCount > 1 && (
                <span className="text-xs px-3 py-1 rounded-full font-bold bg-purple-900/40 border border-purple-500/30 text-purple-300 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {cpuCount} Avversari CPU
                </span>
              )}
              {selectedLeader.attackMode === 'hunt_human' && (
                <span className="text-xs px-3 py-1 rounded-full font-bold bg-red-900/40 border border-red-500/30 text-red-300 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Tutti contro di te
                </span>
              )}
              <span className="text-xs px-3 py-1 rounded-full font-bold bg-gray-800/80 border border-red-500/20 text-red-300">
                ❤️ {selectedLeader.livesCount} vite
              </span>
              <span className="text-xs px-3 py-1 rounded-full font-bold bg-yellow-900/30 border border-yellow-500/20 text-yellow-300">
                +{selectedLeader.rewardCredits} Rankiard
              </span>
            </div>

            {/* Specialty */}
            {selectedLeader.specialty && (
              <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-xl px-4 py-2 max-w-xs">
                <p className="text-yellow-300/80 text-xs">⚡ {selectedLeader.specialty}</p>
              </div>
            )}

            {/* Description */}
            {selectedLeader.description && (
              <p className="text-white/40 text-sm max-w-xs leading-relaxed">{selectedLeader.description}</p>
            )}

            {/* Mazzo story */}
            <div className="bg-gray-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm max-w-xs w-full">
              <p className="text-white/40 text-xs mb-1">Il tuo mazzo Story Mode</p>
              <p className="text-white font-bold">
                {storyDeckIds.length > 0 ? `${storyDeckIds.length} carte` : 'Mazzo non ancora iniziato'}
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => startBattle(selectedLeader)}
                className="py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-orange-900/40 active:scale-95 flex items-center justify-center gap-2"
              >
                <Swords className="w-5 h-5" /> INIZIA LA BATTAGLIA!
              </button>
              <button
                onClick={() => { setPhase('map'); setSelectedLeader(null); }}
                className="py-2.5 text-white/40 hover:text-white/70 text-sm transition-colors"
              >
                Torna alla mappa
              </button>
            </div>
          </div>
      </div>
    );
  }

  // ── MAP ───────────────────────────────────────────────────────────────────
  const completedCount = activeLeaders.filter(l => completedIds.includes(l.id)).length;
  const totalCount = activeLeaders.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'linear-gradient(180deg, #0a0515 0%, #05080f 50%, #0a0515 100%)' }}>
      {/* Phase transition flash overlay */}
      <div ref={transitionRef} className="fixed inset-0 z-[300] bg-black pointer-events-none" style={{ opacity: 0 }} />
      {/* Header — compact in landscape */}
      <div className="flex-shrink-0 border-b border-white/10" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}>
        <div
          className="flex items-center gap-3 px-4"
          style={{ paddingTop: isLandscape ? 4 : 12, paddingBottom: isLandscape ? 4 : 12 }}
        >
          <button
            onClick={onBack}
            className="p-2 text-white/50 hover:text-white transition-colors hover:bg-white/10 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-black leading-tight" style={{ fontSize: isLandscape ? 14 : 18 }}>Story Mode</h1>
            {!isLandscape && (
              <p className="text-white/40 text-xs">Affronta gli Stage e colleziona carte</p>
            )}
          </div>
          {/* Progress */}
          <div className="text-right flex-shrink-0">
            <p className="text-white font-bold text-sm">{completedCount}/{totalCount}</p>
            {!isLandscape && <p className="text-white/40 text-xs">Stage</p>}
          </div>
          {/* Landscape: action buttons inline in header */}
          {isLandscape && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => setShowDeckPanel(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-900/40 border border-purple-500/30 text-purple-300 text-[10px] font-bold"
              >
                <BookOpen className="w-3 h-3" /> Mazzo
              </button>
              <button
                onClick={() => setShowInfermeria(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-[10px] font-bold"
              >
                🩹
              </button>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400 text-[10px] font-bold"
              >
                ↺
              </button>
              <span className="text-yellow-300 text-[10px] font-bold flex-shrink-0">⭐ {userCredits.toLocaleString()}</span>
            </div>
          )}
          {/* View toggle */}
          <button
            onClick={() => {
              const next = storyViewMode === '3d' ? '2d' : '3d';
              setStoryViewMode(next);
              try { localStorage.setItem('storyViewMode', next); } catch {}
            }}
            title={storyViewMode === '3d' ? 'Passa alla mappa classica 2D' : 'Passa alla mappa 3D'}
            style={{
              flexShrink: 0,
              padding: isLandscape ? '4px 8px' : '6px 10px',
              borderRadius: 10,
              border: '1px solid rgba(245,158,11,0.35)',
              background: 'rgba(245,158,11,0.12)',
              color: '#fde68a',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            {storyViewMode === '3d' ? '🗺️ 2D' : '🌍 3D'}
          </button>
        </div>
        {/* Progress bar — hidden in landscape */}
        {totalCount > 0 && !isLandscape && (
          <div className="px-4 pb-3">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%`, background: 'linear-gradient(to right, #f59e0b, #ef4444)' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Deck info bar — hidden in landscape (buttons moved to header) */}
      {!isLandscape && (
      <div className="flex-shrink-0 px-4 py-2.5 flex items-center gap-3 border-b border-white/5" style={{ background: 'rgba(0,0,0,0.3)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-yellow-600/20 border border-yellow-600/30 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          </div>
          <div>
            <p className="text-white text-xs font-bold">{storyDeckIds.length} carte nel mazzo</p>
            <p className="text-white/30 text-[10px]">Mazzo Story Mode</p>
          </div>
        </div>
        <button
          onClick={() => setShowDeckPanel(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-900/40 border border-purple-500/30 text-purple-300 text-[10px] font-bold hover:bg-purple-900/60 transition-colors"
        >
          <BookOpen className="w-3 h-3" /> Vedi mazzo
        </button>
        <button
          onClick={() => setShowInfermeria(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-[10px] font-bold hover:bg-red-900/50 transition-colors"
        >
          🩹 Infermeria
        </button>
        <button
          onClick={() => setShowResetConfirm(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400 text-[10px] font-bold hover:bg-red-900/50 transition-colors"
        >
          ↺ Ricomincia
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-yellow-600/20 border border-yellow-600/30 flex items-center justify-center">
            <Star className="w-3.5 h-3.5 text-yellow-400" />
          </div>
          <div>
            <p className="text-white text-xs font-bold">{userCredits.toLocaleString()}</p>
            <p className="text-white/30 text-[10px]">Rankiard</p>
          </div>
        </div>
      </div>
      )}

      {/* Deck Panel Modal */}
      {showDeckPanel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={() => { setShowDeckPanel(false); setDeckPanelScheaCardId(null); }}>
          <div
            className="relative w-full max-w-lg bg-gray-950 border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col"
            style={{ maxHeight: isLandscape ? '85vh' : '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
              <div>
                <h3 className="text-white font-black text-base">Il tuo Mazzo Story Mode</h3>
                <p className="text-white/40 text-xs mt-0.5">{storyDeckIds.length} carte totali</p>
              </div>
              <button
                onClick={() => { setShowDeckPanel(false); setDeckPanelScheaCardId(null); }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {storyDeckIds.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-4xl mb-3">🃏</div>
                  <p className="text-white/40 text-sm">Nessuna carta nel mazzo</p>
                  <p className="text-white/25 text-xs mt-1">Completa i boss per aggiungere carte</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {storyDeckIds.map((cardId, idx) => {
                    const imgUrl = getCardImageFromId(cardId);
                    const label = getCardDeckLabel(cardId);
                    return (
                      <button
                        key={`${cardId}-${idx}`}
                        className="flex flex-col items-center gap-1 text-left group"
                        onClick={() => setDeckPanelScheaCardId(cardId)}
                        title="Tocca per vedere la scheda"
                      >
                        <div className="w-full aspect-[2/3] rounded-lg overflow-hidden border border-white/10 bg-gray-800 group-hover:border-indigo-400/60 transition-colors relative">
                          {imgUrl ? (
                            <img src={imgUrl} alt={label} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Shield className="w-4 h-4 text-white/20" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <ClipboardList size={14} className="text-white drop-shadow" />
                          </div>
                        </div>
                        <span className="text-[9px] text-white/50 font-bold text-center leading-tight truncate w-full group-hover:text-indigo-300 transition-colors" title={getCardNameFromId(cardId)}>{getCardNameFromId(cardId) || label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Inner card sheet overlay for deck panel */}
            {deckPanelScheaCardId && (
              <div className="absolute inset-0 z-10 bg-gray-950/95 flex flex-col rounded-t-3xl">
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={14} className="text-indigo-400" />
                    <span className="text-white font-bold text-sm">Scheda carta</span>
                  </div>
                  <button
                    onClick={() => setDeckPanelScheaCardId(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4 text-white/70" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <CardInfoSheet cardId={deckPanelScheaCardId} compact />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Infermeria Panel Modal */}
      {showInfermeria && (
        <InfermeriaPanel
          authToken={authToken || ''}
          userCredits={userCredits}
          onCreditsUpdated={(c) => setUserCredits(c)}
          onClose={() => setShowInfermeria(false)}
        />
      )}

      {/* ── La Stanza Segreta: GSAP Reveal Animation ── */}
      {secretRoomRevealing && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.96)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 24,
            pointerEvents: 'none',
          }}
        >
          <div
            ref={secretRevealMarksRef}
            style={{
              position: 'absolute',
              color: '#fbbf24', fontWeight: 900,
              fontSize: 'clamp(48px, 12vw, 88px)',
              letterSpacing: '0.15em',
              textShadow: '0 0 30px rgba(251,191,36,0.6)',
              transformOrigin: 'center',
            }}
          >
            ???
          </div>
          <div
            ref={secretRevealTitleRef}
            style={{
              position: 'absolute',
              color: '#fbbf24', fontWeight: 900,
              fontSize: 'clamp(24px, 7vw, 52px)',
              textShadow: '0 0 30px rgba(251,191,36,0.7), 0 0 60px rgba(245,158,11,0.4)',
              opacity: 0,
              transformOrigin: 'center',
              textAlign: 'center',
              padding: '0 20px',
            }}
          >
            🚪 La Stanza Segreta
          </div>
        </div>
      )}

      {/* ── La Stanza Segreta Easter Egg Overlay ── */}
      {showSecretRoom && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 16px',
            animation: 'secretRoomFadeIn 0.35s ease-out',
          }}
          onClick={() => setShowSecretRoom(false)}
        >
          <style>{`
            @keyframes secretRoomFadeIn {
              from { opacity: 0; }
              to   { opacity: 1; }
            }
            @keyframes secretRoomSlideUp {
              from { opacity: 0; transform: translateY(32px) scale(0.96); }
              to   { opacity: 1; transform: translateY(0)    scale(1); }
            }
            @keyframes secretRoomTitlePop {
              0%   { opacity: 0; transform: scale(0.6) rotate(-4deg); }
              65%  { transform: scale(1.08) rotate(1deg); }
              100% { opacity: 1; transform: scale(1) rotate(0deg); }
            }
            @keyframes secretRoomGoldPulse {
              0%,100% { text-shadow: 0 0 12px rgba(251,191,36,0.6), 0 0 24px rgba(245,158,11,0.3); }
              50%      { text-shadow: 0 0 24px rgba(251,191,36,0.9), 0 0 48px rgba(245,158,11,0.5); }
            }
            @keyframes secretRoomCardIn {
              from { opacity: 0; transform: translateY(16px) scale(0.9); }
              to   { opacity: 1; transform: translateY(0)    scale(1); }
            }
          `}</style>
          <div
            style={{
              width: '100%', maxWidth: 520,
              background: 'linear-gradient(160deg,#0d0b1e 0%,#1a0f2e 100%)',
              border: '1.5px solid rgba(251,191,36,0.4)',
              borderRadius: 24, padding: '28px 24px 24px',
              display: 'flex', flexDirection: 'column', gap: 20,
              maxHeight: '88vh', overflow: 'hidden',
              boxShadow: '0 0 60px rgba(251,191,36,0.15), 0 20px 60px rgba(0,0,0,0.8)',
              animation: 'secretRoomSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 44, marginBottom: 6,
                animation: 'secretRoomTitlePop 0.55s cubic-bezier(0.34,1.56,0.64,1) both',
              }}>🚪</div>
              <h2 style={{
                color: '#fbbf24', fontWeight: 900, fontSize: 22, margin: 0,
                animation: 'secretRoomGoldPulse 2.5s ease-in-out infinite, secretRoomTitlePop 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.08s both',
                letterSpacing: '0.02em',
              }}>La Stanza Segreta</h2>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                Hai sconfitto tutti i leader. Ora conosci il segreto.<br />
                <span style={{ color: 'rgba(251,191,36,0.75)', fontWeight: 700 }}>
                  Chi vuoi sfidare di nuovo? 😈
                </span>
              </p>
            </div>

            {/* Leader grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))',
              gap: 10, overflowY: 'auto', maxHeight: '46vh',
              scrollbarWidth: 'none',
            }}>
              {activeLeaders
                .filter(l => completedIds.includes(l.id))
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((leader, i) => (
                  <button
                    key={leader.id}
                    onClick={() => {
                      setShowSecretRoom(false);
                      handleChallengeLeader(leader);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(251,191,36,0.25)',
                      borderRadius: 14, padding: '10px 8px',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 6, transition: 'all 0.15s ease',
                      animation: `secretRoomCardIn 0.35s ease-out ${i * 0.05}s both`,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(251,191,36,0.12)';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(251,191,36,0.6)';
                      (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(251,191,36,0.25)';
                      (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
                      border: '2px solid rgba(74,222,128,0.5)',
                      background: 'linear-gradient(135deg,#052e16,#14532d)',
                      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {leader.leaderImageUrl ? (
                        <img src={leader.leaderImageUrl} alt={leader.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 20 }}>⚔️</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ color: 'white', fontWeight: 800, fontSize: 11, margin: 0, lineHeight: 1.2 }}>{leader.name}</p>
                      <p style={{ color: 'rgba(74,222,128,0.7)', fontSize: 9, margin: '2px 0 0', fontWeight: 600 }}>{leader.gymName}</p>
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: '#fbbf24',
                      background: 'rgba(251,191,36,0.12)', borderRadius: 6, padding: '2px 6px',
                    }}>Rivincita</span>
                  </button>
                ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <button
                onClick={() => {
                  const completedLeaders = activeLeaders.filter(l => completedIds.includes(l.id));
                  if (completedLeaders.length === 0) return;
                  const randomLeader = completedLeaders[Math.floor(Math.random() * completedLeaders.length)];
                  setShowSecretRoom(false);
                  handleChallengeLeader(randomLeader);
                }}
                style={{
                  flex: 1, padding: '12px 0',
                  background: 'linear-gradient(135deg,#92400e,#fbbf24)',
                  color: '#0d0b1e', border: 'none', borderRadius: 14,
                  fontWeight: 900, fontSize: 14, cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(251,191,36,0.3)',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
              >
                🎲 Sfida Casuale
              </button>
              <button
                onClick={() => setShowSecretRoom(false)}
                style={{
                  padding: '12px 20px',
                  background: 'rgba(255,255,255,0.07)',
                  color: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)')}
              >
                Esci
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Badge strip: medaglie tappe completate — hidden in landscape ── */}
      {completedIds.length > 0 && !isLandscape && (
        <div className="flex-shrink-0 border-b border-white/5" style={{ background: 'rgba(0,0,0,0.25)' }}>
          <div className="px-4 py-2.5 flex items-center gap-2">
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(245,158,11,0.6)', flexShrink: 0 }}>
              🏅 Medaglie
            </span>
            <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {activeLeaders
                .filter(l => completedIds.includes(l.id))
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map(leader => (
                  <div key={leader.id} className="flex-shrink-0 flex flex-col items-center gap-0.5" title={`${leader.gymName} — ${leader.name}`}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      border: '2px solid rgba(74,222,128,0.6)',
                      overflow: 'hidden', flexShrink: 0,
                      background: 'linear-gradient(135deg,#052e16,#14532d)',
                      boxShadow: '0 0 8px rgba(74,222,128,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {leader.badgeImageUrl ? (
                        <img src={leader.badgeImageUrl} alt={leader.gymName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : leader.leaderImageUrl ? (
                        <img src={leader.leaderImageUrl} alt={leader.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 14 }}>🏅</span>
                      )}
                    </div>
                    <span style={{ fontSize: 8, color: 'rgba(74,222,128,0.7)', fontWeight: 700, whiteSpace: 'nowrap', maxWidth: 38, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {leader.name}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Riprendi partita banner — shown only when the leader ID is unknown (fallback), hidden in landscape */}
      {pendingGymGame && !pendingGymGame.gymLeaderId && !isLandscape && (
        <div className="flex-shrink-0 mx-4 mt-3 flex items-center gap-3 bg-orange-900/30 border border-orange-500/40 rounded-2xl px-4 py-3">
          <Swords className="w-5 h-5 text-orange-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-orange-200 font-black text-sm leading-tight">Battaglia interrotta</p>
            <p className="text-orange-400/70 text-xs truncate">
              {pendingGymGame.gymLeaderCpuName ? `vs ${pendingGymGame.gymLeaderCpuName}` : 'Partita in corso sul server'}
            </p>
          </div>
          <button
            onClick={() => {
              const matchedLeader = leaders.find(
                l => l.name === pendingGymGame.gymLeaderCpuName
              );
              if (matchedLeader) {
                handleInternalResume(matchedLeader, pendingGymGame.gameId);
              } else if (onResumeGymGame) {
                onResumeGymGame(pendingGymGame.gameId);
              }
            }}
            className="flex-shrink-0 px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-black text-xs rounded-xl transition-colors active:scale-95"
          >
            Riprendi
          </button>
        </div>
      )}

      {/* 3D World Map */}
      {storyViewMode === '3d' && (
        <StoryWorldMap
          leaders={activeLeaders}
          lostLeaderIds={lostLeaderIds}
          currentLeader={currentLeader ?? null}
          pendingGymGame={pendingGymGame}
          loading={loading}
          getLeaderStatus={getLeaderStatus}
          onChallengeLeader={handleChallengeLeader}
          onResumeGame={handleInternalResume}
          localities={localities}
          collectibles={collectibles}
          userId={userId}
          username={playerName}
          authToken={authToken}
          onCardCollected={fetchStoryDeck}
          quadratoLeader={quadratoLeader}
          quadratoCompleted={quadratoCompleted}
          chosenFaction={chosenFaction}
          wizardCardReceived={wizardCardReceived}
          onWizardCard={handleWizardCard}
          allLeadersCompleted={allLeadersCompleted}
          onOpenSecretRoom={() => {
            if (!secretRoomEverRevealedRef.current) {
              secretRoomEverRevealedRef.current = true;
              setSecretRoomRevealing(true);
            } else {
              setShowSecretRoom(true);
            }
          }}
          onTriggerQuadrato={() => {
            if (!quadratoLeader) return;
            quadratoAutoTriggeredRef.current = true;
            setSelectedLeader(quadratoLeader);
            selectedLeaderRef.current = quadratoLeader;
            setPhase('intro');
          }}
          onStartPvp={(pvpGameId, opponentUsername, _yourDeck, _opponentDeck, yourRole, livesCount, youtubeMusicUrl) => {
            const syntheticLeader: GymLeader = {
              id: -1,
              orderIndex: 0,
              name: opponentUsername,
              gymName: `PvP vs ${opponentUsername}`,
              description: 'Sfida PvP nella Story World',
              specialty: null,
              leaderImageUrl: null,
              badgeImageUrl: null,
              backgroundImageUrl: null,
              cpuLevel: 'medium',
              deckBias: { personaggi: 33, mosse: 33, bonus: 34 },
              customDeck: [],
              livesCount: livesCount ?? 1,
              playerStartingDeck: [],
              rewardCredits: 30,
              rewardDescription: 'Vittoria PvP',
              youtubeMusicUrl: youtubeMusicUrl ?? null,
              leaderMessages: null,
              cpuCount: 0,
              cpuConfigs: [],
              attackMode: 'free_for_all',
            };
            setSelectedLeader(syntheticLeader);
            selectedLeaderRef.current = syntheticLeader;
            setGameIdLocal(pvpGameId);
            gameIdRef.current = pvpGameId;
            setGameId(pvpGameId);
            setPlayerName(playerName);
            generateSessionId();
            setPhase('battle');

            /* ── Create/join the actual game room ── */
            const joinRoom = () => {
              socket.emit('create-training-game', {
                gameId: pvpGameId,
                playerName,
                avatarId,
                userId,
                isGymMode: true,
                livesCount: livesCount ?? 1,
              });
              console.log(`[story-pvp] ${playerName} joined room ${pvpGameId} as ${yourRole} (lives: ${livesCount ?? 1})`);
            };

            if (yourRole === 'challenger') {
              joinRoom();
              /* After both players have had time to join, start the game */
              setTimeout(() => {
                socket.emit('start-story-pvp', { gameId: pvpGameId });
                console.log(`[story-pvp] challenger triggered start for ${pvpGameId}`);
              }, 1500);
            } else {
              /* Target waits 800ms so the challenger's create-training-game lands first */
              setTimeout(joinRoom, 800);
            }
          }}
        />
      )}

      {/* Classic 2D scroll map */}
      {storyViewMode === '2d' && (
        <>
          <div ref={mapScrollRef} className="flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
            {loading ? (
              <div className="text-center py-16">
                <div className="w-10 h-10 border-2 border-white/20 border-t-yellow-400 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/30 text-sm">Caricamento Story Mode…</p>
              </div>
            ) : leaders.length === 0 ? (
              <div className="text-center py-16">
                <Shield className="w-16 h-16 text-white/10 mx-auto mb-4" />
                <p className="text-white/30 text-sm">Nessuno stage disponibile</p>
                <p className="text-white/20 text-xs mt-1">Gli stage Story Mode devono essere configurati da un amministratore</p>
              </div>
            ) : activeLeaders.length === 0 ? (
              <div className="text-center py-16">
                <Shield className="w-16 h-16 text-white/10 mx-auto mb-4" />
                <p className="text-white/30 text-sm">Nessuno stage attivo</p>
                <p className="text-white/20 text-xs mt-1">Tutti gli stage sono temporaneamente disabilitati</p>
              </div>
            ) : (
              <div style={{ position: 'relative', width: '100%', minHeight: GYM_PATH_TOP_PAD + activeLeaders.length * GYM_PATH_NODE_H + (allLeadersCompleted ? GYM_PATH_NODE_H + 32 : 32) }}>
                <GymPathSVG count={activeLeaders.length} />

                {allLeadersCompleted && (
                  <div style={{ position: 'absolute', top: GYM_PATH_TOP_PAD + activeLeaders.length * GYM_PATH_NODE_H, left: 0, right: 0, height: GYM_PATH_NODE_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                    {/* Connector line from last leader */}
                    <div style={{ width: 3, height: 28, background: 'linear-gradient(to bottom, rgba(251,191,36,0.4), rgba(251,191,36,0.9))', borderRadius: 99, marginBottom: 6 }} />
                    <button
                      onClick={() => {
                        if (!secretRoomEverRevealedRef.current) {
                          secretRoomEverRevealedRef.current = true;
                          setSecretRoomRevealing(true);
                        } else {
                          setShowSecretRoom(true);
                        }
                      }}
                      style={{
                        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <div style={{
                          position: 'absolute', inset: -8, borderRadius: '50%',
                          border: '2.5px solid rgba(251,191,36,0.6)',
                          animation: 'gymNodePulse 1.9s ease-out infinite',
                        }} />
                        <div style={{
                          position: 'absolute', inset: -12, borderRadius: '50%',
                          border: '2px dashed rgba(251,191,36,0.25)',
                          animation: 'gymNodeSpin 6s linear infinite',
                        }} />
                        <div style={{
                          width: 66, height: 66, borderRadius: '50%',
                          border: '3px solid #fbbf24',
                          background: 'linear-gradient(135deg,#78350f,#92400e,#1c0a00)',
                          boxShadow: '0 0 24px #fbbf24aa, 0 0 48px rgba(251,191,36,0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          animation: 'gymNodeGlow 2.4s ease-in-out infinite',
                          position: 'relative',
                          overflow: 'hidden',
                        }}>
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg,transparent 25%,rgba(255,255,255,0.12) 50%,transparent 75%)', backgroundSize: '400% auto', animation: 'gymCardShimmer 3s linear infinite' }} />
                          <span style={{ fontSize: 22, fontWeight: 900, color: '#fbbf24', letterSpacing: '0.05em', position: 'relative', zIndex: 1, textShadow: '0 0 12px #fbbf24' }}>???</span>
                        </div>
                      </div>
                      <div style={{
                        background: 'linear-gradient(135deg,rgba(120,53,15,0.85),rgba(30,10,0,0.9))',
                        border: '1.5px solid rgba(251,191,36,0.5)',
                        borderRadius: 14, padding: '7px 20px',
                        boxShadow: '0 4px 20px rgba(251,191,36,0.2)',
                        textAlign: 'center',
                      }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#fbbf24', letterSpacing: '0.12em', textTransform: 'uppercase', textShadow: '0 0 8px rgba(251,191,36,0.6)' }}>La Stanza Segreta</p>
                        <p style={{ margin: '3px 0 0', fontSize: 10, color: 'rgba(251,191,36,0.6)', fontWeight: 700 }}>Tocca per scoprire…</p>
                      </div>
                    </button>
                  </div>
                )}

                {activeLeaders.map((leader, idx) => {
                  const status = getLeaderStatus(leader);
                  const isCompleted = status === 'completed';
                  const isAvailable = status === 'available';
                  const isLocked = status === 'locked';
                  const isCurrent = leader.id === currentLeader?.id;
                  const cpuCount = leader.cpuCount ?? 1;
                  const side: 'left' | 'right' = idx % 2 === 0 ? 'right' : 'left';
                  const nodeY = GYM_PATH_TOP_PAD + idx * GYM_PATH_NODE_H;
                  const nodeSize = isCurrent ? 66 : 58;
                  const borderColor = isCompleted ? '#4ade8099' : isCurrent ? '#f59e0b' : isAvailable ? '#f59e0b44' : '#1f2937';

                  const leaderNode = (
                    <div
                      className="gym-path-node-pop"
                      style={{ position: 'relative', width: nodeSize, height: nodeSize, flexShrink: 0, animationDelay: `${idx * 0.06}s`, zIndex: 2 }}
                      onMouseEnter={(e) => { if (!isLocked) { setHoveredLeaderId(leader.id); setTooltipPos({ x: e.clientX, y: e.clientY }); } }}
                      onMouseMove={(e) => { if (!isLocked) setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                      onMouseLeave={() => { setHoveredLeaderId(null); setTooltipPos(null); }}
                      onTouchStart={(e) => {
                        if (!isLocked) {
                          const t = e.touches[0];
                          setHoveredLeaderId(leader.id);
                          setTooltipPos({ x: t.clientX, y: t.clientY });
                          setTimeout(() => { setHoveredLeaderId(null); setTooltipPos(null); }, 2500);
                        }
                      }}
                    >
                      {isCurrent && (
                        <div style={{ position: 'absolute', inset: -7, borderRadius: '50%', border: '2.5px solid #f59e0b99', animation: 'gymNodePulse 1.9s ease-out infinite' }} />
                      )}
                      {isCurrent && (
                        <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: '2px dashed #f59e0b44', animation: 'gymNodeSpin 6s linear infinite' }} />
                      )}
                      <div style={{
                        width: '100%', height: '100%', borderRadius: '50%',
                        border: `${isCurrent ? 3 : 2}px solid ${borderColor}`,
                        overflow: 'hidden',
                        background: isLocked ? '#0d0a1a' : 'linear-gradient(135deg,#1a1040,#0d0a22)',
                        boxShadow: isCurrent ? '0 0 20px #f59e0baa, 0 0 40px #f59e0b44' : isCompleted ? '0 0 8px #4ade8044' : '0 4px 14px rgba(0,0,0,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative',
                        animation: isCurrent ? 'gymNodeGlow 2.4s ease-in-out infinite' : 'none',
                        opacity: isLocked ? 0.3 : 1,
                      }}>
                        {isLocked ? (
                          <Lock className="w-5 h-5 text-white/20" />
                        ) : leader.leaderImageUrl ? (
                          <img src={leader.leaderImageUrl} alt={leader.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : (
                          <Shield style={{ width: nodeSize * 0.4, height: nodeSize * 0.4, color: isCompleted ? '#4ade8066' : '#f59e0b55' }} />
                        )}
                        {isCompleted && (
                          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.15), transparent 60%)' }} />
                        )}
                      </div>
                      {isCompleted && (
                        <div style={{
                          position: 'absolute', top: -4, right: -4,
                          width: 19, height: 19, borderRadius: '50%',
                          background: 'linear-gradient(135deg,#16a34a,#15803d)',
                          border: '2px solid #05080f',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          animation: 'gymBadgeBounce 2s ease-in-out infinite', zIndex: 3,
                        }}>
                          {leader.badgeImageUrl ? (
                            <img src={leader.badgeImageUrl} alt="badge" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <Star style={{ width: '55%', height: '55%', color: isCompleted ? '#4ade80' : '#f59e0b' }} />
                          )}
                        </div>
                      )}
                    </div>
                  );

                  const align = side === 'right' ? 'flex-start' : 'flex-end';
                  const txtAlign: 'left' | 'right' = side === 'right' ? 'left' : 'right';
                  const bgImg = leader.backgroundImageUrl;

                  const infoCard = isLocked ? (
                    <div style={{ width: '100%', height: '100%', borderRadius: 14, overflow: 'hidden', position: 'relative', border: '1px solid #1f2937', opacity: 0.38 }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,15,0.92)' }} />
                      <div style={{ position: 'relative', zIndex: 1, padding: '10px 12px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: txtAlign }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#374151', letterSpacing: '0.06em' }}>STAGE {leader.orderIndex}</p>
                        <p style={{ margin: '4px 0 0', fontSize: 10, color: '#1f2937', fontWeight: 700 }}>🔒 Stage bloccato</p>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', borderRadius: 14, overflow: 'hidden', position: 'relative',
                      border: isCurrent ? '1.5px solid #f59e0baa' : isCompleted ? '1px solid #4ade8044' : '1px solid rgba(245,158,11,0.18)',
                      boxShadow: isCurrent ? '0 4px 22px #f59e0b55' : isCompleted ? '0 2px 10px #4ade8022' : 'none',
                    }}>
                      {bgImg && (
                        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${bgImg})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.5 }} />
                      )}
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: isCurrent ? 'linear-gradient(135deg,rgba(120,53,15,0.72),rgba(180,83,9,0.55))' : isCompleted ? 'rgba(0,30,15,0.72)' : 'rgba(5,5,18,0.70)',
                      }} />
                      {isCurrent && (
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg,transparent 25%,rgba(255,255,255,0.07) 50%,transparent 75%)', backgroundSize: '400% auto', animation: 'gymCardShimmer 3s linear infinite' }} />
                      )}
                      <div style={{ position: 'relative', zIndex: 1, padding: '8px 10px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', gap: 2 }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: '0 0 1px', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: isCurrent ? '#f59e0bcc' : isCompleted ? '#4ade8099' : 'rgba(255,255,255,0.25)', textAlign: txtAlign, whiteSpace: 'nowrap' }}>⚡ Stage {leader.orderIndex}</p>
                          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 900, lineHeight: 1.1, color: isCurrent ? '#fde68a' : isCompleted ? '#86efac' : 'white', textAlign: txtAlign, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{leader.gymName}</p>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: isCurrent ? 'rgba(253,230,138,0.65)' : isCompleted ? 'rgba(134,239,172,0.55)' : 'rgba(255,255,255,0.4)', textAlign: txtAlign, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            👊 <span style={{ fontWeight: 900, color: isCurrent ? '#fde68a' : isCompleted ? '#86efac' : 'rgba(255,255,255,0.7)' }}>{leader.name}</span>
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', justifyContent: align, overflow: 'hidden' }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: leader.cpuLevel === 'easy' ? '#4ade80' : leader.cpuLevel === 'medium' ? '#facc15' : '#f87171', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {leader.cpuLevel === 'easy' ? '🟢' : leader.cpuLevel === 'medium' ? '🟡' : '🔴'}
                          </span>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>❤️{leader.livesCount}</span>
                          {cpuCount > 1 && (
                            <span style={{ fontSize: 10, color: '#c084fc', fontWeight: 800, background: 'rgba(168,85,247,0.2)', padding: '1px 5px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                              <Users style={{ width: 9, height: 9 }} />{cpuCount}
                            </span>
                          )}
                          <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0 }}>⭐{leader.rewardCredits}</span>
                        </div>
                        <div>
                          {pendingGymGame?.gymLeaderId === leader.id && !lostLeaderIds.includes(leader.id) && !isCompleted ? (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: align }}>
                              <button onClick={() => handleInternalResume(leader, pendingGymGame.gameId)} style={{ background: 'linear-gradient(135deg,#ea580c,#c2410c)', border: 'none', borderRadius: 9, color: 'white', fontSize: 12, fontWeight: 900, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 2px 8px rgba(234,88,12,0.5)', whiteSpace: 'nowrap' }}>
                                <Swords style={{ width: 11, height: 11 }} /> Riprendi
                              </button>
                              {isAvailable && (
                                <button onClick={() => handleChallengeLeader(leader)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 800, padding: '5px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Nuova</button>
                              )}
                            </div>
                          ) : lostLeaderIds.includes(leader.id) && !isCompleted ? (
                            <div style={{ display: 'flex', justifyContent: align }}>
                              <button onClick={() => handleChallengeLeader(leader)} style={{ border: 'none', borderRadius: 9, color: 'white', fontSize: 13, fontWeight: 900, padding: '6px 13px', cursor: 'pointer', background: 'linear-gradient(135deg,#dc2626,#9333ea)', display: 'inline-flex', alignItems: 'center', gap: 5, letterSpacing: '0.04em', boxShadow: '0 2px 10px rgba(220,38,38,0.5)', whiteSpace: 'nowrap' }}>
                                <Swords style={{ width: 12, height: 12 }} /> Riprova
                              </button>
                            </div>
                          ) : isAvailable ? (
                            <div style={{ display: 'flex', justifyContent: align }}>
                              <button onClick={() => handleChallengeLeader(leader)} style={{ border: 'none', borderRadius: 9, color: 'white', fontSize: 13, fontWeight: 900, padding: '6px 13px', cursor: 'pointer', background: 'linear-gradient(135deg,#9333ea,#f59e0b)', display: 'inline-flex', alignItems: 'center', gap: 5, letterSpacing: '0.04em', boxShadow: '0 2px 10px rgba(147,51,234,0.5)', whiteSpace: 'nowrap' }}>
                                <Swords style={{ width: 12, height: 12 }} /> SFIDA!
                              </button>
                            </div>
                          ) : isCompleted ? (
                            <div style={{ display: 'flex', justifyContent: align }}>
                              <button onClick={() => handleChallengeLeader(leader)} style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 9, color: '#4ade80cc', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, padding: '5px 10px', whiteSpace: 'nowrap' }}>
                                <ChevronRight style={{ width: 12, height: 12 }} /> Rigioca
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );

                  const nodePct = side === 'right' ? GYM_NODE_PCT_RIGHT : GYM_NODE_PCT_LEFT;
                  const GAP = 9;
                  const EDGE = 10;

                  return (
                    <div key={leader.id} style={{ position: 'absolute', top: nodeY, left: 0, right: 0, height: GYM_PATH_NODE_H }}>
                      <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: `calc(${nodePct}% - ${nodeSize / 2}px)`, zIndex: 2 }}>
                        {leaderNode}
                      </div>
                      <div style={{
                        position: 'absolute', top: 6, bottom: 6,
                        ...(side === 'right'
                          ? { left: `calc(${nodePct}% + ${nodeSize / 2 + GAP}px)`, right: EDGE }
                          : { left: EDGE, right: `calc(${100 - nodePct}% + ${nodeSize / 2 + GAP}px)` }),
                      }}>
                        {infoCard}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {completedCount === totalCount && totalCount > 0 && (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">🏆</div>
                <p className="text-yellow-300 font-black text-xl">Campione della Story Mode!</p>
                <p className="text-white/40 text-sm mt-1">Hai completato tutti gli stage disponibili</p>
                <div className="flex items-center justify-center gap-1 mt-2">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />)}
                </div>
              </div>
            )}

            {/* Stage 13 Node – always visible once unlocked */}
            {stage13Status && (stage13Status.myStage || stage13Status.canBuild || stage13Status.visibleStage || stage13Status.pendingChallengeAsBoss || stage13Status.pendingChallengeAsChallenger) && (
              <div style={{ padding: '0 10px 24px' }}>
                {/* Connector line from stage 12 */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                  <div style={{ width: 3, height: 28, background: 'linear-gradient(to bottom, rgba(124,58,237,0.0), rgba(124,58,237,0.7))', borderRadius: 99 }} />
                </div>
                <button
                  onClick={() => {
                    setShowStage13Modal(true);
                    setStage13BuildSuccess(false);
                    setStage13BuildError(null);
                  }}
                  style={{
                    width: '100%', border: 'none', cursor: 'pointer', background: 'none', padding: 0, textAlign: 'left',
                  }}
                >
                  <div style={{
                    borderRadius: 18, overflow: 'hidden', position: 'relative',
                    border: stage13Status.myStage
                      ? `2px solid ${stage13Status.myStage.stageColor || '#7c3aed'}88`
                      : stage13Status.visibleStage
                      ? `2px solid ${stage13Status.visibleStage.stageColor || '#7c3aed'}88`
                      : '2px solid rgba(124,58,237,0.4)',
                    boxShadow: '0 4px 28px rgba(124,58,237,0.25)',
                    animation: 'gymCardShimmer 3s linear infinite',
                  }}>
                    {/* Animated bg */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: stage13Status.myStage
                        ? `linear-gradient(135deg, ${stage13Status.myStage.stageColor || '#7c3aed'}22, rgba(10,5,25,0.95))`
                        : stage13Status.visibleStage
                        ? `linear-gradient(135deg, ${stage13Status.visibleStage.stageColor || '#7c3aed'}22, rgba(10,5,25,0.95))`
                        : 'linear-gradient(135deg, rgba(124,58,237,0.14), rgba(10,5,25,0.95))',
                    }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg,transparent 25%,rgba(255,255,255,0.04) 50%,transparent 75%)', backgroundSize: '400% auto', animation: 'gymCardShimmer 3s linear infinite' }} />
                    <div style={{ position: 'relative', zIndex: 1, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* Icon */}
                      <div style={{
                        width: 54, height: 54, borderRadius: '50%', flexShrink: 0,
                        background: stage13Status.myStage
                          ? `${stage13Status.myStage.stageColor || '#7c3aed'}33`
                          : stage13Status.visibleStage
                          ? `${stage13Status.visibleStage.stageColor || '#7c3aed'}33`
                          : 'rgba(124,58,237,0.2)',
                        border: stage13Status.myStage
                          ? `2px solid ${stage13Status.myStage.stageColor || '#7c3aed'}66`
                          : stage13Status.visibleStage
                          ? `2px solid ${stage13Status.visibleStage.stageColor || '#7c3aed'}66`
                          : '2px solid rgba(124,58,237,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 26,
                      }}>
                        {stage13Status.pendingChallengeAsBoss ? '⚔️' : stage13Status.pendingChallengeAsChallenger ? '⏳' : stage13Status.myStage ? '👑' : stage13Status.visibleStage ? '🏰' : '🏗️'}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(196,181,253,0.7)' }}>⭐ Stage 13 – Boss Umano</p>
                        <p style={{ margin: '3px 0 1px', fontSize: 15, fontWeight: 900, color: '#e9d5ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {stage13Status.pendingChallengeAsBoss
                            ? `⚔️ ${stage13Status.pendingChallengeAsBoss.challengerUsername} ti sfida!`
                            : stage13Status.pendingChallengeAsChallenger
                            ? `⏳ Sfida a ${stage13Status.pendingChallengeAsChallenger.bossUsername}...`
                            : stage13Status.myStage
                            ? stage13Status.myStage.stageName
                            : stage13Status.visibleStage
                            ? stage13Status.visibleStage.stageName
                            : 'Costruisci il tuo Stage'}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'rgba(196,181,253,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {stage13Status.pendingChallengeAsBoss
                            ? 'Accetta o rifiuta la sfida'
                            : stage13Status.pendingChallengeAsChallenger
                            ? 'In attesa di risposta dal boss'
                            : stage13Status.myStage
                            ? `👑 Il tuo stage personale`
                            : stage13Status.visibleStage
                            ? `👊 Boss: ${stage13Status.visibleStage.bossUsername}`
                            : 'Costo: 1000 crediti'}
                        </p>
                      </div>
                      {/* Arrow */}
                      <ChevronRight style={{ width: 20, height: 20, color: 'rgba(196,181,253,0.5)', flexShrink: 0 }} />
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Tooltip 2D */}
          {hoveredLeaderId !== null && tooltipPos && (() => {
            const hLeader = activeLeaders.find(l => l.id === hoveredLeaderId);
            if (!hLeader) return null;
            const tipW = 220;
            const tipH = 180;
            const vpW = window.innerWidth;
            const vpH = window.innerHeight;
            let left = tooltipPos.x + 14;
            let top = tooltipPos.y - 20;
            if (left + tipW > vpW - 8) left = tooltipPos.x - tipW - 14;
            if (top + tipH > vpH - 8) top = vpH - tipH - 8;
            if (top < 8) top = 8;
            return (
              <div style={{ position: 'fixed', left, top, width: tipW, zIndex: 9999, pointerEvents: 'none', background: 'rgba(10,5,25,0.97)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.8)', padding: '12px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  {hLeader.leaderImageUrl ? (
                    <img src={hLeader.leaderImageUrl} alt={hLeader.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(245,158,11,0.5)', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(245,158,11,0.1)', border: '2px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Shield style={{ width: 20, height: 20, color: 'rgba(245,158,11,0.5)' }} />
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#fde68a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hLeader.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hLeader.gymName}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: hLeader.cpuLevel === 'easy' ? '#4ade80' : hLeader.cpuLevel === 'medium' ? '#facc15' : '#f87171', background: 'rgba(255,255,255,0.06)', borderRadius: 99, padding: '2px 7px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {hLeader.cpuLevel === 'easy' ? '🟢 Facile' : hLeader.cpuLevel === 'medium' ? '🟡 Medio' : '🔴 Difficile'}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', background: 'rgba(245,158,11,0.1)', borderRadius: 99, padding: '2px 7px', border: '1px solid rgba(245,158,11,0.2)' }}>⭐ +{hLeader.rewardCredits}</span>
                </div>
                {hLeader.specialty && <p style={{ margin: 0, fontSize: 10, color: 'rgba(253,230,138,0.7)', lineHeight: 1.4 }}>⚡ {hLeader.specialty}</p>}
                {hLeader.description && !hLeader.specialty && <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{hLeader.description}</p>}
              </div>
            );
          })()}
        </>
      )}

      {/* Wizard Card Reveal Overlay */}
      {showWizardCardReveal && (
        <div
          className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/90"
          onClick={() => setShowWizardCardReveal(false)}
        >
          <div className="flex flex-col items-center gap-6 animate-fade-in">
            <p className="text-yellow-300 font-black text-2xl text-center drop-shadow-lg px-6">
              Hai ricevuto una nuova carta!
            </p>
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl blur-xl opacity-60"
                style={{ background: chosenFaction === 'bullox' ? 'radial-gradient(circle, #fbbf24 0%, transparent 70%)' : 'radial-gradient(circle, #34d399 0%, transparent 70%)' }} />
              <img
                src={wizardCardImg}
                alt={wizardCardName}
                className="relative w-52 rounded-2xl shadow-2xl border-2"
                style={{ borderColor: chosenFaction === 'bullox' ? '#fbbf24' : '#34d399' }}
              />
            </div>
            <p className="text-white/80 font-bold text-lg">{wizardCardName}</p>
            <p className="text-white/40 text-sm mt-2">Tocca per continuare</p>
          </div>
        </div>
      )}

      {/* Stage 13 Modal */}
      {showStage13Modal && stage13Status && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-5"
          onClick={() => { if (!stage13BuildLoading) setShowStage13Modal(false); }}
        >
          <div
            className="w-full max-w-md bg-gray-950 border border-purple-500/40 rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            {stage13BuildSuccess ? (
              <div className="text-center flex flex-col items-center gap-4">
                <div className="text-5xl">🏰</div>
                <h3 className="text-purple-300 font-black text-xl">Stage 13 costruito!</h3>
                <p className="text-white/60 text-sm">Il tuo Stage Personale è ora attivo. Aspetta gli sfidanti!</p>
                <button
                  onClick={() => setShowStage13Modal(false)}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl transition-colors"
                >Chiudi</button>
              </div>
            ) : stage13Status.pendingChallengeAsBoss ? (
              // Case: someone is challenging your stage
              <div className="flex flex-col gap-4">
                <div className="text-center">
                  <div className="text-5xl mb-2">⚔️</div>
                  <h3 className="text-red-300 font-black text-xl">Sei sfidato!</h3>
                  <p className="text-white/60 text-sm mt-2 leading-relaxed">
                    <span className="text-yellow-300 font-bold">{stage13Status.pendingChallengeAsBoss.challengerUsername}</span> vuole sfidare il tuo Stage 13. Accetti la sfida?
                  </p>
                </div>
                {stage13BuildError && (
                  <div className="bg-red-900/40 border border-red-500/40 rounded-xl px-4 py-2 text-red-300 text-xs text-center">{stage13BuildError}</div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      setStage13BuildLoading(true); setStage13BuildError(null);
                      try {
                        const res = await fetch('/api/story-mode/stage13/respond', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                          body: JSON.stringify({ challengeId: stage13Status.pendingChallengeAsBoss.id, accept: false }),
                        });
                        const data = await res.json();
                        if (!data.success) setStage13BuildError(data.error || 'Errore');
                        else { await fetchStage13Status(); setShowStage13Modal(false); }
                      } catch { setStage13BuildError('Errore di rete'); }
                      setStage13BuildLoading(false);
                    }}
                    disabled={stage13BuildLoading}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition-colors disabled:opacity-50"
                  >{stage13BuildLoading ? '...' : 'Rifiuta'}</button>
                  <button
                    onClick={async () => {
                      setStage13BuildLoading(true); setStage13BuildError(null);
                      try {
                        const res = await fetch('/api/story-mode/stage13/respond', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                          body: JSON.stringify({ challengeId: stage13Status.pendingChallengeAsBoss.id, accept: true }),
                        });
                        const data = await res.json();
                        if (!data.success) setStage13BuildError(data.error || 'Errore');
                        else { await fetchStage13Status(); setShowStage13Modal(false); }
                      } catch { setStage13BuildError('Errore di rete'); }
                      setStage13BuildLoading(false);
                    }}
                    disabled={stage13BuildLoading}
                    className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black text-sm transition-colors disabled:opacity-50"
                  >{stage13BuildLoading ? 'Attendere...' : '⚔️ Accetta!'}</button>
                </div>
              </div>
            ) : stage13Status.pendingChallengeAsChallenger ? (
              // Case: waiting for boss to respond
              <div className="flex flex-col gap-4 text-center">
                <div className="text-5xl">⏳</div>
                <h3 className="text-blue-300 font-black text-xl">Sfida inviata!</h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  Hai sfidato lo Stage di <span className="text-yellow-300 font-bold">{stage13Status.pendingChallengeAsChallenger.bossUsername}</span>. Aspetta che accetti la sfida.
                </p>
                <button onClick={() => setShowStage13Modal(false)} className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition-colors">Chiudi</button>
              </div>
            ) : stage13Status.myStage ? (
              // Case: user already has their own stage
              <div className="flex flex-col gap-4">
                <div className="text-center">
                  <div className="text-5xl mb-2">👑</div>
                  <h3 className="font-black text-xl" style={{ color: stage13Status.myStage.stageColor || '#c084fc' }}>{stage13Status.myStage.stageName}</h3>
                  <p className="text-white/50 text-xs mt-1 font-bold uppercase tracking-wider">Il tuo Stage 13 – Boss Umano</p>
                </div>
                <div className="rounded-xl px-4 py-3 border text-sm" style={{ background: (stage13Status.myStage.stageColor || '#7c3aed') + '18', borderColor: (stage13Status.myStage.stageColor || '#7c3aed') + '55' }}>
                  <p className="text-white/60 text-xs mb-2 font-bold uppercase tracking-wider">Il tuo stage è attivo</p>
                  <p className="text-white/80 text-sm leading-relaxed">
                    Stai difendendo questo stage contro gli sfidanti. Se vinci, puoi rubare una carta dal loro mazzo. Se perdi, il tuo stage viene distrutto.
                  </p>
                  {stage13Status.myStage.youtubeMusicUrl && (
                    <p className="text-white/40 text-xs mt-2">🎵 Musica configurata</p>
                  )}
                </div>
                <button onClick={() => setShowStage13Modal(false)} className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl transition-colors">Chiudi</button>
              </div>
            ) : stage13Status.visibleStage ? (
              // Case A: there's a visible stage to challenge
              <div className="flex flex-col gap-4">
                <div className="text-center">
                  <div className="text-5xl mb-2">⚔️</div>
                  <h3 className="text-yellow-300 font-black text-xl">Ultima Sfida!</h3>
                  <p className="text-white/60 text-sm mt-2 leading-relaxed">
                    Ottimo! Hai completato le 12 Palestre. Ma c'è un'ultima sfida prima di diventare Re delle Minkiards: devi sconfiggere lo Stage di{' '}
                    <span className="text-yellow-300 font-bold">{stage13Status.visibleStage.bossUsername}</span> – la Palestra Numero 13!
                  </p>
                </div>
                <div
                  className="rounded-xl px-4 py-3 border text-center font-bold text-sm"
                  style={{ background: stage13Status.visibleStage.stageColor + '22', borderColor: stage13Status.visibleStage.stageColor + '66', color: stage13Status.visibleStage.stageColor }}
                >
                  🏰 {stage13Status.visibleStage.stageName}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowStage13Modal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition-colors"
                  >Dopo</button>
                  <button
                    onClick={async () => {
                      setStage13BuildLoading(true);
                      setStage13BuildError(null);
                      try {
                        const res = await fetch('/api/story-mode/stage13/challenge', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                          body: JSON.stringify({ stageId: stage13Status.visibleStage.id }),
                        });
                        const data = await res.json();
                        if (!data.success) setStage13BuildError(data.error || 'Errore');
                        else {
                          setStage13BuildSuccess(true);
                          await fetchStage13Status();
                        }
                      } catch { setStage13BuildError('Errore di rete'); }
                      setStage13BuildLoading(false);
                    }}
                    disabled={stage13BuildLoading}
                    className="flex-1 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm transition-colors disabled:opacity-50"
                  >
                    {stage13BuildLoading ? 'Attendere...' : 'Affronta lo Stage 13'}
                  </button>
                </div>
                {stage13BuildError && (
                  <div className="text-red-400 text-xs text-center">{stage13BuildError}</div>
                )}
              </div>
            ) : (
              // Case B: no visible stage, offer to build
              <div className="flex flex-col gap-4">
                <div className="text-center">
                  <div className="text-5xl mb-2">🏆</div>
                  <h3 className="text-yellow-300 font-black text-xl">Tutte le 12 Palestre Completate!</h3>
                  <p className="text-white/60 text-sm mt-2 leading-relaxed">
                    Vuoi costruire il tuo Stage Personale (Stage 13) e sfidare altri giocatori? Costerà <span className="text-yellow-300 font-bold">1000 crediti</span>.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-white/60 text-xs font-bold uppercase tracking-wider">Nome del tuo Stage</label>
                  <input
                    type="text"
                    value={stage13BuildName}
                    onChange={e => setStage13BuildName(e.target.value)}
                    maxLength={100}
                    placeholder="Es. La Caverna del Drago..."
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm outline-none focus:border-purple-500/60"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-white/60 text-xs font-bold uppercase tracking-wider">Colore stage</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={stage13BuildColor}
                      onChange={e => setStage13BuildColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-white/60 text-sm font-mono">{stage13BuildColor}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-white/60 text-xs font-bold uppercase tracking-wider">🎵 Musica di sottofondo (opzionale)</label>
                  <input
                    type="text"
                    value={stage13BuildMusicUrl}
                    onChange={e => setStage13BuildMusicUrl(e.target.value)}
                    placeholder="Link YouTube o YouTube Music..."
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm outline-none focus:border-purple-500/60"
                  />
                  <p className="text-white/30 text-xs">La canzone verrà riprodotta in sottofondo durante le sfide al tuo Stage 13.</p>
                </div>
                {stage13BuildError && (
                  <div className="bg-red-900/40 border border-red-500/40 rounded-xl px-4 py-2 text-red-300 text-xs text-center">
                    {stage13BuildError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowStage13Modal(false)}
                    disabled={stage13BuildLoading}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition-colors disabled:opacity-50"
                  >Salta</button>
                  <button
                    onClick={async () => {
                      if (!stage13BuildName.trim()) { setStage13BuildError('Inserisci il nome del tuo stage'); return; }
                      setStage13BuildLoading(true);
                      setStage13BuildError(null);
                      try {
                        const res = await fetch('/api/story-mode/stage13/build', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                          body: JSON.stringify({ stageName: stage13BuildName, stageColor: stage13BuildColor, youtubeMusicUrl: stage13BuildMusicUrl.trim() || null }),
                        });
                        const data = await res.json();
                        if (!data.success) setStage13BuildError(data.error || 'Errore');
                        else {
                          setStage13BuildSuccess(true);
                          await fetchStage13Status();
                        }
                      } catch { setStage13BuildError('Errore di rete'); }
                      setStage13BuildLoading(false);
                    }}
                    disabled={stage13BuildLoading || !stage13BuildName.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm transition-colors disabled:opacity-50"
                  >
                    {stage13BuildLoading ? 'Costruendo...' : 'Costruisci Stage (1000 crediti)'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stage 13 – Boss Card Steal Modal */}
      {showStage13StealModal && stage13Status?.completedChallengeWaitingSteal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 px-4"
          onClick={() => { if (!stage13StealLoading && !stage13StealSuccess) setShowStage13StealModal(false); }}
        >
          <div
            className="w-full max-w-md bg-gray-950 border border-yellow-500/40 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {stage13StealSuccess ? (
              <div className="text-center flex flex-col items-center gap-4">
                <div className="text-5xl">🃏</div>
                <h3 className="text-yellow-300 font-black text-xl">Carta rubata!</h3>
                <p className="text-white/60 text-sm">La carta è ora nel tuo mazzo Story Mode.</p>
                <button onClick={() => { setShowStage13StealModal(false); setStage13StealSuccess(false); }} className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition-colors">Chiudi</button>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <div className="text-4xl mb-2">🏆</div>
                  <h3 className="text-yellow-300 font-black text-xl">Hai difeso il tuo Stage 13!</h3>
                  <p className="text-white/60 text-sm mt-2 leading-relaxed">
                    Hai sconfitto <span className="text-yellow-300 font-bold">{stage13Status.completedChallengeWaitingSteal.challengerUsername}</span>. Puoi rubare una carta dal loro mazzo Story.
                  </p>
                </div>
                {stage13LoserDeck.length === 0 ? (
                  <div className="text-center text-white/40 text-sm py-4">
                    {stage13StealLoading ? 'Caricamento mazzo...' : 'Il mazzo dello sfidante è vuoto.'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-white/50 text-xs uppercase tracking-wider font-bold">Scegli una carta da rubare:</p>
                    <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                      {stage13LoserDeck.map((card: any) => (
                        <button
                          key={card.id}
                          disabled={stage13StealLoading}
                          onClick={async () => {
                            setStage13StealLoading(true);
                            setStage13StealError(null);
                            try {
                              const res = await fetch('/api/story-mode/stage13/steal-card', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                                body: JSON.stringify({
                                  challengeId: stage13Status.completedChallengeWaitingSteal.id,
                                  cardId: card.id,
                                }),
                              });
                              const data = await res.json();
                              if (!data.success) setStage13StealError(data.error || 'Errore');
                              else { setStage13StealSuccess(true); await fetchStage13Status(); }
                            } catch { setStage13StealError('Errore di rete'); }
                            setStage13StealLoading(false);
                          }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-yellow-500/20 border border-white/10 hover:border-yellow-500/50 transition-all text-left disabled:opacity-50"
                        >
                          <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center text-sm">🃏</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-bold text-sm truncate">{card.name || card.id}</div>
                            {card.pti && <div className="text-white/40 text-xs">{card.pti} PTI{card.stars ? ` · ${'⭐'.repeat(Math.min(card.stars, 5))}` : ''}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {stage13StealError && <div className="text-red-400 text-xs text-center">{stage13StealError}</div>}
                <button
                  onClick={() => setShowStage13StealModal(false)}
                  disabled={stage13StealLoading}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/60 font-bold text-sm transition-colors disabled:opacity-50"
                >Salta (non rubare)</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-5"
          onClick={() => { if (!resetLoading) { setShowResetConfirm(false); setResetError(null); } }}
        >
          <div
            className="w-full max-w-sm bg-gray-950 border border-red-500/30 rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <h3 className="text-white font-black text-lg mb-1">Ricomincia da capo?</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Perderai tutti i tuoi progressi, il mazzo e le stelle accumulate. Questa operazione è <span className="text-red-400 font-bold">irreversibile</span>.
              </p>
              <p className="text-white/40 text-xs mt-2">
                Vuoi davvero ricominciare?
              </p>
            </div>
            {resetError && (
              <div className="bg-red-900/40 border border-red-500/40 rounded-xl px-4 py-2 text-red-300 text-xs text-center">
                {resetError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowResetConfirm(false); setResetError(null); }}
                disabled={resetLoading}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={handleReset}
                disabled={resetLoading}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resetLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : null}
                Ricomincia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage 13 floating button — always visible regardless of scroll/view */}
      {stage13Status && (stage13Status.myStage || stage13Status.canBuild || stage13Status.visibleStage || stage13Status.pendingChallengeAsBoss || stage13Status.pendingChallengeAsChallenger) && !showStage13Modal && phase === 'map' && (
        <button
          onClick={() => {
            setShowStage13Modal(true);
            setStage13BuildSuccess(false);
            setStage13BuildError(null);
          }}
          style={{
            position: 'absolute', bottom: 100, right: 16, zIndex: 80,
            background: stage13Status.pendingChallengeAsBoss
              ? 'linear-gradient(135deg,#dc2626,#991b1b)'
              : stage13Status.myStage
              ? `linear-gradient(135deg,${stage13Status.myStage.stageColor || '#7c3aed'},#4c1d95)`
              : stage13Status.visibleStage
              ? `linear-gradient(135deg,${stage13Status.visibleStage.stageColor || '#7c3aed'},#4c1d95)`
              : 'linear-gradient(135deg,#7c3aed,#4c1d95)',
            border: 'none', borderRadius: 999, cursor: 'pointer',
            padding: '10px 18px',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 20px rgba(124,58,237,0.5), 0 0 0 2px rgba(255,255,255,0.1)',
            animation: stage13Status.pendingChallengeAsBoss ? 'gymNodePulse 1.5s ease-out infinite' : undefined,
          }}
        >
          <span style={{ fontSize: 18 }}>
            {stage13Status.pendingChallengeAsBoss ? '⚔️' : stage13Status.pendingChallengeAsChallenger ? '⏳' : stage13Status.myStage ? '👑' : stage13Status.visibleStage ? '🏰' : '🏗️'}
          </span>
          <span style={{ color: 'white', fontWeight: 900, fontSize: 13, letterSpacing: '0.01em' }}>
            {stage13Status.pendingChallengeAsBoss
              ? 'Sei sfidato!'
              : stage13Status.pendingChallengeAsChallenger
              ? 'Sfida inviata'
              : stage13Status.myStage
              ? 'Stage 13'
              : stage13Status.visibleStage
              ? 'Stage 13'
              : 'Costruisci Stage 13'}
          </span>
        </button>
      )}
    </div>
  );
}
