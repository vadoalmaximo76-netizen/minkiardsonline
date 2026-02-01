import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Eye, Users, MessageSquare, X, Skull, Crown } from 'lucide-react';
import { socket } from '../lib/socket';
import { CardAnimation } from './CardAnimation';
import { CharacterEffects } from './CharacterEffects';
import { CustomAnimationOverlay } from './CustomAnimationOverlay';

interface Card {
  id: string;
  type: string;
  frontImage: string;
  backImage: string;
  owner: string;
  name?: string;
  text?: string;
  faceDown?: boolean;
  pti?: number | null;
  stars?: number | null;
  isHostage?: boolean;
  hostageRemainingTurns?: number;
  hasBarriera?: boolean;
}

interface Player {
  name: string;
  hand: Card[];
  socketId: string;
  avatar?: string;
  isCreator?: boolean;
  userId?: number;
}

interface GameState {
  gameId: string;
  players: Record<string, Player>;
  field: Card[];
  graveyard: Card[];
  currentPlayerIndex: number;
  spectators?: string[];
  turnOrder?: string[];
}

interface SpectatorViewProps {
  gameId: string;
  spectatorName: string;
  onLeave: () => void;
}

interface FloatingNumber {
  id: string;
  value: number;
  type: 'damage' | 'heal' | 'star-up' | 'star-down';
  cardId: string;
}

