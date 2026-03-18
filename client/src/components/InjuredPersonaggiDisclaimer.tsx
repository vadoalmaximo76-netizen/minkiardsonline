import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface InjuredCard {
  cardId: string;
  name: string;
  imageUrl: string | null;
  gamesRemaining: number;
}

interface Props {
  authToken: string;
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

  // Guard: prevent onConfirm from being called more than once (fixes double-game creation crash)
  const confirmedRef = useRef(false);

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

  // Auto-confirm (skip disclaimer) when there are no injured cards — called only once via ref guard
  useEffect(() => {
    if (!loading && injured.length === 0 && !confirmedRef.current) {
      confirmedRef.current = true;
      onConfirm(relevantCardIds || []);
    }
  }, [loading, injured.length, onConfirm, relevantCardIds]);

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
    if (confirmedRef.current) return;
    confirmedRef.current = true;
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
    return null;
  }

  const availableCount = (relevantCardIds?.length ?? 0) - injured.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-gray-900 border border-red-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-red-950/80 to-red-900/50 px-6 py-5 border-b border-red-500/30">
          <div className="flex items-start gap-3">
            <span className="text-3xl mt-0.5">🩹</span>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Personaggi Infortunati</h2>
              <p className="text-red-300 text-sm mt-1 leading-relaxed">
                Questi personaggi sono <strong>morti nell'ultima partita</strong> e non possono scendere in campo oggi.
                Torneranno disponibili automaticamente nella partita successiva.
              </p>
            </div>
          </div>
        </div>

        {/* Credits bar */}
        <div className="px-6 pt-4 pb-2 flex items-center justify-between">
          <span className="text-white/50 text-xs">I tuoi Rankiard disponibili:</span>
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
                {/* Card thumbnail — grayscale to show "unavailable" */}
                <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800 border border-white/10 relative">
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      className="w-full h-full object-cover grayscale opacity-60"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">🃏</div>
                  )}
                  {/* Dead overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="text-base">💀</span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{card.name}</p>
                  <p className="text-red-400 text-xs mt-0.5">⛔ Fuori per questa partita</p>
                  <p className="text-white/35 text-[10px] mt-0.5">Morto nell'ultima battaglia</p>
                </div>

                {/* Revive button */}
                <div className="flex-shrink-0 text-right">
                  <button
                    onClick={() => handleRevive(card.cardId)}
                    disabled={!canRevive || isReviving}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all
                      ${canRevive && !isReviving
                        ? 'bg-yellow-500 hover:bg-yellow-400 text-black cursor-pointer shadow-lg shadow-yellow-500/20'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                  >
                    {isReviving ? (
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      </span>
                    ) : (
                      <>⭐ {REVIVE_COST} — Riscatta</>
                    )}
                  </button>
                  {!canRevive && (
                    <p className="text-red-500/70 text-[10px] mt-1">Rankiard insuff.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary note */}
        <div className="mx-6 mb-4 bg-gray-800/60 border border-white/10 rounded-xl p-3">
          <p className="text-white/60 text-xs text-center leading-relaxed">
            {availableCount > 0
              ? `Il tuo mazzo per questa partita avrà ${availableCount} personaggi disponibili (${injured.length} esclus${injured.length === 1 ? 'o' : 'i'}).`
              : `Tutti i tuoi personaggi sono infortunati. Riscattane almeno uno o usa un mazzo alternativo.`}
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white/80 font-semibold text-sm transition-all"
          >
            ← Indietro
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all"
          >
            Gioca senza di loro →
          </button>
        </div>
      </div>
    </div>
  );
}
