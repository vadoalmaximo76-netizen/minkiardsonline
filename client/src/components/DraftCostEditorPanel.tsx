import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Search } from 'lucide-react';

interface CardEntry {
  id: string;
  type: string;
  name: string;
  draftCost: number;
  deckType?: string;
  imageUrl?: string | null;
  pti?: number | null;
  stars?: number | null;
  effect?: string | null;
  audioUrl?: string | null;
  attackLowAudioUrl?: string | null;
  attackHighAudioUrl?: string | null;
  youtubeUrl?: string | null;
  mosseDamageValue?: number | null;
  mosseDamageEffect?: string | null;
  mosseCharacterOverrides?: any;
  mosseRestrictedFrom?: any;
  mosseRestrictedAgainst?: any;
  mosseTargetingMode?: string | null;
  mosseTargetCount?: number | null;
  mosseCanCounter?: boolean;
  mosseCanBeCountered?: boolean;
  evolvesInto?: string | null;
  evolutionVariants?: any;
  transformsInto?: string | null;
  transformsFrom?: string | null;
  cheatsInto?: string | null;
  specialCategory?: string | null;
  evolvedMoves?: any;
  superAttacco?: any;
}

interface DraftCostEditorPanelProps {
  onClose: () => void;
}

type FilterType = 'all' | 'personaggi' | 'mosse' | 'bonus';

const TYPE_LABEL: Record<string, string> = {
  personaggi: 'PER',
  mosse: 'MOS',
  bonus: 'BON',
};

const TYPE_COLOR: Record<string, string> = {
  personaggi: 'bg-blue-700 text-blue-100',
  mosse: 'bg-red-800 text-red-100',
  bonus: 'bg-amber-700 text-amber-100',
};

