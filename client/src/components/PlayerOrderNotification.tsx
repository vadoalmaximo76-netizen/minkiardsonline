import React, { useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { X } from "lucide-react";

interface PlayerOrderNotificationProps {
  isVisible: boolean;
  playerOrder: string[];
  onClose: () => void;
}

export const PlayerOrderNotification: React.FC<PlayerOrderNotificationProps> = ({
  isVisible,
  playerOrder,
  onClose
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, 5000);
    return () => clearTimeout(timer);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full text-center">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-white font-bold text-2xl">ORDINE DI GIOCO</h2>
          <Button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white p-2"
            size="sm"
          >
            <X size={16} />
          </Button>
        </div>
        
        <div className="space-y-3">
          {playerOrder.map((player, index) => (
            <div key={player} className="bg-gray-700 rounded-lg p-3">
              <span className="text-white font-bold text-lg">
                {index + 1}. {player}
              </span>
            </div>
          ))}
        </div>
        
        <p className="text-white/80 text-sm mt-6">
          Il gioco inizia con {playerOrder[0]}
        </p>
      </div>
    </div>
  );
};