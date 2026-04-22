import React from 'react';
import type { BuildingType, StoryWorldBuildingDatum } from './types';

const BODY_HEIGHT: Record<BuildingType, number> = {
  house: 4, shop: 3, inn: 4.5, tower: 10, ruin: 2,
  church: 7, arcade: 4, farm: 3, barn: 5,
};
const BODY_COLOR: Record<BuildingType, string> = {
  house: '#c8a87a', shop: '#b8d4f0', inn: '#d4c88a', tower: '#9a9a9a',
  ruin: '#7a7060', church: '#f0e8d0', arcade: '#2d1a4e', farm: '#d4b878', barn: '#c87840',
};
const ROOF_COLOR: Record<BuildingType, string> = {
  house: '#8b5e3c', shop: '#4a80c0', inn: '#8b6020', tower: '#444444',
  ruin: '#4a4030', church: '#c04040', arcade: '#7c3aed', farm: '#8b5a1a', barn: '#6b2a10',
};

export function Buildings3D({ buildings }: { buildings: StoryWorldBuildingDatum[] }) {
  return (
    <group>
      {buildings.map((b, i) => {
        const bh = BODY_HEIGHT[b.type];
        const bw = b.w;
        const bd = b.h;
        const isRuin = b.type === 'ruin';

        return (
          <group key={i} position={[b.x, 0, b.z]}>
            {/* Body */}
            <mesh position={[0, bh / 2, 0]}>
              <boxGeometry args={[bw, bh, bd]} />
              <meshLambertMaterial color={BODY_COLOR[b.type]} />
            </mesh>

            {/* Roof pyramid */}
            {!isRuin && (
              <mesh position={[0, bh + 0.8, 0]}>
                <coneGeometry args={[Math.max(bw, bd) * 0.72, 1.6, 4]} />
                <meshLambertMaterial color={ROOF_COLOR[b.type]} />
              </mesh>
            )}

            {/* Church cross */}
            {b.type === 'church' && (
              <>
                <mesh position={[0, bh + 2.2, 0]}>
                  <boxGeometry args={[0.15, 1.5, 0.15]} />
                  <meshLambertMaterial color="#ffffff" />
                </mesh>
                <mesh position={[0, bh + 2.7, 0]}>
                  <boxGeometry args={[0.6, 0.15, 0.15]} />
                  <meshLambertMaterial color="#ffffff" />
                </mesh>
              </>
            )}

            {/* Tower battlements */}
            {b.type === 'tower' && (
              <mesh position={[0, bh + 0.3, 0]}>
                <boxGeometry args={[bw + 0.2, 0.6, bd + 0.2]} />
                <meshLambertMaterial color="#555555" />
              </mesh>
            )}

            {/* Arcade glow sign */}
            {b.type === 'arcade' && (
              <mesh position={[0, bh + 0.1, bd / 2 + 0.05]}>
                <planeGeometry args={[bw * 0.7, 0.5]} />
                <meshBasicMaterial color="#a855f7" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
