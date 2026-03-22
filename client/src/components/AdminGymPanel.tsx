import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Plus, Edit2, Trash2, Save, Shield, ChevronUp, ChevronDown, Eye, EyeOff, Search, Check, Layers, Users, Target, Swords } from 'lucide-react';
import { Button } from './ui/button';

type LeaderMessages = {
  gameStart: string[];
  playPersonaggio: string[];
  playMossa: string[];
  playBonus: string[];
  takeMossa: string[];
  eliminateEnemy: string[];
  ownPersonaggioDies: string[];
  gameWin: string[];
  gameLose: string[];
};

const EMPTY_LEADER_MESSAGES: LeaderMessages = {
  gameStart: ['', '', ''],
  playPersonaggio: ['', '', ''],
  playMossa: ['', '', ''],
  playBonus: ['', '', ''],
  takeMossa: ['', '', ''],
  eliminateEnemy: ['', '', ''],
  ownPersonaggioDies: ['', '', ''],
  gameWin: ['', '', ''],
  gameLose: ['', '', ''],
};

interface CpuConfig {
  name: string;
  imageUrl: string;
  cpuLevel: string;
  customDeck: string[];
  leaderMessages: LeaderMessages;
}

const EMPTY_CPU_CONFIG: CpuConfig = {
  name: '',
  imageUrl: '',
  cpuLevel: 'medium',
  customDeck: [],
  leaderMessages: { ...EMPTY_LEADER_MESSAGES },
};

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
  customDeck: string[];
  livesCount: number;
  playerStartingDeck: string[];
  rewardCredits: number;
  rewardDescription: string | null;
  youtubeMusicUrl: string | null;
  leaderMessages: LeaderMessages | null;
  cpuCount: number;
  cpuConfigs: CpuConfig[];
  attackMode: 'free_for_all' | 'hunt_human';
  isActive: boolean;
  createdAt: string;
}

interface CardEntry {
  id: string;
  deckType: string;
  originalName: string;
  originalImageUrl: string;
  name: string | null;
  imageUrl: string | null;
  pti: number | null;
  stars: number | null;
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
  customDeck: [] as string[],
  livesCount: 3,
  playerStartingDeck: [] as string[],
  rewardCredits: 50,
  rewardDescription: '',
  youtubeMusicUrl: '',
  leaderMessages: { ...EMPTY_LEADER_MESSAGES } as LeaderMessages,
  orderIndex: 1,
  isActive: true,
  cpuCount: 1,
  attackMode: 'free_for_all' as 'free_for_all' | 'hunt_human',
  cpuConfigs: [] as CpuConfig[],
};

const CPU_LEVELS = [
  { value: 'easy', label: '🟢 Facile', desc: 'CPU permissiva, buona per principianti' },
  { value: 'medium', label: '🟡 Medio', desc: 'CPU bilanciata' },
  { value: 'hard', label: '🔴 Difficile', desc: 'CPU aggressiva, usa carte rare spesso' },
];

