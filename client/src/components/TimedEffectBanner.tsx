import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

  useEffect(() => {
    if (!isVisible) {
      setCountdown(4);
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onClose();
          return 4;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isVisible, onClose]);

  const cleanDescription = (desc: string) => {
    return desc
      .replace(/Effetto ritardato \(\d+ turni\):\s*/gi, "")
      .replace(/,\s*Effetto ritardato[^,]*/gi, "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join(" • ");
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 flex items-center justify-center z-[200] pointer-events-none"
        >
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ scaleX: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full pointer-events-auto"
            style={{
              background:
                "linear-gradient(135deg, rgba(180,0,0,0.97) 0%, rgba(100,0,0,0.97) 40%, rgba(20,0,0,0.97) 100%)",
              borderTop: "3px solid rgba(255,80,0,0.9)",
              borderBottom: "3px solid rgba(255,80,0,0.9)",
              boxShadow:
                "0 0 60px rgba(255,60,0,0.5), 0 0 120px rgba(180,0,0,0.3)",
            }}
            onClick={onClose}
          >
            <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-6">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
                className="text-5xl flex-shrink-0"
              >
                ⏳
              </motion.div>

              <div className="flex-1 min-w-0">
                <motion.div
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="flex items-baseline gap-3 flex-wrap"
                >
                  <span
                    className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300"
                  >
                    EFFETTO RITARDATO ATTIVATO
                  </span>
                  <span className="text-xs text-red-300 opacity-80">
                    di {sourcePlayer}
                  </span>
                </motion.div>

                <motion.h2
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                  className="text-2xl font-black text-white uppercase tracking-wide leading-tight mt-0.5"
                  style={{ textShadow: "0 0 20px rgba(255,100,0,0.8)" }}
                >
                  {cardName}
                </motion.h2>

                <motion.p
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.55, duration: 0.4 }}
                  className="text-sm text-orange-200 mt-1 leading-snug"
                >
                  {cleanDescription(description)}
                </motion.p>
              </div>

              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.3 }}
                className="flex-shrink-0 flex flex-col items-center"
              >
                <motion.div
                  key={countdown}
                  initial={{ scale: 1.4, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-10 h-10 rounded-full border-2 border-orange-400 flex items-center justify-center"
                >
                  <span className="text-lg font-bold text-white">
                    {countdown}
                  </span>
                </motion.div>
                <span className="text-[10px] text-orange-400 mt-1 uppercase tracking-wider">
                  Tocca per chiudere
                </span>
              </motion.div>
            </div>

            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 4, ease: "linear" }}
              style={{
                transformOrigin: "left",
                height: "3px",
                background:
                  "linear-gradient(90deg, rgba(255,180,0,0.9), rgba(255,60,0,0.9))",
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
