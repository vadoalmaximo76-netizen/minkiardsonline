import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

/* ────────────────────────────────────────────────────────────────
 * Sky / fog colour palette  (t = day-fraction 0..1, 0 = midnight)
 * ──────────────────────────────────────────────────────────────── */
interface SkyStop {
  t: number;
  sky: string;
  fog: string;
  ambientColor: string;
  ambientIntensity: number;
  hemiIntensity: number;
  fogNear: number;
  fogFar: number;
}

const SKY_STOPS: SkyStop[] = [
  // midnight
  { t: 0.00, sky: '#020818', fog: '#020818', ambientColor: '#0d1a44', ambientIntensity: 0.28, hemiIntensity: 0.18, fogNear: 40, fogFar: 160 },
  // 4 am – still dark
  { t: 0.16, sky: '#020818', fog: '#020818', ambientColor: '#0d1a44', ambientIntensity: 0.28, hemiIntensity: 0.18, fogNear: 40, fogFar: 160 },
  // pre-dawn glow
  { t: 0.21, sky: '#160820', fog: '#160820', ambientColor: '#1a0a30', ambientIntensity: 0.30, hemiIntensity: 0.20, fogNear: 45, fogFar: 175 },
  // sunrise  (~6 am)
  { t: 0.25, sky: '#ff7340', fog: '#ffa060', ambientColor: '#cc5520', ambientIntensity: 0.38, hemiIntensity: 0.30, fogNear: 60, fogFar: 210 },
  // golden hour (~7 am)
  { t: 0.29, sky: '#ffbd6e', fog: '#ffe4a0', ambientColor: '#ffcc66', ambientIntensity: 0.50, hemiIntensity: 0.42, fogNear: 65, fogFar: 240 },
  // mid-morning (~8 am)
  { t: 0.33, sky: '#87ceeb', fog: '#b8d8f0', ambientColor: '#ffffff', ambientIntensity: 0.55, hemiIntensity: 0.55, fogNear: 70, fogFar: 260 },
  // noon
  { t: 0.50, sky: '#5eb5e8', fog: '#b8d8f0', ambientColor: '#ffffff', ambientIntensity: 0.58, hemiIntensity: 0.58, fogNear: 70, fogFar: 260 },
  // afternoon (~4 pm)
  { t: 0.67, sky: '#87ceeb', fog: '#b8d8f0', ambientColor: '#ffffff', ambientIntensity: 0.52, hemiIntensity: 0.50, fogNear: 70, fogFar: 255 },
  // sunset  (~5:30 pm)
  { t: 0.73, sky: '#ff9060', fog: '#ffc080', ambientColor: '#ff7733', ambientIntensity: 0.40, hemiIntensity: 0.32, fogNear: 60, fogFar: 210 },
  // dusk   (~6:30 pm)
  { t: 0.77, sky: '#7b2252', fog: '#4a1230', ambientColor: '#381025', ambientIntensity: 0.32, hemiIntensity: 0.22, fogNear: 48, fogFar: 185 },
  // early night (~8 pm)
  { t: 0.83, sky: '#050a1a', fog: '#050a1a', ambientColor: '#0d1a44', ambientIntensity: 0.28, hemiIntensity: 0.18, fogNear: 40, fogFar: 160 },
  // back to midnight
  { t: 1.00, sky: '#020818', fog: '#020818', ambientColor: '#0d1a44', ambientIntensity: 0.28, hemiIntensity: 0.18, fogNear: 40, fogFar: 160 },
];

const _c0 = new THREE.Color();
const _c1 = new THREE.Color();

function sampleSkyPalette(t: number) {
  let lo = SKY_STOPS[SKY_STOPS.length - 2];
  let hi = SKY_STOPS[SKY_STOPS.length - 1];
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (t >= SKY_STOPS[i].t && t <= SKY_STOPS[i + 1].t) {
      lo = SKY_STOPS[i];
      hi = SKY_STOPS[i + 1];
      break;
    }
  }
  const a = hi.t === lo.t ? 0 : (t - lo.t) / (hi.t - lo.t);

  return {
    sky:              _c0.set(lo.sky).clone().lerp(_c1.set(hi.sky), a),
    fog:              _c0.set(lo.fog).clone().lerp(_c1.set(hi.fog), a),
    ambientColor:     _c0.set(lo.ambientColor).clone().lerp(_c1.set(hi.ambientColor), a),
    ambientIntensity: lo.ambientIntensity + (hi.ambientIntensity - lo.ambientIntensity) * a,
    hemiIntensity:    lo.hemiIntensity    + (hi.hemiIntensity    - lo.hemiIntensity)    * a,
    fogNear:          lo.fogNear          + (hi.fogNear          - lo.fogNear)          * a,
    fogFar:           lo.fogFar           + (hi.fogFar           - lo.fogFar)           * a,
  };
}

