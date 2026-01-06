import React, { useState, useEffect } from 'react';
import { useGameState } from '../lib/stores/useGameState';
import { useAudio } from '../lib/stores/useAudio';
import { socket } from '../lib/socket';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Shield, Swords, Clock, Eye, X, ChevronLeft } from 'lucide-react';
import { HandModal } from './HandModal';

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
  const { playerName, gameId, gameState } = useGameState();
  const { playAttackSound, playDefenseActivated, playAttackBlocked } = useAudio();

  // Get player's hand
  const playerHand: GameCard[] = gameState?.players?.[playerName]?.hand || [];

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
    handleDefenseResponse(true, card.id);
  };

  const handleBackToMain = () => {
    setShowDefenseCardSelect(false);
  };

  if (!defenseRequest) return null;

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
            <strong>ACCETTA:</strong> Subisci {defenseRequest.damageValue} danni
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 justify-center mb-2">
          <Button
            onClick={() => setShowHand(true)}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 text-sm transition-all duration-200"
          >
            <Eye className="w-4 h-4 mr-1" />
            VEDI MANO
          </Button>

          <Button
            onClick={handleShowDefenseCards}
            disabled={isProcessing}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 text-sm transition-all duration-200"
          >
            <Shield className="w-4 h-4 mr-1" />
            {isProcessing ? 'Aspetta...' : 'RESPINGI'}
          </Button>

          <Button
            onClick={() => handleDefenseResponse(false)}
            disabled={isProcessing}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 text-sm transition-all duration-200"
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
