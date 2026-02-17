import React, { useEffect, useState, useMemo } from 'react';

interface FusionAnimationProps {
  isVisible: boolean;
  card1Name: string;
  card2Name: string;
  card1Image: string;
  card2Image: string;
  resultName: string;
  resultImage: string;
  playerName: string;
  fusionType: 'fusione' | 'unione_clandestina' | 'ameeco';
  resultPti?: number;
  resultStars?: number;
  onComplete?: () => void;
}

const FUSION_CONFIG = {
  fusione: {
    label: 'FUSIONE',
    color1: '#00BFFF',
    color2: '#1E90FF',
    color3: '#87CEEB',
    glowColor: 'rgba(0, 191, 255, 0.8)',
    bgGradient: 'radial-gradient(ellipse at center, rgba(0, 100, 255, 0.3) 0%, rgba(0, 0, 0, 0.97) 70%)',
    particleColors: ['#00BFFF', '#1E90FF', '#87CEEB', '#00CED1', '#7DF9FF'],
    emoji: '🔗',
    verb: 'SI FONDONO IN'
  },
  unione_clandestina: {
    label: 'UNIONE CLANDESTINA',
    color1: '#FF1493',
    color2: '#C71585',
    color3: '#FF69B4',
    glowColor: 'rgba(255, 20, 147, 0.8)',
    bgGradient: 'radial-gradient(ellipse at center, rgba(199, 21, 133, 0.3) 0%, rgba(0, 0, 0, 0.97) 70%)',
    particleColors: ['#FF1493', '#C71585', '#FF69B4', '#DB7093', '#FFB6C1'],
    emoji: '⚡',
    verb: 'SI UNISCONO IN'
  },
  ameeco: {
    label: 'AMEECO',
    color1: '#FFD700',
    color2: '#FF8C00',
    color3: '#FFA500',
    glowColor: 'rgba(255, 215, 0, 0.8)',
    bgGradient: 'radial-gradient(ellipse at center, rgba(255, 140, 0, 0.3) 0%, rgba(0, 0, 0, 0.97) 70%)',
    particleColors: ['#FFD700', '#FF8C00', '#FFA500', '#FFEC8B', '#FF6347'],
    emoji: '🌀',
    verb: 'SI FONDONO IN'
  }
};

