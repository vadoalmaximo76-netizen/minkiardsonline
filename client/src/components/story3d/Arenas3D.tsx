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

/* Column positions around the arena centre */
const COL_OFFSETS: [number, number][] = [
  [ 2.1,  2.1],
  [-2.1,  2.1],
  [ 2.1, -2.1],
  [-2.1, -2.1],
];

/* ── Single arena ─────────────────────────────────────────────── */
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
  const { scene }  = useThree();
  const spotRef    = useRef<THREE.SpotLight>(null);
  const gemRef     = useRef<THREE.Group>(null);
  const ring1Ref   = useRef<THREE.Mesh>(null);
  const ring2Ref   = useRef<THREE.Mesh>(null);
  const ring3Ref   = useRef<THREE.Mesh>(null);
  const col1Ref    = useRef<THREE.Mesh>(null);
  const col2Ref    = useRef<THREE.Mesh>(null);
  const col3Ref    = useRef<THREE.Mesh>(null);
  const col4Ref    = useRef<THREE.Mesh>(null);
  const timeRef    = useRef(0);

  const isLocked    = status === 'locked';
  const isCompleted = status === 'completed';
  const leaderName  = leader.name ?? `Leader ${index + 1}`;
  const colRefs     = [col1Ref, col2Ref, col3Ref, col4Ref];

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
    timeRef.current += delta;
    const t = timeRef.current;

    /* ── Gem float + rotate ── */
    if (gemRef.current && status === 'available') {
      gemRef.current.rotation.y = t * 0.7;
      gemRef.current.position.y = 6.0 + Math.sin(t * 1.5 + index) * 0.22;
    }

    /* ── Energy rings ── */
    if (ring1Ref.current) ring1Ref.current.rotation.y = t * 0.9;
    if (ring2Ref.current) ring2Ref.current.rotation.z = t * 1.2;
    if (ring3Ref.current) ring3Ref.current.rotation.x = t * 0.7;

    /* ── Column pulse (available only) ── */
    if (status === 'available') {
      colRefs.forEach((r, ci) => {
        if (!r.current) return;
        const mat = r.current.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.28 + Math.sin(t * 2.2 + ci * 0.6) * 0.18;
      });
    }
  });

  const arenaColor   = isLocked ? '#334455' : color;
  const lockedGrey   = '#2a2a3a';
  const platformCol  = isLocked ? lockedGrey : color;

  return (
    <group
      position={[ax, 0, az]}
      onClick={(e) => {
        e.stopPropagation();
        if (!isLocked) onChallengeLeader(leader);
      }}
    >
      {/* ── Base platform (wide step) ───────────────────────────── */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <cylinderGeometry args={[4.2, 4.6, 0.24, 20]} />
        <meshStandardMaterial color={isLocked ? '#242435' : color} roughness={0.6} metalness={0.25} />
      </mesh>

      {/* ── Mid step ─────────────────────────────────────────────── */}
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[3.5, 4.2, 0.24, 20]} />
        <meshStandardMaterial color={isLocked ? '#2a2a3c' : color} roughness={0.55} metalness={0.3} />
      </mesh>

      {/* ── Top platform ─────────────────────────────────────────── */}
      <mesh position={[0, 0.60, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[3.0, 3.5, 0.24, 20]} />
        <meshStandardMaterial color={isLocked ? '#303044' : color} roughness={0.5} metalness={0.35} />
      </mesh>

      {/* ── Central glowing floor disc ───────────────────────────── */}
      <mesh position={[0, 0.74, 0]}>
        <cylinderGeometry args={[2.0, 2.0, 0.04, 20]} />
        <meshStandardMaterial
          color={arenaColor}
          emissive={arenaColor}
          emissiveIntensity={isLocked ? 0 : 0.5}
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>

      {/* ── 4 Angular columns ────────────────────────────────────── */}
      {COL_OFFSETS.map(([cx, cz], ci) => {
        const refs = [col1Ref, col2Ref, col3Ref, col4Ref];
        return (
          <mesh
            key={ci}
            ref={refs[ci]}
            position={[cx, 2.8, cz]}
            castShadow
          >
            <cylinderGeometry args={[0.28, 0.34, 5.2, 8]} />
            <meshStandardMaterial
              color={isLocked ? '#224455' : color}
              emissive={isLocked ? '#000000' : color}
              emissiveIntensity={isLocked ? 0 : 0.28}
              roughness={0.35}
              metalness={0.55}
            />
          </mesh>
        );
      })}

      {/* ── Energy rings (3 tori around pillar) ──────────────────── */}
      <mesh ref={ring1Ref} position={[0, 2.5, 0]}>
        <torusGeometry args={[1.5, 0.08, 8, 32]} />
        <meshStandardMaterial
          color={arenaColor}
          emissive={arenaColor}
          emissiveIntensity={isLocked ? 0 : 1.4}
          roughness={0.1}
          metalness={0.7}
        />
      </mesh>
      <mesh ref={ring2Ref} position={[0, 3.8, 0]}>
        <torusGeometry args={[1.2, 0.07, 8, 28]} />
        <meshStandardMaterial
          color={arenaColor}
          emissive={arenaColor}
          emissiveIntensity={isLocked ? 0 : 1.2}
          roughness={0.1}
          metalness={0.7}
        />
      </mesh>
      <mesh ref={ring3Ref} position={[0, 5.1, 0]}>
        <torusGeometry args={[0.9, 0.06, 7, 24]} />
        <meshStandardMaterial
          color={arenaColor}
          emissive={arenaColor}
          emissiveIntensity={isLocked ? 0 : 1.0}
          roughness={0.1}
          metalness={0.7}
        />
      </mesh>

      {/* ── Central crystal gem ──────────────────────────────────── */}
      <group ref={gemRef} position={[0, 6.0, 0]}>
        <mesh castShadow>
          <octahedronGeometry args={[1.1]} />
          <meshStandardMaterial
            color={isCompleted ? '#ffffff' : isLocked ? '#334455' : color}
            emissive={isCompleted ? '#aaffaa' : isLocked ? '#000000' : color}
            emissiveIntensity={isCompleted ? 1.0 : isLocked ? 0 : 1.2}
            roughness={0.05}
            metalness={0.8}
            transparent={!isLocked}
            opacity={isLocked ? 1 : 0.88}
          />
        </mesh>
        {/* Inner glow core */}
        {!isLocked && (
          <mesh scale={[0.55, 0.55, 0.55]}>
            <octahedronGeometry args={[1.1]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={2.0}
              roughness={0.0}
              metalness={1.0}
              transparent
              opacity={0.5}
            />
          </mesh>
        )}
      </group>

      {/* ── Completion ring ──────────────────────────────────────── */}
      {isCompleted && (
        <mesh position={[0, 0.28, 0]}>
          <torusGeometry args={[4.0, 0.18, 8, 36]} />
          <meshStandardMaterial
            color="#4ade80"
            emissive="#4ade80"
            emissiveIntensity={0.9}
            roughness={0.2}
            metalness={0.5}
          />
        </mesh>
      )}

      {/* ── Leader name label ─────────────────────────────────────── */}
      <Text
        position={[0, 8.2, 0]}
        fontSize={0.58}
        color={isLocked ? '#8899aa' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.07}
        outlineColor="#000000"
      >
        {isLocked ? '🔒' : leaderName}
      </Text>

      {/* ── Stage / status label ─────────────────────────────────── */}
      <Text
        position={[0, 9.0, 0]}
        fontSize={0.40}
        color={isLocked ? '#556677' : color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#000000"
      >
        {isCompleted ? '✅ Completato' : `Stage ${index + 1}`}
      </Text>

      {/* ── Spotlight column (available arenas) ──────────────────── */}
      {status === 'available' && (
        <>
          <pointLight position={[0, 7, 0]} color={color} intensity={4} distance={18} />
          <spotLight
            ref={spotRef}
            position={[0, 26, 0]}
            color={color}
            intensity={14}
            distance={32}
            angle={0.22}
            penumbra={0.5}
            castShadow={false}
          />
        </>
      )}
    </group>
  );
}

/* ── Arenas container ──────────────────────────────────────────── */
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
