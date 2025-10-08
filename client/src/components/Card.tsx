import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

interface CardProps {
  card: {
    id: string;
    type: string;
    frontImage: string;
    backImage: string;
    owner: string;
    text?: string;
    faceDown?: boolean;
    isFused?: boolean;
    fusionLeader?: string;
    fusedWith?: string[];
  };
  location: 'hand' | 'field' | 'graveyard';
  showBack?: boolean;
}

export const Card: React.FC<CardProps> = ({ card, location, showBack = false }) => {
  const [cardText, setCardText] = useState(card.text || "");
  const [showActions, setShowActions] = useState(false);
  const [showPlayerSelect, setShowPlayerSelect] = useState(false);
  const [showTransferSelect, setShowTransferSelect] = useState(false);
  const [isEliminated, setIsEliminated] = useState(false);
  const [showDamageInput, setShowDamageInput] = useState(false);
  const [damageValue, setDamageValue] = useState("");
  const [targetCard, setTargetCard] = useState<any>(null);

  // Sync local cardText state with incoming card.text prop (for real-time updates)
  useEffect(() => {
    setCardText(card.text || "");
  }, [card.text]);
  const { 
    setSelectedCard, 
    playerName, 
    gameState, 
    gameId,
    selectedMosseCard, 
    setSelectedMosseCard, 
    shakingCards, 
    addShakingCard, 
    removeShakingCard 
  } = useGameState();

  const handleCardClick = () => {
    // If a MOSSE card is selected and this is an opponent's PERSONAGGI card on the field
    if (selectedMosseCard && 
        location === 'field' && 
        card.type === 'personaggi' && 
        card.owner !== playerName) {
      
      // Open damage input dialog instead of attacking immediately
      setTargetCard(card);
      setShowDamageInput(true);
      return;
    }

    // Regular card click behavior
    if (location === 'field') {
      setSelectedCard(card);
      setSelectedMosseCard(null);
    } else if (location === 'graveyard') {
      setShowActions(!showActions);
      setSelectedMosseCard(null);
    } else if (location === 'hand') {
      // For cards in hand, open the modal window
      setSelectedCard(card);
      setSelectedMosseCard(null);
    }
  };

  const handlePlay = () => {
    socket.emit('play-card', { cardId: card.id, playerName: effectivePlayerName });
  };

  const handlePlayFaceDown = () => {
    socket.emit('play-card-face-down', { cardId: card.id, playerName: effectivePlayerName });
  };

  const handleReveal = () => {
    socket.emit('reveal-card', { cardId: card.id, playerName: effectivePlayerName });
  };

  const handleReturnToHand = () => {
    socket.emit('return-to-hand', { cardId: card.id, playerName: effectivePlayerName });
  };

  const handleReturnToDeck = () => {
    socket.emit('return-to-deck', { cardId: card.id, playerName: effectivePlayerName });
  };

  const handleMoveToGraveyard = () => {
    socket.emit('move-to-graveyard', { cardId: card.id, playerName: effectivePlayerName });
  };

  const handleShowCard = () => {
    setShowPlayerSelect(true);
  };

  const evaluateExpression = (expression: string): number => {
    try {
      // Replace 'x' with '*' for multiplication
      let cleanExpr = expression.replace(/x/gi, '*');
      
      // Remove any non-math characters (keep numbers, +, -, *, /, ., (, ))
      cleanExpr = cleanExpr.replace(/[^0-9+\-*/().\s]/g, '');
      
      // Simple validation - check for basic math operators
      if (!/^[0-9+\-*/().\s]+$/.test(cleanExpr)) {
        throw new Error('Invalid expression');
      }
      
      // Use Function constructor for safe evaluation (safer than eval)
      const result = new Function(`"use strict"; return (${cleanExpr})`)();
      
      if (typeof result !== 'number' || isNaN(result)) {
        throw new Error('Result is not a number');
      }
      
      return Math.round(result); // Round to integer
    } catch (error) {
      throw new Error('Espressione matematica non valida');
    }
  };

  const handleDamageConfirm = () => {
    try {
      const damage = evaluateExpression(damageValue.trim());
      if (damage <= 0) {
        alert("Il risultato deve essere un numero positivo");
        return;
      }

      // Attack with damage value
      socket.emit('mosse-attack', { 
        mosseCardId: selectedMosseCard?.id,
        targetCardId: targetCard?.id,
        attackerName: playerName,
        targetOwner: targetCard?.owner,
        damageValue: damage
      });

      // Clear states
      setSelectedMosseCard(null);
      setShowDamageInput(false);
      setDamageValue("");
      setTargetCard(null);
    } catch (error: any) {
      alert(error.message || "Errore nel calcolo del danno");
    }
  };

  const handleDamageCancel = () => {
    setShowDamageInput(false);
    setDamageValue("");
    setTargetCard(null);
  };

  const handleTransferCard = () => {
    setShowTransferSelect(true);
  };

  const handleTransferToPlayer = (targetPlayer: string) => {
    socket.emit('transfer-card', { 
      cardId: card.id, 
      fromPlayer: effectivePlayerName, 
      toPlayer: targetPlayer
    });
    setShowTransferSelect(false);
  };

  const handleShowToPlayer = (targetPlayer: string) => {
    socket.emit('show-card-to-player', { 
      cardId: card.id, 
      fromPlayer: effectivePlayerName, 
      toPlayer: targetPlayer,
      cardImage: card.frontImage
    });
    setShowPlayerSelect(false);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setCardText(newText);
    socket.emit('update-card-text', { cardId: card.id, text: newText });
    
    // Check if PTI has reached 0 for a PERSONAGGI card on field
    if (card.type === 'personaggi' && location === 'field') {
      // Check for explicit "0" or PTI: 0 pattern
      const isZero = newText === "0";
      const ptiZeroMatch = newText.match(/PTI:\s*0(?:\s|$)/);
      
      if (isZero || ptiZeroMatch) {
        // Trigger elimination animation
        setIsEliminated(true);
        
        // Send elimination event to server after animation delay - use card.owner for CPU cards
        setTimeout(() => {
          socket.emit('eliminate-personaggi', { cardId: card.id, playerName: card.owner });
          setIsEliminated(false);
        }, 2000); // 2 second animation
      }
    }
  };

  // Check if current player is the game master (first in turn order)
  const isMaster = gameState?.turnOrder?.[0] === playerName;
  
  // Use card owner if master is controlling CPU card, otherwise use current player name
  const effectivePlayerName = (isMaster && card.owner?.startsWith('CPU-')) ? card.owner : playerName;
  
  // Check if player owns the card OR is master and card belongs to CPU
  const isOwner = card.owner === playerName || (isMaster && card.owner?.startsWith('CPU-'));
  
  // Helper function to get card name from image URL
  const getCardName = (imageUrl: string) => {
    try {
      const url = new URL(imageUrl);
      const pathname = url.pathname;
      const filename = pathname.split('/').pop() || '';
      return filename.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase();
    } catch {
      return '';
    }
  };
  
  // Check if this is the MINKIARD N 300 card
  const isMinkiard300 = getCardName(card.frontImage) === 'MINKIARD N 300';
  
  const handleSuperDice = () => {
    console.log('SUPER DICE button clicked for MINKIARD N 300');
    socket.emit('open-super-dice', { gameId, playerName });
  };
  
  const otherPlayers = Object.keys(gameState?.players || {}).filter(p => p !== playerName);
  const isShaking = shakingCards.has(card.id);
  const isMosseSelected = selectedMosseCard?.id === card.id;

  return (
    <div className="flex flex-col gap-2">
      {/* Card Image */}
      <div className="relative">
        <img
          src={showBack || card.faceDown ? card.backImage : card.frontImage}
          alt="Card"
          className={`w-20 h-28 rounded-lg cursor-pointer hover:scale-105 transition-transform shadow-lg object-contain
            ${isShaking ? 'animate-shake' : ''} 
            ${isMosseSelected ? 'ring-4 ring-red-500 ring-opacity-70' : ''}
            ${card.faceDown ? 'ring-2 ring-orange-400 ring-opacity-50' : ''}`}
          onClick={handleCardClick}
        />
        
        {location === 'field' && (
          <div className="absolute -top-2 left-0 bg-black/70 text-white px-2 py-1 rounded text-xs">
            {card.owner}
          </div>
        )}
        
        {/* Red X elimination animation */}
        {isEliminated && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-600/50 rounded-lg animate-pulse">
            <X size={32} className="text-white animate-ping" />
          </div>
        )}
      </div>

      {/* Card Text - Only show for non-fused cards or fusion leaders */}
      {(!card.isFused || card.fusionLeader === card.id) && (
        <textarea
          value={cardText}
          onChange={handleTextChange}
          placeholder="Add note..."
          className="w-20 h-10 text-xs p-1 rounded resize-none"
          disabled={!isOwner && location === 'hand'}
        />
      )}

      {/* Reveal button for face-down cards in field */}
      {location === 'field' && isOwner && card.faceDown && (
        <div className="flex flex-col gap-1">
          <Button
            onClick={handleReveal}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold text-xs px-2 py-1"
            size="sm"
          >
            SCOPRI
          </Button>
        </div>
      )}

      {/* Super Dice button for MINKIARD N 300 card on field */}
      {location === 'field' && isMinkiard300 && !card.faceDown && (
        <div className="flex flex-col gap-1">
          <Button
            onClick={handleSuperDice}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-2 py-1"
            size="sm"
            style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
          >
            LANCIA IL SUPER DADO
          </Button>
        </div>
      )}

      {location === 'graveyard' && showActions && (
        <div className="flex flex-wrap gap-1">
          {isOwner && (
            <>
              <Button
                onClick={handleReturnToHand}
                className="bg-sky-blue hover:bg-sky-blue/80 text-white font-bold text-xs px-1 py-1"
                size="sm"
              >
                RIMETTI IN MANO
              </Button>
              <Button
                onClick={handleReturnToDeck}
                className="bg-sky-blue hover:bg-sky-blue/80 text-white font-bold text-xs px-1 py-1"
                size="sm"
              >
                RIMETTI NEL MAZZO
              </Button>
            </>
          )}
        </div>
      )}

      {/* Player Selection Modal for MOSTRA */}
      {showPlayerSelect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
              {otherPlayers.map((player) => (
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
            
            <div className="space-y-2">
              {otherPlayers.map((player) => (
                <Button
                  key={player}
                  onClick={() => handleTransferToPlayer(player)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2"
                >
                  {player}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Damage Input Dialog */}
      <Dialog open={showDamageInput} onOpenChange={setShowDamageInput}>
        <DialogContent className="bg-gray-800 border-gray-600 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Inserisci Danno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Quanto danno fa la tua carta MOSSE a {targetCard?.owner}?
            </p>
            <p className="text-gray-400 text-xs">
              Puoi inserire operazioni: 50x3, 100+20, 200-50, ecc.
            </p>
            <Input
              type="text"
              value={damageValue}
              onChange={(e) => setDamageValue(e.target.value)}
              placeholder="es: 50x3, 100+50, 150..."
              className="bg-gray-700 border-gray-600 text-white"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                onClick={handleDamageConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                ATTACCA
              </Button>
              <Button
                onClick={handleDamageCancel}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
              >
                ANNULLA
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
