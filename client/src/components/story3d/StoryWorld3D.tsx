import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { GymLeader } from '../../types/gym';

/* ── World data (mirrored from StoryWorldMap) ─────────────────── */
type BuildingType = 'house' | 'shop' | 'inn' | 'tower' | 'ruin' | 'church' | 'arcade' | 'farm' | 'barn';

const BUILDING_BODY_HEIGHT: Record<BuildingType, number> = {
  house: 4, shop: 3, inn: 4.5, tower: 10, ruin: 2,
  church: 7, arcade: 4, farm: 3, barn: 5,
};

const BUILDING_BODY_COLOR: Record<BuildingType, string> = {
  house: '#c8a87a', shop: '#b8d4f0', inn: '#d4c88a', tower: '#9a9a9a',
  ruin: '#7a7060', church: '#f0e8d0', arcade: '#2d1a4e', farm: '#d4b878', barn: '#c87840',
};

const BUILDING_ROOF_COLOR: Record<BuildingType, string> = {
  house: '#8b5e3c', shop: '#4a80c0', inn: '#8b6020', tower: '#444444',
  ruin: '#4a4030', church: '#c04040', arcade: '#7c3aed', farm: '#8b5a1a', barn: '#6b2a10',
};

const ARENA_COLORS = [
  '#c0392b','#e67e22','#e8b800','#27ae60','#1abc9c',
  '#2980b9','#8e44ad','#e91e63','#ff5722','#607d8b',
  '#795548','#4caf50',
];

/* ── Types ────────────────────────────────────────────────────── */
interface OtherPlayer {
  userId: number;
  username: string;
  avatar: string | null;
  x: number;
  z: number;
}

export interface StoryWorldBuildingDatum {
  x: number; z: number; type: BuildingType; w: number; h: number;
}

export interface StoryWorldTreeDatum {
  x: number; z: number; h: number; r: number;
}

export interface StoryWorldRoadDatum {
  x1: number; z1: number; x2: number; z2: number; w: number;
}

export interface StoryWorldCollectible {
  id: number;
  type: string;
  posX: number;
  posZ: number;
  creditValue?: number;
  cardId?: string | null;
}

export interface StoryWorld3DProps {
  playerRef: React.MutableRefObject<{ x: number; z: number }>;
  otherPlayersRef: React.MutableRefObject<Map<number, OtherPlayer>>;
  leaders: GymLeader[];
  arenaPositions: [number, number][];
  getLeaderStatus: (leader: GymLeader) => 'completed' | 'available' | 'locked';
  visibleCollectibles: StoryWorldCollectible[];
  buildingData: StoryWorldBuildingDatum[];
  treeData: StoryWorldTreeDatum[];
  roadData?: StoryWorldRoadDatum[];
  onChallengeLeader: (leader: GymLeader) => void;
  onClickCollectible: (c: StoryWorldCollectible) => void;
  dayTime?: number;
}

/* ── Terrain ──────────────────────────────────────────────────── */
function Terrain() {
  const grassTex = useTexture('/textures/grass.png');
  const sandTex  = useTexture('/textures/sand.jpg');
  useMemo(() => {
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(40, 40);
    sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
    sandTex.repeat.set(60, 60);
  }, [grassTex, sandTex]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshLambertMaterial map={grassTex} />
      </mesh>
      {/* Water canal accents (flat coloured strips) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshLambertMaterial color="#1a3a5c" transparent opacity={0} />
      </mesh>
    </group>
  );
}

/* ── Roads ────────────────────────────────────────────────────── */
function Roads({ roads }: { roads: StoryWorldRoadDatum[] }) {
  const asphaltTex = useTexture('/textures/asphalt.png');
  useMemo(() => {
    asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
    asphaltTex.repeat.set(1, 8);
  }, [asphaltTex]);

  return (
    <group>
      {roads.map((r, i) => {
        const cx = (r.x1 + r.x2) / 2;
        const cz = (r.z1 + r.z2) / 2;
        const dx = r.x2 - r.x1;
        const dz = r.z2 - r.z1;
        const len = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dx, dz);
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, angle]} position={[cx, 0.01, cz]}>
            <planeGeometry args={[r.w, len]} />
            <meshLambertMaterial map={asphaltTex} color="#666688" />
          </mesh>
        );
      })}
    </group>
  );
}

