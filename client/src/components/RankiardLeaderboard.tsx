import React, { useState, useEffect } from "react";
import { Trophy, ArrowLeft, UserPlus, MessageCircle, Swords, Check, X, Crown, Star } from "lucide-react";

interface LeaderboardEntry {
  id: number;
  username: string;
  avatar: string | null;
  puntiRankiard: number;
  gamesPlayed: number;
  gamesWon: number;
  minutesPlayed: number;
  activeTitle?: string | null;
}

const TITLE_MAP: Record<string, { name: string; icon: string; color: string }> = {
  esordiente:      { name: 'Esordiente',       icon: '🎮', color: '#94a3b8' },
  guerriero:       { name: 'Guerriero',         icon: '⚔️', color: '#94a3b8' },
  veterano:        { name: 'Veterano',          icon: '🛡️', color: '#60a5fa' },
  campione:        { name: 'Campione',          icon: '🏆', color: '#60a5fa' },
  dominatore:      { name: 'Dominatore',        icon: '👑', color: '#c084fc' },
  campione_gym:    { name: 'Campione GymMode',  icon: '🏅', color: '#60a5fa' },
  maestro_gym:     { name: 'Maestro Gym',       icon: '🌟', color: '#c084fc' },
  sfidante:        { name: 'Sfidante',          icon: '🔥', color: '#60a5fa' },
  maestro_rank:    { name: 'Maestro',           icon: '💎', color: '#c084fc' },
  leggenda:        { name: 'Leggenda',          icon: '⭐', color: '#fbbf24' },
  campione_torneo: { name: 'Campione Torneo',   icon: '🎖️', color: '#fbbf24' },
  longevo:         { name: 'Longevo',           icon: '⏳', color: '#c084fc' },
};

function getTitleInfo(titleId?: string | null) {
  if (!titleId) return null;
  return TITLE_MAP[titleId] ?? null;
}

interface RankiardLeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: number;
  currentGameId?: string;
  onNavigate?: (section: string) => void;
}

type ActionState = 'idle' | 'loading' | 'success' | 'error';

interface PlayerActions {
  friend: ActionState;
  message: ActionState;
  challenge: ActionState;
}

const LEADERBOARD_STYLES = `
  @keyframes podiumRise {
    0%   { opacity: 0; transform: translateY(30px) scale(0.9); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes goldGlow {
    0%, 100% { box-shadow: 0 0 20px rgba(250,204,21,0.3), 0 0 50px rgba(250,204,21,0.1); }
    50%       { box-shadow: 0 0 40px rgba(250,204,21,0.6), 0 0 80px rgba(250,204,21,0.2); }
  }
  @keyframes silverGlow {
    0%, 100% { box-shadow: 0 0 20px rgba(148,163,184,0.3); }
    50%       { box-shadow: 0 0 40px rgba(148,163,184,0.5); }
  }
  @keyframes bronzeGlow {
    0%, 100% { box-shadow: 0 0 15px rgba(180,107,44,0.3); }
    50%       { box-shadow: 0 0 30px rgba(180,107,44,0.5); }
  }
  @keyframes rowSlideIn {
    0%   { opacity: 0; transform: translateX(-10px); }
    100% { opacity: 1; transform: translateX(0); }
  }
`;

const AVATARS = ['😎', '🔥', '⚡', '🎮', '👑', '💎', '🐉', '🦁', '🦊', '🐺', '🎯', '🚀'];

function getAvatar(avatar: string | null): string {
  const idx = parseInt(avatar?.replace('avatar-', '') || '1') - 1;
  return AVATARS[Math.max(0, idx) % AVATARS.length];
}

function winRate(p: LeaderboardEntry): number {
  return p.gamesPlayed > 0 ? Math.round((p.gamesWon / p.gamesPlayed) * 100) : 0;
}

const authFetch = (url: string, opts: RequestInit = {}) => {
  const token = localStorage.getItem('authToken');
  return fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
};

