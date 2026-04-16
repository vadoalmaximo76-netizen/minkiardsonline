import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

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
  attackerCardImage?: string;
  defenderCardImage?: string;
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

export function CinematicOverlay({ data, onComplete }: CinematicOverlayProps) {
  const [phase, setPhase] = useState<'active' | 'done'>('done');
  const [impactFired, setImpactFired] = useState(false);
  const [counter, setCounter] = useState(0);

  const activeTimestamp = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const phaseRef = useRef<'active' | 'done'>('done');

  // DOM refs for GSAP
  const flashRef = useRef<HTMLDivElement>(null);
  const barTopRef = useRef<HTMLDivElement>(null);
  const barBottomRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const accentTopRef = useRef<HTMLDivElement>(null);
  const accentBottomRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const counterObjRef = useRef({ val: 0 });
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = data ? resolveTheme(data.type, data.animationType) : BASE_THEMES.big_attack;
  const duration = data ? DURATIONS[data.type] : 1800;

  const isAttackType = data?.type === 'big_attack' || data?.type === 'mega_attack' || data?.type === 'lethal';

  const attackerCharName = data?.attackerCharName || data?.attackerName;
  const defenderCharName = data?.defenderCharName || data?.defenderName;
  const labelText = data?.label || theme.label;
  const cardDisplayName = data?.cardName;
  const displayDamage = data?.damage ?? 0;

  // Shared "force complete" helper — idempotent, safe to call from anywhere.
  // setPhase('done') causes the component to return null, removing bars from DOM automatically.
  const forceComplete = useCallback(() => {
    if (phaseRef.current === 'done') return;
    phaseRef.current = 'done';
    if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
    if (timelineRef.current) { timelineRef.current.kill(); timelineRef.current = null; }
    setPhase('done');
    onCompleteRef.current();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data) return;
    const ts = data.timestamp ?? Date.now();
    if (ts === activeTimestamp.current) return;
    activeTimestamp.current = ts;

    const durationSec = duration / 1000;
    const dmg = data.damage ?? 0;

    // Clear previous safety timer
    if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }

    // Kill any running timeline (guard: if previous was active, complete it first)
    if (timelineRef.current) {
      timelineRef.current.kill();
      timelineRef.current = null;
    }

    setImpactFired(false);
    setCounter(0);
    counterObjRef.current.val = 0;
    phaseRef.current = 'active';
    setPhase('active');

    // Safety net: force-complete if GSAP timeline never fires onComplete
    safetyTimerRef.current = setTimeout(() => {
      forceComplete();
    }, duration + 1200);

    // Small rAF delay to ensure DOM is mounted after setPhase('active')
    const rafId = requestAnimationFrame(() => {
      const flash = flashRef.current;
      const barTop = barTopRef.current;
      const barBottom = barBottomRef.current;
      const content = contentRef.current;
      const accentTop = accentTopRef.current;
      const accentBottom = accentBottomRef.current;

      if (!barTop || !barBottom) {
        // DOM not ready — force complete immediately so we don't stay stuck
        forceComplete();
        return;
      }

      // Reset initial states
      gsap.set(flash, { opacity: 1 });
      gsap.set(barTop, { y: '-100%' });
      gsap.set(barBottom, { y: '100%' });
      gsap.set([accentTop, accentBottom], { opacity: 0 });
      if (content) gsap.set(content, { opacity: 0, scale: 0.85 });

      const tl = gsap.timeline();
      timelineRef.current = tl;

      // ── ENTER: flash + letterbox bars slide in ──
      tl.to(flash, { opacity: 0, duration: 0.25, ease: 'power2.out' }, 0)
        .to(barTop, { y: '0%', duration: 0.2, ease: 'power3.out' }, 0)
        .to(barBottom, { y: '0%', duration: 0.2, ease: 'power3.out' }, 0)
        .to([accentTop, accentBottom], { opacity: 1, duration: 0.15, ease: 'power2.out' }, 0.15);

      // ── CONTENT: scale up with overshoot ──
      if (content) {
        tl.to(content, { opacity: 1, scale: 1.04, duration: 0.15, ease: 'power2.out' }, 0.2)
          .to(content, { scale: 1, duration: 0.15, ease: 'power2.inOut' }, 0.35);
      }

      // ── IMPACT: trigger at 0.5s ──
      tl.add(() => setImpactFired(true), 0.5);

      // ── COUNTER: count up via gsap tween ──
      if (dmg > 0) {
        const obj = counterObjRef.current;
        obj.val = 0;
        tl.to(obj, {
          val: dmg,
          duration: durationSec * 0.55,
          ease: 'power3.out',
          onUpdate: () => setCounter(Math.round(obj.val)),
        }, 0.5);
      }

      // ── EXIT: content fades out, bars retract ──
      const exitAt = durationSec - 0.38;
      if (content) {
        tl.to(content, { opacity: 0, scale: 0.9, duration: 0.35, ease: 'power2.in' }, exitAt);
      }
      tl.to(barTop, { y: '-100%', duration: 0.35, ease: 'power2.in' }, exitAt)
        .to(barBottom, { y: '100%', duration: 0.35, ease: 'power2.in' }, exitAt)
        .to([accentTop, accentBottom], { opacity: 0, duration: 0.25, ease: 'power2.in' }, exitAt);

      // ── DONE ──
      tl.add(() => {
        phaseRef.current = 'done';
        if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
        setPhase('done');
        onCompleteRef.current();
      }, durationSec);
    });

    return () => {
      cancelAnimationFrame(rafId);
      // If cleanup fires while overlay was still active (data changed mid-animation),
      // force complete so GameBoard clears cinematicOverlayData and the game unblocks.
      if (phaseRef.current === 'active') {
        forceComplete();
      } else {
        if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
        if (timelineRef.current) { timelineRef.current.kill(); timelineRef.current = null; }
      }
    };
  }, [data, duration, forceComplete]);

  if (!data || phase === 'done') return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 10000 }}
    >
      <style>{`
        @keyframes cin-card-attacker-in {
          0%   { transform: translateX(-120px) rotate(-15deg) scale(0.7); opacity: 0; }
          70%  { transform: translateX(8px)   rotate(3deg)  scale(1.05); opacity: 1; }
          100% { transform: translateX(0)     rotate(-4deg) scale(1); opacity: 1; }
        }
        @keyframes cin-card-defender-in {
          0%   { transform: translateX(120px) rotate(15deg) scale(0.7); opacity: 0; }
          70%  { transform: translateX(-8px)  rotate(-3deg) scale(1.05); opacity: 1; }
          100% { transform: translateX(0)     rotate(4deg)  scale(1); opacity: 1; }
        }
        @keyframes cin-card-defender-hit {
          0%   { transform: rotate(4deg)    scale(1);    filter: brightness(1); }
          10%  { transform: rotate(-12deg)  scale(1.08); filter: brightness(4) saturate(0); }
          25%  { transform: rotate(10deg)   scale(0.95); filter: brightness(2); }
          40%  { transform: rotate(-8deg)   scale(1.02); filter: brightness(1.5); }
          55%  { transform: rotate(6deg)    scale(0.98); filter: brightness(1.2); }
          70%  { transform: rotate(-3deg)   scale(1);    filter: brightness(1); }
          100% { transform: rotate(4deg)    scale(1);    filter: brightness(1); }
        }
        @keyframes cin-mossa-fly {
          0%   { transform: translateX(0) rotate(-6deg) scale(1); opacity: 1; }
          70%  { transform: translateX(130%) rotate(10deg) scale(1.1); opacity: 0.6; }
          100% { transform: translateX(180%) rotate(15deg) scale(0.9); opacity: 0; }
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
        @keyframes cin-flash {
          0% { opacity: 1; }
          100% { opacity: 0; }
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

      {/* Entry flash — always rendered, GSAP controls opacity */}
      <div
        ref={flashRef}
        className="absolute inset-0"
        style={{ background: 'white', opacity: 0, pointerEvents: 'none' }}
      />

      {/* Letterbox top — GSAP controls translateY */}
      <div
        ref={barTopRef}
        className="absolute top-0 left-0 right-0"
        style={{ height: 90, background: '#000' }}
      />

      {/* Letterbox bottom — GSAP controls translateY */}
      <div
        ref={barBottomRef}
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 90, background: '#000' }}
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

        {/* ── ATTACK LAYOUT: Attacker card vs Defender card ── */}
        {isAttackType && (attackerCharName || defenderCharName) ? (
          <div
            ref={contentRef}
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ padding: '0 8px', opacity: 0 }}
          >
            {/* Label row */}
            <div style={{
              color: theme.accentLight,
              fontFamily: 'monospace, sans-serif',
              fontSize: 'clamp(10px, 1.6vw, 14px)',
              fontWeight: 700,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom: 8,
              opacity: 0,
              animation: 'cin-label-slide 0.3s ease-out forwards',
              animationDelay: '0.1s',
            }}>
              {theme.emoji} {labelText}
            </div>

            {/* CARDS ROW: Mossa card → VS center → Personaggi card */}
            <div className="flex items-center justify-center w-full" style={{ gap: 'clamp(6px, 2vw, 24px)', maxWidth: 680 }}>

              {/* ── ATTACKER: mossa card image ── */}
              <div
                className="flex flex-col items-center"
                style={{
                  flex: '0 0 auto',
                  opacity: 0,
                  animation: 'cin-card-attacker-in 0.45s cubic-bezier(0.34,1.4,0.64,1) forwards',
                  animationDelay: '0.12s',
                }}
              >
                <div style={{
                  width: 'clamp(80px, 14vw, 130px)',
                  aspectRatio: '63/88',
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: `2px solid ${theme.accent}`,
                  boxShadow: `0 0 16px ${theme.accent}99, 0 4px 20px #000a`,
                  position: 'relative',
                  animation: impactFired ? 'cin-mossa-fly 0.4s ease-in forwards' : 'none',
                }}>
                  {data.attackerCardImage ? (
                    <img
                      src={data.attackerCardImage}
                      alt={cardDisplayName || 'Mossa'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      background: `linear-gradient(145deg, ${theme.accent}44, ${theme.bg})`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: 6,
                    }}>
                      <div style={{ fontSize: 'clamp(20px,4vw,32px)', marginBottom: 4 }}>⚔️</div>
                      <div style={{
                        color: theme.accentLight,
                        fontFamily: 'monospace',
                        fontSize: 'clamp(7px,1vw,10px)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        letterSpacing: '0.1em',
                        lineHeight: 1.2,
                        wordBreak: 'break-word',
                      }}>
                        {cardDisplayName || 'MOSSA'}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{
                  color: theme.accentLight,
                  fontFamily: 'monospace',
                  fontSize: 'clamp(8px, 1.1vw, 11px)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  marginTop: 5,
                  textAlign: 'center',
                  maxWidth: 'clamp(80px,14vw,130px)',
                  textShadow: `0 0 10px ${theme.accent}`,
                  opacity: 0.9,
                }}>
                  {attackerCharName}
                </div>
                {cardDisplayName && !data.attackerCardImage && (
                  <div style={{
                    color: theme.accent,
                    fontFamily: 'monospace',
                    fontSize: 'clamp(7px, 0.9vw, 10px)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginTop: 2,
                    textAlign: 'center',
                    maxWidth: 'clamp(80px,14vw,130px)',
                    opacity: 0.7,
                  }}>
                    {cardDisplayName}
                  </div>
                )}
              </div>

              {/* ── CENTER: VS + impact ── */}
              <div
                className="relative flex flex-col items-center justify-center"
                style={{ flexShrink: 0, width: 'clamp(48px, 8vw, 72px)', height: 'clamp(80px,15vw,120px)' }}
              >
                <div style={{
                  color: theme.accentLight,
                  fontFamily: '"Impact","Arial Black",sans-serif',
                  fontSize: 'clamp(14px, 2.5vw, 20px)',
                  fontWeight: 900,
                  letterSpacing: '0.15em',
                  opacity: impactFired ? 0 : 0.6,
                  transition: 'opacity 0.1s',
                }}>VS</div>
                {impactFired && (
                  <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    width: 90, height: 90,
                    background: `radial-gradient(ellipse at center, ${theme.accentLight} 0%, ${theme.accent} 35%, transparent 70%)`,
                    borderRadius: '50%',
                    animation: 'cin-impact-burst 0.55s ease-out forwards',
                  }} />
                )}
                {impactFired && (
                  <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    fontSize: 'clamp(28px, 6vw, 48px)',
                    animation: 'cin-impact-text 0.6s ease-out forwards',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    zIndex: 2,
                  }}>
                    {data.type === 'lethal' ? '☠️' : data.type === 'mega_attack' ? '💥' : '⚔️'}
                  </div>
                )}
              </div>

              {/* ── DEFENDER: personaggi card image ── */}
              <div
                className="flex flex-col items-center"
                style={{
                  flex: '0 0 auto',
                  opacity: 0,
                  animation: 'cin-card-defender-in 0.45s cubic-bezier(0.34,1.4,0.64,1) forwards',
                  animationDelay: '0.12s',
                }}
              >
                <div style={{
                  width: 'clamp(80px, 14vw, 130px)',
                  aspectRatio: '63/88',
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: `2px solid ${impactFired ? '#FF1744' : '#555'}`,
                  boxShadow: impactFired
                    ? `0 0 24px #FF174499, 0 4px 20px #000a`
                    : `0 0 10px #33333399, 0 4px 12px #000a`,
                  position: 'relative',
                  animation: impactFired ? 'cin-card-defender-hit 0.65s ease-out forwards' : 'none',
                  transition: 'border-color 0.1s, box-shadow 0.1s',
                }}>
                  {data.defenderCardImage ? (
                    <img
                      src={data.defenderCardImage}
                      alt={defenderCharName || 'Difensore'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      background: `linear-gradient(145deg, #33000044, #220000)`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: 6,
                    }}>
                      <div style={{ fontSize: 'clamp(20px,4vw,32px)', marginBottom: 4 }}>🛡️</div>
                      <div style={{
                        color: '#EF9A9A',
                        fontFamily: 'monospace',
                        fontSize: 'clamp(7px,1vw,10px)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        letterSpacing: '0.1em',
                        lineHeight: 1.2,
                        wordBreak: 'break-word',
                      }}>
                        {defenderCharName || '???'}
                      </div>
                    </div>
                  )}
                  {impactFired && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(255,23,68,0.45)',
                      animation: 'cin-flash 0.5s ease-out forwards',
                      pointerEvents: 'none',
                    }} />
                  )}
                </div>
                <div style={{
                  color: impactFired ? '#FF8A80' : '#ffcccc',
                  fontFamily: 'monospace',
                  fontSize: 'clamp(8px, 1.1vw, 11px)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  marginTop: 5,
                  textAlign: 'center',
                  maxWidth: 'clamp(80px,14vw,130px)',
                  textShadow: impactFired ? '0 0 10px #FF1744' : 'none',
                  transition: 'color 0.1s, text-shadow 0.1s',
                }}>
                  {defenderCharName || '???'}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{
              width: 'clamp(80px, 30vw, 280px)',
              height: 2,
              background: `linear-gradient(to right, transparent, ${theme.accent}, transparent)`,
              margin: '10px 0',
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
                marginBottom: 2,
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
          /* ── SPECIAL BONUS / non-attack layout ── */
          <div
            ref={contentRef}
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ opacity: 0 }}
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

      {/* Accent border lines on letterbox — GSAP controls opacity */}
      <div ref={accentTopRef} className="absolute" style={{
        top: 88, left: 0, right: 0, height: 3,
        background: `linear-gradient(to right, transparent 0%, ${theme.accent} 20%, ${theme.accentLight} 50%, ${theme.accent} 80%, transparent 100%)`,
        opacity: 0,
      }} />
      <div ref={accentBottomRef} className="absolute" style={{
        bottom: 88, left: 0, right: 0, height: 3,
        background: `linear-gradient(to right, transparent 0%, ${theme.accent} 20%, ${theme.accentLight} 50%, ${theme.accent} 80%, transparent 100%)`,
        opacity: 0,
      }} />
    </div>
  );
}
