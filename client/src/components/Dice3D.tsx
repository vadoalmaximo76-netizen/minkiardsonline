import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';

interface Dice3DProps {
  isRolling: boolean;
  result?: number | null;
  finalValue?: number;
  size?: number;
  onRollComplete?: () => void;
}

const pipLayouts: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
};

const resultRotations: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

const DiceFace: React.FC<{ value: number; size: number }> = ({ value, size }) => {
  const pips = pipLayouts[value] || [];
  const pipSize = Math.max(size * 0.15, 8);

  return (
    <div
      style={{
        position: 'absolute',
        width: `${size}px`,
        height: `${size}px`,
        background: 'linear-gradient(145deg, #ef4444, #b91c1c)',
        borderRadius: `${size * 0.12}px`,
        border: '2px solid rgba(0,0,0,0.3)',
        boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.3), inset 0 -3px 8px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.5)',
        backfaceVisibility: 'hidden',
      }}
    >
      {pips.map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: `${pipSize}px`,
            height: `${pipSize}px`,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #ffffff, #e0e0e0)',
            boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.4)',
            left: `${pos[0]}%`,
            top: `${pos[1]}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
};

export const Dice3D: React.FC<Dice3DProps> = ({
  isRolling,
  result,
  finalValue,
  size = 120,
  onRollComplete,
}) => {
  const effectiveResult = result ?? finalValue ?? null;
  const cubeRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const wasRolling = useRef(false);
  const rollingCtx = useRef<gsap.Context | null>(null);

  const half = size / 2;
  const bounceHeight = Math.round(size * 0.6);

  const faces: { value: number; transform: string }[] = [
    { value: 1, transform: `rotateY(0deg) translateZ(${half}px)` },
    { value: 6, transform: `rotateY(180deg) translateZ(${half}px)` },
    { value: 2, transform: `rotateY(90deg) translateZ(${half}px)` },
    { value: 5, transform: `rotateY(-90deg) translateZ(${half}px)` },
    { value: 3, transform: `rotateX(90deg) translateZ(${half}px)` },
    { value: 4, transform: `rotateX(-90deg) translateZ(${half}px)` },
  ];

  useEffect(() => {
    if (isRolling) {
      wasRolling.current = true;

      rollingCtx.current?.kill();
      rollingCtx.current = gsap.context(() => {
        if (!cubeRef.current || !wrapperRef.current) return;

        // Bounce timeline (looping)
        const bounceTl = gsap.timeline({ repeat: -1 });
        bounceTl
          .to(wrapperRef.current, { y: -bounceHeight, scaleX: 0.95, scaleY: 0.95, duration: 0.1, ease: 'power1.out' }, 0)
          .to(wrapperRef.current, { y: 0, scaleX: 1.05, scaleY: 0.95, duration: 0.1, ease: 'power1.in' }, 0.1)
          .to(wrapperRef.current, { scaleX: 1, scaleY: 1, duration: 0.04, ease: 'none' }, 0.2)
          .to(wrapperRef.current, { y: -bounceHeight * 0.55, duration: 0.08, ease: 'power1.out' }, 0.25)
          .to(wrapperRef.current, { y: 0, duration: 0.08, ease: 'power1.in' }, 0.33)
          .to(wrapperRef.current, { y: -bounceHeight * 0.3, duration: 0.06, ease: 'power1.out' }, 0.42)
          .to(wrapperRef.current, { y: 0, duration: 0.06, ease: 'power1.in' }, 0.48)
          .to(wrapperRef.current, { y: -bounceHeight * 0.12, duration: 0.04, ease: 'power1.out' }, 0.55)
          .to(wrapperRef.current, { y: 0, duration: 0.04, ease: 'power1.in' }, 0.59)
          .to(wrapperRef.current, { duration: 0.61 }, 0.6);

        // Continuous cube tumble
        gsap.to(cubeRef.current, {
          rotateX: '+=1080',
          rotateY: '+=800',
          rotateZ: '+=560',
          duration: 1.2,
          ease: 'none',
          repeat: -1,
        });

        // Shadow animation
        if (shadowRef.current) {
          gsap.set(shadowRef.current, { opacity: 0.4, scaleX: 1 });
          const shadowTl = gsap.timeline({ repeat: -1 });
          shadowTl
            .to(shadowRef.current, { opacity: 0.15, scaleX: 1.8, duration: 0.1 }, 0.08)
            .to(shadowRef.current, { opacity: 0.5, scaleX: 0.85, duration: 0.1 }, 0.16)
            .to(shadowRef.current, { opacity: 0.2, scaleX: 1.4, duration: 0.1 }, 0.28)
            .to(shadowRef.current, { opacity: 0.45, scaleX: 0.9, duration: 0.1 }, 0.36)
            .to(shadowRef.current, { opacity: 0.4, scaleX: 1, duration: 0.1 }, 0.68)
            .to(shadowRef.current, { duration: 0.52 }, 0.7);
        }
      });
    } else if (wasRolling.current) {
      wasRolling.current = false;

      // Kill rolling animations
      rollingCtx.current?.kill();
      rollingCtx.current = null;

      if (wrapperRef.current) {
        gsap.set(wrapperRef.current, { y: 0, scaleX: 1, scaleY: 1 });
      }
      if (shadowRef.current) {
        gsap.to(shadowRef.current, { opacity: 0.4, scaleX: 1, duration: 0.4 });
      }

      // Settle cube onto the correct face
      const rot = effectiveResult != null ? resultRotations[effectiveResult] : { x: 0, y: 0 };
      gsap.to(cubeRef.current, {
        rotateX: rot.x,
        rotateY: rot.y,
        rotateZ: 0,
        duration: 0.9,
        ease: 'elastic.out(1, 0.5)',
        onComplete: () => onRollComplete?.(),
      });
    }

    return () => {
      rollingCtx.current?.kill();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRolling]);

  // Update face when result changes while not rolling
  useEffect(() => {
    if (!isRolling && !wasRolling.current && effectiveResult != null) {
      const rot = resultRotations[effectiveResult];
      gsap.to(cubeRef.current, {
        rotateX: rot.x,
        rotateY: rot.y,
        rotateZ: 0,
        duration: 0.4,
        ease: 'power2.out',
      });
    }
  }, [effectiveResult, isRolling]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          position: 'relative',
          width: `${size}px`,
          height: `${size + bounceHeight}px`,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        <div
          ref={shadowRef}
          style={{
            position: 'absolute',
            bottom: '-4px',
            left: '50%',
            width: `${size * 0.7}px`,
            height: `${size * 0.08}px`,
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 70%)',
            borderRadius: '50%',
            transformOrigin: 'center',
            transform: 'translateX(-50%)',
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
        <div
          ref={wrapperRef}
          style={{ transformOrigin: 'center bottom' }}
        >
          <div
            style={{
              perspective: `${size * 5}px`,
              width: `${size}px`,
              height: `${size}px`,
            }}
          >
            <div
              ref={cubeRef}
              style={{
                width: `${size}px`,
                height: `${size}px`,
                position: 'relative',
                transformStyle: 'preserve-3d',
              }}
            >
              {faces.map((face) => (
                <div
                  key={face.value}
                  style={{
                    position: 'absolute',
                    width: `${size}px`,
                    height: `${size}px`,
                    transform: face.transform,
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <DiceFace value={face.value} size={size} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SuperDiceParticles: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const particlesRef = useRef<THREE.Points>(null);
  const particleCount = 50;

  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 4;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    return pos;
  }, []);

  useFrame((state, delta) => {
    if (!particlesRef.current || !isActive) return;
    particlesRef.current.rotation.y += delta * 0.5;
    particlesRef.current.rotation.x += delta * 0.3;
  });

  if (!isActive) return null;

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#fbbf24" transparent opacity={0.8} />
    </points>
  );
};

const SuperDiceMesh: React.FC<{
  isRolling: boolean;
  rollPhase: 'idle' | 'rolling' | 'settling';
  setRollPhase: (phase: 'idle' | 'rolling' | 'settling') => void;
  rollStartTime: React.MutableRefObject<number>;
  onRollComplete?: () => void;
}> = ({ isRolling, rollPhase, setRollPhase, rollStartTime, onRollComplete }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const rollDuration = 1.0;

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    if (rollPhase === 'rolling') {
      const elapsed = (Date.now() - rollStartTime.current) / 1000;
      const speed = Math.max(1, 20 - elapsed * 15);

      meshRef.current.rotation.x += delta * speed * 4;
      meshRef.current.rotation.y += delta * speed * 3;
      meshRef.current.rotation.z += delta * speed * 2;

      const bounceHeight = Math.sin(elapsed * 10) * 0.4 * Math.max(0, 1 - elapsed / rollDuration);
      meshRef.current.position.y = bounceHeight;

      if (elapsed > rollDuration && !isRolling) {
        setRollPhase('settling');
      }
    } else if (rollPhase === 'settling') {
      const lerpSpeed = 6;
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, 0, delta * lerpSpeed);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, 0, delta * lerpSpeed);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, 0, delta * lerpSpeed);
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, 0, delta * lerpSpeed);

      const rotDiff = Math.abs(meshRef.current.rotation.x) +
                      Math.abs(meshRef.current.rotation.y) +
                      Math.abs(meshRef.current.rotation.z);

      if (rotDiff < 0.01) {
        setRollPhase('idle');
        meshRef.current.rotation.set(0, 0, 0);
        meshRef.current.position.y = 0;
        onRollComplete?.();
      }
    }
  });

  return (
    <mesh ref={meshRef} castShadow>
      <RoundedBox args={[1.2, 1.2, 1.2]} radius={0.15} smoothness={4}>
        <meshStandardMaterial
          color="#9333ea"
          metalness={0.4}
          roughness={0.3}
          emissive="#4c1d95"
          emissiveIntensity={0.2}
        />
      </RoundedBox>

      {[...Array(6)].map((_, i) => {
        const positions: [number, number, number][] = [
          [0, 0, 0.61],
          [0, 0, -0.61],
          [0.61, 0, 0],
          [-0.61, 0, 0],
          [0, 0.61, 0],
          [0, -0.61, 0]
        ];
        const rotations: [number, number, number][] = [
          [0, 0, 0],
          [0, Math.PI, 0],
          [0, Math.PI / 2, 0],
          [0, -Math.PI / 2, 0],
          [-Math.PI / 2, 0, 0],
          [Math.PI / 2, 0, 0]
        ];
        return (
          <group key={i} position={positions[i]} rotation={rotations[i]}>
            <mesh>
              <circleGeometry args={[0.35, 32]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.5} roughness={0.3} />
            </mesh>
            <Text
              position={[0, 0, 0.01]}
              fontSize={0.3}
              color="#1e1b4b"
              anchorX="center"
              anchorY="middle"
              font={undefined}
            >
              {i + 1}
            </Text>
          </group>
        );
      })}
    </mesh>
  );
};

export const SuperDice3D: React.FC<{
  isRolling: boolean;
  diceCards: Array<{ name: string; image: string }>;
  currentIndex: number;
  onRollComplete?: () => void;
}> = ({ isRolling, diceCards, currentIndex, onRollComplete }) => {
  const [rollPhase, setRollPhase] = useState<'idle' | 'rolling' | 'settling'>('idle');
  const rollStartTime = useRef(0);

  useEffect(() => {
    if (isRolling) {
      setRollPhase('rolling');
      rollStartTime.current = Date.now();
    } else if (rollPhase === 'rolling') {
      setRollPhase('settling');
    }
  }, [isRolling, rollPhase]);

  return (
    <div className="w-full h-full min-h-[200px]">
      <Canvas
        camera={{ position: [0, 2, 4], fov: 45 }}
        shadows
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          const handleContextLost = (e: Event) => { e.preventDefault(); };
          const handleContextRestored = () => { gl.setSize(canvas.clientWidth, canvas.clientHeight); };
          canvas.addEventListener('webglcontextlost', handleContextLost);
          canvas.addEventListener('webglcontextrestored', handleContextRestored);
        }}
      >
        <ambientLight intensity={0.6} />
        <spotLight
          position={[5, 10, 5]}
          angle={0.3}
          penumbra={1}
          intensity={1}
          castShadow
        />
        <pointLight position={[-5, 5, -5]} intensity={0.5} color="#a855f7" />
        <pointLight position={[5, 5, 5]} intensity={0.5} color="#ec4899" />

        <SuperDiceMesh
          isRolling={isRolling}
          rollPhase={rollPhase}
          setRollPhase={setRollPhase}
          rollStartTime={rollStartTime}
          onRollComplete={onRollComplete}
        />

        <SuperDiceParticles isActive={isRolling} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <shadowMaterial transparent opacity={0.3} />
        </mesh>
      </Canvas>
    </div>
  );
};
