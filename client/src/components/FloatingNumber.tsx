import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

const _isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

interface FloatingNumberProps {
  value: number;
  type: 'damage' | 'heal' | 'star-up' | 'star-down';
  x: number;
  y: number;
  onComplete: () => void;
}

let _floatingCounter = 0;

export const FloatingNumber: React.FC<FloatingNumberProps> = ({
  value,
  type,
  x,
  y,
  onComplete
}) => {
  const isCritical = type === 'damage' && value >= 200;
  const isHeavy = type === 'damage' && value >= 50;

  const offsetX = useMemo(() => {
    const seed = value * 7 + x * 3;
    return (Math.sin(seed) * 36) - 18;
  }, [value, x]);

  const DURATION = isCritical ? 1.8 : isHeavy ? 1.4 : 1.1;

  useEffect(() => {
    const ms = DURATION * 1000 + 100;
    const timer = setTimeout(() => {
      onComplete();
    }, ms);
    return () => clearTimeout(timer);
  }, [onComplete, DURATION]);

  const getConfig = () => {
    switch (type) {
      case 'damage':
        return {
          color: isCritical ? '#ff2020' : isHeavy ? '#ff6020' : '#ef4444',
          text: `-${Math.abs(value)}`,
          emoji: isCritical ? '💀' : isHeavy ? '💥' : '🩸',
          glowColor: isCritical ? '#ff0000' : '#ef4444',
          fontSize: isCritical ? (_isMobile ? '3.2rem' : '5rem') : isHeavy ? (_isMobile ? '2.6rem' : '4rem') : (_isMobile ? '2rem' : '3rem'),
        };
      case 'heal':
        return {
          color: '#22c55e',
          text: `+${Math.abs(value)}`,
          emoji: '💚',
          glowColor: '#22c55e',
          fontSize: _isMobile ? '2rem' : '3rem',
        };
      case 'star-up':
        return {
          color: '#fbbf24',
          text: `+${Math.abs(value)}⭐`,
          emoji: '🌟',
          glowColor: '#fbbf24',
          fontSize: _isMobile ? '1.8rem' : '2.6rem',
        };
      case 'star-down':
        return {
          color: '#f97316',
          text: `-${Math.abs(value)}⭐`,
          emoji: '💫',
          glowColor: '#f97316',
          fontSize: _isMobile ? '1.8rem' : '2.6rem',
        };
    }
  };

  const cfg = getConfig();
  const riseAmount = isCritical ? -140 : isHeavy ? -110 : -85;

  return createPortal(
    /* Outer div: pure CSS positioning, centered at card — no Framer transforms */
    <div
      className="fixed pointer-events-none z-[99999]"
      style={{ left: x + offsetX, top: y, transform: 'translate(-50%, -50%)' }}
    >
      {/* Inner motion.div: handles animation transforms only */}
      <motion.div
        style={{ originX: '50%', originY: '50%' }}
        initial={{ opacity: 0, y: 0, scale: isCritical ? 1.5 : isHeavy ? 1.25 : 1.05 }}
        animate={{
          opacity: [0, 1, 1, 1, 0],
          y: [0, riseAmount * 0.2, riseAmount * 0.6, riseAmount * 0.85, riseAmount],
          scale: [isCritical ? 1.5 : isHeavy ? 1.25 : 1.05, 1.0, 1.0, 0.95, 0.8],
        }}
        transition={{
          duration: DURATION,
          times: [0, 0.12, 0.45, 0.75, 1],
          ease: 'easeOut',
        }}
      >
        <div
          className="font-black select-none whitespace-nowrap"
          style={{
            fontSize: cfg.fontSize,
            color: cfg.color,
            textShadow: _isMobile
              ? `1px 1px 0 #000, -1px -1px 0 #000`
              : `0 0 20px ${cfg.glowColor}, 0 0 40px ${cfg.glowColor}, 3px 3px 0 #000, -1px -1px 0 #000`,
            WebkitTextStroke: `2px #000`,
            lineHeight: 1,
          }}
        >
          {cfg.emoji} {cfg.text}
        </div>

        {isCritical && (
          <motion.div
            className="font-black text-center select-none whitespace-nowrap"
            style={{
              fontSize: _isMobile ? '0.9rem' : '1.4rem',
              color: '#ffdd00',
              textShadow: '0 0 20px #ff0, 0 0 40px #f90, 2px 2px 0 #000',
              WebkitTextStroke: '1px #000',
              letterSpacing: '4px',
              marginTop: '4px',
              transform: 'translate(-50%, 0)',
            }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.25, 1.0, 0.8] }}
            transition={{ duration: DURATION, times: [0, 0.15, 0.6, 1], ease: 'easeOut' }}
          >
            CRITICO!
          </motion.div>
        )}
      </motion.div>
    </div>,
    document.body
  );
};

export const useFloatingNumbers = () => {
  const [numbers, setNumbers] = useState<Array<{
    id: string;
    value: number;
    type: 'damage' | 'heal' | 'star-up' | 'star-down';
    x: number;
    y: number;
  }>>([]);

  const addNumber = (value: number, type: 'damage' | 'heal' | 'star-up' | 'star-down', element?: HTMLElement) => {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 3;
    const id = `fn-${Date.now()}-${++_floatingCounter}`;
    setNumbers(prev => [...prev, { id, value, type, x, y }]);
  };

  const removeNumber = (id: string) => {
    setNumbers(prev => prev.filter(n => n.id !== id));
  };

  const FloatingNumbersContainer = () => (
    <>
      {numbers.map(num => (
        <FloatingNumber
          key={num.id}
          value={num.value}
          type={num.type}
          x={num.x}
          y={num.y}
          onComplete={() => removeNumber(num.id)}
        />
      ))}
    </>
  );

  return { addNumber, FloatingNumbersContainer };
};
