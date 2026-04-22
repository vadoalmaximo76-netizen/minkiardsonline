import React, { useRef } from 'react';
import { useFrame }       from '@react-three/fiber';
import { Text }           from '@react-three/drei';
import * as THREE         from 'three';
import type { StoryWorldCollectible } from './types';

const PICKUP_RADIUS = 2.8; // world units — trigger proximity pickup

export function Collectibles3D({
  collectibles,
  playerRef,
  onClickCollectible,
}: {
  collectibles: StoryWorldCollectible[];
  playerRef?: React.MutableRefObject<{ x: number; z: number }>;
  onClickCollectible: (c: StoryWorldCollectible) => void;
}) {
  const time      = useRef(0);
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const collected = useRef(new Set<string | number>());

  useFrame((_, delta) => {
    time.current += delta;

    /* Animate all visible collectibles */
    groupRefs.current.forEach((g, i) => {
      if (!g) return;
      g.position.y = 1.5 + Math.sin(time.current * 2 + i * 1.2) * 0.25;
      g.rotation.y = time.current * 1.8;
    });

    /* Proximity pickup: trigger callback when player walks within range */
    if (!playerRef) return;
    const px = playerRef.current.x;
    const pz = playerRef.current.z;

    collectibles.forEach(c => {
      if (collected.current.has(c.id)) return;
      const dx   = px - c.posX;
      const dz   = pz - c.posZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= PICKUP_RADIUS) {
        collected.current.add(c.id);
        onClickCollectible(c);
      }
    });
  });

  return (
    <group>
      {collectibles.map((c, i) => {
        const isCoin = c.type === 'coin' || ((c.creditValue ?? 0) > 0 && !c.cardId);
        const color  = isCoin ? '#fbbf24' : '#a855f7';
        const label  = isCoin ? `+${c.creditValue ?? '?'}` : '🃏';

        return (
          <group
            key={c.id}
            ref={el => { groupRefs.current[i] = el; }}
            position={[c.posX, 1.5, c.posZ]}
            /* Click interaction still supported as fallback */
            onClick={(e) => { e.stopPropagation(); onClickCollectible(c); }}
          >
            {isCoin ? (
              /* Gold coin: thin disk */
              <mesh>
                <cylinderGeometry args={[0.45, 0.45, 0.12, 16]} />
                <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.8} />
              </mesh>
            ) : (
              /* Card: thin rectangle with face colour */
              <mesh>
                <boxGeometry args={[0.5, 0.72, 0.04]} />
                <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.7} />
              </mesh>
            )}

            <pointLight color={color} intensity={2} distance={8} />

            <Text
              position={[0, 0.9, 0]}
              fontSize={0.4}
              color={color}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.05}
              outlineColor="#000000"
            >
              {label}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
