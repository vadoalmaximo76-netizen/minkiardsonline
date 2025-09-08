import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GameBoard } from "./components/GameBoard";
import { PlayerNameDialog } from "./components/PlayerNameDialog";
import { useGameState } from "./lib/stores/useGameState";
import { socket } from "./lib/socket";
import "@fontsource/inter";
import "./index.css";

const queryClient = new QueryClient();

function App() {
  const [showNameDialog, setShowNameDialog] = useState(true);
  const { setPlayerName, playerName, gameId, setGameId } = useGameState();

  useEffect(() => {
    // Get or create game ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('game') || 'default-game';
    setGameId(gameIdFromUrl);

    // Connect to socket
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [setGameId]);

  const handleNameSubmit = (name: string) => {
    setPlayerName(name);
    setShowNameDialog(false);
    
    // Join the game room
    socket.emit('join-game', { gameId, playerName: name });
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

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-royal-blue overflow-auto">
        <GameBoard />
      </div>
    </QueryClientProvider>
  );
}

export default App;
