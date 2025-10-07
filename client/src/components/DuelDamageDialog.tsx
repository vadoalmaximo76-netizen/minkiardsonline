import React, { useState, useEffect } from 'react';
import { useGameState } from '../lib/stores/useGameState';
import { socket } from '../lib/socket';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Swords } from 'lucide-react';

interface DuelAutoAttackEvent {
  attackerName: string;
  mosseCardId: string;
  targetCardId: string;
  message: string;
}

export const DuelDamageDialog: React.FC = () => {
  const [attackEvent, setAttackEvent] = useState<DuelAutoAttackEvent | null>(null);
  const [damageValue, setDamageValue] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const { playerName, gameState } = useGameState();

  // Listen for duel auto-attack events
  useEffect(() => {
    const handleDuelAutoAttack = (event: DuelAutoAttackEvent) => {
      console.log('⚔️ DUEL AUTO-ATTACK EVENT:', event);
      console.log('⚔️ Current playerName:', playerName);
      console.log('⚔️ Event attackerName:', event.attackerName);
      
      // Only show dialog if this player is the attacker
      if (event.attackerName === playerName) {
        console.log('⚔️ SHOWING DUEL DAMAGE DIALOG!');
        
        // Get target card name
        const targetCard = gameState?.field.find((c: any) => c.id === event.targetCardId);
        const targetName = targetCard ? getCardName(targetCard.frontImage) : 'Personaggio avversario';
        
        // Get MOSSE card name
        const mosseCard = gameState?.field.find((c: any) => c.id === event.mosseCardId);
        const mosseName = mosseCard ? getCardName(mosseCard.frontImage) : 'Carta MOSSE';
        
        console.log(`⚔️ Target: ${targetName}, MOSSE: ${mosseName}`);
        
        setAttackEvent({
          ...event,
          message: `Stai attaccando ${targetName} con ${mosseName}!`
        });
        setDamageValue('');
        setIsProcessing(false);
      } else {
        console.log('⚔️ Duel auto-attack not for this player, ignoring');
      }
    };

    socket.on('duel-auto-attack', handleDuelAutoAttack);

    return () => {
      socket.off('duel-auto-attack', handleDuelAutoAttack);
    };
  }, [playerName, gameState]);

  const getCardName = (url: string): string => {
    if (!url) return 'Carta';
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename
      .toLowerCase()
      .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper to evaluate mathematical expressions
  const evaluateExpression = (expr: string): number => {
    try {
      const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, '');
      const result = Function(`'use strict'; return (${sanitized})`)();
      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        throw new Error('Risultato non valido');
      }
      return Math.floor(result);
    } catch (error) {
      throw new Error('Espressione matematica non valida');
    }
  };

  const handleDamageSubmit = () => {
    if (!attackEvent || isProcessing) return;
    
    try {
      const damage = evaluateExpression(damageValue.trim());
      if (damage <= 0) {
        alert('Il danno deve essere un numero positivo!');
        return;
      }
      
      setIsProcessing(true);
      console.log(`⚔️ DUELLO: Submitting attack with damage: ${damage}`);
      
      // Find target owner
      const targetCard = gameState?.field.find((c: any) => c.id === attackEvent.targetCardId);
      if (!targetCard) {
        alert('Personaggio bersaglio non trovato!');
        setIsProcessing(false);
        return;
      }
      
      socket.emit('mosse-attack', {
        mosseCardId: attackEvent.mosseCardId,
        targetCardId: attackEvent.targetCardId,
        attackerName: attackEvent.attackerName,
        targetOwner: targetCard.owner,
        damageValue: damage
      });

      // Close dialog after sending attack
      setTimeout(() => {
        setAttackEvent(null);
        setDamageValue('');
        setIsProcessing(false);
      }, 500);
    } catch (error: any) {
      alert(error.message || 'Errore nel calcolo del danno');
      setIsProcessing(false);
    }
  };

  if (!attackEvent) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
      <Card className="w-full max-w-md bg-white shadow-2xl border-2 border-red-500">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 text-red-600">
            <Swords className="w-6 h-6" />
            <CardTitle className="text-xl font-bold">⚔️ ATTACCO DUELLO</CardTitle>
            <Swords className="w-6 h-6" />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-gray-700 font-medium mb-2">
              {attackEvent.message}
            </p>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
            <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
              Inserisci il danno dell'attacco:
            </label>
            <input
              type="text"
              value={damageValue}
              onChange={(e) => setDamageValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && damageValue) {
                  handleDamageSubmit();
                }
              }}
              placeholder="es. 100 o 50*2"
              className="w-full px-4 py-3 text-center text-2xl font-bold border-2 border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              autoFocus
              disabled={isProcessing}
            />
            <p className="text-xs text-gray-500 text-center mt-2">
              Puoi usare operazioni: es. 50*2, 100+20
            </p>
          </div>
          
          <Button
            onClick={handleDamageSubmit}
            disabled={isProcessing || !damageValue}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 text-lg transition-all duration-200"
          >
            {isProcessing ? 'ATTACCANDO...' : '⚔️ ATTACCA!'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
