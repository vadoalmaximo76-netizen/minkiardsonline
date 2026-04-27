import React, { useRef } from 'react';
import { useFrame }      from '@react-three/fiber';
import * as THREE        from 'three';
import type { GhostFig, WizardFig, DarkFig } from './types';
import { getGroundY } from './terrainHeight';

/* ── Ghost ambush figures ────────────────────────────────────────── */
const GHOST_COUNT = 4;

function GhostFigures3D({
  ghostFigsRef,
}: {
  ghostFigsRef: React.MutableRefObject<GhostFig[]>;
}) {
  const groupRefs = useRef<(THREE.Group | null)[]>(Array(GHOST_COUNT).fill(null));
  const timeRef   = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const ghosts = ghostFigsRef.current;

    for (let i = 0; i < GHOST_COUNT; i++) {
      const grp = groupRefs.current[i];
      if (!grp) continue;
      const ghost = ghosts.find(g => g.id === i);
      if (!ghost) {
        grp.visible = false;
        continue;
      }
      grp.visible = true;
      /* Hover-bob animation (each ghost offset so they don't sync) */
      grp.position.set(ghost.x, getGroundY(ghost.x, ghost.z) + Math.sin(timeRef.current * 2.8 + i * 1.6) * 0.22, ghost.z);
      /* Slow rotate */
      grp.rotation.y = timeRef.current * 0.5 + i * Math.PI * 0.5;
    }
  });

  return (
    <group>
      {Array.from({ length: GHOST_COUNT }, (_, i) => (
        <group
          key={i}
          ref={(el: THREE.Group | null) => { groupRefs.current[i] = el; }}
          visible={false}
        >
          {/* Shadowy body */}
          <mesh position={[0, 1.15, 0]}>
            <capsuleGeometry args={[0.30, 1.05, 4, 8]} />
            <meshStandardMaterial
              color="#0d000e"
              roughness={0.95}
              transparent
              opacity={0.88}
            />
          </mesh>

          {/* Head */}
          <mesh position={[0, 2.22, 0]}>
            <sphereGeometry args={[0.26, 10, 8]} />
            <meshStandardMaterial
              color="#150011"
              roughness={0.90}
              transparent
              opacity={0.92}
            />
          </mesh>

          {/* Left glowing red eye */}
          <mesh position={[-0.10, 2.27, -0.20]}>
            <sphereGeometry args={[0.052, 6, 5]} />
            <meshStandardMaterial
              color="#ff1100"
              emissive="#cc0000"
              emissiveIntensity={4.0}
              roughness={0.05}
            />
          </mesh>

          {/* Right glowing red eye */}
          <mesh position={[0.10, 2.27, -0.20]}>
            <sphereGeometry args={[0.052, 6, 5]} />
            <meshStandardMaterial
              color="#ff1100"
              emissive="#cc0000"
              emissiveIntensity={4.0}
              roughness={0.05}
            />
          </mesh>

          {/* Left floaty arm */}
          <mesh position={[-0.44, 1.52, 0]} rotation={[0, 0, 0.45]}>
            <capsuleGeometry args={[0.075, 0.52, 4, 6]} />
            <meshStandardMaterial
              color="#1a0020"
              roughness={0.97}
              transparent
              opacity={0.80}
            />
          </mesh>

          {/* Right floaty arm */}
          <mesh position={[0.44, 1.52, 0]} rotation={[0, 0, -0.45]}>
            <capsuleGeometry args={[0.075, 0.52, 4, 6]} />
            <meshStandardMaterial
              color="#1a0020"
              roughness={0.97}
              transparent
              opacity={0.80}
            />
          </mesh>

          {/* Dark aura ring at feet */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.95, 0]}>
            <ringGeometry args={[0.28, 0.56, 16]} />
            <meshBasicMaterial
              color="#660020"
              transparent
              opacity={0.55}
              depthWrite={false}
            />
          </mesh>

          {/* Outer aura halo */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.92, 0]}>
            <ringGeometry args={[0.56, 0.85, 16]} />
            <meshBasicMaterial
              color="#330011"
              transparent
              opacity={0.30}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ── Wizard reward NPC ───────────────────────────────────────────── */
function WizardFigure3D({
  wizardFigRef,
}: {
  wizardFigRef: React.MutableRefObject<WizardFig | null>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef  = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (!groupRef.current) return;
    const wiz = wizardFigRef.current;
    if (!wiz) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;
    /* Gentle vertical bob + face player direction */
    groupRef.current.position.set(wiz.x, getGroundY(wiz.x, wiz.z) + Math.sin(timeRef.current * 1.5) * 0.06, wiz.z);
    /* Slowly rotate toward the interaction area */
    groupRef.current.rotation.y = timeRef.current * 0.25;
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Long robe — purple capsule */}
      <mesh position={[0, 1.10, 0]}>
        <capsuleGeometry args={[0.30, 1.38, 4, 10]} />
        <meshStandardMaterial color="#5a1e8c" roughness={0.78} />
      </mesh>

      {/* Robe star decorations */}
      <mesh position={[0, 1.75, -0.31]}>
        <sphereGeometry args={[0.026, 5, 4]} />
        <meshBasicMaterial color="#ffd700" />
      </mesh>
      <mesh position={[-0.20, 1.40, -0.27]}>
        <sphereGeometry args={[0.019, 5, 4]} />
        <meshBasicMaterial color="#ffd700" />
      </mesh>
      <mesh position={[0.18, 1.55, -0.29]}>
        <sphereGeometry args={[0.022, 5, 4]} />
        <meshBasicMaterial color="#ffd700" />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 2.08, 0]}>
        <capsuleGeometry args={[0.088, 0.15, 4, 6]} />
        <meshStandardMaterial color="#f5c99a" roughness={0.80} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 2.34, 0]}>
        <sphereGeometry args={[0.26, 12, 10]} />
        <meshStandardMaterial color="#f5c99a" roughness={0.72} />
      </mesh>

      {/* Glowing eyes (wise yellow-white) */}
      <mesh position={[-0.10, 2.39, -0.22]}>
        <sphereGeometry args={[0.044, 6, 5]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffaa"
          emissiveIntensity={1.2}
          roughness={0.15}
        />
      </mesh>
      <mesh position={[0.10, 2.39, -0.22]}>
        <sphereGeometry args={[0.044, 6, 5]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffaa"
          emissiveIntensity={1.2}
          roughness={0.15}
        />
      </mesh>

      {/* Long white beard */}
      <mesh position={[0, 2.08, -0.22]} rotation={[0.18, 0, 0]}>
        <capsuleGeometry args={[0.088, 0.58, 4, 6]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.95} />
      </mesh>

      {/* Pointed hat brim */}
      <mesh position={[0, 2.65, 0]}>
        <cylinderGeometry args={[0.50, 0.50, 0.062, 14]} />
        <meshStandardMaterial color="#3a0080" roughness={0.80} metalness={0.08} />
      </mesh>

      {/* Pointed hat cone body */}
      <mesh position={[0, 3.12, 0]}>
        <coneGeometry args={[0.28, 0.95, 12]} />
        <meshStandardMaterial color="#3a0080" roughness={0.80} metalness={0.08} />
      </mesh>

      {/* Hat star at tip */}
      <mesh position={[0, 3.60, 0]}>
        <sphereGeometry args={[0.055, 6, 5]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#ffaa00"
          emissiveIntensity={3.0}
          roughness={0.08}
        />
      </mesh>

      {/* Staff rod */}
      <mesh position={[0.55, 0.95, 0]} rotation={[0, 0, -0.12]}>
        <cylinderGeometry args={[0.032, 0.042, 2.85, 6]} />
        <meshStandardMaterial color="#6b3a1f" roughness={0.88} metalness={0.05} />
      </mesh>

      {/* Staff crystal orb */}
      <mesh position={[0.64, 2.45, 0]}>
        <sphereGeometry args={[0.115, 8, 7]} />
        <meshStandardMaterial
          color="#9b59ff"
          emissive="#7a00ff"
          emissiveIntensity={3.5}
          transparent
          opacity={0.88}
          roughness={0.04}
        />
      </mesh>

      {/* Aura ring at feet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.30, 0.62, 16]} />
        <meshBasicMaterial
          color="#9b59ff"
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>

      {/* Outer mystical aura */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.62, 1.05, 16]} />
        <meshBasicMaterial
          color="#5a00cc"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ── Avenger Borbonico – Dark Figure ─────────────────────────────── */
function DarkFigure3D({
  darkFigRef,
}: {
  darkFigRef: React.MutableRefObject<DarkFig | null>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef  = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (!groupRef.current) return;
    const fig = darkFigRef.current;
    if (!fig) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;
    /* Slow, ominous vertical bob — amplitude larger than ghost, slower than wizard */
    groupRef.current.position.set(fig.x, getGroundY(fig.x, fig.z) + Math.sin(timeRef.current * 1.1) * 0.18, fig.z);
    /* Slowly rotate, always facing menacingly */
    groupRef.current.rotation.y = timeRef.current * 0.35;
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Tall dark cloak body */}
      <mesh position={[0, 1.35, 0]}>
        <capsuleGeometry args={[0.38, 1.60, 4, 10]} />
        <meshStandardMaterial
          color="#050003"
          roughness={0.98}
          transparent
          opacity={0.96}
          emissive="#1a003a"
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* Shoulder cowl — wider, more imposing */}
      <mesh position={[0, 2.18, 0]}>
        <capsuleGeometry args={[0.52, 0.18, 4, 10]} />
        <meshStandardMaterial
          color="#060004"
          roughness={0.97}
          transparent
          opacity={0.94}
          emissive="#1a003a"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Head / hood */}
      <mesh position={[0, 2.62, 0]}>
        <sphereGeometry args={[0.32, 12, 10]} />
        <meshStandardMaterial
          color="#070005"
          roughness={0.96}
          emissive="#200040"
          emissiveIntensity={0.7}
        />
      </mesh>

      {/* Left glowing purple eye */}
      <mesh position={[-0.11, 2.68, -0.26]}>
        <sphereGeometry args={[0.060, 7, 6]} />
        <meshStandardMaterial
          color="#cc00ff"
          emissive="#9900cc"
          emissiveIntensity={8.0}
          roughness={0.02}
        />
      </mesh>

      {/* Right glowing purple eye */}
      <mesh position={[0.11, 2.68, -0.26]}>
        <sphereGeometry args={[0.060, 7, 6]} />
        <meshStandardMaterial
          color="#cc00ff"
          emissive="#9900cc"
          emissiveIntensity={8.0}
          roughness={0.02}
        />
      </mesh>

      {/* Left arm — longer, reaching */}
      <mesh position={[-0.58, 1.65, 0.10]} rotation={[0, 0, 0.55]}>
        <capsuleGeometry args={[0.085, 0.78, 4, 6]} />
        <meshStandardMaterial
          color="#080005"
          roughness={0.98}
          transparent
          opacity={0.90}
        />
      </mesh>

      {/* Right arm */}
      <mesh position={[0.58, 1.65, 0.10]} rotation={[0, 0, -0.55]}>
        <capsuleGeometry args={[0.085, 0.78, 4, 6]} />
        <meshStandardMaterial
          color="#080005"
          roughness={0.98}
          transparent
          opacity={0.90}
        />
      </mesh>

      {/* Cloak hem — base */}
      <mesh position={[0, 0.30, 0]}>
        <cylinderGeometry args={[0.46, 0.60, 0.65, 12]} />
        <meshStandardMaterial
          color="#040002"
          roughness={0.99}
          transparent
          opacity={0.92}
          emissive="#100025"
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* Dark aura ring — inner */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.38, 0.72, 20]} />
        <meshBasicMaterial
          color="#6600aa"
          transparent
          opacity={0.62}
          depthWrite={false}
        />
      </mesh>

      {/* Dark aura ring — outer */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.72, 1.20, 20]} />
        <meshBasicMaterial
          color="#330055"
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ── Composite export ────────────────────────────────────────────── */
export { GhostFigures3D, WizardFigure3D, DarkFigure3D };

export function NPCFigures3D({
  ghostFigsRef,
  wizardFigRef,
  darkFigRef,
}: {
  ghostFigsRef?: React.MutableRefObject<GhostFig[]>;
  wizardFigRef?: React.MutableRefObject<WizardFig | null>;
  darkFigRef?: React.MutableRefObject<DarkFig | null>;
}) {
  return (
    <>
      {ghostFigsRef && <GhostFigures3D ghostFigsRef={ghostFigsRef} />}
      {wizardFigRef && <WizardFigure3D wizardFigRef={wizardFigRef} />}
      {darkFigRef && <DarkFigure3D darkFigRef={darkFigRef} />}
    </>
  );
}
