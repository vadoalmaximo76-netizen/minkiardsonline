import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox, Text, Environment } from '@react-three/drei';
import * as THREE from 'three';

interface Dice3DProps {
  isRolling: boolean;
  finalValue?: number;
  onRollComplete?: () => void;
  size?: number;
}

const DiceFace: React.FC<{ position: [number, number, number]; rotation: [number, number, number]; dots: number; size: number }> = ({ position, rotation, dots, size }) => {
  const dotPositions: { [key: number]: [number, number][] } = {
    1: [[0, 0]],
    2: [[-0.25, -0.25], [0.25, 0.25]],
    3: [[-0.25, -0.25], [0, 0], [0.25, 0.25]],
    4: [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]],
    5: [[-0.25, -0.25], [0.25, -0.25], [0, 0], [-0.25, 0.25], [0.25, 0.25]],
    6: [[-0.25, -0.3], [0.25, -0.3], [-0.25, 0], [0.25, 0], [-0.25, 0.3], [0.25, 0.3]]
  };

  const positions = dotPositions[dots] || [];
  const dotSize = size * 0.08;

  return (
    <group position={position} rotation={rotation}>
      {positions.map((pos, idx) => (
        <mesh key={idx} position={[pos[0] * size, pos[1] * size, 0.01]}>
          <circleGeometry args={[dotSize, 32]} />
          <meshStandardMaterial color="white" />
        </mesh>
      ))}
    </group>
  );
};

const AnimatedDice: React.FC<{ isRolling: boolean; finalValue?: number; onRollComplete?: () => void; size?: number }> = ({ 
  isRolling, 
  finalValue = 1, 
  onRollComplete,
  size = 1 
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [rollPhase, setRollPhase] = useState<'idle' | 'rolling' | 'settling'>('idle');
  const [targetRotation, setTargetRotation] = useState<[number, number, number]>([0, 0, 0]);
  const rollStartTime = useRef(0);
  const rollDuration = 1.5;

  const faceRotations: { [key: number]: [number, number, number] } = {
    1: [0, 0, 0],
    2: [0, 0, -Math.PI / 2],
    3: [Math.PI / 2, 0, 0],
    4: [-Math.PI / 2, 0, 0],
    5: [0, 0, Math.PI / 2],
    6: [Math.PI, 0, 0]
  };

  useEffect(() => {
    if (isRolling) {
      setRollPhase('rolling');
      rollStartTime.current = Date.now();
    }
  }, [isRolling]);

  useEffect(() => {
    if (!isRolling && rollPhase === 'rolling') {
      setRollPhase('settling');
      setTargetRotation(faceRotations[finalValue] || [0, 0, 0]);
    }
  }, [isRolling, rollPhase, finalValue]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    if (rollPhase === 'rolling') {
      const elapsed = (Date.now() - rollStartTime.current) / 1000;
      const speed = Math.max(1, 15 - elapsed * 10);
      
      meshRef.current.rotation.x += delta * speed * 3;
      meshRef.current.rotation.y += delta * speed * 2;
      meshRef.current.rotation.z += delta * speed * 1.5;

      const bounceHeight = Math.sin(elapsed * 8) * 0.3 * Math.max(0, 1 - elapsed / rollDuration);
      meshRef.current.position.y = bounceHeight;

      if (elapsed > rollDuration) {
        setRollPhase('settling');
        setTargetRotation(faceRotations[finalValue] || [0, 0, 0]);
      }
    } else if (rollPhase === 'settling') {
      const lerpSpeed = 8;
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotation[0], delta * lerpSpeed);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotation[1], delta * lerpSpeed);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRotation[2], delta * lerpSpeed);
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, 0, delta * lerpSpeed);

      const rotDiff = Math.abs(meshRef.current.rotation.x - targetRotation[0]) +
                      Math.abs(meshRef.current.rotation.y - targetRotation[1]) +
                      Math.abs(meshRef.current.rotation.z - targetRotation[2]);

      if (rotDiff < 0.01) {
        setRollPhase('idle');
        meshRef.current.rotation.set(...targetRotation);
        meshRef.current.position.y = 0;
        onRollComplete?.();
      }
    }
  });

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <RoundedBox args={[size, size, size]} radius={0.1} smoothness={4}>
        <meshStandardMaterial color="#dc2626" metalness={0.3} roughness={0.4} />
      </RoundedBox>
      
      <DiceFace position={[0, size / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} dots={1} size={size} />
      <DiceFace position={[0, -size / 2 - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]} dots={6} size={size} />
      <DiceFace position={[size / 2 + 0.01, 0, 0]} rotation={[0, Math.PI / 2, 0]} dots={2} size={size} />
      <DiceFace position={[-size / 2 - 0.01, 0, 0]} rotation={[0, -Math.PI / 2, 0]} dots={5} size={size} />
      <DiceFace position={[0, 0, size / 2 + 0.01]} rotation={[0, 0, 0]} dots={3} size={size} />
      <DiceFace position={[0, 0, -size / 2 - 0.01]} rotation={[0, Math.PI, 0]} dots={4} size={size} />
    </mesh>
  );
};

