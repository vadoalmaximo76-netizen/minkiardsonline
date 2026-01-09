import React, { useState, useEffect } from 'react';
import { useGameState } from '../lib/stores/useGameState';
import { useAudio } from '../lib/stores/useAudio';
import { socket } from '../lib/socket';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Shield, Swords, Clock, Eye, X, ChevronLeft, Target, Timer } from 'lucide-react';
import { HandModal } from './HandModal';
import { Input } from './ui/input';

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
}

interface GameCard {
  id: string;
  text?: string;
  type?: string;
  frontImage?: string;
  backImage?: string;
  ppiValue?: number;
  starsValue?: number;
  owner?: string;
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
  const { playerName, gameId, gameState } = useGameState();
  const { playAttackSound, playDefenseActivated, playAttackBlocked } = useAudio();

  // Get player's hand
  const playerHand: GameCard[] = gameState?.players?.[playerName]?.hand || [];
  
  // Get MOSSE cards from player's hand for counter-attack
  const mosseCards = playerHand.filter(card => card.type === 'mosse');
  
  // Get attacker's characters on field for counter-attack target
  const attackerName = defenseRequest?.attackerName || '';
  const attackerCharacters = (gameState?.field || []).filter(
    (card: any) => card.owner === attackerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali')
  );

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

  const handleDefenseResponse = (defends: boolean, defenseCardId?: string) => {
    if (!defenseRequest || isProcessing) return;
    
    setIsProcessing(true);
    console.log(`🛡️ Sending defense response: ${defends ? 'DEFEND' : 'ACCEPT'}`, defenseCardId ? `with card ${defenseCardId}` : '');
    
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
      defenseCardId
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
    // Check if this is a MOSSE card - if so, start counter-attack flow
    if (card.type === 'mosse') {
      console.log('🛡️ Selected MOSSE for counter-attack:', card.id);
      setSelectedMosseCard(card);
      setShowDefenseCardSelect(false);
      setShowCounterAttackFlow(true);
    } else {
      // Regular defense with non-MOSSE card
      handleDefenseResponse(true, card.id);
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
              {playerHand.map((card) => (
                <div
                  key={card.id}
                  onClick={() => handleSelectDefenseCard(card)}
                  className="cursor-pointer hover:scale-105 transition-transform duration-200 bg-gray-800 rounded-lg border-2 border-gray-600 hover:border-blue-400 p-2 flex flex-col items-center"
                >
                  {card.frontImage ? (
                    <img
                      src={card.frontImage}
                      alt={getCardName(card.frontImage)}
                      className="w-20 h-28 object-cover rounded-md mb-2"
                    />
                  ) : (
                    <div className="w-20 h-28 bg-gray-700 rounded-md mb-2 flex items-center justify-center">
                      <span className="text-gray-500 text-xs">Carta</span>
                    </div>
                  )}
                  <div className="text-white text-xs font-bold text-center w-full" style={{ wordBreak: 'break-word' }}>
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
                </div>
              ))}
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
