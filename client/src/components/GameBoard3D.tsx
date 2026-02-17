import React, { useRef, useMemo, useState, useCallback, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, Html, Float, Environment, ContactShadows, MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { useGameState } from "../lib/stores/useGameState";
import { useAudio } from "../lib/stores/useAudio";
import { socket } from "../lib/socket";

interface Card3DProps {
  card: any;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  isMyCard?: boolean;
  onClick?: () => void;
  index?: number;
}

const CARD_WIDTH = 0.7;
const CARD_HEIGHT = 1.0;
const CARD_DEPTH = 0.02;

function Card3D({ card, position, rotation = [0, 0, 0], scale = 1, isMyCard = false, onClick, index = 0 }: Card3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const texture = useMemo(() => {
    if (!card.frontImage) return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(card.frontImage, () => setImageLoaded(true));
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [card.frontImage]);

  const backTexture = useMemo(() => {
    if (!card.backImage) return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(card.backImage);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [card.backImage]);

  useEffect(() => {
    return () => {
      texture?.dispose();
      backTexture?.dispose();
    };
  }, [texture, backTexture]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const targetY = position[1] + (hovered ? 0.3 : 0);
    meshRef.current.position.y += (targetY - meshRef.current.position.y) * 0.1;
    if (hovered) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.05;
    }
  });

  const glowColor = useMemo(() => {
    if (card.type === 'PERSONAGGI') return '#3b82f6';
    if (card.type === 'MOSSE') return '#ef4444';
    if (card.type === 'BONUS') return '#22c55e';
    if (card.type === 'PERSONAGGI SPECIALI') return '#a855f7';
    return '#6b7280';
  }, [card.type]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[CARD_WIDTH, CARD_HEIGHT, CARD_DEPTH]} />
        <meshStandardMaterial attach="material-0" color="#1a1a2e" />
        <meshStandardMaterial attach="material-1" color="#1a1a2e" />
        <meshStandardMaterial attach="material-2" color="#1a1a2e" />
        <meshStandardMaterial attach="material-3" color="#1a1a2e" />
        <meshStandardMaterial
          attach="material-4"
          map={card.faceDown ? (backTexture || undefined) : (texture || undefined)}
          color={!texture && !card.faceDown ? '#333355' : undefined}
          roughness={0.3}
          metalness={0.1}
        />
        <meshStandardMaterial
          attach="material-5"
          map={backTexture || undefined}
          color={!backTexture ? '#1a1a3e' : undefined}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      {hovered && (
        <mesh position={[0, 0, -0.02]} scale={[1.08, 1.06, 1]}>
          <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.4} />
        </mesh>
      )}
      {hovered && card.name && (
        <Html position={[0, -CARD_HEIGHT / 2 - 0.15, 0]} center>
          <div style={{
            background: 'rgba(0,0,0,0.85)',
            color: 'white',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            border: `1px solid ${glowColor}`,
            pointerEvents: 'none'
          }}>
            {card.name}
          </div>
        </Html>
      )}
    </group>
  );
}

function DeckPile3D({ position, label, cardCount, color, onClick }: {
  position: [number, number, number];
  label: string;
  cardCount: number;
  color: string;
  onClick?: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (!meshRef.current) return;
    const targetScale = hovered ? 1.05 : 1;
    meshRef.current.scale.x += (targetScale - meshRef.current.scale.x) * 0.1;
    meshRef.current.scale.y += (targetScale - meshRef.current.scale.y) * 0.1;
    meshRef.current.scale.z += (targetScale - meshRef.current.scale.z) * 0.1;
  });

  const stackHeight = Math.min(cardCount * 0.003, 0.15);

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
        position={[0, stackHeight / 2, 0]}
        castShadow
      >
        <boxGeometry args={[CARD_WIDTH * 0.9, stackHeight + 0.01, CARD_HEIGHT * 0.9]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
      </mesh>
      <Text
        position={[0, stackHeight + 0.12, 0]}
        fontSize={0.12}
        color="white"
        anchorX="center"
        anchorY="bottom"
        font="/fonts/inter-bold.woff"
        outlineWidth={0.01}
        outlineColor="black"
      >
        {label}
      </Text>
      <Text
        position={[0, stackHeight + 0.02, 0]}
        fontSize={0.09}
        color="#fbbf24"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.008}
        outlineColor="black"
      >
        {`${cardCount}`}
      </Text>
    </group>
  );
}