const Particles: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const particlesRef = useRef<THREE.Points>(null);
  const particleCount = 50;

  const positions = React.useMemo(() => {
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

export const Dice3D: React.FC<Dice3DProps> = ({ isRolling, finalValue = 1, onRollComplete, size = 1 }) => {
  return (
    <div className="w-full h-full min-h-[200px]">
      <Canvas
        camera={{ position: [0, 2, 4], fov: 45 }}
        shadows
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={1.2} />
        <spotLight
          position={[3, 8, 3]}
          angle={0.4}
          penumbra={0.5}
          intensity={3}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          color="#ffffff"
        />
        <spotLight
          position={[-3, 6, -3]}
          angle={0.5}
          penumbra={1}
          intensity={2}
          color="#ffaa00"
        />
        <pointLight position={[-4, 4, -4]} intensity={1.5} color="#ff6b6b" />
        <pointLight position={[4, 4, 4]} intensity={1.5} color="#4ecdc4" />
        <pointLight position={[0, 5, 0]} intensity={2} color="#ffffff" />
        
        <AnimatedDice 
          isRolling={isRolling} 
          finalValue={finalValue} 
          onRollComplete={onRollComplete}
          size={size}
        />
        
        <Particles isActive={isRolling} />
        
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <shadowMaterial transparent opacity={0.3} />
        </mesh>
      </Canvas>
    </div>
  );
};

export const SuperDice3D: React.FC<{
  isRolling: boolean;
  diceCards: Array<{ name: string; image: string }>;
  currentIndex: number;
  onRollComplete?: () => void;
}> = ({ isRolling, diceCards, currentIndex, onRollComplete }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [rollPhase, setRollPhase] = useState<'idle' | 'rolling' | 'settling'>('idle');
  const rollStartTime = useRef(0);

  useEffect(() => {
    if (isRolling) {
      setRollPhase('rolling');
      rollStartTime.current = Date.now();
    } else if (rollPhase === 'rolling') {
      setRollPhase('settling');
    }
  }, [isRolling]);

  return (
    <div className="w-full h-full min-h-[200px]">
      <Canvas
        camera={{ position: [0, 2, 4], fov: 45 }}
        shadows
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={1.2} />
        <spotLight
          position={[3, 8, 3]}
          angle={0.4}
          penumbra={0.5}
          intensity={3}
          castShadow
          color="#ffffff"
        />
        <spotLight
          position={[-3, 6, -3]}
          angle={0.5}
          penumbra={1}
          intensity={2}
          color="#cc88ff"
        />
        <pointLight position={[-4, 4, -4]} intensity={2} color="#a855f7" />
        <pointLight position={[4, 4, 4]} intensity={2} color="#ec4899" />
        <pointLight position={[0, 5, 0]} intensity={2.5} color="#ffffff" />

        <SuperDiceMesh 
          isRolling={isRolling}
          rollPhase={rollPhase}
          setRollPhase={setRollPhase}
          rollStartTime={rollStartTime}
          onRollComplete={onRollComplete}
        />

        <Particles isActive={isRolling} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <shadowMaterial transparent opacity={0.3} />
        </mesh>
      </Canvas>
    </div>
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

      if (!isRolling && elapsed > 0.5) {
        setRollPhase('settling');
      }
    } else if (rollPhase === 'settling') {
      const lerpSpeed = 10;
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, 0, delta * lerpSpeed);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, 0, delta * lerpSpeed);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, 0, delta * lerpSpeed);
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, 0, delta * lerpSpeed);

      const rotDiff = Math.abs(meshRef.current.rotation.x) +
                      Math.abs(meshRef.current.rotation.y) +
                      Math.abs(meshRef.current.rotation.z);

      if (rotDiff < 0.05) {
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
