import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface KOBannerProps {
  cardName: string;
  cardOwner: string;
  cardImage?: string;
  eliminationMode?: boolean;
  isCurrentPlayer?: boolean;
  onComplete: () => void;
}

export function KOBanner({
  cardName,
  cardOwner,
  cardImage,
  eliminationMode = false,
  isCurrentPlayer = false,
  onComplete,
}: KOBannerProps) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const centreRef = useRef<HTMLDivElement>(null);
  const koTextRef = useRef<HTMLDivElement>(null);

  const holdMs = eliminationMode ? 1800 : 1900;
  const totalMs = eliminationMode ? 3000 : 2700;

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const centre = centreRef.current;
    const koText = koTextRef.current;
    if (!wrapper || !centre) return;

    const ctx = gsap.context(() => {
      gsap.set(wrapper, { opacity: 0 });
      gsap.set(centre, { scale: eliminationMode ? 1.6 : 0.7, y: eliminationMode ? -30 : -60, opacity: 0 });

      // Pulsing glow runs independently - NOT added to the master timeline
      // so it never makes the master timeline non-terminating
      let pulseAnim: gsap.core.Tween | null = null;
      if (koText) {
        pulseAnim = gsap.to(koText, {
          textShadow: eliminationMode
            ? `0 0 70px ${isCurrentPlayer ? 'rgba(255,37,80,0.9)' : 'rgba(255,144,0,0.9)'}, 0 0 120px ${isCurrentPlayer ? 'rgba(255,37,80,0.5)' : 'rgba(255,144,0,0.5)'}, 0 6px 0 #5a0010`
            : '0 0 50px rgba(255,37,80,1), 0 0 90px rgba(255,37,80,0.8), 0 4px 0 #7a0020',
          duration: 0.8,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: eliminationMode ? 0.5 : 0.3,
        });
      }

      const tl = gsap.timeline({
        onComplete: () => onCompleteRef.current(),
      });

      tl.to(wrapper, {
        opacity: 1,
        duration: eliminationMode ? 0.22 : 0.2,
        ease: 'power2.out',
        delay: eliminationMode ? 0.18 : 0,
      })
        .to(centre, {
          scale: 1,
          y: 0,
          opacity: 1,
          duration: 0.32,
          ease: 'back.out(1.56)',
        }, eliminationMode ? 0.3 : 0)
        .to(centre, {
          scale: 1,
          duration: holdMs / 1000 - 0.32 - (eliminationMode ? 0.3 : 0),
          ease: 'none',
        })
        // Kill the pulse before the outro so the outro can resolve cleanly
        .call(() => { if (pulseAnim) pulseAnim.kill(); })
        .to(centre, {
          scale: eliminationMode ? 0.92 : 1.05,
          y: eliminationMode ? 20 : 40,
          opacity: 0,
          duration: eliminationMode ? 0.55 : 0.4,
          ease: 'power2.in',
        })
        .to(wrapper, {
          opacity: 0,
          duration: eliminationMode ? 0.55 : 0.3,
          ease: 'power2.out',
        }, '<');

      const remaining = totalMs / 1000 - tl.duration();
      if (remaining > 0) tl.to({}, { duration: remaining });
    });

    return () => ctx.revert();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (eliminationMode) {
    const accentColor = isCurrentPlayer ? '#ff2550' : '#ff9000';
    const glowColor = isCurrentPlayer ? 'rgba(255,37,80,0.9)' : 'rgba(255,144,0,0.9)';

    return (
      <div
        ref={wrapperRef}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          opacity: 0,
        }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.09) 0px, rgba(0,0,0,0.09) 1px, transparent 1px, transparent 3px)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
        }} />

        <div
          ref={centreRef}
          style={{
            position: 'relative', zIndex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            opacity: 0,
          }}
        >
          <div style={{ position: 'relative', lineHeight: 1 }}>
            {[{ top: 8, left: 8, color: 'rgba(255,0,80,0.4)' }, { top: 4, left: 4, color: 'rgba(255,120,0,0.4)' }].map((s, i) => (
              <div key={i} style={{
                position: 'absolute', top: s.top, left: s.left,
                fontSize: 128, fontWeight: 900, lineHeight: 1,
                fontFamily: '"Impact","Arial Black",sans-serif', letterSpacing: '-0.02em',
                color: 'transparent', WebkitTextStroke: `3px ${s.color}`,
                userSelect: 'none',
              }}>K.O.</div>
            ))}
            <div
              ref={koTextRef}
              style={{
                fontSize: 128, fontWeight: 900, lineHeight: 1,
                fontFamily: '"Impact","Arial Black",sans-serif', letterSpacing: '-0.02em',
                color: accentColor, WebkitTextStroke: '2px #fff',
                textShadow: `0 0 40px ${glowColor}, 0 0 80px ${glowColor.replace('0.9', '0.5')}, 0 6px 0 #5a0010`,
                userSelect: 'none',
              }}
            >K.O.</div>
          </div>

          <div style={{
            width: 280, height: 2,
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
            boxShadow: `0 0 12px ${accentColor}`,
          }} />

          <div style={{
            fontSize: 36, fontWeight: 900, color: 'white', letterSpacing: '0.06em',
            fontFamily: '"Impact","Arial Black",sans-serif',
            textShadow: `0 0 20px ${glowColor}, 0 3px 0 rgba(0,0,0,0.8)`,
            WebkitTextStroke: '1px rgba(255,255,255,0.3)',
            userSelect: 'none',
            textTransform: 'uppercase',
          }}>
            {cardOwner}
          </div>

          <div style={{
            fontSize: 15, fontWeight: 900, letterSpacing: '0.3em', color: accentColor,
            fontFamily: '"Arial","sans-serif"',
            textShadow: `0 0 10px ${glowColor}`,
            textTransform: 'uppercase',
            userSelect: 'none',
            marginTop: -4,
          }}>
            {isCurrentPlayer ? '⚠ SEI STATO ELIMINATO' : 'ELIMINATO DALLA PARTITA'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity: 0,
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 72%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.07) 0px, rgba(0,0,0,0.07) 1px, transparent 1px, transparent 3px)',
        pointerEvents: 'none', mixBlendMode: 'multiply',
      }} />

      <div
        ref={centreRef}
        style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          opacity: 0,
        }}
      >
        <div style={{ position: 'relative' }}>
          {[{ top: 6, left: 6, color: 'rgba(255,0,80,0.5)' }, { top: 3, left: 3, color: 'rgba(255,120,0,0.5)' }].map((s, i) => (
            <div key={i} style={{
              position: 'absolute', top: s.top, left: s.left,
              fontSize: 96, fontWeight: 900, lineHeight: 1,
              fontFamily: '"Impact","Arial Black",sans-serif', letterSpacing: '-0.02em',
              color: 'transparent', WebkitTextStroke: `3px ${s.color}`,
              userSelect: 'none',
            }}>K.O.</div>
          ))}
          <div
            ref={koTextRef}
            style={{
              fontSize: 96, fontWeight: 900, lineHeight: 1,
              fontFamily: '"Impact","Arial Black",sans-serif', letterSpacing: '-0.02em',
              color: '#ff2550', WebkitTextStroke: '2px #fff',
              textShadow: '0 0 30px rgba(255,37,80,0.9), 0 0 60px rgba(255,37,80,0.5), 0 4px 0 #7a0020',
              userSelect: 'none',
            }}
          >K.O.</div>
        </div>

        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(0,0,0,0.75)', border: '1.5px solid rgba(255,37,80,0.5)',
          borderRadius: 12, padding: '8px 16px 8px 10px',
          boxShadow: '0 0 20px rgba(255,37,80,0.3)', backdropFilter: 'blur(8px)', maxWidth: 300,
        }}>
          {cardImage && (
            <div style={{
              width: 42, height: 42, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
              border: '2px solid rgba(255,37,80,0.6)', boxShadow: '0 0 10px rgba(255,37,80,0.4)',
            }}>
              <img src={cardImage} alt={cardName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 16, fontWeight: 900, color: 'white',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              fontFamily: '"Impact","Arial Black",sans-serif', letterSpacing: '0.03em',
              textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            }}>{cardName}</div>
            <div style={{
              fontSize: 11, color: 'rgba(255,180,180,0.85)', fontWeight: 600,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>di <span style={{ color: '#ff8aaa', fontWeight: 900 }}>{cardOwner}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
