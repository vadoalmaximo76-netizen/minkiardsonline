import React, { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { StoryWorldRoadDatum } from './types';

/* ── Biome zone definitions (world coordinates) ─────────────────── */
interface BiomeZone {
  influence: (x: number, z: number) => number;
  r: number; g: number; b: number;
}

function circleZone(cx: number, cz: number, radius: number, falloff = 0.5): BiomeZone['influence'] {
  return (x, z) => {
    const d = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2);
    return Math.max(0, 1 - d / (radius * (1 + falloff)));
  };
}

const BIOME_ZONES: BiomeZone[] = [
  { influence: circleZone(0, 170, 32, 0.4),    r: 0.90, g: 0.85, b: 0.72 },
  { influence: circleZone(0, 10, 28, 0.4),      r: 0.72, g: 0.72, b: 0.76 },
  { influence: circleZone(-80, 60, 24, 0.3),    r: 0.28, g: 0.56, b: 1.0  },
  { influence: circleZone(130, 80, 40, 0.5),    r: 0.16, g: 0.52, b: 0.16 },
  { influence: circleZone(-120, -80, 36, 0.5),  r: 0.18, g: 0.48, b: 0.16 },
  { influence: circleZone(-45, -145, 14, 0.4),  r: 0.18, g: 0.88, b: 0.18 },
  { influence: circleZone(0, -190, 20, 0.4),    r: 0.40, g: 0.38, b: 0.44 },
];

const BASE_R = 0.36, BASE_G = 0.76, BASE_B = 0.25;

/* ── Terrain: procedural height + biome vertex colours ─────────── */
export function Terrain3D() {
  const grassTexture = useTexture('/textures/grass.png');

  useMemo(() => {
    grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(22, 22);
    grassTexture.needsUpdate = true;
  }, [grassTexture]);

  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(500, 500, 128, 128);
    g.rotateX(-Math.PI / 2);
    const pos    = g.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      const h =
        Math.sin(x * 0.015) * Math.cos(z * 0.02) * 1.4 +
        Math.sin(x * 0.04 + 1.3) * Math.sin(z * 0.035) * 0.7 +
        Math.sin(x * 0.08 + 0.7) * Math.cos(z * 0.06 + 0.4) * 0.3;

      const flatSpawn = Math.max(0, 1 - Math.sqrt(x * x + (z - 170) ** 2) / 40);
      const flatCity  = Math.max(0, 1 - Math.sqrt(x * x + (z - 10) ** 2)  / 35);
      const flatBlend = Math.min(1, flatSpawn + flatCity);
      const finalH    = h * (1 - flatBlend);
      pos.setY(i, finalH);

      const hNorm = (finalH + 1.8) / 3.6;
      let r = BASE_R + hNorm * 0.08;
      let gv = BASE_G + hNorm * 0.14;
      let b  = BASE_B + hNorm * 0.04;

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
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial
        map={grassTexture}
        vertexColors
        roughness={0.88}
        metalness={0.0}
      />
    </mesh>
  );
}

/* ── Roads: textured asphalt strips ─────────────────────────────── */
export function Roads3D({ roads }: { roads: StoryWorldRoadDatum[] }) {
  const asphaltTexture = useTexture('/textures/asphalt.png');

  /* Pre-configure shared texture (RepeatWrapping, neutral repeat) */
  useMemo(() => {
    asphaltTexture.wrapS = asphaltTexture.wrapT = THREE.RepeatWrapping;
    asphaltTexture.repeat.set(1.5, 6);
    asphaltTexture.needsUpdate = true;
  }, [asphaltTexture]);

  /* Pre-compute road transforms once */
  const roadData = useMemo(() => roads.map(r => {
    const cx    = (r.x1 + r.x2) / 2;
    const cz    = (r.z1 + r.z2) / 2;
    const dx    = r.x2 - r.x1;
    const dz    = r.z2 - r.z1;
    const len   = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dx, dz);
    return { cx, cz, len, angle, w: r.w };
  }), [roads]);

  if (roads.length === 0) return null;

  return (
    <group>
      {roadData.map((r, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, r.angle]} position={[r.cx, 0.07, r.cz]} receiveShadow>
          <planeGeometry args={[r.w, r.len]} />
          <meshStandardMaterial map={asphaltTexture} roughness={0.95} metalness={0.02} color="#aaaaaa" />
        </mesh>
      ))}
    </group>
  );
}
