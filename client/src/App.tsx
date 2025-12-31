import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GameBoard } from "./components/GameBoard";
import { PlayerNameDialog } from "./components/PlayerNameDialog";
import { RoomCodeDialog } from "./components/RoomCodeDialog";
import { AuthDialog } from "./components/AuthDialog";
import { useGameState } from "./lib/stores/useGameState";
import { socket } from "./lib/socket";
import "@fontsource/inter";
import "./index.css";

const queryClient = new QueryClient();

interface AuthUser {
  id: number;
  username: string;
  email: string | null;
  avatar: string | null;
}

function App() {
  const [showAuthDialog, setShowAuthDialog] = useState(true);
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthUser | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showRoomDialog, setShowRoomDialog] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
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
        socket.connect();
        
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
                  avatarId: data.user.avatar 
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
      // Join the game room directly with avatar
      socket.emit('join-game', { gameId: gameIdFromUrl, playerName: name, avatarId });
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
    
    // Join the game room with avatar
    console.log(`Emitting join-game event for ${playerName} to ${newGameId}`);
    socket.emit('join-game', { gameId: newGameId, playerName, avatarId: pendingAvatar });
  };

  // Show loading screen during initialization or reconnection
  if (isInitializing || isReconnecting) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-royal-blue flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-xl">
              {isInitializing ? 'Inizializzazione...' : 'Ripristino sessione...'}
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
    
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('game');
    
    if (gameIdFromUrl) {
      setGameId(gameIdFromUrl);
      socket.emit('join-game', { 
        gameId: gameIdFromUrl, 
        playerName: user.username, 
        avatarId: user.avatar 
      });
    } else {
      setShowRoomDialog(true);
    }
  };

  if (showAuthDialog && !authenticatedUser) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-royal-blue flex items-center justify-center">
          <AuthDialog open={showAuthDialog} onSuccess={handleAuthSuccess} />
        </div>
      </QueryClientProvider>
    );
  }

  if (showNameDialog || !playerName) {
    return (
      <QueryClientProvider client={queryClient}>
        <PlayerNameDialog
          open={showNameDialog}
          onSubmit={handleNameSubmit}
        />
      </QueryClientProvider>
    );
  }

  if (showRoomDialog || !gameId) {
    return (
      <QueryClientProvider client={queryClient}>
        <RoomCodeDialog
          open={showRoomDialog || !gameId}
          onSubmit={handleRoomSubmit}
        />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-royal-blue overflow-auto">
        <GameBoard />
      </div>
    </QueryClientProvider>
  );
}

export default App;
