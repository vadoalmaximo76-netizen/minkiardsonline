import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useBackgroundEffect, EVENT_COLORS } from '../lib/stores/useBackgroundEffect';
import type { GameEvent } from '../lib/stores/useBackgroundEffect';

const HIGH_PRIORITY_EVENTS = new Set<GameEvent>(['death', 'clash', 'evolution']);

export function DynamicBackground() {
  const currentEvent = useBackgroundEffect(s => s.currentEvent);

  // Gradient layer refs — crossfade between two layers
  const gradLayerARef = useRef<HTMLDivElement>(null);
  const gradLayerBRef = useRef<HTMLDivElement>(null);
  const activeLayerRef = useRef<'A' | 'B'>('A');

  // Orb refs
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);
  const orb3Ref = useRef<HTMLDivElement>(null);
  const orb4Ref = useRef<HTMLDivElement>(null);
  const orb5Ref = useRef<HTMLDivElement>(null);

  // Aurora refs
  const aurora1Ref = useRef<HTMLDivElement>(null);
  const aurora2Ref = useRef<HTMLDivElement>(null);

  // Nebula ref
  const nebulaRef = useRef<HTMLDivElement>(null);

  // Running tweens ref for cleanup
  const tweensRef = useRef<gsap.core.Tween[]>([]);

  useEffect(() => {
    const colors = EVENT_COLORS[currentEvent];
    const isHighPriority = HIGH_PRIORITY_EVENTS.has(currentEvent);
    const duration = isHighPriority ? 0.35 : 0.9;

    // Kill in-progress tweens for high-priority transitions
    if (isHighPriority) {
      tweensRef.current.forEach(t => t.kill());
      tweensRef.current = [];
    }

    const newTweens: gsap.core.Tween[] = [];

    // ── Gradient crossfade ──
    const layerA = gradLayerARef.current;
    const layerB = gradLayerBRef.current;
    if (layerA && layerB) {
      const nextIsB = activeLayerRef.current === 'A';
      const incoming = nextIsB ? layerB : layerA;
      const outgoing = nextIsB ? layerA : layerB;

      // Set incoming layer to new gradient at opacity 0
      gsap.set(incoming, { background: colors.gradient, opacity: 0 });

      // Crossfade
      newTweens.push(
        gsap.to(incoming, { opacity: 1, duration, ease: 'power2.inOut' }),
        gsap.to(outgoing, { opacity: 0, duration, ease: 'power2.inOut' }),
      );
      activeLayerRef.current = nextIsB ? 'B' : 'A';
    }

    // ── Orb colors and opacities ──
    const orbUpdates = [
      { ref: orb1Ref, color: colors.orb1, opacity: colors.opacity1 },
      { ref: orb2Ref, color: colors.orb2, opacity: colors.opacity2 },
      { ref: orb3Ref, color: colors.orb3, opacity: colors.opacity3 },
      { ref: orb4Ref, color: colors.orb4, opacity: colors.opacity4 },
      { ref: orb5Ref, color: colors.orb5, opacity: colors.opacity5 },
    ];

    orbUpdates.forEach(({ ref, color, opacity }) => {
      if (!ref.current) return;
      // Tween opacity via GSAP
      newTweens.push(
        gsap.to(ref.current, { opacity, duration, ease: 'power2.inOut' }),
      );
      // Color: update background inline (gradient string can't be tweened, but color change is imperceptible at this blur level)
      gsap.set(ref.current, { background: `radial-gradient(circle, ${color}, transparent 65%)` });
    });

    // ── Aurora and nebula opacities ──
    if (aurora1Ref.current) {
      newTweens.push(
        gsap.to(aurora1Ref.current, {
          opacity: colors.auroraOpacity,
          duration,
          ease: 'power2.inOut',
        }),
      );
      gsap.set(aurora1Ref.current, {
        background: `linear-gradient(90deg, transparent 0%, ${colors.auroraColor1} 30%, ${colors.auroraColor2} 50%, ${colors.auroraColor1} 70%, transparent 100%)`,
      });
    }
    if (aurora2Ref.current) {
      newTweens.push(
        gsap.to(aurora2Ref.current, {
          opacity: colors.auroraOpacity * 0.7,
          duration,
          ease: 'power2.inOut',
        }),
      );
      gsap.set(aurora2Ref.current, {
        background: `linear-gradient(90deg, transparent 0%, ${colors.auroraColor2} 25%, ${colors.auroraColor1} 50%, ${colors.auroraColor2} 75%, transparent 100%)`,
      });
    }
    if (nebulaRef.current) {
      newTweens.push(
        gsap.to(nebulaRef.current, {
          opacity: colors.pulseOpacity,
          duration,
          ease: 'power2.inOut',
        }),
      );
      gsap.set(nebulaRef.current, {
        background: `radial-gradient(circle, ${colors.pulseColor}, transparent 60%)`,
      });
    }

    tweensRef.current.push(...newTweens);

    return () => {
      newTweens.forEach(t => t.kill());
    };
  }, [currentEvent]);

  const initialColors = EVENT_COLORS['idle'];

  return (
    <>
      {/* Gradient layers — crossfaded by GSAP */}
      <div
        ref={gradLayerARef}
        className="fixed inset-0 pointer-events-none animate-color-shift"
        style={{ background: initialColors.gradient, opacity: 1 }}
      />
      <div
        ref={gradLayerBRef}
        className="fixed inset-0 pointer-events-none animate-color-shift"
        style={{ background: initialColors.gradient, opacity: 0 }}
      />

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Main floating orbs */}
        <div
          ref={orb1Ref}
          className="absolute w-[200px] h-[200px] md:w-[700px] md:h-[700px] rounded-full blur-[40px] md:blur-[120px] md:animate-bg-float-1 will-change-[opacity]"
          style={{
            background: `radial-gradient(circle, ${initialColors.orb1}, transparent 65%)`,
            opacity: initialColors.opacity1,
            top: '5%', left: '15%',
          }}
        />
        <div
          ref={orb2Ref}
          className="absolute w-[180px] h-[180px] md:w-[600px] md:h-[600px] rounded-full blur-[35px] md:blur-[100px] md:animate-bg-float-2 will-change-[opacity]"
          style={{
            background: `radial-gradient(circle, ${initialColors.orb2}, transparent 65%)`,
            opacity: initialColors.opacity2,
            bottom: '10%', right: '10%',
          }}
        />
        <div
          ref={orb3Ref}
          className="hidden md:block absolute w-[500px] h-[500px] rounded-full blur-[90px] animate-bg-float-3"
          style={{
            background: `radial-gradient(circle, ${initialColors.orb3}, transparent 65%)`,
            opacity: initialColors.opacity3,
            top: '40%', left: '55%',
          }}
        />
        <div
          ref={orb4Ref}
          className="hidden md:block absolute w-[550px] h-[550px] rounded-full blur-[110px] animate-bg-float-4"
          style={{
            background: `radial-gradient(circle, ${initialColors.orb4}, transparent 65%)`,
            opacity: initialColors.opacity4,
            top: '60%', left: '5%',
          }}
        />
        <div
          ref={orb5Ref}
          className="hidden md:block absolute w-[450px] h-[450px] rounded-full blur-[80px] animate-bg-float-5"
          style={{
            background: `radial-gradient(circle, ${initialColors.orb5}, transparent 65%)`,
            opacity: initialColors.opacity5,
            top: '15%', right: '25%',
          }}
        />

        {/* Aurora wave effects */}
        <div
          ref={aurora1Ref}
          className="hidden md:block absolute inset-0 animate-aurora-1"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${initialColors.auroraColor1} 30%, ${initialColors.auroraColor2} 50%, ${initialColors.auroraColor1} 70%, transparent 100%)`,
            opacity: initialColors.auroraOpacity,
            height: '40%',
            top: '10%',
          }}
        />
        <div
          ref={aurora2Ref}
          className="hidden md:block absolute inset-0 animate-aurora-2"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${initialColors.auroraColor2} 25%, ${initialColors.auroraColor1} 50%, ${initialColors.auroraColor2} 75%, transparent 100%)`,
            opacity: initialColors.auroraOpacity * 0.7,
            height: '35%',
            bottom: '15%',
            top: 'auto',
          }}
        />

        {/* Central nebula pulse */}
        <div
          ref={nebulaRef}
          className="hidden md:block absolute w-[800px] h-[800px] rounded-full blur-[150px] animate-nebula-pulse"
          style={{
            background: `radial-gradient(circle, ${initialColors.pulseColor}, transparent 60%)`,
            opacity: initialColors.pulseOpacity,
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    </>
  );
}