/* 0 = stars hidden, 1 = stars fully visible */
function calcStarsOpacity(t: number): number {
  if (t < 0.20)               return 1;
  if (t >= 0.20 && t < 0.30)  return 1 - (t - 0.20) / 0.10; // dawn fade-out
  if (t >= 0.30 && t < 0.70)  return 0;
  if (t >= 0.70 && t < 0.80)  return (t - 0.70) / 0.10;     // dusk fade-in
  return 1;
}

/* Sun intensity rises with a sine arc over the daylight half */
function calcSunIntensity(t: number): number {
  if (t < 0.22 || t > 0.78) return 0.06; // moonlight
  const n = (t - 0.22) / (0.78 - 0.22);
  return 0.25 + Math.sin(n * Math.PI) * 1.8;
}

function calcSunColor(t: number): string {
  if (t < 0.22 || t > 0.78)               return '#aabbff'; // moon
  const n = (t - 0.22) / (0.78 - 0.22);
  if (n < 0.12 || n > 0.88)               return '#ff9040'; // sunrise/sunset
  if (n < 0.25 || n > 0.75)               return '#ffcc88'; // golden hour
  return '#fff8e0';                                          // midday
}

/* ── Animated Day/Night system ────────────────────────────────── *
 * 1 full cycle = 10 minutes (delta / 600 per frame).
 * Lighting and sky are updated directly on Three.js refs →
 * zero React re-renders.
 * Min ambient 0.28 at night so the scene is always readable.
 * ────────────────────────────────────────────────────────────── */
