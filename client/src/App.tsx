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
  const { setPlayerName, playerName, gameId, setGameId } = useGameState();

  useEffect(() => {
    // Get game ID from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('game');
    
    if (gameIdFromUrl) {
      setGameId(gameIdFromUrl);
      // If there's a game ID in URL, skip room selection
      setShowRoomDialog(false);
    }

    // Connect to socket
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [setGameId]);

  const handleNameSubmit = (name: string) => {
    setPlayerName(name);
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
    setGameId(newGameId);
    setShowRoomDialog(false);
    
    // Update URL to include room code
    const newUrl = `${window.location.origin}?game=${newGameId}`;
    window.history.pushState(null, '', newUrl);
    
    // Join the game room
    socket.emit('join-game', { gameId: newGameId, playerName });
  };

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
