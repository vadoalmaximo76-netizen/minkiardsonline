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
