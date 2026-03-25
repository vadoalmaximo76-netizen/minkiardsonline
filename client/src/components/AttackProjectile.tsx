import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

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

  // Travel duration scales with distance
  const travelDuration = Math.min(0.32, Math.max(0.16, dist / 2000));

  const color = isCritical ? '#ff1a1a' : isHeavy ? '#ff6600' : '#ffaa00';
  const glowSize = isCritical ? 38 : isHeavy ? 30 : 22;
  const coreSize = isCritical ? 16 : isHeavy ? 12 : 8;

  // Slight arc: midpoint rises above the straight path
  const arcY = -Math.min(55, dist * 0.15);
  const midX = dx * 0.45;
  const midY = dy * 0.45 + arcY;

  const impactFired = useRef(false);

  return createPortal(
    <>
      {/* ── Projectile: outer div for CSS centering, inner motion.div for animation ── */}
      <div
        className="fixed pointer-events-none"
        style={{ left: fromX, top: fromY, zIndex: 99990, transform: 'translate(-50%, -50%)' }}
      >
        <motion.div
          initial={{ x: 0, y: 0, scale: 0.5, opacity: 0 }}
          animate={{
            x: [0, midX, dx],
            y: [0, midY, dy],
            scale: [0.5, 1.3, isCritical ? 2.0 : isHeavy ? 1.6 : 1.2],
            opacity: [0, 1, 1],
          }}
          transition={{
            duration: travelDuration,
            ease: 'easeIn',
            times: [0, 0.4, 1],
          }}
          onAnimationComplete={() => {
            if (!impactFired.current) {
              impactFired.current = true;
              onImpact();
            }
            onComplete();
          }}
        >
          {/* Outer glow ring */}
          <div
            style={{
              width: glowSize,
              height: glowSize,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${color}ff 0%, ${color}88 50%, transparent 100%)`,
              boxShadow: `0 0 ${glowSize}px ${color}, 0 0 ${glowSize * 2}px ${color}88`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* White hot core */}
            <div
              style={{
                width: coreSize,
                height: coreSize,
                borderRadius: '50%',
                background: '#ffffff',
                boxShadow: `0 0 8px #fff, 0 0 16px ${color}`,
              }}
            />
          </div>
        </motion.div>
      </div>

      {/* ── Impact burst at target ── */}
      <div
        className="fixed pointer-events-none"
        style={{ left: toX, top: toY, zIndex: 99989, transform: 'translate(-50%, -50%)' }}
      >
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [0, isCritical ? 4.2 : isHeavy ? 3.2 : 2.4, 0],
            opacity: [0, 0.95, 0],
          }}
          transition={{
            delay: travelDuration * 0.88,
            duration: isCritical ? 0.55 : 0.38,
            ease: 'easeOut',
            times: [0, 0.28, 1],
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: `radial-gradient(circle, #fff 0%, ${color} 40%, transparent 70%)`,
              boxShadow: `0 0 40px ${color}, 0 0 80px ${color}88`,
            }}
          />
        </motion.div>
      </div>

      {/* ── Expanding ring at impact ── */}
      <div
        className="fixed pointer-events-none"
        style={{ left: toX, top: toY, zIndex: 99988, transform: 'translate(-50%, -50%)' }}
      >
        <motion.div
          style={{
            border: `3px solid ${color}`,
            borderRadius: '50%',
            width: 22,
            height: 22,
          }}
          initial={{ scale: 0, opacity: 0.9 }}
          animate={{
            scale: [0, isCritical ? 5.5 : 3.8],
            opacity: [0.9, 0],
          }}
          transition={{
            delay: travelDuration * 0.92,
            duration: 0.45,
            ease: 'easeOut',
          }}
        />
      </div>
    </>,
    document.body
  );
};
