import { useEffect, useState, useRef } from 'react';

export interface CinematicEventData {
  type: 'big_attack' | 'mega_attack' | 'special_bonus' | 'lethal';
  attackerName: string;
  attackerCharName?: string;
  cardName?: string;
  animationType?: string;
  damage?: number;
  label?: string;
}

interface CinematicOverlayProps {
  data: CinematicEventData | null;
  onComplete: () => void;
}

const DURATIONS: Record<CinematicEventData['type'], number> = {
  big_attack: 1800,
  mega_attack: 2600,
  special_bonus: 2200,
  lethal: 2400,
};

const THEMES: Record<CinematicEventData['type'], {
  bg: string;
  accent: string;
  accentLight: string;
  label: string;
  emoji: string;
  scanColor: string;
}> = {
  big_attack: {
    bg: 'linear-gradient(135deg, #1a0a00 0%, #3d1500 40%, #1a0a00 100%)',
    accent: '#FF6B00',
    accentLight: '#FFB347',
    label: 'ATTACCO POTENTE',
    emoji: '⚔️',
    scanColor: 'rgba(255, 107, 0, 0.08)',
  },
  mega_attack: {
    bg: 'linear-gradient(135deg, #1a0005 0%, #4d0010 40%, #1a0005 100%)',
    accent: '#FF1744',
    accentLight: '#FF6B7A',
    label: 'COLPO DEVASTANTE',
    emoji: '💥',
    scanColor: 'rgba(255, 23, 68, 0.10)',
  },
  special_bonus: {
    bg: 'linear-gradient(135deg, #0d0020 0%, #2a0060 40%, #0d0020 100%)',
    accent: '#9C27B0',
    accentLight: '#CE93D8',
    label: 'BONUS SPECIALE',
    emoji: '✨',
    scanColor: 'rgba(156, 39, 176, 0.10)',
  },
  lethal: {
    bg: 'linear-gradient(135deg, #000000 0%, #1a0000 40%, #000000 100%)',
    accent: '#D32F2F',
    accentLight: '#EF9A9A',
    label: 'LETALE',
    emoji: '💀',
    scanColor: 'rgba(211, 47, 47, 0.10)',
  },
};

function useCountUp(target: number, duration: number, active: boolean): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active || target === 0) { setCount(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / (duration * 0.55), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      else setCount(target);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, active]);

  return count;
}

