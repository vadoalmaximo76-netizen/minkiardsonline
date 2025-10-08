import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";

interface DeckProps {
  name: string;
  backImage: string;
  type: 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali';
}

export const Deck: React.FC<DeckProps> = ({ name, backImage, type }) => {
  const { gameState, playerName } = useGameState();
  const [showBrowser, setShowBrowser] = useState(false);
  const [selectedCardForZoom, setSelectedCardForZoom] = useState<any>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const remainingCards = gameState?.decks?.[type]?.length || 0;

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

  const handlePickCard = () => {
    if (remainingCards > 0) {
      socket.emit('pick-card', { deckType: type, playerName });
    }
  };

  const handleChooseCard = () => {
    console.log('SCEGLI clicked - PANNELLO ORIZZONTALE 1800x500');
    console.log('Setting showBrowser to true for deck:', name);
    console.log('Current cards in deck:', getSortedCards().length);
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

  // Function to extract filename from URL and sort alphabetically
  const getSortedCards = () => {
    if (!gameState?.decks?.[type]) return [];
    
    let filteredCards = [...gameState.decks[type]];
    
    // Apply search filter if searchTerm exists
    if (searchTerm.trim()) {
      filteredCards = filteredCards.filter(card => {
        const getFileName = (url: string) => {
          const parts = url.split('/');
          const filename = parts[parts.length - 1];
          // Remove file extension and convert spaces/dashes
          return filename.toLowerCase()
            .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
            .replace(/-/g, ' ')
            .replace(/_/g, ' ');
        };
        
        const cardName = getFileName(card.frontImage);
        return cardName.includes(searchTerm.toLowerCase().trim());
      });
    }
    
    return filteredCards.sort((a, b) => {
      // Extract filename from URL
      const getFileName = (url: string) => {
        const parts = url.split('/');
        const filename = parts[parts.length - 1];
        // Remove file extension and convert to lowercase for comparison
        return filename.toLowerCase().replace(/\.(png|jpg|jpeg|gif|webp)$/i, '');
      };
      
      const filenameA = getFileName(a.frontImage);
      const filenameB = getFileName(b.frontImage);
      
      return filenameA.localeCompare(filenameB);
    });
  };

  return (
    <div className="flex flex-col items-center gap-1 sm:gap-2 md:gap-3">
      <h3 className="text-white font-bold text-xs sm:text-sm md:text-base lg:text-lg" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>{name}</h3>
      
      <div className="relative">
        <img
          src={backImage}
          alt={`${name} back`}
          className={`w-24 h-32 rounded-lg cursor-pointer hover:scale-105 transition-transform shadow-lg ${isShuffling ? 'animate-shuffle' : ''}`}
          onClick={handlePickCard}
        />
        
        {/* Card count */}
        <div className="absolute -bottom-1 -right-1 bg-white text-black rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs">
          {remainingCards}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Button
          onClick={handleShuffle}
          className="bg-sky-blue hover:bg-sky-blue/80 text-white font-bold px-2 py-1 text-xs"
          style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
        >
          MISCHIA
        </Button>
        <Button
          onClick={handleChooseCard}
          className="bg-green-600 hover:bg-green-700 text-white font-bold px-2 py-1 text-xs"
          style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
        >
          SCEGLI
        </Button>
      </div>

      {/* Deck Browser Modal - Full Screen */}
      {showBrowser && (
        <div 
          className="fixed inset-0 bg-gray-900 flex flex-col"
          style={{ 
            zIndex: 9999
          }}
        >
            {/* Header */}
            <div className="p-3 sm:p-4 bg-gray-800 border-b-2 border-gray-600 flex-shrink-0">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white font-bold text-base sm:text-xl md:text-2xl">
                  Scegli una carta da {name}
                </h3>
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('CHIUDI clicked for deck:', name);
                    setShowBrowser(false);
                    setSearchTerm(''); // Reset search when closing
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 sm:px-6 sm:py-3 text-base sm:text-lg font-bold rounded relative z-50"
                  style={{ pointerEvents: 'auto' }}
                >
                  CHIUDI
                </Button>
              </div>
              
              {/* Search input */}
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-sm sm:text-base whitespace-nowrap">Cerca:</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nome carta..."
                  className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm sm:text-base"
                />
                {searchTerm && (
                  <Button
                    onClick={() => setSearchTerm('')}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 text-sm sm:text-base rounded whitespace-nowrap"
                  >
                    X
                  </Button>
                )}
              </div>
              
              {/* Search results info */}
              {searchTerm && (
                <div className="mt-2 text-white/70 text-sm">
                  {getSortedCards().length === 0 ? 
                    'Nessuna carta trovata' : 
                    `${getSortedCards().length} carte trovate`
                  }
                </div>
              )}
            </div>
            
            {/* Cards Grid - Full Screen with Scroll */}
            <div 
              className="flex-1 overflow-auto p-3 sm:p-4"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 sm:gap-4">
                {getSortedCards().map((card, index) => (
                  <div key={card.id} className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
                    <img
                      src={card.frontImage}
                      alt="Card"
                      className="w-full aspect-[3/4] object-cover rounded-lg border-2 border-gray-500 hover:border-white transition-all shadow-xl"
                      onClick={() => handleCardClick(card)}
                    />
                    <span className="text-white text-xs sm:text-sm mt-2 text-center w-full px-1 leading-tight font-medium">
                      {card.frontImage.split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
        </div>
      )}

      {/* Zoomed Card Modal - Full Size Display */}
      {selectedCardForZoom && (
        <div 
          className="fixed inset-0 bg-black/95 flex items-center justify-center p-4"
          style={{ zIndex: 999999999 }}
        >
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 text-center border-2 border-white/20 w-full max-w-2xl">
            {/* Card Name */}
            <h4 className="text-white font-bold text-base sm:text-xl mb-3 sm:mb-4" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
              {selectedCardForZoom.frontImage.split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase()}
            </h4>
            
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
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 sm:py-3 text-xs sm:text-sm rounded-lg w-full"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                PESCA QUESTA CARTA
              </Button>
              <Button
                onClick={() => handleRemoveCard(selectedCardForZoom.id)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 sm:py-3 text-xs sm:text-sm rounded-lg w-full"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                ELIMINA CARTA
              </Button>
              <Button
                onClick={handleCloseZoom}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 sm:py-3 text-xs sm:text-sm rounded-lg w-full"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
