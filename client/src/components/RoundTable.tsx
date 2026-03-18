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
  
  const currentTurnPlayer = gameState?.turnOrder?.[gameState?.currentTurnIndex ?? 0] || '';
  const isMyTurn = currentTurnPlayer === playerName;
  const isDraftMode = (gameState as any)?.isDraftMode || false;

  const fieldCards = gameState?.field || [];
  const players = gameState?.players || {};
  const allPlayerNames = Object.keys(players);
  const turnOrder: string[] = [];
  const scenarioCardsActive = false;

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

  // Determine player order for positioning around the table (current player is always at bottom)
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
      {/* Premium Header with Turn Indicator */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-3 landscape:mb-4 md:mb-4">
        <h2 className="text-white font-black text-xl landscape:text-2xl md:text-2xl text-center tracking-widest"
          style={{
            textShadow: '0 0 20px rgba(168,85,247,0.6), 2px 2px 4px rgba(0,0,0,0.9)',
            background: 'linear-gradient(135deg, #e879f9 0%, #c084fc 40%, #f59e0b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
          TAVOLO DA GIOCO
        </h2>
        {currentTurnPlayer && (
          <div className={`px-4 py-1.5 rounded-2xl text-xs sm:text-sm font-black whitespace-nowrap transition-all duration-500 border-2 ${
            isMyTurn 
              ? 'border-yellow-400 text-yellow-100 animate-pulse' 
              : 'border-blue-400/50 text-blue-100'
          }`} style={{
            background: isMyTurn 
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.4) 0%, rgba(251, 191, 36, 0.25) 100%)'
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(139, 92, 246, 0.2) 100%)',
            backdropFilter: 'blur(12px)',
            boxShadow: isMyTurn
              ? '0 0 20px rgba(250, 204, 21, 0.5), 0 0 40px rgba(250, 204, 21, 0.2)'
              : '0 0 12px rgba(96, 165, 250, 0.25)',
            textShadow: isMyTurn ? '0 0 12px rgba(250, 204, 21, 0.8)' : '0 0 8px rgba(147, 197, 253, 0.5)',
            letterSpacing: isMyTurn ? '0.08em' : '0.04em',
          }}>
            {isMyTurn ? '👑 TOCCA A TE!' : `⏳ Turno di ${currentTurnPlayer}`}
          </div>
        )}
      </div>
      
      {/* Rectangular Table Container */}
      <div 
        data-tutorial="field"
        className="relative w-[79vw] h-[88vh] landscape:w-[88vw] landscape:h-[88vh] sm:w-[84vw] sm:h-[84vh] md:w-[88vw] md:h-[88vh] lg:w-[91vw] lg:h-[88vh] xl:w-[91vw] xl:h-[91vh] max-w-[1488px] max-h-[1302px] min-w-[298px] min-h-[465px] mx-auto border-4 landscape:border-8 md:border-8 game-field bg-no-repeat overflow-visible"
        style={{
          borderRadius: '24px',
          backgroundImage: `url('https://i.ibb.co/Y4bv4xwz/sfondo-minkiards.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          touchAction: 'pan-y pinch-zoom',
          borderColor: 'rgba(251, 191, 36, 0.5)',
          boxShadow: '0 0 0 1px rgba(251,191,36,0.15), 0 0 40px rgba(147,51,234,0.5), 0 0 80px rgba(251,191,36,0.15), 0 8px 32px rgba(0,0,0,0.6)',
        }}
      >
        {/* Overlay - reduced to 25% */}
        <div 
          className="absolute inset-0 bg-black rounded-lg"
          style={{ borderRadius: '16px', opacity: 0.25 }}
        />

        {/* Decorative golden corner accents */}
        {/* Top-left corner */}
        <svg className="absolute top-0 left-0 z-10 pointer-events-none" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M4 44 L4 8 Q4 4 8 4 L44 4" stroke="rgba(251,191,36,0.7)" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <circle cx="4" cy="4" r="3" fill="rgba(251,191,36,0.8)"/>
          <path d="M4 20 L4 4 L20 4" stroke="rgba(251,191,36,0.4)" strokeWidth="1" fill="none"/>
        </svg>
        {/* Top-right corner */}
        <svg className="absolute top-0 right-0 z-10 pointer-events-none" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M44 44 L44 8 Q44 4 40 4 L4 4" stroke="rgba(251,191,36,0.7)" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <circle cx="44" cy="4" r="3" fill="rgba(251,191,36,0.8)"/>
          <path d="M44 20 L44 4 L28 4" stroke="rgba(251,191,36,0.4)" strokeWidth="1" fill="none"/>
        </svg>
        {/* Bottom-left corner */}
        <svg className="absolute bottom-0 left-0 z-10 pointer-events-none" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M4 4 L4 40 Q4 44 8 44 L44 44" stroke="rgba(251,191,36,0.7)" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <circle cx="4" cy="44" r="3" fill="rgba(251,191,36,0.8)"/>
          <path d="M4 28 L4 44 L20 44" stroke="rgba(251,191,36,0.4)" strokeWidth="1" fill="none"/>
        </svg>
        {/* Bottom-right corner */}
        <svg className="absolute bottom-0 right-0 z-10 pointer-events-none" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M44 4 L44 40 Q44 44 40 44 L4 44" stroke="rgba(251,191,36,0.7)" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <circle cx="44" cy="44" r="3" fill="rgba(251,191,36,0.8)"/>
          <path d="M44 28 L44 44 L28 44" stroke="rgba(251,191,36,0.4)" strokeWidth="1" fill="none"/>
        </svg>
        
        <AmbientParticles visible={true} />
        
        {/* Center Area - Decks with protection zone - centered vertically */}
        <div className="absolute top-[45%] sm:top-[45%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          {isDraftMode && (
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full shadow-lg shadow-teal-500/30 flex items-center gap-1">
              <span>🃏</span>
              <span>DRAFT — MAZZO PERSONALE</span>
            </div>
          )}
          {/* Magical halo behind decks */}
          <div className="absolute inset-0 -m-4 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.25) 0%, rgba(251,191,36,0.08) 50%, transparent 75%)',
              filter: 'blur(8px)',
            }}
          />
          <div data-tutorial="decks" className={`relative grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:gap-3 md:gap-4 items-start justify-center zone-decks rounded-xl sm:rounded-2xl p-2 sm:p-3 md:p-4 backdrop-blur-sm ${isDraftMode ? 'ring-1 ring-teal-500/40' : ''}`}
            style={{
              background: 'linear-gradient(135deg, rgba(15,10,40,0.75) 0%, rgba(30,15,60,0.65) 100%)',
              border: '1px solid rgba(139,92,246,0.3)',
              boxShadow: '0 0 30px rgba(139,92,246,0.2), inset 0 0 20px rgba(0,0,0,0.3)',
            }}
          >
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
          const isActive = player === currentTurnPlayer;
          
          return (
            <div key={player}>
              {/* Field zone glow delimiter - subtle area around player's cards */}
              <div
                className="absolute pointer-events-none z-[3]"
                style={{
                  left: `${playerPosition.x}%`,
                  top: `${playerPosition.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '120px',
                  height: '80px',
                  borderRadius: '16px',
                  border: isActive
                    ? '1px solid rgba(74,222,128,0.35)'
                    : '1px solid rgba(99,102,241,0.2)',
                  boxShadow: isActive
                    ? '0 0 16px rgba(74,222,128,0.15), inset 0 0 12px rgba(74,222,128,0.05)'
                    : '0 0 10px rgba(99,102,241,0.1), inset 0 0 8px rgba(99,102,241,0.04)',
                  background: isActive
                    ? 'rgba(34,197,94,0.04)'
                    : 'rgba(79,70,229,0.04)',
                }}
              />

              {/* Player Badge */}
              <div
                className="absolute transform -translate-x-1/2 z-20"
                style={{
                  left: `${playerPosition.x}%`,
                  top: `${Math.max(1, playerPosition.y - 6)}%`,
                }}
              >
                <span className={`text-white font-bold px-2.5 py-1.5 rounded-full text-xs shadow-lg whitespace-nowrap inline-flex items-center gap-1.5 ${
                  isActive 
                    ? 'ring-2 ring-green-400 animate-pulse' 
                    : 'ring-1 ring-white/20'
                }`} style={{
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(34,197,94,0.85) 0%, rgba(21,128,61,0.9) 100%)'
                    : 'linear-gradient(135deg, rgba(30,27,75,0.9) 0%, rgba(49,46,129,0.85) 100%)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: isActive
                    ? '0 0 12px rgba(74,222,128,0.5)'
                    : '0 2px 8px rgba(0,0,0,0.5)',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                }}>
                  {players[player]?.avatar && (
                    <span className="text-base leading-none shrink-0">{getAvatarEmoji(players[player].avatar)}</span>
                  )}
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPlayerOnline(player) ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
                  <span>{player}</span>
                  {!isUnlimitedDeaths && (
                    <span className={`text-[9px] font-bold ml-0.5 px-1 py-0.5 rounded ${
                      getDeathCount(player) >= getDeathLimit(player) 
                        ? 'bg-red-600/80 text-red-100' 
                        : 'bg-black/30 text-white/80'
                    }`}>
                      💀{getDeathCount(player)}/{getDeathLimit(player)}
                    </span>
                  )}
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
                            {/* Enhanced parasitic connector */}
                            <div className="w-3 h-1.5 rounded-full bg-gradient-to-r from-red-600 to-red-400 animate-pulse shadow-sm shadow-red-500/50" />
                            <div className={`${cardScale} relative`}>
                              <div className="border-2 border-red-500 rounded-lg shadow-lg shadow-red-500/60 ring-2 ring-red-400/70 animate-pulse">
                                <Card
                                  card={parasiticCard}
                                  location="field"
                                />
                              </div>
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold shadow-sm">
                                {parasiticCard.owner}
                              </div>
                              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold shadow-sm">
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
                  <div className="text-white/50 text-xs italic" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
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
            {/* Current player field zone glow */}
            <div
              className="absolute pointer-events-none z-[3]"
              style={{
                bottom: '10%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '70%',
                height: '22%',
                borderRadius: '20px',
                border: isMyTurn
                  ? '1px solid rgba(74,222,128,0.35)'
                  : '1px solid rgba(251,191,36,0.2)',
                boxShadow: isMyTurn
                  ? '0 0 20px rgba(74,222,128,0.12), inset 0 0 16px rgba(74,222,128,0.05)'
                  : '0 0 14px rgba(251,191,36,0.08), inset 0 0 10px rgba(251,191,36,0.04)',
                background: isMyTurn
                  ? 'rgba(34,197,94,0.03)'
                  : 'rgba(161,98,7,0.04)',
              }}
            />

            {/* Player Name at bottom */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
              <span className={`text-white font-bold px-3 py-1.5 rounded-full text-xs shadow-lg whitespace-nowrap inline-flex items-center gap-1.5 ${
                isMyTurn ? 'ring-2 ring-green-400 animate-pulse' : 'ring-1 ring-yellow-500/50'
              }`} style={{
                background: isMyTurn
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.85) 0%, rgba(21,128,61,0.9) 100%)'
                  : 'linear-gradient(135deg, rgba(161,98,7,0.85) 0%, rgba(120,53,15,0.9) 100%)',
                backdropFilter: 'blur(8px)',
                boxShadow: isMyTurn
                  ? '0 0 14px rgba(74,222,128,0.5)'
                  : '0 0 10px rgba(251,191,36,0.3)',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
              }}>
                {players[playerName]?.avatar && (
                  <span className="text-base leading-none shrink-0">{getAvatarEmoji(players[playerName].avatar)}</span>
                )}
                <span>{playerName} (Tu)</span>
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
                      {/* Left Arrow - Premium */}
                      <Button
                        onClick={() => handleMoveCard(card.id, 'left')}
                        disabled={!canMoveLeft}
                        className="p-1 h-7 w-7 rounded-full border border-white/30 disabled:border-white/10 disabled:opacity-30 transition-all hover:scale-110"
                        size="sm"
                        style={{
                          background: canMoveLeft 
                            ? 'linear-gradient(135deg, rgba(99,102,241,0.8) 0%, rgba(79,70,229,0.8) 100%)'
                            : 'rgba(30,30,50,0.5)',
                          boxShadow: canMoveLeft ? '0 0 8px rgba(99,102,241,0.4)' : 'none'
                        }}
                      >
                        <ChevronLeft size={14} />
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
                          {/* Enhanced parasitic connector */}
                          <div className="w-3 h-1.5 rounded-full bg-gradient-to-r from-red-600 to-red-400 animate-pulse shadow-sm shadow-red-500/50" />
                          <div className={`${cardScale} relative`}>
                            <div className="border-2 border-red-500 rounded-lg shadow-lg shadow-red-500/60 ring-2 ring-red-400/70 animate-pulse">
                              <Card
                                card={parasiticCard}
                                location="field"
                              />
                            </div>
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold shadow-sm">
                              {parasiticCard.owner}
                            </div>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold shadow-sm">
                              AGGANCIATO
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Right Arrow - Premium */}
                      <Button
                        onClick={() => handleMoveCard(card.id, 'right')}
                        disabled={!canMoveRight}
                        className="p-1 h-7 w-7 rounded-full border border-white/30 disabled:border-white/10 disabled:opacity-30 transition-all hover:scale-110"
                        size="sm"
                        style={{
                          background: canMoveRight
                            ? 'linear-gradient(135deg, rgba(99,102,241,0.8) 0%, rgba(79,70,229,0.8) 100%)'
                            : 'rgba(30,30,50,0.5)',
                          boxShadow: canMoveRight ? '0 0 8px rgba(99,102,241,0.4)' : 'none'
                        }}
                      >
                        <ChevronRight size={14} />
                      </Button>
                    </div>
                    
                    {/* Activate Effect Button - Premium violet electric */}
                    {hasCustomEffect(card) && (
                      <Button
                        onClick={() => handleActivateEffect(card)}
                        className="mt-1.5 px-3 py-1 h-7 text-[11px] font-bold text-white flex items-center gap-1.5 mx-auto rounded-full border border-purple-400/50 transition-all hover:scale-105"
                        size="sm"
                        style={{
                          background: 'linear-gradient(135deg, rgba(147,51,234,0.9) 0%, rgba(109,40,217,0.95) 100%)',
                          boxShadow: '0 0 16px rgba(168,85,247,0.6), 0 0 32px rgba(168,85,247,0.2)',
                          textShadow: '0 0 8px rgba(233,213,255,0.8)'
                        }}
                      >
                        <Zap size={14} />
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

      {/* CARTE IN CAMPO section for all players - Premium redesign */}
      <div className="mt-4 md:mt-8">
        <div className="flex items-center justify-center gap-3 mb-3 md:mb-4">
          <div className="h-px flex-1 max-w-24" style={{background: 'linear-gradient(to right, transparent, rgba(168,85,247,0.5))'}} />
          <h3 className="text-white font-black text-base md:text-lg text-center tracking-widest"
            style={{
              textShadow: '0 0 16px rgba(168,85,247,0.5)',
              background: 'linear-gradient(135deg, #c084fc 0%, #e879f9 50%, #f59e0b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
            CARTE IN CAMPO
          </h3>
          <div className="h-px flex-1 max-w-24" style={{background: 'linear-gradient(to left, transparent, rgba(168,85,247,0.5))'}} />
        </div>
        <div className="rounded-xl p-2 md:p-4 zone-field"
          style={{
            background: 'linear-gradient(135deg, rgba(15,10,40,0.85) 0%, rgba(20,15,55,0.8) 100%)',
            border: '1px solid rgba(99,102,241,0.3)',
            boxShadow: '0 0 24px rgba(79,70,229,0.15), inset 0 0 16px rgba(0,0,0,0.3)',
          }}
        >
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
                const isActiveTurn = player === currentTurnPlayer;
                
                return (
                <div key={player} className="mb-3 md:mb-4 last:mb-0 rounded-xl p-2 sm:p-3"
                  style={{
                    background: isCurrentPlayer
                      ? 'linear-gradient(135deg, rgba(161,98,7,0.3) 0%, rgba(120,53,15,0.2) 100%)'
                      : 'linear-gradient(135deg, rgba(30,27,75,0.4) 0%, rgba(17,24,39,0.3) 100%)',
                    border: isActiveTurn
                      ? '1px solid rgba(74,222,128,0.4)'
                      : isCurrentPlayer
                        ? '1px solid rgba(251,191,36,0.25)'
                        : '1px solid rgba(99,102,241,0.15)',
                    boxShadow: isActiveTurn ? '0 0 12px rgba(74,222,128,0.15)' : 'none'
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5 md:mb-2.5">
                    <h4 className={`font-bold text-sm md:text-base flex items-center gap-2`}
                      style={{
                        color: isActiveTurn ? '#4ade80' : isCurrentPlayer ? '#fbbf24' : '#e2e8f0',
                        textShadow: isActiveTurn 
                          ? '0 0 10px rgba(74,222,128,0.5)' 
                          : isCurrentPlayer 
                            ? '0 0 8px rgba(251,191,36,0.4)'
                            : '1px 1px 2px rgba(0,0,0,0.8)'
                      }}
                    >
                      {!isCurrentPlayer && (
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isPlayerOnline(player) ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
                      )}
                      <span>{player}</span>
                      {isCurrentPlayer && <span className="text-[11px] font-normal text-yellow-300/80">(Tu)</span>}
                      {isActiveTurn && <span className="text-xs">🟢</span>}
                      {!isUnlimitedDeaths && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          getDeathCount(player) >= getDeathLimit(player) 
                            ? 'bg-red-600/70 text-red-100' 
                            : 'bg-black/30 text-white/70'
                        }`}>
                          💀{getDeathCount(player)}/{getDeathLimit(player)}
                        </span>
                      )}
                    </h4>
                    <span className="text-white/50 text-xs md:text-sm bg-black/20 px-2 py-0.5 rounded-full">
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
                            {/* Left Arrow for current player - Premium */}
                            {isCurrentPlayer && (
                              <Button
                                onClick={() => handleMoveCard(card.id, 'left')}
                                disabled={index === 0}
                                className="p-0.5 h-5 w-5 sm:h-6 sm:w-6 rounded-full border border-white/20 disabled:border-white/5 disabled:opacity-25 transition-all hover:scale-110"
                                size="sm"
                                style={{
                                  background: index !== 0
                                    ? 'linear-gradient(135deg, rgba(99,102,241,0.7) 0%, rgba(79,70,229,0.7) 100%)'
                                    : 'rgba(30,30,50,0.4)',
                                  boxShadow: index !== 0 ? '0 0 6px rgba(99,102,241,0.4)' : 'none'
                                }}
                              >
                                <ChevronLeft size={10} />
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
                                <div className="w-2 h-1.5 rounded-full bg-gradient-to-r from-red-600 to-red-400 animate-pulse" />
                                <div className="relative">
                                  <div className="border-2 border-red-500 rounded-lg shadow-lg shadow-red-500/60 ring-2 ring-red-400/70 animate-pulse">
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
                            
                            {/* Right Arrow for current player - Premium */}
                            {isCurrentPlayer && (
                              <Button
                                onClick={() => handleMoveCard(card.id, 'right')}
                                disabled={index === playerCards.length - 1}
                                className="p-0.5 h-5 w-5 sm:h-6 sm:w-6 rounded-full border border-white/20 disabled:border-white/5 disabled:opacity-25 transition-all hover:scale-110"
                                size="sm"
                                style={{
                                  background: index !== playerCards.length - 1
                                    ? 'linear-gradient(135deg, rgba(99,102,241,0.7) 0%, rgba(79,70,229,0.7) 100%)'
                                    : 'rgba(30,30,50,0.4)',
                                  boxShadow: index !== playerCards.length - 1 ? '0 0 6px rgba(99,102,241,0.4)' : 'none'
                                }}
                              >
                                <ChevronRight size={10} />
                              </Button>
                            )}
                          </div>
                          
                          {/* Activate Effect Button - Premium */}
                          {isCurrentPlayer && hasCustomEffect(card) && (
                            <Button
                              onClick={() => handleActivateEffect(card)}
                              className="mt-1 px-2 py-0.5 h-6 text-[9px] font-bold text-white flex items-center gap-1 rounded-full border border-purple-400/40 transition-all hover:scale-105"
                              size="sm"
                              style={{
                                background: 'linear-gradient(135deg, rgba(147,51,234,0.9) 0%, rgba(109,40,217,0.95) 100%)',
                                boxShadow: '0 0 12px rgba(168,85,247,0.5)',
                                textShadow: '0 0 6px rgba(233,213,255,0.8)'
                              }}
                            >
                              <Zap size={10} />
                              Attiva Effetto
                            </Button>
                          )}
                        </div>
                      );
                      })
                    ) : (
                      <p className="text-white/40 italic col-span-full text-sm">Nessuna carta in campo</p>
                    )}
                  </div>
                </div>
              );
            });
            })()
          ) : (
            <p className="text-white/40 italic text-center">Nessun giocatore</p>
          )}
        </div>
      </div>
    </div>
  );
};

// RoundTable without memoization for real-time updates
export const RoundTable = RoundTableComponent;
