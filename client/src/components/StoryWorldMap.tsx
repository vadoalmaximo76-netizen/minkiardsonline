import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture, Html, KeyboardControls, useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { GymLeader } from '../types/gym';

export interface StoryLocality {
  id: number;
  name: string;
  type: string;
  description?: string | null;
  posX: number;
  posZ: number;
  icon: string;
  imageUrl?: string | null;
  isActive: boolean;
}

export interface StoryWorldMapProps {
  leaders: GymLeader[];
  lostLeaderIds: number[];
  currentLeader: GymLeader | null;
  pendingGymGame?: { gameId: string; gymLeaderCpuName?: string; gymLeaderId?: number } | null;
  loading: boolean;
  getLeaderStatus: (leader: GymLeader) => 'completed' | 'available' | 'locked';
  onChallengeLeader: (leader: GymLeader) => void;
  onResumeGame: (leader: GymLeader, gameId: string) => void;
  localities?: StoryLocality[];
}

/* ── Controls ─────────────────────────────────────────────────── */
enum Controls {
  forward = 'forward',
  back = 'back',
  left = 'left',
  right = 'right',
}

const KEY_MAP = [
  { name: Controls.forward, keys: ['ArrowUp', 'KeyW'] },
  { name: Controls.back,    keys: ['ArrowDown', 'KeyS'] },
  { name: Controls.left,    keys: ['ArrowLeft', 'KeyA'] },
  { name: Controls.right,   keys: ['ArrowRight', 'KeyD'] },
];

/* ── Static world data ─────────────────────────────────────────── */
const PLAYER_SPEED = 9;
const MAP_BOUND    = 42;

/* Percorso a zigzag da sud a nord: il giocatore parte a sud e il path serpeggia
   destra-sinistra risalendo verso il nord, coprendo l'intera larghezza della mappa.
   Player spawns at [0, 26], vicino allo Stage 1. */
const ARENA_POSITIONS_BASE: [number, number][] = [
  [  0,  30 ],   //  1 — partenza centro-sud (vicino spawn)
  [ 26,  20 ],   //  2 — curva a destra →
  [ 36,   4 ],   //  3 — est estremo →
  [ 24, -12 ],   //  4 — nord-est (piega verso nord)
  [  6, -26 ],   //  5 — nord centro
  [ -8, -36 ],   //  6 — nord estremo ←
  [-22, -28 ],   //  7 — nord-ovest ←
  [-35, -12 ],   //  8 — ovest estremo (piega verso sud)
  [-34,   8 ],   //  9 — ovest-centro
  [-20,  22 ],   // 10 — sud-ovest ←
  [ -6,  36 ],   // 11 — sud estremo
  [ 24,  36 ],   // 12 — sud-est (traguardo)
];

function getArenaPosition(idx: number): [number, number] {
  if (idx < ARENA_POSITIONS_BASE.length) return ARENA_POSITIONS_BASE[idx];
  /* Deterministic spiral for leaders 13+ (Archimedean spiral, seeded by index) */
  const t = (idx - ARENA_POSITIONS_BASE.length + 1) * 1.37;
  const r = 28 + t * 3.5;
  const x = Math.round(Math.cos(t) * r);
  const z = Math.round(Math.sin(t) * r);
  return [Math.max(-38, Math.min(38, x)), Math.max(-40, Math.min(40, z))];
}

/* Pre-computed tree positions (deterministic, not from Math.random) */
const TREE_DATA: { x: number; z: number; h: number; r: number }[] = [
  { x: 30, z: 30, h: 2.4, r: 0.9 },
  { x:-28, z: 28, h: 2.0, r: 0.75 },
  { x: 32, z: 10, h: 2.8, r: 1.0 },
  { x:-30, z:-12, h: 2.2, r: 0.85 },
  { x: 28, z:-35, h: 2.5, r: 0.95 },
  { x:-32, z:-35, h: 2.0, r: 0.8 },
  { x:  5, z: 35, h: 2.6, r: 1.0 },
  { x:-14, z: 32, h: 2.1, r: 0.7 },
  { x: 22, z: 24, h: 2.3, r: 0.9 },
  { x: 36, z:-10, h: 2.4, r: 0.85 },
  { x:-36, z: 10, h: 2.2, r: 0.8 },
  { x: 38, z:-25, h: 2.7, r: 1.0 },
  { x:-38, z:-22, h: 2.0, r: 0.75 },
  { x:  0, z:-40, h: 2.8, r: 1.0 },
  { x: 18, z: 35, h: 2.1, r: 0.7 },
  { x:-20, z:-42, h: 2.5, r: 0.9 },
  { x: 34, z: 36, h: 2.2, r: 0.8 },
  { x:-34, z: 35, h: 2.4, r: 0.9 },
  { x: 40, z:  0, h: 2.3, r: 0.85 },
  { x:-40, z: -5, h: 2.6, r: 0.95 },
  { x: 14, z:-42, h: 2.0, r: 0.75 },
  { x:-10, z: 40, h: 2.2, r: 0.8 },
  { x: 24, z:-14, h: 2.5, r: 0.9 },
  { x: -6, z:-38, h: 2.1, r: 0.7 },
  { x: 16, z: 28, h: 2.3, r: 0.85 },
];

