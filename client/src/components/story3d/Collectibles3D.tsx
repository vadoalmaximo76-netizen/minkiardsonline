import React, { useRef } from 'react';
import { useFrame }       from '@react-three/fiber';
import { Text }           from '@react-three/drei';
import * as THREE         from 'three';
import type { StoryWorldCollectible } from './types';

const PICKUP_RADIUS = 2.8;

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

    groupRefs.current.forEach((g, i) => {
      if (!g) return;
      g.position.y = 1.5 + Math.sin(time.current * 2 + i * 1.2) * 0.28;
      g.rotation.y = time.current * 2.0;
    });

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
            onClick={(e) => { e.stopPropagation(); onClickCollectible(c); }}
          >
            {isCoin ? (
              /* Gold coin — PBR metallic */
              <>
                <mesh>
                  <cylinderGeometry args={[0.48, 0.48, 0.13, 18]} />
                  <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.9}
                    roughness={0.15}
                    metalness={0.85}
                  />
                </mesh>
                {/* Coin rim */}
                <mesh>
                  <torusGeometry args={[0.44, 0.04, 6, 18]} />
                  <meshStandardMaterial
                    color="#ffdd44"
                    emissive="#ffdd44"
                    emissiveIntensity={0.6}
                    roughness={0.1}
                    metalness={0.9}
                  />
                </mesh>
              </>
            ) : (
              /* Card — slightly shiny */
              <mesh>
                <boxGeometry args={[0.52, 0.74, 0.05]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={0.8}
                  roughness={0.3}
                  metalness={0.4}
                />
              </mesh>
            )}

            <pointLight color={color} intensity={2.5} distance={9} />

            <Text
              position={[0, 0.95, 0]}
              fontSize={0.42}
              color={color}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.06}
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
