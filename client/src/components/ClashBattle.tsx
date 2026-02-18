import React, { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from '../lib/socket';
import { useGameState } from '../lib/stores/useGameState';
import { useAudio } from '../lib/stores/useAudio';
import { useIsMobile } from '../hooks/use-is-mobile';
import { Zap, Swords, Shield, Crown } from 'lucide-react';

interface ClashBattleProps {
  clashId: string;
  attacker: string;
  defender: string;
  damageValue: number;
  duration: number;
}

export const ClashBattle: React.FC<ClashBattleProps> = ({
  clashId,
  attacker,
  defender,
  damageValue,
  duration
}) => {
  const { playerName } = useGameState();
  const { playClashTap, playClashBattleStart, playClashVictory, playBattleMusic, stopBattleMusic } = useAudio();
  const isMobile = useIsMobile();
  const [attackerTaps, setAttackerTaps] = useState(0);
  const [defenderTaps, setDefenderTaps] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration / 1000);
  const [isActive, setIsActive] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);

  const isParticipant = playerName === attacker || playerName === defender;
  const isAttacker = playerName === attacker;
  const isDefender = playerName === defender;

  useEffect(() => {
    playClashBattleStart();
    const music = playBattleMusic();
    return () => {
      music.stop();
    };
  }, []);

  useEffect(() => {
    const handleTapUpdate = (data: { clashId: string; attackerTaps: number; defenderTaps: number }) => {
      if (data.clashId === clashId) {
        setAttackerTaps(data.attackerTaps);
        setDefenderTaps(data.defenderTaps);
      }
    };

    const handleClashEnd = (data: { clashId: string; winner: string | null; isTie: boolean }) => {
      if (data.clashId === clashId) {
        setIsActive(false);
        setWinner(data.winner);
        setShowResult(true);
        stopBattleMusic();
        if (data.winner) {
          playClashVictory();
        }
      }
    };

    socket.on('clash-tap-update', handleTapUpdate);
    socket.on('clash-battle-end', handleClashEnd);

    return () => {
      socket.off('clash-tap-update', handleTapUpdate);
      socket.off('clash-battle-end', handleClashEnd);
    };
  }, [clashId, playClashVictory]);

  useEffect(() => {
    if (!isActive) return;

    const startTime = Date.now();
    const totalMs = duration;
    let lastStateUpdate = Date.now();

    const updateTimer = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, (totalMs - elapsed) / 1000);

      if (timerRef.current) {
        timerRef.current.textContent = `${remaining.toFixed(1)}s`;
      }

      const now = Date.now();
      if (now - lastStateUpdate >= 500 || remaining <= 0) {
        lastStateUpdate = now;
        setTimeLeft(remaining);
      }

      if (remaining > 0) {
        rafId = requestAnimationFrame(updateTimer);
      }
    };

    let rafId = requestAnimationFrame(updateTimer);

    return () => cancelAnimationFrame(rafId);
  }, [isActive, duration]);

  const handleTap = useCallback(() => {
    if (!isActive || !isParticipant) return;
    
    playClashTap();
    
    socket.emit('clash-tap', {
      clashId,
      playerName
    });
  }, [clashId, playerName, isActive, isParticipant, playClashTap]);

  const totalTaps = attackerTaps + defenderTaps;
  const attackerProgress = totalTaps > 0 ? (attackerTaps / totalTaps) * 100 : 50;
  const defenderProgress = totalTaps > 0 ? (defenderTaps / totalTaps) * 100 : 50;

  const isTie = !isActive && showResult && winner === null;

  if (!isActive && showResult) {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4">
        <div className="relative w-full max-w-2xl">
          {!isMobile && (
            <div className={`absolute inset-0 blur-3xl rounded-3xl ${
              isTie ? 'bg-gradient-to-r from-slate-600/20 via-purple-600/20 to-slate-600/20' : 'bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-orange-600/20'
            }`} />
          )}
          
          <div className={`relative bg-gradient-to-b from-slate-900/95 to-slate-800/95 rounded-2xl border border-white/10 shadow-2xl p-8 ${isMobile ? '' : 'backdrop-blur-xl'}`}>
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
              <div className={`p-3 rounded-full shadow-lg ${
                isTie ? 'bg-gradient-to-r from-slate-400 via-purple-400 to-slate-400 shadow-slate-500/50' : 'bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 shadow-orange-500/50'
              }`}>
                {isTie ? <Zap className="w-8 h-8 text-white" /> : <Crown className="w-8 h-8 text-white" />}
              </div>
            </div>
            
            <div className="text-center mt-4">
              <h2 className={`text-4xl font-black mb-4 ${
                isTie 
                  ? 'bg-gradient-to-r from-slate-200 via-purple-300 to-slate-200 bg-clip-text text-transparent'
                  : 'bg-gradient-to-r from-yellow-200 via-yellow-400 to-orange-400 bg-clip-text text-transparent'
              }`}>
                {isTie ? 'PAREGGIO!' : (winner === playerName ? 'VITTORIA!' : `${winner} VINCE!`)}
              </h2>
              
              <div className="flex items-center justify-center gap-8 mb-6">
                <div className={`text-center ${isTie ? '' : (winner === attacker ? 'scale-110' : 'opacity-60')}`}>
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-2 ${
                    isTie 
                      ? 'bg-gradient-to-br from-slate-600 to-slate-700'
                      : (winner === attacker 
                        ? 'bg-gradient-to-br from-red-500 to-orange-600 shadow-lg shadow-red-500/50' 
                        : 'bg-slate-700')
                  }`}>
                    <Swords className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-white font-bold">{attacker}</p>
                  <p className="text-2xl font-mono text-red-400">{attackerTaps}</p>
                </div>
                
                <div className="text-4xl font-bold text-slate-500">VS</div>
                
                <div className={`text-center ${isTie ? '' : (winner === defender ? 'scale-110' : 'opacity-60')}`}>
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-2 ${
                    isTie 
                      ? 'bg-gradient-to-br from-slate-600 to-slate-700'
                      : (winner === defender 
                        ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/50' 
                        : 'bg-slate-700')
                  }`}>
                    <Shield className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-white font-bold">{defender}</p>
                  <p className="text-2xl font-mono text-cyan-400">{defenderTaps}</p>
                </div>
              </div>
              
              <p className="text-slate-400">
                {isTie 
                  ? 'Nessun danno inflitto - entrambi tornano al mazzo!'
                  : <>Il vincitore infligge <span className="text-orange-400 font-bold">{damageValue} PTI</span> di danno!</>
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 overflow-hidden">
      {!isMobile && (
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/15 rounded-full blur-3xl" style={{ animation: 'pulse 3s ease-in-out infinite' }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl" style={{ animation: 'pulse 3s ease-in-out infinite 1s' }} />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl" style={{ animation: 'pulse 4s ease-in-out infinite' }} />
        </div>
      )}
      
      <div className="relative w-full max-w-3xl">
        {!isMobile && (
          <div className="absolute -inset-1 bg-gradient-to-r from-red-500 via-purple-500 to-cyan-500 rounded-3xl blur opacity-50" style={{ animation: 'pulse 4s ease-in-out infinite' }} />
        )}
        
        <div className={`relative bg-gradient-to-b from-slate-900/98 to-slate-800/98 rounded-2xl border border-white/20 shadow-2xl ${isMobile ? 'p-4' : 'backdrop-blur-xl p-8'}`}>
          <div className={`text-center ${isMobile ? 'mb-4' : 'mb-8'}`}>
            <div className="flex items-center justify-center gap-4 mb-4">
              <Zap className={`text-yellow-400 ${isMobile ? 'w-7 h-7' : 'w-10 h-10 animate-bounce'}`} />
              <h1 className={`font-black bg-gradient-to-r from-yellow-200 via-orange-400 to-red-500 bg-clip-text text-transparent tracking-wider ${isMobile ? 'text-3xl' : 'text-5xl'}`}>
                SCONTRO!
              </h1>
              <Zap className={`text-yellow-400 ${isMobile ? 'w-7 h-7' : 'w-10 h-10 animate-bounce'}`} />
            </div>
            
            <div className="flex items-center justify-center gap-6">
              <span className="text-xl font-bold text-red-400">{attacker}</span>
              <span className="text-2xl font-black text-slate-500">VS</span>
              <span className="text-xl font-bold text-cyan-400">{defender}</span>
            </div>
            
            <div className="mt-2 inline-block bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-full px-6 py-2">
              <span className="text-orange-300 font-bold text-lg">{damageValue} PTI in palio</span>
            </div>
          </div>

          <div className={`text-center ${isMobile ? 'mb-3' : 'mb-6'}`}>
            <div className="relative inline-block">
              <div className={`relative bg-gradient-to-b from-slate-700 to-slate-800 rounded-full px-8 py-3 border ${
                timeLeft <= 3 ? 'border-red-500' : 'border-purple-500/50'
              }`}>
                <span
                  ref={timerRef}
                  className={`font-mono text-4xl font-black ${
                    timeLeft <= 3 ? 'text-red-400' : 'text-white'
                  }`}
                >
                  {timeLeft.toFixed(1)}s
                </span>
              </div>
            </div>
          </div>

          <div className={`relative ${isMobile ? 'mb-4' : 'mb-8'}`}>
            {!isMobile && (
              <div className="absolute -inset-2 bg-gradient-to-r from-red-500/30 via-purple-500/30 to-cyan-500/30 rounded-2xl blur" />
            )}
            
            <div className={`relative rounded-xl overflow-hidden border-2 border-white/20 shadow-inner bg-slate-900 ${isMobile ? 'h-14' : 'h-20'}`}>
              <div 
                className="absolute left-0 top-0 h-full transition-all duration-300 ease-out"
                style={{ 
                  width: `${attackerProgress}%`,
                  background: 'linear-gradient(90deg, #dc2626 0%, #f97316 50%, #fbbf24 100%)',
                  boxShadow: isMobile ? 'none' : 'inset 0 2px 10px rgba(255,255,255,0.3), 0 0 20px rgba(239, 68, 68, 0.5)'
                }}
              >
                <div className="absolute inset-0 flex items-center pl-4">
                  <div className="flex items-center gap-2">
                    <Swords className={`text-white ${isMobile ? 'w-4 h-4' : 'w-6 h-6'}`} />
                    <span className={`text-white font-black ${isMobile ? 'text-lg' : 'text-xl'}`}>{attackerTaps}</span>
                  </div>
                </div>
              </div>
              
              <div 
                className="absolute right-0 top-0 h-full transition-all duration-300 ease-out"
                style={{ 
                  width: `${defenderProgress}%`,
                  background: 'linear-gradient(270deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%)',
                  boxShadow: isMobile ? 'none' : 'inset 0 2px 10px rgba(255,255,255,0.3), 0 0 20px rgba(6, 182, 212, 0.5)'
                }}
              >
                <div className="absolute inset-0 flex items-center justify-end pr-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-white font-black ${isMobile ? 'text-lg' : 'text-xl'}`}>{defenderTaps}</span>
                    <Shield className={`text-white ${isMobile ? 'w-4 h-4' : 'w-6 h-6'}`} />
                  </div>
                </div>
              </div>

              <div className="absolute left-1/2 top-0 w-1 h-full bg-white/50 transform -translate-x-1/2 z-10" />
            </div>
            
            <div className="flex justify-between mt-2 px-2">
              <span className="text-red-400 font-bold">{attacker}</span>
              <span className="text-cyan-400 font-bold">{defender}</span>
            </div>
          </div>

          {isParticipant && isActive && (
            <div className="text-center">
              <div className="relative inline-block">
                <button
                  ref={buttonRef}
                  onClick={handleTap}
                  className={`relative rounded-full font-black text-3xl text-white active:scale-90 select-none ${
                    isMobile ? 'w-40 h-40' : 'w-52 h-52'
                  } ${
                    isAttacker 
                      ? 'bg-gradient-to-br from-red-400 via-red-500 to-orange-600 shadow-xl shadow-red-500/50 border-4 border-red-300/50' 
                      : 'bg-gradient-to-br from-cyan-400 via-cyan-500 to-blue-600 shadow-xl shadow-cyan-500/50 border-4 border-cyan-300/50'
                  }`}
                  style={{ 
                    textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                    transition: 'transform 75ms ease-out',
                  }}
                >
                  <div className="relative flex flex-col items-center justify-center gap-2">
                    <Zap className={isMobile ? 'w-10 h-10' : 'w-14 h-14'} />
                    <span className="tracking-wider">PREMI!</span>
                    <div className="flex items-center gap-2 bg-black/30 rounded-full px-4 py-1">
                      <span className="text-2xl font-mono">
                        {isAttacker ? attackerTaps : defenderTaps}
                      </span>
                    </div>
                  </div>
                </button>
              </div>
              
              <p className="text-slate-400 mt-4 text-lg">
                Premi il più velocemente possibile!
              </p>
            </div>
          )}

          {!isParticipant && (
            <div className="text-center">
              <div className="relative inline-block">
                <div className={`relative bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl p-6 border border-purple-500/30 ${isMobile ? '' : 'p-8'}`}>
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-3 h-3 bg-purple-400 rounded-full" />
                    <span className="text-purple-300 font-bold text-lg uppercase tracking-wider">Spettatore</span>
                    <div className="w-3 h-3 bg-purple-400 rounded-full" />
                  </div>
                  <p className="text-slate-300 text-lg">
                    Osservi lo scontro tra <span className="text-red-400 font-bold">{attacker}</span> e <span className="text-cyan-400 font-bold">{defender}</span>
                  </p>
                  <p className="text-slate-500 mt-2">
                    Solo i due sfidanti possono premere il tasto
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
