import React, { useState } from 'react';
import { Trophy, Coins, Star } from 'lucide-react';
import { CardInfoSheet } from './CardInfoSheet';

interface DraftWinRewardProps {
  wins: number;
  creditsEarned: number;
  onContinue: () => void;
  rewardCardId?: string;
}

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: `${5 + (i * 3.4 % 90)}%`,
  delay: `${(i * 0.05) % 1.2}s`,
  duration: `${1.4 + (i * 0.07) % 1.2}s`,
  color: ['#facc15','#a78bfa','#34d399','#f472b6','#60a5fa','#fb923c'][i % 6],
  size: `${6 + (i % 8)}px`,
  rotate: `${(i * 13) % 360}deg`,
}));

export function DraftWinReward({ wins, creditsEarned, onContinue, rewardCardId }: DraftWinRewardProps) {
  const [showScheda, setShowScheda] = useState(false);

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}>
      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {PARTICLES.map(p => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              top: '-20px',
              left: p.left,
              width: p.size,
              height: p.size,
              background: p.color,
              borderRadius: p.id % 2 === 0 ? '50%' : '2px',
              transform: `rotate(${p.rotate})`,
              animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        className="relative text-center px-10 py-10 rounded-3xl border border-white/10 shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)', maxWidth: '420px', width: '90%' }}
      >
        {/* Trophy glow */}
        <div className="relative inline-flex items-center justify-center mb-4">
          <div className="absolute inset-0 rounded-full blur-2xl" style={{ background: 'radial-gradient(circle, rgba(250,204,21,0.5) 0%, transparent 70%)' }} />
          <Trophy size={72} className="text-yellow-400 relative z-10 drop-shadow-lg" strokeWidth={1.5} />
        </div>

        <div className="text-yellow-400 text-sm font-bold uppercase tracking-widest mb-1">Vittoria #{wins}</div>
        <h2 className="text-white text-3xl font-extrabold mb-2">
          {wins === 1 ? 'Prima Vittoria!' : wins >= 5 ? 'Straordinario!' : wins >= 3 ? 'Ottimo!' : 'Bravo!'}
        </h2>

        {/* Stars row */}
        <div className="flex justify-center gap-1 mb-5">
          {Array.from({ length: Math.min(wins, 7) }).map((_, i) => (
            <Star
              key={i}
              size={18}
              className="text-yellow-400 fill-yellow-400"
              style={{ animationDelay: `${i * 0.1}s`, animation: 'popIn 0.4s ease both' }}
            />
          ))}
          {Array.from({ length: Math.max(0, 7 - wins) }).map((_, i) => (
            <Star key={`empty-${i}`} size={18} className="text-white/15" />
          ))}
        </div>

        {/* Credits earned */}
        <div
          className="flex items-center justify-center gap-2 py-3 px-6 rounded-2xl mb-4"
          style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.3)' }}
        >
          <Coins size={22} className="text-yellow-400" />
          <span className="text-yellow-300 font-bold text-2xl">+{creditsEarned}</span>
          <span className="text-yellow-400/70 text-sm">crediti</span>
        </div>

        {/* Reward card Scheda button (only when a card reward is present) */}
        {rewardCardId && (
          <button
            onClick={() => setShowScheda(true)}
            className="w-full py-2 mb-4 rounded-xl text-sm font-semibold border transition-all"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc' }}
          >
            📋 Scheda carta premio
          </button>
        )}

        <p className="text-white/50 text-sm mb-6">
          {wins < 7
            ? `Continua così! Ancora ${7 - wins} ${7 - wins === 1 ? 'vittoria' : 'vittorie'} per il jackpot!`
            : '🎉 Jackpot! Hai completato il Draft con il massimo punteggio!'}
        </p>

        <button
          onClick={onContinue}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-lg rounded-xl transition-all duration-200 active:scale-95"
        >
          {wins < 7 ? 'Continua il Torneo →' : '🏆 Ritira il Jackpot →'}
        </button>
      </div>

      {/* Card info sheet overlay */}
      {showScheda && rewardCardId && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={() => setShowScheda(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: 440,
              background: '#111827',
              borderTop: '1px solid rgba(99,102,241,0.4)',
              borderRadius: '1.5rem 1.5rem 0 0',
              maxHeight: '80vh',
              display: 'flex', flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
            }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>📋 Scheda carta premio</span>
              <button
                onClick={() => setShowScheda(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  borderRadius: '50%', width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 16,
                }}
              >✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              <CardInfoSheet cardId={rewardCardId} compact />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes popIn {
          0%   { transform: scale(0); opacity: 0; }
          70%  { transform: scale(1.3); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
