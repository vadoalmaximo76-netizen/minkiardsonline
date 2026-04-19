import React, { useEffect, useRef } from 'react';

interface GraveyardFlyAnimationProps {
  cardImage: string;
  cardName: string;
  cardType?: string;
  isVisible: boolean;
  onComplete: () => void;
}

export const GraveyardFlyAnimation: React.FC<GraveyardFlyAnimationProps> = ({
  cardImage,
  cardName,
  cardType,
  isVisible,
  onComplete,
}) => {
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => onCompleteRef.current(), 950);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const isPersonaggio = cardType === 'personaggi' || cardType === 'personaggi_speciali';

  return (
    <div
      className="fixed pointer-events-none z-[9990]"
      style={{
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        animation: 'graveyard-card-fly 0.9s cubic-bezier(0.4, 0, 0.8, 1) forwards',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '72px',
          height: '100px',
        }}
      >
        {cardImage ? (
          <img
            src={cardImage}
            alt={cardName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '8px',
              boxShadow: isPersonaggio
                ? '0 0 24px rgba(255,30,30,0.9), 0 0 50px rgba(0,0,0,0.9)'
                : '0 0 14px rgba(200,200,200,0.5), 0 0 30px rgba(0,0,0,0.7)',
              border: isPersonaggio
                ? '2px solid rgba(255,50,50,0.7)'
                : '1px solid rgba(255,255,255,0.25)',
              filter: 'grayscale(0.4) brightness(0.85)',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '8px',
              background: 'rgba(30,20,40,0.9)',
              border: '1px solid rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
            }}
          >
            {isPersonaggio ? '💀' : '🃏'}
          </div>
        )}

        {/* Dark shroud overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '8px',
            background: isPersonaggio
              ? 'linear-gradient(180deg, rgba(255,0,0,0.25) 0%, rgba(0,0,0,0.6) 100%)'
              : 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
          }}
        >
          {isPersonaggio ? '💀' : ''}
        </div>

        {/* Trail streaks */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '8px',
            background: isPersonaggio
              ? 'linear-gradient(45deg, transparent 50%, rgba(255,50,50,0.2) 100%)'
              : 'linear-gradient(45deg, transparent 50%, rgba(150,150,255,0.15) 100%)',
            animation: 'graveyard-trail-glow 0.9s ease-out forwards',
          }}
        />
      </div>
    </div>
  );
};
