import React, { useState, useEffect } from 'react';
import { useGameState } from '../lib/stores/useGameState';
import { socket } from '../lib/socket';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Handshake, X, DicesIcon, ChevronRight } from 'lucide-react';

interface ContrattazioneState {
  negotiationId: string;
  attacker: string;
  defender: string;
  targetCardId: string;
  mosseCardId: string;
  baseDamage: number;
  offersLeft: number;
  currentOffer?: number;
  phase: 'offer' | 'waiting_response' | 'resolved';
  resolvedData?: {
    accepted: boolean;
    finalDamage: number;
    diceResult?: number;
    discountPct?: number;
  };
}

export const ContrattazioneDialog: React.FC = () => {
  const { playerName } = useGameState();
  const [state, setState] = useState<ContrattazioneState | null>(null);
  const [offerInput, setOfferInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAttacker = state?.attacker === playerName;
  const isDefender = state?.defender === playerName;
  const isParticipant = isAttacker || isDefender;

  useEffect(() => {
    const handleStart = (data: any) => {
      setState({
        negotiationId: data.negotiationId,
        attacker: data.attacker,
        defender: data.defender,
        targetCardId: data.targetCardId,
        mosseCardId: data.mosseCardId,
        baseDamage: data.baseDamage,
        offersLeft: data.offersLeft,
        phase: 'offer'
      });
      setOfferInput(String(data.baseDamage));
    };

    const handleOfferReceived = (data: any) => {
      setState(prev => prev ? {
        ...prev,
        offersLeft: data.offersLeft,
        currentOffer: data.offerDamage,
        phase: 'waiting_response'
      } : prev);
    };

    const handleRejected = (data: any) => {
      setState(prev => prev ? {
        ...prev,
        offersLeft: data.offersLeft,
        phase: 'offer'
      } : prev);
      setOfferInput('');
    };

    const handleResolved = (data: any) => {
      setState(prev => prev ? {
        ...prev,
        phase: 'resolved',
        resolvedData: {
          accepted: data.accepted,
          finalDamage: data.finalDamage,
          diceResult: data.diceResult,
          discountPct: data.discountPct
        }
      } : prev);
      setTimeout(() => setState(null), 4000);
    };

    socket.on('contrattazione:start', handleStart);
    socket.on('contrattazione:offer-received', handleOfferReceived);
    socket.on('contrattazione:rejected', handleRejected);
    socket.on('contrattazione:resolved', handleResolved);

    return () => {
      socket.off('contrattazione:start', handleStart);
      socket.off('contrattazione:offer-received', handleOfferReceived);
      socket.off('contrattazione:rejected', handleRejected);
      socket.off('contrattazione:resolved', handleResolved);
    };
  }, []);

  const submitOffer = () => {
    if (!state || !isAttacker) return;
    const val = parseInt(offerInput);
    if (isNaN(val) || val < 0) return;
    setIsSubmitting(true);
    socket.emit('contrattazione:offer', { negotiationId: state.negotiationId, offerDamage: val });
    setState(prev => prev ? { ...prev, phase: 'waiting_response', currentOffer: val } : prev);
    setIsSubmitting(false);
  };

  const respond = (accept: boolean) => {
    if (!state || !isDefender) return;
    socket.emit('contrattazione:respond', { negotiationId: state.negotiationId, accept });
  };

  if (!state) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 pointer-events-auto">
      <div className="bg-gray-900 border-2 border-yellow-500 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 text-white">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Handshake className="text-yellow-400" size={28} />
          <div>
            <h2 className="text-xl font-bold text-yellow-400">CONTRATTAZIONE CLANDESTINA</h2>
            <p className="text-sm text-gray-300">
              {state.attacker} attacca {state.defender}
            </p>
          </div>
        </div>

        {/* Damage info */}
        <div className="bg-gray-800 rounded-lg p-3 mb-4 flex justify-between items-center">
          <div>
            <span className="text-gray-300 text-sm">Danno base</span>
            <p className="text-xs text-gray-500">100 PTI × stelle attaccante</p>
          </div>
          <span className="text-red-400 font-bold text-lg">{state.baseDamage} PTI</span>
        </div>

        {/* Offers left */}
        <div className="flex gap-2 mb-4">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className={`flex-1 h-2 rounded-full ${i <= state.offersLeft ? 'bg-yellow-400' : 'bg-gray-600'}`}
            />
          ))}
          <span className="text-xs text-gray-400 ml-1">{state.offersLeft} offert{state.offersLeft === 1 ? 'a' : 'e'}</span>
        </div>

        {/* Phase: resolved */}
        {state.phase === 'resolved' && state.resolvedData && (
          <div className={`text-center py-4 rounded-lg ${state.resolvedData.accepted ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
            {state.resolvedData.accepted ? (
              <>
                <div className="text-2xl mb-2">✅</div>
                <p className="font-bold text-green-400">ACCORDO RAGGIUNTO!</p>
                <p className="text-white">Danno finale: <span className="font-bold text-red-400">{state.resolvedData.finalDamage} PTI</span></p>
              </>
            ) : (
              <>
                <div className="text-2xl mb-2">🎲</div>
                <p className="font-bold text-orange-400">NESSUN ACCORDO!</p>
                <p className="text-gray-300 text-sm">Dado: {state.resolvedData.diceResult} → -{state.resolvedData.discountPct}% sconto</p>
                <p className="text-white">Danno finale: <span className="font-bold text-red-400">{state.resolvedData.finalDamage} PTI</span></p>
              </>
            )}
          </div>
        )}

        {/* Phase: attacker makes offer */}
        {state.phase === 'offer' && isAttacker && (
          <div>
            <p className="text-sm text-gray-300 mb-3">
              Proponi un danno ridotto a <strong>{state.defender}</strong>. Puoi offrire qualsiasi valore da 0 a {state.baseDamage} PTI.
            </p>
            <div className="flex gap-2 mb-2">
              <Input
                type="number"
                min={0}
                max={state.baseDamage}
                value={offerInput}
                onChange={e => setOfferInput(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white"
                placeholder="Danno offerto (PTI)"
              />
              <Button
                onClick={submitOffer}
                disabled={isSubmitting}
                className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-4"
              >
                <ChevronRight size={18} />
                Offri
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Se tutte e 3 le offerte vengono rifiutate, il dado decide lo sconto (1 faccia = 10%).
            </p>
          </div>
        )}

        {/* Phase: attacker waiting for response */}
        {state.phase === 'waiting_response' && isAttacker && (
          <div className="text-center py-3">
            <p className="text-yellow-300 animate-pulse">In attesa della risposta di {state.defender}...</p>
            <p className="text-gray-400 text-sm mt-1">Hai offerto <strong className="text-white">{state.currentOffer} PTI</strong></p>
          </div>
        )}

        {/* Phase: defender receives offer */}
        {state.phase === 'waiting_response' && isDefender && (
          <div>
            <p className="text-sm text-gray-300 mb-3">
              <strong>{state.attacker}</strong> ti offre un danno ridotto:
            </p>
            <div className="bg-gray-800 rounded-lg p-4 text-center mb-4">
              <span className="text-3xl font-bold text-yellow-400">{state.currentOffer} PTI</span>
              <p className="text-xs text-gray-400 mt-1">invece di {state.baseDamage} PTI</p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => respond(true)}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white font-bold"
              >
                ✅ Accetta
              </Button>
              <Button
                onClick={() => respond(false)}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold"
              >
                ❌ Rifiuta {state.offersLeft <= 1 ? '(dado)' : ''}
              </Button>
            </div>
            {state.offersLeft <= 1 && (
              <p className="text-xs text-orange-400 text-center mt-2">
                Ultima offerta! Se rifiuti, il dado decide lo sconto.
              </p>
            )}
          </div>
        )}

        {/* Phase: waiting for defender (attacker view, offer not submitted yet) */}
        {state.phase === 'offer' && isDefender && (
          <div className="text-center py-3">
            <p className="text-yellow-300 animate-pulse">In attesa dell'offerta di {state.attacker}...</p>
          </div>
        )}

        {/* Non-participant spectator view */}
        {!isParticipant && state.phase !== 'resolved' && (
          <div className="text-center py-3 text-gray-400">
            <p>Negoziazione in corso tra {state.attacker} e {state.defender}...</p>
          </div>
        )}
      </div>
    </div>
  );
};
