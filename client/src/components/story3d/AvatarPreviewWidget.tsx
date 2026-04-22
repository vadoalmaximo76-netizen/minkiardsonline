import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { avatarIndex, AVATAR_NAMES } from './avatarMeta';

/* ── Spinning avatar model inside the Canvas ─────────────────────── */
function SpinningAvatar({ userId }: { userId?: number }) {
  const idx  = avatarIndex(userId);
  const path = `/models/avatars/avatar_${idx}.glb`;
  const { scene } = useGLTF(path);
  const groupRef  = useRef<THREE.Group>(null);

  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.8;
    }
  });

  return (
    <group ref={groupRef} scale={[2.5, 2.5, 2.5]} position={[0, -1.1, 0]}>
      <primitive object={scene} />
    </group>
  );
}

/* ── Fallback while GLB loads ────────────────────────────────────── */
function AvatarFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.6, 1.0, 0.6]} />
      <meshStandardMaterial color="#7c3aed" />
    </mesh>
  );
}

/* ── Public widget ───────────────────────────────────────────────── */
interface AvatarPreviewWidgetProps {
  userId?: number;
  /** Size of the square canvas in px. Default 72. */
  size?: number;
}

export function AvatarPreviewWidget({ userId, size = 72 }: AvatarPreviewWidgetProps) {
  const idx  = avatarIndex(userId);
  const name = AVATAR_NAMES[idx] ?? `Avatar ${idx}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        flexShrink: 0,
      }}
      title={`Il tuo avatar: ${name}`}
    >
      {/* Mini 3D canvas */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid rgba(167,139,250,0.35)',
          background: 'linear-gradient(135deg, rgba(30,10,60,0.85) 0%, rgba(10,5,30,0.95) 100%)',
          boxShadow: '0 0 10px rgba(139,92,246,0.25)',
          position: 'relative',
        }}
      >
        <Canvas
          camera={{ position: [0, 0.6, 3.2], fov: 42 }}
          gl={{ antialias: true, alpha: true }}
          style={{ width: '100%', height: '100%' }}
          dpr={Math.min(window.devicePixelRatio, 2)}
        >
          <ambientLight intensity={1.2} />
          <directionalLight position={[3, 5, 3]} intensity={1.4} />
          <Suspense fallback={<AvatarFallback />}>
            <SpinningAvatar userId={userId} />
          </Suspense>
        </Canvas>
      </div>

      {/* Avatar name label */}
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: '#c4b5fd',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          maxWidth: size,
          textAlign: 'center',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {name}
      </span>
    </div>
  );
}
