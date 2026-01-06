import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { useAudio } from "../lib/stores/useAudio";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { FloatingNumber } from "./FloatingNumber";

const parsePTI = (text: string | undefined): number | null => {
  if (!text) return null;
  const match = text.match(/PTI:\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
};

const parseStars = (text: string | undefined): number | null => {
  if (!text) return null;
  const match = text.match(/stelle:\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
};

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
  const [powerEffect, setPowerEffect] = useState<'up' | 'down' | null>(null);
  const [floatingNumbers, setFloatingNumbers] = useState<Array<{
    id: string;
    value: number;
    type: 'damage' | 'heal' | 'star-up' | 'star-down';
    x: number;
    y: number;
  }>>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const [showDamageInput, setShowDamageInput] = useState(false);
  const [damageValue, setDamageValue] = useState("");
  const [targetCard, setTargetCard] = useState<any>(null);
  const [targetCards, setTargetCards] = useState<any[]>([]);
  const [showHandTargetSelect, setShowHandTargetSelect] = useState(false);
  const [showAttackTargetSelect, setShowAttackTargetSelect] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [isHandTarget, setIsHandTarget] = useState(false);
  const [isFurtoAttack, setIsFurtoAttack] = useState(false);
  const [showPowerSelect, setShowPowerSelect] = useState(false);
  const [prevPTI, setPrevPTI] = useState<number | null>(null);
  const [prevStars, setPrevStars] = useState<number | null>(null);
  const [statGlowEffect, setStatGlowEffect] = useState<'pti-up' | 'pti-down' | 'star-up' | 'star-down' | null>(null);
  const [isNewlyPlaced, setIsNewlyPlaced] = useState(location === 'field');

  // Sync local cardText state with incoming card.text prop (for real-time updates)
  useEffect(() => {
    setCardText(card.text || "");
  }, [card.text]);

  // Reset newly placed flag after animation completes
  useEffect(() => {
    if (isNewlyPlaced) {
      const timer = setTimeout(() => setIsNewlyPlaced(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isNewlyPlaced]);
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

  const { playPointGain, playPointLoss, playStarGain, playStarLoss, playCardPlay } = useAudio();

  // Detect PTI and Star changes to trigger visual/audio effects
  useEffect(() => {
    if (location !== 'field') return;
    if (card.type !== 'personaggi' && card.type !== 'personaggi_speciali') return;
    
    const currentPTI = parsePTI(card.text);
    const currentStars = parseStars(card.text);
    
    // PTI change detection
    if (prevPTI !== null && currentPTI !== null && currentPTI !== prevPTI) {
      const diff = currentPTI - prevPTI;
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 3;
        const id = `pti-${Date.now()}-${Math.random()}`;
        
        if (diff > 0) {
          setFloatingNumbers(prev => [...prev, { id, value: diff, type: 'heal', x, y }]);
          playPointGain();
          setStatGlowEffect('pti-up');
        } else {
          setFloatingNumbers(prev => [...prev, { id, value: Math.abs(diff), type: 'damage', x, y }]);
          playPointLoss();
          setStatGlowEffect('pti-down');
        }
        
        // Clear glow effect after animation
        setTimeout(() => setStatGlowEffect(null), 1000);
      }
    }
    
    // Star change detection
    if (prevStars !== null && currentStars !== null && currentStars !== prevStars) {
      const diff = currentStars - prevStars;
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const id = `star-${Date.now()}-${Math.random()}`;
        
        if (diff > 0) {
          setFloatingNumbers(prev => [...prev, { id, value: diff, type: 'star-up', x, y }]);
          playStarGain();
          setStatGlowEffect('star-up');
        } else {
          setFloatingNumbers(prev => [...prev, { id, value: Math.abs(diff), type: 'star-down', x, y }]);
          playStarLoss();
          setStatGlowEffect('star-down');
        }
        
        // Clear glow effect after animation
        setTimeout(() => setStatGlowEffect(null), 1000);
      }
    }
    
    // Update previous values
    setPrevPTI(currentPTI);
    setPrevStars(currentStars);
  }, [card.text, location, card.type, prevPTI, prevStars, playPointGain, playPointLoss, playStarGain, playStarLoss]);

  // Play card placement sound for cards entering field
  useEffect(() => {
    if (isNewlyPlaced && location === 'field') {
      playCardPlay();
    }
  }, []);

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
      return filename.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase();
    } catch {
      return '';
    }
  };

  const isAtaccoDisonesto = card.type === 'mosse' && location === 'field' && getCardName(card) === 'ATTACCO DISONESTO';

  const handleAttaccoDisonesto = () => {
    // Check if player's character has 0 stars or 0 PTI
    const playerCharacter = gameState?.field?.find(
      c => c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
    );
    
    if (playerCharacter && playerCharacter.text) {
      const starsMatch = playerCharacter.text.match(/stelle:\s*0/i);
      const ptiZeroMatch = playerCharacter.text.match(/PTI:\s*0(?:\s|$)/);
      
      if (starsMatch) {
        alert('❌ Il tuo personaggio ha 0 stelle e non può usare carte MOSSE!');
        return;
      }
      
      if (ptiZeroMatch || playerCharacter.text === "0") {
        alert('❌ Il tuo personaggio ha 0 PTI e non può usare carte MOSSE!');
        return;
      }
    }

    // Set this MOSSE card as the selected card for attack
    setSelectedMosseCard(card);
    // Open hand target selection for ATTACCO DISONESTO
    setShowHandTargetSelect(true);
  };

  const handleCardClick = () => {
    // If a MOSSE card is selected (for regular attacks on field)
    if (selectedMosseCard) {
      // Check if player's character has 0 stars or 0 PTI
      const playerCharacter = gameState?.field?.find(
        c => c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
      );
      
      if (playerCharacter && playerCharacter.text) {
        const starsMatch = playerCharacter.text.match(/stelle:\s*0/i);
        const ptiZeroMatch = playerCharacter.text.match(/PTI:\s*0(?:\s|$)/);
        
        if (starsMatch) {
          alert('❌ Il tuo personaggio ha 0 stelle e non può usare carte MOSSE!');
          setSelectedMosseCard(null);
          return;
        }
        
        if (ptiZeroMatch || playerCharacter.text === "0") {
          alert('❌ Il tuo personaggio ha 0 PTI e non può usare carte MOSSE!');
          setSelectedMosseCard(null);
          return;
        }
      }

      // Regular MOSSE attack on field (NOT for ATTACCO DISONESTO - that has its own button)
      // Can attack ANY personaggio on field (allies or opponents)
      if (location === 'field' && 
          (card.type === 'personaggi' || card.type === 'personaggi_speciali')) {
        
        // Check if the MOSSE card is FURTO
        const mosseCardName = getCardName(selectedMosseCard);
        const isFurto = mosseCardName === 'FURTO' || mosseCardName.includes('FURTO');
        setIsFurtoAttack(isFurto);
        
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
      if (damage < 0) {
        alert("Il risultato non può essere negativo");
        return;
      }

      // Attack with damage value
      socket.emit('mosse-attack', { 
        mosseCardId: selectedMosseCard?.id,
        targetCardId: targetCard?.id,
        attackerName: playerName,
        targetOwner: targetCard?.owner,
        damageValue: damage,
        isHandTarget: isHandTarget,
        isFurtoAttack: isFurtoAttack  // NEW: Pass FURTO flag for star stealing
      });

      // Clear states
      setSelectedMosseCard(null);
      setShowDamageInput(false);
      setDamageValue("");
      setTargetCard(null);
      setIsHandTarget(false);
      setIsFurtoAttack(false);
    } catch (error: any) {
      alert(error.message || "Errore nel calcolo del danno");
    }
  };

  const handleDamageCancel = () => {
    setShowDamageInput(false);
    setDamageValue("");
    setTargetCard(null);
    setIsHandTarget(false);
    setIsFurtoAttack(false);
  };

  const handleHandTargetSelect = (targetCard: any) => {
    setTargetCard(targetCard);
    setIsHandTarget(true);
    setShowHandTargetSelect(false);
    setShowDamageInput(true);
  };

  const handleToggleTarget = (cardId: string) => {
    setSelectedTargets(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  const handleConfirmTargetSelection = () => {
    if (selectedTargets.length === 0) {
      alert('Seleziona almeno un bersaglio!');
      return;
    }
    
    const allPersonaggi = gameState?.field?.filter(
      (c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali'
    ) || [];
    
    const targets = allPersonaggi.filter((c: any) => selectedTargets.includes(c.id));
    setTargetCards(targets);
    setShowAttackTargetSelect(false);
    setShowDamageInput(true);
  };

  const handleMultiTargetDamageConfirm = () => {
    try {
      const damage = evaluateExpression(damageValue.trim());
      if (damage < 0) {
        alert("Il risultato non può essere negativo");
        return;
      }

      // Attack all selected targets with delay between each to prevent server overwrite issues
      // Server can only handle ONE pending defense at a time, so we need to wait for each attack
      // to fully complete (including defense resolution) before sending the next one
      const attackWithDelay = async () => {
        for (let i = 0; i < targetCards.length; i++) {
          const target = targetCards[i];
          socket.emit('mosse-attack', { 
            mosseCardId: selectedMosseCard?.id,
            targetCardId: target.id,
            attackerName: playerName,
            targetOwner: target.owner,
            damageValue: damage,
            isHandTarget: false,
            isFurtoAttack: false
          });
          
          // Wait 3 seconds between attacks to allow full attack cycle (including defense resolution)
          if (i < targetCards.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
      };
      
      attackWithDelay();

      // Clear states
      setSelectedMosseCard(null);
      setShowDamageInput(false);
      setDamageValue("");
      setTargetCard(null);
      setTargetCards([]);
      setSelectedTargets([]);
      setIsHandTarget(false);
      setIsFurtoAttack(false);
    } catch (error: any) {
      alert(error.message || "Errore nel calcolo del danno");
    }
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
    const oldText = cardText;
    setCardText(newText);
    socket.emit('update-card-text', { cardId: card.id, text: newText });

    // Premium 3D Effects for Power/Star changes
    if (location === 'field') {
      const getPti = (t: string) => {
        const match = t.match(/PTI:\s*(\d+)/i);
        return match ? parseInt(match[1]) : (t.match(/^\d+$/) ? parseInt(t) : null);
      };
      const getStars = (t: string) => {
        const match = t.match(/stelle:\s*(\d+)/i);
        return match ? parseInt(match[1]) : null;
      };

      const oldPti = getPti(oldText);
      const newPti = getPti(newText);
      const oldStars = getStars(oldText);
      const newStars = getStars(newText);

      const addFloatingNumber = (value: number, type: 'damage' | 'heal' | 'star-up' | 'star-down') => {
        if (cardRef.current) {
          const rect = cardRef.current.getBoundingClientRect();
          const id = `${Date.now()}-${Math.random()}`;
          setFloatingNumbers(prev => [...prev, {
            id,
            value,
            type,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 3
          }]);
        }
      };

      if (newPti !== null && oldPti !== null && newPti > oldPti) {
        setPowerEffect('up');
        playPointGain();
        addFloatingNumber(newPti - oldPti, 'heal');
        setTimeout(() => setPowerEffect(null), 1200);
      } else if (newPti !== null && oldPti !== null && newPti < oldPti) {
        setPowerEffect('down');
        playPointLoss();
        addFloatingNumber(oldPti - newPti, 'damage');
        setTimeout(() => setPowerEffect(null), 1200);
      } else if (newStars !== null && oldStars !== null && newStars > oldStars) {
        setPowerEffect('up');
        playStarGain();
        addFloatingNumber(newStars - oldStars, 'star-up');
        setTimeout(() => setPowerEffect(null), 1200);
      } else if (newStars !== null && oldStars !== null && newStars < oldStars) {
        setPowerEffect('down');
        playStarLoss();
        addFloatingNumber(oldStars - newStars, 'star-down');
        setTimeout(() => setPowerEffect(null), 1200);
      }
    }
    
    // Check if PTI has reached 0 for a PERSONAGGI card on field
    if ((card.type === 'personaggi' || card.type === 'personaggi_speciali') && location === 'field') {
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
  const isMinkiard300 = getCardName(card) === 'MINKIARD N 300';
  
  const handleSuperDice = () => {
    console.log('SUPER DICE button clicked for MINKIARD N 300');
    socket.emit('open-super-dice', { gameId, playerName });
  };
  
  const otherPlayers = Object.keys(gameState?.players || {}).filter(p => p !== playerName);
  const isShaking = shakingCards.has(card.id);
  const isMosseSelected = selectedMosseCard?.id === card.id;
  
  // Check if this is a PERSONAGGI card
  const isPersonaggio = card.type === 'personaggi' || card.type === 'personaggi_speciali';
  
  // Add animation class for newly played cards (when they appear on field)
  const shouldAnimate = location === 'field';
  const isBonus = card.type === 'bonus';
  const isMosse = card.type === 'mosse';
  const isSpeciali = card.type === 'personaggi_speciali';
  
  // Get dramatic entry animation class based on card type
  const getEntryAnimationClass = () => {
    if (location !== 'field') return '';
    if (isPersonaggio && !isSpeciali) return 'card-personaggi-enter';
    if (isMosse) return 'card-mosse-enter';
    if (isBonus) return 'card-bonus-enter';
    if (isSpeciali) return 'card-speciali-enter';
    return 'card-epic-enter';
  };
  
  // Random scatter direction for elimination (pre-calculated)
  const [scatterX] = useState(() => (Math.random() - 0.5) * 80 - (Math.random() > 0.5 ? 40 : -40));
  const [scatterY] = useState(() => (Math.random() - 0.5) * 80 - 60);

  const removeFloatingNumber = (id: string) => {
    setFloatingNumbers(prev => prev.filter(n => n.id !== id));
  };

  // Get stat glow class based on effect
  const getStatGlowClass = () => {
    if (!statGlowEffect) return '';
    switch (statGlowEffect) {
      case 'pti-up': return 'stat-glow-heal';
      case 'pti-down': return 'stat-glow-damage';
      case 'star-up': return 'stat-glow-star-up';
      case 'star-down': return 'stat-glow-star-down';
      default: return '';
    }
  };

  return (
    <div 
      ref={cardRef}
      className={`flex flex-col gap-2 ${powerEffect === 'up' ? 'animate-power-up' : powerEffect === 'down' ? 'animate-power-down' : ''} ${getStatGlowClass()} ${isNewlyPlaced && location === 'field' ? 'card-field-entry' : ''}`}
    >
      {/* Floating Numbers */}
      {floatingNumbers.map(num => (
        <FloatingNumber
          key={num.id}
          value={num.value}
          type={num.type}
          x={num.x}
          y={num.y}
          onComplete={() => removeFloatingNumber(num.id)}
        />
      ))}
      
      {/* Card Image */}
      <div 
        className="relative"
        style={isEliminated && isPersonaggio ? {
          '--tx': `translate(${scatterX}px, ${scatterY}px)`
        } as React.CSSProperties : undefined}
      >
        <img
          src={showBack || card.faceDown ? card.backImage : card.frontImage}
          alt="Card"
          className={`w-14 h-auto aspect-[2/3] sm:w-16 md:w-20 lg:w-24 card-master cursor-pointer object-cover rounded-xl
            ${getEntryAnimationClass()}
            ${card.type === 'personaggi' ? 'card-border-personaggi' : ''}
            ${card.type === 'mosse' ? 'card-border-mosse' : ''}
            ${card.type === 'bonus' ? 'card-border-bonus' : ''}
            ${card.type === 'personaggi_speciali' ? 'card-border-speciali' : ''}
            ${isEliminated && isPersonaggio ? 'card-disperse' : ''} 
            ${isShaking && !isEliminated ? 'animate-shake' : ''} 
            ${isMosseSelected ? 'ring-4 ring-purple-500 ring-opacity-70' : ''}
            ${card.faceDown ? 'ring-2 ring-orange-400 ring-opacity-50' : ''}`}
          onClick={handleCardClick}
        />
        
        {location === 'field' && (
          <div className="absolute -top-2 left-0 bg-black/70 text-white px-2 py-1 rounded text-xs">
            {card.owner}
          </div>
        )}
        
        {/* Red X elimination animation */}
        {isEliminated && !isPersonaggio && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-600/50 rounded-xl animate-pulse">
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
          className={`w-14 sm:w-16 md:w-20 lg:w-24 h-12 sm:h-14 md:h-16 text-[10px] sm:text-xs p-1 rounded resize-none neon-text-area neon-${card.type}`}
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

      {/* ATTACCA button for MOSSE cards on field (owned by player) - positioned AFTER text note */}
      {location === 'field' && card.type === 'mosse' && isOwner && !card.faceDown && (
        <div className="flex flex-col gap-1 mt-1">
          <Button
            onClick={() => {
              if (isAtaccoDisonesto) {
                handleAttaccoDisonesto();
              } else {
                // For regular MOSSE, open target selection panel
                setSelectedMosseCard(card);
                setSelectedTargets([]);
                setShowAttackTargetSelect(true);
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-2 py-1"
            size="sm"
          >
            ⚔️ ATTACCA
          </Button>
        </div>
      )}
      
      {/* Spacer for non-MOSSE field cards to maintain alignment with MOSSE cards that have ATTACCA button */}
      {location === 'field' && card.type !== 'mosse' && !card.faceDown && (
        <div className="h-6 sm:h-7"></div>
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

      {/* POTERI button for PERSONAGGI cards on field - copy special powers from other characters */}
      {location === 'field' && isPersonaggio && isOwner && !card.faceDown && (
        <div className="flex flex-col gap-1 mt-1">
          <Button
            onClick={() => setShowPowerSelect(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-xs px-2 py-1"
            size="sm"
            style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
          >
            ✨ POTERI
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

      {/* Hand Target Selection Modal (for ATTACCO DISONESTO) - HORIZONTAL CENTERED */}
      {showHandTargetSelect && ReactDOM.createPortal(
        <div 
          onClick={() => setShowHandTargetSelect(false)}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(0, 0, 0, 0.95)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 2147483647 
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              width: '1800px',
              maxWidth: '95vw',
              height: '500px', 
              backgroundColor: '#0f172a', 
              borderRadius: '20px', 
              border: '6px solid #ef4444', 
              padding: '30px',
              boxShadow: '0 0 100px rgba(239, 68, 68, 0.8)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Title and Close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '40px', margin: 0 }}>🎯 ATTACCO DISONESTO</h2>
              <button
                onClick={() => setShowHandTargetSelect(false)}
                style={{ backgroundColor: '#ef4444', color: 'white', padding: '15px 30px', fontWeight: 'bold', fontSize: '20px', cursor: 'pointer', borderRadius: '10px', border: 'none' }}
              >
                ✕ CHIUDI
              </button>
            </div>
            
            <p style={{ color: 'white', textAlign: 'center', fontSize: '22px', margin: '0 0 20px 0' }}>Scegli un personaggio in mano da attaccare:</p>
            
            {/* HORIZONTAL ROW of opponents */}
            <div style={{ display: 'flex', flexDirection: 'row', gap: '30px', overflowX: 'auto', flex: 1, padding: '10px 0' }}>
              {Object.entries(gameState?.players || {}).map(([pName, pData]: [string, any]) => {
                if (pName === playerName) return null;
                const handCards = pData.hand?.filter((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali') || [];
                if (handCards.length === 0) return null;
                
                return (
                  <div key={pName} style={{ backgroundColor: '#1e293b', borderRadius: '15px', padding: '25px', border: '4px solid #f97316', minWidth: '350px', flexShrink: 0 }}>
                    <h3 style={{ color: '#fb923c', fontWeight: 'bold', fontSize: '30px', textAlign: 'center', margin: '0 0 15px 0' }}>🎮 {pName}</h3>
                    <p style={{ color: '#94a3b8', textAlign: 'center', marginBottom: '15px' }}>{handCards.length} personaggio/i in mano</p>
                    <div style={{ display: 'flex', flexDirection: 'row', gap: '15px', justifyContent: 'center' }}>
                      {handCards.map((hCard: any, idx: number) => (
                        <button
                          key={hCard.id}
                          onClick={() => handleHandTargetSelect(hCard)}
                          style={{ 
                            backgroundColor: '#dc2626', 
                            color: 'white', 
                            padding: '20px', 
                            height: '220px', 
                            width: '150px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            borderRadius: '15px', 
                            border: '4px solid #fca5a5', 
                            cursor: 'pointer', 
                            fontSize: '16px', 
                            fontWeight: 'bold'
                          }}
                        >
                          <span style={{ fontSize: '70px', marginBottom: '10px' }}>🎴</span>
                          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>CARTA #{idx + 1}</span>
                          <span style={{ fontSize: '14px', color: '#fecaca', marginTop: '5px' }}>ATTACCA</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {Object.entries(gameState?.players || {}).every(([pName, pData]: [string, any]) => {
                if (pName === playerName) return true;
                return ((pData as any).hand?.filter((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali') || []).length === 0;
              }) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                  <p style={{ color: '#94a3b8', fontSize: '24px' }}>⚠️ Nessun bersaglio disponibile</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Attack Target Selection Panel */}
      {showAttackTargetSelect && ReactDOM.createPortal(
        <div 
          onClick={() => {
            setShowAttackTargetSelect(false);
            setSelectedTargets([]);
            setSelectedMosseCard(null);
          }}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(0, 0, 0, 0.95)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 2147483647 
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              width: '95vw',
              maxWidth: '1200px',
              maxHeight: '90vh',
              backgroundColor: '#0f172a', 
              borderRadius: '20px', 
              border: '6px solid #ef4444', 
              padding: '20px',
              boxShadow: '0 0 100px rgba(239, 68, 68, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '24px', margin: 0 }}>🎯 SELEZIONA BERSAGLI</h2>
              <button
                onClick={() => {
                  setShowAttackTargetSelect(false);
                  setSelectedTargets([]);
                  setSelectedMosseCard(null);
                }}
                style={{ backgroundColor: '#ef4444', color: 'white', padding: '10px 20px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', borderRadius: '10px', border: 'none' }}
              >
                ✕ CHIUDI
              </button>
            </div>
            
            <p style={{ color: '#94a3b8', marginBottom: '15px', fontSize: '14px' }}>
              Seleziona uno o più personaggi da attaccare. Puoi selezionarne più di uno per un attacco multiplo.
            </p>

            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px', padding: '10px' }}>
              {(gameState?.field?.filter((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali') || []).map((character: any) => {
                const isSelected = selectedTargets.includes(character.id);
                const ptiMatch = (character.text || '').match(/PTI:\s*(\d+)/i);
                const stelleMatch = (character.text || '').match(/Stelle:\s*(\d+)/i);
                const pti = ptiMatch ? ptiMatch[1] : '?';
                const stelle = stelleMatch ? stelleMatch[1] : '?';
                const cardName = getCardName(character);
                
                return (
                  <div
                    key={character.id}
                    onClick={() => handleToggleTarget(character.id)}
                    style={{
                      backgroundColor: isSelected ? '#166534' : '#1e293b',
                      border: isSelected ? '4px solid #22c55e' : '3px solid #475569',
                      borderRadius: '15px',
                      padding: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      <img 
                        src={character.frontImage} 
                        alt={cardName}
                        style={{ 
                          width: '80px', 
                          height: '110px', 
                          borderRadius: '10px', 
                          objectFit: 'cover',
                          border: isSelected ? '3px solid #22c55e' : '2px solid #64748b'
                        }}
                      />
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          top: '-10px',
                          right: '-10px',
                          backgroundColor: '#22c55e',
                          borderRadius: '50%',
                          width: '30px',
                          height: '30px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px'
                        }}>
                          ✓
                        </div>
                      )}
                    </div>
                    
                    <div style={{ textAlign: 'center', width: '100%' }}>
                      <p style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '12px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cardName}
                      </p>
                      <p style={{ color: character.owner === playerName ? '#22c55e' : '#f87171', fontSize: '11px', margin: '4px 0' }}>
                        {character.owner === playerName ? '(TU)' : character.owner}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', fontSize: '11px' }}>
                        <span style={{ color: '#60a5fa' }}>PTI: {pti}</span>
                        <span style={{ color: '#fbbf24' }}>⭐ {stelle}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '15px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setShowAttackTargetSelect(false);
                  setSelectedTargets([]);
                  setSelectedMosseCard(null);
                }}
                style={{ 
                  backgroundColor: '#4b5563', 
                  color: 'white', 
                  padding: '15px 40px', 
                  fontWeight: 'bold', 
                  fontSize: '16px', 
                  cursor: 'pointer', 
                  borderRadius: '10px', 
                  border: 'none' 
                }}
              >
                ANNULLA
              </button>
              <button
                onClick={handleConfirmTargetSelection}
                disabled={selectedTargets.length === 0}
                style={{ 
                  backgroundColor: selectedTargets.length > 0 ? '#dc2626' : '#6b7280', 
                  color: 'white', 
                  padding: '15px 40px', 
                  fontWeight: 'bold', 
                  fontSize: '16px', 
                  cursor: selectedTargets.length > 0 ? 'pointer' : 'not-allowed', 
                  borderRadius: '10px', 
                  border: 'none',
                  opacity: selectedTargets.length > 0 ? 1 : 0.5
                }}
              >
                ⚔️ ATTACCA ({selectedTargets.length})
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Damage Input Dialog */}
      <Dialog open={showDamageInput} onOpenChange={setShowDamageInput}>
        <DialogContent className="bg-gray-900 border-gray-600 max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-2xl font-bold">
              {isHandTarget ? '🎯 ATTACCO DISONESTO - Inserisci Danno' : targetCards.length > 1 ? `⚔️ ATTACCO MULTIPLO (${targetCards.length} bersagli)` : 'Inserisci Danno dell\'Attacco'}
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
                        className="w-24 h-32 rounded-xl border-2 border-green-500 object-cover shadow-lg"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      <p className="text-gray-300 text-xs text-center mt-2 max-w-24">
                        {gameState.field.find((c: any) => c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'))?.text || 'Nessun testo'}
                      </p>
                    </>
                  ) : (
                    <div className="w-24 h-32 rounded-xl border-2 border-green-500 bg-gray-700 flex items-center justify-center">
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
                    className="w-28 h-36 rounded-xl border-4 border-yellow-500 object-cover shadow-lg"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                  <p className="text-yellow-400 font-bold text-xs text-center mt-2">MOSSA</p>
                </>
              ) : (
                <div className="w-28 h-36 rounded-xl border-4 border-yellow-500 bg-gray-700 flex items-center justify-center">
                  <p className="text-gray-400 text-xs">MOSSE</p>
                </div>
              )}
            </div>

            {/* RIGHT: Defender Character(s) or Hand Card */}
            <div className="flex flex-col items-center">
              <p className="text-white font-bold mb-2 text-sm">
                {isHandTarget ? 'BERSAGLIO (MANO)' : targetCards.length > 1 ? `BERSAGLI (${targetCards.length})` : 'DIFENSORE'}
              </p>
              {targetCards.length > 0 ? (
                <div className="flex flex-wrap gap-2 justify-center max-w-48">
                  {targetCards.map((tc: any) => (
                    <div key={tc.id} className="flex flex-col items-center">
                      <img 
                        src={tc.frontImage}
                        alt="Bersaglio"
                        className="w-16 h-20 rounded-lg border-2 border-red-500 object-cover shadow-lg"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      <p className="text-red-400 text-[10px] text-center mt-1 max-w-16 truncate">
                        {tc.owner}
                      </p>
                    </div>
                  ))}
                </div>
              ) : targetCard ? (
                <>
                  {isHandTarget ? (
                    <div className="w-24 h-32 rounded-xl border-2 border-red-500 bg-gradient-to-br from-red-900 to-red-700 flex items-center justify-center">
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
                        className="w-24 h-32 rounded-xl border-2 border-red-500 object-cover shadow-lg"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      <p className="text-gray-300 text-xs text-center mt-2 max-w-24">
                        {targetCard.text || 'Nessun testo'}
                      </p>
                    </>
                  )}
                </>
              ) : (
                <div className="w-24 h-32 rounded-xl border-2 border-red-500 bg-gray-700 flex items-center justify-center">
                  <p className="text-gray-400 text-xs">?</p>
                </div>
              )}
            </div>
          </div>

          {/* Damage Input Section */}
          <div className="space-y-4 mt-6">
            <div className={`p-4 rounded-lg border ${isFurtoAttack ? 'bg-yellow-900 border-yellow-600' : 'bg-gray-800 border-gray-600'}`}>
              {isFurtoAttack ? (
                <>
                  <p className="text-yellow-300 text-lg font-bold mb-2">
                    ⭐ FURTO - Quante STELLE rubi a <span className="text-red-400 font-bold">{targetCard?.owner}</span>?
                  </p>
                  <p className="text-yellow-200 text-xs mb-3">
                    Le stelle rubate verranno sottratte dal personaggio avversario. Se le stelle scendono a 0, il personaggio non potrà più usare MOSSE. Se scendono sotto 0, il personaggio muore!
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gray-300 text-sm mb-2">
                    {targetCards.length > 1 
                      ? `Quanto danno fa la tua carta MOSSE a ${targetCards.length} bersagli?`
                      : <>Quanto danno fa la tua carta MOSSE a <span className="text-red-400 font-bold">{targetCard?.owner || targetCards[0]?.owner}</span>?</>
                    }
                  </p>
                  <p className="text-gray-400 text-xs mb-3">
                    Puoi inserire operazioni: 50x3, 100+20, 200-50, ecc.
                    {targetCards.length > 1 && <span className="text-yellow-400 ml-1">(Lo stesso danno verrà applicato a tutti i bersagli)</span>}
                  </p>
                </>
              )}
              <Input
                type="text"
                value={damageValue}
                onChange={(e) => setDamageValue(e.target.value)}
                placeholder={isFurtoAttack ? "es: 1, 2, 3..." : "es: 50x3, 100+50, 150..."}
                className={`text-lg font-bold ${isFurtoAttack ? 'bg-yellow-800 border-yellow-500 text-white' : 'bg-gray-700 border-gray-600 text-white'}`}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={targetCards.length > 0 ? handleMultiTargetDamageConfirm : handleDamageConfirm}
                className={`flex-1 font-bold py-3 text-lg ${isFurtoAttack ? 'bg-yellow-600 hover:bg-yellow-700 text-black' : 'bg-red-600 hover:bg-red-700 text-white'}`}
              >
                {isFurtoAttack ? '⭐ RUBA STELLE' : targetCards.length > 1 ? `⚔️ ATTACCA TUTTI (${targetCards.length})` : '⚔️ ATTACCA'}
              </Button>
              <Button
                onClick={() => {
                  handleDamageCancel();
                  setTargetCards([]);
                  setSelectedTargets([]);
                }}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3"
              >
                ✕ ANNULLA
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* POTERI Power Selection Modal */}
      {showPowerSelect && ReactDOM.createPortal(
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setShowPowerSelect(false)}
        >
          <div 
            style={{
              backgroundColor: '#1f2937',
              borderRadius: '20px',
              padding: '30px',
              maxWidth: '900px',
              maxHeight: '85vh',
              overflowY: 'auto',
              border: '3px solid #8b5cf6',
              boxShadow: '0 0 40px rgba(139, 92, 246, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
                ✨ SCEGLI POTERE DA COPIARE
              </h2>
              <button
                onClick={() => setShowPowerSelect(false)}
                style={{ backgroundColor: '#dc2626', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                CHIUDI
              </button>
            </div>
            
            <p style={{ color: '#9ca3af', marginBottom: '20px', fontSize: '14px' }}>
              Seleziona un personaggio per copiare i suoi poteri speciali su <strong style={{ color: '#a78bfa' }}>{getCardName(card)}</strong>
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '15px' }}>
              {[
                { name: 'CIMICE', image: 'https://i.postimg.cc/sgKH2qy1/CIMICE.png', description: '-50 PTI a tutti quando attaccata, -500 PTI a tutti quando muore' },
                { name: 'PARASSITA', image: 'https://i.postimg.cc/zXvPP4mM/PARASSITA.png', description: 'Si aggancia a un nemico, drena 100 PTI per turno' },
                { name: 'SAIBAIM', image: 'https://i.postimg.cc/K8Lm6Qk6/SAIBAIM.png', description: 'Si aggancia a un nemico, esplode dopo 3 turni' },
                { name: 'BAMBOLA VOODOO', image: 'https://i.postimg.cc/Xq8sJzB2/BAMBOLA-VOODOO.png', description: 'Collega due personaggi, i danni si riflettono' },
              ].map((power) => (
                <div
                  key={power.name}
                  onClick={() => {
                    socket.emit('copy-power', { 
                      cardId: card.id, 
                      playerName: effectivePlayerName,
                      powerSource: power.name 
                    });
                    setShowPowerSelect(false);
                  }}
                  style={{
                    backgroundColor: '#374151',
                    borderRadius: '12px',
                    padding: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '2px solid transparent',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#8b5cf6';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <img 
                    src={power.image} 
                    alt={power.name}
                    style={{ width: '80px', height: '110px', objectFit: 'cover', borderRadius: '8px', margin: '0 auto 8px auto', display: 'block' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <p style={{ color: '#a78bfa', fontWeight: 'bold', fontSize: '12px', marginBottom: '4px' }}>{power.name}</p>
                  <p style={{ color: '#9ca3af', fontSize: '10px', lineHeight: '1.3' }}>{power.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
