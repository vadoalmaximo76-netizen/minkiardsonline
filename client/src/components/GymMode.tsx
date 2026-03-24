import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Shield, Star, Lock, CheckCircle, Swords, Trophy, ChevronRight, Sparkles, Heart, Target, Users } from 'lucide-react';
import { GameBoard } from './GameBoard';
import { socket } from '../lib/socket';
import { useGameState } from '../lib/stores/useGameState';
import { CARD_DATA } from '../lib/cardData';
import { pauseHomeMusic, resumeHomeMusic } from './SpotifyPlayer';
import { InjuredPersonaggiDisclaimer } from './InjuredPersonaggiDisclaimer';

interface CpuConfig {
  name: string;
  imageUrl: string;
  cpuLevel: string;
  customDeck: string[];
  leaderMessages: Record<string, string[]>;
}

interface GymLeader {
  id: number;
  orderIndex: number;
  name: string;
  gymName: string;
  description: string | null;
  specialty: string | null;
  leaderImageUrl: string | null;
  badgeImageUrl: string | null;
  backgroundImageUrl: string | null;
  cpuLevel: string;
  deckBias: { personaggi: number; mosse: number; bonus: number };
  customDeck: string[];
  livesCount: number;
  playerStartingDeck: string[];
  rewardCredits: number;
  rewardDescription: string | null;
  youtubeMusicUrl: string | null;
  leaderMessages: Record<string, string[]> | null;
  cpuCount: number;
  cpuConfigs: CpuConfig[];
  attackMode: 'free_for_all' | 'hunt_human';
}

interface GymModeProps {
  playerName: string;
  userId?: number;
  avatarId?: string | null;
  onBack: () => void;
  pendingGymGame?: { gameId: string; gymLeaderCpuName?: string; gymLeaderId?: number };
  onResumeGymGame?: (gameId: string) => void;
}

type Phase = 'map' | 'intro' | 'battle' | 'victory' | 'defeat' | 'card-pick';

