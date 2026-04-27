import React, { useRef, useState } from 'react';
import { useFrame }                from '@react-three/fiber';
import { Text }                    from '@react-three/drei';
import * as THREE                  from 'three';
import type { OtherPlayer }        from './types';
import { AvatarGLB }               from './AvatarGLB';
import { getGroundY }              from './terrainHeight';

/* Smooth-lerping other-player mesh using a GLB avatar */
function OtherPlayerMesh({ player }: { player: OtherPlayer }) {
  const groupRef  = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(player.x, getGroundY(player.x, player.z), player.z));
  const prevPos   = useRef(new THREE.Vector3(player.x, getGroundY(player.x, player.z), player.z));
  const time      = useRef(Math.random() * 10);
  const movingRef = useRef(false);

  useFrame((_, delta) => {
    time.current += delta;
    targetPos.current.set(player.x, getGroundY(player.x, player.z), player.z);
    if (!groupRef.current) return;

    const before = groupRef.current.position.clone();
    groupRef.current.position.lerp(targetPos.current, Math.min(1, delta * 8));

    const moved = groupRef.current.position.distanceTo(before);
    movingRef.current = moved > 0.001;

    /* Turn to face direction of travel */
    const dx = groupRef.current.position.x - prevPos.current.x;
    const dz = groupRef.current.position.z - prevPos.current.z;
    if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
      groupRef.current.rotation.y = Math.atan2(-dx, -dz);
    }
    prevPos.current.copy(groupRef.current.position);
  });

  return (
    <group ref={groupRef} position={[player.x, getGroundY(player.x, player.z), player.z]}>
      <AvatarGLB userId={player.userId} movingRef={movingRef} timeRef={time} />
      <Text
        position={[0, 4.0, 0]}
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
