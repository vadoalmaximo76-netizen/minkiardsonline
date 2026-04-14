import React, { useState, useEffect, useCallback } from 'react';
import { X, SkipForward, RotateCcw, Trash2, Check, Loader2, FlaskConical } from 'lucide-react';
import { Button } from './ui/button';

interface StageInfo {
  id: number;
  orderIndex: number;
  name: string;
  gymName: string;
  isActive: boolean;
  completed: boolean;
}

interface StoryDeck {
  id: number;
  userId: number;
  cardIds: string[];
  chosenFaction: string | null;
  updatedAt: string;
}

interface Props {
  onClose: () => void;
}

export function AdminTestingPanel({ onClose }: Props) {
  const [leaders, setLeaders] = useState<StageInfo[]>([]);
  const [storyDeck, setStoryDeck] = useState<StoryDeck | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const authToken = localStorage.getItem('authToken');

  const showMsg = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };

  const fetchProgress = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/story-testing/progress', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setLeaders(data.leaders ?? []);
        setStoryDeck(data.storyDeck ?? null);
      } else {
        showMsg(data.error || 'Errore caricamento', false);
      }
    } catch {
      showMsg('Errore di rete', false);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  const skipToStage = async (gymLeaderId: number, gymName: string) => {
    if (!confirm(`Saltare a "${gymName}"? Tutti gli stage precedenti verranno marcati come completati e questo stage sarà resettato.`)) return;
    setActionLoading(`skip-${gymLeaderId}`);
    try {
      const res = await fetch(`/api/admin/story-testing/skip-to-stage/${gymLeaderId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        showMsg(`Saltato a "${gymName}" (${data.completed} stage precedenti completati)`, true);
        await fetchProgress();
      } else {
        showMsg(data.error || 'Errore', false);
      }
    } catch {
      showMsg('Errore di rete', false);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleStage = async (gymLeaderId: number) => {
    setActionLoading(`toggle-${gymLeaderId}`);
    try {
      const res = await fetch(`/api/admin/story-testing/toggle-stage/${gymLeaderId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setLeaders(prev => prev.map(l => l.id === gymLeaderId ? { ...l, completed: data.completed } : l));
      } else {
        showMsg(data.error || 'Errore', false);
      }
    } catch {
      showMsg('Errore di rete', false);
    } finally {
      setActionLoading(null);
    }
  };

  const resetProgress = async () => {
    if (!confirm('Azzerare tutto il progresso Story Mode? Tutti gli stage verranno marcati come non completati.')) return;
    setActionLoading('reset-progress');
    try {
      const res = await fetch('/api/admin/story-testing/reset-progress', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        showMsg('Progresso azzerato!', true);
        await fetchProgress();
      } else {
        showMsg(data.error || 'Errore', false);
      }
    } catch {
      showMsg('Errore di rete', false);
    } finally {
      setActionLoading(null);
    }
  };

  const resetDeck = async () => {
    if (!confirm('Eliminare il mazzo Story Mode? Dovrai riselezionare la fazione da capo.')) return;
    setActionLoading('reset-deck');
    try {
      const res = await fetch('/api/admin/story-testing/reset-deck', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        showMsg('Mazzo Story Mode eliminato!', true);
        await fetchProgress();
      } else {
        showMsg(data.error || 'Errore', false);
      }
    } catch {
      showMsg('Errore di rete', false);
    } finally {
      setActionLoading(null);
    }
  };

  const completedCount = leaders.filter(l => l.completed).length;

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-emerald-400" />
            Testing Story Mode
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X />
          </button>
        </div>

        {msg && (
          <div className={`text-sm rounded px-3 py-2 mb-3 ${msg.ok ? 'bg-green-800/60 text-green-200' : 'bg-red-800/60 text-red-200'}`}>
            {msg.text}
          </div>
        )}

        <div className="flex gap-2 mb-4 flex-wrap">
          <Button
            size="sm"
            onClick={resetProgress}
            disabled={actionLoading === 'reset-progress'}
            className="bg-red-700 hover:bg-red-600 text-white flex items-center gap-1.5"
          >
            {actionLoading === 'reset-progress'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RotateCcw className="w-3.5 h-3.5" />}
            Reset totale progress
          </Button>
          <Button
            size="sm"
            onClick={resetDeck}
            disabled={actionLoading === 'reset-deck'}
            className="bg-orange-700 hover:bg-orange-600 text-white flex items-center gap-1.5"
          >
            {actionLoading === 'reset-deck'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />}
            Reset mazzo Story Mode
          </Button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <span className="text-white/50 text-xs">
            Progressi: <span className="text-emerald-300 font-semibold">{completedCount}</span>/{leaders.length} stage completati
          </span>
          {storyDeck && (
            <span className="text-white/40 text-xs ml-2">
              • Fazione: <span className="text-yellow-300">{storyDeck.chosenFaction ?? 'nessuna'}</span>
              {' '}• Carte mazzo: <span className="text-blue-300">{Array.isArray(storyDeck.cardIds) ? storyDeck.cardIds.length : 0}</span>
            </span>
          )}
          {!storyDeck && !loading && (
            <span className="text-white/30 text-xs ml-2">• Nessun mazzo Story Mode</span>
          )}
        </div>

        {loading ? (
          <div className="text-center text-white/40 py-10 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Caricamento...
          </div>
        ) : leaders.length === 0 ? (
          <div className="text-center text-white/30 py-10 text-sm">Nessuno stage configurato</div>
        ) : (
          <div className="space-y-2">
            {leaders.map((leader) => {
              const isSkipping = actionLoading === `skip-${leader.id}`;
              const isToggling = actionLoading === `toggle-${leader.id}`;
              return (
                <div
                  key={leader.id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors ${
                    leader.completed
                      ? 'bg-emerald-900/20 border-emerald-500/30'
                      : 'bg-white/5 border-white/10'
                  } ${!leader.isActive ? 'opacity-50' : ''}`}
                >
                  <button
                    onClick={() => toggleStage(leader.id)}
                    disabled={!!actionLoading}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      leader.completed
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-white/30 hover:border-white/60'
                    }`}
                    title={leader.completed ? 'Segna come non completato' : 'Segna come completato'}
                  >
                    {isToggling
                      ? <Loader2 className="w-3 h-3 animate-spin text-white" />
                      : leader.completed
                        ? <Check className="w-3 h-3 text-white" />
                        : null}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 text-xs font-mono w-5 text-right">{leader.orderIndex}.</span>
                      <span className="text-white font-semibold text-sm truncate">{leader.gymName}</span>
                      <span className="text-white/40 text-xs truncate hidden sm:block">— {leader.name}</span>
                    </div>
                    {!leader.isActive && (
                      <span className="text-yellow-500/70 text-xs ml-7">inattivo</span>
                    )}
                  </div>

                  <button
                    onClick={() => skipToStage(leader.id, leader.gymName)}
                    disabled={!!actionLoading}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-700/60 hover:bg-indigo-600/80 text-indigo-200 transition-colors disabled:opacity-50 flex-shrink-0"
                    title={`Salta a questo stage (completa tutti i precedenti)`}
                  >
                    {isSkipping
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <SkipForward className="w-3 h-3" />}
                    Salta qui
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
