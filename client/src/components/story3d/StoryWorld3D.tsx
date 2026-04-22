/**
 * StoryWorld3D — React Three Fiber entry point for the 3D open-world map.
 *
 * Architecture:
 *   StoryWorldMap (parent) ──► StoryWorld3D (Canvas)
 *                                 └── World3DScene (scene graph)
 *                                       ├── DayNight3D   (lighting + sky)
 *                                       ├── Terrain3D    (heightmap + biome colours)
 *                                       ├── Roads3D      (asphalt strips)
 *                                       ├── Buildings3D  (instanced city blocks)
 *                                       ├── Trees3D      (instanced foliage)
 *                                       ├── Arenas3D     (gym leader portals)
 *                                       ├── Collectibles3D (coins & cards)
 *                                       ├── OtherPlayers3D (online avatars)
 *                                       ├── PlayerMesh3D   (local character)
 *                                       ├── PlayerCamera3D (third-person follow)
 *                                       ├── FootballField3D
 *                                       ├── ArcadeLights3D
 *                                       └── EffectComposer (Bloom + ToneMapping)
 *
 * The game-loop logic (WASD movement, collision, socket, proximity detection)
 * lives entirely in StoryWorldMap.tsx via requestAnimationFrame. StoryWorld3D
 * reads the shared `playerRef` every Three.js frame — no duplicate loop.
 */

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import * as THREE from 'three';

import { Terrain3D, Roads3D }    from './Terrain3D';
import { Buildings3D }           from './Buildings3D';
import { Trees3D }               from './Trees3D';
import { Arenas3D }              from './Arenas3D';
import { Collectibles3D }        from './Collectibles3D';
import { OtherPlayers3D }        from './OtherPlayers3D';
import { PlayerMesh3D, PlayerCamera3D } from './Player3D';
import { DayNight3D, NightStars3D }    from './DayNight3D';

export type {
  StoryWorldBuildingDatum,
  StoryWorldTreeDatum,
  StoryWorldRoadDatum,
  StoryWorldCollectible,
  StoryWorld3DProps,
} from './types';

import type { StoryWorld3DProps } from './types';

/* ── Football field marker ────────────────────────────────────── */
function FootballField3D() {
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

/* ── Pulsing arcade point lights ──────────────────────────────── */
const ARCADE_LIGHTS_CFG = [
  { x:  22, z: 160, color: '#a855f7' },
  { x: -58, z:  85, color: '#818cf8' },
  { x: 125, z: -12, color: '#f97316' },
  { x:-125, z: -15, color: '#fbbf24' },
  { x: -45, z:-100, color: '#06b6d4' },
  { x:  55, z:-130, color: '#ec4899' },
];

function ArcadeLights3D() {
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
      {ARCADE_LIGHTS_CFG.map((a, i) => (
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

/* ── Scene graph ──────────────────────────────────────────────── */
function World3DScene(props: StoryWorld3DProps) {
  /* shared clock ref — starts at real-world time, advances each frame */
  const dayTimeRef = useRef<number>(
    (() => {
      const h = new Date().getHours() + new Date().getMinutes() / 60;
      return h / 24;
    })()
  );

  const { roadData = [] } = props;

  return (
    <>
      <DayNight3D dayTimeRef={dayTimeRef} />
      <NightStars3D dayTimeRef={dayTimeRef} />

      <Terrain3D />
      <Roads3D roads={roadData} />
      <Buildings3D buildings={props.buildingData} />
      <Trees3D trees={props.treeData} />
      <FootballField3D />
      <ArcadeLights3D />

      <Arenas3D
        arenaPositions={props.arenaPositions}
        leaders={props.leaders}
        getLeaderStatus={props.getLeaderStatus}
        onChallengeLeader={props.onChallengeLeader}
      />
      <Collectibles3D
        collectibles={props.visibleCollectibles}
        onClickCollectible={props.onClickCollectible}
      />
      <OtherPlayers3D otherPlayersRef={props.otherPlayersRef} />

      {/* Local player — rendered at root scene level, no parent transform */}
      <PlayerMesh3D playerRef={props.playerRef} />
      <PlayerCamera3D playerRef={props.playerRef} />

      {/* Post-processing */}
      <EffectComposer>
        <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={0.4} />
        <ToneMapping />
      </EffectComposer>
    </>
  );
}

/* ── Canvas entry point ───────────────────────────────────────── */
export function StoryWorld3D(props: StoryWorld3DProps) {
  return (
    <Canvas
      style={{ position: 'absolute', inset: 0 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 18, 30], fov: 55, near: 0.5, far: 500 }}
    >
      <World3DScene {...props} />
    </Canvas>
  );
}
