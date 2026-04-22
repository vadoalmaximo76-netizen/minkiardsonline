import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ── Walking parts: legs + arms animated in sync ──────────────── */
function WalkingParts({ timeRef }: { timeRef: React.MutableRefObject<number> }) {
  const leftLegRef  = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef  = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const t = timeRef.current * 5;
    if (leftLegRef.current)  leftLegRef.current.position.z  = Math.sin(t) * 0.14;
    if (rightLegRef.current) rightLegRef.current.position.z = Math.sin(t + Math.PI) * 0.14;
    if (leftArmRef.current)  leftArmRef.current.rotation.x  = Math.sin(t + Math.PI) * 0.38;
    if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t) * 0.38;
  });

  return (
    <>
      {/* Left leg */}
      <mesh ref={leftLegRef} position={[-0.18, 0.62, 0]} castShadow>
        <boxGeometry args={[0.25, 0.7, 0.25]} />
        <meshStandardMaterial color="#1a237e" roughness={0.8} metalness={0.0} />
      </mesh>
      {/* Right leg */}
      <mesh ref={rightLegRef} position={[0.18, 0.62, 0]} castShadow>
        <boxGeometry args={[0.25, 0.7, 0.25]} />
        <meshStandardMaterial color="#1a237e" roughness={0.8} metalness={0.0} />
      </mesh>
      {/* Left shoe */}
      <mesh position={[-0.18, 0.24, 0.08]}>
        <boxGeometry args={[0.27, 0.13, 0.36]} />
        <meshStandardMaterial color="#111111" roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Right shoe */}
      <mesh position={[0.18, 0.24, 0.08]}>
        <boxGeometry args={[0.27, 0.13, 0.36]} />
        <meshStandardMaterial color="#111111" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Left arm group — pivot at shoulder */}
      <group ref={leftArmRef} position={[-0.54, 1.88, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.23, 0.55, 0.23]} />
          <meshStandardMaterial color="#e8b800" roughness={0.7} metalness={0.0} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.62, 0]}>
          <boxGeometry args={[0.21, 0.21, 0.21]} />
          <meshStandardMaterial color="#fcd7b0" roughness={0.8} metalness={0.0} />
        </mesh>
      </group>

      {/* Right arm group — pivot at shoulder */}
      <group ref={rightArmRef} position={[0.54, 1.88, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.23, 0.55, 0.23]} />
          <meshStandardMaterial color="#e8b800" roughness={0.7} metalness={0.0} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.62, 0]}>
          <boxGeometry args={[0.21, 0.21, 0.21]} />
          <meshStandardMaterial color="#fcd7b0" roughness={0.8} metalness={0.0} />
        </mesh>
      </group>
    </>
  );
}

/* ── Local player mesh — absolute world position set each frame ── */
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

      {/* Belt / waist */}
      <mesh position={[0, 1.08, 0]}>
        <boxGeometry args={[0.66, 0.18, 0.38]} />
        <meshStandardMaterial color="#3a1a00" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Torso */}
      <mesh position={[0, 1.55, 0]} castShadow>
        <boxGeometry args={[0.68, 0.84, 0.38]} />
        <meshStandardMaterial color="#e8b800" roughness={0.7} metalness={0.0} />
      </mesh>

      {/* Collar */}
      <mesh position={[0, 1.97, 0]}>
        <boxGeometry args={[0.50, 0.22, 0.36]} />
        <meshStandardMaterial color="#fcd7b0" roughness={0.8} metalness={0.0} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 2.10, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.2, 8]} />
        <meshStandardMaterial color="#fcd7b0" roughness={0.8} metalness={0.0} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 2.32, 0]} castShadow>
        <sphereGeometry args={[0.32, 14, 12]} />
        <meshStandardMaterial color="#fcd7b0" roughness={0.75} metalness={0.0} />
      </mesh>

      {/* Hair */}
      <mesh position={[0, 2.56, -0.04]}>
        <sphereGeometry args={[0.26, 10, 8]} />
        <meshStandardMaterial color="#2c1a0e" roughness={0.95} metalness={0.0} />
      </mesh>

      {/* Hat brim */}
      <mesh position={[0, 2.68, 0]}>
        <cylinderGeometry args={[0.18, 0.30, 0.30, 10]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Hat flat top */}
      <mesh position={[0, 2.90, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.08, 10]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Blob shadow on ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.62, 14]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ── Third-person follow camera with zoom + camera-rotate ─────── */
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
