import React, { useEffect, useState } from "react";

interface TimedEffectBannerProps {
  isVisible: boolean;
  cardName: string;
  sourcePlayer: string;
  description: string;
  onClose: () => void;
}

export const TimedEffectBanner: React.FC<TimedEffectBannerProps> = ({
  isVisible,
  cardName,
  sourcePlayer,
  description,
  onClose,
}) => {
  const [countdown, setCountdown] = useState(4);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsExiting(false);
      onClose();
    }, 200);
  };

  useEffect(() => {
    if (!isVisible) {
      setCountdown(4);
      setIsExiting(false);
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleClose();
          return 4;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isVisible]);

  const cleanDescription = (desc: string) => {
    return desc
      .replace(/Effetto ritardato \(\d+ turni\):\s*/gi, "")
      .replace(/,\s*Effetto ritardato[^,]*/gi, "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join(" • ");
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[200] pointer-events-none"
      style={isExiting
        ? { animation: 'timed-banner-out 0.2s ease-in forwards' }
        : { animation: 'timed-banner-fade 0.3s ease-out' }}
    >
      <div
        className="w-full pointer-events-auto"
        style={{
          background:
            "linear-gradient(135deg, rgba(180,0,0,0.97) 0%, rgba(100,0,0,0.97) 40%, rgba(20,0,0,0.97) 100%)",
          borderTop: "3px solid rgba(255,80,0,0.9)",
          borderBottom: "3px solid rgba(255,80,0,0.9)",
          boxShadow:
            "0 0 60px rgba(255,60,0,0.5), 0 0 120px rgba(180,0,0,0.3)",
          animation: isExiting ? 'timed-banner-out 0.2s ease-in forwards' : 'timed-banner-scale 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        onClick={handleClose}
      >
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-6">
          <div
            className="text-5xl flex-shrink-0"
            style={{ animation: 'timed-banner-icon 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.15s both' }}
          >
            ⏳
          </div>

          <div className="flex-1 min-w-0">
            <div
              className="flex items-baseline gap-3 flex-wrap"
              style={{ animation: 'timed-banner-slide 0.35s cubic-bezier(0.22,1,0.36,1) 0.25s both' }}
            >
              <span
                className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300"
              >
                EFFETTO RITARDATO ATTIVATO
              </span>
              <span className="text-xs text-red-300 opacity-80">
                di {sourcePlayer}
              </span>
            </div>

            <h2
              className="text-2xl font-black text-white uppercase tracking-wide leading-tight mt-0.5"
              style={{
                textShadow: "0 0 20px rgba(255,100,0,0.8)",
                animation: 'timed-banner-slide 0.35s cubic-bezier(0.22,1,0.36,1) 0.35s both',
              }}
            >
              {cardName}
            </h2>

            <p
              className="text-sm text-orange-200 mt-1 leading-snug"
              style={{ animation: 'timed-banner-slide 0.35s cubic-bezier(0.22,1,0.36,1) 0.48s both' }}
            >
              {cleanDescription(description)}
            </p>
          </div>

          <div
            className="flex-shrink-0 flex flex-col items-center"
            style={{ animation: 'timed-banner-scale-in 0.35s cubic-bezier(0.34,1.56,0.64,1) 0.45s both' }}
          >
            <div
              key={countdown}
              className="w-10 h-10 rounded-full border-2 border-orange-400 flex items-center justify-center"
              style={{ animation: 'timed-banner-pulse 0.3s ease-out' }}
            >
              <span className="text-lg font-bold text-white">
                {countdown}
              </span>
            </div>
            <span className="text-[10px] text-orange-400 mt-1 uppercase tracking-wider">
              Tocca per chiudere
            </span>
          </div>
        </div>

        <div
          style={{
            transformOrigin: "left",
            height: "3px",
            background:
              "linear-gradient(90deg, rgba(255,180,0,0.9), rgba(255,60,0,0.9))",
            animation: 'timed-banner-progress 4s linear',
          }}
        />
      </div>
    </div>
  );
};
