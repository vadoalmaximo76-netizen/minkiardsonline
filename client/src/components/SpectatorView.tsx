import React, { useState, useEffect } from 'react';
import { ArrowLeft, Eye, Users, MessageSquare, X } from 'lucide-react';
import { socket } from '../lib/socket';

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
}

interface SpectatorViewProps {
  gameId: string;
  spectatorName: string;
  onLeave: () => void;
}

export function SpectatorView({ gameId, spectatorName, onLeave }: SpectatorViewProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ player: string; message: string; timestamp: number }>>([]);
  const [spectatorCount, setSpectatorCount] = useState(0);

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

    socket.on('spectator-joined', handleSpectatorJoined);
    socket.on('spectator-error', handleSpectatorError);
    socket.on('game-state-update', handleGameStateUpdate);
    socket.on('chat-message', handleChatMessage);
    socket.on('spectator-joined-notification', handleSpectatorJoinedNotification);
    socket.on('spectator-left-notification', handleSpectatorLeftNotification);

    return () => {
      socket.emit('leave-spectator', { gameId, spectatorName });
      socket.off('spectator-joined', handleSpectatorJoined);
      socket.off('spectator-error', handleSpectatorError);
      socket.off('game-state-update', handleGameStateUpdate);
      socket.off('chat-message', handleChatMessage);
      socket.off('spectator-joined-notification', handleSpectatorJoinedNotification);
      socket.off('spectator-left-notification', handleSpectatorLeftNotification);
    };
  }, [gameId, spectatorName]);

  const handleLeave = () => {
    socket.emit('leave-spectator', { gameId, spectatorName });
    onLeave();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Connessione in corso...</p>
        </div>
      </div>
    );
  }

  const players = Object.values(gameState.players);
  const currentPlayer = players[gameState.currentPlayerIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 relative overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: `url('https://i.postimg.cc/RFDM9bSq/1.png')` }}
      />
      
      <div className="relative z-10">
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-50">
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

        <div className="pt-20 pb-8 px-4">
          <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/10 max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-4">
              <span className="text-slate-400">Turno di:</span>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold">
                  {currentPlayer?.avatar || currentPlayer?.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-white font-bold text-lg">{currentPlayer?.name || 'Sconosciuto'}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="relative w-[600px] h-[600px] rounded-full bg-gradient-to-br from-slate-800/80 to-slate-700/60 border-4 border-amber-500/30 shadow-2xl">
              <div className="absolute inset-8 rounded-full bg-gradient-to-br from-green-900/50 to-emerald-800/30 border-2 border-green-500/20 flex items-center justify-center">
                <div className="grid grid-cols-4 gap-2 p-4 max-h-[400px] overflow-y-auto">
                  {gameState.field.map((card) => (
                    <div 
                      key={card.id}
                      className="w-20 h-28 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg transform hover:scale-105 transition-transform"
                    >
                      <img 
                        src={card.faceDown ? card.backImage : card.frontImage}
                        alt={card.name || 'Card'}
                        className="w-full h-full object-cover"
                      />
                      {card.text && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 text-[8px] text-white truncate">
                          {card.text}
                        </div>
                      )}
                    </div>
                  ))}
                  {gameState.field.length === 0 && (
                    <div className="col-span-4 text-center text-slate-400 py-8">
                      <p>Nessuna carta in campo</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-500/80 px-4 py-1 rounded-full text-white text-sm font-medium shadow-lg">
                {gameState.field.length} carte in campo
              </div>
            </div>
          </div>

          <div className="mt-6 max-w-4xl mx-auto">
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                Giocatori ({players.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {players.map((player, idx) => (
                  <div 
                    key={player.name}
                    className={`p-3 rounded-xl border transition-all ${
                      idx === gameState.currentPlayerIndex
                        ? 'bg-amber-500/20 border-amber-500/50'
                        : 'bg-slate-700/50 border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
                        {player.avatar || player.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{player.name}</p>
                        <p className="text-slate-400 text-xs">{player.hand?.length || 0} carte in mano</p>
                      </div>
                    </div>
                  </div>
                ))}
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
      </div>
    </div>
  );
}