function getCardImageFromId(cardId: string): string {
  if (cardId.startsWith('custom-')) {
    const num = cardId.replace('custom-', '');
    return `/api/card-image/${num}`;
  }
  const parts = cardId.split('-');
  const idx = parseInt(parts[parts.length - 1]);
  const deckKey = parts.slice(0, parts.length - 1).join('_');
  const mappedKey = deckKey === 'personaggi_speciali' ? 'personaggi_speciali' : deckKey;
  const urls = (CARD_DATA as any)[mappedKey] as string[] | undefined;
  if (urls && !isNaN(idx) && idx >= 0 && idx < urls.length) return urls[idx];
  return '';
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

/* ── Story-Mode path layout ──────────────────────────────────────── */
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
`;

/* x positions as percentages of container width — must match DOM calc() values */
const GYM_NODE_PCT_RIGHT = 58; /* even stages → node center at 58% */
const GYM_NODE_PCT_LEFT  = 42; /* odd  stages → node center at 42% */

function GymPathSVG({ count }: { count: number }) {
  /* viewBox x: 0-100 (%) so SVG scales with container width.
     preserveAspectRatio="none" lets x-scale with container while y stays in px. */
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

export function GymMode({ playerName, userId, avatarId, onBack, pendingGymGame, onResumeGymGame }: GymModeProps) {
  const [leaders, setLeaders] = useState<GymLeader[]>([]);
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('map');
  const [selectedLeader, setSelectedLeader] = useState<GymLeader | null>(null);
  const [gameId, setGameIdLocal] = useState<string | null>(null);
  const [justWon, setJustWon] = useState(false);
  const [storyDeckIds, setStoryDeckIds] = useState<string[]>([]);
  const [cardPickLoading, setCardPickLoading] = useState(false);
  const [battleYoutubeVideoId, setBattleYoutubeVideoId] = useState<string | null>(null);
  const [musicActive, setMusicActive] = useState(false);
  const [pickedCardId, setPickedCardId] = useState<string | null>(null);
  const [victoryStep, setVictoryStep] = useState(0);
  const [pendingBattle, setPendingBattle] = useState<{ leader: GymLeader; deckIds: string[] } | null>(null);
  const [userCredits, setUserCredits] = useState(0);
  const [isReplayBattle, setIsReplayBattle] = useState(false);

  const selectedLeaderRef = useRef<GymLeader | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const battleStartingRef = useRef(false);
  const isReplayBattleRef = useRef(false);
  const mapScrollRef = useRef<HTMLDivElement>(null);
  const expectedCpusRef = useRef(0);
  const cpusAddedRef = useRef(0);

  const { setGameId, setPlayerName, generateSessionId, clearSession: reset } = useGameState();

  const authToken = localStorage.getItem('authToken');

  const fetchLeaders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gym-leaders', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setLeaders(data.gymLeaders || []);
        setCompletedIds(data.completedIds || []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [authToken]);

  const fetchStoryDeck = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/story-mode/deck', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) setStoryDeckIds(data.cardIds || []);
    } catch {}
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

  useEffect(() => {
    fetchLeaders();
    fetchStoryDeck();
    fetchUserCredits();
  }, [fetchLeaders, fetchStoryDeck, fetchUserCredits]);

  useEffect(() => {
    selectedLeaderRef.current = selectedLeader;
  }, [selectedLeader]);

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
      fetch(`/api/gym-leaders/${selectedLeader.id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      }).then(() => {
        setCompletedIds(prev => [...prev, selectedLeader.id]);
        setJustWon(false);
      }).catch(() => {});
    }
  }, [phase, justWon, selectedLeader, authToken]);

  useEffect(() => {
    if (phase !== 'victory') { setVictoryStep(0); return; }
    setVictoryStep(1);
    const t1 = setTimeout(() => setVictoryStep(2), 700);
    const t2 = setTimeout(() => setVictoryStep(3), 2000);
    const t3 = setTimeout(() => setVictoryStep(4), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [phase]);

  useEffect(() => {
    if (phase === 'map' && !loading && mapScrollRef.current) {
      const node = mapScrollRef.current.querySelector('.current-gym-node') as HTMLElement | null;
      if (node) {
        setTimeout(() => node.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
      }
    }
  }, [phase, loading, leaders]);

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

    if (authToken && currentDeckIds.length === 0 && leader.playerStartingDeck && leader.playerStartingDeck.length > 0) {
      try {
        const res = await fetch('/api/story-mode/deck/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ gymLeaderId: leader.id }),
        });
        const data = await res.json();
        if (data.success && data.cardIds) {
          currentDeckIds = data.cardIds;
          setStoryDeckIds(data.cardIds);
        }
      } catch {}
    }

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
    if (totalCpus > 1 && Array.isArray(leader.cpuConfigs)) {
      for (let i = 0; i < totalCpus - 1; i++) {
        const cfg = leader.cpuConfigs[i];
        if (!cfg) continue;
        const delay = 800 + (i + 1) * 500;
        setTimeout(() => {
          socket.emit('add-training-cpu', {
            gameId: newGameId,
            isGymMode: true,
            customDeck: cfg.customDeck && cfg.customDeck.length > 0 ? cfg.customDeck : undefined,
            cpuLevel: cfg.cpuLevel || 'medium',
            leaderName: cfg.name || `CPU ${i + 2}`,
            leaderImageUrl: cfg.imageUrl || undefined,
            leaderMessages: cfg.leaderMessages || undefined,
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

  const handleChallengeLeader = (leader: GymLeader) => {
    const replay = completedIds.includes(leader.id);
    isReplayBattleRef.current = replay;
    setIsReplayBattle(replay);
    setSelectedLeader(leader);
    setPhase('intro');
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
        fetch(`/api/gym-leaders/${selectedLeader.id}/complete`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        }).then(() => {
          setCompletedIds(prev => selectedLeader && !prev.includes(selectedLeader.id) ? [...prev, selectedLeader.id] : prev);
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

  const currentLeader = leaders.find(l => getLeaderStatus(l) === 'available');

  // ── BATTLE ────────────────────────────────────────────────────────────────
  if (phase === 'battle' && gameId && selectedLeader) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
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
        <div className="flex-shrink-0 text-center pt-10 pb-4 px-4">
          <div className="text-5xl mb-2">✨</div>
          <h2 className="text-yellow-300 font-black text-2xl mb-1">Scegli una carta!</h2>
          <p className="text-white/60 text-sm">
            Hai sconfitto il Boss <span className="text-yellow-300 font-bold">{selectedLeader.name}</span> dello Stage <span className="text-yellow-200 font-bold">{selectedLeader.gymName}</span>!
          </p>
          <p className="text-white/40 text-xs mt-2">Scegli una carta da aggiungere al tuo mazzo Story Mode • {storyDeckIds.length} carte nel mazzo</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
            {pickableCards.map((cardId, idx) => {
              const imgUrl = getCardImageFromId(cardId);
              const label = getCardDeckLabel(cardId);
              return (
                <button
                  key={`${cardId}-${idx}`}
                  onClick={() => handlePickCard(cardId)}
                  disabled={cardPickLoading}
                  className="relative rounded-xl overflow-hidden border-2 border-white/20 hover:border-yellow-400 hover:shadow-lg hover:shadow-yellow-400/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed aspect-[2/3] bg-gray-900"
                >
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-center py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-yellow-300 text-[10px] font-bold">{label}</span>
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
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl px-5 py-2 mt-3 inline-block">
              <p className="text-yellow-300 font-black text-xl">+{selectedLeader.rewardCredits} Rankiard</p>
            </div>
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
                    boxShadow: victoryStep >= 2 ? '0 0 40px 12px rgba(234,179,8,0.6), 0 0 80px 20px rgba(234,179,8,0.25)' : 'none',
                    transition: 'box-shadow 0.8s ease',
                  }}
                >
                  <img src={selectedLeader.badgeImageUrl} alt="medaglia" className="w-28 h-28 object-cover rounded-full border-4 border-yellow-400" />
                </div>
                <p className="text-yellow-300 font-black text-lg tracking-wide">⭐ Medaglia conquistata!</p>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-yellow-500/20 border-4 border-yellow-400 flex items-center justify-center mb-3"
                  style={{ boxShadow: victoryStep >= 2 ? '0 0 40px 12px rgba(234,179,8,0.5)' : 'none', transition: 'box-shadow 0.8s ease' }}>
                  <Star className="w-12 h-12 text-yellow-300" />
                </div>
                <p className="text-yellow-300 font-black text-lg">⭐ Stage completato!</p>
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

          <div
            className="transition-all duration-700"
            style={{ opacity: victoryStep >= 4 ? 1 : 0, transform: victoryStep >= 4 ? 'translateY(0)' : 'translateY(10px)' }}
          >
            <button
              onClick={() => { setPhase('map'); setSelectedLeader(null); fetchLeaders(); fetchUserCredits(); }}
              className="px-8 py-3.5 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-lg rounded-2xl transition-all shadow-xl shadow-yellow-500/30 active:scale-95"
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
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
        style={{
          background: selectedLeader.backgroundImageUrl
            ? `linear-gradient(to bottom, rgba(0,0,0,0.88), rgba(20,0,0,0.97)), url(${selectedLeader.backgroundImageUrl}) center/cover`
            : 'linear-gradient(135deg, #1a0000 0%, #0a000e 100%)',
        }}
      >
        <div className="text-7xl mb-4">💀</div>
        <h2 className="text-red-400 font-black text-4xl tracking-wide drop-shadow-lg mb-2">SCONFITTA</h2>
        <p className="text-white/50 text-sm text-center mb-8">
          Il Boss <span className="text-red-300 font-bold">{selectedLeader.name}</span> ti ha battuto.<br />Riprova!
        </p>
        <button
          onClick={() => { setPhase('map'); setSelectedLeader(null); fetchLeaders(); }}
          className="px-8 py-3.5 bg-gray-700 hover:bg-gray-600 text-white font-black text-lg rounded-2xl transition-all active:scale-95 shadow-xl"
        >
          Torna alla Mappa
        </button>
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
        {/* InjuredPersonaggiDisclaimer with actual battle start callback */}
        {pendingBattle ? (
          <InjuredPersonaggiDisclaimer
            authToken={authToken || ''}
            relevantCardIds={pendingBattle.deckIds}
            userCredits={userCredits}
            onCreditsUpdated={(c) => setUserCredits(c)}
            onConfirm={(filteredIds) => doStartBattle(pendingBattle.leader, filteredIds)}
            onCancel={() => { setPendingBattle(null); setPhase('map'); setSelectedLeader(null); }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-5">
            {/* Boss image */}
            {selectedLeader.leaderImageUrl ? (
              <div className="relative">
                <img
                  src={selectedLeader.leaderImageUrl}
                  alt={selectedLeader.name}
                  className="w-36 h-36 object-cover rounded-3xl border-4 border-yellow-400/40 shadow-2xl shadow-yellow-400/10"
                />
                <div className="absolute -bottom-2 -right-2 bg-orange-600 text-white text-[10px] font-black rounded-full px-2 py-0.5 border-2 border-gray-900">
                  BOSS
                </div>
              </div>
            ) : (
              <div className="w-36 h-36 rounded-3xl bg-gray-800 border-4 border-yellow-400/30 flex items-center justify-center">
                <Shield className="w-16 h-16 text-yellow-400/40" />
              </div>
            )}

            {/* Stage name */}
            <div>
              <p className="text-yellow-400/70 text-xs font-black uppercase tracking-widest mb-1">Stage {selectedLeader.orderIndex}</p>
              <h2 className="text-white font-black text-3xl mb-1">{selectedLeader.gymName}</h2>
              <p className="text-white/50 text-sm">Boss: <span className="text-yellow-300 font-bold">{selectedLeader.name}</span></p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap justify-center gap-2">
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
        )}
      </div>
    );
  }

  // ── MAP ───────────────────────────────────────────────────────────────────
  const activeLeaders = leaders.filter(l => l.isActive).sort((a, b) => a.orderIndex - b.orderIndex);
  const completedCount = activeLeaders.filter(l => completedIds.includes(l.id)).length;
  const totalCount = activeLeaders.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'linear-gradient(180deg, #0a0515 0%, #05080f 50%, #0a0515 100%)' }}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/10" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="p-2 text-white/50 hover:text-white transition-colors hover:bg-white/10 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-black text-lg leading-tight">Story Mode</h1>
            <p className="text-white/40 text-xs">Affronta gli Stage e colleziona carte</p>
          </div>
          {/* Progress */}
          <div className="text-right">
            <p className="text-white font-bold text-sm">{completedCount}/{totalCount}</p>
            <p className="text-white/40 text-xs">Stage</p>
          </div>
        </div>
        {/* Progress bar */}
        {totalCount > 0 && (
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

      {/* Deck info bar */}
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
        <div className="h-6 w-px bg-white/10" />
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

      {/* Riprendi partita banner — shown only when the leader ID is unknown (fallback) */}
      {pendingGymGame && onResumeGymGame && !pendingGymGame.gymLeaderId && (
        <div className="flex-shrink-0 mx-4 mt-3 flex items-center gap-3 bg-orange-900/30 border border-orange-500/40 rounded-2xl px-4 py-3">
          <Swords className="w-5 h-5 text-orange-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-orange-200 font-black text-sm leading-tight">Battaglia interrotta</p>
            <p className="text-orange-400/70 text-xs truncate">
              {pendingGymGame.gymLeaderCpuName ? `vs ${pendingGymGame.gymLeaderCpuName}` : 'Partita in corso sul server'}
            </p>
          </div>
          <button
            onClick={() => onResumeGymGame(pendingGymGame.gameId)}
            className="flex-shrink-0 px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-black text-xs rounded-xl transition-colors active:scale-95"
          >
            Riprendi
          </button>
        </div>
      )}

      {/* Stage path map */}
      <style>{GYM_PATH_STYLES}</style>
      <div ref={mapScrollRef} className="flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
        {loading ? (
          <div className="text-center py-16">
            <div className="w-10 h-10 border-2 border-white/20 border-t-yellow-400 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/30 text-sm">Caricamento Story Mode…</p>
          </div>
        ) : activeLeaders.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <p className="text-white/30 text-sm">Nessuno stage disponibile</p>
            <p className="text-white/20 text-xs mt-1">Gli stage verranno aggiunti presto</p>
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', minHeight: GYM_PATH_TOP_PAD + activeLeaders.length * GYM_PATH_NODE_H + 32 }}>
            <GymPathSVG count={activeLeaders.length} />

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

              /* ── node ── */
              const leaderNode = (
                <div
                  className="gym-path-node-pop"
                  style={{ position: 'relative', width: nodeSize, height: nodeSize, flexShrink: 0, animationDelay: `${idx * 0.06}s`, zIndex: 2 }}
                >
                  {/* pulse ring */}
                  {isCurrent && (
                    <div style={{
                      position: 'absolute', inset: -7, borderRadius: '50%',
                      border: '2.5px solid #f59e0b99',
                      animation: 'gymNodePulse 1.9s ease-out infinite',
                    }} />
                  )}
                  {/* spinning dashes */}
                  {isCurrent && (
                    <div style={{
                      position: 'absolute', inset: -10, borderRadius: '50%',
                      border: '2px dashed #f59e0b44',
                      animation: 'gymNodeSpin 6s linear infinite',
                    }} />
                  )}
                  {/* circle */}
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    border: `${isCurrent ? 3 : 2}px solid ${borderColor}`,
                    overflow: 'hidden',
                    background: isLocked ? '#0d0a1a' : 'linear-gradient(135deg,#1a1040,#0d0a22)',
                    boxShadow: isCurrent
                      ? '0 0 20px #f59e0baa, 0 0 40px #f59e0b44'
                      : isCompleted ? '0 0 8px #4ade8044' : '0 4px 14px rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                    animation: isCurrent ? 'gymNodeGlow 2.4s ease-in-out infinite' : 'none',
                    opacity: isLocked ? 0.3 : 1,
                  }}>
                    {isLocked ? (
                      <Lock className="w-5 h-5 text-white/20" />
                    ) : leader.leaderImageUrl ? (
                      <img
                        src={leader.leaderImageUrl}
                        alt={leader.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                      />
                    ) : (
                      <Shield style={{ width: nodeSize * 0.4, height: nodeSize * 0.4, color: isCompleted ? '#4ade8066' : '#f59e0b55' }} />
                    )}
                    {/* shine for completed */}
                    {isCompleted && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.15), transparent 60%)',
                      }} />
                    )}
                  </div>
                  {/* done tick */}
                  {isCompleted && (
                    <div style={{
                      position: 'absolute', top: -4, right: -4,
                      width: 19, height: 19, borderRadius: '50%',
                      background: 'linear-gradient(135deg,#16a34a,#15803d)',
                      border: '2px solid #05080f',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: 'white', fontWeight: 900,
                      boxShadow: '0 0 6px #22c55e99',
                    }}>✓</div>
                  )}
                  {/* badge circle — always show when image available, show a fallback ring when not */}
                  {!isLocked && (
                    <div style={{
                      position: 'absolute',
                      bottom: -4, left: isCurrent ? -8 : -6,
                      width: isCurrent ? 26 : 22, height: isCurrent ? 26 : 22,
                      borderRadius: '50%',
                      border: `2px solid ${isCompleted ? '#4ade8066' : '#f59e0b44'}`,
                      background: isCompleted ? 'rgba(22,101,52,0.8)' : 'rgba(120,53,15,0.8)',
                      overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isCompleted ? '0 0 6px #4ade8088' : '0 0 5px #f59e0b66',
                      animation: 'gymBadgeBounce 2s ease-in-out infinite',
                      zIndex: 3,
                    }}>
                      {leader.badgeImageUrl ? (
                        <img
                          src={leader.badgeImageUrl}
                          alt="badge"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <Star style={{ width: '55%', height: '55%', color: isCompleted ? '#4ade80' : '#f59e0b' }} />
                      )}
                    </div>
                  )}
                </div>
              );

              /* ── info card ── */
              const align = side === 'right' ? 'flex-start' : 'flex-end';
              const txtAlign: 'left' | 'right' = side === 'right' ? 'left' : 'right';
              const bgImg = leader.backgroundImageUrl;

              const infoCard = isLocked ? (
                <div style={{
                  width: '100%', height: '100%',
                  borderRadius: 14, overflow: 'hidden',
                  position: 'relative',
                  border: '1px solid #1f2937',
                  opacity: 0.38,
                }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,15,0.92)' }} />
                  <div style={{ position: 'relative', zIndex: 1, padding: '10px 12px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: txtAlign }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#374151', letterSpacing: '0.06em' }}>
                      STAGE {leader.orderIndex}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 10, color: '#1f2937', fontWeight: 700 }}>
                      🔒 Stage bloccato
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  borderRadius: 14, overflow: 'hidden',
                  position: 'relative',
                  border: isCurrent ? '1.5px solid #f59e0baa' : isCompleted ? '1px solid #4ade8044' : '1px solid rgba(245,158,11,0.18)',
                  boxShadow: isCurrent ? '0 4px 22px #f59e0b55' : isCompleted ? '0 2px 10px #4ade8022' : 'none',
                }}>
                  {/* Stage background image at 50% opacity */}
                  {bgImg && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      backgroundImage: `url(${bgImg})`,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      opacity: 0.5,
                    }} />
                  )}
                  {/* Colour tint overlay */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: isCurrent
                      ? 'linear-gradient(135deg,rgba(120,53,15,0.72),rgba(180,83,9,0.55))'
                      : isCompleted
                      ? 'rgba(0,30,15,0.72)'
                      : 'rgba(5,5,18,0.70)',
                  }} />
                  {/* Shimmer on current stage */}
                  {isCurrent && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(105deg,transparent 25%,rgba(255,255,255,0.07) 50%,transparent 75%)',
                      backgroundSize: '400% auto',
                      animation: 'gymCardShimmer 3s linear infinite',
                    }} />
                  )}

                  {/* Content */}
                  <div style={{ position: 'relative', zIndex: 1, padding: '8px 10px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', gap: 2 }}>
                    {/* Top: stage label + gym name + boss */}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: '0 0 1px', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: isCurrent ? '#f59e0bcc' : isCompleted ? '#4ade8099' : 'rgba(255,255,255,0.25)', textAlign: txtAlign, whiteSpace: 'nowrap' }}>
                        ⚡ Stage {leader.orderIndex}
                      </p>
                      <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 900, lineHeight: 1.1, color: isCurrent ? '#fde68a' : isCompleted ? '#86efac' : 'white', textAlign: txtAlign, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {leader.gymName}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: isCurrent ? 'rgba(253,230,138,0.65)' : isCompleted ? 'rgba(134,239,172,0.55)' : 'rgba(255,255,255,0.4)', textAlign: txtAlign, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        👊 <span style={{ fontWeight: 900, color: isCurrent ? '#fde68a' : isCompleted ? '#86efac' : 'rgba(255,255,255,0.7)' }}>{leader.name}</span>
                      </p>
                    </div>

                    {/* Middle: stats strip */}
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

                    {/* Bottom: action button */}
                    <div>
                      {pendingGymGame?.gymLeaderId === leader.id && onResumeGymGame ? (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: align }}>
                          <button
                            onClick={() => onResumeGymGame(pendingGymGame.gameId)}
                            style={{ background: 'linear-gradient(135deg,#ea580c,#c2410c)', border: 'none', borderRadius: 9, color: 'white', fontSize: 12, fontWeight: 900, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 2px 8px rgba(234,88,12,0.5)', whiteSpace: 'nowrap' }}
                          >
                            <Swords style={{ width: 11, height: 11 }} /> Riprendi
                          </button>
                          {isAvailable && (
                            <button
                              onClick={() => handleChallengeLeader(leader)}
                              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 800, padding: '5px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Nuova
                            </button>
                          )}
                        </div>
                      ) : isAvailable ? (
                        <div style={{ display: 'flex', justifyContent: align }}>
                          <button
                            onClick={() => handleChallengeLeader(leader)}
                            style={{ border: 'none', borderRadius: 9, color: 'white', fontSize: 13, fontWeight: 900, padding: '6px 13px', cursor: 'pointer', background: 'linear-gradient(135deg,#9333ea,#f59e0b)', display: 'inline-flex', alignItems: 'center', gap: 5, letterSpacing: '0.04em', boxShadow: '0 2px 10px rgba(147,51,234,0.5)', whiteSpace: 'nowrap' }}
                          >
                            <Swords style={{ width: 12, height: 12 }} /> SFIDA!
                          </button>
                        </div>
                      ) : isCompleted ? (
                        <div style={{ display: 'flex', justifyContent: align }}>
                          <button
                            onClick={() => handleChallengeLeader(leader)}
                            style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 9, color: '#4ade80cc', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, padding: '5px 10px', whiteSpace: 'nowrap' }}
                          >
                            <ChevronRight style={{ width: 12, height: 12 }} /> Rigioca
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );

              /* node center at GYM_NODE_PCT_RIGHT% or GYM_NODE_PCT_LEFT% — matches SVG viewBox coords */
              const nodePct = side === 'right' ? GYM_NODE_PCT_RIGHT : GYM_NODE_PCT_LEFT;
              const GAP = 9; /* px gap between node edge and card */
              const EDGE = 10; /* px margin from screen edge */

              return (
                <div
                  key={leader.id}
                  style={{ position: 'absolute', top: nodeY, left: 0, right: 0, height: GYM_PATH_NODE_H }}
                >
                  {/* Node — absolutely placed at the SVG percentage position */}
                  <div style={{
                    position: 'absolute',
                    top: '50%', transform: 'translateY(-50%)',
                    left: `calc(${nodePct}% - ${nodeSize / 2}px)`,
                    zIndex: 2,
                  }}>
                    {leaderNode}
                  </div>

                  {/* Card — fills the row height on the opposite side of the node */}
                  <div style={{
                    position: 'absolute',
                    top: 6, bottom: 6,
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

        {/* All completed banner */}
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
      </div>
    </div>
  );
}