/* ── Buildings ────────────────────────────────────────────────── */
function Buildings({ buildings }: { buildings: StoryWorldBuildingDatum[] }) {
  return (
    <group>
      {buildings.map((b, i) => {
        const bh = BUILDING_BODY_HEIGHT[b.type];
        const bodyColor  = BUILDING_BODY_COLOR[b.type];
        const roofColor  = BUILDING_ROOF_COLOR[b.type];
        const bw = b.w;
        const bd = b.h;
        const isRuin = b.type === 'ruin';

        return (
          <group key={i} position={[b.x, 0, b.z]}>
            {/* Body */}
            <mesh position={[0, bh / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[bw, bh, bd]} />
              <meshLambertMaterial color={bodyColor} />
            </mesh>
            {/* Roof pyramid */}
            {!isRuin && (
              <mesh position={[0, bh + 0.8, 0]} castShadow>
                <coneGeometry args={[Math.max(bw, bd) * 0.72, 1.6, 4]} />
                <meshLambertMaterial color={roofColor} />
              </mesh>
            )}
            {/* Church cross */}
            {b.type === 'church' && (
              <>
                <mesh position={[0, bh + 2.2, 0]}>
                  <boxGeometry args={[0.15, 1.5, 0.15]} />
                  <meshLambertMaterial color="#ffffff" />
                </mesh>
                <mesh position={[0, bh + 2.7, 0]}>
                  <boxGeometry args={[0.6, 0.15, 0.15]} />
                  <meshLambertMaterial color="#ffffff" />
                </mesh>
              </>
            )}
            {/* Tower battlements */}
            {b.type === 'tower' && (
              <mesh position={[0, bh + 0.3, 0]}>
                <boxGeometry args={[bw + 0.2, 0.6, bd + 0.2]} />
                <meshLambertMaterial color="#555555" />
              </mesh>
            )}
            {/* Arcade glow sign */}
            {b.type === 'arcade' && (
              <mesh position={[0, bh + 0.1, bd / 2 + 0.05]}>
                <planeGeometry args={[bw * 0.7, 0.5]} />
                <meshBasicMaterial color="#a855f7" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

/* ── Trees (InstancedMesh) ────────────────────────────────────── */
function Trees({ trees }: { trees: StoryWorldTreeDatum[] }) {
  const trunkRef  = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const initDone  = useRef(false);

  useFrame(() => {
    if (initDone.current) return;
    if (!trunkRef.current || !canopyRef.current) return;
    initDone.current = true;
    const dummy = new THREE.Object3D();
    trees.forEach((t, i) => {
      const trunkH = t.h * 2.5;
      dummy.position.set(t.x, trunkH / 2, t.z);
      dummy.scale.set(0.25, trunkH, 0.25);
      dummy.updateMatrix();
      trunkRef.current!.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x, trunkH + t.r * 2.2, t.z);
      dummy.scale.set(t.r * 3.5, t.r * 3.5, t.r * 3.5);
      dummy.updateMatrix();
      canopyRef.current!.setMatrixAt(i, dummy.matrix);
    });
    trunkRef.current.instanceMatrix.needsUpdate = true;
    canopyRef.current.instanceMatrix.needsUpdate = true;
  });

  if (trees.length === 0) return null;

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshLambertMaterial color="#6b4226" />
      </instancedMesh>
      <instancedMesh ref={canopyRef} args={[undefined, undefined, trees.length]} castShadow>
        <sphereGeometry args={[1, 8, 6]} />
        <meshLambertMaterial color="#2d7a2d" />
      </instancedMesh>
    </group>
  );
}

/* ── Arenas ───────────────────────────────────────────────────── */
function Arenas({ arenaPositions, leaders, getLeaderStatus, onChallengeLeader }: {
  arenaPositions: [number, number][];
  leaders: GymLeader[];
  getLeaderStatus: (l: GymLeader) => 'completed' | 'available' | 'locked';
  onChallengeLeader: (l: GymLeader) => void;
}) {
  const time = useRef(0);
  const meshRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((_, delta) => {
    time.current += delta;
    meshRefs.current.forEach((g, i) => {
      if (!g) return;
      const status = getLeaderStatus(leaders[i]);
      if (status === 'available') {
        g.rotation.y = time.current * 0.6;
        g.position.y = Math.sin(time.current * 1.5 + i) * 0.15;
      }
    });
  });

  return (
    <group>
      {arenaPositions.map(([ax, az], i) => {
        const leader = leaders[i];
        if (!leader) return null;
        const status = getLeaderStatus(leader);
        const color = ARENA_COLORS[i % ARENA_COLORS.length];
        const isLocked = status === 'locked';
        const isCompleted = status === 'completed';

        return (
          <group
            key={leader.id}
            ref={el => { meshRefs.current[i] = el; }}
            position={[ax, 0, az]}
            onClick={(e) => {
              e.stopPropagation();
              if (status !== 'locked') onChallengeLeader(leader);
            }}
          >
            {/* Platform */}
            <mesh position={[0, 0.15, 0]} receiveShadow>
              <cylinderGeometry args={[3.5, 4, 0.3, 16]} />
              <meshLambertMaterial color={isLocked ? '#333344' : color} />
            </mesh>
            {/* Steps */}
            <mesh position={[0, 0.35, 0]}>
              <cylinderGeometry args={[3, 3.5, 0.4, 16]} />
              <meshLambertMaterial color={isLocked ? '#222233' : color} />
            </mesh>
            {/* Crystal pillar */}
            <mesh position={[0, 2.5, 0]} castShadow>
              <cylinderGeometry args={[0.6, 0.8, 4.5, 8]} />
              <meshLambertMaterial
                color={isLocked ? '#224' : color}
                emissive={isCompleted ? '#ffffff' : isLocked ? '#000000' : color}
                emissiveIntensity={isCompleted ? 0.3 : isLocked ? 0 : 0.4}
              />
            </mesh>
            {/* Top gem */}
            <mesh position={[0, 4.9, 0]} castShadow>
              <octahedronGeometry args={[0.8]} />
              <meshLambertMaterial
                color={isCompleted ? '#ffffff' : isLocked ? '#334' : color}
                emissive={isCompleted ? '#aaffaa' : isLocked ? '#000' : color}
                emissiveIntensity={isCompleted ? 0.8 : isLocked ? 0 : 0.9}
              />
            </mesh>
            {/* Lock symbol for locked arenas */}
            {isLocked && (
              <mesh position={[0, 5.9, 0]}>
                <boxGeometry args={[0.5, 0.5, 0.2]} />
                <meshLambertMaterial color="#888899" />
              </mesh>
            )}
            {/* Completion ring */}
            {isCompleted && (
              <mesh position={[0, 0.25, 0]} rotation={[0, 0, 0]}>
                <torusGeometry args={[3.8, 0.15, 8, 32]} />
                <meshBasicMaterial color="#4ade80" />
              </mesh>
            )}
            {/* Point light for available arenas */}
            {status === 'available' && (
              <pointLight
                position={[0, 6, 0]}
                color={color}
                intensity={2}
                distance={12}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

/* ── Collectibles ─────────────────────────────────────────────── */
function Collectibles({ collectibles, onClickCollectible }: {
  collectibles: StoryWorldCollectible[];
  onClickCollectible: (c: StoryWorldCollectible) => void;
}) {
  const time = useRef(0);
  const groupRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((_, delta) => {
    time.current += delta;
    groupRefs.current.forEach((g, i) => {
      if (!g) return;
      g.position.y = 1.5 + Math.sin(time.current * 2 + i * 1.2) * 0.25;
      g.rotation.y = time.current * 1.5;
    });
  });

  return (
    <group>
      {collectibles.map((c, i) => {
        const isCoin = c.type === 'coin';
        const color = isCoin ? '#fbbf24' : '#a855f7';
        return (
          <group
            key={c.id}
            ref={el => { groupRefs.current[i] = el; }}
            position={[c.posX, 1.5, c.posZ]}
            onClick={(e) => { e.stopPropagation(); onClickCollectible(c); }}
          >
            <mesh castShadow>
              <sphereGeometry args={[0.5, 8, 8]} />
              <meshLambertMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.6}
              />
            </mesh>
            <pointLight color={color} intensity={1.5} distance={8} />
          </group>
        );
      })}
    </group>
  );
}

/* ── Other Players ────────────────────────────────────────────── */
function OtherPlayerMesh({ player }: { player: OtherPlayer }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(player.x, 0, player.z);
    }
  });
  return (
    <group ref={groupRef}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <capsuleGeometry args={[0.35, 1.2, 4, 8]} />
        <meshLambertMaterial color="#60a5fa" />
      </mesh>
      <mesh position={[0, 2.3, 0]} castShadow>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshLambertMaterial color="#fcd7b0" />
      </mesh>
    </group>
  );
}

function OtherPlayers({ otherPlayersRef, selfUserId }: {
  otherPlayersRef: React.MutableRefObject<Map<number, OtherPlayer>>;
  selfUserId?: number;
}) {
  const [playerList, setPlayerList] = useState<OtherPlayer[]>([]);
  const tickRef = useRef(0);

  useFrame((_, delta) => {
    tickRef.current += delta;
    if (tickRef.current < 0.5) return; // update every 500ms
    tickRef.current = 0;
    const list = Array.from(otherPlayersRef.current.values()).filter(p => p.userId !== selfUserId);
    setPlayerList(list);
  });

  return (
    <group>
      {playerList.map(p => <OtherPlayerMesh key={p.userId} player={p} />)}
    </group>
  );
}

/* ── Player + Camera follow ───────────────────────────────────── */
function PlayerCamera({ playerRef }: {
  playerRef: React.MutableRefObject<{ x: number; z: number }>;
}) {
  const { camera } = useThree();
  const yawRef = useRef(0);
  const isDragging = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const pitchRef = useRef(0.55); // slight top-down angle

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      yawRef.current   -= dx * 0.005;
      pitchRef.current  = Math.max(0.2, Math.min(1.1, pitchRef.current + dy * 0.005));
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { isDragging.current = false; };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - lastMouseRef.current.x;
      const dy = e.touches[0].clientY - lastMouseRef.current.y;
      yawRef.current   -= dx * 0.005;
      pitchRef.current  = Math.max(0.2, Math.min(1.1, pitchRef.current + dy * 0.005));
      lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = () => { isDragging.current = false; };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove,  { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const targetCamPos = useRef(new THREE.Vector3());
  const currentCamPos = useRef(new THREE.Vector3());

  useFrame(() => {
    const px = playerRef.current.x;
    const pz = playerRef.current.z;
    const dist = 18;
    const height = dist * Math.tan(pitchRef.current);

    targetCamPos.current.set(
      px + Math.sin(yawRef.current) * dist,
      height + 2,
      pz + Math.cos(yawRef.current) * dist,
    );

    currentCamPos.current.lerp(targetCamPos.current, 0.1);
    camera.position.copy(currentCamPos.current);
    camera.lookAt(px, 1.5, pz);
  });

  return (
    <>
      {/* Player body */}
      <group position={[playerRef.current.x, 0, playerRef.current.z]}>
        <PlayerMesh playerRef={playerRef} />
      </group>
    </>
  );
}

/* ── Player Mesh (updates each frame) ────────────────────────── */
function PlayerMesh({ playerRef }: { playerRef: React.MutableRefObject<{ x: number; z: number }> }) {
  const groupRef = useRef<THREE.Group>(null);
  const time = useRef(0);
  const prevPos = useRef({ x: playerRef.current.x, z: playerRef.current.z });
  const facingAngle = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    time.current += delta;

    const px = playerRef.current.x;
    const pz = playerRef.current.z;
    groupRef.current.position.set(px, 0, pz);

    const dx = px - prevPos.current.x;
    const dz = pz - prevPos.current.z;
    const moving = Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001;
    if (moving) {
      facingAngle.current = Math.atan2(dx, dz);
    }
    groupRef.current.rotation.y = facingAngle.current;

    prevPos.current = { x: px, z: pz };
  });

  return (
    <group ref={groupRef}>
      {/* Legs (walking bob) */}
      <WalkingLegs timeRef={time} />
      {/* Body */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[0.6, 0.9, 0.35]} />
        <meshLambertMaterial color="#e8b800" />
      </mesh>
      {/* Head */}
      <mesh position={[0, 2.25, 0]} castShadow>
        <sphereGeometry args={[0.3, 10, 10]} />
        <meshLambertMaterial color="#fcd7b0" />
      </mesh>
      {/* Hat */}
      <mesh position={[0, 2.58, 0]}>
        <cylinderGeometry args={[0.22, 0.32, 0.28, 8]} />
        <meshLambertMaterial color="#1a1a2e" />
      </mesh>
      {/* Shadow circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.6, 12]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

/* ── Walking legs ────────────────────────────────────────────── */
function WalkingLegs({ timeRef }: { timeRef: React.MutableRefObject<number> }) {
  const leftRef  = useRef<THREE.Mesh>(null);
  const rightRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = timeRef.current * 5;
    if (leftRef.current)  leftRef.current.position.z  = Math.sin(t) * 0.12;
    if (rightRef.current) rightRef.current.position.z = Math.sin(t + Math.PI) * 0.12;
  });
  return (
    <>
      <mesh ref={leftRef}  position={[-0.15, 0.7, 0]} castShadow>
        <boxGeometry args={[0.22, 0.65, 0.22]} />
        <meshLambertMaterial color="#1a237e" />
      </mesh>
      <mesh ref={rightRef} position={[ 0.15, 0.7, 0]} castShadow>
        <boxGeometry args={[0.22, 0.65, 0.22]} />
        <meshLambertMaterial color="#1a237e" />
      </mesh>
    </>
  );
}

/* ── Lighting + Day/Night ────────────────────────────────────── */
function Lighting({ dayTime }: { dayTime: number }) {
  const sunRef = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    if (!sunRef.current) return;
    const t = dayTime * Math.PI * 2;
    sunRef.current.position.set(
      Math.sin(t) * 100,
      Math.max(5, Math.cos(t) * 80 + 20),
      Math.cos(t) * 60,
    );
    const brightness = Math.max(0, Math.sin(t));
    sunRef.current.intensity = 0.4 + brightness * 1.2;
  });

  const isDark = dayTime > 0.75 || dayTime < 0.2;
  const ambientIntensity = isDark ? 0.12 : 0.35;

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={isDark ? '#2233aa' : '#ffffff'} />
      <directionalLight
        ref={sunRef}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={300}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        color={isDark ? '#aabbff' : '#fff8e0'}
        intensity={isDark ? 0.1 : 1.5}
      />
      {/* Hemisphere sky light */}
      <hemisphereLight
        color={isDark ? '#1a2a6a' : '#87ceeb'}
        groundColor="#2d5a1a"
        intensity={isDark ? 0.15 : 0.4}
      />
    </>
  );
}

/* ── Sky / atmosphere ─────────────────────────────────────────── */
function Sky({ dayTime }: { dayTime: number }) {
  const isDark = dayTime > 0.75 || dayTime < 0.2;
  return isDark ? <Stars radius={200} depth={60} count={2000} factor={4} fade /> : null;
}

/* ── Fog controller ───────────────────────────────────────────── */
function FogController({ dayTime }: { dayTime: number }) {
  const { scene } = useThree();
  const isDark = dayTime > 0.75 || dayTime < 0.2;
  useEffect(() => {
    scene.fog = new THREE.Fog(isDark ? '#050a1a' : '#b8d8f0', 60, 220);
    scene.background = new THREE.Color(isDark ? '#050a1a' : '#87ceeb');
    return () => { scene.fog = null; };
  }, [scene, isDark]);
  return null;
}

/* ── Football field marker ────────────────────────────────────── */
function FootballField() {
  return (
    <group position={[-45, 0.02, -145]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 12]} />
        <meshLambertMaterial color="#1e7a1e" />
      </mesh>
      {/* Field lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[17.5, 11.5]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.08} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.4, 2.6, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

/* ── Arcade building emissive sign ─────────────────────────────── */
function ArcadeSigns() {
  const ARCADE_BUILDINGS = [
    { x:  22, z: 160, color: '#a855f7', name: '🎡' },
    { x: -58, z:  85, color: '#818cf8', name: '🃏' },
    { x: 125, z: -12, color: '#f97316', name: '🎲' },
    { x:-125, z: -15, color: '#fbbf24', name: '⚡' },
    { x: -45, z:-100, color: '#06b6d4', name: '❓' },
    { x:  55, z:-130, color: '#ec4899', name: '✂️' },
  ];
  const time = useRef(0);
  const refs = useRef<(THREE.PointLight | null)[]>([]);
  useFrame((_, delta) => {
    time.current += delta;
    refs.current.forEach((l, i) => {
      if (l) l.intensity = 1.5 + Math.sin(time.current * 2 + i) * 0.8;
    });
  });
  return (
    <group>
      {ARCADE_BUILDINGS.map((a, i) => (
        <pointLight
          key={i}
          ref={el => { refs.current[i] = el; }}
          position={[a.x, 5, a.z]}
          color={a.color}
          intensity={1.5}
          distance={18}
        />
      ))}
    </group>
  );
}

/* ── Scene content ─────────────────────────────────────────────── */
function SceneContent({
  playerRef, otherPlayersRef, leaders, arenaPositions, getLeaderStatus,
  visibleCollectibles, buildingData, treeData, roadData = [], onChallengeLeader,
  onClickCollectible, dayTime = 0.45,
}: StoryWorld3DProps) {
  return (
    <>
      <FogController dayTime={dayTime} />
      <Sky dayTime={dayTime} />
      <Lighting dayTime={dayTime} />
      <Terrain />
      <Roads roads={roadData} />
      <Buildings buildings={buildingData} />
      <Trees trees={treeData} />
      <FootballField />
      <Arenas
        arenaPositions={arenaPositions}
        leaders={leaders}
        getLeaderStatus={getLeaderStatus}
        onChallengeLeader={onChallengeLeader}
      />
      <Collectibles
        collectibles={visibleCollectibles}
        onClickCollectible={onClickCollectible}
      />
      <OtherPlayers otherPlayersRef={otherPlayersRef} />
      <PlayerCamera playerRef={playerRef} />
      <ArcadeSigns />
    </>
  );
}

/* ── Main export ───────────────────────────────────────────────── */
export function StoryWorld3D(props: StoryWorld3DProps) {
  const [dayTime] = useState(() => {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    return h / 24;
  });

  return (
    <Canvas
      style={{ position: 'absolute', inset: 0 }}
      dpr={[1, 1.5]}
      shadows
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 18, 30], fov: 55, near: 0.5, far: 500 }}
    >
      <SceneContent {...props} dayTime={dayTime} />
    </Canvas>
  );
}
