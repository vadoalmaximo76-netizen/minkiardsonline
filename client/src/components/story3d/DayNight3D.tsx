import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

/* ── Animated Day/Night system ────────────────────────────────── *
 * dayTimeRef starts at current real-world clock fraction (0..1)
 * and advances by delta/480 each frame → 1 full 8-minute cycle.
 * All lighting parameters are updated directly on Three.js refs
 * (no React state) for zero re-render overhead.
 * ────────────────────────────────────────────────────────────── */
export function DayNight3D({
  dayTimeRef,
}: {
  dayTimeRef: React.MutableRefObject<number>;
}) {
  const { scene }  = useThree();
  const sunRef     = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef    = useRef<THREE.HemisphereLight>(null);

  useEffect(() => {
    scene.fog        = new THREE.Fog('#b8d8f0', 70, 260);
    scene.background = new THREE.Color('#87ceeb');
    return () => { scene.fog = null; };
  }, [scene]);

  useFrame((_, delta) => {
    dayTimeRef.current = (dayTimeRef.current + delta / 480) % 1;

    const t          = dayTimeRef.current * Math.PI * 2;
    const sinT       = Math.sin(t);
    const brightness = Math.max(0, sinT);
    const isDark     = dayTimeRef.current > 0.75 || dayTimeRef.current < 0.2;

    if (sunRef.current) {
      sunRef.current.position.set(
        Math.sin(t) * 120,
        Math.max(8, Math.cos(t) * 90 + 30),
        Math.cos(t) * 80,
      );
      sunRef.current.intensity = isDark ? 0.06 : 0.5 + brightness * 1.4;
      (sunRef.current.color as THREE.Color).set(isDark ? '#aabbff' : '#fff8e0');
    }

    if (ambientRef.current) {
      ambientRef.current.intensity = isDark ? 0.10 : 0.38;
      (ambientRef.current.color as THREE.Color).set(isDark ? '#2233aa' : '#ffffff');
    }

    if (hemiRef.current) {
      hemiRef.current.intensity = isDark ? 0.12 : 0.45;
    }

    if (scene.fog instanceof THREE.Fog) {
      (scene.fog.color as THREE.Color).set(isDark ? '#050a1a' : '#b8d8f0');
    }
    if (scene.background instanceof THREE.Color) {
      (scene.background as THREE.Color).set(isDark ? '#050a1a' : '#87ceeb');
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.38} color="#ffffff" />
      <directionalLight
        ref={sunRef}
        intensity={1.6}
        color="#fff8e0"
        position={[100, 100, 80]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={350}
        shadow-camera-left={-130}
        shadow-camera-right={130}
        shadow-camera-top={130}
        shadow-camera-bottom={-130}
        shadow-bias={-0.0005}
      />
      <hemisphereLight
        ref={hemiRef}
        color="#87ceeb"
        groundColor="#2d5a1a"
        intensity={0.45}
      />
    </>
  );
}

/* ── Night Stars ──────────────────────────────────────────────── */
export function NightStars3D({
  dayTimeRef,
}: {
  dayTimeRef: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const isDark = dayTimeRef.current > 0.75 || dayTimeRef.current < 0.2;
    groupRef.current.visible = isDark;
  });

  return (
    <group ref={groupRef}>
      <Stars radius={220} depth={70} count={2500} factor={4.5} fade />
    </group>
  );
}
