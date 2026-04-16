import React, { useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';

interface AttackProjectileProps {
  fromRect: DOMRect;
  toRect: DOMRect;
  damage: number;
  onImpact: () => void;
  onComplete: () => void;
}

export const AttackProjectile: React.FC<AttackProjectileProps> = ({
  fromRect,
  toRect,
  damage,
  onImpact,
  onComplete,
}) => {
  const isCritical = damage >= 200;
  const isHeavy = damage >= 80;

  const fromX = fromRect.left + fromRect.width / 2;
  const fromY = fromRect.top + fromRect.height / 2;
  const toX = toRect.left + toRect.width / 2;
  const toY = toRect.top + toRect.height / 2;

  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

  const travelDuration = Math.min(0.26, Math.max(0.11, dist / 2400));
  const impactAt = travelDuration * 0.82;
  const totalDuration = travelDuration + 0.75;

  const primary = isCritical ? '#ff2200' : isHeavy ? '#ff6600' : '#ffcc00';
  const secondary = isCritical ? '#ff8800' : isHeavy ? '#ffdd00' : '#ffffff';
  const cometW = isCritical ? 110 : isHeavy ? 85 : 65;
  const cometH = isCritical ? 18 : isHeavy ? 14 : 10;
  const impactR = isCritical ? 70 : isHeavy ? 52 : 38;

  const sparks = useMemo(() => {
    const count = isCritical ? 12 : isHeavy ? 10 : 8;
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2;
      const len = isCritical ? 85 + (i % 3) * 30 : isHeavy ? 60 + (i % 3) * 22 : 42 + (i % 3) * 16;
      return {
        x: Math.cos(a) * len,
        y: Math.sin(a) * len,
        w: i % 2 === 0 ? 3 : 2,
        color: i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? primary : secondary,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glowTrailRef = useRef<SVGLineElement>(null);
  const coreTrailRef = useRef<SVGLineElement>(null);
  const cometRef = useRef<HTMLDivElement>(null);
  const cometBodyRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const ringsRef = useRef<(HTMLDivElement | null)[]>([]);
  const sparksRef = useRef<(HTMLDivElement | null)[]>([]);
  const screenFlashRef = useRef<HTMLDivElement>(null);

  const onImpactRef = useRef(onImpact);
  const onCompleteRef = useRef(onComplete);
  onImpactRef.current = onImpact;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: () => onCompleteRef.current() });

      if (glowTrailRef.current) {
        tl.to(glowTrailRef.current, {
          attr: { x2: toX, y2: toY },
          duration: travelDuration,
          ease: 'power2.inOut',
        }, 0);
      }
      if (coreTrailRef.current) {
        tl.to(coreTrailRef.current, {
          attr: { x2: toX, y2: toY },
          duration: travelDuration,
          ease: 'power2.inOut',
        }, 0);
      }

      if (cometRef.current) {
        gsap.set(cometRef.current, { opacity: 1 });
        tl.fromTo(cometRef.current,
          { x: 0 },
          { x: dist, duration: travelDuration, ease: 'power4.in' },
          0
        );
      }
      if (cometBodyRef.current) {
        tl.fromTo(cometBodyRef.current,
          { scaleX: 0.3, scaleY: 0.6, opacity: 0 },
          { scaleX: 1.6, scaleY: 1.2, opacity: 1, duration: travelDuration, ease: 'power3.in' },
          0
        );
      }

      tl.call(() => onImpactRef.current(), [], impactAt);

      if (cometRef.current) {
        tl.to(cometRef.current, { opacity: 0, duration: 0.04 }, impactAt);
      }

      const flashDur = isCritical ? 0.65 : 0.48;
      if (flashRef.current) {
        tl.fromTo(flashRef.current,
          { scale: 0, opacity: 0 },
          { scale: 1.4, opacity: 1, duration: flashDur * 0.3, ease: 'power2.out' },
          impactAt
        ).to(flashRef.current,
          { scale: 0.15, opacity: 0, duration: flashDur * 0.7, ease: 'power2.in' }
        );
      }

      const ringDefs = [
        { scale: isCritical ? 8 : isHeavy ? 6 : 4.5, dur: 0.42, offset: 0 },
        { scale: isCritical ? 6 : isHeavy ? 4.5 : 3.2, dur: 0.35, offset: 0.06 },
        { scale: isCritical ? 10 : isHeavy ? 7.5 : 5.5, dur: 0.55, offset: 0.02 },
      ];
      ringsRef.current.forEach((ring, i) => {
        if (!ring) return;
        const rd = ringDefs[i];
        tl.fromTo(ring,
          { scale: 0, opacity: i === 1 ? 0.95 : 0.75 },
          { scale: rd.scale, opacity: 0, duration: rd.dur, ease: 'power2.out' },
          impactAt + rd.offset
        );
      });

      sparksRef.current.forEach((spark, i) => {
        if (!spark) return;
        const s = sparks[i];
        tl.fromTo(spark,
          { x: 0, y: 0, scaleX: 1, opacity: 1 },
          { x: s.x, y: s.y, scaleX: 0.15, opacity: 0, duration: 0.45, ease: 'power3.out' },
          impactAt + 0.02
        );
      });

      if (screenFlashRef.current && (isCritical || isHeavy)) {
        const sfDur = isCritical ? 0.45 : 0.3;
        tl.fromTo(screenFlashRef.current,
          { opacity: 0 },
          { opacity: isCritical ? 0.85 : 0.55, duration: sfDur * 0.15, ease: 'power2.out' },
          impactAt
        ).to(screenFlashRef.current,
          { opacity: 0, duration: sfDur * 0.85, ease: 'power2.in' }
        );
      }

      const remaining = totalDuration - tl.duration();
      if (remaining > 0) tl.to({}, { duration: remaining });
    });

    return () => ctx.revert();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <>
      <svg
        className="fixed inset-0 pointer-events-none overflow-visible"
        style={{ zIndex: 99986, width: '100vw', height: '100vh', top: 0, left: 0 }}
      >
        <defs>
          <filter id="trail-blur">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <line
          ref={glowTrailRef}
          x1={fromX} y1={fromY} x2={fromX} y2={fromY}
          stroke={primary}
          strokeWidth={cometH * 0.7}
          strokeLinecap="round"
          opacity={0.35}
          filter="url(#trail-blur)"
        />
        <line
          ref={coreTrailRef}
          x1={fromX} y1={fromY} x2={fromX} y2={fromY}
          stroke="#ffffff"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.5}
        />
      </svg>

      <div
        ref={cometRef}
        className="fixed pointer-events-none"
        style={{ left: fromX, top: fromY, zIndex: 99990, transform: `rotate(${angleDeg}deg)`, opacity: 0 }}
      >
        <div style={{ transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center' }}>
          <div ref={cometBodyRef} style={{ transformOrigin: 'right center' }}>
            <div
              style={{
                position: 'absolute',
                width: cometW,
                height: cometH * 2.5,
                top: '50%',
                left: 0,
                transform: 'translateY(-50%)',
                borderRadius: '0 50% 50% 0',
                background: `linear-gradient(to right, transparent 0%, ${primary}44 40%, ${primary}cc 100%)`,
                filter: `blur(6px)`,
              }}
            />
            <div
              style={{
                position: 'relative',
                width: cometW,
                height: cometH,
                borderRadius: `0 ${cometH / 2}px ${cometH / 2}px 0`,
                background: `linear-gradient(to right, transparent 0%, ${primary}88 25%, ${primary} 65%, ${secondary} 88%, #ffffff 100%)`,
                boxShadow: `0 0 ${cometH * 1.5}px ${primary}, 0 0 ${cometH * 3}px ${primary}88`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: cometH * 1.4,
                height: cometH * 1.4,
                borderRadius: '50%',
                background: '#ffffff',
                boxShadow: `0 0 ${cometH}px #fff, 0 0 ${cometH * 2}px ${primary}`,
              }}
            />
          </div>
        </div>
      </div>

      <div
        ref={flashRef}
        className="fixed pointer-events-none"
        style={{ left: toX, top: toY, zIndex: 99993, transform: 'translate(-50%, -50%)', opacity: 0 }}
      >
        <div
          style={{
            width: impactR * 2,
            height: impactR * 2,
            borderRadius: '50%',
            background: `radial-gradient(circle, #ffffff 0%, ${secondary} 25%, ${primary} 55%, transparent 80%)`,
            boxShadow: `0 0 ${impactR}px ${primary}, 0 0 ${impactR * 2}px ${primary}88`,
          }}
        />
      </div>

      {[
        { w: 24, border: 4, color: primary },
        { w: 24, border: 3, color: '#ffffff' },
        { w: 16, border: 2, color: primary },
      ].map((rd, i) => (
        <div
          key={i}
          ref={(el) => { ringsRef.current[i] = el; }}
          className="fixed pointer-events-none"
          style={{ left: toX, top: toY, zIndex: 99989, transform: 'translate(-50%, -50%)', opacity: 0 }}
        >
          <div
            style={{
              width: rd.w,
              height: rd.w,
              borderRadius: '50%',
              border: `${rd.border}px solid ${rd.color}`,
              boxShadow: `0 0 8px ${primary}`,
            }}
          />
        </div>
      ))}

      {sparks.map((spark, i) => (
        <div
          key={i}
          ref={(el) => { sparksRef.current[i] = el; }}
          className="fixed pointer-events-none"
          style={{ left: toX, top: toY, zIndex: 99990, transform: 'translate(-50%, -50%)' }}
        >
          <div
            style={{
              position: 'absolute',
              width: spark.w * 10,
              height: spark.w,
              borderRadius: spark.w / 2,
              background: spark.color,
              boxShadow: `0 0 4px ${spark.color}`,
              transformOrigin: 'left center',
              rotate: `${Math.atan2(spark.y, spark.x) * (180 / Math.PI)}deg`,
            }}
          />
        </div>
      ))}

      {(isCritical || isHeavy) && (
        <div
          ref={screenFlashRef}
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: 99992,
            opacity: 0,
            background: `radial-gradient(circle ${isCritical ? '55vw' : '35vw'} at ${toX}px ${toY}px, ${primary}55 0%, transparent 100%)`,
          }}
        />
      )}
    </>,
    document.body
  );
};
