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
  status: string;
  createdAt: number;
}

interface FantaParticipant {
  name: string;
  credits: number;
  deck: { personaggi: any[]; mosse: any[]; bonus: any[] };
  isCPU: boolean;
}

interface FantaSession {
  id: string;
  creatorName: string;
  participants: Record<string, FantaParticipant>;
  status: 'lobby' | 'auction' | 'complete';
  createdAt: number;
}

interface Props {
  playerName: string;
  authToken?: string;
  onClose: () => void;
}

export function FantaMinkiardsSection({ playerName, authToken, onClose }: Props) {
  const [view, setView] = useState<'list' | 'lobby' | 'auction' | 'complete'>('list');
  const [lobbySessions, setLobbySessions] = useState<SessionSummary[]>([]);
  const [currentSession, setCurrentSession] = useState<FantaSession | null>(null);
  const [fantaId, setFantaId] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [cpuCount, setCpuCount] = useState(0);
  const [cpuLevel, setCpuLevel] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [auctionParticipants, setAuctionParticipants] = useState<string[]>([]);
  const [auctionCredits, setAuctionCredits] = useState<Record<string, number>>({});

  const fetchSessions = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/fanta/sessions', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLobbySessions(data);
      }
    } catch {}
  }, [authToken]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  useEffect(() => {
    socket.on('fanta:session-created', ({ fantaId: id, session }: { fantaId: string; session: FantaSession }) => {
      setFantaId(id);
      setCurrentSession(session);
      setView('lobby');
      setLoading(false);
    });

    socket.on('fanta:joined', ({ fantaId: id, session }: { fantaId: string; session: FantaSession }) => {
      setFantaId(id);
      setCurrentSession(session);
      setView('lobby');
      setLoading(false);
    });

    socket.on('fanta:session-updated', ({ session }: { session: FantaSession }) => {
      setCurrentSession(session);
    });

    socket.on('fanta:card-up', (data: { card: any; credits: Record<string, number> }) => {
      if (data.credits) setAuctionCredits(data.credits);
      setView('auction');
    });

    socket.on('fanta:auction-complete', () => {
      setView('complete');
    });

    socket.on('fanta:error', (data: { message: string }) => {
      setError(data.message);
      setLoading(false);
      setTimeout(() => setError(''), 4000);
    });

    return () => {
      socket.off('fanta:session-created');
      socket.off('fanta:joined');
      socket.off('fanta:session-updated');
      socket.off('fanta:card-up');
      socket.off('fanta:auction-complete');
      socket.off('fanta:error');
    };
  }, []);

  const handleCreate = () => {
    if (!playerName) return;
    setLoading(true);
    socket.emit('fanta:create', { cpuCount, cpuLevel, playerName });
    setShowCreateDialog(false);
  };

  const handleJoin = (id: string) => {
    if (!playerName) return;
    setLoading(true);
    socket.emit('fanta:join', { fantaId: id, playerName });
  };

  const handleJoinByCode = () => {
    const code = joinCode.trim();
    if (!code) return;
    handleJoin(code);
  };

  const handleStartAuction = () => {
    socket.emit('fanta:start-auction', { fantaId, playerName });
  };

  const handleLeave = () => {
    socket.emit('fanta:leave', { fantaId, playerName });
    setCurrentSession(null);
    setFantaId('');
    setView('list');
    fetchSessions();
  };

  const isCreator = currentSession?.creatorName === playerName;
  const participants = currentSession ? Object.values(currentSession.participants) : [];

  if (view === 'auction' && fantaId) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-950 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-yellow-400">⭐ FantaMinkiards</span>
            <span className="text-sm text-white/50">Asta in corso...</span>
          </div>
          <div className="text-xs text-white/30">Sessione: {fantaId.slice(-6)}</div>
        </div>
        <div className="flex-1 min-h-0">
          <FantaAuctionRoom
            fantaId={fantaId}
            playerName={playerName}
            isCreator={isCreator}
            participants={auctionParticipants.length > 0 ? auctionParticipants : Object.keys(currentSession?.participants ?? {})}
            initialCredits={auctionCredits}
            onComplete={() => setView('complete')}
          />
        </div>
      </div>
    );
  }

  if (view === 'complete') {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col items-center justify-center p-8">
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="text-3xl font-bold text-yellow-400 mb-2">Asta Completata!</h2>
        <p className="text-white/70 text-center mb-8">
          Tutti i partecipanti hanno il loro mazzo pronto.<br />
          Ora potete creare una partita in modalità Draft usando i vostri mazzi FantaMinkiards!
        </p>
        <div className="space-y-2 mb-8">
          {participants.map(p => (
            <div key={p.name} className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-2">
              <span className="font-bold text-white">{p.name}{p.isCPU ? ' 🤖' : ''}</span>
              <span className="text-gray-400 text-sm">
                {p.deck.personaggi.length} personaggi · {p.deck.mosse.length} mosse · {p.deck.bonus.length} bonus
              </span>
              <span className="text-yellow-300 text-sm ml-auto">{p.credits} cr rimanenti</span>
            </div>
          ))}
        </div>
        <Button
          onClick={onClose}
          className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-8 py-3"
        >
          Torna alla home
        </Button>
      </div>
    );
  }

  if (view === 'lobby' && currentSession) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 bg-gray-950 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <button onClick={handleLeave} className="text-white/50 hover:text-white text-sm">← Esci</button>
            <span className="text-xl font-bold text-yellow-400">⭐ FantaMinkiards</span>
          </div>
          <div className="text-xs text-white/40 font-mono bg-gray-800 px-3 py-1 rounded">
            Codice: {fantaId}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8 w-full max-w-lg">
            <h2 className="text-2xl font-bold text-white mb-2 text-center">Sala d'Attesa</h2>
            <p className="text-white/50 text-sm text-center mb-6">
              {isCreator ? 'Condividi il codice con gli altri giocatori' : 'Aspetta che il creatore avvii l\'asta'}
            </p>

            <div className="space-y-2 mb-6">
              <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Partecipanti</div>
              {participants.map(p => (
                <div key={p.name} className="flex items-center gap-3 bg-gray-700/50 rounded-lg px-3 py-2">
                  <span className="text-lg">{p.isCPU ? '🤖' : '👤'}</span>
                  <span className="font-bold text-white">{p.name}</span>
                  {p.name === currentSession.creatorName && (
                    <span className="ml-auto text-xs bg-yellow-700/50 text-yellow-300 px-2 py-0.5 rounded">Creator</span>
                  )}
                  <span className="ml-auto text-yellow-300 text-sm font-bold">{p.credits} cr</span>
                </div>
              ))}
            </div>

            <div className="bg-gray-700/30 rounded-lg p-3 mb-6 text-xs text-white/60">
              <div className="font-bold text-white/80 mb-1">Come funziona:</div>
              <ul className="space-y-1 list-disc list-inside">
                <li>Ogni giocatore inizia con <span className="text-yellow-300 font-bold">500 crediti</span></li>
                <li>Le carte scorrono in ordine alfabetico: prima Personaggi, poi Mosse, poi Bonus</li>
                <li>Fai offerte per aggiudicarti le carte che vuoi</li>
                <li>L'asta finisce quando tutti hanno 33+33+33 carte</li>
                <li>I CPU rilanciano automaticamente in base alla rarità della carta</li>
              </ul>
            </div>

            {isCreator && (
              <Button
                onClick={handleStartAuction}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 text-base"
                disabled={participants.length < 1}
              >
                🔨 Avvia l'Asta
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-950 border-b border-gray-800">
        <button onClick={onClose} className="text-white/50 hover:text-white text-sm">← Indietro</button>
        <h1 className="text-2xl font-bold text-yellow-400">⭐ FantaMinkiards</h1>
        <div className="w-20" />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Description */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-6">
            <h2 className="text-white font-bold mb-2">Come funziona</h2>
            <p className="text-white/70 text-sm leading-relaxed">
              Prima del torneo, tutti i partecipanti ricevono <strong className="text-yellow-300">500 crediti</strong> e partecipano a un'asta in stile fantasy.
              Le carte scorrono in ordine alfabetico (Personaggi → Mosse → Bonus) e voi fate offerte per costruire il vostro mazzo unico.
              Chi offre di più si aggiudica la carta! L'asta termina quando tutti hanno 33 personaggi, 33 mosse e 33 bonus.
              I CPU partecipano e rilanciano in modo automatico in base alla rarità della carta.
            </p>
          </div>

          {/* Create or join */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-4 text-base rounded-xl"
            >
              + Crea FantaTorneo
            </Button>
            <div className="flex gap-2">
              <Input
                placeholder="Codice sessione..."
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
                className="bg-gray-800 border-gray-600 text-white flex-1"
              />
              <Button
                onClick={handleJoinByCode}
                disabled={!joinCode.trim() || loading}
                className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-4"
              >
                Entra
              </Button>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-4 py-2 text-sm mb-4">
              {error}
            </div>
          )}

          {/* Session list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold">Sessioni disponibili</h3>
              <button onClick={fetchSessions} className="text-xs text-white/40 hover:text-white/70">
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
                {lobbySessions.map(s => (
                  <div key={s.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white">{s.creatorName}</div>
                      <div className="text-xs text-white/50">
                        {s.participantCount} partecipanti: {s.participants.join(', ')}
                      </div>
                      <div className="text-[10px] text-white/30 font-mono mt-1">{s.id}</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleJoin(s.id)}
                      disabled={loading}
                      className="bg-blue-700 hover:bg-blue-600 text-white font-bold"
                    >
                      Entra
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/70 z-60 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Crea FantaTorneo</h2>

            <div className="mb-4">
              <label className="text-sm text-white/70 mb-2 block">Giocatori CPU</label>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setCpuCount(n)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border ${cpuCount === n ? 'bg-yellow-600 border-yellow-500 text-black' : 'bg-gray-700 border-gray-600 text-white'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {cpuCount > 0 && (
              <div className="mb-4">
                <label className="text-sm text-white/70 mb-2 block">Livello CPU</label>
                <div className="flex gap-2">
                  {([['easy', 'Facile'], ['medium', 'Medio'], ['hard', 'Difficile']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setCpuLevel(val)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border ${cpuLevel === val ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-700 border-gray-600 text-white'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-white/40 mt-1">
                  {cpuLevel === 'easy' ? 'I CPU offrono raramente e poco' : cpuLevel === 'medium' ? 'I CPU offrono con moderazione' : 'I CPU sono molto aggressivi sulle carte rare'}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="flex-1 border-gray-600 text-white"
              >
                Annulla
              </Button>
              <Button
                onClick={handleCreate}
                disabled={loading}
                className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black font-bold"
              >
                {loading ? 'Creazione...' : 'Crea'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
