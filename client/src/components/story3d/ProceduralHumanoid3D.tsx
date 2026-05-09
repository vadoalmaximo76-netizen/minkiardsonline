/**
 * ProceduralHumanoid3D — Fully-articulated procedural humanoid avatar.
 *
 * Used as Path-C fallback in AvatarGLB when the loaded GLB has neither
 * baked animation clips nor a recognised skeleton.
 *
 * The figure is built from primitive geometries (sphere, box, cylinder)
 * and driven by a multi-joint walking gait calculated each frame.
 *
 * Coordinate system (matches Three.js / the rest of the story3D stack):
 *   Y up, -Z forward. At MODEL_SCALE 2.5× the figure is ~3 world-units tall.
 */

import React, { useRef } from 'react';
import { useFrame }      from '@react-three/fiber';
import * as THREE        from 'three';

/* ── Jersey palette (mirrors Player3D) ──────────────────────────── */
const JERSEY_PALETTE = [
  '#e74c3c','#2980b9','#27ae60','#e67e22','#8e44ad',
  '#16a085','#e91e63','#d35400','#006064','#f1c40f',
  '#00897b','#6d4c41','#0288d1','#558b2f','#ad1457',
];
function jerseyColor(userId?: number): string {
  if (!userId) return '#e67e22';
  return JERSEY_PALETTE[userId % JERSEY_PALETTE.length];
}

/**
 * BASE_HIP_Y — vertical offset of the hip group so that feet rest on y = 0
 * in model-local space (before the parent 2.5× scale is applied).
 *
 * Derivation:
 *   lHipRef pivot   : -0.065 below hipGroup centre
 *   upper-leg length: 0.22
 *   lower-leg length: 0.21
 *   foot half-height: 0.0275
 *   Total below hip : 0.065 + 0.22 + 0.21 + 0.0275 = 0.5225 → round to 0.52
 */
const BASE_HIP_Y = 0.52;

/* ── Walk-cycle frequency ────────────────────────────────────────── */
const WALK_FREQ = 5.5; /* rad / s  (≈ 1.75 strides / s) */

/* ── Shared geometries (created once, reused across instances) ───── */
const GEO_HEAD      = new THREE.SphereGeometry(0.095, 10, 8);
const GEO_NECK      = new THREE.CylinderGeometry(0.046, 0.052, 0.10, 8);
const GEO_TORSO     = new THREE.BoxGeometry(0.22, 0.32, 0.13);
const GEO_HIP_BOX   = new THREE.BoxGeometry(0.19, 0.13, 0.11);
const GEO_UPPER_ARM = new THREE.CylinderGeometry(0.040, 0.044, 0.19, 8);
const GEO_LOWER_ARM = new THREE.CylinderGeometry(0.033, 0.037, 0.17, 8);
const GEO_HAND      = new THREE.SphereGeometry(0.036, 7, 6);
const GEO_UPPER_LEG = new THREE.CylinderGeometry(0.055, 0.058, 0.22, 8);
const GEO_LOWER_LEG = new THREE.CylinderGeometry(0.046, 0.052, 0.21, 8);
const GEO_FOOT      = new THREE.BoxGeometry(0.09, 0.055, 0.14);
const GEO_EYE       = new THREE.SphereGeometry(0.013, 5, 5);

