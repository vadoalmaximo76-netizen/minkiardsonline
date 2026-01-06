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

  // Separate attached parasitic cards from regular cards
  const attachedParasiticCards = fieldCards.filter(card => card.attachedTo);
  const regularCards = fieldCards.filter(card => !card.attachedTo);

  // Create a map of target cards to their attached parasitic cards
  const attachedCardsMap = attachedParasiticCards.reduce((acc, card) => {
    if (card.attachedTo) {
      if (!acc[card.attachedTo]) {
        acc[card.attachedTo] = [];
      }
      acc[card.attachedTo].push(card);
    }
    return acc;
  }, {} as Record<string, typeof fieldCards>);

  // Group regular cards by player
  const cardsByPlayer = regularCards.reduce((acc, card) => {
    if (!acc[card.owner]) {
      acc[card.owner] = [];
    }
    acc[card.owner].push(card);
    return acc;
  }, {} as Record<string, typeof fieldCards>);

  // Sort players - current player first, then others with cards, then others at bottom
  const allPlayersWithCards = Object.keys(cardsByPlayer);
  const playersWithoutCards = Object.keys(players).filter(
    (player) => !allPlayersWithCards.includes(player)
  );
  
  // Reorder so current player comes first
  const playersWithCards = allPlayersWithCards.sort((a, b) => {
    if (a === playerName) return -1; // Current player first
    if (b === playerName) return 1;  // Current player first
    return 0; // Keep other players in original order
  });

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
                
                // Get attached parasitic cards for this target
                const attachedCards = attachedCardsMap[card.id] || [];
                
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
                    
                    {/* Card with attached parasitic cards */}
                    <div className="relative">
                      <Card
                        card={card}
                        location="field"
                      />
                      
                      {/* Attached parasitic cards - displayed overlapping on the right side */}
                      {attachedCards.length > 0 && (
                        <div className="absolute -right-8 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10">
                          {attachedCards.map((parasiticCard, pIndex) => (
                            <div 
                              key={parasiticCard.id} 
                              className="relative transform scale-75 origin-left"
                              style={{ marginTop: pIndex > 0 ? '-40px' : '0' }}
                            >
                              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-red-500 animate-pulse" />
                              <div className="border-2 border-red-500 rounded-lg shadow-lg shadow-red-500/50 animate-pulse">
                                <Card
                                  card={parasiticCard}
                                  location="field"
                                />
                              </div>
                              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs px-1 rounded whitespace-nowrap">
                                {parasiticCard.owner}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
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
