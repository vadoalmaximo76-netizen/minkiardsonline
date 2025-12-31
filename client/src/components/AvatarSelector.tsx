import React from "react";
import { Button } from "./ui/button";
import { X } from "lucide-react";
import { AVATARS } from "../lib/avatars";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";

interface AvatarSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({ isOpen, onClose }) => {
  const { playerName, gameState } = useGameState();
  
  const currentAvatar = gameState?.players?.[playerName]?.avatar;

  const handleSelectAvatar = (avatarId: string) => {
    socket.emit('set-avatar', { playerName, avatarId });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg border-2 border-purple-500">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Scegli il tuo Avatar</h2>
          <Button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full p-1"
            size="sm"
          >
            <X size={16} />
          </Button>
        </div>
        
        <div className="grid grid-cols-6 gap-3 max-h-80 overflow-y-auto p-2">
          {AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              onClick={() => handleSelectAvatar(avatar.id)}
              className={`
                w-12 h-12 flex items-center justify-center rounded-xl text-2xl
                transition-all duration-200 hover:scale-110
                ${currentAvatar === avatar.id 
                  ? 'bg-purple-600 ring-2 ring-white shadow-lg' 
                  : 'bg-gray-700 hover:bg-gray-600'
                }
              `}
              title={avatar.name}
            >
              {avatar.emoji}
            </button>
          ))}
        </div>
        
        <p className="text-gray-400 text-sm text-center mt-4">
          Il tuo avatar apparirà accanto al tuo nome nel gioco
        </p>
      </div>
    </div>
  );
};
