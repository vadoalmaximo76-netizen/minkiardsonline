import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, Lock, Unlock, RefreshCw, UserPlus, Clock, Gamepad2, Eye } from 'lucide-react';
import { socket } from '../lib/socket';

interface ActiveRoom {
  gameId: string;
  roomCode: string;
  playerCount: number;
  maxPlayers: number;
  players: Array<{ name: string; avatar?: string }>;
  createdAt: string;
  creatorName: string;
  requiresApproval: boolean;
  status: 'waiting' | 'playing';
  spectatorCount?: number;
}

interface ActiveRoomsProps {
  playerName: string;
  userId?: number;
  avatarId?: string | null;
  onBack: () => void;
  onJoinRoom: (gameId: string) => void;
  onSpectate?: (gameId: string) => void;
}

export function ActiveRooms({ playerName, userId, avatarId, onBack, onJoinRoom, onSpectate }: ActiveRoomsProps) {
  const [rooms, setRooms] = useState<ActiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningRoom, setJoiningRoom] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<string | null>(null);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/active-rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);

    socket.on('join-request-approved', ({ gameId }) => {
      if (pendingApproval === gameId) {
        setPendingApproval(null);
        onJoinRoom(gameId);
      }
    });

    socket.on('join-request-denied', ({ gameId }) => {
      if (pendingApproval === gameId) {
        setPendingApproval(null);
        alert('La tua richiesta di accesso è stata rifiutata.');
      }
    });

    return () => {
      clearInterval(interval);
      socket.off('join-request-approved');
      socket.off('join-request-denied');
    };
  }, [pendingApproval, onJoinRoom]);

  const handleJoinRoom = async (room: ActiveRoom) => {
    if (room.requiresApproval) {
      setJoiningRoom(room.gameId);
      setPendingApproval(room.gameId);
      socket.emit('request-join-room', {
        gameId: room.gameId,
        playerName,
        userId,
        avatarId
      });
    } else {
      onJoinRoom(room.gameId);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Adesso';
    if (diffMins < 60) return `${diffMins} min fa`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ore fa`;
    return `${Math.floor(diffHours / 24)} giorni fa`;
  };

  return (
    <div className="min-h-screen bg-arena-deep p-4 md:p-8 relative overflow-hidden">
      {/* Same background as home page */}
      <div 
        className="fixed inset-0 bg-cover bg-center opacity-50"
        style={{
          backgroundImage: 'url(https://files.123freevectors.com/wp-content/original/113342-royal-blue-blurred-background-vector.jpg)'
        }}
      />
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      
      {/* Header */}
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-3 rounded-xl bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm border border-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">Stanze di Gioco Attive</h1>
            <p className="text-white/80 font-medium">Trova una partita e unisciti</p>
          </div>
          <button
            onClick={fetchRooms}
            className="ml-auto p-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 transition-colors"
          >
            <RefreshCw className={`w-6 h-6 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Rooms List */}
        {loading && rooms.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/80 font-medium">Caricamento stanze...</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/70 backdrop-blur-sm rounded-3xl border border-white/20 shadow-lg">
            <Users className="w-16 h-16 text-white/50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2 drop-shadow-lg">Nessuna stanza attiva</h3>
            <p className="text-white/70 mb-6 font-medium">Non ci sono partite in corso al momento</p>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors"
            >
              Crea una nuova partita
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {rooms.map((room) => (
              <div
                key={room.gameId}
                className="bg-slate-900/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:border-amber-500/30 transition-all shadow-lg"
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                      room.status === 'playing' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      <Gamepad2 className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-white">{room.roomCode}</h3>
                        {room.requiresApproval ? (
                          <Lock className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Unlock className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                      <p className="text-white/60 text-sm">
                        Creata da <span className="text-white">{room.creatorName}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-white/80">
                      <Users className="w-5 h-5" />
                      <span className="font-medium">{room.playerCount}/{room.maxPlayers}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/60 text-sm">
                      <Clock className="w-4 h-4" />
                      <span>{getTimeAgo(room.createdAt)}</span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      room.status === 'playing'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {room.status === 'playing' ? 'In gioco' : 'In attesa'}
                    </div>
                  </div>
                </div>

                {/* Players preview */}
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-white/60 text-sm">Giocatori:</span>
                  <div className="flex -space-x-2">
                    {room.players.slice(0, 5).map((player, idx) => (
                      <div
                        key={idx}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 border-2 border-slate-800 flex items-center justify-center text-white text-xs font-bold"
                        title={player.name}
                      >
                        {player.avatar || player.name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {room.players.length > 5 && (
                      <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center text-white/80 text-xs">
                        +{room.players.length - 5}
                      </div>
                    )}
                  </div>
                </div>

                {/* Join/Spectate buttons */}
                <div className="mt-4 flex justify-end gap-3">
                  {room.status === 'playing' && onSpectate && (
                    <button
                      onClick={() => onSpectate(room.gameId)}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white hover:scale-105"
                    >
                      <Eye className="w-5 h-5" />
                      Guarda
                      {room.spectatorCount !== undefined && room.spectatorCount > 0 && (
                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                          {room.spectatorCount}
                        </span>
                      )}
                    </button>
                  )}
                  {pendingApproval === room.gameId ? (
                    <div className="flex items-center gap-2 px-6 py-3 bg-amber-500/20 text-amber-400 rounded-xl">
                      <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span>In attesa di approvazione...</span>
                    </div>
                  ) : room.status === 'waiting' && (
                    <button
                      onClick={() => handleJoinRoom(room)}
                      disabled={joiningRoom === room.gameId || room.playerCount >= room.maxPlayers}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                        room.playerCount >= room.maxPlayers
                          ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white hover:scale-105'
                      }`}
                    >
                      <UserPlus className="w-5 h-5" />
                      {room.playerCount >= room.maxPlayers ? 'Stanza piena' : 
                       room.requiresApproval ? 'Richiedi accesso' : 'Entra'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
