import React from "react";
import { Card } from "./Card";
import { Button } from "./ui/button";
import { X } from "lucide-react";
import { useGameState } from "../lib/stores/useGameState";

interface HandModalProps {
  onClose: () => void;
}

export const HandModal: React.FC<HandModalProps> = ({ onClose }) => {
  const { gameState, playerName } = useGameState();
  const playerCards = gameState?.players?.[playerName]?.hand || [];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-2xl">CARTE IN MANO</h2>
          <Button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2"
            title="Chiudi"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Cards Grid */}
        <div className="flex flex-wrap gap-4 justify-center">
          {playerCards.map((card) => (
            <Card
              key={card.id}
              card={card}
              location="hand"
            />
          ))}
          {playerCards.length === 0 && (
            <p className="text-white/70 italic text-center w-full py-8">
              Nessuna carta in mano
            </p>
          )}
        </div>

        {/* Cards count */}
        {playerCards.length > 0 && (
          <div className="text-center mt-4">
            <p className="text-white/80 text-sm">
              Totale: {playerCards.length} {playerCards.length === 1 ? 'carta' : 'carte'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};