export function DayNight3D({
  dayTimeRef,
}: {
  dayTimeRef: React.MutableRefObject<number>;
}) {
  const { scene }  = useThree();
  const sunRef     = useRef<THREE.DirectionalLight>(null);
  const moonRef    = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef    = useRef<THREE.HemisphereLight>(null);

  useEffect(() => {
    scene.fog        = new THREE.Fog('#b8d8f0', 70, 260);
    scene.background = new THREE.Color('#87ceeb');
    return () => { scene.fog = null; };
  }, [scene]);

  useFrame((_, delta) => {
    // 10-minute full cycle
    dayTimeRef.current = (dayTimeRef.current + delta / 600) % 1;
    const t = dayTimeRef.current;

    const pal = sampleSkyPalette(t);

    /* Sun arc — 0 rad at 6 am, peaks at noon */
    const sunAngle = (t - 0.25) * Math.PI * 2;
    if (sunRef.current) {
      sunRef.current.position.set(
        Math.sin(sunAngle) * 120,
        Math.cos(sunAngle) * 90 + 10,
        Math.cos(sunAngle) * 60,
      );
      sunRef.current.intensity = calcSunIntensity(t);
      (sunRef.current.color as THREE.Color).set(calcSunColor(t));
    }

    /* Moon on the opposite arc — active at night, fades by day */
    if (moonRef.current) {
      const moonAngle = sunAngle + Math.PI;
      moonRef.current.position.set(
        Math.sin(moonAngle) * 100,
        Math.max(10, Math.cos(moonAngle) * 70 + 20),
        Math.cos(moonAngle) * 60,
      );
      /* Bright at night (sun below horizon), dim during day */
      const sunAboveHorizon = Math.max(0, Math.sin(sunAngle));
      moonRef.current.intensity = 0.04 + (1 - sunAboveHorizon) * 0.24;
    }

    if (ambientRef.current) {
      ambientRef.current.intensity = pal.ambientIntensity;
      (ambientRef.current.color as THREE.Color).copy(pal.ambientColor);
    }

    if (hemiRef.current) {
      hemiRef.current.intensity = pal.hemiIntensity;
    }

    if (scene.fog instanceof THREE.Fog) {
      (scene.fog.color as THREE.Color).copy(pal.fog);
      scene.fog.near = pal.fogNear;
      scene.fog.far  = pal.fogFar;
    }

    if (scene.background instanceof THREE.Color) {
      (scene.background as THREE.Color).copy(pal.sky);
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

/* ── Night Stars (gradual fade in / out) ──────────────────────── */
export function NightStars3D({
  dayTimeRef,
}: {
  dayTimeRef: React.MutableRefObject<number>;
}) {
  const groupRef   = useRef<THREE.Group>(null);
  const opacityRef = useRef(calcStarsOpacity(dayTimeRef.current));

  useFrame(() => {
    if (!groupRef.current) return;

    const target = calcStarsOpacity(dayTimeRef.current);
    opacityRef.current += (target - opacityRef.current) * 0.02;
    const op = opacityRef.current;

    groupRef.current.visible = op > 0.01;

    groupRef.current.traverse(obj => {
      const pts = obj as THREE.Points;
      if (pts.isPoints) {
        const mat = pts.material as THREE.PointsMaterial;
        if (mat) {
          mat.transparent = true;
          mat.opacity     = op;
        }
      }
    });
  });

  return (
    <group ref={groupRef}>
      <Stars radius={220} depth={70} count={2500} factor={4.5} fade saturation={0} />
    </group>
  );
}

/* ── Rain Effect ───────────────────────────────────────────────── *
 * 1 500 point-sprite particles simulate rainfall.
 * Weather changes randomly every 45–120 s.
 * Rain also increases fog density smoothly.
 * ─────────────────────────────────────────────────────────────── */
const RAIN_COUNT = 1500;
const RAIN_AREA  = 120;

interface WeatherState {
  raining:     boolean;
  intensity:   number;   // 0..1 smooth
  changeTimer: number;   // seconds until next weather roll
}

export function RainEffect3D() {
  const { scene } = useThree();

  const weatherRef = useRef<WeatherState>({
    raining:     false,
    intensity:   0,
    changeTimer: 30 + Math.random() * 60,
  });

  /* Particle positions — pre-scattered in a box above the player */
  const initialPos = useMemo<Float32Array>(() => {
    const pos = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * RAIN_AREA;
      pos[i * 3 + 1] = Math.random() * 45;
      pos[i * 3 + 2] = (Math.random() - 0.5) * RAIN_AREA;
    }
    return pos;
  }, []);

  const posRef   = useRef(new Float32Array(initialPos));
  const geomRef  = useRef<THREE.BufferGeometry>(null);
  const matRef   = useRef<THREE.PointsMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const w = weatherRef.current;

    /* ── Weather timer ── */
    w.changeTimer -= delta;
    if (w.changeTimer <= 0) {
      if (!w.raining) {
        w.raining = Math.random() < 0.40;
      } else {
        w.raining = Math.random() < 0.35;
      }
      w.changeTimer = 45 + Math.random() * 75;
    }

    /* ── Smooth intensity ── */
    const target = w.raining ? 1 : 0;
    w.intensity += (target - w.intensity) * Math.min(delta * 0.4, 1);

    const visible = w.intensity > 0.01;
    if (groupRef.current) groupRef.current.visible = visible;
    if (!visible) return;

    /* ── Fog: rain compresses far plane ── */
    if (scene.fog instanceof THREE.Fog) {
      const rainFogFar = 260 - w.intensity * 130;           // 260 → 130 at full rain
      if (scene.fog.far > rainFogFar) {
        scene.fog.far = scene.fog.far + (rainFogFar - scene.fog.far) * 0.05;
      }
    }

    /* ── Animate drops ── */
    const pos   = posRef.current;
    const speed = 28 * w.intensity;
    const drift = 3  * w.intensity; // slight horizontal wind

    for (let i = 0; i < RAIN_COUNT; i++) {
      const ix = i * 3;
      pos[ix + 1] -= delta * speed;
      pos[ix]     += delta * drift * 0.3;

      if (pos[ix + 1] < -2) {
        pos[ix]     = (Math.random() - 0.5) * RAIN_AREA;
        pos[ix + 1] = 42 + Math.random() * 8;
        pos[ix + 2] = (Math.random() - 0.5) * RAIN_AREA;
      }
    }

    if (geomRef.current) {
      const attr = geomRef.current.attributes.position as THREE.BufferAttribute;
      attr.set(pos);
      attr.needsUpdate = true;
    }

    if (matRef.current) {
      matRef.current.opacity = 0.25 + w.intensity * 0.40;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <points>
        <bufferGeometry ref={geomRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[posRef.current, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={matRef}
          size={0.18}
          color="#99bbdd"
          transparent
          opacity={0.4}
          sizeAttenuation
          depthWrite={false}
          fog
        />
      </points>
    </group>
  );
}
