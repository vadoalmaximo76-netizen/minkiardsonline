import React, { useState, useEffect, useRef } from 'react';
import {
  Gamepad2, GraduationCap, Users, User, Trophy, Clock, Star, Award, Sparkles,
  Settings, Shuffle, Shield, Crown, Sword, Zap, Flame, Heart, BookOpen, Globe,
  Lock, Bell, Gift, Target, Rocket, ChevronUp, ChevronDown, Trash2, Edit3,
  Plus, X, Check, GripVertical, Play, TrendingUp
} from 'lucide-react';
import { TournamentPanel } from './TournamentPanel';
import { ClubPanel } from './ClubPanel';
import { SeasonalEventsPanel } from './SeasonalEventsPanel';

const ICON_MAP: Record<string, React.ElementType> = {
  Gamepad2, GraduationCap, Users, User, Trophy, Star, Award, Sparkles,
  Settings, Shuffle, Shield, Crown, Sword, Zap, Flame, Heart, BookOpen,
  Globe, Lock, Bell, Gift, Target, Rocket, Clock,
};

const ICON_NAMES = Object.keys(ICON_MAP);

interface HomePanel {
  id: string;
  panelKey: string;
  title: string;
  subtitle: string;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  titleColor: string;
  subtitleColor: string;
  badge: string;
  badgeColor: string;
  sortOrder: number;
  adminOnly: boolean;
}

interface HomeScreenProps {
  playerName: string;
  userId?: number;
  onNavigate: (section: 'play' | 'training' | 'rooms' | 'profile' | 'admin' | 'draft' | 'leaderboard' | 'tournaments' | 'fanta' | 'gym') => void;
  onJoinTournamentMatch?: (gameId: string, matchId: number, tournamentName: string) => void;
  userEmail?: string;
  initialShowTournaments?: boolean;
  onInitialShowTournamentsHandled?: () => void;
}

interface UserStats {
  puntiRankiard: number;
  gamesPlayed: number;
  gamesWon: number;
}

const PANEL_KEY_ACTIONS: Record<string, string> = {
  play: 'navigate:play',
  training: 'navigate:training',
  rooms: 'navigate:rooms',
  profile: 'navigate:profile',
  admin: 'navigate:admin',
  draft: 'navigate:draft',
  fanta: 'navigate:fanta',
  leaderboard: 'navigate:leaderboard',
  gym: 'navigate:gym',
  'tournaments-classic': 'navigate:tournaments',
  tournaments: 'modal:tournaments',
  clubs: 'modal:clubs',
  events: 'modal:events',
};

function PanelEditorModal({
  panel,
  onSave,
  onClose,
  authToken,
}: {
  panel: HomePanel | null;
  onSave: (p: HomePanel) => void;
  onClose: () => void;
  authToken: string;
}) {
  const [form, setForm] = useState<HomePanel>(
    panel ?? {
      id: `panel-${Date.now()}`,
      panelKey: 'play',
      title: 'Nuovo Pannello',
      subtitle: '',
      icon: 'Star',
      gradientFrom: '#7c3aed',
      gradientTo: '#4f46e5',
      titleColor: '#ffffff',
      subtitleColor: 'rgba(255,255,255,0.7)',
      badge: '',
      badgeColor: 'rgba(0,0,0,0.3)',
      sortOrder: 0,
      adminOnly: false,
    }
  );
  const set = (k: keyof HomePanel, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
    }} onClick={onClose}>
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b, #0f172a)', borderRadius: 20,
        border: '1px solid rgba(139,92,246,0.3)', padding: 28, width: '90%', maxWidth: 520,
        boxShadow: '0 30px 80px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 800, color: '#e2e8f0' }}>
          {panel ? '✏️ Modifica Riquadro' : '➕ Nuovo Riquadro'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Chiave sezione</label>
              <select value={form.panelKey} onChange={e => set('panelKey', e.target.value)}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '7px 10px', fontSize: 13 }}>
                {Object.keys(PANEL_KEY_ACTIONS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Icona</label>
              <select value={form.icon} onChange={e => set('icon', e.target.value)}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '7px 10px', fontSize: 13 }}>
                {ICON_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Titolo</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Sottotitolo</label>
            <input value={form.subtitle} onChange={e => set('subtitle', e.target.value)}
              style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Gradiente Da</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="color" value={form.gradientFrom} onChange={e => set('gradientFrom', e.target.value)}
                  style={{ width: 36, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'none' }} />
                <input value={form.gradientFrom} onChange={e => set('gradientFrom', e.target.value)}
                  style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '7px 8px', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Gradiente A</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="color" value={form.gradientTo} onChange={e => set('gradientTo', e.target.value)}
                  style={{ width: 36, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'none' }} />
                <input value={form.gradientTo} onChange={e => set('gradientTo', e.target.value)}
                  style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '7px 8px', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Testo badge (vuoto = nessuno)</label>
              <input value={form.badge} onChange={e => set('badge', e.target.value)}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Colore sfondo badge</label>
              <input value={form.badgeColor} onChange={e => set('badgeColor', e.target.value)}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.adminOnly} onChange={e => set('adminOnly', e.target.checked)}
              style={{ width: 16, height: 16 }} />
            Visibile solo agli admin
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}>
            Annulla
          </button>
          <button onClick={() => onSave(form)}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', borderRadius: 8, color: 'white', padding: '8px 24px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={14} /> Salva
          </button>
        </div>
      </div>
    </div>
  );
}

