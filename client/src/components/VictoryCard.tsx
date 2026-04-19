import React from 'react';

export interface VictoryCardStats {
  winnerName: string;
  pointsEarned?: number;
  totalDamageDealt: number;
  cardsPlayed: number;
  turnsPlayed: number;
  matchDuration: number;
}

interface VictoryCardProps {
  stats: VictoryCardStats;
  cardRef: React.RefObject<HTMLDivElement | null>;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatDate(): string {
  const now = new Date();
  return now.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const VictoryCard: React.FC<VictoryCardProps> = ({ stats, cardRef }) => {
  const statItems = [
    { label: 'Danni Inflitti', value: stats.totalDamageDealt, icon: '⚔️' },
    { label: 'Carte Giocate', value: stats.cardsPlayed, icon: '🃏' },
    { label: 'Turni Giocati', value: stats.turnsPlayed, icon: '🔄' },
    { label: 'Durata', value: formatDuration(stats.matchDuration), icon: '⏱️' },
  ];

  return (
    <div
      ref={cardRef as React.RefObject<HTMLDivElement>}
      style={{
        position: 'fixed',
        left: '-9999px',
        top: '-9999px',
        width: '480px',
        height: '300px',
        background: 'linear-gradient(135deg, #0d0820 0%, #1a0f35 50%, #0d0820 100%)',
        borderRadius: '16px',
        border: '2px solid #c084fc',
        boxShadow: '0 0 40px rgba(192,132,252,0.3), inset 0 0 60px rgba(192,132,252,0.05)',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, Arial, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at 20% 20%, rgba(192,132,252,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(251,191,36,0.06) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div>
          <div style={{
            fontSize: '11px',
            color: '#c084fc',
            textTransform: 'uppercase',
            letterSpacing: '3px',
            fontWeight: 700,
            marginBottom: '4px',
          }}>
            🏆 VITTORIA
          </div>
          <div style={{
            fontSize: '22px',
            fontWeight: 900,
            color: '#fbbf24',
            textShadow: '0 0 20px rgba(251,191,36,0.5)',
            letterSpacing: '1px',
          }}>
            {stats.winnerName}
          </div>
        </div>

        {stats.pointsEarned != null && stats.pointsEarned > 0 && (
          <div style={{
            textAlign: 'right',
          }}>
            <div style={{
              fontSize: '26px',
              fontWeight: 900,
              color: '#4ade80',
              textShadow: '0 0 15px rgba(74,222,128,0.4)',
            }}>
              +{stats.pointsEarned} PR
            </div>
            <div style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              Punti Rankiard
            </div>
          </div>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: '8px',
        position: 'relative',
      }}>
        {statItems.map((item, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            padding: '10px 8px',
            textAlign: 'center',
            border: '1px solid rgba(192,132,252,0.2)',
          }}>
            <div style={{ fontSize: '16px', marginBottom: '4px' }}>{item.icon}</div>
            <div style={{
              fontSize: '15px',
              fontWeight: 800,
              color: '#e2e8f0',
              marginBottom: '2px',
            }}>
              {item.value}
            </div>
            <div style={{
              fontSize: '9px',
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              lineHeight: 1.2,
            }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
      }}>
        <div style={{
          fontSize: '18px',
          fontWeight: 900,
          color: 'rgba(192,132,252,0.6)',
          letterSpacing: '4px',
          textTransform: 'uppercase',
        }}>
          MINKIARDS
        </div>
        <div style={{
          fontSize: '10px',
          color: 'rgba(255,255,255,0.3)',
        }}>
          {formatDate()}
        </div>
      </div>
    </div>
  );
};

export default VictoryCard;
