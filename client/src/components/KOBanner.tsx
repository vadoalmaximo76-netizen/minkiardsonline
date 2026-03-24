import React, { useEffect, useState } from 'react';

interface KOBannerProps {
  cardName: string;
  cardOwner: string;
  cardImage?: string;
  onComplete: () => void;
}

export function KOBanner({ cardName, cardOwner, cardImage, onComplete }: KOBannerProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 300);
    const t2 = setTimeout(() => setPhase('out'), 2200);
    const t3 = setTimeout(() => onComplete(), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const opacity   = phase === 'in' ? 0 : phase === 'out' ? 0 : 1;
  const scaleKO   = phase === 'hold' ? 1 : phase === 'in' ? 2.4 : 0.7;
  const translateY = phase === 'in' ? '-60px' : phase === 'out' ? '40px' : '0px';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 0.28s ease',
        opacity,
      }}
    >
      {/* Dark vignette behind */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 72%)',
        pointerEvents: 'none',
      }} />

      {/* Horizontal scan lines */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.07) 0px, rgba(0,0,0,0.07) 1px, transparent 1px, transparent 3px)',
        pointerEvents: 'none',
        mixBlendMode: 'multiply',
      }} />

      {/* Main banner */}
      <div
        style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          transform: `translateY(${translateY}) scale(${phase === 'hold' ? 1 : phase === 'in' ? 0.7 : 1.05})`,
          transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* "K.O." text */}
        <div style={{ position: 'relative' }}>
          {/* Shadow / echo layers */}
          <div style={{
            position: 'absolute', top: 6, left: 6,
            fontSize: 96, fontWeight: 900, lineHeight: 1,
            fontFamily: '"Impact","Arial Black",sans-serif',
            letterSpacing: '-0.02em',
            color: 'transparent',
            WebkitTextStroke: '3px rgba(255,0,80,0.5)',
            userSelect: 'none',
          }}>K.O.</div>
          <div style={{
            position: 'absolute', top: 3, left: 3,
            fontSize: 96, fontWeight: 900, lineHeight: 1,
            fontFamily: '"Impact","Arial Black",sans-serif',
            letterSpacing: '-0.02em',
            color: 'transparent',
            WebkitTextStroke: '3px rgba(255,120,0,0.5)',
            userSelect: 'none',
          }}>K.O.</div>

          {/* Main K.O. */}
          <div style={{
            fontSize: 96, fontWeight: 900, lineHeight: 1,
            fontFamily: '"Impact","Arial Black",sans-serif',
            letterSpacing: '-0.02em',
            color: '#ff2550',
            WebkitTextStroke: '2px #fff',
            textShadow: '0 0 30px rgba(255,37,80,0.9), 0 0 60px rgba(255,37,80,0.5), 0 4px 0 #7a0020',
            userSelect: 'none',
            animation: phase === 'hold' ? 'koPulse 0.9s ease-in-out infinite alternate' : 'none',
          }}>K.O.</div>
        </div>

        {/* Card info strip */}
        <div style={{
          marginTop: 10,
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(0,0,0,0.75)',
          border: '1.5px solid rgba(255,37,80,0.5)',
          borderRadius: 12,
          padding: '8px 16px 8px 10px',
          boxShadow: '0 0 20px rgba(255,37,80,0.3)',
          backdropFilter: 'blur(8px)',
          maxWidth: 300,
        }}>
          {/* Card image thumbnail */}
          {cardImage && (
            <div style={{
              width: 42, height: 42, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
              border: '2px solid rgba(255,37,80,0.6)',
              boxShadow: '0 0 10px rgba(255,37,80,0.4)',
            }}>
              <img
                src={cardImage}
                alt={cardName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
              />
            </div>
          )}

          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 16, fontWeight: 900, color: 'white',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              fontFamily: '"Impact","Arial Black",sans-serif',
              letterSpacing: '0.03em',
              textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            }}>
              {cardName}
            </div>
            <div style={{
              fontSize: 11, color: 'rgba(255,180,180,0.85)', fontWeight: 600,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              di <span style={{ color: '#ff8aaa', fontWeight: 900 }}>{cardOwner}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes koPulse {
          0%   { text-shadow: 0 0 30px rgba(255,37,80,0.9), 0 0 60px rgba(255,37,80,0.5), 0 4px 0 #7a0020; }
          100% { text-shadow: 0 0 50px rgba(255,37,80,1),   0 0 90px rgba(255,37,80,0.8), 0 4px 0 #7a0020; }
        }
      `}</style>
    </div>
  );
}
