import React from "react";
import { Card } from "./Card";
import { Deck } from "./Deck";
import { useGameState } from "../lib/stores/useGameState";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { socket } from "../lib/socket";
import { Checkbox } from "./ui/checkbox";

export const RoundTable: React.FC = () => {
  const { gameState, playerName, gameId } = useGameState();
  
  const fieldCards = gameState?.field || [];
  const players = gameState?.players || {};
  const allPlayerNames = Object.keys(players);
  const turnOrder = gameState?.turnOrder || [];
  const scenarioCardsActive = gameState?.scenarioCardsActive || false;

  // Determine player order for positioning around the table
  const getOrderedPlayers = () => {
    if (turnOrder.length > 0) {
      // Use turn order if available, excluding current player
      return turnOrder.filter(name => name !== playerName);
    } else {
      // Fallback to all players except current player if no turn order yet
      return allPlayerNames.filter(name => name !== playerName);
    }
  };

  const otherPlayers = getOrderedPlayers();

  // Group cards by player
  const cardsByPlayer = fieldCards.reduce((acc, card) => {
    if (!acc[card.owner]) {
      acc[card.owner] = [];
    }
    acc[card.owner].push(card);
    return acc;
  }, {} as Record<string, typeof fieldCards>);

  const handleMoveCard = (cardId: string, direction: 'left' | 'right') => {
    socket.emit('move-card-position', { 
      cardId, 
      direction, 
      playerName,
      gameId 
    });
  };

  // Calculate positions for players around the table
  const getPlayerPosition = (index: number, total: number) => {
    const angle = (index * 360) / total;
    const radius = 45; // Percentage from center
    const x = 50 + radius * Math.cos((angle * Math.PI) / 180);
    const y = 50 + radius * Math.sin((angle * Math.PI) / 180);
    return { x, y, angle };
  };

  // Calculate card size based on number of players
  const getCardScale = (playerCount: number) => {
    if (playerCount <= 2) return 'scale-90';
    if (playerCount <= 4) return 'scale-75';
    if (playerCount <= 6) return 'scale-60';
    return 'scale-50';
  };

  const cardScale = getCardScale(allPlayerNames.length);

  return (
    <div className="mb-8">
      <h2 className="text-white font-bold text-2xl mb-4 text-center">TAVOLO DA GIOCO</h2>
      
      {/* Round Table Container */}
      <div className="relative bg-gradient-to-br from-green-800 to-green-900 rounded-full w-[900px] h-[700px] mx-auto border-8 border-amber-700 shadow-2xl">
        
        {/* Center Area - Decks */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="flex gap-2 items-center justify-center">
            <div className="flex flex-col items-center scale-75">
              <Deck
                name="PERSONAGGI"
                backImage="https://i.imgur.com/r1rfUAB.png"
                type="personaggi"
              />
            </div>
            <div className="flex flex-col items-center scale-75">
              <Deck
                name="MOSSE"
                backImage="https://i.imgur.com/6MUXCZO.png"
                type="mosse"
              />
            </div>
            <div className="flex flex-col items-center scale-75">
              <Deck
                name="BONUS"
                backImage="https://i.imgur.com/lEROr3r.png"
                type="bonus"
              />
              {/* ATTIVA SCENARI checkbox */}
              <div className="flex items-center space-x-1 mt-1">
                <Checkbox
                  id="attiva-scenari-round"
                  checked={scenarioCardsActive}
                  onCheckedChange={(checked) => {
                    socket.emit('toggle-scenario-cards', { 
                      gameId, 
                      active: checked as boolean 
                    });
                  }}
                />
                <label
                  htmlFor="attiva-scenari-round"
                  className="text-xs font-medium text-white cursor-pointer select-none"
                >
                  SCENARI
                </label>
              </div>
            </div>
            <div className="flex flex-col items-center scale-75">
              <Deck
                name="SPECIALI"
                backImage="https://i.imgur.com/ipVd57A.png"
                type="personaggi_speciali"
              />
            </div>
          </div>
        </div>

        {/* Other Players' Cards around the table */}
        {otherPlayers.map((player, index) => {
          const position = getPlayerPosition(index, otherPlayers.length);
          const playerCards = cardsByPlayer[player] || [];
          
          return (
            <div
              key={player}
              className="absolute transform -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
              }}
            >
              {/* Player Name */}
              <div className="text-center mb-2">
                <span className="bg-blue-800/80 text-white font-bold px-3 py-1 rounded-full text-sm shadow-lg">
                  {player}
                </span>
              </div>
              
              {/* Player's Cards */}
              <div className={`flex gap-1 justify-center ${cardScale}`}>
                {playerCards.length > 0 ? (
                  playerCards.map((card) => (
                    <div key={card.id} className="transform">
                      <Card
                        card={card}
                        location="field"
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-white/60 text-xs italic">
                    Nessuna carta
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Current Player's Field Cards Indicator */}
        {cardsByPlayer[playerName] && cardsByPlayer[playerName].length > 0 && (
          <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2">
            <div className="text-center mb-2">
              <span className="bg-yellow-600/80 text-white font-bold px-3 py-1 rounded-full text-sm shadow-lg">
                Le tue carte in campo
              </span>
            </div>
            <div className={`flex gap-1 justify-center ${cardScale}`}>
              {cardsByPlayer[playerName].map((card, index) => {
                const playerCards = cardsByPlayer[playerName];
                const canMoveLeft = index > 0;
                const canMoveRight = index < playerCards.length - 1;
                
                return (
                  <div key={card.id} className="flex items-center gap-1">
                    {/* Left Arrow */}
                    <Button
                      onClick={() => handleMoveCard(card.id, 'left')}
                      disabled={!canMoveLeft}
                      className="p-1 h-6 w-6 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50"
                      size="sm"
                    >
                      <ChevronLeft size={12} />
                    </Button>
                    
                    {/* Card */}
                    <Card
                      card={card}
                      location="field"
                    />
                    
                    {/* Right Arrow */}
                    <Button
                      onClick={() => handleMoveCard(card.id, 'right')}
                      disabled={!canMoveRight}
                      className="p-1 h-6 w-6 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50"
                      size="sm"
                    >
                      <ChevronRight size={12} />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};