import React, { useEffect, useState } from "react";
import { X, MessageCircle, Shield } from "lucide-react";

interface ChatNotificationProps {
  message: string;
  playerName: string;
  isGymLeader?: boolean;
  gymLeaderImageUrl?: string;
  onClose: () => void;
  onOpenChat: () => void;
}

export const ChatNotification: React.FC<ChatNotificationProps> = ({
  message,
  playerName,
  isGymLeader,
  gymLeaderImageUrl,
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
        className={`fixed bottom-28 left-3 z-50 flex items-end gap-0 max-w-[88vw] transition-all duration-500 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}
        style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.7))' }}
      >
        {/* Boss photo — large, slightly overlapping the bubble */}
        <div
          className="flex-shrink-0 relative z-10"
          style={{ marginBottom: -4, marginRight: -6 }}
        >
          <div
            className="rounded-full border-2 border-amber-400/70 overflow-hidden"
            style={{
              width: 72, height: 72,
              boxShadow: '0 0 18px rgba(245,158,11,0.55), 0 0 36px rgba(245,158,11,0.20)',
              background: 'linear-gradient(135deg,#1a0a00,#2a1200)',
            }}
          >
            {gymLeaderImageUrl ? (
              <img
                src={gymLeaderImageUrl}
                alt={playerName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Shield size={28} className="text-amber-400/60" />
              </div>
            )}
          </div>
          {/* Glow ring */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: '1.5px solid rgba(245,158,11,0.4)',
              animation: 'gymNodePulse 2s ease-out infinite',
            }}
          />
        </div>

        {/* Speech bubble */}
        <div
          className="relative rounded-2xl rounded-bl-sm cursor-pointer"
          style={{
            background: 'linear-gradient(135deg,rgba(0,0,0,0.92),rgba(15,8,0,0.95))',
            border: '1.5px solid rgba(245,158,11,0.45)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(245,158,11,0.1)',
            backdropFilter: 'blur(16px)',
            padding: '10px 36px 10px 14px',
            maxWidth: 220,
          }}
          onClick={handleClick}
        >
          {/* Tail triangle */}
          <div
            style={{
              position: 'absolute', bottom: 8, left: -7,
              width: 0, height: 0,
              borderTop: '7px solid transparent',
              borderBottom: '7px solid transparent',
              borderRight: '8px solid rgba(245,158,11,0.45)',
            }}
          />

          {/* Boss name */}
          <div
            className="font-black text-xs mb-1 flex items-center gap-1"
            style={{ color: '#fbbf24', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            ⚔️ {playerName}
          </div>

          {/* Message text */}
          <div
            className="text-sm font-semibold leading-snug"
            style={{ color: 'rgba(255,235,180,0.92)' }}
          >
            {message}
          </div>

          {/* Close */}
          <button
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
            className="absolute top-2 right-2 text-amber-600/60 hover:text-amber-300 transition-colors"
          >
            <X size={13} />
          </button>
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
