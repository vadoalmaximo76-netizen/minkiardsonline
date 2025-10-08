import React, { useState, useEffect } from 'react';
import { useGameState } from '../lib/stores/useGameState';
import { socket } from '../lib/socket';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Swords, Bot, Dices } from 'lucide-react';
import { DiceModal } from './DiceModal';

interface CharacterData {
  id: string;
  name: string;
  image: string;
  notes: string;
}

interface CPUDamageRequest {
  cpuName: string;
  cpuCharacterName: string;
  mosseCardId: string;
  mosseCardName: string;
  mosseCardImage: string;
  targetCardId: string;
  targetCardName: string;
  targetOwner: string;
  gameCreator: string;
  timestamp: number;
  attackerCharacter: CharacterData | null;
  defenderCharacter: CharacterData | null;
}

export const CPUDamageDialog: React.FC = () => {
  const [damageRequest, setDamageRequest] = useState<CPUDamageRequest | null>(null);
  const [damageValue, setDamageValue] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDiceModalOpen, setIsDiceModalOpen] = useState<boolean>(false);
  const [currentDiceRoll, setCurrentDiceRoll] = useState<number | undefined>(undefined);
  const [playerWhoRolled, setPlayerWhoRolled] = useState<string | undefined>(undefined);
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

    const handleDiceRolled = (data: { playerName: string; result: number }) => {
      setCurrentDiceRoll(data.result);
      setPlayerWhoRolled(data.playerName);
    };

    socket.on('cpu-damage-request', handleCPUDamageRequest);
    socket.on('dice-rolled', handleDiceRolled);

    return () => {
      socket.off('cpu-damage-request', handleCPUDamageRequest);
      socket.off('dice-rolled', handleDiceRolled);
    };
  }, [playerName]);

  const handleDamageSubmit = () => {
    if (!damageRequest || isProcessing) return;
    
    const damage = parseInt(damageValue);
    if (isNaN(damage) || damage < 0) {
      alert('Inserisci un valore di danno valido (minimo 0)!');
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
    <>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
        <Card className="w-full max-w-4xl bg-white shadow-2xl border-2 border-purple-500">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-2 text-purple-600">
              <Bot className="w-6 h-6" />
              <CardTitle className="text-xl font-bold">ATTACCO CPU</CardTitle>
              <Swords className="w-6 h-6" />
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Characters and Move Display */}
            <div className="grid grid-cols-3 gap-4 items-start">
              {/* Attacker Character */}
              <div className="text-center">
                <p className="text-sm font-bold text-purple-600 mb-2">ATTACCANTE</p>
                {damageRequest.attackerCharacter ? (
                  <>
                    <img 
                      src={damageRequest.attackerCharacter.image} 
                      alt={damageRequest.attackerCharacter.name}
                      className="w-full h-48 object-cover rounded-lg shadow-lg border-2 border-purple-400 mb-2"
                    />
                    <p className="font-bold text-purple-700">{damageRequest.attackerCharacter.name}</p>
                    <p className="text-xs text-gray-600 mt-1">({damageRequest.cpuName})</p>
                    {damageRequest.attackerCharacter.notes && (
                      <div className="mt-2 p-2 bg-purple-50 rounded text-xs text-left">
                        <p className="font-semibold text-purple-700">Note:</p>
                        <p className="text-gray-700 whitespace-pre-wrap">{damageRequest.attackerCharacter.notes}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-400 italic">Nessun personaggio</p>
                )}
              </div>

              {/* MOSSE Card */}
              <div className="text-center">
                <p className="text-sm font-bold text-orange-600 mb-2">MOSSA USATA</p>
                {damageRequest.mosseCardImage && (
                  <img 
                    src={damageRequest.mosseCardImage} 
                    alt={damageRequest.mosseCardName}
                    className="w-full h-48 object-cover rounded-lg shadow-lg border-2 border-orange-400 mb-2"
                  />
                )}
                <p className="font-bold text-orange-700">{damageRequest.mosseCardName}</p>
              </div>

              {/* Defender Character */}
              <div className="text-center">
                <p className="text-sm font-bold text-red-600 mb-2">DIFENSORE</p>
                {damageRequest.defenderCharacter ? (
                  <>
                    <img 
                      src={damageRequest.defenderCharacter.image} 
                      alt={damageRequest.defenderCharacter.name}
                      className="w-full h-48 object-cover rounded-lg shadow-lg border-2 border-red-400 mb-2"
                    />
                    <p className="font-bold text-red-700">{damageRequest.defenderCharacter.name}</p>
                    <p className="text-xs text-gray-600 mt-1">({damageRequest.targetOwner})</p>
                    {damageRequest.defenderCharacter.notes && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-xs text-left">
                        <p className="font-semibold text-red-700">Note:</p>
                        <p className="text-gray-700 whitespace-pre-wrap">{damageRequest.defenderCharacter.notes}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-400 italic">Nessun personaggio</p>
                )}
              </div>
            </div>
            
            {/* Damage Input */}
            <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
              <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                Inserisci il danno di questa mossa:
              </label>
              <input
                type="number"
                min="0"
                value={damageValue}
                onChange={(e) => setDamageValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && damageValue !== '') {
                    handleDamageSubmit();
                  }
                }}
                placeholder="Danno (es. 50 o 0)"
                className="w-full px-4 py-3 text-center text-2xl font-bold border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
                disabled={isProcessing}
              />
            </div>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => setIsDiceModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 text-lg transition-all duration-200"
              >
                <Dices className="w-5 h-5 mr-2" />
                LANCIA IL DADO
              </Button>
              
              <Button
                onClick={handleDamageSubmit}
                disabled={isProcessing || !damageValue}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 text-lg transition-all duration-200"
              >
                {isProcessing ? 'APPLICANDO...' : 'APPLICA DANNO'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dice Modal */}
      <DiceModal 
        isOpen={isDiceModalOpen}
        onClose={() => setIsDiceModalOpen(false)}
        currentRoll={currentDiceRoll}
        playerWhoRolled={playerWhoRolled}
      />
    </>
  );
};
