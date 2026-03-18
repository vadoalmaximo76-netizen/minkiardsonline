import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';

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

  const offsetX = useMemo(() => {
    const seed = value * 7 + x * 3;
    return (Math.sin(seed) * 30) - 15;
  }, [value, x]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 350);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  const getStyles = () => {
    switch (type) {
      case 'damage':
        return {
          color: isCritical ? '#ff2222' : '#ef4444',
          text: `-${Math.abs(value)}`,
          emoji: isCritical ? '💀' : '💥',
          shadow: isCritical 
            ? '0 0 30px #ff0000, 0 0 60px #ff0000, 0 0 90px rgba(255,0,0,0.5)' 
            : '0 0 20px #ef4444, 0 0 40px #ef4444',
          animation: 'float-damage-3d',
          size: isCritical ? 'text-6xl md:text-7xl' : 'text-4xl md:text-5xl',
        };
      case 'heal':
        return {
          color: '#22c55e',
          text: `+${Math.abs(value)}`,
          emoji: '✨',
          shadow: '0 0 20px #22c55e, 0 0 40px #22c55e',
          animation: 'float-heal-3d',
          size: value >= 200 ? 'text-5xl md:text-6xl' : 'text-4xl md:text-5xl',
        };
      case 'star-up':
        return {
          color: '#fbbf24',
          text: `+${Math.abs(value)}⭐`,
          emoji: '🌟',
          shadow: '0 0 20px #fbbf24, 0 0 40px #fbbf24',
          animation: 'float-heal-3d',
          size: 'text-4xl md:text-5xl',
        };
      case 'star-down':
        return {
          color: '#f97316',
          text: `-${Math.abs(value)}⭐`,
          emoji: '💫',
          shadow: '0 0 20px #f97316, 0 0 40px #f97316',
          animation: 'float-damage-3d',
          size: 'text-4xl md:text-5xl',
        };
    }
  };

  const styles = getStyles();

  return createPortal(
    <>
      <div
        className="fixed pointer-events-none z-[99999]"
        style={{
          left: x + offsetX,
          top: y,
          transform: 'translate(-50%, -50%)',
          animation: `${styles.animation} 0.35s ease-out forwards`,
        }}
      >
        <div
          className={`font-black ${styles.size}`}
          style={{
            color: styles.color,
            textShadow: `${styles.shadow}, 3px 3px 0 #000, -1px -1px 0 #000`,
            WebkitTextStroke: isCritical ? '3px #000' : '2px #000',
            letterSpacing: isCritical ? '2px' : undefined,
          }}
        >
          {styles.emoji} {styles.text}
        </div>
      </div>
      {isCritical && (
        <div
          className="fixed pointer-events-none z-[99998]"
          style={{
            left: x,
            top: y - 40,
            transform: 'translate(-50%, -50%)',
            animation: 'damage-critical 1.2s ease-out forwards',
          }}
        >
          <div
            className="font-black text-2xl md:text-3xl"
            style={{
              color: '#ff0',
              textShadow: '0 0 20px #ff0, 0 0 40px #f90, 3px 3px 0 #000',
              WebkitTextStroke: '2px #000',
            }}
          >
            CRITICO!
          </div>
        </div>
      )}
    </>,
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
