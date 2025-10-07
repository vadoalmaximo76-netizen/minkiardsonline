import React, { useState, useEffect } from 'react';
import { useGameState } from '../lib/stores/useGameState';
import { socket } from '../lib/socket';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Swords, Bot } from 'lucide-react';

interface CPUDamageRequest {
  cpuName: string;
  cpuCharacterName: string;
  mosseCardId: string;
  mosseCardName: string;
  targetCardId: string;
  targetCardName: string;
  targetOwner: string;
  gameCreator: string;
  timestamp: number;
}

export const CPUDamageDialog: React.FC = () => {
  const [damageRequest, setDamageRequest] = useState<CPUDamageRequest | null>(null);
  const [damageValue, setDamageValue] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const { playerName } = useGameState();

  // Listen for CPU damage requests
  useEffect(() => {
    const handleCPUDamageRequest = (request: CPUDamageRequest) => {
      console.log('🤖 CPU DAMAGE REQUEST RECEIVED:', request);
      console.log('🤖 Current playerName:', playerName);
      console.log('🤖 Request gameCreator:', request.gameCreator);
      
      // Only show dialog if this player is the game creator
      if (request.gameCreator === playerName) {
        console.log('🤖 SHOWING CPU DAMAGE DIALOG!');
        setDamageRequest(request);
        setDamageValue('');
        setIsProcessing(false);
      } else {
        console.log('🤖 CPU damage request not for this player, ignoring');
      }
    };

    socket.on('cpu-damage-request', handleCPUDamageRequest);

    return () => {
      socket.off('cpu-damage-request', handleCPUDamageRequest);
    };
  }, [playerName]);

  const handleDamageSubmit = () => {
    if (!damageRequest || isProcessing) return;
    
    const damage = parseInt(damageValue);
    if (isNaN(damage) || damage <= 0) {
      alert('Inserisci un valore di danno valido!');
      return;
    }
    
    setIsProcessing(true);
    console.log(`🤖 Submitting CPU damage: ${damage}`);
    
    socket.emit('cpu-damage-submit', {
      cpuName: damageRequest.cpuName,
      mosseCardId: damageRequest.mosseCardId,
      targetCardId: damageRequest.targetCardId,
      targetOwner: damageRequest.targetOwner,
      damageValue: damage
    });

    // Close dialog after sending response
    setTimeout(() => {
      setDamageRequest(null);
      setDamageValue('');
      setIsProcessing(false);
    }, 500);
  };

  if (!damageRequest) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
      <Card className="w-full max-w-md bg-white shadow-2xl border-2 border-purple-500">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 text-purple-600">
            <Bot className="w-6 h-6" />
            <CardTitle className="text-xl font-bold">ATTACCO CPU</CardTitle>
            <Swords className="w-6 h-6" />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-gray-700 font-medium mb-2">
              Il personaggio <strong className="text-purple-600">{damageRequest.cpuName}</strong> ha deciso di usare la mossa
            </p>
            <p className="text-lg font-bold text-purple-700 mb-2">
              {damageRequest.mosseCardName}
            </p>
            <p className="text-gray-700 font-medium">
              contro il personaggio avversario <strong className="text-red-600">{damageRequest.targetCardName}</strong> di <strong>{damageRequest.targetOwner}</strong>
            </p>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
            <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
              Inserisci il danno di questa mossa:
            </label>
            <input
              type="number"
              min="1"
              value={damageValue}
              onChange={(e) => setDamageValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && damageValue) {
                  handleDamageSubmit();
                }
              }}
              placeholder="Danno (es. 50)"
              className="w-full px-4 py-3 text-center text-2xl font-bold border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
              disabled={isProcessing}
            />
          </div>
          
          <Button
            onClick={handleDamageSubmit}
            disabled={isProcessing || !damageValue}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 text-lg transition-all duration-200"
          >
            {isProcessing ? 'APPLICANDO...' : 'APPLICA DANNO'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
