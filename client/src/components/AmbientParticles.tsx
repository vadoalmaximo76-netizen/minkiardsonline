import React, { useMemo } from 'react';
import { useIsMobile } from '../hooks/use-is-mobile';

interface ParticleData {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  xDrift?: number;
  type: 'sparkle' | 'dust' | 'ember';
}

interface AmbientParticlesProps {
  visible: boolean;
}

const deterministicRandom = (seed: number): number => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const deterministicRange = (seed: number, min: number, max: number): number => {
  return min + deterministicRandom(seed) * (max - min);
};

export default function AmbientParticles({ visible }: AmbientParticlesProps) {
  const isMobile = useIsMobile();

  const particles = useMemo<ParticleData[]>(() => {
    const result: ParticleData[] = [];
    const sparkleCount = isMobile ? 5 : 15;
    const dustCount = isMobile ? 4 : 12;
    const emberCount = isMobile ? 3 : 8;

    for (let i = 0; i < sparkleCount; i++) {
      result.push({
        id: i,
        left: deterministicRange(i * 1.3, 0, 100),
        top: deterministicRange(i * 4.2, 20, 100),
        size: deterministicRange(i * 1.7, 2, 6),
        duration: deterministicRange(i * 2.1, 8, 14),
        delay: deterministicRange(i * 3.2, 0, 8),
        type: 'sparkle',
      });
    }

    for (let i = 0; i < dustCount; i++) {
      result.push({
        id: i + 100,
        left: 0,
        top: deterministicRange((i + 15) * 1.3, 0, 100),
        size: deterministicRange((i + 15) * 1.7, 2, 4),
        duration: deterministicRange((i + 15) * 2.1, 12, 20),
        delay: deterministicRange((i + 15) * 3.2, 0, 6),
        xDrift: deterministicRange((i + 15) * 5.5, 20, 60),
        type: 'dust',
      });
    }

    for (let i = 0; i < emberCount; i++) {
      result.push({
        id: i + 200,
        left: deterministicRange((i + 27) * 1.3, 5, 95),
        top: deterministicRange((i + 27) * 3.5, 50, 100),
        size: deterministicRange((i + 27) * 1.7, 3, 6),
        duration: deterministicRange((i + 27) * 2.1, 6, 12),
        delay: deterministicRange((i + 27) * 3.2, 0, 10),
        type: 'ember',
      });
    }

    return result;
  }, [isMobile]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes sparkle-twinkle-float {
          0% { transform: translateY(0) scale(0.5); opacity: 0.3; }
          25% { opacity: 1; }
          50% { transform: translateY(-80px) scale(1); opacity: 0.8; }
          75% { opacity: 0.6; }
          100% { transform: translateY(-160px) scale(0.5); opacity: 0; }
        }
        @keyframes dust-drift-sine {
          0% { transform: translateX(0) translateY(0); opacity: 0.4; }
          25% { opacity: 0.7; }
          50% { transform: translateX(var(--dust-drift)) translateY(40px); opacity: 0.5; }
          75% { opacity: 0.6; }
          100% { transform: translateX(0) translateY(80px); opacity: 0.2; }
        }
        @keyframes ember-rise-fade {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          50% { opacity: 0.8; }
          100% { transform: translateY(-120px) scale(0.3); opacity: 0; }
        }
      `}</style>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          overflow: 'hidden',
          borderRadius: 'inherit',
        }}
      >
        {particles.map((p) => {
          if (p.type === 'sparkle') {
            return (
              <div
                key={`sparkle-${p.id}`}
                style={{
                  position: 'absolute',
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  boxShadow: `0 0 ${p.size * 1.5}px #ffffff, 0 0 ${p.size * 3}px rgba(255, 255, 255, 0.6)`,
                  animation: `sparkle-twinkle-float ${p.duration}s ease-in ${p.delay}s infinite`,
                  willChange: isMobile ? 'auto' : 'transform',
                }}
              />
            );
          }
          if (p.type === 'dust') {
            return (
              <div
                key={`dust-${p.id}`}
                style={{
                  position: 'absolute',
                  left: '0',
                  top: `${p.top}%`,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  borderRadius: '50%',
                  backgroundColor: '#d4a574',
                  boxShadow: `0 0 ${p.size * 1.5}px #d4a574, 0 0 ${p.size * 2.5}px rgba(212, 165, 116, 0.5)`,
                  animation: `dust-drift-sine ${p.duration}s ease-in-out ${p.delay}s infinite`,
                  willChange: isMobile ? 'auto' : 'transform',
                  '--dust-drift': `${p.xDrift}px`,
                } as React.CSSProperties}
              />
            );
          }
          return (
            <div
              key={`ember-${p.id}`}
              style={{
                position: 'absolute',
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                borderRadius: '50%',
                backgroundColor: '#ff6b35',
                boxShadow: `0 0 ${p.size * 2}px #ff6b35, 0 0 ${p.size * 3}px rgba(255, 107, 53, 0.6)`,
                animation: `ember-rise-fade ${p.duration}s ease-out ${p.delay}s infinite`,
                willChange: isMobile ? 'auto' : 'transform',
              }}
            />
          );
        })}
      </div>
    </>
  );
}
