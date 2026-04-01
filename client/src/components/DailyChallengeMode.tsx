import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Clock, Trophy, Swords, ChevronRight } from 'lucide-react';
import { GameBoard } from './GameBoard';
import { socket } from '../lib/socket';
import { useGameState } from '../lib/stores/useGameState';
import { pauseHomeMusic, resumeHomeMusic } from './SpotifyPlayer';
import { DailyChallengeLeaderboard } from './DailyChallengeLeaderboard';
import { GuestWall } from './GuestWall';

interface DailyScenario {
  date: string;
  seed: number;
  playerCharacters: string[];
  playerMosse: string[];
  playerBonus: string[];
  cpuOpponents: Array<{
    level: 'easy' | 'medium' | 'hard';
    name: string;
    characters: string[];
    mosse: string[];
    bonus: string[];
  }>;
}

interface DailyChallengeModeProps {
  playerName: string;
  userId?: number;
  avatarId?: string | null;
  onBack: () => void;
  onLogin?: () => void;
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const DIFFICULTY_LABEL: Record<string, { label: string; color: string; emoji: string }> = {
  easy:   { label: 'Facile',    color: '#4ade80', emoji: '🟢' },
  medium: { label: 'Medio',     color: '#facc15', emoji: '🟡' },
  hard:   { label: 'Difficile', color: '#f87171', emoji: '🔴' },
};

type Phase = 'info' | 'playing' | 'result' | 'leaderboard';

const TOTAL_BATTLES = 3;

export function DailyChallengeMode({ playerName, userId, avatarId, onBack, onLogin }: DailyChallengeModeProps) {
  const [phase, setPhase]                   = useState<Phase>('info');
  const [loading, setLoading]               = useState(true);
  const [scenario, setScenario]             = useState<DailyScenario | null>(null);
  const [alreadyPlayed, setAlreadyPlayed]   = useState(false);
  const [playerScore, setPlayerScore]       = useState<any>(null);
  const [playerRank, setPlayerRank]         = useState<number | null>(null);
  const [secondsUntilReset, setSecondsUntilReset] = useState(0);
  const [gameId, setGameIdLocal]            = useState<string | null>(null);
  const [currentCpuIndex, setCurrentCpuIndex] = useState(0);
  const [battleWon, setBattleWon]           = useState(false);
  const [battlesWon, setBattlesWon]         = useState(0);
  const [submitting, setSubmitting]         = useState(false);
  const [submitResult, setSubmitResult]     = useState<{ totalScore: number; rank: number } | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [totalTurnsAcrossBattles, setTotalTurnsAcrossBattles] = useState(0);
  const [challengeFinished, setChallengeFinished] = useState(false);

  const gameIdRef             = useRef<string | null>(null);
  const cpuIndexRef           = useRef(0);
  const battleStartingRef     = useRef(false);
  const expectedCpusRef       = useRef(0);
  const cpusAddedRef          = useRef(0);
  const battlesWonRef         = useRef(0);
  const totalTurnsRef         = useRef(0);
  const submitCalledRef       = useRef(false);

  const { setGameId, setPlayerName: setGSPlayerName, generateSessionId, clearSession } = useGameState();

  const authToken = localStorage.getItem('authToken');

  useEffect(() => {
    if (!authToken) {
      setLoading(false);
      return;
    }
    fetch('/api/daily-challenge/scenario', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setScenario(d.scenario);
          setAlreadyPlayed(d.alreadyPlayed || false);
          setPlayerScore(d.playerScore || null);
          setPlayerRank(d.playerRank || null);
          setSecondsUntilReset(d.secondsUntilReset || 0);
        } else {
          setError(d.error || 'Errore nel caricamento della sfida');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Errore di rete');
        setLoading(false);
      });
  }, [authToken]);

