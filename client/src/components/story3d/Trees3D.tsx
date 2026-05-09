import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { StoryWorldTreeDatum } from './types';

/* Layered canopy colours — three palette sets for depth */
const CANOPY_BOTTOM = ['#2a7a2a', '#388a28', '#226022', '#1e6e1e', '#2e7030', '#3a8c2e'];
const CANOPY_MID    = ['#34922e', '#40a030', '#2a7828', '#286828', '#3c8c34', '#48a038'];
const CANOPY_TOP    = ['#42ac3a', '#50b840', '#36903a', '#307830', '#4aa040', '#58b848'];

/* Maximum number of trees updated per frame for wind sway (performance budget) */
const MAX_WIND_TREES = 220;

/* Per-tree stored base transform data used to recompute wind matrices */
interface TreeBaseData {
  x: number; z: number;
  y1: number; sx1: number; sy1: number; sz1: number; /* bottom canopy */
  y2: number; sx2: number; sy2: number; sz2: number; /* mid canopy    */
  y3: number; sx3: number; sy3: number; sz3: number; /* top canopy    */
  seed: number; /* per-tree wind phase offset (radians) */
}

export function Trees3D({ trees }: { trees: StoryWorldTreeDatum[] }) {
  const trunkRef   = useRef<THREE.InstancedMesh>(null);
  const canopy1Ref = useRef<THREE.InstancedMesh>(null); /* bottom layer (widest)   */
  const canopy2Ref = useRef<THREE.InstancedMesh>(null); /* mid layer               */
  const canopy3Ref = useRef<THREE.InstancedMesh>(null); /* top layer (narrowest)   */
  const initDone   = useRef(false);

  /* Deterministic per-tree wind-phase seeds (golden-ratio spacing) */
  const windSeeds = useMemo(
    () => trees.map((_, i) => ((i * 1.6180339887) % 1) * Math.PI * 2),
    [trees],
  );

  const colorIndices = useMemo(
    () => trees.map((_, i) => (i * 7 + 3) % CANOPY_BOTTOM.length),
    [trees],
  );

  /* Stored base transforms for wind sway recomputation */
  const baseData  = useRef<TreeBaseData[]>([]);
  const windTime  = useRef(0);
  /* Reusable Object3D — avoid per-frame heap allocation */
  const windDummy = useRef(new THREE.Object3D());

  useFrame((_, delta) => {
    /* ── First frame: initialise all instance matrices ───────────── */
    if (!initDone.current) {
      if (!trunkRef.current || !canopy1Ref.current || !canopy2Ref.current || !canopy3Ref.current) return;
      initDone.current = true;

      const dummy = new THREE.Object3D();
      const color  = new THREE.Color();

      trees.forEach((t, i) => {
        const trunkH = t.h * 2.8;
        const ci     = colorIndices[i];

        /* ── Trunk ──────────────────────────────────────────────── */
        dummy.position.set(t.x, trunkH / 2, t.z);
        dummy.scale.set(0.20, trunkH, 0.20);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        trunkRef.current!.setMatrixAt(i, dummy.matrix);

        /* ── Bottom canopy layer (widest) ───────────────────────── */
        const y1  = trunkH + t.r * 1.8;
        const sx1 = t.r * 4.2, sy1 = t.r * 2.2, sz1 = t.r * 4.2;
        dummy.position.set(t.x, y1, t.z);
        dummy.scale.set(sx1, sy1, sz1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        canopy1Ref.current!.setMatrixAt(i, dummy.matrix);
        color.set(CANOPY_BOTTOM[ci]);
        canopy1Ref.current!.setColorAt(i, color);

        /* ── Mid canopy layer ────────────────────────────────────── */
        const y2  = trunkH + t.r * 3.8;
        const sx2 = t.r * 3.1, sy2 = t.r * 2.0, sz2 = t.r * 3.1;
        dummy.position.set(t.x, y2, t.z);
        dummy.scale.set(sx2, sy2, sz2);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        canopy2Ref.current!.setMatrixAt(i, dummy.matrix);
        color.set(CANOPY_MID[ci]);
        canopy2Ref.current!.setColorAt(i, color);

        /* ── Top canopy layer (narrowest) ────────────────────────── */
        const y3  = trunkH + t.r * 5.6;
        const sx3 = t.r * 1.9, sy3 = t.r * 1.8, sz3 = t.r * 1.9;
        dummy.position.set(t.x, y3, t.z);
        dummy.scale.set(sx3, sy3, sz3);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        canopy3Ref.current!.setMatrixAt(i, dummy.matrix);
        color.set(CANOPY_TOP[ci]);
        canopy3Ref.current!.setColorAt(i, color);

        /* Store base data for subsequent per-frame wind updates */
        baseData.current.push({
          x: t.x, z: t.z,
          y1, sx1, sy1, sz1,
          y2, sx2, sy2, sz2,
          y3, sx3, sy3, sz3,
          seed: windSeeds[i],
        });
      });

      trunkRef.current.instanceMatrix.needsUpdate   = true;
      canopy1Ref.current.instanceMatrix.needsUpdate = true;
      canopy2Ref.current.instanceMatrix.needsUpdate = true;
      canopy3Ref.current.instanceMatrix.needsUpdate = true;

      if (canopy1Ref.current.instanceColor) canopy1Ref.current.instanceColor.needsUpdate = true;
      if (canopy2Ref.current.instanceColor) canopy2Ref.current.instanceColor.needsUpdate = true;
      if (canopy3Ref.current.instanceColor) canopy3Ref.current.instanceColor.needsUpdate = true;
      return;
    }

    /* ── Every subsequent frame: gentle wind sway on canopy layers ── */
    if (!canopy1Ref.current || !canopy2Ref.current || !canopy3Ref.current) return;
    if (baseData.current.length === 0) return;

    windTime.current += delta;
    const wt    = windTime.current;
    const dummy = windDummy.current;
    const count = Math.min(trees.length, MAX_WIND_TREES);

    for (let i = 0; i < count; i++) {
      const bd = baseData.current[i];

      /* Two independent sine waves → natural, non-repetitive sway */
      const swayX = Math.sin(wt * 0.78 + bd.seed)        * 0.032;
      const swayZ = Math.sin(wt * 0.78 + bd.seed + 1.31) * 0.024;

      /* Bottom layer — 40% of full amplitude (sheltered) */
      dummy.position.set(bd.x, bd.y1, bd.z);
      dummy.scale.set(bd.sx1, bd.sy1, bd.sz1);
      dummy.rotation.set(swayX * 0.40, 0, swayZ * 0.40);
      dummy.updateMatrix();
      canopy1Ref.current.setMatrixAt(i, dummy.matrix);

      /* Mid layer — 70% amplitude */
      dummy.position.set(bd.x, bd.y2, bd.z);
      dummy.scale.set(bd.sx2, bd.sy2, bd.sz2);
      dummy.rotation.set(swayX * 0.70, 0, swayZ * 0.70);
      dummy.updateMatrix();
      canopy2Ref.current.setMatrixAt(i, dummy.matrix);

      /* Top layer — full amplitude (most exposed to wind) */
      dummy.position.set(bd.x, bd.y3, bd.z);
      dummy.scale.set(bd.sx3, bd.sy3, bd.sz3);
      dummy.rotation.set(swayX, 0, swayZ);
      dummy.updateMatrix();
      canopy3Ref.current.setMatrixAt(i, dummy.matrix);
    }

    canopy1Ref.current.instanceMatrix.needsUpdate = true;
    canopy2Ref.current.instanceMatrix.needsUpdate = true;
    canopy3Ref.current.instanceMatrix.needsUpdate = true;
  });

  if (trees.length === 0) return null;

  return (
    <group>
      {/* Trunk — no shadow cast (performance budget: only canopy1 casts) */}
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]}>
        <cylinderGeometry args={[1, 1.3, 1, 7]} />
        <meshStandardMaterial color="#7a5232" roughness={0.95} metalness={0.0} />
      </instancedMesh>

      {/* Bottom canopy — SHADOW CASTER (instanced = 1 draw call) */}
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
