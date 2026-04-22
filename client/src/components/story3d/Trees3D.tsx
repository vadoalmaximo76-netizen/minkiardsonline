import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { StoryWorldTreeDatum } from './types';

/* Pre-generate per-tree colour variants to avoid Math.random() in render */
const CANOPY_GREENS = ['#2d7a2d', '#3a8a2a', '#246424', '#1e6e1e', '#327832', '#3d8c30'];

export function Trees3D({ trees }: { trees: StoryWorldTreeDatum[] }) {
  const trunkRef  = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const initDone  = useRef(false);

  /* Per-tree deterministic colour index (no Math.random in render) */
  const colorIndices = useMemo(
    () => trees.map((_, i) => (i * 7 + 3) % CANOPY_GREENS.length),
    [trees]
  );

  useFrame(() => {
    if (initDone.current) return;
    if (!trunkRef.current || !canopyRef.current) return;
    initDone.current = true;

    const dummy = new THREE.Object3D();
    const color  = new THREE.Color();

    trees.forEach((t, i) => {
      const trunkH = t.h * 2.5;

      /* trunk */
      dummy.position.set(t.x, trunkH / 2, t.z);
      dummy.scale.set(0.25, trunkH, 0.25);
      dummy.updateMatrix();
      trunkRef.current!.setMatrixAt(i, dummy.matrix);

      /* canopy */
      dummy.position.set(t.x, trunkH + t.r * 2.2, t.z);
      dummy.scale.set(t.r * 3.5, t.r * 3.5, t.r * 3.5);
      dummy.updateMatrix();
      canopyRef.current!.setMatrixAt(i, dummy.matrix);

      /* per-tree colour variation */
      color.set(CANOPY_GREENS[colorIndices[i]]);
      canopyRef.current!.setColorAt(i, color);
    });

    trunkRef.current.instanceMatrix.needsUpdate  = true;
    canopyRef.current.instanceMatrix.needsUpdate = true;
    if (canopyRef.current.instanceColor) {
      canopyRef.current.instanceColor.needsUpdate = true;
    }
  });

  if (trees.length === 0) return null;

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshLambertMaterial color="#6b4226" />
      </instancedMesh>
      <instancedMesh ref={canopyRef} args={[undefined, undefined, trees.length]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshLambertMaterial vertexColors={false} />
      </instancedMesh>
    </group>
  );
}
