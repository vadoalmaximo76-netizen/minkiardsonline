import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { StoryWorldTreeDatum } from './types';

/* Layered canopy colours — three palette sets for depth */
const CANOPY_BOTTOM = ['#2a7a2a', '#388a28', '#226022', '#1e6e1e', '#2e7030', '#3a8c2e'];
const CANOPY_MID    = ['#34922e', '#40a030', '#2a7828', '#286828', '#3c8c34', '#48a038'];
const CANOPY_TOP    = ['#42ac3a', '#50b840', '#36903a', '#307830', '#4aa040', '#58b848'];

export function Trees3D({ trees }: { trees: StoryWorldTreeDatum[] }) {
  const trunkRef   = useRef<THREE.InstancedMesh>(null);
  const canopy1Ref = useRef<THREE.InstancedMesh>(null); // bottom layer (widest)
  const canopy2Ref = useRef<THREE.InstancedMesh>(null); // mid layer
  const canopy3Ref = useRef<THREE.InstancedMesh>(null); // top layer (narrowest)
  const initDone   = useRef(false);

  const colorIndices = useMemo(
    () => trees.map((_, i) => (i * 7 + 3) % CANOPY_BOTTOM.length),
    [trees],
  );

  useFrame(() => {
    if (initDone.current) return;
    if (!trunkRef.current || !canopy1Ref.current || !canopy2Ref.current || !canopy3Ref.current) return;
    initDone.current = true;

    const dummy = new THREE.Object3D();
    const color  = new THREE.Color();

    trees.forEach((t, i) => {
      const trunkH = t.h * 2.8;
      const ci     = colorIndices[i];

      /* ── Trunk ───────────────────────────────────────────────── */
      dummy.position.set(t.x, trunkH / 2, t.z);
      dummy.scale.set(0.20, trunkH, 0.20);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      trunkRef.current!.setMatrixAt(i, dummy.matrix);

      /* ── Bottom canopy layer (widest) ───────────────────────── */
      dummy.position.set(t.x, trunkH + t.r * 1.8, t.z);
      dummy.scale.set(t.r * 4.2, t.r * 2.2, t.r * 4.2);
      dummy.updateMatrix();
      canopy1Ref.current!.setMatrixAt(i, dummy.matrix);
      color.set(CANOPY_BOTTOM[ci]);
      canopy1Ref.current!.setColorAt(i, color);

      /* ── Mid canopy layer ────────────────────────────────────── */
      dummy.position.set(t.x, trunkH + t.r * 3.8, t.z);
      dummy.scale.set(t.r * 3.1, t.r * 2.0, t.r * 3.1);
      dummy.updateMatrix();
      canopy2Ref.current!.setMatrixAt(i, dummy.matrix);
      color.set(CANOPY_MID[ci]);
      canopy2Ref.current!.setColorAt(i, color);

      /* ── Top canopy layer (narrowest) ────────────────────────── */
      dummy.position.set(t.x, trunkH + t.r * 5.6, t.z);
      dummy.scale.set(t.r * 1.9, t.r * 1.8, t.r * 1.9);
      dummy.updateMatrix();
      canopy3Ref.current!.setMatrixAt(i, dummy.matrix);
      color.set(CANOPY_TOP[ci]);
      canopy3Ref.current!.setColorAt(i, color);
    });

    trunkRef.current.instanceMatrix.needsUpdate   = true;
    canopy1Ref.current.instanceMatrix.needsUpdate = true;
    canopy2Ref.current.instanceMatrix.needsUpdate = true;
    canopy3Ref.current.instanceMatrix.needsUpdate = true;

    if (canopy1Ref.current.instanceColor) canopy1Ref.current.instanceColor.needsUpdate = true;
    if (canopy2Ref.current.instanceColor) canopy2Ref.current.instanceColor.needsUpdate = true;
    if (canopy3Ref.current.instanceColor) canopy3Ref.current.instanceColor.needsUpdate = true;
  });

  if (trees.length === 0) return null;

  return (
    <group>
      {/* Trunk — no shadow cast (performance budget: only canopy1 casts) */}
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]}>
        <cylinderGeometry args={[1, 1.3, 1, 7]} />
        <meshStandardMaterial color="#7a5232" roughness={0.95} metalness={0.0} />
      </instancedMesh>

      {/* Bottom canopy — SHADOW CASTER #2 (instanced = 1 draw call) */}
      <instancedMesh ref={canopy1Ref} args={[undefined, undefined, trees.length]} castShadow receiveShadow>
        <sphereGeometry args={[1, 9, 7]} />
        <meshStandardMaterial roughness={0.88} metalness={0.0} vertexColors={false} />
      </instancedMesh>

      {/* Mid canopy — receiver only */}
      <instancedMesh ref={canopy2Ref} args={[undefined, undefined, trees.length]} receiveShadow>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial roughness={0.85} metalness={0.0} vertexColors={false} />
      </instancedMesh>

      {/* Top canopy — receiver only */}
      <instancedMesh ref={canopy3Ref} args={[undefined, undefined, trees.length]} receiveShadow>
        <sphereGeometry args={[1, 7, 6]} />
        <meshStandardMaterial roughness={0.82} metalness={0.0} vertexColors={false} />
      </instancedMesh>
    </group>
  );
}
