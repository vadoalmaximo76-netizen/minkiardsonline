import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AvatarGLB } from './AvatarGLB';

/* ── Per-user jersey colour palette ─────────────────────────────── */
const JERSEY_PALETTE = [
  '#e74c3c', '#2980b9', '#27ae60', '#e67e22', '#8e44ad',
  '#16a085', '#e91e63', '#d35400', '#006064', '#f1c40f',
  '#00897b', '#6d4c41', '#0288d1', '#558b2f', '#ad1457',
];

export function avatarColor(userId?: number): string {
  if (!userId) return '#e67e22';
  return JERSEY_PALETTE[userId % JERSEY_PALETTE.length];
}

/* ── Fixed material constants ───────────────────────────────────── */
const SKIN      = '#f5c99a';
const SKIN_DARK = '#d4a574';
const HAIR      = '#1a0a00';
const JEANS     = '#1a3a6b';
const SHOE      = '#1a1a1a';
const SHOE_SOLE = '#2d2d2d';
const HAT_BODY  = '#1a1a2e';
const HAT_BRIM  = '#252540';
const HAT_BAND  = '#f0f0f0';
const EYE_W     = '#f5f5f5';
const BELT      = '#2c1500';
const BUCKLE    = '#c8a800';

/* ── Animated limbs (pivot-based, driven by timeRef) ─────────────── */
export function WalkingParts({
  timeRef,
  jersey,
}: {
  timeRef: React.MutableRefObject<number>;
  jersey: string;
}) {
  const llRef = useRef<THREE.Group>(null);
  const rlRef = useRef<THREE.Group>(null);
  const laRef = useRef<THREE.Group>(null);
  const raRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const t = timeRef.current * 5.5;
    if (llRef.current) llRef.current.rotation.x =  Math.sin(t) * 0.44;
    if (rlRef.current) rlRef.current.rotation.x = -Math.sin(t) * 0.44;
    if (laRef.current) laRef.current.rotation.x = -Math.sin(t) * 0.40;
    if (raRef.current) raRef.current.rotation.x =  Math.sin(t) * 0.40;
  });

  return (
    <>
      {/* ── Left leg (pivot at hip) ── */}
      <group ref={llRef} position={[-0.17, 1.08, 0]}>
        <mesh position={[0, -0.26, 0]}>
          <capsuleGeometry args={[0.12, 0.44, 4, 8]} />
          <meshStandardMaterial color={JEANS} roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.55, 0]}>
          <sphereGeometry args={[0.12, 8, 6]} />
          <meshStandardMaterial color={JEANS} roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.76, 0]}>
          <capsuleGeometry args={[0.10, 0.30, 4, 8]} />
          <meshStandardMaterial color={JEANS} roughness={0.85} />
        </mesh>
        <mesh position={[0, -1.00, 0.05]}>
          <boxGeometry args={[0.25, 0.12, 0.40]} />
          <meshStandardMaterial color={SHOE} roughness={0.95} />
        </mesh>
        <mesh position={[0, -1.06, 0.05]}>
          <boxGeometry args={[0.27, 0.055, 0.42]} />
          <meshStandardMaterial color={SHOE_SOLE} roughness={0.99} />
        </mesh>
      </group>

      {/* ── Right leg (pivot at hip) ── */}
      <group ref={rlRef} position={[0.17, 1.08, 0]}>
        <mesh position={[0, -0.26, 0]}>
          <capsuleGeometry args={[0.12, 0.44, 4, 8]} />
          <meshStandardMaterial color={JEANS} roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.55, 0]}>
          <sphereGeometry args={[0.12, 8, 6]} />
          <meshStandardMaterial color={JEANS} roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.76, 0]}>
          <capsuleGeometry args={[0.10, 0.30, 4, 8]} />
          <meshStandardMaterial color={JEANS} roughness={0.85} />
        </mesh>
        <mesh position={[0, -1.00, 0.05]}>
          <boxGeometry args={[0.25, 0.12, 0.40]} />
          <meshStandardMaterial color={SHOE} roughness={0.95} />
        </mesh>
        <mesh position={[0, -1.06, 0.05]}>
          <boxGeometry args={[0.27, 0.055, 0.42]} />
          <meshStandardMaterial color={SHOE_SOLE} roughness={0.99} />
        </mesh>
      </group>

      {/* ── Left arm (pivot at shoulder) ── */}
      <group ref={laRef} position={[-0.50, 1.82, 0]}>
        <mesh>
          <sphereGeometry args={[0.13, 8, 7]} />
          <meshStandardMaterial color={jersey} roughness={0.70} />
        </mesh>
        <mesh position={[0, -0.24, 0]}>
          <capsuleGeometry args={[0.10, 0.32, 4, 8]} />
          <meshStandardMaterial color={jersey} roughness={0.70} />
        </mesh>
        <mesh position={[0, -0.48, 0]}>
          <sphereGeometry args={[0.095, 8, 6]} />
          <meshStandardMaterial color={jersey} roughness={0.70} />
        </mesh>
        <mesh position={[0, -0.66, 0]}>
          <capsuleGeometry args={[0.08, 0.26, 4, 8]} />
          <meshStandardMaterial color={SKIN} roughness={0.80} />
        </mesh>
        <mesh position={[0, -0.84, 0]}>
          <sphereGeometry args={[0.09, 8, 7]} />
          <meshStandardMaterial color={SKIN} roughness={0.80} />
        </mesh>
      </group>

      {/* ── Right arm (pivot at shoulder) ── */}
      <group ref={raRef} position={[0.50, 1.82, 0]}>
        <mesh>
          <sphereGeometry args={[0.13, 8, 7]} />
          <meshStandardMaterial color={jersey} roughness={0.70} />
        </mesh>
        <mesh position={[0, -0.24, 0]}>
          <capsuleGeometry args={[0.10, 0.32, 4, 8]} />
          <meshStandardMaterial color={jersey} roughness={0.70} />
        </mesh>
        <mesh position={[0, -0.48, 0]}>
          <sphereGeometry args={[0.095, 8, 6]} />
          <meshStandardMaterial color={jersey} roughness={0.70} />
        </mesh>
        <mesh position={[0, -0.66, 0]}>
          <capsuleGeometry args={[0.08, 0.26, 4, 8]} />
          <meshStandardMaterial color={SKIN} roughness={0.80} />
        </mesh>
        <mesh position={[0, -0.84, 0]}>
          <sphereGeometry args={[0.09, 8, 7]} />
          <meshStandardMaterial color={SKIN} roughness={0.80} />
        </mesh>
      </group>
    </>
  );
}

