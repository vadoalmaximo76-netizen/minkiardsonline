import React, { useEffect, useMemo } from 'react';

interface CardShatter3DProps {
  isVisible: boolean;
  cardImage?: string;
  cardName: string;
  onComplete: () => void;
}

interface ShatterFragment {
  id: number;
  row: number;
  col: number;
  tx: string;
  ty: string;
  rx: string;
  ry: string;
  rz: string;
}

interface Particle {
  id: number;
  left: number;
  delay: number;
}

export const CardShatter3D: React.FC<CardShatter3DProps> = ({
  isVisible,
  cardImage,
  cardName,
  onComplete,
}) => {
  // Generate fragments using useMemo to avoid re-renders
  const fragments = useMemo<ShatterFragment[]>(() => {
    const gridSize = 4;
    const newFragments: ShatterFragment[] = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const id = row * gridSize + col;

        // Generate randomized scatter directions
        const angle = (Math.random() * Math.PI * 2);
        const distance = 80 + Math.random() * 120;
        const tx = `${Math.cos(angle) * distance}px`;
        const ty = `${Math.sin(angle) * distance - 50}px`;

        // Rotation values on all axes
        const rx = `${(Math.random() - 0.5) * 720}deg`;
        const ry = `${(Math.random() - 0.5) * 720}deg`;
        const rz = `${(Math.random() - 0.5) * 720}deg`;

        newFragments.push({
          id,
          row,
          col,
          tx,
          ty,
          rx,
          ry,
          rz,
        });
      }
    }

    return newFragments;
  }, []);

  // Generate particles for floating effect
  const particles = useMemo<Particle[]>(() => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 12; i++) {
      newParticles.push({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
      });
    }
    return newParticles;
  }, []);

  // Handle animation completion
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  const fallbackImage = cardImage || '';
  const hasImage = !!fallbackImage;
  const gridSize = 4;
  const cellSize = 100 / gridSize;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      {/* Semi-transparent dark background */}
      <div className="absolute inset-0 bg-black/50" />

      {/* White flash effect */}
      <div
        className="absolute inset-0"
        style={{
          animation: 'card-shatter-flash 0.5s ease-out',
          backgroundColor: 'rgba(255, 255, 255, 0)',
        }}
      />

      {/* Card shatter container */}
      <div
        className="relative"
        style={{
          width: '200px',
          height: '280px',
          perspective: '1000px',
        }}
      >
        {/* Card image - brief display before shatter */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: hasImage ? `url(${fallbackImage})` : 'none',
            backgroundColor: hasImage ? undefined : '#333',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: '12px',
            animation: 'card-appear 0.3s ease-out forwards',
            opacity: 0.9,
          }}
        />

        {/* Shatter fragments grid */}
        <div className="absolute inset-0">
          {fragments.map((fragment) => {
            const top = (fragment.row / gridSize) * 100;
            const left = (fragment.col / gridSize) * 100;

            // Calculate inset values for clip-path
            const insetTop = `${top}%`;
            const insetLeft = `${left}%`;
            const insetRight = `${100 - left - cellSize}%`;
            const insetBottom = `${100 - top - cellSize}%`;

            return (
              <div
                key={fragment.id}
                className="absolute card-shatter-piece"
                style={{
                  width: '200px',
                  height: '280px',
                  top: `-${fragment.row * cellSize}%`,
                  left: `-${fragment.col * cellSize}%`,
                  backgroundImage: hasImage ? `url(${fallbackImage})` : 'none',
                  backgroundColor: hasImage ? undefined : '#555',
                  backgroundSize: '200px 280px',
                  backgroundPosition: `${left}% ${top}%`,
                  clipPath: `inset(${insetTop} ${insetRight} ${insetBottom} ${insetLeft})`,
                  borderRadius: '4px',
                  transformStyle: 'preserve-3d',
                  // CSS variables for animation
                  '--shatter-tx': fragment.tx,
                  '--shatter-ty': fragment.ty,
                  '--shatter-rx': fragment.rx,
                  '--shatter-ry': fragment.ry,
                  '--shatter-rz': fragment.rz,
                } as React.CSSProperties & Record<string, string>}
              />
            );
          })}
        </div>
      </div>

      {/* Floating dark particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute w-2 h-2 rounded-full bg-gray-700"
            style={{
              left: `${particle.left}%`,
              top: '50%',
              animation: `float-down 2s ease-in forwards`,
              animationDelay: `${particle.delay}s`,
              opacity: 0.6,
            }}
          />
        ))}
      </div>

      {/* Card name display */}
      <div
        className="absolute text-white text-2xl font-bold tracking-wider"
        style={{
          bottom: '80px',
          animation: 'fade-in 0.5s ease-out forwards, fade-out 0.5s ease-out 1s forwards',
          textShadow: '0 0 10px rgba(0,0,0,0.8)',
        }}
      >
        {cardName}
      </div>
    </div>
  );
};