function GameTable() {
  const tableRef = useRef<THREE.Mesh>(null);

  return (
    <group>
      <mesh
        ref={tableRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial
          color="#0a3d1a"
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
        <planeGeometry args={[14.4, 10.4]} />
        <meshStandardMaterial color="#2a1810" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[14.8, 10.8]} />
        <meshStandardMaterial color="#1a0f08" roughness={0.6} metalness={0.15} />
      </mesh>

      {[[-7.2, 0.02, 0], [7.2, 0.02, 0]].map((pos, i) => (
        <mesh key={`rail-side-${i}`} position={pos as [number, number, number]} castShadow>
          <boxGeometry args={[0.3, 0.15, 10.8]} />
          <meshStandardMaterial color="#3d2817" roughness={0.6} metalness={0.1} />
        </mesh>
      ))}
      {[[0, 0.02, -5.4], [0, 0.02, 5.4]].map((pos, i) => (
        <mesh key={`rail-end-${i}`} position={pos as [number, number, number]} castShadow>
          <boxGeometry args={[14.8, 0.15, 0.3]} />
          <meshStandardMaterial color="#3d2817" roughness={0.6} metalness={0.1} />
        </mesh>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry args={[2.5, 2.55, 64]} />
        <meshBasicMaterial color="#fbbf2440" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

function Particles() {
  const particlesRef = useRef<THREE.Points>(null);
  const count = 80;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = Math.random() * 6 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (!particlesRef.current) return;
    particlesRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    const posArray = particlesRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      posArray[i * 3 + 1] += Math.sin(state.clock.elapsedTime + i) * 0.002;
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#fbbf24"
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

function TurnIndicator({ currentPlayer, isMyTurn }: { currentPlayer: string; isMyTurn: boolean }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.y = 3.5 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    const pulse = 0.8 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = pulse * 0.7;
  });

  return (
    <group position={[0, 3.5, -4]}>
      <mesh ref={ref}>
        <planeGeometry args={[4, 0.5]} />
        <meshBasicMaterial
          color={isMyTurn ? '#22c55e' : '#ef4444'}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Text
        position={[0, 0, 0.01]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="black"
      >
        {isMyTurn ? '🎯 IL TUO TURNO!' : `⏳ Turno di ${currentPlayer}`}
      </Text>
    </group>
  );
}

function PlayerZoneLabel({ position, name, isCurrentPlayer, avatar }: {
  position: [number, number, number];
  name: string;
  isCurrentPlayer: boolean;
  avatar?: string;
}) {
  return (
    <Html position={position} center>
      <div style={{
        background: isCurrentPlayer ? 'rgba(34,197,94,0.25)' : 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        color: 'white',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 'bold',
        border: isCurrentPlayer ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.15)',
        whiteSpace: 'nowrap',
        textAlign: 'center',
        pointerEvents: 'none',
        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
      }}>
        {avatar && <span style={{ marginRight: '4px' }}>{avatar}</span>}
        {name}
      </div>
    </Html>
  );
}

function CameraController() {
  const { camera } = useThree();

  useFrame(() => {
    camera.position.lerp(new THREE.Vector3(0, 7, 7), 0.02);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

interface GameBoard3DProps {
  onCardClick?: (card: any) => void;
}

export const GameBoard3D: React.FC<GameBoard3DProps> = ({ onCardClick }) => {
  const { gameState, playerName, gameId } = useGameState();
  const { playButtonClick } = useAudio();

  const fieldCards = gameState?.field || [];
  const players = gameState?.players || {};
  const allPlayerNames = Object.keys(players);
  const currentTurnPlayer = gameState?.turnOrder?.[gameState?.currentTurnIndex ?? 0] || '';
  const isMyTurn = currentTurnPlayer === playerName;

  const decks = gameState?.decks || { personaggi: [], mosse: [], bonus: [], personaggi_speciali: [] };

  const otherPlayers = useMemo(() => {
    return allPlayerNames.filter(n => n !== playerName);
  }, [allPlayerNames, playerName]);

  const myCards = useMemo(() => {
    return fieldCards.filter(c => c.owner === playerName && !c.attachedTo);
  }, [fieldCards, playerName]);

  const myHand = players[playerName]?.hand || [];

  const cardsByPlayer = useMemo(() => {
    const map: Record<string, typeof fieldCards> = {};
    for (const card of fieldCards) {
      if (card.attachedTo) continue;
      if (!map[card.owner]) map[card.owner] = [];
      map[card.owner].push(card);
    }
    return map;
  }, [fieldCards]);

  const getOpponentPosition = useCallback((index: number, total: number): [number, number, number] => {
    if (total === 1) return [0, 0.05, -3.5];
    if (total === 2) return index === 0 ? [-3, 0.05, -3] : [3, 0.05, -3];
    if (total === 3) {
      const positions: [number, number, number][] = [[-3.5, 0.05, -3], [0, 0.05, -3.5], [3.5, 0.05, -3]];
      return positions[index];
    }
    const angle = Math.PI * (0.2 + (0.6 * index) / (total - 1));
    const radius = 4;
    return [Math.cos(angle) * radius, 0.05, -Math.sin(angle) * radius];
  }, []);

  const handleCardClick = useCallback((card: any) => {
    playButtonClick();
    onCardClick?.(card);
  }, [onCardClick, playButtonClick]);

  const handleDrawCard = useCallback((deckType: string) => {
    playButtonClick();
    socket.emit('draw-card', { gameId, playerName, deckType });
  }, [gameId, playerName, playButtonClick]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 5 }}>
      <Canvas
        shadows
        camera={{ position: [0, 7, 7], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true }}
      >
        <CameraController />

        <ambientLight intensity={0.3} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={30}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <pointLight position={[-4, 4, -3]} intensity={0.4} color="#4a90d9" />
        <pointLight position={[4, 4, 3]} intensity={0.3} color="#d94a4a" />
        <spotLight position={[0, 6, 0]} intensity={0.5} angle={0.6} penumbra={0.5} color="#fbbf24" castShadow />

        <fog attach="fog" args={['#0a0a1a', 8, 20]} />

        <GameTable />
        <Particles />

        <TurnIndicator currentPlayer={currentTurnPlayer} isMyTurn={isMyTurn} />

        <group position={[-5.5, 0, 3.5]}>
          <DeckPile3D
            position={[0, 0, 0]}
            label="PERSONAGGI"
            cardCount={decks.personaggi.length}
            color="#3b82f6"
            onClick={() => handleDrawCard('personaggi')}
          />
          <DeckPile3D
            position={[1.2, 0, 0]}
            label="MOSSE"
            cardCount={decks.mosse.length}
            color="#ef4444"
            onClick={() => handleDrawCard('mosse')}
          />
          <DeckPile3D
            position={[2.4, 0, 0]}
            label="BONUS"
            cardCount={decks.bonus.length}
            color="#22c55e"
            onClick={() => handleDrawCard('bonus')}
          />
          <DeckPile3D
            position={[3.6, 0, 0]}
            label="SPECIALI"
            cardCount={decks.personaggi_speciali.length}
            color="#a855f7"
            onClick={() => handleDrawCard('personaggi_speciali')}
          />
        </group>

        <group position={[0, 0.05, 3]}>
          <PlayerZoneLabel
            position={[0, 0.8, 0.8]}
            name={playerName || 'Tu'}
            isCurrentPlayer={isMyTurn}
            avatar={players[playerName]?.avatar}
          />
          {myCards.map((card, i) => {
            const totalCards = myCards.length;
            const spread = Math.min(totalCards * 0.9, 6);
            const x = (i - (totalCards - 1) / 2) * (spread / Math.max(totalCards - 1, 1));
            return (
              <Card3D
                key={card.id}
                card={card}
                position={[x, 0.05, 0]}
                rotation={[-Math.PI / 6, 0, 0]}
                scale={0.9}
                isMyCard={true}
                onClick={() => handleCardClick(card)}
                index={i}
              />
            );
          })}
        </group>

        <group position={[4.5, 0.05, 2.5]}>
          <Text
            position={[0, 0.5, 0]}
            fontSize={0.1}
            color="#94a3b8"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.005}
            outlineColor="black"
          >
            MANO
          </Text>
          {myHand.map((card, i) => {
            const totalCards = myHand.length;
            const arcSpread = Math.min(totalCards * 0.6, 4);
            const x = (i - (totalCards - 1) / 2) * (arcSpread / Math.max(totalCards - 1, 1));
            const arcY = -Math.abs(i - (totalCards - 1) / 2) * 0.05;
            const arcRot = (i - (totalCards - 1) / 2) * 0.05;
            return (
              <Card3D
                key={card.id}
                card={card}
                position={[x, 0.05 + arcY, 0]}
                rotation={[-Math.PI / 4, arcRot, 0]}
                scale={0.7}
                isMyCard={true}
                onClick={() => handleCardClick(card)}
                index={i}
              />
            );
          })}
        </group>

        {otherPlayers.map((opName, idx) => {
          const pos = getOpponentPosition(idx, otherPlayers.length);
          const opCards = cardsByPlayer[opName] || [];
          return (
            <group key={opName} position={pos}>
              <PlayerZoneLabel
                position={[0, 0.8, -0.5]}
                name={opName}
                isCurrentPlayer={currentTurnPlayer === opName}
                avatar={players[opName]?.avatar}
              />
              {opCards.map((card, i) => {
                const totalCards = opCards.length;
                const spread = Math.min(totalCards * 0.8, 5);
                const x = (i - (totalCards - 1) / 2) * (spread / Math.max(totalCards - 1, 1));
                return (
                  <Card3D
                    key={card.id}
                    card={card}
                    position={[x, 0.05, 0]}
                    rotation={[-Math.PI / 6, Math.PI, 0]}
                    scale={0.75}
                    onClick={() => handleCardClick(card)}
                    index={i}
                  />
                );
              })}
            </group>
          );
        })}

        <ContactShadows
          position={[0, -0.01, 0]}
          opacity={0.4}
          scale={15}
          blur={2}
          far={5}
        />
      </Canvas>

      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '6px',
        zIndex: 10,
        pointerEvents: 'auto',
      }}>
        <div style={{
          background: 'rgba(10, 8, 30, 0.85)',
          backdropFilter: 'blur(16px)',
          borderRadius: '16px',
          padding: '6px 12px',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}>
          <span style={{ color: '#94a3b8', fontSize: '11px' }}>
            Campo: {fieldCards.length} carte
          </span>
          <span style={{ color: '#64748b', fontSize: '11px' }}>|</span>
          <span style={{ color: '#94a3b8', fontSize: '11px' }}>
            Mano: {myHand.length} carte
          </span>
          <span style={{ color: '#64748b', fontSize: '11px' }}>|</span>
          <span style={{
            color: isMyTurn ? '#22c55e' : '#f59e0b',
            fontSize: '11px',
            fontWeight: 'bold',
          }}>
            {isMyTurn ? '🎯 Tuo turno' : `⏳ ${currentTurnPlayer}`}
          </span>
        </div>
      </div>
    </div>
  );
};
