import React, { useState, useEffect } from 'react';
import { X, Trophy, Users, Plus, Play, ChevronRight, Award, Crown, Swords } from 'lucide-react';

interface Tournament {
  id: number;
  name: string;
  status: 'registration' | 'in_progress' | 'completed';
  maxParticipants: number;
  currentParticipants: number;
  prizePool: number;
  organizerId: number;
  startDate: string | null;
}

interface TournamentMatch {
  id: number;
  round: number;
  matchNumber: number;
  player1Id: number | null;
  player2Id: number | null;
  winnerId: number | null;
  status: 'pending' | 'in_progress' | 'completed';
  player1Name?: string;
  player2Name?: string;
}

interface TournamentPanelProps {
  userId: number;
  username: string;
  onClose: () => void;
  onJoinMatch?: (gameId: string, matchId: number, tournamentName: string) => void;
  pendingTournamentGame?: { gameId: string };
  onResumeGame?: (gameId: string) => void;
}

const PANEL_STYLES = `
  @keyframes shimmerGold {
    0%   { background-position: 0% 50%; }
    100% { background-position: 200% 50%; }
  }
  @keyframes trophyPulse {
    0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,0.3), 0 0 40px rgba(245,158,11,0.1); }
    50%       { box-shadow: 0 0 35px rgba(245,158,11,0.6), 0 0 70px rgba(245,158,11,0.25); }
  }
  @keyframes liveBlip {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(0.9); }
  }
`;

function StatusBadge({ status }: { status: string }) {
  if (status === 'registration') return (
    <span style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
      ✦ Iscrizioni aperte
    </span>
  );
  if (status === 'in_progress') return (
    <span style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
      ▶ In corso
    </span>
  );
  return (
    <span style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
      ✓ Completato
    </span>
  );
}

