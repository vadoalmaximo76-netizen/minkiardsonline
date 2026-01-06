import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface FloatingNumberProps {
  value: number;
  type: 'damage' | 'heal' | 'star-up' | 'star-down';
  x: number;
  y: number;
  onComplete: () => void;
}

export const FloatingNumber: React.FC<FloatingNumberProps> = ({ 
  value, 
  type, 
  x, 
  y, 
  onComplete 
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 1500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  const getStyles = () => {
    switch (type) {
      case 'damage':
        return {
          color: '#ef4444',
          text: `-${Math.abs(value)}`,
          emoji: '💥',
          shadow: '0 0 20px #ef4444, 0 0 40px #ef4444'
        };
      case 'heal':
        return {
          color: '#22c55e',
          text: `+${Math.abs(value)}`,
          emoji: '✨',
          shadow: '0 0 20px #22c55e, 0 0 40px #22c55e'
        };
      case 'star-up':
        return {
          color: '#fbbf24',
          text: `+${Math.abs(value)}⭐`,
          emoji: '🌟',
          shadow: '0 0 20px #fbbf24, 0 0 40px #fbbf24'
        };
      case 'star-down':
        return {
          color: '#f97316',
          text: `-${Math.abs(value)}⭐`,
          emoji: '💫',
          shadow: '0 0 20px #f97316, 0 0 40px #f97316'
        };
    }
  };

  const styles = getStyles();

  return createPortal(
    <div
      className="fixed pointer-events-none z-[99999]"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        animation: 'float-damage 1.5s ease-out forwards'
      }}
    >
      <div
        className="font-black text-4xl md:text-5xl"
        style={{
          color: styles.color,
          textShadow: `${styles.shadow}, 3px 3px 0 #000`,
          WebkitTextStroke: '2px #000'
        }}
      >
        {styles.emoji} {styles.text}
      </div>
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
    
    const id = `${Date.now()}-${Math.random()}`;
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
