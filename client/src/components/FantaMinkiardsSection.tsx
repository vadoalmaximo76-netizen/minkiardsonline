import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { socket } from "../lib/socket";
import { FantaAuctionRoom } from "./FantaAuctionRoom";

interface SessionSummary {
  id: string;
  creatorName: string;
  participantCount: number;
  participants: string[];
  maxParticipants: number;
  status: string;
  createdAt: number;
}

interface FantaParticipant {
  name: string;
  credits: number;
  deck: { personaggi: any[]; mosse: any[]; bonus: any[] };
  isCPU: boolean;
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
}

interface Props {
  playerName: string;
  authToken?: string;
  onClose: () => void;
  onJoinFantaGame?: (gameId: string) => void;
}

export function FantaMinkiardsSection({ playerName, authToken, onClose, onJoinFantaGame }: Props) {
  const [view, setView] = useState<'list' | 'lobby' | 'waiting' | 'auction' | 'complete'>('list');
  const [lobbySessions, setLobbySessions] = useState<SessionSummary[]>([]);
  const [currentSession, setCurrentSession] = useState<FantaSession | null>(null);
  const [fantaId, setFantaId] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [totalParticipants, setTotalParticipants] = useState(4);
  const [cpuCount, setCpuCount] = useState(3);
  const [cpuLevel, setCpuLevel] = useState<'easy' | 'medium' | 'hard'>('medium');
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

  const fetchSessions = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const [lobbyRes, myRes] = await Promise.all([
        fetch('/api/fanta/sessions', { headers }),
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

    socket.on('fanta:auction-complete', () => {
      setView('complete');
    });

    socket.on('fanta:rejoined', ({ session, status }: { session: FantaSession; status: string }) => {
      setCurrentSession(session);
      setFantaId(session.id);
      setPendingRequests(session.pendingRequests ?? []);
      setLoading(false);
      if (status === 'complete') {
        setView('complete');
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

    socket.on('fanta:error', (data: { message: string }) => {
      setError(data.message);
      setLoading(false);
      setTournamentLoading(false);
      setTimeout(() => setError(''), 4000);
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
      socket.off('fanta:error');
    };
  }, [playerName, view]);

  const handleCreate = () => {
    if (!playerName) return;
    setLoading(true);
    socket.emit('fanta:create', { cpuCount, cpuLevel, playerName, maxParticipants: totalParticipants });
    setShowCreateDialog(false);
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
          {!tournamentGameId ? (
            <div className="space-y-3">
              {isCreator ? (
                <Button
                  onClick={() => {
                    setTournamentLoading(true);
                    socket.emit('fanta:start-tournament', { fantaId, playerName });
                  }}
                  disabled={tournamentLoading}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 text-lg rounded-xl shadow-lg shadow-yellow-500/20"
                >
                  {tournamentLoading ? '⏳ Avvio in corso...' : '🏆 Avvia il torneo'}
                </Button>
              ) : (
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                  <div className="text-white/60 text-sm animate-pulse">
                    ⏳ In attesa che il creatore avvii il torneo...
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
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-950 border-b border-gray-800 flex-shrink-0">
          <button onClick={handleLeave} className="text-white/50 hover:text-white text-sm font-medium">← Esci</button>
          <span className="text-base font-bold text-yellow-400">⭐ FantaMinkiards</span>
          <div className="text-[10px] text-white/30 font-mono bg-gray-800 px-2 py-1 rounded">
            #{fantaId.slice(-6)}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-lg mx-auto space-y-4">

            <div className="text-center">
              <h2 className="text-xl font-bold text-white">Sala d'Attesa</h2>
              <p className="text-white/50 text-sm">
                {isCreator ? 'Approva le richieste e avvia l\'asta' : 'Aspetta che il creatore avvii l\'asta'}
              </p>
            </div>

            {/* Participants list */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">
                  Partecipanti ({participants.length}/{currentSession.maxParticipants})
                </span>
                <span className="text-xs text-white/30">
                  {availableHumanSlots > 0 ? `${availableHumanSlots} posto${availableHumanSlots > 1 ? 'i' : ''} libero` : 'Al completo'}
                </span>
              </div>
              <div className="space-y-2">
                {participants.map(p => (
                  <div key={p.name} className="flex items-center gap-3 bg-gray-700/50 rounded-lg px-3 py-2">
                    <span className="text-base">{p.isCPU ? '🤖' : '👤'}</span>
                    <span className="font-bold text-white text-sm flex-1">{p.name}</span>
                    {p.name === currentSession.creatorName && (
                      <span className="text-xs bg-yellow-700/60 text-yellow-300 px-2 py-0.5 rounded font-semibold">Creator</span>
                    )}
                    <span className="text-yellow-300 text-sm font-black tabular-nums">{p.credits} cr</span>
                  </div>
                ))}
                {/* Empty human slots */}
                {Array.from({ length: Math.max(0, availableHumanSlots) }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex items-center gap-3 border border-dashed border-gray-600 rounded-lg px-3 py-2">
                    <span className="text-base opacity-40">👤</span>
                    <span className="text-gray-600 text-sm italic">Slot libero</span>
                  </div>
                ))}
              </div>
            </div>

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
                      <button
                        onClick={() => handleApprove(req.name)}
                        className="bg-green-700 hover:bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                      >
                        ✓ Approva
                      </button>
                      <button
                        onClick={() => handleReject(req.name)}
                        className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                      >
                        ✕ Rifiuta
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invite by name (creator only) */}
            {isCreator && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Invita giocatore</div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome utente da invitare..."
                    value={inviteTarget}
                    onChange={e => setInviteTarget(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleInvite()}
                    className="bg-gray-700 border-gray-600 text-white text-sm h-10 flex-1"
                  />
                  <Button
                    onClick={handleInvite}
                    disabled={!inviteTarget.trim()}
                    className="h-10 px-4 bg-blue-700 hover:bg-blue-600 text-white font-bold"
                  >
                    Invita
                  </Button>
                </div>
                <p className="text-xs text-white/30 mt-2">L'utente riceverà una notifica se è online nella sezione FantaMinkiards</p>
              </div>
            )}

            {/* Session code (creator) */}
            {isCreator && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-3">
                <div className="text-xs text-white/40 mb-1">Codice sessione da condividere:</div>
                <div className="font-mono text-xs text-white/70 break-all select-all bg-gray-900 rounded px-3 py-2">{fantaId}</div>
              </div>
            )}

            {/* How it works */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4 text-xs text-white/50 leading-relaxed">
              <div className="font-bold text-white/70 mb-1.5">Come funziona:</div>
              <ul className="space-y-1 list-disc list-inside">
                <li>Ogni giocatore inizia con <span className="text-yellow-300 font-bold">1000 crediti</span></li>
                <li>Tutte le carte scorrono in ordine alfabetico</li>
                <li>Fai offerte per aggiudicarti le carte che vuoi</li>
                <li>Squadra completa: <strong className="text-white">20 personaggi · 9 mosse · 15 bonus</strong></li>
                <li>Chi finisce i crediti senza completare la squadra viene squalificato</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Sticky start button (creator only) */}
        {isCreator && (
          <div className="flex-shrink-0 px-4 py-4 bg-gray-950 border-t border-gray-800">
            <Button
              onClick={handleStartAuction}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 text-lg rounded-xl shadow-lg shadow-yellow-500/20"
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
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-5">
            <h2 className="text-white font-bold mb-1">Come funziona</h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Ricevete <strong className="text-yellow-300">1000 crediti</strong> e partecipate a un'asta su tutte le carte in ordine alfabetico.
              Chi offre di più vince la carta! Costruisci il tuo mazzo: <strong className="text-white">20 personaggi · 9 mosse · 15 bonus</strong>. Chi finisce i crediti senza completare viene squalificato.
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
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold">Sessioni disponibili</h3>
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
                  return (
                    <div key={s.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm">{s.creatorName}</div>
                        <div className="text-xs text-white/50 mt-0.5">
                          {s.participantCount}/{s.maxParticipants ?? '?'} partecipanti
                          {s.participants?.length > 0 && ` · ${s.participants.join(', ')}`}
                        </div>
                        <div className="text-[10px] text-white/25 font-mono mt-1 truncate">{s.id}</div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleRequestJoin(s.id)}
                        disabled={loading || slotsLeft === 0}
                        className={`flex-shrink-0 font-bold ${slotsLeft === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-600 text-white'}`}
                      >
                        {slotsLeft === 0 ? 'Pieno' : 'Richiedi'}
                      </Button>
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
          <div className="bg-gray-800 rounded-t-2xl sm:rounded-2xl border border-gray-700 p-6 w-full sm:max-w-md">
            <h2 className="text-xl font-bold text-white mb-5">Crea FantaTorneo</h2>

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

            {/* Summary */}
            <div className="bg-gray-700/40 rounded-lg px-4 py-3 mb-5 text-sm text-white/60">
              Torneo da <strong className="text-white">{totalParticipants}</strong> partecipanti:
              tu + <strong className="text-blue-300">{cpuCount} CPU</strong>
              {totalParticipants - 1 - cpuCount > 0 && <> + <strong className="text-green-300">{totalParticipants - 1 - cpuCount} umani</strong> (approvazione richiesta)</>}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="flex-1 border-gray-600 text-white h-12">
                Annulla
              </Button>
              <Button onClick={handleCreate} disabled={loading} className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black h-12 text-base">
                {loading ? 'Creazione...' : 'Crea'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
