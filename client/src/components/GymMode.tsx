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

export function GymMode({ playerName, userId, avatarId, onBack }: GymModeProps) {
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

  const selectedLeaderRef = useRef<GymLeader | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const battleStartingRef = useRef(false);
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
        if (leader && leader.customDeck && leader.customDeck.length > 0) {
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

      {/* Stage list */}
      <div ref={mapScrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
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
          activeLeaders.map((leader, idx) => {
            const status = getLeaderStatus(leader);
            const isCompleted = status === 'completed';
            const isAvailable = status === 'available';
            const isLocked = status === 'locked';
            const isCurrent = leader.id === currentLeader?.id;
            const cpuCount = leader.cpuCount ?? 1;

            return (
              <div
                key={leader.id}
                className={`relative rounded-2xl border transition-all overflow-hidden ${
                  isCompleted
                    ? 'border-green-500/20 bg-green-900/10'
                    : isAvailable
                    ? `border-yellow-500/40 bg-gray-800/80 shadow-lg ${isCurrent ? 'shadow-yellow-500/10 current-gym-node' : ''}`
                    : 'border-white/5 bg-gray-900/40 opacity-50'
                }`}
                style={isAvailable && leader.backgroundImageUrl ? {
                  backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.92), rgba(0,0,0,0.75)), url(${leader.backgroundImageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                } : {}}
              >
                {isCurrent && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
                )}
                <div className="flex items-center gap-3 p-4">
                  {/* Stage number */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border-2 ${
                    isCompleted ? 'bg-green-900/30 border-green-500/40 text-green-300'
                    : isAvailable ? 'bg-yellow-900/30 border-yellow-500/40 text-yellow-300'
                    : 'bg-gray-800/50 border-white/10 text-white/20'
                  }`}>
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : isLocked ? <Lock className="w-4 h-4" /> : idx + 1}
                  </div>

                  {/* Leader image */}
                  <div className="relative flex-shrink-0">
                    {leader.leaderImageUrl ? (
                      <img
                        src={leader.leaderImageUrl}
                        alt={leader.name}
                        className={`w-14 h-14 rounded-xl object-cover border-2 ${
                          isCompleted ? 'border-green-500/40' : isAvailable ? 'border-yellow-500/40' : 'border-white/10'
                        }`}
                      />
                    ) : (
                      <div className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center ${
                        isCompleted ? 'bg-green-900/20 border-green-500/20' : isAvailable ? 'bg-yellow-900/20 border-yellow-500/20' : 'bg-gray-800/30 border-white/5'
                      }`}>
                        <Shield className={`w-6 h-6 ${isCompleted ? 'text-green-400/40' : isAvailable ? 'text-yellow-400/40' : 'text-white/10'}`} />
                      </div>
                    )}
                    {leader.badgeImageUrl && isCompleted && (
                      <img src={leader.badgeImageUrl} alt="badge" className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full border-2 border-gray-900 object-cover shadow-lg" onError={e => (e.currentTarget.style.display = 'none')} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <p className={`font-black text-base truncate ${isCompleted ? 'text-green-300' : isAvailable ? 'text-white' : 'text-white/30'}`}>
                        {leader.gymName}
                      </p>
                      {isCurrent && !isCompleted && (
                        <span className="text-[9px] font-black bg-yellow-500 text-black px-1.5 py-0.5 rounded-full uppercase">Prossimo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-xs ${isCompleted ? 'text-green-400/60' : isAvailable ? 'text-white/50' : 'text-white/20'}`}>
                        Boss: <span className={`font-bold ${isCompleted ? 'text-green-300/70' : 'text-white/60'}`}>{leader.name}</span>
                      </p>
                      {cpuCount > 1 && (
                        <span className="text-purple-400/70 text-[10px] bg-purple-900/20 border border-purple-500/20 rounded-full px-1.5 py-0.5 font-bold flex items-center gap-0.5">
                          <Users className="w-2.5 h-2.5" />{cpuCount}
                        </span>
                      )}
                      {leader.attackMode === 'hunt_human' && (
                        <span className="text-red-400/70 text-[10px] bg-red-900/20 border border-red-500/20 rounded-full px-1.5 py-0.5 font-bold flex items-center gap-0.5">
                          <Target className="w-2.5 h-2.5" />vs te
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] font-bold ${DIFFICULTY_LABEL[leader.cpuLevel]?.color || 'text-white/40'}`}>
                        {leader.cpuLevel === 'easy' ? '🟢' : leader.cpuLevel === 'medium' ? '🟡' : '🔴'} {DIFFICULTY_LABEL[leader.cpuLevel]?.label}
                      </span>
                      <span className={`text-[10px] ${isAvailable ? 'text-white/30' : 'text-white/15'}`}>❤️ {leader.livesCount}</span>
                      <span className={`text-[10px] ${isAvailable ? 'text-yellow-400/50' : 'text-white/15'}`}>+{leader.rewardCredits}⭐</span>
                    </div>

                    {/* Available: Challenge button */}
                    {isAvailable && (
                      <button
                        onClick={() => handleChallengeLeader(leader)}
                        className="mt-2 px-4 py-1.5 rounded-xl font-black text-xs text-white active:scale-95 transition-transform shadow-lg flex items-center gap-1.5"
                        style={{ background: 'linear-gradient(to right, #9333ea, #f59e0b)' }}
                      >
                        <Swords className="w-3 h-3" /> SFIDA!
                      </button>
                    )}

                    {/* Completed: replay */}
                    {isCompleted && (
                      <button
                        onClick={() => handleChallengeLeader(leader)}
                        className="mt-1.5 flex items-center gap-0.5 text-green-400/50 hover:text-green-400/80 transition-colors text-[10px] font-bold"
                      >
                        <ChevronRight className="w-3 h-3" /> Rigioca
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
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
