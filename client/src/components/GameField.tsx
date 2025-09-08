import React from "react";
import { Card } from "./Card";
import { useGameState } from "../lib/stores/useGameState";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { socket } from "../lib/socket";

export const GameField: React.FC = () => {
  const { gameState, playerName, gameId } = useGameState();
  
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

  const handleMoveCard = (cardId: string, direction: 'left' | 'right') => {
    socket.emit('move-card-position', { 
      cardId, 
      direction, 
      playerName,
      gameId 
    });
  };

  return (
    <div className="mb-8">
      <h2 className="text-white font-bold text-2xl mb-4">CAMPO DA GIOCO</h2>
      <div className="bg-blue-800/50 rounded-lg p-6 min-h-48">
        {/* Players with cards */}
        {playersWithCards.map((currentPlayer) => (
          <div key={currentPlayer} className="mb-6">
            <h3 className="text-white font-semibold mb-2">{currentPlayer}</h3>
            <div className="flex gap-4 flex-wrap">
              {cardsByPlayer[currentPlayer].map((card, index) => {
                const isOwner = card.owner === playerName;
                const playerCards = cardsByPlayer[currentPlayer];
                const canMoveLeft = index > 0;
                const canMoveRight = index < playerCards.length - 1;
                
                return (
                  <div key={card.id} className="flex items-center gap-1">
                    {/* Left Arrow */}
                    {isOwner && (
                      <Button
                        onClick={() => handleMoveCard(card.id, 'left')}
                        disabled={!canMoveLeft}
                        className="p-1 h-6 w-6 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50"
                        size="sm"
                      >
                        <ChevronLeft size={12} />
                      </Button>
                    )}
                    
                    {/* Card */}
                    <Card
                      card={card}
                      location="field"
                    />
                    
                    {/* Right Arrow */}
                    {isOwner && (
                      <Button
                        onClick={() => handleMoveCard(card.id, 'right')}
                        disabled={!canMoveRight}
                        className="p-1 h-6 w-6 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50"
                        size="sm"
                      >
                        <ChevronRight size={12} />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Players without cards (at bottom) */}
        {playersWithoutCards.length > 0 && (
          <div className="border-t border-white/20 pt-4 mt-4">
            <h4 className="text-white/70 text-sm mb-2">Players without cards:</h4>
            <div className="flex gap-4">
              {playersWithoutCards.map((player) => (
                <div key={player} className="text-white/50 text-sm">
                  {player}
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
