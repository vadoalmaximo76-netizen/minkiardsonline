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
    console.log('SCEGLI clicked - PANNELLO ORIZZONTALE 1800x500');
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

      {/* Deck Browser Modal */}
      {showBrowser && (
        <div 
          className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-90 flex items-center justify-center"
          style={{ 
            zIndex: 999999,
            position: 'fixed',
            inset: 0
          }}
        >
          <div 
            className="bg-gray-900 rounded-lg shadow-2xl border-2 border-gray-600"
            style={{ 
              width: '60vw',
              height: '50vh',
              minWidth: '800px',
              minHeight: '450px',
              position: 'relative'
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 bg-gray-800 border-b-2 border-gray-600 rounded-t-lg">
              <h3 className="text-white font-bold text-2xl">
                Scegli una carta da {name}
              </h3>
              <Button
                onClick={() => setShowBrowser(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 text-lg font-bold rounded"
              >
                CHIUDI
              </Button>
            </div>
            
            {/* Cards Grid */}
            <div 
              className="bg-gray-800 p-4 overflow-y-auto overflow-x-hidden rounded-b-lg"
              style={{ 
                height: 'calc(100% - 80px)'
              }}
            >
              <div className="grid grid-cols-6 gap-3">
                {getSortedCards().map((card, index) => (
                  <div key={card.id} className="flex flex-col items-center bg-gray-700 rounded p-1 hover:bg-gray-600 cursor-pointer">
                    <img
                      src={card.frontImage}
                      alt="Card"
                      className="w-full aspect-[3/4] object-cover rounded border border-gray-500 hover:border-white transition-all"
                      onClick={() => handleCardClick(card)}
                    />
                    <span className="text-white text-xs mt-1 text-center truncate w-full">
                      {card.frontImage.split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').substring(0, 8)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zoomed Card Modal */}
      {selectedCardForZoom && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-gray-800 rounded-xl p-8 max-w-lg w-full text-center border-2 border-white/20">
            {/* Card Name */}
            <h4 className="text-white font-bold text-xl mb-4" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
              {selectedCardForZoom.frontImage.split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase()}
            </h4>
            
            {/* Large Card Image */}
            <div className="mb-6">
              <img
                src={selectedCardForZoom.frontImage}
                alt="Selected Card"
                className="w-64 h-auto rounded-xl mx-auto shadow-2xl border-2 border-white/10"
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => handleCardSelect(selectedCardForZoom.id)}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 text-lg rounded-lg"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                PESCA QUESTA CARTA
              </Button>
              <Button
                onClick={handleCloseZoom}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold px-8 py-4 text-lg rounded-lg"
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
