/**
 * StoryWorld3D — React Three Fiber Canvas entry point for the 3D open-world map.
 *
 * Architecture:
 *   StoryWorldMap (parent) ──► StoryWorld3D (Canvas)
 *                                 └── World3DScene (World3DScene.tsx)
 *                                       ├── DayNight3D   (lighting + sky)
 *                                       ├── Terrain3D    (heightmap + biome colours)
 *                                       ├── Roads3D      (asphalt strips)
 *                                       ├── Buildings3D  (instanced city blocks)
 *                                       ├── Trees3D      (instanced foliage)
 *                                       ├── Arenas3D     (gym leader portals)
 *                                       ├── Collectibles3D (coins & cards, proximity pickup)
 *                                       ├── OtherPlayers3D (online avatars)
 *                                       ├── PlayerMesh3D   (local character)
 *                                       ├── PlayerCamera3D (third-person follow)
 *                                       ├── FootballField3D
 *                                       ├── ArcadeLights3D
 *                                       └── EffectComposer (Bloom + ToneMapping)
 *
 * Game-loop logic (WASD movement, collision, socket, proximity detection)
 * lives in StoryWorldMap.tsx via requestAnimationFrame.  StoryWorld3D reads
 * the shared playerRef every Three.js frame — no duplicate loop.
 * cameraYawRef is written by PlayerCamera3D so the RAF tick can apply
 * camera-relative movement direction.
 */

import React from 'react';
import { Canvas } from '@react-three/fiber';

import { World3DScene } from './World3DScene';

export type {
  StoryWorldBuildingDatum,
  StoryWorldTreeDatum,
  StoryWorldRoadDatum,
  StoryWorldCollectible,
  StoryWorld3DProps,
} from './types';

import type { StoryWorld3DProps } from './types';

/* ── Canvas entry point ───────────────────────────────────────────── */
export function StoryWorld3D(props: StoryWorld3DProps) {
  return (
    <Canvas
      style={{ position: 'absolute', inset: 0 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 18, 30], fov: 55, near: 0.5, far: 500 }}
    >
      <World3DScene {...props} />
    </Canvas>
  );
}
