import React, { useEffect, useState } from 'react';
import { Layers, Check, RotateCcw, X } from 'lucide-react';

interface DraftPreset {
  id: number;
  presetName: string;
  personaggiCards: string[];
  mosseCards: string[];
  bonusCards: string[];
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export const DeckSelectDialog: React.FC<Props> = ({ open, onClose, onConfirm }) => {
  const [presets, setPresets] = useState<DraftPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPreset, setLoadingPreset] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null); // null = mazzo corrente
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setError(null);
    setLoading(true);
    fetch('/api/draft/deck/presets', { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then((data: DraftPreset[]) => {
        setPresets(data);
        // If no presets, skip dialog and confirm immediately
        if (!data || data.length === 0) {
          onConfirm();
        }
      })
      .catch(() => setPresets([]))
      .finally(() => setLoading(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  if (loading) return null; // silent while loading

  // If no presets after load, we already called onConfirm — don't render
  if (presets.length === 0) return null;

  const handleConfirm = async () => {
    if (selectedId === null) {
      // Use current active deck
      onConfirm();
      return;
    }
    setLoadingPreset(true);
    setError(null);
    try {
      const res = await fetch(`/api/draft/deck/load-preset/${selectedId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Errore nel caricamento del mazzo');
        return;
      }
      onConfirm();
    } catch {
      setError('Errore di rete');
    } finally {
      setLoadingPreset(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-white/15 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-400" />
            <h3 className="text-white font-bold text-base">Scegli il mazzo</h3>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-white/50 text-xs mb-4">Seleziona il mazzo da usare in questa partita Draft.</p>

        {/* Options */}
        <div className="space-y-2 mb-4">
          {/* Mazzo corrente */}
          <button
            onClick={() => setSelectedId(null)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
              selectedId === null
                ? 'border-teal-500/60 bg-teal-900/30'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedId === null ? 'border-teal-400 bg-teal-500' : 'border-white/30'}`}>
              {selectedId === null && <Check className="w-3 h-3 text-white" />}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Mazzo corrente</p>
              <p className="text-white/40 text-xs">Il mazzo attivo nel tuo profilo Draft</p>
            </div>
          </button>

          {/* Presets */}
          {presets.map(preset => (
            <button
              key={preset.id}
              onClick={() => setSelectedId(preset.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                selectedId === preset.id
                  ? 'border-teal-500/60 bg-teal-900/30'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedId === preset.id ? 'border-teal-400 bg-teal-500' : 'border-white/30'}`}>
                {selectedId === preset.id && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{preset.presetName}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-purple-300 text-xs">{(preset.personaggiCards || []).length} pers.</span>
                  <span className="text-red-300 text-xs">{(preset.mosseCards || []).length} mosse</span>
                  <span className="text-cyan-300 text-xs">{(preset.bonusCards || []).length} bonus</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <p className="text-red-400 text-xs mb-3 text-center">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white/60 font-semibold rounded-xl text-sm transition-all"
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            disabled={loadingPreset}
            className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
          >
            {loadingPreset ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                Caricamento...
              </>
            ) : (
              'Gioca con questo mazzo'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
