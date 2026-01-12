import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GameBoard } from "./components/GameBoard";
import { PlayerNameDialog } from "./components/PlayerNameDialog";
import { RoomCodeDialog } from "./components/RoomCodeDialog";
import { AuthDialog } from "./components/AuthDialog";
import { AdBanner } from "./components/AdBanner";
import { useGameState } from "./lib/stores/useGameState";
import { socket } from "./lib/socket";
import { preloadCriticalImages } from "./lib/imagePreloader";
import "@fontsource/inter";
import "./index.css";

const queryClient = new QueryClient();

interface AuthUser {
  id: number;
  username: string;
  email: string | null;
  avatar: string | null;
  puntiRankiard?: number;
}

function App() {
  const [showAuthDialog, setShowAuthDialog] = useState(true);
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthUser | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showRoomDialog, setShowRoomDialog] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [serverReady, setServerReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [gameInvitation, setGameInvitation] = useState<{
    senderId: number;
    senderUsername: string;
    gameId: string;
    roomCode: string;
  } | null>(null);
  const { 
    setPlayerName, 
    playerName, 
    gameId, 
    setGameId, 
    hasActiveSession, 
    restoreSession, 
    generateSessionId, 
    isReconnecting 
  } = useGameState();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Listen for server ready signal
        socket.on('server-ready', () => {
          console.log('Server cache loaded, ready to play!');
          setServerReady(true);
          setLoadingProgress(100);
        });
        
        // Listen for game invitations from friends
        socket.on('game-invitation', (data: { senderId: number; senderUsername: string; gameId: string; roomCode: string }) => {
          console.log('Game invitation received:', data);
          setGameInvitation(data);
        });
        
        // Register user data on connection to ensure invitations work
        socket.on('connect', () => {
          console.log('Socket connected');
          const storedToken = localStorage.getItem('authToken');
          if (storedToken) {
            console.log('Registering user for invitations');
            socket.emit('set-user-data', { authToken: storedToken });
          }
        });
        
        // Now connect after all listeners are set up
        socket.connect();
        
        // Simulate loading progress while waiting
        const progressInterval = setInterval(() => {
          setLoadingProgress(prev => {
            if (prev >= 90) return prev; // Cap at 90% until server signals ready
            return prev + Math.random() * 15;
          });
        }, 200);
        
        // Request server status
        socket.emit('check-server-ready');
        
        preloadCriticalImages();
        
        const authToken = localStorage.getItem('authToken');
        
        if (authToken) {
          try {
            const res = await fetch('/api/auth/me', {
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            });
            if (res.ok) {
              const data = await res.json();
              setAuthenticatedUser(data.user);
              setShowAuthDialog(false);
              
              // Register user with socket for targeted notifications (game invites)
              socket.emit('set-user-data', { authToken });
              
              if (hasActiveSession()) {
                console.log('Found active session, attempting to restore...');
                const restored = await restoreSession();
                
                if (restored) {
                  console.log('Session restored successfully');
                  setShowNameDialog(false);
                  setShowRoomDialog(false);
                  setIsInitializing(false);
                  return;
                }
              }
              
              setPlayerName(data.user.username);
              setPendingAvatar(data.user.avatar);
              
              const urlParams = new URLSearchParams(window.location.search);
              const gameIdFromUrl = urlParams.get('game');
              
              if (gameIdFromUrl) {
                setGameId(gameIdFromUrl);
                generateSessionId();
                socket.emit('join-game', { 
                  gameId: gameIdFromUrl, 
                  playerName: data.user.username, 
                  avatarId: data.user.avatar,
                  userId: data.user.id
                });
              } else {
                setShowRoomDialog(true);
              }
              
              setIsInitializing(false);
              return;
            } else {
              localStorage.removeItem('authToken');
              localStorage.removeItem('userId');
            }
          } catch (error) {
            console.error('Error restoring user:', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('userId');
          }
        }
        
        setIsInitializing(false);
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsInitializing(false);
      }
    };

    initializeApp();

    return () => {
      socket.off('server-ready');
      socket.off('game-invitation');
      socket.off('connect');
      socket.disconnect();
    };
  }, [setGameId, hasActiveSession, restoreSession, setPlayerName, generateSessionId]);

  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);

  const handleNameSubmit = (name: string, avatarId: string) => {
    setPlayerName(name);
    setPendingAvatar(avatarId);
    generateSessionId(); // Create a new session ID for this player
    setShowNameDialog(false);
    
    // Check if we have a game ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('game');
    
    if (gameIdFromUrl) {
      // Join the game room directly with avatar and userId (for stats tracking)
      socket.emit('join-game', { gameId: gameIdFromUrl, playerName: name, avatarId, userId: authenticatedUser?.id });
    } else {
      // Show room selection dialog
      setShowRoomDialog(true);
    }
  };

  const handleRoomSubmit = (roomCode: string) => {
    const newGameId = `room-${roomCode}`;
    console.log(`Attempting to join room: ${newGameId} with player: ${playerName}`);
    
    setGameId(newGameId);
    setShowRoomDialog(false);
    
    // Update URL to include room code
    const newUrl = `${window.location.origin}?game=${newGameId}`;
    window.history.pushState(null, '', newUrl);
    
    // Join the game room with avatar and userId
    console.log(`Emitting join-game event for ${playerName} to ${newGameId}`);
    socket.emit('join-game', { 
      gameId: newGameId, 
      playerName, 
      avatarId: pendingAvatar,
      userId: authenticatedUser?.id 
    });
  };

  // Show loading screen during initialization, reconnection, or waiting for server
  if (isInitializing || isReconnecting || !serverReady) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-arena-deep flex items-center justify-center">
          <div className="text-center w-80">
            <h1 className="text-4xl font-bold text-white mb-6" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
              MINKIARDS
            </h1>
            <div className="relative w-full h-4 bg-gray-700 rounded-full overflow-hidden mb-4">
              <div 
                className="absolute h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${Math.min(loadingProgress, 100)}%` }}
              />
            </div>
            <p className="text-white text-lg">
              {!serverReady ? 'Caricamento dati di gioco...' : 
               isInitializing ? 'Inizializzazione...' : 'Ripristino sessione...'}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {Math.round(loadingProgress)}%
            </p>
          </div>
        </div>
      </QueryClientProvider>
    );
  }

  const handleAuthSuccess = (user: AuthUser) => {
    setAuthenticatedUser(user);
    setShowAuthDialog(false);
    setPlayerName(user.username);
    setPendingAvatar(user.avatar);
    generateSessionId();
    
    // Register user with socket for targeted notifications (game invites)
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
      socket.emit('set-user-data', { authToken });
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('game');
    
    if (gameIdFromUrl) {
      setGameId(gameIdFromUrl);
      socket.emit('join-game', { 
        gameId: gameIdFromUrl, 
        playerName: user.username, 
        avatarId: user.avatar,
        userId: user.id
      });
    } else {
      setShowRoomDialog(true);
    }
  };

  if (showAuthDialog && !authenticatedUser) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-arena-deep flex items-center justify-center">
          <AuthDialog open={showAuthDialog} onSuccess={handleAuthSuccess} />
        </div>
      </QueryClientProvider>
    );
  }

  if (showNameDialog || !playerName) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-arena-deep flex items-center justify-center">
          <PlayerNameDialog
            open={showNameDialog}
            onSubmit={handleNameSubmit}
          />
        </div>
      </QueryClientProvider>
    );
  }

  if (showRoomDialog || !gameId) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-arena-deep flex flex-col items-center justify-center">
          <div className="w-full max-w-md mb-4">
            <AdBanner format="horizontal" className="mx-auto" />
          </div>
          <RoomCodeDialog
            open={showRoomDialog || !gameId}
            onSubmit={handleRoomSubmit}
          />
          <div className="w-full max-w-md mt-4">
            <AdBanner format="horizontal" className="mx-auto" />
          </div>
        </div>
      </QueryClientProvider>
    );
  }

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('isGuest');
    localStorage.removeItem('guestName');
    setAuthenticatedUser(null);
    setShowAuthDialog(true);
    setShowNameDialog(false);
    setShowRoomDialog(false);
    setPlayerName('');
    setGameId('');
  };

  const handleAcceptInvitation = () => {
    if (gameInvitation && authenticatedUser) {
      const inviteGameId = gameInvitation.gameId;
      setGameId(inviteGameId);
      generateSessionId();
      
      // Update URL
      const newUrl = `${window.location.origin}?game=${inviteGameId}`;
      window.history.pushState(null, '', newUrl);
      
      // Join the game
      socket.emit('join-game', { 
        gameId: inviteGameId, 
        playerName: authenticatedUser.username, 
        avatarId: authenticatedUser.avatar,
        userId: authenticatedUser.id 
      });
      
      setGameInvitation(null);
      setShowRoomDialog(false);
    }
  };

  const handleDeclineInvitation = () => {
    setGameInvitation(null);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-arena-deep overflow-auto">
        {/* Game Invitation Notification */}
        {gameInvitation && (
          <div className="fixed top-4 right-4 z-50 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-2xl p-4 max-w-sm animate-pulse border-2 border-white/20">
            <div className="text-white font-bold text-lg mb-2">Invito alla Partita!</div>
            <div className="text-white/90 mb-3">
              <span className="font-semibold">{gameInvitation.senderUsername}</span> ti ha invitato a giocare!
            </div>
            <div className="text-white/70 text-sm mb-3">
              Stanza: {gameInvitation.roomCode}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAcceptInvitation}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Accetta
              </button>
              <button
                onClick={handleDeclineInvitation}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Rifiuta
              </button>
            </div>
          </div>
        )}
        
        <GameBoard 
          authenticatedUser={authenticatedUser}
          onLogout={handleLogout}
          authToken={localStorage.getItem('authToken')}
        />
      </div>
    </QueryClientProvider>
  );
}

export default App;