/* ── Sky ─────────────────────────────────────────────────────────── */
function SkyDome() {
  const tex = useTexture('/textures/sky.png');
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return (
    <mesh>
      <sphereGeometry args={[200, 32, 16]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} />
    </mesh>
  );
}

/* ── Ground ─────────────────────────────────────────────────────── */
function Ground() {
  const tex = useTexture('/textures/grass.png');
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[120, 120]} />
      <meshStandardMaterial map={tex} roughness={0.85} metalness={0.0} />
    </mesh>
  );
}

/* ── Tree ─────────────────────────────────────────────────────── */
function Tree({ x, z, h, r }: { x: number; z: number; h: number; r: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* trunk */}
      <mesh position={[0, h * 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.28, h * 0.7, 6]} />
        <meshLambertMaterial color="#6b4226" />
      </mesh>
      {/* leaves */}
      <mesh position={[0, h * 0.7 + r * 0.55, 0]} castShadow>
        <coneGeometry args={[r * 1.15, r * 2.2, 7]} />
        <meshLambertMaterial color="#2d7a2d" />
      </mesh>
      <mesh position={[0, h * 0.7 + r * 1.3, 0]} castShadow>
        <coneGeometry args={[r * 0.75, r * 1.6, 7]} />
        <meshLambertMaterial color="#34a034" />
      </mesh>
    </group>
  );
}

/* ── Locality ────────────────────────────────────────────────────── */
const LOCALITY_COLORS: Record<string, { body: string; accent: string; emissive: string }> = {
  town:   { body: '#b45309', accent: '#f97316', emissive: '#7c2d12' },
  shop:   { body: '#1d4ed8', accent: '#60a5fa', emissive: '#1e3a8a' },
  inn:    { body: '#7e22ce', accent: '#c084fc', emissive: '#4a0e8f' },
  forest: { body: '#15803d', accent: '#4ade80', emissive: '#052e16' },
  shrine: { body: '#854d0e', accent: '#fbbf24', emissive: '#713f12' },
  custom: { body: '#0e7490', accent: '#67e8f9', emissive: '#0c4a6e' },
};

function Locality({ locality }: { locality: StoryLocality }) {
  const floatRef = useRef<THREE.Group>(null!);
  const pulseT   = useRef(Math.random() * Math.PI * 2);
  const colors   = LOCALITY_COLORS[locality.type] ?? LOCALITY_COLORS.custom;

  useFrame((_, delta) => {
    pulseT.current += delta * 1.1;
    if (floatRef.current) {
      floatRef.current.position.y = 4.2 + Math.sin(pulseT.current * 0.7) * 0.25;
    }
  });

  return (
    <group position={[locality.posX, 0, locality.posZ]}>
      {/* base disc */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.8, 18]} />
        <meshStandardMaterial color={colors.accent} transparent opacity={0.35} roughness={0.6} />
      </mesh>
      {/* slim pillar */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.28, 2.4, 8]} />
        <meshStandardMaterial color={colors.body} roughness={0.55} metalness={0.3} emissive={colors.emissive} emissiveIntensity={0.4} />
      </mesh>
      {/* top gem */}
      <mesh position={[0, 2.55, 0]} castShadow>
        <octahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial color={colors.accent} emissive={colors.accent} emissiveIntensity={0.6} roughness={0.15} metalness={0.6} />
      </mesh>
      {/* floating label */}
      <group ref={floatRef} position={[0, 4.2, 0]}>
        <Html center distanceFactor={20} zIndexRange={[5, 15]} style={{ pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}>
          <div style={{
            background: 'rgba(5,5,20,0.88)',
            border: `1px solid ${colors.accent}55`,
            borderRadius: 8,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 800,
            color: colors.accent,
            boxShadow: `0 0 8px ${colors.accent}44`,
            letterSpacing: '0.03em',
          }}>
            {locality.icon} {locality.name}
          </div>
        </Html>
      </group>
    </group>
  );
}

