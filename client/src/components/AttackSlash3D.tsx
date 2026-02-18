import React, { useEffect, useMemo } from 'react';

interface AttackSlash3DProps {
  isVisible: boolean;
  attackerName: string;
  targetName: string;
  damage: number;
  onComplete: () => void;
}

interface SparkParticle {
  id: number;
  angle: number;
  distance: number;
  delay: number;
  size: number;
  color: string;
}

interface ImpactRing {
  id: number;
  delay: number;
  size: number;
  color: string;
  duration: number;
}

interface DebrisChunk {
  id: number;
  angle: number;
  distance: number;
  size: number;
  delay: number;
  rotation: number;
}

export const AttackSlash3D: React.FC<AttackSlash3DProps> = ({
  isVisible,
  attackerName,
  targetName,
  damage,
  onComplete,
}) => {
  const isHeavy = damage > 40;
  const isCritical = damage > 80;

  const sparkParticles = useMemo<SparkParticle[]>(() => {
    const particles: SparkParticle[] = [];
    const count = isCritical ? 45 : isHeavy ? 35 : 25;
    const sparkColors = ['#ffaa00', '#ff6600', '#ffcc00', '#ff4400', '#ffffff', '#ffdd44'];
    for (let i = 0; i < count; i++) {
      particles.push({
        id: i,
        angle: ((i * 137.508 + 42) % 360) * (Math.PI / 180),
        distance: (isCritical ? 200 : 150) + ((i * 73 + 17) % (isCritical ? 250 : 200)),
        delay: ((i * 13 + 7) % 8) * 0.025,
        size: 4 + (i % 5) * 3,
        color: sparkColors[i % sparkColors.length],
      });
    }
    return particles;
  }, [isHeavy, isCritical]);

  const impactRings = useMemo<ImpactRing[]>(() => {
    const rings: ImpactRing[] = [
      { id: 0, delay: 0, size: 60, color: 'rgba(255, 150, 0, 0.9)', duration: 0.6 },
      { id: 1, delay: 0.08, size: 80, color: 'rgba(255, 200, 50, 0.7)', duration: 0.7 },
      { id: 2, delay: 0.15, size: 100, color: 'rgba(255, 100, 0, 0.5)', duration: 0.8 },
    ];
    if (isHeavy) {
      rings.push({ id: 3, delay: 0.2, size: 120, color: 'rgba(255, 50, 0, 0.4)', duration: 0.9 });
    }
    if (isCritical) {
      rings.push({ id: 4, delay: 0.25, size: 150, color: 'rgba(255, 0, 0, 0.3)', duration: 1.0 });
    }
    return rings;
  }, [isHeavy, isCritical]);

  const debrisChunks = useMemo<DebrisChunk[]>(() => {
    if (!isHeavy) return [];
    const chunks: DebrisChunk[] = [];
    const count = isCritical ? 15 : 8;
    for (let i = 0; i < count; i++) {
      chunks.push({
        id: i,
        angle: ((i * 137.508 + 23) % 360) * (Math.PI / 180),
        distance: 100 + ((i * 53 + 17) % 150),
        size: 4 + (i % 4) * 3,
        delay: ((i * 11 + 5) % 6) * 0.03,
        rotation: ((i * 97 + 31) % 720) - 360,
      });
    }
    return chunks;
  }, [isHeavy, isCritical]);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onComplete, isCritical ? 1800 : 1400);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete, isCritical]);

  if (!isVisible) return null;

  const damageColor = isCritical ? '#ff0000' : isHeavy ? '#ff4444' : '#ff6644';
  const glowColor = isCritical ? 'rgba(255, 0, 0, 0.8)' : isHeavy ? 'rgba(255, 68, 68, 0.6)' : 'rgba(255, 100, 0, 0.5)';

  return (
    <>
      <style>{`
        @keyframes epic-slash-sweep {
          0% { transform: translateX(-150%) rotateZ(-45deg) scaleX(0.2) scaleY(0.5); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateX(150%) rotateZ(-45deg) scaleX(1.5) scaleY(1); opacity: 0; }
        }
        @keyframes epic-slash-sweep-2 {
          0% { transform: translateX(150%) rotateZ(45deg) scaleX(0.2) scaleY(0.5); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateX(-150%) rotateZ(45deg) scaleX(1.5) scaleY(1); opacity: 0; }
        }
        @keyframes epic-slash-cross {
          0% { transform: translateY(-150%) rotateZ(0deg) scaleX(0.3); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(150%) rotateZ(0deg) scaleX(1.2); opacity: 0; }
        }
        @keyframes impact-flash {
          0% { opacity: 0; }
          10% { opacity: ${isCritical ? 0.8 : 0.5}; }
          100% { opacity: 0; }
        }
        @keyframes impact-ring-expand {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          60% { opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(${isCritical ? 8 : 5}); opacity: 0; }
        }
        @keyframes epic-spark-scatter {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          30% { opacity: 1; }
          100% { transform: translate(var(--spark-tx), var(--spark-ty)) scale(0); opacity: 0; }
        }
        @keyframes epic-damage-float {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          15% { transform: translate(-50%, -50%) scale(${isCritical ? 1.8 : 1.3}); opacity: 1; }
          25% { transform: translate(-50%, -50%) scale(${isCritical ? 1.4 : 1.1}); }
          80% { opacity: 1; }
          100% { transform: translate(-50%, calc(-50% - ${isCritical ? 120 : 80}px)) scale(${isCritical ? 1.6 : 1.0}); opacity: 0; }
        }
        @keyframes epic-label-slide {
          0% { transform: translateX(-30px); opacity: 0; }
          30% { transform: translateX(0); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(0) translateY(-20px); opacity: 0; }
        }
        @keyframes debris-fly {
          0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translate(var(--debris-tx), var(--debris-ty)) rotate(var(--debris-rot)) scale(0.2); opacity: 0; }
        }
        @keyframes impact-crater {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
        }
        @keyframes screen-shake-overlay {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(${isCritical ? -8 : -3}px, ${isCritical ? 6 : 2}px); }
          20% { transform: translate(${isCritical ? 6 : 2}px, ${isCritical ? -8 : -3}px); }
          30% { transform: translate(${isCritical ? -6 : -2}px, ${isCritical ? 4 : 1}px); }
          40% { transform: translate(${isCritical ? 4 : 1}px, ${isCritical ? -4 : -1}px); }
          50% { transform: translate(0, 0); }
        }
      `}</style>

      <div className="fixed inset-0 z-[9999] pointer-events-none" style={{ animation: `screen-shake-overlay ${isCritical ? 0.6 : 0.4}s ease-out` }}>
        <div className="absolute inset-0" style={{ background: isCritical ? 'radial-gradient(circle at 50% 50%, rgba(255,50,0,0.4), transparent 60%)' : 'radial-gradient(circle at 50% 50%, rgba(255,150,0,0.2), transparent 60%)', animation: `impact-flash ${isCritical ? 0.6 : 0.4}s ease-out forwards` }} />

        {isCritical && (
          <div className="absolute left-1/2 top-1/2 rounded-full" style={{ width: '40px', height: '40px', background: 'radial-gradient(circle, rgba(255,200,50,0.8), rgba(255,100,0,0.3), transparent)', animation: 'impact-crater 0.8s ease-out 0.1s forwards', opacity: 0 }} />
        )}

        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-0 w-full" style={{ height: isCritical ? '20%' : '12%', transform: 'translateY(-50%)' }}>
            <div style={{ width: '100%', height: '100%', background: `linear-gradient(to right, transparent, ${damageColor}00 10%, ${damageColor}cc 30%, #ffaa00cc 50%, ${damageColor}aa 70%, ${damageColor}00 90%, transparent)`, boxShadow: `0 0 ${isCritical ? 30 : 15}px ${glowColor}, 0 0 ${isCritical ? 60 : 30}px ${glowColor}`, filter: `drop-shadow(0 0 ${isCritical ? 15 : 8}px ${glowColor})`, animation: `epic-slash-sweep 0.35s ease-in-out forwards` }} />
          </div>

          {(isHeavy || isCritical) && (
            <div className="absolute top-1/2 left-0 w-full" style={{ height: isCritical ? '18%' : '10%', transform: 'translateY(-50%)' }}>
              <div style={{ width: '100%', height: '100%', background: `linear-gradient(to left, transparent, ${damageColor}00 10%, #ffcc00aa 40%, ${damageColor}88 60%, ${damageColor}00 90%, transparent)`, boxShadow: `0 0 20px ${glowColor}`, animation: 'epic-slash-sweep-2 0.35s ease-in-out 0.08s forwards', opacity: 0 }} />
            </div>
          )}

          {isCritical && (
            <div className="absolute top-0 left-1/2 h-full" style={{ width: '8%', transform: 'translateX(-50%)' }}>
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(to bottom, transparent, #ff000000 10%, #ff4444aa 40%, #ffaa0088 60%, #ff000000 90%, transparent)', boxShadow: '0 0 25px rgba(255,0,0,0.5)', animation: 'epic-slash-cross 0.3s ease-in-out 0.15s forwards', opacity: 0 }} />
            </div>
          )}
        </div>

        {impactRings.map((ring) => (
          <div
            key={ring.id}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: `${ring.size}px`,
              height: `${ring.size}px`,
              border: `${isCritical ? 4 : 3}px solid ${ring.color}`,
              boxShadow: `0 0 ${isCritical ? 20 : 12}px ${ring.color}, inset 0 0 ${isCritical ? 15 : 8}px ${ring.color}`,
              animation: `impact-ring-expand ${ring.duration}s ease-out ${ring.delay}s forwards`,
              opacity: 0,
            }}
          />
        ))}

        {sparkParticles.map((spark) => {
          const tx = Math.cos(spark.angle) * spark.distance;
          const ty = Math.sin(spark.angle) * spark.distance;
          return (
            <div
              key={spark.id}
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: `${spark.size}px`,
                height: `${spark.size}px`,
                marginLeft: `${-spark.size / 2}px`,
                marginTop: `${-spark.size / 2}px`,
                background: `radial-gradient(circle, ${spark.color}, ${spark.color}88)`,
                boxShadow: `0 0 ${spark.size * 2}px ${spark.color}`,
                '--spark-tx': `${tx}px`,
                '--spark-ty': `${ty}px`,
                animation: `epic-spark-scatter 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${0.35 + spark.delay}s forwards`,
                opacity: 0,
              } as unknown as React.CSSProperties}
            />
          );
        })}

        {debrisChunks.map((chunk) => {
          const tx = Math.cos(chunk.angle) * chunk.distance;
          const ty = Math.sin(chunk.angle) * chunk.distance - 20;
          return (
            <div
              key={`debris-${chunk.id}`}
              className="absolute left-1/2 top-1/2"
              style={{
                width: `${chunk.size}px`,
                height: `${chunk.size * 0.7}px`,
                marginLeft: `${-chunk.size / 2}px`,
                marginTop: `${-chunk.size / 2}px`,
                backgroundColor: '#8b7355',
                borderRadius: '2px',
                boxShadow: '0 0 4px rgba(139, 115, 85, 0.6)',
                '--debris-tx': `${tx}px`,
                '--debris-ty': `${ty}px`,
                '--debris-rot': `${chunk.rotation}deg`,
                animation: `debris-fly 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${0.3 + chunk.delay}s forwards`,
                opacity: 0,
              } as unknown as React.CSSProperties}
            />
          );
        })}

        <div
          className="absolute left-1/2 top-1/2 flex flex-col items-center gap-0"
          style={{
            animation: `epic-damage-float ${isCritical ? 1.5 : 1.1}s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s forwards`,
            opacity: 0,
            zIndex: 10,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{
            fontSize: isCritical ? '1.3rem' : '1.1rem',
            fontWeight: 800,
            color: '#ffaa00',
            textShadow: `0 0 12px rgba(255, 170, 0, 0.9), 0 0 24px rgba(255, 100, 0, 0.5), 2px 2px 0 rgba(0,0,0,0.9)`,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            animation: 'epic-label-slide 1s ease-out 0.4s forwards',
            opacity: 0,
          }}>
            {attackerName}
          </div>

          {isCritical && (
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 900,
              color: '#ff0000',
              textShadow: '0 0 15px rgba(255,0,0,0.9), 0 0 30px rgba(255,0,0,0.5)',
              letterSpacing: '6px',
              textTransform: 'uppercase',
              animation: 'epic-label-slide 0.8s ease-out 0.45s forwards',
              opacity: 0,
            }}>
              CRITICO!
            </div>
          )}

          <div style={{
            fontSize: isCritical ? '5rem' : isHeavy ? '4.5rem' : '3.5rem',
            fontWeight: 900,
            color: damageColor,
            textShadow: `0 0 15px ${glowColor}, 0 0 30px ${glowColor}, 0 0 60px ${glowColor}, 3px 3px 0 rgba(0,0,0,0.9)`,
            lineHeight: 1,
            letterSpacing: '-2px',
          }}>
            {damage}
          </div>

          <div style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.6)',
            textShadow: '1px 1px 0 rgba(0,0,0,0.9)',
            letterSpacing: '3px',
            textTransform: 'uppercase',
          }}>
            SU
          </div>

          <div style={{
            fontSize: isCritical ? '1.2rem' : '1rem',
            fontWeight: 800,
            color: '#66bbff',
            textShadow: '0 0 10px rgba(102, 187, 255, 0.8), 0 0 20px rgba(102, 187, 255, 0.4), 2px 2px 0 rgba(0,0,0,0.9)',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            animation: 'epic-label-slide 1s ease-out 0.5s forwards',
            opacity: 0,
          }}>
            {targetName}
          </div>
        </div>
      </div>
    </>
  );
};
