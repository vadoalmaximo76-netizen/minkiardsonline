import React, { useState, useEffect } from "react";
import { Trophy, ArrowLeft, UserPlus, MessageCircle, Swords, Check, X } from "lucide-react";

interface LeaderboardEntry {
  id: number;
  username: string;
  avatar: string | null;
  puntiRankiard: number;
  gamesPlayed: number;
  gamesWon: number;
  minutesPlayed: number;
}

interface RankiardLeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: number;
  currentGameId?: string;
}

type ActionState = 'idle' | 'loading' | 'success' | 'error';

interface PlayerActions {
  friend: ActionState;
  message: ActionState;
  challenge: ActionState;
}

interface TooltipButtonProps {
  icon: React.ReactNode;
  successIcon?: React.ReactNode;
  tooltip: string;
  state: ActionState;
  color?: string;
  onClick: () => void;
}

const TooltipButton: React.FC<TooltipButtonProps> = ({
  icon, successIcon, tooltip, state, color = 'rgba(255,255,255,0.5)', onClick
}) => {
  const [hovered, setHovered] = useState(false);

  const isDisabled = state === 'loading' || state === 'success';

  const bgColor = state === 'success'
    ? 'rgba(74,222,128,0.15)'
    : state === 'error'
    ? 'rgba(248,113,113,0.15)'
    : hovered ? 'rgba(255,255,255,0.1)' : 'transparent';

  const iconColor = state === 'success'
    ? '#4ade80'
    : state === 'error'
    ? '#f87171'
    : state === 'loading'
    ? 'rgba(255,255,255,0.3)'
    : hovered ? 'white' : color;

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={isDisabled ? undefined : onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={isDisabled}
        style={{
          background: bgColor,
          border: 'none',
          color: iconColor,
          cursor: isDisabled ? 'default' : 'pointer',
          padding: '6px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          opacity: state === 'loading' ? 0.5 : 1,
        }}
      >
        {state === 'success' && successIcon ? successIcon : icon}
      </button>
      {hovered && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.9)',
          color: 'white',
          fontSize: 11,
          padding: '4px 8px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 10,
          border: '1px solid rgba(255,255,255,0.15)',
        }}>
          {state === 'success' ? '✓ ' : state === 'error' ? '✗ ' : ''}{tooltip}
        </div>
      )}
    </div>
  );
};

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

