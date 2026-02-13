import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  opacity: number;
  shape: 'rect' | 'circle' | 'star';
}

interface FireworkParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  opacity: number;
  trail: { x: number; y: number }[];
}

interface Firework {
  id: number;
  particles: FireworkParticle[];
  startTime: number;
}

interface VictoryDefeatAnimationProps {
  type: 'victory' | 'defeat';
  visible: boolean;
  playerName: string;
}

const CONFETTI_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#06b6d4', '#fbbf24'];
const FIREWORK_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6b9d', '#c084fc', '#67e8f9'];

export default function VictoryDefeatAnimation({ type, visible, playerName }: VictoryDefeatAnimationProps) {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [fireworks, setFireworks] = useState<Firework[]>([]);
  const [defeatOpacity, setDefeatOpacity] = useState(0);
  const [defeatPhase, setDefeatPhase] = useState(0);
  const animationRef = useRef<number | null>(null);
  const confettiRef = useRef<ConfettiPiece[]>([]);
  const fireworksRef = useRef<Firework[]>([]);
  const fireworkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const defeatTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startTimeRef = useRef<number>(0);

  const createConfettiBurst = useCallback(() => {
    const pieces: ConfettiPiece[] = [];
    const count = 80;
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const speed = 3 + Math.random() * 8;
      const shapes: ('rect' | 'circle' | 'star')[] = ['rect', 'circle', 'star'];
      
      pieces.push({
        id: i,
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
        y: window.innerHeight * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 6 + Math.random() * 10,
        opacity: 1,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
      });
    }
    return pieces;
  }, []);

  const createFirework = useCallback((id: number) => {
    const centerX = Math.random() * window.innerWidth * 0.6 + window.innerWidth * 0.2;
    const centerY = Math.random() * window.innerHeight * 0.4 + window.innerHeight * 0.1;
    const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    const particleCount = 30 + Math.floor(Math.random() * 20);
    const particles: FireworkParticle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = 2 + Math.random() * 4;
      particles.push({
        id: i,
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2 + Math.random() * 3,
        opacity: 1,
        trail: [],
      });
    }

    return { id, particles, startTime: performance.now() };
  }, []);

  const animateVictory = useCallback(() => {
    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    
    confettiRef.current = confettiRef.current.map(p => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      vy: p.vy + 0.15,
      vx: p.vx * 0.99,
      rotation: p.rotation + p.rotationSpeed,
      opacity: Math.max(0, p.opacity - 0.003),
    })).filter(p => p.opacity > 0 && p.y < window.innerHeight + 50);

    fireworksRef.current = fireworksRef.current.map(fw => ({
      ...fw,
      particles: fw.particles.map(p => ({
        ...p,
        trail: [...p.trail.slice(-3), { x: p.x, y: p.y }],
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.03,
        vx: p.vx * 0.98,
        opacity: Math.max(0, p.opacity - 0.015),
        size: p.size * 0.995,
      })).filter(p => p.opacity > 0),
    })).filter(fw => fw.particles.length > 0);

    setConfetti([...confettiRef.current]);
    setFireworks([...fireworksRef.current]);

    if (elapsed < 8) {
      animationRef.current = requestAnimationFrame(animateVictory);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    if (type === 'victory') {
      startTimeRef.current = performance.now();
      const initialConfetti = createConfettiBurst();
      confettiRef.current = initialConfetti;
      setConfetti(initialConfetti);

      const firstFirework = createFirework(0);
      fireworksRef.current = [firstFirework];
      setFireworks([firstFirework]);

      let fwId = 1;
      fireworkTimerRef.current = setInterval(() => {
        const newFw = createFirework(fwId++);
        fireworksRef.current.push(newFw);
        
        if (fwId % 3 === 0) {
          const extraConfetti = createConfettiBurst();
          confettiRef.current = [...confettiRef.current, ...extraConfetti];
        }
      }, 600);

      animationRef.current = requestAnimationFrame(animateVictory);

      return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        if (fireworkTimerRef.current) clearInterval(fireworkTimerRef.current);
      };
    }

    if (type === 'defeat') {
      setDefeatOpacity(0);
      setDefeatPhase(0);
      defeatTimersRef.current.forEach(t => clearTimeout(t));
      defeatTimersRef.current = [];
      
      defeatTimersRef.current.push(setTimeout(() => setDefeatOpacity(0.3), 100));
      defeatTimersRef.current.push(setTimeout(() => setDefeatPhase(1), 300));
      defeatTimersRef.current.push(setTimeout(() => setDefeatOpacity(0.6), 600));
      defeatTimersRef.current.push(setTimeout(() => setDefeatPhase(2), 1000));
      defeatTimersRef.current.push(setTimeout(() => setDefeatOpacity(0.8), 1400));
      defeatTimersRef.current.push(setTimeout(() => setDefeatPhase(3), 1800));

      return () => {
        defeatTimersRef.current.forEach(t => clearTimeout(t));
        defeatTimersRef.current = [];
      };
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (fireworkTimerRef.current) clearInterval(fireworkTimerRef.current);
      defeatTimersRef.current.forEach(t => clearTimeout(t));
      confettiRef.current = [];
      fireworksRef.current = [];
      setConfetti([]);
      setFireworks([]);
      setDefeatOpacity(0);
      setDefeatPhase(0);
    };
  }, [visible, type, createConfettiBurst, createFirework, animateVictory]);

  if (!visible) return null;

  if (type === 'defeat') {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        pointerEvents: 'none',
        transition: 'all 1.5s ease-in-out',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,${defeatOpacity}) 100%)`,
          transition: 'all 1s ease-in-out',
        }} />
        {defeatPhase >= 1 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(127, 29, 29, 0.3) 0%, transparent 70%)',
            animation: 'defeatPulse 2s ease-in-out infinite',
          }} />
        )}
        {defeatPhase >= 2 && (
          <>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${15 + i * 15}%`,
                top: 0,
                width: '2px',
                height: '100%',
                background: 'linear-gradient(180deg, transparent, rgba(127, 29, 29, 0.2), transparent)',
                animation: `defeatLine ${2 + i * 0.3}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }} />
            ))}
          </>
        )}
        {defeatPhase >= 3 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.3) 100%)',
          }} />
        )}
        <style>{`
          @keyframes defeatPulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.7; }
          }
          @keyframes defeatLine {
            0%, 100% { opacity: 0; transform: scaleY(0.5); }
            50% { opacity: 1; transform: scaleY(1); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9998,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {fireworks.map(fw => (
        fw.particles.map(p => (
          <React.Fragment key={`${fw.id}-${p.id}`}>
            {p.trail.map((t, ti) => (
              <div key={`trail-${ti}`} style={{
                position: 'absolute',
                left: `${t.x}px`,
                top: `${t.y}px`,
                width: `${p.size * 0.6}px`,
                height: `${p.size * 0.6}px`,
                borderRadius: '50%',
                backgroundColor: p.color,
                opacity: p.opacity * (ti / p.trail.length) * 0.5,
                transform: 'translate(-50%, -50%)',
              }} />
            ))}
            <div style={{
              position: 'absolute',
              left: `${p.x}px`,
              top: `${p.y}px`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              borderRadius: '50%',
              backgroundColor: p.color,
              opacity: p.opacity,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}, 0 0 ${p.size * 4}px ${p.color}`,
              transform: 'translate(-50%, -50%)',
            }} />
          </React.Fragment>
        ))
      ))}
      {confetti.map(p => (
        <div key={`c-${p.id}-${Math.round(p.x)}`} style={{
          position: 'absolute',
          left: `${p.x}px`,
          top: `${p.y}px`,
          width: p.shape === 'circle' ? `${p.size}px` : `${p.size * 0.6}px`,
          height: `${p.size}px`,
          borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'star' ? '2px' : '2px',
          backgroundColor: p.color,
          opacity: p.opacity,
          transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`,
          boxShadow: p.shape === 'star' ? `0 0 ${p.size}px ${p.color}` : 'none',
        }} />
      ))}
    </div>
  );
}
