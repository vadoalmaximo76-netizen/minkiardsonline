import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Eye, Users, MessageSquare, X, Skull, Crown } from 'lucide-react';
import { socket } from '../lib/socket';
import { CardAnimation } from './CardAnimation';
import { CharacterEffects } from './CharacterEffects';
import { CustomAnimationOverlay } from './CustomAnimationOverlay';
import { EmojiReactions } from './EmojiReactions';

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
  attachedTo?: string;
  effect?: string;
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
  decks?: {
    personaggi: Card[];
    mosse: Card[];
    bonus: Card[];
    personaggi_speciali: Card[];
  };
  deckCounts?: {
    personaggi: number;
    mosse: number;
    bonus: number;
    personaggiSpeciali: number;
  };
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

const SpectatorDeck: React.FC<{ name: string; backImage: string; count: number }> = ({ name, backImage, count }) => {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-12 h-16 sm:w-16 sm:h-22 md:w-20 md:h-28">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg shadow-lg border border-white/20">
          <img 
            src={backImage} 
            alt={name}
            className="w-full h-full object-cover rounded-lg"
          />
        </div>
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
          {count}
        </div>
      </div>
      <span className="text-white text-[10px] sm:text-xs mt-1 font-medium" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>{name}</span>
    </div>
  );
};

