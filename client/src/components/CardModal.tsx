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
  const [showVoodooSelect, setShowVoodooSelect] = useState(false);
  const [voodooCard1, setVoodooCard1] = useState<string | null>(null);
  const [voodooCard2, setVoodooCard2] = useState<string | null>(null);
  const [showDuelSelect, setShowDuelSelect] = useState(false);
  const { selectedCard, setSelectedCard, playerName, gameState, setSelectedMosseCard } = useGameState();

  if (!selectedCard) return null;

  // Check if current player is the game master (first in turn order)
  const isMaster = gameState?.turnOrder?.[0] === playerName;
  
  // Check if player owns the card OR is master and card belongs to CPU
  const isOwner = selectedCard.owner === playerName || (isMaster && selectedCard.owner?.startsWith('CPU-'));
  const players = Object.keys(gameState?.players || {}).filter(p => p !== playerName);
  
  // Use card owner if master is controlling CPU card, otherwise use current player name
  const effectivePlayerName = (isMaster && selectedCard.owner?.startsWith('CPU-')) ? selectedCard.owner : playerName;
  
  // Check if this is a face-down card belonging to another player
  const isEnemyFaceDownCard = selectedCard.faceDown && !isOwner;
  
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

  // For enemy face-down cards, show generic name
  const cardName = isEnemyFaceDownCard ? 'CARTA COPERTA' : getCardName(selectedCard.frontImage);
  
  // Determine the card location (we need to check where the card is)
  const isInField = gameState?.field?.some(card => card.id === selectedCard.id);
  const isInGraveyard = gameState?.graveyard?.some(card => card.id === selectedCard.id);

  const handleClose = () => {
    setSelectedCard(null);
  };

  const handleCedi = (targetPlayer: string) => {
    socket.emit('transfer-card', {
      cardId: selectedCard.id,
      fromPlayer: effectivePlayerName,
      toPlayer: targetPlayer
    });
    setSelectedCard(null);
  };

  const handleReturnToHand = () => {
    socket.emit('return-to-hand', { cardId: selectedCard.id, playerName: effectivePlayerName });
    setSelectedCard(null);
  };

  const handleReturnToDeck = () => {
    socket.emit('return-to-deck', { cardId: selectedCard.id, playerName: effectivePlayerName });
    setSelectedCard(null);
  };

  const handleMoveToGraveyard = () => {
    socket.emit('move-to-graveyard', { cardId: selectedCard.id, playerName: effectivePlayerName });
    setSelectedCard(null);
  };

  const handleSposta = () => {
    // Enable drag mode for the card
    socket.emit('enable-drag-mode', { cardId: selectedCard.id });
    setSelectedCard(null);
  };

  const handleAttacca = () => {
    // Check if player's character has 0 stars
    const playerCharacter = gameState?.field?.find(
      card => card.owner === effectivePlayerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali')
    );
    
    if (playerCharacter && playerCharacter.text) {
      // Check for "Stelle: 0" or "stelle: 0" in the notes
      const starsMatch = playerCharacter.text.match(/stelle:\s*0/i);
      if (starsMatch) {
        alert('❌ Il tuo personaggio ha 0 stelle e non può usare carte MOSSE!');
        setSelectedCard(null);
        return;
      }
    }
    
    // Set this MOSSE card as selected for attacking
    setSelectedMosseCard(selectedCard);
    setSelectedCard(null);
  };

  const handlePlay = () => {
    socket.emit('play-card', { cardId: selectedCard.id, playerName: effectivePlayerName });
    setSelectedCard(null);
  };

  const handlePlayFaceDown = () => {
    socket.emit('play-card-face-down', { cardId: selectedCard.id, playerName: effectivePlayerName });
    setSelectedCard(null);
  };

  const handleShowCardToPlayers = () => {
    setShowPlayerSelect(true);
  };

  const handleShowToPlayer = (targetPlayer: string) => {
    socket.emit('show-card-to-player', { 
      cardId: selectedCard.id, 
      fromPlayer: effectivePlayerName, 
      toPlayer: targetPlayer,
      cardImage: selectedCard.frontImage
    });
    setShowPlayerSelect(false);
    setSelectedCard(null);
  };

  const handleTransferToPlayer = (targetPlayer: string) => {
    socket.emit('transfer-card', {
      cardId: selectedCard.id,
      fromPlayer: effectivePlayerName,
      toPlayer: targetPlayer
    });
    setShowTransferSelect(false);
    setSelectedCard(null);
  };

  const handleSwapCards = (targetPlayer: string, targetCardId: string) => {
    socket.emit('swap-cards', {
      player1: effectivePlayerName,
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

  const handleDuplicate = () => {
    socket.emit('duplicate-card', {
      cardId: selectedCard.id
    });
    setSelectedCard(null);
  };

  // BAMBOLA VOODOO handlers
  const handleActivateVoodoo = () => {
    setShowVoodooSelect(true);
  };

  const handleVoodooCardSelect = (cardId: string) => {
    if (!voodooCard1) {
      setVoodooCard1(cardId);
    } else if (!voodooCard2 && cardId !== voodooCard1) {
      setVoodooCard2(cardId);
    }
  };

  const handleConfirmVoodoo = () => {
    if (voodooCard1 && voodooCard2 && selectedCard) {
      socket.emit('voodoo:activate', {
        bonusCardId: selectedCard.id,
        card1Id: voodooCard1,
        card2Id: voodooCard2,
        activatedBy: playerName
      });
      setShowVoodooSelect(false);
      setVoodooCard1(null);
      setVoodooCard2(null);
      setSelectedCard(null);
    }
  };

  const handleCancelVoodoo = () => {
    setShowVoodooSelect(false);
    setVoodooCard1(null);
    setVoodooCard2(null);
  };

  // DUELLO handlers
  const handleDuelStart = (opponentCharacterId: string) => {
    if (selectedCard) {
      socket.emit('duel:start', {
        duelCardId: selectedCard.id,
        initiatorPlayer: playerName,
        opponentCharacterId: opponentCharacterId
      });
      setShowDuelSelect(false);
      setSelectedCard(null);
    }
  };

  const isBambolaVoodoo = selectedCard?.frontImage?.includes('BAMBOLA-VOODOO') || selectedCard?.frontImage?.includes('BAMBOLA_VOODOO');
  const isDuello = selectedCard?.frontImage?.includes('DUELLO') || selectedCard?.frontImage?.includes('duello');

  // Check if this card has an active voodoo link
  const hasVoodooLink = gameState?.voodooLinks?.some((link: any) => 
    link.card1Id === selectedCard?.id || link.card2Id === selectedCard?.id
  );

  const handleRemoveVoodoo = () => {
    if (selectedCard) {
      socket.emit('voodoo:remove', {
        cardId: selectedCard.id
      });
      setSelectedCard(null);
    }
  };

  // Get PERSONAGGI cards from other players in the field
  const getOtherPlayersPersonaggiCards = () => {
    if (!gameState?.field) return [];
    
    return gameState.field.filter(card => 
      card.type === 'personaggi' && 
      card.owner !== playerName
    );
  };

  // Get cards of the same type as selected card from other players in field and hand
  const getOtherPlayersCardsOfSameType = () => {
    const cards = [];
    
    // Add cards from field
    if (gameState?.field) {
      cards.push(...gameState.field.filter(card => 
        card.type === selectedCard.type && 
        card.owner !== playerName
      ));
    }
    
    // Add cards from other players' hands
    if (gameState?.players) {
      Object.entries(gameState.players).forEach(([otherPlayerName, player]) => {
        if (otherPlayerName !== playerName) { // Not current player
          cards.push(...player.hand.filter(card => 
            card.type === selectedCard.type
          ));
        }
      });
    }
    
    return cards;
  };

  // Get ALL FUSABLE cards (PERSONAGGI and PERSONAGGI_SPECIALI) in the field for fusion (any player)
  // UNLIMITED FUSION: Cards can be fused even if already part of another fusion
  const getAllFusableCards = () => {
    if (!gameState?.field) return [];
    
    return gameState.field.filter(card => 
      (card.type === 'personaggi' || card.type === 'personaggi_speciali') && 
      card.id !== selectedCard.id // Exclude only the current card itself
      // No longer excluding already fused cards - unlimited fusion!
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
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
            src={isEnemyFaceDownCard ? selectedCard.backImage : selectedCard.frontImage}
            alt="Card"
            className={`w-64 h-80 rounded-lg shadow-lg ${isEnemyFaceDownCard ? 'ring-4 ring-orange-400 ring-opacity-50' : ''}`}
          />
        </div>

        {/* Face-down card message for enemy cards */}
        {isEnemyFaceDownCard && (
          <div className="text-center mb-6">
            <p className="text-orange-400 font-bold text-lg mb-2">🔒 CARTA COPERTA</p>
            <p className="text-gray-400 text-sm">
              Questa carta appartiene a <span className="text-white font-semibold">{selectedCard.owner}</span> ed è coperta.
            </p>
            <p className="text-gray-400 text-sm">
              Sarà rivelata quando il proprietario la scoperchia o usa "MOSTRA".
            </p>
          </div>
        )}

        {/* Action buttons - hidden for enemy face-down cards */}
        {!isEnemyFaceDownCard && (
          <div className="grid grid-cols-3 gap-3">
            {/* MOSSE card ATTACCA button - show for MOSSE cards in hand or field */}
            {selectedCard.type === 'mosse' && isOwner && (
            <Button
              onClick={handleAttacca}
              className="aspect-square bg-red-600 hover:bg-red-700 text-white font-bold p-2 flex flex-col items-center justify-center gap-1 text-xs"
            >
              <Sword size={16} />
              ATTACCA
            </Button>
          )}

          {/* Field card actions */}
          {isInField && isOwner && (
            <>
              <Button
                onClick={handleReturnToHand}
                className="aspect-square bg-sky-blue hover:bg-sky-blue/80 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
              >
                📤
                MANO
              </Button>
              
              <Button
                onClick={handleReturnToDeck}
                className="aspect-square bg-sky-blue hover:bg-sky-blue/80 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
              >
                🗂️
                MAZZO
              </Button>
              
              <Button
                onClick={handleMoveToGraveyard}
                className="aspect-square bg-sky-blue hover:bg-sky-blue/80 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
              >
                ⚰️
                CIMITERO
              </Button>

              {/* CEDI button for field cards */}
              <Button
                onClick={() => setShowTransferSelect(true)}
                className="aspect-square bg-green-600 hover:bg-green-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                disabled={players.length === 0}
              >
                🎁
                CEDI
              </Button>
                
              {/* SCAMBIA button for all card types */}
              {(selectedCard.type === 'personaggi' || selectedCard.type === 'bonus' || selectedCard.type === 'mosse' || selectedCard.type === 'personaggi_speciali') && (
                <Button
                  onClick={() => setShowSwapSelect(true)}
                  className="aspect-square bg-yellow-600 hover:bg-yellow-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                  disabled={getOtherPlayersCardsOfSameType().length === 0}
                >
                  🔄
                  SCAMBIA
                </Button>
              )}

              {/* BAMBOLA VOODOO ATTIVA button - show only for BAMBOLA VOODOO bonus cards */}
              {isBambolaVoodoo && selectedCard.type === 'bonus' && (
                <Button
                  onClick={handleActivateVoodoo}
                  className="aspect-square bg-pink-600 hover:bg-pink-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                >
                  🔮
                  ATTIVA
                </Button>
              )}

              {/* DUELLO INIZIA button - show for DUELLO cards (mosse or bonus) */}
              {isDuello && (selectedCard.type === 'bonus' || selectedCard.type === 'mosse') && (
                <Button
                  onClick={() => setShowDuelSelect(true)}
                  className="aspect-square bg-red-700 hover:bg-red-800 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                >
                  ⚔️
                  INIZIA DUELLO
                </Button>
              )}

              {/* ANNULLA VOODOO button - show for PERSONAGGI with active voodoo link */}
              {(selectedCard.type === 'personaggi' || selectedCard.type === 'personaggi_speciali') && hasVoodooLink && (
                <Button
                  onClick={handleRemoveVoodoo}
                  className="aspect-square bg-red-600 hover:bg-red-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                >
                  🔮❌
                  ANNULLA VOODOO
                </Button>
              )}

              {/* FUSION SYSTEM buttons only for PERSONAGGI and PERSONAGGI_SPECIALI cards */}
              {(selectedCard.type === 'personaggi' || selectedCard.type === 'personaggi_speciali') && (
                <>
                  {/* FONDI button - always available for UNLIMITED FUSION */}
                  <Button
                    onClick={handleFusion}
                    className="aspect-square bg-purple-600 hover:bg-purple-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                    disabled={getAllFusableCards().length === 0}
                  >
                    🔗
                    FONDI
                  </Button>

                    {/* SEPARA button - show only if card IS fused */}
                    {selectedCard.isFused && (
                      <Button
                        onClick={handleSeparate}
                        className="aspect-square bg-orange-600 hover:bg-orange-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                      >
                        ✂️
                        SEPARA
                      </Button>
                    )}

                    {/* DUPLICA button - always available for PERSONAGGI cards */}
                    <Button
                      onClick={handleDuplicate}
                      className="aspect-square bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                    >
                      📋
                      DUPLICA
                    </Button>
                  </>
                )}
            </>
          )}

          {/* Hand card actions */}
          {!isInField && !isInGraveyard && isOwner && (
            <>
              <Button
                onClick={handlePlay}
                className="aspect-square bg-sky-blue hover:bg-sky-blue/80 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
              >
                🎮
                GIOCA
              </Button>
              
              <Button
                onClick={handlePlayFaceDown}
                className="aspect-square bg-orange-600 hover:bg-orange-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
              >
                🎭
                COPERTA
              </Button>
              
              <Button
                onClick={handleShowCardToPlayers}
                className="aspect-square bg-purple-600 hover:bg-purple-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
              >
                👁️
                MOSTRA
              </Button>

              {/* CEDI button for hand cards */}
              <Button
                onClick={() => setShowTransferSelect(true)}
                className="aspect-square bg-green-600 hover:bg-green-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                disabled={players.length === 0}
              >
                🎁
                CEDI
              </Button>
              
              {/* SCAMBIA button for all card types in hand */}
              {(selectedCard.type === 'personaggi' || selectedCard.type === 'bonus' || selectedCard.type === 'mosse' || selectedCard.type === 'personaggi_speciali') && (
                <Button
                  onClick={() => setShowSwapSelect(true)}
                  className="aspect-square bg-yellow-600 hover:bg-yellow-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                  disabled={getOtherPlayersCardsOfSameType().length === 0}
                >
                  🔄
                  SCAMBIA
                </Button>
              )}

              {/* DUPLICA button for PERSONAGGI and PERSONAGGI_SPECIALI cards in hand */}
              {(selectedCard.type === 'personaggi' || selectedCard.type === 'personaggi_speciali') && (
                <Button
                  onClick={handleDuplicate}
                  className="aspect-square bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                >
                  📋
                  DUPLICA
                </Button>
              )}
            </>
          )}
          </div>
        )}
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

      {/* Card Swap Modal for all card types */}
      {showSwapSelect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Scambia con carta {selectedCard.type.toUpperCase()}:</h3>
              <Button
                onClick={() => setShowSwapSelect(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1"
                size="sm"
              >
                Chiudi
              </Button>
            </div>
            
            {getOtherPlayersCardsOfSameType().length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getOtherPlayersCardsOfSameType().map((card) => {
                  // Check if card is in field (visible) or in hand (private) or face-down (private)
                  const isInField = gameState?.field?.some(fieldCard => fieldCard.id === card.id);
                  const isCardPrivate = !isInField || card.faceDown;
                  
                  const cardName = isCardPrivate 
                    ? 'CARTA NASCOSTA' 
                    : (card.frontImage.split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase() || 'CARTA');
                  
                  const cardImage = isCardPrivate ? card.backImage : card.frontImage;
                  
                  return (
                    <div 
                      key={card.id} 
                      className={`bg-gray-700 rounded-lg p-3 hover:bg-gray-600 cursor-pointer transition-colors ${isCardPrivate ? 'ring-2 ring-orange-400 ring-opacity-50' : ''}`}
                      onClick={() => handleSwapCards(card.owner, card.id)}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={cardImage}
                          alt={cardName}
                          className="w-16 h-20 rounded object-cover"
                        />
                        <div className="flex-1">
                          <h4 className="text-white font-bold text-sm mb-1">{cardName}</h4>
                          <p className="text-gray-300 text-xs">Proprietario: {card.owner}</p>
                          {isCardPrivate ? (
                            <p className="text-orange-400 text-xs mt-1">🔒 Carta nascosta</p>
                          ) : (
                            card.text && (
                              <p className="text-gray-400 text-xs mt-1">Note: {card.text}</p>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-white text-center">Nessuna carta {selectedCard.type.toUpperCase()} disponibile per lo scambio</p>
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
            
            {getAllFusableCards().length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getAllFusableCards().map((card) => {
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

      {/* DUELLO Selection Modal */}
      {showDuelSelect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">⚔️ DUELLO - Seleziona il personaggio avversario:</h3>
              <Button
                onClick={() => setShowDuelSelect(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1"
                size="sm"
              >
                Chiudi
              </Button>
            </div>
            
            {getOtherPlayersPersonaggiCards().length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getOtherPlayersPersonaggiCards().map((card) => {
                  const cardName = card.frontImage.split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase() || 'PERSONAGGIO';
                  
                  return (
                    <div 
                      key={card.id} 
                      className="bg-gray-700 rounded-lg p-3 hover:bg-gray-600 cursor-pointer transition-colors border-2 border-red-500"
                      onClick={() => handleDuelStart(card.id)}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={card.frontImage}
                          alt={cardName}
                          className="w-16 h-20 rounded object-cover"
                        />
                        <div className="flex-1">
                          <h4 className="text-white font-bold text-sm mb-1">{cardName}</h4>
                          <p className="text-red-300 text-xs">Avversario: {card.owner}</p>
                          {card.text && (
                            <p className="text-gray-400 text-xs mt-1 line-clamp-2">{card.text}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-white text-center">Nessun personaggio avversario disponibile sul campo</p>
            )}
          </div>
        </div>
      )}

      {/* BAMBOLA VOODOO Selection Modal */}
      {showVoodooSelect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">🔮 BAMBOLA VOODOO - Seleziona 2 PERSONAGGI da collegare:</h3>
              <Button
                onClick={handleCancelVoodoo}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1"
                size="sm"
              >
                Chiudi
              </Button>
            </div>

            <div className="mb-4 text-center">
              <p className="text-white text-sm mb-2">
                Selezionati: {voodooCard1 ? '1' : '0'}/2
              </p>
              {voodooCard1 && voodooCard2 && (
                <Button
                  onClick={handleConfirmVoodoo}
                  className="bg-pink-600 hover:bg-pink-700 text-white font-bold px-6 py-2"
                >
                  🔮 ATTIVA VOODOO
                </Button>
              )}
            </div>
            
            {gameState?.field && gameState.field.filter(card => 
              card.type === 'personaggi' || card.type === 'personaggi_speciali'
            ).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gameState.field
                  .filter(card => card.type === 'personaggi' || card.type === 'personaggi_speciali')
                  .map((card) => {
                    const cardName = card.frontImage.split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase() || 'PERSONAGGIO';
                    const isSelected = card.id === voodooCard1 || card.id === voodooCard2;
                    
                    return (
                      <div 
                        key={card.id} 
                        className={`bg-gray-700 rounded-lg p-3 hover:bg-gray-600 cursor-pointer transition-colors ${
                          isSelected ? 'ring-4 ring-pink-500 ring-opacity-70' : ''
                        }`}
                        onClick={() => handleVoodooCardSelect(card.id)}
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
                              <p className="text-gray-400 text-xs mt-1 line-clamp-2">{card.text}</p>
                            )}
                            {isSelected && (
                              <p className="text-pink-400 font-bold text-xs mt-1">
                                ✓ Selezionato ({card.id === voodooCard1 ? '1' : '2'})
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-white text-center">Nessun PERSONAGGIO disponibile sul campo</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
