import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

/* ── Avatar index palette (8 distinct models) ────────────────────── */
const NUM_AVATARS = 8;

export function avatarIndex(userId?: number): number {
  if (!userId) return 0;
  return userId % NUM_AVATARS;
}

const AVATAR_PATHS = Array.from(
  { length: NUM_AVATARS },
  (_, i) => `/models/avatars/avatar_${i}.glb`,
);

/* Preload all 8 GLBs at module import time */
AVATAR_PATHS.forEach(path => useGLTF.preload(path));

/* Scale applied to all generated models (gamestack guideline: ≥2.5×) */
const MODEL_SCALE = 2.5;

/* ── Animation clip name patterns (case-insensitive) ─────────────── */
const IDLE_CLIP_RE = /idle|rest|stand|breath|neutral/i;
const WALK_CLIP_RE = /walk|run|move|jog|locomotion/i;

/* ── Bone name patterns for auto-discovery ───────────────────────── */
interface DiscoveredBones {
  spine?:    THREE.Bone;
  head?:     THREE.Bone;
  leftArm?:  THREE.Bone;
  rightArm?: THREE.Bone;
  leftLeg?:  THREE.Bone;
  rightLeg?: THREE.Bone;
}

const BONE_PATTERNS: Record<keyof DiscoveredBones, RegExp> = {
  spine:    /spine|chest|torso|body/i,
  head:     /^head$|neck/i,
  leftArm:  /left.*(arm|shoulder|upper.*arm)|l_?(arm|shoulder)/i,
  rightArm: /right.*(arm|shoulder|upper.*arm)|r_?(arm|shoulder)/i,
  leftLeg:  /left.*(leg|thigh|upleg)|l_?(leg|thigh)/i,
  rightLeg: /right.*(leg|thigh|upleg)|r_?(leg|thigh)/i,
};

function discoverBones(root: THREE.Object3D): DiscoveredBones {
  const result: DiscoveredBones = {};
  const allBones: THREE.Bone[] = [];
  root.traverse(obj => { if (obj instanceof THREE.Bone) allBones.push(obj); });
  if (allBones.length === 0) return result;

  console.log('[AvatarGLB] skeleton found, bones:', allBones.map(b => b.name).join(', '));
  for (const bone of allBones) {
    for (const [key, re] of Object.entries(BONE_PATTERNS) as [keyof DiscoveredBones, RegExp][]) {
      if (!result[key] && re.test(bone.name)) result[key] = bone;
    }
  }
  return result;
}