  useEffect(() => {
    if (secondsUntilReset <= 0) return;
    const timer = setInterval(() => setSecondsUntilReset(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsUntilReset]);

  useEffect(() => { gameIdRef.current = gameId; }, [gameId]);
  useEffect(() => { cpuIndexRef.current = currentCpuIndex; }, [currentCpuIndex]);

  const handleSubmitFinalScore = useCallback(async () => {
    if (!authToken || submitCalledRef.current) return;
    submitCalledRef.current = true;
    setSubmitting(true);
    try {
      const r = await fetch('/api/daily-challenge/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          gameId: gameIdRef.current,
          battlesWon: battlesWonRef.current,
          totalTurns: totalTurnsRef.current,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setSubmitResult({ totalScore: d.totalScore, rank: d.rank });
        setPlayerRank(d.rank);
      }
    } catch (e) {
      console.error('[DailyChallenge] Error submitting score:', e);
    } finally {
      setSubmitting(false);
    }
  }, [authToken]);

  useEffect(() => {
    const handleGameVictory = ({
      winner,
      playerStats,
    }: {
      winner: string;
      playerStats?: Record<string, { turnsPlayed?: number }>;
    }) => {
      if (!gameIdRef.current) return;
      const won = winner?.toLowerCase() === playerName.toLowerCase();
      setBattleWon(won);

      const myTurns = playerStats?.[playerName]?.turnsPlayed || 0;
      totalTurnsRef.current += myTurns;
      setTotalTurnsAcrossBattles(totalTurnsRef.current);

      if (won) {
        battlesWonRef.current += 1;
        setBattlesWon(battlesWonRef.current);
      }

      const currentIdx = cpuIndexRef.current;
      const isLastBattle = currentIdx >= TOTAL_BATTLES - 1;
      const challengeEnded = isLastBattle || !won;

      if (challengeEnded) {
        setChallengeFinished(true);
      }

      setPhase('result');
    };

    const handleCpuAdded = () => {
      cpusAddedRef.current += 1;
      if (cpusAddedRef.current >= expectedCpusRef.current) {
        const gid = gameIdRef.current;
        if (gid) {
          setTimeout(() => {
            socket.emit('start-game', { gameId: gid, playerName, characterLimit: '3' });
          }, 400);
        }
      }
    };

    socket.on('game-victory', handleGameVictory);
    socket.on('training-cpu-added', handleCpuAdded);
    return () => {
      socket.off('game-victory', handleGameVictory);
      socket.off('training-cpu-added', handleCpuAdded);
    };
  }, [playerName]);

  useEffect(() => {
    if (challengeFinished && !submitCalledRef.current && !submitting) {
      handleSubmitFinalScore();
    }
  }, [challengeFinished]);

  const startBattle = useCallback(async (cpuIndex: number) => {
    if (!scenario || battleStartingRef.current) return;
    battleStartingRef.current = true;

    if (cpuIndex === 0 && authToken) {
      try {
        const r = await fetch('/api/daily-challenge/start-attempt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        });
        const d = await r.json();
        if (!d.success) {
          setAlreadyPlayed(true);
          battleStartingRef.current = false;
          return;
        }
        setAlreadyPlayed(true);
      } catch (e) {
        console.error('[DailyChallenge] Failed to record attempt:', e);
        battleStartingRef.current = false;
        return;
      }
    }

    clearSession();
    pauseHomeMusic();

    const cpu = scenario.cpuOpponents[cpuIndex];
    const newGameId = `daily-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setGameIdLocal(newGameId);
    gameIdRef.current = newGameId;
    setGameId(newGameId);
    setGSPlayerName(playerName);
    generateSessionId();

    expectedCpusRef.current = 1;
    cpusAddedRef.current = 0;

    const playerDeck = [
      ...scenario.playerCharacters,
      ...scenario.playerMosse,
      ...scenario.playerBonus,
    ];

    const cpuDeck = [
      ...cpu.characters,
      ...cpu.mosse,
      ...cpu.bonus,
    ];

    socket.emit('create-training-game', {
      gameId: newGameId,
      playerName,
      avatarId,
      userId,
      helpEnabled: false,
      isDailyChallenge: true,
      playerDeck: playerDeck.length > 0 ? playerDeck : undefined,
      livesCount: 3,
    });

    setTimeout(() => {
      socket.emit('add-training-cpu', {
        gameId: newGameId,
        isDailyChallenge: true,
        customDeck: cpuDeck.length > 0 ? cpuDeck : undefined,
        cpuLevel: cpu.level,
        leaderName: cpu.name,
        attackMode: 'hunt_human',
      });
    }, 800);

    setPhase('playing');
    battleStartingRef.current = false;
  }, [scenario, playerName, avatarId, userId, clearSession, setGameId, setGSPlayerName, generateSessionId, authToken]);

  const handleNextBattle = useCallback(() => {
    if (!scenario) return;
    const nextIdx = currentCpuIndex + 1;
    if (nextIdx < scenario.cpuOpponents.length) {
      setCurrentCpuIndex(nextIdx);
      cpuIndexRef.current = nextIdx;
      setBattleWon(false);
      startBattle(nextIdx);
    }
  }, [currentCpuIndex, scenario, startBattle]);

  if (!authToken) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a0618, #080f1c)', position: 'relative' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center' }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '8px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <ArrowLeft width={16} height={16} />
            Indietro
          </button>
        </div>
        <GuestWall onLogin={onLogin || (() => {})} featureName="la Sfida del Giorno" />
      </div>
    );
  }

  if (phase === 'leaderboard') {
    return (
      <DailyChallengeLeaderboard
        onClose={() => setPhase(alreadyPlayed ? 'result' : 'info')}
        currentUserId={userId}
        playerRank={playerRank}
        playerScore={playerScore}
      />
    );
  }

  if (phase === 'playing' && gameId) {
    return (
      <GameBoard
        onLeaveGame={() => {
          clearSession();
          resumeHomeMusic();
          setChallengeFinished(true);
          setPhase('result');
        }}
      />
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a0618, #080f1c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(234,179,8,0.2)', borderTopColor: '#eab308', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a0618, #080f1c)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 20 }}>
        <div style={{ color: '#f87171', fontSize: 18, textAlign: 'center' }}>{error}</div>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: 10, cursor: 'pointer' }}>Torna alla home</button>
      </div>
    );
  }

  if (phase === 'result') {
    const score = submitResult?.totalScore ?? 0;
    const rank  = submitResult?.rank ?? playerRank;
    const isLastBattle = currentCpuIndex >= TOTAL_BATTLES - 1;
    const fullChallengeWon = isLastBattle && battleWon;

    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a0618, #080f1c)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>{fullChallengeWon ? '🏆' : battleWon ? '⚔️' : '💔'}</div>
          <h1 style={{ color: 'white', fontSize: 26, fontWeight: 900, margin: 0 }}>
            {fullChallengeWon ? 'Sfida Completata!' : battleWon ? `Battaglia ${currentCpuIndex + 1}/${TOTAL_BATTLES} Vinta!` : 'Sconfitta'}
          </h1>
          {fullChallengeWon && <p style={{ color: '#eab308', marginTop: 8, fontSize: 15 }}>Hai superato tutti e 3 gli avversari!</p>}
          {!battleWon && !fullChallengeWon && (
            <p style={{ color: 'rgba(148,163,184,0.6)', marginTop: 8, fontSize: 14 }}>
              Battaglie vinte: {battlesWonRef.current}/{TOTAL_BATTLES}
            </p>
          )}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '20px 28px', textAlign: 'center', minWidth: 240 }}>
          <div style={{ color: 'rgba(148,163,184,0.6)', fontSize: 12, marginBottom: 6 }}>Punteggio finale</div>
          {submitting ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
              <div style={{ width: 28, height: 28, border: '2px solid rgba(234,179,8,0.2)', borderTopColor: '#eab308', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : challengeFinished ? (
            <>
              <div style={{ color: '#eab308', fontSize: 36, fontWeight: 900 }}>{score.toLocaleString('it-IT')}</div>
              {rank && <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: 13, marginTop: 4 }}>Posizione #{rank} in classifica</div>}
            </>
          ) : (
            <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: 14 }}>Continua per completare la sfida!</div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
          {!challengeFinished && battleWon && currentCpuIndex < TOTAL_BATTLES - 1 && (
            <button
              onClick={handleNextBattle}
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', color: 'white', padding: '14px 20px', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Swords width={18} height={18} />
              Prossimo Avversario
              <ChevronRight width={18} height={18} />
            </button>
          )}
          <button
            onClick={() => setPhase('leaderboard')}
            style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', color: '#eab308', padding: '12px 20px', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Trophy width={18} height={18} />
            Classifica del Giorno
          </button>
          <button
            onClick={() => { resumeHomeMusic(); onBack(); }}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Torna alla Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a0618, #080f1c, #0a0620)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(234,179,8,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backdropFilter: 'blur(10px)' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '8px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <ArrowLeft width={16} height={16} />
          Indietro
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock width={14} height={14} color="rgba(234,179,8,0.6)" />
          <span style={{ color: 'rgba(234,179,8,0.8)', fontSize: 13, fontWeight: 600 }}>Reset: {formatCountdown(secondsUntilReset)}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480, margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚔️</div>
          <h1 style={{ color: 'white', fontSize: 26, fontWeight: 900, margin: 0 }}>Sfida del Giorno</h1>
          <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: 14, marginTop: 6 }}>
            {scenario?.date || 'Oggi'} · Stesso scenario per tutti i giocatori
          </p>
        </div>

        {alreadyPlayed && playerScore && (
          <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 14, padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>✅ Sfida completata oggi!</div>
            <div style={{ color: 'rgba(148,163,184,0.6)', fontSize: 13 }}>
              Punteggio: <span style={{ color: '#eab308', fontWeight: 700 }}>{playerScore.totalScore.toLocaleString('it-IT')}</span>
              {playerRank && <span> · Posizione #{playerRank}</span>}
            </div>
          </div>
        )}
        {alreadyPlayed && !playerScore && (
          <div style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 14, padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ color: '#eab308', fontWeight: 700, fontSize: 14 }}>Hai già giocato la sfida di oggi.</div>
            <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: 12, marginTop: 4 }}>Torna domani per una nuova sfida!</div>
          </div>
        )}

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '18px 20px' }}>
          <h3 style={{ color: 'rgba(148,163,184,0.8)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>I tuoi avversari di oggi</h3>
          {scenario?.cpuOpponents.map((cpu, idx) => {
            const diff = DIFFICULTY_LABEL[cpu.level] || DIFFICULTY_LABEL.medium;
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: idx < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {diff.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>{cpu.name}</div>
                  <div style={{ color: diff.color, fontSize: 12, marginTop: 1 }}>Avversario {idx + 1}/{TOTAL_BATTLES} · {diff.label}</div>
                </div>
                <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: 12 }}>#{idx + 1}</div>
              </div>
            );
          })}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '18px 20px' }}>
          <h3 style={{ color: 'rgba(148,163,184,0.8)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>Formula Punteggio</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'PTI rimasti',        formula: '× 10',  color: '#67e8f9' },
              { label: 'Stelle rimaste',     formula: '× 50',  color: '#eab308' },
              { label: 'Mosse speciali',     formula: '× 30',  color: '#c084fc' },
              { label: 'Turni impiegati',    formula: '× -5',  color: '#f87171' },
            ].map(({ label, formula, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(148,163,184,0.7)', fontSize: 13 }}>{label}</span>
                <span style={{ color, fontSize: 13, fontWeight: 700 }}>{formula}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!alreadyPlayed ? (
            <button
              onClick={() => startBattle(0)}
              style={{ background: 'linear-gradient(135deg, #eab308, #f97316)', border: 'none', color: 'white', padding: '16px 20px', borderRadius: 14, fontSize: 17, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 0 30px rgba(234,179,8,0.3)' }}
            >
              <Swords width={20} height={20} />
              Inizia la Sfida
            </button>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 20px', textAlign: 'center', color: 'rgba(148,163,184,0.5)', fontSize: 14 }}>
              Hai già giocato oggi. Torna domani per una nuova sfida!
            </div>
          )}
          <button
            onClick={() => setPhase('leaderboard')}
            style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', color: '#eab308', padding: '13px 20px', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Trophy width={18} height={18} />
            Classifica del Giorno
          </button>
        </div>
      </div>
    </div>
  );
}

export default DailyChallengeMode;
