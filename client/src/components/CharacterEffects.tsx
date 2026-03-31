import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type CharacterEffectType = 'physical' | 'fire' | 'lightning' | 'energy' | 'critical' | 'death';

interface CharacterEffectProps {
  isVisible: boolean;
  effectType: CharacterEffectType | 'attack';
  onComplete: () => void;
  characterName?: string;
}

const ImpactParticles: React.FC<{ color: string; count?: number; speed?: number }> = ({ color, count = 30, speed = 0.3 }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const velocitiesRef = useRef<Float32Array>();

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle1 = (i * 137.508 * Math.PI) / 180;
      const angle2 = (i * 73.2 * Math.PI) / 180;
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;
      vel[i * 3] = Math.cos(angle1) * Math.cos(angle2) * speed;
      vel[i * 3 + 1] = Math.sin(angle2) * speed + 0.05;
      vel[i * 3 + 2] = Math.sin(angle1) * Math.cos(angle2) * speed;
    }
    velocitiesRef.current = vel;
    return pos;
  }, [count, speed]);

  useFrame((_, delta) => {
    if (!pointsRef.current || !velocitiesRef.current) return;
    const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      posArray[i * 3] += velocitiesRef.current[i * 3];
      posArray[i * 3 + 1] += velocitiesRef.current[i * 3 + 1];
      posArray[i * 3 + 2] += velocitiesRef.current[i * 3 + 2];
      velocitiesRef.current[i * 3 + 1] -= 0.008;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.18} color={color} transparent opacity={0.9} />
    </points>
  );
};

const ShockwaveRing: React.FC<{ color: string; delay?: number; speed?: number }> = ({ color, delay = 0, speed = 4 }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTime = useRef(Date.now() + delay * 1000);

  useFrame(() => {
    if (!ringRef.current || !matRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    if (elapsed < 0) return;
    const scale = 0.5 + elapsed * speed;
    ringRef.current.scale.setScalar(scale);
    matRef.current.opacity = Math.max(0, 1 - elapsed * 1.5);
  });

  return (
    <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.4, 0.65, 32]} />
      <meshBasicMaterial ref={matRef} color={color} transparent opacity={1} side={THREE.DoubleSide} />
    </mesh>
  );
};

