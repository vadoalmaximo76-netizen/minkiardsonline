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
  const [showHandTargetSelect, setShowHandTargetSelect] = useState(false);
  const [isHandTarget, setIsHandTarget] = useState(false);

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

  const isAtaccoDisonesto = card.type === 'mosse' && location === 'field' && getCardName(card.frontImage) === 'ATTACCO DISONESTO';

  const handleAttaccoDisonesto = () => {
    // Open hand target selection for ATTACCO DISONESTO
    setShowHandTargetSelect(true);
  };

  const handleCardClick = () => {
    // If a MOSSE card is selected (for regular attacks on field)
    if (selectedMosseCard) {
      // Regular MOSSE attack on field (NOT for ATTACCO DISONESTO - that has its own button)
      if (location === 'field' && 
          card.type === 'personaggi' && 
          card.owner !== playerName) {
        
        // Open damage input dialog instead of attacking immediately
        setTargetCard(card);
        setIsHandTarget(false);
        setShowDamageInput(true);
        return;
      }
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
        damageValue: damage,
        isHandTarget: isHandTarget  // NEW: Pass isHandTarget flag
      });

      // Clear states
      setSelectedMosseCard(null);
      setShowDamageInput(false);
      setDamageValue("");
      setTargetCard(null);
      setIsHandTarget(false);
    } catch (error: any) {
      alert(error.message || "Errore nel calcolo del danno");
    }
  };

  const handleDamageCancel = () => {
    setShowDamageInput(false);
    setDamageValue("");
    setTargetCard(null);
    setIsHandTarget(false);
  };

  const handleHandTargetSelect = (targetCard: any) => {
    setTargetCard(targetCard);
    setIsHandTarget(true);
    setShowHandTargetSelect(false);
    setShowDamageInput(true);
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

      {/* ATTACCA button for MOSSE cards on field (owned by player) */}
      {location === 'field' && card.type === 'mosse' && isOwner && !card.faceDown && (
        <div className="flex flex-col gap-1">
          <Button
            onClick={() => {
              if (isAtaccoDisonesto) {
                handleAttaccoDisonesto();
              } else {
                // For regular MOSSE, select it as attack card
                setSelectedMosseCard(card);
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-2 py-1"
            size="sm"
          >
            ⚔️ ATTACCA
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

      {/* Hand Target Selection Modal (for ATTACCO DISONESTO) - LARGE CENTERED */}
      {showHandTargetSelect && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2">
          <div className="bg-gray-900 rounded-2xl p-12 w-[95vw] h-[95vh] border-4 border-red-600 shadow-2xl overflow-y-auto">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-white font-bold text-5xl">🎯 ATTACCO DISONESTO</h2>
              <Button
                onClick={() => setShowHandTargetSelect(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 font-bold text-2xl"
                size="sm"
              >
                ✕ CHIUDI
              </Button>
            </div>
            
            <p className="text-gray-200 text-center mb-12 text-3xl font-bold">Scegli un personaggio in mano di un avversario da attaccare:</p>
            
            <div className="space-y-12">
              {Object.entries(gameState?.players || {}).map(([pName, pData]: [string, any]) => {
                if (pName === playerName) return null;
                const handCards = pData.hand?.filter((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali') || [];
                
                if (handCards.length === 0) return null;
                
                return (
                  <div key={pName} className="bg-gray-800 rounded-lg p-8 border-4 border-orange-500">
                    <h3 className="text-orange-400 font-bold text-4xl mb-8 text-center">{pName}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 justify-items-center">
                      {handCards.map((hCard: any) => (
                        <Button
                          key={hCard.id}
                          onClick={() => handleHandTargetSelect(hCard)}
                          className="bg-red-600 hover:bg-red-700 text-white p-6 h-56 w-40 flex flex-col items-center justify-center rounded-lg border-4 border-red-400 shadow-lg transition-all hover:scale-110"
                        >
                          <p className="text-7xl mb-4">🎴</p>
                          <p className="text-xl font-bold text-center">COPERTA</p>
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Damage Input Dialog */}
      <Dialog open={showDamageInput} onOpenChange={setShowDamageInput}>
        <DialogContent className="bg-gray-900 border-gray-600 max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-2xl font-bold">
              {isHandTarget ? '🎯 ATTACCO DISONESTO - Inserisci Danno' : 'Inserisci Danno dell\'Attacco'}
            </DialogTitle>
          </DialogHeader>
          
          {/* Three Cards Display */}
          <div className="grid grid-cols-3 gap-4 items-start my-4">
            {/* LEFT: Attacker Character */}
            <div className="flex flex-col items-center">
              <p className="text-white font-bold mb-2 text-sm">ATTACCANTE</p>
              {gameState?.field && (
                <>
                  {gameState.field.find((c: any) => c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')) ? (
                    <>
                      <img 
                        src={gameState.field.find((c: any) => c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'))?.frontImage}
                        alt="Attaccante"
                        className="w-24 h-32 rounded-lg border-2 border-green-500 object-cover shadow-lg"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      <p className="text-gray-300 text-xs text-center mt-2 max-w-24">
                        {gameState.field.find((c: any) => c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'))?.text || 'Nessun testo'}
                      </p>
                    </>
                  ) : (
                    <div className="w-24 h-32 rounded-lg border-2 border-green-500 bg-gray-700 flex items-center justify-center">
                      <p className="text-gray-400 text-xs">{playerName}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* CENTER: MOSSE Card */}
            <div className="flex flex-col items-center">
              <p className="text-white font-bold mb-2 text-sm">MOSSE USATA</p>
              {selectedMosseCard ? (
                <>
                  <img 
                    src={selectedMosseCard.frontImage}
                    alt="MOSSE"
                    className="w-28 h-36 rounded-lg border-4 border-yellow-500 object-cover shadow-lg"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                  <p className="text-yellow-400 font-bold text-xs text-center mt-2">MOSSA</p>
                </>
              ) : (
                <div className="w-28 h-36 rounded-lg border-4 border-yellow-500 bg-gray-700 flex items-center justify-center">
                  <p className="text-gray-400 text-xs">MOSSE</p>
                </div>
              )}
            </div>

            {/* RIGHT: Defender Character or Hand Card */}
            <div className="flex flex-col items-center">
              <p className="text-white font-bold mb-2 text-sm">
                {isHandTarget ? 'BERSAGLIO (MANO)' : 'DIFENSORE'}
              </p>
              {targetCard ? (
                <>
                  {isHandTarget ? (
                    // Show hand card as face-down for ATTACCO DISONESTO
                    <div className="w-24 h-32 rounded-lg border-2 border-red-500 bg-gradient-to-br from-red-900 to-red-700 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-white font-bold text-2xl">🎴</p>
                        <p className="text-yellow-400 text-xs mt-1 font-bold">COPERTA</p>
                        <p className="text-red-200 text-xs mt-1">{targetCard.owner}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <img 
                        src={targetCard.frontImage}
                        alt="Difensore"
                        className="w-24 h-32 rounded-lg border-2 border-red-500 object-cover shadow-lg"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      <p className="text-gray-300 text-xs text-center mt-2 max-w-24">
                        {targetCard.text || 'Nessun testo'}
                      </p>
                    </>
                  )}
                </>
              ) : (
                <div className="w-24 h-32 rounded-lg border-2 border-red-500 bg-gray-700 flex items-center justify-center">
                  <p className="text-gray-400 text-xs">?</p>
                </div>
              )}
            </div>
          </div>

          {/* Damage Input Section */}
          <div className="space-y-4 mt-6">
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
              <p className="text-gray-300 text-sm mb-2">
                Quanto danno fa la tua carta MOSSE a <span className="text-red-400 font-bold">{targetCard?.owner}</span>?
              </p>
              <p className="text-gray-400 text-xs mb-3">
                Puoi inserire operazioni: 50x3, 100+20, 200-50, ecc.
              </p>
              <Input
                type="text"
                value={damageValue}
                onChange={(e) => setDamageValue(e.target.value)}
                placeholder="es: 50x3, 100+50, 150..."
                className="bg-gray-700 border-gray-600 text-white text-lg font-bold"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleDamageConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 text-lg"
              >
                ⚔️ ATTACCA
              </Button>
              <Button
                onClick={handleDamageCancel}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3"
              >
                ✕ ANNULLA
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
