import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Edit2, Trash2, Save, Shield, ChevronUp, ChevronDown, Eye, EyeOff, Trophy } from 'lucide-react';
import { Button } from './ui/button';

interface GymLeader {
  id: number;
  orderIndex: number;
  name: string;
  gymName: string;
  description: string | null;
  specialty: string | null;
  leaderImageUrl: string | null;
  badgeImageUrl: string | null;
  backgroundImageUrl: string | null;
  cpuLevel: string;
  deckBias: { personaggi: number; mosse: number; bonus: number };
  rewardCredits: number;
  rewardDescription: string | null;
  isActive: boolean;
  createdAt: string;
}

const EMPTY_FORM = {
  name: '',
  gymName: '',
  description: '',
  specialty: '',
  leaderImageUrl: '',
  badgeImageUrl: '',
  backgroundImageUrl: '',
  cpuLevel: 'medium' as string,
  deckBias: { personaggi: 1.0, mosse: 1.0, bonus: 1.0 },
  rewardCredits: 50,
  rewardDescription: '',
  orderIndex: 1,
  isActive: true,
};

const CPU_LEVELS = [
  { value: 'easy', label: '🟢 Facile', desc: 'CPU permissiva, buona per principianti' },
  { value: 'medium', label: '🟡 Medio', desc: 'CPU bilanciata' },
  { value: 'hard', label: '🔴 Difficile', desc: 'CPU aggressiva, usa carte rare spesso' },
];

function BiasSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-white/70 text-xs">{label}</span>
        <span className="text-white/90 text-xs font-bold">{value.toFixed(1)}x</span>
      </div>
      <input
        type="range"
        min="0.1" max="3.0" step="0.1"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-purple-500"
      />
      <div className="flex justify-between text-white/30 text-[10px]">
        <span>0.1x (raro)</span><span>1.0x (normale)</span><span>3.0x (frequente)</span>
      </div>
    </div>
  );
}

interface Props {
  onClose: () => void;
}