export const RankiardLeaderboard: React.FC<RankiardLeaderboardProps> = ({
  isOpen,
  onClose,
  currentUserId,
  currentGameId,
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<Record<number, PlayerActions>>({});
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/leaderboard')
        .then(r => r.json())
        .then(d => {
          setLeaderboard(d.leaderboard || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const setAction = (userId: number, key: keyof PlayerActions, state: ActionState) => {
    setActions(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] || { friend: 'idle', message: 'idle', challenge: 'idle' }), [key]: state },
    }));
  };

  const getAction = (userId: number, key: keyof PlayerActions): ActionState =>
    actions[userId]?.[key] ?? 'idle';

  const handleFriend = async (p: LeaderboardEntry) => {
    setAction(p.id, 'friend', 'loading');
    try {
      const res = await authFetch('/api/friends/requests', {
        method: 'POST',
        body: JSON.stringify({ addresseeId: p.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAction(p.id, 'friend', 'success');
        showToast(`Richiesta inviata a ${p.username}`, true);
      } else {
        setAction(p.id, 'friend', 'error');
        const msg = data.error === 'Already friends'
          ? 'Siete già amici'
          : data.error === 'Friend request already sent'
          ? 'Richiesta già inviata'
          : data.error || 'Errore';
        showToast(msg, false);
        setTimeout(() => setAction(p.id, 'friend', 'idle'), 2500);
      }
    } catch {
      setAction(p.id, 'friend', 'error');
      showToast('Errore di rete', false);
      setTimeout(() => setAction(p.id, 'friend', 'idle'), 2500);
    }
  };

  const handleMessage = async (p: LeaderboardEntry) => {
    setAction(p.id, 'message', 'loading');
    try {
      const res = await authFetch('/api/messages/conversation', {
        method: 'POST',
        body: JSON.stringify({ recipientId: p.id }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        setAction(p.id, 'message', 'success');
        showToast(`Conversazione aperta con ${p.username}`, true);
        setTimeout(() => setAction(p.id, 'message', 'idle'), 3000);
      } else {
        setAction(p.id, 'message', 'error');
        showToast(data.error || 'Errore', false);
        setTimeout(() => setAction(p.id, 'message', 'idle'), 2500);
      }
    } catch {
      setAction(p.id, 'message', 'error');
      showToast('Errore di rete', false);
      setTimeout(() => setAction(p.id, 'message', 'idle'), 2500);
    }
  };

  const handleChallenge = async (p: LeaderboardEntry) => {
    if (!currentGameId) {
      showToast('Devi essere in una partita per sfidare', false);
      return;
    }
    setAction(p.id, 'challenge', 'loading');
    try {
      const res = await authFetch('/api/friends/invite', {
        method: 'POST',
        body: JSON.stringify({ friendId: p.id, gameId: currentGameId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAction(p.id, 'challenge', 'success');
        showToast(`Sfida inviata a ${p.username}!`, true);
        setTimeout(() => setAction(p.id, 'challenge', 'idle'), 3000);
      } else {
        setAction(p.id, 'challenge', 'error');
        showToast(data.error || 'Errore', false);
        setTimeout(() => setAction(p.id, 'challenge', 'idle'), 2500);
      }
    } catch {
      setAction(p.id, 'challenge', 'error');
      showToast('Errore di rete', false);
      setTimeout(() => setAction(p.id, 'challenge', 'idle'), 2500);
    }
  };

  const emojis = ['😎', '🔥', '⚡', '🎮', '👑', '💎', '🐉', '🦁'];

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999999, background: '#060918', display: 'flex', flexDirection: 'column' }}>

      {toast && (
        <div style={{
          position: 'fixed',
          top: 70,
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.ok ? 'rgba(20,80,40,0.95)' : 'rgba(80,20,20,0.95)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: 8,
          fontSize: 13,
          zIndex: 10000000,
          border: `1px solid ${toast.ok ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
        }}>
          {toast.ok ? <Check width={14} height={14} color="#4ade80" /> : <X width={14} height={14} color="#f87171" />}
          {toast.msg}
        </div>
      )}

      <div style={{ padding: '16px', background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Trophy style={{ color: '#facc15', width: 24, height: 24 }} />
          <h1 style={{ margin: 0, color: 'white', fontSize: 18 }}>Classifica Rankiard</h1>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 8 }}>
          <ArrowLeft width={20} height={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', minHeight: 0 }}>
        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>Caricamento...</div>
        ) : leaderboard.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.3)' }}>Nessun giocatore</div>
        ) : leaderboard.map((p, i) => (
          <div
            key={p.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 80px 80px 80px auto',
              gap: 12,
              padding: '12px',
              marginBottom: 8,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
              alignItems: 'center',
              borderLeft: p.id === currentUserId ? '3px solid rgba(8,145,178,0.6)' : '3px solid transparent',
            }}
          >
            <div style={{ fontSize: 18 }}>
              {i < 3 ? (i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉') : emojis[i % emojis.length]}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>
                {emojis[(parseInt(p.avatar?.replace('avatar-', '') || '0') - 1) % emojis.length]}
              </span>
              <span style={{ color: p.id === currentUserId ? '#67e8f9' : 'white', fontSize: 14 }}>
                {p.username}{p.id === currentUserId ? ' (tu)' : ''}
              </span>
            </div>
            <div style={{ textAlign: 'center', color: '#facc15', fontWeight: 700 }}>{p.puntiRankiard}</div>
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>{p.gamesPlayed}</div>
            <div style={{ textAlign: 'center', color: '#4ade80' }}>{p.gamesWon}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {p.id !== currentUserId ? (
                <>
                  <TooltipButton
                    icon={<UserPlus width={15} height={15} />}
                    successIcon={<Check width={15} height={15} />}
                    tooltip={getAction(p.id, 'friend') === 'success' ? 'Richiesta inviata' : 'Aggiungi ai tuoi amici'}
                    state={getAction(p.id, 'friend')}
                    color="rgba(74,222,128,0.7)"
                    onClick={() => handleFriend(p)}
                  />
                  <TooltipButton
                    icon={<MessageCircle width={15} height={15} />}
                    successIcon={<Check width={15} height={15} />}
                    tooltip="Messaggio privato"
                    state={getAction(p.id, 'message')}
                    color="rgba(103,232,249,0.7)"
                    onClick={() => handleMessage(p)}
                  />
                  <TooltipButton
                    icon={<Swords width={15} height={15} />}
                    successIcon={<Check width={15} height={15} />}
                    tooltip={currentGameId ? 'Sfida' : 'Sfida (non sei in partita)'}
                    state={getAction(p.id, 'challenge')}
                    color={currentGameId ? 'rgba(250,204,21,0.7)' : 'rgba(255,255,255,0.2)'}
                    onClick={() => handleChallenge(p)}
                  />
                </>
              ) : (
                <div style={{ width: 90 }} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RankiardLeaderboard;
