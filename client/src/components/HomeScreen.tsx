import React, { useState, useEffect, useRef } from 'react';
import {
  Gamepad2, GraduationCap, Users, User, Trophy, Clock, Star, Award, Sparkles,
  Settings, Shuffle, Shield, Crown, Sword, Zap, Flame, Heart, BookOpen, Globe,
  Lock, Bell, Gift, Target, Rocket, ChevronUp, ChevronDown, Trash2, Edit3,
  Plus, X, Check, GripVertical
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
  onNavigate: (section: 'play' | 'training' | 'rooms' | 'profile' | 'admin' | 'draft' | 'leaderboard' | 'tournaments' | 'fanta') => void;
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
      badgeColor: 'rgba(0,0,0,0.35)',
      sortOrder: 99,
      adminOnly: false,
    }
  );

  const set = (key: keyof HomePanel, val: any) => setForm(f => ({ ...f, [key]: val }));

  const IconComp = ICON_MAP[form.icon] || Star;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#0f172a', border: '1px solid #334155', borderRadius: 16,
        padding: 24, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto',
        color: '#e2e8f0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{panel ? 'Modifica Pannello' : 'Nuovo Pannello'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 12, color: '#94a3b8' }}>Anteprima</label>
          <div style={{
            borderRadius: 16, padding: '20px 24px', background: `linear-gradient(135deg, ${form.gradientFrom}, ${form.gradientTo})`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
          }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 12 }}>
              <IconComp size={28} color={form.titleColor} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, color: form.titleColor }}>{form.title || 'Titolo'}</span>
            <span style={{ fontSize: 12, color: form.subtitleColor }}>{form.subtitle || 'Sottotitolo'}</span>
            {form.badge && (
              <span style={{ background: form.badgeColor, borderRadius: 20, padding: '4px 12px', fontSize: 11, color: form.titleColor }}>{form.badge}</span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Titolo</label>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Azione (panelKey)</label>
              <select value={form.panelKey} onChange={e => set('panelKey', e.target.value)}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }}>
                {Object.keys(PANEL_KEY_ACTIONS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Sottotitolo</label>
            <input value={form.subtitle} onChange={e => set('subtitle', e.target.value)}
              style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Icona</label>
            <select value={form.icon} onChange={e => set('icon', e.target.value)}
              style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '7px 10px', fontSize: 13 }}>
              {ICON_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Colore gradiente (inizio)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.gradientFrom} onChange={e => set('gradientFrom', e.target.value)}
                  style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6 }} />
                <input value={form.gradientFrom} onChange={e => set('gradientFrom', e.target.value)}
                  style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '7px 8px', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Colore gradiente (fine)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.gradientTo} onChange={e => set('gradientTo', e.target.value)}
                  style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6 }} />
                <input value={form.gradientTo} onChange={e => set('gradientTo', e.target.value)}
                  style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '7px 8px', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Colore titolo</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.titleColor.startsWith('#') ? form.titleColor : '#ffffff'}
                  onChange={e => set('titleColor', e.target.value)}
                  style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6 }} />
                <input value={form.titleColor} onChange={e => set('titleColor', e.target.value)}
                  style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '7px 8px', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Colore sottotitolo</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.subtitleColor.startsWith('#') ? form.subtitleColor : '#ffffff'}
                  onChange={e => set('subtitleColor', e.target.value)}
                  style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6 }} />
                <input value={form.subtitleColor} onChange={e => set('subtitleColor', e.target.value)}
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
  @keyframes titleGlowPulse {
    0%, 100% { text-shadow: 0 0 40px rgba(168,85,247,0.5), 0 0 80px rgba(168,85,247,0.3); }
    50%       { text-shadow: 0 0 70px rgba(168,85,247,1), 0 0 130px rgba(168,85,247,0.7), 0 0 180px rgba(236,72,153,0.5); }
  }
  @keyframes cardGlowBorder {
    0%, 100% { opacity: 0.35; }
    50%       { opacity: 0.85; }
  }
