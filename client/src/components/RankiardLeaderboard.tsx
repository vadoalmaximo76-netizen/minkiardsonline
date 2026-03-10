import React, { useState, useEffect } from "react";
import { Trophy, Medal, Gamepad2, Clock, Crown, X, Loader2, Swords, ArrowLeft, RefreshCw } from "lucide-react";

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

const AVATAR_EMOJIS = [
  "😎", "🔥", "⚡", "🎮", "👑", "💎", "🐉", "🦁", "🦊", "🐺",
  "🎯", "🚀", "💪", "🏆", "⭐", "🌟", "✨", "💫", "🎭", "🃏",
  "🎲", "🎪", "🎨", "🎬"
];

const DARK_BG = '#060918';
const PANEL_BG = '#0d1228';
const HEADER_BG = 'rgba(0,0,0,0.55)';
const COL_HEADER_BG = 'rgba(0,0,0,0.40)';

export const RankiardLeaderboard: React.FC<RankiardLeaderboardProps> = ({
  isOpen,
  onClose,
  currentUserId,
  currentGameId
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [challengeSent, setChallengeSent] = useState<number | null>(null);

  const isFullPage = !currentGameId;

  useEffect(() => {
    if (isOpen) fetchLeaderboard();
  }, [isOpen]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.error('Error fetching leaderboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleChallenge = async (player: LeaderboardEntry) => {
    if (!currentUserId) { alert('Devi essere loggato per sfidare un giocatore'); return; }
    if (!currentGameId) { alert('Devi essere in una stanza di gioco per sfidare un giocatore.'); return; }
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/friends/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ receiverId: player.id, gameId: currentGameId })
      });
      if (res.ok) {
        setChallengeSent(player.id);
        setTimeout(() => setChallengeSent(null), 3000);
      } else {
        const err = await res.json();
        alert(err.error || 'Impossibile inviare la sfida');
      }
    } catch { alert('Errore di connessione'); }
  };

  const getAvatar = (avatarId: string | null) => {
    if (!avatarId) return "👤";
    const idx = parseInt(avatarId.replace('avatar-', '')) - 1;
    return AVATAR_EMOJIS[idx] || "👤";
  };

  const getBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  if (!isOpen) return null;

  const colGrid = currentGameId
    ? '48px 1fr 90px 80px 90px 80px 90px'
    : '48px 1fr 90px 80px 90px 80px';

  const colHeaders = (
    <div style={{
      display: 'grid',
      gridTemplateColumns: colGrid,
      padding: '8px 16px',
      background: COL_HEADER_BG,
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      flexShrink: 0
    }}>
      {['#', 'Giocatore', 'PR', 'Partite', 'Vinte', 'Tempo', ...(currentGameId ? ['Sfida'] : [])].map((h, i) => (
        <div key={h} style={{
          textAlign: i === 1 ? 'left' : 'center',
          paddingLeft: i === 1 ? 4 : 0,
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'rgba(255,255,255,0.45)'
        }}>{h}</div>
      ))}
    </div>
  );

  const rows = loading ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
      <Loader2 style={{ width: 32, height: 32, color: '#facc15', animation: 'spin 1s linear infinite' }} />
    </div>
  ) : leaderboard.length === 0 ? (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 16px', color: 'rgba(255,255,255,0.4)', gap: 12 }}>
      <Trophy style={{ width: 48, height: 48, opacity: 0.4 }} />
      <p style={{ fontSize: 14, margin: 0 }}>Nessun giocatore in classifica</p>
    </div>
  ) : leaderboard.map((player, index) => {
    const rank = index + 1;
    const isMe = player.id === currentUserId;
    const sent = challengeSent === player.id;
    const badge = getBadge(rank);
    const winRate = player.gamesPlayed > 0 ? Math.round((player.gamesWon / player.gamesPlayed) * 100) : 0;

    let rowBg = 'transparent';
    if (isMe) rowBg = 'rgba(8,145,178,0.15)';
    else if (rank === 1) rowBg = 'rgba(161,98,7,0.15)';
    else if (rank === 2) rowBg = 'rgba(71,85,105,0.15)';
    else if (rank === 3) rowBg = 'rgba(120,53,15,0.15)';

    const nameColor = isMe ? '#67e8f9' : rank <= 3 ? '#ffffff' : 'rgba(255,255,255,0.85)';

    return (
      <div key={player.id} style={{
        display: 'grid',
        gridTemplateColumns: colGrid,
        alignItems: 'center',
        padding: '10px 16px',
        background: rowBg,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        borderLeft: isMe ? '2px solid rgba(8,145,178,0.6)' : '2px solid transparent'
      }}>
        <div style={{ textAlign: 'center' }}>
          {badge
            ? <span style={{ fontSize: 18 }}>{badge}</span>
            : <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 500 }}>{rank}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{getAvatar(player.avatar)}</span>
          <span style={{ color: nameColor, fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {player.username}{isMe ? ' (tu)' : ''}
          </span>
        </div>
        <div style={{ textAlign: 'center', color: '#facc15', fontWeight: 700, fontSize: 14 }}>
          {player.puntiRankiard}
        </div>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
          {player.gamesPlayed}
        </div>
        <div style={{ textAlign: 'center', fontSize: 13 }}>
          <span style={{ color: '#4ade80', fontWeight: 500 }}>{player.gamesWon}</span>
          {player.gamesPlayed > 0 && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginLeft: 4 }}>({winRate}%)</span>}
        </div>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
          {formatTime(player.minutesPlayed)}
        </div>
        {currentGameId && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {isMe ? <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>—</span> : (
              <button onClick={() => handleChallenge(player)} disabled={sent}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 8, border: 'none', cursor: sent ? 'default' : 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: sent ? 'rgba(21,128,61,0.4)' : 'rgba(153,27,27,0.4)',
                  color: sent ? '#86efac' : '#fca5a5'
                }}>
                <Swords style={{ width: 12, height: 12 }} />
                {sent ? 'Inviato!' : 'Sfida'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  });

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 100002,
    display: 'flex',
    flexDirection: 'column',
    background: '#ff0000'
  };

  if (isFullPage) {
    return (
      <div style={overlayStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: HEADER_BG, borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: 'rgba(234,179,8,0.15)', borderRadius: 8 }}>
              <Trophy style={{ width: 20, height: 20, color: '#facc15' }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#ffffff' }}>Classifica Rankiard</h1>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Top 100 giocatori</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={fetchLeaderboard} title="Aggiorna"
              style={{ padding: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', borderRadius: 8 }}>
              <RefreshCw style={{ width: 16, height: 16 }} />
            </button>
            <button onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
              <ArrowLeft style={{ width: 16, height: 16 }} />
              Indietro
            </button>
          </div>
        </div>

        {colHeaders}

        <div style={{ flex: 1, overflowY: 'auto', background: PANEL_BG }}>
          {rows}
          <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
            I dati vengono aggiornati automaticamente durante le partite
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, background: 'rgba(0,0,0,0.82)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 700, maxHeight: 'min(90vh, 640px)', background: PANEL_BG, borderRadius: 12, border: '1px solid rgba(234,179,8,0.25)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'linear-gradient(90deg, rgba(120,53,15,0.35), rgba(124,45,18,0.25))', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Trophy style={{ width: 20, height: 20, color: '#facc15' }} />
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#ffffff' }}>Classifica Rankiard</h2>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Top 100 giocatori</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={fetchLeaderboard}
              style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', borderRadius: 6 }}>
              <RefreshCw style={{ width: 16, height: 16 }} />
            </button>
            <button onClick={onClose}
              style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', borderRadius: 6 }}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>

        {colHeaders}

        <div style={{ overflowY: 'auto', flex: 1, background: PANEL_BG }}>
          {rows}
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
          Sfida un giocatore — riceverà una notifica in gioco
        </div>
      </div>
    </div>
  );
};

export default RankiardLeaderboard;
