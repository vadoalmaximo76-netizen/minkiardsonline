import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ── Paleta colori personaggio ──────────────────────────────────── */
const C = {
  skin:       '#f5c99a',
  skinDark:   '#d4a574',
  hair:       '#1a0a00',
  jersey:     '#c0392b',   // rosso vivo
  jerseyTrim: '#f0f0f0',   // bianco
  jeans:      '#1a3a6b',
  shoe:       '#1a1a1a',
  shoeSole:   '#333333',
  belt:       '#2c1500',
  hatBody:    '#1a1a2e',
  hatBrim:    '#252540',
  eye:        '#111111',
  eyeWhite:   '#f5f5f5',
  mouth:      '#8b3a3a',
};

/* ── Parti animate: gambe + braccia in sincronia con il passo ──── */
function WalkingParts({ timeRef }: { timeRef: React.MutableRefObject<number> }) {
  const leftLegRef  = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef  = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const t = timeRef.current * 5.2;
    if (leftLegRef.current)  leftLegRef.current.rotation.x  = Math.sin(t) * 0.42;
    if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(t + Math.PI) * 0.42;
    if (leftArmRef.current)  leftArmRef.current.rotation.x  = Math.sin(t + Math.PI) * 0.40;
    if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t) * 0.40;
  });

  return (
    <>
      {/* ── Gamba sinistra (pivot all'anca) ── */}
      <group ref={leftLegRef} position={[-0.17, 0.98, 0]}>
        {/* coscia */}
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.26, 0.44, 0.26]} />
          <meshStandardMaterial color={C.jeans} roughness={0.85} />
        </mesh>
        {/* stinco */}
        <mesh position={[0, -0.58, 0]}>
          <boxGeometry args={[0.23, 0.32, 0.23]} />
          <meshStandardMaterial color={C.jeans} roughness={0.85} />
        </mesh>
        {/* scarpa sinistra */}
        <mesh position={[0, -0.80, 0.05]}>
          <boxGeometry args={[0.28, 0.13, 0.38]} />
          <meshStandardMaterial color={C.shoe} roughness={0.95} />
        </mesh>
        {/* suola */}
        <mesh position={[0, -0.88, 0.05]}>
          <boxGeometry args={[0.30, 0.06, 0.40]} />
          <meshStandardMaterial color={C.shoeSole} roughness={0.99} />
        </mesh>
      </group>

      {/* ── Gamba destra (pivot all'anca) ── */}
      <group ref={rightLegRef} position={[0.17, 0.98, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.26, 0.44, 0.26]} />
          <meshStandardMaterial color={C.jeans} roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.58, 0]}>
          <boxGeometry args={[0.23, 0.32, 0.23]} />
          <meshStandardMaterial color={C.jeans} roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.80, 0.05]}>
          <boxGeometry args={[0.28, 0.13, 0.38]} />
          <meshStandardMaterial color={C.shoe} roughness={0.95} />
        </mesh>
        <mesh position={[0, -0.88, 0.05]}>
          <boxGeometry args={[0.30, 0.06, 0.40]} />
          <meshStandardMaterial color={C.shoeSole} roughness={0.99} />
        </mesh>
      </group>

      {/* ── Braccio sinistro (pivot alla spalla) ── */}
      <group ref={leftArmRef} position={[-0.52, 1.82, 0]}>
        {/* spalla arrotondata */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.15, 8, 7]} />
          <meshStandardMaterial color={C.jersey} roughness={0.72} />
        </mesh>
        {/* avambraccio */}
        <mesh position={[-0.03, -0.30, 0]}>
          <boxGeometry args={[0.21, 0.48, 0.21]} />
          <meshStandardMaterial color={C.jersey} roughness={0.72} />
        </mesh>
        {/* polso + mano */}
        <mesh position={[-0.03, -0.64, 0]}>
          <boxGeometry args={[0.22, 0.20, 0.22]} />
          <meshStandardMaterial color={C.skin} roughness={0.80} />
        </mesh>
        {/* dita accennate */}
        <mesh position={[-0.03, -0.76, 0.02]}>
          <boxGeometry args={[0.18, 0.09, 0.10]} />
          <meshStandardMaterial color={C.skinDark} roughness={0.85} />
        </mesh>
      </group>

      {/* ── Braccio destro (pivot alla spalla) ── */}
      <group ref={rightArmRef} position={[0.52, 1.82, 0]}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.15, 8, 7]} />
          <meshStandardMaterial color={C.jersey} roughness={0.72} />
        </mesh>
        <mesh position={[0.03, -0.30, 0]}>
          <boxGeometry args={[0.21, 0.48, 0.21]} />
          <meshStandardMaterial color={C.jersey} roughness={0.72} />
        </mesh>
        <mesh position={[0.03, -0.64, 0]}>
          <boxGeometry args={[0.22, 0.20, 0.22]} />
          <meshStandardMaterial color={C.skin} roughness={0.80} />
        </mesh>
        <mesh position={[0.03, -0.76, 0.02]}>
          <boxGeometry args={[0.18, 0.09, 0.10]} />
          <meshStandardMaterial color={C.skinDark} roughness={0.85} />
        </mesh>
      </group>
    </>
  );
}

