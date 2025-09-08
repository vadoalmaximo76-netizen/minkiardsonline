import React from "react";
import { Card } from "./Card";
import { useGameState } from "../lib/stores/useGameState";

export const PlayerHand: React.FC = () => {
  const { gameState, playerName } = useGameState();
  
  const playerCards = gameState?.players?.[playerName]?.hand || [];

  return (
    <div className="mb-8">
      <h2 className="text-white font-bold text-2xl mb-4">YOUR HAND</h2>
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
