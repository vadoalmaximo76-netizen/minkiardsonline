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

interface GoldenParticle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  delay: number;
}

interface GameStats {
  cardsPlayed: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  turnsPlayed: number;
  matchDuration: number;
  finalBlowCard?: { name: string; imageUrl?: string; deckType: string };
}

interface VictoryDefeatAnimationProps {
  type: 'victory' | 'defeat';
  visible: boolean;
  playerName: string;
  stats?: GameStats;
}

const CONFETTI_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#06b6d4', '#fbbf24'];
const FIREWORK_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6b9d', '#c084fc', '#67e8f9'];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function CountUpNumber({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = performance.now();
    const animate = (now: number) => {
      const elapsed = now - (startRef.current || now);
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return <>{value}</>;
}

export default function VictoryDefeatAnimation({ type, visible, playerName, stats }: VictoryDefeatAnimationProps) {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [fireworks, setFireworks] = useState<Firework[]>([]);
  const [defeatOpacity, setDefeatOpacity] = useState(0);
  const [defeatPhase, setDefeatPhase] = useState(0);
  const [victoryPhase, setVictoryPhase] = useState(-1);
  const animationRef = useRef<number | null>(null);
  const confettiRef = useRef<ConfettiPiece[]>([]);
  const fireworksRef = useRef<Firework[]>([]);
  const fireworkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const defeatTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const victoryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startTimeRef = useRef<number>(0);

  const goldenParticles = useMemo(() => {
    const particles: GoldenParticle[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        id: i,
        x: 50 + (((i * 7 + 13) % 80) - 40),
        y: 50 + (((i * 11 + 7) % 80) - 40),
        angle: (i / 60) * 360,
        speed: 2 + (i % 5) * 1.5,
        size: 3 + (i % 4) * 2,
        delay: (i % 10) * 0.05,
      });
    }
    return particles;
  }, []);

  const crackLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; width: number; delay: number }[] = [];
    const seeds = [23, 47, 61, 83, 97, 11, 37, 59, 73, 89, 31, 53];
    for (let i = 0; i < 12; i++) {
      const seed = seeds[i];
      lines.push({
        x1: 50 + ((seed * 3) % 40 - 20),
        y1: 50 + ((seed * 7) % 40 - 20),
        x2: 50 + ((seed * 3) % 40 - 20) + ((seed * 11) % 30 - 15),
        y2: 50 + ((seed * 7) % 40 - 20) + ((seed * 13) % 30 - 15),
        width: 1 + (seed % 3),
        delay: i * 0.08,
      });
    }
    return lines;
  }, []);

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

    if (elapsed < 9) {
      animationRef.current = requestAnimationFrame(animateVictory);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    if (type === 'victory') {
      startTimeRef.current = performance.now();
      setVictoryPhase(0);
      victoryTimersRef.current.forEach(t => clearTimeout(t));
      victoryTimersRef.current = [];

      victoryTimersRef.current.push(setTimeout(() => setVictoryPhase(1), 500));
      victoryTimersRef.current.push(setTimeout(() => setVictoryPhase(2), 1500));
      victoryTimersRef.current.push(setTimeout(() => {
        setVictoryPhase(3);
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
      }, 2500));

      victoryTimersRef.current.push(setTimeout(() => setVictoryPhase(4), 3500));
      victoryTimersRef.current.push(setTimeout(() => setVictoryPhase(5), 5000));
      victoryTimersRef.current.push(setTimeout(() => setVictoryPhase(6), 7000));

      animationRef.current = requestAnimationFrame(animateVictory);

      return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        if (fireworkTimerRef.current) clearInterval(fireworkTimerRef.current);
        victoryTimersRef.current.forEach(t => clearTimeout(t));
        victoryTimersRef.current = [];
      };
    }

    if (type === 'defeat') {
      setDefeatOpacity(0);
      setDefeatPhase(0);
      defeatTimersRef.current.forEach(t => clearTimeout(t));
      defeatTimersRef.current = [];
      
      defeatTimersRef.current.push(setTimeout(() => { setDefeatOpacity(0.3); setDefeatPhase(0); }, 100));
      defeatTimersRef.current.push(setTimeout(() => setDefeatPhase(1), 500));
      defeatTimersRef.current.push(setTimeout(() => { setDefeatOpacity(0.6); setDefeatPhase(2); }, 1500));
      defeatTimersRef.current.push(setTimeout(() => setDefeatPhase(3), 2500));
      defeatTimersRef.current.push(setTimeout(() => { setDefeatPhase(4); setDefeatOpacity(0.8); }, 3500));
      defeatTimersRef.current.push(setTimeout(() => { setDefeatPhase(5); setDefeatOpacity(0.95); }, 5000));

      return () => {
        defeatTimersRef.current.forEach(t => clearTimeout(t));
        defeatTimersRef.current = [];
      };
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (fireworkTimerRef.current) clearInterval(fireworkTimerRef.current);
      defeatTimersRef.current.forEach(t => clearTimeout(t));
      victoryTimersRef.current.forEach(t => clearTimeout(t));
      confettiRef.current = [];
      fireworksRef.current = [];
      setConfetti([]);
      setFireworks([]);
      setDefeatOpacity(0);
      setDefeatPhase(0);
      setVictoryPhase(-1);
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
          background: defeatPhase === 0
            ? 'radial-gradient(ellipse at center, rgba(200,0,0,0.4) 0%, rgba(0,0,0,0.8) 100%)'
            : `radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,${defeatOpacity}) 100%)`,
          transition: 'all 0.8s ease-in-out',
          animation: defeatPhase === 0 ? 'defeatFlashRed 0.5s ease-out' : undefined,
        }} />

        {defeatPhase >= 1 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(180, 20, 20, 0.4) 0%, transparent 70%)',
            animation: 'defeatPulseRed 1.5s ease-in-out infinite',
          }} />
        )}

        {defeatPhase >= 1 && (
          <svg style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
          }}>
            {crackLines.map((line, i) => (
              <line
                key={i}
                x1={`${line.x1}%`}
                y1={`${line.y1}%`}
                x2={`${line.x2}%`}
                y2={`${line.y2}%`}
                stroke="rgba(255,255,255,0.6)"
                strokeWidth={line.width}
                style={{
                  animation: `crackAppear 0.3s ease-out forwards`,
                  animationDelay: `${line.delay}s`,
                  opacity: 0,
                  filter: 'drop-shadow(0 0 4px rgba(255,100,100,0.8))',
                }}
              />
            ))}
          </svg>
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
                background: 'linear-gradient(180deg, transparent, rgba(180, 20, 20, 0.3), transparent)',
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
            background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.4) 100%)',
          }} />
        )}

        {defeatPhase >= 2 && (
          <div style={{
            position: 'absolute',
            top: stats ? '35%' : '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 'clamp(32px, 8vw, 72px)',
              fontWeight: 900,
              color: '#dc2626',
              textShadow: '0 0 40px rgba(220, 38, 38, 0.8), 0 0 80px rgba(220, 38, 38, 0.4), 3px 3px 10px rgba(0,0,0,0.9)',
              letterSpacing: '8px',
              animation: 'shatterTextIn 0.8s ease-out forwards',
              textTransform: 'uppercase',
            }}>
              SCONFITTA
            </div>
            {defeatPhase >= 3 && (
              <div style={{
                animation: 'fadeSlideUp 0.8s ease-out forwards',
                opacity: 0,
                marginTop: '20px',
              }}>
                <div style={{
                  fontSize: 'clamp(14px, 3vw, 20px)',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginBottom: '8px',
                  textShadow: '1px 1px 4px rgba(0,0,0,0.8)',
                }}>
                  Ha vinto
                </div>
                <div style={{
                  fontSize: 'clamp(20px, 5vw, 36px)',
                  fontWeight: 700,
                  color: 'rgba(251, 191, 36, 0.7)',
                  textShadow: '0 0 20px rgba(251, 191, 36, 0.3), 2px 2px 6px rgba(0,0,0,0.8)',
                  letterSpacing: '2px',
                }}>
                  {playerName}
                </div>
              </div>
            )}
          </div>
        )}

        {defeatPhase >= 4 && stats && (
          <div style={{
            position: 'absolute',
            bottom: '15%',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            animation: 'fadeSlideUp 1s ease-out forwards',
            opacity: 0,
          }}>
            <div style={{
              display: 'flex',
              gap: '24px',
              flexWrap: 'wrap',
              justifyContent: 'center',
              maxWidth: '600px',
            }}>
              {[
                { label: 'Carte Giocate', value: stats.cardsPlayed },
                { label: 'Danni Inflitti', value: stats.totalDamageDealt },
                { label: 'Danni Subiti', value: stats.totalDamageReceived },
                { label: 'Turni Giocati', value: stats.turnsPlayed },
              ].map((stat, i) => (
                <div key={i} style={{
                  background: 'rgba(0,0,0,0.5)',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  minWidth: '100px',
                  animation: `statAppear 0.5s ease-out forwards`,
                  animationDelay: `${i * 0.15}s`,
                  opacity: 0,
                }}>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#f87171' }}>
                    <CountUpNumber target={stat.value} duration={1200} />
                  </div>
                </div>
              ))}
            </div>
            {stats.matchDuration > 0 && (
              <div style={{
                marginTop: '16px',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.4)',
                animation: 'statAppear 0.5s ease-out forwards',
                animationDelay: '0.6s',
                opacity: 0,
              }}>
                Durata Partita: {formatDuration(stats.matchDuration)}
              </div>
            )}
          </div>
        )}

        {defeatPhase >= 5 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            animation: 'fadeInSlow 1.5s ease-in forwards',
            opacity: 0,
          }} />
        )}

        <style>{`
          @keyframes defeatFlashRed {
            0% { background: rgba(200,0,0,0.6); }
            100% { background: transparent; }
          }
          @keyframes defeatPulseRed {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.8; }
          }
          @keyframes defeatPulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.7; }
          }
          @keyframes defeatLine {
            0%, 100% { opacity: 0; transform: scaleY(0.5); }
            50% { opacity: 1; transform: scaleY(1); }
          }
          @keyframes crackAppear {
            0% { opacity: 0; stroke-dashoffset: 100; }
            100% { opacity: 0.8; stroke-dashoffset: 0; }
          }
          @keyframes shatterTextIn {
            0% { opacity: 0; transform: scale(3) rotate(-5deg); filter: blur(10px); }
            40% { opacity: 1; transform: scale(0.9) rotate(1deg); filter: blur(0); }
            60% { transform: scale(1.05) rotate(-0.5deg); }
            100% { opacity: 1; transform: scale(1) rotate(0deg); filter: blur(0); }
          }
          @keyframes fadeSlideUp {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes statAppear {
            0% { opacity: 0; transform: translateY(10px) scale(0.9); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes fadeInSlow {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
          @keyframes winnerTextAppear {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
            60% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
            100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
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
      animation: victoryPhase >= 2 ? 'cameraShake 0.5s ease-out' : undefined,
    }}>
      {victoryPhase >= 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          opacity: victoryPhase === 0 ? 1 : 0.4,
          transition: 'opacity 0.5s ease-in-out',
        }} />
      )}

      {victoryPhase >= 1 && (
        <div style={{
          position: 'absolute',
          inset: 0,
        }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '200vmax',
            height: '200vmax',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,191,36,0.6) 0%, rgba(251,191,36,0.2) 30%, transparent 60%)',
            animation: 'goldenExplosion 1.5s ease-out forwards',
          }} />
          {goldenParticles.map(p => (
            <div key={p.id} style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              borderRadius: '50%',
              background: '#fbbf24',
              boxShadow: '0 0 8px #fbbf24, 0 0 16px rgba(251,191,36,0.5)',
              animation: `goldenParticle 1.5s ease-out forwards`,
              animationDelay: `${p.delay}s`,
              opacity: 0,
            }} />
          ))}
        </div>
      )}

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

      {victoryPhase >= 2 && (
        <div style={{
          position: 'absolute',
          top: stats ? '25%' : '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 'clamp(36px, 10vw, 80px)',
            fontWeight: 900,
            color: '#fbbf24',
            textShadow: '0 0 40px rgba(251, 191, 36, 0.8), 0 0 80px rgba(251, 191, 36, 0.4), 0 0 120px rgba(251, 191, 36, 0.2), 3px 3px 10px rgba(0,0,0,0.9)',
            letterSpacing: '8px',
            animation: 'victorySlamIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
            textTransform: 'uppercase',
          }}>
            VITTORIA
          </div>
          {victoryPhase >= 3 && (
            <div style={{
              animation: 'fadeSlideUp 0.8s ease-out forwards',
              opacity: 0,
              marginTop: '12px',
            }}>
              <div style={{
                fontSize: 'clamp(28px, 7vw, 56px)',
                fontWeight: 900,
                color: '#ffffff',
                textShadow: '0 0 20px rgba(255, 255, 255, 0.5), 0 0 40px rgba(251, 191, 36, 0.3), 3px 3px 10px rgba(0,0,0,0.9)',
                letterSpacing: '2px',
              }}>
                {playerName}
              </div>
              <div style={{
                fontSize: 'clamp(14px, 3vw, 20px)',
                color: 'rgba(255, 255, 255, 0.7)',
                marginTop: '8px',
                textShadow: '1px 1px 4px rgba(0,0,0,0.8)',
              }}>
                ha vinto la partita!
              </div>
            </div>
          )}
        </div>
      )}

      {victoryPhase >= 4 && stats?.finalBlowCard && (
        <div style={{
          position: 'absolute',
          top: stats ? '52%' : '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          animation: 'finalBlowAppear 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
          opacity: 0,
        }}>
          <div style={{
            fontSize: 'clamp(12px, 2.5vw, 18px)',
            fontWeight: 700,
            color: '#fbbf24',
            textShadow: '0 0 20px rgba(251, 191, 36, 0.6)',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            marginBottom: '12px',
          }}>
            COLPO FINALE
          </div>
          <div style={{
            position: 'relative',
            display: 'inline-block',
          }}>
            <div style={{
              position: 'absolute',
              inset: '-8px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(251,191,36,0.6), rgba(245,158,11,0.4), rgba(251,191,36,0.6))',
              animation: 'goldenGlowPulse 2s ease-in-out infinite',
              filter: 'blur(8px)',
            }} />
            {stats.finalBlowCard.imageUrl ? (
              <img
                src={stats.finalBlowCard.imageUrl}
                alt={stats.finalBlowCard.name}
                style={{
                  position: 'relative',
                  width: 'clamp(80px, 20vw, 140px)',
                  height: 'auto',
                  borderRadius: '8px',
                  border: '2px solid rgba(251,191,36,0.8)',
                  boxShadow: '0 0 30px rgba(251,191,36,0.5), 0 4px 20px rgba(0,0,0,0.5)',
                }}
              />
            ) : (
              <div style={{
                position: 'relative',
                width: 'clamp(80px, 20vw, 140px)',
                height: 'clamp(110px, 28vw, 190px)',
                borderRadius: '8px',
                border: '2px solid rgba(251,191,36,0.8)',
                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 30px rgba(251,191,36,0.5), 0 4px 20px rgba(0,0,0,0.5)',
              }}>
                <span style={{ fontSize: '14px', color: '#fbbf24', fontWeight: 700, textAlign: 'center', padding: '8px' }}>
                  {stats.finalBlowCard.name}
                </span>
              </div>
            )}
          </div>
          <div style={{
            marginTop: '10px',
            fontSize: 'clamp(14px, 3vw, 20px)',
            fontWeight: 700,
            color: '#ffffff',
            textShadow: '0 0 10px rgba(251,191,36,0.4)',
          }}>
            {stats.finalBlowCard.name}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
            marginTop: '4px',
            textTransform: 'capitalize',
          }}>
            {stats.finalBlowCard.deckType}
          </div>
        </div>
      )}

      {victoryPhase >= 5 && stats && (
        <div style={{
          position: 'absolute',
          bottom: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          animation: 'fadeSlideUp 1s ease-out forwards',
          opacity: 0,
        }}>
          <div style={{
            display: 'flex',
            gap: '20px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: '650px',
          }}>
            {[
              { label: 'Carte Giocate', value: stats.cardsPlayed, icon: '🃏' },
              { label: 'Danni Inflitti', value: stats.totalDamageDealt, icon: '⚔️' },
              { label: 'Danni Subiti', value: stats.totalDamageReceived, icon: '🛡️' },
              { label: 'Turni Giocati', value: stats.turnsPlayed, icon: '🔄' },
            ].map((stat, i) => (
              <div key={i} style={{
                background: 'rgba(0,0,0,0.6)',
                borderRadius: '10px',
                padding: '12px 18px',
                border: '1px solid rgba(251,191,36,0.3)',
                minWidth: '110px',
                backdropFilter: 'blur(8px)',
                animation: `statAppear 0.5s ease-out forwards`,
                animationDelay: `${i * 0.2}s`,
                opacity: 0,
              }}>
                <div style={{ fontSize: '18px', marginBottom: '4px' }}>{stat.icon}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#fbbf24', textShadow: '0 0 10px rgba(251,191,36,0.4)' }}>
                  <CountUpNumber target={stat.value} />
                </div>
              </div>
            ))}
          </div>
          {stats.matchDuration > 0 && (
            <div style={{
              marginTop: '16px',
              fontSize: '15px',
              color: 'rgba(255,255,255,0.6)',
              animation: 'statAppear 0.5s ease-out forwards',
              animationDelay: '0.8s',
              opacity: 0,
            }}>
              ⏱️ Durata Partita: {formatDuration(stats.matchDuration)}
            </div>
          )}
        </div>
      )}

      {victoryPhase >= 6 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          animation: 'fadeInSlow 1.5s ease-in forwards',
          opacity: 0,
        }} />
      )}

      <style>{`
        @keyframes cameraShake {
          0% { transform: translate(0, 0); }
          10% { transform: translate(-4px, -3px); }
          20% { transform: translate(4px, 2px); }
          30% { transform: translate(-3px, 4px); }
          40% { transform: translate(3px, -2px); }
          50% { transform: translate(-2px, 3px); }
          60% { transform: translate(2px, -3px); }
          70% { transform: translate(-1px, 2px); }
          80% { transform: translate(1px, -1px); }
          90% { transform: translate(-1px, 1px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes goldenExplosion {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          50% { opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
        @keyframes goldenParticle {
          0% { opacity: 0; transform: scale(0); }
          30% { opacity: 1; transform: scale(1.5); }
          100% { opacity: 0; transform: scale(0.5) translateY(-50px); }
        }
        @keyframes victorySlamIn {
          0% { opacity: 0; transform: scale(4) rotate(-3deg); filter: blur(8px); }
          50% { opacity: 1; transform: scale(0.85) rotate(1deg); filter: blur(0); }
          70% { transform: scale(1.1) rotate(-0.5deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes finalBlowAppear {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3) rotate(-10deg); }
          60% { opacity: 1; transform: translate(-50%, -50%) scale(1.1) rotate(2deg); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
        }
        @keyframes goldenGlowPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes fadeSlideUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes statAppear {
          0% { opacity: 0; transform: translateY(10px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeInSlow {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes winnerTextAppear {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          60% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}
