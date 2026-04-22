import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

/* ── Colori giorno/notte ──────────────────────────────────────── */
const DAY_FOG    = new THREE.Color('#b8d8f0');
const NIGHT_FOG  = new THREE.Color('#0d1b3e');
const DAY_SKY    = new THREE.Color('#87ceeb');
const NIGHT_SKY  = new THREE.Color('#0d1b3e');
const DAY_AMB    = new THREE.Color('#ffffff');
const NIGHT_AMB  = new THREE.Color('#6688cc');  // azzurro lunare, non nero
const _tmpColor  = new THREE.Color();

function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return _tmpColor.copy(a).lerp(b, t);
}

/* ── Sistema Giorno/Notte animato ─────────────────────────────── *
 * dayTimeRef avanza di delta/480 per frame → ciclo 8 minuti.
 * La luce notturna è mantenuta VISIBILE (min ambient 0.28)
 * in modo che gli elementi della scena siano sempre leggibili.
 * Transizione crepuscolo/alba con curva smooth senza salto brusco.
 * ──────────────────────────────────────────────────────────────── */
export function DayNight3D({
  dayTimeRef,
}: {
  dayTimeRef: React.MutableRefObject<number>;
}) {
  const { scene }   = useThree();
  const sunRef      = useRef<THREE.DirectionalLight>(null);
  const moonRef     = useRef<THREE.DirectionalLight>(null);
  const ambientRef  = useRef<THREE.AmbientLight>(null);
  const hemiRef     = useRef<THREE.HemisphereLight>(null);

  useEffect(() => {
    scene.fog        = new THREE.Fog('#b8d8f0', 70, 260);
    scene.background = new THREE.Color('#87ceeb');
    return () => { scene.fog = null; };
  }, [scene]);

  useFrame((_, delta) => {
    dayTimeRef.current = (dayTimeRef.current + delta / 480) % 1;

    const t      = dayTimeRef.current * Math.PI * 2;
    const sinT   = Math.sin(t);   // +1 = mezzogiorno, -1 = mezzanotte

    /* nightFactor: 0 = pieno giorno, 1 = piena notte
     * Transizione graduale nella zona crepuscolare (sinT ∈ [-0.3, 0.3]) */
    const nightFactor = Math.max(0, Math.min(1, 1 - (sinT + 0.25) / 0.5));

    /* ── Sole: posizione nel cielo ── */
    if (sunRef.current) {
      sunRef.current.position.set(
        Math.sin(t) * 120,
        Math.max(5, Math.cos(t) * 90 + 30),
        Math.cos(t) * 80,
      );
      /* Di giorno luce solare piena; di notte si spegne completamente */
      const dayBrightness = Math.max(0, sinT);
      sunRef.current.intensity = (1 - nightFactor) * (0.5 + dayBrightness * 1.3);
      (sunRef.current.color as THREE.Color).copy(
        lerpColor(new THREE.Color('#fff8e0'), new THREE.Color('#ffcc88'), nightFactor * 0.6),
      );
    }

    /* ── Luna: luce direzionale bassa, attiva di notte ── */
    if (moonRef.current) {
      /* La luna è sul lato opposto del sole */
      moonRef.current.position.set(
        -Math.sin(t) * 100,
        Math.max(10, -Math.cos(t) * 70 + 40),
        -Math.cos(t) * 60,
      );
      /* Intensità lunare minima 0.18 – garantisce visibilità notturna */
      moonRef.current.intensity = nightFactor * 0.28 + 0.04;
    }

    /* ── Luce ambientale: minimo 0.28 di notte (mai buio totale) ── */
    if (ambientRef.current) {
      const minNight = 0.28;
      const maxDay   = 0.40;
      ambientRef.current.intensity = minNight + (maxDay - minNight) * (1 - nightFactor);
      (ambientRef.current.color as THREE.Color).copy(
        lerpColor(DAY_AMB, NIGHT_AMB, nightFactor),
      );
    }

    /* ── Luce emisferica: cielo/terreno ── */
    if (hemiRef.current) {
      hemiRef.current.intensity = 0.30 + 0.22 * (1 - nightFactor);
    }

    /* ── Nebbia e sfondo cielo ── */
    if (scene.fog instanceof THREE.Fog) {
      (scene.fog.color as THREE.Color).copy(lerpColor(DAY_FOG, NIGHT_FOG, nightFactor));
    }
    if (scene.background instanceof THREE.Color) {
      (scene.background as THREE.Color).copy(lerpColor(DAY_SKY, NIGHT_SKY, nightFactor));
    }
  });

  return (
    <>
      {/* Luce ambientale base — sempre attiva */}
      <ambientLight ref={ambientRef} intensity={0.40} color="#ffffff" />

      {/* Sole */}
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

      {/* Luna — luce lunare direzionale separata, no shadow (economica) */}
      <directionalLight
        ref={moonRef}
        intensity={0.04}
        color="#8899cc"
        position={[-100, 80, -60]}
      />

      {/* Luce emisferica cielo/terreno */}
      <hemisphereLight
        ref={hemiRef}
        color="#87ceeb"
        groundColor="#2d5a1a"
        intensity={0.52}
      />
    </>
  );
}

/* ── Stelle notturne ──────────────────────────────────────────── */
export function NightStars3D({
  dayTimeRef,
}: {
  dayTimeRef: React.MutableRefObject<number>;
}) {
  const groupRef   = useRef<THREE.Group>(null);
  const opacityRef = useRef(0);

  useFrame(() => {
    if (!groupRef.current) return;
    const t          = dayTimeRef.current * Math.PI * 2;
    const sinT       = Math.sin(t);
    const nightFactor = Math.max(0, Math.min(1, 1 - (sinT + 0.25) / 0.5));
    opacityRef.current += (nightFactor - opacityRef.current) * 0.02;
    groupRef.current.visible = opacityRef.current > 0.05;
  });

  return (
    <group ref={groupRef}>
      <Stars radius={220} depth={70} count={2500} factor={4.5} fade />
    </group>
  );
}