const PhysicalEffect: React.FC = () => {
  const slashRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTime = useRef(Date.now());

  useFrame(() => {
    if (!slashRef.current || !matRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    slashRef.current.rotation.z = -Math.PI / 4 + elapsed * 2;
    slashRef.current.scale.x = 1 + Math.sin(elapsed * 10) * 0.2;
    matRef.current.opacity = Math.max(0, 1 - elapsed);
  });

  return (
    <>
      <ambientLight intensity={0.8} />
      <pointLight position={[0, 2, 2]} intensity={3} color="#ff4444" />
      <pointLight position={[-2, 0, 2]} intensity={2} color="#ff8800" />
      <mesh ref={slashRef}>
        <planeGeometry args={[3.5, 0.35]} />
        <meshBasicMaterial ref={matRef} color="#ff4444" transparent opacity={1} side={THREE.DoubleSide} />
      </mesh>
      <ImpactParticles color="#ff6600" count={50} />
      <ImpactParticles color="#ffaa00" count={30} />
      <ShockwaveRing color="#ff4444" delay={0} />
      <ShockwaveRing color="#ff8800" delay={0.12} />
      <ShockwaveRing color="#ffaa00" delay={0.25} />
      <mesh position={[0, 0, -0.5]}>
        <circleGeometry args={[0.8, 32]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.3} />
      </mesh>
    </>
  );
};

const FlameParticle: React.FC<{ offsetX: number; offsetZ: number; speed: number; size: number }> = ({ offsetX, offsetZ, speed, size }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTime = useRef(Date.now());

  useFrame(() => {
    if (!meshRef.current || !matRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    const loop = elapsed % (1.2 / speed);
    const t = loop * speed;
    meshRef.current.position.set(
      offsetX + Math.sin(elapsed * 4 + offsetX * 5) * 0.25,
      t * 2.5,
      offsetZ + Math.cos(elapsed * 3 + offsetZ * 5) * 0.25
    );
    const scale = (1 - t * 0.6) * size;
    meshRef.current.scale.setScalar(Math.max(0.01, scale));
    matRef.current.opacity = Math.max(0, 1 - t * 1.2);
  });

  return (
    <mesh ref={meshRef} position={[offsetX, 0, offsetZ]}>
      <coneGeometry args={[0.18, 0.45, 8]} />
      <meshBasicMaterial ref={matRef} color="#ff6600" transparent opacity={0.9} />
    </mesh>
  );
};

const FireEffect: React.FC = () => {
  const flameData = useMemo(() => {
    const flames = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i * 137.508 * Math.PI) / 180;
      const r = 0.2 + (i % 4) * 0.2;
      flames.push({
        offsetX: Math.cos(angle) * r,
        offsetZ: Math.sin(angle) * r,
        speed: 0.6 + (i % 5) * 0.12,
        size: 0.8 + (i % 3) * 0.3,
      });
    }
    return flames;
  }, []);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 1, 2]} intensity={5} color="#ff4400" />
      <pointLight position={[1, 0, 2]} intensity={3} color="#ffaa00" />
      <pointLight position={[-1, 0, 2]} intensity={3} color="#ff6600" />
      {flameData.map((f, i) => (
        <FlameParticle key={i} offsetX={f.offsetX} offsetZ={f.offsetZ} speed={f.speed} size={f.size} />
      ))}
      <ImpactParticles color="#ff4400" count={50} speed={0.25} />
      <ImpactParticles color="#ffaa00" count={35} speed={0.18} />
      <ShockwaveRing color="#ff6600" delay={0} speed={3} />
      <ShockwaveRing color="#ff4400" delay={0.15} speed={3.5} />
      <ShockwaveRing color="#ffcc00" delay={0.3} speed={2.5} />
      <mesh position={[0, 0, -0.8]}>
        <circleGeometry args={[1.2, 32]} />
        <meshBasicMaterial color="#ff4400" transparent opacity={0.25} />
      </mesh>
    </>
  );
};

const LightningBolt: React.FC<{ angle: number; length: number; delay: number }> = ({ angle, length, delay }) => {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTime = useRef(Date.now() + delay * 1000);

  useFrame(() => {
    if (!groupRef.current || !matRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    if (elapsed < 0) return;
    const flicker = Math.sin(elapsed * 30) * 0.5 + 0.5;
    matRef.current.opacity = Math.max(0, (1 - elapsed * 2) * flicker);
  });

  const segments = useMemo(() => {
    const segs = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      segs.push({
        x: ((i * 31 + 7) % 20 - 10) * 0.04,
        y: (i / count) * length,
      });
    }
    return segs;
  }, [length]);

  return (
    <group ref={groupRef} rotation={[0, 0, angle]}>
      {segments.map((seg, i) => (
        i < segments.length - 1 && (
          <mesh key={i} position={[(seg.x + segments[i + 1].x) / 2, (seg.y + segments[i + 1].y) / 2, 0]}>
            <boxGeometry args={[0.06, length / 6, 0.06]} />
            <meshBasicMaterial ref={i === 0 ? matRef : undefined} color="#aaeeFF" transparent opacity={0.95} />
          </mesh>
        )
      ))}
    </group>
  );
};

