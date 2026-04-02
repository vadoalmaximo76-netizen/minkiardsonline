import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

interface FootballMinigamesProps {
  authToken: string | null;
  onClose: () => void;
  onCreditsEarned: (credits: number) => void;
}

type MinigameType = 'rigori' | 'bersaglio' | 'palleggi' | 'tiro_al_volo' | null;

/* ── Credits award helper ─────────────────────────────────────── */
async function awardMinigameCredits(authToken: string, credits: number, game: string): Promise<boolean> {
  try {
    const res = await fetch('/api/football-minigame/award', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ credits, game }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

/* ── Result screen ─────────────────────────────────────────────── */
interface ResultScreenProps {
  title: string;
  emoji: string;
  credits: number;
  detail: string;
  onClose: () => void;
  loading: boolean;
}

function ResultScreen({ title, emoji, credits, detail, onClose, loading }: ResultScreenProps) {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20,
    }}>
      <div style={{
        background: 'rgba(5,5,25,0.98)', border: '2px solid rgba(251,191,36,0.5)',
        borderRadius: 20, padding: '32px 28px', textAlign: 'center', maxWidth: 320, width: '90%',
        boxShadow: '0 0 60px rgba(251,191,36,0.15)',
      }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>{emoji}</div>
        <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: 20, marginBottom: 8 }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginBottom: 16 }}>{detail}</div>
        {credits > 0 && (
          <div style={{
            background: 'rgba(251,191,36,0.12)', border: '1.5px solid rgba(251,191,36,0.4)',
            borderRadius: 12, padding: '12px 20px', marginBottom: 20, display: 'inline-block',
          }}>
            <span style={{ color: '#fbbf24', fontWeight: 900, fontSize: 24 }}>+{credits}</span>
            <span style={{ color: 'rgba(251,191,36,0.7)', fontWeight: 700, fontSize: 16, marginLeft: 6 }}>Rankiard</span>
          </div>
        )}
        {credits === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 20 }}>Nessun credito questa volta</div>
        )}
        <button
          onClick={onClose}
          disabled={loading}
          style={{
            background: 'linear-gradient(135deg,#9333ea,#f59e0b)', border: 'none',
            borderRadius: 12, color: 'white', fontWeight: 900, fontSize: 16,
            padding: '12px 28px', cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1, width: '100%',
          }}
        >
          {loading ? 'Salvataggio…' : '✓ Torna alla mappa'}
        </button>
      </div>
    </div>
  );
}