/* ── Static character body (torso, head, accessories) ─────────────── */
export function CharacterBody({ jersey }: { jersey: string }) {
  const trim = '#f0f0f0';
  return (
    <>
      {/* Hips */}
      <mesh position={[0, 1.08, 0]}>
        <capsuleGeometry args={[0.21, 0.22, 4, 10]} />
        <meshStandardMaterial color={JEANS} roughness={0.85} />
      </mesh>

      {/* Belt */}
      <mesh position={[0, 1.22, 0]}>
        <cylinderGeometry args={[0.235, 0.235, 0.09, 14]} />
        <meshStandardMaterial color={BELT} roughness={0.90} metalness={0.10} />
      </mesh>
      <mesh position={[0, 1.22, -0.235]}>
        <boxGeometry args={[0.13, 0.09, 0.04]} />
        <meshStandardMaterial color={BUCKLE} roughness={0.45} metalness={0.75} />
      </mesh>

      {/* Torso — capsule for a rounder look */}
      <mesh position={[0, 1.65, 0]} castShadow>
        <capsuleGeometry args={[0.27, 0.68, 4, 12]} />
        <meshStandardMaterial color={jersey} roughness={0.70} metalness={0.0} />
      </mesh>

      {/* Jersey centre stripe */}
      <mesh position={[0, 1.65, -0.275]}>
        <planeGeometry args={[0.14, 0.55]} />
        <meshStandardMaterial color={trim} roughness={0.80} side={THREE.DoubleSide} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 2.10, 0]}>
        <capsuleGeometry args={[0.095, 0.18, 4, 8]} />
        <meshStandardMaterial color={SKIN} roughness={0.80} />
      </mesh>

      {/* Head — sphere for organic feel */}
      <mesh position={[0, 2.40, 0]} castShadow>
        <sphereGeometry args={[0.295, 14, 12]} />
        <meshStandardMaterial color={SKIN} roughness={0.72} />
      </mesh>

      {/* Left eye white */}
      <mesh position={[-0.115, 2.46, -0.255]}>
        <sphereGeometry args={[0.060, 8, 6]} />
        <meshStandardMaterial color={EYE_W} roughness={0.25} />
      </mesh>
      {/* Left iris */}
      <mesh position={[-0.115, 2.455, -0.285]}>
        <sphereGeometry args={[0.035, 7, 5]} />
        <meshStandardMaterial color={HAIR} roughness={0.15} />
      </mesh>

      {/* Right eye white */}
      <mesh position={[0.115, 2.46, -0.255]}>
        <sphereGeometry args={[0.060, 8, 6]} />
        <meshStandardMaterial color={EYE_W} roughness={0.25} />
      </mesh>
      {/* Right iris */}
      <mesh position={[0.115, 2.455, -0.285]}>
        <sphereGeometry args={[0.035, 7, 5]} />
        <meshStandardMaterial color={HAIR} roughness={0.15} />
      </mesh>

      {/* Eyebrow left */}
      <mesh position={[-0.115, 2.53, -0.270]} rotation={[0, 0, 0.18]}>
        <boxGeometry args={[0.095, 0.022, 0.025]} />
        <meshStandardMaterial color={HAIR} roughness={0.90} />
      </mesh>
      {/* Eyebrow right */}
      <mesh position={[0.115, 2.53, -0.270]} rotation={[0, 0, -0.18]}>
        <boxGeometry args={[0.095, 0.022, 0.025]} />
        <meshStandardMaterial color={HAIR} roughness={0.90} />
      </mesh>

      {/* Nose */}
      <mesh position={[0, 2.38, -0.295]}>
        <sphereGeometry args={[0.035, 6, 5]} />
        <meshStandardMaterial color={SKIN_DARK} roughness={0.85} />
      </mesh>

      {/* Mouth */}
      <mesh position={[0, 2.30, -0.285]}>
        <boxGeometry args={[0.13, 0.035, 0.025]} />
        <meshStandardMaterial color="#8b3a3a" roughness={0.70} />
      </mesh>

      {/* Hair — sphere cap slightly larger than head */}
      <mesh position={[0, 2.52, 0]}>
        <sphereGeometry args={[0.31, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={HAIR} roughness={0.98} />
      </mesh>
      {/* Hair front tuft */}
      <mesh position={[0, 2.60, -0.22]} rotation={[0.35, 0, 0]}>
        <capsuleGeometry args={[0.07, 0.16, 4, 6]} />
        <meshStandardMaterial color={HAIR} roughness={0.98} />
      </mesh>

      {/* Hat brim */}
      <mesh position={[0, 2.83, 0]}>
        <cylinderGeometry args={[0.44, 0.44, 0.055, 16]} />
        <meshStandardMaterial color={HAT_BRIM} roughness={0.82} metalness={0.08} />
      </mesh>
      {/* Hat body */}
      <mesh position={[0, 3.06, 0]}>
        <cylinderGeometry args={[0.225, 0.255, 0.44, 14]} />
        <meshStandardMaterial color={HAT_BODY} roughness={0.82} metalness={0.08} />
      </mesh>
      {/* Hat band */}
      <mesh position={[0, 2.98, 0]}>
        <cylinderGeometry args={[0.258, 0.258, 0.09, 14]} />
        <meshStandardMaterial color={HAT_BAND} roughness={0.65} />
      </mesh>

      {/* Blob shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.60, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </>
  );
}

/* ── Local player mesh ───────────────────────────────────────────── */
export function PlayerMesh3D({
  playerRef,
  userId,
}: {
  playerRef: React.MutableRefObject<{ x: number; z: number }>;
  userId?: number;
}) {
  const groupRef    = useRef<THREE.Group>(null);
  const time        = useRef(0);
  const prevPos     = useRef({ x: playerRef.current.x, z: playerRef.current.z });
  const facingAngle = useRef(0);
  const movingRef   = useRef(false);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    time.current += delta;

    const px = playerRef.current.x;
    const pz = playerRef.current.z;
    groupRef.current.position.set(px, 0, pz);

    const dx = px - prevPos.current.x;
    const dz = pz - prevPos.current.z;
    const isMoving = Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001;
    movingRef.current = isMoving;
    if (isMoving) {
      facingAngle.current = Math.atan2(dx, dz);
    }
    groupRef.current.rotation.y = facingAngle.current;
    prevPos.current = { x: px, z: pz };
  });

  return (
    <group ref={groupRef}>
      <AvatarGLB userId={userId} movingRef={movingRef} timeRef={time} />
    </group>
  );
}

/* ── Third-person camera ─────────────────────────────────────────── */
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
    const onMouseUp = () => { isDragging.current = false; };
    const onWheel   = (e: WheelEvent) => {
      distRef.current = Math.max(6, Math.min(45, distRef.current + e.deltaY * 0.04));
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dz = e.touches[0].clientY - e.touches[1].clientY;
        pinchDist.current  = Math.sqrt(dx * dx + dz * dz);
        isDragging.current = false;
      } else if (e.touches.length === 1 && mobileCamRotateRef?.current) {
        isDragging.current = true;
        lastMouse.current  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        pinchDist.current  = null;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchDist.current !== null) {
        const dx  = e.touches[0].clientX - e.touches[1].clientX;
        const dz  = e.touches[0].clientY - e.touches[1].clientY;
        const nd  = Math.sqrt(dx * dx + dz * dz);
        distRef.current   = Math.max(6, Math.min(45, distRef.current + (pinchDist.current - nd) * 0.06));
        pinchDist.current = nd;
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
