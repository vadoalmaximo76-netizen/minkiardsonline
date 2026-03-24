import React, { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { socket } from "../lib/socket";
import { FantaAuctionRoom } from "./FantaAuctionRoom";
import { InjuredPersonaggiDisclaimer } from "./InjuredPersonaggiDisclaimer";

interface SessionSummary {
  id: string;
  creatorName: string;
  participantCount: number;
  participants: string[];
  maxParticipants: number;
  status: string;
  createdAt: number;
  isPublic?: boolean;
  scheduledStart?: number;
  invitedUsers?: string[];
}

interface FantaParticipant {
  name: string;
  credits: number;
  deck: { personaggi: any[]; mosse: any[]; bonus: any[] };
  isCPU: boolean;
  socketId?: string;
  teamName?: string;
  teamColor?: string;
  teamLogo?: string;
  isReady?: boolean;
}

interface FantaPlayerStats {
  matchesPlayed: number;
  wins: number;
  totalDamageDealt: number;
  totalCardsPlayed: number;
  totalTurns: number;
}

interface FantaMarketListing {
  id: string;
  sellerName: string;
  card: any;
  price: number;
  listedAt: number;
}

interface PendingRequest {
  name: string;
  socketId: string;
  requestedAt: number;
}

interface FantaSession {
  id: string;
  creatorName: string;
  participants: Record<string, FantaParticipant>;
  maxParticipants: number;
  cpuCount: number;
  pendingRequests: PendingRequest[];
  status: 'lobby' | 'auction' | 'complete';
  createdAt: number;
  cardsNeeded?: { personaggi: number; mosse: number; bonus: number };
  startingBudget?: number;
  tournamentStats?: Record<string, FantaPlayerStats>;
  market?: { listings: FantaMarketListing[] };
  isPublic: boolean;
  invitedUsers: string[];
  scheduledStart?: number;
}

interface Props {
  playerName: string;
  authToken?: string;
  isAdmin?: boolean;
  initialFantaId?: string;
  onClose: () => void;
  onJoinFantaGame?: (gameId: string) => void;
  pendingFantaGame?: { gameId: string };
  onResumeFantaGame?: (gameId: string) => void;
}

const TOTAL_CARDS = { personaggi: 207, mosse: 91, bonus: 172 };
const DEFAULT_DECK_SIZES = { personaggi: 20, mosse: 9, bonus: 15 };

export function FantaMinkiardsSection({ playerName, authToken, isAdmin, initialFantaId, onClose, onJoinFantaGame, pendingFantaGame, onResumeFantaGame }: Props) {
  const [view, setView] = useState<'list' | 'lobby' | 'waiting' | 'auction' | 'complete' | 'configure' | 'bracket'>('list');
  const [lobbySessions, setLobbySessions] = useState<SessionSummary[]>([]);
  const [currentSession, setCurrentSession] = useState<FantaSession | null>(null);
  const [fantaId, setFantaId] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [totalParticipants, setTotalParticipants] = useState(4);
  const [cpuCount, setCpuCount] = useState(3);
  const [cpuLevel, setCpuLevel] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [deckSizeConfig, setDeckSizeConfig] = useState({ ...DEFAULT_DECK_SIZES });
  const [startingBudget, setStartingBudget] = useState(1000);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [auctionCredits, setAuctionCredits] = useState<Record<string, number>>({});
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [inviteTarget, setInviteTarget] = useState('');
  const [waitingForApproval, setWaitingForApproval] = useState(false);
  const [incomingInvite, setIncomingInvite] = useState<{ fantaId: string; creatorName: string; sessionCode: string } | null>(null);
  const [tournamentGameId, setTournamentGameId] = useState<string | null>(null);
  const [tournamentLoading, setTournamentLoading] = useState(false);
  const [mySessions, setMySessions] = useState<SessionSummary[]>([]);

  const [fantaTourney, setFantaTourney] = useState<any | null>(null);
  const [configStep, setConfigStep] = useState(1);
  const [configForm, setConfigForm] = useState({
    name: '',
    type: 'elimination' as 'elimination' | 'round_robin',
    playersPerMatch: 2,
    characterLimit: '3',
    winnerRewardMultiplier: 20,
    runnerUpRewardMultiplier: 5,
  });
  const [prizeNotification, setPrizeNotification] = useState<{ player: string; points: number; placement: number } | null>(null);
  const [activeMatchGameId, setActiveMatchGameId] = useState<string | null>(null);
  const [showDecksPanel, setShowDecksPanel] = useState(false);
  const [selectedDeckPlayer, setSelectedDeckPlayer] = useState<string>('');

  // T001: Team name/color/logo
  const [teamNameInput, setTeamNameInput] = useState('');
  const [teamColorInput, setTeamColorInput] = useState('#3b82f6');
  const [teamLogoInput, setTeamLogoInput] = useState<string>('');
  const [savingTeamInfo, setSavingTeamInfo] = useState(false);

  // Creation: public/private, invites, schedule
  const [isPublicAuction, setIsPublicAuction] = useState(true);
  const [helpEnabled, setHelpEnabled] = useState(false);
  const [createInvitedUsers, setCreateInvitedUsers] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<Array<{ username: string; displayName?: string }>>([]);
  const [scheduledStartInput, setScheduledStartInput] = useState('');
  const [canStartLobby, setCanStartLobby] = useState<{ canStart: boolean; missing: string[] }>({ canStart: true, missing: [] });

  // T002: Formation picker
  const [showFormation, setShowFormation] = useState(false);
  const [pendingMatchForFormation, setPendingMatchForFormation] = useState<any | null>(null);
  const [formationPick, setFormationPick] = useState<{ personaggioId: string | null; mossaId: string | null; bonusId: string | null }>({ personaggioId: null, mossaId: null, bonusId: null });
  const [formationDeckFilter, setFormationDeckFilter] = useState<'personaggi' | 'mosse' | 'bonus'>('personaggi');
  const [formationDeck, setFormationDeck] = useState<{ personaggi: any[]; mosse: any[]; bonus: any[] } | null>(null);
  const [formationDeckLoading, setFormationDeckLoading] = useState(false);

  // T003: Stats panel
  const [showStats, setShowStats] = useState(false);
  const [tournamentStats, setTournamentStats] = useState<Record<string, FantaPlayerStats>>({});

  // T004: Market panel
  const [showMarket, setShowMarket] = useState(false);
  const [marketListings, setMarketListings] = useState<FantaMarketListing[]>([]);
  const [marketSellCard, setMarketSellCard] = useState<{ card: any; type: 'personaggi' | 'mosse' | 'bonus' } | null>(null);
  const [marketSellPrice, setMarketSellPrice] = useState(50);
  const [marketSellDeckTab, setMarketSellDeckTab] = useState<'personaggi' | 'mosse' | 'bonus'>('personaggi');

  // Injured Personaggi disclaimer state
  const [pendingFormation, setPendingFormation] = useState<{ matchId: string; formation: { personaggioId: string; mossaId: string; bonusId: string }; personaggioBaseId: string } | null>(null);
  const [fantaUserCredits, setFantaUserCredits] = useState(0);

  const fetchSessions = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const [lobbyRes, myRes] = await Promise.all([
        fetch(playerName ? `/api/fanta/sessions?playerName=${encodeURIComponent(playerName)}` : '/api/fanta/sessions', { headers }),
        playerName ? fetch(`/api/fanta/my-sessions?playerName=${encodeURIComponent(playerName)}`, { headers }) : Promise.resolve(null),
      ]);
      if (lobbyRes.ok) setLobbySessions(await lobbyRes.json());
      if (myRes?.ok) setMySessions(await myRes.json());
    } catch {}
  }, [authToken, playerName]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  useEffect(() => {
    if (!authToken) return;
    fetch('/api/profile', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json())
      .then(data => { if (data.profile?.user?.puntiRankiard !== undefined) setFantaUserCredits(data.profile.user.puntiRankiard); })
      .catch(() => {});
  }, [authToken]);

  const handleDeleteFantaSession = async (id: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa sessione FantaMinkiards?')) return;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch(`/api/fanta/sessions/${id}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (data.success) {
        fetchSessions();
      } else {
        alert(data.error || 'Errore eliminazione sessione');
      }
    } catch {
      alert('Errore di rete');
    }
  };

  useEffect(() => {
    if (initialFantaId && playerName) {
      console.log('[FANTA] Auto-rejoining fantaId:', initialFantaId);
      setLoading(true);
      socket.emit('fanta:rejoin', { fantaId: initialFantaId, playerName });
    }
  }, [initialFantaId, playerName]);

  useEffect(() => {
    socket.on('fanta:session-created', ({ fantaId: id, session }: { fantaId: string; session: FantaSession }) => {
      setFantaId(id);
      setCurrentSession(session);
      setPendingRequests(session.pendingRequests ?? []);
      setView('lobby');
      setLoading(false);
    });

    socket.on('fanta:joined', ({ fantaId: id, session }: { fantaId: string; session: FantaSession }) => {
      setFantaId(id);
      setCurrentSession(session);
      setPendingRequests(session.pendingRequests ?? []);
      setView('lobby');
      setLoading(false);
    });

    socket.on('fanta:session-updated', ({ session }: { session: FantaSession }) => {
      setCurrentSession(session);
      setPendingRequests(session.pendingRequests ?? []);
    });

    socket.on('fanta:join-requested', ({ fantaId: id }: { fantaId: string }) => {
      setFantaId(id);
      setWaitingForApproval(true);
      setView('waiting');
      setLoading(false);
    });

    socket.on('fanta:join-request', ({ pendingRequests: reqs }: { fantaId: string; pendingRequests: PendingRequest[] }) => {
      setPendingRequests(reqs ?? []);
    });

    socket.on('fanta:join-approved', ({ fantaId: id, session }: { fantaId: string; session: FantaSession }) => {
      setFantaId(id);
      setCurrentSession(session);
      setPendingRequests(session.pendingRequests ?? []);
      setWaitingForApproval(false);
      setView('lobby');
      setLoading(false);
    });

    socket.on('fanta:join-rejected', ({ reason }: { fantaId: string; reason: string }) => {
      setWaitingForApproval(false);
      setView('list');
      setError(reason ?? 'Richiesta rifiutata');
      setLoading(false);
      setTimeout(() => setError(''), 5000);
    });

    socket.on('fanta:invite-broadcast', (data: { fantaId: string; targetName: string; creatorName: string; sessionCode: string }) => {
      if (data.targetName === playerName && view !== 'lobby' && view !== 'auction') {
        setIncomingInvite({ fantaId: data.fantaId, creatorName: data.creatorName, sessionCode: data.sessionCode });
      }
    });

    socket.on('fanta:card-up', (data: { card: any; credits: Record<string, number> }) => {
      if (data.credits) setAuctionCredits(data.credits);
      setWaitingForApproval(false);
      setView('auction');
    });

    socket.on('fanta:auction-complete', ({ decks }: { decks?: Record<string, any>; fantaId?: string }) => {
      if (decks) {
        setCurrentSession(prev => {
          if (!prev) return prev;
          const updatedParticipants = { ...prev.participants };
          for (const [name, deck] of Object.entries(decks)) {
            if (updatedParticipants[name]) {
              updatedParticipants[name] = { ...updatedParticipants[name], deck: deck as any };
            }
          }
          return { ...prev, participants: updatedParticipants };
        });
      }
      setView('complete');
    });

    socket.on('fanta:rejoined', ({ session, status }: { session: FantaSession & { tournament?: any }; status: string }) => {
      setCurrentSession(session);
      setFantaId(session.id);
      setPendingRequests(session.pendingRequests ?? []);
      setLoading(false);
      if (status === 'complete') {
        if (session.tournament) {
          setFantaTourney(session.tournament);
          setView('bracket');
        } else {
          setView('complete');
        }
      } else if (status === 'auction') {
        setView('auction');
      } else {
        setView('lobby');
      }
    });

    socket.on('fanta:tournament-ready', (data: { gameId: string; fantaId: string; participants: string[] }) => {
      setTournamentGameId(data.gameId);
      setTournamentLoading(false);
    });

    socket.on('fanta:tournament-configured', (data: { fantaId: string; tournament: any }) => {
      setFantaTourney(data.tournament);
      setTournamentLoading(false);
      setView('bracket');
    });

    socket.on('fanta:bracket-update', (data: { fantaId: string; tournament: any }) => {
      setFantaTourney(data.tournament);
    });

    socket.on('fanta:match-started', (data: { fantaId: string; matchId: string; gameId: string; players: string[] }) => {
      setActiveMatchGameId(data.gameId);
      setFantaTourney((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          matches: prev.matches.map((m: any) =>
            m.id === data.matchId ? { ...m, status: 'in_progress', gameId: data.gameId } : m
          ),
        };
      });
    });

    socket.on('fanta:prize-awarded', (data: { player: string; points: number; placement: number }) => {
      setPrizeNotification(data);
      setTimeout(() => setPrizeNotification(null), 8000);
    });

    socket.on('fanta:tournament-state', (data: { fantaId: string; tournament: any }) => {
      if (data.tournament) {
        setFantaTourney(data.tournament);
        setView('bracket');
      }
    });

    socket.on('fanta:error', (data: { message: string }) => {
      setError(data.message);
      setLoading(false);
      setTournamentLoading(false);
      setTimeout(() => setError(''), 4000);
    });

    socket.on('fanta:stats-update', (data: { fantaId: string; stats: Record<string, FantaPlayerStats> }) => {
      setTournamentStats(data.stats || {});
    });

    socket.on('fanta:market-update', (data: { market: { listings: FantaMarketListing[] } }) => {
      setMarketListings(data.market?.listings || []);
    });

    socket.on('fanta:market-sale', (data: { buyer: string; seller: string; card: any; price: number }) => {
      setError('');
    });

    socket.on('fanta:deck-data', (data: { deck: { personaggi: any[]; mosse: any[]; bonus: any[] } | null }) => {
      setFormationDeck(data.deck);
      setFormationDeckLoading(false);
    });

    socket.on('fanta:lobby-status', (data: { canStart: boolean; missing: string[] }) => {
      setCanStartLobby(data);
    });

    return () => {
      socket.off('fanta:session-created');
      socket.off('fanta:joined');
      socket.off('fanta:session-updated');
      socket.off('fanta:join-requested');
      socket.off('fanta:join-request');
      socket.off('fanta:join-approved');
      socket.off('fanta:join-rejected');
      socket.off('fanta:invite-broadcast');
      socket.off('fanta:card-up');
      socket.off('fanta:auction-complete');
      socket.off('fanta:rejoined');
      socket.off('fanta:tournament-ready');
      socket.off('fanta:tournament-configured');
      socket.off('fanta:bracket-update');
      socket.off('fanta:match-started');
      socket.off('fanta:prize-awarded');
      socket.off('fanta:tournament-state');
      socket.off('fanta:error');
      socket.off('fanta:stats-update');
      socket.off('fanta:market-update');
      socket.off('fanta:market-sale');
      socket.off('fanta:deck-data');
      socket.off('fanta:lobby-status');
    };
  }, [playerName, view]);

  const maxDeckSize = React.useMemo(() => ({
    personaggi: Math.floor(TOTAL_CARDS.personaggi / totalParticipants),
    mosse: Math.floor(TOTAL_CARDS.mosse / totalParticipants),
    bonus: Math.floor(TOTAL_CARDS.bonus / totalParticipants),
  }), [totalParticipants]);

  React.useEffect(() => {
    setDeckSizeConfig(prev => ({
      personaggi: Math.min(prev.personaggi, maxDeckSize.personaggi),
      mosse: Math.min(prev.mosse, maxDeckSize.mosse),
      bonus: Math.min(prev.bonus, maxDeckSize.bonus),
    }));
  }, [maxDeckSize]);

  // Load stats + market when entering bracket view
  useEffect(() => {
    if (view === 'bracket' && fantaId) {
      socket.emit('fanta:get-stats', { fantaId });
      socket.emit('fanta:get-market', { fantaId });
    }
  }, [view, fantaId]);

  // Sync team info input when entering lobby
  useEffect(() => {
    if (view === 'lobby' && currentSession && playerName) {
      const me = currentSession.participants[playerName];
      if (me) {
        setTeamNameInput(me.teamName || '');
        setTeamColorInput(me.teamColor || '#3b82f6');
        setTeamLogoInput(me.teamLogo || '');
      }
    }
  }, [view, currentSession, playerName]);

  // Sync stats + market from session updates
  useEffect(() => {
    if (currentSession?.tournamentStats) setTournamentStats(currentSession.tournamentStats);
    if (currentSession?.market?.listings) setMarketListings(currentSession.market.listings);
  }, [currentSession]);

  const searchUsers = useCallback(async (q: string) => {
    if (!q || q.length < 2 || !authToken) { setUserSearchResults([]); return; }
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setUserSearchResults((data.users || []).filter((u: any) => u.username !== playerName && !createInvitedUsers.includes(u.username)));
      }
    } catch { setUserSearchResults([]); }
  }, [authToken, playerName, createInvitedUsers]);

  useEffect(() => {
    const t = setTimeout(() => searchUsers(userSearchQuery), 300);
    return () => clearTimeout(t);
  }, [userSearchQuery, searchUsers]);

  useEffect(() => {
    if (currentSession && view === 'lobby') {
      const canStart = fantaManager_canStart(currentSession);
      setCanStartLobby(canStart);
    }
  }, [currentSession, view]);

  function fantaManager_canStart(sess: FantaSession): { canStart: boolean; missing: string[] } {
    if (!sess.invitedUsers || sess.invitedUsers.length === 0) return { canStart: true, missing: [] };
    const missing = sess.invitedUsers.filter(u => {
      const p = sess.participants[u];
      return !p || p.isCPU || !p.socketId;
    });
    return { canStart: missing.length === 0, missing };
  }

  const handleCreate = () => {
    if (!playerName) return;
    setLoading(true);
    const scheduledStart = scheduledStartInput ? new Date(scheduledStartInput).getTime() : undefined;
    socket.emit('fanta:create', {
      cpuCount, cpuLevel, playerName, maxParticipants: totalParticipants,
      cardsNeeded: deckSizeConfig, startingBudget,
      isPublic: isPublicAuction,
      invitedUsers: createInvitedUsers,
      scheduledStart,
      helpEnabled,
    });
    setShowCreateDialog(false);
    setCreateInvitedUsers([]);
    setUserSearchQuery('');
    setScheduledStartInput('');
  };

  const handleRequestJoin = (id: string) => {
    if (!playerName) return;
    setLoading(true);
    socket.emit('fanta:request-join', { fantaId: id, playerName });
  };

  const handleJoinByCode = () => {
    const code = joinCode.trim();
    if (!code) return;
    handleRequestJoin(code);
  };

  const handleAcceptInvite = () => {
    if (!incomingInvite) return;
    setLoading(true);
    socket.emit('fanta:request-join', { fantaId: incomingInvite.fantaId, playerName });
    setIncomingInvite(null);
  };

  const handleStartAuction = () => {
    socket.emit('fanta:start-auction', { fantaId, playerName });
  };

  const handleApprove = (name: string) => {
    socket.emit('fanta:approve-target', { fantaId, approvedName: name, creatorName: playerName });
    setPendingRequests(prev => prev.filter(r => r.name !== name));
  };

  const handleReject = (name: string) => {
    socket.emit('fanta:reject-target', { fantaId, rejectedName: name, creatorName: playerName });
    setPendingRequests(prev => prev.filter(r => r.name !== name));
  };

  const handleInvite = () => {
    if (!inviteTarget.trim()) return;
    socket.emit('fanta:invite', { fantaId, creatorName: playerName, targetName: inviteTarget.trim() });
    setInviteTarget('');
  };

  const handleLeave = () => {
    socket.emit('fanta:leave', { fantaId, playerName });
    setCurrentSession(null);
    setFantaId('');
    setPendingRequests([]);
    setWaitingForApproval(false);
    setView('list');
    fetchSessions();
  };

  const isCreator = currentSession?.creatorName === playerName;
  const participants = currentSession ? Object.values(currentSession.participants) : [];
  const humanSlots = totalParticipants - 1 - cpuCount;
  const currentHumanCount = currentSession ? Object.values(currentSession.participants).filter(p => !p.isCPU).length : 0;
  const availableHumanSlots = currentSession ? (currentSession.maxParticipants - currentHumanCount) : 0;

  if (view === 'auction' && fantaId) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-950 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-yellow-400">⭐ FantaMinkiards</span>
            <span className="text-xs text-white/40">Asta in corso</span>
          </div>
          <div className="text-[10px] text-white/30 font-mono">#{fantaId.slice(-6)}</div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <FantaAuctionRoom
            fantaId={fantaId}
            playerName={playerName}
            isCreator={isCreator}
            participants={Object.keys(currentSession?.participants ?? {})}
            initialCredits={auctionCredits}
            cardsNeeded={currentSession?.cardsNeeded}
            onComplete={() => setView('complete')}
          />
        </div>
      </div>
    );
  }

  if (view === 'complete') {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="text-3xl font-bold text-yellow-400 mb-1">Asta Completata!</h2>
            <p className="text-white/60 text-sm">I mazzi sono pronti. È ora di giocare!</p>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-4 py-2 text-sm mb-4 text-center">
              ⚠️ {error}
            </div>
          )}

          <div className="space-y-2 mb-6">
            {participants.map(p => (
              <div key={p.name} className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-2.5">
                <span className="font-bold text-white text-sm flex-1">{p.name}{p.isCPU ? ' 🤖' : ''}</span>
                <span className="text-gray-400 text-xs">{p.deck.personaggi.length}P · {p.deck.mosse.length}M · {p.deck.bonus.length}B</span>
                <span className="text-yellow-300 text-sm font-black tabular-nums">{p.credits} cr</span>
              </div>
            ))}
          </div>

          {/* Tournament launch section */}
          {fantaTourney ? (
            <div className="space-y-3">
              <div className="bg-purple-900/40 border border-purple-600 rounded-xl p-4 text-center">
                <div className="text-purple-300 font-bold text-sm mb-1">🏆 Torneo configurato!</div>
                <div className="text-white/60 text-xs">{fantaTourney.config?.name}</div>
              </div>
              <Button
                onClick={() => setView('bracket')}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 text-lg rounded-xl"
              >
                📊 Vai al tabellone
              </Button>
            </div>
          ) : !tournamentGameId ? (
            <div className="space-y-3">
              {isCreator ? (
                <Button
                  onClick={() => {
                    setConfigStep(1);
                    setConfigForm({ name: `FantaTorneo #${fantaId.slice(-4).toUpperCase()}`, type: 'elimination', playersPerMatch: 2, characterLimit: '3' });
                    setView('configure');
                  }}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 text-lg rounded-xl shadow-lg shadow-yellow-500/20"
                >
                  🏆 Configura Torneo
                </Button>
              ) : (
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                  <div className="text-white/60 text-sm animate-pulse">
                    ⏳ In attesa che il creatore configuri il torneo...
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                onClick={onClose}
                className="w-full border-gray-600 text-white/60 py-2"
              >
                Torna alla home (senza giocare)
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-green-900/40 border border-green-600 rounded-xl p-4 text-center">
                <div className="text-green-300 font-bold text-sm mb-1">✅ Stanza pronta!</div>
                <div className="text-white/60 text-xs mb-2">Codice stanza:</div>
                <div className="font-mono text-white font-bold text-lg bg-gray-900 rounded-lg px-4 py-2 select-all">
                  {tournamentGameId}
                </div>
              </div>
              <Button
                onClick={() => onJoinFantaGame?.(tournamentGameId)}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 text-lg rounded-xl shadow-lg shadow-green-600/20"
              >
                🎮 Entra nella partita
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="w-full border-gray-600 text-white/60 py-2"
              >
                Torna alla home
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'configure') {
    const isCampionato = configForm.type === 'round_robin';
    const STEPS = ['Tipo', 'Formato', 'Conferma'];
    const canProceed = () => {
      if (configStep === 1) return true;
      if (configStep === 2) return configForm.playersPerMatch >= 2;
      return true;
    };
    const handleConfirm = () => {
      setTournamentLoading(true);
      socket.emit('fanta:configure-tournament', { fantaId, playerName, config: configForm });
    };
    const labelSt: React.CSSProperties = { color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 };
    const inputSt: React.CSSProperties = { width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const };
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)', border: '1px solid #334155', borderRadius: 20, width: 520, maxWidth: '95vw', maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>🏆</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 17 }}>Configura il Torneo Fanta</div>
              <div style={{ color: '#f59e0b', fontSize: 11 }}>Mazzi dall'asta · {isCampionato ? 'Girone all\'italiana' : 'Eliminazione diretta'}</div>
            </div>
            <button onClick={() => setView('complete')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 20 }}>✕</button>
          </div>
          <div style={{ display: 'flex', padding: '12px 24px', gap: 8 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: i + 1 < configStep ? '#7c3aed' : i + 1 === configStep ? '#a78bfa' : '#1e293b', border: `2px solid ${i + 1 === configStep ? '#a78bfa' : '#334155'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: i + 1 <= configStep ? 'white' : '#64748b', fontSize: 12, fontWeight: 700 }}>
                  {i + 1 < configStep ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: 10, color: i + 1 === configStep ? '#a78bfa' : '#64748b', textAlign: 'center' }}>{s}</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 24px' }}>
            {configStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 8 }}>
                  {[
                    { type: 'elimination', label: 'Torneo Fanta', icon: '🏆', desc: 'Eliminazione diretta. Chi perde è fuori.', color: '#f59e0b' },
                    { type: 'round_robin', label: 'Campionato Fanta', icon: '📅', desc: 'Tutti contro tutti, classifica finale.', color: '#3b82f6' },
                  ].map(opt => (
                    <button key={opt.type} onClick={() => setConfigForm(f => ({ ...f, type: opt.type as any }))}
                      style={{ background: configForm.type === opt.type ? `${opt.color}22` : '#1e293b', border: `1px solid ${configForm.type === opt.type ? opt.color : '#334155'}`, borderRadius: 14, padding: '18px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
                      <div style={{ fontSize: 28 }}>{opt.icon}</div>
                      <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>{opt.label}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.4 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <div>
                  <div style={labelSt}>Nome Torneo</div>
                  <input value={configForm.name} onChange={e => setConfigForm(f => ({ ...f, name: e.target.value }))} style={inputSt} placeholder="Es. FantaTorneo Estate 2025" />
                </div>
              </div>
            )}
            {configStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                {!isCampionato && (
                  <div>
                    <div style={labelSt}>Giocatori per Partita</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                      {[2, 3, 4].map(n => (
                        <button key={n} onClick={() => setConfigForm(f => ({ ...f, playersPerMatch: n }))}
                          style={{ background: configForm.playersPerMatch === n ? '#7c3aed' : '#1e293b', border: `1px solid ${configForm.playersPerMatch === n ? '#7c3aed' : '#334155'}`, borderRadius: 8, color: configForm.playersPerMatch === n ? 'white' : '#94a3b8', padding: '8px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
                      Ogni partita del bracket avrà <span style={{ color: '#a78bfa', fontWeight: 700 }}>{configForm.playersPerMatch} partecipanti</span>
                    </div>
                  </div>
                )}
                {isCampionato && (
                  <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ color: '#64748b', fontSize: 13 }}>📅 <strong style={{ color: '#94a3b8' }}>Campionato:</strong> Ogni partita è 1 vs 1. Tutti giocano contro tutti.</div>
                  </div>
                )}
                <div>
                  <div style={labelSt}>Personaggi prima dell'eliminazione</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                    {(['1', '2', '3', '5', 'unlimited'] as const).map(v => (
                      <button key={v} onClick={() => setConfigForm(f => ({ ...f, characterLimit: v }))}
                        style={{ background: configForm.characterLimit === v ? '#0ea5e9' : '#1e293b', border: `1px solid ${configForm.characterLimit === v ? '#0ea5e9' : '#334155'}`, borderRadius: 8, color: configForm.characterLimit === v ? 'white' : '#94a3b8', padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 14, minWidth: 42, textAlign: 'center' as const }}>
                        {v === 'unlimited' ? '∞' : v}
                      </button>
                    ))}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
                    Un concorrente viene eliminato dopo la morte di <span style={{ color: '#38bdf8', fontWeight: 700 }}>{configForm.characterLimit === 'unlimited' ? 'tutti i' : configForm.characterLimit}</span> personagg{configForm.characterLimit === '1' ? 'io' : 'i'}
                  </div>
                </div>
              </div>
            )}
            {configStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 20 }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16, marginBottom: 14 }}>{configForm.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      ['Tipo', configForm.type === 'round_robin' ? 'Campionato' : 'Torneo'],
                      ['Per Partita', isCampionato ? '1 vs 1' : `${configForm.playersPerMatch} giocatori`],
                      ['Limite personaggi', configForm.characterLimit === 'unlimited' ? '∞' : configForm.characterLimit],
                      ['Partecipanti', `${participants.length} attivi`],
                    ].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #334155' }}>
                        <span style={{ color: '#64748b', fontSize: 13 }}>{l}</span>
                        <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {isAdmin && (
                  <div style={{ background: '#1e3a5f', border: '1px solid #2563eb', borderRadius: 12, padding: 16, marginTop: 8 }}>
                    <div style={{ color: '#93c5fd', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>⚙️ Premi Rankiard (Solo Admin)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Moltiplicatore Vincitore (×N × partecipanti)</label>
                        <input
                          type="number" min={1} max={100}
                          value={configForm.winnerRewardMultiplier}
                          onChange={e => setConfigForm(f => ({ ...f, winnerRewardMultiplier: Math.max(1, parseInt(e.target.value) || 1) }))}
                          style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', padding: '8px 12px', width: '100%', fontSize: 15, fontWeight: 700 }}
                        />
                      </div>
                      <div>
                        <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Moltiplicatore Runner-Up (×N × partecipanti)</label>
                        <input
                          type="number" min={0} max={100}
                          value={configForm.runnerUpRewardMultiplier}
                          onChange={e => setConfigForm(f => ({ ...f, runnerUpRewardMultiplier: Math.max(0, parseInt(e.target.value) || 0) }))}
                          style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', padding: '8px 12px', width: '100%', fontSize: 15, fontWeight: 700 }}
                        />
                      </div>
                    </div>
                    <div style={{ color: '#64748b', fontSize: 11, marginTop: 8 }}>
                      Con {participants.length} partecipanti: vincitore +{configForm.winnerRewardMultiplier * participants.length} pt, runner-up +{configForm.runnerUpRewardMultiplier * participants.length} pt
                    </div>
                  </div>
                )}
                {error && <div style={{ background: '#7f1d1d', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13 }}>{error}</div>}
              </div>
            )}
          </div>
          <div style={{ padding: '16px 24px', borderTop: '1px solid #1e293b', display: 'flex', gap: 12 }}>
            {configStep > 1 && (
              <button onClick={() => setConfigStep(s => s - 1)} style={{ flex: 1, padding: '12px 0', background: '#1e293b', border: '1px solid #334155', borderRadius: 12, color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>
                ← Indietro
              </button>
            )}
            {configStep < 3 ? (
              <button onClick={() => canProceed() && setConfigStep(s => s + 1)} disabled={!canProceed()}
                style={{ flex: 2, padding: '12px 0', background: canProceed() ? '#7c3aed' : '#334155', border: 'none', borderRadius: 12, color: 'white', cursor: canProceed() ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 15 }}>
                Avanti →
              </button>
            ) : (
              <button onClick={handleConfirm} disabled={tournamentLoading}
                style={{ flex: 2, padding: '12px 0', background: tournamentLoading ? '#334155' : '#f59e0b', border: 'none', borderRadius: 12, color: tournamentLoading ? '#94a3b8' : '#000', cursor: tournamentLoading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 15 }}>
                {tournamentLoading ? '⏳ Avvio...' : '🏆 Avvia Torneo'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'bracket' && fantaTourney) {
    const isCampionato = fantaTourney.config?.type === 'round_robin';
    const currentRound = fantaTourney.currentRound || 1;
    const allMatches: any[] = fantaTourney.matches || [];
    const maxRound = allMatches.length > 0 ? Math.max(...allMatches.map((m: any) => m.round)) : 1;

    const roundLabels: Record<number, string> = {};
    if (!isCampionato) {
      if (maxRound >= 1) roundLabels[maxRound] = 'Finale';
      if (maxRound >= 2) roundLabels[maxRound - 1] = 'Semifinale';
      if (maxRound >= 3) roundLabels[maxRound - 2] = 'Quarti';
    }

    const wins: Record<string, number> = {};
    if (isCampionato) {
      for (const m of allMatches) {
        if (m.winnerId) wins[m.winnerId] = (wins[m.winnerId] || 0) + 1;
      }
    }

    const rounds: any[][] = [];
    for (let r = 1; r <= maxRound; r++) {
      rounds.push(allMatches.filter((m: any) => m.round === r).sort((a: any, b: any) => a.matchNumber - b.matchNumber));
    }

    const statusColor = (s: string) => s === 'completed' ? '#22c55e' : s === 'in_progress' ? '#3b82f6' : '#64748b';
    const statusLabel = (s: string) => s === 'completed' ? 'Completato' : s === 'in_progress' ? 'In corso' : 'In attesa';

    const canPlay = (match: any) => {
      if (match.status === 'completed') return false;
      return match.players.includes(playerName) || isCreator;
    };

    const handleJoinMatch = (match: any) => {
      if (match.gameId && match.status === 'in_progress') {
        onJoinFantaGame?.(match.gameId);
        return;
      }
      // Show formation picker if this player is a match participant (not just admin)
      if (match.players.includes(playerName)) {
        setPendingMatchForFormation(match);
        setFormationPick({ personaggioId: null, mossaId: null, bonusId: null });
        setFormationDeckFilter('personaggi');
        setFormationDeck(null);
        setFormationDeckLoading(true);
        setShowFormation(true);
        socket.emit('fanta:get-deck', { fantaId, playerName });
      } else {
        socket.emit('fanta:start-fanta-match', { fantaId, playerName, matchId: match.id });
      }
    };

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0f172a', zIndex: 50, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
        {prizeNotification && (
          <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: '#854d0e', border: '2px solid #f59e0b', borderRadius: 16, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 32px #f59e0b44' }}>
            <span style={{ fontSize: 24 }}>{prizeNotification.placement === 1 ? '🏆' : '🥈'}</span>
            <div>
              <div style={{ color: '#fde68a', fontWeight: 700, fontSize: 15 }}>{prizeNotification.player} riceve {prizeNotification.points} Rankiard!</div>
              <div style={{ color: '#fbbf24', fontSize: 12 }}>{prizeNotification.placement === 1 ? 'Vincitore del torneo' : 'Runner-up del torneo'}</div>
            </div>
          </div>
        )}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 8, background: '#0f172a', flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={() => setView('complete')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 20, padding: 4, flexShrink: 0 }}>←</button>
          <div style={{ flex: 1, minWidth: 100 }}>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>🏆 {fantaTourney.config?.name || 'FantaTorneo'}</div>
            <div style={{ color: '#f59e0b', fontSize: 10 }}>{isCampionato ? 'Campionato' : 'Torneo'} Fanta</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => { setSelectedDeckPlayer(participants[0]?.name || ''); setShowDecksPanel(true); }}
              style={{ background: '#1e3a5f', border: '1px solid #2563eb', borderRadius: 8, color: '#93c5fd', padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >🃏 Mazzi</button>
            <button
              onClick={() => { setShowStats(true); socket.emit('fanta:get-stats', { fantaId }); }}
              style={{ background: '#14532d', border: '1px solid #16a34a', borderRadius: 8, color: '#4ade80', padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >📊 Stats</button>
            <button
              onClick={() => { setShowMarket(true); socket.emit('fanta:get-market', { fantaId }); }}
              style={{ background: '#4c1d95', border: '1px solid #7c3aed', borderRadius: 8, color: '#c4b5fd', padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >🛒 Mercato</button>
          </div>
          {fantaTourney.status === 'completed' && fantaTourney.winnerId && (
            <div style={{ background: '#854d0e', border: '1px solid #d97706', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#fde68a', fontWeight: 700, flexShrink: 0 }}>
              👑 {fantaTourney.winnerId}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
          {/* Standings (round_robin) */}
          {isCampionato && (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 16, marginBottom: 20, maxWidth: 600, margin: '0 auto 20px' }}>
              <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Classifica</div>
              {Object.entries(wins).sort(([, a], [, b]) => b - a).map(([name, w], i) => {
                const pp = currentSession?.participants?.[name];
                const tColor = pp?.teamColor;
                const tName = pp?.teamName || name;
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #334155' }}>
                    <span style={{ color: i === 0 ? '#f59e0b' : '#64748b', fontWeight: 700, fontSize: 14, width: 20 }}>{i + 1}.</span>
                    {tColor && <div style={{ width: 18, height: 18, borderRadius: 4, background: tColor, flexShrink: 0 }} />}
                    <div style={{ flex: 1 }}>
                      <span style={{ color: '#f1f5f9', fontWeight: name === playerName ? 700 : 400 }}>{tName}{name === playerName ? ' (tu)' : ''}</span>
                      {pp?.teamName && pp.teamName !== name && <div style={{ color: '#64748b', fontSize: 10 }}>{name}</div>}
                    </div>
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>{w} V</span>
                    <span style={{ color: '#64748b', fontSize: 12 }}>{allMatches.filter((m: any) => m.status === 'completed' && m.players.includes(name) && m.winnerId !== name).length} S</span>
                  </div>
                );
              })}
              {Object.keys(wins).length === 0 && (
                <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>Nessuna partita ancora giocata</div>
              )}
            </div>
          )}

          {/* Bracket / Match list */}
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
            {isCampionato ? (
              <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {allMatches.map((match: any) => {
                  const getTeamDisplay = (name: string) => {
                    const pp = currentSession?.participants?.[name];
                    return pp?.teamName || name;
                  };
                  const winnerDisplay = match.winnerId ? getTeamDisplay(match.winnerId) : null;
                  return (
                  <div key={match.id} style={{ background: '#1e293b', border: `1px solid ${statusColor(match.status)}44`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14 }}>
                        {match.players.map(getTeamDisplay).join(' vs ')}
                      </div>
                      {match.winnerId && <div style={{ color: '#22c55e', fontSize: 12, marginTop: 2 }}>Vincitore: {winnerDisplay}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{ background: statusColor(match.status) + '22', color: statusColor(match.status), border: `1px solid ${statusColor(match.status)}44`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                        {statusLabel(match.status)}
                      </span>
                      {canPlay(match) && (
                        <button onClick={() => handleJoinMatch(match)}
                          style={{ background: match.status === 'in_progress' ? '#16a34a' : '#7c3aed', border: 'none', borderRadius: 8, color: 'white', padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          {match.status === 'in_progress' ? '▶ Riprendi' : '🎮 Gioca'}
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', minWidth: 'max-content', padding: '0 4px' }}>
                {rounds.map((roundMatches, ri) => {
                  const round = ri + 1;
                  const label = roundLabels[round] || `Round ${round}`;
                  return (
                    <div key={round} style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 220 }}>
                      <div style={{ textAlign: 'center', padding: '6px 12px', background: round === currentRound ? '#7c3aed22' : '#1e293b', border: `1px solid ${round === currentRound ? '#7c3aed' : '#334155'}`, borderRadius: 8, color: round === currentRound ? '#a78bfa' : '#64748b', fontWeight: 700, fontSize: 13 }}>
                        {label}
                      </div>
                      {roundMatches.map((match: any) => (
                        <div key={match.id} style={{ background: '#1e293b', border: `1px solid ${statusColor(match.status)}55`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {match.players.map((p: string) => {
                            const pp = currentSession?.participants?.[p];
                            const pName = pp?.teamName || p;
                            return (
                              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: match.winnerId === p ? '#14532d' : '#0f172a', border: `1px solid ${match.winnerId === p ? '#16a34a' : '#334155'}`, borderRadius: 8 }}>
                                <div style={{ width: 22, height: 22, borderRadius: 5, background: pp?.teamColor || 'transparent', border: pp?.teamColor ? 'none' : '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{p === playerName ? '👤' : '🧑'}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ color: '#f1f5f9', fontWeight: p === playerName ? 700 : 400, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pName}{p === playerName ? ' (tu)' : ''}</div>
                                  {pp?.teamName && pp.teamName !== p && <div style={{ color: '#64748b', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</div>}
                                </div>
                                {match.winnerId === p && <span style={{ color: '#22c55e', fontSize: 12 }}>👑</span>}
                              </div>
                            );
                          })}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ background: statusColor(match.status) + '22', color: statusColor(match.status), border: `1px solid ${statusColor(match.status)}44`, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                              {statusLabel(match.status)}
                            </span>
                            {canPlay(match) && (
                              <button onClick={() => handleJoinMatch(match)}
                                style={{ background: match.status === 'in_progress' ? '#16a34a' : '#7c3aed', border: 'none', borderRadius: 8, color: 'white', padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                {match.status === 'in_progress' ? '▶ Riprendi' : '🎮 Gioca'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {fantaTourney.status === 'completed' && (
            <div style={{ textAlign: 'center', marginTop: 24, padding: 24, background: '#1e293b', border: '1px solid #f59e0b44', borderRadius: 16, maxWidth: 400, margin: '24px auto 0' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
              <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 18 }}>Torneo Concluso!</div>
              <div style={{ color: '#f1f5f9', marginTop: 8, fontSize: 15 }}>Vincitore: <strong>{fantaTourney.winnerId}</strong></div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ margin: '0 12px 12px', background: '#7f1d1d', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, textAlign: 'center' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Deck viewer overlay */}
        {showDecksPanel && (() => {
          const rarityColor: Record<string, string> = { comune: '#64748b', rara: '#3b82f6', epica: '#7c3aed', leggendaria: '#f59e0b' };
          const rarityLabel: Record<string, string> = { comune: 'C', rara: 'R', epica: 'E', leggendaria: 'L' };
          const typeColor: Record<string, string> = { personaggi: '#3b82f6', mosse: '#f97316', bonus: '#22c55e' };
          const selectedP = participants.find(p => p.name === selectedDeckPlayer) || participants[0];
          if (!selectedP) return null;
          const deck = selectedP.deck as any;
          const sections: Array<{ key: 'personaggi' | 'mosse' | 'bonus'; label: string; icon: string }> = [
            { key: 'personaggi', label: 'Personaggi', icon: '⚔️' },
            { key: 'mosse', label: 'Mosse', icon: '💥' },
            { key: 'bonus', label: 'Bonus', icon: '✨' },
          ];
          return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
              {/* Header */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e293b', background: 'linear-gradient(90deg, #0f172a, #1e1b4b)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span style={{ fontSize: 22 }}>🃏</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16 }}>Mazzi dei Partecipanti</div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>{fantaTourney?.config?.name || 'FantaTorneo'}</div>
                </div>
                <button onClick={() => setShowDecksPanel(false)} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>✕ Chiudi</button>
              </div>

              {/* Participant tabs */}
              <div style={{ display: 'flex', gap: 8, padding: '10px 14px', overflowX: 'auto', flexShrink: 0, background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
                {participants.map(p => {
                  const isSelected = p.name === (selectedP?.name);
                  const deckTotal = (p.deck?.personaggi?.length || 0) + (p.deck?.mosse?.length || 0) + (p.deck?.bonus?.length || 0);
                  return (
                    <button key={p.name} onClick={() => setSelectedDeckPlayer(p.name)}
                      style={{ flexShrink: 0, background: isSelected ? 'linear-gradient(135deg, #1e3a5f, #1e1b4b)' : '#1e293b', border: `1px solid ${isSelected ? '#2563eb' : '#334155'}`, borderRadius: 10, padding: '8px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 80 }}>
                      <span style={{ fontSize: 18 }}>{p.isCPU ? '🤖' : '👤'}</span>
                      <span style={{ color: isSelected ? '#93c5fd' : '#94a3b8', fontWeight: isSelected ? 700 : 400, fontSize: 12, whiteSpace: 'nowrap', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                      <span style={{ color: '#64748b', fontSize: 10 }}>{deckTotal} carte · {p.credits} cr</span>
                    </button>
                  );
                })}
              </div>

              {/* Selected participant info bar */}
              <div style={{ padding: '10px 16px', background: '#0f172a', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, borderBottom: '1px solid #1e293b22' }}>
                <span style={{ fontSize: 24 }}>{selectedP.isCPU ? '🤖' : '👤'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>{selectedP.name}</div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    {(selectedP.deck?.personaggi?.length || 0)}P · {(selectedP.deck?.mosse?.length || 0)}M · {(selectedP.deck?.bonus?.length || 0)}B
                  </div>
                </div>
                <div style={{ background: '#854d0e22', border: '1px solid #d97706', borderRadius: 10, padding: '4px 12px', color: '#fbbf24', fontWeight: 700, fontSize: 13 }}>
                  💰 {selectedP.credits} cr rimasti
                </div>
              </div>

              {/* Cards */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {sections.map(({ key, label, icon }) => {
                  const cards: any[] = deck[key] || [];
                  if (cards.length === 0) return null;
                  return (
                    <div key={key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 16 }}>{icon}</span>
                        <span style={{ color: typeColor[key], fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
                        <span style={{ background: typeColor[key] + '22', color: typeColor[key], border: `1px solid ${typeColor[key]}44`, borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{cards.length}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                        {cards.map((card: any, ci: number) => (
                          <div key={card.id || ci} style={{ background: 'linear-gradient(160deg, #1e293b, #0f172a)', border: `1px solid ${rarityColor[card.rarity] || '#334155'}44`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {/* Card image */}
                            <div style={{ position: 'relative', aspectRatio: '3/4', background: '#0f172a', overflow: 'hidden' }}>
                              {card.frontImage ? (
                                <img src={card.frontImage} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 28 }}>🃏</div>
                              )}
                              {/* Rarity badge */}
                              <div style={{ position: 'absolute', top: 6, right: 6, background: rarityColor[card.rarity] || '#334155', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 800, color: 'white', letterSpacing: 0.3 }}>
                                {rarityLabel[card.rarity] || '?'}
                              </div>
                              {/* Auction price badge */}
                              {card.auctionPrice != null && (
                                <div style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(0,0,0,0.75)', border: '1px solid #f59e0b88', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, color: '#fbbf24', backdropFilter: 'blur(4px)' }}>
                                  💰 {card.auctionPrice} cr
                                </div>
                              )}
                            </div>
                            {/* Card info */}
                            <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 12, lineHeight: 1.3 }}>{card.name}</div>
                              {key === 'personaggi' && (card.pti != null || card.stars != null) && (
                                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                                  {card.pti != null && (
                                    <span style={{ color: '#38bdf8', fontSize: 11, fontWeight: 700 }}>⚡ {card.pti} PTI</span>
                                  )}
                                  {card.stars != null && (
                                    <span style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700 }}>{'⭐'.repeat(Math.min(card.stars, 5))}</span>
                                  )}
                                </div>
                              )}
                              {(key === 'mosse' || key === 'bonus') && card.effect && (
                                <div style={{ color: '#94a3b8', fontSize: 10, lineHeight: 1.4, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>
                                  {card.effect}
                                </div>
                              )}
                              {card.auctionPrice == null && (
                                <div style={{ color: '#334155', fontSize: 10, fontStyle: 'italic', marginTop: 2 }}>Prezzo non disponibile</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Formation Picker Overlay ── */}
        {showFormation && pendingMatchForFormation && (() => {
          const myDeck = formationDeck;
          const tabDefs: Array<{ key: 'personaggi' | 'mosse' | 'bonus'; label: string; icon: string; color: string; glow: string; selectedId: string | null; setId: (id: string | null) => void }> = [
            { key: 'personaggi', label: 'Personaggio', icon: '⚔️', color: '#3b82f6', glow: '#3b82f688', selectedId: formationPick.personaggioId, setId: (id) => setFormationPick(p => ({ ...p, personaggioId: id })) },
            { key: 'mosse', label: 'Mossa', icon: '💥', color: '#f97316', glow: '#f9731688', selectedId: formationPick.mossaId, setId: (id) => setFormationPick(p => ({ ...p, mossaId: id })) },
            { key: 'bonus', label: 'Bonus', icon: '✨', color: '#22c55e', glow: '#22c55e88', selectedId: formationPick.bonusId, setId: (id) => setFormationPick(p => ({ ...p, bonusId: id })) },
          ];
          const currentTabDef = tabDefs.find(t => t.key === formationDeckFilter)!;
          const cards: any[] = myDeck?.[formationDeckFilter] || [];
          const allPicked = formationPick.personaggioId && formationPick.mossaId && formationPick.bonusId;
          const pickedCount = [formationPick.personaggioId, formationPick.mossaId, formationPick.bonusId].filter(Boolean).length;
          return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'linear-gradient(160deg, #0a0a1a 0%, #0f0a1e 40%, #0a1a0f 100%)', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
              {/* Animated background orbs */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, #7c3aed22 0%, transparent 70%)', animation: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-5%', right: '-5%', width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, #f9731622 0%, transparent 70%)' }} />
                <div style={{ position: 'absolute', top: '40%', right: '10%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, #22c55e11 0%, transparent 70%)' }} />
              </div>

              {/* Header */}
              <div style={{ position: 'relative', zIndex: 1, padding: '14px 18px', borderBottom: '1px solid #ffffff15', background: 'linear-gradient(90deg, #1e1b4bcc, #0f172acc)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 0 16px #7c3aed66', flexShrink: 0 }}>📋</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 17, letterSpacing: 0.3 }}>Schieramento Iniziale</div>
                  <div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 500 }}>Scegli le 3 carte da giocare in apertura</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: 'linear-gradient(135deg, #7c3aed33, #4f46e533)', border: '1px solid #7c3aed44', borderRadius: 20, padding: '4px 12px', color: '#a78bfa', fontSize: 12, fontWeight: 700 }}>{pickedCount}/3 carte</div>
                  <button onClick={() => { setShowFormation(false); setPendingMatchForFormation(null); setFormationDeck(null); }} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>✕</button>
                </div>
              </div>

              {/* Explanation banner */}
              <div style={{ position: 'relative', zIndex: 1, background: 'linear-gradient(90deg, #1e1b4b88, #0f172a88)', backdropFilter: 'blur(6px)', borderBottom: '1px solid #ffffff10', padding: '10px 18px', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>💡</span>
                  <div>
                    <div style={{ color: '#fde68a', fontWeight: 700, fontSize: 12, marginBottom: 2 }}>Come funziona la Formazione?</div>
                    <div style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.5 }}>
                      Scegli <span style={{ color: '#60a5fa', fontWeight: 700 }}>1 Personaggio</span>, <span style={{ color: '#fb923c', fontWeight: 700 }}>1 Mossa</span> e <span style={{ color: '#4ade80', fontWeight: 700 }}>1 Bonus</span> che vuoi avere sicuramente nella mano di partenza. Le 3 carte scelte verranno distribuite all'inizio della partita insieme alle altre — è la tua mossa tattica prima ancora di cominciare!
                    </div>
                  </div>
                </div>
              </div>

              {/* Tab selector */}
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 0, background: '#00000040', borderBottom: '1px solid #ffffff10', flexShrink: 0 }}>
                {tabDefs.map(tab => {
                  const isPicked = tab.selectedId != null;
                  const isActive = tab.key === formationDeckFilter;
                  return (
                    <button key={tab.key} onClick={() => setFormationDeckFilter(tab.key)}
                      style={{ flex: 1, padding: '12px 6px', background: isActive ? tab.color + '25' : 'transparent', border: 'none', borderBottom: `3px solid ${isActive ? tab.color : 'transparent'}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.15s', position: 'relative' }}>
                      {isPicked && <div style={{ position: 'absolute', top: 6, right: 'calc(50% - 22px)', width: 8, height: 8, borderRadius: '50%', background: tab.color, boxShadow: `0 0 6px ${tab.color}` }} />}
                      <span style={{ fontSize: 20, filter: isPicked ? `drop-shadow(0 0 6px ${tab.color})` : 'none' }}>{isPicked ? '✅' : tab.icon}</span>
                      <span style={{ color: isActive ? tab.color : (isPicked ? tab.color + 'cc' : '#64748b'), fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tab.label}</span>
                      {myDeck && <span style={{ color: isActive ? tab.color + 'aa' : '#334155', fontSize: 10 }}>{(myDeck[tab.key] || []).length} carte</span>}
                    </button>
                  );
                })}
              </div>

              {/* Card grid */}
              <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', padding: '14px 14px 8px' }}>
                {formationDeckLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
                    <div style={{ width: 40, height: 40, border: '3px solid #7c3aed44', borderTop: '3px solid #7c3aed', borderRadius: '50%' }} />
                    <div style={{ color: '#64748b', fontSize: 13 }}>Caricamento mazzo...</div>
                  </div>
                )}
                {!formationDeckLoading && cards.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10 }}>
                    <span style={{ fontSize: 36 }}>📭</span>
                    <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center' }}>Nessuna carta di tipo <strong style={{ color: '#94a3b8' }}>{formationDeckFilter}</strong> nel mazzo</div>
                  </div>
                )}
                {!formationDeckLoading && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                    {cards.map((card: any) => {
                      const isSelected = currentTabDef.selectedId === card.id;
                      return (
                        <button key={card.id} onClick={() => currentTabDef.setId(isSelected ? null : card.id)}
                          style={{ background: isSelected ? `linear-gradient(145deg, ${currentTabDef.color}33, ${currentTabDef.color}11)` : 'linear-gradient(145deg, #1e293b, #0f172a)', border: `2px solid ${isSelected ? currentTabDef.color : '#334155'}`, borderRadius: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', textAlign: 'left', boxShadow: isSelected ? `0 0 16px ${currentTabDef.glow}, inset 0 0 16px ${currentTabDef.color}22` : '0 2px 8px #00000044', transform: isSelected ? 'scale(1.04)' : 'scale(1)', transition: 'all 0.15s' }}>
                          <div style={{ position: 'relative', aspectRatio: '3/4', background: '#0a0a1a', width: '100%', overflow: 'hidden' }}>
                            {card.frontImage
                              ? <img src={card.frontImage} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isSelected ? `brightness(1.15) saturate(1.3)` : 'brightness(0.9)' }} loading="lazy" />
                              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 32 }}>🃏</div>
                            }
                            {isSelected && (
                              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${currentTabDef.color}33, transparent)`, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 6 }}>
                                <div style={{ background: currentTabDef.color, borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, boxShadow: `0 0 10px ${currentTabDef.glow}` }}>✓</div>
                              </div>
                            )}
                          </div>
                          <div style={{ padding: '6px 8px', background: isSelected ? currentTabDef.color + '22' : 'transparent' }}>
                            <div style={{ color: isSelected ? '#fff' : '#cbd5e1', fontWeight: 700, fontSize: 10, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</div>
                            {formationDeckFilter === 'personaggi' && card.pti != null && <div style={{ color: '#38bdf8', fontSize: 9, marginTop: 1, fontWeight: 600 }}>⚡ {card.pti} PTI</div>}
                            {formationDeckFilter === 'mosse' && card.stars != null && <div style={{ color: '#fbbf24', fontSize: 9, marginTop: 1 }}>{'★'.repeat(Math.min(card.stars, 5))}</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom: selected summary + action buttons */}
              <div style={{ position: 'relative', zIndex: 1, padding: '12px 16px', background: 'linear-gradient(0deg, #0a0a1a, #0f172a88)', backdropFilter: 'blur(10px)', borderTop: '1px solid #ffffff10', flexShrink: 0 }}>
                {/* Selection summary */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {tabDefs.map(tab => {
                    const card = tab.selectedId ? (myDeck?.[tab.key] as any[] || []).find((c: any) => c.id === tab.selectedId) : null;
                    return (
                      <div key={tab.key} style={{ flex: 1, background: card ? `linear-gradient(135deg, ${tab.color}22, ${tab.color}11)` : '#1e293b', border: `1px solid ${card ? tab.color + '66' : '#334155'}`, borderRadius: 10, padding: '8px 10px', minHeight: 50, display: 'flex', flexDirection: 'column', gap: 3, transition: 'all 0.2s', boxShadow: card ? `0 0 12px ${tab.color}33` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 12 }}>{tab.icon}</span>
                          <span style={{ color: tab.color, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tab.label}</span>
                        </div>
                        {card ? (
                          <div style={{ color: '#f1f5f9', fontSize: 10, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</div>
                        ) : (
                          <div style={{ color: '#475569', fontSize: 10 }}>Non selezionato</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { socket.emit('fanta:start-fanta-match', { fantaId, playerName, matchId: pendingMatchForFormation.id }); setShowFormation(false); setPendingMatchForFormation(null); setFormationDeck(null); }}
                    style={{ flex: 1, background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid #334155', borderRadius: 12, color: '#94a3b8', padding: '12px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ↩ Salta formazione
                  </button>
                  <button onClick={() => {
                    if (!allPicked) return;
                    const formation = { personaggioId: formationPick.personaggioId!, mossaId: formationPick.mossaId!, bonusId: formationPick.bonusId! };
                    // Find the selected personaggio card to get its base ID for injury check
                    const selectedPersonaggio = formationDeck?.personaggi?.find((c: any) => c.id === formation.personaggioId);
                    const baseId = selectedPersonaggio ? (selectedPersonaggio.draftBaseId || selectedPersonaggio.id) : formation.personaggioId;
                    setPendingFormation({ matchId: pendingMatchForFormation.id, formation, personaggioBaseId: baseId });
                  }}
                    disabled={!allPicked}
                    style={{ flex: 2, background: allPicked ? 'linear-gradient(135deg, #7c3aed, #4f46e5, #6d28d9)' : '#1e293b', border: `2px solid ${allPicked ? '#7c3aed' : '#334155'}`, borderRadius: 12, color: allPicked ? '#fff' : '#475569', padding: '12px 0', fontSize: 13, fontWeight: 800, cursor: allPicked ? 'pointer' : 'not-allowed', boxShadow: allPicked ? '0 0 24px #7c3aed66' : 'none', letterSpacing: 0.3, transition: 'all 0.2s' }}>
                    {allPicked ? '🚀 Schiera e Combatti!' : `Seleziona ancora ${3 - pickedCount} carta${3 - pickedCount !== 1 ? '' : ''}`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Stats Panel Overlay ── */}
        {showStats && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e293b', background: 'linear-gradient(90deg, #14532d, #0f172a)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <span style={{ fontSize: 22 }}>📊</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16 }}>Statistiche del Torneo</div>
                <div style={{ color: '#4ade80', fontSize: 11 }}>Cumulative per partecipante</div>
              </div>
              <button onClick={() => setShowStats(false)} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>✕ Chiudi</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
              {Object.keys(tournamentStats).length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center', marginTop: 60, fontSize: 14 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                  Nessuna partita ancora completata nel torneo
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 600, margin: '0 auto' }}>
                  {Object.entries(tournamentStats)
                    .sort(([, a], [, b]) => (b.wins - a.wins) || (b.totalDamageDealt - a.totalDamageDealt))
                    .map(([name, stats], i) => {
                      const p = currentSession?.participants?.[name];
                      const teamColor = p?.teamColor || '#3b82f6';
                      const teamName = p?.teamName || name;
                      const winRate = stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0;
                      return (
                        <div key={name} style={{ background: '#1e293b', border: `1px solid ${i === 0 ? '#f59e0b' : '#334155'}`, borderRadius: 14, padding: '16px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: teamColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, color: 'white', flexShrink: 0 }}>
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>{teamName}</div>
                              {p?.teamName && p.teamName !== name && <div style={{ color: '#64748b', fontSize: 11 }}>{name}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <span style={{ background: '#16a34a22', border: '1px solid #16a34a', borderRadius: 20, padding: '3px 12px', color: '#4ade80', fontWeight: 700, fontSize: 12 }}>{stats.wins}V</span>
                              <span style={{ background: '#dc262622', border: '1px solid #dc2626', borderRadius: 20, padding: '3px 12px', color: '#f87171', fontWeight: 700, fontSize: 12 }}>{stats.matchesPlayed - stats.wins}S</span>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                            <div style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px' }}>
                              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Partite</div>
                              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 18 }}>{stats.matchesPlayed}</div>
                            </div>
                            <div style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px' }}>
                              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Win rate</div>
                              <div style={{ color: winRate > 50 ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: 18 }}>{winRate}%</div>
                            </div>
                            <div style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px' }}>
                              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Danno totale</div>
                              <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 18 }}>{stats.totalDamageDealt}</div>
                            </div>
                            <div style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px' }}>
                              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Carte giocate</div>
                              <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: 18 }}>{stats.totalCardsPlayed}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Market Panel Overlay ── */}
        {showMarket && (() => {
          const myP = currentSession?.participants?.[playerName];
          const myDeck = myP?.deck;
          const myCredits = myP?.credits ?? 0;
          const typeColor: Record<string, string> = { personaggi: '#3b82f6', mosse: '#f97316', bonus: '#22c55e' };
          const typeLabel: Record<string, string> = { personaggi: 'Personaggi', mosse: 'Mosse', bonus: 'Bonus' };
          return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e293b', background: 'linear-gradient(90deg, #4c1d95, #0f172a)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span style={{ fontSize: 22 }}>🛒</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16 }}>Mercato Carte</div>
                  <div style={{ color: '#c4b5fd', fontSize: 11 }}>Compra e vendi carte con gli altri partecipanti</div>
                </div>
                <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: 13, marginRight: 4 }}>💰 {myCredits} cr</div>
                <button onClick={() => { setShowMarket(false); setMarketSellCard(null); }} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>✕ Chiudi</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Listings */}
                <div>
                  <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 }}>Annunci disponibili ({marketListings.length})</div>
                  {marketListings.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Nessuna carta in vendita al momento</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {marketListings.map(listing => {
                        const isMine = listing.sellerName === playerName;
                        const canAfford = myCredits >= listing.price;
                        return (
                          <div key={listing.id} style={{ background: '#1e293b', border: `1px solid ${isMine ? '#7c3aed' : '#334155'}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 52, height: 68, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#0f172a' }}>
                              {listing.card.frontImage ? <img src={listing.card.frontImage} alt={listing.card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 22 }}>🃏</div>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.card.name}</div>
                              <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                                <span style={{ background: typeColor[listing.card.type] + '22', color: typeColor[listing.card.type], border: `1px solid ${typeColor[listing.card.type]}44`, borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{typeLabel[listing.card.type]}</span>
                                <span style={{ color: '#64748b', fontSize: 11 }}>Venditore: {listing.sellerName}</span>
                              </div>
                              {listing.card.pti != null && <div style={{ color: '#38bdf8', fontSize: 10, marginTop: 2 }}>⚡ {listing.card.pti} PTI</div>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                              <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: 14 }}>💰 {listing.price} cr</div>
                              {isMine ? (
                                <button onClick={() => { socket.emit('fanta:remove-listing', { fantaId, playerName, listingId: listing.id }); }}
                                  style={{ background: '#7f1d1d', border: '1px solid #ef4444', borderRadius: 7, color: '#fca5a5', padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                  ✕ Ritira
                                </button>
                              ) : (
                                <button onClick={() => { if (!canAfford) return; socket.emit('fanta:buy-card', { fantaId, playerName, listingId: listing.id }); }}
                                  disabled={!canAfford}
                                  style={{ background: canAfford ? '#16a34a' : '#1e293b', border: `1px solid ${canAfford ? '#22c55e' : '#334155'}`, borderRadius: 7, color: canAfford ? 'white' : '#475569', padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: canAfford ? 'pointer' : 'not-allowed' }}>
                                  {canAfford ? '🛒 Compra' : 'Insufficiente'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Sell section */}
                {myDeck && (
                  <div>
                    <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 }}>Metti in vendita</div>
                    {/* Type tabs */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      {(['personaggi', 'mosse', 'bonus'] as const).map(type => (
                        <button key={type} onClick={() => { setMarketSellDeckTab(type); setMarketSellCard(null); }}
                          style={{ flex: 1, padding: '7px 0', background: marketSellDeckTab === type ? typeColor[type] + '22' : '#1e293b', border: `1px solid ${marketSellDeckTab === type ? typeColor[type] : '#334155'}`, borderRadius: 8, color: marketSellDeckTab === type ? typeColor[type] : '#64748b', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                          {typeLabel[type]} ({(myDeck[type] as any[]).length})
                        </button>
                      ))}
                    </div>
                    {marketSellCard ? (
                      <div style={{ background: '#1e293b', border: `1px solid ${typeColor[marketSellCard.type]}`, borderRadius: 12, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <div style={{ width: 44, height: 58, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#0f172a' }}>
                            {marketSellCard.card.frontImage ? <img src={marketSellCard.card.frontImage} alt={marketSellCard.card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 18 }}>🃏</div>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13 }}>{marketSellCard.card.name}</div>
                            {marketSellCard.card.pti != null && <div style={{ color: '#38bdf8', fontSize: 11 }}>⚡ {marketSellCard.card.pti} PTI</div>}
                          </div>
                          <button onClick={() => setMarketSellCard(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, padding: 4 }}>✕</button>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>Prezzo (crediti)</div>
                            <input type="number" min={1} max={1000} value={marketSellPrice} onChange={e => setMarketSellPrice(Math.max(1, parseInt(e.target.value) || 1))}
                              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', padding: '8px 12px', fontSize: 14, fontWeight: 700 }} />
                          </div>
                          <button onClick={() => { socket.emit('fanta:list-card', { fantaId, playerName, cardId: marketSellCard.card.id, cardType: marketSellCard.type, price: marketSellPrice }); setMarketSellCard(null); }}
                            style={{ background: '#7c3aed', border: 'none', borderRadius: 10, color: 'white', padding: '12px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 20, flexShrink: 0 }}>
                            🏷️ Metti in vendita
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                        {(myDeck[marketSellDeckTab] as any[]).map((card: any) => {
                          const alreadyListed = marketListings.some(l => l.sellerName === playerName && l.card.id === card.id);
                          return (
                            <button key={card.id} onClick={() => { if (!alreadyListed) setMarketSellCard({ card, type: marketSellDeckTab }); }}
                              disabled={alreadyListed}
                              style={{ background: alreadyListed ? '#0f172a' : '#1e293b', border: `1px solid ${alreadyListed ? '#1e293b' : '#334155'}`, borderRadius: 8, cursor: alreadyListed ? 'not-allowed' : 'pointer', padding: 0, overflow: 'hidden', opacity: alreadyListed ? 0.4 : 1, textAlign: 'left' }}>
                              <div style={{ aspectRatio: '3/4', background: '#0f172a', width: '100%' }}>
                                {card.frontImage ? <img src={card.frontImage} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 22 }}>🃏</div>}
                              </div>
                              <div style={{ padding: '4px 6px' }}>
                                <div style={{ color: '#f1f5f9', fontSize: 9, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</div>
                                {alreadyListed && <div style={{ color: '#7c3aed', fontSize: 9 }}>In vendita</div>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  if (view === 'waiting') {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col items-center justify-center p-8">
        <div className="text-5xl mb-4 animate-pulse">⏳</div>
        <h2 className="text-2xl font-bold text-white mb-2">Richiesta inviata</h2>
        <p className="text-white/60 text-center mb-6">
          Il creatore deve approvare la tua richiesta di accesso.<br />
          Attendi la risposta...
        </p>
        <div className="text-xs text-white/30 font-mono mb-8">Sessione: #{fantaId.slice(-6)}</div>
        <Button
          variant="outline"
          onClick={() => { socket.emit('fanta:leave', { fantaId, playerName }); setView('list'); setFantaId(''); }}
          className="border-gray-600 text-white"
        >
          Annulla richiesta
        </Button>
      </div>
    );
  }

  if (view === 'lobby' && currentSession) {
    const invitedNotJoined = (currentSession.invitedUsers || []).filter(u => !currentSession.participants[u]?.socketId);
    const scheduledDate = currentSession.scheduledStart ? new Date(currentSession.scheduledStart) : null;
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { setError('Logo troppo grande (max 2MB)'); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        setTeamLogoInput(dataUrl);
      };
      reader.readAsDataURL(file);
    };

    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-950 border-b border-gray-800 flex-shrink-0">
          <button onClick={handleLeave} className="text-white/50 hover:text-white text-sm font-medium">← Esci</button>
          <span className="text-base font-bold text-yellow-400">⭐ FantaMinkiards</span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${currentSession.isPublic ? 'bg-green-900/60 text-green-400' : 'bg-purple-900/60 text-purple-400'}`}>
              {currentSession.isPublic ? '🌐 Pubblica' : '🔒 Privata'}
            </span>
            <div className="text-[10px] text-white/30 font-mono bg-gray-800 px-2 py-1 rounded">#{fantaId.slice(-6)}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-lg mx-auto space-y-4">

            <div className="text-center">
              <h2 className="text-xl font-bold text-white">🏟️ Sala d'Attesa</h2>
              <p className="text-white/50 text-sm mt-1">
                {isCreator ? 'Configura la tua squadra e aspetta tutti i partecipanti' : 'Configura la tua squadra e aspetta che il creatore avvii l\'asta'}
              </p>
            </div>

            {/* Scheduled start banner */}
            {scheduledDate && (
              <div className="bg-amber-950/40 rounded-xl border border-amber-600/50 p-4 flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">📅</span>
                <div className="flex-1">
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-0.5">Data d'inizio programmata</div>
                  <div className="text-white font-bold text-base">
                    {scheduledDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <div className="text-amber-300 text-sm font-semibold">
                    ore {scheduledDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {isCreator && (
                  <button
                    onClick={() => {
                      const newVal = scheduledStartInput ? new Date(scheduledStartInput).getTime() : undefined;
                      socket.emit('fanta:update-scheduled-start', { fantaId, playerName, scheduledStart: newVal });
                    }}
                    className="text-xs text-amber-400/70 hover:text-amber-300 underline"
                  >Modifica</button>
                )}
              </div>
            )}

            {/* Participants / waiting room */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">
                  Sala d'attesa ({participants.length}/{currentSession.maxParticipants})
                </span>
                {canStartLobby.canStart ? (
                  <span className="text-xs font-bold text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">✓ Tutti presenti</span>
                ) : (
                  <span className="text-xs font-bold text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full">
                    {canStartLobby.missing.length} attendo{canStartLobby.missing.length > 1 ? 'no' : ''}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {participants.map(p => (
                  <div key={p.name} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${p.name === playerName ? 'bg-indigo-900/30 border border-indigo-700/40' : 'bg-gray-700/50'}`}>
                    {p.teamLogo ? (
                      <img src={p.teamLogo} alt="logo" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: `2px solid ${p.teamColor || '#4b5563'}` }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: p.teamColor || '#374151', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, border: `2px solid ${p.teamColor || '#4b5563'}66` }}>
                        {p.isCPU ? '🤖' : '👤'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm truncate">{p.teamName || p.name}</div>
                      {p.teamName && p.teamName !== p.name && <div className="text-white/40 text-xs truncate">{p.name}</div>}
                    </div>
                    {p.name === currentSession.creatorName && (
                      <span className="text-[10px] bg-yellow-700/60 text-yellow-300 px-1.5 py-0.5 rounded font-semibold">Creator</span>
                    )}
                    {p.name === playerName && (
                      <span className="text-[10px] bg-indigo-700/60 text-indigo-300 px-1.5 py-0.5 rounded font-semibold">Tu</span>
                    )}
                    <span className="text-yellow-300 text-xs font-black tabular-nums">{p.credits} cr</span>
                  </div>
                ))}
                {/* Invited but not yet joined */}
                {invitedNotJoined.map(username => (
                  <div key={`waiting-${username}`} className="flex items-center gap-3 border border-dashed border-amber-700/40 bg-amber-950/10 rounded-lg px-3 py-2">
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: '#451a03', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⏳</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-amber-300 text-sm truncate">{username}</div>
                      <div className="text-amber-400/60 text-xs">Invitato · non ancora entrato</div>
                    </div>
                  </div>
                ))}
                {/* Empty non-invited human slots */}
                {Array.from({ length: Math.max(0, availableHumanSlots - invitedNotJoined.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex items-center gap-3 border border-dashed border-gray-600 rounded-lg px-3 py-2">
                    <span className="text-base opacity-30">👤</span>
                    <span className="text-gray-600 text-sm italic">Slot libero</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Team setup (for current human player) */}
            {!currentSession.participants[playerName]?.isCPU && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">🎨 La tua squadra</div>

                {/* Logo upload */}
                <div className="flex items-center gap-3 mb-3">
                  <label className="cursor-pointer flex-shrink-0" title="Carica logo squadra">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    {teamLogoInput ? (
                      <img src={teamLogoInput} alt="logo" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: `2px solid ${teamColorInput}` }} />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: 8, background: teamColorInput, border: '2px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📷</div>
                    )}
                  </label>
                  <div className="flex-1 flex flex-col gap-2">
                    <Input
                      placeholder="Nome squadra (es. I Devastatori)"
                      value={teamNameInput}
                      onChange={e => setTeamNameInput(e.target.value)}
                      maxLength={30}
                      className="bg-gray-700 border-gray-600 text-white text-sm h-9"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={teamColorInput}
                        onChange={e => setTeamColorInput(e.target.value)}
                        style={{ width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'none', padding: 0, flexShrink: 0 }}
                        title="Colore squadra"
                      />
                      <span className="text-xs text-white/40">Colore squadra</span>
                      {teamLogoInput && (
                        <button onClick={() => setTeamLogoInput('')} className="text-xs text-red-400 hover:text-red-300 ml-auto">✕ Rimuovi logo</button>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setSavingTeamInfo(true);
                    socket.emit('fanta:set-team-info', { fantaId, playerName, teamName: teamNameInput, teamColor: teamColorInput });
                    if (teamLogoInput !== (currentSession.participants[playerName]?.teamLogo || '')) {
                      socket.emit('fanta:set-team-logo', { fantaId, playerName, logoDataUrl: teamLogoInput });
                    }
                    setTimeout(() => setSavingTeamInfo(false), 1500);
                  }}
                  disabled={savingTeamInfo}
                  className="w-full h-9 bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-sm"
                >
                  {savingTeamInfo ? '✅ Salvato!' : '💾 Salva impostazioni squadra'}
                </Button>
              </div>
            )}

            {/* Scheduled start editor (creator only, if not set yet) */}
            {isCreator && !scheduledDate && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">📅 Orario d'inizio (opzionale)</div>
                <p className="text-xs text-white/40 mb-3">Imposta una data e ora per l'asta — i partecipanti riceveranno notifiche 24h e 1h prima.</p>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={scheduledStartInput}
                    onChange={e => setScheduledStartInput(e.target.value)}
                    min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)}
                    style={{ flex: 1, background: '#1e293b', border: '1px solid #374151', borderRadius: 8, color: 'white', padding: '8px 10px', fontSize: 13 }}
                  />
                  <Button
                    onClick={() => {
                      if (!scheduledStartInput) return;
                      const ts = new Date(scheduledStartInput).getTime();
                      socket.emit('fanta:update-scheduled-start', { fantaId, playerName, scheduledStart: ts });
                      setScheduledStartInput('');
                    }}
                    disabled={!scheduledStartInput}
                    className="h-10 px-4 bg-amber-700 hover:bg-amber-600 text-white font-bold text-sm"
                  >
                    Imposta
                  </Button>
                </div>
              </div>
            )}

            {/* Pending requests (creator only) */}
            {isCreator && pendingRequests.length > 0 && (
              <div className="bg-amber-950/40 rounded-xl border border-amber-700/60 p-4">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">
                  🔔 Richieste di accesso ({pendingRequests.length})
                </div>
                <div className="space-y-2">
                  {pendingRequests.map(req => (
                    <div key={req.name} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2">
                      <span className="text-base">👤</span>
                      <span className="font-bold text-white text-sm flex-1">{req.name}</span>
                      <button onClick={() => handleApprove(req.name)} className="bg-green-700 hover:bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all">✓ Approva</button>
                      <button onClick={() => handleReject(req.name)} className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all">✕ Rifiuta</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invite additional players (creator only) */}
            {isCreator && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">➕ Invita altri giocatori</div>
                <div className="relative">
                  <Input
                    placeholder="Cerca utente da invitare..."
                    value={inviteTarget}
                    onChange={e => { setInviteTarget(e.target.value); setUserSearchQuery(e.target.value); }}
                    onKeyDown={e => e.key === 'Enter' && handleInvite()}
                    className="bg-gray-700 border-gray-600 text-white text-sm h-10"
                  />
                  {userSearchResults.length > 0 && inviteTarget.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg overflow-hidden z-10 shadow-xl">
                      {userSearchResults.slice(0, 5).map(u => (
                        <button key={u.username} onClick={() => { setInviteTarget(u.username); setUserSearchResults([]); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-left transition-colors">
                          <span className="text-sm text-white font-medium">{u.username}</span>
                          {u.displayName && u.displayName !== u.username && <span className="text-xs text-white/40">{u.displayName}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={handleInvite} disabled={!inviteTarget.trim()} className="w-full h-10 mt-2 bg-blue-700 hover:bg-blue-600 text-white font-bold text-sm">
                  📨 Invita
                </Button>
                <p className="text-xs text-white/30 mt-2">L'utente riceverà una notifica se è online nella sezione FantaMinkiards</p>
              </div>
            )}

            {/* Session code */}
            {isCreator && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-3">
                <div className="text-xs text-white/40 mb-1">Codice sessione da condividere:</div>
                <div className="font-mono text-xs text-white/70 break-all select-all bg-gray-900 rounded px-3 py-2">{fantaId}</div>
              </div>
            )}

            {/* How it works */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4 text-xs text-white/50 leading-relaxed">
              <div className="font-bold text-white/70 mb-1.5">ℹ️ Come funziona:</div>
              <ul className="space-y-1 list-disc list-inside">
                <li>Ogni giocatore inizia con <span className="text-yellow-300 font-bold">{(currentSession?.startingBudget ?? 1000).toLocaleString('it-IT')} crediti</span></li>
                <li>Squadra completa: <strong className="text-white">{currentSession?.cardsNeeded?.personaggi ?? 20} personaggi · {currentSession?.cardsNeeded?.mosse ?? 9} mosse · {currentSession?.cardsNeeded?.bonus ?? 15} bonus</strong></li>
                <li>Fai offerte per aggiudicarti le carte che vuoi</li>
                <li>Chi finisce i crediti senza completare la squadra viene squalificato</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Sticky start button (creator only) */}
        {isCreator && (
          <div className="flex-shrink-0 px-4 py-4 bg-gray-950 border-t border-gray-800">
            {!canStartLobby.canStart && (
              <p className="text-center text-xs text-amber-400 mb-2">
                ⏳ In attesa di: <strong>{canStartLobby.missing.join(', ')}</strong>
              </p>
            )}
            <Button
              onClick={handleStartAuction}
              disabled={!canStartLobby.canStart}
              className={`w-full font-black py-4 text-lg rounded-xl shadow-lg transition-all ${
                canStartLobby.canStart
                  ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/20'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50 shadow-none'
              }`}
            >
              🔨 Avvia l'Asta
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Injured Personaggi Disclaimer — shown before fanta match formation is submitted */}
      {pendingFormation && authToken && (
        <InjuredPersonaggiDisclaimer
          authToken={authToken}
          relevantCardIds={[pendingFormation.personaggioBaseId]}
          userCredits={fantaUserCredits}
          onCreditsUpdated={setFantaUserCredits}
          onConfirm={() => {
            // Decrement injury counters: next game is starting
            if (authToken) {
              fetch('/api/decrement-injured-personaggi', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
              }).catch(() => {});
            }
            socket.emit('fanta:start-fanta-match', {
              fantaId,
              playerName,
              matchId: pendingFormation.matchId,
              formation: pendingFormation.formation,
            });
            setPendingFormation(null);
            setShowFormation(false);
            setPendingMatchForFormation(null);
            setFormationDeck(null);
          }}
          onCancel={() => setPendingFormation(null)}
        />
      )}
      {/* Incoming invite modal */}
      {incomingInvite && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-yellow-500/60 p-6 w-full max-w-sm text-center shadow-lg shadow-yellow-500/10">
            <div className="text-4xl mb-3">📨</div>
            <h3 className="text-lg font-bold text-white mb-1">Sei stato invitato!</h3>
            <p className="text-white/60 text-sm mb-5">
              <strong className="text-yellow-300">{incomingInvite.creatorName}</strong> ti invita a partecipare al FantaTorneo{' '}
              <span className="font-mono text-white/50">#{incomingInvite.sessionCode}</span>
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIncomingInvite(null)}
                className="flex-1 border-gray-600 text-white"
              >
                Rifiuta
              </Button>
              <Button
                onClick={handleAcceptInvite}
                disabled={loading}
                className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black"
              >
                Accetta
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-950 border-b border-gray-800 flex-shrink-0">
        <button onClick={onClose} className="text-white/50 hover:text-white text-sm font-medium">← Indietro</button>
        <h1 className="text-lg font-bold text-yellow-400">⭐ FantaMinkiards</h1>
        <div className="w-16" />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto">
          {pendingFantaGame && onResumeFantaGame && (
            <div className="flex items-center gap-3 bg-purple-900/30 border border-purple-500/40 rounded-2xl px-4 py-3 mb-4">
              <span className="text-2xl flex-shrink-0">🎮</span>
              <div className="flex-1 min-w-0">
                <p className="text-purple-200 font-black text-sm leading-tight">Partita FantaMinkiards interrotta</p>
                <p className="text-purple-400/70 text-xs">La tua partita è ancora attiva sul server</p>
              </div>
              <button
                onClick={() => onResumeFantaGame(pendingFantaGame.gameId)}
                className="flex-shrink-0 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl transition-colors active:scale-95"
              >
                Riprendi
              </button>
            </div>
          )}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-5">
            <h2 className="text-white font-bold mb-1">Come funziona</h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Ricevete <strong className="text-yellow-300">{(currentSession?.startingBudget ?? 1000).toLocaleString('it-IT')} crediti</strong> e partecipate a un'asta su tutte le carte in ordine alfabetico.
              Chi offre di più vince la carta! Costruisci il tuo mazzo: <strong className="text-white">{currentSession?.cardsNeeded?.personaggi ?? 20} personaggi · {currentSession?.cardsNeeded?.mosse ?? 9} mosse · {currentSession?.cardsNeeded?.bonus ?? 15} bonus</strong>. Chi finisce i crediti senza completare viene squalificato.
            </p>
          </div>

          <Button
            onClick={() => setShowCreateDialog(true)}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 text-base rounded-xl mb-4 shadow-lg shadow-yellow-500/10"
          >
            + Crea FantaTorneo
          </Button>

          <div className="flex gap-2 mb-5">
            <Input
              placeholder="Codice sessione per entrare..."
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
              className="bg-gray-800 border-gray-600 text-white flex-1 h-11"
            />
            <Button
              onClick={handleJoinByCode}
              disabled={!joinCode.trim() || loading}
              className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-5 h-11"
            >
              Richiedi
            </Button>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-4 py-2 text-sm mb-4">
              ⚠️ {error}
            </div>
          )}

          {/* My active sessions */}
          {mySessions.length > 0 && (
            <div className="mb-5">
              <div className="text-xs font-bold text-yellow-400/70 uppercase tracking-widest mb-2">Le mie sessioni</div>
              <div className="space-y-2">
                {mySessions.map(s => {
                  const statusLabel = s.status === 'complete' ? '✅ Completata' : s.status === 'auction' ? '🔥 In corso' : '⏳ Lobby';
                  const statusColor = s.status === 'complete' ? 'text-green-400' : s.status === 'auction' ? 'text-orange-400' : 'text-yellow-300';
                  return (
                    <div key={s.id} className="bg-gray-800 rounded-xl border border-yellow-600/30 p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm">{s.creatorName}</div>
                        <div className="text-xs text-white/50 mt-0.5">{s.participants.join(', ')}</div>
                        <div className={`text-xs font-semibold mt-1 ${statusColor}`}>{statusLabel}</div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setLoading(true);
                          socket.emit('fanta:rejoin', { fantaId: s.id, playerName });
                        }}
                        disabled={loading}
                        className="flex-shrink-0 bg-yellow-600 hover:bg-yellow-500 text-black font-black"
                      >
                        Riprendi
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          onClick={() => handleDeleteFantaSession(s.id)}
                          className="flex-shrink-0 bg-red-900 hover:bg-red-800 text-red-300 border border-red-700"
                        >
                          Elimina
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold">{isAdmin ? 'Tutte le sessioni' : 'Sessioni disponibili'}</h3>
              <button onClick={fetchSessions} className="text-xs text-white/40 hover:text-white/70 underline">
                Aggiorna
              </button>
            </div>
            {lobbySessions.length === 0 ? (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-white/40">
                <div className="text-3xl mb-2">🔍</div>
                <div className="text-sm">Nessuna sessione disponibile. Creane una!</div>
              </div>
            ) : (
              <div className="space-y-2">
                {lobbySessions.map(s => {
                  const slotsLeft = s.maxParticipants ? s.maxParticipants - s.participantCount : '?';
                  const scheduledDate = s.scheduledStart ? new Date(s.scheduledStart) : null;
                  const isInvited = s.invitedUsers?.includes(playerName);
                  return (
                    <div key={s.id} className={`bg-gray-800 rounded-xl border p-4 flex items-center gap-4 ${isInvited ? 'border-blue-700/60 bg-blue-950/10' : 'border-gray-700'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white text-sm">{s.creatorName}</span>
                          {s.isPublic === false ? (
                            <span className="text-[10px] bg-purple-900/60 text-purple-400 px-1.5 py-0.5 rounded-full font-semibold">🔒 Privata</span>
                          ) : (
                            <span className="text-[10px] bg-green-900/40 text-green-500 px-1.5 py-0.5 rounded-full font-semibold">🌐 Pubblica</span>
                          )}
                          {isInvited && <span className="text-[10px] bg-blue-900/60 text-blue-400 px-1.5 py-0.5 rounded-full font-semibold">📨 Invitato</span>}
                        </div>
                        <div className="text-xs text-white/50">
                          {s.participantCount}/{s.maxParticipants ?? '?'} partecipanti
                        </div>
                        {scheduledDate && (
                          <div className="text-[11px] text-amber-400 mt-0.5">
                            📅 {scheduledDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} ore {scheduledDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        {isAdmin && s.status !== 'lobby' && (
                          <div className={`text-xs font-semibold mt-0.5 ${s.status === 'complete' ? 'text-green-400' : 'text-orange-400'}`}>
                            {s.status === 'complete' ? '✅ Completata' : '🔥 In corso'}
                          </div>
                        )}
                        <div className="text-[10px] text-white/25 font-mono mt-1 truncate">{s.id}</div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleRequestJoin(s.id)}
                        disabled={loading || slotsLeft === 0}
                        className={`flex-shrink-0 font-bold ${slotsLeft === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : isInvited ? 'bg-blue-700 hover:bg-blue-600 text-white' : 'bg-blue-700 hover:bg-blue-600 text-white'}`}
                      >
                        {slotsLeft === 0 ? 'Pieno' : isInvited ? '✓ Accetta' : 'Richiedi'}
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          onClick={() => handleDeleteFantaSession(s.id)}
                          className="flex-shrink-0 bg-red-900 hover:bg-red-800 text-red-300 border border-red-700"
                        >
                          Elimina
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-gray-800 rounded-t-2xl sm:rounded-2xl border border-gray-700 p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-5">⭐ Crea FantaTorneo</h2>

            {/* Public / Private toggle */}
            <div className="mb-5">
              <label className="text-sm font-semibold text-white/80 mb-2 block">Visibilità asta</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { val: true, icon: '🌐', label: 'Pubblica', desc: 'Visibile e accessibile a tutti' },
                  { val: false, icon: '🔒', label: 'Privata', desc: 'Solo su invito diretto' },
                ] as const).map(({ val, icon, label, desc }) => (
                  <button key={String(val)} onClick={() => setIsPublicAuction(val)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${isPublicAuction === val ? (val ? 'bg-green-900/30 border-green-500/60 text-green-300' : 'bg-purple-900/30 border-purple-500/60 text-purple-300') : 'bg-gray-700 border-gray-600 text-white/60'}`}>
                    <span className="text-xl mb-1">{icon}</span>
                    <span className="font-bold text-sm">{label}</span>
                    <span className="text-[11px] text-white/40 leading-tight">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Total participants */}
            <div className="mb-5">
              <label className="text-sm font-semibold text-white/80 mb-1 block">
                Partecipanti totali: <span className="text-yellow-300">{totalParticipants}</span>
              </label>
              <input
                type="range"
                min={2}
                max={10}
                value={totalParticipants}
                onChange={e => {
                  const v = Number(e.target.value);
                  setTotalParticipants(v);
                  if (cpuCount >= v) setCpuCount(v - 1);
                }}
                className="w-full accent-yellow-500 h-2 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-white/30 mt-1">
                <span>2</span><span>4</span><span>6</span><span>8</span><span>10</span>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {[2, 4, 6, 8, 10].map(n => (
                  <button key={n} onClick={() => { setTotalParticipants(n); if (cpuCount >= n) setCpuCount(n - 1); }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border ${totalParticipants === n ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-gray-700 border-gray-600 text-white'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* CPU count */}
            <div className="mb-5">
              <label className="text-sm font-semibold text-white/80 mb-1 block">
                Di cui CPU: <span className="text-blue-300">{cpuCount}</span>
                <span className="text-white/40 text-xs ml-1">({totalParticipants - 1 - cpuCount} posto{totalParticipants - 1 - cpuCount !== 1 ? 'i' : ''} per umani)</span>
              </label>
              <input
                type="range"
                min={0}
                max={totalParticipants - 1}
                value={cpuCount}
                onChange={e => setCpuCount(Number(e.target.value))}
                className="w-full accent-blue-500 h-2 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-white/30 mt-1">
                <span>0 CPU</span>
                <span>{totalParticipants - 1} CPU</span>
              </div>
            </div>

            {/* CPU level */}
            {cpuCount > 0 && (
              <div className="mb-5">
                <label className="text-sm font-semibold text-white/80 mb-2 block">Livello CPU</label>
                <div className="flex gap-2">
                  {([['easy', 'Facile'], ['medium', 'Medio'], ['hard', 'Difficile']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setCpuLevel(val)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${cpuLevel === val ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-700 border-gray-600 text-white'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Deck size configuration */}
            <div className="mb-5">
              <label className="text-sm font-semibold text-white/80 mb-2 block">
                Dimensione mazzi per concorrente
              </label>
              <div className="space-y-3">
                {([
                  { key: 'personaggi', label: 'Personaggi', color: 'accent-purple-500', bg: 'text-purple-300' },
                  { key: 'mosse', label: 'Mosse', color: 'accent-red-500', bg: 'text-red-300' },
                  { key: 'bonus', label: 'Bonus', color: 'accent-green-500', bg: 'text-green-300' },
                ] as const).map(({ key, label, color, bg }) => (
                  <div key={key} className="bg-gray-700/40 rounded-lg px-3 py-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-white/70">{label}</span>
                      <span className={`text-sm font-black ${bg}`}>
                        {deckSizeConfig[key]}
                        <span className="text-white/30 font-normal ml-1 text-xs">/ max {maxDeckSize[key]}</span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={maxDeckSize[key]}
                      value={deckSizeConfig[key]}
                      onChange={e => setDeckSizeConfig(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                      className={`w-full ${color} h-2 cursor-pointer`}
                    />
                    <div className="flex justify-between text-xs text-white/20 mt-0.5">
                      <span>1</span>
                      <span className="text-white/30 text-xs">{totalParticipants} × {deckSizeConfig[key]} = {totalParticipants * deckSizeConfig[key]} / {TOTAL_CARDS[key]} disponibili</span>
                      <span>{maxDeckSize[key]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div className="mb-5">
              <label className="text-sm font-semibold text-white/80 mb-2 block">
                💰 Budget iniziale per squadra: <span className="text-yellow-300 font-black">{startingBudget.toLocaleString('it-IT')} crediti</span>
              </label>
              <input
                type="range"
                min={200}
                max={5000}
                step={100}
                value={startingBudget}
                onChange={e => setStartingBudget(Number(e.target.value))}
                className="w-full accent-yellow-500 h-2 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-white/30 mt-1">
                <span>200</span><span>1.000</span><span>2.000</span><span>3.500</span><span>5.000</span>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {[500, 1000, 2000, 3000, 5000].map(v => (
                  <button key={v} onClick={() => setStartingBudget(v)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border ${startingBudget === v ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-gray-700 border-gray-600 text-white'}`}>
                    {v.toLocaleString('it-IT')}
                  </button>
                ))}
              </div>
              <div className="text-xs text-white/40 mt-2">
                Ogni concorrente parte con questo budget per l'asta. Budget più alto = aste più competitive.
              </div>
            </div>

            {/* User invite (only when human slots > 0) */}
            {totalParticipants - 1 - cpuCount > 0 && (
              <div className="mb-5">
                <label className="text-sm font-semibold text-white/80 mb-2 block">
                  👥 Invita giocatori umani <span className="text-white/40 font-normal text-xs">({createInvitedUsers.length}/{totalParticipants - 1 - cpuCount} slot umani)</span>
                </label>
                {createInvitedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {createInvitedUsers.map(u => (
                      <div key={u} className="flex items-center gap-1.5 bg-blue-900/40 border border-blue-700/50 rounded-full px-3 py-1">
                        <span className="text-xs text-blue-300 font-medium">{u}</span>
                        <button onClick={() => setCreateInvitedUsers(prev => prev.filter(x => x !== u))} className="text-blue-400/70 hover:text-red-400 text-xs leading-none">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {createInvitedUsers.length < totalParticipants - 1 - cpuCount && (
                  <div className="relative">
                    <Input
                      placeholder="Cerca utente da invitare..."
                      value={userSearchQuery}
                      onChange={e => setUserSearchQuery(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white text-sm h-9"
                    />
                    {userSearchResults.length > 0 && userSearchQuery.length >= 2 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg overflow-hidden z-20 shadow-xl">
                        {userSearchResults.slice(0, 5).map(u => (
                          <button key={u.username} onClick={() => {
                            setCreateInvitedUsers(prev => [...prev, u.username]);
                            setUserSearchQuery('');
                            setUserSearchResults([]);
                          }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-left transition-colors">
                            <span className="text-blue-400 text-sm font-medium">+</span>
                            <span className="text-sm text-white">{u.username}</span>
                            {u.displayName && u.displayName !== u.username && <span className="text-xs text-white/40">{u.displayName}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {createInvitedUsers.length > 0 && (
                  <p className="text-xs text-white/30 mt-1.5">Gli utenti invitati riceveranno una notifica.</p>
                )}
              </div>
            )}

            {/* Scheduled start */}
            <div className="mb-5">
              <label className="text-sm font-semibold text-white/80 mb-2 block">📅 Data d'inizio (opzionale)</label>
              <input
                type="datetime-local"
                value={scheduledStartInput}
                onChange={e => setScheduledStartInput(e.target.value)}
                min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #374151', borderRadius: 10, color: 'white', padding: '10px 12px', fontSize: 14 }}
              />
              {scheduledStartInput && (
                <p className="text-xs text-amber-400/70 mt-1.5">
                  ⏰ Notifiche automatiche 24h e 1h prima dell'asta.
                </p>
              )}
            </div>

            {/* Summary */}
            <div className="bg-gray-700/40 rounded-lg px-4 py-3 mb-5 text-sm text-white/60">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPublicAuction ? 'bg-green-900/60 text-green-400' : 'bg-purple-900/60 text-purple-400'}`}>
                  {isPublicAuction ? '🌐 Pubblica' : '🔒 Privata'}
                </span>
              </div>
              Torneo da <strong className="text-white">{totalParticipants}</strong> partecipanti:
              tu + <strong className="text-blue-300">{cpuCount} CPU</strong>
              {totalParticipants - 1 - cpuCount > 0 && <> + <strong className="text-green-300">{totalParticipants - 1 - cpuCount} umani</strong>{createInvitedUsers.length > 0 ? <> (<strong className="text-blue-300">{createInvitedUsers.length}</strong> già invitati)</> : <> (inviti dalla sala d'attesa)</>}</>}
            </div>

            <div className="bg-slate-800/60 rounded-xl p-3 border border-purple-500/30">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setHelpEnabled(!helpEnabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${helpEnabled ? 'bg-purple-500' : 'bg-slate-600'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${helpEnabled ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-white font-medium text-sm">💡 Aiuti (guida per principianti)</span>
              </label>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); setCreateInvitedUsers([]); setUserSearchQuery(''); setScheduledStartInput(''); }} className="flex-1 border-gray-600 text-white h-12">
                Annulla
              </Button>
              <Button onClick={handleCreate} disabled={loading} className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black h-12 text-base">
                {loading ? 'Creazione...' : '🚀 Crea'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
