import React, { useEffect, useMemo } from 'react';
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
  const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

  const travelDuration = Math.min(0.26, Math.max(0.11, dist / 2400));
  const impactDelay = travelDuration * 0.82;
  const totalDuration = travelDuration + 0.75;

  const primary = isCritical ? '#ff2200' : isHeavy ? '#ff6600' : '#ffcc00';
  const secondary = isCritical ? '#ff8800' : isHeavy ? '#ffdd00' : '#ffffff';
  const cometW = isCritical ? 110 : isHeavy ? 85 : 65;
  const cometH = isCritical ? 18 : isHeavy ? 14 : 10;
  const impactR = isCritical ? 70 : isHeavy ? 52 : 38;

  // Pre-compute spark directions (avoid random in render)
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

  // Cleanup after all animations finish
  useEffect(() => {
    const impactTimer = setTimeout(onImpact, impactDelay * 1000);
    const doneTimer = setTimeout(onComplete, totalDuration * 1000);
    return () => { clearTimeout(impactTimer); clearTimeout(doneTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <>
      {/* ── SVG trail line that draws from source toward target ── */}
      <svg
        className="fixed inset-0 pointer-events-none overflow-visible"
        style={{ zIndex: 99986, width: '100vw', height: '100vh', top: 0, left: 0 }}
      >
        <defs>
          <filter id="trail-blur">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        {/* Glow trail */}
        <motion.line
          x1={fromX} y1={fromY} x2={fromX} y2={fromY}
          stroke={primary}
          strokeWidth={cometH * 0.7}
          strokeLinecap="round"
          opacity={0.35}
          filter="url(#trail-blur)"
          animate={{ x2: toX, y2: toY }}
          transition={{ duration: travelDuration, ease: [0.4, 0, 1, 0.8] }}
        />
        {/* Sharp core trail */}
        <motion.line
          x1={fromX} y1={fromY} x2={fromX} y2={fromY}
          stroke="#ffffff"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.5}
          animate={{ x2: toX, y2: toY }}
          transition={{ duration: travelDuration, ease: [0.4, 0, 1, 0.8] }}
        />
      </svg>

      {/* ── Comet projectile: wrapper rotated toward target ── */}
      {/*    Inner motion.div slides x: 0 → dist along the rotated axis ── */}
      <div
        className="fixed pointer-events-none"
        style={{ left: fromX, top: fromY, zIndex: 99990, transform: `rotate(${angleDeg}deg)` }}
      >
        <motion.div
          animate={{ x: [0, dist * 0.45, dist] }}
          transition={{ duration: travelDuration, ease: [0.25, 0, 0.9, 1], times: [0, 0.4, 1] }}
        >
          {/* Center the comet on the animated position */}
          <div style={{ transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center' }}>
            <motion.div
              animate={{ scaleX: [0.3, 1.1, 1.6], scaleY: [0.6, 1, 1.2], opacity: [0, 1, 1] }}
              transition={{ duration: travelDuration, ease: 'easeIn', times: [0, 0.3, 1] }}
              style={{ transformOrigin: 'right center' }}
            >
              {/* Outer glow halo */}
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
              {/* Core comet body */}
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
              {/* Bright white tip */}
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
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* ── Impact: central flash burst ── */}
      <div className="fixed pointer-events-none" style={{ left: toX, top: toY, zIndex: 99993, transform: 'translate(-50%, -50%)' }}>
        <motion.div
          style={{
            width: impactR * 2,
            height: impactR * 2,
            borderRadius: '50%',
            background: `radial-gradient(circle, #ffffff 0%, ${secondary} 25%, ${primary} 55%, transparent 80%)`,
            boxShadow: `0 0 ${impactR}px ${primary}, 0 0 ${impactR * 2}px ${primary}88`,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.4, 0.15], opacity: [0, 1, 0] }}
          transition={{ delay: impactDelay, duration: isCritical ? 0.65 : 0.48, ease: 'easeOut', times: [0, 0.3, 1] }}
        />
      </div>

      {/* ── Impact: 3 shockwave rings ── */}
      {[
        { scale: isCritical ? 8 : isHeavy ? 6 : 4.5, dur: 0.42, delay: 0 },
        { scale: isCritical ? 6 : isHeavy ? 4.5 : 3.2, dur: 0.35, delay: 0.06 },
        { scale: isCritical ? 10 : isHeavy ? 7.5 : 5.5, dur: 0.55, delay: 0.02 },
      ].map((ring, i) => (
        <div key={i} className="fixed pointer-events-none" style={{ left: toX, top: toY, zIndex: 99989, transform: 'translate(-50%, -50%)' }}>
          <motion.div
            style={{
              width: i === 2 ? 16 : 24,
              height: i === 2 ? 16 : 24,
              borderRadius: '50%',
              border: `${i === 0 ? 4 : i === 1 ? 3 : 2}px solid ${i === 1 ? '#ffffff' : primary}`,
              boxShadow: `0 0 8px ${primary}`,
            }}
            initial={{ scale: 0, opacity: i === 1 ? 0.95 : 0.75 }}
            animate={{ scale: ring.scale, opacity: 0 }}
            transition={{ delay: impactDelay + ring.delay, duration: ring.dur, ease: 'easeOut' }}
          />
        </div>
      ))}

      {/* ── Impact: spark particles ── */}
      {sparks.map((spark, i) => (
        <div key={i} className="fixed pointer-events-none" style={{ left: toX, top: toY, zIndex: 99990, transform: 'translate(-50%, -50%)' }}>
          <motion.div
            style={{
              position: 'absolute',
              width: spark.w * 10,
              height: spark.w,
              borderRadius: spark.w / 2,
              background: spark.color,
              boxShadow: `0 0 4px ${spark.color}`,
              transformOrigin: 'left center',
              rotate: Math.atan2(spark.y, spark.x) * (180 / Math.PI),
            }}
            initial={{ scaleX: 1, x: 0, y: 0, opacity: 1 }}
            animate={{
              x: spark.x,
              y: spark.y,
              scaleX: 0.15,
              opacity: 0,
            }}
            transition={{ delay: impactDelay + 0.02, duration: 0.45, ease: [0.2, 0, 0.8, 1] }}
          />
        </div>
      ))}

      {/* ── Screen flash for heavy/critical ── */}
      {(isCritical || isHeavy) && (
        <motion.div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: 99992,
            background: `radial-gradient(circle ${isCritical ? '55vw' : '35vw'} at ${toX}px ${toY}px, ${primary}55 0%, transparent 100%)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, isCritical ? 0.85 : 0.55, 0] }}
          transition={{ delay: impactDelay, duration: isCritical ? 0.45 : 0.3, ease: 'easeOut', times: [0, 0.15, 1] }}
        />
      )}
    </>,
    document.body
  );
};