export function AdminGymPanel({ onClose }: Props) {
  const [leaders, setLeaders] = useState<GymLeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GymLeader | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewLeader, setPreviewLeader] = useState<GymLeader | null>(null);
  const authToken = localStorage.getItem('authToken');

  const fetchLeaders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/gym-leaders', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) setLeaders(data.gymLeaders || []);
      else setError(data.error || 'Errore caricamento');
    } catch {
      setError('Errore di rete');
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => { fetchLeaders(); }, [fetchLeaders]);

  const openCreate = () => {
    setEditing(null);
    const maxOrder = leaders.length > 0 ? Math.max(...leaders.map(l => l.orderIndex)) + 1 : 1;
    setForm({ ...EMPTY_FORM, orderIndex: maxOrder });
    setError(''); setSuccess('');
    setShowForm(true);
  };

  const openEdit = (leader: GymLeader) => {
    setEditing(leader);
    setForm({
      name: leader.name,
      gymName: leader.gymName,
      description: leader.description || '',
      specialty: leader.specialty || '',
      leaderImageUrl: leader.leaderImageUrl || '',
      badgeImageUrl: leader.badgeImageUrl || '',
      backgroundImageUrl: leader.backgroundImageUrl || '',
      cpuLevel: leader.cpuLevel,
      deckBias: leader.deckBias || { personaggi: 1.0, mosse: 1.0, bonus: 1.0 },
      rewardCredits: leader.rewardCredits,
      rewardDescription: leader.rewardDescription || '',
      orderIndex: leader.orderIndex,
      isActive: leader.isActive,
    });
    setError(''); setSuccess('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.gymName.trim()) {
      setError('Nome capopalestra e nome palestra sono obbligatori');
      return;
    }
    setSaving(true);
    setError(''); setSuccess('');
    try {
      const url = editing ? `/api/admin/gym-leaders/${editing.id}` : '/api/admin/gym-leaders';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(editing ? 'Palestra aggiornata!' : 'Palestra creata!');
        setShowForm(false);
        fetchLeaders();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Errore salvataggio');
      }
    } catch {
      setError('Errore di rete');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (leader: GymLeader) => {
    if (!confirm(`Eliminare la palestra "${leader.gymName}" di ${leader.name}? Verranno eliminati anche tutti i progressi dei giocatori.`)) return;
    try {
      const res = await fetch(`/api/admin/gym-leaders/${leader.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) { setSuccess('Palestra eliminata!'); fetchLeaders(); setTimeout(() => setSuccess(''), 3000); }
      else setError(data.error || 'Errore eliminazione');
    } catch {
      setError('Errore di rete');
    }
  };

  const toggleActive = async (leader: GymLeader) => {
    try {
      const res = await fetch(`/api/admin/gym-leaders/${leader.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...leader, deckBias: leader.deckBias || { personaggi: 1.0, mosse: 1.0, bonus: 1.0 }, isActive: !leader.isActive }),
      });
      const data = await res.json();
      if (data.success) fetchLeaders();
    } catch {}
  };

  const moveOrder = async (leader: GymLeader, dir: 'up' | 'down') => {
    const sorted = [...leaders].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = sorted.findIndex(l => l.id === leader.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await Promise.all([
      fetch(`/api/admin/gym-leaders/${leader.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...leader, deckBias: leader.deckBias || { personaggi: 1.0, mosse: 1.0, bonus: 1.0 }, orderIndex: other.orderIndex }),
      }),
      fetch(`/api/admin/gym-leaders/${other.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...other, deckBias: other.deckBias || { personaggi: 1.0, mosse: 1.0, bonus: 1.0 }, orderIndex: leader.orderIndex }),
      }),
    ]);
    fetchLeaders();
  };

  const sorted = [...leaders].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="fixed inset-0 bg-black/85 z-[70] flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 rounded-2xl w-full max-w-4xl border border-white/10 my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-yellow-400" />
            <h2 className="text-white font-bold text-xl">Pannello Palestre</h2>
            <span className="text-white/40 text-sm">{leaders.length} palestre configurate</span>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Messages */}
          {error && <div className="bg-red-900/50 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">{error}</div>}
          {success && <div className="bg-green-900/50 border border-green-500/30 text-green-300 rounded-xl px-4 py-3 text-sm">{success}</div>}

          {/* Action bar */}
          <div className="flex justify-between items-center">
            <p className="text-white/50 text-sm">Le palestre sono ordinate in sequenza. I giocatori le affrontano nell'ordine configurato.</p>
            <Button onClick={openCreate} className="bg-yellow-600 hover:bg-yellow-700 text-white gap-2">
              <Plus className="w-4 h-4" /> Nuova Palestra
            </Button>
          </div>

          {/* Form */}
          {showForm && (
            <div className="bg-gray-800 rounded-2xl border border-white/10 p-6">
              <h3 className="text-white font-bold text-lg mb-5 flex items-center gap-2">
                {editing ? <Edit2 className="w-5 h-5 text-blue-400" /> : <Plus className="w-5 h-5 text-green-400" />}
                {editing ? `Modifica: ${editing.gymName}` : 'Crea Nuova Palestra'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Posizione */}
                <div>
                  <label className="block text-white/70 text-xs font-semibold mb-1.5">Posizione nel percorso</label>
                  <input
                    type="number" min={1}
                    value={form.orderIndex}
                    onChange={e => setForm(f => ({ ...f, orderIndex: parseInt(e.target.value) || 1 }))}
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>

                {/* Attiva */}
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all w-full ${
                      form.isActive ? 'border-green-500 bg-green-900/30 text-white' : 'border-white/10 bg-white/5 text-white/50'
                    }`}
                  >
                    {form.isActive ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4" />}
                    <span className="font-semibold text-sm">{form.isActive ? 'Visibile ai giocatori' : 'Nascosta'}</span>
                  </button>
                </div>

                {/* Nome capopalestra */}
                <div>
                  <label className="block text-white/70 text-xs font-semibold mb-1.5">Nome Capopalestra *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="es. Brock, Misty..."
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30"
                  />
                </div>

                {/* Nome palestra */}
                <div>
                  <label className="block text-white/70 text-xs font-semibold mb-1.5">Nome Palestra *</label>
                  <input
                    value={form.gymName}
                    onChange={e => setForm(f => ({ ...f, gymName: e.target.value }))}
                    placeholder="es. Palestra della Roccia"
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30"
                  />
                </div>

                {/* Specialità */}
                <div>
                  <label className="block text-white/70 text-xs font-semibold mb-1.5">Specialità / Tema</label>
                  <input
                    value={form.specialty}
                    onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
                    placeholder="es. Personaggi Leggendari, Solo Mosse..."
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30"
                  />
                </div>

                {/* Livello CPU */}
                <div>
                  <label className="block text-white/70 text-xs font-semibold mb-1.5">Difficoltà CPU</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CPU_LEVELS.map(lvl => (
                      <button
                        key={lvl.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, cpuLevel: lvl.value }))}
                        title={lvl.desc}
                        className={`py-2 rounded-xl border-2 text-xs font-bold transition-all ${
                          form.cpuLevel === lvl.value
                            ? lvl.value === 'easy' ? 'border-green-500 bg-green-900/30 text-white'
                              : lvl.value === 'medium' ? 'border-yellow-500 bg-yellow-900/30 text-white'
                              : 'border-red-500 bg-red-900/30 text-white'
                            : 'border-white/10 bg-white/5 text-white/50 hover:border-white/30'
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Descrizione */}
                <div className="md:col-span-2">
                  <label className="block text-white/70 text-xs font-semibold mb-1.5">Descrizione / Testo narrativo</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Breve descrizione della palestra e del suo stile di gioco..."
                    rows={2}
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30 resize-none"
                  />
                </div>

                {/* Immagine capopalestra */}
                <div>
                  <label className="block text-white/70 text-xs font-semibold mb-1.5">URL Immagine Capopalestra</label>
                  <input
                    value={form.leaderImageUrl}
                    onChange={e => setForm(f => ({ ...f, leaderImageUrl: e.target.value }))}
                    placeholder="https://... (ritratto del capopalestra)"
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30"
                  />
                  {form.leaderImageUrl && (
                    <img src={form.leaderImageUrl} alt="preview" className="mt-2 h-16 w-16 object-cover rounded-lg border border-white/20" onError={e => (e.currentTarget.style.display = 'none')} />
                  )}
                </div>

                {/* Immagine medaglia */}
                <div>
                  <label className="block text-white/70 text-xs font-semibold mb-1.5">URL Immagine Medaglia/Badge</label>
                  <input
                    value={form.badgeImageUrl}
                    onChange={e => setForm(f => ({ ...f, badgeImageUrl: e.target.value }))}
                    placeholder="https://... (medaglia ottenuta alla vittoria)"
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30"
                  />
                  {form.badgeImageUrl && (
                    <img src={form.badgeImageUrl} alt="badge preview" className="mt-2 h-16 w-16 object-cover rounded-lg border border-white/20" onError={e => (e.currentTarget.style.display = 'none')} />
                  )}
                </div>

                {/* Immagine sfondo campo */}
                <div className="md:col-span-2">
                  <label className="block text-white/70 text-xs font-semibold mb-1.5">URL Immagine Sfondo Campo da Gioco</label>
                  <input
                    value={form.backgroundImageUrl}
                    onChange={e => setForm(f => ({ ...f, backgroundImageUrl: e.target.value }))}
                    placeholder="https://... (sfondo visualizzato durante la battaglia)"
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30"
                  />
                  {form.backgroundImageUrl && (
                    <img src={form.backgroundImageUrl} alt="bg preview" className="mt-2 h-20 w-full object-cover rounded-lg border border-white/20" onError={e => (e.currentTarget.style.display = 'none')} />
                  )}
                </div>

                {/* Deck bias sliders */}
                <div className="md:col-span-2">
                  <label className="block text-white/70 text-xs font-semibold mb-3">Composizione Mazzo CPU (moltiplicatore frequenza carte)</label>
                  <div className="bg-gray-700/50 rounded-xl p-4 space-y-4">
                    <BiasSlider label="🧑 Personaggi" value={form.deckBias.personaggi} onChange={v => setForm(f => ({ ...f, deckBias: { ...f.deckBias, personaggi: v } }))} />
                    <BiasSlider label="⚔️ Mosse" value={form.deckBias.mosse} onChange={v => setForm(f => ({ ...f, deckBias: { ...f.deckBias, mosse: v } }))} />
                    <BiasSlider label="✨ Bonus" value={form.deckBias.bonus} onChange={v => setForm(f => ({ ...f, deckBias: { ...f.deckBias, bonus: v } }))} />
                  </div>
                </div>

                {/* Ricompensa crediti */}
                <div>
                  <label className="block text-white/70 text-xs font-semibold mb-1.5">Ricompensa Punti Rankiard</label>
                  <input
                    type="number" min={0}
                    value={form.rewardCredits}
                    onChange={e => setForm(f => ({ ...f, rewardCredits: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>

                {/* Descrizione ricompensa */}
                <div>
                  <label className="block text-white/70 text-xs font-semibold mb-1.5">Descrizione Ricompensa</label>
                  <input
                    value={form.rewardDescription}
                    onChange={e => setForm(f => ({ ...f, rewardDescription: e.target.value }))}
                    placeholder="es. +50 Rankiard + Medaglia Roccia"
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30"
                  />
                </div>
              </div>

              {error && <div className="mt-4 bg-red-900/50 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">{error}</div>}

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowForm(false)} className="border-white/20 text-white/70 hover:text-white">
                  Annulla
                </Button>
                <Button onClick={handleSave} disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-white gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Salvataggio...' : editing ? 'Salva Modifiche' : 'Crea Palestra'}
                </Button>
              </div>
            </div>
          )}

          {/* Leaders list */}
          {loading ? (
            <div className="text-white/50 text-center py-12">Caricamento...</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16">
              <Shield className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/40 text-lg font-semibold">Nessuna palestra configurata</p>
              <p className="text-white/30 text-sm mt-1">Crea la prima palestra per avviare il percorso</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((leader, idx) => (
                <div
                  key={leader.id}
                  className={`bg-gray-800 rounded-2xl border overflow-hidden transition-all ${
                    leader.isActive ? 'border-white/10' : 'border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Order controls */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveOrder(leader, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-white/30 hover:text-white disabled:opacity-20 transition-colors"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <span className="text-white/60 text-sm font-bold text-center w-6">{leader.orderIndex}</span>
                      <button
                        onClick={() => moveOrder(leader, 'down')}
                        disabled={idx === sorted.length - 1}
                        className="p-1 text-white/30 hover:text-white disabled:opacity-20 transition-colors"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Leader portrait */}
                    <div className="flex-shrink-0">
                      {leader.leaderImageUrl ? (
                        <img src={leader.leaderImageUrl} alt={leader.name} className="w-14 h-14 object-cover rounded-xl border border-white/20" />
                      ) : (
                        <div className="w-14 h-14 bg-gray-700 rounded-xl border border-white/10 flex items-center justify-center">
                          <Shield className="w-6 h-6 text-white/30" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-bold">{leader.gymName}</span>
                        {!leader.isActive && <span className="text-xs bg-gray-700 text-white/40 px-2 py-0.5 rounded-full">Nascosta</span>}
                      </div>
                      <div className="text-white/60 text-sm">Capopalestra: <span className="text-white/80">{leader.name}</span></div>
                      {leader.specialty && <div className="text-yellow-400/70 text-xs mt-0.5">⚡ {leader.specialty}</div>}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          leader.cpuLevel === 'easy' ? 'bg-green-900/50 text-green-300'
                          : leader.cpuLevel === 'medium' ? 'bg-yellow-900/50 text-yellow-300'
                          : 'bg-red-900/50 text-red-300'
                        }`}>
                          {leader.cpuLevel === 'easy' ? '🟢 Facile' : leader.cpuLevel === 'medium' ? '🟡 Medio' : '🔴 Difficile'}
                        </span>
                        <span className="text-white/40 text-xs flex items-center gap-1">
                          <Trophy className="w-3 h-3" /> {leader.rewardCredits} Rankiard
                        </span>
                      </div>
                    </div>

                    {/* Badge preview */}
                    {leader.badgeImageUrl && (
                      <div className="flex-shrink-0">
                        <img src={leader.badgeImageUrl} alt="badge" className="w-10 h-10 object-cover rounded-full border-2 border-yellow-500/50" />
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleActive(leader)}
                        title={leader.isActive ? 'Nascondi palestra' : 'Rendi visibile'}
                        className="p-2 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                      >
                        {leader.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setPreviewLeader(leader)}
                        title="Anteprima"
                        className="p-2 text-white/40 hover:text-blue-400 transition-colors rounded-lg hover:bg-white/10"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEdit(leader)}
                        title="Modifica"
                        className="p-2 text-white/40 hover:text-yellow-400 transition-colors rounded-lg hover:bg-white/10"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(leader)}
                        title="Elimina"
                        className="p-2 text-white/40 hover:text-red-400 transition-colors rounded-lg hover:bg-white/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Deck bias bars */}
                  <div className="px-4 pb-3 flex gap-3">
                    {(['personaggi', 'mosse', 'bonus'] as const).map(type => {
                      const bias = leader.deckBias?.[type] ?? 1.0;
                      const pct = Math.min((bias / 3.0) * 100, 100);
                      return (
                        <div key={type} className="flex-1">
                          <div className="text-white/30 text-[10px] mb-1 capitalize">{type}</div>
                          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${type === 'personaggi' ? 'bg-blue-500' : type === 'mosse' ? 'bg-red-500' : 'bg-green-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-white/40 text-[10px] mt-0.5">{bias.toFixed(1)}x</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {previewLeader && (
        <div className="fixed inset-0 bg-black/90 z-[80] flex items-center justify-center p-4" onClick={() => setPreviewLeader(null)}>
          <div
            className="bg-gray-800 rounded-2xl border border-white/15 w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={previewLeader.backgroundImageUrl ? {
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.9)), url(${previewLeader.backgroundImageUrl})`,
              backgroundSize: 'cover', backgroundPosition: 'center'
            } : {}}
          >
            <div className="p-6 text-center">
              <div className="text-white/50 text-xs mb-3">PALESTRA #{previewLeader.orderIndex}</div>
              {previewLeader.leaderImageUrl ? (
                <img src={previewLeader.leaderImageUrl} alt={previewLeader.name} className="w-24 h-24 object-cover rounded-full mx-auto border-4 border-yellow-500/50 mb-4" />
              ) : (
                <div className="w-24 h-24 bg-gray-700 rounded-full mx-auto border-4 border-white/20 mb-4 flex items-center justify-center">
                  <Shield className="w-10 h-10 text-white/30" />
                </div>
              )}
              <h3 className="text-white font-bold text-xl">{previewLeader.gymName}</h3>
              <p className="text-white/60 text-sm">Capopalestra {previewLeader.name}</p>
              {previewLeader.specialty && (
                <p className="text-yellow-400 text-xs mt-2 bg-yellow-900/30 rounded-full px-3 py-1 inline-block">⚡ {previewLeader.specialty}</p>
              )}
              {previewLeader.description && (
                <p className="text-white/50 text-sm mt-3 leading-relaxed">{previewLeader.description}</p>
              )}
              <div className="mt-4 flex items-center justify-center gap-4">
                {previewLeader.badgeImageUrl && (
                  <div className="text-center">
                    <img src={previewLeader.badgeImageUrl} alt="badge" className="w-12 h-12 object-cover rounded-full border-2 border-yellow-500 mx-auto" />
                    <p className="text-yellow-400 text-xs mt-1">Medaglia</p>
                  </div>
                )}
                <div className="text-center">
                  <div className="text-white font-bold text-lg">+{previewLeader.rewardCredits}</div>
                  <div className="text-white/50 text-xs">Rankiard</div>
                </div>
              </div>
              <div className={`mt-4 text-xs font-bold px-3 py-1 rounded-full inline-block ${
                previewLeader.cpuLevel === 'easy' ? 'bg-green-900/50 text-green-300'
                : previewLeader.cpuLevel === 'medium' ? 'bg-yellow-900/50 text-yellow-300'
                : 'bg-red-900/50 text-red-300'
              }`}>
                {previewLeader.cpuLevel === 'easy' ? '🟢 CPU Facile' : previewLeader.cpuLevel === 'medium' ? '🟡 CPU Medio' : '🔴 CPU Difficile'}
              </div>
            </div>
            <div className="border-t border-white/10 px-6 py-3 flex justify-end">
              <Button size="sm" onClick={() => setPreviewLeader(null)} className="bg-gray-700 hover:bg-gray-600 text-white">
                Chiudi anteprima
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
