import React, { useState, useEffect } from 'react';
import { useGameState } from '../lib/stores/useGameState';
import { socket } from '../lib/socket';
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

  useEffect(() => {
    const handleDuelAutoAttack = (event: DuelAutoAttackEvent) => {
      console.log('⚔️ DUEL AUTO-ATTACK EVENT:', event);
      if (event.attackerName === playerName) {
        console.log('⚔️ SHOWING DUEL DAMAGE DIALOG!');
        const targetCard = gameState?.field.find((c: any) => c.id === event.targetCardId);
        const targetName = targetCard ? getCardName(targetCard.frontImage) : 'Personaggio avversario';
        const mosseCard = gameState?.field.find((c: any) => c.id === event.mosseCardId);
        const mosseName = mosseCard ? getCardName(mosseCard.frontImage) : 'Carta MOSSE';

        setAttackEvent({
          ...event,
          message: `Stai attaccando ${targetName} con ${mosseName}!`
        });
        setDamageValue('');
        setIsProcessing(false);
      }
    };

    socket.on('duel-auto-attack', handleDuelAutoAttack);
    return () => { socket.off('duel-auto-attack', handleDuelAutoAttack); };
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-black/85 backdrop-blur-xl border border-red-500/40 rounded-2xl shadow-[0_0_40px_rgba(239,68,68,0.25)] w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <Swords className="w-5 h-5 text-red-400" />
          </div>
          <h2 className="text-xl font-black bg-gradient-to-r from-red-400 to-rose-400 bg-clip-text text-transparent">
            ⚔️ ATTACCO DUELLO
          </h2>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <Swords className="w-5 h-5 text-red-400" />
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 text-center">
          <p className="text-violet-100 font-medium">
            {attackEvent.message}
          </p>
        </div>

        <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-4 mb-4">
          <label className="block text-sm font-semibold text-violet-300/80 mb-2 text-center">
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
            className="w-full px-4 py-3 text-center text-2xl font-bold bg-black/40 border border-red-500/30 text-red-100 placeholder:text-red-300/30 rounded-xl focus:outline-none focus:border-red-400/60 transition-colors"
            autoFocus
            disabled={isProcessing}
          />
          <p className="text-xs text-violet-400/50 text-center mt-2">
            Puoi usare operazioni: es. 50*2, 100+20
          </p>
        </div>

        <button
          onClick={handleDamageSubmit}
          disabled={isProcessing || !damageValue}
          className="w-full py-4 text-lg font-bold bg-gradient-to-r from-red-700 to-rose-800 hover:from-red-600 hover:to-rose-700 disabled:opacity-40 text-white rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
        >
          {isProcessing ? 'ATTACCANDO...' : '⚔️ ATTACCA!'}
        </button>
      </div>
    </div>
  );
};