export function DraftCostEditorPanel({ onClose }: DraftCostEditorPanelProps) {
  const [cards, setCards] = useState<CardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftEdits, setDraftEdits] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const authToken = localStorage.getItem('authToken');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/cards', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setCards(data.cards || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [authToken]);

  const filtered = useMemo(() => {
    return cards.filter(c => {
      if (filter !== 'all' && c.type !== filter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!c.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [cards, filter, search]);

  const changedCount = Object.keys(draftEdits).length;

  const handleChange = (cardId: string, value: string) => {
    const num = parseInt(value);
    if (isNaN(num)) return;
    const clamped = Math.max(0, Math.min(999, num));
    setDraftEdits(prev => ({ ...prev, [cardId]: clamped }));
  };

  const handleSave = async () => {
    if (changedCount === 0) return;
    setSaving(true);
    setMsg(null);
    try {
      const modifications = cards
        .filter(c => draftEdits[c.id] !== undefined)
        .map(c => ({
          originalCardId: c.id,
          deckType: c.deckType ?? c.type,
          name: c.name ?? null,
          imageUrl: c.imageUrl ?? null,
          pti: c.pti ?? null,
          stars: c.stars ?? null,
          effect: c.effect ?? null,
          audioUrl: c.audioUrl ?? null,
          attackLowAudioUrl: c.attackLowAudioUrl ?? null,
          attackHighAudioUrl: c.attackHighAudioUrl ?? null,
          youtubeUrl: c.youtubeUrl ?? null,
          mosseDamageValue: c.mosseDamageValue ?? null,
          mosseDamageEffect: c.mosseDamageEffect ?? null,
          mosseCharacterOverrides: c.mosseCharacterOverrides ?? null,
          mosseRestrictedFrom: c.mosseRestrictedFrom ?? null,
          mosseRestrictedAgainst: c.mosseRestrictedAgainst ?? null,
          mosseTargetingMode: c.mosseTargetingMode ?? null,
          mosseTargetCount: c.mosseTargetCount ?? null,
          mosseCanCounter: c.mosseCanCounter ?? false,
          mosseCanBeCountered: c.mosseCanBeCountered ?? false,
          evolvesInto: c.evolvesInto ?? null,
          evolutionVariants: c.evolutionVariants ?? null,
          transformsInto: c.transformsInto ?? null,
          transformsFrom: c.transformsFrom ?? null,
          cheatsInto: c.cheatsInto ?? null,
          specialCategory: c.specialCategory ?? null,
          evolvedMoves: c.evolvedMoves ?? null,
          superAttacco: c.superAttacco ?? null,
          draftCost: draftEdits[c.id],
        }));

      const res = await fetch('/api/admin/card-modifications-bulk', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ modifications }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCards(prev =>
          prev.map(c =>
            draftEdits[c.id] !== undefined ? { ...c, draftCost: draftEdits[c.id] } : c
          )
        );
        setDraftEdits({});
        setMsg({ type: 'success', text: `✓ Salvati ${data.count} costi draft` });
      } else {
        setMsg({ type: 'error', text: data.error || 'Errore durante il salvataggio' });
      }
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Errore di rete' });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const filterBtn = (f: FilterType, label: string) => (
    <button
      key={f}
      onClick={() => setFilter(f)}
      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
        filter === f
          ? 'bg-indigo-600 text-white'
          : 'bg-white/10 text-white/60 hover:bg-white/20'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/85 z-[80] flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-white font-bold text-base">Editor Costi Draft</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-white/10 flex-shrink-0">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              placeholder="Cerca carta..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-white text-xs placeholder-white/30 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-1.5">
            {filterBtn('all', 'Tutti')}
            {filterBtn('personaggi', 'Personaggi')}
            {filterBtn('mosse', 'Mosse')}
            {filterBtn('bonus', 'Bonus')}
          </div>
          <button
            onClick={handleSave}
            disabled={changedCount === 0 || saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              changedCount > 0 && !saving
                ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Salvataggio...' : `Salva${changedCount > 0 ? ` (${changedCount})` : ''}`}
          </button>
        </div>

        {msg && (
          <div
            className={`mx-5 mt-3 text-xs rounded-lg px-3 py-2 flex-shrink-0 ${
              msg.type === 'success'
                ? 'bg-green-900/60 text-green-300 border border-green-500/30'
                : 'bg-red-900/60 text-red-300 border border-red-500/30'
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="text-center text-white/30 py-16 text-sm">Caricamento carte...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-white/30 py-16 text-sm">Nessuna carta trovata</div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-900">
                  <th className="text-left text-white/40 text-xs font-semibold py-2 pr-3 w-12">Tipo</th>
                  <th className="text-left text-white/40 text-xs font-semibold py-2 pr-3">Nome</th>
                  <th className="text-right text-white/40 text-xs font-semibold py-2 w-28">Costo Draft</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(card => {
                  const currentVal = draftEdits[card.id] !== undefined ? draftEdits[card.id] : (card.draftCost ?? 0);
                  const isEdited = draftEdits[card.id] !== undefined;
                  return (
                    <tr
                      key={card.id}
                      className={`border-b border-white/5 ${isEdited ? 'bg-indigo-900/20' : 'hover:bg-white/5'}`}
                    >
                      <td className="py-1.5 pr-3">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${TYPE_COLOR[card.type] ?? 'bg-gray-700 text-white'}`}>
                          {TYPE_LABEL[card.type] ?? card.type.slice(0, 3).toUpperCase()}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-white text-xs max-w-[280px] truncate" title={card.name}>
                        {card.name || card.id}
                      </td>
                      <td className="py-1.5 text-right">
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={currentVal}
                          onChange={e => handleChange(card.id, e.target.value)}
                          className={`w-20 text-right bg-gray-800 border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 ${
                            isEdited ? 'border-indigo-500' : 'border-white/10'
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-2 border-t border-white/10 flex-shrink-0 text-white/30 text-xs">
          {filtered.length} carte visualizzate
          {changedCount > 0 && <span className="text-indigo-400 ml-2">· {changedCount} modificate</span>}
        </div>
      </div>
    </div>
  );
}
