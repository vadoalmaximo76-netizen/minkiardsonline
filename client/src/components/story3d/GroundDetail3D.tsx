/**
 * GroundDetail3D — Instanced micro-detail: grass tufts + wildflowers.
 *
 * Adds visual richness to the ground plane around the world centre
 * without measurable performance cost (two InstancedMesh draw calls).
 * All positions are pre-calculated with a deterministic LCG so the
 * same layout is produced every render without random calls in JSX.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ── Tuft configuration ────────────────────────────────────────── */
const TUFT_COUNT    = 280; /* small cone tufts  */
const FLOWER_COUNT  = 140; /* tiny sphere blooms */
const SPREAD_RADIUS = 80; /* world units from origin */

/* Flower colours — cycling deterministically */
const FLOWER_COLORS = [
  '#f8d7a0', '#f7c5c5', '#d4f0a8', '#c5dbf7',
  '#f7d5f0', '#fff0a0', '#d0f5e8', '#fcd5b0',
];

/* ── Simple 32-bit LCG (Park-Miller variant) ───────────────────── */
function lcgNext(seed: number): number {
  return (seed * 16807) % 2147483647;
}
function lcgFloat(seed: number): number {
  return (seed % 1000) / 1000;
}

/* ── Pre-computed instance data (useMemo — outside render path) ── */
interface TuftDatum  { x: number; z: number; sy: number; }
interface FlowerDatum { x: number; z: number; ci: number; }

function buildTufts(): TuftDatum[] {
  const result: TuftDatum[] = [];
  let seed = 98765;
  for (let i = 0; i < TUFT_COUNT; i++) {
    seed = lcgNext(seed);
    const r  = lcgFloat(seed) * SPREAD_RADIUS;
    seed = lcgNext(seed);
    const a  = lcgFloat(seed) * Math.PI * 2;
    seed = lcgNext(seed);
    const sy = 0.35 + lcgFloat(seed) * 0.55; /* height variance */
    result.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, sy });
  }
  return result;
}

function buildFlowers(): FlowerDatum[] {
  const result: FlowerDatum[] = [];
  let seed = 54321;
  for (let i = 0; i < FLOWER_COUNT; i++) {
    seed = lcgNext(seed);
    const r  = lcgFloat(seed) * SPREAD_RADIUS;
    seed = lcgNext(seed);
    const a  = lcgFloat(seed) * Math.PI * 2;
    seed = lcgNext(seed);
    const ci = Math.floor(lcgFloat(seed) * FLOWER_COLORS.length);
    result.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, ci });
  }
  return result;
}

export function GroundDetail3D() {
  const tuftRef   = useRef<THREE.InstancedMesh>(null);
  const stemRef   = useRef<THREE.InstancedMesh>(null);
  const bloomRef  = useRef<THREE.InstancedMesh>(null);
  const initDone  = useRef(false);

  /* Pre-calculate positions once — no heap allocation at render time */
  const tufts   = useMemo(buildTufts,   []);
  const flowers = useMemo(buildFlowers, []);

  useFrame(() => {
    if (initDone.current) return;
    if (!tuftRef.current || !stemRef.current || !bloomRef.current) return;
    initDone.current = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    /* ── Grass tufts ─────────────────────────────────────────────── */
    tufts.forEach((t, i) => {
      dummy.position.set(t.x, t.sy * 0.5 * 0.18, t.z); /* half-height above ground */
      dummy.scale.set(0.18, t.sy * 0.18, 0.18);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      tuftRef.current!.setMatrixAt(i, dummy.matrix);
    });
    tuftRef.current.instanceMatrix.needsUpdate = true;

    /* ── Flower stems + blooms ───────────────────────────────────── */
    flowers.forEach((f, i) => {
      /* Stem */
      dummy.position.set(f.x, 0.10, f.z);
      dummy.scale.set(0.04, 0.20, 0.04);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      stemRef.current!.setMatrixAt(i, dummy.matrix);

      /* Bloom */
      dummy.position.set(f.x, 0.24, f.z);
      dummy.scale.set(0.12, 0.12, 0.12);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      bloomRef.current!.setMatrixAt(i, dummy.matrix);
      color.set(FLOWER_COLORS[f.ci]);
      bloomRef.current!.setColorAt(i, color);
    });

    stemRef.current.instanceMatrix.needsUpdate  = true;
    bloomRef.current.instanceMatrix.needsUpdate = true;
    if (bloomRef.current.instanceColor) bloomRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {/* Grass tufts — cone geometry */}
      <instancedMesh ref={tuftRef} args={[undefined, undefined, TUFT_COUNT]}>
        <coneGeometry args={[1, 1, 5]} />
        <meshStandardMaterial color="#4a8a2a" roughness={0.92} metalness={0} />
      </instancedMesh>

      {/* Flower stems */}
      <instancedMesh ref={stemRef} args={[undefined, undefined, FLOWER_COUNT]}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshStandardMaterial color="#5a7a38" roughness={0.9} metalness={0} />
      </instancedMesh>

      {/* Flower blooms — sphere with per-instance colour */}
      <instancedMesh ref={bloomRef} args={[undefined, undefined, FLOWER_COUNT]}>
        <sphereGeometry args={[1, 6, 5]} />
        <meshStandardMaterial roughness={0.7} metalness={0} vertexColors={false} />
      </instancedMesh>
    </group>
  );
}
