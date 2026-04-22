import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text }               from '@react-three/drei';
import * as THREE             from 'three';
import type { GymLeader }     from '../../types/gym';

const ARENA_COLORS = [
  '#c0392b','#e67e22','#e8b800','#27ae60','#1abc9c',
  '#2980b9','#8e44ad','#e91e63','#ff5722','#607d8b',
  '#795548','#4caf50',
];

/* ── Single arena with a correct spotlight light-column ──────────── */
function ArenaItem({
  leader, ax, az, color, status, index, onChallengeLeader,
}: {
  leader: GymLeader;
  ax: number; az: number;
  color: string;
  status: 'completed' | 'available' | 'locked';
  index: number;
  onChallengeLeader: (l: GymLeader) => void;
}) {
  const { scene }   = useThree();
  const spotRef     = useRef<THREE.SpotLight>(null);
  const gemRef      = useRef<THREE.Group>(null);
  const time        = useRef(0);

  const isLocked    = status === 'locked';
  const isCompleted = status === 'completed';
  const leaderName  = leader.name ?? `Leader ${index + 1}`;

  /* Attach spotlight target — imperative: create Object3D, add to scene */
  React.useEffect(() => {
    if (status !== 'available') return;
    const target = new THREE.Object3D();
    target.position.set(ax, 0, az);
    scene.add(target);
    if (spotRef.current) spotRef.current.target = target;
    return () => { scene.remove(target); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useFrame((_, delta) => {
    time.current += delta;
    if (gemRef.current && status === 'available') {
      gemRef.current.rotation.y = time.current * 0.6;
      gemRef.current.position.y = 4.9 + Math.sin(time.current * 1.5 + index) * 0.15;
    }
  });

  return (
    <group
      position={[ax, 0, az]}
      onClick={(e) => {
        e.stopPropagation();
        if (!isLocked) onChallengeLeader(leader);
      }}
    >
      {/* Platform */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[3.5, 4, 0.3, 16]} />
        <meshLambertMaterial color={isLocked ? '#333344' : color} />
      </mesh>

      {/* Steps */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[3, 3.5, 0.4, 16]} />
        <meshLambertMaterial color={isLocked ? '#222233' : color} />
      </mesh>

      {/* Crystal pillar */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.6, 0.8, 4.5, 8]} />
        <meshLambertMaterial
          color={isLocked ? '#224466' : color}
          emissive={isCompleted ? '#ffffff' : isLocked ? '#000000' : color}
          emissiveIntensity={isCompleted ? 0.3 : isLocked ? 0 : 0.4}
        />
      </mesh>

      {/* Gem (animated when available) */}
      <group ref={gemRef} position={[0, 4.9, 0]}>
        <mesh>
          <octahedronGeometry args={[0.8]} />
          <meshLambertMaterial
            color={isCompleted ? '#ffffff' : isLocked ? '#334455' : color}
            emissive={isCompleted ? '#aaffaa' : isLocked ? '#000000' : color}
            emissiveIntensity={isCompleted ? 0.8 : isLocked ? 0 : 0.9}
          />
        </mesh>
      </group>

      {/* Completion ring */}
      {isCompleted && (
        <mesh position={[0, 0.25, 0]}>
          <torusGeometry args={[3.8, 0.15, 8, 32]} />
          <meshBasicMaterial color="#4ade80" />
        </mesh>
      )}

      {/* Leader name label */}
      <Text
        position={[0, 6.6, 0]}
        fontSize={0.55}
        color={isLocked ? '#8899aa' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.06}
        outlineColor="#000000"
      >
        {isLocked ? '🔒' : leaderName}
      </Text>

      {/* Stage / status label */}
      <Text
        position={[0, 7.3, 0]}
        fontSize={0.38}
        color={isLocked ? '#556677' : color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#000000"
      >
        {isCompleted ? '✅ Completato' : `Stage ${index + 1}`}
      </Text>

      {/* Spotlight light-column for available arenas — correct R3F target pattern */}
      {status === 'available' && (
        <>
          {/* Bright point at gem level */}
          <pointLight position={[0, 6, 0]} color={color} intensity={3} distance={16} />

          {/* Spotlight aimed from above at the platform centre — target set imperatively via useEffect */}
          <spotLight
            ref={spotRef}
            position={[0, 22, 0]}
            color={color}
            intensity={10}
            distance={28}
            angle={0.2}
            penumbra={0.45}
            castShadow={false}
          />
        </>
      )}
    </group>
  );
}

/* ── Arenas container ──────────────────────────────────────────────── */
export function Arenas3D({
  arenaPositions, leaders, getLeaderStatus, onChallengeLeader,
}: {
  arenaPositions: [number, number][];
  leaders: GymLeader[];
  getLeaderStatus: (l: GymLeader) => 'completed' | 'available' | 'locked';
  onChallengeLeader: (l: GymLeader) => void;
}) {
  return (
    <group>
      {arenaPositions.map(([ax, az], i) => {
        const leader = leaders[i];
        if (!leader) return null;
        return (
          <ArenaItem
            key={leader.id}
            leader={leader}
            ax={ax}
            az={az}
            color={ARENA_COLORS[i % ARENA_COLORS.length]}
            status={getLeaderStatus(leader)}
            index={i}
            onChallengeLeader={onChallengeLeader}
          />
        );
      })}
    </group>
  );
}
