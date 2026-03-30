import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Users, Lock, Unlock, RefreshCw, UserPlus, Clock, Gamepad2, Eye, Trash2, Key, X } from 'lucide-react';
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
  hasPassword: boolean;
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
  onJoinRoom: (gameId: string, roomPassword?: string) => void;
  onSpectate?: (gameId: string) => void;
}

export function ActiveRooms({ playerName, userId, avatarId, onBack, onJoinRoom, onSpectate }: ActiveRoomsProps) {
  const [rooms, setRooms] = useState<ActiveRoom[]>([]);
  const roomsRef = useRef<ActiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningRoom, setJoiningRoom] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<string | null>(null);
  const [confirmDeleteGameId, setConfirmDeleteGameId] = useState<string | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<string | null>(null);

  // Password dialog state for joiners
  const [passwordPrompt, setPasswordPrompt] = useState<{ gameId: string; roomCode: string } | null>(null);
  const [joinPassword, setJoinPassword] = useState('');
  const [joinPasswordError, setJoinPasswordError] = useState('');

  // Password management for creators
  const [passwordManageGameId, setPasswordManageGameId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaveMsg, setPasswordSaveMsg] = useState('');

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/active-rooms', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        roomsRef.current = data;
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
      const wasCreator = roomsRef.current.some(r => r.gameId === deletedGameId && r.isCreator);
      if (wasCreator) {
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
      setDeletingRoom(null);
      fetchRooms();
    });

    socket.on('room-password-updated', () => {
      setSavingPassword(false);
      setPasswordSaveMsg('Password aggiornata!');
      setTimeout(() => {
        setPasswordSaveMsg('');
        setPasswordManageGameId(null);
        setNewPassword('');
        fetchRooms();
      }, 1200);
    });

    socket.on('set-room-password-error', ({ message }: { message: string }) => {
      setSavingPassword(false);
      setPasswordSaveMsg('Errore: ' + message);
    });

    socket.on('join-game-error', ({ message, requiresPassword }: { message: string; requiresPassword?: boolean }) => {
      if (requiresPassword) {
        setJoinPasswordError('Password errata. Riprova.');
        setJoiningRoom(null);
      }
    });

    return () => {
      clearInterval(interval);
      socket.off('join-request-approved');
      socket.off('join-request-denied');
      socket.off('room-deleted');
      socket.off('delete-room-error');
      socket.off('rooms-updated');
      socket.off('room-password-updated');
      socket.off('set-room-password-error');
      socket.off('join-game-error');
    };
  }, [pendingApproval, onJoinRoom, onBack]);

  const handleJoinRoom = (room: ActiveRoom) => {
    if (room.hasPassword && !room.isCreator && !room.isFormerPlayer) {
      setPasswordPrompt({ gameId: room.gameId, roomCode: room.roomCode });
      setJoinPassword('');
      setJoinPasswordError('');
      return;
    }
    if (room.requiresApproval) {
      setJoiningRoom(room.gameId);
      setPendingApproval(room.gameId);
      socket.emit('request-join-room', { gameId: room.gameId, playerName, userId, avatarId });
    } else {
      onJoinRoom(room.gameId);
    }
  };

  const handleJoinWithPassword = () => {
    if (!passwordPrompt) return;
    const pwd = joinPassword.trim();
    if (!pwd) { setJoinPasswordError('Inserisci la password.'); return; }
    setJoiningRoom(passwordPrompt.gameId);
    setJoinPasswordError('');
    onJoinRoom(passwordPrompt.gameId, pwd);
    setPasswordPrompt(null);
  };

  const handleDeleteRoom = (gameId: string) => {
    setDeletingRoom(gameId);
    setConfirmDeleteGameId(null);
    socket.emit('delete-room', { gameId });
  };

  const handleSavePassword = (gameId: string) => {
    setSavingPassword(true);
    setPasswordSaveMsg('');
    socket.emit('set-room-password', { gameId, password: newPassword });
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
      <div
        className="fixed inset-0 bg-cover bg-center opacity-50"
        style={{ backgroundImage: 'url(https://files.123freevectors.com/wp-content/original/113342-royal-blue-blurred-background-vector.jpg)' }}
      />
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

      {/* Password prompt for joiners */}
      {passwordPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Stanza protetta</h3>
                  <p className="text-white/60 text-sm">{passwordPrompt.roomCode}</p>
                </div>
              </div>
              <button onClick={() => setPasswordPrompt(null)} className="text-white/40 hover:text-white/80 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-white/70 text-sm mb-4">Questa stanza richiede una password per accedere.</p>
            <input
              type="password"
              value={joinPassword}
              onChange={e => { setJoinPassword(e.target.value); setJoinPasswordError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleJoinWithPassword()}
              placeholder="Password stanza..."
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-amber-500/60 mb-2"
            />
            {joinPasswordError && (
              <p className="text-red-400 text-sm mb-3">{joinPasswordError}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setPasswordPrompt(null)}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleJoinWithPassword}
                className="flex-1 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
              >
                Entra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password management for creators */}
      {passwordManageGameId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Key className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Password stanza</h3>
                  <p className="text-white/60 text-sm">Solo il creatore può modificarla</p>
                </div>
              </div>
              <button onClick={() => { setPasswordManageGameId(null); setNewPassword(''); setPasswordSaveMsg(''); }} className="text-white/40 hover:text-white/80 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-white/70 text-sm mb-4">
              Imposta una password per proteggere l'accesso. Lascia vuoto per rimuoverla.
            </p>
            <input
              type="text"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setPasswordSaveMsg(''); }}
              placeholder="Nuova password (vuoto = nessuna)..."
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-blue-500/60 mb-2"
            />
            {passwordSaveMsg && (
              <p className={`text-sm mb-2 ${passwordSaveMsg.startsWith('Errore') ? 'text-red-400' : 'text-green-400'}`}>
                {passwordSaveMsg}
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setPasswordManageGameId(null); setNewPassword(''); setPasswordSaveMsg(''); }}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => handleSavePassword(passwordManageGameId)}
                disabled={savingPassword}
                className="flex-1 px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50"
              >
                {savingPassword ? 'Salvataggio...' : newPassword ? 'Imposta password' : 'Rimuovi password'}
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
                        {room.hasPassword ? (
                          <Lock className="w-4 h-4 text-amber-400" title="Stanza protetta da password" />
                        ) : room.requiresApproval ? (
                          <Lock className="w-4 h-4 text-blue-400" title="Richiede approvazione" />
                        ) : (
                          <Unlock className="w-4 h-4 text-green-400" title="Accesso libero" />
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

                {/* Action buttons */}
                <div className="mt-4 flex justify-end gap-3 flex-wrap">
                  {/* Creator tools: password + delete */}
                  {room.isCreator && (
                    <>
                      <button
                        onClick={() => { setPasswordManageGameId(room.gameId); setNewPassword(''); setPasswordSaveMsg(''); }}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 cursor-pointer"
                        title={room.hasPassword ? 'Modifica o rimuovi password' : 'Imposta password'}
                      >
                        <Key className="w-4 h-4" />
                        {room.hasPassword ? 'Modifica password' : 'Imposta password'}
                      </button>

                      {room.status !== 'playing' && (
                        <button
                          onClick={() => setConfirmDeleteGameId(room.gameId)}
                          disabled={deletingRoom === room.gameId}
                          className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 cursor-pointer"
                          title="Elimina questa stanza"
                        >
                          {deletingRoom === room.gameId ? (
                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Elimina stanza
                        </button>
                      )}
                    </>
                  )}

                  {room.status === 'playing' && onSpectate && (
                    <button
                      onClick={() => onSpectate(room.gameId)}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white hover:scale-105"
                    >
                      <Eye className="w-5 h-5" />
                      Guarda
                      {room.spectatorCount !== undefined && room.spectatorCount > 0 && (
                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{room.spectatorCount}</span>
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
                      {room.hasPassword ? (
                        <><Lock className="w-4 h-4" /> Entra (password)</>
                      ) : room.requiresApproval ? 'Richiedi accesso' : 'Entra'}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
