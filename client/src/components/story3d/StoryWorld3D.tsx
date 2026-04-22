import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture, Stars, Text } from '@react-three/drei';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { GymLeader } from '../../types/gym';

/* ── Building config ─────────────────────────────────────────── */
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

/* ── Types ───────────────────────────────────────────────────── */
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
}

/* ── Day/Night animated controller ───────────────────────────── */
function DayNightSystem({
  dayTimeRef,
}: {
  dayTimeRef: React.MutableRefObject<number>;
}) {
  const { scene } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const starsVisible = useRef(false);

  useEffect(() => {
    scene.fog = new THREE.Fog('#b8d8f0', 60, 220);
    scene.background = new THREE.Color('#87ceeb');
    return () => { scene.fog = null; };
  }, [scene]);

  useFrame((_, delta) => {
    /* advance 8-minute day cycle */
    dayTimeRef.current = (dayTimeRef.current + delta / 480) % 1;
    const t = dayTimeRef.current * Math.PI * 2;
    const sinT = Math.sin(t);
    const brightness = Math.max(0, sinT);
    const isDark = dayTimeRef.current > 0.75 || dayTimeRef.current < 0.2;

    if (sunRef.current) {
      sunRef.current.position.set(
        Math.sin(t) * 100,
        Math.max(5, Math.cos(t) * 80 + 20),
        Math.cos(t) * 60,
      );
      sunRef.current.intensity = isDark ? 0.08 : 0.4 + brightness * 1.2;
      (sunRef.current.color as THREE.Color).set(isDark ? '#aabbff' : '#fff8e0');
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = isDark ? 0.12 : 0.35;
      (ambientRef.current.color as THREE.Color).set(isDark ? '#2233aa' : '#ffffff');
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = isDark ? 0.15 : 0.4;
    }
    if (scene.fog instanceof THREE.Fog) {
      (scene.fog.color as THREE.Color).set(isDark ? '#050a1a' : '#b8d8f0');
    }
    if (scene.background instanceof THREE.Color) {
      (scene.background as THREE.Color).set(isDark ? '#050a1a' : '#87ceeb');
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.35} color="#ffffff" />
      <directionalLight
        ref={sunRef}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={300}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        intensity={1.5}
        color="#fff8e0"
        position={[80, 80, 60]}
      />
      <hemisphereLight
        ref={hemiRef}
        color="#87ceeb"
        groundColor="#2d5a1a"
        intensity={0.4}
      />
    </>
  );
}

/* ── Terrain (subtle height variation via vertex shader) ─────── */
function Terrain() {
  const grassTex = useTexture('/textures/grass.png');
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(500, 500, 64, 64);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      /* gentle hills (max ±1.5 units) — game logic stays on y=0 */
      const h =
        Math.sin(x * 0.015) * Math.cos(z * 0.02) * 1.2 +
        Math.sin(x * 0.04 + 1.3) * Math.sin(z * 0.035) * 0.5;
      /* flatten area near origin (player spawn zone 0..±30) */
      const flatBlend = Math.max(0, 1 - Math.sqrt(x * x + z * z) / 30);
      pos.setY(i, h * (1 - flatBlend));
    }
    g.computeVertexNormals();
    /* vertex colors for biome blending */
    const colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const r = 0.18 + y * 0.03;
      const gv = 0.45 + Math.max(0, y) * 0.05;
      const b = 0.12;
      colors.push(r, gv, b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }, []);

  useMemo(() => {
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(40, 40);
  }, [grassTex]);

  return (
    <mesh geometry={geo} receiveShadow>
      <meshLambertMaterial map={grassTex} vertexColors />
    </mesh>
  );
}

/* ── Roads ───────────────────────────────────────────────────── */
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
          <mesh key={i} rotation={[-Math.PI / 2, 0, angle]} position={[cx, 0.05, cz]}>
            <planeGeometry args={[r.w, len]} />
            <meshLambertMaterial map={asphaltTex} color="#666688" />
          </mesh>
        );
      })}
    </group>
  );
}

