import React, { useState, useEffect } from "react";
import { Trophy, X, RefreshCw, ArrowLeft } from "lucide-react";

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

const AVATARS = ["😎", "🔥", "⚡", "🎮", "👑", "💎", "🐉", "🦁", "🦊", "🐺", "🎯", "🚀", "💪", "🏆"];

export const RankiardLeaderboard: React.FC<RankiardLeaderboardProps> = ({
  isOpen,
  onClose,
  currentUserId,
  currentGameId
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

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

  const isFullPage = !currentGameId;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 9999999,
      background: '#060918',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        background: 'rgba(0,0,0,0.6)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Trophy style={{ width: 24, height: 24, color: '#facc15' }} />
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 16, margin: 0 }}>
              Classifica Rankiard
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: 0 }}>
              Top 100 giocatori
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => window.location.reload()}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 8, fontSize: 16 }}>
            <RefreshCw style={{ width: 18, height: 18 }} />
          </button>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 8, fontSize: 16 }}>
            <ArrowLeft style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '50px 1fr 100px 80px 80px 80px',
        padding: '12px 20px',
        background: 'rgba(0,0,0,0.4)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        fontSize: 11,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase',
        flexShrink: 0
      }}>
        <div>#</div>
        <div>Giocatore</div>
        <div style={{ textAlign: 'center' }}>PR</div>
        <div style={{ textAlign: 'center' }}>Partite</div>
        <div style={{ textAlign: 'center' }}>Vinte</div>
        <div style={{ textAlign: 'center' }}>Tempo</div>
      </div>

      {/* Rows */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        background: '#0d1228'
      }}>
        {loading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
            Caricamento...
          </div>
        ) : leaderboard.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
            Nessun giocatore
          </div>
        ) : leaderboard.map((p, i) => {
          const rank = i + 1;
          const isMe = p.id === currentUserId;
          const badge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank.toString();
          const getAvatar = (avatarId: string | null) => {
            if (!avatarId) return '👤';
            const idx = parseInt(avatarId.replace('avatar-', '')) - 1;
            return AVATARS[idx % AVATARS.length];
          };

          return (
            <div key={p.id} style={{
              display: 'grid',
              gridTemplateColumns: '50px 1fr 100px 80px 80px 80px',
              padding: '12px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              alignItems: 'center',
              background: isMe ? 'rgba(8,145,178,0.1)' : 'transparent',
              borderLeft: isMe ? '3px solid rgba(8,145,178,0.6)' : '3px solid transparent'
            }}>
              <div style={{ textAlign: 'center', fontSize: 14 }}>
                {typeof badge === 'string' && badge.length > 1 ? badge : rank <= 3 ? badge : rank}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{getAvatar(p.avatar)}</span>
                <span style={{ color: isMe ? '#67e8f9' : 'white', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.username}{isMe ? ' (tu)' : ''}
                </span>
              </div>
              <div style={{ textAlign: 'center', color: '#facc15', fontWeight: 700, fontSize: 13 }}>
                {p.puntiRankiard}
              </div>
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                {p.gamesPlayed}
              </div>
              <div style={{ textAlign: 'center', color: '#4ade80', fontSize: 12, fontWeight: 500 }}>
                {p.gamesWon}
              </div>
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                {p.minutesPlayed < 60 ? `${p.minutesPlayed}m` : `${Math.floor(p.minutesPlayed / 60)}h`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RankiardLeaderboard;
