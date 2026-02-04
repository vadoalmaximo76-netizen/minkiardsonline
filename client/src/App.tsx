import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GameBoard } from "./components/GameBoard";
import { PlayerNameDialog } from "./components/PlayerNameDialog";
import { RoomCodeDialog } from "./components/RoomCodeDialog";
import { AuthDialog } from "./components/AuthDialog";
import { AdBanner } from "./components/AdBanner";
import { HomeScreen } from "./components/HomeScreen";
import { TrainingMode } from "./components/TrainingMode";
import { ActiveRooms } from "./components/ActiveRooms";
import { ProfileSection } from "./components/ProfileSection";
import { SpectatorView } from "./components/SpectatorView";
import { ResetPasswordPage } from "./components/ResetPasswordPage";
import { CardAdminPanel } from "./components/CardAdminPanel";
import { UpdateNotification } from "./components/UpdateNotification";
import { OfflineGameBoard } from "./components/OfflineGameBoard";
import { useGameState } from "./lib/stores/useGameState";
import { socket } from "./lib/socket";
import { preloadCriticalImages } from "./lib/imagePreloader";
import "@fontsource/inter";
import "./index.css";

type AppSection = 'home' | 'play' | 'training' | 'rooms' | 'profile' | 'spectator' | 'offline' | 'admin';

function getResetPasswordToken(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('token');
}

const queryClient = new QueryClient();

interface AuthUser {
  id: number;
  username: string;
  email: string | null;
  avatar: string | null;
  puntiRankiard?: number;
}

import { TooltipProvider } from "./components/ui/tooltip";

