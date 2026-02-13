import React, { useState, useEffect } from 'react';
import { useGameState } from '../lib/stores/useGameState';
import { useAudio } from '../lib/stores/useAudio';
import { socket } from '../lib/socket';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Shield, Swords, Clock, Eye, X, ChevronLeft, Target, Timer } from 'lucide-react';
import { HandModal } from './HandModal';
import { Input } from './ui/input';

const DEFENSE_BONUS_CARDS = [
  "ALTA SALVA", "BOOMERANG", "CONTRO SKRAZZKOOM", "CONVERSIONE",
  "DIFESA VIGLIACCA", "E NN T MITT SCUORN", "E TAGG TRATTAT",
  "FOLATA DI VENTO", "RESPINTA", "E NN T MITT SSCUORN"
];

const evaluateMathExpression = (expr: string): number | null => {
  const cleaned = expr.replace(/\s/g, '');
  if (!/^[\d+\-*/().]+$/.test(cleaned)) return null;
  try {
    const result = Function('"use strict"; return (' + cleaned + ')')();
    return typeof result === 'number' && isFinite(result) ? Math.floor(result) : null;
  } catch {
    return null;
  }
};

interface DefenseRequest {
  gameId: string;
  attackId: string;
  attackerName: string;
  defenderName: string;
  mosseCardId: string;
  targetCardId: string;
  damageValue: number;
  message: string;
  mosseCardImage?: string;
  attackerCardImage?: string;
  defenderCardImage?: string;
  attackerCardText?: string;
  defenderCardText?: string;
  mosseCanBeCountered?: boolean;
  mosseDamageValue?: number;
  attackerStars?: number;
}

interface GameCard {
  id: string;
  text?: string;
  effect?: string;
  type?: string;
  frontImage?: string;
  backImage?: string;
  ppiValue?: number;
  starsValue?: number;
  stars?: number;
  owner?: string;
  mosseDamageValue?: number;
  mosseCanCounter?: boolean;
  mosseCanBeCountered?: boolean;
  mosseRestrictedFrom?: string[];
  mosseRestrictedAgainst?: string[];
}

const getCardName = (imageUrl: string) => {
  try {
    const url = new URL(imageUrl);
    const filename = url.pathname.split('/').pop() || '';
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    return decodeURIComponent(nameWithoutExt).toUpperCase();
  } catch {
    return 'CARTA';
  }
};

