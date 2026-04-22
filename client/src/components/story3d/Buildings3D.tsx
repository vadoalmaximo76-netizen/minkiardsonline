import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { BuildingType, StoryWorldBuildingDatum } from './types';

const BODY_HEIGHT: Record<BuildingType, number> = {
  house: 4, shop: 3, inn: 4.5, tower: 10, ruin: 2,
  church: 7, arcade: 4, farm: 3, barn: 5,
};
/* Updated palette from main */
const BODY_COLOR: Record<BuildingType, string> = {
  house: '#d4b88a', shop: '#c8e0f8', inn: '#e0d490', tower: '#b0b0b0',
  ruin: '#8a8070', church: '#f5f0e0', arcade: '#3d2a6e', farm: '#ddc090', barn: '#d08050',
};
const ROOF_COLOR: Record<BuildingType, string> = {
  house: '#8b5e3c', shop: '#4a80c0', inn: '#8b6020', tower: '#505050',
  ruin: '#5a5040', church: '#c04040', arcade: '#7c3aed', farm: '#8b5a1a', barn: '#7b3a10',
};

const WIN_GLOW = '#ffeebb';

/* LOD thresholds (world units, squared for cheap per-instance checks) */
const LOD_NEAR    = 100;
const LOD_FAR     = 150;
const LOD_NEAR_SQ = LOD_NEAR * LOD_NEAR;
const LOD_FAR_SQ  = LOD_FAR  * LOD_FAR;

/* Spatial chunk size — governs how many InstancedMesh groups are created */
const CHUNK_SIZE = 80;

/* Per-frame scratch objects — allocated once */
const _dummy  = new THREE.Object3D();
const _hidden = new THREE.Matrix4().makeScale(0, 0, 0);

/* ── Types ─────────────────────────────────────────────────────────── */

interface InstanceData {
  x: number; z: number;
  bw: number; bh: number; bd: number;
  bodyY: number; roofY: number; roofR: number;
}

