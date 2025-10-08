import React, { useState } from "react";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { X } from "lucide-react";

interface DiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoll?: number;
  playerWhoRolled?: string;
}

export const DiceModal: React.FC<DiceModalProps> = ({ 
  isOpen, 
  onClose, 
  currentRoll, 
  playerWhoRolled 
}) => {
  const [isRolling, setIsRolling] = useState(false);
  const { playerName, gameId } = useGameState();

  if (!isOpen) return null;

  const handleRollDice = () => {
    setIsRolling(true);
    socket.emit('roll-dice', { gameId, playerName });
    
    // Stop rolling animation after 1 second
    setTimeout(() => {
      setIsRolling(false);
    }, 1000);
  };

  const renderDiceFace = (number?: number) => {
    if (!number || isRolling) {
      // Show rolling animation (random dots)
      const randomDots = Math.floor(Math.random() * 6) + 1;
      return renderDots(randomDots);
    }
    return renderDots(number);
  };

  const renderDots = (number: number) => {
    const dots = [];
    
    // Define dot positions for each number
    const dotPositions = {
      1: [[50, 50]], // center
      2: [[25, 25], [75, 75]], // diagonal
      3: [[25, 25], [50, 50], [75, 75]], // diagonal with center
      4: [[25, 25], [75, 25], [25, 75], [75, 75]], // corners
      5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]], // corners + center
      6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]] // two columns
    };

    const positions = dotPositions[number as keyof typeof dotPositions] || [];
    
    positions.forEach((pos, index) => {
      dots.push(
        <div
          key={index}
          className="absolute w-4 h-4 bg-white rounded-full"
          style={{
            left: `${pos[0]}%`,
            top: `${pos[1]}%`,
            transform: 'translate(-50%, -50%)'
          }}
        />
      );
    });

    return dots;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full text-center">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-white font-bold text-xl">DADO</h3>
          <Button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white p-2"
            size="sm"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Dice Display */}
        <div className="mb-6">
          <div 
            className={`w-32 h-32 bg-red-600 rounded-lg mx-auto mb-4 relative border-4 border-red-700 shadow-lg ${
              isRolling ? 'animate-bounce' : ''
            }`}
          >
            {renderDiceFace(currentRoll)}
          </div>
          
          {currentRoll && !isRolling && (
            <div className="text-white">
              <p className="text-2xl font-bold mb-2">{currentRoll}</p>
              {playerWhoRolled && (
                <p className="text-sm text-gray-300">
                  Lanciato da: {playerWhoRolled}
                </p>
              )}
            </div>
          )}
          
          {isRolling && (
            <p className="text-white text-lg">Lanciando...</p>
          )}
        </div>

        {/* Roll Button */}
        <Button
          onClick={handleRollDice}
          disabled={isRolling}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
        >
          {isRolling ? 'LANCIANDO...' : 'LANCIA'}
        </Button>
      </div>
    </div>
  );
};