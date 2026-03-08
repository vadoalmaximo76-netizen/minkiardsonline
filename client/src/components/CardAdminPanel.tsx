import React, { useState, useEffect, useCallback } from 'react';
import { AddCardsModal } from './AddCardsModal';
import { AdminTooltipsPanel } from './AdminTooltipsPanel';
import { OcrReviewPanel } from './OcrReviewPanel';
import { DraftCostEditorPanel } from './DraftCostEditorPanel';
import { Button } from './ui/button';
import { Info, Eye, Coins, Check, X, Zap, ListOrdered } from 'lucide-react';

interface CardAdminPanelProps {
  onBack: () => void;
}

interface PurchaseRecord {
  id: number;
  userId: number;
  packageId: string;
  creditsAmount: number;
  priceEur: number;
  status: string;
  paymentNote: string | null;
  adminNote: string | null;
  createdAt: string;
  email?: string;
}

function AdminDraftCreditsPanel({ onClose }: { onClose: () => void }) {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const authToken = localStorage.getItem('authToken');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/draft/purchases', { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) {
        const data = await res.json();
        setPurchases(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: number) => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/draft/purchases/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) { setMsg('Approvato!'); load(); }
      else { const d = await res.json(); setMsg(d.error || 'Errore'); }
    } finally { setProcessing(null); setTimeout(() => setMsg(null), 3000); }
  };

  const reject = async (id: number) => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/draft/purchases/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNote: 'Rifiutato dall\'admin' })
      });
      if (res.ok) { setMsg('Rifiutato.'); load(); }
      else { const d = await res.json(); setMsg(d.error || 'Errore'); }
    } finally { setProcessing(null); setTimeout(() => setMsg(null), 3000); }
  };

  const pending = purchases.filter(p => p.status === 'pending');
  const processed = purchases.filter(p => p.status !== 'pending');

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg flex items-center gap-2"><Coins className="w-5 h-5 text-teal-400" />Acquisti Crediti Draft</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X /></button>
        </div>
        {msg && <div className="bg-green-800/60 text-green-200 text-sm rounded px-3 py-2 mb-3">{msg}</div>}
        {loading ? (
          <div className="text-center text-white/40 py-8">Caricamento...</div>
        ) : (
          <>
            <div className="mb-4">
              <h3 className="text-teal-300 font-semibold text-sm mb-2">In attesa ({pending.length})</h3>
              {pending.length === 0 ? (
                <p className="text-white/30 text-sm">Nessuna richiesta in attesa</p>
              ) : pending.map(p => (
                <div key={p.id} className="bg-white/5 border border-amber-500/30 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="text-white font-medium text-sm">ID {p.id} — {p.creditsAmount.toLocaleString()} crediti — €{Number(p.priceEur).toFixed(2)}</div>
                      <div className="text-white/50 text-xs">Utente #{p.userId} • {new Date(p.createdAt).toLocaleDateString('it-IT')}</div>
                      {p.paymentNote && <div className="text-white/60 text-xs mt-1">Nota: {p.paymentNote}</div>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => approve(p.id)}
                        disabled={processing === p.id}
                        className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />Approva
                      </button>
                      <button
                        onClick={() => reject(p.id)}
                        disabled={processing === p.id}
                        className="flex items-center gap-1 bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />Rifiuta
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {processed.length > 0 && (
              <div>
                <h3 className="text-white/60 font-semibold text-sm mb-2">Processati ({processed.length})</h3>
                {processed.map(p => (
                  <div key={p.id} className="bg-white/5 border border-white/10 rounded-lg p-3 mb-2 opacity-70">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm">ID {p.id} — {p.creditsAmount.toLocaleString()} crediti</div>
                        <div className="text-white/40 text-xs">{new Date(p.createdAt).toLocaleDateString('it-IT')}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${p.status === 'approved' ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'}`}>
                        {p.status === 'approved' ? 'Approvato' : 'Rifiutato'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface AutoCostResult {
  updated: number;
  skipped: number;
  byType: Record<string, number>;
}

export function CardAdminPanel({ onBack }: CardAdminPanelProps) {
  const [showTooltipsPanel, setShowTooltipsPanel] = useState(false);
  const [showOcrPanel, setShowOcrPanel] = useState(false);
  const [showCreditsPanel, setShowCreditsPanel] = useState(false);
  const [showDraftCostEditor, setShowDraftCostEditor] = useState(false);
  const [showAutoCostDialog, setShowAutoCostDialog] = useState(false);
  const [autoCostOverride, setAutoCostOverride] = useState(false);
  const [autoCostRunning, setAutoCostRunning] = useState(false);
  const [autoCostResult, setAutoCostResult] = useState<AutoCostResult | null>(null);
  const [autoCostError, setAutoCostError] = useState<string | null>(null);
  const authToken = localStorage.getItem('authToken');

  const runAutoCost = async () => {
    setAutoCostRunning(true);
    setAutoCostResult(null);
    setAutoCostError(null);
    try {
      const res = await fetch('/api/admin/auto-assign-draft-costs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrideExisting: autoCostOverride }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAutoCostResult(data);
      } else {
        setAutoCostError(data.error || 'Errore sconosciuto');
      }
    } catch (e: any) {
      setAutoCostError(e.message || 'Errore di rete');
    } finally {
      setAutoCostRunning(false);
    }
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-[60] flex gap-2 flex-wrap justify-end">
        <Button
          onClick={() => setShowDraftCostEditor(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          size="sm"
        >
          <ListOrdered size={16} className="mr-1" /> Editor Costi Draft
        </Button>
        <Button
          onClick={() => { setShowAutoCostDialog(true); setAutoCostResult(null); setAutoCostError(null); }}
          className="bg-orange-600 hover:bg-orange-700 text-white"
          size="sm"
        >
          <Zap size={16} className="mr-1" /> Costi Draft Auto
        </Button>
        <Button
          onClick={() => setShowCreditsPanel(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white"
          size="sm"
        >
          <Coins size={16} className="mr-1" /> Crediti Draft
        </Button>
        <Button
          onClick={() => setShowOcrPanel(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          size="sm"
        >
          <Eye size={16} className="mr-1" /> OCR BONUS
        </Button>
        <Button
          onClick={() => setShowTooltipsPanel(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white"
          size="sm"
        >
          <Info size={16} className="mr-1" /> Tooltip Contestuali
        </Button>
      </div>
      <AddCardsModal 
        isOpen={true} 
        onClose={onBack} 
      />
      {showTooltipsPanel && (
        <AdminTooltipsPanel
          onClose={() => setShowTooltipsPanel(false)}
        />
      )}
      {showOcrPanel && (
        <OcrReviewPanel
          isOpen={showOcrPanel}
          onClose={() => setShowOcrPanel(false)}
          authToken={authToken || ''}
        />
      )}
      {showCreditsPanel && (
        <AdminDraftCreditsPanel
          onClose={() => setShowCreditsPanel(false)}
        />
      )}
      {showDraftCostEditor && (
        <DraftCostEditorPanel
          onClose={() => setShowDraftCostEditor(false)}
        />
      )}
      {showAutoCostDialog && (
        <div className="fixed inset-0 bg-black/80 z-[75] flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-400" /> Auto-assegna Costi Draft
              </h2>
              <button onClick={() => setShowAutoCostDialog(false)} className="text-white/50 hover:text-white">
                <X />
              </button>
            </div>
            {!autoCostResult ? (
              <>
                <p className="text-white/70 text-sm mb-4">
                  Calcola e salva automaticamente un costo draft (1–100) per ogni carta in base alla sua potenza.
                  I personaggi usano PTI e stelle, le mosse usano il danno e gli effetti speciali, le bonus usano il testo dell'effetto.
                </p>
                <label className="flex items-center gap-2 text-white/80 text-sm mb-5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCostOverride}
                    onChange={e => setAutoCostOverride(e.target.checked)}
                    className="w-4 h-4 accent-orange-500"
                  />
                  Sovrascrivi costi già impostati manualmente
                </label>
                {autoCostError && (
                  <div className="bg-red-900/50 text-red-300 text-sm rounded px-3 py-2 mb-3">{autoCostError}</div>
                )}
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAutoCostDialog(false)}
                    className="border-white/20 text-white/70"
                  >
                    Annulla
                  </Button>
                  <Button
                    size="sm"
                    onClick={runAutoCost}
                    disabled={autoCostRunning}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {autoCostRunning ? 'Elaborazione...' : 'Avvia'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-green-900/40 border border-green-500/30 rounded-xl p-4 mb-4">
                  <div className="text-green-300 font-bold text-base mb-2 flex items-center gap-2">
                    <Check className="w-4 h-4" /> Completato!
                  </div>
                  <div className="text-white text-sm mb-1">
                    <span className="font-semibold text-orange-300">{autoCostResult.updated}</span> costi assegnati,{' '}
                    <span className="text-white/50">{autoCostResult.skipped}</span> saltate
                  </div>
                  <div className="text-white/60 text-xs mt-2 space-y-0.5">
                    {Object.entries(autoCostResult.byType).map(([type, count]) => (
                      <div key={type}>• {type}: {count} carte</div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => setShowAutoCostDialog(false)}
                    className="bg-gray-600 hover:bg-gray-500 text-white"
                  >
                    Chiudi
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
