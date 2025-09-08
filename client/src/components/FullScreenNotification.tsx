import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FullScreenNotificationProps {
  isVisible: boolean;
  playerName: string;
  cardCount: number;
  onClose: () => void;
}

export const FullScreenNotification: React.FC<FullScreenNotificationProps> = ({
  isVisible,
  playerName,
  cardCount,
  onClose
}) => {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!isVisible) {
      setCountdown(5);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onClose();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [isVisible, onClose]);

  const getNotificationText = () => {
    const randomTitles = [
      "UH LÀ LÀ!",
      "ATTENZIONE ATTENZIONE",
      "MANNEGGIA QUIGL PUORC",
      "🐷 2⃣"
    ];
    
    const randomTitle = randomTitles[Math.floor(Math.random() * randomTitles.length)];
    
    if (cardCount === 3) {
      return {
        title: randomTitle,
        subtitle: `${playerName} ha messo 3 carte nel CIMITERO!`,
        color: "from-orange-500 to-red-600"
      };
    } else if (cardCount === 5) {
      return {
        title: randomTitle,
        subtitle: `${playerName} ha messo 5 carte nel CIMITERO!`,
        color: "from-purple-500 to-pink-600"
      };
    }
    return {
      title: randomTitle,
      subtitle: `${playerName} ha raggiunto ${cardCount} carte nel CIMITERO!`,
      color: "from-blue-500 to-purple-600"
    };
  };

  const notificationData = getNotificationText();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className={`bg-gradient-to-br ${notificationData.color} p-8 rounded-2xl shadow-2xl text-center max-w-md mx-4 border-4 border-white/20`}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.h1
              initial={{ scale: 0.8 }}
              animate={{ scale: [0.8, 1.1, 1] }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-4xl font-bold text-white mb-4"
            >
              {notificationData.title}
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="text-xl text-white/90 mb-6"
            >
              {notificationData.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.3 }}
              className="bg-black/20 rounded-lg p-4 backdrop-blur-sm"
            >
              <p className="text-white/70 text-sm mb-2">
                Chiusura automatica in:
              </p>
              <motion.div
                key={countdown}
                initial={{ scale: 1.2, opacity: 0.7 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-3xl font-bold text-white"
              >
                {countdown}
              </motion.div>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.3 }}
              onClick={onClose}
              className="mt-4 px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors backdrop-blur-sm"
            >
              Chiudi
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};