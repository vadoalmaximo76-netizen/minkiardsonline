import React from "react";
import { Card } from "./Card";
import { Deck } from "./Deck";
import { useGameState } from "../lib/stores/useGameState";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { socket } from "../lib/socket";
import { Checkbox } from "./ui/checkbox";
import { getAvatarEmoji } from "../lib/avatars";
import AmbientParticles from "./AmbientParticles";
import useTableTheme, { TABLE_THEMES } from "../lib/stores/useTableTheme";

// Check if a card has custom activatable effects
const hasCustomEffect = (card: any): boolean => {
  const effect = card.effect || '';
  
  // Only check the effect field - not the text field which contains PTI/Stelle info
  if (!effect || effect.trim() === '' || effect.trim().toLowerCase() === 'none') {
    return false;
  }
  
  // Check for formal effect tags
  const effectLower = effect.toLowerCase();
  if (effectLower.includes('[comportamento:') || 
      effectLower.includes('[dado:') || 
      effectLower.includes('[dettagli:') ||
      effectLower.includes('[animazione:') ||
      effectLower.includes('[bersaglio:')) {
    return true;
  }
  
  // Check for effect-like keywords in the effect field only
  const effectKeywords = ['quando', 'attiva', 'assorbe', 'aggiunge', 'infligge', 
                          'protetto', 'immune', 'clona', 'trasforma', 'ruba', 'cura',
                          'danno', 'aumenta', 'diminuisce', 'raddoppia', 'dimezza',
                          'scommessa', 'fusione', 'guadagna', 'perde'];
  for (const keyword of effectKeywords) {
    if (effectLower.includes(keyword)) {
      return true;
    }
  }
  
  // If effect field has content and is not "none", consider it an effect
  return effect.trim().length > 5;
};