const LightningEffect: React.FC = () => {
  const boltData = useMemo(() => {
    const bolts = [];
    const count = 8;
    for (let i = 0; i < count; i++) {
      bolts.push({
        angle: (i * 45 * Math.PI) / 180,
        length: 1.5 + (i % 3) * 0.7,
        delay: (i * 7 % 10) * 0.03,
      });
    }
    return bolts;
  }, []);

  const coreRef = useRef<THREE.Mesh>(null);
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTime = useRef(Date.now());

  useFrame(() => {
    if (!coreRef.current || !coreMatRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    const flicker = Math.sin(elapsed * 25) * 0.4 + 0.6;
    coreRef.current.scale.setScalar((1 + Math.sin(elapsed * 15) * 0.3) * flicker);
    coreMatRef.current.opacity = Math.max(0, (1 - elapsed) * flicker);
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 0, 2]} intensity={8} color="#aaaaff" />
      <pointLight position={[0, 2, 2]} intensity={4} color="#ffffff" />
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial ref={coreMatRef} color="#ffffff" transparent opacity={1} />
      </mesh>
      {boltData.map((b, i) => (
        <LightningBolt key={i} angle={b.angle} length={b.length} delay={b.delay} />
      ))}
      <ImpactParticles color="#aaaaff" count={40} speed={0.35} />
      <ImpactParticles color="#ffffff" count={25} speed={0.22} />
      <ShockwaveRing color="#aaaaff" delay={0} speed={5} />
      <ShockwaveRing color="#ffffff" delay={0.1} speed={6} />
      <ShockwaveRing color="#4444ff" delay={0.2} speed={4} />
    </>
  );
};

const EnergyOrb: React.FC = () => {
  const orbRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const orbMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTime = useRef(Date.now());

  useFrame(() => {
    if (!orbRef.current || !glowRef.current || !orbMatRef.current || !glowMatRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    const phase = Math.min(elapsed / 0.3, 1);
    const expand = elapsed > 0.3 ? Math.max(0, 1 - (elapsed - 0.3) * 2) : 0;
    const size = phase * (1 + expand * 3);
    orbRef.current.scale.setScalar(size);
    glowRef.current.scale.setScalar(size * 2.2);
    orbMatRef.current.opacity = Math.max(0, 1 - (elapsed - 0.3) * 1.8);
    glowMatRef.current.opacity = Math.max(0, (0.5 - Math.abs(elapsed - 0.4)) * 1.5);
    orbRef.current.rotation.y = elapsed * 3;
    orbRef.current.rotation.z = elapsed * 2;
  });

  return (
    <>
      <mesh ref={glowRef} position={[0, 0, -0.2]}>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshBasicMaterial ref={glowMatRef} color="#9900ff" transparent opacity={0.4} />
      </mesh>
      <mesh ref={orbRef}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshBasicMaterial ref={orbMatRef} color="#cc44ff" transparent opacity={0.95} wireframe />
      </mesh>
    </>
  );
};

const EnergyEffect: React.FC = () => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 2]} intensity={8} color="#9900ff" />
      <pointLight position={[2, 1, 2]} intensity={4} color="#cc44ff" />
      <pointLight position={[-2, -1, 2]} intensity={4} color="#00ccff" />
      <EnergyOrb />
      <ImpactParticles color="#cc44ff" count={60} speed={0.28} />
      <ImpactParticles color="#00ccff" count={40} speed={0.2} />
      <ImpactParticles color="#ffffff" count={20} speed={0.4} />
      <ShockwaveRing color="#9900ff" delay={0.3} speed={5} />
      <ShockwaveRing color="#cc44ff" delay={0.4} speed={4} />
      <ShockwaveRing color="#00ccff" delay={0.5} speed={3.5} />
      <ShockwaveRing color="#ffffff" delay={0.6} speed={6} />
    </>
  );
};