const SpectatorCard: React.FC<{ 
  card: Card; 
  floatingNum?: FloatingNumber;
  scale?: string;
}> = ({ card, floatingNum, scale = 'w-16 h-22 sm:w-20 sm:h-28' }) => {
  const extractStats = (text: string | undefined) => {
    if (!text) return { pti: null, stars: null };
    const ptiMatch = text.match(/PTI:\s*(\d+)/i);
    const starsMatch = text.match(/stelle:\s*(\d+)/i);
    return {
      pti: ptiMatch ? parseInt(ptiMatch[1]) : null,
      stars: starsMatch ? parseInt(starsMatch[1]) : null
    };
  };

  const stats = extractStats(card.text);

  return (
    <div className={`relative ${scale} rounded-lg overflow-hidden shadow-lg border-2 ${
      card.isHostage ? 'border-red-500 ring-2 ring-red-400' : 
      card.hasBarriera ? 'border-cyan-400 ring-2 ring-cyan-300' : 
      'border-white/20'
    }`}>
      <img 
        src={card.faceDown ? card.backImage : card.frontImage}
        alt={card.name || 'Card'}
        className="w-full h-full object-cover"
      />
      
      {(card.type === 'personaggi' || card.type === 'personaggi_speciali') && stats.pti !== null && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-0.5 sm:p-1">
          <div className="flex justify-between items-center text-[8px] sm:text-[10px]">
            <span className="text-red-400 font-bold">PTI: {stats.pti}</span>
            <span className="text-yellow-400 font-bold">⭐{stats.stars || 0}</span>
          </div>
        </div>
      )}

      {card.isHostage && (
        <div className="absolute top-0 left-0 right-0 bg-red-500/80 text-white text-[6px] sm:text-[8px] text-center py-0.5 font-bold">
          OSTAGGIO ({card.hostageRemainingTurns})
        </div>
      )}

      {card.hasBarriera && (
        <div className="absolute inset-0 border-4 border-cyan-400 rounded-lg pointer-events-none animate-pulse" />
      )}

      {floatingNum && (
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-black text-lg sm:text-2xl animate-bounce z-20 ${
          floatingNum.type === 'damage' ? 'text-red-500' : 
          floatingNum.type === 'heal' ? 'text-green-500' :
          floatingNum.type === 'star-up' ? 'text-yellow-400' : 'text-orange-500'
        }`} style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
          {floatingNum.type === 'damage' ? `-${floatingNum.value}` : `+${floatingNum.value}`}
        </div>
      )}
    </div>
  );
};

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

    const handleCardAttacked = (data: { targetCardId: string; damage: number; gameId?: string }) => {
      if ((!data.gameId || data.gameId === gameId) && data.damage > 0) {
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

    const handleCharacterEliminated = () => {
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

    const handleSaibaImExplosion = () => {
      setAnimationCardName('explosion');
      setShowCardAnimation(true);
    };

    const handleCardToGraveyard = () => {
      setCharacterEffectType('death');
      setShowCharacterEffect(true);
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
    socket.on('saibaim-explosion', handleSaibaImExplosion);
    socket.on('card-to-graveyard', handleCardToGraveyard);

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
      socket.off('saibaim-explosion', handleSaibaImExplosion);
      socket.off('card-to-graveyard', handleCardToGraveyard);
    };
  }, [gameId, spectatorName]);

  const handleLeave = () => {
    socket.emit('leave-spectator', { gameId, spectatorName });
    onLeave();
  };

  const { regularCards, attachedCardsMap, cardsByPlayer } = useMemo(() => {
    if (!gameState) return { regularCards: [], attachedCardsMap: {}, cardsByPlayer: {} };
    
    const fieldCards = gameState.field || [];
    const attachedParasiticCards = fieldCards.filter(card => card.attachedTo);
    const regular = fieldCards.filter(card => !card.attachedTo);
    
    const attachedMap = attachedParasiticCards.reduce((acc, card) => {
      if (card.attachedTo) {
        if (!acc[card.attachedTo]) {
          acc[card.attachedTo] = [];
        }
        acc[card.attachedTo].push(card);
      }
      return acc;
    }, {} as Record<string, Card[]>);

    const byPlayer = regular.reduce((acc, card) => {
      if (!acc[card.owner]) {
        acc[card.owner] = [];
      }
      acc[card.owner].push(card);
      return acc;
    }, {} as Record<string, Card[]>);

    return { regularCards: regular, attachedCardsMap: attachedMap, cardsByPlayer: byPlayer };
  }, [gameState?.field]);

  const allPlayerNames = gameState ? Object.keys(gameState.players) : [];
  const turnOrder = gameState?.turnOrder || allPlayerNames;
  const currentPlayerName = turnOrder[gameState?.currentPlayerIndex || 0];

  const getPlayerPosition = (playerIndex: number, totalPlayers: number) => {
    if (totalPlayers === 1) {
      return { x: 50, y: 20 };
    }
    if (totalPlayers === 2) {
      const positions = [{ x: 50, y: 15 }, { x: 50, y: 85 }];
      return positions[playerIndex] || positions[0];
    }
    if (totalPlayers === 3) {
      const positions = [{ x: 50, y: 12 }, { x: 15, y: 75 }, { x: 85, y: 75 }];
      return positions[playerIndex] || positions[0];
    }
    if (totalPlayers === 4) {
      const positions = [{ x: 50, y: 12 }, { x: 88, y: 50 }, { x: 50, y: 88 }, { x: 12, y: 50 }];
      return positions[playerIndex] || positions[0];
    }
    const angle = (playerIndex / totalPlayers) * 2 * Math.PI - Math.PI / 2;
    const radiusX = 38;
    const radiusY = 35;
    return {
      x: 50 + radiusX * Math.cos(angle),
      y: 50 + radiusY * Math.sin(angle)
    };
  };

  const getCardPositions = (playerCards: Card[], playerIndex: number, totalPlayers: number) => {
    const playerPos = getPlayerPosition(playerIndex, totalPlayers);
    const cardCount = playerCards.length;
    
    if (cardCount === 0) return [];
    if (cardCount === 1) return [{ x: playerPos.x, y: playerPos.y + 8 }];
    
    const spacing = Math.max(5, Math.min(10, 50 / cardCount));
    
    return playerCards.map((_, cardIndex) => {
      const offset = (cardIndex - (cardCount - 1) / 2) * spacing;
      return { x: playerPos.x + offset, y: playerPos.y + 8 };
    });
  };

  const deckCounts = gameState?.deckCounts || {
    personaggi: gameState?.decks?.personaggi?.length || 0,
    mosse: gameState?.decks?.mosse?.length || 0,
    bonus: gameState?.decks?.bonus?.length || 0,
    personaggiSpeciali: gameState?.decks?.personaggi_speciali?.length || 0
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
      <div className="relative z-10 h-screen flex flex-col">
        <div className="flex-shrink-0 p-2 sm:p-4 flex items-center justify-between z-50 bg-slate-900/60 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={handleLeave}
              className="p-2 sm:p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 transition-colors border border-white/10"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </button>
            
            <div className="bg-purple-500/20 backdrop-blur-sm px-2 sm:px-4 py-1 sm:py-2 rounded-xl border border-purple-500/30 flex items-center gap-1 sm:gap-2">
              <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              <span className="text-purple-300 font-medium text-xs sm:text-sm">Spettatore</span>
            </div>
          </div>

          <div className="bg-amber-500/20 backdrop-blur-sm px-2 sm:px-4 py-1 sm:py-2 rounded-xl border border-amber-500/30 flex items-center gap-1 sm:gap-2">
            <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            <span className="text-white font-bold text-xs sm:text-sm">{currentPlayerName}</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-slate-800/80 px-2 sm:px-4 py-1 sm:py-2 rounded-xl border border-white/10 flex items-center gap-1 sm:gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
              <span className="text-white font-medium text-xs sm:text-sm">{spectatorCount}</span>
            </div>
            
            <button
              onClick={() => setShowChat(!showChat)}
              className={`p-2 sm:p-3 rounded-xl transition-colors border ${
                showChat 
                  ? 'bg-purple-500/30 border-purple-500/50 text-purple-300' 
                  : 'bg-slate-800/80 border-white/10 text-white hover:bg-slate-700/80'
              }`}
            >
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden p-2 sm:p-4">
          <div 
            className="relative w-full h-full rounded-2xl border-4 border-purple-500/30 overflow-hidden"
            style={{
              backgroundImage: `url('https://i.ibb.co/Y4bv4xwz/sfondo-minkiards.png')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              boxShadow: '0 0 40px rgba(147, 51, 234, 0.4)'
            }}
          >
            <div className="absolute inset-0 bg-black/40" />
            
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="flex flex-row gap-2 sm:gap-3 md:gap-4 items-start justify-center bg-black/50 rounded-xl p-2 sm:p-3 md:p-4 backdrop-blur-sm border border-white/10">
                <SpectatorDeck 
                  name="PERSONAGGI" 
                  backImage="https://i.imgur.com/r1rfUAB.png" 
                  count={deckCounts.personaggi} 
                />
                <SpectatorDeck 
                  name="MOSSE" 
                  backImage="https://i.imgur.com/6MUXCZO.png" 
                  count={deckCounts.mosse} 
                />
                <SpectatorDeck 
                  name="BONUS" 
                  backImage="https://i.imgur.com/lEROr3r.png" 
                  count={deckCounts.bonus} 
                />
                <SpectatorDeck 
                  name="SPECIALI" 
                  backImage="https://i.imgur.com/ipVd57A.png" 
                  count={deckCounts.personaggiSpeciali} 
                />
              </div>
            </div>

            {turnOrder.map((playerName, playerIndex) => {
              const playerCards = cardsByPlayer[playerName] || [];
              const playerPos = getPlayerPosition(playerIndex, turnOrder.length);
              const cardPositions = getCardPositions(playerCards, playerIndex, turnOrder.length);
              const isCurrentTurn = currentPlayerName === playerName;
              const player = gameState.players[playerName];
              
              return (
                <div key={playerName}>
                  <div
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                    style={{
                      left: `${playerPos.x}%`,
                      top: `${playerPos.y}%`,
                    }}
                  >
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full shadow-lg ${
                      isCurrentTurn 
                        ? 'bg-amber-500/80 ring-2 ring-amber-300' 
                        : 'bg-blue-800/80'
                    }`}>
                      <span className="text-white font-bold text-xs whitespace-nowrap" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                        {playerName}
                      </span>
                      {isCurrentTurn && <Crown className="w-3 h-3 text-white" />}
                      <span className="text-white/70 text-[10px]">
                        ({player?.hand?.length || 0})
                      </span>
                    </div>
                  </div>
                  
                  {playerCards.length > 0 ? (
                    playerCards.map((card, cardIndex) => {
                      const cardPos = cardPositions[cardIndex];
                      if (!cardPos) return null;
                      
                      const attachedCards = attachedCardsMap[card.id] || [];
                      const floatingNum = floatingNumbers.find(n => n.cardId === card.id);
                      
                      return (
                        <div
                          key={card.id}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
                          style={{
                            left: `${cardPos.x}%`,
                            top: `${cardPos.y}%`,
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <SpectatorCard card={card} floatingNum={floatingNum} />
                            
                            {attachedCards.map((parasiticCard) => (
                              <div key={parasiticCard.id} className="flex items-center">
                                <div className="w-2 h-1 bg-red-500 animate-pulse" />
                                <div className="relative">
                                  <div className="border-2 border-red-500 rounded-lg shadow-lg shadow-red-500/50 ring-2 ring-red-400 animate-pulse">
                                    <SpectatorCard card={parasiticCard} scale="w-14 h-20 sm:w-16 sm:h-22" />
                                  </div>
                                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[6px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold">
                                    {parasiticCard.owner}
                                  </div>
                                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[6px] px-1 py-0.5 rounded-full whitespace-nowrap font-bold">
                                    AGGANCIATO
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
                      style={{
                        left: `${playerPos.x}%`,
                        top: `${playerPos.y + 8}%`,
                      }}
                    >
                      <div className="text-white/50 text-xs italic" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                        Nessuna carta
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
              <div className="flex items-center gap-1">
                <span className="text-amber-400 font-bold">{regularCards.length}</span>
                <span className="text-white/70 text-xs">in campo</span>
              </div>
              <div className="w-px h-4 bg-white/20" />
              <div className="flex items-center gap-1">
                <Skull className="w-4 h-4 text-slate-400" />
                <span className="text-white font-bold">{gameState.graveyard.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm border-t border-white/10">
          <div className="bg-blue-800/30 rounded-lg p-2 sm:p-4 max-h-48 overflow-y-auto">
            <h3 className="text-white font-bold text-sm sm:text-base mb-2 sm:mb-3" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
              CARTE IN CAMPO
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {turnOrder.map((playerName) => {
                const playerCards = cardsByPlayer[playerName] || [];
                const isCurrentTurn = currentPlayerName === playerName;
                
                return (
                  <div key={playerName}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-semibold text-xs sm:text-sm ${isCurrentTurn ? 'text-amber-400' : 'text-white'}`}>
                        {playerName} {isCurrentTurn && '👑'}
                      </span>
                      <span className="text-white/60 text-xs">{playerCards.length} carte</span>
                    </div>
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                      {playerCards.length > 0 ? (
                        playerCards.map((card) => {
                          const attachedCards = attachedCardsMap[card.id] || [];
                          const floatingNum = floatingNumbers.find(n => n.cardId === card.id);
                          
                          return (
                            <div key={card.id} className="flex items-center gap-0.5">
                              <SpectatorCard card={card} floatingNum={floatingNum} scale="w-12 h-16 sm:w-14 sm:h-20" />
                              {attachedCards.map((parasiticCard) => (
                                <div key={parasiticCard.id} className="flex items-center">
                                  <div className="w-1 h-0.5 bg-red-500" />
                                  <div className="border border-red-500 rounded">
                                    <SpectatorCard card={parasiticCard} scale="w-10 h-14 sm:w-12 sm:h-16" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-white/50 italic text-xs">Nessuna carta</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <EmojiReactions gameId={gameId} playerName={spectatorName} />

      {showChat && (
        <div className="fixed bottom-4 right-4 w-72 sm:w-80 bg-slate-800/95 backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl z-50">
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-white font-medium text-sm">Chat della Partita</span>
            <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="h-48 sm:h-64 overflow-y-auto p-3 space-y-2">
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
