import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

/* ── Avatar index palette (8 distinct models) ────────────────────── */
const NUM_AVATARS = 8;

export function avatarIndex(userId?: number): number {
  if (!userId) return 0;
  return userId % NUM_AVATARS;
}

const AVATAR_PATHS = Array.from(
  { length: NUM_AVATARS },
  (_, i) => `/models/avatars/avatar_${i}.glb`,
);

/* Preload all 8 GLBs at module import time */
AVATAR_PATHS.forEach(path => useGLTF.preload(path));

/* Scale applied to all generated models (gamestack guideline: ≥2.5×) */
const MODEL_SCALE = 2.5;

/* ── Single GLB avatar with procedural walk animation ───────────── */
export function AvatarGLB({
  userId,
  movingRef,
  timeRef,
}: {
  userId?: number;
  /** Ref so useFrame always reads current value without triggering re-renders */
  movingRef: React.MutableRefObject<boolean>;
  timeRef: React.MutableRefObject<number>;
}) {
  const path        = AVATAR_PATHS[avatarIndex(userId)];
  const { scene }   = useGLTF(path);
  const innerRef    = useRef<THREE.Group>(null);

  /* Clone scene once per mount so multiple instances of the same model coexist */
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  /* Procedural walk animation — whole-body vertical bob + lateral sway */
  useFrame(() => {
    if (!innerRef.current) return;
    if (movingRef.current) {
      const t = timeRef.current * 6.5;
      innerRef.current.position.y  = Math.abs(Math.sin(t)) * 0.08;
      innerRef.current.rotation.z  = Math.sin(t) * 0.04;
    } else {
      innerRef.current.position.y  = 0;
      innerRef.current.rotation.z  = 0;
    }
  });

  return (
    <>
      {/* Shadow blob at world scale (outside the 2.5× model group) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.65, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
      </mesh>

      {/* GLB model group — scaled up as required by gamestack guidelines */}
      <group ref={innerRef} scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </>
  );
}
