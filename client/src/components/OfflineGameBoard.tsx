import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, RefreshCw, Hand, Swords, Heart, Star, Trophy, Skull, Volume2, VolumeX, Plus } from 'lucide-react';
import { 
  OfflineGameEngine, 
  OfflineGameState, 
  OfflineCard,
  drawCard,
  playCardToField,
  attackWithMosse,
  endTurn,
  getCurrentPlayerName,
  isPlayerTurn
} from '../lib/offlineGameEngine';
import { executeCPUTurn } from '../lib/offlineCPU';
import { AddCardsModal } from './AddCardsModal';

interface OfflineGameBoardProps {
  playerName: string;
  onBack: () => void;
  openAddCardsOnStart?: boolean;
}

export function OfflineGameBoard({ playerName, onBack, openAddCardsOnStart = false }: OfflineGameBoardProps) {
  const [gameState, setGameState] = useState<OfflineGameState | null>(null);
  const [selectedCard, setSelectedCard] = useState<OfflineCard | null>(null);
  const [attackMode, setAttackMode] = useState(false);
  const [attackerCard, setAttackerCard] = useState<OfflineCard | null>(null);
  const [isProcessingCPU, setIsProcessingCPU] = useState(false);
  const [showDeckSelector, setShowDeckSelector] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [addCardsModalOpen, setAddCardsModalOpen] = useState(openAddCardsOnStart);
  const engineRef = useRef<OfflineGameEngine | null>(null);

  useEffect(() => {
    const engine = new OfflineGameEngine(playerName, 'CPU');
    engineRef.current = engine;
    
    engine.on('*', (event) => {
      if (event.type === 'state-update' || event.type === 'card-drawn' || 
          event.type === 'card-played' || event.type === 'attack' ||
          event.type === 'damage-dealt' || event.type === 'character-eliminated' ||
          event.type === 'turn-changed' || event.type === 'game-over') {
        setGameState(engine.getState());
      }
    });

    engine.startGame();
    setGameState(engine.getState());

    return () => {
      engineRef.current = null;
    };
  }, [playerName]);

  const processCPUTurn = useCallback(async () => {
    if (!gameState) return;
    if (getCurrentPlayerName(gameState) !== 'CPU') return;
    
    setIsProcessingCPU(true);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const newState = executeCPUTurn(gameState, 'CPU');
    setGameState(newState);
    
    setIsProcessingCPU(false);
  }, [gameState]);

  useEffect(() => {
    if (gameState && getCurrentPlayerName(gameState) === 'CPU' && !isProcessingCPU && !gameState.gameEnded) {
      processCPUTurn();
    }
  }, [gameState, isProcessingCPU, processCPUTurn]);

  const handleDrawCard = (deckType: 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali') => {
    if (!gameState || !isPlayerTurn(gameState, playerName)) return;
    
    const result = drawCard(gameState, playerName, deckType);
    setGameState(result.state);
    setShowDeckSelector(false);
  };

  const handlePlayCard = (card: OfflineCard) => {
    if (!gameState || !isPlayerTurn(gameState, playerName)) return;
    
    if (card.type === 'mosse') {
      setAttackMode(true);
      setAttackerCard(card);
      return;
    }
    
    const newState = playCardToField(gameState, playerName, card.id);
    setGameState(newState);
    setSelectedCard(null);
  };

  const handleAttack = (targetCard: OfflineCard) => {
    if (!gameState || !attackerCard || !isPlayerTurn(gameState, playerName)) return;
    
    const newState = attackWithMosse(gameState, playerName, attackerCard.id, targetCard.id);
    setGameState(newState);
    setAttackMode(false);
    setAttackerCard(null);
    setSelectedCard(null);
  };

  const handleEndTurn = () => {
    if (!gameState || !isPlayerTurn(gameState, playerName)) return;
    
    const newState = endTurn(gameState);
    setGameState(newState);
  };

  const handleNewGame = () => {
    const engine = new OfflineGameEngine(playerName, 'CPU');
    engineRef.current = engine;
    engine.startGame();
    setGameState(engine.getState());
    setSelectedCard(null);
    setAttackMode(false);
    setAttackerCard(null);
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Caricamento partita offline...</div>
      </div>
    );
  }

  const myHand = gameState.players[playerName]?.hand || [];
  const cpuHand = gameState.players['CPU']?.hand || [];
  const myCharacters = gameState.field.filter(c => c.owner === playerName && (c.type === 'personaggi' || c.type === 'personaggi_speciali'));
  const cpuCharacters = gameState.field.filter(c => c.owner === 'CPU' && (c.type === 'personaggi' || c.type === 'personaggi_speciali'));
  const isMyTurn = isPlayerTurn(gameState, playerName);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 overflow-hidden">
      <div className="absolute top-4 left-4 flex gap-2 z-50">
        <button
          onClick={onBack}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={20} />
          Esci
        </button>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
        >
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>

      <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2">
        <div className={`px-4 py-2 rounded-lg font-bold ${isMyTurn ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {isMyTurn ? '🎮 TUO TURNO' : '🤖 TURNO CPU'}
        </div>
        <div className="text-white/70 text-sm">
          Turno #{gameState.turnNumber}
        </div>
      </div>

      {gameState.gameEnded && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl text-center shadow-2xl border border-white/20">
            {gameState.winner === playerName ? (
              <>
                <Trophy className="w-24 h-24 text-yellow-400 mx-auto mb-4" />
                <h2 className="text-4xl font-bold text-yellow-400 mb-2">VITTORIA!</h2>
                <p className="text-white/80 mb-6">Hai sconfitto la CPU!</p>
              </>
            ) : (
              <>
                <Skull className="w-24 h-24 text-red-500 mx-auto mb-4" />
                <h2 className="text-4xl font-bold text-red-400 mb-2">SCONFITTA</h2>
                <p className="text-white/80 mb-6">La CPU ti ha sconfitto!</p>
              </>
            )}
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleNewGame}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-white font-bold flex items-center gap-2 hover:scale-105 transition-transform"
              >
                <RefreshCw size={20} />
                Nuova Partita
              </button>
              <button
                onClick={onBack}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-bold"
              >
                Torna al Menu
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto h-full flex flex-col gap-4 pt-16">
        <div className="bg-black/30 rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              🤖 CPU ({cpuHand.length} carte)
              {isProcessingCPU && <span className="animate-pulse text-yellow-400">sta pensando...</span>}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {cpuHand.map((_, idx) => (
              <div key={idx} className="w-16 h-24 bg-gradient-to-br from-red-800 to-red-900 rounded-lg border-2 border-red-600 shadow-lg flex items-center justify-center">
                <span className="text-2xl">🃏</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-black/30 rounded-xl p-4 border border-red-500/30">
          <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2">
            <Swords size={18} />
            Campo CPU ({cpuCharacters.length} personaggi)
          </h3>
          <div className="flex flex-wrap gap-3 justify-center min-h-32">
            {cpuCharacters.map(card => (
              <div
                key={card.id}
                onClick={() => attackMode && handleAttack(card)}
                className={`relative cursor-pointer transition-all ${
                  attackMode ? 'ring-4 ring-red-500 animate-pulse hover:scale-110' : ''
                }`}
              >
                <img
                  src={card.frontImage}
                  alt={card.name || 'Carta'}
                  className="w-24 h-36 object-cover rounded-lg shadow-xl"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 rounded-b-lg p-1 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <span className="text-red-400 flex items-center gap-1">
                      <Heart size={12} />
                      {card.currentPti || card.pti || 100}
                    </span>
                    <span className="text-yellow-400 flex items-center gap-1">
                      <Star size={12} />
                      {card.stars || 1}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {cpuCharacters.length === 0 && (
              <div className="text-white/40 italic">Nessun personaggio in campo</div>
            )}
          </div>
        </div>

        <div className="bg-black/30 rounded-xl p-4 border border-blue-500/30">
          <h3 className="text-blue-400 font-bold mb-3 flex items-center gap-2">
            <Swords size={18} />
            Il tuo campo ({myCharacters.length} personaggi)
          </h3>
          <div className="flex flex-wrap gap-3 justify-center min-h-32">
            {myCharacters.map(card => (
              <div key={card.id} className="relative">
                <img
                  src={card.frontImage}
                  alt={card.name || 'Carta'}
                  className="w-24 h-36 object-cover rounded-lg shadow-xl border-2 border-blue-500"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 rounded-b-lg p-1 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <span className="text-red-400 flex items-center gap-1">
                      <Heart size={12} />
                      {card.currentPti || card.pti || 100}
                    </span>
                    <span className="text-yellow-400 flex items-center gap-1">
                      <Star size={12} />
                      {card.stars || 1}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {myCharacters.length === 0 && (
              <div className="text-white/40 italic">Nessun personaggio in campo</div>
            )}
          </div>
        </div>

        <div className="bg-black/30 rounded-xl p-4 border border-green-500/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-green-400 font-bold flex items-center gap-2">
              <Hand size={18} />
              La tua mano ({myHand.length} carte)
            </h3>
            
            <div className="flex gap-2">
              {isMyTurn && !attackMode && (
                <>
                  <button
                    onClick={() => setShowDeckSelector(!showDeckSelector)}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white font-bold text-sm hover:scale-105 transition-transform"
                  >
                    Pesca Carta
                  </button>
                  <button
                    onClick={handleEndTurn}
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg text-white font-bold text-sm hover:scale-105 transition-transform"
                  >
                    Fine Turno
                  </button>
                </>
              )}
              {attackMode && (
                <button
                  onClick={() => { setAttackMode(false); setAttackerCard(null); }}
                  className="px-4 py-2 bg-gray-600 rounded-lg text-white font-bold text-sm"
                >
                  Annulla Attacco
                </button>
              )}
            </div>
          </div>

          {showDeckSelector && (
            <div className="mb-4 flex flex-wrap gap-2 justify-center bg-black/30 rounded-lg p-3">
              <button
                onClick={() => handleDrawCard('personaggi')}
                className="px-4 py-2 bg-blue-600 rounded-lg text-white font-bold text-sm hover:bg-blue-500 disabled:opacity-50"
                disabled={gameState.decks.personaggi.length === 0}
              >
                Personaggi ({gameState.decks.personaggi.length})
              </button>
              <button
                onClick={() => handleDrawCard('mosse')}
                className="px-4 py-2 bg-red-600 rounded-lg text-white font-bold text-sm hover:bg-red-500 disabled:opacity-50"
                disabled={gameState.decks.mosse.length === 0}
              >
                Mosse ({gameState.decks.mosse.length})
              </button>
              <button
                onClick={() => handleDrawCard('bonus')}
                className="px-4 py-2 bg-green-600 rounded-lg text-white font-bold text-sm hover:bg-green-500 disabled:opacity-50"
                disabled={gameState.decks.bonus.length === 0}
              >
                Bonus ({gameState.decks.bonus.length})
              </button>
              <button
                onClick={() => handleDrawCard('personaggi_speciali')}
                className="px-4 py-2 bg-yellow-600 rounded-lg text-white font-bold text-sm hover:bg-yellow-500 disabled:opacity-50"
                disabled={gameState.decks.personaggi_speciali.length === 0}
              >
                Speciali ({gameState.decks.personaggi_speciali.length})
              </button>
            </div>
          )}

          {attackMode && (
            <div className="mb-4 bg-red-500/20 border border-red-500 rounded-lg p-3 text-center">
              <p className="text-red-400 font-bold">⚔️ MODALITÀ ATTACCO - Clicca su un nemico per attaccarlo!</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-center">
            {myHand.map(card => (
              <div
                key={card.id}
                onClick={() => isMyTurn && !attackMode && handlePlayCard(card)}
                className={`relative cursor-pointer transition-all hover:scale-110 hover:-translate-y-2 ${
                  selectedCard?.id === card.id ? 'ring-4 ring-yellow-400' : ''
                } ${!isMyTurn ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <img
                  src={card.frontImage}
                  alt={card.name || 'Carta'}
                  className="w-20 h-28 object-cover rounded-lg shadow-xl"
                />
                <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-black rounded-full text-xs text-white border border-white/30">
                  {card.type === 'personaggi' && '👤'}
                  {card.type === 'personaggi_speciali' && '⭐'}
                  {card.type === 'mosse' && '⚔️'}
                  {card.type === 'bonus' && '🎁'}
                </div>
              </div>
            ))}
            {myHand.length === 0 && (
              <div className="text-white/40 italic">Nessuna carta in mano - Pesca una carta!</div>
            )}
          </div>
        </div>

        <div className="bg-black/30 rounded-xl p-3 border border-white/10 max-h-32 overflow-y-auto">
          <h4 className="text-white/60 text-sm font-bold mb-2">📜 Log partita</h4>
          <div className="space-y-1">
            {gameState.messages.slice(-5).reverse().map(msg => (
              <div key={msg.id} className={`text-xs ${
                msg.type === 'attack' ? 'text-red-400' :
                msg.type === 'damage' ? 'text-orange-400' :
                msg.type === 'elimination' ? 'text-purple-400' :
                msg.type === 'victory' ? 'text-yellow-400' :
                'text-white/70'
              }`}>
                <span className="text-white/50">[{new Date(msg.timestamp).toLocaleTimeString('it-IT')}]</span>{' '}
                <span className="font-bold">{msg.playerName}:</span> {msg.message}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setAddCardsModalOpen(true)}
            className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl text-white font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-lg"
          >
            <Plus size={20} />
            AGGIUNGI
          </button>
        </div>
      </div>

      <AddCardsModal
        isOpen={addCardsModalOpen}
        onClose={() => setAddCardsModalOpen(false)}
      />
    </div>
  );
}
