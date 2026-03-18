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
  const [selectedId, setSelectedId] = useState<number | null>(null);
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
        if (!data || data.length === 0) {
          onConfirm();
        }
      })
      .catch(() => setPresets([]))
      .finally(() => setLoading(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  if (loading) return null;
  if (presets.length === 0) return null;

  const handleConfirm = async () => {
    if (selectedId === null) {
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
      <div className="bg-black/85 backdrop-blur-xl border border-violet-500/30 rounded-2xl p-5 w-full max-w-sm shadow-[0_0_40px_rgba(124,58,237,0.25)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Layers className="w-4 h-4 text-cyan-400" />
            </div>
            <h3 className="text-white font-bold text-base">Scegli il mazzo</h3>
          </div>
          <button onClick={onClose} className="text-violet-400/50 hover:text-violet-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-violet-400/50 text-xs mb-4">Seleziona il mazzo da usare in questa partita Draft.</p>

        {/* Options */}
        <div className="space-y-2 mb-4">
          <button
            onClick={() => setSelectedId(null)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
              selectedId === null
                ? 'border-cyan-500/50 bg-cyan-900/20 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-violet-500/20'
            }`}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedId === null ? 'border-cyan-400 bg-cyan-500' : 'border-white/30'}`}>
              {selectedId === null && <Check className="w-3 h-3 text-white" />}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Mazzo corrente</p>
              <p className="text-violet-400/50 text-xs">Il mazzo attivo nel tuo profilo Draft</p>
            </div>
          </button>

          {presets.map(preset => (
            <button
              key={preset.id}
              onClick={() => setSelectedId(preset.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                selectedId === preset.id
                  ? 'border-violet-500/50 bg-violet-900/20 shadow-[0_0_10px_rgba(124,58,237,0.15)]'
                  : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-violet-500/20'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedId === preset.id ? 'border-violet-400 bg-violet-500' : 'border-white/30'}`}>
                {selectedId === preset.id && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{preset.presetName}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-violet-400 text-xs">{(preset.personaggiCards || []).length} pers.</span>
                  <span className="text-red-400 text-xs">{(preset.mosseCards || []).length} mosse</span>
                  <span className="text-cyan-400 text-xs">{(preset.bonusCards || []).length} bonus</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <p className="text-red-400 text-xs mb-3 text-center bg-red-900/20 border border-red-500/20 rounded-xl p-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-violet-300/60 font-semibold rounded-xl text-sm transition-all border border-white/10"
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            disabled={loadingPreset}
            className="flex-1 py-2.5 bg-gradient-to-r from-cyan-700 to-teal-700 hover:from-cyan-600 hover:to-teal-600 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
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