export function SpectatorView({ gameId, spectatorName, onLeave }: SpectatorViewProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ player: string; message: string; timestamp: number }>>([]);
  const [spectatorCount, setSpectatorCount] = useState(0);
  
  const [showCardAnimation, setShowCardAnimation] = useState(false);
  const [animationCardName, setAnimationCardName] = useState('');
  const [showCharacterEffect, setShowCharacterEffect] = useState(false);
  const [characterEffectType, setCharacterEffectType] = useState<'attack' | 'death'>('attack');
  const [showCustomAnimation, setShowCustomAnimation] = useState(false);
  const [customAnimationCard, setCustomAnimationCard] = useState('');
  const [customAnimationDesc, setCustomAnimationDesc] = useState('');
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([]);

  useEffect(() => {
    socket.emit('join-as-spectator', { gameId, spectatorName });

    const handleSpectatorJoined = (data: { success: boolean; gameId: string; gameState: GameState }) => {
      if (data.success) {
        setConnected(true);
        setGameState(data.gameState);
        setSpectatorCount(data.gameState.spectators?.length || 1);
      }
    };

    const handleSpectatorError = (data: { message: string }) => {
      setError(data.message);
    };

    const handleGameStateUpdate = (state: GameState) => {
      setGameState(state);
      setSpectatorCount(state.spectators?.length || 0);
    };

    const handleChatMessage = (data: { player: string; message: string }) => {
      setChatMessages(prev => [...prev.slice(-49), { ...data, timestamp: Date.now() }]);
    };

    const handleSpectatorJoinedNotification = (data: { spectatorCount: number }) => {
      setSpectatorCount(data.spectatorCount);
    };

    const handleSpectatorLeftNotification = (data: { spectatorCount: number }) => {
      setSpectatorCount(data.spectatorCount);
    };

    const handleCardAnimationTrigger = (data: { cardName: string; gameId: string }) => {
      if (data.gameId === gameId) {
        setAnimationCardName(data.cardName);
        setShowCardAnimation(true);
      }
    };

    const handleCustomAnimationTrigger = (data: { cardName: string; customAnimation: string; gameId: string }) => {
      if (data.gameId === gameId) {
        setCustomAnimationCard(data.cardName);
        setCustomAnimationDesc(data.customAnimation);
        setShowCustomAnimation(true);
      }
    };

    const handleCardAttacked = (data: { targetCardId: string; damage: number; gameId: string }) => {
      if (data.gameId === gameId && data.damage > 0) {
        const id = `damage-${Date.now()}-${Math.random()}`;
        setFloatingNumbers(prev => [...prev, { id, value: data.damage, type: 'damage', cardId: data.targetCardId }]);
        setTimeout(() => {
          setFloatingNumbers(prev => prev.filter(n => n.id !== id));
        }, 1500);
        setCharacterEffectType('attack');
        setShowCharacterEffect(true);
      }
    };

    const handleMosseAttack = (data: { targetCardId: string; damage: number }) => {
      if (data.damage > 0) {
        const id = `damage-${Date.now()}-${Math.random()}`;
        setFloatingNumbers(prev => [...prev, { id, value: data.damage, type: 'damage', cardId: data.targetCardId }]);
        setTimeout(() => {
          setFloatingNumbers(prev => prev.filter(n => n.id !== id));
        }, 1500);
        setCharacterEffectType('attack');
        setShowCharacterEffect(true);
      }
    };

    const handleCharacterEliminated = (data: { cardId: string }) => {
      setCharacterEffectType('death');
      setShowCharacterEffect(true);
    };

    const handleRecursiveDamageAnimation = (data: { cardId: string; damage: number }) => {
      const id = `damage-${Date.now()}-${Math.random()}`;
      setFloatingNumbers(prev => [...prev, { id, value: data.damage, type: 'damage', cardId: data.cardId }]);
      setTimeout(() => {
        setFloatingNumbers(prev => prev.filter(n => n.id !== id));
      }, 1500);
    };

    socket.on('spectator-joined', handleSpectatorJoined);
    socket.on('spectator-error', handleSpectatorError);
    socket.on('game-state-update', handleGameStateUpdate);
    socket.on('chat-message', handleChatMessage);
    socket.on('spectator-joined-notification', handleSpectatorJoinedNotification);
    socket.on('spectator-left-notification', handleSpectatorLeftNotification);
    socket.on('card-animation-trigger', handleCardAnimationTrigger);
    socket.on('custom-animation-trigger', handleCustomAnimationTrigger);
    socket.on('card-attacked', handleCardAttacked);
    socket.on('mosse-attack', handleMosseAttack);
    socket.on('character-eliminated', handleCharacterEliminated);
    socket.on('recursive-damage-animation', handleRecursiveDamageAnimation);

    return () => {
      socket.emit('leave-spectator', { gameId, spectatorName });
      socket.off('spectator-joined', handleSpectatorJoined);
      socket.off('spectator-error', handleSpectatorError);
      socket.off('game-state-update', handleGameStateUpdate);
      socket.off('chat-message', handleChatMessage);
      socket.off('spectator-joined-notification', handleSpectatorJoinedNotification);
      socket.off('spectator-left-notification', handleSpectatorLeftNotification);
      socket.off('card-animation-trigger', handleCardAnimationTrigger);
      socket.off('custom-animation-trigger', handleCustomAnimationTrigger);
      socket.off('card-attacked', handleCardAttacked);
      socket.off('mosse-attack', handleMosseAttack);
      socket.off('character-eliminated', handleCharacterEliminated);
      socket.off('recursive-damage-animation', handleRecursiveDamageAnimation);
    };
  }, [gameId, spectatorName]);

  const handleLeave = () => {
    socket.emit('leave-spectator', { gameId, spectatorName });
    onLeave();
  };

  const cardsByPlayer = useMemo(() => {
    if (!gameState) return {};
    const grouped: Record<string, Card[]> = {};
    gameState.field.forEach(card => {
      if (!grouped[card.owner]) {
        grouped[card.owner] = [];
      }
      grouped[card.owner].push(card);
    });
    return grouped;
  }, [gameState?.field]);

  const players = gameState ? Object.values(gameState.players) : [];
  const turnOrder = gameState?.turnOrder || players.map(p => p.name);
  const currentPlayer = gameState ? players[gameState.currentPlayerIndex] : null;

  const getPlayerPositionStyle = (playerIndex: number, totalPlayers: number): React.CSSProperties => {
    if (totalPlayers === 1) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
    if (totalPlayers === 2) {
      const positions = [
        { top: '15%', left: '50%', transform: 'translateX(-50%)' },
        { bottom: '15%', left: '50%', transform: 'translateX(-50%)' }
      ];
      return positions[playerIndex] || positions[0];
    }
    if (totalPlayers === 3) {
      const positions = [
        { top: '10%', left: '50%', transform: 'translateX(-50%)' },
        { bottom: '20%', left: '20%', transform: 'translateX(-50%)' },
        { bottom: '20%', right: '20%', transform: 'translateX(50%)' }
      ];
      return positions[playerIndex] || positions[0];
    }
    if (totalPlayers === 4) {
      const positions = [
        { top: '10%', left: '50%', transform: 'translateX(-50%)' },
        { top: '50%', right: '3%', transform: 'translateY(-50%)' },
        { bottom: '10%', left: '50%', transform: 'translateX(-50%)' },
        { top: '50%', left: '3%', transform: 'translateY(-50%)' }
      ];
      return positions[playerIndex] || positions[0];
    }
    const angle = (playerIndex / totalPlayers) * 2 * Math.PI - Math.PI / 2;
    const radiusX = totalPlayers > 6 ? 42 : 40;
    const radiusY = totalPlayers > 6 ? 38 : 35;
    const x = 50 + radiusX * Math.cos(angle);
    const y = 50 + radiusY * Math.sin(angle);
    return {
      top: `${y}%`,
      left: `${x}%`,
      transform: 'translate(-50%, -50%)'
    };
  };

  const getCardSizeClass = (totalPlayers: number): string => {
    if (totalPlayers <= 2) return 'w-20 h-28 md:w-24 md:h-32';
    if (totalPlayers <= 4) return 'w-16 h-22 md:w-20 md:h-28';
    if (totalPlayers <= 6) return 'w-14 h-20 md:w-16 md:h-22';
    return 'w-12 h-16 md:w-14 md:h-20';
  };

  const getMaxCardsWidth = (totalPlayers: number): string => {
    if (totalPlayers <= 2) return 'max-w-[400px]';
    if (totalPlayers <= 4) return 'max-w-[300px]';
    if (totalPlayers <= 6) return 'max-w-[220px]';
    return 'max-w-[180px]';
  };

  const extractStats = (text: string | undefined) => {
    if (!text) return { pti: null, stars: null };
    const ptiMatch = text.match(/PTI:\s*(\d+)/i);
    const starsMatch = text.match(/stelle:\s*(\d+)/i);
    return {
      pti: ptiMatch ? parseInt(ptiMatch[1]) : null,
      stars: starsMatch ? parseInt(starsMatch[1]) : null
    };
  };

  if (error) {
    return (
      <div className="min-h-screen bg-arena-deep flex items-center justify-center p-4">
        <div className="bg-slate-800/80 rounded-2xl p-8 max-w-md w-full text-center border border-red-500/30">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Errore</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button
            onClick={onLeave}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
          >
            Torna Indietro
          </button>
        </div>
      </div>
    );
  }

  if (!connected || !gameState) {
    return (
      <div className="min-h-screen bg-arena-deep flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Connessione in corso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-arena-deep relative overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: `url('https://i.ibb.co/Y4bv4xwz/sfondo-minkiards.png')` }}
      />
      
      <div className="relative z-10 h-screen flex flex-col">
        <div className="flex-shrink-0 p-4 flex items-center justify-between z-50">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLeave}
              className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 transition-colors border border-white/10"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            
            <div className="bg-purple-500/20 backdrop-blur-sm px-4 py-2 rounded-xl border border-purple-500/30 flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-400" />
              <span className="text-purple-300 font-medium">Modalità Spettatore</span>
            </div>
          </div>

          <div className="bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-amber-500/30 flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <span className="text-slate-400">Turno di:</span>
            <span className="text-white font-bold">{currentPlayer?.name || 'Sconosciuto'}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-400" />
              <span className="text-white font-medium">{spectatorCount} spettatori</span>
            </div>
            
            <button
              onClick={() => setShowChat(!showChat)}
              className={`p-3 rounded-xl transition-colors border ${
                showChat 
                  ? 'bg-purple-500/30 border-purple-500/50 text-purple-300' 
                  : 'bg-slate-800/80 border-white/10 text-white hover:bg-slate-700/80'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full max-w-6xl max-h-[80vh]">
              {turnOrder.map((playerName, playerIndex) => {
                const player = gameState.players[playerName];
                const playerCards = cardsByPlayer[playerName] || [];
                const positionStyle = getPlayerPositionStyle(playerIndex, turnOrder.length);
                const isCurrentTurn = currentPlayer?.name === playerName;

                return (
                  <div
                    key={playerName}
                    className="absolute"
                    style={positionStyle}
                  >
                    <div className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${
                      isCurrentTurn 
                        ? 'bg-amber-500/20 border-2 border-amber-500/50 shadow-lg shadow-amber-500/20' 
                        : 'bg-slate-800/60 border border-white/10'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                          isCurrentTurn 
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 ring-2 ring-amber-300' 
                            : 'bg-gradient-to-br from-purple-500 to-blue-500'
                        }`}>
                          {player?.avatar || playerName.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-center">
                          <p className={`font-bold text-sm ${isCurrentTurn ? 'text-amber-300' : 'text-white'}`}>
                            {playerName}
                          </p>
                          <p className="text-slate-400 text-xs">
                            {player?.hand?.length || 0} carte in mano
                          </p>
                        </div>
                        {isCurrentTurn && (
                          <Crown className="w-5 h-5 text-amber-400 animate-pulse" />
                        )}
                      </div>

                      {playerCards.length > 0 ? (
                        <div className={`flex flex-wrap justify-center gap-1.5 ${getMaxCardsWidth(turnOrder.length)}`}>
                          {playerCards.map((card) => {
                            const stats = extractStats(card.text);
                            const floatingNum = floatingNumbers.find(n => n.cardId === card.id);
                            
                            return (
                              <div 
                                key={card.id}
                                className={`relative ${getCardSizeClass(turnOrder.length)} rounded-lg overflow-hidden shadow-lg transform hover:scale-110 transition-transform cursor-pointer ${
                                  card.isHostage ? 'ring-2 ring-red-500' : ''
                                } ${card.hasBarriera ? 'ring-2 ring-cyan-400' : ''}`}
                              >
                                <img 
                                  src={card.faceDown ? card.backImage : card.frontImage}
                                  alt={card.name || 'Card'}
                                  className="w-full h-full object-cover"
                                />
                                
                                {(card.type === 'personaggi' || card.type === 'personaggi_speciali') && stats.pti !== null && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-1">
                                    <div className="flex justify-between items-center text-[10px]">
                                      <span className="text-red-400 font-bold">PTI: {stats.pti}</span>
                                      <span className="text-yellow-400 font-bold">⭐{stats.stars || 0}</span>
                                    </div>
                                  </div>
                                )}

                                {card.isHostage && (
                                  <div className="absolute top-0 left-0 right-0 bg-red-500/80 text-white text-[8px] text-center py-0.5 font-bold">
                                    OSTAGGIO ({card.hostageRemainingTurns})
                                  </div>
                                )}

                                {card.hasBarriera && (
                                  <div className="absolute top-0 left-0 w-full h-full border-4 border-cyan-400 rounded-lg pointer-events-none animate-pulse" />
                                )}

                                {floatingNum && (
                                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-black text-2xl animate-bounce ${
                                    floatingNum.type === 'damage' ? 'text-red-500' : 
                                    floatingNum.type === 'heal' ? 'text-green-500' :
                                    floatingNum.type === 'star-up' ? 'text-yellow-400' : 'text-orange-500'
                                  }`} style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                                    {floatingNum.type === 'damage' ? `-${floatingNum.value}` : `+${floatingNum.value}`}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-slate-500 text-xs italic py-2">
                          Nessuna carta in campo
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800/80 backdrop-blur-sm px-6 py-2 rounded-full border border-white/10">
                <span className="text-amber-400 font-medium">{gameState.field.length}</span>
                <span className="text-slate-400 ml-1">carte totali in campo</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 p-4 bg-slate-900/50 backdrop-blur-sm border-t border-white/10">
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Skull className="w-5 h-5 text-slate-400" />
              <span className="text-slate-400">Cimitero:</span>
              <span className="text-white font-bold">{gameState.graveyard.length} carte</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-400" />
              <span className="text-slate-400">Giocatori:</span>
              <span className="text-white font-bold">{turnOrder.length}</span>
            </div>
          </div>
        </div>
      </div>

      {showChat && (
        <div className="fixed bottom-4 right-4 w-80 bg-slate-800/95 backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl z-50">
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-white font-medium">Chat della Partita</span>
            <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="h-64 overflow-y-auto p-3 space-y-2">
            {chatMessages.length === 0 ? (
              <p className="text-slate-500 text-center text-sm">Nessun messaggio</p>
            ) : (
              chatMessages.map((msg, idx) => (
                <div key={idx} className="text-sm">
                  <span className="text-amber-400 font-medium">{msg.player}:</span>
                  <span className="text-white ml-2">{msg.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showCardAnimation && (
        <CardAnimation
          isVisible={showCardAnimation}
          cardName={animationCardName}
          onComplete={() => setShowCardAnimation(false)}
        />
      )}

      {showCharacterEffect && (
        <CharacterEffects
          isVisible={showCharacterEffect}
          effectType={characterEffectType}
          onComplete={() => setShowCharacterEffect(false)}
        />
      )}

      {showCustomAnimation && (
        <CustomAnimationOverlay
          isVisible={showCustomAnimation}
          cardName={customAnimationCard}
          animationDescription={customAnimationDesc}
          onComplete={() => setShowCustomAnimation(false)}
        />
      )}
    </div>
  );
}
