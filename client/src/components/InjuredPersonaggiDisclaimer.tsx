import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CARD_DATA } from '../lib/cardData';

type CardDataKey = keyof typeof CARD_DATA;

function getCardDataUrlsLocal(key: string): string[] | undefined {
  if (key in CARD_DATA) return CARD_DATA[key as CardDataKey] as string[];
  return undefined;
}

function getCardImageFromIdLocal(cardId: string): string {
  if (cardId.startsWith('custom-')) {
    const num = cardId.replace('custom-', '');
    return `/api/card-image/${num}`;
  }
  const parts = cardId.split('-');
  const idx = parseInt(parts[parts.length - 1]);
  const deckKey = parts.slice(0, parts.length - 1).join('_');
  const mappedKey = deckKey === 'personaggi_speciali' ? 'personaggi_speciali' : deckKey;
  const urls = getCardDataUrlsLocal(mappedKey);
  if (urls && !isNaN(idx) && idx >= 0 && idx < urls.length) return urls[idx];
  return '';
}

/**
 * Draft card IDs have format: "personaggi-5-abc123"
 * Base card IDs (as stored in injured_personaggi) have format: "personaggi-5"
 * This function extracts the base ID from a draft ID.
 */
function extractBaseId(cardId: string): string {
  // Match pattern: prefix-number-randomSuffix  (e.g. "personaggi-5-abc123" → "personaggi-5")
  const match = cardId.match(/^(.+?-\d+)-[a-z0-9]{4,}$/i);
  return match ? match[1] : cardId;
}

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
const FETCH_TIMEOUT_MS = 8_000;

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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reviving, setReviving] = useState<Set<string>>(new Set());
  const [localCredits, setLocalCredits] = useState(userCredits);

  // Guard: prevent onConfirm from being called more than once (fixes double-game creation crash)
  const confirmedRef = useRef(false);

  const fetchInjured = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch('/api/injured-personaggi', {
        headers: { Authorization: `Bearer ${authToken}` },
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.success) {
        let list: InjuredCard[] = data.injured || [];
        if (relevantCardIds && relevantCardIds.length > 0) {
          // relevantCardIds may contain draft IDs (e.g. "personaggi-5-abc123")
          // injuries are stored with base IDs (e.g. "personaggi-5")
          // so we match exactly OR by prefix (extractBaseId)
          const relevantExact = new Set(relevantCardIds);
          const relevantBases = new Set(relevantCardIds.map(extractBaseId));
          list = list.filter(c => relevantExact.has(c.cardId) || relevantBases.has(c.cardId));
        }
        setInjured(list);
      } else {
        // DB unavailable or other server error — do NOT silently bypass
        setFetchError(data.error === 'db_unavailable'
          ? 'Impossibile verificare lo stato degli infortuni, riprova tra poco.'
          : (data.error || 'Errore nel recupero degli infortuni.'));
        setInjured([]);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setFetchError('La verifica degli infortuni ha impiegato troppo tempo. Riprova.');
      } else {
        setFetchError('Errore di rete. Impossibile verificare lo stato degli infortuni.');
      }
      setInjured([]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [authToken, relevantCardIds]);

  useEffect(() => {
    fetchInjured();
  }, [fetchInjured]);

  useEffect(() => {
    setLocalCredits(userCredits);
  }, [userCredits]);

  // Auto-confirm (skip disclaimer) ONLY when: fetch succeeded, loading done, and no injuries found.
  // Never auto-confirm when a fetch error occurred.
  useEffect(() => {
    if (!loading && !fetchError && injured.length === 0 && !confirmedRef.current) {
      confirmedRef.current = true;
      onConfirm(relevantCardIds || []);
    }
  }, [loading, fetchError, injured.length, onConfirm, relevantCardIds]);

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
    // injured.cardId are base IDs (e.g. "personaggi-5")
    // relevantCardIds may be draft IDs (e.g. "personaggi-5-abc123")
    // Exclude a card if its base ID (or exact ID) is in the injured set
    const injuredBaseIds = new Set(injured.map(c => c.cardId));
    const available = relevantCardIds
      ? relevantCardIds.filter(id => {
          const base = extractBaseId(id);
          return !injuredBaseIds.has(id) && !injuredBaseIds.has(base);
        })
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

  if (fetchError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="bg-gray-900 border border-yellow-500/40 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden p-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-3xl">⚠️</span>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Controllo infortuni</h2>
              <p className="text-yellow-300 text-sm mt-1 leading-relaxed">{fetchError}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white/80 font-semibold text-sm transition-all"
            >
              ← Indietro
            </button>
            <button
              onClick={fetchInjured}
              className="flex-1 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-sm transition-all"
            >
              Riprova
            </button>
          </div>
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

        {/* Visual roster grid — all deck cards, injured ones in grayscale */}
        {relevantCardIds && relevantCardIds.length > 0 && (
          <div className="px-6 pt-3 pb-2">
            <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-2">Il tuo mazzo per questa partita</p>
            <div className="flex flex-wrap gap-2">
              {relevantCardIds.map((cardId, idx) => {
                const baseId = extractBaseId(cardId);
                const injuredEntry = injured.find(c => c.cardId === cardId || c.cardId === baseId);
                const isInjured = !!injuredEntry;
                const imgUrl = injuredEntry?.imageUrl || getCardImageFromIdLocal(cardId);
                return (
                  <div
                    key={`${cardId}-${idx}`}
                    className="relative flex-shrink-0"
                    style={{ width: 38, height: 54 }}
                    title={injuredEntry ? `${injuredEntry.name} — Infortunato` : cardId}
                  >
                    <div className="w-full h-full rounded-md overflow-hidden border border-white/10" style={{ filter: isInjured ? 'grayscale(100%)' : 'none', opacity: isInjured ? 0.5 : 1 }}>
                      {imgUrl ? (
                        <img src={imgUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <span className="text-xs opacity-30">?</span>
                        </div>
                      )}
                    </div>
                    {isInjured && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/20">
                        <span style={{ fontSize: 16, lineHeight: 1 }}>🩹</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
