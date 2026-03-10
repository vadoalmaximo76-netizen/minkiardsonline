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
  const [totalParticipants, setTotalParticipants] = useState(2);
  const [cpuLevel, setCpuLevel] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [auctionCredits, setAuctionCredits] = useState<Record<string, number>>({});

  const fetchSessions = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch('/api/fanta/sessions', { headers });
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
    const cpuCount = totalParticipants - 1;
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
  const cpuCount = totalParticipants - 1;

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
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col items-center justify-center p-8">
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="text-3xl font-bold text-yellow-400 mb-2">Asta Completata!</h2>
        <p className="text-white/70 text-center mb-8">
          Tutti i partecipanti hanno il loro mazzo pronto.<br />
          Ora potete creare una partita in modalità Draft usando i vostri mazzi FantaMinkiards!
        </p>
        <div className="space-y-2 mb-8 w-full max-w-md">
          {participants.map(p => (
            <div key={p.name} className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-2">
              <span className="font-bold text-white">{p.name}{p.isCPU ? ' 🤖' : ''}</span>
              <span className="text-gray-400 text-sm">
                {p.deck.personaggi.length}P · {p.deck.mosse.length}M · {p.deck.bonus.length}B
              </span>
              <span className="text-yellow-300 text-sm ml-auto">{p.credits} cr</span>
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
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-950 border-b border-gray-800 flex-shrink-0">
          <button onClick={handleLeave} className="text-white/50 hover:text-white text-sm font-medium">← Esci</button>
          <span className="text-base font-bold text-yellow-400">⭐ FantaMinkiards</span>
          <div className="text-[10px] text-white/30 font-mono bg-gray-800 px-2 py-1 rounded">
            #{fantaId.slice(-6)}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-lg mx-auto">
            <h2 className="text-xl font-bold text-white mb-1 text-center">Sala d'Attesa</h2>
            <p className="text-white/50 text-sm text-center mb-4">
              {isCreator ? 'Condividi il codice con gli altri giocatori' : "Aspetta che il creatore avvii l'asta"}
            </p>

            {/* Participants */}
            <div className="mb-4">
              <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
                Partecipanti ({participants.length})
              </div>
              <div className="space-y-1.5">
                {participants.map(p => (
                  <div key={p.name} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2.5">
                    <span className="text-lg">{p.isCPU ? '🤖' : '👤'}</span>
                    <span className="font-bold text-white text-sm flex-1">{p.name}</span>
                    {p.name === currentSession.creatorName && (
                      <span className="text-xs bg-yellow-700/60 text-yellow-300 px-2 py-0.5 rounded font-semibold">Creator</span>
                    )}
                    <span className="text-yellow-300 text-sm font-black tabular-nums">{p.credits} cr</span>
                  </div>
                ))}
              </div>
            </div>

            {/* How it works */}
            <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50 mb-4 text-sm text-white/60">
              <div className="font-bold text-white/80 mb-2">Come funziona:</div>
              <ul className="space-y-1 list-disc list-inside text-xs leading-relaxed">
                <li>Ogni giocatore inizia con <span className="text-yellow-300 font-bold">500 crediti</span></li>
                <li>Le carte scorrono in ordine alfabetico: prima Personaggi, poi Mosse, poi Bonus</li>
                <li>Fai offerte per aggiudicarti le carte che vuoi</li>
                <li>L'asta finisce quando tutti hanno 33+33+33 carte</li>
                <li>I CPU rilanciano automaticamente in base alla rarità della carta</li>
              </ul>
            </div>

            {/* Codice da condividere */}
            {isCreator && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-3 mb-4">
                <div className="text-xs text-white/40 mb-1">Codice sessione da condividere:</div>
                <div className="font-mono text-sm text-white/80 break-all select-all">{fantaId}</div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky start button */}
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-950 border-b border-gray-800 flex-shrink-0">
        <button onClick={onClose} className="text-white/50 hover:text-white text-sm font-medium">← Indietro</button>
        <h1 className="text-lg font-bold text-yellow-400">⭐ FantaMinkiards</h1>
        <div className="w-16" />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto">

          {/* Description */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-5">
            <h2 className="text-white font-bold mb-1">Come funziona</h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Prima del torneo, tutti i partecipanti ricevono <strong className="text-yellow-300">500 crediti</strong> e partecipano a un'asta.
              Le carte scorrono in ordine alfabetico e voi fate offerte per costruire il vostro mazzo unico.
              Chi offre di più si aggiudica la carta! I CPU partecipano e rilanciano automaticamente.
            </p>
          </div>

          {/* Create */}
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 text-base rounded-xl mb-4 shadow-lg shadow-yellow-500/10"
          >
            + Crea FantaTorneo
          </Button>

          {/* Join by code */}
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
              Entra
            </Button>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-4 py-2 text-sm mb-4">
              ⚠️ {error}
            </div>
          )}

          {/* Session list */}
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
                {lobbySessions.map(s => (
                  <div key={s.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm">{s.creatorName}</div>
                      <div className="text-xs text-white/50 mt-0.5">
                        {s.participantCount} partecipanti: {(s.participants ?? []).join(', ')}
                      </div>
                      <div className="text-[10px] text-white/25 font-mono mt-1 truncate">{s.id}</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleJoin(s.id)}
                      disabled={loading}
                      className="bg-blue-700 hover:bg-blue-600 text-white font-bold flex-shrink-0"
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
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-gray-800 rounded-t-2xl sm:rounded-2xl border border-gray-700 p-6 w-full sm:max-w-md">
            <h2 className="text-xl font-bold text-white mb-5">Crea FantaTorneo</h2>

            {/* Total participants (2-32) */}
            <div className="mb-5">
              <label className="text-sm font-semibold text-white/80 mb-1 block">
                Partecipanti totali: <span className="text-yellow-300">{totalParticipants}</span>
                <span className="text-white/40 text-xs ml-1">({totalParticipants - 1} CPU + tu)</span>
              </label>
              <input
                type="range"
                min={2}
                max={32}
                value={totalParticipants}
                onChange={e => setTotalParticipants(Number(e.target.value))}
                className="w-full accent-yellow-500 h-2 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-white/30 mt-1">
                <span>2</span>
                <span>8</span>
                <span>16</span>
                <span>24</span>
                <span>32</span>
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                {[2, 4, 8, 16, 32].map(n => (
                  <button
                    key={n}
                    onClick={() => setTotalParticipants(n)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${
                      totalParticipants === n
                        ? 'bg-yellow-500 border-yellow-400 text-black'
                        : 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* CPU level */}
            <div className="mb-6">
              <label className="text-sm font-semibold text-white/80 mb-2 block">Livello CPU</label>
              <div className="flex gap-2">
                {([['easy', 'Facile'], ['medium', 'Medio'], ['hard', 'Difficile']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setCpuLevel(val)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold border transition-all ${
                      cpuLevel === val
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="text-xs text-white/40 mt-1.5">
                {cpuLevel === 'easy' ? 'I CPU offrono raramente e poco' : cpuLevel === 'medium' ? 'I CPU offrono con moderazione' : 'I CPU sono molto aggressivi sulle carte rare'}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-700/40 rounded-lg px-4 py-3 mb-5 text-sm text-white/60">
              Torneo da <strong className="text-white">{totalParticipants} partecipanti</strong>:
              tu + <strong className="text-yellow-300">{cpuCount} CPU</strong>.
              Gli amici possono entrare con il codice sessione.
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="flex-1 border-gray-600 text-white h-12"
              >
                Annulla
              </Button>
              <Button
                onClick={handleCreate}
                disabled={loading}
                className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black h-12 text-base"
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
