import React, { useEffect, useRef, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';

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
  onComplete,
}) => {
  const isCritical = type === 'damage' && value >= 200;
  const isHeavy = type === 'damage' && value >= 50;

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const offsetX = useMemo(() => {
    const seed = value * 7 + x * 3;
    return Math.sin(seed) * 36 - 18;
  }, [value, x]);

  const DURATION = isCritical ? 1.8 : isHeavy ? 1.4 : 1.1;

  const getConfig = () => {
    switch (type) {
      case 'damage':
        return {
          color: isCritical ? '#ff2020' : isHeavy ? '#ff6020' : '#ef4444',
          text: `-${Math.abs(value)}`,
          emoji: isCritical ? '💀' : isHeavy ? '💥' : '🩸',
          glowColor: isCritical ? '#ff0000' : '#ef4444',
          fontSize: isCritical
            ? _isMobile ? '3.2rem' : '5rem'
            : isHeavy
            ? _isMobile ? '2.6rem' : '4rem'
            : _isMobile ? '2rem' : '3rem',
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

  const innerRef = useRef<HTMLDivElement>(null);
  const criticalRef = useRef<HTMLDivElement>(null);
  const criticalFlashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: () => onCompleteRef.current() });

      tl.fromTo(
        el,
        { opacity: 0, y: 0, scale: isCritical ? 2.0 : isHeavy ? 1.4 : 1.1 },
        {
          opacity: 1,
          scale: 1.0,
          duration: 0.18,
          ease: 'elastic.out(1.6, 0.5)',
        }
      )
        .to(
          el,
          {
            y: riseAmount,
            duration: DURATION - 0.3,
            ease: 'power2.out',
          },
          0.06
        )
        .to(
          el,
          {
            opacity: 0,
            scale: 0.75,
            duration: 0.28,
            ease: 'back.in(1.5)',
          },
          `>-0.28`
        );

      if (isCritical && criticalRef.current) {
        gsap.fromTo(
          criticalRef.current,
          { opacity: 0, scale: 0.3 },
          {
            opacity: 1,
            scale: 1.3,
            duration: 0.25,
            ease: 'elastic.out(2, 0.4)',
            delay: 0.12,
          }
        );
        gsap.to(criticalRef.current, { scale: 1.0, duration: 0.1, delay: 0.37 });
        gsap.to(criticalRef.current, {
          opacity: 0,
          scale: 0.7,
          duration: 0.28,
          ease: 'back.in(1.5)',
          delay: DURATION - 0.38,
        });
      }

      if (isCritical && criticalFlashRef.current) {
        gsap.timeline()
          .fromTo(
            criticalFlashRef.current,
            { opacity: 0 },
            { opacity: 0.7, duration: 0.06, ease: 'none' }
          )
          .to(criticalFlashRef.current, { opacity: 0, duration: 0.22, ease: 'power2.out' });

        // Screen shake via document.body transform
        gsap.timeline({ delay: 0.04 })
          .to(document.body, { x: -7, y: 3, duration: 0.05, ease: 'none' })
          .to(document.body, { x: 7, y: -3, duration: 0.05, ease: 'none' })
          .to(document.body, { x: -5, y: 2, duration: 0.05, ease: 'none' })
          .to(document.body, { x: 5, y: -2, duration: 0.05, ease: 'none' })
          .to(document.body, { x: -3, y: 1, duration: 0.05, ease: 'none' })
          .to(document.body, { x: 0, y: 0, duration: 0.05, ease: 'none' })
          .call(() => gsap.set(document.body, { clearProps: 'transform' }));
      }
    });

    return () => ctx.revert();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <>
      {isCritical && (
        <div
          ref={criticalFlashRef}
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 99998, background: 'rgba(255,30,30,0.35)', opacity: 0 }}
        />
      )}
      <div
        className="fixed pointer-events-none z-[99999]"
        style={{ left: x + offsetX, top: y, transform: 'translate(-50%, -50%)' }}
      >
        <div ref={innerRef} style={{ opacity: 0, transformOrigin: '50% 50%' }}>
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
            <div
              ref={criticalRef}
              className="font-black text-center select-none whitespace-nowrap"
              style={{
                opacity: 0,
                fontSize: _isMobile ? '0.9rem' : '1.4rem',
                color: '#ffdd00',
                textShadow: '0 0 20px #ff0, 0 0 40px #f90, 2px 2px 0 #000',
                WebkitTextStroke: '1px #000',
                letterSpacing: '4px',
                marginTop: '4px',
                transformOrigin: '50% 50%',
              }}
            >
              CRITICO!
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export const useFloatingNumbers = () => {
  const [numbers, setNumbers] = useState<
    Array<{
      id: string;
      value: number;
      type: 'damage' | 'heal' | 'star-up' | 'star-down';
      x: number;
      y: number;
    }>
  >([]);

  const addNumber = (
    value: number,
    type: 'damage' | 'heal' | 'star-up' | 'star-down',
    element?: HTMLElement
  ) => {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 3;
    const id = `fn-${Date.now()}-${++_floatingCounter}`;
    setNumbers((prev) => [...prev, { id, value, type, x, y }]);
  };

  const removeNumber = (id: string) => {
    setNumbers((prev) => prev.filter((n) => n.id !== id));
  };

  const FloatingNumbersContainer = () => (
    <>
      {numbers.map((num) => (
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
