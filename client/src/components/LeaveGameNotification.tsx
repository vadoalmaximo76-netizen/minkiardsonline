import React, { useEffect } from "react";
import { Button } from "./ui/button";
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
      // Auto-close after 4 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-red-600 rounded-lg p-8 max-w-md w-full text-center shadow-2xl border-2 border-red-400">
        <div className="flex justify-between items-center mb-6">
          <div></div> {/* Spacer */}
          <Button
            onClick={onClose}
            className="bg-red-800 hover:bg-red-900 text-white p-2"
            size="sm"
          >
            <X size={16} />
          </Button>
        </div>
        
        <div className="text-6xl mb-4">👋</div>
        
        <h2 className="text-white font-bold text-3xl mb-2">A CASCETTA</h2>
        <p className="text-white/90 text-xl font-semibold">
          {playerName}
        </p>
        
        <div className="mt-6 text-white/80 text-sm">
          ha lasciato la partita
        </div>
      </div>
    </div>
  );
};