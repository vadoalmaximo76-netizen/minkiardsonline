import React, { useEffect, useState } from "react";
import { X, MessageCircle } from "lucide-react";

interface ChatNotificationProps {
  message: string;
  playerName: string;
  onClose: () => void;
  onOpenChat: () => void;
}

export const ChatNotification: React.FC<ChatNotificationProps> = ({ 
  message, 
  playerName, 
  onClose, 
  onOpenChat 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    setIsVisible(true);
    
    // Auto close after 5 seconds
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to complete
  };

  const handleClick = () => {
    onOpenChat();
    handleClose();
  };

  return (
    <div 
      className={`fixed top-4 right-4 z-50 bg-gray-800 text-white rounded-lg shadow-lg p-4 max-w-sm border border-gray-600 cursor-pointer transition-all duration-300 ${
        isVisible ? 'transform translate-x-0 opacity-100' : 'transform translate-x-full opacity-0'
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