import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── MOBILE FAST PATH ────────────────────────────────────────────────────────
// On mobile, the full AttackSlash3D (WebGL canvas + 25-45 sparks + rings +
// screen shake) causes severe frame drops. Instead we render a lightweight
// CSS-only overlay: a brief screen flash + a floating damage number.
// The Three.js canvas, spark particles, and impact rings are all skipped.
// ─────────────────────────────────────────────────────────────────────────────
const AttackSlash3DMobile: React.FC<{
  damage: number;
  attackerName: string;
  targetName: string;
  isCritical: boolean;
  onComplete: () => void;
}> = ({ damage, attackerName, targetName, isCritical, onComplete }) => {
  const damageColor = isCritical ? '#ff2222' : '#ff6644';
  const glowColor = isCritical ? 'rgba(255,0,0,0.7)' : 'rgba(255,100,0,0.5)';

  const onCompleteRef1 = useRef(onComplete);
  useEffect(() => { onCompleteRef1.current = onComplete; });
  useEffect(() => {
    const timer = setTimeout(() => onCompleteRef1.current(), isCritical ? 900 : 650);
    return () => clearTimeout(timer);
  }, [isCritical]);

  return (
    <div
      className="fixed inset-0 z-[9999] pointer-events-none"
      style={{ animation: 'attack-mobile-flash 0.4s ease-out forwards' }}
    >
      <style>{`
        @keyframes attack-mobile-flash {
          0%   { background: rgba(255,80,0,${isCritical ? 0.35 : 0.2}); }
          25%  { background: rgba(255,80,0,0.05); }
          100% { background: transparent; }
        }
        @keyframes attack-mobile-number {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
          20%  { opacity: 1; transform: translate(-50%, -50%) scale(${isCritical ? 1.3 : 1.1}); }
          75%  { opacity: 1; transform: translate(-50%, calc(-50% - 40px)) scale(1); }
          100% { opacity: 0; transform: translate(-50%, calc(-50% - 70px)) scale(0.8); }
        }
        @keyframes attack-mobile-label {
          0%   { opacity: 0; transform: translateY(6px); }
          30%  { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      <div
        className="absolute left-1/2 top-1/3 flex flex-col items-center gap-0"
        style={{ animation: 'attack-mobile-number 0.65s ease-out forwards', opacity: 0 }}
      >
        {isCritical && (
          <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#ff0', letterSpacing: '4px', animation: 'attack-mobile-label 0.6s ease-out forwards', opacity: 0, textShadow: '1px 1px 0 #000' }}>
            CRITICO!
          </div>
        )}
        <div style={{ fontSize: isCritical ? '4rem' : '3rem', fontWeight: 900, color: damageColor, textShadow: `0 0 12px ${glowColor}, 2px 2px 0 #000`, lineHeight: 1 }}>
          {damage}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '2px', textTransform: 'uppercase', animation: 'attack-mobile-label 0.6s ease-out 0.1s forwards', opacity: 0, textShadow: '1px 1px 0 #000' }}>
          {attackerName} → {targetName}
        </div>
      </div>
    </div>
  );
};

interface AttackSlash3DProps {
  isVisible: boolean;
  attackerName: string;
  targetName: string;
  damage: number;
  onComplete: () => void;
}

