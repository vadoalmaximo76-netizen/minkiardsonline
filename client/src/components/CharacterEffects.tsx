import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CharacterEffectProps {
  isVisible: boolean;
  effectType: 'attack' | 'death';
  onComplete: () => void;
  characterName?: string;
}

const ImpactParticles: React.FC<{ color: string; count?: number }> = ({ color, count = 30 }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const velocitiesRef = useRef<Float32Array>();
  
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;
      vel[i * 3] = (Math.random() - 0.5) * 0.3;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    velocitiesRef.current = vel;
    return pos;
  }, [count]);

  useFrame((state, delta) => {
    if (!pointsRef.current || !velocitiesRef.current) return;
    const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < count; i++) {
      posArray[i * 3] += velocitiesRef.current[i * 3];
      posArray[i * 3 + 1] += velocitiesRef.current[i * 3 + 1];
      posArray[i * 3 + 2] += velocitiesRef.current[i * 3 + 2];
      velocitiesRef.current[i * 3 + 1] -= 0.01;
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.15} color={color} transparent opacity={0.9} />
    </points>
  );
};

const ShockwaveRing: React.FC<{ color: string; delay?: number }> = ({ color, delay = 0 }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const startTime = useRef(Date.now() + delay * 1000);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    if (!ringRef.current || !materialRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    if (elapsed < 0) return;
    
    const scale = 0.5 + elapsed * 4;
    ringRef.current.scale.setScalar(scale);
    materialRef.current.opacity = Math.max(0, 1 - elapsed * 1.5);
  });

  return (
    <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.4, 0.6, 32]} />
      <meshBasicMaterial ref={materialRef} color={color} transparent opacity={1} side={THREE.DoubleSide} />
    </mesh>
  );
};

const AttackEffect: React.FC = () => {
  const slashRef = useRef<THREE.Mesh>(null);
  const startTime = useRef(Date.now());

  useFrame(() => {
    if (!slashRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    
    slashRef.current.rotation.z = -Math.PI / 4 + elapsed * 2;
    slashRef.current.scale.x = 1 + Math.sin(elapsed * 10) * 0.2;
    
    const material = slashRef.current.material as THREE.MeshBasicMaterial;
    material.opacity = Math.max(0, 1 - elapsed);
  });

  return (
    <>
      <ambientLight intensity={0.8} />
      <pointLight position={[0, 2, 2]} intensity={3} color="#ff4444" />
      <pointLight position={[-2, 0, 2]} intensity={2} color="#ff8800" />
      
      <mesh ref={slashRef}>
        <planeGeometry args={[3, 0.3]} />
        <meshBasicMaterial color="#ff4444" transparent opacity={1} side={THREE.DoubleSide} />
      </mesh>
      
      <ImpactParticles color="#ff6600" count={50} />
      <ImpactParticles color="#ffaa00" count={30} />
      
      <ShockwaveRing color="#ff4444" delay={0} />
      <ShockwaveRing color="#ff8800" delay={0.1} />
      <ShockwaveRing color="#ffaa00" delay={0.2} />
      
      <mesh position={[0, 0, -0.5]}>
        <circleGeometry args={[0.8, 32]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.3} />
      </mesh>
    </>
  );
};

const DeathEffect: React.FC = () => {
  const skullRef = useRef<THREE.Group>(null);
  const startTime = useRef(Date.now());
  const [spiritParticles] = useState(() => {
    const particles = [];
    for (let i = 0; i < 20; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 2,
        y: Math.random() * 2,
        z: (Math.random() - 0.5) * 2,
        speed: 0.5 + Math.random() * 0.5
      });
    }
    return particles;
  });

  useFrame((state) => {
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
  const startTime = useRef(Date.now());

  useFrame(() => {
    if (!meshRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    
    meshRef.current.position.y = initialY + elapsed * speed;
    meshRef.current.position.x = initialX + Math.sin(elapsed * 3 + initialX * 10) * 0.3;
    meshRef.current.position.z = initialZ + Math.cos(elapsed * 2 + initialZ * 10) * 0.3;
    
    const material = meshRef.current.material as THREE.MeshBasicMaterial;
    material.opacity = Math.max(0, 1 - elapsed * 0.5);
  });

  return (
    <mesh ref={meshRef} position={[initialX, initialY, initialZ]}>
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshBasicMaterial color="#aa88ff" transparent opacity={0.8} />
    </mesh>
  );
};

export const CharacterEffects: React.FC<CharacterEffectProps> = ({
  isVisible,
  effectType,
  onComplete,
  characterName
}) => {
  useEffect(() => {
    if (isVisible) {
      const duration = effectType === 'attack' ? 1500 : 2500;
      const timer = setTimeout(onComplete, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete, effectType]);

  if (!isVisible) return null;

  const getBackgroundGradient = () => {
    if (effectType === 'attack') {
      return 'from-red-900/60 via-orange-900/40 to-transparent';
    }
    return 'from-purple-900/70 via-black/50 to-transparent';
  };

  const getEmoji = () => {
    if (effectType === 'attack') return '💥';
    return '💀';
  };

  const getMessage = () => {
    if (effectType === 'attack') {
      return characterName ? `${characterName} COLPITO!` : 'COLPITO!';
    }
    return characterName ? `${characterName} ELIMINATO!` : 'ELIMINATO!';
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className={`absolute inset-0 bg-gradient-radial ${getBackgroundGradient()}`} />
      
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
          {effectType === 'attack' ? <AttackEffect /> : <DeathEffect />}
        </Canvas>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="text-[100px] animate-bounce" style={{ 
          filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.5))',
        }}>
          {getEmoji()}
        </div>
        
        <div className={`px-8 py-4 rounded-2xl border ${effectType === 'attack' ? 'bg-red-900/80 border-red-500/50' : 'bg-purple-900/80 border-purple-500/50'}`}>
          <h2 className="text-white text-3xl font-bold tracking-wider text-center animate-pulse"
              style={{ textShadow: effectType === 'attack' ? '0 0 20px rgba(255,0,0,0.8)' : '0 0 20px rgba(136,0,255,0.8)' }}>
            {getMessage()}
          </h2>
        </div>
      </div>
    </div>
  );
};
