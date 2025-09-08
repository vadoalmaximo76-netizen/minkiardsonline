import React from "react";
import { Card } from "./Card";
import { useGameState } from "../lib/stores/useGameState";
import { Button } from "./ui/button";
import { X } from "lucide-react";

interface GraveyardProps {
  onClose: () => void;
}

export const Graveyard: React.FC<GraveyardProps> = ({ onClose }) => {
  const { gameState } = useGameState();
  
  const graveyardCards = gameState?.graveyard || [];

  // Group cards by the player who eliminated them
  const cardsByEliminator = graveyardCards.reduce((acc, card) => {
    const eliminator = card.eliminatedBy || 'Unknown';
    if (!acc[eliminator]) {
      acc[eliminator] = [];
    }
    acc[eliminator].push(card);
    return acc;
  }, {} as Record<string, typeof graveyardCards>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-white font-bold text-2xl">CIMITERO</h2>
          <Button
            onClick={onClose}
            className="bg-sky-blue hover:bg-sky-blue/80 text-white"
            size="sm"
          >
            <X size={20} />
          </Button>
        </div>

        {Object.keys(cardsByEliminator).length === 0 ? (
          <p className="text-white/70 italic text-center">No cards in graveyard</p>
        ) : (
          Object.entries(cardsByEliminator).map(([eliminator, cards]) => (
            <div key={eliminator} className="mb-6">
              <h3 className="text-white font-semibold mb-3">Eliminated by: {eliminator}</h3>
              <div className="flex gap-4 flex-wrap">
                {cards.map((card) => (
                  <Card
                    key={card.id}
                    card={card}
                    location="graveyard"
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
