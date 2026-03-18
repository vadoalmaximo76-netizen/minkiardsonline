import React, { useEffect } from "react";
import { X } from "lucide-react";

interface LeaveGameNotificationProps {
  isVisible: boolean;
  playerName: string;
  onClose: () => void;
}

export const LeaveGameNotification: React.FC<LeaveGameNotificationProps> = ({
  isVisible,
  playerName,
  onClose
}) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black/85 backdrop-blur-xl border border-red-500/40 rounded-2xl p-8 max-w-md w-full text-center shadow-[0_0_40px_rgba(239,68,68,0.3)]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-red-900/40 border border-red-500/30 text-red-400 hover:bg-red-900/60 transition-colors"
        >
          <X size={14} />
        </button>

        <div className="text-6xl mb-4">👋</div>

        <h2 className="font-black text-3xl mb-2 bg-gradient-to-r from-red-400 to-rose-400 bg-clip-text text-transparent">
          A CASCETTA
        </h2>
        <p className="text-violet-100 text-xl font-semibold">
          {playerName}
        </p>

        <div className="mt-6 text-violet-300/60 text-sm">
          ha lasciato la partita
        </div>
      </div>
    </div>
  );
};
