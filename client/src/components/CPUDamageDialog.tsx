import React, { useState, useEffect } from 'react';
import { useGameState } from '../lib/stores/useGameState';
import { socket } from '../lib/socket';
import { Swords, Bot, Dices, X } from 'lucide-react';
import { DiceModal } from './DiceModal';

const evaluateMathExpression = (expr: string): number | null => {
  const cleaned = expr.replace(/\s/g, '');
  if (!/^[\d+\-*/().]+$/.test(cleaned)) return null;
  try {
    const result = Function('"use strict"; return (' + cleaned + ')')();
    return typeof result === 'number' && isFinite(result) ? Math.floor(result) : null;
  } catch {
    return null;
  }
};

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
  isHandTarget?: boolean;
  mosseDamageValue?: number | null;
  mosseDamageEffect?: string | null;
  suggestedDamage?: number | null;
  attackerStars?: number;
}

export const CPUDamageDialog: React.FC = () => {
  const [damageRequest, setDamageRequest] = useState<CPUDamageRequest | null>(null);
  const [damageValue, setDamageValue] = useState<string>('');
  const [starsToRemove, setStarsToRemove] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDiceModalOpen, setIsDiceModalOpen] = useState<boolean>(false);
  const [currentDiceRoll, setCurrentDiceRoll] = useState<number | undefined>(undefined);
  const [playerWhoRolled, setPlayerWhoRolled] = useState<string | undefined>(undefined);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState<number | null>(null);
  const { playerName } = useGameState();

  useEffect(() => {
    const handleCPUDamageRequest = (request: CPUDamageRequest) => {
      console.log('🤖 CPU DAMAGE REQUEST RECEIVED:', request);
      if (request.gameCreator === playerName) {
        console.log('🤖 SHOWING CPU DAMAGE DIALOG!');
        setDamageRequest(request);
        if (request.suggestedDamage !== null && request.suggestedDamage !== undefined) {
          setDamageValue(request.suggestedDamage.toString());
          setAutoSubmitCountdown(3);
        } else {
          setDamageValue('');
          setAutoSubmitCountdown(null);
        }
        setStarsToRemove('');
        setIsProcessing(false);
      }
    };

    const handleDiceRoll = (data: { playerName: string; value: number }) => {
      console.log('🎲 DICE ROLL RESULT:', data);
      setCurrentDiceRoll(data.value);
      setPlayerWhoRolled(data.playerName);
    };

    socket.on('cpu-damage-request', handleCPUDamageRequest);
    socket.on('dice-rolled', handleDiceRoll);

    return () => {
      socket.off('cpu-damage-request', handleCPUDamageRequest);
      socket.off('dice-rolled', handleDiceRoll);
    };
  }, [playerName]);

  useEffect(() => {
    if (autoSubmitCountdown === null) return;
    if (autoSubmitCountdown <= 0) {
      handleDamageSubmit();
      return;
    }
    const timer = setTimeout(() => setAutoSubmitCountdown(prev => (prev !== null ? prev - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [autoSubmitCountdown]);

  const handleDamageSubmit = () => {
    if (!damageRequest || isProcessing) return;

    const damage = evaluateMathExpression(damageValue.trim());
    if (damage === null || damage < 0) {
      alert('Inserisci un valore di danno valido (minimo 0)!');
      return;
    }

    const stars = starsToRemove === '' ? 0 : parseInt(starsToRemove);
    if (isNaN(stars) || stars < 0) {
      alert('Inserisci un valore di stelle valido (minimo 0)!');
      return;
    }

    setIsProcessing(true);

    socket.emit('cpu-damage-submit', {
      cpuName: damageRequest.cpuName,
      mosseCardId: damageRequest.mosseCardId,
      targetCardId: damageRequest.targetCardId,
      targetOwner: damageRequest.targetOwner,
      damageValue: damage,
      starsToRemove: stars,
      mosseEffect: damageRequest.mosseDamageEffect || null
    });

    setTimeout(() => {
      setDamageRequest(null);
      setDamageValue('');
      setStarsToRemove('');
      setIsProcessing(false);
    }, 500);
  };

  if (!damageRequest) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="bg-black/85 backdrop-blur-xl border border-violet-500/30 rounded-2xl shadow-[0_0_40px_rgba(124,58,237,0.3)] w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">

          {/* Header */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-xl font-black bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              ATTACCO CPU
            </h2>
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
              <Swords className="w-5 h-5 text-violet-400" />
            </div>
          </div>

          {/* Characters and Move Display */}
          <div className="grid grid-cols-3 gap-4 items-start mb-5">
            {/* Attacker Character */}
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/70 mb-2">Attaccante</p>
              {damageRequest.attackerCharacter && damageRequest.attackerCharacter.image ? (
                <>
                  <img
                    src={damageRequest.attackerCharacter.image}
                    alt={damageRequest.attackerCharacter.name}
                    className="w-full h-48 object-cover rounded-xl shadow-lg border-2 border-violet-500/30 mb-2 cursor-pointer hover:border-violet-400/60 transition-all"
                    onClick={() => setZoomedImage(damageRequest.attackerCharacter!.image)}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <p className="font-bold text-violet-100">{damageRequest.attackerCharacter.name || 'Attaccante'}</p>
                  <p className="text-xs text-violet-400/50 mt-0.5">({damageRequest.cpuName})</p>
                  {damageRequest.attackerCharacter.notes && (
                    <div className="mt-2 p-2 bg-violet-900/20 border border-violet-500/15 rounded-xl text-xs text-left">
                      <p className="font-semibold text-violet-300/70">Note:</p>
                      <p className="text-violet-200/70 whitespace-pre-wrap">{damageRequest.attackerCharacter.notes}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-48 rounded-xl border-2 border-violet-500/30 mb-2 bg-violet-900/20 flex items-center justify-center">
                  <p className="text-violet-300 font-bold">{damageRequest.cpuName}</p>
                </div>
              )}
            </div>

            {/* MOSSE Card */}
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-400/70 mb-2">Mossa usata</p>
              {damageRequest.mosseCardImage && (
                <img
                  src={damageRequest.mosseCardImage}
                  alt={damageRequest.mosseCardName}
                  className="w-full h-48 object-cover rounded-xl shadow-lg border-2 border-orange-500/30 mb-2 cursor-pointer hover:border-orange-400/60 transition-all"
                  onClick={() => setZoomedImage(damageRequest.mosseCardImage)}
                />
              )}
              <p className="font-bold text-orange-300">{damageRequest.mosseCardName}</p>
            </div>

            {/* Defender Character */}
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-red-400/70 mb-2">
                {damageRequest.isHandTarget ? 'Bersaglio (mano)' : 'Difensore'}
              </p>
              {damageRequest.isHandTarget ? (
                <div className="w-full h-48 rounded-xl border-2 border-red-500/30 mb-2 bg-gradient-to-br from-red-900/40 to-rose-900/40 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-white font-bold text-xl mb-2">🎴</p>
                    <p className="text-white text-xs font-semibold">CARTA COPERTA</p>
                    <p className="text-red-300/70 text-xs mt-1">{damageRequest.targetCardName}</p>
                  </div>
                </div>
              ) : (
                damageRequest.defenderCharacter && damageRequest.defenderCharacter.image ? (
                  <>
                    <img
                      src={damageRequest.defenderCharacter.image}
                      alt={damageRequest.defenderCharacter.name}
                      className="w-full h-48 object-cover rounded-xl shadow-lg border-2 border-red-500/30 mb-2 cursor-pointer hover:border-red-400/60 transition-all"
                      onClick={() => setZoomedImage(damageRequest.defenderCharacter!.image)}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <p className="font-bold text-red-300">{damageRequest.defenderCharacter.name || 'Difensore'}</p>
                    <p className="text-xs text-violet-400/50 mt-0.5">({damageRequest.targetOwner})</p>
                    {damageRequest.defenderCharacter.notes && (
                      <div className="mt-2 p-2 bg-red-900/20 border border-red-500/15 rounded-xl text-xs text-left">
                        <p className="font-semibold text-red-300/70">Note:</p>
                        <p className="text-violet-200/70 whitespace-pre-wrap">{damageRequest.defenderCharacter.notes}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-48 rounded-xl border-2 border-red-500/30 mb-2 bg-red-900/20 flex items-center justify-center">
                    <p className="text-red-300 font-bold">{damageRequest.targetOwner}</p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* MOSSE Damage Info */}
          {damageRequest.mosseDamageValue !== null && damageRequest.mosseDamageValue !== undefined && (
            <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-3 mb-4">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                <span>⚔️</span>
                <span>Danno pre-calcolato: {damageRequest.mosseDamageValue} PTI × {damageRequest.attackerStars || 1} stelle = {damageRequest.suggestedDamage} PTI</span>
              </div>
              <p className="text-center text-emerald-400/60 text-xs mt-1">Puoi modificare il valore prima di confermare</p>
            </div>
          )}

          {/* MOSSE Effect Info */}
          {damageRequest.mosseDamageEffect && (
            <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-3 mb-4">
              <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-sm">
                <span>💀</span>
                <span>Effetto speciale: {
                  damageRequest.mosseDamageEffect === 'death' ? 'Morte istantanea' :
                  damageRequest.mosseDamageEffect === 'halve_pti' ? 'PTI dimezzati' :
                  damageRequest.mosseDamageEffect === 'zero_stars' ? 'Manda a 0 stelle' :
                  damageRequest.mosseDamageEffect === 'set_5_pti' ? 'Manda a 5 PTI' :
                  damageRequest.mosseDamageEffect === 'remove_1_star' ? 'Elimina 1 stella' :
                  damageRequest.mosseDamageEffect
                }</span>
              </div>
            </div>
          )}

          {/* Damage and Stars Input */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-violet-900/20 border border-violet-500/20 rounded-xl p-4">
              <label className="block text-sm font-semibold text-violet-300/80 mb-2 text-center">
                PTI da togliere:
              </label>
              <input
                type="text"
                value={damageValue}
                onChange={(e) => setDamageValue(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter' && damageValue !== '') handleDamageSubmit(); }}
                placeholder="Es: 50, 100+50, 200*2"
                className={`w-full px-4 py-3 text-center text-2xl font-bold bg-black/40 border rounded-xl focus:outline-none transition-colors text-violet-100 placeholder:text-violet-400/30 ${
                  damageRequest.suggestedDamage !== null && damageRequest.suggestedDamage !== undefined
                    ? 'border-emerald-500/40 focus:border-emerald-400/60'
                    : 'border-violet-500/30 focus:border-violet-400/60'
                }`}
                autoFocus
                disabled={isProcessing}
              />
            </div>
            <div className="bg-amber-900/20 border border-amber-500/20 rounded-xl p-4">
              <label className="block text-sm font-semibold text-amber-300/80 mb-2 text-center">
                ⭐ Stelle da togliere:
              </label>
              <input
                type="number"
                min="0"
                value={starsToRemove}
                onChange={(e) => setStarsToRemove(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter' && damageValue !== '') handleDamageSubmit(); }}
                placeholder="Stelle (es. 1)"
                className="w-full px-4 py-3 text-center text-2xl font-bold bg-black/40 border border-amber-500/30 text-amber-100 placeholder:text-amber-400/30 rounded-xl focus:outline-none focus:border-amber-400/60 transition-colors"
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setIsDiceModalOpen(true)}
              className="flex items-center justify-center gap-2 py-4 text-lg font-bold bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl transition-all"
            >
              <Dices className="w-5 h-5" />
              LANCIA IL DADO
            </button>

            <div className="relative">
              {autoSubmitCountdown !== null && (
                <button
                  onClick={() => setAutoSubmitCountdown(null)}
                  className="absolute -top-5 left-0 right-0 text-xs text-amber-300/70 underline text-center"
                >
                  Annulla auto-invio ({autoSubmitCountdown}s)
                </button>
              )}
              <button
                onClick={handleDamageSubmit}
                disabled={isProcessing || !damageValue}
                className="w-full py-4 text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 text-white rounded-xl transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)]"
              >
                {autoSubmitCountdown !== null
                  ? `AUTO-INVIO IN ${autoSubmitCountdown}s`
                  : isProcessing ? 'APPLICANDO...' : 'APPLICA DANNO'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <DiceModal
        isOpen={isDiceModalOpen}
        onClose={() => setIsDiceModalOpen(false)}
        currentRoll={currentDiceRoll}
        playerWhoRolled={playerWhoRolled}
      />

      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[120] p-4"
          onClick={() => setZoomedImage(null)}
        >
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-red-900/60 border border-red-500/30 hover:bg-red-900 text-white rounded-full flex items-center justify-center z-[121] transition-colors"
          >
            <X size={20} />
          </button>
          <img
            src={zoomedImage}
            alt="Carta ingrandita"
            className="max-w-full max-h-full object-contain rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