const HOME_STYLES = `
  @keyframes letterBounce {
    0%   { transform: translateY(0) scale(1); }
    25%  { transform: translateY(-14px) scale(1.15); }
    55%  { transform: translateY(3px) scale(0.97); }
    75%  { transform: translateY(-4px) scale(1.04); }
    100% { transform: translateY(0) scale(1); }
  }
  @keyframes shimmerSweep {
    0%   { transform: translateX(-120%) skewX(-20deg); opacity: 0; }
    15%  { opacity: 1; }
    85%  { opacity: 1; }
    100% { transform: translateX(250%) skewX(-20deg); opacity: 0; }
  }
  @keyframes iconFloat {
    0%, 100% { transform: translateY(0) scale(1.1) rotate(0deg); }
    40%       { transform: translateY(-8px) scale(1.18) rotate(-4deg); }
    70%       { transform: translateY(-3px) scale(1.13) rotate(2deg); }
  }
  @keyframes glowRingPulse {
    0%, 100% { opacity: 0; transform: scale(1); }
    50%       { opacity: 0.6; transform: scale(1.04); }
  }
  @keyframes cardGlowBorder {
    0%, 100% { opacity: 0.35; }
    50%       { opacity: 0.85; }
  }
  @keyframes marqueeNews {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes statsPop {
    0%   { opacity: 0; transform: translateY(-8px) scale(0.95); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes borderSpin {
    from { transform: translate(-50%, -50%) rotate(0deg); }
    to   { transform: translate(-50%, -50%) rotate(360deg); }
  }
  @keyframes particleFloat {
    0%   { transform: translateY(0px) scale(1); opacity: var(--p-op); }
    50%  { opacity: calc(var(--p-op) * 2.2); }
    100% { transform: translateY(-100vh) scale(0.4); opacity: 0; }
  }
  @keyframes sparkle {
    0%, 100% { transform: scale(0) rotate(0deg); opacity: 0; }
    20%       { transform: scale(1.4) rotate(45deg); opacity: 1; }
    80%       { transform: scale(0.8) rotate(90deg); opacity: 0.6; }
  }
  @keyframes logoGlowPulse {
    0%, 100% { filter: drop-shadow(0 0 12px rgba(168,85,247,0.5)) drop-shadow(0 0 24px rgba(168,85,247,0.3)); }
    50%       { filter: drop-shadow(0 0 28px rgba(168,85,247,1)) drop-shadow(0 0 50px rgba(168,85,247,0.8)) drop-shadow(0 0 70px rgba(236,72,153,0.6)); }
  }
  @keyframes logoBounce {
    0%   { transform: scale(1) translateY(0); }
    25%  { transform: scale(1.06) translateY(-8px); }
    55%  { transform: scale(0.98) translateY(2px); }
    75%  { transform: scale(1.03) translateY(-3px); }
    100% { transform: scale(1) translateY(0); }
  }
  @keyframes rankFloat {
    0%   { transform: translateY(0px); }
    50%  { transform: translateY(-10px); }
    100% { transform: translateY(0px); }
  }
  @keyframes pulseBorder {
    0%   { box-shadow: 0 0 0 0 rgba(168,85,247,0.5); }
    70%  { box-shadow: 0 0 0 12px rgba(168,85,247,0); }
    100% { box-shadow: 0 0 0 0 rgba(168,85,247,0); }
  }
  @keyframes homeGiocaGlow {
    0%, 100% { box-shadow: 0 0 20px rgba(34,197,94,0.4), 0 8px 32px rgba(0,0,0,0.4); }
    50%       { box-shadow: 0 0 36px rgba(34,197,94,0.65), 0 8px 32px rgba(0,0,0,0.4); }
  }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;

const RANK_TIERS = [
  { name: 'Esordiente',  min: 0,    max: 299,      numeral: 'I'   },
  { name: 'Dilettante',  min: 300,  max: 599,      numeral: 'II'  },
  { name: 'Competitore', min: 600,  max: 999,      numeral: 'III' },
  { name: 'Sfidante',    min: 1000, max: 1499,     numeral: 'IV'  },
  { name: 'Campione',    min: 1500, max: 1999,     numeral: 'V'   },
  { name: 'Maestro',     min: 2000, max: 2499,     numeral: 'VI'  },
  { name: 'Leggenda',    min: 2500, max: Infinity, numeral: '★'   },
];

function getTierInfo(pts: number) {
  const idx = RANK_TIERS.findIndex(t => pts >= t.min && pts <= t.max);
  const tier = RANK_TIERS[Math.max(0, idx)];
  const nextTier = RANK_TIERS[idx + 1] ?? null;
  const progress = nextTier
    ? Math.min(99, Math.round(((pts - tier.min) / (nextTier.min - tier.min)) * 100))
    : 100;
  return { tier, nextTier, progress };
}

const PARTICLE_COLORS = ['#c084fc', '#60a5fa', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#38bdf8'];
const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768;
const PARTICLE_COUNT = IS_MOBILE ? 0 : 14;
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  id: i,
  x: (i * 31 + 13) % 97,
  size: 1.2 + (i % 5) * 0.7,
  duration: 14 + (i % 8) * 3,
  delay: (i * 1.8) % 14,
  opacity: 0.12 + (i % 6) * 0.05,
  color: PARTICLE_COLORS[i % 7],
}));

export function HomeScreen({ playerName, userId, onNavigate, onJoinTournamentMatch, userEmail, initialShowTournaments, onInitialShowTournamentsHandled }: HomeScreenProps) {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [activeRoomsCount, setActiveRoomsCount] = useState(0);
  const [tickerQuotes, setTickerQuotes] = useState<string[]>([]);
  const [tickerEditOpen, setTickerEditOpen] = useState(false);
  const [tickerEditText, setTickerEditText] = useState('');
  const [tickerSaving, setTickerSaving] = useState(false);
  const [panels, setPanels] = useState<HomePanel[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editingPanel, setEditingPanel] = useState<HomePanel | null | 'new'>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [titleHovered, setTitleHovered] = useState(false);
  const [titleAutoGlow, setTitleAutoGlow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const [giocaHovered, setGiocaHovered] = useState(false);
  const isAdmin = userEmail === 'lucaforte94@gmail.com';
  const authToken = localStorage.getItem('authToken') || '';

  const DEFAULT_QUOTES = [
    "⚡ Viva il Pelux",
    "🎮 Entra nel vivo del gioco scegliendo la sezione che preferisci",
    "✨ Lo sapevi che puoi comprare skin speciali per le tue carte? Vai su PROFILO e scegli SKIN CARTE",
    "📖 Vuoi capire meglio il meccanismo? Vai su ALLENAMENTO e premi REGOLAMENTO per non avere più dubbi!",
    "🏆 FantaMinkiards: costruisci la tua squadra e sfida gli amici nel torneo!",
    "📬 Minkiards è un progetto indipendente nato nel 2012 — vadoalmaximo76@gmail.com"
  ];

  useEffect(() => {
    fetch('/api/news-ticker')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setTickerQuotes(data); else setTickerQuotes(DEFAULT_QUOTES); })
      .catch(() => setTickerQuotes(DEFAULT_QUOTES));
  }, []);

  const tickerText = tickerQuotes.length > 0
    ? [...tickerQuotes, ...tickerQuotes].join('   •   ')
    : DEFAULT_QUOTES.join('   •   ');
  const tickerDuration = Math.max(20, (tickerText.length / 2) * 0.09);

  const openTickerEdit = () => {
    setTickerEditText((tickerQuotes.length > 0 ? tickerQuotes : DEFAULT_QUOTES).join('\n'));
    setTickerEditOpen(true);
  };

  const saveTickerEdit = async () => {
    setTickerSaving(true);
    const lines = tickerEditText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    try {
      await fetch('/api/news-ticker', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(lines),
      });
      setTickerQuotes(lines);
      setTickerEditOpen(false);
    } catch (e) { console.error(e); }
    setTickerSaving(false);
  };

  const [showTournaments, setShowTournaments] = useState(false);
  const [showSeasonalEvents, setShowSeasonalEvents] = useState(false);
  const [showClubs, setShowClubs] = useState(false);

  useEffect(() => {
    if (initialShowTournaments) {
      setShowTournaments(true);
      onInitialShowTournamentsHandled?.();
    }
  }, [initialShowTournaments]);

  useEffect(() => {
    fetch('/api/home-panels')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPanels([...data].sort((a, b) => a.sortOrder - b.sortOrder)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          const statsRes = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
          if (statsRes.ok) {
            const data = await statsRes.json();
            setUserStats({ puntiRankiard: data.user.puntiRankiard || 0, gamesPlayed: data.user.gamesPlayed || 0, gamesWon: data.user.gamesWon || 0 });
          }
        }
        const roomsRes = await fetch('/api/active-rooms');
        if (roomsRes.ok) {
          const rooms = await roomsRes.json();
          setActiveRoomsCount(rooms.length || 0);
        }
      } catch (e) {}
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    const handleFocus = () => fetchData();
    window.addEventListener('focus', handleFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', handleFocus); };
  }, []);

  useEffect(() => {
    const glowInterval = setInterval(() => {
      setTitleAutoGlow(true);
      setTimeout(() => setTitleAutoGlow(false), 1800);
    }, 10000);
    return () => clearInterval(glowInterval);
  }, []);

  useEffect(() => {
    if (userStats) {
      const { progress } = getTierInfo(userStats.puntiRankiard);
      const timer = setTimeout(() => setBarWidth(progress), 200);
      return () => clearTimeout(timer);
    }
  }, [userStats]);

  const savePanels = async (updated: HomePanel[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/home-panels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(updated),
      });
      if (res.ok) setPanels(updated);
    } finally { setSaving(false); }
  };

  const handlePanelSave = (updated: HomePanel) => {
    let next: HomePanel[];
    const idx = panels.findIndex(p => p.id === updated.id);
    if (idx >= 0) {
      next = panels.map(p => p.id === updated.id ? updated : p);
    } else {
      next = [...panels, { ...updated, sortOrder: panels.length }];
    }
    savePanels(next.map((p, i) => ({ ...p, sortOrder: i })));
    setEditingPanel(null);
  };

  const handleDelete = (id: string) => {
    const next = panels.filter(p => p.id !== id).map((p, i) => ({ ...p, sortOrder: i }));
    savePanels(next);
  };

  const handleMove = (id: string, dir: -1 | 1) => {
    const idx = panels.findIndex(p => p.id === id);
    if (idx < 0) return;
    const next = [...panels];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    savePanels(next.map((p, i) => ({ ...p, sortOrder: i })));
  };

  const handlePanelClick = (panel: HomePanel) => {
    if (editMode) return;
    const action = PANEL_KEY_ACTIONS[panel.panelKey];
    if (!action) return;
    if (action.startsWith('navigate:')) {
      onNavigate(action.replace('navigate:', '') as any);
    } else if (action === 'modal:tournaments') {
      setShowTournaments(true);
    } else if (action === 'modal:clubs') {
      setShowClubs(true);
    } else if (action === 'modal:events') {
      setShowSeasonalEvents(true);
    } else if (action === 'modal:leaderboard' || action === 'navigate:leaderboard') {
      onNavigate('leaderboard');
    }
  };

  const visiblePanels = panels.filter(p => !p.adminOnly || isAdmin);

  const tierInfo = userStats ? getTierInfo(userStats.puntiRankiard) : null;

  return (
    <div className="min-h-screen bg-arena-deep flex flex-col overflow-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: HOME_STYLES }} />

      {/* ── Background ── */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 20% 10%, rgba(88,28,135,0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(30,58,138,0.3) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(6,182,212,0.15) 0%, transparent 60%), radial-gradient(ellipse at 10% 70%, rgba(139,92,246,0.2) 0%, transparent 50%), linear-gradient(180deg, #03050d 0%, #070b1a 30%, #0a1028 60%, #060918 100%)' }} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute rounded-full home-blob animate-bg-float-1" style={{ width: 500, height: 500, background: 'radial-gradient(circle, #9333ea, transparent 65%)', opacity: 0.35, top: '5%', left: '5%', willChange: 'transform' }} />
        <div className="absolute rounded-full home-blob animate-bg-float-2" style={{ width: 450, height: 450, background: 'radial-gradient(circle, #3b82f6, transparent 65%)', opacity: 0.28, bottom: '10%', right: '5%', willChange: 'transform' }} />
        <div className="absolute rounded-full home-blob animate-bg-float-3" style={{ width: 380, height: 380, background: 'radial-gradient(circle, #06b6d4, transparent 65%)', opacity: 0.22, top: '45%', left: '55%', willChange: 'transform' }} />
        <div className="absolute rounded-full home-blob animate-bg-float-4" style={{ width: 420, height: 420, background: 'radial-gradient(circle, #ec4899, transparent 65%)', opacity: 0.16, top: '60%', left: '0%', willChange: 'transform' }} />
        <div className="absolute inset-0 animate-aurora-1" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.12) 30%, rgba(59,130,246,0.08) 50%, rgba(139,92,246,0.12) 70%, transparent 100%)', height: '40%', top: '10%', willChange: 'transform' }} />
        <div className="absolute inset-0 animate-aurora-2" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.08) 25%, rgba(236,72,153,0.07) 50%, rgba(59,130,246,0.08) 75%, transparent 100%)', height: '35%', bottom: '15%', top: 'auto', willChange: 'transform' }} />
        {PARTICLES.map(p => (
          <div key={p.id} style={{ position: 'absolute', bottom: '-5px', left: `${p.x}%`, width: p.size, height: p.size, borderRadius: '50%', background: p.color, boxShadow: `0 0 ${p.size * 3}px ${p.color}`, '--p-op': p.opacity, animation: `particleFloat ${p.duration}s ease-in ${p.delay}s infinite` } as React.CSSProperties} />
        ))}
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto relative z-10 no-scrollbar" style={{ paddingBottom: 164 }}>

        {/* Header */}
        <header
          className="sticky top-0 z-30 px-5 py-3 flex justify-between items-center"
          style={{ background: 'rgba(3,5,13,0.82)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(139,92,246,0.1)' }}
        >
          <div
            onMouseEnter={() => setTitleHovered(true)}
            onMouseLeave={() => setTitleHovered(false)}
            className="cursor-default select-none"
          >
            <img
              src="https://i.ibb.co/B55FsW7p/logo-testo-minkiards.png"
              alt="MINKIARDS"
              style={{
                height: 34,
                width: 'auto',
                animation: (titleHovered || titleAutoGlow)
                  ? 'logoBounce 0.65s cubic-bezier(0.34,1.56,0.64,1) both, logoGlowPulse 1.2s ease-in-out infinite'
                  : 'none',
                filter: (titleHovered || titleAutoGlow)
                  ? 'drop-shadow(0 0 18px rgba(192,132,252,0.95)) drop-shadow(0 0 36px rgba(236,72,153,0.6))'
                  : 'drop-shadow(0 0 6px rgba(192,132,252,0.4))',
                transition: 'filter 0.35s ease',
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(15,23,42,0.8)', padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(139,92,246,0.2)' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'statsPop 1s ease-in-out infinite alternate' }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#cbd5e1' }}>
                Ciao, <span style={{ color: '#c084fc', fontWeight: 700 }}>{playerName}</span>
              </span>
            </div>
            {isAdmin && (
              <button
                onClick={() => setEditMode(e => !e)}
                style={{
                  background: editMode ? 'linear-gradient(135deg,#059669,#0d9488)' : 'rgba(30,41,59,0.9)',
                  border: `1px solid ${editMode ? '#059669' : '#334155'}`,
                  borderRadius: 8, color: editMode ? 'white' : '#94a3b8',
                  padding: '5px 12px', cursor: 'pointer', fontSize: 11,
                  fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                <Edit3 size={11} /> {editMode ? 'Fine' : 'Modifica'}
              </button>
            )}
          </div>
        </header>

        {/* ── Rank section ── */}
        <section style={{ padding: '28px 20px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          {/* Purple glow backdrop */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 280, height: 280, background: 'rgba(139,92,246,0.18)', filter: 'blur(64px)', borderRadius: '50%', pointerEvents: 'none' }} />

          <h2 style={{ fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20, position: 'relative', zIndex: 1 }}>
            Il tuo rango
          </h2>

          {/* Floating rank badge */}
          <div style={{ position: 'relative', marginBottom: 24, zIndex: 1, animation: 'rankFloat 4s ease-in-out infinite' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #a855f7, #4f46e5)', borderRadius: '2rem', filter: 'blur(10px)', opacity: 0.5 }} />
            <div style={{
              position: 'relative', width: 112, height: 128,
              background: 'linear-gradient(to bottom, #1e293b, #0f172a)',
              borderRadius: '3rem 3rem 4rem 4rem',
              border: '2px solid #7c3aed',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 0 rgba(168,85,247,0.5)',
              animation: 'pulseBorder 2s ease-in-out infinite',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.08), transparent)' }} />
              <Flame style={{ width: 40, height: 40, color: '#c084fc', marginBottom: 4, filter: 'drop-shadow(0 0 8px rgba(192,132,252,0.9))' }} />
              <span style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {userStats ? userStats.puntiRankiard.toLocaleString('it-IT') : '…'}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4 }}>
                {tierInfo ? tierInfo.tier.name : '…'}
              </span>
            </div>
            <div style={{
              position: 'absolute', bottom: -10, right: -10, width: 30, height: 30,
              background: '#0f172a', borderRadius: '50%', border: '1px solid #334155',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8' }}>{tierInfo?.tier.numeral ?? '?'}</span>
            </div>
          </div>

          {/* Progress bar */}
          {userStats && tierInfo && (
            <div style={{ width: '100%', maxWidth: 300, marginBottom: 20, zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                <span style={{ color: '#cbd5e1' }}>{tierInfo.tier.name}</span>
                {tierInfo.nextTier ? (
                  <span style={{ color: '#a78bfa' }}>
                    {tierInfo.nextTier.name} <span style={{ color: '#475569' }}>({tierInfo.nextTier.min.toLocaleString('it-IT')})</span>
                  </span>
                ) : (
                  <span style={{ color: '#f59e0b' }}>Rango massimo 👑</span>
                )}
              </div>
              <div style={{ height: 10, width: '100%', background: '#0f172a', borderRadius: 999, border: '1px solid #1e293b', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${barWidth}%`,
                  background: 'linear-gradient(to right, #7c3aed, #6366f1, #60a5fa)',
                  borderRadius: 999,
                  transition: 'width 1.5s cubic-bezier(0.16,1,0.3,1)',
                  position: 'relative',
                }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 32, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.25))' }} />
                </div>
              </div>
              {tierInfo.nextTier && (
                <p style={{ textAlign: 'center', fontSize: 10, color: '#475569', marginTop: 6, fontWeight: 500 }}>
                  <span style={{ color: '#94a3b8' }}>{(tierInfo.nextTier.min - userStats.puntiRankiard).toLocaleString('it-IT')} punti</span> al prossimo grado
                </p>
              )}
            </div>
          )}

          {/* Stats grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 0, width: '100%', maxWidth: 300,
            background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(12px)',
            borderRadius: 18, border: '1px solid rgba(30,41,59,0.8)',
            overflow: 'hidden', zIndex: 1,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', borderRight: '1px solid rgba(30,41,59,0.8)' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{userStats?.gamesPlayed ?? '…'}</span>
              <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginTop: 3 }}>Partite</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', borderRight: '1px solid rgba(30,41,59,0.8)' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#4ade80', lineHeight: 1 }}>{userStats?.gamesWon ?? '…'}</span>
              <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginTop: 3 }}>Vittorie</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#60a5fa' }}>
                <TrendingUp style={{ width: 12, height: 12 }} />
                <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>
                  {userStats && userStats.gamesPlayed > 0 ? Math.round((userStats.gamesWon / userStats.gamesPlayed) * 100) : 0}%
                </span>
              </div>
              <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginTop: 3 }}>Win Rate</span>
            </div>
          </div>
        </section>

        {/* ── Panels grid ── */}
        <section style={{ padding: '0 16px 16px' }}>
          {visiblePanels.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                <span style={{ width: 4, height: 16, background: '#7c3aed', borderRadius: 2, display: 'inline-block' }} />
                Sezioni
              </h3>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {visiblePanels.map((panel, idx) => {
              const IconComp = ICON_MAP[panel.icon] || Star;
              const isHovered = hoveredId === panel.id;
              const dynamicBadge = panel.panelKey === 'play' && userStats
                ? `${userStats.puntiRankiard} Rankiard`
                : panel.panelKey === 'profile' && userStats
                ? `${userStats.gamesWon}/${userStats.gamesPlayed} vinte`
                : panel.panelKey === 'rooms'
                ? (activeRoomsCount > 0 ? `${activeRoomsCount} attive` : (panel.badge || 'Nessuna'))
                : panel.badge;

              return (
                <div key={panel.id} style={{ position: 'relative' }}>
                  {isHovered && !editMode && (
                    <div style={{
                      position: 'absolute', inset: -3, borderRadius: 28, pointerEvents: 'none', zIndex: 0,
                      background: `linear-gradient(135deg, ${panel.gradientFrom}, ${panel.gradientTo})`,
                      animation: 'cardGlowBorder 1.4s ease-in-out infinite',
                      filter: 'blur(8px)',
                    }} />
                  )}
                  <div style={{ position: 'relative', borderRadius: 26, overflow: 'hidden', padding: 2, zIndex: 1 }}>
                    <div style={{
                      position: 'absolute', top: '50%', left: '50%', width: '200%', height: '200%',
                      background: `conic-gradient(from 0deg, transparent 0%, ${panel.gradientFrom}cc 14%, ${panel.gradientTo}99 22%, transparent 32%)`,
                      animation: `borderSpin ${5 + (idx % 4) * 1.5}s linear infinite`,
                      pointerEvents: 'none',
                    }} />
                    <button
                      onClick={() => handlePanelClick(panel)}
                      onMouseEnter={() => setHoveredId(panel.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        width: '100%', position: 'relative', zIndex: 1,
                        aspectRatio: '1 / 1',
                        background: `linear-gradient(135deg, ${panel.gradientFrom}, ${panel.gradientTo})`,
                        borderRadius: 22, padding: '28px 16px',
                        border: editMode ? '2px dashed rgba(255,255,255,0.4)' : `1px solid ${isHovered ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
                        cursor: editMode ? 'default' : 'pointer',
                        transform: !editMode && isHovered ? 'scale(1.04) translateY(-5px)' : 'scale(1)',
                        transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.35s ease, border-color 0.2s',
                        boxShadow: isHovered
                          ? `0 30px 60px -10px ${panel.gradientFrom}88, 0 0 0 1px ${panel.gradientFrom}44`
                          : '0 10px 30px rgba(0,0,0,0.3)',
                        overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {isHovered && !editMode && (
                        <div style={{
                          position: 'absolute', top: 0, left: 0, width: '50%', height: '100%',
                          background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.25) 50%, transparent 80%)',
                          animation: 'shimmerSweep 0.7s ease-out forwards',
                          pointerEvents: 'none', zIndex: 2,
                        }} />
                      )}
                      <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%' }}>
                        <div style={{
                          width: 64, height: 64, borderRadius: 18,
                          background: isHovered ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.2)',
                          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                          animation: isHovered && !editMode ? 'iconFloat 1.6s ease-in-out infinite' : 'none',
                          transition: 'background 0.3s',
                          boxShadow: isHovered ? `0 0 24px ${panel.gradientFrom}99` : 'none',
                        }}>
                          <IconComp size={32} color={panel.titleColor ?? '#ffffff'} />
                        </div>
                        <h2 style={{
                          margin: 0, marginBottom: 8, fontSize: 17, fontWeight: 800, color: panel.titleColor ?? '#ffffff',
                          transition: 'letter-spacing 0.3s, text-shadow 0.3s',
                          letterSpacing: isHovered && !editMode ? '0.04em' : '0',
                          textShadow: isHovered ? `0 0 16px ${panel.titleColor ?? '#ffffff'}cc` : 'none',
                        }}>{panel.title}</h2>
                        <p style={{ margin: 0, marginBottom: 14, fontSize: 12, color: panel.subtitleColor ?? 'rgba(255,255,255,0.7)', transition: 'opacity 0.3s', opacity: isHovered ? 1 : 0.75, lineHeight: 1.4 }}>{panel.subtitle}</p>
                        {dynamicBadge && (
                          <div style={{
                            background: panel.badgeColor ?? 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', borderRadius: 20,
                            padding: '5px 14px', fontSize: 12, color: panel.titleColor ?? '#ffffff', fontWeight: 700,
                            transform: isHovered ? 'scale(1.07)' : 'scale(1)', transition: 'transform 0.3s',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                          }}>
                            {dynamicBadge}
                          </div>
                        )}
                      </div>
                      <div style={{ position: 'absolute', bottom: -20, right: -20, width: 120, height: 120, background: 'rgba(255,255,255,0.05)', borderRadius: '50%', filter: 'blur(24px)' }} />
                      <div style={{ position: 'absolute', top: -20, left: -20, width: 80, height: 80, background: 'rgba(255,255,255,0.05)', borderRadius: '50%', filter: 'blur(18px)' }} />
                    </button>
                  </div>

                  {editMode && (
                    <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
                      <button onClick={() => setEditingPanel(panel)}
                        style={{ background: '#2563eb', border: 'none', borderRadius: 6, color: 'white', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Edit3 size={12} />
                      </button>
                      <button onClick={() => handleDelete(panel.id)}
                        style={{ background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={12} />
                      </button>
                      <button onClick={() => handleMove(panel.id, -1)} disabled={idx === 0}
                        style={{ background: '#374151', border: 'none', borderRadius: 6, color: idx === 0 ? '#6b7280' : 'white', width: 28, height: 28, cursor: idx === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronUp size={12} />
                      </button>
                      <button onClick={() => handleMove(panel.id, 1)} disabled={idx === visiblePanels.length - 1}
                        style={{ background: '#374151', border: 'none', borderRadius: 6, color: idx === visiblePanels.length - 1 ? '#6b7280' : 'white', width: 28, height: 28, cursor: idx === visiblePanels.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronDown size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {editMode && (
              <button onClick={() => setEditingPanel('new')}
                style={{
                  background: 'rgba(30,41,59,0.8)', border: '2px dashed #334155', borderRadius: 24,
                  color: '#64748b', cursor: 'pointer', padding: '24px 32px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
                  minHeight: 160, transition: 'border-color 0.2s, color 0.2s', aspectRatio: '1 / 1',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c3aed'; (e.currentTarget as HTMLButtonElement).style.color = '#a78bfa'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#334155'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}>
                <Plus size={32} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Aggiungi riquadro</span>
              </button>
            )}
          </div>
        </section>

        {/* ── Ticker ── */}
        <div style={{ padding: '4px 16px 12px' }}>
          <div style={{
            background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12,
            overflow: 'hidden', display: 'flex', alignItems: 'center',
            boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
          }}>
            <div style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 12px', borderRight: '1px solid rgba(139,92,246,0.2)',
              background: 'rgba(139,92,246,0.1)',
            }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>NEWS</span>
              {isAdmin && (
                <button
                  onClick={openTickerEdit}
                  title="Modifica news"
                  style={{
                    width: 18, height: 18, borderRadius: 4, border: 'none', cursor: 'pointer',
                    background: 'rgba(139,92,246,0.35)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, padding: 0, flexShrink: 0,
                  }}
                >✏️</button>
              )}
            </div>
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative', height: 36 }}>
              <div style={{
                display: 'inline-flex', whiteSpace: 'nowrap',
                animation: `marqueeNews ${tickerDuration}s linear infinite`,
                paddingLeft: 16,
              }}>
                <span style={{ fontSize: 12, color: 'rgba(203,213,225,0.9)', whiteSpace: 'nowrap', lineHeight: '36px' }}>
                  {tickerText}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>{/* end scrollable body */}

      {/* ── Fixed bottom CTA ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
        pointerEvents: 'none',
      }}>
        <div style={{
          pointerEvents: 'auto',
          background: 'linear-gradient(to top, #03050d 55%, rgba(3,5,13,0.92) 80%, transparent)',
          paddingTop: 48, paddingBottom: 20, paddingLeft: 16, paddingRight: 16,
        }}>
          {/* GIOCA ORA */}
          <button
            onClick={() => !editMode && onNavigate('play')}
            onMouseEnter={() => setGiocaHovered(true)}
            onMouseLeave={() => setGiocaHovered(false)}
            style={{
              width: '100%', position: 'relative', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', padding: '14px 20px',
              background: 'linear-gradient(to bottom, #22c55e, #16a34a)',
              borderRadius: 18, border: '1px solid rgba(74,222,128,0.3)',
              cursor: editMode ? 'default' : 'pointer', marginBottom: 10,
              transform: giocaHovered && !editMode ? 'translateY(-2px)' : 'translateY(0)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              animation: 'homeGiocaGlow 2.5s ease-in-out infinite',
              opacity: editMode ? 0.5 : 1,
            }}
          >
            <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: 'linear-gradient(to bottom, rgba(255,255,255,0.12), transparent)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: 'rgba(255,255,255,0.18)', padding: 8, borderRadius: 12 }}>
                <Gamepad2 style={{ width: 22, height: 22, color: 'white' }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: 'white', letterSpacing: '0.02em', lineHeight: 1 }}>GIOCA ORA</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(220,252,231,0.9)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>Guadagna Rankiard</div>
              </div>
            </div>
            <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
              <Play style={{ width: 14, height: 14, color: 'white', fill: 'white' }} />
            </div>
          </button>

          {/* Quick links */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {[
              { id: 'training',    icon: BookOpen, label: 'Allena'     },
              { id: 'gym',         icon: Shield,   label: 'Palestre'   },
              { id: 'draft',       icon: Shuffle,  label: 'Draft'      },
              { id: 'leaderboard', icon: Trophy,   label: 'Classifica' },
            ].map(item => {
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => !editMode && onNavigate(item.id as any)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '8px 4px', borderRadius: 12, border: 'none',
                    background: 'rgba(255,255,255,0.04)', cursor: editMode ? 'default' : 'pointer',
                    transition: 'background 0.15s',
                    opacity: editMode ? 0.4 : 1,
                  }}
                  onMouseEnter={e => { if (!editMode) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
                >
                  <IconComp style={{ width: 18, height: 18, color: '#94a3b8' }} />
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Saving indicator ── */}
      {saving && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 18px', color: '#94a3b8', fontSize: 13, zIndex: 9000 }}>
          Salvataggio...
        </div>
      )}

      {/* ── Ticker edit modal ── */}
      {tickerEditOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        }} onClick={() => setTickerEditOpen(false)}>
          <div style={{
            background: 'linear-gradient(135deg, #1e1b4b, #0f172a)', borderRadius: 20,
            border: '1px solid rgba(139,92,246,0.3)', padding: 28, width: '90%', maxWidth: 520,
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#e2e8f0' }}>✏️ Modifica News</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'rgba(148,163,184,0.7)' }}>Una news per riga — scorrono automaticamente nel ticker</p>
            <textarea
              value={tickerEditText}
              onChange={e => setTickerEditText(e.target.value)}
              rows={10}
              style={{
                width: '100%', borderRadius: 10, border: '1px solid rgba(139,92,246,0.3)',
                background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 13, lineHeight: 1.6,
                padding: '10px 12px', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={saveTickerEdit}
                disabled={tickerSaving}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff',
                  fontWeight: 700, fontSize: 14, opacity: tickerSaving ? 0.6 : 1,
                }}
              >{tickerSaving ? 'Salvataggio...' : 'Salva'}</button>
              <button
                onClick={() => setTickerEditOpen(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(139,92,246,0.3)',
                  background: 'transparent', color: 'rgba(203,213,225,0.7)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}
              >Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Panel editor modal ── */}
      {editingPanel !== null && (
        <PanelEditorModal
          panel={editingPanel === 'new' ? null : editingPanel}
          onSave={handlePanelSave}
          onClose={() => setEditingPanel(null)}
          authToken={authToken}
        />
      )}

      {showTournaments && (
        <TournamentPanel userId={userId || 0} username={playerName} onClose={() => setShowTournaments(false)} onJoinMatch={onJoinTournamentMatch} />
      )}
      {showClubs && (
        <ClubPanel userId={userId || 0} username={playerName} onClose={() => setShowClubs(false)} />
      )}
      <SeasonalEventsPanel isOpen={showSeasonalEvents} onClose={() => setShowSeasonalEvents(false)} />
    </div>
  );
}
