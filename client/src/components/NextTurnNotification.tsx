import React, { useEffect, useState, useMemo } from "react";
import { X, Swords, Crown, Zap, Shield } from "lucide-react";

const _isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

interface NextTurnNotificationProps {
  isVisible: boolean;
  nextPlayer: string;
  onClose: () => void;
  isMyTurn?: boolean;
}

export const NextTurnNotification: React.FC<NextTurnNotificationProps> = ({
  isVisible,
  nextPlayer,
  onClose,
  isMyTurn = false,
}) => {
  const [phase, setPhase] = useState<"enter" | "show" | "exit" | "hidden">("hidden");

  const sparks = useMemo(() =>
    [...Array(12)].map((_, i) => ({
      angle: (i / 12) * 360,
      delay: (i * 37 + 11) % 100 / 100,
      size: 3 + (i * 13 % 5),
      speed: 1.5 + (i * 17 % 30) / 10,
    })), []
  );

  const energyLines = useMemo(() =>
    [...Array(8)].map((_, i) => ({
      rotation: (i * 45),
      delay: (i * 23 % 80) / 100,
      width: 40 + (i * 31 % 60),
    })), []
  );

  useEffect(() => {
    if (isVisible) {
      setPhase("enter");
      const showTimer = setTimeout(() => setPhase("show"), 100);
      const exitTimer = setTimeout(() => setPhase("exit"), 2500);
      const closeTimer = setTimeout(() => {
        setPhase("hidden");
        onClose();
      }, 3000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(exitTimer);
        clearTimeout(closeTimer);
      };
    } else {
      setPhase("hidden");
    }
  }, [isVisible, onClose]);

  if (!isVisible && phase === "hidden") return null;

  const bgOpacity = phase === "enter" ? "0" : phase === "show" ? "1" : "0";

  const screenFlash = phase === "enter" ? (
    <div
      className="fixed inset-0 pointer-events-none z-[10001]"
      style={{
        background: isMyTurn
          ? 'radial-gradient(ellipse at center, rgba(251,191,36,0.55) 0%, rgba(245,158,11,0.2) 50%, transparent 80%)'
          : 'radial-gradient(ellipse at center, rgba(99,102,241,0.45) 0%, rgba(67,56,202,0.15) 50%, transparent 80%)',
        animation: 'ntScreenFlash 0.5s ease-out forwards',
      }}
    />
  ) : null;

  if (_isMobile) {
    return (
      <>
        <style>{`
          @keyframes ntScreenFlash {
            0% { opacity: 0; }
            25% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes ntSlideIn {
            0% { transform: translateX(-120%) scale(0.8); opacity: 0; }
            40% { transform: translateX(8%) scale(1.05); opacity: 1; }
            100% { transform: translateX(0%) scale(1); opacity: 1; }
          }
          @keyframes ntSlideOut {
            0% { transform: translateX(0%) scale(1); opacity: 1; }
            100% { transform: translateX(120%) scale(0.7); opacity: 0; }
          }
        `}</style>
        {screenFlash}
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{
            backgroundColor: `rgba(0,0,0,${bgOpacity === "1" ? "0.75" : "0"})`,
            transition: "background-color 0.3s ease",
            pointerEvents: phase === "hidden" ? "none" : "auto",
          }}
          onClick={onClose}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-4 right-4 z-[10000] bg-white/10 rounded-full p-2"
          >
            <X size={20} className="text-white" />
          </button>

          <div
            className="relative w-full max-w-2xl mx-4"
            style={{
              animation:
                phase === "enter" || phase === "show"
                  ? "ntSlideIn 0.5s ease-out forwards"
                  : phase === "exit"
                    ? "ntSlideOut 0.4s ease-in forwards"
                    : "none",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative overflow-hidden rounded-xl border-2"
              style={{
                background: isMyTurn
                  ? "linear-gradient(135deg, #b45309, #ea580c, #f59e0b, #ea580c, #b45309)"
                  : "linear-gradient(135deg, #1e3a5f, #4338ca, #6366f1, #4338ca, #1e3a5f)",
                borderColor: isMyTurn
                  ? "rgba(251, 191, 36, 0.6)"
                  : "rgba(129, 140, 248, 0.6)",
              }}
            >
              <div className="relative flex flex-col items-center py-6 px-8">
                <div className="flex items-center gap-3 mb-2">
                  {isMyTurn ? (
                    <>
                      <Swords size={28} className="text-yellow-200" />
                      <Crown size={36} className="text-yellow-300" />
                      <Swords size={28} className="text-yellow-200" />
                    </>
                  ) : (
                    <>
                      <Shield size={28} className="text-indigo-300" />
                      <Swords size={36} className="text-indigo-200" />
                      <Zap size={28} className="text-indigo-300" />
                    </>
                  )}
                </div>

                <div className="text-center">
                  <h2
                    className="font-black tracking-wider"
                    style={{
                      fontSize: "clamp(1.5rem, 5vw, 2.5rem)",
                      color: "white",
                      textShadow: "0 2px 4px rgba(0,0,0,0.6)",
                      letterSpacing: "0.15em",
                    }}
                  >
                    {isMyTurn ? "IL TUO TURNO!" : `Turno di`}
                  </h2>

                  {!isMyTurn && (
                    <p
                      className="font-bold mt-1"
                      style={{
                        fontSize: "clamp(1.2rem, 4vw, 2rem)",
                        color: "white",
                        textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                      }}
                    >
                      {nextPlayer}
                    </p>
                  )}

                  {isMyTurn && (
                    <p
                      className="font-semibold mt-1 text-yellow-200/90"
                      style={{ fontSize: "clamp(0.9rem, 2.5vw, 1.2rem)" }}
                    >
                      Prepara la tua mossa!
                    </p>
                  )}
                </div>
              </div>

              <div
                className="h-1"
                style={{
                  background: isMyTurn
                    ? "linear-gradient(90deg, transparent, #fbbf24, #f59e0b, #fbbf24, transparent)"
                    : "linear-gradient(90deg, transparent, #818cf8, #6366f1, #818cf8, transparent)",
                }}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes ntSlideIn {
          0% { transform: translateX(-120%) scale(0.8); opacity: 0; }
          40% { transform: translateX(8%) scale(1.08); opacity: 1; }
          60% { transform: translateX(-3%) scale(1.03); }
          80% { transform: translateX(1%) scale(1.01); }
          100% { transform: translateX(0%) scale(1); opacity: 1; }
        }
        @keyframes ntSlideOut {
          0% { transform: translateX(0%) scale(1); opacity: 1; }
          100% { transform: translateX(120%) scale(0.7); opacity: 0; }
        }
        @keyframes ntGlowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(255, 165, 0, 0.4), 0 0 60px rgba(255, 165, 0, 0.2); }
          50% { box-shadow: 0 0 40px rgba(255, 165, 0, 0.8), 0 0 100px rgba(255, 165, 0, 0.4), 0 0 150px rgba(255, 165, 0, 0.2); }
        }
        @keyframes ntGlowPulseBlue {
          0%, 100% { box-shadow: 0 0 20px rgba(100, 100, 255, 0.4), 0 0 60px rgba(100, 100, 255, 0.2); }
          50% { box-shadow: 0 0 40px rgba(100, 100, 255, 0.8), 0 0 100px rgba(100, 100, 255, 0.4), 0 0 150px rgba(100, 100, 255, 0.2); }
        }
        @keyframes ntIconSpin {
          0% { transform: rotate(0deg) scale(0); }
          50% { transform: rotate(180deg) scale(1.3); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes ntTextReveal {
          0% { clip-path: inset(0 100% 0 0); }
          100% { clip-path: inset(0 0% 0 0); }
        }
        @keyframes ntShine {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        @keyframes ntParticle {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-80px) scale(0); opacity: 0; }
        }
        @keyframes ntSpark {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--spark-x), var(--spark-y)) scale(0); opacity: 0; }
        }
        @keyframes ntEnergyLine {
          0% { transform: rotate(var(--line-rot)) scaleX(0); opacity: 0; }
          30% { opacity: 0.8; }
          100% { transform: rotate(var(--line-rot)) scaleX(1); opacity: 0; }
        }
        @keyframes ntFlashBurst {
          0% { transform: scale(0); opacity: 0.9; }
          100% { transform: scale(3); opacity: 0; }
        }
        @keyframes ntScreenFlash {
          0%   { opacity: 0.65; }
          100% { opacity: 0; }
        }
        @keyframes ntSweep {
          0%   { transform: translateX(-110%); }
          100% { transform: translateX(110%); }
        }
        @keyframes ntBorderPulse {
          0%, 100% { border-color: rgba(251, 191, 36, 0.4); }
          50% { border-color: rgba(251, 191, 36, 0.9); }
        }
        @keyframes ntBorderPulseBlue {
          0%, 100% { border-color: rgba(129, 140, 248, 0.4); }
          50% { border-color: rgba(129, 140, 248, 0.9); }
        }
        @keyframes ntTextPulse {
          0%, 100% { text-shadow: 0 0 20px currentColor; }
          50% { text-shadow: 0 0 40px currentColor, 0 0 60px currentColor; }
        }
        @keyframes ntShake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-2px); }
          30% { transform: translateX(2px); }
          50% { transform: translateX(-1px); }
          70% { transform: translateX(1px); }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${bgOpacity === "1" ? "0.85" : "0"})`,
          transition: "background-color 0.4s ease",
          pointerEvents: phase === "hidden" ? "none" : "auto",
        }}
        onClick={onClose}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 right-4 z-[10000] bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
        >
          <X size={20} className="text-white" />
        </button>

        {/* Full-screen flash at the moment the banner appears */}
        {(phase === "enter" || phase === "show") && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: isMyTurn
                ? 'rgba(251,191,36,0.22)'
                : 'rgba(99,102,241,0.22)',
              animation: 'ntScreenFlash 0.35s ease-out forwards',
            }}
          />
        )}
        {/* Horizontal sweep stripe */}
        {(phase === "enter" || phase === "show") && (
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
          >
            <div
              style={{
                position: 'absolute',
                top: '35%',
                left: 0,
                right: 0,
                height: '30%',
                background: isMyTurn
                  ? 'linear-gradient(90deg, transparent, rgba(251,191,36,0.35), transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(129,140,248,0.35), transparent)',
                animation: 'ntSweep 0.55s cubic-bezier(0.4,0,0.2,1) forwards',
              }}
            />
          </div>
        )}

        {phase === "show" && (
          <div
            className="absolute"
            style={{
              top: '50%',
              left: '50%',
              width: '300px',
              height: '300px',
              borderRadius: '50%',
              background: isMyTurn
                ? 'radial-gradient(circle, rgba(251,191,36,0.4), transparent 70%)'
                : 'radial-gradient(circle, rgba(129,140,248,0.4), transparent 70%)',
              animation: 'ntFlashBurst 0.8s ease-out forwards',
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}

        {phase === "show" && energyLines.map((line, i) => (
          <div
            key={`el-${i}`}
            className="absolute"
            style={{
              top: '50%',
              left: '50%',
              width: `${line.width}px`,
              height: '2px',
              background: isMyTurn
                ? 'linear-gradient(90deg, transparent, rgba(251,191,36,0.8), transparent)'
                : 'linear-gradient(90deg, transparent, rgba(129,140,248,0.8), transparent)',
              transformOrigin: 'left center',
              '--line-rot': `${line.rotation}deg`,
              animation: `ntEnergyLine 0.6s ${line.delay}s ease-out forwards`,
              opacity: 0,
            } as unknown as React.CSSProperties}
          />
        ))}

        {phase === "show" && sparks.map((spark, i) => {
          const rad = (spark.angle * Math.PI) / 180;
          const dist = 60 + spark.size * 10;
          return (
            <div
              key={`sp-${i}`}
              className="absolute rounded-full"
              style={{
                top: '50%',
                left: '50%',
                width: `${spark.size}px`,
                height: `${spark.size}px`,
                background: isMyTurn ? '#fbbf24' : '#818cf8',
                boxShadow: `0 0 ${spark.size * 2}px ${isMyTurn ? '#fbbf24' : '#818cf8'}`,
                '--spark-x': `${Math.cos(rad) * dist}px`,
                '--spark-y': `${Math.sin(rad) * dist}px`,
                animation: `ntSpark ${spark.speed}s ${spark.delay}s ease-out forwards`,
                opacity: 0,
              } as unknown as React.CSSProperties}
            />
          );
        })}

        <div
          className="relative w-full max-w-2xl mx-4"
          style={{
            animation:
              phase === "enter" || phase === "show"
                ? "ntSlideIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
                : phase === "exit"
                  ? "ntSlideOut 0.5s ease-in forwards"
                  : "none",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="relative overflow-hidden rounded-xl border-2"
            style={{
              background: isMyTurn
                ? "linear-gradient(135deg, #b45309, #ea580c, #f59e0b, #ea580c, #b45309)"
                : "linear-gradient(135deg, #1e3a5f, #4338ca, #6366f1, #4338ca, #1e3a5f)",
              borderColor: isMyTurn
                ? "rgba(251, 191, 36, 0.6)"
                : "rgba(129, 140, 248, 0.6)",
              animation: phase === "show"
                ? isMyTurn
                  ? "ntGlowPulse 1s ease-in-out infinite, ntBorderPulse 1.5s ease-in-out infinite"
                  : "ntGlowPulseBlue 1s ease-in-out infinite, ntBorderPulseBlue 1.5s ease-in-out infinite"
                : "none",
            }}
          >
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)",
              }}
            />

            <div
              className="absolute top-0 h-full w-32 opacity-30"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                animation: phase === "show" ? "ntShine 1.5s ease-in-out" : "none",
                left: "-100%",
              }}
            />

            {phase === "show" && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: isMyTurn
                    ? 'radial-gradient(ellipse at center, rgba(251,191,36,0.15), transparent 70%)'
                    : 'radial-gradient(ellipse at center, rgba(129,140,248,0.15), transparent 70%)',
                  animation: 'ntTextPulse 2s ease-in-out infinite',
                }}
              />
            )}

            <div className="relative flex flex-col items-center py-6 px-8">
              <div className="flex items-center gap-3 mb-2">
                {isMyTurn ? (
                  <>
                    <Swords
                      size={28}
                      className="text-yellow-200"
                      style={{
                        animation:
                          phase === "show"
                            ? "ntIconSpin 0.6s ease-out forwards"
                            : "none",
                      }}
                    />
                    <Crown
                      size={36}
                      className="text-yellow-300"
                      style={{
                        animation:
                          phase === "show"
                            ? "ntIconSpin 0.6s 0.1s ease-out forwards"
                            : "none",
                        transform: "scale(0)",
                        filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.8))',
                      }}
                    />
                    <Swords
                      size={28}
                      className="text-yellow-200"
                      style={{
                        animation:
                          phase === "show"
                            ? "ntIconSpin 0.6s ease-out forwards"
                            : "none",
                      }}
                    />
                  </>
                ) : (
                  <>
                    <Shield
                      size={28}
                      className="text-indigo-300"
                      style={{
                        animation:
                          phase === "show"
                            ? "ntIconSpin 0.6s ease-out forwards"
                            : "none",
                        filter: 'drop-shadow(0 0 6px rgba(129,140,248,0.6))',
                      }}
                    />
                    <Swords
                      size={36}
                      className="text-indigo-200"
                      style={{
                        animation:
                          phase === "show"
                            ? "ntIconSpin 0.6s 0.1s ease-out forwards"
                            : "none",
                        transform: "scale(0)",
                        filter: 'drop-shadow(0 0 8px rgba(129,140,248,0.8))',
                      }}
                    />
                    <Zap
                      size={28}
                      className="text-indigo-300"
                      style={{
                        animation:
                          phase === "show"
                            ? "ntIconSpin 0.6s ease-out forwards"
                            : "none",
                        filter: 'drop-shadow(0 0 6px rgba(129,140,248,0.6))',
                      }}
                    />
                  </>
                )}
              </div>

              <div
                className="text-center"
                style={{
                  animation:
                    phase === "show"
                      ? "ntTextReveal 0.4s 0.2s ease-out both"
                      : "none",
                }}
              >
                <h2
                  className="font-black tracking-wider"
                  style={{
                    fontSize: "clamp(1.5rem, 5vw, 2.5rem)",
                    color: "white",
                    textShadow: isMyTurn
                      ? "0 0 20px rgba(251, 191, 36, 0.8), 0 0 40px rgba(251, 191, 36, 0.4), 0 2px 4px rgba(0,0,0,0.5)"
                      : "0 0 20px rgba(129, 140, 248, 0.8), 0 0 40px rgba(129,140,248,0.4), 0 2px 4px rgba(0,0,0,0.5)",
                    letterSpacing: "0.15em",
                    animation: phase === "show" ? "ntShake 0.4s 0.3s ease-out" : "none",
                  }}
                >
                  {isMyTurn ? "IL TUO TURNO!" : `Turno di`}
                </h2>

                {!isMyTurn && (
                  <p
                    className="font-bold mt-1"
                    style={{
                      fontSize: "clamp(1.2rem, 4vw, 2rem)",
                      color: "white",
                      textShadow:
                        "0 0 15px rgba(129, 140, 248, 0.6), 0 2px 4px rgba(0,0,0,0.5)",
                    }}
                  >
                    {nextPlayer}
                  </p>
                )}

                {isMyTurn && (
                  <p
                    className="font-semibold mt-1 text-yellow-200/90"
                    style={{
                      fontSize: "clamp(0.9rem, 2.5vw, 1.2rem)",
                      textShadow: "0 0 10px rgba(251,191,36,0.5), 0 1px 3px rgba(0,0,0,0.4)",
                    }}
                  >
                    Prepara la tua mossa!
                  </p>
                )}
              </div>

              <div className="flex gap-2 mt-3">
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full"
                    style={{
                      width: i === 3 ? 8 : 6,
                      height: i === 3 ? 8 : 6,
                      backgroundColor: isMyTurn
                        ? "rgba(251, 191, 36, 0.7)"
                        : "rgba(129, 140, 248, 0.7)",
                      boxShadow: `0 0 ${i === 3 ? 8 : 4}px ${isMyTurn ? 'rgba(251,191,36,0.5)' : 'rgba(129,140,248,0.5)'}`,
                      animation:
                        phase === "show"
                          ? `ntParticle 1s ${i * 0.12}s ease-out infinite`
                          : "none",
                    }}
                  />
                ))}
              </div>
            </div>

            <div
              className="h-1"
              style={{
                background: isMyTurn
                  ? "linear-gradient(90deg, transparent, #fbbf24, #f59e0b, #fbbf24, transparent)"
                  : "linear-gradient(90deg, transparent, #818cf8, #6366f1, #818cf8, transparent)",
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};