interface ChunkGroup {
  key: string;
  type: BuildingType;
  buildings: StoryWorldBuildingDatum[];
  sphere: THREE.Sphere;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function chunkIndex(v: number) {
  return Math.floor(v / CHUNK_SIZE);
}

/* Tight bounding sphere for one chunk-type group in world space */
function buildChunkSphere(buildings: StoryWorldBuildingDatum[], type: BuildingType): THREE.Sphere {
  const maxH = BODY_HEIGHT[type] + 2;
  let sx = 0, sz = 0;
  for (const b of buildings) { sx += b.x; sz += b.z; }
  const cx = sx / buildings.length;
  const cz = sz / buildings.length;
  const cy = maxH / 2;
  let r = 0;
  for (const b of buildings) {
    const hw = b.w / 2, hd = b.h / 2;
    for (const [bx, bz] of [[b.x-hw,b.z-hd],[b.x+hw,b.z-hd],[b.x-hw,b.z+hd],[b.x+hw,b.z+hd]]) {
      const d = Math.sqrt((bx-cx)**2 + cy**2 + (bz-cz)**2);
      if (d > r) r = d;
    }
  }
  return new THREE.Sphere(new THREE.Vector3(cx, cy, cz), r + 2);
}

/* ── Per-chunk-type instanced renderer ─────────────────────────────── */

function BuildingChunkInstanced({
  type, buildings, sphere, playerRef, woodMap,
}: {
  type: BuildingType;
  buildings: StoryWorldBuildingDatum[];
  sphere: THREE.Sphere;
  playerRef: React.MutableRefObject<{ x: number; z: number }>;
  woodMap: THREE.Texture;
}) {
  const count  = buildings.length;
  const isRuin = type === 'ruin';
  const bh     = BODY_HEIGHT[type];

  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const roofRef = useRef<THREE.InstancedMesh>(null);

  const data = useMemo<InstanceData[]>(
    () => buildings.map(b => ({
      x: b.x, z: b.z,
      bw: b.w, bh, bd: b.h,
      bodyY: bh / 2,
      roofY: bh + 0.9,
      roofR: Math.max(b.w, b.h) * 0.75,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buildings],
  );

  /*
   * Track the current LOD band per instance so matrix writes only happen on
   * band transitions.  255 = uninitialised (forces first write).
   * 0 = hidden, 1 = body-only, 2 = full-detail
   */
  const bandRef = useRef<Uint8Array>(new Uint8Array(count).fill(255));

  /* Set pre-computed bounding sphere so Three.js frustum-culls correctly */
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.boundingSphere = sphere.clone();
    if (roofRef.current) roofRef.current.boundingSphere = sphere.clone();
  }, [sphere]);

  useFrame(() => {
    const body = bodyRef.current;
    if (!body) return;
    const roof  = roofRef.current;
    const bands = bandRef.current;
    const px = playerRef.current.x;
    const pz = playerRef.current.z;

    /* Chunk-level early-exit when all buildings are beyond LOD_FAR */
    const chunkDist = Math.sqrt((sphere.center.x-px)**2 + (sphere.center.z-pz)**2);
    if (chunkDist - sphere.radius > LOD_FAR) {
      if (!body.userData.allHidden) {
        for (let i = 0; i < count; i++) {
          if (bands[i] !== 0) {
            body.setMatrixAt(i, _hidden);
            if (roof) roof.setMatrixAt(i, _hidden);
            bands[i] = 0;
          }
        }
        body.instanceMatrix.needsUpdate = true;
        if (roof) roof.instanceMatrix.needsUpdate = true;
        body.userData.allHidden = true;
      }
      return;
    }
    body.userData.allHidden = false;

    let dirty = false;

    for (let i = 0; i < count; i++) {
      const d      = data[i];
      const distSq = (d.x-px)**2 + (d.z-pz)**2;

      const newBand: number = distSq >= LOD_FAR_SQ ? 0
        : (!isRuin && distSq < LOD_NEAR_SQ)        ? 2
        : 1;

      if (bands[i] === newBand) continue;
      bands[i] = newBand;
      dirty = true;

      if (newBand === 0) {
        body.setMatrixAt(i, _hidden);
        if (roof) roof.setMatrixAt(i, _hidden);
        continue;
      }

      _dummy.position.set(d.x, d.bodyY, d.z);
      _dummy.scale.set(d.bw, d.bh, d.bd);
      _dummy.updateMatrix();
      body.setMatrixAt(i, _dummy.matrix);

      if (roof) {
        if (newBand === 2) {
          _dummy.position.set(d.x, d.roofY, d.z);
          _dummy.scale.set(d.roofR, 1.8, d.roofR);
          _dummy.updateMatrix();
          roof.setMatrixAt(i, _dummy.matrix);
        } else {
          roof.setMatrixAt(i, _hidden);
        }
      }
    }

    if (dirty) {
      body.instanceMatrix.needsUpdate = true;
      if (roof) roof.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial map={woodMap} color={BODY_COLOR[type]} roughness={0.82} metalness={0.02} />
      </instancedMesh>
      {!isRuin && (
        <instancedMesh ref={roofRef} args={[undefined, undefined, count]}>
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color={ROOF_COLOR[type]} roughness={0.75} metalness={0.0} />
        </instancedMesh>
      )}
    </group>
  );
}

/* ── Near-only detail meshes (windows, cornice, special accents) ───── */
/*
 * Rendered only when player is within LOD_NEAR.  Covers:
 *   – Windows + cornice on all building types
 *   – Church cross, tower battlements, arcade neon sign
 * Window emissive intensity is driven by dayTimeRef for day/night cycling.
 */

function NearDetails({
  buildings, playerRef, dayTimeRef,
}: {
  buildings: StoryWorldBuildingDatum[];
  playerRef: React.MutableRefObject<{ x: number; z: number }>;
  dayTimeRef?: React.MutableRefObject<number>;
}) {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  /* Flat array of refs to all window meshes, for day/night emissive update */
  const winRefs   = useRef<(THREE.Mesh | null)[]>([]);

  /* Visibility toggling: show group only within LOD_NEAR */
  useFrame(() => {
    const px = playerRef.current.x;
    const pz = playerRef.current.z;
    for (let i = 0; i < buildings.length; i++) {
      const g = groupRefs.current[i];
      if (!g) continue;
      const b = buildings[i];
      g.visible = (b.x-px)**2 + (b.z-pz)**2 < LOD_NEAR_SQ;
    }
  });

  /* Day/night window emissive update */
  useFrame(() => {
    if (!dayTimeRef || winRefs.current.length === 0) return;
    const t          = dayTimeRef.current;
    const isDark     = t > 0.75 || t < 0.2;
    /* Smooth transition: 0→1 over ±0.05 of the threshold */
    const nightAlpha = isDark
      ? Math.min(1, (t < 0.2 ? (0.2 - t) / 0.05 : (t - 0.75) / 0.05))
      : 0;
    const intensity  = 0.06 + nightAlpha * 0.88;
    winRefs.current.forEach(m => {
      if (!m) return;
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
    });
  });

  /* Build flat window-ref index across all buildings in render order */
  let winIndex = 0;

  return (
    <group>
      {buildings.map((b, i) => {
        const bh        = BODY_HEIGHT[b.type];
        const bw        = b.w;
        const bd        = b.h;
        const isRuin    = b.type === 'ruin';
        const isTower   = b.type === 'tower';
        const isChurch  = b.type === 'church';
        const isArcade  = b.type === 'arcade';
        const winCountX = Math.max(1, Math.floor(bw / 2.2));
        const winY      = bh * 0.55;

        const myWinStartIdx = winIndex;
        const myWinCount    = (!isRuin && !isTower) ? winCountX : 0;
        winIndex += myWinCount;

        return (
          <group
            key={i}
            ref={(el: THREE.Group | null) => { groupRefs.current[i] = el; }}
            position={[b.x, 0, b.z]}
          >
            {/* ── Windows (front face) — emissive at night ─────────── */}
            {!isRuin && !isTower && Array.from({ length: myWinCount }).map((_, wi) => {
              const spacing = bw / (winCountX + 1);
              const wx      = -bw / 2 + spacing * (wi + 1);
              const refIdx  = myWinStartIdx + wi;
              return (
                <mesh
                  key={wi}
                  ref={(el: THREE.Mesh | null) => { winRefs.current[refIdx] = el; }}
                  position={[wx, winY, bd / 2 + 0.04]}
                >
                  <boxGeometry args={[0.50, 0.60, 0.06]} />
                  <meshStandardMaterial
                    color="#1a2840"
                    emissive={WIN_GLOW}
                    emissiveIntensity={0.06}
                    roughness={0.1}
                    metalness={0.3}
                  />
                </mesh>
              );
            })}

            {/* ── Cornice ledge ─────────────────────────────────────── */}
            {!isRuin && (
              <mesh position={[0, bh + 0.07, 0]}>
                <boxGeometry args={[bw + 0.28, 0.16, bd + 0.28]} />
                <meshStandardMaterial color="#888888" roughness={0.7} metalness={0.1} />
              </mesh>
            )}

            {/* ── Church cross ──────────────────────────────────────── */}
            {isChurch && (
              <>
                <mesh position={[0, bh + 2.3, 0]}>
                  <boxGeometry args={[0.14, 1.6, 0.14]} />
                  <meshStandardMaterial color="#f0f0f0" roughness={0.6} metalness={0.1} />
                </mesh>
                <mesh position={[0, bh + 2.8, 0]}>
                  <boxGeometry args={[0.62, 0.14, 0.14]} />
                  <meshStandardMaterial color="#f0f0f0" roughness={0.6} metalness={0.1} />
                </mesh>
              </>
            )}

            {/* ── Tower battlements ─────────────────────────────────── */}
            {isTower && (
              <>
                <mesh position={[0, bh + 0.35, 0]}>
                  <boxGeometry args={[bw + 0.3, 0.7, bd + 0.3]} />
                  <meshStandardMaterial color="#606060" roughness={0.8} metalness={0.05} />
                </mesh>
                {([-1, 1] as const).map(side => (
                  <mesh key={side} position={[side * bw * 0.35, bh * 0.6, bd / 2 + 0.04]}>
                    <boxGeometry args={[0.18, 0.9, 0.06]} />
                    <meshStandardMaterial color="#222233" roughness={0.9} />
                  </mesh>
                ))}
              </>
            )}

            {/* ── Arcade neon sign ──────────────────────────────────── */}
            {isArcade && (
              <>
                <mesh position={[0, bh + 0.2, bd / 2 + 0.06]}>
                  <planeGeometry args={[bw * 0.75, 0.65]} />
                  <meshStandardMaterial
                    color="#a855f7"
                    emissive="#a855f7"
                    emissiveIntensity={1.6}
                    roughness={0.2}
                    metalness={0.1}
                  />
                </mesh>
                <mesh position={[0, bh + 0.2, bd / 2 + 0.03]}>
                  <boxGeometry args={[bw * 0.78, 0.72, 0.04]} />
                  <meshStandardMaterial color="#2d1a4e" roughness={0.6} metalness={0.4} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

/* ── Public component ──────────────────────────────────────────────── */

export function Buildings3D({
  buildings,
  playerRef,
  dayTimeRef,
}: {
  buildings: StoryWorldBuildingDatum[];
  playerRef: React.MutableRefObject<{ x: number; z: number }>;
  dayTimeRef?: React.MutableRefObject<number>;
}) {
  const woodMap = useTexture('/textures/wood.jpg');
  useMemo(() => {
    woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
    woodMap.repeat.set(2, 2.5);
    woodMap.needsUpdate = true;
  }, [woodMap]);

  /* Group buildings by (chunk, type) — one InstancedMesh per group */
  const chunks = useMemo<ChunkGroup[]>(() => {
    const map = new Map<string, StoryWorldBuildingDatum[]>();
    for (const b of buildings) {
      const key = `${chunkIndex(b.x)},${chunkIndex(b.z)},${b.type}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return Array.from(map.entries()).map(([key, bs]) => ({
      key,
      type: bs[0].type,
      buildings: bs,
      sphere: buildChunkSphere(bs, bs[0].type),
    }));
  }, [buildings]);

  return (
    <group>
      {chunks.map(chunk => (
        <BuildingChunkInstanced
          key={chunk.key}
          type={chunk.type}
          buildings={chunk.buildings}
          sphere={chunk.sphere}
          playerRef={playerRef}
          woodMap={woodMap}
        />
      ))}
      <NearDetails buildings={buildings} playerRef={playerRef} dayTimeRef={dayTimeRef} />
    </group>
  );
}
