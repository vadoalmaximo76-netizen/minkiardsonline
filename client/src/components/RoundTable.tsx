import React from "react";
import { Card } from "./Card";
import { Deck } from "./Deck";
import { useGameState } from "../lib/stores/useGameState";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { socket } from "../lib/socket";
import { Checkbox } from "./ui/checkbox";

// Check if a card has custom activatable effects
const hasCustomEffect = (card: any): boolean => {
  const text = card.text || '';
  const effect = card.effect || '';
  const combined = text + ' ' + effect;
  return combined.includes('[COMPORTAMENTO:') || 
         combined.includes('[DADO:') || 
         combined.includes('[DETTAGLI:') ||
         combined.includes('[ANIMAZIONE:');
};

const RoundTableComponent: React.FC = () => {
  const { gameState, playerName, gameId, showBrowser } = useGameState();
  
  const fieldCards = gameState?.field || [];
  const players = gameState?.players || {};
  const allPlayerNames = Object.keys(players);
  const turnOrder: string[] = [];
  const scenarioCardsActive = false;

  // Compute card filtering directly (no memoization for real-time updates)
  const attachedParasiticCards = fieldCards.filter(card => card.attachedTo);
  const regularCards = fieldCards.filter(card => !card.attachedTo);
  const attachedCardsMap = attachedParasiticCards.reduce((acc, card) => {
    if (card.attachedTo) {
      if (!acc[card.attachedTo]) {
        acc[card.attachedTo] = [];
      }
      acc[card.attachedTo].push(card);
    }
    return acc;
  }, {} as Record<string, typeof fieldCards>);

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

  // Group regular cards by player (attached parasitic cards are rendered with their targets)
  const cardsByPlayer = regularCards.reduce((acc, card) => {
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

  // Activate custom effect on a card
  const handleActivateEffect = (card: any) => {
    console.log(`⚡ Activating custom effect for card: ${card.name || card.id}`);
    socket.emit('activate-custom-effect', {
      cardId: card.id,
      playerName,
      gameId
    });
  };

  // Calculate positions for other players around the rectangular table (current player is always at bottom)
  const getPlayerPosition = (index: number, totalOtherPlayers: number) => {
    if (totalOtherPlayers === 0) return { x: 50, y: 50, angle: 0 };
    
    // Define fixed positions around the rectangular perimeter with extra buffer for mobile
    // Check if mobile portrait mode (narrow screen)
    const isMobile = window.innerWidth < 768;
    const isPortrait = window.innerHeight > window.innerWidth;
    const mobileBuffer = isMobile && isPortrait ? 6 : 0; // Extra buffer for mobile portrait
    
    const positions = [
      // Top positions (moved slightly down to be closer to decks)
      { x: 50, y: Math.max(10, 15 - mobileBuffer), angle: -90 },    // Top center
      { x: 18 + mobileBuffer, y: Math.max(12, 18 - mobileBuffer), angle: -135 },  // Top left
      { x: 82 - mobileBuffer, y: Math.max(12, 18 - mobileBuffer), angle: -45 },   // Top right
      // Side positions with much more spacing and buffer from center
      { x: Math.max(4, 8 - mobileBuffer), y: 35 + mobileBuffer, angle: 180 },    // Left side upper
      { x: Math.min(96, 92 + mobileBuffer), y: 35 + mobileBuffer, angle: 0 },     // Right side upper
      { x: Math.max(4, 8 - mobileBuffer), y: 60 + mobileBuffer, angle: 180 },    // Left side lower  
      { x: Math.min(96, 92 + mobileBuffer), y: 60 + mobileBuffer, angle: 0 },     // Right side lower
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
    // Reduce spacing on mobile to prevent deck overlap
    const isMobile = window.innerWidth < 768;
    const isPortrait = window.innerHeight > window.innerWidth;
    const maxSpacing = isMobile && isPortrait ? 50 : 70;
    const minSpacing = isMobile && isPortrait ? 5 : 7;
    const spacing = Math.max(minSpacing, Math.min(10, maxSpacing / cardCount)); // Better spacing to prevent overlap
    
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

  // Calculate positions for current player's cards (always at bottom center)
  const getCurrentPlayerCardPositions = (playerCards: any[]) => {
    const cardCount = playerCards.length;
    if (cardCount === 0) return [];
    
    const isMobile = window.innerWidth < 640;
    const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024;
    
    // Position cards at bottom center - moved down to avoid overlap with decks
    const bottomY = isMobile ? 85 : 82;
    const centerX = 50;
    
    if (cardCount === 1) {
      return [{ x: centerX, y: bottomY, angle: 0 }];
    }
    
    // Spread cards horizontally at bottom center - MORE horizontal spacing
    const availableWidth = isMobile ? 85 : isTablet ? 90 : 95;
    const cardWidth = isMobile ? 18 : isTablet ? 16 : 14;
    const idealSpacing = cardWidth + 3;
    
    const totalNeededWidth = cardCount * idealSpacing;
    const cardSpacing = totalNeededWidth > availableWidth 
      ? availableWidth / cardCount 
      : idealSpacing;
    
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
      <h2 className="text-white font-bold text-lg landscape:text-2xl md:text-2xl mb-2 landscape:mb-4 md:mb-4 text-center" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>TAVOLO DA GIOCO</h2>
      
      {/* Rectangular Table Container - taller to fit all cards */}
      <div 
        data-tutorial="field"
        className="relative w-[85vw] h-[95vh] landscape:w-[95vw] landscape:h-[95vh] sm:w-[90vw] sm:h-[90vh] md:w-[95vw] md:h-[95vh] lg:w-[98vw] lg:h-[95vh] xl:w-[98vw] xl:h-[98vh] max-w-[1600px] max-h-[1400px] min-w-[320px] min-h-[500px] mx-auto border-4 landscape:border-8 md:border-8 border-purple-500/30 game-field bg-no-repeat overflow-visible touch-manipulation"
        style={{
          borderRadius: '24px',
          backgroundImage: `url('https://i.ibb.co/Y4bv4xwz/sfondo-minkiards.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          touchAction: 'pinch-zoom',
          boxShadow: '0 0 40px rgba(147, 51, 234, 0.4)'
        }}
      >
        {/* Black overlay with 20% opacity */}
        <div 
          className="absolute inset-0 bg-black opacity-40 rounded-lg"
          style={{ borderRadius: '16px' }}
        />
        
        {/* Center Area - Decks with protection zone - centered vertically */}
        <div className="absolute top-[45%] sm:top-[45%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <div data-tutorial="decks" className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:gap-3 md:gap-4 items-start justify-center bg-black/40 rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 backdrop-blur-sm">
            <Deck
              name="PERSONAGGI"
              backImage="https://i.imgur.com/r1rfUAB.png"
              type="personaggi"
            />
            <Deck
              name="MOSSE"
              backImage="https://i.imgur.com/6MUXCZO.png"
              type="mosse"
            />
            <Deck
              name="BONUS"
              backImage="https://i.imgur.com/lEROr3r.png"
              type="bonus"
            />
            <Deck
              name="SPECIALI"
              backImage="https://i.imgur.com/ipVd57A.png"
              type="personaggi_speciali"
            />
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
                <span className="bg-blue-800/80 text-white font-bold px-2 py-1 rounded-full text-xs shadow-lg whitespace-nowrap" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                  {player}
                </span>
              </div>
              
              {/* Player's Cards positioned individually */}
              {playerCards.length > 0 ? (
                playerCards.map((card, cardIndex) => {
                  const cardPos = cardPositions[cardIndex];
                  if (!cardPos) return null;
                  
                  // Get attached parasitic cards for this target
                  const attachedCards = attachedCardsMap[card.id] || [];
                  
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
                      <div className="flex items-center gap-1">
                        <div className={`${cardScale}`}>
                          <Card
                            card={card}
                            location="field"
                          />
                        </div>
                        
                        {/* Attached parasitic cards */}
                        {attachedCards.map((parasiticCard) => (
                          <div key={parasiticCard.id} className="flex items-center">
                            <div className="w-2 h-1 bg-red-500 animate-pulse" />
                            <div className={`${cardScale} relative`}>
                              <div className="border-2 border-red-500 rounded-lg shadow-lg shadow-red-500/50 ring-2 ring-red-400 animate-pulse">
                                <Card
                                  card={parasiticCard}
                                  location="field"
                                />
                              </div>
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold">
                                {parasiticCard.owner}
                              </div>
                              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold">
                                AGGANCIATO
                              </div>
                            </div>
                          </div>
                        ))}
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
                  <div className="text-white/60 text-xs italic" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
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
                
                // Get attached parasitic cards for this target
                const attachedCards = attachedCardsMap[card.id] || [];
                
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
                      
                      {/* Attached parasitic cards */}
                      {attachedCards.map((parasiticCard) => (
                        <div key={parasiticCard.id} className="flex items-center">
                          <div className="w-2 h-1 bg-red-500 animate-pulse" />
                          <div className={`${cardScale} relative`}>
                            <div className="border-2 border-red-500 rounded-lg shadow-lg shadow-red-500/50 ring-2 ring-red-400 animate-pulse">
                              <Card
                                card={parasiticCard}
                                location="field"
                              />
                            </div>
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold">
                              {parasiticCard.owner}
                            </div>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold">
                              AGGANCIATO
                            </div>
                          </div>
                        </div>
                      ))}
                      
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
        <h3 className="text-white font-bold text-lg md:text-xl mb-2 md:mb-4 text-center" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>CARTE IN CAMPO</h3>
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
                    <h4 className={`font-semibold text-sm md:text-base ${isCurrentPlayer ? 'text-yellow-400' : 'text-white'}`} style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                      {player} {isCurrentPlayer && '(Tu)'}
                    </h4>
                    <span className="text-white/60 text-xs md:text-sm" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                      {playerCards.length} carte
                    </span>
                  </div>
                  
                  <div className="grid gap-2 sm:gap-3 md:gap-4" style={{
                    gridTemplateColumns: `repeat(auto-fit, minmax(${playerCards.length <= 3 ? '80px' : playerCards.length <= 6 ? '70px' : '60px'}, 1fr))`,
                    maxWidth: '100%'
                  }}>
                    {playerCards.length > 0 ? (
                      playerCards.map((card, index) => {
                        // Get attached parasitic cards for this target
                        const attachedCards = attachedCardsMap[card.id] || [];
                        
                        return (
                        <div key={card.id} className="flex flex-col items-center gap-0.5">
                          {/* Card with arrows and attached cards */}
                          <div className="flex items-center gap-0.5">
                            {/* Left Arrow for current player */}
                            {isCurrentPlayer && (
                              <Button
                                onClick={() => handleMoveCard(card.id, 'left')}
                                disabled={index === 0}
                                className="p-0.5 h-4 w-4 sm:h-5 sm:w-5 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50"
                                size="sm"
                              >
                                <ChevronLeft size={8} />
                              </Button>
                            )}
                            
                            {/* Card */}
                            <Card
                              card={card}
                              location="field"
                            />
                            
                            {/* Attached parasitic cards */}
                            {attachedCards.map((parasiticCard) => (
                              <div key={parasiticCard.id} className="flex items-center">
                                <div className="w-2 h-1 bg-red-500 animate-pulse" />
                                <div className="relative">
                                  <div className="border-2 border-red-500 rounded-lg shadow-lg shadow-red-500/50 ring-2 ring-red-400 animate-pulse">
                                    <Card
                                      card={parasiticCard}
                                      location="field"
                                    />
                                  </div>
                                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold">
                                    {parasiticCard.owner}
                                  </div>
                                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold">
                                    AGGANCIATO
                                  </div>
                                </div>
                              </div>
                            ))}
                            
                            {/* Right Arrow for current player */}
                            {isCurrentPlayer && (
                              <Button
                                onClick={() => handleMoveCard(card.id, 'right')}
                                disabled={index === playerCards.length - 1}
                                className="p-0.5 h-4 w-4 sm:h-5 sm:w-5 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50"
                                size="sm"
                              >
                                <ChevronRight size={8} />
                              </Button>
                            )}
                          </div>
                          
                          {/* Activate Effect Button for cards with custom effects */}
                          {isCurrentPlayer && hasCustomEffect(card) && (
                            <Button
                              onClick={() => handleActivateEffect(card)}
                              className="mt-1 px-2 py-0.5 h-5 text-[9px] bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1"
                              size="sm"
                            >
                              <Zap size={10} />
                              Attiva Effetto
                            </Button>
                          )}
                        </div>
                      );
                      })
                    ) : (
                      <p className="text-white/60 italic col-span-full">Nessuna carta in campo</p>
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

// RoundTable without memoization for real-time updates
export const RoundTable = RoundTableComponent;