import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode, useCallback } from "react";
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
import { DraftSection } from "./components/DraftSection";
import { FantaMinkiardsSection } from "./components/FantaMinkiardsSection";
import { ClassicTournamentHub } from "./components/ClassicTournamentHub";
import { DeckSelectDialog } from "./components/DeckSelectDialog";
import { RankiardLeaderboard } from "./components/RankiardLeaderboard";
import { GymMode } from "./components/GymMode";
import { DailyChallengeMode } from "./components/DailyChallengeMode";
import { SpotifyPlayer } from "./components/SpotifyPlayer";
import { useGameState } from "./lib/stores/useGameState";
import { socket } from "./lib/socket";
import { playOpen, playBack, initGlobalClickSound } from "./lib/uiSound";
import { preloadCriticalImages } from "./lib/imagePreloader";
import { Toaster } from "./components/ui/sonner";
import { useGamepadStore } from "./lib/stores/useGamepadStore";
import { GamepadCursor } from "./components/GamepadCursor";
import type { AppSection } from "./hooks/useGamepad";
import "@fontsource/inter";
import "./index.css";

const SECTION_PATHS: Record<AppSection, string> = {
  home:              '/',
  play:              '/gioca',
  training:          '/allenamento',
  rooms:             '/stanze',
  profile:           '/profilo',
  spectator:         '/spettatore',
  admin:             '/admin',
  draft:             '/draft',
  leaderboard:       '/classifica',
  tournaments:       '/tornei',
  fanta:             '/fanta',
  gym:               '/palestre',
  'daily-challenge': '/sfida-quotidiana',
};

const PATH_SECTIONS: Record<string, AppSection> = Object.fromEntries(
  Object.entries(SECTION_PATHS).map(([k, v]) => [v, k as AppSection])
);

function sectionFromPath(): AppSection {
  const path = window.location.pathname;
  return PATH_SECTIONS[path] || 'home';
}

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
  isAdmin?: boolean;
}

import { TooltipProvider } from "./components/ui/tooltip";
import NotificationPromptBanner from "./components/NotificationPromptBanner";
import { NotificationInbox } from "./components/NotificationInbox";
import { BottomNav } from "./components/BottomNav";
import { AdminPageTooltipFab } from "./components/AdminPageTooltipFab";
import { PageTooltipDisplay } from "./components/PageTooltipDisplay";
import { PWAInstallBanner } from "./components/PWAInstallBanner";

class GameErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GameErrorBoundary] Caught error:', error.message, error.stack);
    console.error('[GameErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-[9999] p-4">
          <div className="bg-gray-800 rounded-xl border border-red-500/50 p-6 max-w-md text-center">
            <h2 className="text-red-400 text-xl font-bold mb-3">Errore nel gioco</h2>
            <p className="text-gray-300 mb-2 text-sm">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold transition-colors"
            >
              Riprova
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageTransitionOverlay({ phase }: { phase: 'idle' | 'in' | 'out' }) {
  if (phase === 'idle') return null;
  return (
    <div
      className={phase === 'in' ? 'transition-overlay-in' : 'transition-overlay-out'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        pointerEvents: 'none',
      }}
    />
  );
}

