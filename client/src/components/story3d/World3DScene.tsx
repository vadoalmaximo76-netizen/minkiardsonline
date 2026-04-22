/**
 * World3DScene — Scene graph that lives inside the R3F Canvas.
 *
 * Extracted from StoryWorld3D.tsx so the scene can be imported, tested,
 * and composed independently from the Canvas/renderer setup.
 */

import React, { useRef } from 'react';
import { useFrame }       from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { Terrain3D, Roads3D }              from './Terrain3D';
import { Buildings3D }                     from './Buildings3D';
import { Trees3D }                         from './Trees3D';
import { Arenas3D }                        from './Arenas3D';
import { Collectibles3D }                  from './Collectibles3D';
import { OtherPlayers3D }                  from './OtherPlayers3D';
import { PlayerMesh3D, PlayerCamera3D }    from './Player3D';
import { DayNight3D, NightStars3D, RainEffect3D } from './DayNight3D';
import { WorldAudio3D }                    from './WorldAudio3D';
import type { StoryWorld3DProps }          from './types';

/* ── Animated water plane for the lake zone ───────────────────── */
function WaterPlane3D() {
  const meshRef   = useRef<THREE.Mesh>(null);
  const matRef    = useRef<THREE.MeshStandardMaterial>(null);
  const timeRef   = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    if (meshRef.current) {
      /* Gentle vertical bob */
      meshRef.current.position.y = 0.32 + Math.sin(t * 0.7) * 0.05;
    }
    if (matRef.current) {
      /* Shimmer: roughness + opacity pulse */
      matRef.current.roughness = 0.08 + Math.sin(t * 1.3) * 0.06;
      matRef.current.opacity   = 0.76 + Math.sin(t * 0.9 + 1.2) * 0.06;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[-80, 0.32, 60]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[48, 48, 10, 10]} />
      <meshStandardMaterial
        ref={matRef}
        color="#1a6ab8"
        transparent
        opacity={0.78}
        roughness={0.08}
        metalness={0.55}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ── Football field ───────────────────────────────────────────── */
function FootballField3D() {
  return (
    <group position={[-45, 0.06, -145]}>
      {/* Pitch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial color="#1e7a1e" roughness={0.92} metalness={0.0} />
      </mesh>
      {/* Centre circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.4, 2.6, 36]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
      </mesh>
      {/* Halfway line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[0.12, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
      </mesh>
      {/* Goal posts left */}
      <mesh position={[-9.2, 1.2, 0]}>
        <boxGeometry args={[0.18, 2.4, 5.6]} />
        <meshStandardMaterial color="#dddddd" roughness={0.5} metalness={0.4} wireframe />
      </mesh>
      {/* Goal posts right */}
      <mesh position={[9.2, 1.2, 0]}>
        <boxGeometry args={[0.18, 2.4, 5.6]} />
        <meshStandardMaterial color="#dddddd" roughness={0.5} metalness={0.4} wireframe />
      </mesh>
    </group>
  );
}

/* ── Pulsing arcade point lights ──────────────────────────────── */
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
      if (l) l.intensity = 1.8 + Math.sin(time.current * 2.2 + i) * 1.0;
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
          intensity={1.8}
          distance={20}
        />
      ))}
    </group>
  );
}

/* ── Main scene graph ─────────────────────────────────────────── */
export function World3DScene(props: StoryWorld3DProps) {
  const dayTimeRef = useRef<number>(
    (() => {
      const h = new Date().getHours() + new Date().getMinutes() / 60;
      return h / 24;
    })()
  );

  const weatherIntensityRef = useRef<number>(0);

  const { roadData = [] } = props;

  return (
    <>
      <DayNight3D dayTimeRef={dayTimeRef} />
      <NightStars3D dayTimeRef={dayTimeRef} />
      <RainEffect3D intensityRef={weatherIntensityRef} />

      <WorldAudio3D
        dayTimeRef={dayTimeRef}
        playerRef={props.playerRef}
        arenaPositions={props.arenaPositions ?? []}
        weatherIntensityRef={weatherIntensityRef}
      />

      <Terrain3D />
      <Roads3D roads={roadData} />
      <WaterPlane3D />
      <Buildings3D buildings={props.buildingData} playerRef={props.playerRef} dayTimeRef={dayTimeRef} />
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

      {/* Local player */}
      <PlayerMesh3D playerRef={props.playerRef} />
      <PlayerCamera3D
        playerRef={props.playerRef}
        cameraYawRef={props.cameraYawRef}
        mobileCamRotateRef={props.mobileCamRotateRef}
      />

      {/* Post-processing — PS2-style cinematic */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.55}
          luminanceSmoothing={0.85}
          intensity={0.75}
        />
        <Vignette
          offset={0.28}
          darkness={0.52}
          eskil={false}
        />
        <ToneMapping />
      </EffectComposer>
    </>
  );
}
