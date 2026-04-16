import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { gsap } from 'gsap';

interface CardAnimationProps {
  isVisible: boolean;
  cardName: string;
  onComplete: () => void;
}

const ParticleSystem: React.FC<{ color: string; count?: number; spread?: number; speed?: number }> = ({
  color,
  count = 100,
  spread = 5,
  speed = 1,
}) => {
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    return pos;
  }, [count, spread]);

  const velocities = useMemo(() => {
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      vel[i * 3] = (Math.random() - 0.5) * 0.02 * speed;
      vel[i * 3 + 1] = Math.random() * 0.02 * speed;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.02 * speed;
    }
    return vel;
  }, [count, speed]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < count; i++) {
      posArray[i * 3] += velocities[i * 3];
      posArray[i * 3 + 1] += velocities[i * 3 + 1];
      posArray[i * 3 + 2] += velocities[i * 3 + 2];

      if (Math.abs(posArray[i * 3]) > spread / 2) velocities[i * 3] *= -1;
      if (posArray[i * 3 + 1] > spread / 2) posArray[i * 3 + 1] = -spread / 2;
      if (Math.abs(posArray[i * 3 + 2]) > spread / 2) velocities[i * 3 + 2] *= -1;
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
      <pointsMaterial size={0.1} color={color} transparent opacity={0.8} />
    </points>
  );
};

const ExplosionRing: React.FC<{ color: string; delay?: number }> = ({ color, delay = 0 }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const startTime = useRef(Date.now() + delay * 1000);

  useFrame(() => {
    if (!ringRef.current) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    if (elapsed < 0) return;

    const scale = 1 + elapsed * 3;
    ringRef.current.scale.setScalar(scale);
    const material = ringRef.current.material as THREE.MeshBasicMaterial;
    material.opacity = Math.max(0, 1 - elapsed * 0.5);
  });

  return (
    <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.8, 1, 32]} />
      <meshBasicMaterial color={color} transparent opacity={1} side={THREE.DoubleSide} />
    </mesh>
  );
};

const RotatingObject: React.FC<{ children: React.ReactNode; speed?: number }> = ({ children, speed = 1 }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * speed;
    }
  });

  return <group ref={groupRef}>{children}</group>;
};

const PulsingLight: React.FC<{ color: string; intensity?: number }> = ({ color, intensity = 2 }) => {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (lightRef.current) {
      lightRef.current.intensity = intensity + Math.sin(state.clock.elapsedTime * 5) * intensity * 0.5;
    }
  });

  return <pointLight ref={lightRef} color={color} intensity={intensity} distance={10} />;
};

const EnergyBeam: React.FC<{ color: string; direction?: 'horizontal' | 'vertical' }> = ({ color, direction = 'horizontal' }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 10) * 0.2;
      if (direction === 'horizontal') {
        meshRef.current.scale.x = scale * 5;
      } else {
        meshRef.current.scale.y = scale * 5;
      }
    }
  });

  return (
    <mesh ref={meshRef} rotation={direction === 'vertical' ? [0, 0, Math.PI / 2] : [0, 0, 0]}>
      <boxGeometry args={[1, 0.3, 0.3]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} />
    </mesh>
  );
};

