import React, { useEffect, useState } from "react";
import { X, Swords, Crown, Zap } from "lucide-react";

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

  useEffect(() => {
    if (isVisible) {
      setPhase("enter");
      const showTimer = setTimeout(() => setPhase("show"), 100);
      const exitTimer = setTimeout(() => setPhase("exit"), 2000);
      const closeTimer = setTimeout(() => {
        setPhase("hidden");
        onClose();
      }, 2500);
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

  return (
    <>
      <style>{`
        @keyframes ntSlideIn {
          0% { transform: translateX(-120%) scale(0.8); opacity: 0; }
          60% { transform: translateX(5%) scale(1.05); opacity: 1; }
          80% { transform: translateX(-2%) scale(1.02); }
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
      `}</style>

      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${bgOpacity === "1" ? "0.8" : "0"})`,
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

        <div
          className="relative w-full max-w-2xl mx-4"
          style={{
            animation:
              phase === "enter" || phase === "show"
                ? "ntSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
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
                  ? "ntGlowPulse 1s ease-in-out infinite"
                  : "ntGlowPulseBlue 1s ease-in-out infinite"
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
                    <Zap
                      size={28}
                      className="text-indigo-300"
                      style={{
                        animation:
                          phase === "show"
                            ? "ntIconSpin 0.6s ease-out forwards"
                            : "none",
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
                      ? "0 0 20px rgba(251, 191, 36, 0.8), 0 2px 4px rgba(0,0,0,0.5)"
                      : "0 0 20px rgba(129, 140, 248, 0.8), 0 2px 4px rgba(0,0,0,0.5)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {isMyTurn ? "È IL TUO TURNO!" : `Turno di`}
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
                      textShadow: "0 1px 3px rgba(0,0,0,0.4)",
                    }}
                  >
                    Prepara la tua mossa!
                  </p>
                )}
              </div>

              <div className="flex gap-1 mt-3">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full"
                    style={{
                      width: 6,
                      height: 6,
                      backgroundColor: isMyTurn
                        ? "rgba(251, 191, 36, 0.7)"
                        : "rgba(129, 140, 248, 0.7)",
                      animation:
                        phase === "show"
                          ? `ntParticle 1s ${i * 0.15}s ease-out infinite`
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
