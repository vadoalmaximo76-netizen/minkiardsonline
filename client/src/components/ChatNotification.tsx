import React, { useEffect, useState } from "react";
import { X, MessageCircle, Shield } from "lucide-react";

interface ChatNotificationProps {
  message: string;
  playerName: string;
  isGymLeader?: boolean;
  onClose: () => void;
  onOpenChat: () => void;
}

export const ChatNotification: React.FC<ChatNotificationProps> = ({
  message,
  playerName,
  isGymLeader,
  onClose,
  onOpenChat
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    const timer = setTimeout(() => {
      handleClose();
    }, isGymLeader ? 7000 : 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleClick = () => {
    onOpenChat();
    handleClose();
  };

  if (isGymLeader) {
    return (
      <div
        className={`fixed top-4 right-4 z-50 rounded-2xl p-4 max-w-sm cursor-pointer transition-all duration-300 bg-black/85 backdrop-blur-xl border border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.3)] ${
          isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}
        onClick={handleClick}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-xl p-2 bg-amber-500/10 border border-amber-500/30">
            <Shield size={16} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-black mb-1 text-amber-400">
              ⚔️ {playerName}
            </div>
            <div className="text-sm font-medium text-amber-100/80 leading-snug">
              {message}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="flex-shrink-0 text-amber-600/70 hover:text-amber-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="text-xs mt-2 text-amber-500/60">
          Clicca per aprire la chat
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed top-4 right-4 z-50 bg-black/85 backdrop-blur-xl border border-violet-500/30 rounded-2xl shadow-[0_0_20px_rgba(124,58,237,0.25)] p-4 max-w-sm cursor-pointer transition-all duration-300 ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 rounded-xl p-2 bg-cyan-500/10 border border-cyan-500/30">
          <MessageCircle size={16} className="text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-cyan-400 mb-1">
            Nuovo messaggio da {playerName}
          </div>
          <div className="text-sm text-violet-100/80 line-clamp-2">
            {message}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="flex-shrink-0 text-violet-400/50 hover:text-violet-200 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <div className="text-xs text-violet-400/50 mt-2">
        Clicca per aprire la chat
      </div>
    </div>
  );
};
