import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ── Walking legs ─────────────────────────────────────────────── */
function WalkingLegs({ timeRef }: { timeRef: React.MutableRefObject<number> }) {
  const leftRef  = useRef<THREE.Mesh>(null);
  const rightRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const t = timeRef.current * 5;
    if (leftRef.current)  leftRef.current.position.z  = Math.sin(t) * 0.12;
    if (rightRef.current) rightRef.current.position.z = Math.sin(t + Math.PI) * 0.12;
  });

  return (
    <>
      <mesh ref={leftRef}  position={[-0.15, 0.7, 0]}>
        <boxGeometry args={[0.22, 0.65, 0.22]} />
        <meshLambertMaterial color="#1a237e" />
      </mesh>
      <mesh ref={rightRef} position={[ 0.15, 0.7, 0]}>
        <boxGeometry args={[0.22, 0.65, 0.22]} />
        <meshLambertMaterial color="#1a237e" />
      </mesh>
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

    /* Absolute world position — group has no transform-bearing parent */
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
      <WalkingLegs timeRef={time} />
      {/* Torso */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[0.6, 0.9, 0.35]} />
        <meshLambertMaterial color="#e8b800" />
      </mesh>
      {/* Head */}
      <mesh position={[0, 2.25, 0]}>
        <sphereGeometry args={[0.3, 10, 10]} />
        <meshLambertMaterial color="#fcd7b0" />
      </mesh>
      {/* Hat brim */}
      <mesh position={[0, 2.58, 0]}>
        <cylinderGeometry args={[0.22, 0.32, 0.28, 8]} />
        <meshLambertMaterial color="#1a1a2e" />
      </mesh>
      {/* Blob shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.6, 12]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

/* ── Third-person follow camera ───────────────────────────────── */
export function PlayerCamera3D({
  playerRef,
  cameraYawRef,
}: {
  playerRef: React.MutableRefObject<{ x: number; z: number }>;
  cameraYawRef?: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  const yawRef     = useRef(0);
  const pitchRef   = useRef(0.55);
  const isDragging = useRef(false);
  const lastMouse  = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      lastMouse.current  = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      yawRef.current  -= (e.clientX - lastMouse.current.x) * 0.005;
      pitchRef.current = Math.max(0.2, Math.min(1.1,
        pitchRef.current + (e.clientY - lastMouse.current.y) * 0.005,
      ));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { isDragging.current = false; };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        lastMouse.current  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || e.touches.length !== 1) return;
      yawRef.current  -= (e.touches[0].clientX - lastMouse.current.x) * 0.005;
      pitchRef.current = Math.max(0.2, Math.min(1.1,
        pitchRef.current + (e.touches[0].clientY - lastMouse.current.y) * 0.005,
      ));
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = () => { isDragging.current = false; };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove',  onTouchMove,  { passive: true });
    window.addEventListener('touchend',   onTouchEnd);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove',  onTouchMove);
      window.removeEventListener('touchend',   onTouchEnd);
    };
  }, []);

  const targetCam  = useRef(new THREE.Vector3());
  const currentCam = useRef(new THREE.Vector3());

  useFrame(() => {
    const px   = playerRef.current.x;
    const pz   = playerRef.current.z;
    const dist = 18;
    const h    = dist * Math.tan(pitchRef.current);

    targetCam.current.set(
      px + Math.sin(yawRef.current) * dist,
      h + 2,
      pz + Math.cos(yawRef.current) * dist,
    );
    currentCam.current.lerp(targetCam.current, 0.1);
    camera.position.copy(currentCam.current);
    camera.lookAt(px, 1.5, pz);

    /* Expose camera yaw so the RAF tick can rotate joystick input */
    if (cameraYawRef) cameraYawRef.current = yawRef.current;
  });

  return null;
}
