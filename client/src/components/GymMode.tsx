import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Shield, Star, Lock, CheckCircle, Swords, Trophy, ChevronRight, Sparkles, Heart } from 'lucide-react';
import { GameBoard } from './GameBoard';
import { socket } from '../lib/socket';
import { useGameState } from '../lib/stores/useGameState';
import { CARD_DATA } from '../lib/cardData';
import { pauseHomeMusic, resumeHomeMusic } from './SpotifyPlayer';

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

  const selectedLeaderRef = useRef<GymLeader | null>(null);
  const gameIdRef = useRef<string | null>(null);

  const { setGameId, setPlayerName, generateSessionId, reset } = useGameState();

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

  useEffect(() => {
    fetchLeaders();
    fetchStoryDeck();
  }, [fetchLeaders, fetchStoryDeck]);

  useEffect(() => {
    selectedLeaderRef.current = selectedLeader;
  }, [selectedLeader]);

  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  useEffect(() => {
    const handleGameOver = (data: any) => {
      const gid = gameIdRef.current;
      if (!gid || data.gameId !== gid) return;
      const actuallyWon = data.winner && (
        data.winner.toLowerCase() === playerName.toLowerCase() ||
        (data.winnerId && data.winnerId === userId)
      );
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
    socket.on('game-over', handleGameOver);
    return () => { socket.off('game-over', handleGameOver); };
  }, [playerName, userId]);

  useEffect(() => {
    const handleCpuAdded = ({ cpuName }: { cpuName: string }) => {
      const leader = selectedLeaderRef.current;
      const gid = gameIdRef.current;
      if (!gid || !leader) return;
      const livesLimit = leader.livesCount > 0 ? String(leader.livesCount) : '3';
      console.log(`[GymMode] CPU added (${cpuName}), auto-starting game ${gid} with characterLimit=${livesLimit}`);
      setTimeout(() => {
        socket.emit('start-game', {
          gameId: gid,
          playerName,
          characterLimit: livesLimit,
        });
      }, 400);
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

  const startBattle = useCallback(async (leader: GymLeader) => {
    const newGameId = `gym-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setGameIdLocal(newGameId);
    setSelectedLeader(leader);
    selectedLeaderRef.current = leader;
    gameIdRef.current = newGameId;

    setGameId(newGameId);
    setPlayerName(playerName);
    generateSessionId();

    // Always fetch the latest story deck fresh from server before each battle
    // so the accumulated deck is always up-to-date across the whole story mode
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

    // Initialize with first-leader starting deck only if story deck is still empty
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

    socket.emit('create-training-game', {
      gameId: newGameId,
      playerName,
      avatarId,
      userId,
      helpEnabled: false,
      isGymMode: true,
      playerDeck: currentDeckIds.length > 0 ? currentDeckIds : undefined,
      livesCount: leader.livesCount || 3,
    });

    setTimeout(() => {
      socket.emit('add-training-cpu', {
        gameId: newGameId,
        isGymMode: true,
        customDeck: leader.customDeck && leader.customDeck.length > 0 ? leader.customDeck : undefined,
        cpuLevel: leader.cpuLevel,
        leaderName: leader.name,
        leaderImageUrl: leader.leaderImageUrl || undefined,
        leaderMessages: leader.leaderMessages || undefined,
      });
    }, 800);

    // YouTube battle music
    const ytId = leader.youtubeMusicUrl ? extractYoutubeVideoId(leader.youtubeMusicUrl) : null;
    setBattleYoutubeVideoId(ytId);

    pauseHomeMusic();
    setPhase('battle');
  }, [playerName, avatarId, userId, setGameId, setPlayerName, generateSessionId, authToken]);

  const handleBackFromBattle = () => {
    if (gameId) {
      socket.emit('leave-game', { gameId });
    }
    // Change phase FIRST so GameBoard unmounts before reset() clears the game state.
    // Calling reset() while GameBoard is still mounted causes a crash because GameBoard
    // re-renders with null gameState before being unmounted.
    setGameIdLocal(null);
    setBattleYoutubeVideoId(null);
    setMusicActive(false);
    setPhase('map');
    setSelectedLeader(null);
    resumeHomeMusic();
    fetchLeaders();
    // Defer reset() to let React unmount GameBoard cleanly first
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

  if (phase === 'battle' && gameId && selectedLeader) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* YouTube battle music – shown when user activates */}
        {battleYoutubeVideoId && musicActive && (
          <iframe
            key={battleYoutubeVideoId}
            src={`https://www.youtube.com/embed/${battleYoutubeVideoId}?autoplay=1&loop=1&playlist=${battleYoutubeVideoId}&controls=0`}
            allow="autoplay"
            style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            title="battle-music"
          />
        )}
        {/* Floating battle header overlay */}
        <div className="fixed top-4 left-4 z-[60] flex items-center gap-3 flex-wrap">
          <button
            onClick={handleBackFromBattle}
            className="px-3 py-2 bg-black/70 hover:bg-black/90 text-white rounded-xl text-sm font-semibold flex items-center gap-2 border border-white/20 backdrop-blur-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Abbandona
          </button>
          <div className="bg-black/70 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2 flex items-center gap-2">
            {selectedLeader.leaderImageUrl ? (
              <img src={selectedLeader.leaderImageUrl} alt={selectedLeader.name} className="w-6 h-6 rounded-full object-cover border border-yellow-400/40" />
            ) : selectedLeader.badgeImageUrl ? (
              <img src={selectedLeader.badgeImageUrl} alt="" className="w-5 h-5 rounded-full" />
            ) : (
              <Shield className="w-4 h-4 text-yellow-400" />
            )}
            <span className="text-white text-xs font-bold">{selectedLeader.gymName}</span>
            <span className="text-white/50 text-xs">vs {selectedLeader.name}</span>
          </div>
          <div className="bg-black/70 backdrop-blur-sm border border-red-500/30 rounded-xl px-3 py-2 flex items-center gap-1">
            {Array.from({ length: selectedLeader.livesCount || 3 }).map((_, i) => (
              <Heart key={i} className="w-3.5 h-3.5 text-red-400 fill-red-400" />
            ))}
          </div>
          {battleYoutubeVideoId && (
            <button
              onClick={() => setMusicActive(a => !a)}
              title={musicActive ? 'Disattiva musica battaglia' : 'Attiva musica battaglia'}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border backdrop-blur-sm transition-colors ${
                musicActive
                  ? 'bg-red-600/80 hover:bg-red-700/90 text-white border-red-400/40'
                  : 'bg-black/70 hover:bg-black/90 text-white/60 hover:text-white border-white/20'
              }`}
            >
              {musicActive ? '🎵 On' : '🎵 Off'}
            </button>
          )}
        </div>
        <GameBoard />
      </div>
    );
  }

  if (phase === 'card-pick' && selectedLeader && selectedLeader.customDeck && selectedLeader.customDeck.length > 0) {
    const pickableCards = selectedLeader.customDeck;
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{
          background: selectedLeader.backgroundImageUrl
            ? `linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.96)), url(${selectedLeader.backgroundImageUrl}) center/cover`
            : 'linear-gradient(135deg, #1a0a2e 0%, #0a1a2e 100%)',
        }}
      >
        <div className="flex-shrink-0 text-center pt-10 pb-4 px-4">
          <div className="text-5xl mb-2">✨</div>
          <h2 className="text-yellow-300 font-black text-2xl mb-1">Scegli una carta!</h2>
          <p className="text-white/60 text-sm">
            Hai sconfitto <span className="text-yellow-300 font-bold">{selectedLeader.name}</span>!
            Scegli una carta del Capopalestra da aggiungere al tuo mazzo Story Mode.
          </p>
          <p className="text-white/40 text-xs mt-2">
            Il tuo mazzo: {storyDeckIds.length} carte
          </p>
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
                  className="relative rounded-xl overflow-hidden border-2 border-white/20 hover:border-yellow-400 transition-all group disabled:opacity-50 disabled:cursor-not-allowed aspect-[2/3] bg-gray-900"
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

  if (phase === 'victory' && selectedLeader) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: selectedLeader.backgroundImageUrl
            ? `linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.92)), url(${selectedLeader.backgroundImageUrl}) center/cover`
            : 'linear-gradient(135deg, #1a0a2e 0%, #0a1a2e 100%)',
        }}
      >
        <div className="text-center max-w-sm w-full">
          <div className="text-7xl mb-4">🏆</div>
          <h2 className="text-yellow-300 font-black text-3xl mb-2">VITTORIA!</h2>
          <p className="text-white/70 mb-6">Hai sconfitto {selectedLeader.name} della {selectedLeader.gymName}!</p>

          {selectedLeader.badgeImageUrl && (
            <div className="flex flex-col items-center mb-6">
              <img src={selectedLeader.badgeImageUrl} alt="badge" className="w-20 h-20 object-cover rounded-full border-4 border-yellow-400 shadow-lg shadow-yellow-400/30 mb-2" />
              <p className="text-yellow-400 font-bold text-sm">Medaglia ottenuta!</p>
            </div>
          )}

          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-2xl px-6 py-4 mb-4">
            <p className="text-yellow-300 font-black text-2xl">+{selectedLeader.rewardCredits} Rankiard</p>
            {selectedLeader.rewardDescription && (
              <p className="text-white/60 text-sm mt-1">{selectedLeader.rewardDescription}</p>
            )}
          </div>

          {storyDeckIds.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl px-4 py-3 mb-6">
              <p className="text-blue-300 text-sm font-semibold">📖 Mazzo Story Mode: {storyDeckIds.length} carte</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { resumeHomeMusic(); setPhase('map'); setSelectedLeader(null); fetchLeaders(); fetchStoryDeck(); }}
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-2xl transition-all"
            >
              Continua percorso →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'defeat' && selectedLeader) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg, #1a0505 0%, #0a0a1a 100%)' }}
      >
        <div className="text-center max-w-sm w-full">
          <div className="text-7xl mb-4">💀</div>
          <h2 className="text-red-400 font-black text-3xl mb-2">SCONFITTO!</h2>
          <p className="text-white/70 mb-6">{selectedLeader.name} era troppo forte. Allenati e riprova!</p>

          <div className="flex gap-3">
            <button
              onClick={() => { resumeHomeMusic(); setPhase('map'); setSelectedLeader(null); }}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-2xl transition-all"
            >
              ← Mappa
            </button>
            <button
              onClick={() => startBattle(selectedLeader)}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-2xl transition-all"
            >
              Riprova!
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'intro' && selectedLeader) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: selectedLeader.backgroundImageUrl
            ? `linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.9)), url(${selectedLeader.backgroundImageUrl}) center/cover`
            : 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 100%)',
        }}
      >
        <div className="max-w-sm w-full text-center">
          <button onClick={() => setPhase('map')} className="absolute top-6 left-6 text-white/50 hover:text-white flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Indietro
          </button>

          {selectedLeader.leaderImageUrl ? (
            <img src={selectedLeader.leaderImageUrl} alt={selectedLeader.name} className="w-28 h-28 object-cover rounded-full mx-auto border-4 border-yellow-400/60 mb-5 shadow-2xl" />
          ) : (
            <div className="w-28 h-28 bg-gray-800 rounded-full mx-auto border-4 border-white/20 mb-5 flex items-center justify-center">
              <Shield className="w-12 h-12 text-white/30" />
            </div>
          )}

          <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Palestra #{selectedLeader.orderIndex}</p>
          <h2 className="text-white font-black text-2xl mb-1">{selectedLeader.gymName}</h2>
          <p className="text-white/70 text-lg mb-3">Capopalestra <span className="text-yellow-300 font-bold">{selectedLeader.name}</span></p>

          {selectedLeader.specialty && (
            <div className="inline-block bg-yellow-900/40 border border-yellow-600/30 text-yellow-300 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
              ⚡ {selectedLeader.specialty}
            </div>
          )}

          {selectedLeader.description && (
            <p className="text-white/50 text-sm mb-6 leading-relaxed italic">"{selectedLeader.description}"</p>
          )}

          <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 mb-4 flex items-center justify-center gap-4 flex-wrap">
            <div className="text-center">
              <div className={`text-xs font-bold px-2 py-1 rounded-full mb-1 ${
                selectedLeader.cpuLevel === 'easy' ? 'bg-green-900/50 text-green-300'
                : selectedLeader.cpuLevel === 'medium' ? 'bg-yellow-900/50 text-yellow-300'
                : 'bg-red-900/50 text-red-300'
              }`}>
                {selectedLeader.cpuLevel === 'easy' ? '🟢 Facile' : selectedLeader.cpuLevel === 'medium' ? '🟡 Medio' : '🔴 Difficile'}
              </div>
              <p className="text-white/40 text-[10px]">Difficoltà</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <div className="flex items-center gap-0.5 justify-center mb-1">
                {Array.from({ length: selectedLeader.livesCount || 3 }).map((_, i) => (
                  <Heart key={i} className="w-4 h-4 text-red-400 fill-red-400" />
                ))}
              </div>
              <p className="text-white/40 text-[10px]">Vite</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-yellow-300 font-black text-lg">+{selectedLeader.rewardCredits}</p>
              <p className="text-white/40 text-[10px]">Rankiard</p>
            </div>
            {selectedLeader.badgeImageUrl && (
              <>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <img src={selectedLeader.badgeImageUrl} alt="badge" className="w-8 h-8 object-cover rounded-full border border-yellow-400/50 mx-auto" />
                  <p className="text-white/40 text-[10px] mt-0.5">Medaglia</p>
                </div>
              </>
            )}
          </div>

          {storyDeckIds.length > 0 && (
            <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl px-4 py-2 mb-4 text-left">
              <p className="text-blue-300 text-xs font-semibold">📖 Mazzo Story Mode: {storyDeckIds.length} carte</p>
              <p className="text-blue-400/60 text-[10px] mt-0.5">Il tuo mazzo accumulato verrà usato in questa battaglia</p>
            </div>
          )}

          <button
            onClick={() => startBattle(selectedLeader)}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black py-4 rounded-2xl text-lg transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-3"
          >
            <Swords className="w-5 h-5" /> SFIDA!
          </button>
        </div>
      </div>
    );
  }

  const completedCount = completedIds.length;
  const totalCount = leaders.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(180deg, #03050d 0%, #070b1a 40%, #0a1028 100%)' }}>
      <div className="flex-shrink-0 flex items-center gap-4 px-4 pt-safe py-4 border-b border-white/10 bg-black/30 backdrop-blur-sm">
        <button onClick={onBack} className="p-2 text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center shadow-lg">
            <Trophy className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-white font-black text-lg leading-none">Story Mode</h1>
            <p className="text-white/40 text-xs mt-0.5">Percorso Palestre</p>
          </div>
        </div>
        <div className="ml-auto text-right">
          <p className="text-yellow-300 font-black text-lg leading-none">{completedCount}/{totalCount}</p>
          <p className="text-white/40 text-xs mt-0.5">palestre</p>
        </div>
      </div>

      {storyDeckIds.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 bg-blue-900/20 border-b border-blue-500/20 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <p className="text-blue-300 text-xs font-semibold">Mazzo Story Mode: {storyDeckIds.length} carte accumulate</p>
        </div>
      )}

      {totalCount > 0 && (
        <div className="flex-shrink-0 px-4 py-2 bg-black/20">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-700"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-white/40">
            Caricamento percorso...
          </div>
        ) : leaders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-8">
            <Shield className="w-16 h-16 text-white/15 mb-4" />
            <p className="text-white/40 text-lg font-semibold">Nessuna palestra disponibile</p>
            <p className="text-white/25 text-sm mt-1">Le palestre verranno aggiunte presto!</p>
          </div>
        ) : (
          <div className="px-4 py-6 space-y-0">
            {leaders.map((leader, idx) => {
              const status = getLeaderStatus(leader);
              const isCompleted = status === 'completed';
              const isAvailable = status === 'available';
              const isLocked = status === 'locked';
              const isCurrent = leader.id === currentLeader?.id;

              return (
                <div key={leader.id} className="relative">
                  {idx < leaders.length - 1 && (
                    <div className="absolute left-8 top-full w-px h-6 bg-white/10 z-0" />
                  )}

                  <div
                    className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all mb-6 ${
                      isCompleted
                        ? 'bg-green-900/15 border-green-500/25'
                        : isAvailable
                        ? 'bg-yellow-900/20 border-yellow-500/40 shadow-lg shadow-yellow-500/10'
                        : 'bg-white/3 border-white/8 opacity-50'
                    } ${isCurrent ? 'ring-2 ring-yellow-400/40' : ''}`}
                  >
                    <div className="relative flex-shrink-0">
                      {leader.leaderImageUrl ? (
                        <img
                          src={leader.leaderImageUrl}
                          alt={leader.name}
                          className={`w-16 h-16 object-cover rounded-xl border-2 ${
                            isCompleted ? 'border-green-500/50' : isAvailable ? 'border-yellow-400/60' : 'border-white/10'
                          } ${isLocked ? 'grayscale' : ''}`}
                        />
                      ) : (
                        <div className={`w-16 h-16 rounded-xl border-2 flex items-center justify-center ${
                          isCompleted ? 'bg-green-900/40 border-green-500/40' : isAvailable ? 'bg-yellow-900/40 border-yellow-400/40' : 'bg-gray-800 border-white/10'
                        }`}>
                          <Shield className={`w-8 h-8 ${isCompleted ? 'text-green-400' : isAvailable ? 'text-yellow-400' : 'text-white/20'}`} />
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1">
                        {isCompleted ? (
                          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md border-2 border-gray-900">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                        ) : isLocked ? (
                          <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center shadow-md border-2 border-gray-900">
                            <Lock className="w-3 h-3 text-white/40" />
                          </div>
                        ) : isCurrent ? (
                          <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center shadow-md border-2 border-gray-900 animate-pulse">
                            <Swords className="w-3 h-3 text-black" />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-bold ${isCompleted ? 'text-green-400' : isAvailable ? 'text-yellow-400' : 'text-white/30'}`}>
                          Palestra #{leader.orderIndex}
                        </span>
                        {isCompleted && leader.badgeImageUrl && (
                          <img src={leader.badgeImageUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                        )}
                      </div>
                      <h3 className={`font-black text-base leading-tight ${isLocked ? 'text-white/30' : 'text-white'}`}>
                        {leader.gymName}
                      </h3>
                      <p className={`text-sm ${isLocked ? 'text-white/20' : 'text-white/60'}`}>
                        {leader.name}
                      </p>
                      {leader.specialty && !isLocked && (
                        <p className="text-yellow-400/70 text-xs mt-0.5">⚡ {leader.specialty}</p>
                      )}
                      {isCompleted && (
                        <p className="text-green-400 text-xs font-semibold mt-0.5">✓ Completata</p>
                      )}
                      {!isLocked && (
                        <div className="flex items-center gap-0.5 mt-1">
                          {Array.from({ length: leader.livesCount || 3 }).map((_, i) => (
                            <Heart key={i} className="w-3 h-3 text-red-400 fill-red-400" />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0 text-right flex flex-col items-end gap-2">
                      {!isLocked && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          leader.cpuLevel === 'easy' ? 'bg-green-900/50 text-green-300'
                          : leader.cpuLevel === 'medium' ? 'bg-yellow-900/50 text-yellow-300'
                          : 'bg-red-900/50 text-red-300'
                        }`}>
                          {leader.cpuLevel === 'easy' ? '🟢' : leader.cpuLevel === 'medium' ? '🟡' : '🔴'}
                          {' '}{leader.cpuLevel === 'easy' ? 'Facile' : leader.cpuLevel === 'medium' ? 'Medio' : 'Difficile'}
                        </span>
                      )}
                      {isAvailable && (
                        <button
                          onClick={() => handleChallengeLeader(leader)}
                          className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black px-4 py-2 rounded-xl text-sm transition-all shadow-md shadow-orange-500/20 flex items-center gap-1.5"
                        >
                          <Swords className="w-3.5 h-3.5" /> Sfida
                        </button>
                      )}
                      {isCompleted && (
                        <button
                          onClick={() => handleChallengeLeader(leader)}
                          className="border border-green-500/30 text-green-400/70 hover:text-green-300 px-3 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1"
                        >
                          Rigioca
                        </button>
                      )}
                      {isLocked && (
                        <div className="flex items-center gap-1 text-white/20 text-xs">
                          <Lock className="w-3 h-3" /> Bloccata
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {completedCount === totalCount && totalCount > 0 && (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">🏆</div>
                <p className="text-yellow-300 font-black text-xl">Campione delle Palestre!</p>
                <p className="text-white/40 text-sm mt-1">Hai completato tutte le palestre disponibili</p>
                <div className="flex items-center justify-center gap-1 mt-2">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
