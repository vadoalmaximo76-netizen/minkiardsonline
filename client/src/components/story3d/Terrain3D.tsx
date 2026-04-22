import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { StoryWorldRoadDatum } from './types';

/* ── Terrain: procedural height + vertex biome colours, no textures ── */
export function Terrain3D() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(500, 500, 64, 64);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;

    const colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      /* gentle hills — max ±1.5 units vertical */
      const h =
        Math.sin(x * 0.015) * Math.cos(z * 0.02) * 1.2 +
        Math.sin(x * 0.04 + 1.3) * Math.sin(z * 0.035) * 0.5;

      /* flatten the spawn/road zone near origin (radius 40 u) */
      const flatBlend = Math.max(0, 1 - Math.sqrt(x * x + z * z) / 40);
      const finalH = h * (1 - flatBlend);
      pos.setY(i, finalH);

      /* biome vertex colours: green meadow (base) + darker at hills + lighter at plains */
      const hNorm = (finalH + 1.5) / 3;
      const r = 0.15 + hNorm * 0.08;
      const gv = 0.38 + hNorm * 0.12;
      const b  = 0.10 + hNorm * 0.04;
      colors.push(r, gv, b);
    }

    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geo}>
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}

/* ── Roads: simple flat planes with asphalt colour — no external textures ── */
export function Roads3D({ roads }: { roads: StoryWorldRoadDatum[] }) {
  if (roads.length === 0) return null;
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
            <meshLambertMaterial color="#555566" />
          </mesh>
        );
      })}
    </group>
  );
}