function App() {
  const [showAuthDialog, setShowAuthDialog] = useState(true);
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthUser | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showRoomDialog, setShowRoomDialog] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [serverReady, setServerReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState<AppSection>('home');
  const [spectatingGameId, setSpectatingGameId] = useState<string | null>(null);
  const [resetPasswordToken, setResetPasswordToken] = useState<string | null>(() => getResetPasswordToken());
  const [gameInvitation, setGameInvitation] = useState<{
    senderId: number;
    senderUsername: string;
    gameId: string;
    roomCode: string;
  } | null>(null);
  // Track if session was successfully restored to prevent active-game-found from overriding
  const sessionRestoredRef = React.useRef(false);
  const { 
    setPlayerName, 
    playerName, 
    gameId, 
    setGameId, 
    hasActiveSession, 
    restoreSession, 
    generateSessionId, 
    isReconnecting,
    clearSession
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

        // Listen for active game found (after server restart)
        // Only rejoin if session was NOT already restored and we don't have an active game
        socket.on('active-game-found', (data: { gameId: string; handCount: number; playerName: string }) => {
          console.log('Active game found on server:', data);
          
          // Skip if session was already successfully restored
          if (sessionRestoredRef.current) {
            console.log('Session already restored, skipping active-game-found');
            return;
          }
          
          // Get current gameId from store to check if we're already in a game
          const currentGameId = useGameState.getState().gameId;
          const currentPlayerName = useGameState.getState().playerName;
          
          // If we already have a gameId, don't switch to a different game
          if (currentGameId && currentGameId !== data.gameId) {
            console.log(`Already in game ${currentGameId}, not switching to ${data.gameId}`);
            return;
          }
          
          // If we already have a gameId that matches, don't rejoin (we're already there)
          if (currentGameId === data.gameId && currentPlayerName === data.playerName) {
            console.log('Already in this game, skipping rejoin');
            return;
          }
          
          // Only rejoin if we don't have an active game
          if (data.playerName && data.gameId) {
            console.log(`Rejoining game ${data.gameId} as ${data.playerName} with ${data.handCount} cards in hand`);
            setGameId(data.gameId);
            setPlayerName(data.playerName);
            generateSessionId();
            // SECURITY: Include auth token for authenticated reconnection
            socket.emit('join-game', { 
              gameId: data.gameId, 
              playerName: data.playerName,
              authToken: localStorage.getItem('authToken')
            });
            setShowRoomDialog(false);
            setShowNameDialog(false);
          }
        });
        
        // Handle when join requires approval (game in progress)
        socket.on('join-requires-approval', ({ gameId, message }) => {
          console.log(`Join requires approval for game ${gameId}: ${message}`);
          alert(message || 'Questa partita è già iniziata. Usa la lista delle stanze attive per richiedere di unirti.');
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
        
        try {
          const res = await fetch('/api/auth/me', {
            headers: authToken ? {
              'Authorization': `Bearer ${authToken}`
            } : {}
          });
          
          const data = await res.json();
          
          if (res.ok && data.user) {
            setAuthenticatedUser(data.user);
            setShowAuthDialog(false);
            
            // Register user with socket for targeted notifications (game invites)
            console.log('Emitting set-user-data after login validation');
            socket.emit('set-user-data', { authToken });
            
            if (hasActiveSession()) {
              console.log('Found active session, attempting to restore...');
              const restored = await restoreSession();
              
              if (restored) {
                console.log('Session restored successfully');
                sessionRestoredRef.current = true; // Mark session as restored to prevent active-game-found override
                setShowNameDialog(false);
                setShowRoomDialog(false);
                setIsInitializing(false);
                return;
              }
            }
            
            // Check if server has an active game for this player (after server restart)
            // SECURITY: Send auth token, server will resolve player identity
            socket.emit('check-active-game', { authToken });
            
            setPlayerName(data.user.username);
            setPendingAvatar(data.user.avatar);
            
            const urlParams = new URLSearchParams(window.location.search);
            const gameIdFromUrl = urlParams.get('game');
            
            if (gameIdFromUrl) {
              setGameId(gameIdFromUrl);
              setCurrentSection('play');
              generateSessionId();
              socket.emit('join-game', { 
                gameId: gameIdFromUrl, 
                playerName: data.user.username, 
                avatarId: data.user.avatar,
                userId: data.user.id
              });
            } else {
              setCurrentSection('home');
            }
            
            setIsInitializing(false);
            return;
          } else if (res.ok && data.guestMode && data.dbError) {
            // Database unavailable - enable guest mode with warning
            console.log('Guest mode enabled - database unavailable');
            setShowAuthDialog(false);
            setCurrentSection('home');
            setIsInitializing(false);
            return;
          } else if (res.ok && data.guestMode && data.noToken) {
            // No token stored - show auth dialog
            setIsInitializing(false);
            return;
          } else if (res.status === 401) {
            // Invalid or expired token - clear and show auth dialog
            console.log('Token invalid/expired, clearing auth');
            localStorage.removeItem('authToken');
            localStorage.removeItem('userId');
          }
        } catch (error) {
          console.error('Error checking auth:', error);
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
      socket.off('active-game-found');
      socket.off('connect');
      socket.off('join-requires-approval');
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

  // Show reset password page if token is present in URL
  if (resetPasswordToken) {
    return (
      <QueryClientProvider client={queryClient}>
        <ResetPasswordPage 
          token={resetPasswordToken} 
          onComplete={() => {
            setResetPasswordToken(null);
            window.history.replaceState({}, '', window.location.pathname);
          }} 
        />
      </QueryClientProvider>
    );
  }

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
      console.log('handleAuthSuccess: Emitting set-user-data, socket connected:', socket.connected);
      socket.emit('set-user-data', { authToken });
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('game');
    
    if (gameIdFromUrl) {
      setGameId(gameIdFromUrl);
      setCurrentSection('play');
      socket.emit('join-game', { 
        gameId: gameIdFromUrl, 
        playerName: user.username, 
        avatarId: user.avatar,
        userId: user.id
      });
    } else {
      setCurrentSection('home');
    }
  };

  const handleNavigate = (section: 'play' | 'training' | 'rooms' | 'profile' | 'offline' | 'admin') => {
    if (section === 'play') {
      setShowRoomDialog(true);
    }
    setCurrentSection(section);
  };

  const handleJoinRoom = (roomGameId: string) => {
    setGameId(roomGameId);
    generateSessionId();
    
    const newUrl = `${window.location.origin}?game=${roomGameId}`;
    window.history.pushState(null, '', newUrl);
    
    socket.emit('join-game', { 
      gameId: roomGameId, 
      playerName, 
      avatarId: pendingAvatar,
      userId: authenticatedUser?.id 
    });
    
    setCurrentSection('play');
    setShowRoomDialog(false);
  };

  const handleJoinTournamentMatch = (tournamentGameId: string, matchId: number, tournamentName: string) => {
    setGameId(tournamentGameId);
    generateSessionId();
    
    const newUrl = `${window.location.origin}?game=${tournamentGameId}`;
    window.history.pushState(null, '', newUrl);
    
    socket.emit('join-game', { 
      gameId: tournamentGameId, 
      playerName, 
      avatarId: pendingAvatar,
      userId: authenticatedUser?.id,
      tournamentMatchId: matchId,
      tournamentName
    });
    
    setCurrentSection('play');
  };

  const handleUpdateProfile = (updates: { username?: string; avatar?: string }) => {
    if (updates.username) {
      setPlayerName(updates.username);
    }
    if (updates.avatar) {
      setPendingAvatar(updates.avatar);
    }
    if (authenticatedUser) {
      setAuthenticatedUser({
        ...authenticatedUser,
        username: updates.username || authenticatedUser.username,
        avatar: updates.avatar || authenticatedUser.avatar
      });
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

  // Show Home Screen
  if (currentSection === 'home') {
    return (
      <QueryClientProvider client={queryClient}>
        <HomeScreen 
          playerName={playerName}
          userId={authenticatedUser?.id}
          onNavigate={handleNavigate}
          onJoinTournamentMatch={handleJoinTournamentMatch}
          userEmail={authenticatedUser?.email || undefined}
        />
      </QueryClientProvider>
    );
  }

  // Show Training Mode
  if (currentSection === 'training') {
    return (
      <QueryClientProvider client={queryClient}>
        <TrainingMode
          playerName={playerName}
          userId={authenticatedUser?.id}
          avatarId={pendingAvatar}
          userEmail={authenticatedUser?.email}
          onBack={() => setCurrentSection('home')}
        />
      </QueryClientProvider>
    );
  }

  // Show Spectator View
  if (currentSection === 'spectator' && spectatingGameId) {
    return (
      <QueryClientProvider client={queryClient}>
        <SpectatorView
          gameId={spectatingGameId}
          spectatorName={playerName || 'Spettatore'}
          onLeave={() => {
            setSpectatingGameId(null);
            setCurrentSection('rooms');
          }}
        />
      </QueryClientProvider>
    );
  }

  // Show Active Rooms
  if (currentSection === 'rooms') {
    return (
      <QueryClientProvider client={queryClient}>
        <ActiveRooms
          playerName={playerName}
          userId={authenticatedUser?.id}
          avatarId={pendingAvatar}
          onBack={() => setCurrentSection('home')}
          onJoinRoom={handleJoinRoom}
          onSpectate={(gameId) => {
            setSpectatingGameId(gameId);
            setCurrentSection('spectator');
          }}
        />
      </QueryClientProvider>
    );
  }

  // Show Profile Section
  if (currentSection === 'profile') {
    return (
      <QueryClientProvider client={queryClient}>
        <ProfileSection
          playerName={playerName}
          userId={authenticatedUser?.id}
          userEmail={authenticatedUser?.email}
          userAvatar={authenticatedUser?.avatar}
          socket={socket}
          onBack={() => setCurrentSection('home')}
          onUpdateProfile={handleUpdateProfile}
        />
      </QueryClientProvider>
    );
  }

  // Show Offline Game Mode - uses local game engine (works without server)
  if (currentSection === 'offline') {
    return (
      <QueryClientProvider client={queryClient}>
        <OfflineGameBoard 
          playerName={playerName || authenticatedUser?.username || 'Giocatore'}
          onBack={() => {
            setCurrentSection('home');
            window.history.pushState(null, '', window.location.origin);
          }}
        />
      </QueryClientProvider>
    );
  }

  // Show Admin Panel (only for lucaforte94@gmail.com)
  if (currentSection === 'admin') {
    if (authenticatedUser?.email !== 'lucaforte94@gmail.com') {
      setCurrentSection('home');
      return null;
    }
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-arena-deep overflow-auto">
          <CardAdminPanel
            onBack={() => setCurrentSection('home')}
          />
        </div>
      </QueryClientProvider>
    );
  }

  // Show Room Dialog for Play section
  if (showRoomDialog || !gameId) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-arena-deep flex flex-col items-center justify-center">
          <button
            onClick={() => setCurrentSection('home')}
            className="absolute top-4 left-4 p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
          >
            ← Indietro
          </button>
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
    clearSession(); // Clear all session data including localStorage
    sessionRestoredRef.current = false; // Reset the ref so active-game-found can work again
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
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-arena-deep overflow-auto">
          {/* Card Update Notification */}
          <UpdateNotification />
          
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
            onBack={() => {
              // Only reset game-related state, keep player identity
              setGameId('');
              setShowRoomDialog(false);
              setCurrentSection('home');
              sessionRestoredRef.current = false;
              window.history.pushState(null, '', window.location.origin);
            }}
            onLeaveGame={() => {
              // Called when user leaves game via handleLeaveGame in GameBoard
              sessionRestoredRef.current = false; // Reset the ref so active-game-found can work again
            }}
          />
        </div>
      </QueryClientProvider>
    </TooltipProvider>
  );
}

export default App;