const CriticalEffect: React.FC = () => {
  const coreRef = useRef<THREE.Mesh>(null);
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTime = useRef(Date.now());

  useFrame(() => {
    if (!coreRef.current || !coreMatRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    coreRef.current.scale.setScalar(1 + elapsed * 4);
    coreRef.current.rotation.z = elapsed * 5;
    coreMatRef.current.opacity = Math.max(0, 1 - elapsed * 1.2);
  });

  const boltData = useMemo(() => {
    const bolts = [];
    for (let i = 0; i < 12; i++) {
      bolts.push({
        angle: (i * 30 * Math.PI) / 180,
        length: 2 + (i % 4) * 0.5,
        delay: (i * 7 % 12) * 0.02,
      });
    }
    return bolts;
  }, []);

  return (
    <>
      <ambientLight intensity={1} />
      <pointLight position={[0, 0, 2]} intensity={12} color="#ffffff" />
      <pointLight position={[2, 2, 2]} intensity={6} color="#ff4400" />
      <pointLight position={[-2, -2, 2]} intensity={6} color="#ffcc00" />
      <pointLight position={[2, -2, 2]} intensity={6} color="#9900ff" />
      <mesh ref={coreRef}>
        <torusGeometry args={[0.4, 0.12, 8, 24]} />
        <meshBasicMaterial ref={coreMatRef} color="#ffffff" transparent opacity={1} />
      </mesh>
      {boltData.map((b, i) => (
        <LightningBolt key={i} angle={b.angle} length={b.length} delay={b.delay} />
      ))}
      <ImpactParticles color="#ff4400" count={50} speed={0.4} />
      <ImpactParticles color="#ffcc00" count={40} speed={0.35} />
      <ImpactParticles color="#9900ff" count={35} speed={0.3} />
      <ImpactParticles color="#ffffff" count={25} speed={0.5} />
      <ShockwaveRing color="#ffffff" delay={0} speed={7} />
      <ShockwaveRing color="#ff4400" delay={0.1} speed={5} />
      <ShockwaveRing color="#ffcc00" delay={0.2} speed={4} />
      <ShockwaveRing color="#9900ff" delay={0.3} speed={3.5} />
      <ShockwaveRing color="#ffffff" delay={0.4} speed={6} />
    </>
  );
};

const DeathEffect: React.FC = () => {
  const skullRef = useRef<THREE.Group>(null);
  const startTime = useRef(Date.now());
  const spiritParticles = useMemo(() => {
    const particles = [];
    for (let i = 0; i < 20; i++) {
      const angle = (i * 137.508 * Math.PI) / 180;
      const r = (i % 4) * 0.4;
      particles.push({
        x: Math.cos(angle) * r,
        y: (i % 3) * 0.4,
        z: Math.sin(angle) * r,
        speed: 0.4 + (i % 5) * 0.08,
      });
    }
    return particles;
  }, []);

  useFrame(() => {
    if (!skullRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    skullRef.current.rotation.y = elapsed * 0.5;
    skullRef.current.position.y = Math.sin(elapsed * 2) * 0.2;
    skullRef.current.scale.setScalar(1 + Math.sin(elapsed * 3) * 0.1);
  });

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 3, 2]} intensity={4} color="#8800ff" />
      <pointLight position={[-2, 0, 2]} intensity={2} color="#ff00ff" />
      <pointLight position={[2, 0, 2]} intensity={2} color="#4400ff" />
      <group ref={skullRef}>
        <mesh>
          <sphereGeometry args={[0.6, 32, 32]} />
          <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.2} emissive="#440044" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[-0.2, 0.1, 0.5]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
        <mesh position={[0.2, 0.1, 0.5]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      </group>
      {spiritParticles.map((p, i) => (
        <SpiritParticle key={i} initialX={p.x} initialY={p.y} initialZ={p.z} speed={p.speed} />
      ))}
      <ShockwaveRing color="#8800ff" delay={0} />
      <ShockwaveRing color="#ff00ff" delay={0.15} />
      <ShockwaveRing color="#4400ff" delay={0.3} />
      <ImpactParticles color="#8800ff" count={60} />
      <ImpactParticles color="#ff00ff" count={40} />
    </>
  );
};