/* ── Mini-gioco 1: Rigori ──────────────────────────────────────── */
function Rigori({ onFinish }: { onFinish: (goals: number, total: number) => void }) {
  const [round, setRound] = useState(0);
  const [goals, setGoals] = useState(0);
  const [goalkeeperPos, setGoalkeeperPos] = useState<number | null>(null);
  const [playerChoice, setPlayerChoice] = useState<number | null>(null);
  const [roundResult, setRoundResult] = useState<'goal' | 'saved' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const TOTAL_ROUNDS = 5;
  const GRID_COLS = 3;
  const GRID_ROWS = 3;

  const shoot = useCallback((cell: number) => {
    if (isAnimating || round >= TOTAL_ROUNDS) return;
    setIsAnimating(true);
    setPlayerChoice(cell);

    const gkTendency = Math.random() < 0.55 ? 4 : Math.floor(Math.random() * 9);
    setGoalkeeperPos(gkTendency);

    const isGoal = cell !== gkTendency;
    setTimeout(() => {
      setRoundResult(isGoal ? 'goal' : 'saved');
      if (isGoal) setGoals(g => g + 1);
      setTimeout(() => {
        const nextRound = round + 1;
        if (nextRound >= TOTAL_ROUNDS) {
          onFinish(goals + (isGoal ? 1 : 0), TOTAL_ROUNDS);
        } else {
          setRound(nextRound);
          setGoalkeeperPos(null);
          setPlayerChoice(null);
          setRoundResult(null);
          setIsAnimating(false);
        }
      }, 1200);
    }, 600);
  }, [isAnimating, round, goals, onFinish]);

  const cellLabels = ['↖', '↑', '↗', '←', '●', '→', '↙', '↓', '↘'];
  const currentGoals = goals;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 16, flex: 1 }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 700 }}>
        Calcio {round + 1} di {TOTAL_ROUNDS} · Gol: <span style={{ color: '#4ade80', fontWeight: 900 }}>{currentGoals}</span>
      </div>

      {/* Goal visual */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 320, aspectRatio: '2/1',
        border: '3px solid white', borderBottom: 'none',
        background: 'rgba(0,0,0,0.2)', borderRadius: '4px 4px 0 0',
        overflow: 'hidden',
      }}>
        {/* Net lines */}
        {[1,2,3,4,5,6,7].map(i => (
          <div key={`v${i}`} style={{ position: 'absolute', left: `${i * 12.5}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.15)' }} />
        ))}
        {[1,2,3].map(i => (
          <div key={`h${i}`} style={{ position: 'absolute', top: `${i * 25}%`, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.15)' }} />
        ))}

        {/* Goalkeeper */}
        {goalkeeperPos !== null && (
          <div style={{
            position: 'absolute',
            left: `${((goalkeeperPos % GRID_COLS) / GRID_COLS * 100) + 12}%`,
            top: `${(Math.floor(goalkeeperPos / GRID_COLS) / GRID_ROWS * 100) + 8}%`,
            fontSize: 28, transition: 'all 0.4s ease',
            transform: 'translateX(-50%)',
          }}>🧤</div>
        )}

        {/* Ball */}
        {playerChoice !== null && (
          <div style={{
            position: 'absolute',
            left: `${((playerChoice % GRID_COLS) / GRID_COLS * 100) + 16}%`,
            top: `${(Math.floor(playerChoice / GRID_COLS) / GRID_ROWS * 100) + 5}%`,
            fontSize: 22, transition: 'all 0.5s ease',
            transform: 'translateX(-50%)',
          }}>⚽</div>
        )}

        {/* Result */}
        {roundResult && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: roundResult === 'goal' ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)',
            fontSize: 36, fontWeight: 900,
          }}>
            {roundResult === 'goal' ? '⚽ GOL!' : '🧤 Parato!'}
          </div>
        )}
      </div>

      {/* Grid selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 280, width: '100%' }}>
        {Array.from({ length: 9 }, (_, i) => (
          <button
            key={i}
            onClick={() => shoot(i)}
            disabled={isAnimating}
            style={{
              aspectRatio: '1',
              background: playerChoice === i
                ? (roundResult === 'goal' ? 'rgba(74,222,128,0.4)' : roundResult === 'saved' ? 'rgba(239,68,68,0.4)' : 'rgba(147,51,234,0.5)')
                : 'rgba(255,255,255,0.1)',
              border: `1.5px solid ${playerChoice === i ? (roundResult === 'goal' ? '#4ade80' : roundResult === 'saved' ? '#ef4444' : '#9333ea') : 'rgba(255,255,255,0.2)'}`,
              borderRadius: 10, color: 'white', fontSize: 20, cursor: isAnimating ? 'default' : 'pointer',
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {cellLabels[i]}
          </button>
        ))}
      </div>

      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
        Clicca una cella per tirare
      </div>
    </div>
  );
}

/* ── Mini-gioco 2: Tiro al Bersaglio ─────────────────────────── */
function TiroAlBersaglio({ onFinish }: { onFinish: (score: number) => void }) {
  const [targets, setTargets] = useState<{ id: number; x: number; y: number; size: number; born: number }[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [running, setRunning] = useState(true);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const nextId = useRef(0);
  const scoreRef = useRef(0);
  const runningRef = useRef(true);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  const spawnTarget = useCallback(() => {
    if (!runningRef.current) return;
    const elapsed = 30 - timeLeft;
    const speed = Math.min(1 + elapsed * 0.05, 2.5);
    const size = Math.max(30, 70 - elapsed);
    setTargets(prev => [
      ...prev.slice(-4),
      {
        id: nextId.current++,
        x: 5 + Math.random() * 80,
        y: 10 + Math.random() * 70,
        size,
        born: Date.now(),
      },
    ]);
    const delay = Math.max(600, 1800 - elapsed * 30);
    setTimeout(spawnTarget, delay);
  }, [timeLeft]);

  useEffect(() => {
    const t = setTimeout(spawnTarget, 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setRunning(false);
          runningRef.current = false;
          clearInterval(interval);
          onFinish(scoreRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running, onFinish]);

  const hitTarget = useCallback((id: number) => {
    if (!running) return;
    setTargets(prev => prev.filter(t => t.id !== id));
    setScore(s => { const ns = Math.max(0, s + 10); scoreRef.current = ns; return ns; });
    setHits(h => h + 1);
  }, [running]);

  const missClick = useCallback(() => {
    if (!running) return;
    setScore(s => { const ns = Math.max(0, s - 3); scoreRef.current = ns; return ns; });
    setMisses(m => m + 1);
  }, [running]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 8, padding: '8px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700 }}>
          ✅ {hits} · ❌ {misses}
        </div>
        <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: 18 }}>
          ⏱ {timeLeft}s
        </div>
        <div style={{ color: '#4ade80', fontWeight: 900, fontSize: 18 }}>
          {score} pt
        </div>
      </div>

      {/* Field */}
      <div
        onClick={missClick}
        style={{
          flex: 1, position: 'relative', background: '#2d8a2d',
          border: '4px solid white', borderRadius: 8, overflow: 'hidden',
          cursor: 'crosshair', userSelect: 'none',
        }}
      >
        {/* Goal */}
        <div style={{
          position: 'absolute', top: '15%', left: '10%', right: '10%', height: '40%',
          border: '3px solid rgba(255,255,255,0.8)', borderBottom: 'none',
          pointerEvents: 'none',
        }} />

        {targets.map(t => {
          const age = (Date.now() - t.born) / 1000;
          const alpha = Math.max(0, 1 - age / 2.5);
          return (
            <button
              key={t.id}
              onClick={e => { e.stopPropagation(); hitTarget(t.id); }}
              style={{
                position: 'absolute',
                left: `${t.x}%`, top: `${t.y}%`,
                width: t.size, height: t.size,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                background: `radial-gradient(circle, rgba(239,68,68,${alpha}), rgba(180,20,20,${alpha * 0.8}))`,
                border: `3px solid rgba(255,200,0,${alpha})`,
                cursor: 'pointer', zIndex: 5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: t.size * 0.4,
                boxShadow: `0 0 ${t.size * 0.3}px rgba(239,68,68,${alpha * 0.5})`,
                transition: 'opacity 0.1s',
              }}
            >
              🎯
            </button>
          );
        })}

        {!running && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fbbf24', fontWeight: 900, fontSize: 24,
          }}>
            Tempo scaduto!
          </div>
        )}
      </div>

      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center' }}>
        +10 pt per bersaglio · -3 pt per mancato
      </div>
    </div>
  );
}

/* ── Mini-gioco 3: Palleggi ───────────────────────────────────── */
function Palleggi({ onFinish }: { onFinish: (count: number) => void }) {
  const [count, setCount] = useState(0);
  const [ballY, setBallY] = useState(30);
  const [ballX, setBallX] = useState(50);
  const [velocity, setVelocity] = useState(8);
  const [running, setRunning] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [hit, setHit] = useState(false);
  const ballYRef = useRef(30);
  const velocityRef = useRef(8);
  const countRef = useRef(0);
  const runningRef = useRef(true);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef(performance.now());
  const hitZone = { y: 72, h: 12 };

  const handleTap = useCallback(() => {
    if (!runningRef.current) return;
    const by = ballYRef.current;
    if (by >= hitZone.y - 5 && by <= hitZone.y + hitZone.h + 5) {
      const newCount = countRef.current + 1;
      countRef.current = newCount;
      setCount(newCount);
      const newVel = Math.min(velocityRef.current + 0.8, 20);
      velocityRef.current = newVel;
      setVelocity(newVel);
      ballYRef.current = hitZone.y - 20;
      setBallY(hitZone.y - 20);
      setBallX(30 + Math.random() * 40);
      setHit(true);
      setTimeout(() => setHit(false), 200);
    }
  }, [hitZone.h, hitZone.y]);

  useEffect(() => {
    const tick = (now: number) => {
      if (!runningRef.current) return;
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      const newY = ballYRef.current + velocityRef.current * dt * 30;
      ballYRef.current = newY;
      setBallY(newY);
      if (newY > 95) {
        runningRef.current = false;
        setRunning(false);
        setGameOver(true);
        onFinish(countRef.current);
        return;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [onFinish]);

  return (
    <div
      onClick={handleTap}
      style={{
        flex: 1, position: 'relative', background: 'linear-gradient(180deg, #1a3c8a 0%, #2d6b2d 60%, #3db03d 100%)',
        display: 'flex', flexDirection: 'column', cursor: 'pointer', userSelect: 'none',
        padding: 16, gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
          Palleggi: <span style={{ color: '#fbbf24', fontWeight: 900, fontSize: 18 }}>{count}</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          Velocità: {velocity.toFixed(1)}x
        </div>
      </div>

      {/* Game area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Ball */}
        <div style={{
          position: 'absolute',
          left: `${ballX}%`, top: `${ballY}%`,
          fontSize: 32, transform: 'translate(-50%, -50%)',
          filter: hit ? 'brightness(2)' : 'none',
          transition: 'filter 0.1s',
        }}>⚽</div>

        {/* Hit zone */}
        <div style={{
          position: 'absolute',
          left: '5%', right: '5%',
          top: `${hitZone.y}%`, height: `${hitZone.h}%`,
          background: 'rgba(251,191,36,0.25)',
          border: '2px dashed rgba(251,191,36,0.7)',
          borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: 'rgba(251,191,36,0.7)', fontSize: 11, fontWeight: 700 }}>
            👟 ZONA DI TIRO
          </span>
        </div>

        {gameOver && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#ef4444', fontWeight: 900, fontSize: 24, gap: 8,
          }}>
            <span>😞 Pallone perso!</span>
            <span style={{ fontSize: 16, color: '#fbbf24' }}>{count} palleggi</span>
          </div>
        )}
      </div>

      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', pointerEvents: 'none' }}>
        Tocca quando il pallone è nella zona gialla!
      </div>
    </div>
  );
}

/* ── Mini-gioco 4: Tiro al Volo ──────────────────────────────── */
function TiroAlVolo({ onFinish }: { onFinish: (goals: number) => void }) {
  const ATTEMPTS = 5;
  const [attempt, setAttempt] = useState(0);
  const [goals, setGoals] = useState(0);
  const [phase, setPhase] = useState<'waiting' | 'incoming' | 'impact' | 'choose' | 'result'>('waiting');
  const [ballX, setBallX] = useState(0);
  const [ballY, setBallY] = useState(50);
  const [direction, setDirection] = useState<'left' | 'center' | 'right' | null>(null);
  const [gkPos, setGkPos] = useState<'left' | 'center' | 'right'>('center');
  const [shotResult, setShotResult] = useState<'goal' | 'saved' | 'missed' | null>(null);
  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);
  const [powerDir, setPowerDir] = useState(1);
  const chargeRef = useRef<NodeJS.Timeout | null>(null);
  const powerRef = useRef(0);

  const startAttempt = useCallback(() => {
    if (attempt >= ATTEMPTS) return;
    setPhase('incoming');
    setBallX(0);
    setBallY(50);
    setDirection(null);
    setGkPos('center');
    setShotResult(null);
    setPower(0);
    powerRef.current = 0;
    setCharging(false);

    let startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / 1500, 1);
      setBallX(progress * 60);
      setBallY(50 + Math.sin(progress * Math.PI) * 10);
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setPhase('choose');
        startCharging();
      }
    };
    requestAnimationFrame(animate);
  }, [attempt]);

  const startCharging = useCallback(() => {
    setCharging(true);
    let p = 0;
    let dir = 1;
    chargeRef.current = setInterval(() => {
      p += dir * 3;
      if (p >= 100) { p = 100; dir = -1; }
      if (p <= 0) { p = 0; dir = 1; }
      powerRef.current = p;
      setPower(p);
      setPowerDir(dir);
    }, 30);
  }, []);

  const stopCharging = useCallback(() => {
    if (chargeRef.current) clearInterval(chargeRef.current);
    setCharging(false);
  }, []);

  const shoot = useCallback((dir: 'left' | 'center' | 'right') => {
    if (phase !== 'choose') return;
    stopCharging();
    setDirection(dir);
    const gk: ('left' | 'center' | 'right')[] = ['left', 'center', 'right'];
    const randomGk = gk[Math.floor(Math.random() * 3)];
    setGkPos(randomGk);

    const currentPower = powerRef.current;
    const isGoal = dir !== randomGk && currentPower > 25;
    setShotResult(isGoal ? 'goal' : 'saved');
    setPhase('result');

    if (isGoal) setGoals(g => g + 1);

    setTimeout(() => {
      const nextAttempt = attempt + 1;
      if (nextAttempt >= ATTEMPTS) {
        onFinish(goals + (isGoal ? 1 : 0));
      } else {
        setAttempt(nextAttempt);
        setPhase('waiting');
      }
    }, 1500);
  }, [phase, stopCharging, attempt, goals, onFinish]);

  useEffect(() => {
    return () => { if (chargeRef.current) clearInterval(chargeRef.current); };
  }, []);

  const gkEmoji = { left: '🧤⬅', center: '🧤', right: '➡🧤' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700 }}>
          Tiro {attempt + 1} di {ATTEMPTS}
        </div>
        <div style={{ color: '#4ade80', fontWeight: 900, fontSize: 18 }}>
          ⚽ {goals} gol
        </div>
      </div>

      {/* Game area */}
      <div style={{
        flex: 1, position: 'relative', background: '#2d8a2d',
        border: '3px solid white', borderRadius: 8, overflow: 'hidden',
        minHeight: 160,
      }}>
        {/* Goal outline */}
        <div style={{
          position: 'absolute', top: '10%', left: '15%', right: '15%', height: '55%',
          border: '3px solid white', borderBottom: 'none',
          pointerEvents: 'none', zIndex: 2,
        }} />

        {/* Goalkeeper */}
        <div style={{
          position: 'absolute', top: '25%',
          left: gkPos === 'left' ? '20%' : gkPos === 'center' ? '45%' : '65%',
          fontSize: 28, transition: 'left 0.3s ease', transform: 'translateX(-50%)', zIndex: 3,
        }}>
          🧤
        </div>

        {/* Ball trajectory */}
        {(phase === 'incoming' || phase === 'choose' || phase === 'result') && (
          <div style={{
            position: 'absolute',
            left: `${ballX}%`, top: `${ballY}%`,
            fontSize: 24, transform: 'translate(-50%, -50%)', transition: 'none', zIndex: 4,
          }}>⚽</div>
        )}

        {/* Result overlay */}
        {shotResult && (
          <div style={{
            position: 'absolute', inset: 0, background: shotResult === 'goal' ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 900, color: 'white', zIndex: 10,
          }}>
            {shotResult === 'goal' ? '⚽ GOL!' : '🧤 Parato!'}
          </div>
        )}
      </div>

      {/* Power bar */}
      {phase === 'choose' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 6, height: 16, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${power}%`,
              background: power > 70 ? '#4ade80' : power > 30 ? '#fbbf24' : '#ef4444',
              transition: 'width 0.02s', borderRadius: 6,
            }} />
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'center' }}>
            Forza del tiro: {power}%
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {phase === 'waiting' && (
          <button
            onClick={startAttempt}
            style={{
              background: 'linear-gradient(135deg,#2563eb,#7c3aed)', border: 'none',
              borderRadius: 12, color: 'white', fontWeight: 900, fontSize: 16,
              padding: '12px', cursor: 'pointer',
            }}
          >
            ⚽ Ricevi il cross!
          </button>
        )}

        {phase === 'choose' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {(['left', 'center', 'right'] as const).map(dir => (
              <button
                key={dir}
                onClick={() => shoot(dir)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.25)',
                  borderRadius: 10, color: 'white', fontWeight: 900, fontSize: 14,
                  padding: '10px', cursor: 'pointer',
                }}
              >
                {dir === 'left' ? '← Sinistra' : dir === 'center' ? '↑ Centro' : 'Destra →'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Panel selector ─────────────────────────────────────────── */
function MinigamePanel({ onSelect, onClose }: { onSelect: (g: MinigameType) => void; onClose: () => void }) {
  const games: { id: MinigameType; icon: string; name: string; desc: string; maxCredits: string }[] = [
    { id: 'rigori', icon: '⚽', name: 'Rigori', desc: 'Best of 5 — tira e segna!', maxCredits: 'Fino a 50 Rankiard' },
    { id: 'bersaglio', icon: '🎯', name: 'Tiro al Bersaglio', desc: '30 secondi — colpisci i bersagli!', maxCredits: 'Fino a 60 Rankiard' },
    { id: 'palleggi', icon: '🦵', name: 'Palleggi', desc: 'Tieni il pallone in aria!', maxCredits: 'Fino a 50 Rankiard' },
    { id: 'tiro_al_volo', icon: '🏃', name: 'Tiro al Volo', desc: '5 cross — timing e precisione!', maxCredits: 'Fino a 50 Rankiard' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, flex: 1 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 40, marginBottom: 4 }}>🏟️</div>
        <div style={{ color: 'white', fontWeight: 900, fontSize: 18 }}>Campo da Calcio</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
          Scegli un mini-gioco per guadagnare Rankiard!
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {games.map(game => (
          <button
            key={game.id}
            onClick={() => onSelect(game.id)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1.5px solid rgba(255,255,255,0.15)',
              borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            <div style={{ fontSize: 32, flexShrink: 0 }}>{game.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: 800, fontSize: 15 }}>{game.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>{game.desc}</div>
            </div>
            <div style={{
              color: '#fbbf24', fontWeight: 700, fontSize: 11,
              background: 'rgba(251,191,36,0.1)', borderRadius: 8, padding: '4px 8px',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              {game.maxCredits}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export function FootballMinigames({ authToken, onClose, onCreditsEarned }: FootballMinigamesProps) {
  const [activeGame, setActiveGame] = useState<MinigameType>(null);
  const [showResult, setShowResult] = useState(false);
  const [earnedCredits, setEarnedCredits] = useState(0);
  const [resultDetail, setResultDetail] = useState('');
  const [resultEmoji, setResultEmoji] = useState('');
  const [resultTitle, setResultTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const calcRigoriCredits = (goals: number, total: number) => {
    if (goals === 0) return 0;
    if (goals === 1) return 5;
    if (goals === 2) return 12;
    if (goals === 3) return 22;
    if (goals === 4) return 35;
    return 50;
  };

  const calcBersaglioCredits = (score: number) => {
    if (score <= 0) return 0;
    return Math.min(60, Math.floor(score * 0.6));
  };

  const calcPalleggiCredits = (count: number) => {
    if (count === 0) return 0;
    if (count < 5) return 3;
    if (count < 10) return 8;
    if (count < 20) return 18;
    if (count < 35) return 30;
    return 50;
  };

  const calcTiroAlVoloCredits = (goals: number) => {
    if (goals === 0) return 0;
    if (goals === 1) return 8;
    if (goals === 2) return 18;
    if (goals === 3) return 30;
    if (goals === 4) return 42;
    return 50;
  };

  const finishGame = useCallback(async (credits: number, emoji: string, title: string, detail: string) => {
    setEarnedCredits(credits);
    setResultEmoji(emoji);
    setResultTitle(title);
    setResultDetail(detail);
    setShowResult(true);

    if (credits > 0 && authToken) {
      setSaving(true);
      try {
        await awardMinigameCredits(authToken, credits, activeGame ?? 'unknown');
        onCreditsEarned(credits);
      } finally {
        setSaving(false);
      }
    }
  }, [authToken, onCreditsEarned, activeGame]);

  const handleRigoriFinish = useCallback((goals: number, total: number) => {
    const credits = calcRigoriCredits(goals, total);
    finishGame(
      credits,
      goals >= 3 ? '⚽' : '🧤',
      goals === total ? 'Fantastico! Rigori perfetti!' : `${goals}/${total} gol segnati!`,
      `Hai segnato ${goals} rigori su ${total}`,
    );
  }, [finishGame]);

  const handleBersaglioFinish = useCallback((score: number) => {
    const credits = calcBersaglioCredits(score);
    finishGame(
      credits,
      score > 30 ? '🎯' : '😅',
      score > 0 ? `Punteggio: ${score}!` : 'Nessun punto!',
      `Hai totalizzato ${score} punti al tiro al bersaglio`,
    );
  }, [finishGame]);

  const handlePalleggiFinish = useCallback((count: number) => {
    const credits = calcPalleggiCredits(count);
    finishGame(
      credits,
      count >= 20 ? '🦵' : count >= 5 ? '⚽' : '😓',
      count > 0 ? `${count} palleggi!` : 'Pallone perso subito!',
      `Hai effettuato ${count} palleggi consecutivi`,
    );
  }, [finishGame]);

  const handleTiroAlVoloFinish = useCallback((goals: number) => {
    const credits = calcTiroAlVoloCredits(goals);
    finishGame(
      credits,
      goals >= 3 ? '🏃' : '🧤',
      `${goals}/5 gol al volo!`,
      `Hai segnato ${goals} gol al volo su 5 tentativi`,
    );
  }, [finishGame]);

  const gameTitle: Record<string, string> = {
    rigori: 'Rigori',
    bersaglio: 'Tiro al Bersaglio',
    palleggi: 'Palleggi',
    tiro_al_volo: 'Tiro al Volo',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '12px',
    }}>
      <div style={{
        background: 'rgba(5,5,25,0.98)',
        border: '2px solid rgba(74,222,128,0.3)',
        borderRadius: 20,
        width: '100%', maxWidth: 420,
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 0 60px rgba(0,0,0,0.8)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeGame && !showResult && (
              <button
                onClick={() => { setActiveGame(null); setShowResult(false); }}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 12,
                  padding: '4px 10px', cursor: 'pointer',
                }}
              >
                ← Indietro
              </button>
            )}
            <div style={{ color: 'white', fontWeight: 800, fontSize: 15 }}>
              {activeGame && !showResult ? gameTitle[activeGame] ?? 'Gioco' : '⚽ Campo da Calcio'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {!activeGame && !showResult && (
            <MinigamePanel onSelect={setActiveGame} onClose={onClose} />
          )}

          {activeGame === 'rigori' && !showResult && (
            <Rigori onFinish={handleRigoriFinish} />
          )}

          {activeGame === 'bersaglio' && !showResult && (
            <TiroAlBersaglio onFinish={handleBersaglioFinish} />
          )}

          {activeGame === 'palleggi' && !showResult && (
            <Palleggi onFinish={handlePalleggiFinish} />
          )}

          {activeGame === 'tiro_al_volo' && !showResult && (
            <TiroAlVolo onFinish={handleTiroAlVoloFinish} />
          )}

          {showResult && (
            <ResultScreen
              title={resultTitle}
              emoji={resultEmoji}
              credits={earnedCredits}
              detail={resultDetail}
              onClose={() => {
                setShowResult(false);
                setActiveGame(null);
              }}
              loading={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}
