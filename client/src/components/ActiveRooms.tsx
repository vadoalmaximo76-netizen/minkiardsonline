import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, Lock, Unlock, RefreshCw, UserPlus, Clock, Gamepad2, Eye, Trash2 } from 'lucide-react';
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
  isFormerPlayer?: boolean;
  isCreator?: boolean;
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
  const [confirmDeleteGameId, setConfirmDeleteGameId] = useState<string | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<string | null>(null);

  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/active-rooms', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
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
    const interval = setInterval(fetchRooms, 15000);

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

    socket.on('room-deleted', ({ gameId: deletedGameId }: { gameId: string }) => {
      // Only navigate home if the deleted room is one the current user was associated with
      const wasInRoom = rooms.some(r => r.gameId === deletedGameId && r.isCreator);
      if (wasInRoom) {
        onBack();
      } else {
        fetchRooms();
      }
    });

    socket.on('delete-room-error', ({ message }: { message: string }) => {
      setDeletingRoom(null);
      alert(message);
    });

    socket.on('rooms-updated', () => {
      fetchRooms();
    });

    return () => {
      clearInterval(interval);
      socket.off('join-request-approved');
      socket.off('join-request-denied');
      socket.off('room-deleted');
      socket.off('delete-room-error');
      socket.off('rooms-updated');
    };
  }, [pendingApproval, onJoinRoom, onBack]);

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

  const handleDeleteRoom = (gameId: string) => {
    setDeletingRoom(gameId);
    setConfirmDeleteGameId(null);
    socket.emit('delete-room', { gameId });
  };

  const getDeleteStatus = (createdAt: string): { canDelete: boolean; label: string } => {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    if (ageMs >= TWO_HOURS_MS) {
      return { canDelete: true, label: 'Elimina stanza' };
    }
    const remainingMs = TWO_HOURS_MS - ageMs;
    const remainingMins = Math.ceil(remainingMs / 60000);
    if (remainingMins < 60) {
      return { canDelete: false, label: `Eliminabile tra ${remainingMins} min` };
    }
    const remainingHours = Math.ceil(remainingMs / 3600000 * 10) / 10;
    return { canDelete: false, label: `Eliminabile tra ${remainingHours}h` };
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

      {/* Confirm delete dialog */}
      {confirmDeleteGameId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Elimina stanza</h3>
                <p className="text-white/60 text-sm">Questa azione è irreversibile</p>
              </div>
            </div>
            <p className="text-white/80 mb-6">
              Tutti i giocatori presenti nella stanza verranno disconnessi. Vuoi procedere?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteGameId(null)}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDeleteRoom(confirmDeleteGameId)}
                className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
      
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
            {rooms.map((room) => {
              const deleteStatus = room.isCreator ? getDeleteStatus(room.createdAt) : null;
              return (
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

                  {/* Join/Spectate/Delete buttons */}
                  <div className="mt-4 flex justify-end gap-3 flex-wrap">
                    {/* Delete button — only for the creator */}
                    {deleteStatus && (
                      <button
                        onClick={() => deleteStatus.canDelete && setConfirmDeleteGameId(room.gameId)}
                        disabled={!deleteStatus.canDelete || deletingRoom === room.gameId}
                        title={deleteStatus.canDelete ? 'Elimina questa stanza' : deleteStatus.label}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all text-sm ${
                          deleteStatus.canDelete && deletingRoom !== room.gameId
                            ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 cursor-pointer'
                            : 'bg-slate-700/50 text-slate-500 border border-slate-600/30 cursor-not-allowed'
                        }`}
                      >
                        {deletingRoom === room.gameId ? (
                          <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        {deleteStatus.canDelete ? 'Elimina stanza' : deleteStatus.label}
                      </button>
                    )}

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
                    {(room.isFormerPlayer || room.isCreator) && room.playerCount < room.maxPlayers && (
                      <button
                        onClick={() => onJoinRoom(room.gameId)}
                        disabled={joiningRoom === room.gameId}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white hover:scale-105"
                      >
                        <UserPlus className="w-5 h-5" />
                        Rientra
                      </button>
                    )}
                    {pendingApproval === room.gameId ? (
                      <div className="flex items-center gap-2 px-6 py-3 bg-amber-500/20 text-amber-400 rounded-xl">
                        <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <span>In attesa di approvazione...</span>
                      </div>
                    ) : !room.isFormerPlayer && !room.isCreator && room.playerCount < room.maxPlayers && (
                      <button
                        onClick={() => handleJoinRoom(room)}
                        disabled={joiningRoom === room.gameId}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white hover:scale-105"
                      >
                        <UserPlus className="w-5 h-5" />
                        {room.requiresApproval ? 'Richiedi accesso' : 'Entra'}
                      </button>
                    )}
                    {room.playerCount >= room.maxPlayers && (
                      <div className="flex items-center gap-2 px-6 py-3 bg-slate-600 text-slate-400 rounded-xl cursor-not-allowed">
                        <UserPlus className="w-5 h-5" />
                        Stanza piena
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
