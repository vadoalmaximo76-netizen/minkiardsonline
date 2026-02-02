import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import ReactDOM from "react-dom";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { useAudio } from "../lib/stores/useAudio";
import { X, Palette } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { FloatingNumber } from "./FloatingNumber";
import { SkinSelectionPanel } from "./SkinSelectionPanel";

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

const parseOriginalPTI = (text: string | undefined): number | null => {
  if (!text) return null;
  const match = text.match(/PTI originali:\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
};

const getHealthPercentage = (currentPTI: number | null, originalPTI: number | null): number => {
  if (currentPTI === null || originalPTI === null || originalPTI <= 0) return 100;
  const percentage = Math.max(0, Math.min(100, (currentPTI / originalPTI) * 100));
  return percentage;
};

const getHealthBarColor = (percentage: number): string => {
  if (percentage >= 80) return 'from-cyan-400 via-blue-500 to-blue-600';
  if (percentage >= 60) return 'from-green-400 via-teal-500 to-cyan-500';
  if (percentage >= 40) return 'from-yellow-400 via-orange-500 to-amber-500';
  if (percentage >= 20) return 'from-orange-500 via-red-500 to-red-600';
  return 'from-red-600 via-red-700 to-red-900';
};

// Helper to check character-specific overrides for MOSSE cards
interface CharacterOverrideResult {
  damageValue: number | null;
  effect: string | null;
  overrideType: 'usedBy' | 'usedOn' | 'both' | null;
}

const getCharacterOverride = (
  mosseCard: any,
  attackerCardName: string | null,
  targetCardName: string | null
): CharacterOverrideResult => {
  const result: CharacterOverrideResult = { damageValue: null, effect: null, overrideType: null };
  
  if (!mosseCard?.mosseCharacterOverrides || !Array.isArray(mosseCard.mosseCharacterOverrides)) {
    return result;
  }
  
  const overrides = mosseCard.mosseCharacterOverrides;
  
  // Normalize names for comparison
  const normalizeCardName = (name: string | null): string => {
    if (!name) return '';
    return name.toUpperCase().replace(/[_-]/g, ' ').trim();
  };
  
  const attackerNorm = normalizeCardName(attackerCardName);
  const targetNorm = normalizeCardName(targetCardName);
  
  // Check for usedBy override (when attacker matches)
  if (attackerNorm) {
    const usedByOverride = overrides.find((o: any) => {
      const charNorm = normalizeCardName(o.characterName || o.characterId);
      return charNorm === attackerNorm && o.usedBy && (o.usedBy.damageValue !== null || o.usedBy.effect);
    });
    if (usedByOverride?.usedBy) {
      result.damageValue = usedByOverride.usedBy.damageValue;
      result.effect = usedByOverride.usedBy.effect;
      result.overrideType = 'usedBy';
    }
  }
  
  // Check for usedOn override (when target matches) - takes priority over usedBy
  if (targetNorm) {
    const usedOnOverride = overrides.find((o: any) => {
      const charNorm = normalizeCardName(o.characterName || o.characterId);
      return charNorm === targetNorm && o.usedOn && (o.usedOn.damageValue !== null || o.usedOn.effect);
    });
    if (usedOnOverride?.usedOn) {
      // If both usedBy and usedOn exist, usedOn takes priority for damage/effect
      if (result.overrideType === 'usedBy') {
        result.overrideType = 'both';
      } else {
        result.overrideType = 'usedOn';
      }
      // usedOn values override usedBy values
      if (usedOnOverride.usedOn.damageValue !== null) {
        result.damageValue = usedOnOverride.usedOn.damageValue;
      }
      if (usedOnOverride.usedOn.effect) {
        result.effect = usedOnOverride.usedOn.effect;
      }
    }
  }
  
  return result;
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
    protectedByRifugio?: string;
    rifugioProtecting?: string;
    rifugioPTI?: number;
    isBarrieraShield?: boolean;
    barrieraProtecting?: string;
    barrieraPTI?: number;
    appliedSkinUrl?: string | null;
  };
  location: 'hand' | 'field' | 'graveyard';
  showBack?: boolean;
  onCardPlayed?: () => void;
}

import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { CARD_KEYWORDS } from "../lib/tooltips";

