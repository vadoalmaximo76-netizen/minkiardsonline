import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { X, Plus, Save, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface TooltipData {
  id: string;
  trigger: string;
  title: string;
  message: string;
  position: string;
  isActive: boolean;
  priority: number;
}

interface AdminTooltipsPanelProps {
  onClose: () => void;
  authToken: string | null;
}

const TRIGGER_OPTIONS = [
  'card_drawn', 'first_attack_opportunity', 'defense_prompt',
  'evolution_available', 'bonus_in_hand', 'turn_started',
  'card_died', 'special_drawn', 'game_start', 'dice_rolled'
];

export const AdminTooltipsPanel: React.FC<AdminTooltipsPanelProps> = ({ onClose, authToken }) => {
  const [tooltips, setTooltips] = useState<TooltipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTooltip, setNewTooltip] = useState<TooltipData | null>(null);

  useEffect(() => {
    loadTooltips();
  }, []);

  const loadTooltips = async () => {
    try {
      const res = await fetch('/api/admin/contextual-tooltips', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) setTooltips(data.tooltips || []);
    } catch (e) {}
    setLoading(false);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/contextual-tooltips', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ tooltips })
      });
    } catch (e) {}
    setSaving(false);
  };

  const addNew = () => {
    const id = `tooltip-${Date.now()}`;
    setNewTooltip({
      id,
      trigger: 'card_drawn',
      title: '',
      message: '',
      position: 'bottom',
      isActive: true,
      priority: tooltips.length + 1
    });
  };

  const confirmNew = () => {
    if (newTooltip && newTooltip.title && newTooltip.message) {
      setTooltips([...tooltips, newTooltip]);
      setNewTooltip(null);
    }
  };

  const deleteTooltip = async (id: string) => {
    try {
      await fetch(`/api/admin/contextual-tooltips/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      setTooltips(tooltips.filter(t => t.id !== id));
    } catch (e) {}
  };

  const updateTooltip = (id: string, updates: Partial<TooltipData>) => {
    setTooltips(tooltips.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="premium-panel p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto animate-panel-slide-up">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-white font-bold text-xl">Gestione Tooltip Contestuali</h2>
          <div className="flex gap-2">
            <Button onClick={saveAll} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white" size="sm">
              <Save size={16} className="mr-1" /> {saving ? 'Salvando...' : 'Salva Tutto'}
            </Button>
            <Button onClick={onClose} className="bg-red-600 hover:bg-red-700 text-white" size="sm">
              <X size={16} />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-white/60 text-center py-8">Caricamento...</div>
        ) : (
          <div className="space-y-3">
            {tooltips.map((tooltip) => (
              <div key={tooltip.id} className="bg-slate-800/60 border border-purple-500/20 rounded-xl p-4">
                {editingId === tooltip.id ? (
                  <div className="space-y-3">
                    <input
                      value={tooltip.title}
                      onChange={e => updateTooltip(tooltip.id, { title: e.target.value })}
                      className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                      placeholder="Titolo"
                    />
                    <textarea
                      value={tooltip.message}
                      onChange={e => updateTooltip(tooltip.id, { message: e.target.value })}
                      className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm min-h-[60px]"
                      placeholder="Messaggio"
                    />
                    <div className="flex gap-2">
                      <select
                        value={tooltip.trigger}
                        onChange={e => updateTooltip(tooltip.id, { trigger: e.target.value })}
                        className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                      >
                        {TRIGGER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <select
                        value={tooltip.position}
                        onChange={e => updateTooltip(tooltip.id, { position: e.target.value })}
                        className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="top">Alto</option>
                        <option value="center">Centro</option>
                        <option value="bottom">Basso</option>
                      </select>
                      <input
                        type="number"
                        value={tooltip.priority}
                        onChange={e => updateTooltip(tooltip.id, { priority: parseInt(e.target.value) || 1 })}
                        className="w-20 bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                        placeholder="Priorità"
                      />
                    </div>
                    <Button onClick={() => setEditingId(null)} className="bg-cyan-600 hover:bg-cyan-700 text-white" size="sm">
                      Chiudi Editor
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 cursor-pointer" onClick={() => setEditingId(tooltip.id)}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold text-sm">{tooltip.title}</span>
                        <span className="text-purple-400 text-xs bg-purple-500/10 px-2 py-0.5 rounded-full">{tooltip.trigger}</span>
                      </div>
                      <p className="text-white/60 text-xs">{tooltip.message}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => updateTooltip(tooltip.id, { isActive: !tooltip.isActive })}>
                        {tooltip.isActive ? <ToggleRight size={20} className="text-green-400" /> : <ToggleLeft size={20} className="text-gray-500" />}
                      </button>
                      <button onClick={() => deleteTooltip(tooltip.id)} className="text-red-400 hover:text-red-300">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {newTooltip && (
              <div className="bg-slate-800/60 border border-cyan-500/30 rounded-xl p-4 space-y-3">
                <input
                  value={newTooltip.title}
                  onChange={e => setNewTooltip({ ...newTooltip, title: e.target.value })}
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                  placeholder="Titolo"
                />
                <textarea
                  value={newTooltip.message}
                  onChange={e => setNewTooltip({ ...newTooltip, message: e.target.value })}
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm min-h-[60px]"
                  placeholder="Messaggio"
                />
                <div className="flex gap-2">
                  <select
                    value={newTooltip.trigger}
                    onChange={e => setNewTooltip({ ...newTooltip, trigger: e.target.value })}
                    className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                  >
                    {TRIGGER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select
                    value={newTooltip.position}
                    onChange={e => setNewTooltip({ ...newTooltip, position: e.target.value })}
                    className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="top">Alto</option>
                    <option value="center">Centro</option>
                    <option value="bottom">Basso</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={confirmNew} className="bg-green-600 hover:bg-green-700 text-white" size="sm">Aggiungi</Button>
                  <Button onClick={() => setNewTooltip(null)} className="bg-gray-600 hover:bg-gray-700 text-white" size="sm">Annulla</Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <Button onClick={addNew} className="bg-purple-600 hover:bg-purple-700 text-white w-full" size="sm">
            <Plus size={16} className="mr-1" /> Nuovo Tooltip
          </Button>
        </div>
      </div>
    </div>
  );
};