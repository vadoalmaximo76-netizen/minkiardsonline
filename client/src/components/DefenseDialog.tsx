import React, { useState, useEffect } from 'react';
import { useGameState } from '../lib/stores/useGameState';
import { socket } from '../lib/socket';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Shield, Swords, Clock } from 'lucide-react';

interface DefenseRequest {
  gameId: string;
  attackId: string;
  attackerName: string;
  defenderName: string;
  mosseCardId: string;
  targetCardId: string;
  damageValue: number;
  message: string;
  mosseCardImage?: string;
  attackerCardImage?: string;
  defenderCardImage?: string;
  attackerCardText?: string;
  defenderCardText?: string;
}

export const DefenseDialog: React.FC = () => {
  const [defenseRequest, setDefenseRequest] = useState<DefenseRequest | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30); // 30 second timer
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const { playerName, gameId } = useGameState();

  // Listen for defense requests
  useEffect(() => {
    const handleDefenseRequest = (request: DefenseRequest) => {
      console.log('🛡️ DEFENSE REQUEST RECEIVED:', request);
      console.log('🛡️ Current playerName:', playerName);
      console.log('🛡️ Request defenderName:', request.defenderName);
      // Only show dialog if this player is the defender
      if (request.defenderName === playerName) {
        console.log('🛡️ SHOWING DEFENSE DIALOG!');
        setDefenseRequest(request);
        setTimeLeft(30); // Reset timer
        setIsProcessing(false);
      } else {
        console.log('🛡️ Defense request not for this player, ignoring');
      }
    };

    socket.on('defense:request', handleDefenseRequest);

    return () => {
      socket.off('defense:request', handleDefenseRequest);
    };
  }, [playerName]);

  // Countdown timer
  useEffect(() => {
    if (!defenseRequest) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-accept if time runs out
          handleDefenseResponse(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [defenseRequest]);

  const handleDefenseResponse = (defends: boolean) => {
    if (!defenseRequest || isProcessing) return;
    
    setIsProcessing(true);
    console.log(`🛡️ Sending defense response: ${defends ? 'DEFEND' : 'ACCEPT'}`);
    
    socket.emit('defense:response', {
      gameId: defenseRequest.gameId,
      attackId: defenseRequest.attackId,
      defends
    });

    // Close dialog after sending response
    setTimeout(() => {
      setDefenseRequest(null);
      setIsProcessing(false);
    }, 500);
  };

  if (!defenseRequest) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-6xl bg-gradient-to-b from-gray-900 to-gray-800 rounded-lg shadow-2xl border-2 border-red-500 p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 text-red-600 mb-2">
            <Swords className="w-8 h-8" />
            <h1 className="text-3xl font-bold">ATTACCO NEMICO!</h1>
            <Swords className="w-8 h-8" />
          </div>
          <div className="flex items-center justify-center gap-1 text-gray-300 text-lg">
            <Clock className="w-5 h-5" />
            <span className="font-mono font-bold">{timeLeft}s</span>
          </div>
        </div>

        {/* Attacker Name */}
        <div className="text-center mb-4">
          <p className="text-yellow-400 text-xl font-bold">
            {defenseRequest.attackerName} ti sta attaccando!
          </p>
        </div>

        {/* Three Cards Layout: Attacker | MOSSE | Defender */}
        <div className="flex gap-4 justify-center items-end mb-6 flex-wrap">
          {/* Left: Attacker Card */}
          <div className="flex flex-col items-center">
            <div className="text-white text-sm font-bold mb-2">ATTACCANTE</div>
            {defenseRequest.attackerCardImage ? (
              <img
                src={defenseRequest.attackerCardImage}
                alt="Attaccante"
                className="w-32 h-48 rounded-lg border-2 border-green-500 object-cover shadow-lg"
              />
            ) : (
              <div className="w-32 h-48 rounded-lg border-2 border-green-500 bg-gray-700 flex items-center justify-center">
                <span className="text-gray-400 text-sm">Carta</span>
              </div>
            )}
            {defenseRequest.attackerCardText && (
              <div className="mt-2 text-white text-xs text-center max-w-32">
                {defenseRequest.attackerCardText}
              </div>
            )}
          </div>

          {/* Center: MOSSE Card */}
          <div className="flex flex-col items-center">
            <div className="text-white text-sm font-bold mb-2">MOSSE</div>
            {defenseRequest.mosseCardImage ? (
              <img
                src={defenseRequest.mosseCardImage}
                alt="MOSSE"
                className="w-40 h-56 rounded-lg border-4 border-yellow-500 object-cover shadow-lg scale-105"
              />
            ) : (
              <div className="w-40 h-56 rounded-lg border-4 border-yellow-500 bg-gray-700 flex items-center justify-center">
                <span className="text-gray-400">MOSSE</span>
              </div>
            )}
            <div className="mt-3 text-red-400 font-bold text-2xl">
              ⚠️ DMG: {defenseRequest.damageValue}
            </div>
          </div>

          {/* Right: Defender Card */}
          <div className="flex flex-col items-center">
            <div className="text-white text-sm font-bold mb-2">DIFENSORE</div>
            {defenseRequest.defenderCardImage ? (
              <img
                src={defenseRequest.defenderCardImage}
                alt="Difensore"
                className="w-32 h-48 rounded-lg border-2 border-blue-500 object-cover shadow-lg"
              />
            ) : (
              <div className="w-32 h-48 rounded-lg border-2 border-blue-500 bg-gray-700 flex items-center justify-center">
                <span className="text-gray-400 text-sm">Carta</span>
              </div>
            )}
            {defenseRequest.defenderCardText && (
              <div className="mt-2 text-white text-xs text-center max-w-32">
                {defenseRequest.defenderCardText}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="bg-gray-700 p-3 rounded-lg border border-gray-600 mb-6">
          <p className="text-gray-300 text-sm text-center">
            <strong>RESPINGI:</strong> Blocchi l'attacco, la MOSSE torna nel mazzo
            <br />
            <strong>ACCETTA:</strong> Subisci {defenseRequest.damageValue} danni
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => handleDefenseResponse(true)}
            disabled={isProcessing}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 transition-all duration-200"
          >
            <Shield className="w-5 h-5 mr-2" />
            {isProcessing ? 'Aspetta...' : 'RESPINGI'}
          </Button>

          <Button
            onClick={() => handleDefenseResponse(false)}
            disabled={isProcessing}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 transition-all duration-200"
          >
            <Swords className="w-5 h-5 mr-2" />
            {isProcessing ? 'Aspetta...' : 'ACCETTA'}
          </Button>
        </div>

        {/* Timer Warning */}
        {timeLeft <= 10 && (
          <div className="text-center mt-4">
            <p className="text-red-400 font-bold animate-pulse">
              ⚠️ Risposta automatica in {timeLeft} secondi!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};