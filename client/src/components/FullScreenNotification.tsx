import React, { useEffect, useState } from "react";
import { useAudio } from "../lib/stores/useAudio";

interface FullScreenNotificationProps {
  isVisible: boolean;
  playerName: string;
  cardCount: number;
  title: string;
  onClose: () => void;
}

export const FullScreenNotification: React.FC<FullScreenNotificationProps> = ({
  isVisible,
  playerName,
  cardCount,
  title,
  onClose
}) => {
  const [countdown, setCountdown] = useState(5);
  const { playNotification } = useAudio();

  useEffect(() => {
    if (isVisible) {
      playNotification();
    }
  }, [isVisible]);

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
    if (cardCount === 3) {
      return {
        title: title,
        subtitle: `${playerName} ha messo 3 carte nel CIMITERO!`,
        color: "from-orange-500 to-red-600"
      };
    } else if (cardCount === 5) {
      return {
        title: title,
        subtitle: `${playerName} ha messo 5 carte nel CIMITERO!`,
        color: "from-purple-500 to-pink-600"
      };
    }
    return {
      title: title,
      subtitle: `${playerName} ha raggiunto ${cardCount} carte nel CIMITERO!`,
      color: "from-blue-500 to-purple-600"
    };
  };

  if (!isVisible) return null;

  const notificationData = getNotificationText();

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]"
      style={{ animation: 'fsn-backdrop 0.5s ease-out' }}
      onClick={onClose}
    >
      <div
        className={`bg-gradient-to-br ${notificationData.color} p-8 rounded-2xl shadow-2xl text-center max-w-md mx-4 border-4 border-white/20`}
        style={{ animation: 'fsn-panel 0.5s ease-out 0.2s both' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h1
          className="text-4xl font-bold text-white mb-4"
          style={{ animation: 'fsn-scale 0.6s ease-out 0.5s both' }}
        >
          {notificationData.title}
        </h1>
        
        <p
          className="text-xl text-white/90 mb-6"
          style={{ animation: 'fsn-slide-up 0.5s ease-out 0.8s both' }}
        >
          {notificationData.subtitle}
        </p>

        <div
          className="bg-black/20 rounded-lg p-4 backdrop-blur-sm"
          style={{ animation: 'fsn-fade 0.3s ease-out 1.2s both' }}
        >
          <p className="text-white/70 text-sm mb-2">
            Chiusura automatica in:
          </p>
          <div
            key={countdown}
            className="text-3xl font-bold text-white"
            style={{ animation: 'fsn-pulse 0.3s ease-out' }}
          >
            {countdown}
          </div>
        </div>

        <button
          style={{ animation: 'fsn-slide-up 0.3s ease-out 1.5s both' }}
          onClick={onClose}
          className="mt-4 px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors backdrop-blur-sm"
        >
          Chiudi
        </button>
      </div>
    </div>
  );
};