interface ActionButtonProps {
  icon: React.ReactNode;
  successIcon?: React.ReactNode;
  tooltip: string;
  state: ActionState;
  color?: string;
  onClick: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, successIcon, tooltip, state, color = 'rgba(255,255,255,0.5)', onClick }) => {
  const [hovered, setHovered] = useState(false);
  const isDisabled = state === 'loading' || state === 'success';

  const bg = state === 'success' ? 'rgba(74,222,128,0.15)' : state === 'error' ? 'rgba(248,113,113,0.15)' : hovered ? 'rgba(255,255,255,0.1)' : 'transparent';
  const col = state === 'success' ? '#4ade80' : state === 'error' ? '#f87171' : state === 'loading' ? 'rgba(255,255,255,0.3)' : hovered ? 'white' : color;

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={isDisabled ? undefined : onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={isDisabled}
        title={tooltip}
        style={{ background: bg, border: 'none', color: col, cursor: isDisabled ? 'default' : 'pointer', padding: '6px 7px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease', opacity: state === 'loading' ? 0.5 : 1 }}
      >
        {state === 'success' && successIcon ? successIcon : icon}
      </button>
      {hovered && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.9)', color: 'white', fontSize: 11, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10, border: '1px solid rgba(255,255,255,0.1)' }}>
          {tooltip}
        </div>
      )}
    </div>
  );
};