interface SlashData {
  id: number;
  rotZ: number;
  offsetY: number;
  color: string;
  glowColor: string;
  width: number;
  height: number;
  delay: number;
  startX: number;
  endX: number;
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

const SlashMesh: React.FC<{ slash: SlashData }> = ({ slash }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const startTime = useRef(Date.now() + slash.delay * 1000);

  useFrame(() => {
    if (!meshRef.current || !matRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    if (elapsed < 0) return;
    const t = Math.min(elapsed / 0.35, 1);
    meshRef.current.position.x = slash.startX + (slash.endX - slash.startX) * t;
    meshRef.current.position.y = slash.offsetY;
    meshRef.current.scale.x = 0.2 + t * 0.8;
    matRef.current.opacity = elapsed < 0.25 ? t * 4 : Math.max(0, 1 - (elapsed - 0.25) * 3);
  });

  return (
    <mesh ref={meshRef} position={[slash.startX, slash.offsetY, 0]} rotation={[0, 0, slash.rotZ]}>
      <boxGeometry args={[slash.width, slash.height, 0.05]} />
      <meshStandardMaterial
        ref={matRef}
        color={slash.color}
        emissive={slash.glowColor}
        emissiveIntensity={2}
        transparent
        opacity={0}
      />
    </mesh>
  );
};

const EnergyOrbAtCenter: React.FC<{ color: string }> = ({ color }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTime = useRef(Date.now() + 150);

  useFrame(() => {
    if (!meshRef.current || !matRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    if (elapsed < 0) return;
    const scale = 1 + elapsed * 6;
    meshRef.current.scale.setScalar(scale);
    matRef.current.opacity = Math.max(0, 0.7 - elapsed * 1.4);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0.1]}>
      <sphereGeometry args={[0.3, 16, 16]} />
      <meshBasicMaterial ref={matRef} color={color} transparent opacity={0.7} />
    </mesh>
  );
};

const Scene3D: React.FC<{ isHeavy: boolean; isCritical: boolean; slashData: SlashData[] }> = ({ isHeavy, isCritical, slashData }) => {
  const primaryColor = isCritical ? '#ff0000' : isHeavy ? '#ff4444' : '#ff6644';
  const glowColor = isCritical ? '#ff2200' : isHeavy ? '#ff6600' : '#ff8800';

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 0, 3]} intensity={isCritical ? 12 : isHeavy ? 8 : 5} color={primaryColor} />
      <pointLight position={[0, 2, 3]} intensity={4} color="#ffaa00" />
      {slashData.map((slash) => (
        <SlashMesh key={slash.id} slash={slash} />
      ))}
      {isCritical && <EnergyOrbAtCenter color="#ff4400" />}
      {isHeavy && !isCritical && <EnergyOrbAtCenter color="#ff8800" />}
    </>
  );
};

