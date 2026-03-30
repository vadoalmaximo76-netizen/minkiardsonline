import React, { useState, useEffect } from 'react';
import { Swords, Trophy, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';

interface DailyChallengePanelProps {
  userId?: number;
  onPlay: () => void;
  onLeaderboard: () => void;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const DailyChallengePanel: React.FC<DailyChallengePanelProps> = ({ userId, onPlay, onLeaderboard }) => {
  const [loading, setLoading] = useState(true);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);
  const [playerScore, setPlayerScore] = useState<any>(null);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [secondsUntilReset, setSecondsUntilReset] = useState(0);
  const [today, setToday] = useState('');

  const authToken = localStorage.getItem('authToken');

  useEffect(() => {
    if (!authToken) { setLoading(false); return; }
    fetch('/api/daily-challenge/scenario', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setAlreadyPlayed(d.alreadyPlayed || false);
          setPlayerScore(d.playerScore || null);
          setPlayerRank(d.playerRank || null);
          setSecondsUntilReset(d.secondsUntilReset || 0);
          setToday(d.today || '');
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authToken]);

  useEffect(() => {
    if (secondsUntilReset <= 0) return;
    const timer = setInterval(() => setSecondsUntilReset(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsUntilReset]);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a0a2e, #0f1a2e)',
      border: '1px solid rgba(234,179,8,0.2)',
      borderRadius: 16,
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'linear-gradient(135deg, #eab308, #f97316)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 16px rgba(234,179,8,0.4)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 22 }}>⚔️</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: 16, fontWeight: 800 }}>Sfida del Giorno</h3>
          <p style={{ margin: '2px 0 0', color: 'rgba(148,163,184,0.6)', fontSize: 12 }}>
            {today ? today : 'Uno scenario unico ogni giorno'}
          </p>
        </div>
        {alreadyPlayed && (
          <CheckCircle2 width={22} height={22} color="#4ade80" style={{ flexShrink: 0 }} />
        )}
      </div>

      {!loading && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: '6px 10px' }}>
            <Clock width={13} height={13} color="rgba(234,179,8,0.6)" />
            <span style={{ color: 'rgba(148,163,184,0.6)', fontSize: 12 }}>Reset in</span>
            <span style={{ color: '#eab308', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {formatCountdown(secondsUntilReset)}
            </span>
          </div>

          {alreadyPlayed && playerScore && (
            <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(148,163,184,0.6)', fontSize: 12 }}>Il tuo punteggio</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#eab308', fontWeight: 800, fontSize: 14 }}>{playerScore.totalScore.toLocaleString('it-IT')}</span>
                {playerRank && <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 12 }}>#{playerRank}</span>}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onPlay}
              style={{
                flex: 1,
                background: alreadyPlayed
                  ? 'rgba(255,255,255,0.06)'
                  : 'linear-gradient(135deg, #eab308, #f97316)',
                border: alreadyPlayed ? '1px solid rgba(255,255,255,0.1)' : 'none',
                color: alreadyPlayed ? 'rgba(255,255,255,0.4)' : 'white',
                padding: '11px 14px', borderRadius: 10,
                fontSize: 14, fontWeight: 700, cursor: alreadyPlayed ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: alreadyPlayed ? 'none' : '0 0 20px rgba(234,179,8,0.25)',
              }}
              disabled={alreadyPlayed}
            >
              <Swords width={15} height={15} />
              {alreadyPlayed ? 'Già giocato' : 'Gioca'}
            </button>
            <button
              onClick={onLeaderboard}
              style={{
                background: 'rgba(234,179,8,0.1)',
                border: '1px solid rgba(234,179,8,0.2)',
                color: '#eab308',
                padding: '11px 14px', borderRadius: 10,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Trophy width={15} height={15} />
              Classifica
            </button>
          </div>
        </>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
          <div style={{ width: 24, height: 24, border: '2px solid rgba(234,179,8,0.2)', borderTopColor: '#eab308', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}
    </div>
  );
};

export default DailyChallengePanel;