export function TournamentPanel({ userId, username, onClose, onJoinMatch, pendingTournamentGame, onResumeGame }: TournamentPanelProps) {
  const [view, setView] = useState<'list' | 'create' | 'bracket'>('list');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [bracketData, setBracketData] = useState<{ tournament: Tournament; matches: TournamentMatch[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const authToken = localStorage.getItem('authToken');

  const [formData, setFormData] = useState({
    name: '',
    maxParticipants: 8,
    prizePool: 100,
    entryFee: 0,
  });

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tournaments');
      const data = await res.json();
      if (data.success) setTournaments(data.tournaments);
    } catch (err) {
      console.error('Error fetching tournaments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBracket = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/bracket`);
      const data = await res.json();
      if (data.success) {
        setBracketData(data);
        setView('bracket');
      }
    } catch (err) {
      console.error('Error fetching bracket:', err);
      const res = await fetch(`/api/tournaments/${id}`);
      const fallbackData = await res.json();
      if (fallbackData.success) {
        const enrichedMatches = fallbackData.matches.map((m: any) => ({
          ...m,
          player1Name: fallbackData.participants.find((p: any) => p.userId === m.player1Id)?.username || 'TBD',
          player2Name: fallbackData.participants.find((p: any) => p.userId === m.player2Id)?.username || 'TBD',
        }));
        setBracketData({ tournament: fallbackData.tournament, matches: enrichedMatches });
        setView('bracket');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (id: number) => {
    try {
      const res = await fetch(`/api/tournaments/${id}/join`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) fetchTournaments();
      else alert(data.error || 'Errore durante l\'iscrizione');
    } catch (err) {
      console.error('Error joining tournament:', err);
    }
  };

  const handleStart = async (id: number) => {
    try {
      const res = await fetch(`/api/tournaments/${id}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) fetchTournaments();
      else alert(data.error || 'Errore durante l\'avvio');
    } catch (err) {
      console.error('Error starting tournament:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) { fetchTournaments(); setView('list'); }
      else alert(data.error || 'Errore durante la creazione');
    } catch (err) {
      console.error('Error creating tournament:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTournaments(); }, []);

  const totalRounds = bracketData ? Math.ceil(Math.log2(bracketData.tournament.maxParticipants)) : 0;

  return (
    <>
      <style>{PANEL_STYLES}</style>
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }} onClick={onClose} />

        <div style={{
          position: 'relative', width: '100%', maxWidth: 900, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', borderRadius: 28, overflow: 'hidden',
          background: 'linear-gradient(160deg, #0d1425 0%, #0a0f1e 50%, #0d1a0a 100%)',
          border: '1px solid rgba(245,158,11,0.2)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.8), inset 0 1px 0 rgba(245,158,11,0.1)',
        }}>
          {/* Gold accent line */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, transparent, #f59e0b, #fde68a, #f59e0b, transparent)', flexShrink: 0 }} />

          {/* Header */}
          <div style={{
            padding: '20px 24px', flexShrink: 0,
            borderBottom: '1px solid rgba(245,158,11,0.1)',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.06), transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {view !== 'list' && (
                <button
                  onClick={() => setView('list')}
                  style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(203,213,225,0.7)', flexShrink: 0 }}
                >
                  <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
                </button>
              )}
              <div style={{
                width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'trophyPulse 3s ease-in-out infinite',
              }}>
                <Trophy size={26} color="#fff" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #fde68a, #f59e0b, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {view === 'create' ? 'Crea Torneo' : view === 'bracket' && bracketData ? bracketData.tournament.name : 'Tornei Draft'}
                </h2>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(148,163,184,0.6)', marginTop: 2 }}>
                  {view === 'list' ? 'Competi per il montepremi finale' : view === 'create' ? 'Configura il tuo torneo' : 'Tabellone dei match'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {view === 'list' && (
                <button
                  onClick={() => setView('create')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
                  }}
                >
                  <Plus size={15} />
                  Crea
                </button>
              )}
              {view === 'bracket' && bracketData && (
                <StatusBadge status={bracketData.tournament.status} />
              )}
              <button
                onClick={onClose}
                style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(148,163,184,0.8)' }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, minHeight: 0 }}>

            {/* Riprendi partita banner */}
            {pendingTournamentGame && onResumeGame && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)', borderRadius: 16, padding: '12px 16px', marginBottom: 20 }}>
                <Swords size={18} color="#60a5fa" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#bfdbfe', lineHeight: 1.2 }}>Match torneo interrotto</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(96,165,250,0.6)', marginTop: 2 }}>La tua partita è ancora attiva sul server</p>
                </div>
                <button
                  onClick={() => onResumeGame(pendingTournamentGame.gameId)}
                  style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                >
                  Riprendi
                </button>
              </div>
            )}

            {/* ===== LIST VIEW ===== */}
            {view === 'list' && (
              <div>
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0', gap: 12, flexDirection: 'column' }}>
                    <div style={{ width: 40, height: 40, border: '3px solid rgba(245,158,11,0.15)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 13 }}>Caricamento tornei...</span>
                  </div>
                ) : tournaments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', borderRadius: 20, border: '1px dashed rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.03)' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
                    <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 15, margin: 0 }}>Nessun torneo disponibile.</p>
                    <p style={{ color: 'rgba(148,163,184,0.3)', fontSize: 13, margin: '8px 0 0' }}>Crea il primo torneo e sfida tutti!</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {tournaments.map((t) => {
                      const fillPct = Math.round((t.currentParticipants / t.maxParticipants) * 100);
                      const statusColor = t.status === 'registration' ? '#4ade80' : t.status === 'in_progress' ? '#60a5fa' : '#94a3b8';
                      const statusBg = t.status === 'registration' ? 'rgba(34,197,94,0.08)' : t.status === 'in_progress' ? 'rgba(59,130,246,0.08)' : 'rgba(100,116,139,0.05)';
                      return (
                        <div key={t.id} style={{
                          borderRadius: 20, overflow: 'hidden',
                          background: statusBg,
                          border: `1px solid ${statusColor}28`,
                          transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 16px 40px ${statusColor}18`; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                        >
                          {/* Card top bar */}
                          <div style={{ height: 3, background: `linear-gradient(90deg, ${statusColor}88, ${statusColor})` }} />

                          <div style={{ padding: '16px 18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                              <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                                <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</h4>
                                <StatusBadge status={t.status} />
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', color: '#f59e0b', fontWeight: 800, fontSize: 15 }}>
                                  <Award size={14} />
                                  {t.prizePool} PR
                                </div>
                              </div>
                            </div>

                            {/* Participants fill bar */}
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Users size={10} /> {t.currentParticipants}/{t.maxParticipants} giocatori
                                </span>
                                <span style={{ fontSize: 11, color: statusColor, fontWeight: 700 }}>{fillPct}%</span>
                              </div>
                              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${fillPct}%`, borderRadius: 3, background: `linear-gradient(90deg, ${statusColor}88, ${statusColor})`, transition: 'width 0.5s ease' }} />
                              </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 8 }}>
                              {t.status === 'registration' && (
                                <>
                                  <button
                                    onClick={() => handleJoin(t.id)}
                                    style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'background 0.2s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                  >
                                    Iscriviti
                                  </button>
                                  {t.organizerId === userId && t.currentParticipants >= 4 && (
                                    <button
                                      onClick={() => handleStart(t.id)}
                                      style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                    >
                                      <Play size={13} fill="white" />
                                      Avvia
                                    </button>
                                  )}
                                </>
                              )}
                              {(t.status === 'in_progress' || t.status === 'completed') && (
                                <button
                                  onClick={() => fetchBracket(t.id)}
                                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                >
                                  {t.status === 'in_progress' ? 'Bracket Live' : 'Vedi Bracket'}
                                  <ChevronRight size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ===== CREATE VIEW ===== */}
            {view === 'create' && (
              <div style={{ maxWidth: 480, margin: '0 auto' }}>
                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Nome torneo</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Es. Grand Prix d'Estate"
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: 12,
                        border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)',
                        color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={e => (e.target.style.borderColor = 'rgba(245,158,11,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(245,158,11,0.2)')}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Partecipanti</label>
                      <select
                        value={formData.maxParticipants}
                        onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })}
                        style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(245,158,11,0.2)', background: '#0a0f1e', color: '#e2e8f0', fontSize: 14, outline: 'none', cursor: 'pointer' }}
                      >
                        <option value={4}>4 giocatori</option>
                        <option value={8}>8 giocatori</option>
                        <option value={16}>16 giocatori</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Montepremi (PR)</label>
                      <input
                        type="number"
                        value={formData.prizePool}
                        onChange={(e) => setFormData({ ...formData, prizePool: parseInt(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)', color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Quota iscrizione (PR)</label>
                    <input
                      type="number"
                      value={formData.entryFee}
                      onChange={(e) => setFormData({ ...formData, entryFee: parseInt(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)', color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', marginTop: 8,
                      background: loading ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#000', fontWeight: 900, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
                      letterSpacing: '0.04em', textTransform: 'uppercase', boxShadow: loading ? 'none' : '0 8px 24px rgba(245,158,11,0.3)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {loading ? 'Creazione in corso...' : '🏆 Crea Torneo'}
                  </button>
                </form>
              </div>
            )}

            {/* ===== BRACKET VIEW ===== */}
            {view === 'bracket' && bracketData && (
              <div style={{ overflowX: 'auto', paddingBottom: 12 }}>
                <div style={{ display: 'inline-flex', gap: 20, minWidth: 'fit-content', paddingBottom: 8 }}>
                  {Array.from({ length: totalRounds }).map((_, roundIdx) => {
                    const roundNum = roundIdx + 1;
                    const roundMatches = bracketData.matches.filter(m => m.round === roundNum);
                    let roundTitle = `Round ${roundNum}`;
                    if (roundNum === totalRounds) roundTitle = '🏆 Finale';
                    else if (roundNum === totalRounds - 1) roundTitle = 'Semifinale';
                    const roundColors = ['#60a5fa', '#a78bfa', '#f59e0b', '#f472b6'];
                    const rc = roundColors[Math.min(roundIdx, roundColors.length - 1)];
                    return (
                      <div key={roundNum} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 220, flexShrink: 0 }}>
                        {/* Round label */}
                        <div style={{
                          textAlign: 'center', padding: '7px 12px', borderRadius: 10,
                          background: `${rc}18`, border: `1px solid ${rc}35`,
                          fontSize: 11, fontWeight: 900, color: rc, letterSpacing: '0.06em', textTransform: 'uppercase',
                        }}>
                          {roundTitle}
                        </div>

                        {/* Matches */}
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: 12, flex: 1 }}>
                          {roundMatches.map((match) => {
                            const isLive = match.status === 'in_progress';
                            const p1Won = match.winnerId && match.winnerId === match.player1Id;
                            const p2Won = match.winnerId && match.winnerId === match.player2Id;
                            return (
                              <div key={match.id} style={{ position: 'relative' }}>
                                {isLive && (
                                  <div style={{
                                    position: 'absolute', top: -10, right: 10, zIndex: 1,
                                    background: '#3b82f6', color: '#fff', fontSize: 9, fontWeight: 900,
                                    padding: '2px 8px', borderRadius: 20, letterSpacing: '0.1em',
                                    animation: 'liveBlip 1.2s ease-in-out infinite',
                                  }}>LIVE</div>
                                )}
                                <div style={{
                                  borderRadius: 14, overflow: 'hidden',
                                  border: isLive ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                                  background: isLive ? 'rgba(59,130,246,0.07)' : 'rgba(255,255,255,0.04)',
                                  boxShadow: isLive ? '0 0 20px rgba(59,130,246,0.15)' : 'none',
                                }}>
                                  {/* Player 1 */}
                                  <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '9px 12px',
                                    background: p1Won ? 'rgba(34,197,94,0.12)' : 'transparent',
                                    borderLeft: p1Won ? '3px solid #22c55e' : '3px solid transparent',
                                  }}>
                                    <span style={{ fontSize: 13, fontWeight: p1Won ? 800 : 500, color: p1Won ? '#4ade80' : (match.winnerId && !p1Won ? 'rgba(148,163,184,0.4)' : '#e2e8f0'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                                      {match.player1Name || '???'}
                                    </span>
                                    {p1Won && <Crown size={13} color="#4ade80" />}
                                  </div>

                                  {/* VS separator */}
                                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ position: 'absolute', background: '#0a0f1e', padding: '0 6px', fontSize: 9, color: 'rgba(148,163,184,0.3)', fontWeight: 800, letterSpacing: '0.1em' }}>VS</span>
                                  </div>

                                  {/* Player 2 */}
                                  <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '9px 12px',
                                    background: p2Won ? 'rgba(34,197,94,0.12)' : 'transparent',
                                    borderLeft: p2Won ? '3px solid #22c55e' : '3px solid transparent',
                                  }}>
                                    <span style={{ fontSize: 13, fontWeight: p2Won ? 800 : 500, color: p2Won ? '#4ade80' : (match.winnerId && !p2Won ? 'rgba(148,163,184,0.4)' : '#e2e8f0'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                                      {match.player2Name || '???'}
                                    </span>
                                    {p2Won && <Crown size={13} color="#4ade80" />}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {roundMatches.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(148,163,184,0.25)', fontSize: 12 }}>
                              In attesa...
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
