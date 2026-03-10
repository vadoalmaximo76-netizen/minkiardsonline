import React, { useState, useEffect } from "react";
import { Trophy, ArrowLeft } from "lucide-react";

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

  const emojis = ['😎', '🔥', '⚡', '🎮', '👑', '💎', '🐉', '🦁'];

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999999, background: '#060918', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Trophy style={{ color: '#facc15', width: 24, height: 24 }} />
          <h1 style={{ margin: 0, color: 'white', fontSize: 18 }}>Classifica Rankiard</h1>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 8 }}>
          <ArrowLeft width={20} height={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {loading ? <div style={{ color: 'rgba(255,255,255,0.5)' }}>Caricamento...</div> : leaderboard.length === 0 ? <div style={{ color: 'rgba(255,255,255,0.3)' }}>Nessun giocatore</div> : leaderboard.map((p, i) => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 80px 80px', gap: 12, padding: '12px', marginBottom: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 8, alignItems: 'center', borderLeft: p.id === currentUserId ? '3px solid rgba(8,145,178,0.6)' : '3px solid transparent' }}>
            <div style={{ fontSize: 18 }}>{i < 3 ? (i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉') : emojis[i % emojis.length]}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{emojis[(parseInt(p.avatar?.replace('avatar-', '') || '0') - 1) % emojis.length]}</span>
              <span style={{ color: p.id === currentUserId ? '#67e8f9' : 'white', fontSize: 14 }}>{p.username}{p.id === currentUserId ? ' (tu)' : ''}</span>
            </div>
            <div style={{ textAlign: 'center', color: '#facc15', fontWeight: 700 }}>{p.puntiRankiard}</div>
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>{p.gamesPlayed}</div>
            <div style={{ textAlign: 'center', color: '#4ade80' }}>{p.gamesWon}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RankiardLeaderboard;