const RoundTableComponent: React.FC = () => {
  const { gameState, playerName, gameId, showBrowser } = useGameState();
  const currentThemeId = useTableTheme(state => state.currentThemeId);
  const tableTheme = TABLE_THEMES.find(t => t.id === currentThemeId) || TABLE_THEMES[0];
  
  const currentTurnPlayer = gameState?.turnOrder?.[gameState?.currentTurnIndex ?? 0] || '';
  const isMyTurn = currentTurnPlayer === playerName;
  const isDraftMode = (gameState as any)?.isDraftMode || false;

  const fieldCards = gameState?.field || [];
  const players = gameState?.players || {};
  const allPlayerNames = Object.keys(players);
  const turnOrder: string[] = [];
  const scenarioCardsActive = gameState?.scenarioCardsActive ?? true;

  const charLimit = gameState?.characterLimit;
  const isUnlimitedDeaths = charLimit === 'unlimited';
  const baseDeathLimit = isUnlimitedDeaths ? 0 : parseInt(charLimit ?? '0') || 0;
  const deathModifiers: Record<string, number> = gameState?.playerDeathModifiers || {};
  const graveyard = gameState?.graveyard || [];

  const getDeathCount = (name: string): number =>
    graveyard.filter((c: any) => c.owner === name && (c.type === 'personaggi' || c.type === 'personaggi_speciali')).length;

  const getDeathLimit = (name: string): number =>
    Math.max(1, baseDeathLimit + (deathModifiers[name] || 0));

  const isPlayerOnline = (name: string): boolean =>
    players[name]?.socketId != null;

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
      orderedList = Array.from(new Set(turnOrder));
    } else {
      orderedList = Array.from(new Set(allPlayerNames));
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
    const mobileBuffer = isMobile && isPortrait ? 6 : 0;
    
    const positions = [
      { x: 50, y: Math.max(10, 15 - mobileBuffer), angle: -90 },    // Top center
      { x: 18 + mobileBuffer, y: Math.max(12, 18 - mobileBuffer), angle: -135 },  // Top left
      { x: 82 - mobileBuffer, y: Math.max(12, 18 - mobileBuffer), angle: -45 },   // Top right
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
    const isLandscape = window.innerWidth > window.innerHeight;
    
    const bottomY = isMobile ? 85 : 82;
    const centerX = 50;
    
    if (cardCount === 1) {
      return [{ x: centerX, y: bottomY, angle: 0 }];
    }
    
    const availableWidth = isMobile ? 90 : isTablet ? 90 : 95;
    const cardWidth = isMobile ? 22 : isTablet ? 18 : 16;
    const idealSpacing = cardWidth + 2;
    
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

  const getCardScale = (playerCount: number) => {
    const mobileScales = {
      2: 'scale-[0.75] landscape:scale-[0.88] sm:scale-[0.80] md:scale-[0.85] lg:scale-[0.90]',
      4: 'scale-[0.65] landscape:scale-[0.79] sm:scale-[0.70] md:scale-[0.75] lg:scale-[0.85]', 
      6: 'scale-[0.55] landscape:scale-[0.70] sm:scale-[0.60] md:scale-[0.65] lg:scale-[0.75]',
      8: 'scale-[0.45] landscape:scale-[0.60] sm:scale-[0.50] md:scale-[0.55] lg:scale-[0.65]'
    };
    
    if (playerCount <= 2) return mobileScales[2];
    if (playerCount <= 4) return mobileScales[4];
    if (playerCount <= 6) return mobileScales[6];
    return mobileScales[8];
  };

  const cardScale = getCardScale(allPlayerNames.length);

  const deckScale = cardScale;

  return (
    <div className="mb-4 md:mb-8">
      <style>{`
        @keyframes arena-badge-glow {
          0%,100% { box-shadow: 0 0 10px 2px rgba(34,211,238,0.4), 0 0 20px 5px rgba(124,58,237,0.2); }
          50% { box-shadow: 0 0 20px 6px rgba(34,211,238,0.7), 0 0 40px 12px rgba(124,58,237,0.4); }
        }
        @keyframes arena-player-pulse {
          0%,100% { box-shadow: 0 0 8px 2px rgba(34,211,238,0.35); }
          50% { box-shadow: 0 0 18px 6px rgba(34,211,238,0.65); }
        }
        @keyframes arena-overlay-pulse {
          0%,100% { opacity: 0.55; }
          50% { opacity: 0.45; }
        }
        .arena-badge-glow { animation: arena-badge-glow 2s ease-in-out infinite; }
        .arena-player-pulse { animation: arena-player-pulse 2.5s ease-in-out infinite; }
        .arena-overlay-pulse { animation: arena-overlay-pulse 4s ease-in-out infinite; }
      `}</style>
      <div className="flex flex-wrap items-center justify-center gap-2 mb-2 landscape:mb-4 md:mb-4">
        <h2 className="font-black text-lg landscape:text-2xl md:text-2xl text-center tracking-wide" style={{
          background: 'linear-gradient(to right, #22d3ee, #818cf8, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: 'none',
          filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.4))',
        }}>TAVOLO DA GIOCO</h2>
        {currentTurnPlayer && (
          <div
            className={`px-3 py-1 rounded-2xl text-xs sm:text-sm font-black whitespace-nowrap transition-all duration-500 border ${isMyTurn ? 'arena-badge-glow' : ''}`}
            style={{
              background: isMyTurn
                ? 'linear-gradient(135deg, rgba(34,211,238,0.22) 0%, rgba(124,58,237,0.18) 100%)'
                : 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(124,58,237,0.12) 100%)',
              borderColor: isMyTurn ? 'rgba(34,211,238,0.5)' : 'rgba(99,102,241,0.35)',
              backdropFilter: 'blur(12px)',
              color: isMyTurn ? '#a5f3fc' : '#c7d2fe',
              textShadow: isMyTurn ? '0 0 12px rgba(34,211,238,0.7)' : '0 0 8px rgba(165,180,252,0.4)',
            }}
          >
            {isMyTurn ? '⚡ TOCCA A TE!' : `⏳ Turno di ${currentTurnPlayer}`}
          </div>
        )}
      </div>
      
      {/* Rectangular Table Container — background image + theme colour overlay */}
      <div 
        data-tutorial="field"
        className="relative w-[79vw] h-[88vh] landscape:w-[88vw] landscape:h-[88vh] sm:w-[84vw] sm:h-[84vh] md:w-[88vw] md:h-[88vh] lg:w-[91vw] lg:h-[88vh] xl:w-[91vw] xl:h-[91vh] max-w-[1488px] max-h-[1302px] min-w-[298px] min-h-[465px] mx-auto game-field bg-no-repeat overflow-visible"
        style={{
          borderRadius: '24px',
          backgroundImage: `url('https://i.ibb.co/Y4bv4xwz/sfondo-minkiards.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          touchAction: 'pan-y pinch-zoom',
          border: `3px solid ${tableTheme.tableBorder}66`,
          boxShadow: `0 0 60px ${tableTheme.tableBorder}30, 0 0 120px rgba(30,0,60,0.4), inset 0 0 80px rgba(30,0,60,0.15)`,
        }}
      >
        {/* Scenario background image overlay — replaces fixed div at zIndex:0 in GameBoard */}
        {gameState?.activeScenario?.cardImageUrl && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: '22px',
              backgroundImage: `url(${gameState.activeScenario.cardImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(10px) brightness(0.35)',
              zIndex: 0,
              transition: 'opacity 0.8s ease',
            }}
          />
        )}

        {/* Theme colour overlay */}
        <div
          className="absolute inset-0 arena-overlay-pulse pointer-events-none"
          style={{
            borderRadius: '20px',
            background: tableTheme.backgroundGradient,
            zIndex: 0,
          }}
        />
        
        <AmbientParticles visible={true} />
        
        {/* Center Area - Decks with protection zone - centered vertically */}
        <div className="absolute top-[45%] sm:top-[45%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          {isDraftMode && (
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full flex items-center gap-1" style={{background:'linear-gradient(135deg, #0e7490, #4f46e5)', boxShadow:'0 0 12px rgba(34,211,238,0.3)'}}>
              <span>🃏</span>
              <span>DRAFT — MAZZO PERSONALE</span>
            </div>
          )}
          <div data-tutorial="decks" className={`grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:gap-3 md:gap-4 items-start justify-center zone-decks rounded-xl sm:rounded-2xl p-2 sm:p-3 md:p-4 backdrop-blur-sm ${isDraftMode ? 'ring-1 ring-indigo-500/40' : ''}`} style={{
            background: 'linear-gradient(135deg, rgba(10,8,30,0.80) 0%, rgba(5,3,20,0.70) 100%)',
            border: '1px solid rgba(99,102,241,0.35)',
            boxShadow: '0 0 28px rgba(99,102,241,0.18), 0 8px 32px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.3)',
          }}>
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
              {/* Player Name - positioned above the card */}
              <div
                className="absolute transform -translate-x-1/2 z-20"
                style={{
                  left: `${playerPosition.x}%`,
                  top: `${Math.max(1, playerPosition.y - 6)}%`,
                }}
              >
                <div
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-black whitespace-nowrap ${player === currentTurnPlayer ? 'arena-player-pulse' : ''}`}
                  style={{
                    background: player === currentTurnPlayer
                      ? 'linear-gradient(135deg, rgba(34,211,238,0.25) 0%, rgba(124,58,237,0.18) 100%)'
                      : 'linear-gradient(135deg, rgba(10,8,30,0.82) 0%, rgba(5,3,20,0.72) 100%)',
                    border: player === currentTurnPlayer
                      ? '1px solid rgba(34,211,238,0.55)'
                      : '1px solid rgba(99,102,241,0.30)',
                    backdropFilter: 'blur(10px)',
                    color: player === currentTurnPlayer ? '#a5f3fc' : '#c7d2fe',
                    textShadow: player === currentTurnPlayer ? '0 0 10px rgba(34,211,238,0.6)' : '0 0 6px rgba(165,180,252,0.3)',
                  }}
                >
                  {/* Avatar circle with initial */}
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                    style={{
                      background: player === currentTurnPlayer
                        ? 'linear-gradient(135deg, #06b6d4, #6d28d9)'
                        : 'linear-gradient(135deg, #312e81, #1e1b4b)',
                      color: '#e0e7ff',
                      border: player === currentTurnPlayer ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(99,102,241,0.35)',
                      boxShadow: player === currentTurnPlayer ? '0 0 6px rgba(34,211,238,0.55)' : 'none',
                    }}
                  >
                    {player[0]?.toUpperCase()}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPlayerOnline(player) ? 'bg-emerald-400' : 'bg-red-500'}`} />
                  {player}
                  {!isUnlimitedDeaths && (
                    <span className="text-[9px] opacity-80 ml-0.5">💀{getDeathCount(player)}/{getDeathLimit(player)}</span>
                  )}
                </div>
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
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-[5]"
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
                            <div className="w-2 h-0.5 bg-gradient-to-r from-orange-500 to-red-600 animate-pulse" style={{boxShadow:'0 0 4px rgba(249,115,22,0.6)'}} />
                            <div className={`${cardScale} relative`}>
                              <div className="border-2 border-orange-500 rounded-lg shadow-lg shadow-orange-500/40 ring-1 ring-orange-400/50 animate-pulse">
                                <Card
                                  card={parasiticCard}
                                  location="field"
                                />
                              </div>
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-600 to-red-700 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold shadow-md">
                                {parasiticCard.owner}
                              </div>
                              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-700 to-rose-800 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold shadow-md">
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
                  <div className="text-indigo-300/60 text-xs italic">
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
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap ${isMyTurn ? 'arena-badge-glow' : ''}`}
                style={{
                  background: isMyTurn
                    ? 'linear-gradient(135deg, rgba(34,211,238,0.28) 0%, rgba(124,58,237,0.22) 100%)'
                    : 'linear-gradient(135deg, rgba(10,8,30,0.85) 0%, rgba(5,3,20,0.75) 100%)',
                  border: isMyTurn
                    ? '1px solid rgba(34,211,238,0.60)'
                    : '1px solid rgba(99,102,241,0.35)',
                  backdropFilter: 'blur(12px)',
                  color: isMyTurn ? '#a5f3fc' : '#c7d2fe',
                  textShadow: isMyTurn ? '0 0 12px rgba(34,211,238,0.7)' : '0 0 8px rgba(165,180,252,0.35)',
                }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                  style={{
                    background: isMyTurn
                      ? 'linear-gradient(135deg, #06b6d4, #6d28d9)'
                      : 'linear-gradient(135deg, #312e81, #1e1b4b)',
                    color: '#e0e7ff',
                    border: isMyTurn ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(99,102,241,0.35)',
                    boxShadow: isMyTurn ? '0 0 8px rgba(34,211,238,0.6)' : 'none',
                  }}
                >
                  {playerName[0]?.toUpperCase()}
                </span>
                {playerName}
                <span className="text-[10px] opacity-70">(Tu)</span>
              </div>
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
                          <div className="w-2 h-0.5 bg-gradient-to-r from-orange-500 to-red-600 animate-pulse" style={{boxShadow:'0 0 4px rgba(249,115,22,0.6)'}} />
                          <div className={`${cardScale} relative`}>
                            <div className="border-2 border-orange-500 rounded-lg shadow-lg shadow-orange-500/40 ring-1 ring-orange-400/50 animate-pulse">
                              <Card
                                card={parasiticCard}
                                location="field"
                              />
                            </div>
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-600 to-red-700 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold shadow-md">
                              {parasiticCard.owner}
                            </div>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-700 to-rose-800 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold shadow-md">
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
                    
                    {/* Activate Effect Button - for cards with custom effects */}
                    {hasCustomEffect(card) && (
                      <Button
                        onClick={() => handleActivateEffect(card)}
                        className="mt-1 px-2 py-0.5 h-6 text-[10px] bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 mx-auto"
                        size="sm"
                      >
                        <Zap size={12} />
                        Attiva Effetto
                      </Button>
                    )}
                  </div>
                );
              });
            })()}
          </>
        )}
      </div>

      {/* CARTE IN CAMPO section for all players */}
      <div className="mt-4 md:mt-8">
        <h3 className="font-black text-lg md:text-xl mb-2 md:mb-4 text-center tracking-wide" style={{
          background: 'linear-gradient(to right, #22d3ee, #818cf8, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.4))',
        }}>CARTE IN CAMPO</h3>
        <div className="rounded-xl p-2 md:p-4 zone-field" style={{
          background: 'linear-gradient(135deg, rgba(10,8,30,0.72) 0%, rgba(5,3,20,0.62) 100%)',
          border: '1px solid rgba(99,102,241,0.22)',
          boxShadow: '0 0 20px rgba(99,102,241,0.10), inset 0 0 20px rgba(0,0,0,0.25)',
        }}>
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
                    <div className="inline-flex items-center gap-1.5">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                        style={{
                          background: player === currentTurnPlayer
                            ? 'linear-gradient(135deg, #06b6d4, #6d28d9)'
                            : 'linear-gradient(135deg, #312e81, #1e1b4b)',
                          color: '#e0e7ff',
                          border: player === currentTurnPlayer ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(99,102,241,0.35)',
                          boxShadow: player === currentTurnPlayer ? '0 0 6px rgba(34,211,238,0.55)' : 'none',
                        }}
                      >
                        {player[0]?.toUpperCase()}
                      </span>
                      <h4
                        className="font-black text-sm md:text-base flex items-center gap-1.5"
                        style={{
                          color: player === currentTurnPlayer ? '#a5f3fc' : isCurrentPlayer ? '#c7d2fe' : '#ddd6fe',
                          textShadow: player === currentTurnPlayer ? '0 0 10px rgba(34,211,238,0.5)' : '0 0 6px rgba(165,180,252,0.3)',
                        }}
                      >
                        {player} {isCurrentPlayer && <span className="text-[10px] opacity-70">(Tu)</span>}
                        {player === currentTurnPlayer && <span className="text-[10px] text-cyan-300">⚡</span>}
                        {!isUnlimitedDeaths && (
                          <span className={`text-[10px] font-normal ${getDeathCount(player) >= getDeathLimit(player) ? 'text-red-400' : 'text-emerald-500/80'}`}>
                            💀{getDeathCount(player)}/{getDeathLimit(player)}
                          </span>
                        )}
                      </h4>
                      {!isCurrentPlayer && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPlayerOnline(player) ? 'bg-emerald-400' : 'bg-red-500'}`} />}
                    </div>
                    <span className="text-emerald-400/60 text-xs md:text-sm font-medium">
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
                        const cardHasEffect = hasCustomEffect(card);
                        if (cardHasEffect) {
                          console.log(`🎯 Card ${card.id} has custom effect: text="${card.text}", effect="${card.effect}"`);
                        }
                        
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
                                <div className="w-2 h-0.5 bg-gradient-to-r from-orange-500 to-red-600 animate-pulse" style={{boxShadow:'0 0 4px rgba(249,115,22,0.6)'}} />
                                <div className="relative">
                                  <div className="border-2 border-orange-500 rounded-lg shadow-lg shadow-orange-500/40 ring-1 ring-orange-400/50 animate-pulse">
                                    <Card
                                      card={parasiticCard}
                                      location="field"
                                    />
                                  </div>
                                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-600 to-red-700 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold shadow-md">
                                    {parasiticCard.owner}
                                  </div>
                                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-700 to-rose-800 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold shadow-md">
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
                          
                          {/* Activate Effect Button - show for cards with custom effects */}
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
                      <p className="text-indigo-300/60 italic col-span-full">Nessuna carta in campo</p>
                    )}
                  </div>
                </div>
              );
            });
            })()
          ) : (
            <p className="text-indigo-300/60 italic text-center">Nessun giocatore</p>
          )}
        </div>
      </div>
    </div>
  );
};

// RoundTable without memoization for real-time updates
export const RoundTable = RoundTableComponent;