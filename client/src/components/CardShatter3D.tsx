import React, { useEffect, useMemo } from 'react';

interface CardShatter3DProps {
  isVisible: boolean;
  cardImage?: string;
  cardName: string;
  onComplete: () => void;
}

interface ShatterFragment {
  id: number;
  row: number;
  col: number;
  tx: string;
  ty: string;
  rx: string;
  ry: string;
  rz: string;
  delay: number;
}

interface FireParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
  angle: number;
  distance: number;
}

interface EmberParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  angle: number;
  distance: number;
  drift: number;
}

interface SmokeParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  drift: number;
}

interface DebrisParticle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  delay: number;
  rotation: number;
  color: string;
}

export const CardShatter3D: React.FC<CardShatter3DProps> = ({
  isVisible,
  cardImage,
  cardName,
  onComplete,
}) => {
  const gridSize = 5;

  const fragments = useMemo<ShatterFragment[]>(() => {
    const newFragments: ShatterFragment[] = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const id = row * gridSize + col;
        const angle = ((id * 137.508 + 42) % 360) * (Math.PI / 180);
        const distance = 120 + ((id * 73 + 17) % 180);
        const tx = `${Math.cos(angle) * distance}px`;
        const ty = `${Math.sin(angle) * distance - 80}px`;
        const rx = `${((id * 43 + 11) % 1080 - 540)}deg`;
        const ry = `${((id * 67 + 23) % 1080 - 540)}deg`;
        const rz = `${((id * 97 + 31) % 1080 - 540)}deg`;
        const delay = ((id * 13 + 7) % 8) * 0.02;
        newFragments.push({ id, row, col, tx, ty, rx, ry, rz, delay });
      }
    }
    return newFragments;
  }, []);

  const fireParticles = useMemo<FireParticle[]>(() => {
    const particles: FireParticle[] = [];
    const fireColors = ['#ff4400', '#ff6600', '#ff8800', '#ffaa00', '#ffcc00', '#ff2200', '#ff0000'];
    for (let i = 0; i < 40; i++) {
      const angle = ((i * 137.508 + 23) % 360) * (Math.PI / 180);
      particles.push({
        id: i,
        x: 50 + ((i * 31 + 7) % 40 - 20),
        y: 50 + ((i * 17 + 13) % 30 - 15),
        size: 8 + (i % 7) * 6,
        delay: (i % 12) * 0.03,
        duration: 0.6 + (i % 5) * 0.2,
        color: fireColors[i % fireColors.length],
        angle: angle * (180 / Math.PI),
        distance: 60 + ((i * 47 + 11) % 120),
      });
    }
    return particles;
  }, []);

  const emberParticles = useMemo<EmberParticle[]>(() => {
    const particles: EmberParticle[] = [];
    for (let i = 0; i < 30; i++) {
      particles.push({
        id: i,
        x: 50 + ((i * 41 + 9) % 60 - 30),
        y: 50 + ((i * 29 + 17) % 40 - 20),
        size: 2 + (i % 4),
        delay: 0.1 + (i % 15) * 0.05,
        angle: ((i * 137.508) % 360),
        distance: 100 + ((i * 53 + 7) % 200),
        drift: ((i * 37 + 11) % 60) - 30,
      });
    }
    return particles;
  }, []);

  const smokeParticles = useMemo<SmokeParticle[]>(() => {
    const particles: SmokeParticle[] = [];
    for (let i = 0; i < 12; i++) {
      particles.push({
        id: i,
        x: 50 + ((i * 47 + 13) % 50 - 25),
        y: 50 + ((i * 23 + 7) % 30 - 15),
        size: 40 + (i % 5) * 20,
        delay: 0.15 + (i % 6) * 0.08,
        drift: ((i * 31 + 19) % 40) - 20,
      });
    }
    return particles;
  }, []);

  const debrisParticles = useMemo<DebrisParticle[]>(() => {
    const particles: DebrisParticle[] = [];
    const debrisColors = ['#8b7355', '#6b5b45', '#a0936b', '#5a4a3a', '#c4b090'];
    for (let i = 0; i < 20; i++) {
      particles.push({
        id: i,
        angle: ((i * 137.508 + 50) % 360) * (Math.PI / 180),
        distance: 80 + ((i * 67 + 13) % 150),
        size: 3 + (i % 5) * 2,
        delay: (i % 10) * 0.025,
        rotation: ((i * 97 + 31) % 720) - 360,
        color: debrisColors[i % debrisColors.length],
      });
    }
    return particles;
  }, []);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onComplete, 2200);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  const fallbackImage = cardImage || '';
  const hasImage = !!fallbackImage;
  const cellSize = 100 / gridSize;

  return (
    <>
      <style>{`
        @keyframes epic-shatter-fragment {
          0% { transform: translate3d(0, 0, 0) rotateX(0) rotateY(0) rotateZ(0) scale(1); opacity: 1; filter: brightness(3); }
          15% { filter: brightness(1.5); }
          100% { transform: translate3d(var(--shatter-tx), var(--shatter-ty), -200px) rotateX(var(--shatter-rx)) rotateY(var(--shatter-ry)) rotateZ(var(--shatter-rz)) scale(0); opacity: 0; filter: brightness(0.3); }
        }
        @keyframes epic-flash {
          0% { background-color: rgba(255, 200, 50, 0); }
          8% { background-color: rgba(255, 200, 50, 0.9); }
          20% { background-color: rgba(255, 100, 0, 0.5); }
          50% { background-color: rgba(255, 50, 0, 0.2); }
          100% { background-color: rgba(0, 0, 0, 0); }
        }
        @keyframes fire-burst {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          30% { opacity: 0.9; }
          100% { transform: translate(calc(-50% + var(--fire-dx)), calc(-50% + var(--fire-dy))) scale(2.5); opacity: 0; }
        }
        @keyframes ember-float {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { opacity: 0.8; }
          100% { transform: translate(calc(-50% + var(--ember-dx)), calc(-50% + var(--ember-dy) - 100px)) scale(0.2); opacity: 0; }
        }
        @keyframes smoke-rise {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          20% { opacity: 0.4; }
          100% { transform: translate(calc(-50% + var(--smoke-drift)), calc(-50% - 200px)) scale(3); opacity: 0; }
        }
        @keyframes debris-scatter {
          0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
          60% { opacity: 0.8; }
          100% { transform: translate(var(--debris-tx), var(--debris-ty)) rotate(var(--debris-rot)) scale(0.3); opacity: 0; }
        }
        @keyframes shockwave-ring-expand {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; border-width: 4px; }
          100% { transform: translate(-50%, -50%) scale(6); opacity: 0; border-width: 1px; }
        }
        @keyframes shockwave-ring-2 {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.7; border-width: 3px; }
          100% { transform: translate(-50%, -50%) scale(8); opacity: 0; border-width: 1px; }
        }
        @keyframes card-death-appear {
          0% { transform: scale(1.2); opacity: 0; filter: brightness(3); }
          30% { transform: scale(1); opacity: 1; filter: brightness(1.5); }
          60% { filter: brightness(1); }
          70% { transform: scale(1); filter: brightness(2) saturate(0); }
          100% { transform: scale(0.95); opacity: 0; filter: brightness(3) saturate(0); }
        }
        @keyframes death-name-reveal {
          0% { transform: translateY(20px) scale(0.5); opacity: 0; }
          30% { transform: translateY(0) scale(1.1); opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translateY(-30px) scale(0.8); opacity: 0; }
        }
        @keyframes ground-crack {
          0% { transform: translate(-50%, -50%) scaleX(0); opacity: 0; }
          20% { opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scaleX(1); opacity: 0; }
        }
        @keyframes screen-darken {
          0% { opacity: 0; }
          20% { opacity: 0.6; }
          80% { opacity: 0.6; }
          100% { opacity: 0; }
        }
      `}</style>

      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="absolute inset-0" style={{ animation: 'screen-darken 2.2s ease-out forwards', backgroundColor: 'rgba(0,0,0,0.7)' }} />
        <div className="absolute inset-0" style={{ animation: 'epic-flash 0.8s ease-out forwards' }} />

        <div className="absolute left-1/2 top-1/2" style={{ width: '300px', height: '4px', background: 'linear-gradient(90deg, transparent, #ff6600, #ffcc00, #ff6600, transparent)', animation: 'ground-crack 1.5s ease-out 0.1s forwards', opacity: 0 }} />
        <div className="absolute left-1/2 top-1/2" style={{ width: '4px', height: '300px', background: 'linear-gradient(180deg, transparent, #ff6600, #ffcc00, #ff6600, transparent)', animation: 'ground-crack 1.5s ease-out 0.15s forwards', opacity: 0 }} />

        <div className="absolute left-1/2 top-1/2 rounded-full" style={{ width: '80px', height: '80px', border: '4px solid rgba(255, 150, 0, 0.9)', boxShadow: '0 0 30px rgba(255, 150, 0, 0.6), 0 0 60px rgba(255, 100, 0, 0.3), inset 0 0 20px rgba(255, 200, 0, 0.4)', animation: 'shockwave-ring-expand 0.8s ease-out 0.05s forwards', opacity: 0 }} />
        <div className="absolute left-1/2 top-1/2 rounded-full" style={{ width: '60px', height: '60px', border: '3px solid rgba(255, 255, 255, 0.7)', boxShadow: '0 0 20px rgba(255, 255, 255, 0.5)', animation: 'shockwave-ring-2 1s ease-out 0.15s forwards', opacity: 0 }} />
        <div className="absolute left-1/2 top-1/2 rounded-full" style={{ width: '100px', height: '100px', border: '2px solid rgba(255, 80, 0, 0.6)', animation: 'shockwave-ring-expand 1.2s ease-out 0.25s forwards', opacity: 0 }} />

        <div className="relative" style={{ width: '200px', height: '280px', perspective: '1200px' }}>
          <div className="absolute inset-0" style={{ backgroundImage: hasImage ? `url(${fallbackImage})` : 'none', backgroundColor: hasImage ? undefined : '#333', backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '12px', animation: 'card-death-appear 0.7s ease-out forwards' }} />

          <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
            {fragments.map((fragment) => {
              const top = (fragment.row / gridSize) * 100;
              const left = (fragment.col / gridSize) * 100;
              const insetTop = `${top}%`;
              const insetLeft = `${left}%`;
              const insetRight = `${100 - left - cellSize}%`;
              const insetBottom = `${100 - top - cellSize}%`;

              return (
                <div
                  key={fragment.id}
                  className="absolute"
                  style={{
                    width: '200px',
                    height: '280px',
                    top: 0,
                    left: 0,
                    backgroundImage: hasImage ? `url(${fallbackImage})` : 'none',
                    backgroundColor: hasImage ? undefined : '#555',
                    backgroundSize: '200px 280px',
                    clipPath: `inset(${insetTop} ${insetRight} ${insetBottom} ${insetLeft})`,
                    transformStyle: 'preserve-3d',
                    '--shatter-tx': fragment.tx,
                    '--shatter-ty': fragment.ty,
                    '--shatter-rx': fragment.rx,
                    '--shatter-ry': fragment.ry,
                    '--shatter-rz': fragment.rz,
                    animation: `epic-shatter-fragment 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${0.3 + fragment.delay}s forwards`,
                    boxShadow: '0 0 8px rgba(255, 100, 0, 0.5)',
                  } as unknown as React.CSSProperties}
                />
              );
            })}
          </div>
        </div>

        {fireParticles.map((particle) => (
          <div
            key={`fire-${particle.id}`}
            className="absolute rounded-full"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              background: `radial-gradient(circle, ${particle.color}, transparent)`,
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
              '--fire-dx': `${Math.cos(particle.angle * Math.PI / 180) * particle.distance}px`,
              '--fire-dy': `${Math.sin(particle.angle * Math.PI / 180) * particle.distance}px`,
              animation: `fire-burst ${particle.duration}s ease-out ${particle.delay}s forwards`,
              opacity: 0,
            } as unknown as React.CSSProperties}
          />
        ))}

        {emberParticles.map((particle) => (
          <div
            key={`ember-${particle.id}`}
            className="absolute rounded-full"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              background: `radial-gradient(circle, #ffdd00, #ff6600)`,
              boxShadow: `0 0 ${particle.size * 3}px #ff8800`,
              '--ember-dx': `${particle.drift}px`,
              '--ember-dy': `${-particle.distance}px`,
              animation: `ember-float ${1.2 + (particle.id % 4) * 0.3}s ease-out ${particle.delay}s forwards`,
              opacity: 0,
            } as unknown as React.CSSProperties}
          />
        ))}

        {smokeParticles.map((particle) => (
          <div
            key={`smoke-${particle.id}`}
            className="absolute rounded-full"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              background: `radial-gradient(circle, rgba(80,60,40,0.5), transparent)`,
              '--smoke-drift': `${particle.drift}px`,
              animation: `smoke-rise ${1.8 + (particle.id % 3) * 0.4}s ease-out ${particle.delay}s forwards`,
              opacity: 0,
            } as unknown as React.CSSProperties}
          />
        ))}

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {debrisParticles.map((particle) => {
            const tx = Math.cos(particle.angle) * particle.distance;
            const ty = Math.sin(particle.angle) * particle.distance - 30;
            return (
              <div
                key={`debris-${particle.id}`}
                className="absolute"
                style={{
                  left: '50%',
                  top: '50%',
                  width: `${particle.size}px`,
                  height: `${particle.size * 0.6}px`,
                  backgroundColor: particle.color,
                  borderRadius: '2px',
                  '--debris-tx': `${tx}px`,
                  '--debris-ty': `${ty}px`,
                  '--debris-rot': `${particle.rotation}deg`,
                  animation: `debris-scatter 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${0.05 + particle.delay}s forwards`,
                  opacity: 0,
                  boxShadow: `0 0 3px ${particle.color}`,
                } as unknown as React.CSSProperties}
              />
            );
          })}
        </div>

        <div
          className="absolute text-center"
          style={{
            bottom: '25%',
            left: '50%',
            transform: 'translateX(-50%)',
            animation: 'death-name-reveal 1.8s ease-out 0.2s forwards',
            opacity: 0,
          }}
        >
          <div className="text-3xl font-black tracking-widest uppercase" style={{ color: '#ff4444', textShadow: '0 0 20px rgba(255, 68, 68, 0.8), 0 0 40px rgba(255, 0, 0, 0.4), 2px 2px 0 rgba(0,0,0,0.9), -1px -1px 0 rgba(0,0,0,0.9)' }}>
            {cardName}
          </div>
          <div className="text-sm font-bold tracking-[0.3em] uppercase mt-1" style={{ color: '#ff8888', textShadow: '0 0 10px rgba(255, 68, 68, 0.5), 1px 1px 0 rgba(0,0,0,0.8)' }}>
            ELIMINATO
          </div>
        </div>
      </div>
    </>
  );
};
