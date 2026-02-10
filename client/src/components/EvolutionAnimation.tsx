import React, { useEffect, useState, useMemo } from 'react';

interface EvolutionAnimationProps {
  isVisible: boolean;
  type: 'evolution' | 'transformation' | 'taroccata';
  oldName: string;
  newName: string;
  oldImage: string;
  newImage: string;
  playerName: string;
  pti?: number;
  stars?: number;
  onComplete?: () => void;
}

const TYPE_CONFIG = {
  evolution: {
    label: 'EVOLUZIONE',
    color1: '#FFD700',
    color2: '#FFA500',
    color3: '#FF8C00',
    glowColor: 'rgba(255, 215, 0, 0.8)',
    bgGradient: 'radial-gradient(ellipse at center, rgba(255, 165, 0, 0.3) 0%, rgba(0, 0, 0, 0.95) 70%)',
    particleColors: ['#FFD700', '#FFA500', '#FFEC8B', '#FF6347', '#FFE4B5'],
    emoji: '🌟',
    verb: 'SI È EVOLUTO IN'
  },
  transformation: {
    label: 'TRASFORMAZIONE',
    color1: '#8B5CF6',
    color2: '#A855F7',
    color3: '#C084FC',
    glowColor: 'rgba(139, 92, 246, 0.8)',
    bgGradient: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.3) 0%, rgba(0, 0, 0, 0.95) 70%)',
    particleColors: ['#8B5CF6', '#A855F7', '#C084FC', '#E879F9', '#7C3AED'],
    emoji: '🦋',
    verb: 'SI È TRASFORMATO IN'
  },
  taroccata: {
    label: 'TAROCCATA',
    color1: '#EF4444',
    color2: '#DC2626',
    color3: '#F87171',
    glowColor: 'rgba(239, 68, 68, 0.8)',
    bgGradient: 'radial-gradient(ellipse at center, rgba(239, 68, 68, 0.3) 0%, rgba(0, 0, 0, 0.95) 70%)',
    particleColors: ['#EF4444', '#DC2626', '#F87171', '#991B1B', '#FCA5A5'],
    emoji: '🃏',
    verb: 'SI È TAROCCATO IN'
  }
};

