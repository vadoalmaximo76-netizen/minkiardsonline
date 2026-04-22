import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { BuildingType, StoryWorldBuildingDatum } from './types';

const BODY_HEIGHT: Record<BuildingType, number> = {
  house: 4, shop: 3, inn: 4.5, tower: 10, ruin: 2,
  church: 7, arcade: 4, farm: 3, barn: 5,
};
const BODY_COLOR: Record<BuildingType, string> = {
  house: '#d4b88a', shop: '#c8e0f8', inn: '#e0d490', tower: '#b0b0b0',
  ruin: '#8a8070', church: '#f5f0e0', arcade: '#3d2a6e', farm: '#ddc090', barn: '#d08050',
};
const ROOF_COLOR: Record<BuildingType, string> = {
  house: '#8b5e3c', shop: '#4a80c0', inn: '#8b6020', tower: '#505050',
  ruin: '#5a5040', church: '#c04040', arcade: '#7c3aed', farm: '#8b5a1a', barn: '#7b3a10',
};

/* ── Buildings container ──────────────────────────────────────── */
export function Buildings3D({
  buildings,
  dayTimeRef,
}: {
  buildings: StoryWorldBuildingDatum[];
  dayTimeRef?: React.MutableRefObject<number>;
}) {
  const woodMap = useTexture('/textures/wood.jpg');

  useMemo(() => {
    woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
    woodMap.repeat.set(2, 2.5);
    woodMap.needsUpdate = true;
  }, [woodMap]);

  /* Collect refs to all window meshes for day/night emissive update */
  const winRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(() => {
    if (!dayTimeRef || winRefs.current.length === 0) return;
    const t      = dayTimeRef.current;
    const isDark = t > 0.75 || t < 0.2;
    /* Smooth transition: 0→1 over ±0.05 of the threshold */
    const nightAlpha = isDark
      ? Math.min(1, (t < 0.2 ? (0.2 - t) / 0.05 : (t - 0.75) / 0.05))
      : 0;
    const intensity = 0.06 + nightAlpha * 0.88;

    winRefs.current.forEach(m => {
      if (!m) return;
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
    });
  });

  /* Build flat index for window refs */
  let winIndex = 0;

  return (
    <group>
      {buildings.map((b, i) => {
        const bh = BODY_HEIGHT[b.type];
        const bw = b.w;
        const bd = b.h;
        const isRuin   = b.type === 'ruin';
        const isTower  = b.type === 'tower';
        const isChurch = b.type === 'church';
        const isArcade = b.type === 'arcade';
        const winCountX = Math.max(1, Math.floor(bw / 2.2));
        const winY      = bh * 0.55;

        /* Capture window indices for this building (front face only) */
        const myWinStartIdx = winIndex;
        const myWinCount    = (!isRuin && !isTower) ? winCountX : 0;
        winIndex += myWinCount;

        return (
          <group key={i} position={[b.x, 0, b.z]}>
            {/* ── Body — receives shadows but does not cast (perf budget) */}
            <mesh position={[0, bh / 2, 0]} receiveShadow>
              <boxGeometry args={[bw, bh, bd]} />
              <meshStandardMaterial
                map={woodMap}
                color={BODY_COLOR[b.type]}
                roughness={0.82}
                metalness={0.02}
              />
            </mesh>

            {/* ── Windows (front face) — emissive at night ─────────── */}
            {Array.from({ length: myWinCount }).map((_, wi) => {
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
                    emissive="#ffeebb"
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

            {/* ── Roof pyramid ──────────────────────────────────────── */}
            {!isRuin && !isTower && (
              <mesh position={[0, bh + 0.9, 0]}>
                <coneGeometry args={[Math.max(bw, bd) * 0.75, 1.8, 4]} />
                <meshStandardMaterial color={ROOF_COLOR[b.type]} roughness={0.75} metalness={0.0} />
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
