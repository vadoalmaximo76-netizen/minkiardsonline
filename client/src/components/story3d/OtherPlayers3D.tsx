import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { OtherPlayer } from './types';

/* Lerps toward target position each frame for smooth movement */
function OtherPlayerMesh({ player }: { player: OtherPlayer }) {
  const groupRef   = useRef<THREE.Group>(null);
  const targetPos  = useRef(new THREE.Vector3(player.x, 0, player.z));

  useFrame((_, delta) => {
    targetPos.current.set(player.x, 0, player.z);
    if (!groupRef.current) return;
    groupRef.current.position.lerp(targetPos.current, Math.min(1, delta * 8));
  });

  return (
    <group ref={groupRef} position={[player.x, 0, player.z]}>
      {/* Body capsule */}
      <mesh position={[0, 1.2, 0]}>
        <capsuleGeometry args={[0.35, 1.2, 4, 8]} />
        <meshLambertMaterial color="#60a5fa" />
      </mesh>
      {/* Head */}
      <mesh position={[0, 2.3, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshLambertMaterial color="#fcd7b0" />
      </mesh>
      {/* Username label */}
      <Text
        position={[0, 3.1, 0]}
        fontSize={0.45}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {player.username}
      </Text>
    </group>
  );
}

export function OtherPlayers3D({
  otherPlayersRef,
  selfUserId,
}: {
  otherPlayersRef: React.MutableRefObject<Map<number, OtherPlayer>>;
  selfUserId?: number;
}) {
  const [playerList, setPlayerList] = useState<OtherPlayer[]>([]);
  const tickRef = useRef(0);

  useFrame((_, delta) => {
    tickRef.current += delta;
    if (tickRef.current < 0.5) return;
    tickRef.current = 0;
    const list = Array.from(otherPlayersRef.current.values()).filter(
      p => p.userId !== selfUserId,
    );
    setPlayerList(list);
  });

  return (
    <group>
      {playerList.map(p => (
        <OtherPlayerMesh key={p.userId} player={p} />
      ))}
    </group>
  );
}
