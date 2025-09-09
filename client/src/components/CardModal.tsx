import React, { useState } from "react";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { X, Sword } from "lucide-react";

export const CardModal: React.FC = () => {
  const [showPlayerSelect, setShowPlayerSelect] = useState(false);
  const { selectedCard, setSelectedCard, playerName, gameState, setSelectedMosseCard } = useGameState();

  if (!selectedCard) return null;

  const isOwner = selectedCard.owner === playerName;
  const players = Object.keys(gameState?.players || {}).filter(p => p !== playerName);
  
  // Extract card name from the frontImage URL
  const getCardName = (imageUrl: string) => {
    try {
      const url = new URL(imageUrl);
      const pathname = url.pathname;
      const filename = pathname.split('/').pop() || '';
      // Remove file extension, replace hyphens with spaces, and convert to uppercase
      return filename.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase();
    } catch {
      return 'CARD';
    }
  };

  const cardName = getCardName(selectedCard.frontImage);
  
  // Determine the card location (we need to check where the card is)
  const isInField = gameState?.field?.some(card => card.id === selectedCard.id);
  const isInGraveyard = gameState?.graveyard?.some(card => card.id === selectedCard.id);

  const handleClose = () => {
    setSelectedCard(null);
  };

  const handleCedi = (targetPlayer: string) => {
    socket.emit('transfer-card', {
      cardId: selectedCard.id,
      fromPlayer: playerName,
      toPlayer: targetPlayer
    });
    setSelectedCard(null);
  };

  const handleReturnToHand = () => {
    socket.emit('return-to-hand', { cardId: selectedCard.id, playerName });
    setSelectedCard(null);
  };

  const handleReturnToDeck = () => {
    socket.emit('return-to-deck', { cardId: selectedCard.id, playerName });
    setSelectedCard(null);
  };

  const handleMoveToGraveyard = () => {
    socket.emit('move-to-graveyard', { cardId: selectedCard.id, playerName });
    setSelectedCard(null);
  };

  const handleSposta = () => {
    // Enable drag mode for the card
    socket.emit('enable-drag-mode', { cardId: selectedCard.id });
    setSelectedCard(null);
  };

  const handleAttacca = () => {
    // Set this MOSSE card as selected for attacking
    setSelectedMosseCard(selectedCard);
    setSelectedCard(null);
  };

  const handlePlay = () => {
    socket.emit('play-card', { cardId: selectedCard.id, playerName });
    setSelectedCard(null);
  };

  const handlePlayFaceDown = () => {
    socket.emit('play-card-face-down', { cardId: selectedCard.id, playerName });
    setSelectedCard(null);
  };

  const handleShowCardToPlayers = () => {
    setShowPlayerSelect(true);
  };

  const handleShowToPlayer = (targetPlayer: string) => {
    socket.emit('show-card-to-player', { 
      cardId: selectedCard.id, 
      fromPlayer: playerName, 
      toPlayer: targetPlayer,
      cardImage: selectedCard.frontImage
    });
    setShowPlayerSelect(false);
    setSelectedCard(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold text-lg">{cardName}</h3>
          <Button
            onClick={handleClose}
            className="bg-sky-blue hover:bg-sky-blue/80 text-white p-2"
            size="sm"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Large card image */}
        <div className="flex justify-center mb-6">
          <img
            src={selectedCard.frontImage}
            alt="Card"
            className="w-64 h-80 rounded-lg shadow-lg"
          />
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {/* MOSSE card ATTACCA button - show for MOSSE cards in hand or field */}
          {selectedCard.type === 'mosse' && isOwner && (
            <Button
              onClick={handleAttacca}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 flex items-center justify-center gap-2"
            >
              <Sword size={20} />
              ATTACCA
            </Button>
          )}

          {/* Field card actions */}
          {isInField && isOwner && (
            <>
              <Button
                onClick={handleReturnToHand}
                className="w-full bg-sky-blue hover:bg-sky-blue/80 text-white font-bold py-3"
              >
                RIMETTI IN MANO
              </Button>
              
              <Button
                onClick={handleReturnToDeck}
                className="w-full bg-sky-blue hover:bg-sky-blue/80 text-white font-bold py-3"
              >
                RIMETTI NEL MAZZO
              </Button>
              
              <Button
                onClick={handleMoveToGraveyard}
                className="w-full bg-sky-blue hover:bg-sky-blue/80 text-white font-bold py-3"
              >
                METTI NEL CIMITERO
              </Button>

              {/* CEDI buttons for field cards */}
              {players.length > 0 && (
                <div className="space-y-2">
                  <p className="text-white text-sm">CEDI A:</p>
                  {players.map((player) => (
                    <Button
                      key={player}
                      onClick={() => handleCedi(player)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2"
                    >
                      {player}
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Hand card actions */}
          {!isInField && !isInGraveyard && isOwner && (
            <>
              <Button
                onClick={handlePlay}
                className="w-full bg-sky-blue hover:bg-sky-blue/80 text-white font-bold py-3"
              >
                GIOCA
              </Button>
              
              <Button
                onClick={handlePlayFaceDown}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3"
              >
                GIOCA CARTA COPERTA
              </Button>
              
              <Button
                onClick={handleShowCardToPlayers}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3"
              >
                MOSTRA
              </Button>

              {/* CEDI buttons for hand cards */}
              {players.length > 0 && (
                <div className="space-y-2">
                  <p className="text-white text-sm">CEDI A:</p>
                  {players.map((player) => (
                    <Button
                      key={player}
                      onClick={() => handleCedi(player)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2"
                    >
                      {player}
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Player Selection Modal for MOSTRA */}
      {showPlayerSelect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Mostra carta a:</h3>
              <Button
                onClick={() => setShowPlayerSelect(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1"
                size="sm"
              >
                Chiudi
              </Button>
            </div>
            
            <div className="space-y-2">
              {players.map((player) => (
                <Button
                  key={player}
                  onClick={() => handleShowToPlayer(player)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2"
                >
                  {player}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