`;

export function HomeScreen({ playerName, userId, onNavigate, onJoinTournamentMatch, userEmail, initialShowTournaments, onInitialShowTournamentsHandled }: HomeScreenProps) {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [activeRoomsCount, setActiveRoomsCount] = useState(0);
  const [randomQuote, setRandomQuote] = useState("");
  const [panels, setPanels] = useState<HomePanel[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editingPanel, setEditingPanel] = useState<HomePanel | null | 'new'>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [titleHovered, setTitleHovered] = useState(false);
  const [saving, setSaving] = useState(false);
  const isAdmin = userEmail === 'lucaforte94@gmail.com';

  const authToken = localStorage.getItem('authToken') || '';

  useEffect(() => {
    const quotes = [
      "Viva il Pelux",
      "Entra nel vivo del gioco scegliendo la sezione che preferisci",
      "Lo sapevi che puoi compare skin speciali per le tue carte? Vai su PROFILO E STORE e scegli SKIN CARTE",
      "Vuoi capire meglio il meccanismo delle Minkiards? Vai su ALLENAMENTO e premi su REGOLAMENTO per non avere più dubbi!",
      "Minkiards è un progetto indipendente nato nel 2012, per maggiori info contatta vadoalmaximo76@gmail.com"
    ];
    setRandomQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);

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
        if (authToken) {
          const statsRes = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${authToken}` } });
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
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="min-h-screen bg-arena-deep flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: HOME_STYLES }} />
      <div className="fixed inset-0 pointer-events-none animate-color-shift" style={{ background: 'radial-gradient(ellipse at 20% 10%, rgba(88, 28, 135, 0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(30, 58, 138, 0.3) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(6, 182, 212, 0.15) 0%, transparent 60%), radial-gradient(ellipse at 10% 70%, rgba(139, 92, 246, 0.2) 0%, transparent 50%), linear-gradient(180deg, #03050d 0%, #070b1a 30%, #0a1028 60%, #060918 100%)' }} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[120px] animate-bg-float-1" style={{ background: 'radial-gradient(circle, #9333ea, transparent 65%)', opacity: 0.25, top: '10%', left: '10%' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-[100px] animate-bg-float-2" style={{ background: 'radial-gradient(circle, #3b82f6, transparent 65%)', opacity: 0.2, bottom: '15%', right: '10%' }} />
        <div className="absolute w-[450px] h-[450px] rounded-full blur-[90px] animate-bg-float-3" style={{ background: 'radial-gradient(circle, #06b6d4, transparent 65%)', opacity: 0.15, top: '50%', left: '60%' }} />
        <div className="absolute w-[550px] h-[550px] rounded-full blur-[110px] animate-bg-float-4" style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 65%)', opacity: 0.12, top: '65%', left: '5%' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full blur-[80px] animate-bg-float-5" style={{ background: 'radial-gradient(circle, #6366f1, transparent 65%)', opacity: 0.1, top: '20%', right: '20%' }} />
        <div className="absolute inset-0 animate-aurora-1" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(139, 92, 246, 0.08) 30%, rgba(59, 130, 246, 0.06) 50%, rgba(139, 92, 246, 0.08) 70%, transparent 100%)', opacity: 0.6, height: '40%', top: '10%' }} />
        <div className="absolute inset-0 animate-aurora-2" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.06) 25%, rgba(139, 92, 246, 0.08) 50%, rgba(59, 130, 246, 0.06) 75%, transparent 100%)', opacity: 0.4, height: '35%', bottom: '15%', top: 'auto' }} />
        <div className="absolute w-[700px] h-[700px] rounded-full blur-[150px] animate-nebula-pulse" style={{ background: 'radial-gradient(circle, rgba(88, 28, 135, 0.12), transparent 60%)', opacity: 0.4, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      </div>

      {/* Header */}
      <div className="text-center mb-12 relative z-10">
        <h1
          className="text-6xl md:text-7xl font-black tracking-wider mb-4 cursor-default select-none"
          style={{ fontFamily: 'Inter, sans-serif', animation: titleHovered ? 'titleGlowPulse 1.2s ease-in-out infinite' : 'none', display: 'flex', justifyContent: 'center', gap: 2 }}
          onMouseEnter={() => setTitleHovered(true)}
          onMouseLeave={() => setTitleHovered(false)}
        >
          {'MINKIARDS'.split('').map((letter, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #c084fc, #f472b6, #c084fc)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: titleHovered ? `letterBounce 0.55s cubic-bezier(0.34,1.56,0.64,1) both` : 'none',
                animationDelay: titleHovered ? `${i * 45}ms` : '0ms',
                transition: 'filter 0.2s',
                filter: titleHovered ? 'drop-shadow(0 0 8px rgba(192,132,252,0.9))' : 'drop-shadow(0 0 4px rgba(192,132,252,0.4))',
              }}
            >
              {letter}
            </span>
          ))}
        </h1>
        <p className="text-slate-400 text-lg">
          Benvenuto, <span className="text-white font-semibold">{playerName}</span>
        </p>
        {isAdmin && (
          <button
            onClick={() => setEditMode(e => !e)}
            style={{
              marginTop: 12, background: editMode ? 'linear-gradient(135deg,#059669,#0d9488)' : '#1e293b',
              border: `1px solid ${editMode ? '#059669' : '#334155'}`, borderRadius: 8,
              color: editMode ? 'white' : '#94a3b8', padding: '6px 16px', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6
            }}>
            <Edit3 size={12} /> {editMode ? 'Fine modifica' : 'Modifica riquadri'}
          </button>
        )}
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full relative z-10">
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
              {/* Animated glow ring behind card */}
              {isHovered && !editMode && (
                <div style={{
                  position: 'absolute', inset: -3, borderRadius: 27, pointerEvents: 'none', zIndex: 0,
                  background: `linear-gradient(135deg, ${panel.gradientFrom}, ${panel.gradientTo})`,
                  animation: 'cardGlowBorder 1.4s ease-in-out infinite',
                  filter: 'blur(8px)',
                }} />
              )}
              <button
                onClick={() => handlePanelClick(panel)}
                onMouseEnter={() => setHoveredId(panel.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  width: '100%', position: 'relative', zIndex: 1,
                  background: `linear-gradient(135deg, ${panel.gradientFrom}, ${panel.gradientTo})`,
                  borderRadius: 24, padding: '24px 32px',
                  border: editMode ? '2px dashed rgba(255,255,255,0.4)' : `1px solid ${isHovered ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
                  cursor: editMode ? 'default' : 'pointer',
                  transform: !editMode && isHovered ? 'scale(1.05) translateY(-5px)' : 'scale(1)',
                  transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.35s ease, border-color 0.2s',
                  boxShadow: isHovered
                    ? `0 30px 60px -10px ${panel.gradientFrom}88, 0 0 0 1px ${panel.gradientFrom}44`
                    : '0 10px 30px rgba(0,0,0,0.3)',
                  overflow: 'hidden',
                }}
              >
                {/* Shimmer sweep on hover */}
                {isHovered && !editMode && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, width: '50%', height: '100%',
                    background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.25) 50%, transparent 80%)',
                    animation: 'shimmerSweep 0.7s ease-out forwards',
                    pointerEvents: 'none', zIndex: 2,
                  }} />
                )}
                <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 16,
                    background: isHovered ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                    animation: isHovered && !editMode ? 'iconFloat 1.6s ease-in-out infinite' : 'none',
                    transition: 'background 0.3s',
                    boxShadow: isHovered ? `0 0 20px ${panel.gradientFrom}88` : 'none',
                  }}>
                    <IconComp size={32} color={panel.titleColor} />
                  </div>
                  <h2 style={{
                    margin: 0, marginBottom: 8, fontSize: 20, fontWeight: 700, color: panel.titleColor,
                    transition: 'letter-spacing 0.3s, text-shadow 0.3s',
                    letterSpacing: isHovered && !editMode ? '0.04em' : '0',
                    textShadow: isHovered ? `0 0 16px ${panel.titleColor}cc` : 'none',
                  }}>{panel.title}</h2>
                  <p style={{ margin: 0, marginBottom: 16, fontSize: 14, color: panel.subtitleColor, transition: 'opacity 0.3s', opacity: isHovered ? 1 : 0.85 }}>{panel.subtitle}</p>
                  {dynamicBadge && (
                    <div style={{
                      background: panel.badgeColor, backdropFilter: 'blur(8px)', borderRadius: 20,
                      padding: '6px 16px', fontSize: 13, color: panel.titleColor, fontWeight: 500,
                      transform: isHovered ? 'scale(1.07)' : 'scale(1)', transition: 'transform 0.3s',
                    }}>
                      {dynamicBadge}
                    </div>
                  )}
                </div>
                <div style={{ position: 'absolute', bottom: -16, right: -16, width: 96, height: 96, background: 'rgba(255,255,255,0.05)', borderRadius: '50%', filter: 'blur(20px)' }} />
                <div style={{ position: 'absolute', top: -16, left: -16, width: 64, height: 64, background: 'rgba(255,255,255,0.05)', borderRadius: '50%', filter: 'blur(16px)' }} />
              </button>

              {/* Admin edit controls */}
              {editMode && (
                <div style={{
                  position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10
                }}>
                  <button onClick={() => setEditingPanel(panel)}
                    style={{ background: '#2563eb', border: 'none', borderRadius: 6, color: 'white', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Edit3 size={12} />
                  </button>
                  <button onClick={() => handleDelete(panel.id)}
                    style={{ background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={12} />
                  </button>
                  <button onClick={() => handleMove(panel.id, -1)} disabled={idx === 0}
                    style={{ background: idx === 0 ? '#374151' : '#374151', border: 'none', borderRadius: 6, color: idx === 0 ? '#6b7280' : 'white', width: 28, height: 28, cursor: idx === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

        {/* Add new panel button (admin edit mode) */}
        {editMode && (
          <button onClick={() => setEditingPanel('new')}
            style={{
              background: 'rgba(30,41,59,0.8)', border: '2px dashed #334155', borderRadius: 24,
              color: '#64748b', cursor: 'pointer', padding: '24px 32px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
              minHeight: 160, transition: 'border-color 0.2s, color 0.2s'
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c3aed'; (e.currentTarget as HTMLButtonElement).style.color = '#a78bfa'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#334155'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}>
            <Plus size={32} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Aggiungi riquadro</span>
          </button>
        )}
      </div>

      {saving && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 18px', color: '#94a3b8', fontSize: 13, zIndex: 9000 }}>
          Salvataggio...
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 text-center relative z-10 max-w-xl">
        <p className="text-slate-500 text-sm leading-relaxed">{randomQuote}</p>
      </div>

      {/* Panel editor modal */}
      {editingPanel !== null && (
        <PanelEditorModal
          panel={editingPanel === 'new' ? null : editingPanel}
          onSave={handlePanelSave}
          onClose={() => setEditingPanel(null)}
          authToken={authToken}
        />
      )}

      {showTournaments && (
        <TournamentPanel userId={userId || 0} username={playerName} onClose={() => setShowTournaments(false)} />
      )}
      {showClubs && (
        <ClubPanel userId={userId || 0} username={playerName} onClose={() => setShowClubs(false)} />
      )}
      <SeasonalEventsPanel isOpen={showSeasonalEvents} onClose={() => setShowSeasonalEvents(false)} />
    </div>
  );
}
