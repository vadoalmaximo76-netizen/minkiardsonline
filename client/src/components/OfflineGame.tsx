import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Wifi, WifiOff, RefreshCw, Play, Hand, Target, SkipForward } from 'lucide-react';
import {
  OfflineGameState,
  OfflineCard,
  createOfflineGame,
  drawCard,
  playCardToField,
  attackWithMosse,
  endTurn,
  cpuTakeTurn,
  getCurrentPlayerName,
  isPlayerTurn,
} from '../lib/offlineGameEngine';

interface OfflineGameProps {
  playerName: string;
  onBack: () => void;
}

export function OfflineGame({ playerName, onBack }: OfflineGameProps) {
  const [gameState, setGameState] = useState<OfflineGameState | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [attackMode, setAttackMode] = useState(false);
  const [isProcessingCPU, setIsProcessingCPU] = useState(false);

  useEffect(() => {
    const newGame = createOfflineGame(playerName, 'CPU');
    
    let state = newGame;
    const result1 = drawCard(state, playerName, 'personaggi');
    state = result1.state;
    const result2 = drawCard(state, playerName, 'mosse');
    state = result2.state;
    const result3 = drawCard(state, playerName, 'bonus');
    state = result3.state;
    
    setGameState(state);
  }, [playerName]);

  const handleDrawCard = useCallback((deckType: 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali') => {
    if (!gameState || !isPlayerTurn(gameState, playerName)) return;
    
    const result = drawCard(gameState, playerName, deckType);
    setGameState(result.state);
  }, [gameState, playerName]);

  const handlePlayCard = useCallback((cardId: string) => {
    if (!gameState || !isPlayerTurn(gameState, playerName)) return;
    
    const card = gameState.players[playerName]?.hand.find(c => c.id === cardId);
    if (!card) return;

    if (card.type === 'mosse') {
      setSelectedCard(cardId);
      setAttackMode(true);
    } else if (card.type === 'personaggi' || card.type === 'personaggi_speciali') {
      const newState = playCardToField(gameState, playerName, cardId);
      setGameState(newState);
    }
  }, [gameState, playerName]);

  const handleSelectTarget = useCallback((targetCardId: string) => {
    if (!gameState || !selectedCard || !attackMode) return;
    
    const newState = attackWithMosse(gameState, playerName, selectedCard, targetCardId);
    setGameState(newState);
    setSelectedCard(null);
    setAttackMode(false);
  }, [gameState, selectedCard, attackMode, playerName]);

  const handleEndTurn = useCallback(() => {
    if (!gameState || !isPlayerTurn(gameState, playerName)) return;
    
    let newState = endTurn(gameState);
    setGameState(newState);
    
    const nextPlayer = getCurrentPlayerName(newState);
    if (newState.players[nextPlayer]?.isCPU) {
      setIsProcessingCPU(true);
      setTimeout(() => {
        newState = cpuTakeTurn(newState, nextPlayer);
        setGameState(newState);
        setIsProcessingCPU(false);
      }, 1500);
    }
  }, [gameState, playerName]);

  const handleNewGame = useCallback(() => {
    const newGame = createOfflineGame(playerName, 'CPU');
    let state = newGame;
    const result1 = drawCard(state, playerName, 'personaggi');
    state = result1.state;
    const result2 = drawCard(state, playerName, 'mosse');
    state = result2.state;
    const result3 = drawCard(state, playerName, 'bonus');
    state = result3.state;
    
    setGameState(state);
    setSelectedCard(null);
    setAttackMode(false);
  }, [playerName]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const currentPlayer = getCurrentPlayerName(gameState);
  const isMyTurn = isPlayerTurn(gameState, playerName);
  const myHand = gameState.players[playerName]?.hand || [];
  const myFieldCards = gameState.field.filter(c => c.owner === playerName);
  const enemyFieldCards = gameState.field.filter(c => c.owner !== playerName);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Indietro</span>
          </button>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-red-900/50 rounded-lg">
            <WifiOff className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-medium">Modalità Offline</span>
          </div>
          
          <button
            onClick={handleNewGame}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Nuova Partita</span>
          </button>
        </div>

        {gameState.gameEnded && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-2xl text-center">
              <h2 className="text-4xl font-bold text-white mb-4">
                {gameState.winner === playerName ? '🎉 Hai Vinto!' : '💀 Hai Perso!'}
              </h2>
              <p className="text-slate-400 mb-6">
                {gameState.winner === playerName 
                  ? 'Complimenti! Hai sconfitto la CPU!'
                  : 'La CPU ti ha sconfitto. Riprova!'}
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleNewGame}
                  className="px-6 py-3 bg-orange-600 hover:bg-orange-500 rounded-lg font-medium transition-colors"
                >
                  Nuova Partita
                </button>
                <button
                  onClick={onBack}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                >
                  Torna al Menu
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-4">
          <div className={`inline-block px-6 py-2 rounded-full font-bold ${
            isMyTurn ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}>
            {isProcessingCPU ? '🤖 CPU sta pensando...' : 
             isMyTurn ? '🎮 Il tuo turno!' : `Turno di ${currentPlayer}`}
          </div>
        </div>

        {attackMode && (
          <div className="text-center mb-4">
            <div className="inline-block px-6 py-2 bg-red-600 rounded-full animate-pulse">
              <Target className="w-4 h-4 inline mr-2" />
              Seleziona un bersaglio nemico!
            </div>
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-lg font-bold text-red-400 mb-2 text-center">Campo Nemico (CPU)</h3>
          <div className="flex gap-4 justify-center min-h-[200px] p-4 bg-red-900/20 rounded-xl border border-red-500/30">
            {enemyFieldCards.length === 0 ? (
              <div className="text-slate-500 flex items-center">Nessuna carta in campo</div>
            ) : (
              enemyFieldCards.map(card => (
                <div
                  key={card.id}
                  onClick={() => attackMode && handleSelectTarget(card.id)}
                  className={`relative w-32 h-44 rounded-lg overflow-hidden shadow-lg transition-all ${
                    attackMode ? 'cursor-crosshair hover:ring-4 hover:ring-red-500 hover:scale-105' : ''
                  }`}
                >
                  <img src={card.frontImage} alt={card.name} className="w-full h-full object-cover" />
                  {card.pti !== undefined && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-1 text-center">
                      <span className="text-yellow-400 font-bold text-sm">{card.pti} PTI</span>
                      {card.stars && <span className="text-amber-400 ml-2">{'⭐'.repeat(card.stars)}</span>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-bold text-blue-400 mb-2 text-center">Il Tuo Campo</h3>
          <div className="flex gap-4 justify-center min-h-[200px] p-4 bg-blue-900/20 rounded-xl border border-blue-500/30">
            {myFieldCards.length === 0 ? (
              <div className="text-slate-500 flex items-center">Nessuna carta in campo</div>
            ) : (
              myFieldCards.map(card => (
                <div
                  key={card.id}
                  className="relative w-32 h-44 rounded-lg overflow-hidden shadow-lg"
                >
                  <img src={card.frontImage} alt={card.name} className="w-full h-full object-cover" />
                  {card.pti !== undefined && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-1 text-center">
                      <span className="text-yellow-400 font-bold text-sm">{card.pti} PTI</span>
                      {card.stars && <span className="text-amber-400 ml-2">{'⭐'.repeat(card.stars)}</span>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Hand className="w-5 h-5" />
              La Tua Mano ({myHand.length} carte)
            </h3>
            <button
              onClick={handleEndTurn}
              disabled={!isMyTurn || isProcessingCPU}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <SkipForward className="w-5 h-5" />
              Termina Turno
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4 p-4 bg-slate-800/50 rounded-xl">
            {myHand.map(card => (
              <div
                key={card.id}
                onClick={() => isMyTurn && handlePlayCard(card.id)}
                className={`relative flex-shrink-0 w-28 h-40 rounded-lg overflow-hidden shadow-lg transition-all ${
                  isMyTurn ? 'cursor-pointer hover:scale-105 hover:-translate-y-2' : 'opacity-75'
                } ${selectedCard === card.id ? 'ring-4 ring-yellow-500' : ''}`}
              >
                <img src={card.frontImage} alt={card.name} className="w-full h-full object-cover" />
                <div className="absolute top-0 left-0 bg-black/80 px-2 py-1 text-xs font-bold uppercase">
                  {card.type === 'personaggi_speciali' ? 'SPECIALE' : card.type}
                </div>
                {card.mosseDamageValue && (
                  <div className="absolute bottom-0 left-0 right-0 bg-red-900/90 p-1 text-center">
                    <span className="text-red-200 font-bold text-xs">⚔️ {card.mosseDamageValue}</span>
                  </div>
                )}
                {card.pti !== undefined && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-1 text-center">
                    <span className="text-yellow-400 font-bold text-xs">{card.pti} PTI</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4 justify-center flex-wrap">
          <button
            onClick={() => handleDrawCard('personaggi')}
            disabled={!isMyTurn || isProcessingCPU}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
          >
            <Play className="w-5 h-5" />
            Pesca Personaggio
          </button>
          <button
            onClick={() => handleDrawCard('mosse')}
            disabled={!isMyTurn || isProcessingCPU}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
          >
            <Play className="w-5 h-5" />
            Pesca Mosse
          </button>
          <button
            onClick={() => handleDrawCard('bonus')}
            disabled={!isMyTurn || isProcessingCPU}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
          >
            <Play className="w-5 h-5" />
            Pesca Bonus
          </button>
        </div>

        <div className="mt-6 max-h-32 overflow-y-auto bg-slate-800/50 rounded-xl p-4">
          <h4 className="text-sm font-bold text-slate-400 mb-2">Log di Gioco</h4>
          <div className="space-y-1">
            {gameState.messages.slice(-10).reverse().map(msg => (
              <div key={msg.id} className="text-sm">
                <span className="text-slate-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                <span className="text-slate-400 mx-2">-</span>
                <span className="text-slate-300">{msg.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
