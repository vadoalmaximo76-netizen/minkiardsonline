import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { GymLeader } from '../../types/gym';

const ARENA_COLORS = [
  '#c0392b','#e67e22','#e8b800','#27ae60','#1abc9c',
  '#2980b9','#8e44ad','#e91e63','#ff5722','#607d8b',
  '#795548','#4caf50',
];

export function Arenas3D({
  arenaPositions, leaders, getLeaderStatus, onChallengeLeader,
}: {
  arenaPositions: [number, number][];
  leaders: GymLeader[];
  getLeaderStatus: (l: GymLeader) => 'completed' | 'available' | 'locked';
  onChallengeLeader: (l: GymLeader) => void;
}) {
  const time    = useRef(0);
  const gemRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((_, delta) => {
    time.current += delta;
    gemRefs.current.forEach((g, i) => {
      if (!g) return;
      const leader = leaders[i];
      if (!leader) return;
      if (getLeaderStatus(leader) === 'available') {
        g.rotation.y = time.current * 0.6;
        g.position.y = 4.9 + Math.sin(time.current * 1.5 + i) * 0.15;
      }
    });
  });

  return (
    <group>
      {arenaPositions.map(([ax, az], i) => {
        const leader = leaders[i];
        if (!leader) return null;

        const status      = getLeaderStatus(leader);
        const color       = ARENA_COLORS[i % ARENA_COLORS.length];
        const isLocked    = status === 'locked';
        const isCompleted = status === 'completed';
        const leaderName  = leader.name ?? `Leader ${i + 1}`;

        return (
          <group
            key={leader.id}
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
            <group ref={el => { gemRefs.current[i] = el; }} position={[0, 4.9, 0]}>
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
              {isCompleted ? '✅ Completato' : `Stage ${i + 1}`}
            </Text>

            {/* Spotlight light column for available arenas */}
            {status === 'available' && (
              <>
                <pointLight position={[0, 6, 0]} color={color} intensity={2.5} distance={14} />
                <spotLight
                  position={[0, 20, 0]}
                  target-position={[ax, 0, az]}
                  color={color}
                  intensity={8}
                  distance={25}
                  angle={0.22}
                  penumbra={0.4}
                />
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}
