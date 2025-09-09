import React from "react";
import { Card } from "./Card";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";

export const PlayerHand: React.FC = () => {
  const { gameState, playerName, gameId } = useGameState();
  
  const playerCards = gameState?.players?.[playerName]?.hand || [];

  const handleEndTurn = () => {
    socket.emit('end-turn', { gameId, playerName });
  };

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white font-bold text-2xl">CARTE IN MANO</h2>
        <Button
          onClick={handleEndTurn}
          className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold"
        >
          FINE TURNO
        </Button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {playerCards.map((card) => (
          <Card
            key={card.id}
            card={card}
            location="hand"
          />
        ))}
        {playerCards.length === 0 && (
          <p className="text-white/70 italic">No cards in hand</p>
        )}
      </div>
    </div>
  );
};
