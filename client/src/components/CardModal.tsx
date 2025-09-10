import React, { useState } from "react";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { X, Sword } from "lucide-react";

export const CardModal: React.FC = () => {
  const [showPlayerSelect, setShowPlayerSelect] = useState(false);
  const [showTransferSelect, setShowTransferSelect] = useState(false);
  const [showSwapSelect, setShowSwapSelect] = useState(false);
  const [showFusionSelect, setShowFusionSelect] = useState(false);
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

  const handleTransferToPlayer = (targetPlayer: string) => {
    socket.emit('transfer-card', {
      cardId: selectedCard.id,
      fromPlayer: playerName,
      toPlayer: targetPlayer
    });
    setShowTransferSelect(false);
    setSelectedCard(null);
  };

  const handleSwapCards = (targetPlayer: string, targetCardId: string) => {
    socket.emit('swap-personaggi-cards', {
      player1: playerName,
      card1Id: selectedCard.id,
      player2: targetPlayer,
      card2Id: targetCardId
    });
    setShowSwapSelect(false);
    setSelectedCard(null);
  };

  // FUSION SYSTEM HANDLERS
  const handleFusion = () => {
    setShowFusionSelect(true);
  };

  const handleFuseWith = (targetCardId: string) => {
    socket.emit('fuse-cards', {
      leaderCardId: selectedCard.id,
      targetCardId: targetCardId,
      playerName: playerName
    });
    setShowFusionSelect(false);
    setSelectedCard(null);
  };

  const handleSeparate = () => {
    socket.emit('separate-cards', {
      cardId: selectedCard.id,
      playerName: playerName
    });
    setSelectedCard(null);
  };

  // Get PERSONAGGI cards from other players in the field
  const getOtherPlayersPersonaggiCards = () => {
    if (!gameState?.field) return [];
    
    return gameState.field.filter(card => 
      card.type === 'personaggi' && 
      card.owner !== playerName
    );
  };

  // Get ALL PERSONAGGI cards in the field for fusion (any player)
  const getAllPersonaggiCards = () => {
    if (!gameState?.field) return [];
    
    return gameState.field.filter(card => 
      card.type === 'personaggi' && 
      card.id !== selectedCard.id && // Exclude the current card
      !card.isFused // Exclude already fused cards
    );
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

              {/* CEDI and SCAMBIA buttons for field cards */}
              <div className="space-y-2">
                <Button
                  onClick={() => setShowTransferSelect(true)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
                  disabled={players.length === 0}
                >
                  CEDI
                </Button>
                
                {/* SCAMBIA button only for PERSONAGGI cards */}
                {selectedCard.type === 'personaggi' && (
                  <Button
                    onClick={() => setShowSwapSelect(true)}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3"
                    disabled={getOtherPlayersPersonaggiCards().length === 0}
                  >
                    SCAMBIA
                  </Button>
                )}

                {/* FUSION SYSTEM buttons only for PERSONAGGI cards */}
                {selectedCard.type === 'personaggi' && (
                  <>
                    {/* FONDI button - show only if card is NOT fused */}
                    {!selectedCard.isFused && (
                      <Button
                        onClick={handleFusion}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3"
                        disabled={getAllPersonaggiCards().length === 0}
                      >
                        FONDI
                      </Button>
                    )}

                    {/* SEPARA button - show only if card IS fused */}
                    {selectedCard.isFused && (
                      <Button
                        onClick={handleSeparate}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3"
                      >
                        SEPARA
                      </Button>
                    )}
                  </>
                )}
              </div>
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

              {/* CEDI button for hand cards */}
              <Button
                onClick={() => setShowTransferSelect(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
                disabled={players.length === 0}
              >
                CEDI
              </Button>
              
              {/* SCAMBIA button only for PERSONAGGI cards in hand */}
              {selectedCard.type === 'personaggi' && (
                <Button
                  onClick={() => setShowSwapSelect(true)}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3"
                  disabled={getOtherPlayersPersonaggiCards().length === 0}
                >
                  SCAMBIA
                </Button>
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

      {/* Player Selection Modal for CEDI */}
      {showTransferSelect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Cedi carta a:</h3>
              <Button
                onClick={() => setShowTransferSelect(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1"
                size="sm"
              >
                Chiudi
              </Button>
            </div>
            
            {players.length > 0 ? (
              <div className="space-y-2">
                {players.map((player) => (
                  <Button
                    key={player}
                    onClick={() => handleTransferToPlayer(player)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2"
                  >
                    {player}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-white text-center">Nessun altro giocatore disponibile</p>
            )}
          </div>
        </div>
      )}

      {/* Card Swap Modal for PERSONAGGI */}
      {showSwapSelect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Scambia con carta PERSONAGGI:</h3>
              <Button
                onClick={() => setShowSwapSelect(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1"
                size="sm"
              >
                Chiudi
              </Button>
            </div>
            
            {getOtherPlayersPersonaggiCards().length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getOtherPlayersPersonaggiCards().map((card) => {
                  const cardName = card.frontImage.split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase() || 'CARTA';
                  
                  return (
                    <div 
                      key={card.id} 
                      className="bg-gray-700 rounded-lg p-3 hover:bg-gray-600 cursor-pointer transition-colors"
                      onClick={() => handleSwapCards(card.owner, card.id)}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={card.frontImage}
                          alt={cardName}
                          className="w-16 h-20 rounded object-cover"
                        />
                        <div className="flex-1">
                          <h4 className="text-white font-bold text-sm mb-1">{cardName}</h4>
                          <p className="text-gray-300 text-xs">Proprietario: {card.owner}</p>
                          {card.text && (
                            <p className="text-gray-400 text-xs mt-1">Note: {card.text}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-white text-center">Nessuna carta PERSONAGGI disponibile per lo scambio</p>
            )}
          </div>
        </div>
      )}

      {/* Card Fusion Modal for PERSONAGGI */}
      {showFusionSelect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Fondi con quale PERSONAGGIO:</h3>
              <Button
                onClick={() => setShowFusionSelect(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1"
                size="sm"
              >
                Chiudi
              </Button>
            </div>
            
            {getAllPersonaggiCards().length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getAllPersonaggiCards().map((card) => {
                  const cardName = card.frontImage.split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase() || 'CARTA';
                  
                  return (
                    <div 
                      key={card.id} 
                      className="bg-gray-700 rounded-lg p-3 hover:bg-gray-600 cursor-pointer transition-colors"
                      onClick={() => handleFuseWith(card.id)}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={card.frontImage}
                          alt={cardName}
                          className="w-16 h-20 rounded object-cover"
                        />
                        <div className="flex-1">
                          <h4 className="text-white font-bold text-sm mb-1">{cardName}</h4>
                          <p className="text-gray-300 text-xs">Proprietario: {card.owner}</p>
                          {card.text && (
                            <p className="text-gray-400 text-xs mt-1">Note: {card.text}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-white text-center">Nessun PERSONAGGIO disponibile per la fusione</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