export const AttackSlash3D: React.FC<AttackSlash3DProps> = ({
  isVisible,
  attackerName,
  targetName,
  damage,
  onComplete,
}) => {
  const isHeavy = damage > 40;
  const isCritical = damage > 80;

  // Detect mobile once at mount. Must be called BEFORE any conditional return
  // to respect React's rules of hooks.
  const isMobile = useMemo(() => typeof window !== 'undefined' && window.innerWidth <= 768, []);

  const slashData = useMemo<SlashData[]>(() => {
    const slashes: SlashData[] = [];
    const primaryColor = isCritical ? '#ff2200' : isHeavy ? '#ff4444' : '#ff6644';
    const glowColor = isCritical ? '#ff0000' : isHeavy ? '#ff4400' : '#ff8800';

    slashes.push({
      id: 0,
      rotZ: (-Math.PI / 4) * 0.8,
      offsetY: 0,
      color: primaryColor,
      glowColor,
      width: 6,
      height: 0.25,
      delay: 0,
      startX: -4,
      endX: 4,
    });

    if (isHeavy || isCritical) {
      slashes.push({
        id: 1,
        rotZ: (Math.PI / 4) * 0.8,
        offsetY: 0,
        color: isCritical ? '#ffcc00' : '#ff8800',
        glowColor: isCritical ? '#ffaa00' : '#ff6600',
        width: 6,
        height: 0.2,
        delay: 0.07,
        startX: 4,
        endX: -4,
      });
    }

    if (isCritical) {
      slashes.push({
        id: 2,
        rotZ: 0,
        offsetY: 0,
        color: '#9900ff',
        glowColor: '#cc44ff',
        width: 0.2,
        height: 7,
        delay: 0.12,
        startX: 0,
        endX: 0,
      });
    }

    return slashes;
  }, [isHeavy, isCritical]);

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
    if (isHeavy) rings.push({ id: 3, delay: 0.2, size: 120, color: 'rgba(255, 50, 0, 0.4)', duration: 0.9 });
    if (isCritical) rings.push({ id: 4, delay: 0.25, size: 150, color: 'rgba(255, 0, 0, 0.3)', duration: 1.0 });
    return rings;
  }, [isHeavy, isCritical]);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => onCompleteRef.current(), isCritical ? 1200 : 900);
      return () => clearTimeout(timer);
    }
  }, [isVisible, isCritical]);

  if (!isVisible) return null;

  // On mobile: skip WebGL canvas + 25-45 sparks + 3-5 rings + screen shake.
  // Initializing a WebGL context per-attack causes severe frame drops.
  if (isMobile) {
    return (
      <AttackSlash3DMobile
        damage={damage}
        attackerName={attackerName}
        targetName={targetName}
        isCritical={isCritical}
        onComplete={onComplete}
      />
    );
  }

  const damageColor = isCritical ? '#ff0000' : isHeavy ? '#ff4444' : '#ff6644';
  const glowColor = isCritical ? 'rgba(255, 0, 0, 0.8)' : isHeavy ? 'rgba(255, 68, 68, 0.6)' : 'rgba(255, 100, 0, 0.5)';

  return (
    <>
      <style>{`
        @keyframes impact-flash-3d {
          0% { opacity: 0; }
          10% { opacity: ${isCritical ? 0.8 : 0.5}; }
          100% { opacity: 0; }
        }
        @keyframes impact-ring-expand-3d {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          60% { opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(${isCritical ? 8 : 5}); opacity: 0; }
        }
        @keyframes spark-scatter-3d {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          30% { opacity: 1; }
          100% { transform: translate(var(--spark-tx), var(--spark-ty)) scale(0); opacity: 0; }
        }
        @keyframes damage-float-3d {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          15% { transform: translate(-50%, -50%) scale(${isCritical ? 1.8 : 1.3}); opacity: 1; }
          25% { transform: translate(-50%, -50%) scale(${isCritical ? 1.4 : 1.1}); }
          80% { opacity: 1; }
          100% { transform: translate(-50%, calc(-50% - ${isCritical ? 120 : 80}px)) scale(${isCritical ? 1.6 : 1.0}); opacity: 0; }
        }
        @keyframes label-slide-3d {
          0% { transform: translateX(-30px); opacity: 0; }
          30% { transform: translateX(0); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(0) translateY(-20px); opacity: 0; }
        }
        @keyframes screen-shake-3d {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(${isCritical ? -8 : -3}px, ${isCritical ? 6 : 2}px); }
          20% { transform: translate(${isCritical ? 6 : 2}px, ${isCritical ? -8 : -3}px); }
          30% { transform: translate(${isCritical ? -6 : -2}px, ${isCritical ? 4 : 1}px); }
          40% { transform: translate(${isCritical ? 4 : 1}px, ${isCritical ? -4 : -1}px); }
          50% { transform: translate(0, 0); }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[9999] pointer-events-none"
        style={{ animation: `screen-shake-3d ${isCritical ? 0.6 : 0.4}s ease-out` }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: isCritical
              ? 'radial-gradient(circle at 50% 50%, rgba(255,50,0,0.4), transparent 60%)'
              : 'radial-gradient(circle at 50% 50%, rgba(255,150,0,0.2), transparent 60%)',
            animation: `impact-flash-3d ${isCritical ? 0.6 : 0.4}s ease-out forwards`,
          }}
        />

        <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
          <Canvas
            camera={{ position: [0, 0, 5], fov: 70 }}
            style={{ pointerEvents: 'none', background: 'transparent' }}
            gl={{ alpha: true }}
            onCreated={({ gl }) => {
              const canvas = gl.domElement;
              const handleContextLost = (e: Event) => {
                e.preventDefault();
              };
              const handleContextRestored = () => {
                gl.setSize(canvas.clientWidth, canvas.clientHeight);
              };
              canvas.addEventListener('webglcontextlost', handleContextLost);
              canvas.addEventListener('webglcontextrestored', handleContextRestored);
            }}
          >
            <Scene3D isHeavy={isHeavy} isCritical={isCritical} slashData={slashData} />
          </Canvas>
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
              animation: `impact-ring-expand-3d ${ring.duration}s ease-out ${ring.delay}s forwards`,
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
                animation: `spark-scatter-3d 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${0.3 + spark.delay}s forwards`,
                opacity: 0,
              } as unknown as React.CSSProperties}
            />
          );
        })}

        <div
          className="absolute left-1/2 top-1/2 flex flex-col items-center gap-0"
          style={{
            animation: `damage-float-3d ${isCritical ? 1.5 : 1.1}s cubic-bezier(0.34, 1.56, 0.64, 1) 0.35s forwards`,
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
            animation: 'label-slide-3d 1s ease-out 0.35s forwards',
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
              animation: 'label-slide-3d 0.8s ease-out 0.4s forwards',
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
            animation: 'label-slide-3d 1s ease-out 0.45s forwards',
            opacity: 0,
          }}>
            {targetName}
          </div>
        </div>
      </div>
    </>
  );
};
