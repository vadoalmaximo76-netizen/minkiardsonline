import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
  type: 'spark' | 'ember' | 'ring' | 'trail';
}

interface CardTrailParticlesProps {
  visible: boolean;
  cardType: string;
  startX: number;
  startY: number;
  onComplete: () => void;
}

interface TypeTheme {
  colors: string[];
  glowColor: string;
  flashColor: string;
  ringColor: string;
}

const getThemeForCardType = (cardType: string): TypeTheme => {
  const normalizedType = cardType.toLowerCase();

  if (normalizedType === 'personaggi') {
    return {
      colors: ['#3b82f6', '#60a5fa', '#93c5fd', '#2563eb', '#38bdf8'],
      glowColor: 'rgba(59, 130, 246, 0.6)',
      flashColor: 'rgba(59, 130, 246, 0.4)',
      ringColor: 'rgba(96, 165, 250, 0.8)',
    };
  }
  if (normalizedType === 'mosse') {
    return {
      colors: ['#ef4444', '#f87171', '#fca5a5', '#dc2626', '#ff6b6b'],
      glowColor: 'rgba(239, 68, 68, 0.6)',
      flashColor: 'rgba(239, 68, 68, 0.4)',
      ringColor: 'rgba(248, 113, 113, 0.8)',
    };
  }
  if (normalizedType === 'bonus') {
    return {
      colors: ['#fbbf24', '#fcd34d', '#fde68a', '#f59e0b', '#ffffff'],
      glowColor: 'rgba(251, 191, 36, 0.6)',
      flashColor: 'rgba(251, 191, 36, 0.3)',
      ringColor: 'rgba(252, 211, 77, 0.8)',
    };
  }
  if (normalizedType === 'personaggi speciali' || normalizedType === 'personaggi_speciali' || normalizedType === 'speciali') {
    return {
      colors: ['#a855f7', '#c084fc', '#e879f9', '#9333ea', '#d946ef'],
      glowColor: 'rgba(168, 85, 247, 0.6)',
      flashColor: 'rgba(168, 85, 247, 0.4)',
      ringColor: 'rgba(192, 132, 252, 0.8)',
    };
  }

  return {
    colors: ['#a855f7', '#c084fc', '#e879f9'],
    glowColor: 'rgba(168, 85, 247, 0.5)',
    flashColor: 'rgba(168, 85, 247, 0.3)',
    ringColor: 'rgba(192, 132, 252, 0.7)',
  };
};