/* ── Mesh principale del giocatore locale ─────────────────────── */
export function PlayerMesh3D({
  playerRef,
}: {
  playerRef: React.MutableRefObject<{ x: number; z: number }>;
}) {
  const groupRef    = useRef<THREE.Group>(null);
  const time        = useRef(0);
  const prevPos     = useRef({ x: playerRef.current.x, z: playerRef.current.z });
  const facingAngle = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    time.current += delta;

    const px = playerRef.current.x;
    const pz = playerRef.current.z;

    groupRef.current.position.set(px, 0, pz);

    const dx = px - prevPos.current.x;
    const dz = pz - prevPos.current.z;
    if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
      facingAngle.current = Math.atan2(dx, dz);
    }
    groupRef.current.rotation.y = facingAngle.current;
    prevPos.current = { x: px, z: pz };
  });

  return (
    <group ref={groupRef}>
      <WalkingParts timeRef={time} />

      {/* ── Cintura ── */}
      <mesh position={[0, 1.04, 0]}>
        <boxGeometry args={[0.70, 0.16, 0.38]} />
        <meshStandardMaterial color={C.belt} roughness={0.92} metalness={0.12} />
      </mesh>
      {/* fibbia */}
      <mesh position={[0, 1.04, -0.20]}>
        <boxGeometry args={[0.16, 0.12, 0.06]} />
        <meshStandardMaterial color="#c8a800" roughness={0.5} metalness={0.7} />
      </mesh>

      {/* ── Torso — SHADOW CASTER #1 ── */}
      <mesh position={[0, 1.58, 0]} castShadow>
        <boxGeometry args={[0.70, 0.88, 0.38]} />
        <meshStandardMaterial color={C.jersey} roughness={0.72} metalness={0.0} />
      </mesh>
      {/* Striscia bianca jersey (fronte) */}
      <mesh position={[0, 1.58, -0.200]}>
        <boxGeometry args={[0.18, 0.72, 0.02]} />
        <meshStandardMaterial color={C.jerseyTrim} roughness={0.8} />
      </mesh>
      {/* Striscia bianca jersey (retro) */}
      <mesh position={[0, 1.58, 0.200]}>
        <boxGeometry args={[0.18, 0.72, 0.02]} />
        <meshStandardMaterial color={C.jerseyTrim} roughness={0.8} />
      </mesh>

      {/* ── Collo ── */}
      <mesh position={[0, 2.04, 0]}>
        <cylinderGeometry args={[0.13, 0.15, 0.22, 9]} />
        <meshStandardMaterial color={C.skin} roughness={0.80} />
      </mesh>

      {/* ── Testa ── */}
      <mesh position={[0, 2.35, 0]}>
        <boxGeometry args={[0.56, 0.54, 0.50]} />
        <meshStandardMaterial color={C.skin} roughness={0.75} />
      </mesh>

      {/* ── Occhio sinistro ── */}
      <mesh position={[-0.14, 2.39, -0.26]}>
        <boxGeometry args={[0.13, 0.11, 0.04]} />
        <meshStandardMaterial color={C.eyeWhite} roughness={0.6} />
      </mesh>
      <mesh position={[-0.14, 2.37, -0.28]}>
        <sphereGeometry args={[0.045, 6, 5]} />
        <meshStandardMaterial color={C.eye} roughness={0.3} />
      </mesh>
      {/* ── Occhio destro ── */}
      <mesh position={[0.14, 2.39, -0.26]}>
        <boxGeometry args={[0.13, 0.11, 0.04]} />
        <meshStandardMaterial color={C.eyeWhite} roughness={0.6} />
      </mesh>
      <mesh position={[0.14, 2.37, -0.28]}>
        <sphereGeometry args={[0.045, 6, 5]} />
        <meshStandardMaterial color={C.eye} roughness={0.3} />
      </mesh>

      {/* ── Naso ── */}
      <mesh position={[0, 2.32, -0.27]}>
        <boxGeometry args={[0.07, 0.07, 0.06]} />
        <meshStandardMaterial color={C.skinDark} roughness={0.85} />
      </mesh>

      {/* ── Bocca ── */}
      <mesh position={[0, 2.22, -0.265]}>
        <boxGeometry args={[0.18, 0.04, 0.04]} />
        <meshStandardMaterial color={C.mouth} roughness={0.7} />
      </mesh>

      {/* ── Capelli (sopra la testa) ── */}
      <mesh position={[0, 2.64, 0.01]}>
        <boxGeometry args={[0.54, 0.16, 0.48]} />
        <meshStandardMaterial color={C.hair} roughness={0.98} />
      </mesh>
      {/* ciuffo frontale */}
      <mesh position={[0, 2.62, -0.24]}>
        <boxGeometry args={[0.44, 0.20, 0.10]} />
        <meshStandardMaterial color={C.hair} roughness={0.98} />
      </mesh>

      {/* ── Cappello (tesa + corpo) ── */}
      <mesh position={[0, 2.76, 0]}>
        <boxGeometry args={[0.70, 0.09, 0.66]} />
        <meshStandardMaterial color={C.hatBrim} roughness={0.85} metalness={0.08} />
      </mesh>
      <mesh position={[0, 2.96, 0]}>
        <cylinderGeometry args={[0.21, 0.24, 0.38, 10]} />
        <meshStandardMaterial color={C.hatBody} roughness={0.85} metalness={0.08} />
      </mesh>
      {/* banda decorativa cappello */}
      <mesh position={[0, 2.95, 0]}>
        <cylinderGeometry args={[0.245, 0.245, 0.08, 10]} />
        <meshStandardMaterial color={C.jerseyTrim} roughness={0.7} />
      </mesh>

      {/* ── Ombra blob sul pavimento ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.62, 14]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.20} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ── Telecamera terza persona con zoom e rotazione ────────────── */
export function PlayerCamera3D({
  playerRef,
  cameraYawRef,
  mobileCamRotateRef,
}: {
  playerRef: React.MutableRefObject<{ x: number; z: number }>;
  cameraYawRef?: React.MutableRefObject<number>;
  mobileCamRotateRef?: React.MutableRefObject<boolean>;
}) {
  const { camera } = useThree();
  const yawRef     = useRef(0);
  const pitchRef   = useRef(0.55);
  const distRef    = useRef(18);
  const isDragging = useRef(false);
  const lastMouse  = useRef({ x: 0, y: 0 });
  const pinchDist  = useRef<number | null>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      lastMouse.current  = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      yawRef.current  -= (e.clientX - lastMouse.current.x) * 0.005;
      pitchRef.current = Math.max(0.18, Math.min(1.15,
        pitchRef.current + (e.clientY - lastMouse.current.y) * 0.005,
      ));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp   = () => { isDragging.current = false; };
    const onWheel     = (e: WheelEvent) => {
      distRef.current = Math.max(6, Math.min(45, distRef.current + e.deltaY * 0.04));
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dz = e.touches[0].clientY - e.touches[1].clientY;
        pinchDist.current = Math.sqrt(dx * dx + dz * dz);
        isDragging.current = false;
      } else if (e.touches.length === 1 && mobileCamRotateRef?.current) {
        isDragging.current = true;
        lastMouse.current  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        pinchDist.current  = null;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchDist.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dz = e.touches[0].clientY - e.touches[1].clientY;
        const newDist = Math.sqrt(dx * dx + dz * dz);
        const delta   = pinchDist.current - newDist;
        distRef.current = Math.max(6, Math.min(45, distRef.current + delta * 0.06));
        pinchDist.current = newDist;
      } else if (e.touches.length === 1 && isDragging.current) {
        yawRef.current  -= (e.touches[0].clientX - lastMouse.current.x) * 0.005;
        pitchRef.current = Math.max(0.18, Math.min(1.15,
          pitchRef.current + (e.touches[0].clientY - lastMouse.current.y) * 0.005,
        ));
        lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchDist.current = null;
      if (e.touches.length === 0) isDragging.current = false;
    };

    window.addEventListener('mousedown',  onMouseDown);
    window.addEventListener('mousemove',  onMouseMove);
    window.addEventListener('mouseup',    onMouseUp);
    window.addEventListener('wheel',      onWheel,      { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove',  onTouchMove,  { passive: true });
    window.addEventListener('touchend',   onTouchEnd);
    return () => {
      window.removeEventListener('mousedown',  onMouseDown);
      window.removeEventListener('mousemove',  onMouseMove);
      window.removeEventListener('mouseup',    onMouseUp);
      window.removeEventListener('wheel',      onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove',  onTouchMove);
      window.removeEventListener('touchend',   onTouchEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const targetCam  = useRef(new THREE.Vector3());
  const currentCam = useRef(new THREE.Vector3());

  useFrame(() => {
    const px   = playerRef.current.x;
    const pz   = playerRef.current.z;
    const dist = distRef.current;
    const h    = dist * Math.tan(pitchRef.current);

    targetCam.current.set(
      px + Math.sin(yawRef.current) * dist,
      h + 2,
      pz + Math.cos(yawRef.current) * dist,
    );
    currentCam.current.lerp(targetCam.current, 0.1);
    camera.position.copy(currentCam.current);
    camera.lookAt(px, 1.5, pz);

    if (cameraYawRef) cameraYawRef.current = yawRef.current;
  });

  return null;
}
