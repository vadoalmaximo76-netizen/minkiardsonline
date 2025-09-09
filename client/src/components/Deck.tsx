import React, { useState } from "react";
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
  
  const remainingCards = gameState?.decks?.[type]?.length || 0;

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
    setShowBrowser(true);
  };

  const handleCardClick = (card: any) => {
    setSelectedCardForZoom(card);
  };

  const handleCardSelect = (cardId: string) => {
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
    
    return [...gameState.decks[type]].sort((a, b) => {
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
      <h3 className="text-white font-bold text-xs sm:text-sm md:text-base lg:text-lg">{name}</h3>
      
      <div className="relative">
        <img
          src={backImage}
          alt={`${name} back`}
          className={`w-20 h-28 rounded-lg cursor-pointer hover:scale-105 transition-transform shadow-lg ${isShuffling ? 'animate-shuffle' : ''}`}
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
        >
          MISCHIA
        </Button>
        <Button
          onClick={handleChooseCard}
          className="bg-green-600 hover:bg-green-700 text-white font-bold px-2 py-1 text-xs"
        >
          SCEGLI
        </Button>
      </div>

      {/* Deck Browser Modal */}
      {showBrowser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Scegli una carta da {name}</h3>
              <Button
                onClick={() => setShowBrowser(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2"
              >
                Chiudi
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {getSortedCards().map((card) => (
                <div key={card.id} className="flex flex-col items-center">
                  <img
                    src={card.frontImage}
                    alt="Card"
                    className="w-20 h-28 rounded-lg cursor-pointer hover:scale-105 transition-transform shadow-lg"
                    onClick={() => handleCardClick(card)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Zoomed Card Modal */}
      {selectedCardForZoom && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full text-center">
            <div className="mb-4">
              <img
                src={selectedCardForZoom.frontImage}
                alt="Selected Card"
                className="w-48 h-auto rounded-lg mx-auto shadow-2xl"
              />
            </div>
            
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => handleCardSelect(selectedCardForZoom.id)}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-3"
              >
                PESCA
              </Button>
              <Button
                onClick={() => handleRemoveCard(selectedCardForZoom.id)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-3"
              >
                RIMUOVI
              </Button>
              <Button
                onClick={handleCloseZoom}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold px-4 py-3"
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
