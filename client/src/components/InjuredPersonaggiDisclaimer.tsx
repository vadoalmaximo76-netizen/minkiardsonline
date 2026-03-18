import React, { useEffect, useState, useCallback } from 'react';

export interface InjuredCard {
  cardId: string;
  name: string;
  imageUrl: string | null;
  gamesRemaining: number;
}

interface Props {
  authToken: string;
  /** cardIds that are relevant to the current deck/selection (filter injuries to only these) */
  relevantCardIds?: string[];
  onConfirm: (availableCardIds: string[]) => void;
  onCancel: () => void;
  userCredits: number;
  onCreditsUpdated: (newCredits: number) => void;
}

const REVIVE_COST = 50;

export function InjuredPersonaggiDisclaimer({
  authToken,
  relevantCardIds,
  onConfirm,
  onCancel,
  userCredits,
  onCreditsUpdated,
}: Props) {
  const [injured, setInjured] = useState<InjuredCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviving, setReviving] = useState<Set<string>>(new Set());
  const [localCredits, setLocalCredits] = useState(userCredits);

  const fetchInjured = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/injured-personaggi', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        let list: InjuredCard[] = data.injured || [];
        if (relevantCardIds && relevantCardIds.length > 0) {
          const relevant = new Set(relevantCardIds);
          list = list.filter(c => relevant.has(c.cardId));
        }
        setInjured(list);
      }
    } catch {
      // Silent — assume no injuries on error
      setInjured([]);
    } finally {
      setLoading(false);
    }
  }, [authToken, relevantCardIds]);

  useEffect(() => {
    fetchInjured();
  }, [fetchInjured]);

  useEffect(() => {
    setLocalCredits(userCredits);
  }, [userCredits]);

  const handleRevive = async (cardId: string) => {
    if (localCredits < REVIVE_COST) return;
    setReviving(prev => new Set(prev).add(cardId));
    try {
      const res = await fetch('/api/revive-personaggio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ cardId }),
      });
      const data = await res.json();
      if (data.success) {
        const newCreds = data.newCredits;
        setLocalCredits(newCreds);
        onCreditsUpdated(newCreds);
        setInjured(prev => prev.filter(c => c.cardId !== cardId));
      } else {
        alert(data.error || 'Impossibile riscattare il personaggio');
      }
    } catch {
      alert('Errore di rete');
    } finally {
      setReviving(prev => { const s = new Set(prev); s.delete(cardId); return s; });
    }
  };

  const handleConfirm = () => {
    const injuredIds = new Set(injured.map(c => c.cardId));
    const available = relevantCardIds
      ? relevantCardIds.filter(id => !injuredIds.has(id))
      : [];
    onConfirm(available);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-gray-900 rounded-2xl p-8 flex items-center gap-3 text-white">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>Controllo infortuni...</span>
        </div>
      </div>
    );
  }

  if (injured.length === 0) {
    // No injured cards in this deck — skip the disclaimer automatically
    // (call onConfirm with all relevant card IDs)
    setTimeout(() => onConfirm(relevantCardIds || []), 0);
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 border border-red-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-900/60 to-red-800/40 px-6 py-4 border-b border-red-500/30">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🩹</span>
            <div>
              <h2 className="text-white font-bold text-lg">Personaggi Infortunati</h2>
              <p className="text-red-300 text-xs">
                Questi personaggi sono fuori combattimento per una partita.
                Puoi riscattarli pagando {REVIVE_COST} Rankiard ciascuno.
              </p>
            </div>
          </div>
        </div>

        {/* Credits */}
        <div className="px-6 pt-4 pb-2 flex items-center justify-between">
          <span className="text-white/60 text-sm">I tuoi Rankiard:</span>
          <span className="text-yellow-400 font-bold text-sm">⭐ {localCredits}</span>
        </div>

        {/* Card list */}
        <div className="px-6 pb-4 space-y-3 max-h-64 overflow-y-auto">
          {injured.map(card => {
            const canRevive = localCredits >= REVIVE_COST;
            const isReviving = reviving.has(card.cardId);
            return (
              <div
                key={card.cardId}
                className="flex items-center gap-3 bg-black/40 rounded-xl p-3 border border-red-500/20"
              >
                {/* Card thumbnail */}
                <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800 border border-white/10">
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      className="w-full h-full object-cover opacity-50"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl opacity-40">🃏</div>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{card.name}</p>
                  <p className="text-red-400 text-xs mt-0.5">⛔ Non disponibile per 1 partita</p>
                </div>
                {/* Revive button */}
                <button
                  onClick={() => handleRevive(card.cardId)}
                  disabled={!canRevive || isReviving}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all
                    ${canRevive && !isReviving
                      ? 'bg-yellow-500 hover:bg-yellow-400 text-black cursor-pointer'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                >
                  {isReviving ? '...' : `⭐ ${REVIVE_COST}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Disclaimer note */}
        <div className="mx-6 mb-4 bg-orange-900/30 border border-orange-500/30 rounded-xl p-3">
          <p className="text-orange-300 text-xs text-center">
            ⚠️ I personaggi infortunati verranno rimossi dal tuo mazzo per questa partita. Torneranno disponibili automaticamente nella partita successiva.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-semibold text-sm transition-all"
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all"
          >
            Continua senza di loro →
          </button>
        </div>
      </div>
    </div>
  );
}
