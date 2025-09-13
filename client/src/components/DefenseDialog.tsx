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
      <Card className="w-full max-w-md bg-white shadow-2xl border-2 border-red-500">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 text-red-600">
            <Swords className="w-6 h-6" />
            <CardTitle className="text-xl font-bold">ATTACCO NEMICO!</CardTitle>
            <Swords className="w-6 h-6" />
          </div>
          <div className="flex items-center justify-center gap-1 text-gray-600 text-sm">
            <Clock className="w-4 h-4" />
            <span className="font-mono">{timeLeft}s</span>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-gray-700 font-medium">
              <strong className="text-red-600">{defenseRequest.attackerName}</strong> ti sta attaccando!
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Vuoi respingere l'attacco o accettarlo?
            </p>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg border">
            <p className="text-xs text-gray-500 text-center">
              <strong>Respingere:</strong> Blocchi l'attacco, la carta MOSSE torna nel mazzo
            </p>
            <p className="text-xs text-gray-500 text-center mt-1">
              <strong>Accettare:</strong> Subisci il danno normalmente
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={() => handleDefenseResponse(true)}
              disabled={isProcessing}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 transition-all duration-200"
            >
              <Shield className="w-4 h-4 mr-2" />
              {isProcessing ? 'Aspetta...' : 'RESPINGI'}
            </Button>
            
            <Button
              onClick={() => handleDefenseResponse(false)}
              disabled={isProcessing}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 transition-all duration-200"
            >
              <Swords className="w-4 h-4 mr-2" />
              {isProcessing ? 'Aspetta...' : 'ACCETTA'}
            </Button>
          </div>
          
          {timeLeft <= 10 && (
            <div className="text-center">
              <p className="text-xs text-red-500 font-medium animate-pulse">
                ⚠️ Risposta automatica in {timeLeft} secondi!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};