const DECK_TYPES = [
  { value: 'personaggi', label: 'Personaggi', color: 'bg-blue-600', dot: 'bg-blue-400' },
  { value: 'mosse', label: 'Mosse', color: 'bg-red-600', dot: 'bg-red-400' },
  { value: 'bonus', label: 'Bonus', color: 'bg-green-600', dot: 'bg-green-400' },
  { value: 'personaggi_speciali', label: 'Speciali', color: 'bg-purple-600', dot: 'bg-purple-400' },
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

function MessagesEditor({
  messages,
  onChange,
}: {
  messages: LeaderMessages;
  onChange: (m: LeaderMessages) => void;
}) {
  const fields: { key: keyof LeaderMessages; label: string; emoji: string }[] = [
    { key: 'gameStart', label: 'Inizio partita', emoji: '🎮' },
    { key: 'playPersonaggio', label: 'Gioca Personaggio', emoji: '🧑' },
    { key: 'playMossa', label: 'Gioca Mossa', emoji: '⚔️' },
    { key: 'playBonus', label: 'Gioca Bonus', emoji: '✨' },
    { key: 'takeMossa', label: 'Subisce Mossa', emoji: '🛡️' },
    { key: 'eliminateEnemy', label: 'Elimina nemico', emoji: '💀' },
    { key: 'ownPersonaggioDies', label: 'Suo personaggio muore', emoji: '😢' },
    { key: 'gameWin', label: 'Vittoria CPU', emoji: '🏆' },
    { key: 'gameLose', label: 'Sconfitta CPU', emoji: '😭' },
  ];

  return (
    <div className="space-y-3">
      {fields.map(({ key, label, emoji }) => (
        <div key={key}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-base">{emoji}</span>
            <label className="text-white/60 text-xs">{label}</label>
          </div>
          {(messages[key] || ['', '', '']).map((msg, i) => (
            <input
              key={i}
              value={msg}
              onChange={e => {
                const arr = [...(messages[key] || ['', '', ''])];
                arr[i] = e.target.value;
                onChange({ ...messages, [key]: arr });
              }}
              placeholder={`Frase ${i + 1}…`}
              className="w-full bg-gray-600/50 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-500/50 placeholder-white/20 mb-1"
            />
          ))}
        </div>
      ))}
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

  const [availableCards, setAvailableCards] = useState<CardEntry[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [cardSearch, setCardSearch] = useState('');
  const [cardDeckFilter, setCardDeckFilter] = useState('personaggi');
  const [deckEditTarget, setDeckEditTarget] = useState<string>('cpu-main');
  const [expandedMessages, setExpandedMessages] = useState<string | null>(null);
  const [expandedCpus, setExpandedCpus] = useState<Record<number, boolean>>({});

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

  const loadCards = useCallback(async () => {
    if (availableCards.length > 0) return;
    setLoadingCards(true);
    try {
      const res = await fetch('/api/admin/existing-cards', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) setAvailableCards(data.cards || []);
    } catch {}
    finally { setLoadingCards(false); }
  }, [authToken, availableCards.length]);

  const syncCpuConfigs = (count: number, existing: CpuConfig[]): CpuConfig[] => {
    const result: CpuConfig[] = [];
    for (let i = 0; i < count - 1; i++) {
      result.push(existing[i] ? { ...existing[i] } : { ...EMPTY_CPU_CONFIG });
    }
    return result;
  };

  const openCreate = () => {
    setEditing(null);
    const maxOrder = leaders.length > 0 ? Math.max(...leaders.map(l => l.orderIndex)) + 1 : 1;
    setForm({ ...EMPTY_FORM, orderIndex: maxOrder });
    setCardSearch('');
    setCardDeckFilter('personaggi');
    setDeckEditTarget('cpu-main');
    setExpandedMessages(null);
    setExpandedCpus({});
    setError(''); setSuccess('');
    setShowForm(true);
    loadCards();
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
      customDeck: Array.isArray(leader.customDeck) ? leader.customDeck : [],
      livesCount: leader.livesCount ?? 3,
      playerStartingDeck: Array.isArray(leader.playerStartingDeck) ? leader.playerStartingDeck : [],
      rewardCredits: leader.rewardCredits,
      rewardDescription: leader.rewardDescription || '',
      youtubeMusicUrl: leader.youtubeMusicUrl || '',
      leaderMessages: leader.leaderMessages
        ? { ...EMPTY_LEADER_MESSAGES, ...leader.leaderMessages }
        : { ...EMPTY_LEADER_MESSAGES },
      orderIndex: leader.orderIndex,
      isActive: leader.isActive,
      cpuCount: leader.cpuCount ?? 1,
      attackMode: leader.attackMode ?? 'free_for_all',
      cpuConfigs: Array.isArray(leader.cpuConfigs) ? leader.cpuConfigs : [],
    });
    setCardSearch('');
    setCardDeckFilter('personaggi');
    setDeckEditTarget('cpu-main');
    setExpandedMessages(null);
    setExpandedCpus({});
    setError(''); setSuccess('');
    setShowForm(true);
    loadCards();
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.gymName.trim()) {
      setError('Nome Boss e nome Stage sono obbligatori');
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
        setSuccess(editing ? 'Stage aggiornato!' : 'Stage creato!');
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
    if (!confirm(`Eliminare lo Stage "${leader.gymName}" (Boss: ${leader.name})? Verranno eliminati anche tutti i progressi dei giocatori.`)) return;
    try {
      const res = await fetch(`/api/admin/gym-leaders/${leader.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) { setSuccess('Stage eliminato!'); fetchLeaders(); setTimeout(() => setSuccess(''), 3000); }
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
        body: JSON.stringify({ ...leader, deckBias: leader.deckBias || { personaggi: 1.0, mosse: 1.0, bonus: 1.0 }, customDeck: Array.isArray(leader.customDeck) ? leader.customDeck : [], isActive: !leader.isActive }),
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
        body: JSON.stringify({ ...leader, deckBias: leader.deckBias || { personaggi: 1.0, mosse: 1.0, bonus: 1.0 }, customDeck: Array.isArray(leader.customDeck) ? leader.customDeck : [], orderIndex: other.orderIndex }),
      }),
      fetch(`/api/admin/gym-leaders/${other.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...other, deckBias: other.deckBias || { personaggi: 1.0, mosse: 1.0, bonus: 1.0 }, customDeck: Array.isArray(other.customDeck) ? other.customDeck : [], orderIndex: leader.orderIndex }),
      }),
    ]);
    fetchLeaders();
  };

  const getActiveDeck = (): string[] => {
    if (deckEditTarget === 'player') return form.playerStartingDeck;
    if (deckEditTarget === 'cpu-main') return form.customDeck;
    const idx = parseInt(deckEditTarget.replace('cpu-extra-', ''));
    if (!isNaN(idx) && form.cpuConfigs[idx]) return form.cpuConfigs[idx].customDeck;
    return [];
  };

  const setActiveDeck = (deck: string[]) => {
    if (deckEditTarget === 'player') {
      setForm(f => ({ ...f, playerStartingDeck: deck }));
    } else if (deckEditTarget === 'cpu-main') {
      setForm(f => ({ ...f, customDeck: deck }));
    } else {
      const idx = parseInt(deckEditTarget.replace('cpu-extra-', ''));
      if (!isNaN(idx)) {
        setForm(f => {
          const configs = [...f.cpuConfigs];
          if (configs[idx]) configs[idx] = { ...configs[idx], customDeck: deck };
          return { ...f, cpuConfigs: configs };
        });
      }
    }
  };

  const toggleCardInDeck = (cardId: string) => {
    const deck = getActiveDeck();
    if (deck.includes(cardId)) {
      setActiveDeck(deck.filter(id => id !== cardId));
    } else {
      setActiveDeck([...deck, cardId]);
    }
  };

  const removeCardFromDeck = (cardId: string) => {
    setActiveDeck(getActiveDeck().filter(id => id !== cardId));
  };

  const activeDeck = getActiveDeck();

  const filteredCards = useMemo(() => {
    const q = cardSearch.toLowerCase().trim();
    return availableCards.filter(c => {
      if (c.deckType !== cardDeckFilter) return false;
      if (!q) return true;
      const displayName = c.name || c.originalName;
      return displayName.toLowerCase().includes(q);
    });
  }, [availableCards, cardDeckFilter, cardSearch]);

  const selectedCardEntries = useMemo(() =>
    activeDeck.map(id => availableCards.find(c => c.id === id)).filter(Boolean) as CardEntry[],
    [activeDeck, availableCards]
  );

  const deckCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activeDeck.forEach(id => {
      const cleanType = availableCards.find(c => c.id === id)?.deckType || '';
      if (cleanType) counts[cleanType] = (counts[cleanType] || 0) + 1;
    });
    return counts;
  }, [activeDeck, availableCards]);

  const sorted = [...leaders].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="fixed inset-0 bg-black/90 z-[70] flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 rounded-2xl w-full max-w-5xl border border-white/10 my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-yellow-900/20 to-orange-900/10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-white font-black text-xl">Pannello Stage</h2>
              <p className="text-white/40 text-xs">{leaders.length} stage configurati</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="bg-red-900/50 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">{error}</div>}
          {success && <div className="bg-green-900/50 border border-green-500/30 text-green-300 rounded-xl px-4 py-3 text-sm">{success}</div>}

          <div className="flex justify-between items-center">
            <p className="text-white/50 text-sm">Gli stage sono in sequenza. I giocatori li affrontano nell'ordine configurato.</p>
            <Button onClick={openCreate} className="bg-yellow-600 hover:bg-yellow-700 text-white gap-2 shadow-lg shadow-yellow-900/30">
              <Plus className="w-4 h-4" /> Nuovo Stage
            </Button>
          </div>

          {/* ── FORM ───────────────────────────────────────────────────────── */}
          {showForm && (
            <div className="bg-gray-800/80 rounded-2xl border border-white/10 p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/10">
                {editing
                  ? <Edit2 className="w-5 h-5 text-blue-400" />
                  : <Plus className="w-5 h-5 text-green-400" />
                }
                <h3 className="text-white font-black text-lg">
                  {editing ? `Modifica Stage: ${editing.gymName}` : 'Crea Nuovo Stage'}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Posizione */}
                <div>
                  <label className="block text-white/60 text-xs font-semibold mb-1.5 uppercase tracking-wider">Posizione nel percorso</label>
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
                    <span className="font-semibold text-sm">{form.isActive ? 'Visibile ai giocatori' : 'Nascosto'}</span>
                  </button>
                </div>

                {/* Nome Stage */}
                <div>
                  <label className="block text-white/60 text-xs font-semibold mb-1.5 uppercase tracking-wider">Nome Stage *</label>
                  <input
                    value={form.gymName}
                    onChange={e => setForm(f => ({ ...f, gymName: e.target.value }))}
                    placeholder="es. Stage della Roccia"
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30"
                  />
                </div>

                {/* Specialità */}
                <div>
                  <label className="block text-white/60 text-xs font-semibold mb-1.5 uppercase tracking-wider">Specialità / Tema</label>
                  <input
                    value={form.specialty}
                    onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
                    placeholder="es. Solo Personaggi Leggendari…"
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30"
                  />
                </div>

                {/* Numero vite */}
                <div>
                  <label className="block text-white/60 text-xs font-semibold mb-1.5 uppercase tracking-wider">Vite Giocatore ❤️</label>
                  <input
                    type="number" min={1} max={10}
                    value={form.livesCount}
                    onChange={e => setForm(f => ({ ...f, livesCount: Math.max(1, parseInt(e.target.value) || 3) }))}
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <p className="text-white/30 text-xs mt-1">Personaggi che il giocatore può schierare</p>
                </div>

                {/* Ricompensa */}
                <div>
                  <label className="block text-white/60 text-xs font-semibold mb-1.5 uppercase tracking-wider">Ricompensa Rankiard ⭐</label>
                  <input
                    type="number" min={0}
                    value={form.rewardCredits}
                    onChange={e => setForm(f => ({ ...f, rewardCredits: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>

                {/* Descrizione */}
                <div className="md:col-span-2">
                  <label className="block text-white/60 text-xs font-semibold mb-1.5 uppercase tracking-wider">Descrizione narrativa</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Breve descrizione dello stage e del suo stile di gioco…"
                    rows={2}
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30 resize-none"
                  />
                </div>

                {/* Badge */}
                <div>
                  <label className="block text-white/60 text-xs font-semibold mb-1.5 uppercase tracking-wider">URL Medaglia/Badge</label>
                  <input
                    value={form.badgeImageUrl}
                    onChange={e => setForm(f => ({ ...f, badgeImageUrl: e.target.value }))}
                    placeholder="https://…"
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30"
                  />
                  {form.badgeImageUrl && (
                    <img src={form.badgeImageUrl} alt="badge preview" className="mt-2 h-14 w-14 object-cover rounded-lg border border-white/20" onError={e => (e.currentTarget.style.display = 'none')} />
                  )}
                </div>

                {/* Sfondo */}
                <div>
                  <label className="block text-white/60 text-xs font-semibold mb-1.5 uppercase tracking-wider">URL Immagine Sfondo</label>
                  <input
                    value={form.backgroundImageUrl}
                    onChange={e => setForm(f => ({ ...f, backgroundImageUrl: e.target.value }))}
                    placeholder="https://…"
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30"
                  />
                  {form.backgroundImageUrl && (
                    <img src={form.backgroundImageUrl} alt="bg preview" className="mt-2 h-16 w-full object-cover rounded-lg border border-white/20" onError={e => (e.currentTarget.style.display = 'none')} />
                  )}
                </div>

                {/* YouTube musica */}
                <div className="md:col-span-2">
                  <label className="block text-white/60 text-xs font-semibold mb-1.5 uppercase tracking-wider">🎵 URL YouTube musica battaglia</label>
                  <input
                    value={form.youtubeMusicUrl}
                    onChange={e => setForm(f => ({ ...f, youtubeMusicUrl: e.target.value }))}
                    placeholder="https://www.youtube.com/watch?v=…"
                    className="w-full bg-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30"
                  />
                </div>

                {/* ── MODALITÀ ATTACCO ─────────────────────────────────────── */}
                <div className="md:col-span-2">
                  <label className="block text-white/60 text-xs font-semibold mb-2 uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" /> Modalità Attacco CPU
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, attackMode: 'free_for_all' }))}
                      className={`flex flex-col items-center gap-2 px-4 py-3.5 rounded-xl border-2 transition-all ${
                        form.attackMode === 'free_for_all'
                          ? 'border-blue-500 bg-blue-900/30 text-white'
                          : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20'
                      }`}
                    >
                      <Swords className="w-5 h-5 text-blue-400" />
                      <span className="font-black text-sm">Tutti contro tutti</span>
                      <span className="text-[10px] text-center opacity-60 leading-tight">Le CPU si attaccano anche tra loro — partita libera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, attackMode: 'hunt_human' }))}
                      className={`flex flex-col items-center gap-2 px-4 py-3.5 rounded-xl border-2 transition-all ${
                        form.attackMode === 'hunt_human'
                          ? 'border-red-500 bg-red-900/30 text-white'
                          : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20'
                      }`}
                    >
                      <Target className="w-5 h-5 text-red-400" />
                      <span className="font-black text-sm">Tutti contro l'umano</span>
                      <span className="text-[10px] text-center opacity-60 leading-tight">Tutte le CPU si concentrano solo sul giocatore umano</span>
                    </button>
                  </div>
                </div>

                {/* ── CPU AVVERSARI ─────────────────────────────────────────── */}
                <div className="md:col-span-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-orange-400" />
                    <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">CPU Avversari</label>
                    <span className="text-white/30 text-xs ml-1">Quante CPU affrontare in questo stage?</span>
                  </div>
                  <div className="flex gap-2 mb-4">
                    {[1, 2, 3, 4].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          const newConfigs = syncCpuConfigs(n, form.cpuConfigs);
                          setForm(f => ({ ...f, cpuCount: n, cpuConfigs: newConfigs }));
                          if (deckEditTarget.startsWith('cpu-extra-')) {
                            const idx = parseInt(deckEditTarget.replace('cpu-extra-', ''));
                            if (idx >= n - 1) setDeckEditTarget('cpu-main');
                          }
                        }}
                        className={`flex-1 py-2.5 rounded-xl border-2 font-black text-sm transition-all ${
                          form.cpuCount === n
                            ? 'border-orange-500 bg-orange-900/30 text-white'
                            : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20'
                        }`}
                      >
                        {n} {n === 1 ? 'CPU' : 'CPU'}
                      </button>
                    ))}
                  </div>

                  {/* Boss principale (CPU #1) */}
                  <div className="bg-gray-700/50 rounded-xl border border-orange-500/20 overflow-hidden mb-3">
                    <button
                      type="button"
                      onClick={() => setExpandedCpus(s => ({ ...s, 0: !s[0] }))}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-orange-400 text-xs font-black bg-orange-900/30 border border-orange-500/30 rounded-full px-2 py-0.5">
                          BOSS {form.cpuCount > 1 ? '#1' : ''}
                        </span>
                        <span className="text-white font-bold text-sm">{form.name || 'Boss principale'}</span>
                        {form.leaderImageUrl && (
                          <img src={form.leaderImageUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-white/20" onError={e => (e.currentTarget.style.display = 'none')} />
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${expandedCpus[0] ? 'rotate-180' : ''}`} />
                    </button>
                    {(expandedCpus[0] ?? true) && (
                      <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-white/50 text-xs mb-1">Nome Boss *</label>
                            <input
                              value={form.name}
                              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                              placeholder="es. Don Corleone…"
                              className="w-full bg-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30"
                            />
                          </div>
                          <div>
                            <label className="block text-white/50 text-xs mb-1">URL Immagine Boss</label>
                            <input
                              value={form.leaderImageUrl}
                              onChange={e => setForm(f => ({ ...f, leaderImageUrl: e.target.value }))}
                              placeholder="https://…"
                              className="w-full bg-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30"
                            />
                          </div>
                        </div>
                        {form.leaderImageUrl && (
                          <img src={form.leaderImageUrl} alt="preview" className="h-14 w-14 object-cover rounded-lg border border-white/20" onError={e => (e.currentTarget.style.display = 'none')} />
                        )}
                        {/* Difficoltà */}
                        <div>
                          <label className="block text-white/50 text-xs mb-1.5">Difficoltà</label>
                          <div className="grid grid-cols-3 gap-2">
                            {CPU_LEVELS.map(lvl => (
                              <button
                                key={lvl.value} type="button"
                                onClick={() => setForm(f => ({ ...f, cpuLevel: lvl.value }))}
                                title={lvl.desc}
                                className={`py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${
                                  form.cpuLevel === lvl.value
                                    ? lvl.value === 'easy' ? 'border-green-500 bg-green-900/30 text-white'
                                      : lvl.value === 'medium' ? 'border-yellow-500 bg-yellow-900/30 text-white'
                                      : 'border-red-500 bg-red-900/30 text-white'
                                    : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20'
                                }`}
                              >
                                {lvl.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Messaggi boss principale */}
                        <button
                          type="button"
                          onClick={() => setExpandedMessages(expandedMessages === 'main' ? null : 'main')}
                          className="text-xs text-yellow-400/70 hover:text-yellow-400 flex items-center gap-1 transition-colors"
                        >
                          {expandedMessages === 'main' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          Frasi personalizzate
                        </button>
                        {expandedMessages === 'main' && (
                          <div className="bg-gray-800/60 rounded-xl p-3 border border-white/5">
                            <MessagesEditor
                              messages={form.leaderMessages}
                              onChange={m => setForm(f => ({ ...f, leaderMessages: m }))}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CPU aggiuntive */}
                  {form.cpuConfigs.map((cfg, idx) => (
                    <div key={idx} className="bg-gray-700/50 rounded-xl border border-purple-500/20 overflow-hidden mb-3">
                      <button
                        type="button"
                        onClick={() => setExpandedCpus(s => ({ ...s, [idx + 1]: !s[idx + 1] }))}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-purple-400 text-xs font-black bg-purple-900/30 border border-purple-500/30 rounded-full px-2 py-0.5">
                            CPU #{idx + 2}
                          </span>
                          <span className="text-white/70 font-bold text-sm">{cfg.name || `CPU avversaria #${idx + 2}`}</span>
                          {cfg.imageUrl && (
                            <img src={cfg.imageUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-white/20" onError={e => (e.currentTarget.style.display = 'none')} />
                          )}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${expandedCpus[idx + 1] ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedCpus[idx + 1] && (
                        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-white/50 text-xs mb-1">Nome CPU #{idx + 2}</label>
                              <input
                                value={cfg.name}
                                onChange={e => {
                                  setForm(f => {
                                    const configs = [...f.cpuConfigs];
                                    configs[idx] = { ...configs[idx], name: e.target.value };
                                    return { ...f, cpuConfigs: configs };
                                  });
                                }}
                                placeholder="es. Scagnozzo…"
                                className="w-full bg-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-white/30"
                              />
                            </div>
                            <div>
                              <label className="block text-white/50 text-xs mb-1">URL Immagine</label>
                              <input
                                value={cfg.imageUrl}
                                onChange={e => {
                                  setForm(f => {
                                    const configs = [...f.cpuConfigs];
                                    configs[idx] = { ...configs[idx], imageUrl: e.target.value };
                                    return { ...f, cpuConfigs: configs };
                                  });
                                }}
                                placeholder="https://…"
                                className="w-full bg-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-white/30"
                              />
                            </div>
                          </div>
                          {cfg.imageUrl && (
                            <img src={cfg.imageUrl} alt="preview" className="h-14 w-14 object-cover rounded-lg border border-white/20" onError={e => (e.currentTarget.style.display = 'none')} />
                          )}
                          {/* Difficoltà CPU extra */}
                          <div>
                            <label className="block text-white/50 text-xs mb-1.5">Difficoltà</label>
                            <div className="grid grid-cols-3 gap-2">
                              {CPU_LEVELS.map(lvl => (
                                <button
                                  key={lvl.value} type="button"
                                  onClick={() => {
                                    setForm(f => {
                                      const configs = [...f.cpuConfigs];
                                      configs[idx] = { ...configs[idx], cpuLevel: lvl.value };
                                      return { ...f, cpuConfigs: configs };
                                    });
                                  }}
                                  className={`py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${
                                    cfg.cpuLevel === lvl.value
                                      ? lvl.value === 'easy' ? 'border-green-500 bg-green-900/30 text-white'
                                        : lvl.value === 'medium' ? 'border-yellow-500 bg-yellow-900/30 text-white'
                                        : 'border-red-500 bg-red-900/30 text-white'
                                      : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20'
                                  }`}
                                >
                                  {lvl.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Messaggi CPU extra */}
                          <button
                            type="button"
                            onClick={() => setExpandedMessages(expandedMessages === `extra-${idx}` ? null : `extra-${idx}`)}
                            className="text-xs text-purple-400/70 hover:text-purple-400 flex items-center gap-1 transition-colors"
                          >
                            {expandedMessages === `extra-${idx}` ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            Frasi personalizzate
                          </button>
                          {expandedMessages === `extra-${idx}` && (
                            <div className="bg-gray-800/60 rounded-xl p-3 border border-white/5">
                              <MessagesEditor
                                messages={cfg.leaderMessages || { ...EMPTY_LEADER_MESSAGES }}
                                onChange={m => {
                                  setForm(f => {
                                    const configs = [...f.cpuConfigs];
                                    configs[idx] = { ...configs[idx], leaderMessages: m };
                                    return { ...f, cpuConfigs: configs };
                                  });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* ── MAZZI ──────────────────────────────────────────────────── */}
                <div className="md:col-span-2">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Layers className="w-4 h-4 text-yellow-400" />
                    <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Mazzi</label>
                    <div className="flex gap-1 flex-wrap ml-2">
                      <button
                        type="button"
                        onClick={() => setDeckEditTarget('cpu-main')}
                        className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${deckEditTarget === 'cpu-main' ? 'bg-orange-600 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}
                      >
                        🤖 Boss{form.cpuCount > 1 ? ' #1' : ''}
                      </button>
                      {form.cpuConfigs.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setDeckEditTarget(`cpu-extra-${idx}`)}
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${deckEditTarget === `cpu-extra-${idx}` ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}
                        >
                          🤖 CPU #{idx + 2}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setDeckEditTarget('player')}
                        className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${deckEditTarget === 'player' ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}
                      >
                        👤 Iniziale
                      </button>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-auto ${
                      activeDeck.length > 0 ? 'bg-yellow-600/30 text-yellow-300 border border-yellow-600/40' : 'bg-white/10 text-white/40'
                    }`}>
                      {activeDeck.length > 0 ? `${activeDeck.length} carte` : 'Nessuna carta'}
                    </span>
                  </div>

                  {deckEditTarget === 'player' && (
                    <p className="text-blue-400/60 text-[11px] bg-blue-900/20 border border-blue-500/20 rounded-lg px-3 py-2 mb-3">
                      💡 Il mazzo iniziale viene assegnato al giocatore alla prima partita dello Story Mode (solo se non ha ancora carte).
                    </p>
                  )}

                  {/* Bias sliders — solo CPU senza mazzo specifico */}
                  {deckEditTarget === 'cpu-main' && activeDeck.length === 0 && (
                    <div className="bg-gray-700/50 rounded-xl p-4 space-y-4 mb-4">
                      <p className="text-white/40 text-xs mb-2">Pesi per la selezione casuale delle carte. Aggiungi carte specifiche per sovrascrivere.</p>
                      <BiasSlider label="🧑 Personaggi" value={form.deckBias.personaggi} onChange={v => setForm(f => ({ ...f, deckBias: { ...f.deckBias, personaggi: v } }))} />
                      <BiasSlider label="⚔️ Mosse" value={form.deckBias.mosse} onChange={v => setForm(f => ({ ...f, deckBias: { ...f.deckBias, mosse: v } }))} />
                      <BiasSlider label="✨ Bonus" value={form.deckBias.bonus} onChange={v => setForm(f => ({ ...f, deckBias: { ...f.deckBias, bonus: v } }))} />
                    </div>
                  )}

                  {/* Selected cards */}
                  {activeDeck.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {Object.entries(deckCounts).map(([type, count]) => {
                          const dt = DECK_TYPES.find(d => d.value === type);
                          return dt ? (
                            <span key={type} className={`text-xs px-2 py-0.5 rounded-full text-white font-bold ${dt.color}`}>
                              {dt.label}: {count}
                            </span>
                          ) : null;
                        })}
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {selectedCardEntries.map((card, i) => (
                          <div key={`${card.id}-${i}`} className="relative group">
                            <div className="w-10 h-14 rounded overflow-hidden border border-white/20 bg-gray-800">
                              {(card.imageUrl || card.originalImageUrl) ? (
                                <img
                                  src={card.imageUrl || card.originalImageUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={e => { (e.currentTarget.style.display = 'none'); }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Shield className="w-3 h-3 text-white/20" />
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCardFromDeck(card.id)}
                              className="absolute -top-1 -right-1 bg-red-600 rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-2.5 h-2.5 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Card picker */}
                  <div className="bg-gray-700/50 rounded-xl p-3 border border-white/5">
                    <div className="flex gap-2 mb-2 flex-wrap">
                      <div className="flex-1 relative min-w-[120px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                        <input
                          value={cardSearch}
                          onChange={e => setCardSearch(e.target.value)}
                          placeholder="Cerca carta…"
                          className="w-full bg-gray-600 text-white rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-500 placeholder-white/30"
                        />
                      </div>
                      {DECK_TYPES.map(dt => (
                        <button
                          key={dt.value}
                          type="button"
                          onClick={() => setCardDeckFilter(dt.value)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg font-bold transition-all ${cardDeckFilter === dt.value ? dt.color + ' text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}
                        >
                          {dt.label}
                        </button>
                      ))}
                    </div>
                    {loadingCards ? (
                      <div className="text-center py-4 text-white/30 text-xs">Caricamento carte…</div>
                    ) : (
                      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 max-h-48 overflow-y-auto">
                        {filteredCards.slice(0, 60).map((card) => {
                          const isSelected = activeDeck.includes(card.id);
                          const displayName = card.name || card.originalName;
                          return (
                            <button
                              key={card.id}
                              type="button"
                              onClick={() => toggleCardInDeck(card.id)}
                              title={displayName}
                              className={`relative rounded overflow-hidden border-2 transition-all aspect-[2/3] ${
                                isSelected ? 'border-yellow-400 shadow-lg shadow-yellow-400/30' : 'border-transparent hover:border-white/30'
                              }`}
                            >
                              {(card.imageUrl || card.originalImageUrl) ? (
                                <img
                                  src={card.imageUrl || card.originalImageUrl}
                                  alt={displayName}
                                  className="w-full h-full object-cover"
                                  onError={e => { (e.currentTarget.style.display = 'none'); }}
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-600 flex items-center justify-center">
                                  <Shield className="w-3 h-3 text-white/30" />
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute inset-0 bg-yellow-400/20 flex items-center justify-center">
                                  <Check className="w-4 h-4 text-yellow-300 drop-shadow" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                        {filteredCards.length === 0 && (
                          <div className="col-span-full text-center py-4 text-white/30 text-xs">
                            Nessuna carta trovata
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Pulsanti salva/annulla */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                <Button type="button" onClick={() => setShowForm(false)} className="bg-gray-700 hover:bg-gray-600 text-white">
                  Annulla
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-white gap-2 shadow-lg shadow-yellow-900/30">
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? 'Salvataggio…' : 'Salva Stage'}
                </Button>
              </div>
            </div>
          )}

          {/* ── LISTA STAGE ──────────────────────────────────────────────── */}
          {loading ? (
            <div className="text-center py-12 text-white/30">
              <div className="w-8 h-8 border-2 border-white/20 border-t-yellow-400 rounded-full animate-spin mx-auto mb-3" />
              Caricamento stage…
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12 text-white/30">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Nessuno stage configurato</p>
              <p className="text-xs mt-1">Crea il primo stage con il pulsante qui sopra</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((leader, idx) => (
                <div
                  key={leader.id}
                  className={`rounded-xl border transition-all ${
                    leader.isActive ? 'bg-gray-800/60 border-white/10' : 'bg-gray-900/60 border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 p-4">
                    {/* Ordine */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => moveOrder(leader, 'up')}
                        disabled={idx === 0}
                        className="text-white/30 hover:text-white disabled:opacity-20 transition-colors p-0.5"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <span className="text-white/40 text-xs font-bold text-center">{leader.orderIndex}</span>
                      <button
                        onClick={() => moveOrder(leader, 'down')}
                        disabled={idx === sorted.length - 1}
                        className="text-white/30 hover:text-white disabled:opacity-20 transition-colors p-0.5"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Immagine */}
                    <div className="relative flex-shrink-0">
                      {leader.leaderImageUrl ? (
                        <img src={leader.leaderImageUrl} alt={leader.name} className="w-12 h-12 rounded-xl object-cover border border-white/20" onError={e => (e.currentTarget.style.display = 'none')} />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gray-700 border border-white/10 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-white/20" />
                        </div>
                      )}
                      {leader.badgeImageUrl && (
                        <img src={leader.badgeImageUrl} alt="badge" className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full border-2 border-gray-800 object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-bold text-sm truncate">{leader.gymName}</span>
                        <span className="text-white/40 text-xs">Boss: {leader.name}</span>
                        {(leader.cpuCount ?? 1) > 1 && (
                          <span className="text-purple-400 text-[10px] bg-purple-900/30 border border-purple-500/30 rounded-full px-1.5 py-0.5 font-bold">
                            {leader.cpuCount} CPU
                          </span>
                        )}
                        {leader.attackMode === 'hunt_human' && (
                          <span className="text-red-400 text-[10px] bg-red-900/30 border border-red-500/30 rounded-full px-1.5 py-0.5 font-bold flex items-center gap-0.5">
                            <Target className="w-2.5 h-2.5" /> vs Umano
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          leader.cpuLevel === 'easy' ? 'bg-green-900/40 text-green-300'
                          : leader.cpuLevel === 'medium' ? 'bg-yellow-900/40 text-yellow-300'
                          : 'bg-red-900/40 text-red-300'
                        }`}>
                          {leader.cpuLevel === 'easy' ? '🟢 Facile' : leader.cpuLevel === 'medium' ? '🟡 Medio' : '🔴 Difficile'}
                        </span>
                        <span className="text-white/30 text-[10px]">❤️ {leader.livesCount} vite</span>
                        {Array.isArray(leader.customDeck) && leader.customDeck.length > 0 && (
                          <span className="text-yellow-400/60 text-[10px]">🃏 {leader.customDeck.length} carte</span>
                        )}
                        {leader.specialty && (
                          <span className="text-blue-400/60 text-[10px] truncate max-w-[120px]">⚡ {leader.specialty}</span>
                        )}
                      </div>
                    </div>

                    {/* Azioni */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setPreviewLeader(leader)}
                        title="Anteprima"
                        className="p-1.5 text-white/30 hover:text-white transition-colors hover:bg-white/10 rounded-lg"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleActive(leader)}
                        title={leader.isActive ? 'Nascondi' : 'Mostra'}
                        className={`p-1.5 transition-colors hover:bg-white/10 rounded-lg ${leader.isActive ? 'text-green-400 hover:text-green-300' : 'text-white/30 hover:text-white'}`}
                      >
                        {leader.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => openEdit(leader)}
                        title="Modifica"
                        className="p-1.5 text-blue-400/70 hover:text-blue-400 transition-colors hover:bg-white/10 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(leader)}
                        title="Elimina"
                        className="p-1.5 text-red-400/50 hover:text-red-400 transition-colors hover:bg-white/10 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Anteprima */}
      {previewLeader && (
        <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4" onClick={() => setPreviewLeader(null)}>
          <div
            className="bg-gray-900 rounded-2xl w-full max-w-sm border border-white/10 overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
            style={previewLeader.backgroundImageUrl ? {
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(10,10,20,0.95)), url(${previewLeader.backgroundImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            } : {}}
          >
            <div className="p-6 text-center">
              {previewLeader.leaderImageUrl ? (
                <img src={previewLeader.leaderImageUrl} alt={previewLeader.name} className="w-24 h-24 rounded-2xl object-cover mx-auto border-4 border-yellow-400/40 mb-4 shadow-lg" onError={e => (e.currentTarget.style.display = 'none')} />
              ) : (
                <div className="w-24 h-24 bg-gray-700 rounded-2xl mx-auto border-4 border-white/20 mb-4 flex items-center justify-center">
                  <Shield className="w-10 h-10 text-white/30" />
                </div>
              )}
              <h3 className="text-white font-black text-xl">{previewLeader.gymName}</h3>
              <p className="text-white/60 text-sm">Boss: <span className="text-yellow-300 font-bold">{previewLeader.name}</span></p>
              {(previewLeader.cpuCount ?? 1) > 1 && (
                <p className="text-purple-300 text-xs mt-1">{previewLeader.cpuCount} CPU avversarie</p>
              )}
              {previewLeader.attackMode === 'hunt_human' && (
                <div className="mt-2 inline-flex items-center gap-1 bg-red-900/30 text-red-300 text-xs px-2 py-0.5 rounded-full border border-red-500/30 font-bold">
                  <Target className="w-3 h-3" /> Tutti contro l'umano
                </div>
              )}
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
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