const Animation3DScene: React.FC<{ type: string }> = ({ type }) => {
  switch (type) {
    case 'explosion':
      return (
        <>
          <ambientLight intensity={0.3} />
          <PulsingLight color="#ff6600" intensity={3} />
          <ParticleSystem color="#ff4400" count={200} spread={6} speed={2} />
          <ExplosionRing color="#ff6600" delay={0} />
          <ExplosionRing color="#ff8800" delay={0.2} />
          <ExplosionRing color="#ffaa00" delay={0.4} />
        </>
      );
    case 'energy':
      return (
        <>
          <ambientLight intensity={0.2} />
          <PulsingLight color="#00aaff" intensity={4} />
          <ParticleSystem color="#00ccff" count={150} spread={5} speed={1.5} />
          <EnergyBeam color="#00ffff" direction="horizontal" />
          <RotatingObject speed={2}>
            <mesh>
              <torusGeometry args={[1.5, 0.1, 16, 100]} />
              <meshBasicMaterial color="#00aaff" transparent opacity={0.6} />
            </mesh>
          </RotatingObject>
        </>
      );
    case 'fire':
      return (
        <>
          <ambientLight intensity={0.2} />
          <PulsingLight color="#ff4400" intensity={5} />
          <pointLight position={[0, 2, 0]} color="#ff8800" intensity={3} />
          <ParticleSystem color="#ff6600" count={300} spread={4} speed={3} />
          <ParticleSystem color="#ffaa00" count={200} spread={3} speed={2} />
        </>
      );
    case 'lightning':
      return (
        <>
          <ambientLight intensity={0.1} />
          <PulsingLight color="#ffff00" intensity={6} />
          <ParticleSystem color="#ffff88" count={100} spread={6} speed={4} />
          <EnergyBeam color="#ffff00" direction="vertical" />
        </>
      );
    case 'poison':
      return (
        <>
          <ambientLight intensity={0.3} />
          <PulsingLight color="#00ff00" intensity={3} />
          <ParticleSystem color="#00ff44" count={200} spread={5} speed={1} />
          <RotatingObject speed={0.5}>
            <mesh>
              <icosahedronGeometry args={[1, 0]} />
              <meshBasicMaterial color="#00aa00" transparent opacity={0.5} wireframe />
            </mesh>
          </RotatingObject>
        </>
      );
    case 'magic':
      return (
        <>
          <ambientLight intensity={0.2} />
          <PulsingLight color="#aa00ff" intensity={4} />
          <pointLight position={[2, 2, 2]} color="#ff00aa" intensity={2} />
          <ParticleSystem color="#ff00ff" count={250} spread={6} speed={1.5} />
          <RotatingObject speed={1.5}>
            <mesh>
              <octahedronGeometry args={[1.2, 0]} />
              <meshBasicMaterial color="#aa00ff" transparent opacity={0.4} />
            </mesh>
          </RotatingObject>
          <RotatingObject speed={-1}>
            <mesh>
              <torusGeometry args={[2, 0.05, 16, 100]} />
              <meshBasicMaterial color="#ff00aa" transparent opacity={0.6} />
            </mesh>
          </RotatingObject>
        </>
      );
    case 'storm':
      return (
        <>
          <ambientLight intensity={0.1} />
          <PulsingLight color="#4444ff" intensity={4} />
          <ParticleSystem color="#8888ff" count={400} spread={8} speed={3} />
          <RotatingObject speed={3}>
            <mesh>
              <torusGeometry args={[2.5, 0.3, 16, 100]} />
              <meshBasicMaterial color="#6666ff" transparent opacity={0.4} />
            </mesh>
          </RotatingObject>
        </>
      );
    case 'nuclear':
      return (
        <>
          <ambientLight intensity={0.1} />
          <PulsingLight color="#ffff00" intensity={8} />
          <pointLight position={[0, 3, 0]} color="#ff8800" intensity={5} />
          <ParticleSystem color="#ffaa00" count={500} spread={10} speed={4} />
          <ExplosionRing color="#ffff00" delay={0} />
          <ExplosionRing color="#ff8800" delay={0.3} />
          <ExplosionRing color="#ff4400" delay={0.6} />
          <mesh position={[0, 2, 0]}>
            <sphereGeometry args={[1.5, 32, 32]} />
            <meshBasicMaterial color="#ff6600" transparent opacity={0.6} />
          </mesh>
        </>
      );
    default:
      return (
        <>
          <ambientLight intensity={0.5} />
          <ParticleSystem color="#ffffff" count={100} spread={4} speed={1} />
        </>
      );
  }
};

