import React, { useState, useEffect, useCallback } from 'react';
import { socket } from '../lib/socket';
import { useGameState } from '../lib/stores/useGameState';
import { Zap } from 'lucide-react';

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
  const [attackerTaps, setAttackerTaps] = useState(0);
  const [defenderTaps, setDefenderTaps] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration / 1000);
  const [isActive, setIsActive] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);

  const isParticipant = playerName === attacker || playerName === defender;
  const isAttacker = playerName === attacker;
  const isDefender = playerName === defender;

  // Listen for tap updates
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
      }
    };

    socket.on('clash-tap-update', handleTapUpdate);
    socket.on('clash-battle-end', handleClashEnd);

    return () => {
      socket.off('clash-tap-update', handleTapUpdate);
      socket.off('clash-battle-end', handleClashEnd);
    };
  }, [clashId]);

  // Countdown timer
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0.1) {
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [isActive]);

  // Handle tap
  const handleTap = useCallback(() => {
    if (!isActive || !isParticipant) return;
    
    socket.emit('clash-tap', {
      clashId,
      playerName
    });
  }, [clashId, playerName, isActive, isParticipant]);

  // Calculate progress bar percentages
  const totalTaps = attackerTaps + defenderTaps;
  const attackerProgress = totalTaps > 0 ? (attackerTaps / totalTaps) * 100 : 50;
  const defenderProgress = totalTaps > 0 ? (defenderTaps / totalTaps) * 100 : 50;

  // Determine player's color
  const myColor = isAttacker ? 'red' : isDefender ? 'blue' : null;

  if (!isActive && winner !== null) {
    return null; // Will be closed by parent
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="w-full max-w-2xl bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl shadow-2xl border-4 border-yellow-500 p-6 animate-pulse-slow">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Zap className="w-8 h-8 text-yellow-400 animate-pulse" />
            <h1 className="text-3xl font-bold text-yellow-400" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
              SCONTRO!
            </h1>
            <Zap className="w-8 h-8 text-yellow-400 animate-pulse" />
          </div>
          <p className="text-white text-lg">
            {attacker} vs {defender} - <span className="text-red-400 font-bold">{damageValue} PTI</span>
          </p>
        </div>

        {/* Timer */}
        <div className="text-center mb-4">
          <div className="inline-block bg-gray-700 rounded-full px-6 py-2">
            <span className="text-white font-mono text-2xl font-bold">
              {timeLeft.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-16 rounded-full overflow-hidden border-4 border-white shadow-lg mb-6">
          {/* Attacker (Red) Side */}
          <div 
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-700 to-red-500 transition-all duration-100"
            style={{ width: `${attackerProgress}%` }}
          >
            <div className="absolute inset-0 flex items-center justify-start pl-4">
              <span className="text-white font-bold text-lg" style={{ textShadow: '1px 1px 2px black' }}>
                {attacker}: {attackerTaps}
              </span>
            </div>
          </div>
          
          {/* Defender (Blue) Side */}
          <div 
            className="absolute right-0 top-0 h-full bg-gradient-to-l from-blue-700 to-blue-500 transition-all duration-100"
            style={{ width: `${defenderProgress}%` }}
          >
            <div className="absolute inset-0 flex items-center justify-end pr-4">
              <span className="text-white font-bold text-lg" style={{ textShadow: '1px 1px 2px black' }}>
                {defenderTaps}: {defender}
              </span>
            </div>
          </div>

          {/* Center line */}
          <div className="absolute left-1/2 top-0 w-1 h-full bg-white/50 transform -translate-x-1/2 z-10" />
        </div>

        {/* Tap Button for Participants */}
        {isParticipant && isActive && (
          <div className="text-center">
            <button
              onClick={handleTap}
              className={`w-48 h-48 rounded-full font-bold text-2xl text-white shadow-lg transform active:scale-95 transition-transform duration-50 ${
                isAttacker 
                  ? 'bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 border-4 border-red-300' 
                  : 'bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 border-4 border-blue-300'
              }`}
              style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
            >
              <div className="flex flex-col items-center justify-center">
                <Zap className="w-12 h-12 mb-2" />
                <span>PREMI!</span>
                <span className="text-lg mt-1">
                  {isAttacker ? attackerTaps : defenderTaps}
                </span>
              </div>
            </button>
            <p className="text-gray-400 mt-4 text-sm">
              Premi il più velocemente possibile!
            </p>
          </div>
        )}

        {/* Spectator View */}
        {!isParticipant && (
          <div className="text-center">
            <div className="bg-gray-700 rounded-lg p-6">
              <p className="text-gray-300 text-lg">
                Stai osservando lo scontro tra <span className="text-red-400 font-bold">{attacker}</span> e <span className="text-blue-400 font-bold">{defender}</span>
              </p>
              <p className="text-gray-400 mt-2">
                Solo i due sfidanti possono premere il tasto
              </p>
            </div>
          </div>
        )}

        {/* Winner Announcement (brief flash before closing) */}
        {!isActive && winner && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center rounded-xl">
            <div className="text-center">
              <h2 className="text-4xl font-bold text-yellow-400 mb-4" style={{ textShadow: '2px 2px 4px black' }}>
                {winner === playerName ? 'HAI VINTO!' : `${winner} HA VINTO!`}
              </h2>
              <p className="text-white text-xl">
                {attackerTaps} - {defenderTaps}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
