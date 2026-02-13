import React, { useEffect, useRef, useState } from 'react';

interface Dice3DProps {
  isRolling: boolean;
  result?: number | null;
  finalValue?: number;
  size?: number;
  onRollComplete?: () => void;
}

const pipLayouts: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
};

const resultRotations: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

const DiceFace: React.FC<{ value: number; size: number }> = ({ value, size }) => {
  const pips = pipLayouts[value] || [];
  const pipSize = Math.max(size * 0.15, 8);

  return (
    <div
      style={{
        position: 'absolute',
        width: `${size}px`,
        height: `${size}px`,
        background: 'linear-gradient(145deg, #ef4444, #b91c1c)',
        borderRadius: `${size * 0.12}px`,
        border: '2px solid rgba(0,0,0,0.3)',
        boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.3), inset 0 -3px 8px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.5)',
        backfaceVisibility: 'hidden',
      }}
    >
      {pips.map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: `${pipSize}px`,
            height: `${pipSize}px`,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #ffffff, #e0e0e0)',
            boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.4)',
            left: `${pos[0]}%`,
            top: `${pos[1]}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
};

export const Dice3D: React.FC<Dice3DProps> = ({
  isRolling,
  result,
  finalValue,
  size = 120,
  onRollComplete,
}) => {
  const effectiveResult = result ?? finalValue ?? null;
  const wasRolling = useRef(false);
  const styleId = useRef(`dice3d-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    if (isRolling) {
      wasRolling.current = true;
    } else if (wasRolling.current) {
      wasRolling.current = false;
      const timer = setTimeout(() => {
        onRollComplete?.();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isRolling, onRollComplete]);

  const rot = effectiveResult != null ? resultRotations[effectiveResult] : { x: 0, y: 0 };

  let cubeTransform: string;
  if (isRolling) {
    cubeTransform = '';
  } else {
    cubeTransform = `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`;
  }

  const half = size / 2;

  const faces: { value: number; transform: string }[] = [
    { value: 1, transform: `rotateY(0deg) translateZ(${half}px)` },
    { value: 6, transform: `rotateY(180deg) translateZ(${half}px)` },
    { value: 2, transform: `rotateY(90deg) translateZ(${half}px)` },
    { value: 5, transform: `rotateY(-90deg) translateZ(${half}px)` },
    { value: 3, transform: `rotateX(90deg) translateZ(${half}px)` },
    { value: 4, transform: `rotateX(-90deg) translateZ(${half}px)` },
  ];

  const sid = styleId.current;
  const bounceHeight = Math.round(size * 0.6);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`
        @keyframes ${sid}-tumble {
          0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
          10% { transform: rotateX(120deg) rotateY(80deg) rotateZ(45deg); }
          20% { transform: rotateX(250deg) rotateY(190deg) rotateZ(100deg); }
          30% { transform: rotateX(400deg) rotateY(270deg) rotateZ(180deg); }
          40% { transform: rotateX(520deg) rotateY(380deg) rotateZ(230deg); }
          50% { transform: rotateX(650deg) rotateY(460deg) rotateZ(310deg); }
          60% { transform: rotateX(790deg) rotateY(560deg) rotateZ(370deg); }
          70% { transform: rotateX(900deg) rotateY(650deg) rotateZ(440deg); }
          80% { transform: rotateX(980deg) rotateY(720deg) rotateZ(490deg); }
          90% { transform: rotateX(1040deg) rotateY(770deg) rotateZ(530deg); }
          100% { transform: rotateX(1080deg) rotateY(800deg) rotateZ(560deg); }
        }
        @keyframes ${sid}-bounce {
          0% { transform: translateY(0) scale(1); }
          8% { transform: translateY(-${bounceHeight}px) scale(0.95); }
          16% { transform: translateY(0) scale(1.05, 0.95); }
          20% { transform: translateY(0) scale(1); }
          28% { transform: translateY(-${Math.round(bounceHeight * 0.55)}px) scale(0.97); }
          36% { transform: translateY(0) scale(1.03, 0.97); }
          40% { transform: translateY(0) scale(1); }
          46% { transform: translateY(-${Math.round(bounceHeight * 0.3)}px) scale(0.98); }
          52% { transform: translateY(0) scale(1.02, 0.98); }
          56% { transform: translateY(0) scale(1); }
          60% { transform: translateY(-${Math.round(bounceHeight * 0.12)}px) scale(0.99); }
          64% { transform: translateY(0) scale(1.01, 0.99); }
          68% { transform: translateY(0) scale(1); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes ${sid}-shadow {
          0% { opacity: 0.4; transform: translateX(-50%) scale(1); }
          8% { opacity: 0.15; transform: translateX(-50%) scale(1.8); }
          16% { opacity: 0.5; transform: translateX(-50%) scale(0.85); }
          28% { opacity: 0.2; transform: translateX(-50%) scale(1.4); }
          36% { opacity: 0.45; transform: translateX(-50%) scale(0.9); }
          46% { opacity: 0.25; transform: translateX(-50%) scale(1.2); }
          52% { opacity: 0.4; transform: translateX(-50%) scale(0.95); }
          68% { opacity: 0.4; transform: translateX(-50%) scale(1); }
          100% { opacity: 0.4; transform: translateX(-50%) scale(1); }
        }
      `}</style>
      <div
        style={{
          position: 'relative',
          width: `${size}px`,
          height: `${size + bounceHeight}px`,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        {isRolling && (
          <div
            style={{
              position: 'absolute',
              bottom: '-4px',
              left: '50%',
              width: `${size * 0.7}px`,
              height: `${size * 0.08}px`,
              background: 'radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 70%)',
              borderRadius: '50%',
              animation: `${sid}-shadow 1.2s cubic-bezier(0.25, 0.1, 0.25, 1) infinite`,
              transformOrigin: 'center',
            }}
          />
        )}
        <div
          style={{
            animation: isRolling
              ? `${sid}-bounce 1.2s cubic-bezier(0.25, 0.1, 0.25, 1) infinite`
              : 'none',
          }}
        >
          <div
            style={{
              perspective: `${size * 5}px`,
              width: `${size}px`,
              height: `${size}px`,
            }}
          >
            <div
              style={{
                width: `${size}px`,
                height: `${size}px`,
                position: 'relative',
                transformStyle: 'preserve-3d',
                animation: isRolling
                  ? `${sid}-tumble 1.2s cubic-bezier(0.25, 0.1, 0.25, 1) infinite`
                  : 'none',
                transform: !isRolling ? cubeTransform : undefined,
                transition: !isRolling ? 'transform 0.9s cubic-bezier(0.22, 0.68, 0.35, 1.2)' : 'none',
              }}
            >
              {faces.map((face) => (
                <div
                  key={face.value}
                  style={{
                    position: 'absolute',
                    width: `${size}px`,
                    height: `${size}px`,
                    transform: face.transform,
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <DiceFace value={face.value} size={size} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SuperDice3D: React.FC<{
  isRolling: boolean;
  diceCards: Array<{ name: string; image: string }>;
  currentIndex: number;
  onRollComplete?: () => void;
}> = ({ isRolling, diceCards, currentIndex, onRollComplete }) => {
  const [displayIndex, setDisplayIndex] = useState(currentIndex);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRolling && diceCards.length > 0) {
      intervalRef.current = setInterval(() => {
        setDisplayIndex((prev) => (prev + 1) % diceCards.length);
      }, 150);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDisplayIndex(currentIndex);
      if (!isRolling) {
        onRollComplete?.();
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRolling, diceCards.length, currentIndex]);

  const card = diceCards[displayIndex] || diceCards[0];
  if (!card) return null;

  const size = 150;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`
        @keyframes super-dice-spin {
          0% { transform: rotateY(0deg) rotateX(0deg); }
          100% { transform: rotateY(720deg) rotateX(360deg); }
        }
      `}</style>
      <div style={{ perspective: `${size * 5}px` }}>
        <div
          style={{
            width: `${size}px`,
            height: `${size}px`,
            position: 'relative',
            transformStyle: 'preserve-3d',
            animation: isRolling ? 'super-dice-spin 0.8s linear infinite' : 'none',
            transition: !isRolling ? 'transform 0.5s ease-out' : 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: `${size}px`,
              height: `${size}px`,
              background: 'linear-gradient(135deg, #9333ea, #7c3aed)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(147,51,234,0.4), inset 0 1px 2px rgba(255,255,255,0.2)',
              transform: `translateZ(${size / 2}px)`,
              backfaceVisibility: 'hidden',
            }}
          >
            <img
              src={card.image}
              alt={card.name}
              style={{
                width: '80%',
                height: '80%',
                objectFit: 'contain',
                borderRadius: '8px',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