export function CinematicOverlay({ data, onComplete }: CinematicOverlayProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit' | 'done'>('done');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevDataRef = useRef<CinematicEventData | null>(null);

  const theme = data ? THEMES[data.type] : THEMES.big_attack;
  const duration = data ? DURATIONS[data.type] : 1800;
  const displayDamage = data?.damage ?? 0;
  const counter = useCountUp(displayDamage, duration, phase === 'hold' || phase === 'exit');

  useEffect(() => {
    if (!data || data === prevDataRef.current) return;
    prevDataRef.current = data;

    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase('enter');

    timerRef.current = setTimeout(() => {
      setPhase('hold');
      timerRef.current = setTimeout(() => {
        setPhase('exit');
        timerRef.current = setTimeout(() => {
          setPhase('done');
          onComplete();
        }, 400);
      }, duration - 600);
    }, 200);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [data, duration, onComplete]);

  if (!data || phase === 'done') return null;

  const isEntering = phase === 'enter';
  const isExiting = phase === 'exit';

  const charName = data.attackerCharName || data.attackerName;
  const labelText = data.label || (data.animationType ? `${theme.label} · ${data.animationType.toUpperCase()}` : theme.label);
  const cardDisplayName = data.cardName;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 10000 }}
    >
      <style>{`
        @keyframes cin-flash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes cin-bar-top {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(0); }
        }
        @keyframes cin-bar-top-out {
          0% { transform: translateY(0); }
          100% { transform: translateY(-100%); }
        }
        @keyframes cin-bar-bottom {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
        @keyframes cin-bar-bottom-out {
          0% { transform: translateY(0); }
          100% { transform: translateY(100%); }
        }
        @keyframes cin-content-in {
          0% { opacity: 0; transform: scale(0.85); }
          60% { opacity: 1; transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes cin-content-out {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.9); }
        }
        @keyframes cin-damage-pop {
          0% { transform: scale(0.6); opacity: 0; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes cin-label-slide {
          0% { transform: translateX(-40px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes cin-char-slide {
          0% { transform: translateX(40px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes cin-glow-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.85; }
        }
        @keyframes cin-scan {
          0% { background-position: 0 0; }
          100% { background-position: 0 100px; }
        }
        @keyframes cin-ring {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
        }
        @keyframes cin-border-glow {
          0%, 100% { box-shadow: 0 0 0 2px var(--cin-accent), 0 0 20px var(--cin-accent); }
          50% { box-shadow: 0 0 0 3px var(--cin-accent), 0 0 40px var(--cin-accent), 0 0 60px var(--cin-accent); }
        }
      `}</style>

      {/* Entry flash */}
      {isEntering && (
        <div
          className="absolute inset-0"
          style={{
            background: 'white',
            animation: 'cin-flash 0.25s ease-out forwards',
          }}
        />
      )}

      {/* Letterbox top */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: 90,
          background: '#000',
          animation: isExiting
            ? 'cin-bar-top-out 0.35s ease-in forwards'
            : 'cin-bar-top 0.2s ease-out forwards',
        }}
      />

      {/* Letterbox bottom */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: 90,
          background: '#000',
          animation: isExiting
            ? 'cin-bar-bottom-out 0.35s ease-in forwards'
            : 'cin-bar-bottom 0.2s ease-out forwards',
        }}
      />

      {/* Full-screen background (between letterbox bars) */}
      <div
        className="absolute"
        style={{
          top: 90, left: 0, right: 0, bottom: 90,
          background: theme.bg,
        }}
      >
        {/* Scan lines */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(
              to bottom,
              ${theme.scanColor} 0px,
              ${theme.scanColor} 1px,
              transparent 1px,
              transparent 4px
            )`,
            animation: 'cin-scan 3s linear infinite',
          }}
        />

        {/* Center glow ring (for mega_attack and lethal only) */}
        {(data.type === 'mega_attack' || data.type === 'lethal') && (
          <>
            <div
              className="absolute rounded-full"
              style={{
                width: 300,
                height: 300,
                border: `2px solid ${theme.accent}`,
                top: '50%',
                left: '50%',
                animation: 'cin-ring 0.8s ease-out forwards',
                animationDelay: '0.1s',
                opacity: 0,
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: 300,
                height: 300,
                border: `2px solid ${theme.accentLight}`,
                top: '50%',
                left: '50%',
                animation: 'cin-ring 0.8s ease-out forwards',
                animationDelay: '0.3s',
                opacity: 0,
              }}
            />
          </>
        )}

        {/* Background glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: '80vw',
            height: '80vw',
            maxWidth: 600,
            maxHeight: 600,
            background: `radial-gradient(ellipse at center, ${theme.accent}22 0%, transparent 70%)`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            animation: 'cin-glow-pulse 0.6s ease-in-out infinite',
          }}
        />

        {/* Content container */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            animation: isExiting
              ? 'cin-content-out 0.35s ease-in forwards'
              : 'cin-content-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}
        >
          {/* Emoji */}
          <div style={{ fontSize: 42, lineHeight: 1, marginBottom: 8 }}>
            {theme.emoji}
          </div>

          {/* Label */}
          <div
            style={{
              color: theme.accentLight,
              fontFamily: 'monospace, sans-serif',
              fontSize: 'clamp(11px, 1.8vw, 15px)',
              fontWeight: 700,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom: 6,
              opacity: 0,
              animation: 'cin-label-slide 0.3s ease-out forwards',
              animationDelay: '0.1s',
            }}
          >
            {labelText}
          </div>

          {/* Accent divider */}
          <div
            style={{
              width: 'clamp(80px, 20vw, 200px)',
              height: 2,
              background: `linear-gradient(to right, transparent, ${theme.accent}, transparent)`,
              marginBottom: 10,
            }}
          />

          {/* Attacker char name */}
          {charName && (
            <div
              style={{
                color: '#fff',
                fontFamily: 'sans-serif',
                fontSize: 'clamp(18px, 3.5vw, 30px)',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                textShadow: `0 0 20px ${theme.accent}, 0 0 40px ${theme.accent}80`,
                marginBottom: 10,
                opacity: 0,
                animation: 'cin-char-slide 0.3s ease-out forwards',
                animationDelay: '0.15s',
                maxWidth: '80vw',
                textAlign: 'center',
                lineHeight: 1.1,
              }}
            >
              {charName}
            </div>
          )}

          {/* Card name (mossa used) */}
          {cardDisplayName && (
            <div
              style={{
                color: theme.accentLight,
                fontFamily: 'monospace, sans-serif',
                fontSize: 'clamp(10px, 1.6vw, 13px)',
                fontWeight: 600,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                opacity: 0,
                animation: 'cin-label-slide 0.3s ease-out forwards',
                animationDelay: '0.18s',
                maxWidth: '70vw',
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              {cardDisplayName}
            </div>
          )}

          {/* Damage counter */}
          {displayDamage > 0 && (
            <div
              style={{
                color: theme.accent,
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: 'clamp(52px, 12vw, 96px)',
                fontWeight: 900,
                lineHeight: 1,
                textShadow: `0 0 10px ${theme.accent}, 0 0 30px ${theme.accent}, 0 0 60px ${theme.accent}80`,
                marginBottom: 4,
                opacity: 0,
                animation: 'cin-damage-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                animationDelay: '0.2s',
                letterSpacing: '-0.02em',
              }}
            >
              -{counter}
            </div>
          )}

          {/* "PTI" label */}
          {displayDamage > 0 && (
            <div
              style={{
                color: theme.accentLight,
                fontFamily: 'monospace, sans-serif',
                fontSize: 'clamp(12px, 2vw, 16px)',
                fontWeight: 700,
                letterSpacing: '0.3em',
                opacity: 0,
                animation: 'cin-label-slide 0.3s ease-out forwards',
                animationDelay: '0.25s',
              }}
            >
              PTI
            </div>
          )}

          {/* Special bonus label (no damage) */}
          {displayDamage === 0 && data.label && (
            <div
              style={{
                color: theme.accentLight,
                fontFamily: 'sans-serif',
                fontSize: 'clamp(14px, 2.5vw, 20px)',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textAlign: 'center',
                opacity: 0,
                animation: 'cin-label-slide 0.3s ease-out forwards',
                animationDelay: '0.25s',
                maxWidth: '70vw',
              }}
            >
              {data.label}
            </div>
          )}
        </div>
      </div>

      {/* Accent border on letterbox bars */}
      <div
        className="absolute"
        style={{
          top: 88,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(to right, transparent 0%, ${theme.accent} 20%, ${theme.accentLight} 50%, ${theme.accent} 80%, transparent 100%)`,
          opacity: isExiting ? 0 : 1,
          transition: 'opacity 0.2s',
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: 88,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(to right, transparent 0%, ${theme.accent} 20%, ${theme.accentLight} 50%, ${theme.accent} 80%, transparent 100%)`,
          opacity: isExiting ? 0 : 1,
          transition: 'opacity 0.2s',
        }}
      />
    </div>
  );
}