export const DefenseDialog: React.FC = () => {
  const [defenseRequest, setDefenseRequest] = useState<DefenseRequest | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30); // 30 second timer
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showHand, setShowHand] = useState<boolean>(false);
  const [showDefenseCardSelect, setShowDefenseCardSelect] = useState<boolean>(false);
  const [showCounterAttackFlow, setShowCounterAttackFlow] = useState<boolean>(false);
  const [selectedMosseCard, setSelectedMosseCard] = useState<GameCard | null>(null);
  const [counterDamage, setCounterDamage] = useState<string>('');
  const [showTargetSelect, setShowTargetSelect] = useState<boolean>(false);
  const [showDelayPanel, setShowDelayPanel] = useState<boolean>(false);
  const [delayTurns, setDelayTurns] = useState<string>('');
  const [showVigliaccaTargetSelect, setShowVigliaccaTargetSelect] = useState<boolean>(false);
  const [selectedVigliaccaCard, setSelectedVigliaccaCard] = useState<GameCard | null>(null);
  const { playerName, gameId, gameState } = useGameState();
  const { playAttackSound, playDefenseActivated, playAttackBlocked, playModalOpen, playButtonClick } = useAudio();

  // Get player's hand
  const playerHand: GameCard[] = gameState?.players?.[playerName]?.hand || [];
  
  // Get defender's character (the one being attacked)
  const defenderCharacter = (gameState?.field || []).find(
    (card: any) => card.id === defenseRequest?.targetCardId
  );
  
  // Get defender's current stars (parse from text if needed)
  const getDefenderStars = (): number => {
    if (!defenderCharacter) return 1;
    let stars = defenderCharacter.stars || 1;
    if (defenderCharacter.text) {
      const starsMatch = defenderCharacter.text.match(/[Ss]telle[:\s]*(\d+)/i);
      if (starsMatch) {
        stars = parseInt(starsMatch[1]);
      }
    }
    return stars;
  };
  
  const defenderStars = getDefenderStars();
  
  // Get MOSSE cards from player's hand for counter-attack
  // Counter-attack is ONLY allowed if the attacking MOSSE has mosseCanBeCountered = true
  // AND the defender's MOSSE has mosseCanCounter = true
  const canCounterAttack = defenseRequest?.mosseCanBeCountered === true;
  
  const mosseCards = playerHand.filter(card => {
    if (card.type !== 'mosse') return false;
    if (!canCounterAttack) return false;
    return card.mosseCanCounter === true;
  });
  
  // Calculate suggested counter damage for a given MOSSE card
  const calculateCounterDamage = (mosseCard: GameCard): number | null => {
    if (!mosseCard.mosseDamageValue) return null;
    return mosseCard.mosseDamageValue * defenderStars;
  };
  
  // Check if a counter MOSSE can successfully repel the attack
  const canRepelAttack = (mosseCard: GameCard): boolean => {
    if (!defenseRequest?.mosseCanBeCountered) return false;
    if (!mosseCard.mosseCanCounter) return false;
    const counterDamage = calculateCounterDamage(mosseCard);
    if (counterDamage === null) return false;
    return counterDamage >= (defenseRequest?.damageValue ?? 0);
  };
  
  // Get eligible MOSSE cards that can successfully repel the current attack
  // (counter damage >= attack damage AND attack canBeCountered AND card canCounter)
  const eligibleCounterCards = mosseCards.filter(card => canRepelAttack(card));
  
  // Get attacker's characters on field for counter-attack target
  const attackerName = defenseRequest?.attackerName || '';
  const attackerCharacters = (gameState?.field || []).filter(
    (card: any) => card.owner === attackerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali')
  );

  // Get all opponent characters for DIFESA VIGLIACCA (exclude attacker AND defender)
  const vigliaccaTargetCharacters = (gameState?.field || []).filter(
    (card: any) => card.owner !== attackerName && card.owner !== playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali')
  );

  const DELAY_DEFENSE_PATTERN = /ritard[ai].*dann[oi]|dann[oi].*ritardat[oi]|(?:dopo|tra)\s+\d+\s+turni?.*dann[oi]|assorb[ei].*dann[oi].*(?:dopo|tra)\s+\d+/i;

  const getDelayTurnsFromCard = (card: GameCard): number | null => {
    const cardText = `${card.text || ''} ${card.effect || ''}`;
    const match = cardText.match(/(?:dopo|tra)\s+(\d+)\s+turni?/i) || cardText.match(/ritard[ai].*?(\d+)\s+turni?/i);
    if (match) return parseInt(match[1], 10);
    return null;
  };

  const isDelayDefenseCard = (card: GameCard): boolean => {
    if (card.type !== 'bonus') return false;
    const cardText = `${card.text || ''} ${card.effect || ''}`;
    return DELAY_DEFENSE_PATTERN.test(cardText);
  };

  // Check if a card is a defense BONUS
  const isDefenseBonusCard = (card: GameCard): boolean => {
    if (card.type !== 'bonus') return false;
    const cardName = card.frontImage ? getCardName(card.frontImage) : '';
    if (DEFENSE_BONUS_CARDS.some(dc => cardName.includes(dc))) return true;
    if (isDelayDefenseCard(card)) return true;
    return false;
  };

  // Check if a defense card should be hidden (ALTA SALVA with damage <= 200)
  const isDefenseCardDisabled = (card: GameCard): boolean => {
    if (card.type !== 'bonus') return false;
    const cardName = card.frontImage ? getCardName(card.frontImage) : '';
    if (cardName.includes('ALTA SALVA') && (defenseRequest?.damageValue ?? 0) <= 200) {
      return true;
    }
    return false;
  };

  // Listen for defense requests
  useEffect(() => {
    const handleDefenseRequest = (request: DefenseRequest) => {
      console.log('🛡️ DEFENSE REQUEST RECEIVED:', request);
      console.log('🛡️ Images received - Attacker:', request.attackerCardImage ? '✓' : '✗');
      console.log('🛡️ Images received - MOSSE:', request.mosseCardImage ? '✓' : '✗');
      console.log('🛡️ Images received - Defender:', request.defenderCardImage ? '✓' : '✗');
      console.log('🛡️ Current playerName:', playerName);
      console.log('🛡️ Request defenderName:', request.defenderName);
      // Only show dialog if this player is the defender
      if (request.defenderName === playerName) {
        console.log('🛡️ SHOWING DEFENSE DIALOG!');
        playModalOpen();
        playAttackSound(); // Play attack incoming sound
        setDefenseRequest(request);
        setTimeLeft(30); // Reset timer
        setIsProcessing(false);
        setShowDefenseCardSelect(false);
        setShowCounterAttackFlow(false);
        setSelectedMosseCard(null);
        setCounterDamage('');
        setShowTargetSelect(false);
        setShowDelayPanel(false);
        setDelayTurns('');
        setShowVigliaccaTargetSelect(false);
        setSelectedVigliaccaCard(null);
      } else {
        console.log('🛡️ Defense request not for this player, ignoring');
      }
    };

    socket.on('defense:request', handleDefenseRequest);

    return () => {
      socket.off('defense:request', handleDefenseRequest);
    };
  }, [playerName]);

  // Countdown timer
  useEffect(() => {
    if (!defenseRequest) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-accept if time runs out
          handleDefenseResponse(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [defenseRequest]);

  const handleDefenseResponse = (
    defends: boolean, 
    defenseCardId?: string, 
    counterOptions?: { counterAttack?: boolean; counterCardId?: string; counterDamage?: number }
  ) => {
    if (!defenseRequest || isProcessing) return;
    
    setIsProcessing(true);
    console.log(`🛡️ Sending defense response: ${defends ? 'DEFEND' : 'ACCEPT'}`, defenseCardId ? `with card ${defenseCardId}` : '', counterOptions ? `(counter-attack: ${counterOptions.counterDamage} damage)` : '');
    
    // Play appropriate sound effect
    if (defends) {
      playAttackBlocked(); // Play defense success sound
    } else {
      playDefenseActivated(); // Play damage accepted sound
    }
    
    // If defending with a card, first play it to the field
    if (defends && defenseCardId) {
      socket.emit('play-card', {
        cardId: defenseCardId,
        playerName: playerName
      });
    }
    
    socket.emit('defense:response', {
      gameId: defenseRequest.gameId,
      attackId: defenseRequest.attackId,
      defends,
      defenseCardId,
      counterAttackOptions: counterOptions
    });

    // Close dialog after sending response
    setTimeout(() => {
      setDefenseRequest(null);
      setIsProcessing(false);
      setShowDefenseCardSelect(false);
    }, 500);
  };

  const handleShowDefenseCards = () => {
    setShowDefenseCardSelect(true);
  };

  const handleSelectDefenseCard = (card: GameCard) => {
    playButtonClick();
    if (card.type === 'mosse') {
      console.log('🛡️ Selected MOSSE for counter-attack:', card.id);
      setSelectedMosseCard(card);
      setShowDefenseCardSelect(false);
      setShowCounterAttackFlow(true);
      
      const autoDamage = calculateCounterDamage(card);
      if (autoDamage !== null) {
        setCounterDamage(autoDamage.toString());
        console.log(`🛡️ Auto-calculated counter damage: ${card.mosseDamageValue} × ${defenderStars} stelle = ${autoDamage}`);
      }
    } else {
      const cardName = card.frontImage ? getCardName(card.frontImage) : '';
      
      if (cardName.includes('DIFESA VIGLIACCA')) {
        console.log('🛡️ Selected DIFESA VIGLIACCA - showing target selection');
        setSelectedVigliaccaCard(card);
        setShowDefenseCardSelect(false);
        setShowVigliaccaTargetSelect(true);
      } else if (isDelayDefenseCard(card)) {
        const turns = getDelayTurnsFromCard(card);
        if (turns && defenseRequest) {
          console.log(`⏳ Selected delay defense card: delaying ${defenseRequest.damageValue} damage by ${turns} turns`);
          setIsProcessing(true);
          
          socket.emit('play-card', {
            cardId: card.id,
            playerName: playerName
          });
          
          socket.emit('defense:delay', {
            gameId: defenseRequest.gameId,
            attackId: defenseRequest.attackId,
            delayTurns: turns,
            targetCardId: defenseRequest.targetCardId,
            damageValue: defenseRequest.damageValue,
            attackerName: defenseRequest.attackerName,
            defenderName: defenseRequest.defenderName,
            mosseCardId: defenseRequest.mosseCardId
          });
          
          playAttackBlocked();
          
          setTimeout(() => {
            setDefenseRequest(null);
            setIsProcessing(false);
            setShowDefenseCardSelect(false);
          }, 500);
        } else {
          handleDefenseResponse(true, card.id);
        }
      } else {
        handleDefenseResponse(true, card.id);
      }
    }
  };

  const handleBackToMain = () => {
    setShowDefenseCardSelect(false);
    setShowCounterAttackFlow(false);
    setSelectedMosseCard(null);
    setCounterDamage('');
    setShowTargetSelect(false);
    setShowDelayPanel(false);
    setDelayTurns('');
    setShowVigliaccaTargetSelect(false);
    setSelectedVigliaccaCard(null);
  };

  const handleSelectVigliaccaTarget = (targetCard: any) => {
    if (!defenseRequest || !selectedVigliaccaCard || isProcessing) return;
    setIsProcessing(true);
    console.log(`🛡️ DIFESA VIGLIACCA: Redirecting ${defenseRequest.damageValue} damage to ${targetCard.id}`);

    if (selectedVigliaccaCard) {
      socket.emit('play-card', {
        cardId: selectedVigliaccaCard.id,
        playerName: playerName
      });
    }

    socket.emit('defense:response', {
      gameId: defenseRequest.gameId,
      attackId: defenseRequest.attackId,
      defends: true,
      defenseCardId: selectedVigliaccaCard.id,
      redirectTargetCardId: targetCard.id
    });

    playAttackBlocked();

    setTimeout(() => {
      setDefenseRequest(null);
      setIsProcessing(false);
      setShowVigliaccaTargetSelect(false);
      setSelectedVigliaccaCard(null);
    }, 500);
  };

  const handleDelayDamage = () => {
    const turns = parseInt(delayTurns);
    if (!defenseRequest || isProcessing || isNaN(turns) || turns < 1) return;
    
    setIsProcessing(true);
    console.log(`⏳ Delaying damage by ${turns} turns`);
    
    socket.emit('defense:delay', {
      gameId: defenseRequest.gameId,
      attackId: defenseRequest.attackId,
      delayTurns: turns,
      targetCardId: defenseRequest.targetCardId,
      damageValue: defenseRequest.damageValue,
      attackerName: defenseRequest.attackerName,
      defenderName: defenseRequest.defenderName,
      mosseCardId: defenseRequest.mosseCardId
    });

    setTimeout(() => {
      setDefenseRequest(null);
      setIsProcessing(false);
      setShowDelayPanel(false);
      setDelayTurns('');
    }, 500);
  };

  const handleCounterDamageSubmit = () => {
    const damage = evaluateMathExpression(counterDamage);
    if (damage === null || damage < 0) {
      return;
    }
    setShowTargetSelect(true);
  };
  
  // NEW: Handle counter-attack that only repels (no target selection needed)
  const handleRepelOnly = () => {
    if (!defenseRequest || !selectedMosseCard || isProcessing) return;
    
    const damage = evaluateMathExpression(counterDamage);
    if (damage === null || damage < 0) return;
    
    // Verify damage is sufficient to repel
    if (damage < defenseRequest.damageValue) {
      console.log('❌ Cannot repel: counter damage insufficient');
      return;
    }
    
    console.log(`⚔️ REPEL ATTACK: Using ${selectedMosseCard.id} with ${damage} counter damage to block ${defenseRequest.damageValue} attack damage`);
    
    // Use the defense response with counter-attack options
    handleDefenseResponse(true, selectedMosseCard.id, {
      counterAttack: true,
      counterCardId: selectedMosseCard.id,
      counterDamage: damage
    });
  };

  const handleSelectCounterTarget = (targetCard: any) => {
    if (!defenseRequest || !selectedMosseCard || isProcessing) return;
    
    const damage = evaluateMathExpression(counterDamage);
    if (damage === null || damage < 0) return;

    setIsProcessing(true);
    console.log(`⚔️ COUNTER-ATTACK: ${selectedMosseCard.id} with ${damage} damage against ${targetCard.id}`);

    // First play the MOSSE card to field
    socket.emit('play-card', {
      cardId: selectedMosseCard.id,
      playerName: playerName
    });

    // Then emit counter-attack
    socket.emit('counter-attack', {
      attackId: defenseRequest.attackId,
      defenderMosseCardId: selectedMosseCard.id,
      defenderDamage: damage,
      defenderTargetCardId: targetCard.id
    });

    playAttackBlocked();

    // Close dialog
    setTimeout(() => {
      setDefenseRequest(null);
      setIsProcessing(false);
      setShowDefenseCardSelect(false);
      setShowCounterAttackFlow(false);
      setSelectedMosseCard(null);
      setCounterDamage('');
      setShowTargetSelect(false);
    }, 500);
  };

  if (!defenseRequest) return null;

  // DIFESA VIGLIACCA: Target selection panel
  if (showVigliaccaTargetSelect && selectedVigliaccaCard) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="w-full max-w-2xl bg-gradient-to-b from-gray-900 to-gray-800 rounded-lg shadow-2xl border-2 border-purple-500 p-4">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 text-purple-400 mb-1">
              <Target className="w-6 h-6" />
              <h1 className="text-xl font-bold">DIFESA VIGLIACCA</h1>
              <Target className="w-6 h-6" />
            </div>
            <p className="text-gray-300 text-sm">
              Scegli un personaggio nemico a cui deviare i <span className="text-red-400 font-bold">{defenseRequest.damageValue} PTI</span> di danno
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Non puoi scegliere il personaggio dell'attaccante ({attackerName})
            </p>
            <div className="flex items-center justify-center gap-1 text-gray-300 text-sm mt-2">
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold">{timeLeft}s</span>
            </div>
          </div>

          {vigliaccaTargetCharacters.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {vigliaccaTargetCharacters.map((card: any) => (
                <div
                  key={card.id}
                  onClick={() => handleSelectVigliaccaTarget(card)}
                  className="cursor-pointer hover:scale-105 transition-transform duration-200 bg-gray-800 rounded-lg border-2 border-gray-600 hover:border-purple-400 p-2 flex flex-col items-center"
                >
                  {card.frontImage && (
                    <img
                      src={card.frontImage}
                      alt={getCardName(card.frontImage)}
                      className="w-20 h-28 object-cover rounded-md mb-2"
                    />
                  )}
                  <div className="text-white text-xs font-bold text-center">
                    {card.frontImage ? getCardName(card.frontImage) : 'Personaggio'}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    {card.owner}
                  </div>
                  {card.text && (
                    <div className="text-gray-500 text-xs mt-1 text-center line-clamp-1">
                      {card.text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-4 mb-4">
              Nessun personaggio nemico disponibile (escluso attaccante)
            </div>
          )}

          <div className="flex justify-center">
            <Button
              onClick={handleBackToMain}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              INDIETRO
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // DELAY PANEL: Show turn input for delaying damage
  if (showDelayPanel) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="w-full max-w-md bg-gradient-to-b from-gray-900 to-gray-800 rounded-lg shadow-2xl border-2 border-amber-500 p-6">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 text-amber-400 mb-2">
              <Timer className="w-6 h-6" />
              <h1 className="text-xl font-bold">RITARDA IL DANNO</h1>
              <Timer className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-center gap-1 text-gray-300 text-sm mb-2">
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold">{timeLeft}s</span>
            </div>
          </div>

          <p className="text-gray-300 text-center text-sm mb-2">
            Danno da ricevere: <span className="text-red-400 font-bold">{defenseRequest.damageValue} PTI</span>
          </p>

          <p className="text-gray-400 text-center text-xs mb-4">
            Inserisci dopo quanti TUOI turni vuoi subire questo danno.
          </p>

          <div className="mb-4">
            <label className="block text-white text-sm font-bold mb-2">
              Numero di turni:
            </label>
            <Input
              type="number"
              value={delayTurns}
              onChange={(e) => setDelayTurns(e.target.value)}
              placeholder="Es: 3"
              className="w-full bg-gray-700 border-gray-600 text-white text-center text-xl"
              min="1"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleBackToMain}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              ANNULLA
            </Button>
            <Button
              onClick={handleDelayDamage}
              disabled={!delayTurns || parseInt(delayTurns) < 1 || isProcessing}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2"
            >
              <Timer className="w-4 h-4 mr-1" />
              CONFERMA
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // COUNTER-ATTACK FLOW: Show damage input and target selection
  if (showCounterAttackFlow && selectedMosseCard) {
    // Target selection step
    if (showTargetSelect) {
      return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl bg-gradient-to-b from-gray-900 to-gray-800 rounded-lg shadow-2xl border-2 border-orange-500 p-4">
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-2 text-orange-400 mb-1">
                <Target className="w-6 h-6" />
                <h1 className="text-xl font-bold">SCEGLI BERSAGLIO DELLA RESPINTA</h1>
                <Target className="w-6 h-6" />
              </div>
              <p className="text-gray-300 text-sm">
                La tua respinta da <span className="text-yellow-400 font-bold">{evaluateMathExpression(counterDamage) ?? 0} PTI</span> contro l'attacco da <span className="text-red-400 font-bold">{defenseRequest.damageValue} PTI</span>
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {(evaluateMathExpression(counterDamage) ?? 0) > defenseRequest.damageValue 
                  ? `Danno netto: ${(evaluateMathExpression(counterDamage) ?? 0) - defenseRequest.damageValue} PTI al nemico!`
                  : (evaluateMathExpression(counterDamage) ?? 0) < defenseRequest.damageValue 
                    ? `Danno netto: ${defenseRequest.damageValue - (evaluateMathExpression(counterDamage) ?? 0)} PTI a te!`
                    : '⚡ VALORI UGUALI: Si attiverà uno SCONTRO!'}
              </p>
            </div>

            {attackerCharacters.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {attackerCharacters.map((card: any) => (
                  <div
                    key={card.id}
                    onClick={() => handleSelectCounterTarget(card)}
                    className="cursor-pointer hover:scale-105 transition-transform duration-200 bg-gray-800 rounded-lg border-2 border-gray-600 hover:border-orange-400 p-2 flex flex-col items-center"
                  >
                    {card.frontImage && (
                      <img
                        src={card.frontImage}
                        alt={getCardName(card.frontImage)}
                        className="w-20 h-28 object-cover rounded-md mb-2"
                      />
                    )}
                    <div className="text-white text-xs font-bold text-center">
                      {card.frontImage ? getCardName(card.frontImage) : 'Personaggio'}
                    </div>
                    {card.text && (
                      <div className="text-gray-400 text-xs mt-1 text-center line-clamp-1">
                        {card.text}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-4 mb-4">
                Nessun personaggio nemico disponibile
              </div>
            )}

            <div className="flex justify-center">
              <Button
                onClick={() => setShowTargetSelect(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                INDIETRO
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Damage input step
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="w-full max-w-md bg-gradient-to-b from-gray-900 to-gray-800 rounded-lg shadow-2xl border-2 border-yellow-500 p-6">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 text-yellow-400 mb-2">
              <Swords className="w-6 h-6" />
              <h1 className="text-xl font-bold">RESPINGI CON MOSSE</h1>
              <Swords className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-center gap-1 text-gray-300 text-sm mb-2">
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold">{timeLeft}s</span>
            </div>
          </div>

          {/* Selected MOSSE card preview */}
          <div className="flex justify-center mb-4">
            {selectedMosseCard.frontImage && (
              <img
                src={selectedMosseCard.frontImage}
                alt={getCardName(selectedMosseCard.frontImage)}
                className="w-24 h-32 object-cover rounded-lg border-2 border-yellow-500"
              />
            )}
          </div>

          <p className="text-gray-300 text-center text-sm mb-2">
            Attacco nemico: <span className="text-red-400 font-bold">{defenseRequest.damageValue} PTI</span>
          </p>

          <p className="text-gray-400 text-center text-xs mb-4">
            Inserisci i danni della tua respinta. Se maggiore, infliggi la differenza al nemico!
          </p>

          {/* Damage input */}
          <div className="mb-4">
            <label className="block text-white text-sm font-bold mb-2">
              Danno della tua MOSSE:
            </label>
            <Input
              type="text"
              value={counterDamage}
              onChange={(e) => setCounterDamage(e.target.value)}
              placeholder="Es: 100, 50+50, 200*2"
              className="w-full bg-gray-700 border-gray-600 text-white text-center text-xl"
            />
          </div>

          <div className="flex flex-col gap-2">
            {/* Show RESPINGI SOLO button when counter damage >= attack damage and attack can be countered */}
            {canCounterAttack && evaluateMathExpression(counterDamage) !== null && 
             (evaluateMathExpression(counterDamage) ?? 0) >= defenseRequest.damageValue && (
              <Button
                onClick={handleRepelOnly}
                disabled={isProcessing}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
              >
                <Shield className="w-5 h-5 mr-2" />
                RESPINGI ATTACCO ({evaluateMathExpression(counterDamage)} vs {defenseRequest.damageValue})
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleBackToMain}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                ANNULLA
              </Button>
              <Button
                onClick={handleCounterDamageSubmit}
                disabled={!counterDamage || evaluateMathExpression(counterDamage) === null || (evaluateMathExpression(counterDamage) ?? -1) < 0}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2"
              >
                <Target className="w-4 h-4 mr-1" />
                SCEGLI BERSAGLIO
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show defense card selection panel
  if (showDefenseCardSelect) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="w-full max-w-4xl max-h-[85vh] bg-gradient-to-b from-gray-900 to-gray-800 rounded-lg shadow-2xl border-2 border-blue-500 p-4 overflow-y-auto">
          {/* Header */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 text-blue-400 mb-1">
              <Shield className="w-6 h-6" />
              <h1 className="text-2xl font-bold">SELEZIONA CARTA PER RESPINGERE</h1>
              <Shield className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-center gap-1 text-gray-300 text-sm">
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold">{timeLeft}s</span>
            </div>
            <p className="text-gray-400 text-sm mt-2">
              Scegli una carta dalla tua mano per metterla in campo e respingere l'attacco
            </p>
          </div>

          {/* Cards Grid */}
          {playerHand.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
              {playerHand.filter(card => !isDefenseCardDisabled(card)).map((card) => {
                const cardNameStr = card.frontImage ? getCardName(card.frontImage) : '';
                const isBonusDef = isDefenseBonusCard(card);
                const isMosseCard = card.type === 'mosse';
                const mosseCannotRepel = isMosseCard && !canRepelAttack(card);
                const mosseCounterDmg = isMosseCard ? calculateCounterDamage(card) : null;
                const delayTurnsVal = isDelayDefenseCard(card) ? getDelayTurnsFromCard(card) : null;
                const bonusLabel = isBonusDef ? (
                  delayTurnsVal ? `Ritarda ${delayTurnsVal} turni` :
                  cardNameStr.includes('BOOMERANG') || cardNameStr.includes('RESPINTA') ? 'Riflette danno' :
                  cardNameStr.includes('CONTRO SKRAZZKOOM') ? 'Riflette x2' :
                  cardNameStr.includes('CONVERSIONE') ? 'Converte in PTI' :
                  cardNameStr.includes('DIFESA VIGLIACCA') ? 'Devia su nemico' :
                  cardNameStr.includes('E NN T MITT') ? 'Annulla danno' :
                  cardNameStr.includes('E TAGG TRATTAT') ? 'Dimezza danno' :
                  cardNameStr.includes('FOLATA DI VENTO') ? 'Dado + devia' :
                  cardNameStr.includes('ALTA SALVA') ? 'Annulla se >200' :
                  'Difesa'
                ) : null;
                return (
                <div
                  key={card.id}
                  onClick={() => {
                    if (mosseCannotRepel) return;
                    handleSelectDefenseCard(card);
                  }}
                  className={`${mosseCannotRepel ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-105'} transition-transform duration-200 bg-gray-800 rounded-lg border-2 ${mosseCannotRepel ? 'border-red-800' : isBonusDef ? 'border-green-500 hover:border-green-300' : 'border-gray-600 hover:border-blue-400'} p-2 flex flex-col items-center relative`}
                >
                  {card.frontImage ? (
                    <img
                      src={card.frontImage}
                      alt={getCardName(card.frontImage)}
                      className={`w-20 h-28 object-cover rounded-md mb-2 ${mosseCannotRepel ? 'grayscale' : ''}`}
                    />
                  ) : (
                    <div className="w-20 h-28 bg-gray-700 rounded-md mb-2 flex items-center justify-center">
                      <span className="text-gray-500 text-xs">Carta</span>
                    </div>
                  )}
                  <div className={`${mosseCannotRepel ? 'text-gray-500' : 'text-white'} text-xs font-bold text-center w-full`} style={{ wordBreak: 'break-word' }}>
                    {card.frontImage ? getCardName(card.frontImage) : (card.text?.substring(0, 15) || 'Carta')}
                  </div>
                  {card.type && (
                    <div className="text-gray-400 text-xs mt-1 capitalize">
                      {card.type.replace('_', ' ')}
                    </div>
                  )}
                  {(card.ppiValue !== undefined || card.starsValue !== undefined) && (
                    <div className="flex gap-2 mt-1 text-xs">
                      {card.ppiValue !== undefined && (
                        <span className="text-red-400">PTI: {card.ppiValue}</span>
                      )}
                      {card.starsValue !== undefined && (
                        <span className="text-yellow-400">⭐ {card.starsValue}</span>
                      )}
                    </div>
                  )}
                  {bonusLabel && (
                    <div className="absolute top-0 right-0 bg-green-600 text-white text-[9px] font-bold px-1 py-0.5 rounded-bl-md rounded-tr-md">
                      {bonusLabel}
                    </div>
                  )}
                  {mosseCannotRepel && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
                      <div className="text-center px-1">
                        <div className="text-red-400 text-[10px] font-bold leading-tight">
                          {!canCounterAttack ? 'NON CONTRASTABILE' : mosseCounterDmg !== null ? `Danno ${mosseCounterDmg} < ${defenseRequest?.damageValue}` : 'DANNO INSUFFICIENTE'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8 mb-4">
              Non hai carte in mano
            </div>
          )}

          {/* Back Button */}
          <div className="flex gap-2 justify-center">
            <Button
              onClick={handleBackToMain}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 text-sm"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              INDIETRO
            </Button>
            <Button
              onClick={() => handleDefenseResponse(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 text-sm"
            >
              <Shield className="w-4 h-4 mr-1" />
              RESPINGI SENZA CARTA
            </Button>
          </div>

          {/* Timer Warning */}
          {timeLeft <= 10 && (
            <div className="text-center mt-3">
              <p className="text-red-400 font-bold text-xs animate-pulse">
                ⚠️ Risposta automatica in {timeLeft}s
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main defense dialog
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-4xl max-h-[85vh] bg-gradient-to-b from-gray-900 to-gray-800 rounded-lg shadow-2xl border-2 border-red-500 p-4 overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 text-red-600 mb-1">
            <Swords className="w-6 h-6" />
            <h1 className="text-2xl font-bold">ATTACCO NEMICO!</h1>
            <Swords className="w-6 h-6" />
          </div>
          <div className="flex items-center justify-center gap-1 text-gray-300 text-sm">
            <Clock className="w-4 h-4" />
            <span className="font-mono font-bold">{timeLeft}s</span>
          </div>
        </div>

        {/* Attacker Name */}
        <div className="text-center mb-3">
          <p className="text-yellow-400 text-base font-bold">
            {defenseRequest.attackerName} ti sta attaccando!
          </p>
        </div>

        {/* Three Cards Layout: Attacker | MOSSE | Defender - SINGLE ROW */}
        <div className="flex gap-2 justify-center items-start mb-4 flex-nowrap">
          {/* Left: Attacker Card */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="text-white text-xs font-bold mb-1">ATTACCANTE</div>
            {defenseRequest.attackerCardImage ? (
              <img
                src={defenseRequest.attackerCardImage}
                alt="Attaccante"
                className="w-24 h-32 rounded-lg border-2 border-green-500 object-cover shadow-lg"
              />
            ) : (
              <div className="w-24 h-32 rounded-lg border-2 border-green-500 bg-gray-700 flex items-center justify-center">
                <span className="text-gray-400 text-xs">Carta</span>
              </div>
            )}
            {defenseRequest.attackerCardText && (
              <div className="mt-1 text-gray-300 text-xs text-center max-w-24 line-clamp-2">
                {defenseRequest.attackerCardText}
              </div>
            )}
          </div>

          {/* Center: MOSSE Card */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="text-white text-xs font-bold mb-1">MOSSE</div>
            {defenseRequest.mosseCardImage ? (
              <img
                src={defenseRequest.mosseCardImage}
                alt="MOSSE"
                className="w-28 h-36 rounded-lg border-4 border-yellow-500 object-cover shadow-lg"
              />
            ) : (
              <div className="w-28 h-36 rounded-lg border-4 border-yellow-500 bg-gray-700 flex items-center justify-center">
                <span className="text-gray-400 text-xs">MOSSE</span>
              </div>
            )}
            <div className="mt-2 text-red-400 font-bold text-lg">
              ⚠️ {defenseRequest.damageValue}
            </div>
          </div>

          {/* Right: Defender Card */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="text-white text-xs font-bold mb-1">DIFENSORE</div>
            {defenseRequest.defenderCardImage ? (
              <img
                src={defenseRequest.defenderCardImage}
                alt="Difensore"
                className="w-24 h-32 rounded-lg border-2 border-blue-500 object-cover shadow-lg"
              />
            ) : (
              <div className="w-24 h-32 rounded-lg border-2 border-blue-500 bg-gray-700 flex items-center justify-center">
                <span className="text-gray-400 text-xs">Carta</span>
              </div>
            )}
            {defenseRequest.defenderCardText && (
              <div className="mt-1 text-gray-300 text-xs text-center max-w-24 line-clamp-2">
                {defenseRequest.defenderCardText}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="bg-gray-700 p-2 rounded-lg border border-gray-600 mb-3 text-center">
          <p className="text-gray-300 text-xs">
            <strong>RESPINGI:</strong> Scegli una carta dalla mano per metterla in campo e bloccare l'attacco
          </p>
          <p className="text-gray-300 text-xs">
            <strong>RITARDA:</strong> Subisci il danno dopo un certo numero dei tuoi turni
          </p>
          <p className="text-gray-300 text-xs">
            <strong>ACCETTA:</strong> Subisci {defenseRequest.damageValue} danni
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 justify-center mb-2 flex-wrap">
          <Button
            onClick={() => setShowHand(true)}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 text-sm transition-all duration-200 min-w-[80px]"
          >
            <Eye className="w-4 h-4 mr-1" />
            VEDI MANO
          </Button>

          <Button
            onClick={handleShowDefenseCards}
            disabled={isProcessing}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 text-sm transition-all duration-200 min-w-[80px]"
          >
            <Shield className="w-4 h-4 mr-1" />
            {isProcessing ? 'Aspetta...' : 'RESPINGI'}
          </Button>

          <Button
            onClick={() => setShowDelayPanel(true)}
            disabled={isProcessing}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-3 text-sm transition-all duration-200 min-w-[80px]"
          >
            <Timer className="w-4 h-4 mr-1" />
            {isProcessing ? 'Aspetta...' : 'RITARDA'}
          </Button>

          <Button
            onClick={() => handleDefenseResponse(false)}
            disabled={isProcessing}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 text-sm transition-all duration-200 min-w-[80px]"
          >
            <Swords className="w-4 h-4 mr-1" />
            {isProcessing ? 'Aspetta...' : 'ACCETTA'}
          </Button>
        </div>

        {showHand && <HandModal onClose={() => setShowHand(false)} />}

        {/* Timer Warning */}
        {timeLeft <= 10 && (
          <div className="text-center">
            <p className="text-red-400 font-bold text-xs animate-pulse">
              ⚠️ Risposta automatica in {timeLeft}s
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
