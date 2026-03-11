import React, { useState, useEffect, useCallback } from "react";
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
  isAdmin?: boolean;
  onClose: () => void;
  onJoinFantaGame?: (gameId: string) => void;
}

export function FantaMinkiardsSection({ playerName, authToken, isAdmin, onClose, onJoinFantaGame }: Props) {
  const [view, setView] = useState<'list' | 'lobby' | 'waiting' | 'auction' | 'complete' | 'configure' | 'bracket'>('list');
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
      socket.emit('fanta:start-fanta-match', { fantaId, playerName, matchId: match.id });
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
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 12, background: '#0f172a', flexShrink: 0 }}>
          <button onClick={() => setView('complete')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 20, padding: 4 }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 17 }}>🏆 {fantaTourney.config?.name || 'FantaTorneo'}</div>
            <div style={{ color: '#f59e0b', fontSize: 11 }}>{isCampionato ? 'Campionato Fanta' : 'Torneo Fanta'} · Mazzi dall'asta</div>
          </div>
          {fantaTourney.status === 'completed' && fantaTourney.winnerId && (
            <div style={{ background: '#854d0e', border: '1px solid #d97706', borderRadius: 20, padding: '4px 14px', fontSize: 12, color: '#fde68a', fontWeight: 700 }}>
              👑 {fantaTourney.winnerId}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
          {/* Standings (round_robin) */}
          {isCampionato && (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 16, marginBottom: 20, maxWidth: 600, margin: '0 auto 20px' }}>
              <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Classifica</div>
              {Object.entries(wins).sort(([, a], [, b]) => b - a).map(([name, w], i) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #334155' }}>
                  <span style={{ color: i === 0 ? '#f59e0b' : '#64748b', fontWeight: 700, fontSize: 14, width: 20 }}>{i + 1}.</span>
                  <span style={{ color: '#f1f5f9', flex: 1, fontWeight: name === playerName ? 700 : 400 }}>{name}{name === playerName ? ' (tu)' : ''}</span>
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>{w} V</span>
                  <span style={{ color: '#64748b', fontSize: 12 }}>{allMatches.filter((m: any) => m.status === 'completed' && m.players.includes(name) && m.winnerId !== name).length} S</span>
                </div>
              ))}
              {Object.keys(wins).length === 0 && (
                <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>Nessuna partita ancora giocata</div>
              )}
            </div>
          )}

          {/* Bracket / Match list */}
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
            {isCampionato ? (
              <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {allMatches.map((match: any) => (
                  <div key={match.id} style={{ background: '#1e293b', border: `1px solid ${statusColor(match.status)}44`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14 }}>
                        {match.players.join(' vs ')}
                      </div>
                      {match.winnerId && <div style={{ color: '#22c55e', fontSize: 12, marginTop: 2 }}>Vincitore: {match.winnerId}</div>}
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
                ))}
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
                          {match.players.map((p: string) => (
                            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: match.winnerId === p ? '#14532d' : '#0f172a', border: `1px solid ${match.winnerId === p ? '#16a34a' : '#334155'}`, borderRadius: 8 }}>
                              <span style={{ fontSize: 14 }}>{p === playerName ? '👤' : '🧑'}</span>
                              <span style={{ color: '#f1f5f9', fontWeight: p === playerName ? 700 : 400, flex: 1, fontSize: 13 }}>{p}{p === playerName ? ' (tu)' : ''}</span>
                              {match.winnerId === p && <span style={{ color: '#22c55e', fontSize: 12 }}>👑</span>}
                            </div>
                          ))}
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
