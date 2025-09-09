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

  // Calculate positions for other players around the table (current player is always at bottom)
  const getPlayerPosition = (index: number, totalOtherPlayers: number) => {
    // Distribute other players around the table, starting from top
    // Leave bottom position for current player
    const availableAngle = 270; // 360 - 90 degrees reserved for bottom
    const startAngle = -135; // Start from top-left
    
    let angle;
    if (totalOtherPlayers === 1) {
      angle = -90; // Single other player at top
    } else {
      angle = startAngle + (index * availableAngle) / (totalOtherPlayers - 1);
    }
    
    const radius = 38; // Percentage from center
    const x = 50 + radius * Math.cos((angle * Math.PI) / 180);
    const y = 50 + radius * Math.sin((angle * Math.PI) / 180);
    return { x, y, angle };
  };

  // Calculate individual card positions for a player's cards
  const getCardPositions = (playerCards: any[], playerIndex: number, totalOtherPlayers: number) => {
    const playerPos = getPlayerPosition(playerIndex, totalOtherPlayers);
    const cardCount = playerCards.length;
    
    if (cardCount === 0) return [];
    if (cardCount === 1) return [playerPos];
    
    // For multiple cards, spread them in an arc around the player's position
    const arcSpan = Math.min(45, cardCount * 8); // Maximum arc of 45 degrees
    const startAngle = playerPos.angle - arcSpan / 2;
    
    return playerCards.map((_, cardIndex) => {
      const cardAngle = startAngle + (cardIndex * arcSpan) / (cardCount - 1);
      const cardRadius = playerPos.angle >= -45 && playerPos.angle <= 135 ? 40 : 36; // Adjust radius based on position
      const x = 50 + cardRadius * Math.cos((cardAngle * Math.PI) / 180);
      const y = 50 + cardRadius * Math.sin((cardAngle * Math.PI) / 180);
      return { x, y, angle: cardAngle };
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
    // Smaller scales for TAVOLO DA GIOCO cards
    const mobileScales = {
      2: 'scale-65 sm:scale-75 md:scale-85 lg:scale-95',
      4: 'scale-55 sm:scale-65 md:scale-75 lg:scale-85', 
      6: 'scale-45 sm:scale-55 md:scale-65 lg:scale-75',
      8: 'scale-35 sm:scale-45 md:scale-55 lg:scale-65'
    };
    
    if (playerCount <= 2) return mobileScales[2];
    if (playerCount <= 4) return mobileScales[4];
    if (playerCount <= 6) return mobileScales[6];
    return mobileScales[8];
  };

  const cardScale = getCardScale(allPlayerNames.length);

  return (
    <div className="mb-4 md:mb-8">
      <h2 className="text-white font-bold text-lg md:text-2xl mb-2 md:mb-4 text-center">TAVOLO DA GIOCO</h2>
      
      {/* Elliptical Table Container */}
      <div 
        className="relative w-[70vw] h-[90vw] landscape:w-[90vw] landscape:h-[65vw] sm:w-[85vw] sm:h-[65vw] md:w-[90vw] md:h-[65vw] lg:w-[95vw] lg:h-[70vw] max-w-[1200px] max-h-[900px] min-w-[280px] min-h-[350px] mx-auto border-4 md:border-8 border-amber-700 shadow-2xl bg-no-repeat overflow-hidden touch-manipulation"
        style={{
          borderRadius: '50%',
          backgroundImage: `url('https://i.ibb.co/B2yVVMkJ/wallpaper-2547293.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          touchAction: 'pinch-zoom'
        }}
      >
        
        {/* Center Area - Decks */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="flex gap-1 sm:gap-2 items-center justify-center">
            <div className="flex flex-col items-center scale-75 sm:scale-85 md:scale-95 lg:scale-105">
              <Deck
                name="PERSONAGGI"
                backImage="https://i.imgur.com/r1rfUAB.png"
                type="personaggi"
              />
            </div>
            <div className="flex flex-col items-center scale-75 sm:scale-85 md:scale-95 lg:scale-105">
              <Deck
                name="MOSSE"
                backImage="https://i.imgur.com/6MUXCZO.png"
                type="mosse"
              />
            </div>
            <div className="flex flex-col items-center scale-75 sm:scale-85 md:scale-95 lg:scale-105">
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
            <div className="flex flex-col items-center scale-75 sm:scale-85 md:scale-95 lg:scale-105">
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
            allPlayerNames.map((player) => {
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
            })
          ) : (
            <p className="text-white/60 italic text-center">Nessun giocatore</p>
          )}
        </div>
      </div>
    </div>
  );
};