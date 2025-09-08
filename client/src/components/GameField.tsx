import React from "react";
import { Card } from "./Card";
import { useGameState } from "../lib/stores/useGameState";

export const GameField: React.FC = () => {
  const { gameState } = useGameState();
  
  const fieldCards = gameState?.field || [];
  const players = gameState?.players || {};

  // Group cards by player
  const cardsByPlayer = fieldCards.reduce((acc, card) => {
    if (!acc[card.owner]) {
      acc[card.owner] = [];
    }
    acc[card.owner].push(card);
    return acc;
  }, {} as Record<string, typeof fieldCards>);

  // Sort players - those with cards first, then others at bottom
  const playersWithCards = Object.keys(cardsByPlayer);
  const playersWithoutCards = Object.keys(players).filter(
    (player) => !playersWithCards.includes(player)
  );

  return (
    <div className="mb-8">
      <h2 className="text-white font-bold text-2xl mb-4">CAMPO DA GIOCO</h2>
      <div className="bg-blue-800/50 rounded-lg p-6 min-h-48">
        {/* Players with cards */}
        {playersWithCards.map((playerName) => (
          <div key={playerName} className="mb-6">
            <h3 className="text-white font-semibold mb-2">{playerName}</h3>
            <div className="flex gap-4 flex-wrap">
              {cardsByPlayer[playerName].map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  location="field"
                />
              ))}
            </div>
          </div>
        ))}

        {/* Players without cards (at bottom) */}
        {playersWithoutCards.length > 0 && (
          <div className="border-t border-white/20 pt-4 mt-4">
            <h4 className="text-white/70 text-sm mb-2">Players without cards:</h4>
            <div className="flex gap-4">
              {playersWithoutCards.map((playerName) => (
                <div key={playerName} className="text-white/50 text-sm">
                  {playerName}
                </div>
              ))}
            </div>
          </div>
        )}

        {fieldCards.length === 0 && (
          <p className="text-white/70 italic text-center">No cards in play</p>
        )}
      </div>
    </div>
  );
};
