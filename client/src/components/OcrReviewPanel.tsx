import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { X, Check, SkipForward, Eye, Loader2 } from 'lucide-react';

interface PendingCard {
  cardId: string;
  cardName: string;
  imageUrl: string;
  ocrText: string;
  ocrConfidence: number;
  currentEffect: string | null;
}

interface OcrReviewPanelProps {
  onClose: () => void;
}

export function OcrReviewPanel({ onClose }: OcrReviewPanelProps) {
  const [pending, setPending] = useState<PendingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [approving, setApproving] = useState<string | null>(null);
  const [ocrRunning, setOcrRunning] = useState(false);

  const authToken = localStorage.getItem('authToken');

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ocr-pending-review', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setPending(data.pending);
      }
    } catch (err) {
      console.error('Failed to fetch OCR pending:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (cardId: string, text?: string) => {
    setApproving(cardId);
    try {
      const res = await fetch('/api/admin/ocr-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ cardId, approvedText: text }),
      });
      const data = await res.json();
      if (data.success) {
        setPending(prev => prev.filter(p => p.cardId !== cardId));
        setEditingId(null);
      }
    } catch (err) {
      console.error('Failed to approve:', err);
    }
    setApproving(null);
  };

  const handleBulkApprove = async () => {
    if (!confirm(`Approvare tutti i ${pending.length} testi OCR? Questa azione non può essere annullata.`)) return;
    setOcrRunning(true);
    for (const card of pending) {
      await handleApprove(card.cardId);
    }
    setOcrRunning(false);
  };

  const handleRunOcr = async () => {
    setOcrRunning(true);
    try {
      const res = await fetch('/api/admin/ocr-bonus-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setTimeout(() => {
          fetchPending();
          setOcrRunning(false);
        }, 5000);
      } else {
        alert(data.error || 'OCR fallito');
        setOcrRunning(false);
      }
    } catch (err) {
      console.error('OCR failed:', err);
      setOcrRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">
            OCR Revisione BONUS ({pending.length} in attesa)
          </h2>
          <div className="flex gap-2">
            {pending.length > 0 && (
              <Button
                onClick={handleBulkApprove}
                disabled={ocrRunning}
                className="bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                <Check size={14} className="mr-1" /> Approva Tutti
              </Button>
            )}
            <Button
              onClick={handleRunOcr}
              disabled={ocrRunning}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              {ocrRunning ? (
                <><Loader2 size={14} className="mr-1 animate-spin" /> OCR in corso...</>
              ) : (
                <><Eye size={14} className="mr-1" /> Avvia OCR</>
              )}
            </Button>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-white" size={32} />
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              Nessuna carta BONUS in attesa di revisione OCR.
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map(card => (
                <div key={card.cardId} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-start gap-3">
                    {card.imageUrl && (
                      <img
                        src={card.imageUrl}
                        alt={card.cardName}
                        className="w-16 h-20 object-cover rounded border border-gray-600 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-bold text-white">{card.cardName}</span>
                        <span className="text-xs text-gray-500 font-mono">{card.cardId}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          card.ocrConfidence >= 50 ? 'bg-green-600/30 text-green-400' :
                          card.ocrConfidence >= 30 ? 'bg-yellow-600/30 text-yellow-400' :
                          'bg-red-600/30 text-red-400'
                        }`}>
                          {card.ocrConfidence.toFixed(0)}%
                        </span>
                      </div>
                      {editingId === card.cardId ? (
                        <div className="space-y-2">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full bg-gray-900 text-white border border-gray-600 rounded p-2 text-sm min-h-[60px]"
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleApprove(card.cardId, editText)}
                              disabled={approving === card.cardId}
                              className="bg-green-600 hover:bg-green-700 text-white"
                              size="sm"
                            >
                              Salva
                            </Button>
                            <Button
                              onClick={() => setEditingId(null)}
                              variant="outline"
                              size="sm"
                            >
                              Annulla
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-300">{card.ocrText}</p>
                      )}
                    </div>
                    {editingId !== card.cardId && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          onClick={() => handleApprove(card.cardId)}
                          disabled={approving === card.cardId}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          size="sm"
                          title="Approva testo OCR"
                        >
                          {approving === card.cardId ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        </Button>
                        <Button
                          onClick={() => { setEditingId(card.cardId); setEditText(card.ocrText); }}
                          variant="outline"
                          size="sm"
                          title="Modifica prima di approvare"
                        >
                          Modifica
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
