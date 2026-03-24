import React, { useEffect, useState } from 'react';

interface KOBannerProps {
  cardName: string;
  cardOwner: string;
  cardImage?: string;
  eliminationMode?: boolean;
  isCurrentPlayer?: boolean;
  onComplete: () => void;
}

export function KOBanner({
  cardName,
  cardOwner,
  cardImage,
  eliminationMode = false,
  isCurrentPlayer = false,
  onComplete,
}: KOBannerProps) {
  const [phase, setPhase] = useState<'flash' | 'in' | 'hold' | 'out'>('flash');

  const holdMs  = eliminationMode ? 3200 : 1900;
  const totalMs = eliminationMode ? 4800 : 2700;

  useEffect(() => {
    const t0 = setTimeout(() => setPhase('in'),   eliminationMode ? 180 : 0);
    const t1 = setTimeout(() => setPhase('hold'),  eliminationMode ? 480 : 300);
    const t2 = setTimeout(() => setPhase('out'),   eliminationMode ? holdMs + 480 : holdMs + 300);
    const t3 = setTimeout(() => onComplete(), totalMs);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const isHold  = phase === 'hold';
  const isFlash = phase === 'flash';
  const isOut   = phase === 'out';
  const opacity = isFlash ? 0 : isOut ? 0 : 1;

  /* ─── ELIMINATION MODE ─────────────────────────────────────── */
  if (eliminationMode) {
    const accentColor = isCurrentPlayer ? '#ff2550' : '#ff9000';
    const glowColor   = isCurrentPlayer ? 'rgba(255,37,80,0.9)' : 'rgba(255,144,0,0.9)';

    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          opacity,
          transition: isFlash ? 'none' : isOut ? 'opacity 0.55s ease' : 'opacity 0.22s ease',
        }}
      >
        {/* Scan-lines */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.09) 0px, rgba(0,0,0,0.09) 1px, transparent 1px, transparent 3px)',
          pointerEvents: 'none',
        }} />

        {/* Vignette */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
        }} />

        {/* Centre column */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          transform: isHold ? 'scale(1) translateY(0)' : isFlash ? 'scale(1.6) translateY(-30px)' : isOut ? 'scale(0.92) translateY(20px)' : 'scale(0.75) translateY(-50px)',
          transition: isFlash ? 'none' : 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

          {/* K.O. text */}
          <div style={{ position: 'relative', lineHeight: 1 }}>
            {/* Echo layers */}
            {[{ top: 8, left: 8, color: 'rgba(255,0,80,0.4)' }, { top: 4, left: 4, color: 'rgba(255,120,0,0.4)' }].map((s, i) => (
              <div key={i} style={{
                position: 'absolute', top: s.top, left: s.left,
                fontSize: 128, fontWeight: 900, lineHeight: 1,
                fontFamily: '"Impact","Arial Black",sans-serif', letterSpacing: '-0.02em',
                color: 'transparent', WebkitTextStroke: `3px ${s.color}`,
                userSelect: 'none',
              }}>K.O.</div>
            ))}
            <div style={{
              fontSize: 128, fontWeight: 900, lineHeight: 1,
              fontFamily: '"Impact","Arial Black",sans-serif', letterSpacing: '-0.02em',
              color: accentColor, WebkitTextStroke: '2px #fff',
              textShadow: `0 0 40px ${glowColor}, 0 0 80px ${glowColor.replace('0.9','0.5')}, 0 6px 0 #5a0010`,
              userSelect: 'none',
              animation: isHold ? 'koPulse 0.8s ease-in-out infinite alternate' : 'none',
            }}>K.O.</div>
          </div>

          {/* Divider */}
          <div style={{
            width: 280, height: 2,
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
            boxShadow: `0 0 12px ${accentColor}`,
          }} />

          {/* Player name */}
          <div style={{
            fontSize: 36, fontWeight: 900, color: 'white', letterSpacing: '0.06em',
            fontFamily: '"Impact","Arial Black",sans-serif',
            textShadow: `0 0 20px ${glowColor}, 0 3px 0 rgba(0,0,0,0.8)`,
            WebkitTextStroke: '1px rgba(255,255,255,0.3)',
            userSelect: 'none',
            textTransform: 'uppercase',
          }}>
            {cardOwner}
          </div>

          {/* Subtitle */}
          <div style={{
            fontSize: 15, fontWeight: 900, letterSpacing: '0.3em', color: accentColor,
            fontFamily: '"Arial","sans-serif"',
            textShadow: `0 0 10px ${glowColor}`,
            textTransform: 'uppercase',
            userSelect: 'none',
            marginTop: -4,
          }}>
            {isCurrentPlayer ? '⚠ SEI STATO ELIMINATO' : 'ELIMINATO DALLA PARTITA'}
          </div>
        </div>

        <style>{`
          @keyframes koPulse {
            0%   { text-shadow: 0 0 40px ${glowColor}, 0 0 80px ${glowColor.replace('0.9','0.5')}, 0 6px 0 #5a0010; }
            100% { text-shadow: 0 0 70px ${glowColor}, 0 0 120px ${glowColor}, 0 6px 0 #5a0010; }
          }
        `}</style>
      </div>
    );
  }

  /* ─── REGULAR CARD K.O. MODE ───────────────────────────────── */
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        transition: 'opacity 0.28s ease', opacity,
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 72%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.07) 0px, rgba(0,0,0,0.07) 1px, transparent 1px, transparent 3px)',
        pointerEvents: 'none', mixBlendMode: 'multiply',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        transform: `translateY(${phase === 'in' ? '-60px' : isOut ? '40px' : '0px'}) scale(${isHold ? 1 : phase === 'in' ? 0.7 : 1.05})`,
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* K.O. text */}
        <div style={{ position: 'relative' }}>
          {[{ top: 6, left: 6, color: 'rgba(255,0,80,0.5)' }, { top: 3, left: 3, color: 'rgba(255,120,0,0.5)' }].map((s, i) => (
            <div key={i} style={{
              position: 'absolute', top: s.top, left: s.left,
              fontSize: 96, fontWeight: 900, lineHeight: 1,
              fontFamily: '"Impact","Arial Black",sans-serif', letterSpacing: '-0.02em',
              color: 'transparent', WebkitTextStroke: `3px ${s.color}`,
              userSelect: 'none',
            }}>K.O.</div>
          ))}
          <div style={{
            fontSize: 96, fontWeight: 900, lineHeight: 1,
            fontFamily: '"Impact","Arial Black",sans-serif', letterSpacing: '-0.02em',
            color: '#ff2550', WebkitTextStroke: '2px #fff',
            textShadow: '0 0 30px rgba(255,37,80,0.9), 0 0 60px rgba(255,37,80,0.5), 0 4px 0 #7a0020',
            userSelect: 'none',
            animation: isHold ? 'koPulseReg 0.9s ease-in-out infinite alternate' : 'none',
          }}>K.O.</div>
        </div>

        {/* Card strip */}
        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(0,0,0,0.75)', border: '1.5px solid rgba(255,37,80,0.5)',
          borderRadius: 12, padding: '8px 16px 8px 10px',
          boxShadow: '0 0 20px rgba(255,37,80,0.3)', backdropFilter: 'blur(8px)', maxWidth: 300,
        }}>
          {cardImage && (
            <div style={{
              width: 42, height: 42, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
              border: '2px solid rgba(255,37,80,0.6)', boxShadow: '0 0 10px rgba(255,37,80,0.4)',
            }}>
              <img src={cardImage} alt={cardName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 16, fontWeight: 900, color: 'white',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              fontFamily: '"Impact","Arial Black",sans-serif', letterSpacing: '0.03em',
              textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            }}>{cardName}</div>
            <div style={{
              fontSize: 11, color: 'rgba(255,180,180,0.85)', fontWeight: 600,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>di <span style={{ color: '#ff8aaa', fontWeight: 900 }}>{cardOwner}</span></div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes koPulseReg {
          0%   { text-shadow: 0 0 30px rgba(255,37,80,0.9), 0 0 60px rgba(255,37,80,0.5), 0 4px 0 #7a0020; }
          100% { text-shadow: 0 0 50px rgba(255,37,80,1),   0 0 90px rgba(255,37,80,0.8), 0 4px 0 #7a0020; }
        }
      `}</style>
    </div>
  );
}