export const CardAnimation: React.FC<CardAnimationProps> = ({ isVisible, cardName, onComplete }) => {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const emojiRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible) return;

    const ctx = gsap.context(() => {
      if (emojiRef.current) {
        gsap.fromTo(emojiRef.current,
          { scale: 0.3, opacity: 0, y: 20 },
          { scale: 1, opacity: 1, y: 0, duration: 0.55, ease: 'elastic.out(1.4, 0.5)', delay: 0.05 }
        );
        gsap.to(emojiRef.current, {
          y: -12,
          duration: 1.0,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: 0.6,
        });
      }

      if (nameRef.current) {
        gsap.fromTo(nameRef.current,
          { scale: 0.6, opacity: 0, y: 15 },
          { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.7)', delay: 0.2 }
        );
        gsap.to(nameRef.current, {
          textShadow: '0 0 30px rgba(255,255,255,1), 0 0 60px rgba(255,255,255,0.7)',
          duration: 0.9,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: 0.65,
        });
      }

      if (overlayRef.current) {
        gsap.fromTo(overlayRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.35, ease: 'power2.out' }
        );
      }

      const timer = setTimeout(() => {
        gsap.to([emojiRef.current, nameRef.current, overlayRef.current].filter(Boolean), {
          opacity: 0,
          scale: 0.9,
          duration: 0.3,
          ease: 'power2.in',
          onComplete: () => onCompleteRef.current(),
        });
      }, 2700);

      return () => clearTimeout(timer);
    });

    return () => ctx.revert();
  }, [isVisible]);

  if (!isVisible) return null;

  const getAnimationType = (): string => {
    const n = cardName.toUpperCase().trim();
    if (['BOMBA', 'ATTACCO KAMIKAZE', 'MINA VAGANTE', 'BOMBA SENZA DETONATORE'].includes(n)) return 'explosion';
    if (['ONDA ENERGETICA', 'PARTITA DI TENNIS'].includes(n)) return 'energy';
    if (['OMBELICO LANCIAFIAMME', 'ACCHIAPPT CHESSA'].includes(n)) return 'fire';
    if (['SAETTA', 'UNA TEMPESTA BABY'].includes(n)) return 'lightning';
    if (['AGO DI PINO', 'INFLUENZA', 'VIRUS'].includes(n)) return 'poison';
    if (['BAMBOLA VOODOO', 'BAMBOLA-VOODOO', 'MACUMBA', 'ROULETTE RUSSA'].includes(n)) return 'magic';
    if (['PIOGGIA DI METEORITI'].includes(n)) return 'storm';
    if (['ESPLOSIONE ATOMICA'].includes(n)) return 'nuclear';
    return 'default';
  };

  const animationType = getAnimationType();
  const normalizedName = cardName.toUpperCase().trim();

  const getEmoji = () => {
    const emojiMap: Record<string, string> = {
      'BAMBOLA VOODOO': '🔮', 'BAMBOLA-VOODOO': '🔮', 'UNA TEMPESTA BABY': '⛈️',
      'ACCETTATA': '🪓', 'ACCHIAPPT CHESSA': '🔥', 'AGO DI PINO': '⚗️',
      'ATTACCO KAMIKAZE': '💥', 'BOMBA SENZA DETONATORE': '🧨', 'BOMBA': '💣',
      'CANZONE NEOMELODICA': '🎤', 'CIAVATTA': '🩴', 'DUELLO': '🔫',
      'ESPLOSIONE ATOMICA': '☢️', 'FUCILE A POMPA': '🔫', 'FURTO': '🥷',
      'INFLUENZA': '🌡️', 'LU TRATTORE': '🚜', 'MAZZA DA BASEBALL': '🏏',
      'MINA VAGANTE': '💣', 'MOTOSEGA': '🪚', 'OMBELICO LANCIAFIAMME': '🔥',
      'ONDA ENERGETICA': '⚡', 'PADELLATA IN FACCIA': '🍳', 'PARTITA DI TENNIS': '🎾',
      'PIOGGIA DI METEORITI': '☄️', 'PRETA': '🪨', 'PUGNO': '👊',
      'ROULETTE RUSSA': '🔫', 'SAETTA': '⚡', 'VIRUS': '🦠',
    };
    return emojiMap[normalizedName] || '✨';
  };

  const getBackgroundGradient = () => {
    switch (animationType) {
      case 'explosion': return 'from-orange-900/80 via-red-900/60 to-yellow-900/40';
      case 'energy': return 'from-cyan-900/80 via-blue-900/60 to-indigo-900/40';
      case 'fire': return 'from-red-900/80 via-orange-900/60 to-yellow-900/40';
      case 'lightning': return 'from-yellow-900/80 via-amber-900/60 to-white/20';
      case 'poison': return 'from-green-900/80 via-emerald-900/60 to-lime-900/40';
      case 'magic': return 'from-purple-900/80 via-pink-900/60 to-violet-900/40';
      case 'storm': return 'from-gray-900/80 via-slate-900/60 to-blue-900/40';
      case 'nuclear': return 'from-yellow-900/80 via-orange-900/60 to-red-900/80';
      default: return 'from-gray-900/80 via-gray-800/60 to-gray-700/40';
    }
  };

  return (
    <div ref={overlayRef} className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none" style={{ opacity: 0 }}>
      <div className={`absolute inset-0 bg-gradient-radial ${getBackgroundGradient()}`} />

      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 60 }}
          style={{ pointerEvents: 'none' }}
          onCreated={({ gl }) => {
            const canvas = gl.domElement;
            const handleContextLost = (e: Event) => { e.preventDefault(); };
            const handleContextRestored = () => { gl.setSize(canvas.clientWidth, canvas.clientHeight); };
            canvas.addEventListener('webglcontextlost', handleContextLost);
            canvas.addEventListener('webglcontextrestored', handleContextRestored);
          }}
        >
          <Animation3DScene type={animationType} />
        </Canvas>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4">
        <div
          ref={emojiRef}
          className="text-[120px] drop-shadow-2xl"
          style={{ filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.5))', opacity: 0, lineHeight: 1 }}
        >
          {getEmoji()}
        </div>

        <div className="bg-black/60 backdrop-blur-sm px-8 py-4 rounded-2xl border border-white/20">
          <h2
            ref={nameRef}
            className="text-white text-3xl font-bold tracking-wider text-center"
            style={{
              textShadow: '0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(255,255,255,0.4)',
              opacity: 0,
            }}
          >
            {cardName}
          </h2>
        </div>
      </div>
    </div>
  );
};
