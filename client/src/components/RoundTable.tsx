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
    let orderedList;
    if (turnOrder.length > 0) {
      // Use turn order if available
      orderedList = [...turnOrder];
    } else {
      // Fallback to all players if no turn order yet
      orderedList = [...allPlayerNames];
    }

    // Find current player index
    const currentPlayerIndex = orderedList.indexOf(playerName);
    if (currentPlayerIndex === -1) return orderedList.filter(name => name !== playerName);

    // Rearrange so current player is at bottom, others arranged clockwise starting from top
    const reorderedPlayers = [];
    const totalPlayers = orderedList.length;
    
    // Add other players in order, starting from the next player after current
    for (let i = 1; i < totalPlayers; i++) {
      const playerIndex = (currentPlayerIndex + i) % totalPlayers;
      reorderedPlayers.push(orderedList[playerIndex]);
    }
    
    return reorderedPlayers;
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

  // Calculate positions for other players around the rectangular table (current player is always at bottom)
  const getPlayerPosition = (index: number, totalOtherPlayers: number) => {
    if (totalOtherPlayers === 0) return { x: 50, y: 50, angle: 0 };
    
    // Define fixed positions around the rectangular perimeter with better spacing
    const positions = [
      // Top positions
      { x: 50, y: 12, angle: -90 },   // Top center
      { x: 25, y: 15, angle: -135 },  // Top left
      { x: 75, y: 15, angle: -45 },   // Top right
      // Side positions with more spacing
      { x: 12, y: 35, angle: 180 },   // Left side upper
      { x: 88, y: 35, angle: 0 },     // Right side upper
      { x: 12, y: 55, angle: 180 },   // Left side lower  
      { x: 88, y: 55, angle: 0 },     // Right side lower
    ];
    
    // For different player counts, select optimal positions
    let selectedPositions = [];
    
    if (totalOtherPlayers === 1) {
      selectedPositions = [positions[0]]; // Top center only
    } else if (totalOtherPlayers === 2) {
      selectedPositions = [positions[1], positions[2]]; // Top left and right
    } else if (totalOtherPlayers === 3) {
      selectedPositions = [positions[1], positions[0], positions[2]]; // Top left, center, right
    } else if (totalOtherPlayers === 4) {
      selectedPositions = [positions[1], positions[2], positions[3], positions[4]]; // Top and sides
    } else {
      // Use all available positions with good spacing
      selectedPositions = positions.slice(0, Math.min(totalOtherPlayers, positions.length));
    }
    
    return selectedPositions[index] || selectedPositions[index % selectedPositions.length];
  };

  // Calculate individual card positions for a player's cards
  const getCardPositions = (playerCards: any[], playerIndex: number, totalOtherPlayers: number) => {
    const playerPos = getPlayerPosition(playerIndex, totalOtherPlayers);
    const cardCount = playerCards.length;
    
    if (cardCount === 0) return [];
    if (cardCount === 1) return [playerPos];
    
    // For multiple cards, spread them horizontally or vertically based on position
    const spacing = Math.min(6, 30 / cardCount); // Adaptive spacing
    
    return playerCards.map((_, cardIndex) => {
      const offset = (cardIndex - (cardCount - 1) / 2) * spacing;
      
      // Adjust positioning based on player location
      if (playerPos.y < 25) {
        // Top positions - spread horizontally
        return {
          x: playerPos.x + offset,
          y: playerPos.y,
          angle: playerPos.angle
        };
      } else if (playerPos.x < 25) {
        // Left positions - spread vertically  
        return {
          x: playerPos.x,
          y: playerPos.y + offset,
          angle: playerPos.angle
        };
      } else if (playerPos.x > 75) {
        // Right positions - spread vertically
        return {
          x: playerPos.x,
          y: playerPos.y + offset,
          angle: playerPos.angle
        };
      } else {
        // Default horizontal spread
        return {
          x: playerPos.x + offset,
          y: playerPos.y,
          angle: playerPos.angle
        };
      }
    });
  };

  // Calculate positions for current player's cards (always at bottom)
  const getCurrentPlayerCardPositions = (playerCards: any[]) => {
    const cardCount = playerCards.length;
    if (cardCount === 0) return [];
    
    const bottomY = 88; // Bottom position
    const centerX = 50;
    
    if (cardCount === 1) {
      return [{ x: centerX, y: bottomY, angle: 0 }];
    }
    
    // Spread cards horizontally at bottom
    const cardSpacing = Math.min(8, 40 / cardCount); // Adjust spacing based on card count
    const totalWidth = (cardCount - 1) * cardSpacing;
    const startX = centerX - totalWidth / 2;
    
    return playerCards.map((_, cardIndex) => ({
      x: startX + cardIndex * cardSpacing,
      y: bottomY,
      angle: 0
    }));
  };

  // Calculate card size based on number of players and screen size
  const getCardScale = (playerCount: number) => {
    // Mobile portrait small, landscape same as desktop
    const mobileScales = {
      2: 'scale-45 landscape:scale-95 sm:scale-75 md:scale-85 lg:scale-95',
      4: 'scale-35 landscape:scale-85 sm:scale-65 md:scale-75 lg:scale-85', 
      6: 'scale-25 landscape:scale-75 sm:scale-55 md:scale-65 lg:scale-75',
      8: 'scale-20 landscape:scale-65 sm:scale-45 md:scale-55 lg:scale-65'
    };
    
    if (playerCount <= 2) return mobileScales[2];
    if (playerCount <= 4) return mobileScales[4];
    if (playerCount <= 6) return mobileScales[6];
    return mobileScales[8];
  };

  const cardScale = getCardScale(allPlayerNames.length);

  // Use the same scale as field cards for consistency
  const deckScale = cardScale;

  return (
    <div className="mb-4 md:mb-8">
      <h2 className="text-white font-bold text-lg landscape:text-2xl md:text-2xl mb-2 landscape:mb-4 md:mb-4 text-center">TAVOLO DA GIOCO</h2>
      
      {/* Rectangular Table Container */}
      <div 
        className="relative w-[75vw] h-[85vh] landscape:w-[90vw] landscape:h-[85vh] sm:w-[85vw] sm:h-[75vh] md:w-[88vw] md:h-[80vh] lg:w-[92vw] lg:h-[85vh] xl:w-[95vw] xl:h-[90vh] max-w-[1300px] max-h-[900px] min-w-[320px] min-h-[400px] mx-auto border-4 landscape:border-8 md:border-8 border-white bg-no-repeat overflow-hidden touch-manipulation"
        style={{
          borderRadius: '16px',
          backgroundImage: `url('https://i.ibb.co/B2yVVMkJ/wallpaper-2547293.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          touchAction: 'pinch-zoom',
          boxShadow: '0 0 20px rgba(255, 255, 255, 0.6), 0 0 40px rgba(255, 255, 255, 0.4), 0 0 60px rgba(255, 255, 255, 0.2)'
        }}
      >
        
        {/* Center Area - Decks */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="flex gap-0.5 landscape:gap-1 sm:gap-1 items-center justify-center">
            <div className={`flex flex-col items-center ${deckScale}`}>
              <Deck
                name="PERSONAGGI"
                backImage="https://i.imgur.com/r1rfUAB.png"
                type="personaggi"
              />
            </div>
            <div className={`flex flex-col items-center ${deckScale}`}>
              <Deck
                name="MOSSE"
                backImage="https://i.imgur.com/6MUXCZO.png"
                type="mosse"
              />
            </div>
            <div className={`flex flex-col items-center ${deckScale}`}>
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
                  className="text-xs font-medium text-white cursor-pointer select-none hidden landscape:block sm:block"
                >
                  SCENARI
                </label>
              </div>
            </div>
            <div className={`flex flex-col items-center ${deckScale}`}>
              <Deck
                name="SPECIALI"
                backImage="https://i.imgur.com/ipVd57A.png"
                type="personaggi_speciali"
              />
            </div>
          </div>
        </div>

        {/* Other Players' Cards around the table */}
        {otherPlayers.map((player, playerIndex) => {
          const playerCards = cardsByPlayer[player] || [];
          const cardPositions = getCardPositions(playerCards, playerIndex, otherPlayers.length);
          const playerPosition = getPlayerPosition(playerIndex, otherPlayers.length);
          
          return (
            <div key={player}>
              {/* Player Name */}
              <div
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${playerPosition.x}%`,
                  top: `${playerPosition.y}%`,
                }}
              >
                <span className="bg-blue-800/80 text-white font-bold px-2 py-1 rounded-full text-xs shadow-lg whitespace-nowrap">
                  {player}
                </span>
              </div>
              
              {/* Player's Cards positioned individually */}
              {playerCards.length > 0 ? (
                playerCards.map((card, cardIndex) => {
                  const cardPos = cardPositions[cardIndex];
                  if (!cardPos) return null;
                  
                  return (
                    <div
                      key={card.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: `${cardPos.x}%`,
                        top: `${cardPos.y}%`,
                        transform: `translate(-50%, -50%) rotate(${cardPos.angle + 90}deg)`,
                      }}
                    >
                      <div className={`${cardScale}`}>
                        <Card
                          card={card}
                          location="field"
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                // Show "no cards" message at player position
                <div
                  className="absolute transform -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${playerPosition.x}%`,
                    top: `${playerPosition.y + 8}%`,
                  }}
                >
                  <div className="text-white/60 text-xs italic">
                    Nessuna carta
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Current Player's Field Cards (always at bottom) */}
        {cardsByPlayer[playerName] && cardsByPlayer[playerName].length > 0 && (
          <>
            {/* Player Name at bottom */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-yellow-600/80 text-white font-bold px-2 py-1 rounded-full text-xs shadow-lg whitespace-nowrap">
                {playerName} (Tu)
              </span>
            </div>
            
            {/* Current player's cards positioned individually */}
            {(() => {
              const currentPlayerCards = cardsByPlayer[playerName];
              const cardPositions = getCurrentPlayerCardPositions(currentPlayerCards);
              
              return currentPlayerCards.map((card, cardIndex) => {
                const cardPos = cardPositions[cardIndex];
                if (!cardPos) return null;
                
                const canMoveLeft = cardIndex > 0;
                const canMoveRight = cardIndex < currentPlayerCards.length - 1;
                
                return (
                  <div
                    key={card.id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${cardPos.x}%`,
                      top: `${cardPos.y}%`,
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {/* Left Arrow */}
                      <Button
                        onClick={() => handleMoveCard(card.id, 'left')}
                        disabled={!canMoveLeft}
                        className="p-1 h-5 w-5 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50"
                        size="sm"
                      >
                        <ChevronLeft size={10} />
                      </Button>
                      
                      {/* Card */}
                      <div className={`${cardScale}`}>
                        <Card
                          card={card}
                          location="field"
                        />
                      </div>
                      
                      {/* Right Arrow */}
                      <Button
                        onClick={() => handleMoveCard(card.id, 'right')}
                        disabled={!canMoveRight}
                        className="p-1 h-5 w-5 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50"
                        size="sm"
                      >
                        <ChevronRight size={10} />
                      </Button>
                    </div>
                  </div>
                );
              });
            })()}
          </>
        )}
      </div>

      {/* CARTE IN CAMPO section for all players */}
      <div className="mt-4 md:mt-8">
        <h3 className="text-white font-bold text-lg md:text-xl mb-2 md:mb-4 text-center">CARTE IN CAMPO</h3>
        <div className="bg-blue-800/30 rounded-lg p-2 md:p-4">
          {allPlayerNames.length > 0 ? (
            (() => {
              // Reorder players to put current player first
              const orderedPlayers = [
                playerName,
                ...allPlayerNames.filter(player => player !== playerName)
              ];
              
              return orderedPlayers.map((player) => {
                const playerCards = cardsByPlayer[player] || [];
                const isCurrentPlayer = player === playerName;
                
                return (
                <div key={player} className="mb-3 md:mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-1 md:mb-2">
                    <h4 className={`font-semibold text-sm md:text-base ${isCurrentPlayer ? 'text-yellow-400' : 'text-white'}`}>
                      {player} {isCurrentPlayer && '(Tu)'}
                    </h4>
                    <span className="text-white/60 text-xs md:text-sm">
                      {playerCards.length} carte
                    </span>
                  </div>
                  
                  <div className="flex gap-1 md:gap-2 flex-wrap">
                    {playerCards.length > 0 ? (
                      playerCards.map((card, index) => (
                        <div key={card.id} className="flex items-center gap-1">
                          {/* Left Arrow for current player */}
                          {isCurrentPlayer && (
                            <Button
                              onClick={() => handleMoveCard(card.id, 'left')}
                              disabled={index === 0}
                              className="p-1 h-4 w-4 md:h-6 md:w-6 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50"
                              size="sm"
                            >
                              <ChevronLeft size={8} className="md:w-3 md:h-3" />
                            </Button>
                          )}
                          
                          {/* Card */}
                          <div className="scale-90 sm:scale-100 md:scale-110 lg:scale-125">
                            <Card
                              card={card}
                              location="field"
                            />
                          </div>
                          
                          {/* Right Arrow for current player */}
                          {isCurrentPlayer && (
                            <Button
                              onClick={() => handleMoveCard(card.id, 'right')}
                              disabled={index === playerCards.length - 1}
                              className="p-1 h-4 w-4 md:h-6 md:w-6 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50"
                              size="sm"
                            >
                              <ChevronRight size={8} className="md:w-3 md:h-3" />
                            </Button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-white/60 italic">Nessuna carta in campo</p>
                    )}
                  </div>
                </div>
              );
            });
            })()
          ) : (
            <p className="text-white/60 italic text-center">Nessun giocatore</p>
          )}
        </div>
      </div>
    </div>
  );
};