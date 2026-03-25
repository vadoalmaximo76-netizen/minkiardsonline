import React, { useEffect, useState, useMemo } from 'react';

interface PersonaggioNotificationProps {
  isVisible: boolean;
  cardName: string;
  message: string;
  cardImage: string;
}

export const PersonaggioNotification: React.FC<PersonaggioNotificationProps> = ({
  isVisible,
  cardName,
  message,
  cardImage
}) => {
  const [phase, setPhase] = useState<'hidden' | 'in' | 'hold' | 'out'>('hidden');

  const particles = useMemo(() =>
    Array.from({ length: 22 }, (_, i) => ({
      left: ((i * 97 + 13) % 100),
      delay: ((i * 37 + 7) % 200) / 100,
      duration: 2.2 + ((i * 17) % 20) / 10,
      size: 3 + (i % 4),
      color: i % 3 === 0 ? '#fbbf24' : i % 3 === 1 ? '#f59e0b' : '#ffffff',
    })), []
  );

  useEffect(() => {
    if (!isVisible) { setPhase('hidden'); return; }
    setPhase('in');
    const t1 = setTimeout(() => setPhase('hold'), 550);
    const t2 = setTimeout(() => setPhase('out'), 3500);
    const t3 = setTimeout(() => setPhase('hidden'), 4100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isVisible]);

  if (phase === 'hidden') return null;

  const isIn   = phase === 'in';
  const isHold = phase === 'hold';
  const isOut  = phase === 'out';

  return (
    <>
      <style>{`
        @keyframes pn-backdrop {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes pn-slam {
          0%   { opacity: 0; transform: translateY(-90px) scale(0.6) rotate(-4deg); }
          55%  { opacity: 1; transform: translateY(10px)  scale(1.06) rotate(1deg); }
          75%  { transform: translateY(-4px) scale(0.98) rotate(-0.5deg); }
          100% { transform: translateY(0)   scale(1)    rotate(0deg); }
        }
        @keyframes pn-title {
          0%   { opacity: 0; letter-spacing: 0.5em; filter: blur(6px); }
          60%  { opacity: 1; filter: blur(0); }
          100% { letter-spacing: 0.12em; }
        }
        @keyframes pn-subtitle {
          0%   { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pn-particle {
          0%   { opacity: 0.9; transform: translateY(0) scale(1); }
          100% { opacity: 0;   transform: translateY(-320px) scale(0.2); }
        }
        @keyframes pn-shine {
          0%   { left: -80%; opacity: 0; }
          30%  { opacity: 0.6; }
          100% { left: 120%;  opacity: 0; }
        }
        @keyframes pn-glow-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); }
          50%       { box-shadow: 0 0 28px 6px rgba(251,191,36,0.45); }
        }
        @keyframes pn-slide-out {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(30px) scale(0.92); }
        }
        @keyframes pn-spotlight {
          0%, 100% { opacity: 0.55; }
          50%       { opacity: 0.75; }
        }
        @keyframes pn-divider {
          0%   { opacity: 0; width: 0; }
          100% { opacity: 1; width: 220px; }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9990] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 80% at 50% 42%, rgba(0,0,0,0.72) 30%, rgba(0,0,0,0.92) 100%)',
          animation: 'pn-backdrop 0.3s ease-out forwards',
          opacity: isOut ? 0 : 1,
          transition: isOut ? 'opacity 0.5s ease' : undefined,
        }}
      />

      {/* Spotlight cone from top */}
      <div
        className="fixed pointer-events-none"
        style={{
          top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 340, height: '65%', zIndex: 9991,
          background: 'linear-gradient(180deg, rgba(251,191,36,0.18) 0%, transparent 100%)',
          clipPath: 'polygon(35% 0%, 65% 0%, 100% 100%, 0% 100%)',
          animation: 'pn-spotlight 2s ease-in-out infinite',
          opacity: isHold ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}
      />

      {/* Rising golden particles */}
      <div className="fixed inset-0 z-[9992] pointer-events-none overflow-hidden">
        {(isIn || isHold) && particles.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', left: `${p.left}%`, bottom: '8%',
              width: p.size, height: p.size, borderRadius: '50%',
              background: p.color, boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
              animation: `pn-particle ${p.duration}s ${p.delay}s ease-out infinite`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div
        className="fixed inset-0 z-[9993] flex flex-col items-center justify-center pointer-events-none"
        style={{
          animation: isOut
            ? 'pn-slide-out 0.5s ease-in forwards'
            : 'pn-slam 0.55s cubic-bezier(0.22,1,0.36,1) forwards',
        }}
      >
        {/* Card image frame */}
        {cardImage && (
          <div
            style={{
              position: 'relative', marginBottom: 20,
              borderRadius: 16,
              animation: isHold ? 'pn-glow-ring 1.8s ease-in-out infinite' : undefined,
            }}
          >
            <div style={{
              position: 'absolute', inset: -3, borderRadius: 18, zIndex: 0,
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #fde68a, #f59e0b, #fbbf24)',
              boxShadow: '0 0 24px rgba(251,191,36,0.5)',
            }} />
            <div style={{ position: 'relative', zIndex: 1, borderRadius: 14, overflow: 'hidden' }}>
              <img
                src={cardImage}
                alt={cardName}
                style={{ width: 148, height: 208, objectFit: 'cover', display: 'block' }}
                onError={e => {
                  const p = e.currentTarget.parentElement?.parentElement as HTMLElement | null;
                  if (p) p.style.display = 'none';
                }}
              />
              <div style={{
                position: 'absolute', top: 0, bottom: 0, width: '55%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)',
                animation: 'pn-shine 1.1s 0.3s ease-out forwards',
              }} />
            </div>
          </div>
        )}

        {/* Card name */}
        <div style={{ animation: 'pn-title 0.55s 0.2s ease-out both', marginBottom: 8 }}>
          <h2 style={{
            fontFamily: '"Impact","Arial Black",sans-serif',
            fontSize: 'clamp(1.6rem, 5.5vw, 2.8rem)',
            color: '#fbbf24',
            textShadow: '0 0 20px rgba(251,191,36,0.8), 0 0 40px rgba(251,191,36,0.4), 0 3px 0 #7a3c00',
            letterSpacing: '0.12em',
            textAlign: 'center',
            textTransform: 'uppercase',
            lineHeight: 1.1, margin: 0,
          }}>
            {cardName}
          </h2>
        </div>

        {/* Subtitle */}
        <div style={{ animation: 'pn-subtitle 0.4s 0.45s ease-out both' }}>
          <p style={{
            color: 'rgba(255,255,255,0.82)', fontSize: 'clamp(0.9rem, 2.8vw, 1.15rem)',
            fontWeight: 600, textAlign: 'center',
            textShadow: '0 1px 6px rgba(0,0,0,0.7)',
            margin: 0, padding: '0 16px', maxWidth: 360,
          }}>
            {message}
          </p>
        </div>

        {/* Decorative divider */}
        <div style={{
          marginTop: 14, height: 2, overflow: 'hidden',
          background: 'linear-gradient(90deg, transparent, #fbbf24, #fff, #fbbf24, transparent)',
          boxShadow: '0 0 10px rgba(251,191,36,0.6)',
          animation: 'pn-divider 0.5s 0.55s ease-out both',
        }} />
      </div>
    </>
  );
};