/* ── Buildings ───────────────────────────────────────────────── */
function Buildings({ buildings }: { buildings: StoryWorldBuildingDatum[] }) {
  return (
    <group>
      {buildings.map((b, i) => {
        const bh = BUILDING_BODY_HEIGHT[b.type];
        const bodyColor = BUILDING_BODY_COLOR[b.type];
        const roofColor = BUILDING_ROOF_COLOR[b.type];
        const bw = b.w;
        const bd = b.h;
        const isRuin = b.type === 'ruin';

        return (
          <group key={i} position={[b.x, 0, b.z]}>
            <mesh position={[0, bh / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[bw, bh, bd]} />
              <meshLambertMaterial color={bodyColor} />
            </mesh>
            {!isRuin && (
              <mesh position={[0, bh + 0.8, 0]} castShadow>
                <coneGeometry args={[Math.max(bw, bd) * 0.72, 1.6, 4]} />
                <meshLambertMaterial color={roofColor} />
              </mesh>
            )}
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
            {b.type === 'tower' && (
              <mesh position={[0, bh + 0.3, 0]}>
                <boxGeometry args={[bw + 0.2, 0.6, bd + 0.2]} />
                <meshLambertMaterial color="#555555" />
              </mesh>
            )}
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

/* ── Trees (InstancedMesh) ───────────────────────────────────── */
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

/* ── Arenas ──────────────────────────────────────────────────── */
function Arenas({ arenaPositions, leaders, getLeaderStatus, onChallengeLeader }: {
  arenaPositions: [number, number][];
  leaders: GymLeader[];
  getLeaderStatus: (l: GymLeader) => 'completed' | 'available' | 'locked';
  onChallengeLeader: (l: GymLeader) => void;
}) {
  const time = useRef(0);
  const gemRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((_, delta) => {
    time.current += delta;
    gemRefs.current.forEach((g, i) => {
      if (!g) return;
      const leader = leaders[i];
      if (!leader) return;
      const status = getLeaderStatus(leader);
      if (status === 'available') {
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
        const status = getLeaderStatus(leader);
        const color = ARENA_COLORS[i % ARENA_COLORS.length];
        const isLocked = status === 'locked';
        const isCompleted = status === 'completed';
        const leaderName = leader.name ?? `Leader ${i + 1}`;

        return (
          <group
            key={leader.id}
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
                color={isLocked ? '#224466' : color}
                emissive={isCompleted ? '#ffffff' : isLocked ? '#000000' : color}
                emissiveIntensity={isCompleted ? 0.3 : isLocked ? 0 : 0.4}
              />
            </mesh>
            {/* Top gem — animated when available */}
            <group ref={el => { gemRefs.current[i] = el; }} position={[0, 4.9, 0]}>
              <mesh castShadow>
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
            {/* Leader name billboard */}
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
            {/* Stage number */}
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
            {/* Point light for available arenas */}
            {status === 'available' && (
              <pointLight position={[0, 6, 0]} color={color} intensity={2.5} distance={14} />
            )}
          </group>
        );
      })}
    </group>
  );
}

/* ── Collectibles (coin & card geometries) ───────────────────── */
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
      g.rotation.y = time.current * 1.8;
    });
  });

  return (
    <group>
      {collectibles.map((c, i) => {
        const isCoin = c.type === 'coin' || (c.creditValue && c.creditValue > 0);
        const color = isCoin ? '#fbbf24' : '#a855f7';
        const label = isCoin ? `+${c.creditValue ?? '?'}` : '🃏';

        return (
          <group
            key={c.id}
            ref={el => { groupRefs.current[i] = el; }}
            position={[c.posX, 1.5, c.posZ]}
            onClick={(e) => { e.stopPropagation(); onClickCollectible(c); }}
          >
            {isCoin ? (
              /* Coin: thin glowing disk */
              <mesh castShadow>
                <cylinderGeometry args={[0.45, 0.45, 0.12, 16]} />
                <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.8} />
              </mesh>
            ) : (
              /* Card: thin rectangle */
              <mesh castShadow>
                <boxGeometry args={[0.5, 0.72, 0.04]} />
                <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.7} />
              </mesh>
            )}
            <pointLight color={color} intensity={2} distance={8} />
            <Text
              position={[0, 0.9, 0]}
              fontSize={0.4}
              color={color}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.05}
              outlineColor="#000000"
            >
              {label}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

/* ── Other Players with name labels ──────────────────────────── */
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
      <Text
        position={[0, 3.1, 0]}
        fontSize={0.45}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {player.username}
      </Text>
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
    if (tickRef.current < 0.5) return;
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

/* ── Player mesh (absolute world position via useFrame) ──────── */
function PlayerMesh({ playerRef }: { playerRef: React.MutableRefObject<{ x: number; z: number }> }) {
  const groupRef   = useRef<THREE.Group>(null);
  const time       = useRef(0);
  const prevPos    = useRef({ x: playerRef.current.x, z: playerRef.current.z });
  const facingAngle = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    time.current += delta;

    const px = playerRef.current.x;
    const pz = playerRef.current.z;

    /* Set ABSOLUTE world position — group has no parent transform */
    groupRef.current.position.set(px, 0, pz);

    const dx = px - prevPos.current.x;
    const dz = pz - prevPos.current.z;
    if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
      facingAngle.current = Math.atan2(dx, dz);
    }
    groupRef.current.rotation.y = facingAngle.current;
    prevPos.current = { x: px, z: pz };
  });

  return (
    /* NO parent <group position=...> — position set each frame above */
    <group ref={groupRef}>
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

/* ── Camera (no parent group wrapping player) ────────────────── */
function PlayerCamera({ playerRef }: {
  playerRef: React.MutableRefObject<{ x: number; z: number }>;
}) {
  const { camera } = useThree();
  const yawRef   = useRef(0);
  const pitchRef = useRef(0.55);
  const isDragging   = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

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

  const targetCamPos  = useRef(new THREE.Vector3());
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

  return null;
}

/* ── Football field ──────────────────────────────────────────── */
function FootballField() {
  return (
    <group position={[-45, 0.05, -145]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 12]} />
        <meshLambertMaterial color="#1e7a1e" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.4, 2.6, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

/* ── Arcade sign point lights ────────────────────────────────── */
const ARCADE_LIGHTS = [
  { x:  22, z: 160, color: '#a855f7' },
  { x: -58, z:  85, color: '#818cf8' },
  { x: 125, z: -12, color: '#f97316' },
  { x:-125, z: -15, color: '#fbbf24' },
  { x: -45, z:-100, color: '#06b6d4' },
  { x:  55, z:-130, color: '#ec4899' },
];

function ArcadeSigns() {
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
      {ARCADE_LIGHTS.map((a, i) => (
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

/* ── Stars that appear at night ──────────────────────────────── */
function NightStars({ dayTimeRef }: { dayTimeRef: React.MutableRefObject<number> }) {
  /* update opacity via the Three.js scene graph rather than React state */
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const isDark = dayTimeRef.current > 0.75 || dayTimeRef.current < 0.2;
    groupRef.current.visible = isDark;
  });
  return (
    <group ref={groupRef}>
      <Stars radius={200} depth={60} count={2000} factor={4} fade />
    </group>
  );
}

/* ── Scene content ───────────────────────────────────────────── */
function SceneContent({
  playerRef, otherPlayersRef, leaders, arenaPositions, getLeaderStatus,
  visibleCollectibles, buildingData, treeData, roadData = [],
  onChallengeLeader, onClickCollectible,
}: StoryWorld3DProps) {
  /* shared animated day-time ref — starts at real clock, advances live */
  const dayTimeRef = useRef<number>(
    (() => {
      const h = new Date().getHours() + new Date().getMinutes() / 60;
      return h / 24;
    })()
  );

  return (
    <>
      <DayNightSystem dayTimeRef={dayTimeRef} />
      <NightStars dayTimeRef={dayTimeRef} />
      <Terrain />
      {roadData.length > 0 && <Roads roads={roadData} />}
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
      {/* PlayerMesh at root level — no parent transform wrapper */}
      <PlayerMesh playerRef={playerRef} />
      <PlayerCamera playerRef={playerRef} />
      <ArcadeSigns />
      {/* Postprocessing */}
      <EffectComposer>
        <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={0.4} />
        <ToneMapping />
      </EffectComposer>
    </>
  );
}

/* ── Main export ─────────────────────────────────────────────── */
export function StoryWorld3D(props: StoryWorld3DProps) {
  return (
    <Canvas
      style={{ position: 'absolute', inset: 0 }}
      dpr={[1, 1.5]}
      shadows
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 18, 30], fov: 55, near: 0.5, far: 500 }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
