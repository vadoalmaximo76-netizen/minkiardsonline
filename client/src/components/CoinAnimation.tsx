import React, { useEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';

interface CoinAnimationProps {
  isActive: boolean;
  pointsAwarded: number;
  onComplete?: () => void;
  targetPosition?: { x: number; y: number };
}

export const CoinAnimation: React.FC<CoinAnimationProps> = ({
  isActive,
  pointsAwarded,
  onComplete,
  targetPosition = { x: window.innerWidth / 2, y: 80 },
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const subTextRef = useRef<HTMLDivElement>(null);
  const bgGlowRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctx = useRef<gsap.Context | null>(null);

  const playCoinSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/success.mp3');
      }
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 0.4;
      audioRef.current.play().catch(() => {});
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!isActive || pointsAwarded <= 0) return;
    const container = containerRef.current;
    if (!container) return;

    if (ctx.current) ctx.current.revert();

    const coinCount = Math.min(Math.max(5, Math.floor(pointsAwarded / 10)), 20);
    const tgt = targetPosition;

    const coinEls: HTMLDivElement[] = [];
    for (let i = 0; i < coinCount; i++) {
      const size = 30 + Math.floor(Math.random() * 20);
      const coin = document.createElement('div');
      coin.style.cssText = `
        position: absolute; left: 0; top: 0;
        width: ${size}px; height: ${size}px;
        border-radius: 50%; opacity: 0; pointer-events: none;
        background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%);
        box-shadow: 0 0 20px rgba(255,215,0,0.8), inset 0 -3px 6px rgba(0,0,0,0.3), inset 0 3px 6px rgba(255,255,255,0.5);
      `;
      const inner = document.createElement('div');
      inner.style.cssText = `
        position: absolute; inset: 6px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-weight: 900; color: #78350f; font-size: ${size * 0.4}px;
        background: linear-gradient(135deg, #FFEC8B 0%, #FFD700 100%);
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      `;
      inner.textContent = 'R';
      coin.appendChild(inner);
      container.appendChild(coin);
      coinEls.push(coin);
    }

    const particleEls: HTMLDivElement[] = [];
    const colors = ['#FFD700', '#FFA500', '#FFFF00', '#FFE4B5', '#FFFFFF'];
    for (let i = 0; i < 30; i++) {
      const size = 3 + Math.random() * 8;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const p = document.createElement('div');
      p.style.cssText = `
        position: absolute; left: ${tgt.x}px; top: ${tgt.y}px;
        width: ${size}px; height: ${size}px;
        border-radius: 50%; opacity: 0; pointer-events: none;
        background: ${color};
        box-shadow: 0 0 ${size * 2}px ${color};
        transform: translate(-50%, -50%);
      `;
      container.appendChild(p);
      particleEls.push(p);
    }

    ctx.current = gsap.context(() => {
      playCoinSound();

      coinEls.forEach((coin, i) => {
        const startX = Math.random() * window.innerWidth * 0.6 + window.innerWidth * 0.2;
        const startY = window.innerHeight + 50;
        const rotation = Math.random() * 360;
        const midX = (startX + tgt.x) / 2 + (Math.random() - 0.5) * 60;
        const midY = Math.min(startY, tgt.y) - 120 - Math.random() * 80;
        const delay = i * 0.08;

        gsap.set(coin, { x: startX, y: startY, scale: 0, rotation, opacity: 0 });

        const coinTl = gsap.timeline({ delay });
        coinTl
          .to(coin, {
            x: midX, y: midY,
            scale: 1.2, rotation: rotation + 360, opacity: 1,
            duration: 0.55, ease: 'power2.out',
          })
          .to(coin, {
            x: tgt.x, y: tgt.y,
            scale: 0.7, rotation: rotation + 720, opacity: 0,
            duration: 0.55, ease: 'power3.in',
          });

        if (i === 1 || i === 4) {
          coinTl.call(() => playCoinSound(), [], 0.4);
        }
      });

      particleEls.forEach((p, i) => {
        const px = tgt.x + (Math.random() - 0.5) * 200;
        const py = tgt.y + (Math.random() - 0.5) * 100;
        const pDelay = 0.8 + Math.random() * 0.5;
        gsap.fromTo(p,
          { scale: 0, opacity: 0 },
          { x: px, y: py, scale: 1.5, opacity: 1, duration: 0.5, delay: pDelay, ease: 'power2.out' }
        );
        gsap.to(p, { scale: 0, opacity: 0, duration: 0.5, delay: pDelay + 0.5, ease: 'power2.in' });
      });

      if (bgGlowRef.current) {
        gsap.fromTo(bgGlowRef.current,
          { opacity: 0 },
          { opacity: 0.3, duration: 0.8, delay: 0.5, ease: 'power2.out',
            yoyo: true, repeat: 1, onComplete: () => { if (bgGlowRef.current) bgGlowRef.current.style.opacity = '0'; } }
        );
      }

      if (textRef.current && subTextRef.current) {
        const text = textRef.current;
        const sub = subTextRef.current;
        gsap.fromTo(text,
          { scale: 0, opacity: 0, y: tgt.y + 50 },
          { scale: 1.3, opacity: 1, y: tgt.y, duration: 0.3, delay: 0.6, ease: 'back.out(2)' }
        );
        gsap.to(text, { scale: 1.0, duration: 0.15, delay: 0.9 });
        gsap.to(text, { y: tgt.y - 20, opacity: 0, duration: 0.8, delay: 1.8, ease: 'power2.in' });

        gsap.fromTo(sub,
          { opacity: 0, scale: 0.8 },
          { opacity: 1, scale: 1.1, duration: 0.3, delay: 0.75, ease: 'elastic.out(1.5, 0.5)' }
        );
        gsap.to(sub, {
          scale: 1.0,
          duration: 0.4,
          delay: 1.05,
          repeat: 3,
          yoyo: true,
          ease: 'sine.inOut',
        });
        gsap.to(sub, { opacity: 0, duration: 0.4, delay: 1.8 });
      }

      gsap.delayedCall(3, () => {
        coinEls.forEach(el => el.remove());
        particleEls.forEach(el => el.remove());
        onComplete?.();
      });
    });

    return () => {
      if (ctx.current) {
        ctx.current.revert();
        ctx.current = null;
      }
      coinEls.forEach(el => { try { el.remove(); } catch (e) {} });
      particleEls.forEach(el => { try { el.remove(); } catch (e) {} });
    };
  }, [isActive, pointsAwarded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isActive) return null;

  const tgt = targetPosition;

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-[9999]">
      <div
        ref={bgGlowRef}
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, rgba(255,215,0,0.3) 0%, transparent 70%)',
          opacity: 0,
        }}
      />

      <div
        ref={textRef}
        className="absolute pointer-events-none"
        style={{ left: '50%', top: tgt.y, transform: 'translate(-50%, 0)', opacity: 0, textAlign: 'center' }}
      >
        <div
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.75rem)',
            fontWeight: 900,
            background: 'linear-gradient(180deg, #FFD700 0%, #FF8C00 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 10px rgba(255,165,0,0.8))',
          }}
        >
          +{pointsAwarded} PR
        </div>
        <div
          ref={subTextRef}
          style={{
            opacity: 0,
            color: '#fde047',
            fontSize: 'clamp(0.9rem, 2vw, 1.25rem)',
            fontWeight: 700,
            marginTop: 4,
            textShadow: '0 0 10px rgba(255,215,0,0.8)',
          }}
        >
          Punti Rankiard!
        </div>
      </div>
    </div>
  );
};

export default CoinAnimation;
