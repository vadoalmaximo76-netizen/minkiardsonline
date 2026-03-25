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
  const [animationPhase, setAnimationPhase] = useState(0);

  const embers = useMemo(() =>
    [...Array(18)].map((_, i) => ({
      left: (i * 37 + 11) % 100,
      delay: (i * 23 % 200) / 100,
      duration: 1.8 + (i * 17 % 30) / 10,
      size: 2 + (i * 13 % 4),
      drift: (i % 2 === 0 ? 1 : -1) * (10 + (i * 7 % 20)),
    })), []
  );

  const sparks = useMemo(() =>
    [...Array(8)].map((_, i) => ({
      angle: (i / 8) * 360,
      delay: i * 0.08,
      distance: 70 + (i * 19 % 40),
    })), []
  );

  useEffect(() => {
    if (isVisible) {
      setAnimationPhase(0);
      const t1 = setTimeout(() => setAnimationPhase(1), 80);
      const t2 = setTimeout(() => setAnimationPhase(2), 350);
      const t3 = setTimeout(() => setAnimationPhase(3), 650);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">

      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ animation: 'pgBackdropIn 0.45s ease-out forwards', background: 'rgba(0,0,0,0)' }}
      />

      {/* Ember particles rising from bottom */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {embers.map((e, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${e.left}%`,
              bottom: '-5%',
              width: `${e.size}px`,
              height: `${e.size}px`,
              background: i % 3 === 0
                ? 'rgba(251,191,36,0.9)'
                : i % 3 === 1
                  ? 'rgba(245,158,11,0.85)'
                  : 'rgba(252,211,77,0.8)',
              boxShadow: i % 3 === 0
                ? '0 0 8px rgba(251,191,36,0.8), 0 0 16px rgba(251,191,36,0.4)'
                : i % 3 === 1
                  ? '0 0 8px rgba(245,158,11,0.7), 0 0 16px rgba(245,158,11,0.3)'
                  : '0 0 6px rgba(252,211,77,0.6)',
              animation: `pgEmberRise ${e.duration}s ease-out infinite`,
              animationDelay: `${e.delay}s`,
              '--drift': `${e.drift}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Main container */}
      <div
        className="relative flex flex-col items-center gap-5"
        style={{ animation: 'pgContainerEnter 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
      >

        {/* Card with gold border */}
        {cardImage && (
          <div
            className="relative"
            style={{
              animation: animationPhase >= 1 ? 'pgCardReveal 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
              opacity: animationPhase >= 1 ? 1 : 0,
            }}
          >
            {/* Outer glow */}
            <div
              className="absolute -inset-4 rounded-xl"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.55) 0%, rgba(245,158,11,0.2) 50%, transparent 80%)',
                filter: 'blur(12px)',
                animation: 'pgGlowPulse 1.8s ease-in-out infinite',
              }}
            />

            {/* Gold border ring */}
            <div
              className="absolute -inset-1 rounded-xl"
              style={{
                background: 'conic-gradient(from 0deg, #f59e0b, #fbbf24, #fde68a, #f59e0b, #b45309, #fbbf24, #f59e0b)',
                animation: 'pgBorderSpin 4s linear infinite',
                padding: '2px',
              }}
            >
              <div className="w-full h-full bg-gray-900 rounded-xl" />
            </div>

            <img
              src={cardImage}
              alt={cardName}
              className="relative w-40 h-56 rounded-xl object-contain z-10"
              style={{
                filter: 'drop-shadow(0 0 24px rgba(251,191,36,0.7)) drop-shadow(0 4px 12px rgba(0,0,0,0.8))',
                animation: 'pgCardFloat 2.5s ease-in-out infinite',
              }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />

            {/* Orbiting sparks */}
            {sparks.map((sp, i) => (
              <div
                key={i}
                className="absolute top-1/2 left-1/2 rounded-full"
                style={{
                  width: '5px',
                  height: '5px',
                  background: i % 2 === 0 ? '#fbbf24' : '#fde68a',
                  boxShadow: i % 2 === 0
                    ? '0 0 8px #fbbf24, 0 0 16px rgba(251,191,36,0.5)'
                    : '0 0 8px #fde68a, 0 0 12px rgba(253,230,138,0.4)',
                  transform: `rotate(${sp.angle}deg) translateX(${sp.distance}px)`,
                  animation: `pgOrbit ${3 + i * 0.3}s linear infinite`,
                  animationDelay: `${sp.delay}s`,
                  opacity: 0.85,
                }}
              />
            ))}
          </div>
        )}

        {/* Text banner */}
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            animation: animationPhase >= 2 ? 'pgTextReveal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
            opacity: animationPhase >= 2 ? 1 : 0,
          }}
        >
          {/* Gold border */}
          <div
            className="absolute -inset-px rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #fbbf24, #fde68a, #f59e0b, #b45309)',
              backgroundSize: '300% 300%',
              animation: 'pgBorderFlow 2.5s linear infinite',
            }}
          />

          <div
            className="relative px-10 py-5 rounded-2xl"
            style={{ background: 'linear-gradient(135deg, rgba(10,6,0,0.97), rgba(30,18,3,0.96))', backdropFilter: 'blur(16px)' }}
          >
            {/* Top accent line */}
            <div
              className="absolute top-0 left-4 right-4 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)' }}
            />

            <h2
              className="text-4xl md:text-5xl font-black text-center mb-2 tracking-wider"
              style={{
                background: 'linear-gradient(135deg, #fde68a, #fbbf24, #f59e0b, #fbbf24, #fde68a)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                filter: 'drop-shadow(0 0 12px rgba(251,191,36,0.6))',
                animation: animationPhase >= 3 ? 'pgTitleGlow 2s ease-in-out infinite alternate' : 'none',
              }}
            >
              {cardName}
            </h2>

            <p
              className="text-lg md:text-xl font-bold text-center tracking-widest uppercase"
              style={{
                color: '#fde68a',
                textShadow: '0 0 12px rgba(251,191,36,0.6), 0 1px 4px rgba(0,0,0,0.9)',
                animation: animationPhase >= 3 ? 'pgMessagePulse 1.8s ease-in-out infinite' : 'none',
              }}
            >
              {message}
            </p>

            {/* Decorative dots */}
            <div className="flex justify-center gap-2 mt-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-full"
                  style={{
                    width: i === 2 ? '10px' : '6px',
                    height: i === 2 ? '10px' : '6px',
                    background: '#fbbf24',
                    boxShadow: '0 0 8px rgba(251,191,36,0.7), 0 0 16px rgba(251,191,36,0.3)',
                    animation: 'pgDotPulse 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.18}s`,
                  }}
                />
              ))}
            </div>

            {/* Bottom accent line */}
            <div
              className="absolute bottom-0 left-4 right-4 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)' }}
            />
          </div>
        </div>

        {/* Crown accent below */}
        <div
          className="w-48 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, #fbbf24, #fde68a, #fbbf24, transparent)',
            boxShadow: '0 0 12px rgba(251,191,36,0.5)',
            animation: 'pgLinePulse 2s ease-in-out infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes pgBackdropIn {
          from { background: rgba(0,0,0,0); }
          to   { background: rgba(0,0,0,0.7); }
        }
        @keyframes pgContainerEnter {
          0%   { opacity: 0; transform: scale(0.82) translateY(28px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pgCardReveal {
          0%   { opacity: 0; transform: scale(0.55) rotateY(80deg); }
          60%  { transform: scale(1.08) rotateY(-8deg); }
          100% { opacity: 1; transform: scale(1) rotateY(0deg); }
        }
        @keyframes pgCardFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-7px); }
        }
        @keyframes pgGlowPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 0.9; transform: scale(1.06); }
        }
        @keyframes pgBorderSpin {
          0%   { background-position: 0% 50%; transform: rotate(0deg); }
          100% { background-position: 0% 50%; transform: rotate(360deg); }
        }
        @keyframes pgBorderFlow {
          0%   { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        @keyframes pgOrbit {
          0%   { transform: rotate(0deg) translateX(var(--d, 80px)) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(var(--d, 80px)) rotate(-360deg); }
        }
        @keyframes pgTextReveal {
          0%   { opacity: 0; transform: translateY(24px) scale(0.92); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pgTitleGlow {
          0%   { filter: drop-shadow(0 0 8px rgba(251,191,36,0.5)); }
          100% { filter: drop-shadow(0 0 20px rgba(251,191,36,0.9)) drop-shadow(0 0 40px rgba(245,158,11,0.4)); }
        }
        @keyframes pgMessagePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.82; transform: scale(1.02); }
        }
        @keyframes pgEmberRise {
          0%   { transform: translateY(0) translateX(0) scale(1); opacity: 1; }
          100% { transform: translateY(-380px) translateX(var(--drift, 15px)) scale(0.1); opacity: 0; }
        }
        @keyframes pgDotPulse {
          0%, 100% { opacity: 0.5; transform: scale(0.8); }
          50%       { opacity: 1; transform: scale(1.25); }
        }
        @keyframes pgLinePulse {
          0%, 100% { opacity: 0.6; transform: scaleX(1); }
          50%       { opacity: 1; transform: scaleX(1.15); }
        }
      `}</style>
    </div>
  );
};
