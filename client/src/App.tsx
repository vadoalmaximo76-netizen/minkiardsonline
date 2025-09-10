import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GameBoard } from "./components/GameBoard";
import { PlayerNameDialog } from "./components/PlayerNameDialog";
import { RoomCodeDialog } from "./components/RoomCodeDialog";
import { useGameState } from "./lib/stores/useGameState";
import { socket } from "./lib/socket";
import "@fontsource/inter";
import "./index.css";

const queryClient = new QueryClient();

function App() {
  const [showNameDialog, setShowNameDialog] = useState(true);
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
        // Connect to socket first
        socket.connect();
        
        // Check if we have an active session
        if (hasActiveSession()) {
          console.log('Found active session, attempting to restore...');
          const restored = await restoreSession();
          
          if (restored) {
            console.log('Session restored successfully');
            setShowNameDialog(false);
            setShowRoomDialog(false);
            setIsInitializing(false);
            return;
          } else {
            console.log('Session restoration failed, showing login');
          }
        }
        
        // Get game ID from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        const gameIdFromUrl = urlParams.get('game');
        
        if (gameIdFromUrl) {
          setGameId(gameIdFromUrl);
          // If there's a game ID in URL, skip room selection
          setShowRoomDialog(false);
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
  }, [setGameId, hasActiveSession, restoreSession]);

  const handleNameSubmit = (name: string) => {
    setPlayerName(name);
    generateSessionId(); // Create a new session ID for this player
    setShowNameDialog(false);
    
    // Check if we have a game ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('game');
    
    if (gameIdFromUrl) {
      // Join the game room directly
      socket.emit('join-game', { gameId: gameIdFromUrl, playerName: name });
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
    
    // Join the game room
    console.log(`Emitting join-game event for ${playerName} to ${newGameId}`);
    socket.emit('join-game', { gameId: newGameId, playerName });
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
