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
        className={`fixed top-4 right-4 z-50 rounded-xl shadow-2xl p-4 max-w-sm cursor-pointer transition-all duration-300 ${
          isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}
        style={{
          background: 'linear-gradient(135deg, #1a0a00 0%, #3d1f00 100%)',
          border: '2px solid #f59e0b',
          boxShadow: '0 0 20px rgba(245,158,11,0.4), 0 4px 24px rgba(0,0,0,0.6)',
        }}
        onClick={handleClick}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-full p-2" style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid #f59e0b' }}>
            <Shield size={16} className="text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-black mb-1 flex items-center gap-1" style={{ color: '#f59e0b' }}>
              ⚔️ {playerName}
            </div>
            <div className="text-sm font-medium text-yellow-100 leading-snug">
              {message}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="flex-shrink-0 text-yellow-600 hover:text-yellow-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="text-xs mt-2 text-yellow-600">
          Clicca per aprire la chat
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`fixed top-4 right-4 z-50 bg-gray-800 text-white rounded-lg shadow-lg p-4 max-w-sm border border-gray-600 cursor-pointer transition-all duration-300 ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 bg-sky-blue rounded-full p-2">
          <MessageCircle size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-sky-blue mb-1">
            Nuovo messaggio da {playerName}
          </div>
          <div className="text-sm text-gray-200 line-clamp-2">
            {message}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <div className="text-xs text-gray-400 mt-2">
        Clicca per aprire la chat
      </div>
    </div>
  );
};
