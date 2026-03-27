import { useEffect, useState, useRef } from 'react';

export interface CinematicEventData {
  type: 'big_attack' | 'mega_attack' | 'special_bonus' | 'lethal';
  attackerName: string;
  attackerCharName?: string;
  cardName?: string;
  animationType?: string;
  damage?: number;
  label?: string;
  defenderName?: string;
  defenderCharName?: string;
  timestamp?: number;
}

interface CinematicOverlayProps {
  data: CinematicEventData | null;
  onComplete: () => void;
}

const DURATIONS: Record<CinematicEventData['type'], number> = {
  big_attack: 1800,
  mega_attack: 2800,
  special_bonus: 2200,
  lethal: 2400,
};

type ThemeShape = {
  bg: string;
  accent: string;
  accentLight: string;
  label: string;
  emoji: string;
  scanColor: string;
};

const BASE_THEMES: Record<CinematicEventData['type'], ThemeShape> = {
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

const ANIMATION_TYPE_OVERRIDES: Record<string, Partial<ThemeShape>> = {
  death: {
    bg: 'linear-gradient(135deg, #000000 0%, #0d0000 40%, #000000 100%)',
    accent: '#B71C1C',
    accentLight: '#FF5252',
    label: 'MORTE ISTANTANEA',
    emoji: '☠️',
    scanColor: 'rgba(183, 28, 28, 0.15)',
  },
  death_on_dice_fail: {
    bg: 'linear-gradient(135deg, #120900 0%, #2a1a00 40%, #120900 100%)',
    accent: '#FFD600',
    accentLight: '#FFFF8D',
    label: 'ROULETTE RUSSA',
    emoji: '🎲',
    scanColor: 'rgba(255, 214, 0, 0.10)',
  },
  gamble_death: {
    bg: 'linear-gradient(135deg, #120900 0%, #2a1a00 40%, #120900 100%)',
    accent: '#FFD600',
    accentLight: '#FFFF8D',
    label: 'ROULETTE RUSSA',
    emoji: '🎲',
    scanColor: 'rgba(255, 214, 0, 0.10)',
  },
  dice_split: {
    bg: 'linear-gradient(135deg, #09120a 0%, #1a2c1b 40%, #09120a 100%)',
    accent: '#00C853',
    accentLight: '#69F0AE',
    label: 'SPLIT DADO',
    emoji: '🎯',
    scanColor: 'rgba(0, 200, 83, 0.08)',
  },
  halve_pti: {
    bg: 'linear-gradient(135deg, #001200 0%, #003300 40%, #001200 100%)',
    accent: '#76FF03',
    accentLight: '#CCFF90',
    label: 'PTI DIMEZZATI',
    emoji: '☣️',
    scanColor: 'rgba(118, 255, 3, 0.08)',
  },
  zero_stars: {
    bg: 'linear-gradient(135deg, #000d1a 0%, #001f3d 40%, #000d1a 100%)',
    accent: '#448AFF',
    accentLight: '#82B1FF',
    label: 'STELLE AZZERATE',
    emoji: '⭐',
    scanColor: 'rgba(68, 138, 255, 0.08)',
  },
  set_5_pti: {
    bg: 'linear-gradient(135deg, #001a15 0%, #003828 40%, #001a15 100%)',
    accent: '#1DE9B6',
    accentLight: '#A7FFEB',
    label: '5 PTI RIMASTI',
    emoji: '5️⃣',
    scanColor: 'rgba(29, 233, 182, 0.08)',
  },
  drain_on_attack: {
    bg: 'linear-gradient(135deg, #0a1200 0%, #1c2e00 40%, #0a1200 100%)',
    accent: '#8BC34A',
    accentLight: '#DCEDC8',
    label: 'ASSORBIMENTO',
    emoji: '🌀',
    scanColor: 'rgba(139, 195, 74, 0.08)',
  },
  field_harvest_30: {
    bg: 'linear-gradient(135deg, #1a0a00 0%, #3d1a00 40%, #1a0a00 100%)',
    accent: '#FF6D00',
    accentLight: '#FFAB40',
    label: 'DANNO DI CAMPO',
    emoji: '🌋',
    scanColor: 'rgba(255, 109, 0, 0.10)',
  },
};

function resolveTheme(type: CinematicEventData['type'], animationType?: string): ThemeShape {
  const base = BASE_THEMES[type];
  if (!animationType) return base;
  const override = ANIMATION_TYPE_OVERRIDES[animationType];
  if (!override) return base;
  return { ...base, ...override };
}

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
  const [impactFired, setImpactFired] = useState(false);
  const timerIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const activeTimestamp = useRef<number | null>(null);

  const theme = data ? resolveTheme(data.type, data.animationType) : BASE_THEMES.big_attack;
  const duration = data ? DURATIONS[data.type] : 1800;
  const displayDamage = data?.damage ?? 0;
  const counter = useCountUp(displayDamage, duration, phase === 'hold' || phase === 'exit');

  const isAttackType = data?.type === 'big_attack' || data?.type === 'mega_attack' || data?.type === 'lethal';

  function clearAll() {
    timerIds.current.forEach(id => clearTimeout(id));
    timerIds.current = [];
  }

  function addTimer(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms);
    timerIds.current.push(id);
    return id;
  }

  useEffect(() => {
    if (!data) return;
    const ts = data.timestamp ?? Date.now();
    if (ts === activeTimestamp.current) return;
    activeTimestamp.current = ts;

    clearAll();
    setImpactFired(false);
    setPhase('enter');

    addTimer(() => {
      setPhase('hold');
      addTimer(() => {
        setImpactFired(true);
      }, 300);
      addTimer(() => {
        setPhase('exit');
        addTimer(() => {
          setPhase('done');
          onComplete();
        }, 380);
      }, duration - 580);
    }, 200);

    return clearAll;
  }, [data, duration, onComplete]);

  if (!data || phase === 'done') return null;

  const isEntering = phase === 'enter';
  const isExiting = phase === 'exit';

  const attackerCharName = data.attackerCharName || data.attackerName;
  const defenderCharName = data.defenderCharName || data.defenderName;
  const labelText = data.label || theme.label;
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
        @keyframes cin-attacker-in {
          0% { transform: translateX(-80px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes cin-defender-in {
          0% { transform: translateX(80px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes cin-defender-hit {
          0%   { transform: translateX(0)    rotate(0deg);   filter: brightness(1); }
          15%  { transform: translateX(-14px) rotate(-4deg); filter: brightness(3) saturate(0); }
          30%  { transform: translateX(14px)  rotate(3deg);  filter: brightness(2); }
          45%  { transform: translateX(-10px) rotate(-2deg); filter: brightness(1.5); }
          60%  { transform: translateX(8px)   rotate(1deg);  filter: brightness(1.2); }
          75%  { transform: translateX(-5px)  rotate(0deg);  filter: brightness(1); }
          100% { transform: translateX(0)    rotate(0deg);   filter: brightness(1); }
        }
        @keyframes cin-impact-burst {
          0%   { transform: translate(-50%, -50%) scale(0.2); opacity: 1; }
          60%  { transform: translate(-50%, -50%) scale(1.4); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(2);   opacity: 0; }
        }
        @keyframes cin-impact-text {
          0%   { transform: translate(-50%, -50%) scale(0.3) rotate(-15deg); opacity: 0; }
          40%  { transform: translate(-50%, -50%) scale(1.3) rotate(8deg);  opacity: 1; }
          70%  { transform: translate(-50%, -50%) scale(1)   rotate(-3deg); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.8) rotate(0deg);  opacity: 0; }
        }
        @keyframes cin-mossa-fly {
          0%   { transform: translateX(0) scaleX(1); opacity: 1; }
          80%  { transform: translateX(110%) scaleX(1.3); opacity: 0.7; }
          100% { transform: translateX(140%) scaleX(1.5); opacity: 0; }
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
      `}</style>

      {/* Entry flash */}
      {isEntering && (
        <div
          className="absolute inset-0"
          style={{ background: 'white', animation: 'cin-flash 0.25s ease-out forwards' }}
        />
      )}

      {/* Letterbox top */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: 90,
          background: '#000',
          animation: isExiting ? 'cin-bar-top-out 0.35s ease-in forwards' : 'cin-bar-top 0.2s ease-out forwards',
        }}
      />

      {/* Letterbox bottom */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: 90,
          background: '#000',
          animation: isExiting ? 'cin-bar-bottom-out 0.35s ease-in forwards' : 'cin-bar-bottom 0.2s ease-out forwards',
        }}
      />

      {/* Full-screen background */}
      <div className="absolute" style={{ top: 90, left: 0, right: 0, bottom: 90, background: theme.bg }}>
        {/* Scan lines */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(to bottom, ${theme.scanColor} 0px, ${theme.scanColor} 1px, transparent 1px, transparent 4px)`,
            animation: 'cin-scan 3s linear infinite',
          }}
        />

        {/* Center glow rings */}
        {(data.type === 'mega_attack' || data.type === 'lethal') && (
          <>
            <div className="absolute rounded-full" style={{ width: 300, height: 300, border: `2px solid ${theme.accent}`, top: '50%', left: '50%', animation: 'cin-ring 0.8s ease-out forwards', animationDelay: '0.1s', opacity: 0 }} />
            <div className="absolute rounded-full" style={{ width: 300, height: 300, border: `2px solid ${theme.accentLight}`, top: '50%', left: '50%', animation: 'cin-ring 0.8s ease-out forwards', animationDelay: '0.3s', opacity: 0 }} />
          </>
        )}

        {/* Background glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: '80vw', height: '80vw', maxWidth: 600, maxHeight: 600,
            background: `radial-gradient(ellipse at center, ${theme.accent}22 0%, transparent 70%)`,
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            animation: 'cin-glow-pulse 0.6s ease-in-out infinite',
          }}
        />

        {/* ── ATTACK LAYOUT: Attacker vs Defender ── */}
        {isAttackType && (attackerCharName || defenderCharName) ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{
              animation: isExiting
                ? 'cin-content-out 0.35s ease-in forwards'
                : 'cin-content-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            }}
          >
            {/* Label row */}
            <div style={{
              color: theme.accentLight,
              fontFamily: 'monospace, sans-serif',
              fontSize: 'clamp(10px, 1.6vw, 14px)',
              fontWeight: 700,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom: 10,
              opacity: 0,
              animation: 'cin-label-slide 0.3s ease-out forwards',
              animationDelay: '0.1s',
            }}>
              {theme.emoji} {labelText}
            </div>

            {/* VS row */}
            <div className="flex items-center justify-center w-full" style={{ gap: 'clamp(8px, 3vw, 40px)', maxWidth: 700 }}>

              {/* ATTACKER side */}
              <div
                className="flex flex-col items-center"
                style={{
                  flex: 1, maxWidth: 240,
                  opacity: 0,
                  animation: 'cin-attacker-in 0.35s ease-out forwards',
                  animationDelay: '0.12s',
                }}
              >
                <div style={{
                  color: theme.accentLight,
                  fontFamily: 'monospace',
                  fontSize: 'clamp(9px, 1.3vw, 11px)',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                  opacity: 0.7,
                }}>ATTACCANTE</div>
                <div style={{
                  color: '#fff',
                  fontFamily: 'sans-serif',
                  fontSize: 'clamp(14px, 2.8vw, 24px)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  textShadow: `0 0 20px ${theme.accent}`,
                  letterSpacing: '0.1em',
                  textAlign: 'center',
                  lineHeight: 1.15,
                }}>
                  {attackerCharName}
                </div>
                {/* Mossa card - flies toward defender */}
                {cardDisplayName && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '4px 10px',
                      background: `${theme.accent}33`,
                      border: `1px solid ${theme.accent}`,
                      borderRadius: 4,
                      color: theme.accentLight,
                      fontFamily: 'monospace',
                      fontSize: 'clamp(8px, 1.2vw, 11px)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      textAlign: 'center',
                      maxWidth: '100%',
                      opacity: impactFired ? 0 : 1,
                      animation: impactFired ? 'cin-mossa-fly 0.35s ease-in forwards' : 'none',
                    }}
                  >
                    {cardDisplayName}
                  </div>
                )}
              </div>

              {/* CENTER: impact zone */}
              <div className="relative flex flex-col items-center" style={{ flexShrink: 0, width: 'clamp(60px, 10vw, 90px)' }}>
                <div style={{
                  color: theme.accentLight,
                  fontFamily: 'monospace',
                  fontSize: 'clamp(10px, 1.8vw, 13px)',
                  fontWeight: 700,
                  letterSpacing: '0.35em',
                  opacity: 0.5,
                }}>VS</div>
                {/* Impact burst */}
                {impactFired && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%', left: '50%',
                      width: 80, height: 80,
                      background: `radial-gradient(ellipse at center, ${theme.accentLight} 0%, ${theme.accent} 40%, transparent 70%)`,
                      borderRadius: '50%',
                      animation: 'cin-impact-burst 0.5s ease-out forwards',
                    }}
                  />
                )}
                {impactFired && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%', left: '50%',
                      fontSize: 'clamp(24px, 5vw, 40px)',
                      animation: 'cin-impact-text 0.55s ease-out forwards',
                      pointerEvents: 'none',
                      userSelect: 'none',
                      zIndex: 2,
                    }}
                  >
                    {data.type === 'lethal' ? '☠️' : data.type === 'mega_attack' ? '💥' : '⚔️'}
                  </div>
                )}
              </div>

              {/* DEFENDER side */}
              <div
                className="flex flex-col items-center"
                style={{
                  flex: 1, maxWidth: 240,
                  opacity: 0,
                  animation: 'cin-defender-in 0.35s ease-out forwards',
                  animationDelay: '0.12s',
                }}
              >
                <div style={{
                  color: '#EF9A9A',
                  fontFamily: 'monospace',
                  fontSize: 'clamp(9px, 1.3vw, 11px)',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                  opacity: 0.7,
                }}>DIFENSORE</div>
                <div
                  style={{
                    color: impactFired ? '#FF8A80' : '#ffdddd',
                    fontFamily: 'sans-serif',
                    fontSize: 'clamp(14px, 2.8vw, 24px)',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    textShadow: impactFired ? '0 0 20px #FF1744, 0 0 40px #FF1744' : 'none',
                    letterSpacing: '0.1em',
                    textAlign: 'center',
                    lineHeight: 1.15,
                    animation: impactFired ? 'cin-defender-hit 0.6s ease-out forwards' : 'none',
                    transition: 'text-shadow 0.1s',
                  }}
                >
                  {defenderCharName || '???'}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{
              width: 'clamp(80px, 30vw, 280px)',
              height: 2,
              background: `linear-gradient(to right, transparent, ${theme.accent}, transparent)`,
              margin: '12px 0',
            }} />

            {/* Damage counter */}
            {displayDamage > 0 && (
              <div style={{
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
              }}>
                -{counter}
              </div>
            )}
            {displayDamage > 0 && (
              <div style={{
                color: theme.accentLight,
                fontFamily: 'monospace, sans-serif',
                fontSize: 'clamp(12px, 2vw, 16px)',
                fontWeight: 700,
                letterSpacing: '0.3em',
                opacity: 0,
                animation: 'cin-label-slide 0.3s ease-out forwards',
                animationDelay: '0.25s',
              }}>
                PTI
              </div>
            )}
          </div>
        ) : (
          /* ── SPECIAL BONUS / non-attack layout (original) ── */
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{
              animation: isExiting
                ? 'cin-content-out 0.35s ease-in forwards'
                : 'cin-content-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            }}
          >
            <div style={{ fontSize: 42, lineHeight: 1, marginBottom: 8 }}>{theme.emoji}</div>
            <div style={{
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
            }}>
              {labelText}
            </div>
            <div style={{
              width: 'clamp(80px, 20vw, 200px)',
              height: 2,
              background: `linear-gradient(to right, transparent, ${theme.accent}, transparent)`,
              marginBottom: 10,
            }} />
            {attackerCharName && (
              <div style={{
                color: '#fff',
                fontFamily: 'sans-serif',
                fontSize: 'clamp(18px, 3.5vw, 30px)',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                textShadow: `0 0 20px ${theme.accent}, 0 0 40px ${theme.accent}80`,
                marginBottom: 10,
                opacity: 0,
                animation: 'cin-attacker-in 0.3s ease-out forwards',
                animationDelay: '0.15s',
                maxWidth: '80vw',
                textAlign: 'center',
                lineHeight: 1.1,
              }}>
                {attackerCharName}
              </div>
            )}
            {cardDisplayName && (
              <div style={{
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
              }}>
                {cardDisplayName}
              </div>
            )}
            {displayDamage > 0 && (
              <div style={{
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
              }}>
                -{counter}
              </div>
            )}
            {displayDamage > 0 && (
              <div style={{
                color: theme.accentLight,
                fontFamily: 'monospace, sans-serif',
                fontSize: 'clamp(12px, 2vw, 16px)',
                fontWeight: 700,
                letterSpacing: '0.3em',
                opacity: 0,
                animation: 'cin-label-slide 0.3s ease-out forwards',
                animationDelay: '0.25s',
              }}>
                PTI
              </div>
            )}
            {displayDamage === 0 && data.label && (
              <div style={{
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
              }}>
                {data.label}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accent border lines on letterbox */}
      <div className="absolute" style={{
        top: 88, left: 0, right: 0, height: 3,
        background: `linear-gradient(to right, transparent 0%, ${theme.accent} 20%, ${theme.accentLight} 50%, ${theme.accent} 80%, transparent 100%)`,
        opacity: isExiting ? 0 : 1, transition: 'opacity 0.2s',
      }} />
      <div className="absolute" style={{
        bottom: 88, left: 0, right: 0, height: 3,
        background: `linear-gradient(to right, transparent 0%, ${theme.accent} 20%, ${theme.accentLight} 50%, ${theme.accent} 80%, transparent 100%)`,
        opacity: isExiting ? 0 : 1, transition: 'opacity 0.2s',
      }} />
    </div>
  );
}
