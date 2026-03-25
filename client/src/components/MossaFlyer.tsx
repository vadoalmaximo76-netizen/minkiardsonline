import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

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
const FLY_DURATION = 0.26; // seconds

export const MossaFlyer: React.FC<MossaFlyerProps> = ({
  fromRect,
  toRect,
  cardImageSrc,
  damage,
  onImpact,
  onComplete,
}) => {
  const controls = useAnimation();
  const impactFiredRef = useRef(false);
  const [showImpact, setShowImpact] = useState(false);
  const [impactPos, setImpactPos] = useState({ x: 0, y: 0 });

  const isHeavy = damage >= 30;
  const glowColor = isHeavy ? '#ef4444' : '#f97316';

  useEffect(() => {
    const fx = fromRect.left + fromRect.width / 2;
    const fy = fromRect.top + fromRect.height / 2;
    const tx = toRect.left + toRect.width / 2;
    const ty = toRect.top + toRect.height / 2;

    const dx = tx - fx;
    const dy = ty - fy;
    const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

    setImpactPos({ x: tx, y: ty });

    const run = async () => {
      // Phase 1: instantly place at source, pop up
      await controls.start({
        x: fx - CARD_W / 2,
        y: fy - CARD_H / 2,
        scale: 1.15,
        rotate: angleDeg - 90,
        opacity: 1,
        transition: { duration: 0 },
      });

      // Phase 2: fly toward target
      await controls.start({
        x: tx - CARD_W / 2,
        y: ty - CARD_H / 2,
        scale: 0.75,
        rotate: angleDeg - 90,
        opacity: 0.9,
        transition: {
          duration: FLY_DURATION,
          ease: [0.18, 0, 0.72, 1],
        },
      });

      // Phase 3: impact — card briefly expands and vanishes
      if (!impactFiredRef.current) {
        impactFiredRef.current = true;
        setShowImpact(true);
        onImpact();
      }

      await controls.start({
        scale: 1.6,
        opacity: 0,
        transition: { duration: 0.12, ease: 'easeOut' },
      });

      setTimeout(onComplete, 200);
    };

    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        @keyframes mf-ring {
          0%   { transform: translate(-50%,-50%) scale(0.1); opacity: 0.9; }
          100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; }
        }
        @keyframes mf-flash {
          0%   { opacity: 0.85; transform: translate(-50%,-50%) scale(0.3); }
          100% { opacity: 0;    transform: translate(-50%,-50%) scale(2); }
        }
        @keyframes mf-spark {
          0%   { opacity: 1; transform: translate(-50%,-50%) rotate(var(--sa)) translateX(0) scale(1); }
          100% { opacity: 0; transform: translate(-50%,-50%) rotate(var(--sa)) translateX(var(--sd)) scale(0.2); }
        }
        @keyframes mf-trail {
          0%   { opacity: 0.6; }
          100% { opacity: 0; }
        }
      `}</style>

      <div className="fixed inset-0 z-[99990] pointer-events-none">
        {/* Flying card */}
        <motion.div
          animate={controls}
          style={{
            position: 'absolute',
            width: CARD_W,
            height: CARD_H,
            borderRadius: 5,
            boxShadow: `0 0 18px ${glowColor}, 0 0 40px ${glowColor}80`,
            overflow: 'hidden',
            willChange: 'transform',
          }}
        >
          {cardImageSrc ? (
            <img
              src={cardImageSrc}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: isHeavy
                ? 'linear-gradient(135deg, #7f1d1d, #ef4444, #fca5a5)'
                : 'linear-gradient(135deg, #78350f, #f97316, #fcd34d)',
            }} />
          )}
          {/* Inner glow overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at center, ${glowColor}60, transparent 70%)`,
          }} />
        </motion.div>

        {/* Impact effects — appear when card hits */}
        {showImpact && (
          <>
            {/* White flash burst */}
            <div style={{
              position: 'absolute',
              left: impactPos.x, top: impactPos.y,
              width: 80, height: 80,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #ffffff, rgba(255,255,255,0) 70%)',
              animation: 'mf-flash 0.25s ease-out forwards',
            }} />

            {/* Shockwave rings */}
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                position: 'absolute',
                left: impactPos.x, top: impactPos.y,
                width: isHeavy ? 120 : 80,
                height: isHeavy ? 120 : 80,
                borderRadius: '50%',
                border: `2px solid ${glowColor}`,
                animation: `mf-ring ${0.45 + i * 0.12}s ${i * 0.06}s ease-out forwards`,
              }} />
            ))}

            {/* Spark particles */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} style={{
                position: 'absolute',
                left: impactPos.x, top: impactPos.y,
                width: 4 + (i % 3),
                height: 4 + (i % 3),
                borderRadius: '50%',
                background: i % 2 === 0 ? glowColor : '#fff',
                boxShadow: `0 0 6px ${glowColor}`,
                '--sa': `${i * 45}deg`,
                '--sd': `${50 + (i * 13 % 40)}px`,
                animation: `mf-spark ${0.35 + (i * 7 % 15) / 100}s ${i * 0.02}s ease-out forwards`,
              } as React.CSSProperties} />
            ))}

            {/* Heavy hit: extra screen pulse overlay */}
            {isHeavy && (
              <div style={{
                position: 'fixed', inset: 0,
                background: 'rgba(239,68,68,0.12)',
                animation: 'mf-flash 0.3s ease-out forwards',
                pointerEvents: 'none',
              }} />
            )}
          </>
        )}
      </div>
    </>
  );
};