export function ProceduralHumanoid3D({
  movingRef,
  timeRef,
  userId,
}: {
  movingRef: React.MutableRefObject<boolean>;
  timeRef:   React.MutableRefObject<number>;
  userId?:   number;
}) {
  /* ── Joint refs ─────────────────────────────────────────────────── */
  const hipRef    = useRef<THREE.Group>(null);
  const torsoRef  = useRef<THREE.Group>(null);
  const headRef   = useRef<THREE.Group>(null);
  const lShRef    = useRef<THREE.Group>(null); /* left shoulder */
  const rShRef    = useRef<THREE.Group>(null); /* right shoulder */
  const lElRef    = useRef<THREE.Group>(null); /* left elbow */
  const rElRef    = useRef<THREE.Group>(null); /* right elbow */
  const lHipJRef  = useRef<THREE.Group>(null); /* left hip joint  */
  const rHipJRef  = useRef<THREE.Group>(null); /* right hip joint */
  const lKneeRef  = useRef<THREE.Group>(null);
  const rKneeRef  = useRef<THREE.Group>(null);
  const lAnkleRef = useRef<THREE.Group>(null); /* left ankle  — heel-raise */
  const rAnkleRef = useRef<THREE.Group>(null); /* right ankle — heel-raise */

  const alphaRef  = useRef(0); /* 0 = idle, 1 = walk */

  /* ── Animation loop ─────────────────────────────────────────────── */
  useFrame((_, delta) => {
    const t  = timeRef.current;
    const wt = t * WALK_FREQ;

    /* Blend idle ↔ walk (~0.25 s) */
    const target = movingRef.current ? 1 : 0;
    alphaRef.current = THREE.MathUtils.lerp(alphaRef.current, target, Math.min(1, delta * 4));
    const a    = alphaRef.current;   /* walk weight */
    const idle = 1 - a;             /* idle weight */

    const hip   = hipRef.current;
    const torso = torsoRef.current;
    const head  = headRef.current;
    const lSh   = lShRef.current;
    const rSh   = rShRef.current;
    const lEl   = lElRef.current;
    const rEl   = rElRef.current;
    const lH    = lHipJRef.current;
    const rH    = rHipJRef.current;
    const lK    = lKneeRef.current;
    const rK    = rKneeRef.current;
    const lAnk  = lAnkleRef.current;
    const rAnk  = rAnkleRef.current;

    if (!hip) return;

    /* ── HIP GROUP: vertical bob + lateral sway + forward lean ── */
    hip.position.y = BASE_HIP_Y
      + Math.abs(Math.sin(wt))     * 0.026  * a    /* walk bob    */
      + Math.sin(t * 1.8)          * 0.006  * idle; /* idle breath */
    hip.rotation.z  = Math.sin(wt) * 0.036  * a;   /* lateral sway */
    hip.rotation.x  = -0.06        * a;             /* forward lean */
    hip.rotation.y  = 0;

    /* ── TORSO: counter-rotate vs hips (shoulder-twist) ── */
    if (torso) {
      torso.rotation.y = Math.sin(wt)  * 0.10  * a;
      torso.scale.y    = 1 + Math.sin(t * 1.8) * 0.013 * idle; /* breathing */
      torso.rotation.x = 0;
      torso.rotation.z = 0;
    }

    /* ── HEAD: nod idle + look-forward walk ── */
    if (head) {
      head.rotation.x = Math.sin(t * 1.4)           * 0.012 * idle
                      - Math.sin(wt * 0.5 + 0.2)    * 0.040 * a;
      head.rotation.z = -Math.sin(wt * 0.5)         * 0.028 * a;
    }

    /* ── ARMS: counter-swing (opposite phase to same-side leg) ── */
    /* Left arm swings forward when right leg swings forward (phase = π) */
    if (lSh) lSh.rotation.x = Math.sin(wt + Math.PI) * 0.40 * a;
    if (lEl) lEl.rotation.x = Math.max(0, Math.sin(wt + Math.PI * 0.55)) * 0.30 * a;
    /* Right arm: phase = 0 */
    if (rSh) rSh.rotation.x = Math.sin(wt)            * 0.40 * a;
    if (rEl) rEl.rotation.x = Math.max(0, Math.sin(wt + Math.PI * 1.55)) * 0.30 * a;

    /* ── LEGS: alternating swing + knee follow-through + heel-raise ── */
    /* Left leg: phase = 0 (forward when t=0) */
    if (lH) lH.rotation.x  = Math.sin(wt)                        * 0.54 * a;
    if (lK) lK.rotation.x  = Math.max(0, -Math.sin(wt - 0.35))   * 0.48 * a;
    /* Left heel-raise (plantar-flexion) during push-off / back-swing:
       lifts as the leg trails behind, peaks just before toe-off.       */
    if (lAnk) lAnk.rotation.x = Math.max(0, -Math.sin(wt + 0.40)) * 0.42 * a;

    /* Right leg: phase = π */
    if (rH) rH.rotation.x  = Math.sin(wt + Math.PI)              * 0.54 * a;
    if (rK) rK.rotation.x  = Math.max(0, -Math.sin(wt + Math.PI - 0.35)) * 0.48 * a;
    if (rAnk) rAnk.rotation.x = Math.max(0, -Math.sin(wt + Math.PI + 0.40)) * 0.42 * a;
  });

  /* ── Colours ─────────────────────────────────────────────────────── */
  const jersey = jerseyColor(userId);
  const skin   = '#f0b89a';
  const short  = '#1a2878'; /* dark-blue shorts */
  const shoe   = '#2a2a2a'; /* near-black shoes */

  return (
    /* Hip group — all animation is applied here via ref */
    <group ref={hipRef} position={[0, BASE_HIP_Y, 0]}>

      {/* ── HIP BLOCK ─────────────────────────────────────────────── */}
      <mesh geometry={GEO_HIP_BOX} castShadow>
        <meshStandardMaterial color={short} roughness={0.82} metalness={0} />
      </mesh>

      {/* ── TORSO ─────────────────────────────────────────────────── */}
      <group ref={torsoRef} position={[0, 0.225, 0]}>
        <mesh geometry={GEO_TORSO} castShadow>
          <meshStandardMaterial color={jersey} roughness={0.76} metalness={0.04} />
        </mesh>

        {/* ── HEAD + NECK ─────────────────────────────────────────── */}
        <group ref={headRef} position={[0, 0.215, 0]}>
          {/* Neck */}
          <mesh geometry={GEO_NECK} position={[0, 0.055, 0]} castShadow>
            <meshStandardMaterial color={skin} roughness={0.72} metalness={0} />
          </mesh>
          {/* Head sphere */}
          <mesh geometry={GEO_HEAD} position={[0, 0.165, 0]} castShadow>
            <meshStandardMaterial color={skin} roughness={0.66} metalness={0} />
          </mesh>
          {/* Eyes */}
          <mesh geometry={GEO_EYE} position={[ 0.038, 0.175, 0.083]}>
            <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.3} />
          </mesh>
          <mesh geometry={GEO_EYE} position={[-0.038, 0.175, 0.083]}>
            <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.3} />
          </mesh>
        </group>

        {/* ── LEFT SHOULDER → ARM ───────────────────────────────────
            Pivot at shoulder joint (positive X = left side)              */}
        <group ref={lShRef} position={[0.130, 0.110, 0]}>
          <mesh geometry={GEO_UPPER_ARM} position={[0, -0.095, 0]} castShadow>
            <meshStandardMaterial color={jersey} roughness={0.76} metalness={0} />
          </mesh>
          {/* Elbow pivot — at bottom of upper arm */}
          <group ref={lElRef} position={[0, -0.19, 0]}>
            <mesh geometry={GEO_LOWER_ARM} position={[0, -0.085, 0]} castShadow>
              <meshStandardMaterial color={skin} roughness={0.70} metalness={0} />
            </mesh>
            <mesh geometry={GEO_HAND} position={[0, -0.178, 0]}>
              <meshStandardMaterial color={skin} roughness={0.65} metalness={0} />
            </mesh>
          </group>
        </group>

        {/* ── RIGHT SHOULDER → ARM ─────────────────────────────────── */}
        <group ref={rShRef} position={[-0.130, 0.110, 0]}>
          <mesh geometry={GEO_UPPER_ARM} position={[0, -0.095, 0]} castShadow>
            <meshStandardMaterial color={jersey} roughness={0.76} metalness={0} />
          </mesh>
          <group ref={rElRef} position={[0, -0.19, 0]}>
            <mesh geometry={GEO_LOWER_ARM} position={[0, -0.085, 0]} castShadow>
              <meshStandardMaterial color={skin} roughness={0.70} metalness={0} />
            </mesh>
            <mesh geometry={GEO_HAND} position={[0, -0.178, 0]}>
              <meshStandardMaterial color={skin} roughness={0.65} metalness={0} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ── LEFT HIP JOINT → LEG ──────────────────────────────────────
          Pivot at hip joint (offset to left + slightly below hip centre)  */}
      <group ref={lHipJRef} position={[0.062, -0.062, 0]}>
        <mesh geometry={GEO_UPPER_LEG} position={[0, -0.110, 0]} castShadow>
          <meshStandardMaterial color={short} roughness={0.82} metalness={0} />
        </mesh>
        {/* Knee pivot */}
        <group ref={lKneeRef} position={[0, -0.220, 0]}>
          <mesh geometry={GEO_LOWER_LEG} position={[0, -0.105, 0]} castShadow>
            <meshStandardMaterial color={skin} roughness={0.76} metalness={0} />
          </mesh>
          {/* Ankle pivot — heel-raise driven by lAnkleRef in useFrame */}
          <group ref={lAnkleRef} position={[0, -0.210, 0]}>
            <mesh geometry={GEO_FOOT} position={[0.015, -0.0275, 0.022]}>
              <meshStandardMaterial color={shoe} roughness={0.88} metalness={0.08} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ── RIGHT HIP JOINT → LEG ─────────────────────────────────── */}
      <group ref={rHipJRef} position={[-0.062, -0.062, 0]}>
        <mesh geometry={GEO_UPPER_LEG} position={[0, -0.110, 0]} castShadow>
          <meshStandardMaterial color={short} roughness={0.82} metalness={0} />
        </mesh>
        <group ref={rKneeRef} position={[0, -0.220, 0]}>
          <mesh geometry={GEO_LOWER_LEG} position={[0, -0.105, 0]} castShadow>
            <meshStandardMaterial color={skin} roughness={0.76} metalness={0} />
          </mesh>
          {/* Ankle pivot — heel-raise driven by rAnkleRef in useFrame */}
          <group ref={rAnkleRef} position={[0, -0.210, 0]}>
            <mesh geometry={GEO_FOOT} position={[-0.015, -0.0275, 0.022]}>
              <meshStandardMaterial color={shoe} roughness={0.88} metalness={0.08} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