export const EvolutionAnimation: React.FC<EvolutionAnimationProps> = ({
  isVisible,
  type,
  oldName,
  newName,
  oldImage,
  newImage,
  playerName,
  pti,
  stars,
  onComplete
}) => {
  const [phase, setPhase] = useState(0);
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.evolution;

  const energyParticles = useMemo(() =>
    [...Array(40)].map((_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 3 + Math.random() * 8,
      delay: Math.random() * 2,
      duration: 1.5 + Math.random() * 2,
      color: config.particleColors[i % config.particleColors.length]
    })), [type]
  );

  const lightningBolts = useMemo(() =>
    [...Array(8)].map((_, i) => ({
      angle: (i / 8) * 360,
      length: 80 + Math.random() * 120,
      delay: Math.random() * 1.5,
      width: 2 + Math.random() * 3
    })), []
  );

  const ringParticles = useMemo(() =>
    [...Array(24)].map((_, i) => ({
      angle: (i / 24) * 360,
      distance: 100 + Math.random() * 60,
      size: 4 + Math.random() * 6,
      delay: i * 0.08,
      color: config.particleColors[i % config.particleColors.length]
    })), [type]
  );

  useEffect(() => {
    if (!isVisible) {
      setPhase(0);
      return;
    }

    setPhase(1);
    const t2 = setTimeout(() => setPhase(2), 800);
    const t3 = setTimeout(() => setPhase(3), 1800);
    const t4 = setTimeout(() => setPhase(4), 2800);
    const t5 = setTimeout(() => setPhase(5), 4200);
    const t6 = setTimeout(() => {
      setPhase(0);
      onComplete?.();
    }, 5500);

    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
    };
  }, [isVisible, onComplete]);

  if (!isVisible || phase === 0) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none" style={{ perspective: '1000px' }}>
      <div
        className="absolute inset-0"
        style={{
          background: config.bgGradient,
          animation: 'evoBackdropIn 0.6s ease-out forwards',
          opacity: phase >= 5 ? 0 : 1,
          transition: 'opacity 0.8s ease-out'
        }}
      />

      {phase >= 1 && phase < 5 && energyParticles.map((p, i) => (
        <div
          key={`ep-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}, 0 0 ${p.size * 4}px ${p.color}`,
            animation: `evoParticleFloat ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
            opacity: 0.8
          }}
        />
      ))}

      {phase >= 2 && phase < 5 && lightningBolts.map((bolt, i) => (
        <div
          key={`lb-${i}`}
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            width: `${bolt.width}px`,
            height: `${bolt.length}px`,
            background: `linear-gradient(to bottom, ${config.color1}, transparent)`,
            transform: `rotate(${bolt.angle}deg) translateY(-50%)`,
            transformOrigin: 'top center',
            animation: `evoLightning 0.3s ease-out infinite`,
            animationDelay: `${bolt.delay}s`,
            opacity: 0.7,
            filter: `blur(1px)`,
            boxShadow: `0 0 10px ${config.glowColor}`
          }}
        />
      ))}

      {phase >= 3 && phase < 5 && ringParticles.map((rp, i) => {
        const rad = (rp.angle * Math.PI) / 180;
        const x = 50 + Math.cos(rad) * (rp.distance / 5);
        const y = 50 + Math.sin(rad) * (rp.distance / 5);
        return (
          <div
            key={`rp-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${rp.size}px`,
              height: `${rp.size}px`,
              backgroundColor: rp.color,
              boxShadow: `0 0 ${rp.size * 3}px ${rp.color}`,
              animation: `evoRingPulse 1.5s ease-in-out infinite`,
              animationDelay: `${rp.delay}s`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        );
      })}

      {phase >= 2 && phase < 4 && (
        <div
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            border: `3px solid ${config.color1}`,
            boxShadow: `0 0 40px ${config.glowColor}, inset 0 0 40px ${config.glowColor}`,
            animation: 'evoShockwave 1.5s ease-out forwards'
          }}
        />
      )}

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        {phase >= 1 && (
          <div
            className="text-center mb-2"
            style={{
              animation: phase >= 3 ? 'evoFadeUp 0.5s ease-out forwards' : 'evoSlideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              opacity: phase >= 3 ? 0 : 1
            }}
          >
            <div
              className="text-xl sm:text-2xl font-black tracking-widest mb-2"
              style={{ color: config.color1, textShadow: `0 0 20px ${config.glowColor}` }}
            >
              {config.emoji} {config.label} {config.emoji}
            </div>

            {oldImage && (
              <div className="relative mx-auto" style={{ width: '140px', height: '200px' }}>
                <img
                  src={oldImage}
                  alt={oldName}
                  className="w-full h-full object-contain rounded-lg"
                  style={{
                    filter: phase >= 2 ? 'brightness(2) saturate(0.3)' : 'none',
                    transition: 'filter 0.5s ease',
                    boxShadow: `0 0 30px ${config.glowColor}`
                  }}
                />
                {phase >= 2 && (
                  <div
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background: `radial-gradient(circle, ${config.color1}88 0%, transparent 70%)`,
                      animation: 'evoPulseGlow 0.5s ease-in-out infinite'
                    }}
                  />
                )}
              </div>
            )}

            <div
              className="text-lg sm:text-xl font-bold mt-2"
              style={{
                color: '#fff',
                textShadow: `0 0 10px ${config.glowColor}`
              }}
            >
              {oldName}
            </div>
          </div>
        )}

        {phase >= 2 && phase < 4 && (
          <div
            className="text-2xl sm:text-4xl font-black"
            style={{
              color: config.color1,
              textShadow: `0 0 30px ${config.glowColor}, 0 0 60px ${config.glowColor}`,
              animation: 'evoArrowPulse 0.8s ease-in-out infinite',
              letterSpacing: '0.2em'
            }}
          >
            {config.verb}
          </div>
        )}

        {phase >= 3 && (
          <div
            className="text-center"
            style={{
              animation: phase >= 5
                ? 'evoFadeOut 0.8s ease-out forwards'
                : 'evoNewCharReveal 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            }}
          >
            {newImage && (
              <div className="relative mx-auto" style={{ width: '180px', height: '260px' }}>
                <div
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: `conic-gradient(from 0deg, ${config.color1}, ${config.color2}, ${config.color3}, ${config.color1})`,
                    animation: 'evoAuraSpin 2s linear infinite',
                    filter: 'blur(15px)',
                    opacity: 0.6,
                    transform: 'scale(1.3)'
                  }}
                />
                <img
                  src={newImage}
                  alt={newName}
                  className="relative w-full h-full object-contain rounded-xl"
                  style={{
                    boxShadow: `0 0 40px ${config.glowColor}, 0 0 80px ${config.glowColor}`,
                    animation: 'evoCardFloat 2s ease-in-out infinite'
                  }}
                />
                {phase >= 4 && (
                  <div
                    className="absolute -inset-4"
                    style={{
                      border: `2px solid ${config.color1}`,
                      borderRadius: '16px',
                      animation: 'evoOuterRing 1s ease-out forwards',
                      boxShadow: `0 0 20px ${config.glowColor}`
                    }}
                  />
                )}
              </div>
            )}

            <div
              className="text-2xl sm:text-4xl font-black mt-4 tracking-wider"
              style={{
                background: `linear-gradient(135deg, ${config.color1}, #fff, ${config.color2})`,
                backgroundSize: '200% 200%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'evoNameShine 2s ease-in-out infinite',
                textShadow: 'none',
                filter: `drop-shadow(0 0 10px ${config.glowColor})`
              }}
            >
              {newName}
            </div>

            {phase >= 4 && pti != null && stars != null && (
              <div
                className="flex items-center justify-center gap-4 mt-2"
                style={{ animation: 'evoStatsReveal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
              >
                <span
                  className="text-lg sm:text-xl font-bold px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: `${config.color1}33`,
                    border: `1px solid ${config.color1}`,
                    color: config.color1,
                    textShadow: `0 0 10px ${config.glowColor}`
                  }}
                >
                  PTI: {pti}
                </span>
                <span
                  className="text-lg sm:text-xl font-bold px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: `${config.color2}33`,
                    border: `1px solid ${config.color2}`,
                    color: config.color2,
                    textShadow: `0 0 10px ${config.glowColor}`
                  }}
                >
                  {'⭐'.repeat(Math.min(stars, 10))}
                </span>
              </div>
            )}
          </div>
        )}

        {phase >= 3 && phase < 5 && (
          <div
            className="text-sm sm:text-base font-semibold mt-2"
            style={{
              color: '#94a3b8',
              animation: 'evoFadeInSlow 1s ease-out forwards'
            }}
          >
            {playerName}
          </div>
        )}
      </div>

      {phase >= 3 && phase < 5 && (
        <>
          <div
            className="absolute left-0 right-0 top-0"
            style={{
              height: '4px',
              background: `linear-gradient(90deg, transparent, ${config.color1}, ${config.color2}, ${config.color1}, transparent)`,
              animation: 'evoScanline 1s ease-out forwards',
              boxShadow: `0 0 20px ${config.glowColor}`
            }}
          />
          <div
            className="absolute left-0 right-0 bottom-0"
            style={{
              height: '4px',
              background: `linear-gradient(90deg, transparent, ${config.color1}, ${config.color2}, ${config.color1}, transparent)`,
              animation: 'evoScanline 1s ease-out forwards',
              boxShadow: `0 0 20px ${config.glowColor}`
            }}
          />
        </>
      )}

      {phase >= 2 && phase < 4 && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${config.color1}22 0%, transparent 50%)`,
            animation: 'evoFlashBurst 0.3s ease-out'
          }}
        />
      )}
    </div>
  );
};