/* ── Arena ─────────────────────────────────────────────────────── */
interface ArenaProps {
  leader: GymLeader;
  position: [number, number, number];
  status: 'completed' | 'available' | 'locked';
  isCurrent: boolean;
  isNear: boolean;
  onChallenge: (leader: GymLeader) => void;
}

function Arena({ leader, position, status, isCurrent, isNear, onChallenge }: ArenaProps) {
  const [hovered, setHovered] = useState(false);
  const clickable = status !== 'locked';
  const sphereRef    = useRef<THREE.Mesh>(null!);
  const ringRef      = useRef<THREE.Mesh>(null!);
  const floatRef     = useRef<THREE.Group>(null!);
  const pulseT       = useRef(0);

  useFrame((_, delta) => {
    pulseT.current += delta * 1.8;
    if (status === 'available') {
      const s = 1 + Math.sin(pulseT.current * 1.22) * 0.18;
      if (sphereRef.current) sphereRef.current.scale.setScalar(s);
      if (ringRef.current)   ringRef.current.scale.setScalar(1 + Math.sin(pulseT.current * 1.22) * 0.08);
    }
    /* Badge float bob — always animates so badge never stands still */
    if (floatRef.current) {
      floatRef.current.position.y = 7.6 + Math.sin(pulseT.current * 0.85) * 0.35;
    }
  });

  const platformColor = status === 'completed'
    ? '#166534' : status === 'available'
    ? '#92400e' : '#1f2937';
  const pillarColor = status === 'completed'
    ? '#15803d' : status === 'available'
    ? '#b45309' : '#374151';
  const sphereColor = status === 'completed'
    ? '#4ade80' : status === 'available'
    ? '#fbbf24' : '#6b7280';
  const emissive = status === 'available' ? '#c05a00' : status === 'completed' ? '#052e16' : '#000000';
  const accentColor = status === 'completed' ? '#4ade80' : '#fbbf24';

  const handleClick = useCallback(() => {
    if (clickable) onChallenge(leader);
  }, [clickable, leader, onChallenge]);

  return (
    <group position={position}>
      {/* platform */}
      <mesh
        position={[0, 0.12, 0]}
        receiveShadow castShadow
        onClick={clickable ? handleClick : undefined}
        onPointerOver={clickable ? () => setHovered(true) : undefined}
        onPointerOut={clickable ? () => setHovered(false) : undefined}
      >
        <cylinderGeometry args={[3.5, 3.5, 0.25, 20]} />
        <meshStandardMaterial
          color={hovered && clickable ? (status === 'completed' ? '#22c55e' : '#f59e0b') : platformColor}
          roughness={0.55} metalness={0.2}
        />
      </mesh>
      {/* edge ring — pulses for available */}
      <mesh ref={ringRef} position={[0, 0.25, 0]}>
        <torusGeometry args={[3.5, 0.12, 8, 24]} />
        <meshStandardMaterial
          color={sphereColor}
          emissive={status === 'available' ? sphereColor : '#000000'}
          emissiveIntensity={status === 'available' ? 0.5 : 0}
          roughness={0.3} metalness={0.4}
        />
      </mesh>
      {/* pillar */}
      <mesh position={[0, 1.65, 0]} castShadow>
        <cylinderGeometry args={[0.38, 0.5, 3.0, 8]} />
        <meshStandardMaterial color={pillarColor} emissive={emissive} emissiveIntensity={0.35} roughness={0.6} metalness={0.25} />
      </mesh>
      {/* status sphere */}
      <mesh ref={sphereRef} position={[0, 3.35, 0]}>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshStandardMaterial
          color={sphereColor}
          emissive={sphereColor}
          emissiveIntensity={status === 'locked' ? 0 : 0.7}
          roughness={0.2} metalness={0.5}
        />
      </mesh>

      {/* ── Floating badge group — bobs up and down ── */}
      {status !== 'locked' && (
        <group ref={floatRef} position={[0, 7.6, 0]}>
          <Html
            center
            distanceFactor={26}
            zIndexRange={[20, 30]}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {/* Boss portrait — large circle */}
              <div style={{
                width: 58, height: 58,
                borderRadius: '50%',
                border: `3px solid ${accentColor}`,
                overflow: 'hidden',
                background: '#0d0a1a',
                boxShadow: `0 0 14px ${accentColor}99, 0 0 28px ${accentColor}44, 0 2px 8px rgba(0,0,0,0.8)`,
                flexShrink: 0,
              }}>
                {leader.leaderImageUrl ? (
                  <img
                    src={leader.leaderImageUrl}
                    alt={leader.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(#1a1040,#0d0a22)', fontSize: 24 }}>
                    {status === 'completed' ? '✓' : '⚔️'}
                  </div>
                )}
              </div>
              {/* Badge icon — small, below portrait */}
              {leader.badgeImageUrl && (
                <div style={{
                  width: 26, height: 26,
                  borderRadius: '50%',
                  border: `2px solid ${accentColor}`,
                  overflow: 'hidden',
                  background: '#0d0a1a',
                  boxShadow: `0 0 8px ${accentColor}88`,
                  marginTop: -2,
                }}>
                  <img src={leader.badgeImageUrl} alt="badge" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
            </div>
          </Html>
        </group>
      )}

      {/* ── Gym name label — static, below boss portrait ── */}
      <Html
        position={[0, 5.0, 0]}
        center
        distanceFactor={22}
        zIndexRange={[10, 20]}
        style={{ pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}
      >
        <div style={{
          background: status === 'locked'
            ? 'rgba(0,0,0,0.75)'
            : status === 'completed'
              ? 'rgba(5,46,22,0.92)'
              : 'rgba(30,15,0,0.92)',
          border: `1px solid ${status === 'completed' ? '#4ade8066' : status === 'available' ? '#fbbf2466' : '#374151'}`,
          borderRadius: 8,
          padding: '3px 9px',
          fontSize: 12,
          fontWeight: 800,
          color: status === 'locked' ? '#6b7280' : status === 'completed' ? '#86efac' : '#fde68a',
          letterSpacing: '0.03em',
          boxShadow: status !== 'locked' ? `0 2px 8px rgba(0,0,0,0.7), 0 0 6px ${accentColor}44` : 'none',
        }}>
          {status === 'locked' ? '🔒 ' : status === 'completed' ? '✓ ' : '⚡ '}
          {leader.gymName}
        </div>
      </Html>

      {/* proximity glow ring on ground */}
      {isNear && status !== 'locked' && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.8, 4.4, 32]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

/* ── Player ─────────────────────────────────────────────────────── */
interface PlayerProps {
  posRef: React.RefObject<THREE.Group>;
  joystickRef: React.MutableRefObject<{ x: number; z: number }>;
}

function Player({ posRef, joystickRef }: PlayerProps) {
  const [, getState] = useKeyboardControls<Controls>();
  const velocity = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const controls = getState();
    const joy = joystickRef.current;

    let dx = 0;
    let dz = 0;
    if (controls.forward || joy.z < -0.3) dz -= 1;
    if (controls.back    || joy.z >  0.3) dz += 1;
    if (controls.left    || joy.x < -0.3) dx -= 1;
    if (controls.right   || joy.x >  0.3) dx += 1;

    const moving = dx !== 0 || dz !== 0;
    if (moving) {
      const len = Math.sqrt(dx * dx + dz * dz);
      dx /= len; dz /= len;
    }

    velocity.current.set(dx * PLAYER_SPEED, 0, dz * PLAYER_SPEED);

    if (posRef.current) {
      posRef.current.position.x = THREE.MathUtils.clamp(
        posRef.current.position.x + velocity.current.x * delta,
        -MAP_BOUND, MAP_BOUND
      );
      posRef.current.position.z = THREE.MathUtils.clamp(
        posRef.current.position.z + velocity.current.z * delta,
        -MAP_BOUND, MAP_BOUND
      );

      /* Simple rotation towards movement direction */
      if (moving) {
        const targetAngle = Math.atan2(dx, dz);
        posRef.current.rotation.y = THREE.MathUtils.lerp(
          posRef.current.rotation.y,
          targetAngle,
          0.18
        );
      }
    }
  });

  return (
    <group ref={posRef} position={[0, 0, 26]}>
      {/* capsule torso — cylinder with rounded ends */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 1.1, 12]} />
        <meshStandardMaterial color="#7c3aed" roughness={0.4} metalness={0.2} emissive="#3b1a8a" emissiveIntensity={0.3} />
      </mesh>
      {/* capsule top cap */}
      <mesh position={[0, 1.45, 0]} castShadow>
        <sphereGeometry args={[0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#7c3aed" roughness={0.4} metalness={0.2} emissive="#3b1a8a" emissiveIntensity={0.3} />
      </mesh>
      {/* capsule bottom cap */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <sphereGeometry args={[0.32, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#6d28d9" roughness={0.4} metalness={0.2} />
      </mesh>
      {/* head (sphere) */}
      <mesh position={[0, 1.95, 0]} castShadow>
        <sphereGeometry args={[0.3, 14, 10]} />
        <meshStandardMaterial color="#e2c9a8" roughness={0.7} metalness={0.0} />
      </mesh>
      {/* player shadow disc */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.48, 12]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

/* ── Camera rig ─────────────────────────────────────────────────── */
function CameraRig({ posRef }: { posRef: React.RefObject<THREE.Group> }) {
  const CAM_OFFSET = useMemo(() => new THREE.Vector3(18, 26, 18), []);
  const camTarget = useRef(new THREE.Vector3(0, 0, 26));

  useFrame(({ camera }) => {
    if (!posRef.current) return;
    const px = posRef.current.position;
    camTarget.current.lerp(px, 0.08);

    camera.position.set(
      camTarget.current.x + CAM_OFFSET.x,
      camTarget.current.y + CAM_OFFSET.y,
      camTarget.current.z + CAM_OFFSET.z
    );
    camera.lookAt(camTarget.current);
  });

  return null;
}

/* ── World scene (inside Canvas) ───────────────────────────────── */
interface WorldSceneProps {
  leaders: GymLeader[];
  arenaPositions: [number, number][];
  getLeaderStatus: (leader: GymLeader) => 'completed' | 'available' | 'locked';
  currentLeader: GymLeader | null;
  nearestLeaderId: number | null;
  playerPosRef: React.RefObject<THREE.Group>;
  joystickRef: React.MutableRefObject<{ x: number; z: number }>;
  onNearestChange: (id: number | null, dist: number) => void;
  onChallengeLeader: (leader: GymLeader) => void;
  localities: StoryLocality[];
}

function WorldScene({
  leaders,
  arenaPositions,
  getLeaderStatus,
  currentLeader,
  nearestLeaderId,
  playerPosRef,
  joystickRef,
  onNearestChange,
  onChallengeLeader,
  localities,
}: WorldSceneProps) {

  const nearCheckRef = useRef(0);

  useFrame((_, delta) => {
    nearCheckRef.current += delta;
    if (nearCheckRef.current < 0.15) return;
    nearCheckRef.current = 0;

    if (!playerPosRef.current) return;
    const px = playerPosRef.current.position.x;
    const pz = playerPosRef.current.position.z;

    let minDist = Infinity;
    let minId: number | null = null;

    leaders.forEach((l, idx) => {
      const [ax, az] = arenaPositions[idx] ?? getArenaPosition(idx);
      const dist = Math.sqrt((px - ax) ** 2 + (pz - az) ** 2);
      if (dist < minDist) { minDist = dist; minId = l.id; }
    });

    onNearestChange(minDist <= 9 ? minId : null, minDist);
  });

  return (
    <>
      {/* Lighting — richer PBR setup */}
      <ambientLight intensity={0.75} color="#e8f0ff" />
      <directionalLight
        position={[30, 55, 20]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={180}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        color="#fff5e0"
      />
      <directionalLight position={[-20, 30, -20]} intensity={0.4} color="#c8d8ff" />
      <hemisphereLight args={['#87ceeb', '#3a6b35', 0.45]} />

      {/* Sky dome with texture */}
      <SkyDome />
      <fog attach="fog" args={['#b8d8f0', 62, 130]} />

      {/* Ground */}
      <Ground />

      {/* Trees */}
      {TREE_DATA.map((t, i) => (
        <Tree key={i} {...t} />
      ))}

      {/* Localities */}
      {localities.map(loc => (
        <Locality key={loc.id} locality={loc} />
      ))}

      {/* Arenas */}
      {leaders.map((leader, idx) => {
        const [ax, az] = arenaPositions[idx] ?? getArenaPosition(idx);
        const status = getLeaderStatus(leader);
        const isNear = leader.id === nearestLeaderId;
        const isCurrent = leader.id === currentLeader?.id;
        return (
          <Arena
            key={leader.id}
            leader={leader}
            position={[ax, 0, az]}
            status={status}
            isCurrent={isCurrent}
            isNear={isNear}
            onChallenge={onChallengeLeader}
          />
        );
      })}

      {/* Player */}
      <Player posRef={playerPosRef} joystickRef={joystickRef} />

      {/* Camera */}
      <CameraRig posRef={playerPosRef} />
    </>
  );
}

/* ── GPS Minimap overlay ─────────────────────────────────────────── */
interface MinimapProps {
  playerPosRef: React.RefObject<THREE.Group>;
  arenaPositions: [number, number][];
  leaders: GymLeader[];
  getLeaderStatus: (leader: GymLeader) => 'completed' | 'available' | 'locked';
  localities: StoryLocality[];
}

function Minimap({ playerPosRef, arenaPositions, leaders, getLeaderStatus, localities }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const SIZE  = 160;
    const PAD   = 8;
    const WORLD = 84; // -42 to +42
    const scale = (SIZE - PAD * 2) / WORLD;

    const toC = (wx: number, wz: number) => ({
      x: PAD + (wx + 42) * scale,
      y: PAD + (wz + 42) * scale,
    });

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) { rafRef.current = requestAnimationFrame(draw); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, SIZE, SIZE);

      /* Background */
      ctx.beginPath();
      ctx.roundRect(0, 0, SIZE, SIZE, 10);
      ctx.fillStyle = 'rgba(3,4,18,0.92)';
      ctx.fill();

      /* Border */
      ctx.beginPath();
      ctx.roundRect(0.5, 0.5, SIZE - 1, SIZE - 1, 10);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();

      /* Label */
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MAPPA', SIZE / 2, 14);

      /* Localities */
      localities.forEach(loc => {
        const { x, y } = toC(loc.posX, loc.posZ);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(-3.5, -3.5, 7, 7);
        ctx.restore();
      });

      /* Arenas */
      arenaPositions.forEach(([ax, az], idx) => {
        if (idx >= leaders.length) return;
        const status = getLeaderStatus(leaders[idx]);
        const { x, y } = toC(ax, az);
        const color = status === 'completed' ? '#4ade80' : status === 'available' ? '#fbbf24' : '#4b5563';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (status !== 'locked') {
          ctx.beginPath();
          ctx.arc(x, y, 6.5, 0, Math.PI * 2);
          ctx.strokeStyle = color + '66';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      /* Player */
      if (playerPosRef.current) {
        const px = playerPosRef.current.position.x;
        const pz = playerPosRef.current.position.z;
        const { x, y } = toC(px, pz);
        /* Glow */
        const grd = ctx.createRadialGradient(x, y, 0, x, y, 9);
        grd.addColorStop(0, 'rgba(167,139,250,0.55)');
        grd.addColorStop(1, 'rgba(167,139,250,0)');
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        /* Dot */
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#a78bfa';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [arenaPositions, leaders, getLeaderStatus, localities, playerPosRef]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        opacity: hovered ? 1 : 0.55,
        transition: 'opacity 0.25s ease',
        zIndex: 20,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
        cursor: 'default',
      }}
    >
      <canvas ref={canvasRef} width={160} height={160} style={{ display: 'block' }} />
      {hovered && (
        <div style={{
          position: 'absolute', bottom: 4, right: 6,
          fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700,
          letterSpacing: '0.05em',
        }}>
          🟢 completato &nbsp; 🟡 disponibile
        </div>
      )}
    </div>
  );
}

/* ── Mobile joystick button ─────────────────────────────────────── */
interface JoystickBtnProps {
  label: string;
  onStart: () => void;
  onEnd: () => void;
}

function JoystickBtn({ label, onStart, onEnd }: JoystickBtnProps) {
  return (
    <div
      onPointerDown={(e) => { e.preventDefault(); onStart(); }}
      onPointerUp={onEnd}
      onPointerLeave={onEnd}
      style={{
        width: 52,
        height: 52,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.18)',
        border: '2px solid rgba(255,255,255,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        userSelect: 'none',
        cursor: 'pointer',
        touchAction: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {label}
    </div>
  );
}

/* ── Main exported component ────────────────────────────────────── */
export function StoryWorldMap({
  leaders,
  lostLeaderIds,
  currentLeader,
  pendingGymGame,
  loading,
  getLeaderStatus,
  onChallengeLeader,
  onResumeGame,
  localities = [],
}: StoryWorldMapProps) {

  const playerPosRef = useRef<THREE.Group>(null!);
  const joystickRef  = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  const [nearestLeaderId, setNearestLeaderId] = useState<number | null>(null);
  const [nearestDist, setNearestDist]         = useState(Infinity);
  const [showHint, setShowHint]               = useState(true);
  /* Show mobile joystick only on touch-capable devices */
  const [isTouchDevice] = useState(
    () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );

  /* Derive nearest leader object */
  const nearLeader = useMemo(
    () => leaders.find(l => l.id === nearestLeaderId) ?? null,
    [leaders, nearestLeaderId]
  );

  /* Progress counts for HUD */
  const completedCount = useMemo(
    () => leaders.filter(l => getLeaderStatus(l) === 'completed').length,
    [leaders, getLeaderStatus]
  );

  /* Pre-memoize world positions per leader (stable between renders) */
  const arenaPositions = useMemo(
    () => leaders.map((_, idx) => getArenaPosition(idx)),
    [leaders]
  );

  const handleNearestChange = useCallback((id: number | null, dist: number) => {
    setNearestLeaderId(id);
    setNearestDist(dist);
  }, []);

  /* Hide keyboard hint after 5 seconds */
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(t);
  }, []);

  /* Joystick press handlers */
  const setJoy = useCallback((x: number, z: number) => {
    joystickRef.current = { x, z };
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-white/20 border-t-yellow-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/30 text-sm">Caricamento mappa…</p>
        </div>
      </div>
    );
  }

  if (leaders.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/30 text-sm">Nessuno stage disponibile</p>
        </div>
      </div>
    );
  }

  const nearStatus = nearLeader ? getLeaderStatus(nearLeader) : null;
  const hasPending = nearLeader ? pendingGymGame?.gymLeaderId === nearLeader.id && !lostLeaderIds.includes(nearLeader.id) && nearStatus !== 'completed' : false;
  const hasLost    = nearLeader ? lostLeaderIds.includes(nearLeader.id) && nearStatus !== 'completed' : false;

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      {/* Canvas */}
      <KeyboardControls map={KEY_MAP}>
        <Canvas
          shadows
          style={{ position: 'absolute', inset: 0 }}
          camera={{ position: [18, 26, 44], fov: 55 }}
          gl={{ antialias: true }}
        >
          <WorldScene
            leaders={leaders}
            arenaPositions={arenaPositions}
            getLeaderStatus={getLeaderStatus}
            currentLeader={currentLeader}
            nearestLeaderId={nearestLeaderId}
            playerPosRef={playerPosRef}
            joystickRef={joystickRef}
            onNearestChange={handleNearestChange}
            onChallengeLeader={onChallengeLeader}
            localities={localities}
          />
        </Canvas>
      </KeyboardControls>

      {/* ── GPS Minimap — centered vertically on left side ── */}
      <Minimap
        playerPosRef={playerPosRef}
        arenaPositions={arenaPositions}
        leaders={leaders}
        getLeaderStatus={getLeaderStatus}
        localities={localities}
      />

      {/* ── Persistent top HUD (right-aligned to avoid minimap) ── */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10, padding: '6px 12px',
        color: 'rgba(255,255,255,0.60)', fontSize: 11, fontWeight: 700,
        pointerEvents: 'none', zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 3,
        textAlign: 'right',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.45)' }}>WASD / ↑↓←→ — muoviti</span>
        <span style={{ color: '#4ade80', fontSize: 12 }}>
          ✓ Stage completati: <strong>{completedCount}/{leaders.length}</strong>
        </span>
        <span style={{ color: 'rgba(251,191,36,0.85)' }}>
          {nearLeader && nearStatus !== 'locked' && nearestDist <= 9
            ? `⚡ Stage attivo: ${nearLeader.gymName}`
            : '📍 Avvicinati ad uno Stage'}
        </span>
      </div>

      {/* ── Fading intro hint (first 5 s) ── */}
      {showHint && (
        <div style={{
          position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 12, padding: '6px 14px',
          color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 700,
          pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 20,
        }}>
          Clicca su uno Stage o avvicinati per sfidarlo
        </div>
      )}

      {/* ── Near leader card ── */}
      {nearLeader && nearStatus !== 'locked' && nearestDist <= 9 && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(5,5,20,0.9) 100%)',
          border: '0 solid transparent',
          borderTop: `2px solid ${nearStatus === 'completed' ? 'rgba(74,222,128,0.5)' : 'rgba(245,158,11,0.5)'}`,
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
          zIndex: 30,
        }}>
          {/* Leader image */}
          {nearLeader.leaderImageUrl ? (
            <img
              src={nearLeader.leaderImageUrl}
              alt={nearLeader.name}
              style={{
                width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
                border: `2px solid ${nearStatus === 'completed' ? '#4ade80' : '#fbbf24'}`,
                flexShrink: 0,
                boxShadow: `0 0 18px ${nearStatus === 'completed' ? '#4ade8055' : '#fbbf2455'}`,
              }}
            />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: nearStatus === 'completed' ? 'rgba(22,101,52,0.6)' : 'rgba(120,53,15,0.6)',
              border: `2px solid ${nearStatus === 'completed' ? '#4ade8055' : '#fbbf2455'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 22,
            }}>
              🏋️
            </div>
          )}

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: nearStatus === 'completed' ? '#4ade80' : '#fbbf24' }}>
                ⚡ Stage {nearLeader.orderIndex}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: nearStatus === 'completed' ? '#86efac' : '#fde68a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nearLeader.gymName}
            </p>
            <p style={{ margin: '1px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              👊 {nearLeader.name}
              {' · '}
              {nearLeader.cpuLevel === 'easy' ? '🟢' : nearLeader.cpuLevel === 'medium' ? '🟡' : '🔴'}
              {' · '}
              ❤️ {nearLeader.livesCount}
              {' · '}
              ⭐ {nearLeader.rewardCredits}
            </p>
          </div>

          {/* Action button */}
          <div style={{ flexShrink: 0 }}>
            {hasPending ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  onClick={() => onResumeGame(nearLeader, pendingGymGame!.gameId)}
                  style={{
                    background: 'linear-gradient(135deg,#ea580c,#c2410c)', border: 'none',
                    borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 900,
                    padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
                    boxShadow: '0 2px 10px rgba(234,88,12,0.4)',
                  }}
                >
                  ⚔️ Riprendi
                </button>
                <button
                  onClick={() => onChallengeLeader(nearLeader)}
                  style={{
                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 800,
                    padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  Nuova partita
                </button>
              </div>
            ) : hasLost ? (
              <button
                onClick={() => onChallengeLeader(nearLeader)}
                style={{
                  background: 'linear-gradient(135deg,#dc2626,#9333ea)', border: 'none',
                  borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 900,
                  padding: '10px 18px', cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: '0 2px 12px rgba(220,38,38,0.5)',
                }}
              >
                ⚔️ Riprova
              </button>
            ) : nearStatus === 'available' ? (
              <button
                onClick={() => onChallengeLeader(nearLeader)}
                style={{
                  background: 'linear-gradient(135deg,#9333ea,#f59e0b)', border: 'none',
                  borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 900,
                  padding: '10px 18px', cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: '0 2px 14px rgba(147,51,234,0.5)',
                  letterSpacing: '0.04em',
                }}
              >
                ⚔️ SFIDA!
              </button>
            ) : nearStatus === 'completed' ? (
              <button
                onClick={() => onChallengeLeader(nearLeader)}
                style={{
                  background: 'rgba(74,222,128,0.15)',
                  border: '1.5px solid rgba(74,222,128,0.4)',
                  borderRadius: 10, color: '#86efac', fontSize: 13, fontWeight: 800,
                  padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                ↺ Rigioca
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Mobile joystick (touch devices only) — centered at bottom ── */}
      {isTouchDevice && (
        <div style={{
          position: 'absolute',
          bottom: nearLeader && nearStatus !== 'locked' && nearestDist <= 9 ? 140 : 14,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          zIndex: 25,
          transition: 'bottom 0.2s ease',
        }}>
          <JoystickBtn label="▲" onStart={() => setJoy(0, -1)} onEnd={() => setJoy(0, 0)} />
          <div style={{ display: 'flex', gap: 4 }}>
            <JoystickBtn label="◀" onStart={() => setJoy(-1, 0)} onEnd={() => setJoy(0, 0)} />
            <JoystickBtn label="▼" onStart={() => setJoy(0, 1)} onEnd={() => setJoy(0, 0)} />
            <JoystickBtn label="▶" onStart={() => setJoy(1, 0)} onEnd={() => setJoy(0, 0)} />
          </div>
        </div>
      )}
    </div>
  );
}