const SpiritParticle: React.FC<{ initialX: number; initialY: number; initialZ: number; speed: number }> = ({ initialX, initialY, initialZ, speed }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTime = useRef(Date.now());

  useFrame(() => {
    if (!meshRef.current || !matRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    meshRef.current.position.y = initialY + elapsed * speed;
    meshRef.current.position.x = initialX + Math.sin(elapsed * 3 + initialX * 10) * 0.3;
    meshRef.current.position.z = initialZ + Math.cos(elapsed * 2 + initialZ * 10) * 0.3;
    matRef.current.opacity = Math.max(0, 1 - elapsed * 0.5);
  });

  return (
    <mesh ref={meshRef} position={[initialX, initialY, initialZ]}>
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshBasicMaterial ref={matRef} color="#aa88ff" transparent opacity={0.8} />
    </mesh>
  );
};

function getEffectConfig(effectType: CharacterEffectType | 'attack') {
  const normalized: CharacterEffectType = effectType === 'attack' ? 'physical' : effectType;

  switch (normalized) {
    case 'fire':
      return {
        bg: 'from-orange-900/60 via-red-900/40 to-transparent',
        emoji: '🔥',
        label: (name?: string) => name ? `${name} IN FIAMME!` : 'IN FIAMME!',
        duration: 1100,
        borderClass: 'bg-orange-900/80 border-orange-500/50',
        textShadow: '0 0 20px rgba(255,100,0,0.8)',
      };
    case 'lightning':
      return {
        bg: 'from-blue-900/60 via-purple-900/40 to-transparent',
        emoji: '⚡',
        label: (name?: string) => name ? `${name} FULMINATO!` : 'FULMINATO!',
        duration: 900,
        borderClass: 'bg-blue-900/80 border-blue-300/50',
        textShadow: '0 0 20px rgba(100,100,255,0.8)',
      };
    case 'energy':
      return {
        bg: 'from-purple-900/70 via-cyan-900/40 to-transparent',
        emoji: '💥',
        label: (name?: string) => name ? `${name} COLPITO!` : 'COLPO ENERGETICO!',
        duration: 1200,
        borderClass: 'bg-purple-900/80 border-purple-400/50',
        textShadow: '0 0 20px rgba(180,0,255,0.8)',
      };
    case 'critical':
      return {
        bg: 'from-yellow-900/70 via-red-900/60 to-transparent',
        emoji: '💫',
        label: (name?: string) => name ? `CRITICO SU ${name}!` : 'COLPO CRITICO!',
        duration: 3000,
        borderClass: 'bg-yellow-900/80 border-yellow-400/50',
        textShadow: '0 0 20px rgba(255,200,0,0.9)',
      };
    case 'death':
      return {
        bg: 'from-purple-900/70 via-black/50 to-transparent',
        emoji: '💀',
        label: (name?: string) => name ? `${name} ELIMINATO!` : 'ELIMINATO!',
        duration: 1200,
        borderClass: 'bg-purple-900/80 border-purple-500/50',
        textShadow: '0 0 20px rgba(136,0,255,0.8)',
      };
    default:
      return {
        bg: 'from-red-900/60 via-orange-900/40 to-transparent',
        emoji: '💥',
        label: (name?: string) => name ? `${name} COLPITO!` : 'COLPITO!',
        duration: 800,
        borderClass: 'bg-red-900/80 border-red-500/50',
        textShadow: '0 0 20px rgba(255,0,0,0.8)',
      };
  }
}

function renderEffect(effectType: CharacterEffectType | 'attack') {
  const normalized: CharacterEffectType = effectType === 'attack' ? 'physical' : effectType;
  switch (normalized) {
    case 'fire': return <FireEffect />;
    case 'lightning': return <LightningEffect />;
    case 'energy': return <EnergyEffect />;
    case 'critical': return <CriticalEffect />;
    case 'death': return <DeathEffect />;
    default: return <PhysicalEffect />;
  }
}

export const CharacterEffects: React.FC<CharacterEffectProps> = ({
  isVisible,
  effectType,
  onComplete,
  characterName,
}) => {
  const config = getEffectConfig(effectType);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onComplete, config.duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete, effectType]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className={`absolute inset-0 bg-gradient-radial ${config.bg}`} />
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        <Canvas camera={{ position: [0, 0, 5], fov: 60 }} style={{ pointerEvents: 'none' }}>
          {renderEffect(effectType)}
        </Canvas>
      </div>
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="text-[100px] animate-bounce" style={{ filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.5))' }}>
          {config.emoji}
        </div>
        <div className={`px-8 py-4 rounded-2xl border ${config.borderClass}`}>
          <h2
            className="text-white text-3xl font-bold tracking-wider text-center animate-pulse"
            style={{ textShadow: config.textShadow }}
          >
            {config.label(characterName)}
          </h2>
        </div>
      </div>
    </div>
  );
};