const KeywordDescription: React.FC<{ text: string }> = ({ text }) => {
  const parts = useMemo(() => {
    // Escape keywords for regex and sort by length descending to match longest first
    const keywords = Object.keys(CARD_KEYWORDS).sort((a, b) => b.length - a.length);
    const pattern = new RegExp(`(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    
    return text.split(pattern).map((part, i) => {
      const keywordMatch = keywords.find(k => k.toLowerCase() === part.toLowerCase());
      if (keywordMatch) {
        return (
          <TooltipProvider key={i}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-yellow-400 font-bold cursor-help underline decoration-dotted decoration-yellow-400/50 hover:text-yellow-300 transition-colors">
                  {part}
                </span>
              </TooltipTrigger>
              <TooltipContent className="hidden bg-slate-900 border-slate-700 text-white p-2 text-xs shadow-2xl">
                {CARD_KEYWORDS[keywordMatch]}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      return part;
    });
  }, [text]);

  return <>{parts}</>;
};

const CardComponent: React.FC<CardProps> = ({ card, location, showBack = false, onCardPlayed }) => {
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
  const [starsToRemove, setStarsToRemove] = useState("");
  const [targetCard, setTargetCard] = useState<any>(null);
  const [targetCards, setTargetCards] = useState<any[]>([]);
  const [showHandTargetSelect, setShowHandTargetSelect] = useState(false);
  const [showAttackTargetSelect, setShowAttackTargetSelect] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [isHandTarget, setIsHandTarget] = useState(false);
  const [isFurtoAttack, setIsFurtoAttack] = useState(false);
  const [selectedMosseEffect, setSelectedMosseEffect] = useState<string | null>(null);
  const [mosseHasPreset, setMosseHasPreset] = useState(false);
  const [prevPTI, setPrevPTI] = useState<number | null>(null);
  const [prevStars, setPrevStars] = useState<number | null>(null);
  const [statGlowEffect, setStatGlowEffect] = useState<'pti-up' | 'pti-down' | 'star-up' | 'star-down' | null>(null);
  const [isNewlyPlaced, setIsNewlyPlaced] = useState(location === 'field');
  const [imageLoaded, setImageLoaded] = useState(true); // Start as true for immediate interaction
  const originalPTIRef = useRef<number | null>(null);
  const prevLocationRef = useRef<string>(location);
  const [showSkinPanel, setShowSkinPanel] = useState(false);
  const [skinAnimation, setSkinAnimation] = useState<string | null>(null);
  
  // Use skin from card's game state (persisted) instead of local state
  const appliedSkinUrl = card.appliedSkinUrl || null;

  // Sync local cardText state with incoming card.text prop (for real-time updates)
  useEffect(() => {
    setCardText(card.text || "");
  }, [card.text]);

  // Capture original PTI on first valid PTI reading
  useEffect(() => {
    if (originalPTIRef.current === null) {
      const originalFromText = parseOriginalPTI(card.text);
      const currentPTI = parsePTI(card.text);
      if (originalFromText !== null) {
        originalPTIRef.current = originalFromText;
      } else if (currentPTI !== null && currentPTI > 0) {
        originalPTIRef.current = currentPTI;
      }
    }
  }, [card.text]);

  // Trigger animation when card moves to field
  useEffect(() => {
    if (location === 'field' && prevLocationRef.current !== 'field') {
      console.log(`🎬 Card ${card.id} entering field - triggering animation`);
      setIsNewlyPlaced(true);
    }
    prevLocationRef.current = location;
  }, [location, card.id]);

  // Reset newly placed flag after animation completes
  useEffect(() => {
    if (isNewlyPlaced) {
      const timer = setTimeout(() => setIsNewlyPlaced(false), 1500);
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
        
        // Auto-fill damage based on MOSSE card settings and character overrides
        const mosseCard = selectedMosseCard as any;
        const attackerCard = gameState?.field?.find((c: any) => 
          c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
        );
        const attackerStars = attackerCard?.stars || 1;
        const attackerName = attackerCard ? getCardName(attackerCard) : null;
        const targetName = getCardName(card);
        
        // Check for character-specific overrides first
        const charOverride = getCharacterOverride(mosseCard, attackerName, targetName);
        
        if (charOverride.overrideType) {
          // Use character-specific override values
          if (charOverride.damageValue !== null) {
            const suggestedDamage = charOverride.damageValue * attackerStars;
            setDamageValue(suggestedDamage.toString());
            setMosseHasPreset(true);
            console.log(`🎯 Character override applied (${charOverride.overrideType}): ${charOverride.damageValue} × ${attackerStars} = ${suggestedDamage}`);
          } else if (mosseCard.mosseDamageValue !== null && mosseCard.mosseDamageValue !== undefined) {
            const suggestedDamage = mosseCard.mosseDamageValue * attackerStars;
            setDamageValue(suggestedDamage.toString());
            setMosseHasPreset(true);
          } else {
            setDamageValue('');
            setMosseHasPreset(charOverride.effect !== null);
          }
          setSelectedMosseEffect(charOverride.effect || mosseCard.mosseDamageEffect || null);
        } else if (mosseCard.mosseDamageValue !== null && mosseCard.mosseDamageValue !== undefined) {
          // Use default MOSSE damage value
          const suggestedDamage = mosseCard.mosseDamageValue * attackerStars;
          setDamageValue(suggestedDamage.toString());
          setMosseHasPreset(true);
          setSelectedMosseEffect(mosseCard.mosseDamageEffect || null);
        } else {
          setDamageValue('');
          setMosseHasPreset(false);
          setSelectedMosseEffect(mosseCard.mosseDamageEffect || null);
        }
        
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
    if (onCardPlayed) {
      onCardPlayed();
    }
  };

  const handlePlayFaceDown = () => {
    socket.emit('play-card-face-down', { cardId: card.id, playerName: effectivePlayerName });
    if (onCardPlayed) {
      onCardPlayed();
    }
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

  const handleSkinSelect = (skinImageUrl: string | null, skinId: number | null, rarity: string) => {
    // Emit socket event to apply skin to card in game state
    socket.emit('apply-card-skin', {
      cardId: card.id,
      skinImageUrl: skinImageUrl,
      playerName: playerName
    });
    
    if (skinImageUrl) {
      const animClass = rarity === 'legendary' ? 'animate-legendary-glow' :
                        rarity === 'epic' ? 'animate-epic-glow' :
                        rarity === 'rare' ? 'animate-rare-glow' : 'animate-common-glow';
      setSkinAnimation(animClass);
      setTimeout(() => setSkinAnimation(null), 2000);
    } else {
      setSkinAnimation(null);
    }
    setShowSkinPanel(false);
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
      // If there's a special effect like "death", damage can be 0
      let damage = 0;
      if (damageValue.trim() !== '') {
        damage = evaluateExpression(damageValue.trim());
        if (damage < 0) {
          alert("Il risultato non può essere negativo");
          return;
        }
      } else if (!selectedMosseEffect) {
        // No damage value and no effect - require something
        alert("Inserisci un valore di danno!");
        return;
      }

      const stars = starsToRemove.trim() !== '' ? parseInt(starsToRemove) : 0;
      if (isNaN(stars) || stars < 0) {
        alert("Il valore delle stelle non è valido");
        return;
      }

      // Attack with damage value and optional effect
      socket.emit('mosse-attack', { 
        mosseCardId: selectedMosseCard?.id,
        targetCardId: targetCard?.id,
        attackerName: playerName,
        targetOwner: targetCard?.owner,
        damageValue: damage,
        starsToRemove: stars,
        isHandTarget: isHandTarget,
        isFurtoAttack: isFurtoAttack,
        mosseEffect: selectedMosseEffect  // Pass special effect
      });

      // Clear states
      setSelectedMosseCard(null);
      setShowDamageInput(false);
      setDamageValue("");
      setStarsToRemove("");
      setTargetCard(null);
      setIsHandTarget(false);
      setIsFurtoAttack(false);
      setSelectedMosseEffect(null);
      setMosseHasPreset(false);
    } catch (error: any) {
      alert(error.message || "Errore nel calcolo del danno");
    }
  };

  const handleDamageCancel = () => {
    setShowDamageInput(false);
    setDamageValue("");
    setStarsToRemove("");
    setTargetCard(null);
    setIsHandTarget(false);
    setIsFurtoAttack(false);
    setSelectedMosseEffect(null);
    setMosseHasPreset(false);
  };

  const handleHandTargetSelect = (handTargetCard: any) => {
    setTargetCard(handTargetCard);
    setIsHandTarget(true);
    setShowHandTargetSelect(false);
    
    // Auto-fill damage for hand target attacks with character override support
    const mosseCard = selectedMosseCard as any;
    const attackerCard = gameState?.field?.find((c: any) => 
      c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
    );
    const attackerStars = attackerCard?.stars || 1;
    const attackerName = attackerCard ? getCardName(attackerCard) : null;
    const targetName = getCardName(handTargetCard);
    
    // Check for character-specific overrides
    const charOverride = getCharacterOverride(mosseCard, attackerName, targetName);
    
    if (charOverride.overrideType) {
      if (charOverride.damageValue !== null) {
        const suggestedDamage = charOverride.damageValue * attackerStars;
        setDamageValue(suggestedDamage.toString());
        setMosseHasPreset(true);
        console.log(`🎯 Hand target override (${charOverride.overrideType}): ${charOverride.damageValue} × ${attackerStars} = ${suggestedDamage}`);
      } else if (mosseCard?.mosseDamageValue !== null && mosseCard?.mosseDamageValue !== undefined) {
        const suggestedDamage = mosseCard.mosseDamageValue * attackerStars;
        setDamageValue(suggestedDamage.toString());
        setMosseHasPreset(true);
      } else {
        setDamageValue('');
        setMosseHasPreset(charOverride.effect !== null);
      }
      setSelectedMosseEffect(charOverride.effect || mosseCard?.mosseDamageEffect || null);
    } else if (mosseCard?.mosseDamageValue !== null && mosseCard?.mosseDamageValue !== undefined) {
      const suggestedDamage = mosseCard.mosseDamageValue * attackerStars;
      setDamageValue(suggestedDamage.toString());
      setMosseHasPreset(true);
      setSelectedMosseEffect(mosseCard.mosseDamageEffect || null);
    } else {
      setDamageValue('');
      setMosseHasPreset(false);
      setSelectedMosseEffect(mosseCard?.mosseDamageEffect || null);
    }
    
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
    
    // Auto-fill damage based on MOSSE card configuration
    const mosseCard = selectedMosseCard as any;
    if (mosseCard) {
      const attackerCard = gameState?.field?.find((c: any) => 
        c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
      );
      const attackerStars = attackerCard?.stars || 1;
      const attackerName = attackerCard ? getCardName(attackerCard) : null;
      // Use first target for character override check
      const firstTarget = targets[0];
      const targetName = firstTarget ? getCardName(firstTarget) : null;
      
      // Check for character-specific overrides
      const charOverride = getCharacterOverride(mosseCard, attackerName, targetName);
      
      if (charOverride.overrideType) {
        if (charOverride.damageValue !== null) {
          const suggestedDamage = charOverride.damageValue * attackerStars;
          setDamageValue(suggestedDamage.toString());
          setMosseHasPreset(true);
          console.log(`🎯 Multi-target override (${charOverride.overrideType}): ${charOverride.damageValue} × ${attackerStars} = ${suggestedDamage}`);
        } else if (mosseCard.mosseDamageValue !== null && mosseCard.mosseDamageValue !== undefined) {
          const suggestedDamage = mosseCard.mosseDamageValue * attackerStars;
          setDamageValue(suggestedDamage.toString());
          setMosseHasPreset(true);
        } else {
          setDamageValue('');
          setMosseHasPreset(charOverride.effect !== null);
        }
        setSelectedMosseEffect(charOverride.effect || mosseCard.mosseDamageEffect || null);
      } else if (mosseCard.mosseDamageValue !== null && mosseCard.mosseDamageValue !== undefined) {
        const suggestedDamage = mosseCard.mosseDamageValue * attackerStars;
        setDamageValue(suggestedDamage.toString());
        setMosseHasPreset(true);
        setSelectedMosseEffect(mosseCard.mosseDamageEffect || null);
        console.log(`🎯 Multi-target autofill: ${mosseCard.mosseDamageValue} × ${attackerStars} = ${suggestedDamage}`);
      } else {
        setDamageValue('');
        setMosseHasPreset(false);
        setSelectedMosseEffect(mosseCard.mosseDamageEffect || null);
      }
    }
    
    setShowDamageInput(true);
  };

  const handleMultiTargetDamageConfirm = () => {
    try {
      const damage = evaluateExpression(damageValue.trim());
      if (damage < 0) {
        alert("Il risultato non può essere negativo");
        return;
      }

      const stars = starsToRemove.trim() !== '' ? parseInt(starsToRemove) : 0;
      if (isNaN(stars) || stars < 0) {
        alert("Il valore delle stelle non è valido");
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
            starsToRemove: stars,
            isHandTarget: false,
            isFurtoAttack: false,
            mosseEffect: selectedMosseEffect  // Pass special effect
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
      setStarsToRemove("");
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
  
  const isMinkiard300 = getCardName(card) === 'MINKIARD N 300';
  
  // OSTAGGIO: Hostage label visibility
  const isHostage = (card as any).isHostage;
  const hostageTurnsRemaining = (card as any).hostageTurnsRemaining;
  
  // Check if this is the MEDICINA bonus card
  const isMedicina = card.type === 'bonus' && getCardName(card).toUpperCase().includes('MEDICINA');
  
  // Check if this is the RIFUGIO bonus card
  const isRifugio = card.type === 'bonus' && getCardName(card).toUpperCase().includes('RIFUGIO');
  
  // Check if this is the BARRIERA bonus card (not a shield clone)
  const isBarriera = card.type === 'bonus' && getCardName(card).toUpperCase().includes('BARRIERA') && !card.isBarrieraShield;
  
  // Check if this card has a special effect that can be interrupted
  const cardNameUpper = getCardName(card).toUpperCase();
  const isSpecialEffectCard = location === 'field' && (
    cardNameUpper.includes('VIRUS') ||
    cardNameUpper.includes('INFLUENZA') ||
    cardNameUpper.includes('OSTAGGIO') ||
    cardNameUpper.includes('BAMBOLA') ||
    cardNameUpper.includes('VOODOO') ||
    cardNameUpper.includes('PARASSITA') ||
    cardNameUpper.includes('SAIBAIM') ||
    cardNameUpper.includes('DUELLO')
  );
  
  // Check if this is a BARRIERA shield (the duplicated cards)
  const isBarrieraShield = card.isBarrieraShield === true;
  
  // State for RIFUGIO target selection
  const [showRifugioTargetSelect, setShowRifugioTargetSelect] = useState(false);
  const [rifugioTargets, setRifugioTargets] = useState<any[]>([]);
  
  // State for BARRIERA target selection
  const [showBarrieraTargetSelect, setShowBarrieraTargetSelect] = useState(false);
  const [barrieraTargets, setBarrieraTargets] = useState<any[]>([]);
  
  const handleSuperDice = () => {
    console.log('SUPER DICE button clicked for MINKIARD N 300');
    socket.emit('open-super-dice', { gameId, playerName });
  };

  const handleSomministraMedicina = () => {
    console.log('SOMMINISTRA button clicked for MEDICINA');
    socket.emit('somministra-medicina', { cardId: card.id, playerName: effectivePlayerName });
  };

  const handleActivateRifugio = () => {
    console.log('PROTEGGI button clicked for RIFUGIO');
    socket.emit('rifugio:get-targets', { rifugioCardId: card.id, playerName: effectivePlayerName });
    setShowRifugioTargetSelect(true);
  };

  const handleRifugioTargetSelect = (targetCharacterId: string) => {
    console.log(`RIFUGIO protecting character ${targetCharacterId}`);
    socket.emit('rifugio:activate', { 
      rifugioCardId: card.id, 
      targetCharacterId, 
      playerName: effectivePlayerName 
    });
    setShowRifugioTargetSelect(false);
    setRifugioTargets([]);
  };

  const handleActivateBarriera = () => {
    console.log('PROTEGGI button clicked for BARRIERA');
    socket.emit('barriera:get-targets', { barrieraCardId: card.id, playerName: effectivePlayerName });
    setShowBarrieraTargetSelect(true);
  };

  const handleBarrieraTargetSelect = (targetCharacterId: string) => {
    console.log(`BARRIERA protecting character ${targetCharacterId}`);
    socket.emit('barriera:activate', { 
      barrieraCardId: card.id, 
      targetCharacterId, 
      playerName: effectivePlayerName 
    });
    setShowBarrieraTargetSelect(false);
    setBarrieraTargets([]);
  };

  const handleInterruptEffect = () => {
    console.log(`INTERROMPI clicked for card ${card.id}`);
    socket.emit('interrupt-effect', { cardId: card.id, playerName: effectivePlayerName });
  };

  // Listen for RIFUGIO targets
  useEffect(() => {
    const handleRifugioTargets = (data: { rifugioCardId: string; targets: any[] }) => {
      if (data.rifugioCardId === card.id) {
        setRifugioTargets(data.targets);
      }
    };

    socket.on('rifugio:targets', handleRifugioTargets);
    return () => {
      socket.off('rifugio:targets', handleRifugioTargets);
    };
  }, [card.id]);

  // Listen for BARRIERA targets
  useEffect(() => {
    const handleBarrieraTargets = (data: { barrieraCardId: string; targets: any[] }) => {
      if (data.barrieraCardId === card.id) {
        setBarrieraTargets(data.targets);
      }
    };

    socket.on('barriera:targets', handleBarrieraTargets);
    return () => {
      socket.off('barriera:targets', handleBarrieraTargets);
    };
  }, [card.id]);
  
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
      className={`relative flex flex-col gap-2 ${powerEffect === 'up' ? 'animate-power-up' : powerEffect === 'down' ? 'animate-power-down' : ''} ${getStatGlowClass()} ${isNewlyPlaced && location === 'field' ? getEntryAnimationClass() : ''}`}
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

      {/* Particle Effects for newly placed cards */}
      {isNewlyPlaced && location === 'field' && (
        <div className="absolute inset-0 pointer-events-none overflow-visible z-50">
          {/* Energy burst particles */}
          {[...Array(12)].map((_, i) => {
            const angle = (i * 30) * (Math.PI / 180);
            const distance = 60 + (i % 3) * 20;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            const delay = i * 0.05;
            const size = 4 + (i % 4) * 2;
            const particleColor = isSpeciali ? '#fbbf24' : isMosse ? '#ef4444' : isBonus ? '#ffffff' : '#00f2ff';
            
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor: particleColor,
                  boxShadow: `0 0 ${size * 2}px ${particleColor}, 0 0 ${size * 4}px ${particleColor}`,
                  animation: `card-particle-burst 0.8s ease-out ${delay}s forwards`,
                  transform: `translate(-50%, -50%)`,
                  '--particle-x': `${x}px`,
                  '--particle-y': `${y}px`,
                } as React.CSSProperties}
              />
            );
          })}
          {/* Central flash */}
          <div 
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: '120%',
              height: '120%',
              background: `radial-gradient(circle, ${isSpeciali ? 'rgba(251,191,36,0.6)' : isMosse ? 'rgba(239,68,68,0.6)' : isBonus ? 'rgba(255,255,255,0.6)' : 'rgba(0,242,255,0.6)'} 0%, transparent 70%)`,
              animation: 'card-flash-burst 0.6s ease-out forwards',
            }}
          />
        </div>
      )}
      
      {/* Card Image with Health Bar */}
      <div 
        className="relative"
        style={isEliminated && isPersonaggio ? {
          '--tx': `translate(${scatterX}px, ${scatterY}px)`
        } as React.CSSProperties : undefined}
      >
        {/* NEL RIFUGIO Label for protected characters */}
        {isPersonaggio && !card.faceDown && card.protectedByRifugio && (
          <div 
            className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-20 whitespace-nowrap"
          >
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-emerald-400/50"
                 style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
              🏠 NEL RIFUGIO
            </div>
          </div>
        )}

        {/* OSTAGGIO Label */}
        {isHostage && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap font-bold shadow-lg z-[100] border border-amber-400 animate-bounce">
            ⛓️ In ostaggio ({hostageTurnsRemaining} t)
          </div>
        )}

        {/* Vertical Health Bar for Personaggi - Absolutely positioned */}
        {isPersonaggio && !card.faceDown && (() => {
          const currentPTI = parsePTI(card.text);
          const originalPTI = originalPTIRef.current || parseOriginalPTI(card.text) || currentPTI || 1000;
          const healthPercent = currentPTI !== null ? getHealthPercentage(currentPTI, originalPTI) : 100;
          const colorClass = getHealthBarColor(healthPercent);
          
          return (
            <div 
              className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
              style={{ left: '-10px', width: '6px', height: 'calc(100% - 8px)', marginTop: '4px' }}
            >
              {/* Health bar background */}
              <div 
                className="relative w-full h-full bg-gray-900/90 rounded-full overflow-hidden"
                style={{ 
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6), 0 0 6px rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                {/* Health bar fill */}
                <div 
                  className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${colorClass} transition-all duration-150 ease-out`}
                  style={{ 
                    height: `${healthPercent}%`,
                    boxShadow: healthPercent > 0 ? `0 0 10px rgba(59, 130, 246, 0.6), inset 0 1px 3px rgba(255,255,255,0.4)` : 'none',
                    borderRadius: '9999px'
                  }}
                />
                {/* Gloss overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/25 via-transparent to-transparent rounded-full pointer-events-none" />
                {/* Tick marks for visual appeal */}
                <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-full h-px bg-white/20" />
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
        
        {/* Card image - immediately clickable */}
        <div 
          className="relative cursor-pointer"
          onClick={handleCardClick}
        >
          <img
            src={showBack || card.faceDown ? card.backImage : (appliedSkinUrl || card.frontImage)}
            alt="Card"
            loading="eager"
            decoding="async"
            className={`w-14 h-auto aspect-[2/3] sm:w-16 md:w-20 lg:w-24 card-master object-cover rounded-xl bg-slate-700
              ${getEntryAnimationClass()}
              ${card.type === 'personaggi' ? 'card-border-personaggi' : ''}
              ${card.type === 'mosse' ? 'card-border-mosse' : ''}
              ${card.type === 'bonus' ? 'card-border-bonus' : ''}
              ${card.type === 'personaggi_speciali' ? 'card-border-speciali' : ''}
              ${isEliminated && isPersonaggio ? 'card-disperse' : ''} 
              ${isShaking && !isEliminated ? 'animate-shake' : ''} 
              ${isMosseSelected ? 'ring-4 ring-purple-500 ring-opacity-70' : ''}
              ${card.faceDown ? 'ring-2 ring-orange-400 ring-opacity-50' : ''}
              ${skinAnimation || ''}`}
          />
          {appliedSkinUrl && !showBack && !card.faceDown && (
            <div className="absolute -top-1 -right-1 bg-violet-500 rounded-full p-0.5 z-10">
              <Palette className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        
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
        <div className="relative group">
          <textarea
            value={cardText}
            onChange={handleTextChange}
            placeholder="Add note..."
            className={`w-14 sm:w-16 md:w-20 lg:w-24 h-12 sm:h-14 md:h-16 text-[10px] sm:text-xs p-1 rounded resize-none neon-text-area neon-${card.type}`}
            disabled={!isOwner && location === 'hand'}
          />
          {!card.faceDown && (
            <div className="absolute inset-0 pointer-events-none p-1 overflow-y-auto bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-[7px] sm:text-[10px] text-white leading-tight font-medium text-center italic drop-shadow-md">
                <KeywordDescription text={cardText} />
              </p>
            </div>
          )}
        </div>
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
                const mosseCard = card as any;
                const targetingMode = mosseCard?.mosseTargetingMode;
                
                // Get all characters from field
                const allCharacters = gameState?.field?.filter((c: any) => 
                  (c.type === 'personaggi' || c.type === 'personaggi_speciali') && !c.isEliminated
                ) || [];
                const enemyCharacters = allCharacters.filter((c: any) => c.owner !== playerName);
                
                // Handle automatic targeting modes
                if (targetingMode && allCharacters.length > 0) {
                  let autoTargets: any[] = [];
                  
                  switch (targetingMode) {
                    case 'single':
                      // Random single enemy
                      if (enemyCharacters.length > 0) {
                        const randomIndex = Math.floor(Math.random() * enemyCharacters.length);
                        autoTargets = [enemyCharacters[randomIndex]];
                      }
                      break;
                    case 'highest_pti':
                      // Enemy with highest PTI
                      if (enemyCharacters.length > 0) {
                        const sortedByPTI = [...enemyCharacters].sort((a, b) => {
                          // Use numeric pti property if available, otherwise parse from text
                          const aPTI = a.pti ?? parseInt((a.text || '').match(/PTI:\s*(\d+)/i)?.[1] || '0');
                          const bPTI = b.pti ?? parseInt((b.text || '').match(/PTI:\s*(\d+)/i)?.[1] || '0');
                          return bPTI - aPTI;
                        });
                        autoTargets = [sortedByPTI[0]];
                      }
                      break;
                    case 'all_enemies':
                      // All enemy characters
                      autoTargets = enemyCharacters;
                      break;
                    case 'all_characters':
                      // All characters including own
                      autoTargets = allCharacters;
                      break;
                    case 'specific_count':
                      // Specific number of enemies (even if less available)
                      const count = mosseCard?.mosseTargetCount || 1;
                      autoTargets = enemyCharacters.slice(0, count);
                      break;
                  }
                  
                  if (autoTargets.length > 0) {
                    // Set the selected targets and mosse card, then open target panel with pre-selected targets
                    setSelectedMosseCard(card);
                    setSelectedTargets(autoTargets.map((t: any) => t.id));
                    setShowAttackTargetSelect(true);
                    return;
                  }
                }
                
                // For manual mode or if no targets found, open target selection panel
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

      {/* SOMMINISTRA button for MEDICINA bonus card on field */}
      {location === 'field' && isMedicina && isOwner && !card.faceDown && (
        <div className="flex flex-col gap-1">
          <Button
            onClick={handleSomministraMedicina}
            className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-2 py-1"
            size="sm"
            style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
          >
            💊 SOMMINISTRA
          </Button>
        </div>
      )}

      {/* PROTEGGI button for RIFUGIO bonus card on field */}
      {location === 'field' && isRifugio && isOwner && !card.faceDown && !card.rifugioProtecting && (
        <div className="flex flex-col gap-1">
          <Button
            onClick={handleActivateRifugio}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2 py-1"
            size="sm"
            style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
          >
            🏠 PROTEGGI
          </Button>
        </div>
      )}

      {/* PROTEGGI button for BARRIERA bonus card on field (only before activation) */}
      {location === 'field' && isBarriera && isOwner && !card.faceDown && (
        <div className="flex flex-col gap-1">
          <Button
            onClick={handleActivateBarriera}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-2 py-1"
            size="sm"
            style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
          >
            🛡️ PROTEGGI
          </Button>
        </div>
      )}

      {/* INTERROMPI button for special effect cards on field */}
      {isSpecialEffectCard && isOwner && !card.faceDown && (
        <div className="flex flex-col gap-1">
          <Button
            onClick={handleInterruptEffect}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-2 py-1"
            size="sm"
            style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
          >
            🛑 INTERROMPI
          </Button>
        </div>
      )}

      {/* RIFUGIO Target Selection Modal */}
      {showRifugioTargetSelect && ReactDOM.createPortal(
        <div 
          onClick={() => setShowRifugioTargetSelect(false)}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(0, 0, 0, 0.90)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 2147483647 
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              width: '600px',
              maxWidth: '95vw',
              backgroundColor: '#0f172a', 
              borderRadius: '16px', 
              border: '4px solid #10b981', 
              padding: '24px',
              boxShadow: '0 0 60px rgba(16, 185, 129, 0.6)'
            }}
          >
            <h2 style={{ 
              color: '#10b981', 
              fontSize: '24px', 
              fontWeight: 'bold', 
              marginBottom: '20px',
              textAlign: 'center',
              textShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
            }}>
              🏠 SELEZIONA PERSONAGGIO DA PROTEGGERE
            </h2>
            
            {rifugioTargets.length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center' }}>
                Nessun personaggio disponibile...
              </p>
            ) : (
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '16px', 
                justifyContent: 'center' 
              }}>
                {rifugioTargets.map((target: any) => (
                  <div 
                    key={target.id}
                    onClick={() => handleRifugioTargetSelect(target.id)}
                    style={{ 
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '12px',
                      border: '3px solid #10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <img 
                      src={target.frontImage} 
                      alt="Character"
                      style={{ 
                        width: '120px', 
                        height: '170px', 
                        objectFit: 'cover',
                        borderRadius: '8px'
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Button
                onClick={() => setShowRifugioTargetSelect(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold px-6 py-2"
              >
                Annulla
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* BARRIERA Target Selection Modal */}
      {showBarrieraTargetSelect && ReactDOM.createPortal(
        <div 
          onClick={() => setShowBarrieraTargetSelect(false)}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(0, 0, 0, 0.90)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 2147483647 
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              width: '600px',
              maxWidth: '95vw',
              backgroundColor: '#0f172a', 
              borderRadius: '16px', 
              border: '4px solid #3b82f6', 
              padding: '24px',
              boxShadow: '0 0 60px rgba(59, 130, 246, 0.6)'
            }}
          >
            <h2 style={{ 
              color: '#3b82f6', 
              fontSize: '24px', 
              fontWeight: 'bold', 
              marginBottom: '20px',
              textAlign: 'center',
              textShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
            }}>
              🛡️ SELEZIONA PERSONAGGIO DA PROTEGGERE
            </h2>
            
            {barrieraTargets.length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center' }}>
                Nessun personaggio disponibile...
              </p>
            ) : (
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '16px', 
                justifyContent: 'center' 
              }}>
                {barrieraTargets.map((target: any) => (
                  <div 
                    key={target.id}
                    onClick={() => handleBarrieraTargetSelect(target.id)}
                    style={{ 
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '12px',
                      border: '3px solid #3b82f6',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <img 
                      src={target.frontImage} 
                      alt="Character"
                      style={{ 
                        width: '120px', 
                        height: '170px', 
                        objectFit: 'cover',
                        borderRadius: '8px'
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Button
                onClick={() => setShowBarrieraTargetSelect(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold px-6 py-2"
              >
                Annulla
              </Button>
            </div>
          </div>
        </div>,
        document.body
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

          {/* MOSSE Effect Info - Show if there's a preset */}
          {(mosseHasPreset || selectedMosseEffect) && (
            <div className="bg-green-900/50 p-4 rounded-lg border-2 border-green-500 mb-4">
              <p className="text-green-300 font-bold mb-2">⚡ Effetto Preconfigurato</p>
              {selectedMosseEffect && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-white">Effetto speciale:</span>
                  <span className={`font-bold px-2 py-1 rounded ${
                    selectedMosseEffect === 'death' ? 'bg-red-600 text-white' :
                    selectedMosseEffect === 'halve_pti' ? 'bg-orange-600 text-white' :
                    selectedMosseEffect === 'zero_stars' ? 'bg-yellow-600 text-black' :
                    selectedMosseEffect === 'set_5_pti' ? 'bg-purple-600 text-white' :
                    selectedMosseEffect === 'remove_1_star' ? 'bg-blue-600 text-white' :
                    'bg-gray-600 text-white'
                  }`}>
                    {selectedMosseEffect === 'death' ? '💀 MORTE ISTANTANEA' :
                     selectedMosseEffect === 'halve_pti' ? '➗ DIMEZZA PTI' :
                     selectedMosseEffect === 'zero_stars' ? '⭐ AZZERA STELLE' :
                     selectedMosseEffect === 'set_5_pti' ? '5️⃣ IMPOSTA 5 PTI' :
                     selectedMosseEffect === 'remove_1_star' ? '⭐ -1 STELLA' :
                     selectedMosseEffect}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedMosseEffect(null)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Rimuovi
                  </Button>
                </div>
              )}
              {mosseHasPreset && (selectedMosseCard as any)?.mosseDamageValue !== undefined && (
                <p className="text-green-200 text-sm">
                  Danno base: {(selectedMosseCard as any).mosseDamageValue} PTI × {
                    gameState?.field?.find((c: any) => c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'))?.stars || 1
                  } stelle = <span className="font-bold text-green-400">{damageValue} PTI</span>
                </p>
              )}
              {selectedMosseEffect === 'death' && (
                <p className="text-red-300 text-xs mt-2">
                  ⚠️ Questo effetto uccide istantaneamente il bersaglio. Il danno PTI è opzionale.
                </p>
              )}
            </div>
          )}

          {/* Damage Input Section */}
          <div className="space-y-4 mt-6">
            {isFurtoAttack ? (
              <div className="p-4 rounded-lg border bg-yellow-900 border-yellow-600">
                <p className="text-yellow-300 text-lg font-bold mb-2">
                  ⭐ FURTO - Quante STELLE rubi a <span className="text-red-400 font-bold">{targetCard?.owner}</span>?
                </p>
                <p className="text-yellow-200 text-xs mb-3">
                  Le stelle rubate verranno sottratte dal personaggio avversario. Se le stelle scendono a 0, il personaggio non potrà più usare MOSSE. Se scendono sotto 0, il personaggio muore!
                </p>
                <Input
                  type="text"
                  value={damageValue}
                  onChange={(e) => setDamageValue(e.target.value)}
                  placeholder="es: 1, 2, 3..."
                  className="text-lg font-bold bg-yellow-800 border-yellow-500 text-white"
                  autoFocus
                />
              </div>
            ) : (
              <>
                <p className="text-gray-300 text-sm mb-2">
                  {targetCards.length > 1 
                    ? `Quanto danno fa la tua carta MOSSE a ${targetCards.length} bersagli?`
                    : <>Quanto danno fa la tua carta MOSSE a <span className="text-red-400 font-bold">{targetCard?.owner || targetCards[0]?.owner}</span>?</>
                  }
                  {targetCards.length > 1 && <span className="text-yellow-400 ml-1 block text-xs mt-1">(Lo stesso danno verrà applicato a tutti i bersagli)</span>}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border bg-gray-800 border-gray-600">
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      PTI da togliere:
                    </label>
                    <Input
                      type="text"
                      value={damageValue}
                      onChange={(e) => setDamageValue(e.target.value)}
                      placeholder="es: 50x3, 100+50..."
                      className="text-lg font-bold bg-gray-700 border-gray-600 text-white"
                      autoFocus
                    />
                    <p className="text-gray-400 text-xs mt-2">
                      Puoi inserire operazioni: 50x3, 100+20, 200-50, ecc.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border bg-yellow-900/50 border-yellow-600">
                    <label className="block text-yellow-300 text-sm font-medium mb-2">
                      ⭐ Stelle da togliere:
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={starsToRemove}
                      onChange={(e) => setStarsToRemove(e.target.value)}
                      placeholder="es: 1, 2..."
                      className="text-lg font-bold bg-yellow-800/50 border-yellow-500 text-white"
                    />
                    <p className="text-yellow-200/70 text-xs mt-2">
                      Lascia vuoto per non togliere stelle
                    </p>
                  </div>
                </div>
              </>
            )}

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

      {/* Skin Selection Panel */}
      <SkinSelectionPanel
        isOpen={showSkinPanel}
        onClose={() => setShowSkinPanel(false)}
        cardName={getCardName(card)}
        cardId={card.id}
        currentImage={card.frontImage}
        onSkinSelect={handleSkinSelect}
        authToken={localStorage.getItem('authToken')}
      />

      {/* Skin animation styles */}
      <style>{`
        @keyframes legendary-glow {
          0%, 100% { filter: drop-shadow(0 0 10px gold); }
          50% { filter: drop-shadow(0 0 25px gold) drop-shadow(0 0 40px orange); }
        }
        @keyframes epic-glow {
          0%, 100% { filter: drop-shadow(0 0 8px purple); }
          50% { filter: drop-shadow(0 0 20px purple); }
        }
        @keyframes rare-glow {
          0%, 100% { filter: drop-shadow(0 0 6px blue); }
          50% { filter: drop-shadow(0 0 15px blue); }
        }
        @keyframes common-glow {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.2); }
        }
        .animate-legendary-glow { animation: legendary-glow 2s ease-in-out; }
        .animate-epic-glow { animation: epic-glow 1.5s ease-in-out; }
        .animate-rare-glow { animation: rare-glow 1.2s ease-in-out; }
        .animate-common-glow { animation: common-glow 0.8s ease-in-out; }
      `}</style>
    </div>
  );
};

// Memoized Card component to prevent unnecessary re-renders
export const Card = memo(CardComponent, (prevProps, nextProps) => {
  // Only re-render if card data actually changed
  const prevCard = prevProps.card;
  const nextCard = nextProps.card;
  return (
    prevCard.id === nextCard.id &&
    prevCard.text === nextCard.text &&
    prevCard.faceDown === nextCard.faceDown &&
    prevCard.owner === nextCard.owner &&
    prevCard.isFused === nextCard.isFused &&
    prevCard.fusionLeader === nextCard.fusionLeader &&
    prevCard.protectedByRifugio === nextCard.protectedByRifugio &&
    prevCard.isBarrieraShield === nextCard.isBarrieraShield &&
    prevCard.barrieraPTI === nextCard.barrieraPTI &&
    prevCard.appliedSkinUrl === nextCard.appliedSkinUrl &&
    prevProps.location === nextProps.location &&
    prevProps.showBack === nextProps.showBack &&
    prevProps.onCardPlayed === nextProps.onCardPlayed
  );
});
