import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { StoryWorldRoadDatum } from './types';

/* ── Biome zone definitions (world coordinates) ─────────────────── */
interface BiomeZone {
  /** Returns 0‒1 influence at (x, z) */
  influence: (x: number, z: number) => number;
  /** RGB 0‒1 */
  r: number; g: number; b: number;
}

function circleZone(cx: number, cz: number, radius: number, falloff = 0.5): BiomeZone['influence'] {
  return (x, z) => {
    const d = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2);
    return Math.max(0, 1 - d / (radius * (1 + falloff)));
  };
}

const BIOME_ZONES: BiomeZone[] = [
  /* Spawn plaza — light sandy-grey stone */
  { influence: circleZone(0, 170, 32, 0.4), r: 0.72, g: 0.68, b: 0.60 },
  /* Centro città — light grey cobblestone */
  { influence: circleZone(0, 10, 28, 0.4),  r: 0.55, g: 0.55, b: 0.58 },
  /* Lake — blue-green water near (-80, 60) */
  { influence: circleZone(-80, 60, 24, 0.3), r: 0.18, g: 0.38, b: 0.72 },
  /* Forest north-east — darker green */
  { influence: circleZone(130, 80, 40, 0.5),  r: 0.10, g: 0.30, b: 0.10 },
  /* Forest south-west — darker green */
  { influence: circleZone(-120, -80, 36, 0.5), r: 0.12, g: 0.28, b: 0.10 },
  /* Football field area — bright grass */
  { influence: circleZone(-45, -145, 14, 0.4), r: 0.12, g: 0.55, b: 0.12 },
  /* Torre Finale — dark volcanic rock */
  { influence: circleZone(0, -190, 20, 0.4),   r: 0.22, g: 0.20, b: 0.24 },
];

/* Base meadow colour */
const BASE_R = 0.20, BASE_G = 0.42, BASE_B = 0.14;

/* ── Terrain: procedural height + biome vertex colours ─────────── */
export function Terrain3D() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(500, 500, 64, 64);
    g.rotateX(-Math.PI / 2);
    const pos    = g.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      /* Gentle height noise */
      const h =
        Math.sin(x * 0.015) * Math.cos(z * 0.02) * 1.2 +
        Math.sin(x * 0.04 + 1.3) * Math.sin(z * 0.035) * 0.5;

      /* Flatten radius-40 around spawn (0, 185) and city centre (0, 10) */
      const flatSpawn = Math.max(0, 1 - Math.sqrt(x * x + (z - 170) ** 2) / 40);
      const flatCity  = Math.max(0, 1 - Math.sqrt(x * x + (z - 10) ** 2)  / 35);
      const flatBlend = Math.min(1, flatSpawn + flatCity);
      const finalH    = h * (1 - flatBlend);
      pos.setY(i, finalH);

      /* Start with base colour blended by height */
      const hNorm = (finalH + 1.5) / 3;
      let r = BASE_R + hNorm * 0.06;
      let gv = BASE_G + hNorm * 0.10;
      let b  = BASE_B + hNorm * 0.03;

      /* Overlay biome zones */
      for (const zone of BIOME_ZONES) {
        const inf = zone.influence(x, z);
        if (inf > 0) {
          r  = r  * (1 - inf) + zone.r * inf;
          gv = gv * (1 - inf) + zone.g * inf;
          b  = b  * (1 - inf) + zone.b * inf;
        }
      }

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

/* ── Roads: flat planes with dark-asphalt colour ─────────────────── */
export function Roads3D({ roads }: { roads: StoryWorldRoadDatum[] }) {
  if (roads.length === 0) return null;
  return (
    <group>
      {roads.map((r, i) => {
        const cx  = (r.x1 + r.x2) / 2;
        const cz  = (r.z1 + r.z2) / 2;
        const dx  = r.x2 - r.x1;
        const dz  = r.z2 - r.z1;
        const len = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dx, dz);
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, angle]} position={[cx, 0.06, cz]}>
            <planeGeometry args={[r.w, len]} />
            <meshLambertMaterial color="#44444f" />
          </mesh>
        );
      })}
    </group>
  );
}
