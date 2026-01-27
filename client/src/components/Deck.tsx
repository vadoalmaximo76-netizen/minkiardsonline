import React, { useState, useEffect, memo, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";

interface DeckProps {
  name: string;
  backImage: string;
  type: 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali';
}

const DeckComponent: React.FC<DeckProps> = ({ name, backImage, type }) => {
  const { gameState, playerName } = useGameState();
  const [showBrowser, setShowBrowser] = useState(false);
  const [selectedCardForZoom, setSelectedCardForZoom] = useState<any>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deckCards, setDeckCards] = useState<any[]>([]);
  const [isLoadingDeck, setIsLoadingDeck] = useState(false);
  
  // Use deckCounts for faster access (pre-calculated on server)
  // Fallback to array length for backward compatibility
  const deckType = type === 'personaggi_speciali' ? 'personaggiSpeciali' : type;
  const remainingCards = (gameState as any)?.deckCounts?.[deckType] ?? gameState?.decks?.[type]?.length ?? 0;

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showBrowser) {
        console.log('ESC pressed - closing deck browser for:', name);
        setShowBrowser(false);
        setSearchTerm('');
      }
    };

    if (showBrowser) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showBrowser, name]);

  // Listen for deck shuffle events from server to trigger animation
  useEffect(() => {
    const handleDeckShuffled = (data: { deckType: string }) => {
      if (data.deckType === type) {
        setIsShuffling(true);
        setTimeout(() => {
          setIsShuffling(false);
        }, 1000);
      }
    };

    socket.on('deck-shuffled', handleDeckShuffled);
    return () => {
      socket.off('deck-shuffled', handleDeckShuffled);
    };
  }, [type]);

  const handleShuffle = () => {
    // Start shuffle animation
    setIsShuffling(true);
    
    // Send shuffle request to server
    socket.emit('shuffle-deck', { deckType: type });
    
    // Stop animation after 1 second
    setTimeout(() => {
      setIsShuffling(false);
    }, 1000);
  };

  // Track pending pick for optimistic UI with server acknowledgment
  const [isPicking, setIsPicking] = useState(false);
  
  // Listen for server acknowledgment to clear pending state
  useEffect(() => {
    const handlePickResult = () => {
      setIsPicking(false);
    };
    
    // Clear pending state on any card pick confirmation or game state update
    socket.on('card-picked-private', handlePickResult);
    
    return () => {
      socket.off('card-picked-private', handlePickResult);
    };
  }, []);

  const handlePickCard = () => {
    if (remainingCards > 0 && !isPicking) {
      // Optimistic UI: show immediate feedback
      setIsPicking(true);
      socket.emit('pick-card', { deckType: type, playerName });
      
      // Fallback timeout in case server doesn't respond (e.g., network failure)
      setTimeout(() => setIsPicking(false), 3000);
    }
  };

  // Listen for deck contents response
  useEffect(() => {
    const handleDeckContents = (data: { deckType: string; cards: any[] }) => {
      if (data.deckType === type) {
        setDeckCards(data.cards);
        setIsLoadingDeck(false);
      }
    };
    
    socket.on('deck-contents', handleDeckContents);
    return () => {
      socket.off('deck-contents', handleDeckContents);
    };
  }, [type]);

  const handleChooseCard = () => {
    console.log('SCEGLI clicked - fetching deck contents for:', name);
    
    // Notify other players that this player is choosing a card
    socket.emit('player-choosing-card', { playerName, deckName: name });
    
    // Fetch deck contents on demand (not stored in game state anymore for performance)
    setIsLoadingDeck(true);
    socket.emit('get-deck-contents', { deckType: type });
    
    setShowBrowser(true);
  };

  const handleCardClick = (card: any) => {
    setSelectedCardForZoom(card);
  };

  const handleCardSelect = (cardId: string) => {
    console.log('PESCA QUESTA CARTA clicked:', { deckType: type, cardId, playerName });
    socket.emit('choose-specific-card', { deckType: type, cardId, playerName });
    setSelectedCardForZoom(null);
    setShowBrowser(false);
  };

  const handleCloseZoom = () => {
    setSelectedCardForZoom(null);
  };

  const handleRemoveCard = (cardId: string) => {
    socket.emit('remove-card-to-graveyard', { 
      deckType: type, 
      cardId, 
      playerName,
      section: 'CARTE CANCELLATE'
    });
    setSelectedCardForZoom(null);
    setShowBrowser(false);
  };

  // Helper to get card display name (works for both URL-based and custom base64 cards)
  const getCardDisplayName = (card: any): string => {
    // First priority: Check if card has a custom name property (for permanent/custom cards)
    if (card.name && card.name.trim()) {
      return card.name.toUpperCase();
    }
    
    // Second priority: If card has a text field with a name, use the first line (before any PTI/Stars info)
    if (card.text && card.text.trim()) {
      const firstLine = card.text.split('\n')[0].trim();
      if (firstLine && !firstLine.startsWith('PTI:') && !firstLine.startsWith('Stelle:')) {
        return firstLine.toUpperCase();
      }
    }
    
    // For base64 images (custom cards), return a generic name if no name/text
    if (card.frontImage?.startsWith('data:')) {
      return 'CARTA PERSONALIZZATA';
    }
    
    // Extract from URL for regular cards
    const parts = card.frontImage?.split('/') || [];
    const filename = parts[parts.length - 1] || '';
    return filename.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase();
  };

  // Function to extract filename from URL and sort alphabetically
  // Uses locally fetched deckCards (fetched on demand when SCEGLI opens)
  const getSortedCards = () => {
    if (!deckCards || deckCards.length === 0) return [];
    
    let filteredCards = [...deckCards];
    
    // Apply search filter if searchTerm exists
    if (searchTerm.trim()) {
      filteredCards = filteredCards.filter(card => {
        const cardName = getCardDisplayName(card).toLowerCase();
        return cardName.includes(searchTerm.toLowerCase().trim());
      });
    }
    
    return filteredCards.sort((a, b) => {
      const nameA = getCardDisplayName(a).toLowerCase();
      const nameB = getCardDisplayName(b).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  };

  const getShortName = (fullName: string) => {
    const shortNames: Record<string, string> = {
      'PERSONAGGI': 'PERS',
      'MOSSE': 'MOSSE',
      'BONUS': 'BONUS',
      'SPECIALI': 'SPEC'
    };
    return shortNames[fullName] || fullName;
  };

  return (
    <div className="flex flex-col items-center gap-1 sm:gap-1.5 md:gap-2 w-[70px] sm:w-[80px] md:w-auto">
      <h3 className="text-white font-bold text-[9px] sm:text-xs md:text-sm lg:text-base leading-tight text-center truncate w-full" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
        <span className="sm:hidden">{getShortName(name)}</span>
        <span className="hidden sm:inline">{name}</span>
      </h3>
      
      <div className="relative">
        <img
          src={backImage}
          alt={`${name} back`}
          className={`w-14 sm:w-16 md:w-20 lg:w-24 aspect-[2/3] object-cover rounded-md sm:rounded-lg md:rounded-xl cursor-pointer deck-3d shadow-lg transition-all duration-150 ${isShuffling ? 'animate-shuffle' : ''} ${isPicking ? 'scale-95 opacity-70' : 'hover:scale-105'}`}
          onClick={handlePickCard}
        />
        
        {/* Card count */}
        <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 bg-white text-black rounded-full w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 flex items-center justify-center font-bold text-[8px] sm:text-[10px] md:text-xs">
          {remainingCards}
        </div>
      </div>

      <Button
        onClick={handleChooseCard}
        className="bg-green-600 hover:bg-green-700 text-white font-bold px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[8px] sm:text-[10px] md:text-xs rounded w-full"
        style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
      >
        SCEGLI
      </Button>

      {/* Deck Browser Modal - Portal to Body for Top Z-Index */}
      {showBrowser && createPortal(
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-2 sm:p-4"
          style={{ 
            zIndex: 999999
          }}
          onClick={() => {
            setShowBrowser(false);
            setSearchTerm('');
          }}
        >
          <div 
            className="premium-panel flex flex-col w-[98vw] h-[95vh] sm:w-[95vw] sm:h-[92vh] lg:w-[92vw] lg:h-[85vh] max-w-[2000px]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-3 sm:p-4 lg:p-6 bg-gray-800 border-b-2 border-gray-600 flex-shrink-0">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white font-bold text-lg sm:text-xl lg:text-3xl">
                  Scegli una carta da {name}
                </h3>
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('CHIUDI clicked for deck:', name);
                    setShowBrowser(false);
                    setSearchTerm('');
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 sm:px-6 sm:py-3 lg:px-8 lg:py-4 text-base sm:text-lg lg:text-xl font-bold rounded relative z-50"
                  style={{ pointerEvents: 'auto' }}
                >
                  CHIUDI
                </Button>
              </div>
              
              {/* Search input */}
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-sm sm:text-base lg:text-lg whitespace-nowrap">Cerca:</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nome carta..."
                  className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm sm:text-base lg:text-lg"
                />
                {searchTerm && (
                  <Button
                    onClick={() => setSearchTerm('')}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 text-sm sm:text-base lg:text-lg rounded whitespace-nowrap"
                  >
                    X
                  </Button>
                )}
              </div>
              
              {/* Search results info */}
              {searchTerm && (
                <div className="mt-2 text-white/70 text-sm lg:text-base">
                  {getSortedCards().length === 0 ? 
                    'Nessuna carta trovata' : 
                    `${getSortedCards().length} carte trovate`
                  }
                </div>
              )}
            </div>
            
            {/* Cards Grid - Responsive with Larger Cards */}
            <div 
              className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6"
            >
              <div 
                className="grid gap-4 sm:gap-5 lg:gap-6"
                style={{
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                }}
              >
                {getSortedCards().map((card, index) => (
                  <div key={card.id} className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
                    <img
                      src={card.frontImage}
                      alt="Card"
                      className={`w-full aspect-[3/4] object-cover rounded-xl border-2 hover:border-white transition-all shadow-xl ${
                        card.id?.startsWith('permanent-') || card.id?.startsWith('custom-') 
                          ? 'border-green-500' 
                          : 'border-gray-500'
                      }`}
                      onClick={() => handleCardClick(card)}
                    />
                    <span className="text-white text-xs sm:text-sm lg:text-base mt-2 text-center w-full px-1 leading-tight font-medium">
                      {getCardDisplayName(card)}
                    </span>
                    {(card.id?.startsWith('permanent-') || card.id?.startsWith('custom-')) && (
                      <span className="text-green-400 text-[10px] mt-0.5">PERSONALIZZATA</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Zoomed Card Modal - Portal to Body */}
      {selectedCardForZoom && createPortal(
        <div 
          className="fixed inset-0 bg-black/95 flex items-center justify-center p-4"
          style={{ zIndex: 9999999 }}
        >
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 text-center border-2 border-white/20 w-full max-w-2xl">
            {/* Card Name */}
            <h4 className="text-white font-bold text-base sm:text-xl lg:text-2xl mb-3 sm:mb-4" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
              {getCardDisplayName(selectedCardForZoom)}
            </h4>
            {(selectedCardForZoom.id?.startsWith('permanent-') || selectedCardForZoom.id?.startsWith('custom-')) && (
              <span className="inline-block bg-green-600 text-white text-xs px-2 py-1 rounded mb-3">CARTA PERSONALIZZATA</span>
            )}
            
            {/* Full Size Card Image */}
            <div className="mb-4 flex items-center justify-center" style={{ minHeight: '400px', maxHeight: '60vh' }}>
              <img
                src={selectedCardForZoom.frontImage}
                alt="Selected Card"
                className="max-w-full max-h-full rounded-xl shadow-2xl border-2 border-white/10"
                style={{ objectFit: 'contain' }}
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => handleCardSelect(selectedCardForZoom.id)}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 sm:py-3 lg:py-4 text-xs sm:text-sm lg:text-base rounded-xl w-full"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                PESCA QUESTA CARTA
              </Button>
              <Button
                onClick={() => handleRemoveCard(selectedCardForZoom.id)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 sm:py-3 lg:py-4 text-xs sm:text-sm lg:text-base rounded-xl w-full"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                ELIMINA CARTA
              </Button>
              <Button
                onClick={handleCloseZoom}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 sm:py-3 lg:py-4 text-xs sm:text-sm lg:text-base rounded-xl w-full"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                Chiudi
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// Memoized Deck component - only re-render when props or deck count changes
export const Deck = memo(DeckComponent);
