import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [visible, setVisible] = useState(true);
  const isCritical = type === 'damage' && value >= 200;
  const isHeavy = type === 'damage' && value >= 50;

  const offsetX = useMemo(() => {
    const seed = value * 7 + x * 3;
    return (Math.sin(seed) * 36) - 18;
  }, [value, x]);

  const DURATION = isCritical ? 1800 : isHeavy ? 1400 : 1100;

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 200);
    }, DURATION);
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
          strokeColor: '#000',
          strokeWidth: isCritical ? 3 : 2,
        };
      case 'heal':
        return {
          color: '#22c55e',
          text: `+${Math.abs(value)}`,
          emoji: '💚',
          glowColor: '#22c55e',
          fontSize: _isMobile ? '2rem' : '3rem',
          strokeColor: '#000',
          strokeWidth: 2,
        };
      case 'star-up':
        return {
          color: '#fbbf24',
          text: `+${Math.abs(value)}⭐`,
          emoji: '🌟',
          glowColor: '#fbbf24',
          fontSize: _isMobile ? '1.8rem' : '2.6rem',
          strokeColor: '#000',
          strokeWidth: 2,
        };
      case 'star-down':
        return {
          color: '#f97316',
          text: `-${Math.abs(value)}⭐`,
          emoji: '💫',
          glowColor: '#f97316',
          fontSize: _isMobile ? '1.8rem' : '2.6rem',
          strokeColor: '#000',
          strokeWidth: 2,
        };
    }
  };

  const cfg = getConfig();

  const damageY = isCritical ? -130 : isHeavy ? -100 : -80;
  const scaleInitial = isCritical ? 1.6 : isHeavy ? 1.3 : 1.1;

  const variants = {
    initial: {
      opacity: 0,
      y: 0,
      x: offsetX,
      scale: scaleInitial,
      rotate: isCritical ? -8 : (Math.sin(_floatingCounter) * 6),
    },
    animate: {
      opacity: [0, 1, 1, 0.8, 0],
      y: [0, damageY * 0.3, damageY * 0.65, damageY * 0.85, damageY],
      scale: [scaleInitial, 1.0, 1.0, 0.95, 0.8],
      rotate: isCritical ? [-8, 0, 3, 0] : 0,
      transition: {
        duration: DURATION / 1000,
        times: [0, 0.15, 0.5, 0.8, 1],
        ease: ['easeOut', 'linear', 'linear', 'easeIn'],
      },
    },
  };

  if (!visible) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed pointer-events-none z-[99999]"
        style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
        initial="initial"
        animate="animate"
        variants={variants}
      >
        <div
          className="font-black select-none"
          style={{
            fontSize: cfg.fontSize,
            color: cfg.color,
            textShadow: _isMobile
              ? `1px 1px 0 #000, -1px -1px 0 #000`
              : `0 0 20px ${cfg.glowColor}, 0 0 40px ${cfg.glowColor}, 3px 3px 0 #000, -1px -1px 0 #000`,
            WebkitTextStroke: `${cfg.strokeWidth}px ${cfg.strokeColor}`,
            letterSpacing: isCritical ? '2px' : undefined,
            lineHeight: 1,
          }}
        >
          {cfg.emoji} {cfg.text}
        </div>

        {isCritical && (
          <motion.div
            className="font-black text-center select-none"
            style={{
              fontSize: _isMobile ? '0.9rem' : '1.4rem',
              color: '#ffdd00',
              textShadow: '0 0 20px #ff0, 0 0 40px #f90, 2px 2px 0 #000',
              WebkitTextStroke: '1px #000',
              letterSpacing: '4px',
              marginTop: '2px',
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1.0, 0.8] }}
            transition={{ duration: DURATION / 1000, times: [0, 0.2, 0.7, 1] }}
          >
            CRITICO!
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>,
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
