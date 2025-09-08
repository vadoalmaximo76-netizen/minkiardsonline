import React from "react";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { X } from "lucide-react";

export const CardModal: React.FC = () => {
  const { selectedCard, setSelectedCard, playerName, gameState } = useGameState();

  if (!selectedCard) return null;

  const isOwner = selectedCard.owner === playerName;
  const players = Object.keys(gameState?.players || {}).filter(p => p !== playerName);

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold text-lg">Card Actions</h3>
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
            className="w-48 h-72 rounded-lg shadow-lg"
          />
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {isOwner && (
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
              
              <Button
                onClick={handleSposta}
                className="w-full bg-sky-blue hover:bg-sky-blue/80 text-white font-bold py-3"
              >
                SPOSTA
              </Button>

              {/* CEDI button with player selection */}
              {players.length > 0 && (
                <div className="space-y-2">
                  <p className="text-white text-sm">CEDI A:</p>
                  {players.map((player) => (
                    <Button
                      key={player}
                      onClick={() => handleCedi(player)}
                      className="w-full bg-sky-blue hover:bg-sky-blue/80 text-white font-bold py-2"
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
    </div>
  );
};
