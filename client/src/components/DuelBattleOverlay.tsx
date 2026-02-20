import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGameState } from '../lib/stores/useGameState';
import { socket } from '../lib/socket';
import { Swords } from 'lucide-react';

interface DuelCharInfo {
  id: string;
  name: string;
  owner: string;
  pti: number;
  maxPti: number;
  stars: number;
  frontImage: string;
}

interface DuelStateData {
  duelCardId: string;
  character1Id: string;
  character2Id: string;
  player1: string;
  player2: string;
  currentTurn: string;
  consecutiveTurns: number;
  active: boolean;
}

const getCardNameFromUrl = (url: string): string => {
  if (!url) return 'Personaggio';
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
    return 'Personaggio';
  }
};

const HPBar: React.FC<{ current: number; max: number; isPlayer: boolean }> = ({ current, max, isPlayer }) => {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  const barColor = percentage > 50 ? 'bg-green-500' : percentage > 20 ? 'bg-yellow-500' : 'bg-red-500';
  const glowColor = percentage > 50 ? 'shadow-green-500/50' : percentage > 20 ? 'shadow-yellow-500/50' : 'shadow-red-500/50';

  return (
    <div className={`w-full ${isPlayer ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold text-yellow-300 tracking-wider">PTI</span>
        <div className="flex-1 h-4 bg-gray-800 rounded-full border border-gray-600 overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-1000 ease-out shadow-lg ${glowColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <div className="text-right">
        <span className="text-sm font-mono font-bold text-white">{current}</span>
        <span className="text-xs text-gray-400">/{max}</span>
      </div>
    </div>
  );
};

const TypewriterText: React.FC<{ text: string; speed?: number; onComplete?: () => void }> = ({ text, speed = 30, onComplete }) => {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed('');
    indexRef.current = 0;
    const interval = setInterval(() => {
      indexRef.current++;
      if (indexRef.current <= text.length) {
        setDisplayed(text.slice(0, indexRef.current));
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return <span>{displayed}<span className="animate-pulse">|</span></span>;
};

export const DuelBattleOverlay: React.FC = () => {
  const { playerName, gameState } = useGameState();
  const [duelState, setDuelState] = useState<DuelStateData | null>(null);
  const [char1, setChar1] = useState<DuelCharInfo | null>(null);
  const [char2, setChar2] = useState<DuelCharInfo | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [introPhase, setIntroPhase] = useState<'flash' | 'vs' | 'names' | 'done'>('flash');
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [showVictory, setShowVictory] = useState<{ winner: string; reason: string } | null>(null);
  const [hitEffect, setHitEffect] = useState<'left' | 'right' | null>(null);
  const [shakeScreen, setShakeScreen] = useState(false);
  const [damageFlash, setDamageFlash] = useState<'left' | 'right' | null>(null);
  const prevPtiRef = useRef<{ char1: number; char2: number }>({ char1: 0, char2: 0 });
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);
  const isDuelEndingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      if (mountedRef.current) fn();
    }, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const findCharInfo = useCallback((charId: string): DuelCharInfo | null => {
    if (!gameState?.field) return null;
    const card: any = gameState.field.find((c: any) => c.id === charId);
    if (card) {
      const name = getCardNameFromUrl(card.frontImage);
      const originalPti = card.originalPti || card.pti || 500;
      return {
        id: card.id,
        name,
        owner: card.owner,
        pti: card.pti || 0,
        maxPti: Math.max(originalPti, card.pti || 0),
        stars: card.stars || 1,
        frontImage: card.frontImage || ''
      };
    }
    const graveyardCard: any = (gameState as any)?.graveyard?.find((c: any) => c.id === charId);
    if (graveyardCard) {
      const name = getCardNameFromUrl(graveyardCard.frontImage);
      return {
        id: graveyardCard.id,
        name,
        owner: graveyardCard.owner,
        pti: 0,
        maxPti: graveyardCard.originalPti || 500,
        stars: graveyardCard.stars || 1,
        frontImage: graveyardCard.frontImage || ''
      };
    }
    return null;
  }, [gameState]);

  useEffect(() => {
    const handleDuelStarted = (data: { duelState: DuelStateData; message: string }) => {
      console.log('⚔️ DUEL OVERLAY: Duel started!', data);
      isDuelEndingRef.current = false;
      setDuelState(data.duelState);
      setShowIntro(true);
      setIntroPhase('flash');
      setShowVictory(null);

      safeTimeout(() => setIntroPhase('vs'), 400);
      safeTimeout(() => setIntroPhase('names'), 1500);
      safeTimeout(() => {
        setIntroPhase('done');
        setShowIntro(false);
        setCurrentMessage('Il duello ha inizio!');
      }, 2800);
    };

    const handleDuelEnded = (data: { winner: string; reason: string }) => {
      console.log('⚔️ DUEL OVERLAY: Duel ended!', data);
      isDuelEndingRef.current = true;
      setShowVictory(data);
      setCurrentMessage(`${data.winner} ha vinto il duello!`);
      safeTimeout(() => {
        setDuelState(null);
        setShowVictory(null);
        setShowIntro(false);
        isDuelEndingRef.current = false;
      }, 5000);
    };

    const handleCardAttacked = (data: { attackerName: string; damageValue: number; targetCardId: string }) => {
      if (!duelState) return;
      const targetName = gameState?.field?.find((c: any) => c.id === data.targetCardId);
      const name = targetName ? getCardNameFromUrl(targetName.frontImage) : 'avversario';
      setCurrentMessage(`${data.attackerName} infligge ${data.damageValue} danni a ${name}!`);
    };

    socket.on('duel:started', handleDuelStarted);
    socket.on('duel-ended', handleDuelEnded);
    socket.on('card-attacked', handleCardAttacked);

    return () => {
      socket.off('duel:started', handleDuelStarted);
      socket.off('duel-ended', handleDuelEnded);
      socket.off('card-attacked', handleCardAttacked);
    };
  }, [playerName, safeTimeout, duelState, gameState]);

  useEffect(() => {
    const gs = gameState as any;
    if (gs?.activeDuel && gs.activeDuel.active && !duelState) {
      setDuelState(gs.activeDuel);
    }
    if (gs?.activeDuel && duelState) {
      setDuelState(gs.activeDuel);
    }
    if (!gs?.activeDuel && duelState && !showVictory && !isDuelEndingRef.current) {
      setDuelState(null);
    }
  }, [(gameState as any)?.activeDuel]);

  useEffect(() => {
    if (!duelState) return;
    const c1 = findCharInfo(duelState.character1Id);
    const c2 = findCharInfo(duelState.character2Id);

    if (c1 && char1 && c1.pti < prevPtiRef.current.char1) {
      triggerHitEffect('left', prevPtiRef.current.char1 - c1.pti);
    }
    if (c2 && char2 && c2.pti < prevPtiRef.current.char2) {
      triggerHitEffect('right', prevPtiRef.current.char2 - c2.pti);
    }

    if (c1) prevPtiRef.current.char1 = c1.pti;
    if (c2) prevPtiRef.current.char2 = c2.pti;

    setChar1(c1);
    setChar2(c2);

    if (!showVictory && !isDuelEndingRef.current) {
      if (c1 && c1.pti <= 0) {
        console.log(`⚔️ DUEL OVERLAY: Character 1 (${c1.name}) PTI=0, ending duel client-side`);
        isDuelEndingRef.current = true;
        setShowVictory({ winner: duelState.player2, reason: 'character_death' });
        setCurrentMessage(`${duelState.player2} ha vinto il duello!`);
        safeTimeout(() => {
          setDuelState(null);
          setShowVictory(null);
          setShowIntro(false);
          isDuelEndingRef.current = false;
        }, 5000);
      } else if (c2 && c2.pti <= 0) {
        console.log(`⚔️ DUEL OVERLAY: Character 2 (${c2.name}) PTI=0, ending duel client-side`);
        isDuelEndingRef.current = true;
        setShowVictory({ winner: duelState.player1, reason: 'character_death' });
        setCurrentMessage(`${duelState.player1} ha vinto il duello!`);
        safeTimeout(() => {
          setDuelState(null);
          setShowVictory(null);
          setShowIntro(false);
          isDuelEndingRef.current = false;
        }, 5000);
      } else if ((!c1 && char1) || (!c2 && char2)) {
        const missingIsChar1 = !c1 && char1;
        const winner = missingIsChar1 ? duelState.player2 : duelState.player1;
        console.log(`⚔️ DUEL OVERLAY: Character removed from field, ending duel client-side. Winner: ${winner}`);
        isDuelEndingRef.current = true;
        setShowVictory({ winner, reason: 'character_death' });
        setCurrentMessage(`${winner} ha vinto il duello!`);
        safeTimeout(() => {
          setDuelState(null);
          setShowVictory(null);
          setShowIntro(false);
          isDuelEndingRef.current = false;
        }, 5000);
      }
    }
  }, [duelState, gameState?.field, findCharInfo]);

  const triggerHitEffect = (side: 'left' | 'right', _damage: number) => {
    setHitEffect(side);
    setDamageFlash(side);
    setShakeScreen(true);
    safeTimeout(() => setHitEffect(null), 600);
    safeTimeout(() => setDamageFlash(null), 300);
    safeTimeout(() => setShakeScreen(false), 400);
  };

  const isMyTurn = useMemo(() => {
    if (!duelState || !playerName) return false;
    return duelState.currentTurn === playerName;
  }, [duelState, playerName]);

  const isParticipant = useMemo(() => {
    if (!duelState || !playerName) return false;
    return duelState.player1 === playerName || duelState.player2 === playerName;
  }, [duelState, playerName]);

  const myChar = useMemo(() => {
    if (!duelState) return null;
    if (duelState.player1 === playerName) return char1;
    if (duelState.player2 === playerName) return char2;
    return char1;
  }, [duelState, playerName, char1, char2]);

  const oppChar = useMemo(() => {
    if (!duelState) return null;
    if (duelState.player1 === playerName) return char2;
    if (duelState.player2 === playerName) return char1;
    return char2;
  }, [duelState, playerName, char1, char2]);

  const showBattleMusic = !!(duelState || showIntro || showVictory);

  if (!duelState && !showIntro && !showVictory) return null;

  return (
    <div className={`fixed inset-0 z-[90] pointer-events-none ${shakeScreen ? 'animate-shake' : ''}`}>
      {showBattleMusic && (
        <iframe
          src="https://www.youtube.com/embed/XZT7ancr3qQ?autoplay=1&loop=1&playlist=XZT7ancr3qQ&controls=0&showinfo=0&modestbranding=1&rel=0"
          allow="autoplay; encrypted-media"
          className="absolute bottom-0 right-0 w-[1px] h-[1px] opacity-[0.01]"
          title="Duel Battle Music"
        />
      )}

      {showIntro && (
        <div className="absolute inset-0 z-[95] flex items-center justify-center bg-black pointer-events-auto">
          {introPhase === 'flash' && (
            <div className="absolute inset-0 bg-white animate-flash" />
          )}

          {introPhase !== 'flash' && introPhase !== 'done' && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-8">
                <div className={`transition-all duration-700 ${introPhase === 'names' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-20'}`}>
                  <div className="text-center">
                    {char1 && (
                      <img src={char1.frontImage} alt={char1.name} className="w-28 h-40 object-cover rounded-lg border-2 border-blue-500 shadow-lg shadow-blue-500/50 mx-auto mb-2" />
                    )}
                    <p className="text-blue-400 font-bold text-lg">{char1?.owner || '???'}</p>
                    <p className="text-white text-sm">{char1?.name || '???'}</p>
                  </div>
                </div>

                <div className="transition-all duration-500 scale-100 opacity-100">
                  <div className="relative">
                    <span className="text-7xl font-black text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)] animate-pulse">
                      VS
                    </span>
                    <div className="absolute inset-0 blur-xl bg-red-500/30 rounded-full" />
                  </div>
                </div>

                <div className={`transition-all duration-700 ${introPhase === 'names' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-20'}`}>
                  <div className="text-center">
                    {char2 && (
                      <img src={char2.frontImage} alt={char2.name} className="w-28 h-40 object-cover rounded-lg border-2 border-red-500 shadow-lg shadow-red-500/50 mx-auto mb-2" />
                    )}
                    <p className="text-red-400 font-bold text-lg">{char2?.owner || '???'}</p>
                    <p className="text-white text-sm">{char2?.name || '???'}</p>
                  </div>
                </div>
              </div>

              <div className={`mt-4 transition-opacity duration-500 ${introPhase === 'names' ? 'opacity-100' : 'opacity-0'}`}>
                <p className="text-yellow-400 text-xl font-bold tracking-widest animate-pulse">DUELLO!</p>
              </div>
            </div>
          )}
        </div>
      )}

      {showVictory && (
        <div className="absolute inset-0 z-[95] flex items-center justify-center bg-black/90 pointer-events-auto">
          <div className="text-center animate-victoryBounce">
            <div className="text-6xl mb-4">🏆</div>
            <h1 className="text-4xl font-black text-yellow-400 mb-2 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]">
              VITTORIA!
            </h1>
            <p className="text-2xl text-white font-bold mb-4">{showVictory.winner}</p>
            <p className="text-gray-400 text-lg">ha vinto il duello!</p>
            <div className="mt-6 flex justify-center gap-2">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-3xl animate-bounce" style={{ animationDelay: `${i * 100}ms` }}>⭐</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {!showIntro && !showVictory && duelState && (
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900/70 via-slate-900/60 to-transparent">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-indigo-950/50 to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-slate-950/50 to-transparent" />
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-red-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full border border-yellow-500/30">
              <Swords className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 text-sm font-bold tracking-wider">DUELLO</span>
              <Swords className="w-4 h-4 text-yellow-400" />
            </div>
          </div>

          <div className="relative h-full flex flex-col">
            <div className="flex-1 flex items-center justify-between px-4 pt-12 pb-4 relative">
              {oppChar && (
                <div className="absolute top-10 right-4 w-[45%] max-w-[240px] z-10">
                  <div className="bg-gradient-to-r from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-3 border border-gray-600/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-bold text-sm truncate max-w-[120px]">{oppChar.name}</span>
                      <span className="text-xs text-gray-400">{oppChar.owner}</span>
                    </div>
                    <HPBar current={oppChar.pti} max={oppChar.maxPti} isPlayer={false} />
                    <div className="flex items-center gap-1 mt-1">
                      {[...Array(Math.min(oppChar.stars, 5))].map((_, i) => (
                        <span key={i} className="text-yellow-400 text-xs">★</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {oppChar && (
                <div className="absolute top-24 right-8 sm:right-16">
                  <div className={`relative ${damageFlash === 'right' ? 'animate-damageFlash' : ''} ${hitEffect === 'right' ? 'animate-hitShake' : ''}`}>
                    <img
                      src={oppChar.frontImage}
                      alt={oppChar.name}
                      className="w-24 h-36 sm:w-32 sm:h-44 object-cover rounded-lg border-2 border-red-500/60 shadow-lg shadow-red-500/20"
                    />
                    {hitEffect === 'right' && (
                      <div className="absolute inset-0 bg-red-500/40 rounded-lg animate-pulse" />
                    )}
                  </div>
                </div>
              )}

              {myChar && (
                <div className="absolute bottom-20 left-4 w-[45%] max-w-[240px] z-10">
                  <div className="bg-gradient-to-r from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-3 border border-blue-500/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-bold text-sm truncate max-w-[120px]">{myChar.name}</span>
                      <span className="text-xs text-blue-400">{myChar.owner}</span>
                    </div>
                    <HPBar current={myChar.pti} max={myChar.maxPti} isPlayer={true} />
                    <div className="flex items-center gap-1 mt-1">
                      {[...Array(Math.min(myChar.stars, 5))].map((_, i) => (
                        <span key={i} className="text-yellow-400 text-xs">★</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {myChar && (
                <div className="absolute bottom-28 left-8 sm:left-16">
                  <div className={`relative ${damageFlash === 'left' ? 'animate-damageFlash' : ''} ${hitEffect === 'left' ? 'animate-hitShake' : ''}`}>
                    <img
                      src={myChar.frontImage}
                      alt={myChar.name}
                      className="w-28 h-40 sm:w-36 sm:h-48 object-cover rounded-lg border-2 border-blue-500/60 shadow-lg shadow-blue-500/20"
                    />
                    {hitEffect === 'left' && (
                      <div className="absolute inset-0 bg-red-500/40 rounded-lg animate-pulse" />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative z-20">
              <div className="bg-gray-900/95 backdrop-blur-sm border-t-2 border-gray-600/50 px-4 py-3 min-h-[60px]">
                <div>
                  {currentMessage ? (
                    <p className="text-white text-sm font-medium">
                      <TypewriterText text={currentMessage} speed={25} />
                    </p>
                  ) : (
                    <p className="text-gray-400 text-sm">
                      {!isParticipant
                        ? `Stai osservando il duello... Turno di ${duelState.currentTurn}`
                        : isMyTurn
                          ? 'È il tuo turno! Gioca una carta MOSSE per attaccare.'
                          : `È il turno di ${duelState.currentTurn}...`}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-gray-950/90 px-4 py-2 flex items-center justify-between border-t border-gray-700/50">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isMyTurn ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
                  <span className={`text-xs font-bold ${isMyTurn ? 'text-green-400' : 'text-gray-500'}`}>
                    {isMyTurn ? 'IL TUO TURNO' : `Turno di ${duelState?.currentTurn || '...'}`}
                  </span>
                </div>
                {duelState && duelState.consecutiveTurns > 0 && duelState.currentTurn === playerName && (
                  <span className="text-xs text-yellow-400 font-bold">
                    Turni bonus: {duelState.consecutiveTurns}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes flash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-8px); }
          20% { transform: translateX(8px); }
          30% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          50% { transform: translateX(-4px); }
          60% { transform: translateX(4px); }
          70% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
        @keyframes hitShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          50% { transform: translateX(10px); }
          75% { transform: translateX(-5px); }
        }
        @keyframes damageFlash {
          0% { filter: brightness(3); }
          50% { filter: brightness(0.5); }
          100% { filter: brightness(1); }
        }
        @keyframes victoryBounce {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-flash { animation: flash 0.4s ease-out forwards; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        .animate-hitShake { animation: hitShake 0.5s ease-in-out; }
        .animate-damageFlash { animation: damageFlash 0.3s ease-out; }
        .animate-victoryBounce { animation: victoryBounce 0.8s ease-out forwards; }
      `}</style>
    </div>
  );
};
