import React, { useState, useEffect } from 'react';
import { Trophy, ArrowLeft, Clock } from 'lucide-react';

interface ScoreEntry {
  id: number;
  userId: number;
  username: string;
  challengeDate: string;
  totalScore: number;
  ptiRemaining: number;
  starsRemaining: number;
  specialMovesUsed: number;
  turnsUsed: number;
  completed: boolean;
  completedAt: string | null;
}

interface Props {
  onClose: () => void;
  currentUserId?: number;
  playerRank?: number | null;
  playerScore?: ScoreEntry | null;
}

const AVATARS = ['😎', '🔥', '⚡', '🎮', '👑', '💎', '🐉', '🦁', '🦊', '🐺', '🎯', '🚀'];

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const DailyChallengeLeaderboard: React.FC<Props> = ({ onClose, currentUserId, playerRank: playerRankProp, playerScore: playerScoreProp }) => {
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState('');
  const [secondsUntilReset, setSecondsUntilReset] = useState(0);
  // Refreshed from leaderboard endpoint (more accurate than prop)
  const [playerRankLocal, setPlayerRankLocal] = useState<number | null>(playerRankProp ?? null);
  const [playerEntryLocal, setPlayerEntryLocal] = useState<ScoreEntry | null>(playerScoreProp ?? null);

  useEffect(() => {
    setLoading(true);
    const authToken = localStorage.getItem('authToken');
    fetch('/api/daily-challenge/leaderboard', {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    })
      .then(r => r.json())
      .then(d => {
        setLeaderboard(d.leaderboard || []);
        setToday(d.today || '');
        setSecondsUntilReset(d.secondsUntilReset || 0);
        // Use server-provided rank/entry if available (more accurate, includes outside-top-100 case)
        if (d.playerRank) setPlayerRankLocal(d.playerRank);
        if (d.playerEntry) setPlayerEntryLocal(d.playerEntry);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (secondsUntilReset <= 0) return;
    const timer = setInterval(() => setSecondsUntilReset(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsUntilReset]);

  const playerInTop = leaderboard.some(e => e.userId === currentUserId);
  const effectivePlayerRank  = playerRankLocal  ?? playerRankProp  ?? null;
  const effectivePlayerEntry = playerEntryLocal ?? playerScoreProp ?? null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999999, background: 'linear-gradient(160deg, #0a0618, #080f1c, #0a0620)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(234,179,8,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #eab308, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(234,179,8,0.4)', flexShrink: 0 }}>
            <Trophy style={{ color: '#fff' }} width={20} height={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, color: 'white', fontSize: 18, fontWeight: 900 }}>Classifica Sfida del Giorno</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Clock width={11} height={11} color="rgba(148,163,184,0.5)" />
              <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)' }}>Reset in {formatCountdown(secondsUntilReset)}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 10, borderRadius: 10 }}>
          <ArrowLeft width={20} height={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 12px 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(234,179,8,0.2)', borderTopColor: '#eab308', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : leaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(148,163,184,0.4)', fontSize: 15 }}>
            Nessuno ha ancora completato la sfida di oggi.<br />
            <span style={{ fontSize: 13, marginTop: 8, display: 'block' }}>Sii il primo!</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 80px 80px 60px', gap: 8, padding: '12px 8px 4px', alignItems: 'center' }}>
              <div />
              <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Giocatore</span>
              <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>Punteggio</span>
              <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>PTI</span>
              <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>Turni</span>
            </div>

            {leaderboard.map((entry, i) => {
              const isSelf = entry.userId === currentUserId;
              const medalEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
              const isTop3 = i < 3;
              const avatarEmoji = AVATARS[(entry.userId || 0) % AVATARS.length];
              const hasBadge = i < 3;
              return (
                <div key={entry.id} style={{
                  display: 'grid', gridTemplateColumns: '44px 1fr 80px 80px 60px', gap: 8,
                  padding: '10px 8px', marginBottom: 4, borderRadius: 12, alignItems: 'center',
                  background: isSelf ? 'rgba(103,232,249,0.06)' : isTop3 ? 'rgba(255,255,255,0.03)' : 'transparent',
                  border: isSelf ? '1px solid rgba(103,232,249,0.2)' : '1px solid transparent',
                }}>
                  <div style={{ textAlign: 'center', fontSize: medalEmoji ? 18 : 13, color: 'rgba(148,163,184,0.5)', fontWeight: 700 }}>
                    {medalEmoji ?? `#${i + 1}`}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{avatarEmoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: isSelf ? 800 : 600, color: isSelf ? '#67e8f9' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {entry.username}{isSelf ? ' (tu)' : ''}{hasBadge ? ' 🏅' : ''}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', color: '#eab308', fontWeight: 800, fontSize: 14 }}>
                    {entry.totalScore.toLocaleString('it-IT')}
                  </div>
                  <div style={{ textAlign: 'center', color: 'rgba(148,163,184,0.7)', fontSize: 12 }}>
                    {entry.ptiRemaining}
                  </div>
                  <div style={{ textAlign: 'center', color: 'rgba(148,163,184,0.6)', fontSize: 12 }}>
                    {entry.turnsUsed}
                  </div>
                </div>
              );
            })}

            {!playerInTop && effectivePlayerEntry && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 8px 4px', opacity: 0.4 }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                  <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Il tuo risultato</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: '44px 1fr 80px 80px 60px', gap: 8,
                  padding: '10px 8px', borderRadius: 12, alignItems: 'center',
                  background: 'rgba(103,232,249,0.06)', border: '1px solid rgba(103,232,249,0.2)',
                }}>
                  <div style={{ textAlign: 'center', fontSize: 13, color: 'rgba(148,163,184,0.5)', fontWeight: 700 }}>#{effectivePlayerRank}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{AVATARS[(currentUserId || 0) % AVATARS.length]}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#67e8f9' }}>Tu</span>
                  </div>
                  <div style={{ textAlign: 'center', color: '#eab308', fontWeight: 800, fontSize: 14 }}>{effectivePlayerEntry.totalScore.toLocaleString('it-IT')}</div>
                  <div style={{ textAlign: 'center', color: 'rgba(148,163,184,0.7)', fontSize: 12 }}>{effectivePlayerEntry.ptiRemaining}</div>
                  <div style={{ textAlign: 'center', color: 'rgba(148,163,184,0.6)', fontSize: 12 }}>{effectivePlayerEntry.turnsUsed}</div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DailyChallengeLeaderboard;