export const FusionAnimation: React.FC<FusionAnimationProps> = ({
  isVisible,
  card1Name,
  card2Name,
  card1Image,
  card2Image,
  resultName,
  resultImage,
  playerName,
  fusionType,
  resultPti,
  resultStars,
  onComplete
}) => {
  const [phase, setPhase] = useState(0);
  const config = FUSION_CONFIG[fusionType] || FUSION_CONFIG.fusione;

  const mergeParticles = useMemo(() =>
    [...Array(50)].map((_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 7,
      delay: Math.random() * 2,
      duration: 1 + Math.random() * 2,
      color: config.particleColors[i % config.particleColors.length]
    })), [fusionType]
  );

  const spiralParticles = useMemo(() =>
    [...Array(30)].map((_, i) => {
      const angle = (i / 30) * Math.PI * 4;
      const radius = 5 + (i / 30) * 20;
      return {
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
        size: 3 + Math.random() * 5,
        delay: i * 0.05,
        color: config.particleColors[i % config.particleColors.length]
      };
    }), [fusionType]
  );

  const dnaHelixParticles = useMemo(() =>
    [...Array(20)].map((_, i) => {
      const t = i / 20;
      return {
        x1: 50 + Math.cos(t * Math.PI * 3) * 12,
        y1: 20 + t * 60,
        x2: 50 - Math.cos(t * Math.PI * 3) * 12,
        y2: 20 + t * 60,
        size: 4 + Math.random() * 4,
        delay: t * 1.5,
        color: config.particleColors[i % config.particleColors.length]
      };
    }), [fusionType]
  );

  useEffect(() => {
    if (!isVisible) {
      setPhase(0);
      return;
    }

    setPhase(1);
    const t2 = setTimeout(() => setPhase(2), 600);
    const t3 = setTimeout(() => setPhase(3), 1600);
    const t4 = setTimeout(() => setPhase(4), 2800);
    const t5 = setTimeout(() => setPhase(5), 4000);
    const t6 = setTimeout(() => setPhase(6), 5200);
    const t7 = setTimeout(() => {
      setPhase(0);
      onComplete?.();
    }, 6500);

    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
      clearTimeout(t7);
    };
  }, [isVisible, onComplete]);

  if (!isVisible || phase === 0) return null;

  return (
    <>
      <style>{`
        @keyframes fusionSlideLeft {
          0% { transform: translateX(-120vw) rotate(-15deg) scale(0.7); opacity: 0; }
          60% { transform: translateX(5vw) rotate(3deg) scale(1.05); opacity: 1; }
          100% { transform: translateX(0) rotate(0deg) scale(1); opacity: 1; }
        }
        @keyframes fusionSlideRight {
          0% { transform: translateX(120vw) rotate(15deg) scale(0.7); opacity: 0; }
          60% { transform: translateX(-5vw) rotate(-3deg) scale(1.05); opacity: 1; }
          100% { transform: translateX(0) rotate(0deg) scale(1); opacity: 1; }
        }
        @keyframes fusionMergeLeft {
          0% { transform: translateX(0) scale(1); opacity: 1; }
          50% { transform: translateX(30%) scale(0.9) rotate(5deg); opacity: 0.8; }
          80% { transform: translateX(45%) scale(0.5) rotate(15deg); opacity: 0.5; filter: brightness(3); }
          100% { transform: translateX(50%) scale(0) rotate(30deg); opacity: 0; filter: brightness(5); }
        }
        @keyframes fusionMergeRight {
          0% { transform: translateX(0) scale(1); opacity: 1; }
          50% { transform: translateX(-30%) scale(0.9) rotate(-5deg); opacity: 0.8; }
          80% { transform: translateX(-45%) scale(0.5) rotate(-15deg); opacity: 0.5; filter: brightness(3); }
          100% { transform: translateX(-50%) scale(0) rotate(-30deg); opacity: 0; filter: brightness(5); }
        }
        @keyframes fusionResultReveal {
          0% { transform: scale(0) rotate(180deg); opacity: 0; filter: brightness(5) blur(10px); }
          40% { transform: scale(1.3) rotate(-10deg); opacity: 0.8; filter: brightness(2) blur(2px); }
          70% { transform: scale(0.95) rotate(3deg); opacity: 1; filter: brightness(1.2) blur(0); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; filter: brightness(1) blur(0); }
        }
        @keyframes fusionSpiralIn {
          0% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        }
        @keyframes fusionEnergyRing {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; border-width: 4px; }
          100% { transform: translate(-50%, -50%) scale(3); opacity: 0; border-width: 1px; }
        }
        @keyframes fusionPulseGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        @keyframes fusionFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fusionLabelSlam {
          0% { transform: scale(3) translateY(-30px); opacity: 0; letter-spacing: 0.8em; }
          50% { transform: scale(1.1) translateY(5px); opacity: 1; letter-spacing: 0.15em; }
          70% { transform: scale(0.95) translateY(-2px); }
          100% { transform: scale(1) translateY(0); opacity: 1; letter-spacing: 0.2em; }
        }
        @keyframes fusionShockwave {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
        }
        @keyframes fusionFlashBurst {
          0% { opacity: 0.9; }
          100% { opacity: 0; }
        }
        @keyframes fusionStatsReveal {
          0% { transform: translateY(20px) scale(0.8); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes fusionAuraSpin {
          0% { transform: scale(1.3) rotate(0deg); }
          100% { transform: scale(1.3) rotate(360deg); }
        }
        @keyframes fusionDnaFloat {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
        }
        @keyframes fusionCardGlow {
          0%, 100% { box-shadow: 0 0 20px var(--glow), 0 0 40px var(--glow); }
          50% { box-shadow: 0 0 40px var(--glow), 0 0 80px var(--glow), 0 0 120px var(--glow); }
        }
        @keyframes fusionNameShine {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes fusionFadeOut {
          0% { opacity: 1; }
          100% { opacity: 0; transform: scale(1.1); }
        }
        @keyframes fusionVerbPulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>

      <div className="fixed inset-0 z-[9999] pointer-events-none" style={{ perspective: '1200px' }}>
        <div
          className="absolute inset-0"
          style={{
            background: config.bgGradient,
            opacity: phase >= 6 ? 0 : 1,
            transition: 'opacity 0.8s ease-out'
          }}
        />

        {phase >= 1 && phase < 4 && mergeParticles.map((p, i) => (
          <div
            key={`mp-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              animation: `fusionSpiralIn ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
              opacity: 0.7
            }}
          />
        ))}

        {phase >= 2 && phase < 4 && dnaHelixParticles.map((p, i) => (
          <React.Fragment key={`dna-${i}`}>
            <div
              className="absolute rounded-full"
              style={{
                left: `${p.x1}%`,
                top: `${p.y1}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: config.color1,
                boxShadow: `0 0 ${p.size * 3}px ${config.color1}`,
                animation: `fusionDnaFloat 1.5s ease-in-out infinite`,
                animationDelay: `${p.delay}s`,
                transform: 'translate(-50%, -50%)'
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                left: `${p.x2}%`,
                top: `${p.y2}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: config.color2,
                boxShadow: `0 0 ${p.size * 3}px ${config.color2}`,
                animation: `fusionDnaFloat 1.5s ease-in-out infinite`,
                animationDelay: `${p.delay + 0.3}s`,
                transform: 'translate(-50%, -50%)'
              }}
            />
          </React.Fragment>
        ))}

        {phase >= 3 && phase < 5 && [0, 0.3, 0.6, 0.9, 1.2].map((delay, i) => (
          <div
            key={`ring-${i}`}
            className="absolute rounded-full"
            style={{
              left: '50%',
              top: '50%',
              width: '100px',
              height: '100px',
              border: `3px solid ${config.color1}`,
              animation: `fusionEnergyRing 1.5s ease-out infinite`,
              animationDelay: `${delay}s`
            }}
          />
        ))}

        {phase === 3 && (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${config.color1}88 0%, transparent 40%)`,
              animation: 'fusionFlashBurst 0.5s ease-out forwards'
            }}
          />
        )}

        {phase >= 3 && phase < 5 && (
          <div
            className="absolute rounded-full"
            style={{
              left: '50%',
              top: '50%',
              width: '200px',
              height: '200px',
              border: `2px solid ${config.color1}`,
              animation: 'fusionShockwave 1s ease-out forwards',
              boxShadow: `0 0 30px ${config.glowColor}`
            }}
          />
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center">

          {phase >= 1 && phase < 3 && (
            <div
              className="text-center mb-4"
              style={{
                animation: 'fusionLabelSlam 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
              }}
            >
              <div
                className="text-xl sm:text-3xl font-black tracking-widest"
                style={{
                  color: config.color1,
                  textShadow: `0 0 20px ${config.glowColor}, 0 0 40px ${config.glowColor}`
                }}
              >
                {config.emoji} {config.label} {config.emoji}
              </div>
            </div>
          )}

          {phase >= 1 && phase < 3 && (
            <div className="flex items-center justify-center gap-6 sm:gap-12">
              <div
                className="relative"
                style={{
                  width: '130px',
                  height: '185px',
                  animation: phase >= 2 ? `fusionMergeLeft 1s ease-in forwards` : `fusionSlideLeft 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
                  ['--glow' as string]: config.glowColor
                }}
              >
                <div
                  className="absolute -inset-2 rounded-xl"
                  style={{
                    background: `conic-gradient(from 0deg, ${config.color1}44, ${config.color2}44, ${config.color3}44, ${config.color1}44)`,
                    animation: 'fusionAuraSpin 2s linear infinite',
                    filter: 'blur(10px)'
                  }}
                />
                {card1Image && (
                  <img
                    src={card1Image}
                    alt={card1Name}
                    className="relative w-full h-full object-contain rounded-lg"
                    style={{
                      animation: 'fusionCardGlow 1.5s ease-in-out infinite',
                      ['--glow' as string]: config.glowColor
                    }}
                  />
                )}
                <div
                  className="absolute -bottom-6 left-0 right-0 text-center text-xs sm:text-sm font-bold truncate"
                  style={{
                    color: config.color1,
                    textShadow: `0 0 8px ${config.glowColor}`
                  }}
                >
                  {card1Name}
                </div>
              </div>

              <div
                className="text-3xl sm:text-5xl font-black"
                style={{
                  color: config.color1,
                  textShadow: `0 0 30px ${config.glowColor}`,
                  animation: 'fusionVerbPulse 1s ease-in-out infinite'
                }}
              >
                +
              </div>

              <div
                className="relative"
                style={{
                  width: '130px',
                  height: '185px',
                  animation: phase >= 2 ? `fusionMergeRight 1s ease-in forwards` : `fusionSlideRight 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
                  ['--glow' as string]: config.glowColor
                }}
              >
                <div
                  className="absolute -inset-2 rounded-xl"
                  style={{
                    background: `conic-gradient(from 180deg, ${config.color2}44, ${config.color3}44, ${config.color1}44, ${config.color2}44)`,
                    animation: 'fusionAuraSpin 2s linear infinite reverse',
                    filter: 'blur(10px)'
                  }}
                />
                {card2Image && (
                  <img
                    src={card2Image}
                    alt={card2Name}
                    className="relative w-full h-full object-contain rounded-lg"
                    style={{
                      animation: 'fusionCardGlow 1.5s ease-in-out infinite',
                      ['--glow' as string]: config.glowColor
                    }}
                  />
                )}
                <div
                  className="absolute -bottom-6 left-0 right-0 text-center text-xs sm:text-sm font-bold truncate"
                  style={{
                    color: config.color2,
                    textShadow: `0 0 8px ${config.glowColor}`
                  }}
                >
                  {card2Name}
                </div>
              </div>
            </div>
          )}

          {phase >= 3 && phase < 5 && (
            <div
              className="text-xl sm:text-3xl font-black tracking-wider"
              style={{
                color: config.color1,
                textShadow: `0 0 25px ${config.glowColor}, 0 0 50px ${config.glowColor}`,
                animation: 'fusionVerbPulse 1s ease-in-out infinite',
                marginBottom: '12px'
              }}
            >
              {config.verb}
            </div>
          )}

          {phase >= 4 && (
            <div
              className="text-center"
              style={{
                animation: phase >= 6 ? 'fusionFadeOut 0.8s ease-out forwards' : 'fusionResultReveal 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
              }}
            >
              <div
                className="relative mx-auto"
                style={{
                  width: '190px',
                  height: '270px',
                  perspective: '1000px',
                  transformStyle: 'preserve-3d'
                }}
              >
                <div
                  className="absolute -inset-3 rounded-xl"
                  style={{
                    background: `conic-gradient(from 0deg, ${config.color1}, ${config.color2}, ${config.color3}, ${config.color1})`,
                    animation: 'fusionAuraSpin 2s linear infinite',
                    filter: 'blur(15px)',
                    opacity: 0.7
                  }}
                />
                {resultImage && (
                  <img
                    src={resultImage}
                    alt={resultName}
                    className="relative w-full h-full object-contain rounded-xl"
                    style={{
                      boxShadow: `0 0 40px ${config.glowColor}, 0 0 80px ${config.glowColor}`,
                      animation: 'fusionFloat 2s ease-in-out infinite',
                      transformStyle: 'preserve-3d'
                    }}
                  />
                )}
                {phase >= 5 && (
                  <div
                    className="absolute -inset-5"
                    style={{
                      border: `2px solid ${config.color1}`,
                      borderRadius: '16px',
                      animation: 'fusionPulseGlow 1.5s ease-in-out infinite',
                      boxShadow: `0 0 25px ${config.glowColor}`
                    }}
                  />
                )}
              </div>

              <div
                className="text-2xl sm:text-4xl font-black mt-5 tracking-wider"
                style={{
                  background: `linear-gradient(135deg, ${config.color1}, #fff, ${config.color2})`,
                  backgroundSize: '200% 200%',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'fusionNameShine 2s ease-in-out infinite',
                  filter: `drop-shadow(0 0 12px ${config.glowColor})`
                }}
              >
                {resultName}
              </div>

              {phase >= 5 && resultPti != null && resultStars != null && (
                <div
                  className="flex items-center justify-center gap-4 mt-3"
                  style={{ animation: 'fusionStatsReveal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
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
                    PTI: {resultPti}
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
                    {'⭐'.repeat(Math.min(resultStars, 10))}
                  </span>
                </div>
              )}
            </div>
          )}

          {phase >= 4 && phase < 6 && (
            <div
              className="text-sm sm:text-base font-semibold mt-3"
              style={{
                color: '#94a3b8',
                animation: 'fusionStatsReveal 0.5s ease-out forwards'
              }}
            >
              {playerName}
            </div>
          )}
        </div>

        {phase >= 4 && phase < 6 && spiralParticles.map((sp, i) => (
          <div
            key={`sp-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${sp.x}%`,
              top: `${sp.y}%`,
              width: `${sp.size}px`,
              height: `${sp.size}px`,
              backgroundColor: sp.color,
              boxShadow: `0 0 ${sp.size * 3}px ${sp.color}`,
              animation: `fusionPulseGlow 1.2s ease-in-out infinite`,
              animationDelay: `${sp.delay}s`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        ))}

        {phase >= 4 && phase < 6 && (
          <>
            <div
              className="absolute left-0 right-0 top-0"
              style={{
                height: '3px',
                background: `linear-gradient(90deg, transparent, ${config.color1}, ${config.color2}, ${config.color1}, transparent)`,
                boxShadow: `0 0 15px ${config.glowColor}`
              }}
            />
            <div
              className="absolute left-0 right-0 bottom-0"
              style={{
                height: '3px',
                background: `linear-gradient(90deg, transparent, ${config.color1}, ${config.color2}, ${config.color1}, transparent)`,
                boxShadow: `0 0 15px ${config.glowColor}`
              }}
            />
          </>
        )}
      </div>
    </>
  );
};
