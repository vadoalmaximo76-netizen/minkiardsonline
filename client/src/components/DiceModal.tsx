import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { X } from "lucide-react";
import { Dice3D } from "./Dice3D";

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
  const [finalValue, setFinalValue] = useState<number>(1);
  const [showResult, setShowResult] = useState(false);
  const pendingRollRef = useRef<number | null>(null);
  const { playerName, gameId } = useGameState();

  useEffect(() => {
    if (currentRoll) {
      if (isRolling) {
        pendingRollRef.current = currentRoll;
        setFinalValue(currentRoll);
        setTimeout(() => {
          setIsRolling(false);
        }, 1200);
      } else {
        setFinalValue(currentRoll);
        setShowResult(true);
      }
    }
  }, [currentRoll, isRolling]);

  const handleRollComplete = useCallback(() => {
    setShowResult(true);
  }, []);

  if (!isOpen) return null;

  const handleRollDice = () => {
    setIsRolling(true);
    setShowResult(false);
    pendingRollRef.current = null;
    socket.emit('roll-dice', { gameId, playerName });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="premium-panel p-8 max-w-md w-full text-center">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-white font-bold text-2xl tracking-wide" style={{ textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>
            DADO
          </h3>
          <Button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-full transition-all hover:scale-110"
            size="sm"
          >
            <X size={16} />
          </Button>
        </div>

        <div className="mb-6 h-[250px] relative flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-radial from-red-500/20 via-transparent to-transparent rounded-full blur-xl" />
          <Dice3D 
            isRolling={isRolling} 
            finalValue={finalValue}
            onRollComplete={handleRollComplete}
            size={120}
          />
        </div>
        
        {showResult && !isRolling && (
          <div className="text-white mb-4 animate-in fade-in zoom-in duration-300">
            <p className="text-4xl font-bold mb-2 animate-pulse" style={{ textShadow: '0 0 20px rgba(220,38,38,0.8)' }}>
              {finalValue}
            </p>
            {playerWhoRolled && (
              <p className="text-sm text-gray-400">
                Lanciato da: <span className="text-white font-semibold">{playerWhoRolled}</span>
              </p>
            )}
          </div>
        )}
        
        {isRolling && (
          <p className="text-white text-lg animate-pulse mb-4">Lanciando...</p>
        )}

        <Button
          onClick={handleRollDice}
          disabled={isRolling}
          className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold py-4 text-lg rounded-xl transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 shadow-lg"
          style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
        >
          {isRolling ? 'LANCIANDO...' : 'LANCIA'}
        </Button>
      </div>
    </div>
  );
};
