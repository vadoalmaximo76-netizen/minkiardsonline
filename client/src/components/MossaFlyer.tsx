import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';

interface MossaFlyerProps {
  fromRect: DOMRect;
  toRect: DOMRect;
  cardImageSrc?: string;
  damage: number;
  onImpact: () => void;
  onComplete: () => void;
}

const CARD_W = 54;
const CARD_H = 76;
const FLY_DURATION = 0.26;

export const MossaFlyer: React.FC<MossaFlyerProps> = ({
  fromRect,
  toRect,
  cardImageSrc,
  damage,
  onImpact,
  onComplete,
}) => {
  const isHeavy = damage >= 30;
  const glowColor = isHeavy ? '#ef4444' : '#f97316';

  const onImpactRef = useRef(onImpact);
  const onCompleteRef = useRef(onComplete);
  onImpactRef.current = onImpact;
  onCompleteRef.current = onComplete;

  const cardRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const ringsRef = useRef<(HTMLDivElement | null)[]>([]);
  const sparksRef = useRef<(HTMLDivElement | null)[]>([]);
  const screenPulseRef = useRef<HTMLDivElement>(null);

  const fx = fromRect.left + fromRect.width / 2;
  const fy = fromRect.top + fromRect.height / 2;
  const tx = toRect.left + toRect.width / 2;
  const ty = toRect.top + toRect.height / 2;
  const dx = tx - fx;
  const dy = ty - fy;
  const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => onCompleteRef.current(),
      });

      gsap.set(card, {
        x: fx - CARD_W / 2,
        y: fy - CARD_H / 2,
        scale: 1.15,
        rotation: angleDeg - 90,
        opacity: 1,
      });

      const arcPeakX = (fx + tx) / 2 + dy * 0.1;
      const arcPeakY = (fy + ty) / 2 - Math.abs(dx) * 0.15 - 40;

      tl.to(card, {
        motionPath: undefined,
        x: arcPeakX - CARD_W / 2,
        y: arcPeakY - CARD_H / 2,
        scale: 1.0,
        rotation: angleDeg - 90,
        opacity: 1,
        duration: FLY_DURATION * 0.45,
        ease: 'power2.out',
      })
        .to(card, {
          x: tx - CARD_W / 2,
          y: ty - CARD_H / 2,
          scale: 0.75,
          rotation: angleDeg - 90,
          opacity: 0.9,
          duration: FLY_DURATION * 0.55,
          ease: 'power3.in',
        })
        .call(() => onImpactRef.current())
        .to(card, {
          scale: 1.6,
          opacity: 0,
          duration: 0.12,
          ease: 'power2.out',
        });

      const impactTime = FLY_DURATION;

      if (flashRef.current) {
        tl.fromTo(
          flashRef.current,
          { scale: 0.3, opacity: 0.85 },
          { scale: 2.0, opacity: 0, duration: 0.25, ease: 'power2.out' },
          impactTime
        );
      }

      ringsRef.current.forEach((ring, i) => {
        if (!ring) return;
        tl.fromTo(
          ring,
          { scale: 0.1, opacity: 0.9 },
          {
            scale: 2.8,
            opacity: 0,
            duration: 0.45 + i * 0.12,
            ease: 'power2.out',
          },
          impactTime + i * 0.06
        );
      });

      const sparkAngles = [0, 45, 90, 135, 180, 225, 270, 315];
      sparksRef.current.forEach((spark, i) => {
        if (!spark) return;
        const angle = sparkAngles[i] * (Math.PI / 180);
        const dist2 = 50 + (i * 13 % 40);
        const sx = Math.cos(angle) * dist2;
        const sy = Math.sin(angle) * dist2;
        tl.fromTo(
          spark,
          { x: 0, y: 0, scale: 1, opacity: 1 },
          {
            x: sx,
            y: sy,
            scale: 0.2,
            opacity: 0,
            duration: 0.35 + (i * 7 % 15) / 100,
            ease: 'power3.out',
          },
          impactTime + i * 0.02
        );
      });

      if (isHeavy && screenPulseRef.current) {
        tl.fromTo(
          screenPulseRef.current,
          { opacity: 0.85, scale: 0.3 },
          { opacity: 0, scale: 2.0, duration: 0.3, ease: 'power2.out' },
          impactTime
        );
      }

      tl.to({}, { duration: 0.2 });
    });

    return () => ctx.revert();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div className="fixed inset-0 z-[99990] pointer-events-none">
      <div
        ref={cardRef}
        style={{
          position: 'absolute',
          width: CARD_W,
          height: CARD_H,
          borderRadius: 5,
          boxShadow: `0 0 18px ${glowColor}, 0 0 40px ${glowColor}80`,
          overflow: 'hidden',
          willChange: 'transform',
          opacity: 0,
        }}
      >
        {cardImageSrc ? (
          <img
            src={cardImageSrc}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: isHeavy
                ? 'linear-gradient(135deg, #7f1d1d, #ef4444, #fca5a5)'
                : 'linear-gradient(135deg, #78350f, #f97316, #fcd34d)',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at center, ${glowColor}60, transparent 70%)`,
          }}
        />
      </div>

      <div
        ref={flashRef}
        style={{
          position: 'absolute',
          left: tx,
          top: ty,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #ffffff, rgba(255,255,255,0) 70%)',
          transform: 'translate(-50%, -50%)',
          opacity: 0,
        }}
      />

      {[0, 1, 2].map((i) => (
        <div
          key={i}
          ref={(el) => { ringsRef.current[i] = el; }}
          style={{
            position: 'absolute',
            left: tx,
            top: ty,
            width: isHeavy ? 120 : 80,
            height: isHeavy ? 120 : 80,
            borderRadius: '50%',
            border: `2px solid ${glowColor}`,
            transform: 'translate(-50%, -50%)',
            opacity: 0,
          }}
        />
      ))}

      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div
          key={i}
          ref={(el) => { sparksRef.current[i] = el; }}
          style={{
            position: 'absolute',
            left: tx,
            top: ty,
            width: 4 + (i % 3),
            height: 4 + (i % 3),
            borderRadius: '50%',
            background: i % 2 === 0 ? glowColor : '#fff',
            boxShadow: `0 0 6px ${glowColor}`,
            transform: 'translate(-50%, -50%)',
            opacity: 0,
          }}
        />
      ))}

      {isHeavy && (
        <div
          ref={screenPulseRef}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(239,68,68,0.12)',
            pointerEvents: 'none',
            opacity: 0,
          }}
        />
      )}
    </div>,
    document.body
  );
};
