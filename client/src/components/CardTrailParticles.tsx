import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
}

interface CardTrailParticlesProps {
  visible: boolean;
  cardType: string;
  startX: number;
  startY: number;
  onComplete: () => void;
}

const getColorsForCardType = (cardType: string): string[] => {
  const normalizedType = cardType.toLowerCase();
  
  if (normalizedType === 'personaggi') {
    return ['#3b82f6', '#60a5fa', '#93c5fd'];
  }
  if (normalizedType === 'mosse') {
    return ['#ef4444', '#f87171', '#fca5a5'];
  }
  if (normalizedType === 'bonus') {
    return ['#ffffff', '#e2e8f0', '#f8fafc'];
  }
  if (normalizedType === 'personaggi speciali' || normalizedType === 'personaggi_speciali' || normalizedType === 'speciali') {
    return ['#eab308', '#fbbf24', '#fcd34d'];
  }
  
  return ['#a855f7'];
};

export default function CardTrailParticles({
  visible,
  cardType,
  startX,
  startY,
  onComplete,
}: CardTrailParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);

  const initializeParticles = useCallback(() => {
    const colors = getColorsForCardType(cardType);
    const particleCount = 20 + Math.floor(Math.random() * 11);
    const newParticles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const speed = 2 + Math.random() * 4;
      
      newParticles.push({
        id: i,
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 1,
      });
    }

    particlesRef.current = newParticles;
    setParticles(newParticles);
    startTimeRef.current = performance.now();
    isAnimatingRef.current = true;
  }, [cardType, startX, startY]);

  const animate = useCallback(() => {
    if (!startTimeRef.current || !isAnimatingRef.current) {
      return;
    }

    const currentTime = performance.now();
    const elapsed = (currentTime - startTimeRef.current) / 1000;
    const duration = 1.5;
    const progress = elapsed / duration;

    if (progress >= 1) {
      isAnimatingRef.current = false;
      setParticles([]);
      onComplete();
      return;
    }

    const updatedParticles = particlesRef.current.map((particle) => ({
      ...particle,
      x: particle.x + particle.vx,
      y: particle.y + particle.vy + (progress * 0.5),
      vy: particle.vy + 0.05,
      opacity: Math.max(0, 1 - progress),
    }));

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
      setParticles([]);
      isAnimatingRef.current = false;
      startTimeRef.current = null;
    }
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
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
            boxShadow: `0 0 ${particle.size * 1.5}px ${particle.color}, 0 0 ${particle.size * 3}px ${particle.color}`,
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
}
