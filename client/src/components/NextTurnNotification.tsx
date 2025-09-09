import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { X, Clock } from "lucide-react";

interface NextTurnNotificationProps {
  isVisible: boolean;
  nextPlayer: string;
  onClose: () => void;
}

export const NextTurnNotification: React.FC<NextTurnNotificationProps> = ({
  isVisible,
  nextPlayer,
  onClose
}) => {
  const [isClockAnimating, setIsClockAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsClockAnimating(true);
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
      <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-lg p-8 max-w-md w-full text-center shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div></div> {/* Spacer */}
          <Button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white p-2"
            size="sm"
          >
            <X size={16} />
          </Button>
        </div>
        
        <div className="flex items-center justify-center mb-4">
          <Clock 
            size={48} 
            className={`text-white ${isClockAnimating ? 'animate-pulse' : ''}`}
          />
        </div>
        
        <h2 className="text-white font-bold text-3xl mb-2">TOCCA A TE</h2>
        <p className="text-white/90 text-xl font-semibold">
          {nextPlayer}
        </p>
        
        <div className="mt-6 text-white/80 text-sm">
          È il tuo turno!
        </div>
      </div>
    </div>
  );
};