export default function CardTrailParticles({
  visible,
  cardType,
  startX,
  startY,
  onComplete,
}: CardTrailParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [flashPhase, setFlashPhase] = useState(0);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);
  const flashTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const theme = useMemo(() => getThemeForCardType(cardType), [cardType]);

  const rings = useMemo(() => {
    return [
      { id: 0, delay: 0, maxScale: 4, duration: 0.7 },
      { id: 1, delay: 0.1, maxScale: 6, duration: 0.8 },
      { id: 2, delay: 0.2, maxScale: 8, duration: 0.9 },
    ];
  }, []);

  const initializeParticles = useCallback(() => {
    const particleCount = 35;
    const newParticles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = ((i * 137.508 + 42) % 360) * (Math.PI / 180);
      const speed = 3 + ((i * 47 + 13) % 60) / 10;
      const isEmber = i >= 25;

      newParticles.push({
        id: i,
        x: startX + ((i * 7 + 3) % 20 - 10),
        y: startY + ((i * 11 + 5) % 16 - 8),
        vx: Math.cos(angle) * speed * (isEmber ? 0.5 : 1),
        vy: Math.sin(angle) * speed * (isEmber ? 0.3 : 1) - (isEmber ? 2 : 0),
        size: isEmber ? 3 + (i % 3) : 5 + (i % 6) * 2,
        color: theme.colors[i % theme.colors.length],
        opacity: 1,
        type: isEmber ? 'ember' : 'spark',
      });
    }

    particlesRef.current = newParticles;
    setParticles(newParticles);
    startTimeRef.current = performance.now();
    isAnimatingRef.current = true;
    flashTimersRef.current.forEach(t => clearTimeout(t));
    flashTimersRef.current = [];
    setFlashPhase(1);
    flashTimersRef.current.push(setTimeout(() => setFlashPhase(2), 150));
    flashTimersRef.current.push(setTimeout(() => setFlashPhase(0), 400));
  }, [cardType, startX, startY, theme]);

  const animate = useCallback(() => {
    if (!startTimeRef.current || !isAnimatingRef.current) {
      return;
    }

    const currentTime = performance.now();
    const elapsed = (currentTime - startTimeRef.current) / 1000;
    const duration = 1.8;
    const progress = elapsed / duration;

    if (progress >= 1) {
      isAnimatingRef.current = false;
      setParticles([]);
      onComplete();
      return;
    }

    const updatedParticles = particlesRef.current.map((particle) => {
      const drag = particle.type === 'ember' ? 0.97 : 0.98;
      const gravity = particle.type === 'ember' ? -0.08 : 0.06;
      return {
        ...particle,
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        vx: particle.vx * drag,
        vy: particle.vy * drag + gravity,
        opacity: Math.max(0, 1 - progress * (particle.type === 'ember' ? 1.2 : 1)),
        size: particle.size * (1 - progress * 0.3),
      };
    });

    particlesRef.current = updatedParticles;
    setParticles([...updatedParticles]);

    animationRef.current = requestAnimationFrame(animate);
  }, [onComplete]);

  useEffect(() => {
    if (visible) {
      initializeParticles();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      flashTimersRef.current.forEach(t => clearTimeout(t));
      flashTimersRef.current = [];
      setParticles([]);
      isAnimatingRef.current = false;
      startTimeRef.current = null;
      setFlashPhase(0);
    }

    return () => {
      flashTimersRef.current.forEach(t => clearTimeout(t));
      flashTimersRef.current = [];
    };
  }, [visible, initializeParticles]);

  useEffect(() => {
    if (visible && isAnimatingRef.current) {
      animationRef.current = requestAnimationFrame(animate);
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [visible, animate]);

  if (!visible && particles.length === 0) {
    return null;
  }

  return (
    <>
      <style>{`
        @keyframes card-entry-ring {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; border-width: 3px; }
          70% { opacity: 0.4; }
          100% { transform: translate(-50%, -50%) scale(var(--ring-scale)); opacity: 0; border-width: 1px; }
        }
        @keyframes card-entry-flash {
          0% { opacity: 0; }
          30% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes card-entry-glow {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 9999,
          overflow: 'hidden',
        }}
      >
        {flashPhase > 0 && (
          <div
            style={{
              position: 'absolute',
              left: `${startX}px`,
              top: `${startY}px`,
              width: '200px',
              height: '200px',
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, ${theme.flashColor}, transparent 70%)`,
              animation: 'card-entry-flash 0.4s ease-out forwards',
            }}
          />
        )}

        {flashPhase > 0 && (
          <div
            style={{
              position: 'absolute',
              left: `${startX}px`,
              top: `${startY}px`,
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${theme.colors[0]}, transparent)`,
              boxShadow: `0 0 40px ${theme.glowColor}, 0 0 80px ${theme.glowColor}`,
              animation: 'card-entry-glow 0.6s ease-out forwards',
            }}
          />
        )}

        {visible && rings.map((ring) => (
          <div
            key={`ring-${ring.id}`}
            style={{
              position: 'absolute',
              left: `${startX}px`,
              top: `${startY}px`,
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              border: `3px solid ${theme.ringColor}`,
              boxShadow: `0 0 12px ${theme.glowColor}, inset 0 0 8px ${theme.glowColor}`,
              '--ring-scale': ring.maxScale,
              animation: `card-entry-ring ${ring.duration}s ease-out ${ring.delay}s forwards`,
              opacity: 0,
            } as unknown as React.CSSProperties}
          />
        ))}

        {particles.map((particle) => (
          <div
            key={particle.id}
            style={{
              position: 'absolute',
              left: `${particle.x}px`,
              top: `${particle.y}px`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              borderRadius: '50%',
              backgroundColor: particle.color,
              opacity: particle.opacity,
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}, 0 0 ${particle.size * 4}px ${particle.color}`,
              pointerEvents: 'none',
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </div>
    </>
  );
}