export const RankiardLeaderboard: React.FC<RankiardLeaderboardProps> = ({ isOpen, onClose, currentUserId, currentGameId, onNavigate }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<Record<number, PlayerActions>>({});
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/leaderboard')
        .then(r => r.json())
        .then(d => { setLeaderboard(d.leaderboard || []); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const setAction = (userId: number, key: keyof PlayerActions, state: ActionState) => {
    setActions(prev => ({ ...prev, [userId]: { ...(prev[userId] || { friend: 'idle', message: 'idle', challenge: 'idle' }), [key]: state } }));
  };

  const getAction = (userId: number, key: keyof PlayerActions): ActionState => actions[userId]?.[key] ?? 'idle';

  const handleFriend = async (p: LeaderboardEntry) => {
    setAction(p.id, 'friend', 'loading');
    try {
      const res = await authFetch('/api/friends/requests', { method: 'POST', body: JSON.stringify({ addresseeId: p.id }) });
      const data = await res.json();
      if (res.ok && data.success) { setAction(p.id, 'friend', 'success'); showToast(`Richiesta inviata a ${p.username}`, true); }
      else {
        setAction(p.id, 'friend', 'error');
        const msg = data.error === 'Already friends' ? 'Siete già amici' : data.error === 'Friend request already sent' ? 'Richiesta già inviata' : data.error || 'Errore';
        showToast(msg, false);
        setTimeout(() => setAction(p.id, 'friend', 'idle'), 2500);
      }
    } catch { setAction(p.id, 'friend', 'error'); showToast('Errore di rete', false); setTimeout(() => setAction(p.id, 'friend', 'idle'), 2500); }
  };

  const handleMessage = async (p: LeaderboardEntry) => {
    setAction(p.id, 'message', 'loading');
    try {
      const res = await authFetch('/api/messages/conversation', { method: 'POST', body: JSON.stringify({ recipientId: p.id }) });
      const data = await res.json();
      if (res.ok && data.id) {
        setAction(p.id, 'message', 'success');
        showToast(`Conversazione aperta con ${p.username}`, true);
        localStorage.setItem('openConversationId', String(data.id));
        if (onNavigate) onNavigate('profile');
      }
      else { setAction(p.id, 'message', 'error'); showToast(data.error || 'Errore', false); setTimeout(() => setAction(p.id, 'message', 'idle'), 2500); }
    } catch { setAction(p.id, 'message', 'error'); showToast('Errore di rete', false); setTimeout(() => setAction(p.id, 'message', 'idle'), 2500); }
  };

  const handleChallenge = async (p: LeaderboardEntry) => {
    setAction(p.id, 'challenge', 'loading');
    try {
      const body: Record<string, any> = { friendId: p.id };
      if (currentGameId) body.gameId = currentGameId;
      const res = await authFetch('/api/friends/invite', { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok && data.success) { setAction(p.id, 'challenge', 'success'); showToast(`Sfida inviata a ${p.username}!`, true); setTimeout(() => setAction(p.id, 'challenge', 'idle'), 3000); }
      else { setAction(p.id, 'challenge', 'error'); showToast(data.error || 'Errore', false); setTimeout(() => setAction(p.id, 'challenge', 'idle'), 2500); }
    } catch { setAction(p.id, 'challenge', 'error'); showToast('Errore di rete', false); setTimeout(() => setAction(p.id, 'challenge', 'idle'), 2500); }
  };

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  const PODIUM = [
    { place: 1, label: '1°', color: '#facc15', bg: 'linear-gradient(160deg, #422006, #1c0f00)', border: 'rgba(250,204,21,0.4)', glow: 'goldGlow', medal: '🥇', size: 72, crown: true },
    { place: 2, label: '2°', color: '#cbd5e1', bg: 'linear-gradient(160deg, #1e293b, #0f172a)', border: 'rgba(148,163,184,0.3)', glow: 'silverGlow', medal: '🥈', size: 60, crown: false },
    { place: 3, label: '3°', color: '#b47c2c', bg: 'linear-gradient(160deg, #292000, #0f0900)', border: 'rgba(180,107,44,0.3)', glow: 'bronzeGlow', medal: '🥉', size: 56, crown: false },
  ];

  return (
    <>
      <style>{LEADERBOARD_STYLES}</style>
      {toast && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? 'rgba(20,80,40,0.97)' : 'rgba(80,20,20,0.97)', color: 'white', padding: '10px 20px', borderRadius: 10, fontSize: 13, zIndex: 10000001, border: `1px solid ${toast.ok ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}`, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
          {toast.ok ? <Check width={14} height={14} color="#4ade80" /> : <X width={14} height={14} color="#f87171" />}
          {toast.msg}
        </div>
      )}

      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999999, display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg, #060918, #08101e, #060912)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(250,204,21,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #facc15, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(250,204,21,0.35)', flexShrink: 0 }}>
              <Trophy style={{ color: '#fff' }} width={22} height={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, color: 'white', fontSize: 20, fontWeight: 900, letterSpacing: '-0.01em' }}>Classifica Rankiard</h1>
              <p style={{ margin: 0, color: 'rgba(148,163,184,0.5)', fontSize: 11, marginTop: 1 }}>I migliori giocatori di Minkiards</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 10, borderRadius: 10, display: 'flex', alignItems: 'center' }}>
            <ArrowLeft width={20} height={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 14 }}>
              <div style={{ width: 44, height: 44, border: '3px solid rgba(250,204,21,0.2)', borderTopColor: '#facc15', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ color: 'rgba(148,163,184,0.4)', fontSize: 13 }}>Caricamento classifica...</span>
            </div>
          ) : leaderboard.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'rgba(148,163,184,0.3)', fontSize: 15 }}>Nessun giocatore in classifica</div>
          ) : (
            <>
              {/* PODIUM — top 3 */}
              {top3.length > 0 && (
                <div style={{ padding: '28px 20px 8px', background: 'linear-gradient(180deg, rgba(250,204,21,0.04), transparent)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, maxWidth: 520, margin: '0 auto' }}>
                    {/* Order: 2nd, 1st, 3rd for visual podium effect */}
                    {[1, 0, 2].map((idx) => {
                      const p = top3[idx];
                      if (!p) return <div key={idx} style={{ flex: 1 }} />;
                      const pod = PODIUM[idx];
                      const isSelf = p.id === currentUserId;
                      const wr = winRate(p);
                      return (
                        <div key={p.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', animation: `podiumRise 0.5s ease ${idx * 0.12}s both` }}>
                          {/* Crown for #1 */}
                          {pod.crown && (
                            <div style={{ fontSize: 24, marginBottom: -4, animation: 'trophyPulse 3s ease-in-out infinite' }}>👑</div>
                          )}
                          {/* Avatar card */}
                          <div style={{
                            width: pod.size + 8, height: pod.size + 8, borderRadius: '50%',
                            background: pod.bg, border: `2px solid ${pod.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: pod.size * 0.5, marginBottom: 10,
                            animation: `${pod.glow} 3s ease-in-out infinite`,
                            outline: isSelf ? '2px solid rgba(103,232,249,0.6)' : 'none',
                            outlineOffset: 3,
                          }}>
                            {getAvatar(p.avatar)}
                          </div>
                          {/* Medal */}
                          <div style={{ fontSize: 20, marginBottom: 4 }}>{pod.medal}</div>
                          {/* Name */}
                          <div style={{ fontSize: idx === 0 ? 14 : 12, fontWeight: 800, color: pod.color, textAlign: 'center', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.username}{isSelf ? ' ✦' : ''}
                          </div>
                          {/* Active title */}
                          {(() => { const ti = getTitleInfo(p.activeTitle); return ti && p.activeTitle !== 'esordiente' ? (
                            <div style={{ fontSize: 10, color: ti.color, fontWeight: 700, marginTop: 2, textAlign: 'center' }}>
                              {ti.icon} {ti.name}
                            </div>
                          ) : null; })()}
                          {/* Points */}
                          <div style={{ fontSize: idx === 0 ? 16 : 13, fontWeight: 900, color: '#facc15', marginTop: 2 }}>
                            {p.puntiRankiard.toLocaleString('it-IT')} PR
                          </div>
                          {/* Win rate */}
                          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', marginTop: 2 }}>{wr}% win rate</div>

                          {/* Podium base */}
                          <div style={{
                            width: '100%', marginTop: 12, borderRadius: '8px 8px 0 0',
                            background: `linear-gradient(180deg, ${pod.border}, ${pod.border.replace('0.4', '0.1').replace('0.3', '0.05')})`,
                            height: idx === 0 ? 48 : idx === 1 ? 32 : 20,
                            border: `1px solid ${pod.border}`, borderBottom: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ fontSize: 15, fontWeight: 900, color: pod.color }}>{pod.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Separator */}
              {rest.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 8px', opacity: 0.4 }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                  <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Tutti i giocatori</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                </div>
              )}

              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 80px 64px 64px 86px', gap: 8, padding: '6px 20px 4px', alignItems: 'center' }}>
                <div />
                <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Giocatore</span>
                <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>PR</span>
                <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>Partite</span>
                <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>Win%</span>
                <div />
              </div>

              {/* Full list (all players, starting from #1) */}
              <div style={{ padding: '0 12px 20px' }}>
                {leaderboard.map((p, i) => {
                  const isSelf = p.id === currentUserId;
                  const wr = winRate(p);
                  const medalEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'grid', gridTemplateColumns: '44px 1fr 80px 64px 64px 86px', gap: 8,
                        padding: '10px 8px', marginBottom: 4, borderRadius: 12, alignItems: 'center',
                        background: isSelf ? 'rgba(103,232,249,0.06)' : i < 3 ? 'rgba(255,255,255,0.03)' : 'transparent',
                        border: isSelf ? '1px solid rgba(103,232,249,0.2)' : '1px solid transparent',
                        transition: 'background 0.15s',
                        animation: `rowSlideIn 0.3s ease ${Math.min(i, 10) * 0.03}s both`,
                      }}
                      onMouseEnter={e => { if (!isSelf) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { if (!isSelf) (e.currentTarget as HTMLDivElement).style.background = i < 3 ? 'rgba(255,255,255,0.03)' : 'transparent'; }}
                    >
                      {/* Rank */}
                      <div style={{ textAlign: 'center', fontSize: medalEmoji ? 18 : 13, color: 'rgba(148,163,184,0.5)', fontWeight: 700 }}>
                        {medalEmoji ?? `#${i + 1}`}
                      </div>

                      {/* Player */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{getAvatar(p.avatar)}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: isSelf ? 800 : 600, color: isSelf ? '#67e8f9' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.username}{isSelf ? ' (tu)' : ''}
                          </div>
                          {(() => { const ti = getTitleInfo(p.activeTitle); return ti && p.activeTitle !== 'esordiente' ? (
                            <div style={{ fontSize: 10, color: ti.color, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ti.icon} {ti.name}
                            </div>
                          ) : null; })()}
                        </div>
                      </div>

                      {/* PR */}
                      <div style={{ textAlign: 'center', color: '#facc15', fontWeight: 800, fontSize: 13 }}>
                        {p.puntiRankiard.toLocaleString('it-IT')}
                      </div>

                      {/* Games played */}
                      <div style={{ textAlign: 'center', color: 'rgba(148,163,184,0.6)', fontSize: 12 }}>
                        {p.gamesPlayed}
                      </div>

                      {/* Win rate */}
                      <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: wr >= 60 ? '#4ade80' : wr >= 40 ? '#e2e8f0' : '#f87171' }}>
                        {wr}%
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                        {p.id !== currentUserId ? (
                          <>
                            <ActionButton icon={<UserPlus width={14} height={14} />} successIcon={<Check width={14} height={14} />} tooltip={getAction(p.id, 'friend') === 'success' ? 'Richiesta inviata' : 'Aggiungi amico'} state={getAction(p.id, 'friend')} color="rgba(74,222,128,0.7)" onClick={() => handleFriend(p)} />
                            <ActionButton icon={<MessageCircle width={14} height={14} />} successIcon={<Check width={14} height={14} />} tooltip="Messaggio privato" state={getAction(p.id, 'message')} color="rgba(103,232,249,0.7)" onClick={() => handleMessage(p)} />
                            <ActionButton icon={<Swords width={14} height={14} />} successIcon={<Check width={14} height={14} />} tooltip="Sfida" state={getAction(p.id, 'challenge')} color="rgba(250,204,21,0.7)" onClick={() => handleChallenge(p)} />
                          </>
                        ) : (
                          <div style={{ width: 90 }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default RankiardLeaderboard;
