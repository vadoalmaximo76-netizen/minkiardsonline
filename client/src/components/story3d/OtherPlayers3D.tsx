import React, { useRef, useState } from 'react';
import { useFrame }                from '@react-three/fiber';
import { Text }                    from '@react-three/drei';
import * as THREE                  from 'three';
import type { OtherPlayer }        from './types';
import { WalkingParts, CharacterBody, avatarColor } from './Player3D';

/* Smooth-lerping other-player mesh with full character model */
function OtherPlayerMesh({ player }: { player: OtherPlayer }) {
  const groupRef  = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(player.x, 0, player.z));
  const time      = useRef(Math.random() * 10); // offset so players don't walk in sync
  const jersey    = avatarColor(player.userId);

  useFrame((_, delta) => {
    time.current += delta;
    targetPos.current.set(player.x, 0, player.z);
    if (!groupRef.current) return;
    groupRef.current.position.lerp(targetPos.current, Math.min(1, delta * 8));
  });

  return (
    <group ref={groupRef} position={[player.x, 0, player.z]}>
      <WalkingParts timeRef={time} jersey={jersey} />
      <CharacterBody jersey={jersey} />
      <Text
        position={[0, 3.5, 0]}
        fontSize={0.44}
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
    setPlayerList(
      Array.from(otherPlayersRef.current.values()).filter(p => p.userId !== selfUserId),
    );
  });

  return (
    <group>
      {playerList.map(p => (
        <OtherPlayerMesh key={p.userId} player={p} />
      ))}
    </group>
  );
}
