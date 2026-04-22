/**
 * StoryWorld3D — React Three Fiber Canvas entry point for the 3D open-world map.
 *
 * Architecture:
 *   StoryWorldMap (parent) ──► StoryWorld3D (Canvas)
 *                                 └── World3DScene (World3DScene.tsx)
 *                                       ├── DayNight3D   (PBR lighting + sky + shadows)
 *                                       ├── Terrain3D    (128×128 heightmap + biome tint + grass tex)
 *                                       ├── Roads3D      (asphalt texture strips)
 *                                       ├── Buildings3D  (wood texture + windows + cornices)
 *                                       ├── Trees3D      (3-layer instanced foliage)
 *                                       ├── WaterPlane3D (animated lake surface)
 *                                       ├── Arenas3D     (columns + energy rings + gem)
 *                                       ├── Collectibles3D (PBR coins & cards)
 *                                       ├── OtherPlayers3D
 *                                       ├── PlayerMesh3D   (PS2-style humanoid with arms)
 *                                       ├── PlayerCamera3D
 *                                       ├── FootballField3D
 *                                       ├── ArcadeLights3D
 *                                       └── EffectComposer (Bloom + Vignette + ChromaticAberration)
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

/* ── Canvas entry point ───────────────────────────────────────── */
export function StoryWorld3D(props: StoryWorld3DProps) {
  return (
    <Canvas
      style={{ position: 'absolute', inset: 0 }}
      dpr={[1, 1.5]}
      shadows
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 18, 30], fov: 55, near: 0.5, far: 500 }}
    >
      <World3DScene {...props} />
    </Canvas>
  );
}
