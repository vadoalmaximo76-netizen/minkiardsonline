/**
 * World3DScene — Scene graph that lives inside the R3F Canvas.
 *
 * Extracted from StoryWorld3D.tsx so the scene can be imported, tested,
 * and composed independently from the Canvas/renderer setup.
 */

import React, { useRef } from 'react';
import { useFrame }       from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import * as THREE from 'three';

import { Terrain3D, Roads3D }              from './Terrain3D';
import { Buildings3D }                     from './Buildings3D';
import { Trees3D }                         from './Trees3D';
import { Arenas3D }                        from './Arenas3D';
import { Collectibles3D }                  from './Collectibles3D';
import { OtherPlayers3D }                  from './OtherPlayers3D';
import { PlayerMesh3D, PlayerCamera3D }    from './Player3D';
import { DayNight3D, NightStars3D }        from './DayNight3D';
import type { StoryWorld3DProps }          from './types';

/* ── Football field marker ────────────────────────────────────────── */
function FootballField3D() {
  return (
    <group position={[-45, 0.05, -145]}>
      {/* Pitch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 12]} />
        <meshLambertMaterial color="#1e7a1e" />
      </mesh>
      {/* Centre circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.4, 2.6, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>
      {/* Goal posts left */}
      <mesh position={[-9.2, 1.2, 0]}>
        <boxGeometry args={[0.2, 2.4, 5.6]} />
        <meshLambertMaterial color="#dddddd" wireframe />
      </mesh>
      {/* Goal posts right */}
      <mesh position={[9.2, 1.2, 0]}>
        <boxGeometry args={[0.2, 2.4, 5.6]} />
        <meshLambertMaterial color="#dddddd" wireframe />
      </mesh>
    </group>
  );
}

/* ── Pulsing arcade point lights ──────────────────────────────────── */
const ARCADE_LIGHTS_CFG = [
  { x:  22, z:  160, color: '#a855f7' },
  { x: -58, z:   85, color: '#818cf8' },
  { x: 125, z:  -12, color: '#f97316' },
  { x:-125, z:  -15, color: '#fbbf24' },
  { x: -45, z: -100, color: '#06b6d4' },
  { x:  55, z: -130, color: '#ec4899' },
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
          ref={(el: THREE.PointLight | null) => { refs.current[i] = el; }}
          position={[a.x, 5, a.z]}
          color={a.color}
          intensity={1.5}
          distance={18}
        />
      ))}
    </group>
  );
}

/* ── Main scene graph ─────────────────────────────────────────────── */
export function World3DScene(props: StoryWorld3DProps) {
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
        playerRef={props.playerRef}
        onClickCollectible={props.onClickCollectible}
      />
      <OtherPlayers3D
        otherPlayersRef={props.otherPlayersRef}
        selfUserId={props.selfUserId}
      />

      {/* Local player — absolute world position, no transform-bearing parent */}
      <PlayerMesh3D playerRef={props.playerRef} />
      <PlayerCamera3D
        playerRef={props.playerRef}
        cameraYawRef={props.cameraYawRef}
        mobileCamRotateRef={props.mobileCamRotateRef}
      />

      {/* Post-processing */}
      <EffectComposer>
        <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={0.4} />
        <ToneMapping />
      </EffectComposer>
    </>
  );
}