function App() {
  const [showAuthDialog, setShowAuthDialog] = useState(true);
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthUser | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showRoomDialog, setShowRoomDialog] = useState(false);
  const [showDeckSelectDialog, setShowDeckSelectDialog] = useState(false);
  const [pendingDraftParams, setPendingDraftParams] = useState<{ gameId: string; playerName: string; avatarId: number | undefined; userId: number | undefined; turnTimerSeconds: number; helpEnabled?: boolean } | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [serverReady, setServerReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState<AppSection>(sectionFromPath);
  const [overlayPhase, setOverlayPhase] = useState<'idle' | 'in' | 'out'>('idle');
  const overlayTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [openHomeTournaments, setOpenHomeTournaments] = useState(false);
  const [spectatingGameId, setSpectatingGameId] = useState<string | null>(null);
  const [fantaReturnId, setFantaReturnId] = useState<string | null>(null);

  const { setNavSection, setPrimaryAction } = useGamepadStore();

  useEffect(() => {
    setNavSection(currentSection);
  }, [currentSection, setNavSection]);

  useEffect(() => {
    if (currentSection !== 'fanta') setFantaReturnId(null);
  }, [currentSection]);

  const [pendingGymGame, setPendingGymGame] = useState<{ gameId: string; gymLeaderCpuName?: string; gymLeaderId?: number } | null>(null);
  const [pendingTournamentGame, setPendingTournamentGame] = useState<{ gameId: string } | null>(null);
  const [pendingFantaGame, setPendingFantaGame] = useState<{ gameId: string; fantaTournamentId?: string } | null>(null);
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

  // Countdown displayed while reconnecting (mirrors the 27s client timeout)
  const [reconnectCountdown, setReconnectCountdown] = useState(27);

  useEffect(() => {
    if (!isReconnecting) {
      setReconnectCountdown(27);
      return;
    }
    setReconnectCountdown(27);
    const interval = setInterval(() => {
      setReconnectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isReconnecting]);

  const navigateToRef = useRef<((section: AppSection) => void) | null>(null);

  // On every page load: prompt any waiting Service Worker to activate immediately
  // so that stale cached assets are cleared before init runs.
  // Also reload once when the controller changes so the fresh SW version takes effect.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      console.log('[SW] Controller changed — reloading for fresh assets');
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker.getRegistration('/').then((reg) => {
      if (!reg) return;
      const applyUpdate = (sw: ServiceWorker) => {
        console.log('[SW] New version waiting — sending SKIP_WAITING');
        sw.postMessage({ type: 'SKIP_WAITING' });
      };
      if (reg.waiting) {
        applyUpdate(reg.waiting);
      }
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            applyUpdate(newSW);
          }
        });
      });
    }).catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      // Safety net: if initialization is still pending after 12 seconds, unblock the UI
      const safetyTimer = setTimeout(() => {
        console.warn('[init] Safety timeout reached — forcing isInitializing=false');
        setIsInitializing(false);
      }, 12000);

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
        socket.on('active-game-found', (data: { gameId: string; handCount: number; playerName: string; gameMode?: 'gym' | 'tournament' | 'fanta' | 'regular'; gymLeaderCpuName?: string; gymLeaderId?: number; fantaTournamentId?: string }) => {
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

          // If we're already in the play view with any active game, the set-user-data auto-rejoin
          // already restored the socket to the room — emitting join-game would interfere
          const appSection = (window as any).__minkAppSection;
          if (appSection === 'play' && currentGameId) {
            console.log('Already in play view — skipping active-game-found join-game, auto-rejoin handled by set-user-data');
            return;
          }

          // For special modes (gym, tournament, fanta) — store as pending so the user
          // can choose to resume via a contextual "Riprendi partita" button inside the section.
          const mode = data.gameMode || 'regular';
          if (mode === 'gym') {
            console.log(`[active-game-found] Pending gym game ${data.gameId} (${data.gymLeaderCpuName}, leaderId=${data.gymLeaderId})`);
            setPendingGymGame({ gameId: data.gameId, gymLeaderCpuName: data.gymLeaderCpuName, gymLeaderId: data.gymLeaderId });
            return;
          }
          if (mode === 'tournament') {
            console.log(`[active-game-found] Pending tournament game ${data.gameId}`);
            setPendingTournamentGame({ gameId: data.gameId });
            return;
          }
          if (mode === 'fanta') {
            console.log(`[active-game-found] Pending fanta game ${data.gameId} (fantaTournamentId=${data.fantaTournamentId})`);
            setPendingFantaGame({ gameId: data.gameId, fantaTournamentId: data.fantaTournamentId });
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
          // Navigate back to home so the player isn't stuck on an empty game screen
          setGameId('');
          setCurrentSection('home');
        });

        socket.on('challenge-accepted', (data: { gameId: string; roomCode: string; acceptedBy: string }) => {
          console.log(`Challenge accepted by ${data.acceptedBy}, room: ${data.roomCode}`);
          if (confirm(`${data.acceptedBy} ha accettato la tua sfida! Vuoi entrare nella stanza ${data.roomCode}?`)) {
            setGameId(data.gameId);
            generateSessionId();
            socket.emit('join-game', {
              gameId: data.gameId,
              playerName,
              avatarId: pendingAvatar,
              userId: authenticatedUser?.id,
              authToken: localStorage.getItem('authToken'),
            });
            navigateTo('play');
          }
        });
        
        // socket.ts 'connect' handler already sends set-user-data — no need to duplicate here
        // Emit check-server-ready inside the connect handler so it is sent only once the socket
        // is actually connected (avoids the event being lost if connect is still pending).
        socket.on('connect', () => {
          console.log('Socket connected');
          socket.emit('check-server-ready');
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
        
        preloadCriticalImages();
        initGlobalClickSound();
        
        const authToken = localStorage.getItem('authToken');
        
        try {
          // Fetch with an 8-second timeout so a hanging network call never blocks init
          const authController = new AbortController();
          const authFetchTimeout = setTimeout(() => {
            console.warn('[init] /api/auth/me timed out after 8s');
            authController.abort();
          }, 8000);

          let res: Response;
          try {
            res = await fetch('/api/auth/me', {
              signal: authController.signal,
              headers: authToken ? {
                'Authorization': `Bearer ${authToken}`
              } : {}
            });
          } finally {
            clearTimeout(authFetchTimeout);
          }
          
          const data = await res.json();
          
          if (res.ok && data.user) {
            setAuthenticatedUser(data.user);
            setShowAuthDialog(false);
            
            // Register user with socket for targeted notifications (game invites)
            console.log('Emitting set-user-data after login validation');
            socket.emit('set-user-data', { authToken, lastGameId: localStorage.getItem('mink_lastGameId') || undefined });
            
            if (hasActiveSession()) {
              console.log('Found active session, attempting to restore...');
              // Unblock the loading screen immediately — the reconnecting UI handles the wait
              clearTimeout(safetyTimer);
              setIsInitializing(false);
              const restored = await restoreSession();
              
              if (restored) {
                console.log('Session restored successfully');
                sessionRestoredRef.current = true; // Mark session as restored to prevent active-game-found override
                setShowNameDialog(false);
                setShowRoomDialog(false);
                return;
              }
            }
            
            // Check if server has an active game for this player (after server restart)
            // SECURITY: Send auth token, server will resolve player identity
            // Also send the last known gameId so the server can prefer the correct game
            socket.emit('check-active-game', { authToken, lastGameId: localStorage.getItem('mink_lastGameId') || undefined });
            
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
            
            clearTimeout(safetyTimer);
            setIsInitializing(false);
            return;
          } else if (res.ok && data.guestMode && data.dbError) {
            // Database unavailable - enable guest mode with warning
            console.log('Guest mode enabled - database unavailable');
            setShowAuthDialog(false);
            setCurrentSection('home');
            clearTimeout(safetyTimer);
            setIsInitializing(false);
            return;
          } else if (res.ok && data.guestMode && data.noToken) {
            // No token stored - show auth dialog
            clearTimeout(safetyTimer);
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
        
        clearTimeout(safetyTimer);
        setIsInitializing(false);
      } catch (error) {
        console.error('Error initializing app:', error);
        clearTimeout(safetyTimer);
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

  // Persist the last active gameId in localStorage so reconnection returns to the correct game
  useEffect(() => {
    if (gameId) {
      localStorage.setItem('mink_lastGameId', gameId);
    }
  }, [gameId]);

  useEffect(() => {
    (window as any).__minkAppSection = currentSection;
    const path = SECTION_PATHS[currentSection];
    const hasGame = window.location.search.includes('game=');
    if (currentSection !== 'play' && path && window.location.pathname !== path) {
      window.history.replaceState({ section: currentSection }, '', path);
    } else if (currentSection === 'play' && !hasGame && window.location.pathname !== path) {
      window.history.replaceState({ section: currentSection }, '', path);
    }
  }, [currentSection]);

  useEffect(() => {
    const handlePopState = () => {
      const section = sectionFromPath();
      setCurrentSection(section);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  const handleRoomSubmit = (roomCode: string, isDraftMode?: boolean, turnTimerSeconds?: number, helpEnabled?: boolean) => {
    const newGameId = `room-${roomCode}`;
    console.log(`Attempting to join room: ${newGameId} with player: ${playerName}${isDraftMode ? ' [DRAFT]' : ''}${helpEnabled ? ' [AIUTI]' : ''}`);
    
    setShowRoomDialog(false);
    setShowDeckSelectDialog(false);
    setPendingDraftParams(null);

    if (isDraftMode) {
      // For Draft mode: show deck selection first
      setPendingDraftParams({
        gameId: newGameId,
        playerName,
        avatarId: pendingAvatar,
        userId: authenticatedUser?.id,
        turnTimerSeconds: turnTimerSeconds ?? 30,
        helpEnabled: helpEnabled ?? false,
      });
      setShowDeckSelectDialog(true);
      return;
    }

    setGameId(newGameId);
    
    // Update URL to include room code
    const newUrl = `${window.location.origin}?game=${newGameId}`;
    window.history.pushState(null, '', newUrl);
    
    // Join the game room with avatar and userId
    console.log(`Emitting join-game event for ${playerName} to ${newGameId}`);
    socket.emit('join-game', { 
      gameId: newGameId, 
      playerName, 
      avatarId: pendingAvatar,
      userId: authenticatedUser?.id,
      isDraftMode: false,
      turnTimerSeconds: turnTimerSeconds ?? 30,
      helpEnabled: helpEnabled ?? false,
    });
  };

  const handleDeckConfirmed = () => {
    if (!pendingDraftParams) return;
    const p = pendingDraftParams;
    setShowDeckSelectDialog(false);
    setPendingDraftParams(null);
    setGameId(p.gameId);
    const newUrl = `${window.location.origin}?game=${p.gameId}`;
    window.history.pushState(null, '', newUrl);
    console.log(`Emitting join-game (draft) for ${p.playerName} to ${p.gameId}`);
    socket.emit('join-game', {
      gameId: p.gameId,
      playerName: p.playerName,
      avatarId: p.avatarId,
      userId: p.userId,
      isDraftMode: true,
      turnTimerSeconds: p.turnTimerSeconds,
      helpEnabled: p.helpEnabled ?? false,
    });
  };

  useEffect(() => {
    let action: (() => void) | undefined;
    switch (currentSection) {
      case 'home':
      case 'rooms':
        action = () => { setShowRoomDialog(true); navigateToRef.current?.('play'); };
        break;
      case 'play':
        action = () => setShowRoomDialog(true);
        break;
      case 'leaderboard':
        action = () => navigateToRef.current?.('play');
        break;
      case 'draft':
      case 'tournaments':
      case 'fanta':
      case 'gym':
      case 'profile':
        action = () => navigateToRef.current?.('home', 'back');
        break;
      default:
        action = undefined;
        break;
    }
    setPrimaryAction(action);
  }, [currentSection, setPrimaryAction]);

  const renderContent = () => {
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
               isInitializing ? 'Inizializzazione...' : 'Riconnessione in corso...'}
            </p>
            {isReconnecting ? (
              <div className="mt-3">
                <p className="text-yellow-300 text-sm font-semibold">
                  Il tuo turno è al sicuro per altri {reconnectCountdown}s
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  Riconnessione automatica in corso...
                </p>
              </div>
            ) : (
              <p className="text-gray-400 text-sm mt-2">
                {Math.round(loadingProgress)}%
              </p>
            )}
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
      socket.emit('set-user-data', { authToken, lastGameId: localStorage.getItem('mink_lastGameId') || undefined });
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

  const navigateTo = (section: AppSection, sound: 'open' | 'back' | 'none' = 'open') => {
    overlayTimersRef.current.forEach(clearTimeout);
    overlayTimersRef.current = [];

    if (sound === 'open') playOpen();
    else if (sound === 'back') playBack();

    setOverlayPhase('in');
    const t1 = setTimeout(() => {
      setCurrentSection(section);
      const path = SECTION_PATHS[section];
      const hasGame = window.location.search.includes('game=');
      if (!hasGame || section !== 'play') {
        window.history.pushState({ section }, '', path);
      }
      setOverlayPhase('out');
    }, 170);
    const t2 = setTimeout(() => setOverlayPhase('idle'), 420);
    overlayTimersRef.current = [t1, t2];
  };

  navigateToRef.current = (section: AppSection) => navigateTo(section);

  const handleGoHome = () => navigateTo('home', 'back');

  const handleBottomNavNavigate = (section: AppSection) => {
    if (section === 'play') {
      if (!gameId) setShowRoomDialog(true);
      navigateTo('play');
    } else {
      navigateTo(section);
    }
  };

  const handleNavigate = (section: 'play' | 'training' | 'rooms' | 'profile' | 'admin' | 'draft' | 'leaderboard' | 'tournaments' | 'fanta' | 'gym' | 'daily-challenge') => {
    if (section === 'play') {
      setShowRoomDialog(true);
    }
    navigateTo(section);
  };

  const handleJoinGameFromNotification = (newGameId: string) => {
    setGameId(newGameId);
    generateSessionId();
    socket.emit('join-game', {
      gameId: newGameId,
      playerName,
      avatarId: pendingAvatar,
      userId: authenticatedUser?.id,
      authToken: localStorage.getItem('authToken'),
    });
    navigateTo('play');
  };

  const handleJoinRoom = (roomGameId: string, roomPassword?: string) => {
    setGameId(roomGameId);
    generateSessionId();
    
    const newUrl = `${window.location.origin}?game=${roomGameId}`;
    window.history.pushState(null, '', newUrl);
    
    socket.emit('join-game', { 
      gameId: roomGameId, 
      playerName, 
      avatarId: pendingAvatar,
      userId: authenticatedUser?.id,
      ...(roomPassword ? { roomPassword } : {})
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

  const handleResumeGame = (gameId: string, playerNameForResume: string) => {
    setGameId(gameId);
    setPlayerName(playerNameForResume);
    generateSessionId();
    socket.emit('rejoin-game', {
      gameId,
      playerName: playerNameForResume,
      authToken: localStorage.getItem('authToken'),
    });
    setPendingGymGame(null);
    setPendingTournamentGame(null);
    setPendingFantaGame(null);
    setCurrentSection('play');
  };

  const handleResumeFantaGame = (pendingGame: { gameId: string; fantaTournamentId?: string }) => {
    const pName = authenticatedUser?.username || playerName;
    setPendingFantaGame(null);
    // active-game-found only fires for active card games, so fanta pending games are always
    // match games. Emit rejoin-game and navigate to play to show the game board.
    // Store fantaReturnId so the user can navigate back to the fanta section after the match.
    if (pendingGame.fantaTournamentId) {
      setFantaReturnId(pendingGame.fantaTournamentId);
    }
    setGameId(pendingGame.gameId);
    setPlayerName(pName);
    generateSessionId();
    socket.emit('rejoin-game', {
      gameId: pendingGame.gameId,
      playerName: pName,
      authToken: localStorage.getItem('authToken'),
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
        <div className="page-enter">
          <HomeScreen 
            playerName={playerName}
            userId={authenticatedUser?.id}
            onNavigate={handleNavigate}
            onJoinTournamentMatch={handleJoinTournamentMatch}
            userEmail={authenticatedUser?.email || undefined}
            initialShowTournaments={openHomeTournaments}
            onInitialShowTournamentsHandled={() => setOpenHomeTournaments(false)}
            pendingTournamentGame={pendingTournamentGame ?? undefined}
            onResumeTournamentGame={(gameId) => handleResumeGame(gameId, authenticatedUser?.username || playerName)}
            onRejoinLastGame={(gameId) => handleResumeGame(gameId, authenticatedUser?.username || playerName)}
          />
        </div>
        <SpotifyPlayer disabled={false} />
        <PageTransitionOverlay phase={overlayPhase} />
        <NotificationPromptBanner authToken={localStorage.getItem('authToken')} />
        <NotificationInbox onNavigate={(s) => handleNavigate(s as any)} socket={socket} onJoinGame={handleJoinGameFromNotification} />
        <BottomNav currentSection={currentSection} onNavigate={handleBottomNavNavigate} hasActiveGame={!!gameId} />
      </QueryClientProvider>
    );
  }

  // Show Training Mode
  if (currentSection === 'training') {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="page-enter">
          <TrainingMode
            playerName={playerName}
            userId={authenticatedUser?.id}
            avatarId={pendingAvatar}
            userEmail={authenticatedUser?.email}
            onBack={handleGoHome}
          />
        </div>
        <SpotifyPlayer disabled={false} />
        <PageTransitionOverlay phase={overlayPhase} />
        <NotificationPromptBanner authToken={localStorage.getItem('authToken')} />
        <NotificationInbox onNavigate={(s) => handleNavigate(s as any)} socket={socket} onJoinGame={handleJoinGameFromNotification} />
      </QueryClientProvider>
    );
  }

  // Show Spectator View
  if (currentSection === 'spectator' && spectatingGameId) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="page-enter">
          <SpectatorView
            gameId={spectatingGameId}
            spectatorName={playerName || 'Spettatore'}
            onLeave={() => {
              setSpectatingGameId(null);
              navigateTo('rooms', 'back');
            }}
          />
        </div>
        <SpotifyPlayer disabled={false} />
        <PageTransitionOverlay phase={overlayPhase} />
        <NotificationPromptBanner authToken={localStorage.getItem('authToken')} />
        <NotificationInbox onNavigate={(s) => handleNavigate(s as any)} socket={socket} onJoinGame={handleJoinGameFromNotification} />
      </QueryClientProvider>
    );
  }

  // Show Active Rooms
  if (currentSection === 'rooms') {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="page-enter">
          <ActiveRooms
            playerName={playerName}
            userId={authenticatedUser?.id}
            avatarId={pendingAvatar}
            onBack={handleGoHome}
            onJoinRoom={handleJoinRoom}
            onSpectate={(gameId) => {
              setSpectatingGameId(gameId);
              navigateTo('spectator');
            }}
          />
        </div>
        <SpotifyPlayer disabled={false} />
        <PageTransitionOverlay phase={overlayPhase} />
        <NotificationPromptBanner authToken={localStorage.getItem('authToken')} />
        <NotificationInbox onNavigate={(s) => handleNavigate(s as any)} socket={socket} onJoinGame={handleJoinGameFromNotification} />
        <BottomNav currentSection={currentSection} onNavigate={handleBottomNavNavigate} hasActiveGame={!!gameId} />
      </QueryClientProvider>
    );
  }

  // Show Profile Section
  if (currentSection === 'profile') {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="page-enter">
          <ProfileSection
            playerName={playerName}
            userId={authenticatedUser?.id}
            userEmail={authenticatedUser?.email}
            userAvatar={authenticatedUser?.avatar}
            socket={socket}
            onBack={handleGoHome}
            onUpdateProfile={handleUpdateProfile}
            onLogin={() => setShowAuthDialog(true)}
          />
        </div>
        <SpotifyPlayer disabled={false} />
        <PageTransitionOverlay phase={overlayPhase} />
        <NotificationPromptBanner authToken={localStorage.getItem('authToken')} />
        <NotificationInbox onNavigate={(s) => handleNavigate(s as any)} socket={socket} onJoinGame={handleJoinGameFromNotification} />
        <BottomNav currentSection={currentSection} onNavigate={handleBottomNavNavigate} hasActiveGame={!!gameId} />
      </QueryClientProvider>
    );
  }

  // Show Draft Section (music disabled)
  if (currentSection === 'draft') {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="page-enter">
          <DraftSection
            playerName={playerName}
            userId={authenticatedUser?.id}
            onBack={handleGoHome}
            onGoToTournaments={() => { setOpenHomeTournaments(true); navigateTo('home', 'back'); }}
            onLogin={() => setShowAuthDialog(true)}
          />
        </div>
        <SpotifyPlayer disabled={false} />
        <PageTransitionOverlay phase={overlayPhase} />
        <NotificationPromptBanner authToken={localStorage.getItem('authToken')} />
        <NotificationInbox onNavigate={(s) => handleNavigate(s as any)} socket={socket} onJoinGame={handleJoinGameFromNotification} />
        <BottomNav currentSection={currentSection} onNavigate={handleBottomNavNavigate} hasActiveGame={!!gameId} />
      </QueryClientProvider>
    );
  }

  // Show Classic Tournament Hub
  if (currentSection === 'tournaments') {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="page-enter" style={{ width: '100%', height: '100vh', position: 'relative' }}>
          <ClassicTournamentHub
            userId={authenticatedUser?.id ?? 0}
            username={playerName}
            puntiRankiard={(authenticatedUser as any)?.puntiRankiard ?? 0}
            userEmail={authenticatedUser?.email ?? ''}
            onClose={handleGoHome}
            onPlayMatch={handleJoinTournamentMatch}
            onLogin={() => setShowAuthDialog(true)}
          />
        </div>
        <SpotifyPlayer disabled={false} />
        <PageTransitionOverlay phase={overlayPhase} />
        <NotificationPromptBanner authToken={localStorage.getItem('authToken')} />
        <NotificationInbox onNavigate={(s) => handleNavigate(s as any)} socket={socket} onJoinGame={handleJoinGameFromNotification} />
        <BottomNav currentSection={currentSection} onNavigate={handleBottomNavNavigate} hasActiveGame={!!gameId} />
      </QueryClientProvider>
    );
  }

  // Show Leaderboard Section
  if (currentSection === 'leaderboard') {
    return (
      <QueryClientProvider client={queryClient}>
        <RankiardLeaderboard
          isOpen={true}
          onClose={handleGoHome}
          currentUserId={authenticatedUser?.id}
          currentGameId={gameId}
          onNavigate={(s) => handleNavigate(s as any)}
        />
        <SpotifyPlayer disabled={false} />
        <NotificationPromptBanner authToken={localStorage.getItem('authToken')} />
        <NotificationInbox onNavigate={(s) => handleNavigate(s as any)} socket={socket} onJoinGame={handleJoinGameFromNotification} />
        <BottomNav currentSection={currentSection} onNavigate={handleBottomNavNavigate} hasActiveGame={!!gameId} />
      </QueryClientProvider>
    );
  }

  // Show FantaMinkiards Section
  if (currentSection === 'fanta') {
    return (
      <QueryClientProvider client={queryClient}>
        <FantaMinkiardsSection
          playerName={authenticatedUser?.username || playerName}
          authToken={localStorage.getItem('authToken') ?? undefined}
          isAdmin={authenticatedUser?.email === 'lucaforte94@gmail.com'}
          initialFantaId={fantaReturnId ?? undefined}
          onClose={handleGoHome}
          pendingFantaGame={pendingFantaGame ?? undefined}
          onResumeFantaGame={(gameId, fantaTournamentId) => handleResumeFantaGame({ gameId, fantaTournamentId })}
          onJoinFantaGame={(gameId: string) => {
            setGameId(gameId);
            const newUrl = `${window.location.origin}?game=${gameId}`;
            window.history.pushState(null, '', newUrl);
            socket.emit('join-game', {
              gameId,
              playerName,
              avatarId: pendingAvatar,
              userId: authenticatedUser?.id,
              isDraftMode: true,
            });
            setCurrentSection('play');
          }}
        />
        <SpotifyPlayer disabled={false} />
        <NotificationPromptBanner authToken={localStorage.getItem('authToken')} />
        <NotificationInbox onNavigate={(s) => handleNavigate(s as any)} socket={socket} onJoinGame={handleJoinGameFromNotification} />
        <BottomNav currentSection={currentSection} onNavigate={handleBottomNavNavigate} hasActiveGame={!!gameId} />
      </QueryClientProvider>
    );
  }

  // Show Gym / Story Mode
  if (currentSection === 'gym') {
    return (
      <QueryClientProvider client={queryClient}>
        <GymMode
          playerName={authenticatedUser?.username || playerName}
          userId={authenticatedUser?.id}
          avatarId={authenticatedUser?.avatar}
          onBack={handleGoHome}
          pendingGymGame={pendingGymGame ?? undefined}
          onResumeGymGame={(gameId) => handleResumeGame(gameId, authenticatedUser?.username || playerName)}
          onClearPendingGymGame={() => setPendingGymGame(null)}
          onLogin={() => setShowAuthDialog(true)}
        />
        <SpotifyPlayer disabled={false} />
        <NotificationPromptBanner authToken={localStorage.getItem('authToken')} />
        <NotificationInbox onNavigate={(s) => handleNavigate(s as any)} socket={socket} onJoinGame={handleJoinGameFromNotification} />
      </QueryClientProvider>
    );
  }

  // Show Daily Challenge
  if (currentSection === 'daily-challenge') {
    return (
      <QueryClientProvider client={queryClient}>
        <DailyChallengeMode
          playerName={authenticatedUser?.username || playerName}
          userId={authenticatedUser?.id}
          avatarId={authenticatedUser?.avatar}
          onBack={handleGoHome}
          onLogin={() => setShowAuthDialog(true)}
        />
        <SpotifyPlayer disabled={false} />
        <NotificationPromptBanner authToken={localStorage.getItem('authToken')} />
        <NotificationInbox onNavigate={(s) => handleNavigate(s as any)} socket={socket} onJoinGame={handleJoinGameFromNotification} />
      </QueryClientProvider>
    );
  }

  // Show Admin Panel - uses CardAdminPanel for card management
  if (currentSection === 'admin') {
    if (authenticatedUser?.email !== 'lucaforte94@gmail.com') {
      setCurrentSection('home');
      return null;
    }
    return (
      <QueryClientProvider client={queryClient}>
        <div className="page-enter-no-transform">
          <CardAdminPanel 
            onBack={() => {
              window.history.pushState(null, '', window.location.origin);
              handleGoHome();
            }}
          />
        </div>
        <SpotifyPlayer disabled={false} />
        <PageTransitionOverlay phase={overlayPhase} />
        <NotificationPromptBanner authToken={localStorage.getItem('authToken')} />
        <NotificationInbox onNavigate={(s) => handleNavigate(s as any)} socket={socket} onJoinGame={handleJoinGameFromNotification} />
      </QueryClientProvider>
    );
  }

  // Show Room Dialog for Play section (only when in play mode)
  if (currentSection === 'play' && (showRoomDialog || !gameId)) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-arena-deep flex flex-col items-center justify-center">
          <button
            onClick={() => { setShowDeckSelectDialog(false); setPendingDraftParams(null); handleGoHome(); }}
            className="absolute top-4 left-4 p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
          >
            ← Indietro
          </button>
          <div className="w-full max-w-md mb-4">
            <AdBanner format="horizontal" className="mx-auto" />
          </div>
          <RoomCodeDialog
            open={(showRoomDialog || !gameId) && !showDeckSelectDialog}
            onSubmit={handleRoomSubmit}
          />
          <div className="w-full max-w-md mt-4">
            <AdBanner format="horizontal" className="mx-auto" />
          </div>
        </div>
        <DeckSelectDialog
          open={showDeckSelectDialog}
          onClose={() => { setShowDeckSelectDialog(false); setPendingDraftParams(null); }}
          onConfirm={handleDeckConfirmed}
        />
        <SpotifyPlayer disabled={false} />
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
        <div className="min-h-screen bg-arena-deep overflow-auto animate-view-enter">
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
          <GameErrorBoundary>
            <GameBoard 
              authenticatedUser={authenticatedUser}
              onLogout={handleLogout}
              authToken={localStorage.getItem('authToken')}
              onBack={() => {
                setGameId('');
                setShowRoomDialog(false);
                setCurrentSection('home');
                sessionRestoredRef.current = false;
                window.history.pushState(null, '', window.location.origin);
              }}
              onLeaveGame={() => {
                sessionRestoredRef.current = false;
              }}
              onContinueTournament={() => {
                console.log('[APP] Prosegui torneo — navigating to tournaments');
                sessionRestoredRef.current = true;
                window.history.pushState(null, '', window.location.origin);
                setCurrentSection('tournaments');
              }}
              onContinueFantaTournament={(fantaId: string) => {
                console.log('[APP] Continua torneo FantaMinkiards — fantaId:', fantaId);
                sessionRestoredRef.current = true;
                window.history.pushState(null, '', window.location.origin);
                if (authenticatedUser?.username) {
                  setPlayerName(authenticatedUser.username);
                }
                setFantaReturnId(fantaId);
                setCurrentSection('fanta');
              }}
              onLogin={() => setShowAuthDialog(true)}
            />
          </GameErrorBoundary>
        </div>
        <DeckSelectDialog
          open={showDeckSelectDialog}
          onClose={() => { setShowDeckSelectDialog(false); setPendingDraftParams(null); }}
          onConfirm={handleDeckConfirmed}
        />
        <Toaster position="top-right" richColors />
      </QueryClientProvider>
    </TooltipProvider>
  );
  }; // end renderContent

  const isAdmin = !!(authenticatedUser?.isAdmin);
  const currentPageRoute = SECTION_PATHS[currentSection] ?? '/';

  return (
    <>
      <GamepadCursor onNavigate={(section) => navigateToRef.current?.(section)} />
      {renderContent()}
      {authenticatedUser && (
        <>
          <PageTooltipDisplay
            currentRoute={currentPageRoute}
            userId={authenticatedUser.id}
          />
          <AdminPageTooltipFab
            currentRoute={currentPageRoute}
            isAdmin={isAdmin}
          />
        </>
      )}
      <PWAInstallBanner />
    </>
  );
}

export default App;
