import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { useAudio } from "../lib/stores/useAudio";
import { X, Sword, Plus, Sparkles, Palette } from "lucide-react";
import { CARD_DATA } from "../lib/cardData";
import { SkinSelectionPanel } from "./SkinSelectionPanel";

export const CardModal: React.FC = () => {
  const [showPlayerSelect, setShowPlayerSelect] = useState(false);
  const [showTransferSelect, setShowTransferSelect] = useState(false);
  const [showSwapSelect, setShowSwapSelect] = useState(false);
  const [showFusionSelect, setShowFusionSelect] = useState(false);
  const [showVoodooSelect, setShowVoodooSelect] = useState(false);
  const [voodooCard1, setVoodooCard1] = useState<string | null>(null);
  const [voodooCard2, setVoodooCard2] = useState<string | null>(null);
  const [showDuelSelect, setShowDuelSelect] = useState(false);
  const [showAddPTIPanel, setShowAddPTIPanel] = useState(false);
  const [ptiToAdd, setPtiToAdd] = useState('');
  const [stelleToAdd, setStelleToAdd] = useState('');
  const [showAddPRPanel, setShowAddPRPanel] = useState(false);
  const [prToAdd, setPrToAdd] = useState('');
  const [showPowerSelect, setShowPowerSelect] = useState(false);
  const [showSkinPanel, setShowSkinPanel] = useState(false);
  const [appliedSkinUrl, setAppliedSkinUrl] = useState<string | null>(null);
  const { selectedCard, setSelectedCard, playerName, gameState, gameId, setSelectedMosseCard, userRankiardPoints, prSpentThisGame, addPRSpent, setHandModalOpen } = useGameState();
  const { playFusionSound, playModalOpen, playModalClose, playButtonClick } = useAudio();
  
  // Calculate available Rankiard points (total from authenticated user minus spent this game)
  const availableRankiardPoints = userRankiardPoints - prSpentThisGame;

  if (!selectedCard) return null;

  // Check if current player is the game master (first in turn order)
  const isMaster = gameState?.turnOrder?.[0] === playerName;
  
  // Check if player owns the card OR is master and card belongs to CPU
  const isOwner = selectedCard.owner === playerName || (isMaster && selectedCard.owner?.startsWith('CPU-'));
  // For CEDI: When transferring from another player's card, include current player as recipient option
  // When transferring from own card, exclude current player
  const cardOwner = selectedCard?.owner || '';
  const isTransferFromOther = cardOwner && cardOwner !== playerName;
  const players = Object.keys(gameState?.players || {}).filter(p => {
    // If transferring from another player's card, show all players except the card owner
    if (isTransferFromOther) {
      return p !== cardOwner;
    }
    // If transferring from own card, show all players except self
    return p !== playerName;
  });
  
  // Use card owner if master is controlling CPU card, otherwise use current player name
  const effectivePlayerName = (isMaster && selectedCard.owner?.startsWith('CPU-')) ? selectedCard.owner : playerName;
  
  // Check if this is a face-down card belonging to another player
  const isEnemyFaceDownCard = selectedCard.faceDown && !isOwner;
  
  // Extract card name - checks for custom name first, then falls back to URL extraction
  const getCardName = (cardData: any) => {
    // First check if the card has a custom name property
    if (cardData.name && cardData.name.trim()) {
      return cardData.name.toUpperCase();
    }
    // Fall back to extracting from image URL
    try {
      const url = new URL(cardData.frontImage);
      const pathname = url.pathname;
      const filename = pathname.split('/').pop() || '';
      // Remove file extension, replace hyphens with spaces, and convert to uppercase
      return filename.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase();
    } catch {
      return 'CARD';
    }
  };

  // For enemy face-down cards, show generic name
  const cardName = isEnemyFaceDownCard ? 'CARTA COPERTA' : getCardName(selectedCard);
  
  // Determine the card location (we need to check where the card is)
  const isInField = gameState?.field?.some(card => card.id === selectedCard.id);
  const isInGraveyard = gameState?.graveyard?.some(card => card.id === selectedCard.id);

  const handleClose = () => {
    playModalClose();
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
    playButtonClick();
    // Check if player's character has 0 stars
    const playerCharacter = gameState?.field?.find(
      card => card.owner === effectivePlayerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali')
    );
    
    if (playerCharacter && playerCharacter.text) {
      // Check for "Stelle: 0" or "stelle: 0" in the notes
      const starsMatch = playerCharacter.text.match(/stelle:\s*0/i);
      const ptiZeroMatch = playerCharacter.text.match(/PTI:\s*0(?:\s|$)/);
      
      if (starsMatch) {
        alert('❌ Il tuo personaggio ha 0 stelle e non può usare carte MOSSE!');
        setSelectedCard(null);
        return;
      }
      
      if (ptiZeroMatch || playerCharacter.text === "0") {
        alert('❌ Il tuo personaggio ha 0 PTI e non può usare carte MOSSE!');
        setSelectedCard(null);
        return;
      }
    }
    
    // Set this MOSSE card as selected for attacking
    setSelectedMosseCard(selectedCard);
    setSelectedCard(null);
  };

  const handlePlay = () => {
    playButtonClick();
    socket.emit('play-card', { cardId: selectedCard.id, playerName: effectivePlayerName });
    setSelectedCard(null);
    setHandModalOpen(false);
  };

  const handlePlayFaceDown = () => {
    socket.emit('play-card-face-down', { cardId: selectedCard.id, playerName: effectivePlayerName });
    setSelectedCard(null);
    setHandModalOpen(false);
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
    playFusionSound();
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
  const isMinkiard300 = cardName === 'MINKIARD N 300';
  
  const handleSuperDice = () => {
    console.log('SUPER DICE button clicked from CardModal for MINKIARD N 300');
    socket.emit('open-super-dice', { gameId, playerName });
    setSelectedCard(null);
  };

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

  // Handler for adding PTI to a character
  const handleAddPTI = () => {
    setShowAddPTIPanel(true);
  };

  const handleConfirmAddPTI = () => {
    const ptiValue = parseInt(ptiToAdd) || 0;
    const stelleValue = parseInt(stelleToAdd) || 0;
    
    // Allow if at least one value is non-zero
    if ((ptiValue !== 0 || stelleValue !== 0) && selectedCard) {
      socket.emit('modify-stats', {
        cardId: selectedCard.id,
        ptiAmount: ptiValue,
        stelleAmount: stelleValue,
        playerName: effectivePlayerName
      });
      setShowAddPTIPanel(false);
      setPtiToAdd('');
      setStelleToAdd('');
      setSelectedCard(null);
    }
  };

  const handleCancelAddPTI = () => {
    setShowAddPTIPanel(false);
    setPtiToAdd('');
    setStelleToAdd('');
  };

  // Handler for adding PR (Rankiard Points) to convert to PTI
  const handleAddPR = () => {
    setShowAddPRPanel(true);
  };

  const handleConfirmAddPR = () => {
    const prValue = parseInt(prToAdd);
    if (!isNaN(prValue) && prValue > 0 && selectedCard && prValue <= availableRankiardPoints) {
      const pendingAmount = prValue;
      socket.emit('add-pr', {
        cardId: selectedCard.id,
        prAmount: prValue,
        playerName: effectivePlayerName,
        userTotalPoints: userRankiardPoints
      });
      
      const handlePRSuccess = (data: any) => {
        addPRSpent(pendingAmount);
        socket.off('pr-spent-update', handlePRSuccess);
        socket.off('pr-error', handlePRError);
      };
      const handlePRError = (data: any) => {
        console.error('PR add failed:', data.message);
        socket.off('pr-spent-update', handlePRSuccess);
        socket.off('pr-error', handlePRError);
      };
      socket.on('pr-spent-update', handlePRSuccess);
      socket.on('pr-error', handlePRError);
      
      setShowAddPRPanel(false);
      setPrToAdd('');
      setSelectedCard(null);
    }
  };

  const handleCancelAddPR = () => {
    setShowAddPRPanel(false);
    setPrToAdd('');
  };

  // Handler for skin selection - emit socket event to persist skin on card
  const handleSkinSelect = (skinImageUrl: string | null, skinId: number | null, rarity: string) => {
    if (selectedCard) {
      // Emit socket event to apply skin to card in game state
      socket.emit('apply-card-skin', {
        cardId: selectedCard.id,
        skinImageUrl: skinImageUrl,
        playerName: playerName
      });
    }
    setShowSkinPanel(false);
  };

  // Get PERSONAGGI cards from other players in the field
  const getOtherPlayersPersonaggiCards = () => {
    if (!gameState?.field) return [];
    
    return gameState.field.filter(card => 
      (card.type === 'personaggi' || card.type === 'personaggi_speciali') && 
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

  // Get ALL cards from other players (any type) for swapping
  const getOtherPlayersCardsOfAnyType = () => {
    const cards = [];
    
    // Add cards from field
    if (gameState?.field) {
      cards.push(...gameState.field.filter(card => 
        card.owner !== playerName && card.id !== selectedCard.id
      ));
    }
    
    // Add cards from other players' hands
    if (gameState?.players) {
      Object.entries(gameState.players).forEach(([otherPlayerName, player]) => {
        if (otherPlayerName !== playerName) { // Not current player
          cards.push(...player.hand);
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-2 sm:p-4">
      <div className="premium-panel p-4 sm:p-6 max-w-lg w-full relative rounded-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <h3 className="text-white font-bold text-base sm:text-lg pr-8">{cardName}</h3>
          <Button
            onClick={handleClose}
            className="absolute top-2 right-2 sm:-top-2 sm:-right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 shadow-lg border-2 border-white/20 z-[70] min-w-[36px] min-h-[36px]"
            size="sm"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Large card image */}
        <div className="flex justify-center mb-4 sm:mb-6">
          <img
            src={isEnemyFaceDownCard ? selectedCard.backImage : (selectedCard.appliedSkinUrl || selectedCard.frontImage)}
            alt="Card"
            className={`w-40 h-52 sm:w-64 sm:h-80 rounded-lg shadow-lg ${isEnemyFaceDownCard ? 'ring-4 ring-orange-400 ring-opacity-50' : ''}`}
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
            <motion.button
              onClick={handleAttacca}
              className="aspect-square bg-red-600 hover:bg-red-700 text-white font-bold p-2 flex flex-col items-center justify-center gap-1 text-xs rounded-md"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            >
              <Sword size={16} />
              ATTACCA
            </motion.button>
          )}

          {/* Field card actions - available for all field cards (own and opponent's) */}
          {isInField && (
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
                  disabled={getOtherPlayersCardsOfAnyType().length === 0}
                >
                  🔄
                  SCAMBIA
                </Button>
              )}

              {/* SKIN button - apply cosmetic skin to all card types */}
              {isOwner && (
                <Button
                  onClick={() => setShowSkinPanel(true)}
                  className="aspect-square bg-violet-600 hover:bg-violet-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                >
                  <Palette size={14} />
                  SKIN
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

                    {/* DUPLICA button - always available for PERSONAGGI and PERSONAGGI_SPECIALI cards */}
                    <Button
                      onClick={handleDuplicate}
                      className="aspect-square bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                    >
                      📋
                      DUPLICA
                    </Button>

                    {/* MODIFICA STATISTICHE button */}
                    <Button
                      onClick={handleAddPTI}
                      className="aspect-square bg-cyan-600 hover:bg-cyan-700 text-white font-bold p-2 flex flex-col items-center justify-center text-[9px] leading-tight"
                    >
                      📊
                      PUNTI E STELLE
                    </Button>

                    {/* AGGIUNGI PR button */}
                    <Button
                      onClick={handleAddPR}
                      className="aspect-square bg-amber-600 hover:bg-amber-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                    >
                      <Plus size={14} />
                      PR
                    </Button>

                    {/* POTERI button - copy special powers from other characters */}
                    <Button
                      onClick={() => setShowPowerSelect(true)}
                      className="aspect-square bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                    >
                      <Sparkles size={14} />
                      POTERI
                    </Button>

                    {/* SKIN button - apply cosmetic skin to card */}
                    {isOwner && (
                      <Button
                        onClick={() => setShowSkinPanel(true)}
                        className="aspect-square bg-violet-600 hover:bg-violet-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
                      >
                        <Palette size={14} />
                        SKIN
                      </Button>
                    )}

                    {/* SUPER DADO button - only for MINKIARD N 300 */}
                    {isMinkiard300 && (
                      <Button
                        onClick={handleSuperDice}
                        className="aspect-square bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold p-2 flex flex-col items-center justify-center text-[9px] leading-tight"
                      >
                        🎲
                        SUPER DADO
                      </Button>
                    )}
                  </>
                )}
            </>
          )}

          {/* Hand card actions */}
          {!isInField && !isInGraveyard && isOwner && (
            <>
              <motion.button
                onClick={handlePlay}
                className="aspect-square bg-sky-blue hover:bg-sky-blue/80 text-white font-bold p-2 flex flex-col items-center justify-center text-xs rounded-md"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              >
                🎮
                GIOCA
              </motion.button>
              
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
                  disabled={getOtherPlayersCardsOfAnyType().length === 0}
                >
                  🔄
                  SCAMBIA
                </Button>
              )}

              {/* SKIN button for all card types in hand */}
              <Button
                onClick={() => setShowSkinPanel(true)}
                className="aspect-square bg-violet-600 hover:bg-violet-700 text-white font-bold p-2 flex flex-col items-center justify-center text-xs"
              >
                <Palette size={14} />
                SKIN
              </Button>

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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-60 p-4">
          <div className="premium-panel p-6 max-w-md w-full">
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-60 p-4">
          <div className="premium-panel p-6 max-w-md w-full">
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-60 p-4">
          <div className="premium-panel p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Scambia con qualsiasi carta:</h3>
              <Button
                onClick={() => setShowSwapSelect(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1"
                size="sm"
              >
                Chiudi
              </Button>
            </div>
            
            {getOtherPlayersCardsOfAnyType().length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getOtherPlayersCardsOfAnyType().map((card) => {
                  // Check if card is in field (visible) or in hand (private) or face-down (private)
                  const isInField = gameState?.field?.some(fieldCard => fieldCard.id === card.id);
                  const isCardPrivate = !isInField || card.faceDown;
                  
                  const cardName = isCardPrivate 
                    ? 'CARTA NASCOSTA' 
                    : getCardName(card);
                  
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
              <p className="text-white text-center">Nessuna carta disponibile per lo scambio</p>
            )}
          </div>
        </div>
      )}

      {/* Card Fusion Modal for PERSONAGGI */}
      {showFusionSelect && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="premium-panel p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
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
                  const cardName = getCardName(card);
                  
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="premium-panel p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
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
                  const cardName = getCardName(card);
                  
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="premium-panel p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
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
                    const cardName = getCardName(card);
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

      {/* Modify Stats Panel - Sky Blue Panel for PTI and Stars */}
      {showAddPTIPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-2 sm:p-4">
          <div className="bg-cyan-600 rounded-lg p-4 sm:p-6 max-w-md w-full shadow-xl border-4 border-cyan-400 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h3 className="text-white font-bold text-lg sm:text-xl">📊 MODIFICA STATISTICHE</h3>
              <Button
                onClick={handleCancelAddPTI}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 min-w-[36px] min-h-[36px]"
                size="sm"
              >
                <X size={16} />
              </Button>
            </div>

            <div className="text-center mb-3 sm:mb-4">
              <p className="text-white text-base sm:text-lg mb-1 sm:mb-2">
                Modifica PTI e Stelle di questo personaggio
              </p>
              <p className="text-cyan-200 text-xs sm:text-sm">
                Usa valori positivi per aggiungere, negativi per sottrarre.
              </p>
            </div>

            {/* PTI Section */}
            <div className="mb-3 sm:mb-4">
              <label className="text-white font-bold text-sm block mb-2">PTI (Punti)</label>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setPtiToAdd(String((parseInt(ptiToAdd) || 0) - 100))}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-3 min-w-[48px] min-h-[44px] text-sm"
                >
                  -100
                </Button>
                <input
                  type="number"
                  value={ptiToAdd}
                  onChange={(e) => setPtiToAdd(e.target.value)}
                  placeholder="0"
                  className="flex-1 min-w-0 px-2 sm:px-3 py-2 text-lg sm:text-xl text-center font-bold rounded-lg bg-white text-cyan-800 border-2 border-cyan-300"
                />
                <Button
                  onClick={() => setPtiToAdd(String((parseInt(ptiToAdd) || 0) + 100))}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold px-3 py-3 min-w-[48px] min-h-[44px] text-sm"
                >
                  +100
                </Button>
              </div>
            </div>

            {/* Stelle Section */}
            <div className="mb-4 sm:mb-6">
              <label className="text-white font-bold text-sm block mb-2">⭐ Stelle</label>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setStelleToAdd(String((parseInt(stelleToAdd) || 0) - 1))}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-3 min-w-[48px] min-h-[44px]"
                >
                  -1
                </Button>
                <input
                  type="number"
                  value={stelleToAdd}
                  onChange={(e) => setStelleToAdd(e.target.value)}
                  placeholder="0"
                  className="flex-1 min-w-0 px-2 sm:px-3 py-2 text-lg sm:text-xl text-center font-bold rounded-lg bg-white text-cyan-800 border-2 border-cyan-300"
                />
                <Button
                  onClick={() => setStelleToAdd(String((parseInt(stelleToAdd) || 0) + 1))}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold px-4 py-3 min-w-[48px] min-h-[44px]"
                >
                  +1
                </Button>
              </div>
            </div>

            <div className="flex gap-3 sm:gap-4 pb-2">
              <Button
                onClick={handleCancelAddPTI}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 min-h-[48px]"
              >
                ANNULLA
              </Button>
              <Button
                onClick={handleConfirmAddPTI}
                disabled={(!ptiToAdd || parseInt(ptiToAdd) === 0) && (!stelleToAdd || parseInt(stelleToAdd) === 0)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 min-h-[48px] disabled:opacity-50"
              >
                ✓ CONFERMA
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add PR Panel - Orange Panel for Rankiard Points */}
      {showAddPRPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-2 sm:p-4">
          <div className="bg-amber-600 rounded-lg p-4 sm:p-6 max-w-md w-full shadow-xl border-4 border-amber-400 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h3 className="text-white font-bold text-lg sm:text-xl">➕ AGGIUNGI PR</h3>
              <Button
                onClick={handleCancelAddPR}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 min-w-[36px] min-h-[36px]"
                size="sm"
              >
                <X size={16} />
              </Button>
            </div>

            <div className="text-center mb-3 sm:mb-4">
              <div className="bg-amber-700 rounded-lg p-3 mb-3 sm:mb-4">
                <p className="text-amber-200 text-xs sm:text-sm">I tuoi Punti Rankiard:</p>
                <p className="text-white text-xl sm:text-2xl font-bold">{userRankiardPoints}</p>
                <p className="text-amber-200 text-xs sm:text-sm mt-1">
                  Disponibili questa partita: <span className="text-white font-bold">{availableRankiardPoints}</span>
                </p>
                {prSpentThisGame > 0 && (
                  <p className="text-amber-300 text-xs mt-1">
                    (Già spesi: {prSpentThisGame})
                  </p>
                )}
              </div>
              <p className="text-white text-base sm:text-lg mb-1 sm:mb-2">
                Quanti Punti Rankiard vuoi convertire in PTI?
              </p>
              <p className="text-amber-200 text-xs sm:text-sm">
                I punti si sottraggono solo per questa partita.
              </p>
            </div>

            <div className="mb-4 sm:mb-6">
              <input
                type="number"
                value={prToAdd}
                onChange={(e) => setPrToAdd(e.target.value)}
                placeholder="Inserisci PR..."
                min="1"
                max={availableRankiardPoints}
                className="w-full px-3 sm:px-4 py-3 text-xl sm:text-2xl text-center font-bold rounded-lg bg-white text-amber-800 border-4 border-amber-300 focus:outline-none focus:border-amber-100"
              />
              {parseInt(prToAdd) > availableRankiardPoints && (
                <p className="text-red-300 text-sm mt-2 text-center">
                  Non hai abbastanza punti disponibili!
                </p>
              )}
            </div>

            <div className="flex gap-3 sm:gap-4 pb-2">
              <Button
                onClick={handleCancelAddPR}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 min-h-[48px]"
              >
                ANNULLA
              </Button>
              <Button
                onClick={handleConfirmAddPR}
                disabled={!prToAdd || parseInt(prToAdd) <= 0 || parseInt(prToAdd) > availableRankiardPoints}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 min-h-[48px] disabled:opacity-50"
              >
                ✓ CONFERMA
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* POTERI Power Selection Modal - Show all personaggi cards */}
      {showPowerSelect && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-60 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-4xl max-h-[85vh] overflow-y-auto border-3 border-purple-500" style={{ boxShadow: '0 0 40px rgba(139, 92, 246, 0.5)' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white text-2xl font-bold">✨ SCEGLI POTERE DA COPIARE</h2>
              <Button
                onClick={() => setShowPowerSelect(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2"
              >
                CHIUDI
              </Button>
            </div>
            
            <p className="text-gray-400 mb-4 text-sm">
              Seleziona un personaggio per copiare i suoi poteri speciali su <strong className="text-purple-400">{cardName}</strong>
            </p>

            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {CARD_DATA.personaggi.map((imageUrl, index) => {
                const extractedName = (() => {
                  try {
                    const url = new URL(imageUrl);
                    const pathname = url.pathname;
                    const filename = pathname.split('/').pop() || '';
                    return filename.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase();
                  } catch {
                    return `PERSONAGGIO ${index + 1}`;
                  }
                })();
                
                return (
                  <div
                    key={index}
                    onClick={() => {
                      socket.emit('copy-power', { 
                        cardId: selectedCard.id, 
                        playerName: effectivePlayerName,
                        powerSource: extractedName 
                      });
                      setShowPowerSelect(false);
                      setSelectedCard(null);
                    }}
                    className="cursor-pointer transition-all duration-200 hover:scale-105 hover:border-purple-500 border-2 border-transparent rounded-lg p-1 bg-gray-700"
                  >
                    <img 
                      src={imageUrl} 
                      alt={extractedName}
                      className="w-full h-auto aspect-[2/3] object-cover rounded-md"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <p className="text-purple-300 font-bold text-[8px] text-center mt-1 truncate">{extractedName}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Skin Selection Panel */}
      {selectedCard && (
        <SkinSelectionPanel
          isOpen={showSkinPanel}
          onClose={() => setShowSkinPanel(false)}
          cardName={cardName}
          cardId={selectedCard.id}
          currentImage={selectedCard.frontImage}
          onSkinSelect={handleSkinSelect}
          authToken={localStorage.getItem('authToken')}
        />
      )}
    </div>
  );
};