/* ── Single GLB avatar: Path A (baked clips) → B (bones) → C (fallback) ── */
export function AvatarGLB({
  userId,
  movingRef,
  timeRef,
}: {
  userId?: number;
  movingRef: React.MutableRefObject<boolean>;
  timeRef:   React.MutableRefObject<number>;
}) {
  const path                   = AVATAR_PATHS[avatarIndex(userId)];
  const { scene, animations }  = useGLTF(path);
  const bodyGroupRef           = useRef<THREE.Group>(null);
  const modelGroupRef          = useRef<THREE.Group>(null);

  /* Clone scene once per mount so multiple instances coexist */
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  /* ── PATH A: AnimationMixer for baked clips ── */
  /* useAnimations must be called unconditionally (React hook rules).
     It binds the mixer to clonedScene; actions are keyed by clip name. */
  const { actions } = useAnimations(animations, clonedScene);

  /* Refs tracking which path is active and which actions to crossfade */
  const hasClips          = useRef(false);
  const idleActionRef     = useRef<THREE.AnimationAction | null>(null);
  const walkActionRef     = useRef<THREE.AnimationAction | null>(null);
  const currentActionRef  = useRef<THREE.AnimationAction | null>(null);

  /* ── PATH B: procedural bone animation ── */
  const bonesRef  = useRef<DiscoveredBones>({});
  const hasBones  = useRef(false);
  const origRots  = useRef<Map<THREE.Bone, THREE.Euler>>(new Map());

  /* Alpha: 0 = idle, 1 = walking — lerps in ~0.25 s */
  const animAlphaRef = useRef(0);

  /* One-time setup after the cloned scene and actions are ready */
  useEffect(() => {
    /* ── PATH A: map clips to idle / walk states ── */
    const clipNames = Object.keys(actions);
    if (clipNames.length > 0) {
      console.log('[AvatarGLB] animation clips available:', clipNames.join(', '));

      const idleEntry = clipNames.find(n => IDLE_CLIP_RE.test(n));
      const walkEntry = clipNames.find(n => WALK_CLIP_RE.test(n));

      /* Deterministic fallback when names don't match the patterns:
         treat the first clip as idle, second (or first again) as walk.
         This ensures Path A activates even with non-standard clip names. */
      const idleName = idleEntry ?? clipNames[0];
      const walkName = walkEntry ?? (clipNames.length > 1 ? clipNames[1] : clipNames[0]);

      if (idleName) idleActionRef.current = actions[idleName] ?? null;
      if (walkName) walkActionRef.current = actions[walkName] ?? null;

      hasClips.current = !!(idleActionRef.current || walkActionRef.current);

      if (hasClips.current) {
        /* Start idle animation immediately */
        const startAction = idleActionRef.current ?? walkActionRef.current!;
        startAction.reset().play();
        currentActionRef.current = startAction;
        console.log('[AvatarGLB] Path A active — idle:', idleName, 'walk:', walkName);
        return; /* skip Path B/C setup */
      }
    }

    /* ── PATH B: discover bones ── */
    const bones = discoverBones(clonedScene);
    bonesRef.current  = bones;
    hasBones.current  = Object.keys(bones).length > 0;
    if (!hasBones.current) {
      console.log('[AvatarGLB] Path C active — enhanced procedural fallback');
    } else {
      console.log('[AvatarGLB] Path B active — procedural bone animation');
      for (const bone of Object.values(bonesRef.current)) {
        if (bone) origRots.current.set(bone, bone.rotation.clone());
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clonedScene]);

  useFrame((_, delta) => {
    if (!bodyGroupRef.current || !modelGroupRef.current) return;

    const t  = timeRef.current;
    const wt = t * 6.5; /* walk-cycle phase */

    /* Smooth idle↔walk blend (~0.25 s transition, rate = 4/s) */
    const target = movingRef.current ? 1 : 0;
    animAlphaRef.current = THREE.MathUtils.lerp(
      animAlphaRef.current, target, Math.min(1, delta * 4),
    );
    const alpha = animAlphaRef.current;
    const idle  = 1 - alpha;

    /* ── PATH A: crossfade between baked animation clips ── */
    if (hasClips.current) {
      const shouldWalk  = alpha > 0.5;
      const targetAct   = shouldWalk ? (walkActionRef.current ?? idleActionRef.current)
                                     : (idleActionRef.current ?? walkActionRef.current);

      if (targetAct && targetAct !== currentActionRef.current) {
        if (currentActionRef.current) {
          /* Crossfade over the same 0.25 s window as the alpha lerp */
          currentActionRef.current.crossFadeTo(targetAct, 0.25, true);
          targetAct.play();
        } else {
          targetAct.reset().play();
        }
        currentActionRef.current = targetAct;
      }

      /* Keep body group neutral — the mixer drives the mesh directly */
      bodyGroupRef.current.position.y = 0;
      bodyGroupRef.current.rotation.set(0, 0, 0);
      bodyGroupRef.current.scale.setScalar(MODEL_SCALE);
      modelGroupRef.current.rotation.set(0, 0, 0);
      return;
    }

    /* ── PATH B: procedural bone animation ── */
    if (hasBones.current) {
      const b = bonesRef.current;

      if (b.spine) {
        const orig = origRots.current.get(b.spine)!;
        b.spine.rotation.x = orig.x + Math.sin(t * 1.8)  * 0.025 * idle;
        b.spine.rotation.z = orig.z + Math.sin(wt)        * 0.06  * alpha;
      }
      if (b.head) {
        const orig = origRots.current.get(b.head)!;
        b.head.rotation.x  = orig.x + Math.sin(t * 1.4)   * 0.015 * idle
                                     - Math.sin(wt * 0.5)  * 0.05  * alpha;
        b.head.rotation.z  = orig.z - Math.sin(wt)         * 0.04  * alpha;
      }
      /* Arms swing opposite to legs */
      if (b.leftArm) {
        const orig = origRots.current.get(b.leftArm)!;
        b.leftArm.rotation.x  = orig.x + Math.sin(wt + Math.PI) * 0.45 * alpha;
      }
      if (b.rightArm) {
        const orig = origRots.current.get(b.rightArm)!;
        b.rightArm.rotation.x = orig.x + Math.sin(wt)            * 0.45 * alpha;
      }
      if (b.leftLeg) {
        const orig = origRots.current.get(b.leftLeg)!;
        b.leftLeg.rotation.x  = orig.x + Math.sin(wt)            * 0.5  * alpha;
      }
      if (b.rightLeg) {
        const orig = origRots.current.get(b.rightLeg)!;
        b.rightLeg.rotation.x = orig.x + Math.sin(wt + Math.PI)  * 0.5  * alpha;
      }

      /* Whole-body bob during walk */
      bodyGroupRef.current.position.y = Math.abs(Math.sin(wt)) * 0.06 * alpha;
      bodyGroupRef.current.rotation.z = Math.sin(wt) * 0.025 * alpha;
      bodyGroupRef.current.rotation.x = 0;
      bodyGroupRef.current.scale.setScalar(MODEL_SCALE);
      modelGroupRef.current.rotation.set(0, 0, 0);
      return;
    }

    /* ── PATH C: enhanced procedural fallback (no skeleton, no clips) ── */
    /* Idle: subtle vertical breath + scale-Y pulse */
    const idleY      = Math.sin(t * 1.8)     * 0.012 * idle;
    const idleScaleY = 1 + Math.sin(t * 1.8) * 0.008 * idle;

    /* Walk: pronounced bob + lateral sway + slight forward lean */
    const walkBob  = Math.abs(Math.sin(wt)) * 0.09 * alpha;
    const walkSway = Math.sin(wt)            * 0.05 * alpha;
    const walkLean = Math.sin(wt * 0.5)      * 0.015 * alpha;

    bodyGroupRef.current.position.y = idleY + walkBob;
    bodyGroupRef.current.rotation.z = walkSway;
    bodyGroupRef.current.rotation.x = walkLean;
    bodyGroupRef.current.scale.set(MODEL_SCALE, MODEL_SCALE * idleScaleY, MODEL_SCALE);

    /* Inner model group: simulate head nod by tilting model upper region */
    const headNodIdle = Math.sin(t * 1.4)              * 0.008 * idle;
    const headNodWalk = Math.sin(wt + Math.PI * 0.5)   * 0.04  * alpha;
    modelGroupRef.current.rotation.x = headNodIdle + headNodWalk;
  });

  return (
    <>
      {/* Shadow blob at world scale (outside the 2.5× model group) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.65, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
      </mesh>

      {/* GLB model group — scaled up as required by gamestack guidelines */}
      <group ref={bodyGroupRef} scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]}>
        <group ref={modelGroupRef}>
          <primitive object={clonedScene} />
        </group>
      </group>
    </>
  );
}
