import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy, Users, Plus, Play, ChevronRight, ChevronLeft, X, Crown,
  Star, Sword, Shield, Award, Search, Send, Eye, Zap, Clock,
  CheckCircle, AlertCircle, RefreshCw, User, Bot, Settings, Gift,
  BarChart2, Calendar, Layers
} from 'lucide-react';
import { playUISound } from '../lib/uiSound';

type CompetitionType = 'torneo_classico' | 'torneo_draft' | 'campionato_classico' | 'campionato_draft';

const COMP_TYPE_INFO: Record<CompetitionType, { label: string; icon: React.ReactNode; desc: string; type: string; gameMode: string; color: string }> = {
  torneo_classico: {
    label: 'Torneo Classico',
    icon: <Trophy size={28} />,
    desc: 'Eliminazione diretta con il mazzo completo. Chi perde è fuori.',
    type: 'elimination',
    gameMode: 'classic',
    color: '#f59e0b',
  },
  torneo_draft: {
    label: 'Torneo Draft',
    icon: <Layers size={28} />,
    desc: 'Eliminazione diretta con il proprio mazzo Draft.',
    type: 'elimination',
    gameMode: 'draft',
    color: '#8b5cf6',
  },
  campionato_classico: {
    label: 'Campionato Classico',
    icon: <BarChart2 size={28} />,
    desc: 'Tutti contro tutti con calendario e classifica. 2 punti per vittoria.',
    type: 'round_robin',
    gameMode: 'classic',
    color: '#3b82f6',
  },
  campionato_draft: {
    label: 'Campionato Draft',
    icon: <Calendar size={28} />,
    desc: 'Tutti contro tutti con il proprio mazzo Draft. 2 punti per vittoria.',
    type: 'round_robin',
    gameMode: 'draft',
    color: '#10b981',
  },
};

function CompetitionTypeSelector({ onSelect, onClose }: { onSelect: (t: CompetitionType) => void; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(6px)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
        border: '1px solid #334155', borderRadius: 20,
        width: 560, maxWidth: '95vw', maxHeight: '95vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          background: 'linear-gradient(90deg, #7c3aed22 0%, #1d4ed822 100%)',
          borderBottom: '1px solid #334155', padding: '18px 24px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Trophy size={22} color="#f59e0b" />
          <div style={{ flex: 1 }}>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 17 }}>Tipo di Competizione</div>
            <div style={{ color: '#64748b', fontSize: 12 }}>Scegli il formato della tua competizione</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {(Object.entries(COMP_TYPE_INFO) as [CompetitionType, typeof COMP_TYPE_INFO[CompetitionType]][]).map(([key, info]) => (
            <button
              key={key}
              onClick={() => { onSelect(key); playUISound('open'); }}
              style={{
                background: 'linear-gradient(135deg, #1e293b, #1a1f35)',
                border: `1px solid ${info.color}44`,
                borderRadius: 14, padding: '18px 16px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 10,
                textAlign: 'left', transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = info.color;
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 20px ${info.color}22`;
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = `${info.color}44`;
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
                (e.currentTarget as HTMLButtonElement).style.transform = '';
              }}
            >
              <div style={{ color: info.color }}>{info.icon}</div>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>{info.label}</div>
              <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.4 }}>{info.desc}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ background: info.color + '22', border: `1px solid ${info.color}44`, borderRadius: 6, padding: '2px 8px', fontSize: 11, color: info.color }}>
                  {info.type === 'elimination' ? 'Eliminazione' : 'Girone'}
                </span>
                <span style={{ background: '#334155', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#94a3b8' }}>
                  {info.gameMode === 'draft' ? '🃏 Draft' : '📦 Classico'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TournamentParticipant {
  id: number;
  userId: number | null;
  isCpu: boolean;
  displayName: string;
  username?: string;
  avatar?: number | null;
  status: string;
  placement: number | null;
  wins: number;
  losses: number;
  disqualifiedAt?: string | null;
  disqualificationReason?: string | null;
}

interface TournamentMatch {
  id: number;
  round: number;
  matchNumber: number;
  player1Id: number | null;
  player2Id: number | null;
  playerIds: (number | null)[];
  winnerId: number | null;
  status: string;
  gameId: string | null;
  scheduledAt?: string | null;
  note?: string | null;
}

interface Tournament {
  id: number;
  name: string;
  description: string | null;
  type: string;
  gameMode: string;
  status: string;
  maxParticipants: number;
  currentParticipants: number;
  playersPerMatch: number;
  cpuCount: number;
  prizePool: number;
  entryFee: number;
  winnerRewardMultiplier: number;
  runnerUpRewardMultiplier: number;
  organizerId: number;
  organizerName?: string;
  winnerId: number | null;
  startDate: string | null;
  endDate: string | null;
  estimatedWinnerPrize?: number;
  estimatedRunnerUpPrize?: number;
  isOfficial: boolean;
  createdAt: string;
}

interface Props {
  userId: number;
  username: string;
  puntiRankiard: number;
  userEmail: string;
  onClose: () => void;
  onPlayMatch?: (gameId: string, matchId: number, tournamentName: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  registration: 'Iscrizioni',
  closed: 'Chiuso',
  in_progress: 'In Corso',
  completed: 'Completato',
  cancelled: 'Annullato',
};

const STATUS_COLORS: Record<string, string> = {
  registration: '#22c55e',
  closed: '#f97316',
  in_progress: '#3b82f6',
  completed: '#8b5cf6',
  cancelled: '#6b7280',
};

const MATCH_STATUS_LABELS: Record<string, string> = {
  pending: 'In attesa',
  in_progress: 'In corso',
  completed: 'Completato',
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#6b7280';
  return (
    <span style={{
      background: color + '22',
      color: color,
      border: `1px solid ${color}44`,
      borderRadius: 20,
      padding: '2px 10px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

// ─── Bracket Visualizer ───────────────────────────────────────────────────────

function BracketView({
  matches,
  participantNames,
  userId,
  tournamentName,
  onPlayMatch,
}: {
  matches: TournamentMatch[];
  participantNames: Record<number, string>;
  userId: number;
  tournamentName?: string;
  onPlayMatch?: (gameId: string, matchId: number, name: string) => void;
}) {
  if (!matches.length) return (
    <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
      Il tabellone sarà generato all'avvio del torneo.
    </div>
  );

  const maxRound = Math.max(...matches.map(m => m.round));

  const getName = (id: number | null | undefined): string => {
    if (id == null) return 'BYE';
    if (id < 0) return participantNames[id] || 'CPU';
    return participantNames[id] || `Giocatore #${id}`;
  };

  const rounds: TournamentMatch[][] = [];
  for (let r = 1; r <= maxRound; r++) {
    rounds.push(matches.filter(m => m.round === r).sort((a, b) => a.matchNumber - b.matchNumber));
  }

  const roundLabels: Record<number, string> = {};
  if (maxRound >= 1) roundLabels[maxRound] = 'Finale';
  if (maxRound >= 2) roundLabels[maxRound - 1] = 'Semifinale';
  if (maxRound >= 3) roundLabels[maxRound - 2] = 'Quarti';

  return (
    <div style={{ overflowX: 'auto', padding: '16px 0' }}>
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', minWidth: 'max-content' }}>
        {rounds.map((roundMatches, ri) => {
          const round = ri + 1;
          const label = roundLabels[round] || `Round ${round}`;
          return (
            <div key={round} style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', minWidth: 200 }}>
              <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                {label}
              </div>
              {roundMatches.map(match => {
                const players: (number | null)[] = (match.playerIds && (match.playerIds as any[]).length > 0)
                  ? (match.playerIds as any[])
                  : [match.player1Id, match.player2Id];

                return (
                  <div key={match.id} style={{
                    background: '#1e293b',
                    border: `1px solid ${match.status === 'completed' ? '#8b5cf6' : '#334155'}`,
                    borderRadius: 10,
                    overflow: 'hidden',
                    width: 200,
                    boxShadow: match.status === 'completed' ? '0 0 12px #8b5cf644' : undefined,
                  }}>
                    <div style={{
                      background: '#0f172a',
                      padding: '4px 10px',
                      fontSize: 10,
                      color: '#64748b',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}>
                      <span>Match #{match.matchNumber}</span>
                      <span style={{ color: STATUS_COLORS[match.status] || '#64748b' }}>
                        {MATCH_STATUS_LABELS[match.status] || match.status}
                      </span>
                    </div>
                    {players.map((pid, pi) => {
                      const name = getName(pid);
                      const isWinner = pid != null && match.winnerId != null && pid === match.winnerId;
                      const isMe = pid === userId || pid === -userId;
                      return (
                        <div key={pi} style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          background: isWinner ? '#7c3aed22' : 'transparent',
                          borderTop: pi > 0 ? '1px solid #1e293b' : undefined,
                          fontWeight: isMe ? 700 : 400,
                          color: isWinner ? '#a78bfa' : (pid == null ? '#374151' : '#e2e8f0'),
                          fontSize: 13,
                        }}>
                          {isWinner && <Crown size={12} color="#f59e0b" />}
                          {pid != null && pid < 0 && <Bot size={11} color="#64748b" />}
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name}
                          </span>
                          {isMe && <span style={{ fontSize: 10, color: '#3b82f6' }}>Tu</span>}
                        </div>
                      );
                    })}
                    {(() => {
                      const isUserInMatch = players.includes(userId);
                      const canPlay = isUserInMatch && match.status === 'pending' && match.gameId && onPlayMatch;
                      if (!canPlay) return null;
                      return (
                        <button
                          onClick={() => onPlayMatch!(match.gameId!, match.id, tournamentName || 'Torneo')}
                          style={{
                            width: '100%',
                            padding: '7px 0',
                            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                            borderTop: '1px solid #4f46e5',
                          }}
                        >
                          <Play size={12} /> Gioca Adesso
                        </button>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          );
        })}
        {/* Trophy at the end if completed */}
        {matches.some(m => m.round === maxRound && m.status === 'completed') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 32 }}>
            <Trophy size={40} color="#f59e0b" />
            <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 12 }}>Campione</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tournament Detail Modal ───────────────────────────────────────────────────

function TournamentDetailModal({
  tournament,
  participants,
  matches,
  participantNames,
  userId,
  userEmail,
  onClose,
  onJoin,
  onStart,
  onInvite,
  onPlayMatch,
  onDelete,
}: {
  tournament: Tournament;
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  participantNames: Record<number, string>;
  userId: number;
  userEmail: string;
  onClose: () => void;
  onJoin: () => void;
  onStart: () => void;
  onInvite: () => void;
  onPlayMatch?: (gameId: string, matchId: number, tournamentName: string) => void;
  onDelete?: () => void;
}) {
  const isRoundRobin = tournament.type === 'round_robin';
  const [tab, setTab] = useState<'info' | 'bracket' | 'partecipanti' | 'classifica'>('info');

  const [standings, setStandings] = useState<any[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);

  const [scheduleMatch, setScheduleMatch] = useState<TournamentMatch | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [disqualifyParticipant, setDisqualifyParticipant] = useState<TournamentParticipant | null>(null);
  const [disqualifyReason, setDisqualifyReason] = useState('');
  const [disqualifyLoading, setDisqualifyLoading] = useState(false);

  const [walkoverMatch, setWalkoverMatch] = useState<TournamentMatch | null>(null);
  const [walkoverWinnerId, setWalkoverWinnerId] = useState<number | null>(null);
  const [walkoverReason, setWalkoverReason] = useState('');
  const [walkoverLoading, setWalkoverLoading] = useState(false);

  const [adminToast, setAdminToast] = useState('');
  const showAdminToast = (msg: string) => { setAdminToast(msg); setTimeout(() => setAdminToast(''), 3500); };

  const authToken = localStorage.getItem('authToken');

  const handleSchedule = async () => {
    if (!scheduleMatch) return;
    setScheduleLoading(true);
    try {
      const res = await fetch(`/api/tournaments/matches/${scheduleMatch.id}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ scheduledAt: scheduleDate || null }),
      });
      const data = await res.json();
      if (data.success) { showAdminToast('Data impostata e notifica inviata ai giocatori!'); setScheduleMatch(null); }
      else showAdminToast(data.error || 'Errore');
    } catch { showAdminToast('Errore di rete'); }
    finally { setScheduleLoading(false); }
  };

  const handleDisqualify = async () => {
    if (!disqualifyParticipant || !disqualifyReason.trim()) return;
    setDisqualifyLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/disqualify/${disqualifyParticipant.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ reason: disqualifyReason }),
      });
      const data = await res.json();
      if (data.success) { showAdminToast('Giocatore squalificato.'); setDisqualifyParticipant(null); }
      else showAdminToast(data.error || 'Errore');
    } catch { showAdminToast('Errore di rete'); }
    finally { setDisqualifyLoading(false); }
  };

  const handleWalkover = async () => {
    if (!walkoverMatch || walkoverWinnerId == null || !walkoverReason.trim()) return;
    setWalkoverLoading(true);
    try {
      const res = await fetch(`/api/tournaments/matches/${walkoverMatch.id}/walkover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ winnerId: walkoverWinnerId, reason: walkoverReason }),
      });
      const data = await res.json();
      if (data.success) { showAdminToast('Risultato a tavolino registrato!'); setWalkoverMatch(null); }
      else showAdminToast(data.error || 'Errore');
    } catch { showAdminToast('Errore di rete'); }
    finally { setWalkoverLoading(false); }
  };

  const isOrganizer = tournament.organizerId === userId;
  const isAdmin = userEmail === 'lucaforte94@gmail.com';
  const isParticipant = participants.some(p => p.userId === userId);
  const canJoin = !isParticipant && tournament.status === 'registration' && tournament.currentParticipants < tournament.maxParticipants;
  const canStart = (isOrganizer || isAdmin) && (tournament.status === 'registration' || tournament.status === 'closed') && participants.length >= 2;

  const pendingMatches = matches.filter(m => m.status === 'pending' || m.status === 'in_progress');
  const myPendingMatches = pendingMatches.filter(m => {
    const pids: (number | null)[] = (m.playerIds && (m.playerIds as any[]).length > 0)
      ? (m.playerIds as any[]) : [m.player1Id, m.player2Id];
    return pids.includes(userId);
  });

  useEffect(() => {
    if (tab === 'classifica' && isRoundRobin) {
      setStandingsLoading(true);
      fetch(`/api/tournaments/${tournament.id}/standings`)
        .then(r => r.json())
        .then(d => { if (d.success) setStandings(d.standings || []); })
        .catch(() => {})
        .finally(() => setStandingsLoading(false));
    }
  }, [tab, tournament.id, isRoundRobin]);

  const TABS = [
    { key: 'info' as const, label: 'Info' },
    { key: 'bracket' as const, label: isRoundRobin ? 'Calendario' : 'Tabellone' },
    { key: 'partecipanti' as const, label: `Partecipanti (${participants.length})` },
    ...(isRoundRobin ? [{ key: 'classifica' as const, label: '🏆 Classifica' }] : []),
  ];

  const getName = (id: number | null | undefined): string => {
    if (id == null) return 'BYE';
    if (id < 0) return participantNames[id] || 'CPU';
    return participantNames[id] || `Giocatore #${id}`;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(6px)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        border: '1px solid #334155',
        borderRadius: 20,
        width: '96vw',
        maxWidth: 860,
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(90deg, #7c3aed22 0%, #1d4ed822 100%)',
          borderBottom: '1px solid #334155',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <Trophy size={24} color="#f59e0b" />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 18 }}>{tournament.name}</div>
              {tournament.isOfficial && (
                <span style={{
                  background: 'linear-gradient(135deg, #b45309, #d97706)',
                  borderRadius: 6, padding: '2px 8px',
                  fontSize: 10, fontWeight: 800, color: '#fff',
                  letterSpacing: 1, textTransform: 'uppercase',
                }}>⭐ UFFICIALE</span>
              )}
            </div>
            <div style={{ color: '#64748b', fontSize: 12 }}>Organizzato da {tournament.organizerName}</div>
          </div>
          <StatusBadge status={tournament.status} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', background: '#0f172a' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); playUISound('click'); }}
              style={{
                flex: 1, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t.key ? '#a78bfa' : '#64748b',
                fontWeight: tab === t.key ? 700 : 400, fontSize: 13,
                borderBottom: tab === t.key ? '2px solid #7c3aed' : '2px solid transparent',
                transition: 'all 0.2s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {tab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
                {[
                  { icon: Users, label: 'Partecipanti', value: `${tournament.currentParticipants}/${tournament.maxParticipants}` },
                  { icon: Sword, label: 'Per Partita', value: `${tournament.playersPerMatch} giocatori` },
                  { icon: Bot, label: 'CPU', value: tournament.cpuCount > 0 ? `${tournament.cpuCount} bot` : 'Nessuno' },
                  { icon: Crown, label: 'Premio 1°', value: `${tournament.estimatedWinnerPrize ?? (tournament.winnerRewardMultiplier * tournament.currentParticipants)} PR` },
                  { icon: Award, label: 'Premio 2°', value: `${tournament.estimatedRunnerUpPrize ?? (tournament.runnerUpRewardMultiplier * tournament.currentParticipants)} PR` },
                  { icon: Gift, label: 'Iscrizione', value: tournament.entryFee > 0 ? `${tournament.entryFee} PR` : 'Gratuito' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} style={{
                    background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
                    padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <Icon size={18} color="#7c3aed" />
                    <div>
                      <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                      <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14, marginTop: 2 }}>{value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {tournament.description && (
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '14px 16px', color: '#94a3b8', fontSize: 14 }}>
                  {tournament.description}
                </div>
              )}

              {/* My pending matches */}
              {myPendingMatches.length > 0 && (
                <div style={{ background: '#1e3a5f', border: '1px solid #1d4ed8', borderRadius: 12, padding: 16 }}>
                  <div style={{ color: '#60a5fa', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sword size={16} /> Le tue partite
                  </div>
                  {myPendingMatches.map(m => {
                    const pids: (number | null)[] = (m.playerIds && (m.playerIds as any[]).length > 0)
                      ? (m.playerIds as any[]) : [m.player1Id, m.player2Id];
                    return (
                      <div key={m.id} style={{ marginBottom: 8 }}>
                        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Round {m.round} • Match #{m.matchNumber}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          {pids.filter(Boolean).map(pid => (
                            <span key={pid} style={{
                              background: pid === userId ? '#1d4ed822' : '#1e293b',
                              border: `1px solid ${pid === userId ? '#3b82f6' : '#334155'}`,
                              borderRadius: 6, padding: '3px 8px', fontSize: 12, color: '#e2e8f0',
                            }}>
                              {getName(pid)}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {canJoin && (
                  <button onClick={() => { onJoin(); playUISound('open'); }}
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)', border: 'none', borderRadius: 10, color: 'white', padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={16} /> Iscriviti
                    {tournament.entryFee > 0 && <span style={{ background: '#ffffff22', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>−{tournament.entryFee} PR</span>}
                  </button>
                )}
                {canStart && (
                  <button onClick={() => { onStart(); playUISound('open'); }}
                    style={{ background: 'linear-gradient(135deg,#059669,#0891b2)', border: 'none', borderRadius: 10, color: 'white', padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Play size={16} /> Avvia Torneo
                  </button>
                )}
                {(tournament.status === 'registration') && (
                  <button onClick={() => { onInvite(); playUISound('click'); }}
                    style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#94a3b8', padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Send size={15} /> Invita Giocatore
                  </button>
                )}
                {(isOrganizer || isAdmin) && tournament.status !== 'completed' && onDelete && (
                  <button onClick={() => {
                    if (window.confirm('Sei sicuro di voler eliminare questo torneo?')) {
                      onDelete();
                      playUISound('back' as any);
                    }
                  }}
                    style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: 10, color: '#ef4444', padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <X size={15} /> Elimina Torneo
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === 'bracket' && (
            <div>
              <BracketView
                matches={matches}
                participantNames={participantNames}
                userId={userId}
                tournamentName={tournament.name}
                onPlayMatch={onPlayMatch}
              />
              {isAdmin && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Settings size={14} /> Utilità Admin
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('authToken');
                        const r = await fetch('/api/push/test', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                        const d = await r.json();
                        if (d.success) showAdminToast('Test push inviato — controlla le notifiche');
                        else showAdminToast('Errore: ' + (d.error || 'sconosciuto'));
                      } catch (e: any) { showAdminToast('Errore: ' + e.message); }
                    }}
                    style={{ background: '#0f172a', border: '1px solid #7c3aed', borderRadius: 8, color: '#a78bfa', padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 600, marginBottom: 12 }}>
                    🔔 Invia notifica push di test
                  </button>
                </div>
              )}
              {isAdmin && tournament.status !== 'completed' && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Settings size={14} /> Controlli Admin — Partite
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {matches.filter(m => m.status !== 'completed').map(m => {
                      const pids: (number | null)[] = (m.playerIds && (m.playerIds as any[]).length > 0) ? (m.playerIds as any[]) : [m.player1Id, m.player2Id];
                      const humanPids = pids.filter((p): p is number => p !== null && p > 0);
                      const dateStr = m.scheduledAt ? new Date(m.scheduledAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
                      return (
                        <div key={m.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: '#94a3b8', fontSize: 12 }}>R{m.round} M{m.matchNumber}</div>
                            <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>
                              {pids.filter(Boolean).map(p => getName(p)).join(' vs ')}
                            </div>
                            {dateStr && <div style={{ color: '#60a5fa', fontSize: 11, marginTop: 2 }}>📅 {dateStr}</div>}
                            {m.note && <div style={{ color: '#f59e0b', fontSize: 11, marginTop: 2 }}>📝 {m.note}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => { setScheduleMatch(m); setScheduleDate(m.scheduledAt ? new Date(m.scheduledAt).toISOString().slice(0, 16) : ''); }}
                              style={{ background: '#0f172a', border: '1px solid #3b82f6', borderRadius: 6, color: '#60a5fa', padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                              📅 Programma
                            </button>
                            {humanPids.length >= 2 && (
                              <button
                                onClick={() => { setWalkoverMatch(m); setWalkoverWinnerId(null); setWalkoverReason(''); }}
                                style={{ background: '#0f172a', border: '1px solid #f59e0b', borderRadius: 6, color: '#fbbf24', padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                                ⚖️ A Tavolino
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {matches.filter(m => m.status !== 'completed').length === 0 && (
                      <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Tutte le partite sono completate</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'partecipanti' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {participants.length === 0 && (
                <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>Nessun partecipante</div>
              )}
              {participants.map(p => (
                <div key={p.id} style={{
                  background: '#1e293b', border: `1px solid ${p.userId === userId ? '#3b82f6' : '#334155'}`,
                  borderRadius: 10, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  {p.isCpu ? <Bot size={20} color="#64748b" /> : <User size={20} color="#7c3aed" />}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14 }}>
                      {p.username || p.displayName}
                      {p.userId === userId && <span style={{ color: '#3b82f6', fontSize: 11, marginLeft: 6 }}>(Tu)</span>}
                      {p.isCpu && <span style={{ color: '#64748b', fontSize: 11, marginLeft: 6 }}>CPU</span>}
                      {p.disqualifiedAt && <span style={{ color: '#ef4444', fontSize: 11, marginLeft: 6 }}>❌ Squalificato</span>}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>
                      V: {p.wins} / S: {p.losses}
                      {p.placement && <span style={{ marginLeft: 8, color: p.placement === 1 ? '#f59e0b' : '#94a3b8' }}>#{p.placement}</span>}
                      {p.disqualificationReason && <span style={{ marginLeft: 8, color: '#ef444488', fontStyle: 'italic' }}>{p.disqualificationReason}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isAdmin && !p.isCpu && !p.disqualifiedAt && tournament.status !== 'completed' && (
                      <button
                        onClick={() => { setDisqualifyParticipant(p); setDisqualifyReason(''); }}
                        style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: 6, color: '#ef4444', padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                        Squalifica
                      </button>
                    )}
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'classifica' && isRoundRobin && (
            <div>
              {standingsLoading ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>Caricamento classifica...</div>
              ) : standings.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>Nessun dato disponibile</div>
              ) : (
                <div>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>
                    Vittorie = 2 punti · Sconfitte = 0 punti
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
                        <th style={{ padding: '8px 10px', color: '#64748b', textAlign: 'center', width: 36 }}>#</th>
                        <th style={{ padding: '8px 10px', color: '#64748b', textAlign: 'left' }}>Giocatore</th>
                        <th style={{ padding: '8px 10px', color: '#64748b', textAlign: 'center' }}>G</th>
                        <th style={{ padding: '8px 10px', color: '#64748b', textAlign: 'center' }}>V</th>
                        <th style={{ padding: '8px 10px', color: '#64748b', textAlign: 'center' }}>S</th>
                        <th style={{ padding: '8px 10px', color: '#f59e0b', textAlign: 'center', fontWeight: 700 }}>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((s, i) => {
                        const isMe = s.userId === userId;
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
                        return (
                          <tr key={s.participantId} style={{
                            background: isMe ? '#1e3a5f' : i % 2 === 0 ? '#1e293b' : '#0f172a',
                            borderBottom: '1px solid #1e293b',
                          }}>
                            <td style={{ padding: '10px', textAlign: 'center', color: i < 3 ? '#f59e0b' : '#64748b', fontWeight: 700 }}>
                              {medal || i + 1}
                            </td>
                            <td style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                              {s.isCpu ? <Bot size={16} color="#64748b" /> : <User size={16} color="#7c3aed" />}
                              <span style={{ color: '#f1f5f9', fontWeight: isMe ? 700 : 400 }}>
                                {s.displayName}
                                {isMe && <span style={{ color: '#3b82f6', fontSize: 11, marginLeft: 6 }}>(Tu)</span>}
                              </span>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>{s.played}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#22c55e' }}>{s.wins}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#ef4444' }}>{s.losses}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#f59e0b', fontWeight: 700, fontSize: 16 }}>{s.points}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Admin Toast */}
      {adminToast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', border: '1px solid #7c3aed', borderRadius: 12,
          padding: '12px 24px', color: '#f1f5f9', fontWeight: 600, fontSize: 14,
          zIndex: 10000, boxShadow: '0 8px 32px #7c3aed44',
        }}>{adminToast}</div>
      )}

      {/* Schedule Modal */}
      {scheduleMatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setScheduleMatch(null); }}>
          <div style={{ background: '#1e293b', border: '1px solid #3b82f6', borderRadius: 16, padding: 24, width: 360, maxWidth: '95vw' }}>
            <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>📅 Programma Partita</div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
              R{scheduleMatch.round} M{scheduleMatch.matchNumber}
            </div>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6 }}>Data e ora (lasciar vuoto per rimuovere)</div>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', padding: '10px 12px', fontSize: 14, boxSizing: 'border-box', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setScheduleMatch(null)} style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', padding: '10px', cursor: 'pointer', fontWeight: 600 }}>
                Annulla
              </button>
              <button onClick={handleSchedule} disabled={scheduleLoading} style={{ flex: 2, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', borderRadius: 8, color: 'white', padding: '10px', cursor: 'pointer', fontWeight: 700 }}>
                {scheduleLoading ? '...' : 'Salva Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disqualify Modal */}
      {disqualifyParticipant && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setDisqualifyParticipant(null); }}>
          <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: 16, padding: 24, width: 380, maxWidth: '95vw' }}>
            <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>❌ Squalifica Giocatore</div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
              {disqualifyParticipant.username || disqualifyParticipant.displayName}
            </div>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6 }}>Motivazione *</div>
            <textarea
              value={disqualifyReason}
              onChange={e => setDisqualifyReason(e.target.value)}
              rows={3} placeholder="Inserisci la motivazione della squalifica..."
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', padding: '10px 12px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDisqualifyParticipant(null)} style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', padding: '10px', cursor: 'pointer', fontWeight: 600 }}>
                Annulla
              </button>
              <button onClick={handleDisqualify} disabled={disqualifyLoading || !disqualifyReason.trim()} style={{ flex: 2, background: 'linear-gradient(135deg,#b91c1c,#ef4444)', border: 'none', borderRadius: 8, color: 'white', padding: '10px', cursor: 'pointer', fontWeight: 700, opacity: disqualifyReason.trim() ? 1 : 0.5 }}>
                {disqualifyLoading ? '...' : 'Conferma Squalifica'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Walkover Modal */}
      {walkoverMatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setWalkoverMatch(null); }}>
          <div style={{ background: '#1e293b', border: '1px solid #f59e0b', borderRadius: 16, padding: 24, width: 400, maxWidth: '95vw' }}>
            <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>⚖️ Risultato A Tavolino</div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>R{walkoverMatch.round} M{walkoverMatch.matchNumber}</div>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6 }}>Seleziona il vincitore *</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {(() => {
                const pids: (number | null)[] = (walkoverMatch.playerIds && (walkoverMatch.playerIds as any[]).length > 0)
                  ? (walkoverMatch.playerIds as any[])
                  : [walkoverMatch.player1Id, walkoverMatch.player2Id];
                return pids.filter((p): p is number => p !== null && p > 0).map(pid => (
                  <button key={pid} onClick={() => setWalkoverWinnerId(pid)}
                    style={{ background: walkoverWinnerId === pid ? '#78350f' : '#0f172a', border: `1px solid ${walkoverWinnerId === pid ? '#f59e0b' : '#334155'}`, borderRadius: 8, color: walkoverWinnerId === pid ? '#fde68a' : '#94a3b8', padding: '10px 14px', cursor: 'pointer', fontWeight: walkoverWinnerId === pid ? 700 : 400, textAlign: 'left' }}>
                    {getName(pid)}
                  </button>
                ));
              })()}
            </div>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6 }}>Motivazione *</div>
            <textarea
              value={walkoverReason}
              onChange={e => setWalkoverReason(e.target.value)}
              rows={2} placeholder="Es. Giocatore non presentato nei termini..."
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', padding: '10px 12px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setWalkoverMatch(null)} style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', padding: '10px', cursor: 'pointer', fontWeight: 600 }}>
                Annulla
              </button>
              <button onClick={handleWalkover} disabled={walkoverLoading || walkoverWinnerId == null || !walkoverReason.trim()} style={{ flex: 2, background: 'linear-gradient(135deg,#78350f,#d97706)', border: 'none', borderRadius: 8, color: 'white', padding: '10px', cursor: 'pointer', fontWeight: 700, opacity: (walkoverWinnerId != null && walkoverReason.trim()) ? 1 : 0.5 }}>
                {walkoverLoading ? '...' : 'Assegna Risultato'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invite Modal ──────────────────────────────────────────────────────────────

function InviteModal({ tournamentId, tournamentName, onClose }: { tournamentId: number; tournamentName: string; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: number; username: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<number[]>([]);
  const authToken = localStorage.getItem('authToken');

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${authToken}` } });
      const data = await res.json();
      if (data.success) setResults(data.users);
    } finally { setLoading(false); }
  }, [authToken]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  const invite = async (targetUserId: number) => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ targetUserId }),
      });
      if (res.ok) { setSent(prev => [...prev, targetUserId]); playUISound('open'); }
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#1e293b', border: '1px solid #334155', borderRadius: 16,
        width: 420, maxWidth: '95vw', padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Send size={18} color="#7c3aed" /> Invita a {tournamentName}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
        </div>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cerca username..."
            style={{
              width: '100%', padding: '10px 10px 10px 34px', background: '#0f172a',
              border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 14,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        {loading && <div style={{ color: '#64748b', textAlign: 'center', fontSize: 13, padding: 8 }}>Ricerca...</div>}
        {results.map(u => (
          <div key={u.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            background: '#0f172a', borderRadius: 8, marginBottom: 6,
          }}>
            <User size={16} color="#7c3aed" />
            <span style={{ flex: 1, color: '#e2e8f0', fontSize: 14 }}>{u.username}</span>
            {sent.includes(u.id) ? (
              <span style={{ color: '#22c55e', fontSize: 12 }}>✓ Inviato</span>
            ) : (
              <button onClick={() => invite(u.id)} style={{
                background: '#7c3aed', border: 'none', borderRadius: 6, color: 'white',
                padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
              }}>Invita</button>
            )}
          </div>
        ))}
        {!loading && query.length >= 2 && results.length === 0 && (
          <div style={{ color: '#64748b', textAlign: 'center', fontSize: 13, padding: 12 }}>Nessun utente trovato</div>
        )}
      </div>
    </div>
  );
}

// ─── Create Tournament Wizard ─────────────────────────────────────────────────

function CreateWizard({
  userId,
  userEmail,
  puntiRankiard,
  onClose,
  onCreated,
  competitionType,
}: {
  userId: number;
  userEmail: string;
  puntiRankiard: number;
  onClose: () => void;
  onCreated: () => void;
  competitionType: CompetitionType;
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const authToken = localStorage.getItem('authToken');
  const isAdmin = userEmail === 'lucaforte94@gmail.com';
  const compInfo = COMP_TYPE_INFO[competitionType];
  const isCampionato = compInfo.type === 'round_robin';

  const [form, setForm] = useState({
    name: '',
    description: '',
    maxParticipants: 8,
    playersPerMatch: 2,
    cpuCount: 0,
    cpuNames: '' as string,
    entryFee: 0,
    winnerRewardMultiplier: 20,
    runnerUpRewardMultiplier: 5,
    characterLimit: '3' as string,
    isOfficial: false,
  });

  const setField = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const totalSlots = form.maxParticipants;
  const humanSlots = totalSlots - form.cpuCount;
  const estimatedWinner = form.winnerRewardMultiplier * totalSlots;
  const estimatedRunnerUp = form.runnerUpRewardMultiplier * totalSlots;

  const STEPS = ['Base', 'Formato', 'CPU & Premi', 'Conferma'];

  const canProceed = () => {
    if (step === 1) return form.name.trim().length >= 3;
    if (step === 2) return form.maxParticipants >= 2 && form.playersPerMatch >= 2;
    if (step === 3) return form.cpuCount >= 0 && form.cpuCount < form.maxParticipants;
    return true;
  };

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const cpuNamesList = form.cpuNames
        .split(',').map(n => n.trim()).filter(Boolean);
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          maxParticipants: form.maxParticipants,
          playersPerMatch: isCampionato ? 2 : form.playersPerMatch,
          cpuCount: form.cpuCount,
          cpuNames: cpuNamesList,
          entryFee: form.entryFee,
          winnerRewardMultiplier: isAdmin ? form.winnerRewardMultiplier : undefined,
          runnerUpRewardMultiplier: isAdmin ? form.runnerUpRewardMultiplier : undefined,
          settings: { characterLimit: form.characterLimit },
          type: compInfo.type,
          gameMode: compInfo.gameMode,
          isOfficial: isAdmin ? form.isOfficial : false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        playUISound('open');
        onCreated();
      } else {
        setError(data.error || 'Errore creazione torneo');
      }
    } catch (e) {
      setError('Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: '#0f172a',
    border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(6px)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
        border: '1px solid #334155', borderRadius: 20,
        width: 520, maxWidth: '95vw', maxHeight: '95vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #1e293b',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ color: compInfo.color }}>{compInfo.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 17 }}>Crea {compInfo.label}</div>
            <div style={{ color: compInfo.color, fontSize: 11 }}>{compInfo.type === 'round_robin' ? 'Girone all\'italiana' : 'Eliminazione diretta'} · {compInfo.gameMode === 'draft' ? 'Draft' : 'Classico'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', padding: '12px 24px', gap: 8 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: i + 1 < step ? '#7c3aed' : i + 1 === step ? '#a78bfa' : '#1e293b',
                border: `2px solid ${i + 1 === step ? '#a78bfa' : '#334155'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: i + 1 <= step ? 'white' : '#64748b', fontSize: 12, fontWeight: 700,
              }}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 10, color: i + 1 === step ? '#a78bfa' : '#64748b', textAlign: 'center' }}>{s}</div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 24px' }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={labelStyle}>Nome Torneo *</div>
                <input value={form.name} onChange={e => setField('name', e.target.value)}
                  placeholder="Es. Campionato Estivo" style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>Descrizione (opzionale)</div>
                <textarea value={form.description} onChange={e => setField('description', e.target.value)}
                  placeholder="Descrivi il torneo..." rows={3}
                  style={{ ...inputStyle, resize: 'vertical' as const }} />
              </div>
              {isAdmin && (
                <button
                  onClick={() => setField('isOfficial', !form.isOfficial)}
                  style={{
                    background: form.isOfficial
                      ? 'linear-gradient(135deg, #78350f, #b45309)'
                      : '#1e293b',
                    border: `1px solid ${form.isOfficial ? '#d97706' : '#334155'}`,
                    borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                    transition: 'all 0.2s',
                  }}>
                  <span style={{ fontSize: 22 }}>⭐</span>
                  <div>
                    <div style={{ color: form.isOfficial ? '#fde68a' : '#94a3b8', fontWeight: 700, fontSize: 14 }}>
                      Competizione Ufficiale
                    </div>
                    <div style={{ color: form.isOfficial ? '#fbbf24' : '#64748b', fontSize: 12 }}>
                      {form.isOfficial
                        ? 'Gli iscritti riceveranno notifiche push — appare in cima alla lista'
                        : 'Attiva per rendere questa competizione ufficiale (solo admin)'}
                    </div>
                  </div>
                  <div style={{
                    marginLeft: 'auto',
                    width: 40, height: 22, borderRadius: 11,
                    background: form.isOfficial ? '#d97706' : '#334155',
                    position: 'relative', transition: 'background 0.2s',
                  }}>
                    <div style={{
                      position: 'absolute', top: 3, left: form.isOfficial ? 21 : 3,
                      width: 16, height: 16, borderRadius: '50%', background: 'white',
                      transition: 'left 0.2s',
                    }} />
                  </div>
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={labelStyle}>Max Partecipanti</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[4, 8, 16, 32].map(n => (
                    <button key={n} onClick={() => { setField('maxParticipants', n); if (form.cpuCount > n - 1) setField('cpuCount', Math.max(0, n - 1)); }}
                      style={{
                        background: form.maxParticipants === n ? '#7c3aed' : '#1e293b',
                        border: `1px solid ${form.maxParticipants === n ? '#7c3aed' : '#334155'}`,
                        borderRadius: 8, color: form.maxParticipants === n ? 'white' : '#94a3b8',
                        padding: '8px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                      }}>
                      {n}
                    </button>
                  ))}
                  <input type="number" min={2} max={64} value={form.maxParticipants}
                    onChange={e => { const v = parseInt(e.target.value) || 8; setField('maxParticipants', v); }}
                    style={{ ...inputStyle, width: 80 }} />
                </div>
              </div>
              {!isCampionato && (
                <div>
                  <div style={labelStyle}>Giocatori per Partita</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[2, 3, 4, 5, 6, 7, 8].map(n => (
                      <button key={n} onClick={() => setField('playersPerMatch', n)}
                        style={{
                          background: form.playersPerMatch === n ? '#7c3aed' : '#1e293b',
                          border: `1px solid ${form.playersPerMatch === n ? '#7c3aed' : '#334155'}`,
                          borderRadius: 8, color: form.playersPerMatch === n ? 'white' : '#94a3b8',
                          padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                          minWidth: 42, textAlign: 'center',
                        }}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
                    Ogni partita del bracket avrà <span style={{ color: '#a78bfa', fontWeight: 700 }}>{form.playersPerMatch} partecipanti</span> — il torneo si organizza automaticamente
                  </div>
                </div>
              )}
              {isCampionato && (
                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ color: '#64748b', fontSize: 12 }}>📅 <strong style={{ color: '#94a3b8' }}>Campionato:</strong> Ogni partita è 1 vs 1. Il calendario completo viene generato automaticamente all'avvio.</div>
                </div>
              )}
              <div>
                <div style={labelStyle}>Personaggi prima dell'eliminazione</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(['1', '2', '3', '5', 'unlimited'] as const).map(v => (
                    <button key={v} onClick={() => setField('characterLimit', v)}
                      style={{
                        background: form.characterLimit === v ? '#0ea5e9' : '#1e293b',
                        border: `1px solid ${form.characterLimit === v ? '#0ea5e9' : '#334155'}`,
                        borderRadius: 8, color: form.characterLimit === v ? 'white' : '#94a3b8',
                        padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                        minWidth: 42, textAlign: 'center',
                      }}>
                      {v === 'unlimited' ? '∞' : v}
                    </button>
                  ))}
                </div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
                  Un concorrente viene eliminato dopo la morte di{' '}
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                    {form.characterLimit === 'unlimited' ? 'tutti i' : form.characterLimit}
                  </span>{' '}
                  personagg{form.characterLimit === '1' ? 'io' : 'i'}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Quota di Iscrizione (PR)</div>
                <input type="number" min={0} value={form.entryFee}
                  onChange={e => setField('entryFee', parseInt(e.target.value) || 0)}
                  style={inputStyle} />
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>0 = iscrizione gratuita</div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={labelStyle}>Giocatori CPU ({form.cpuCount}/{totalSlots - 1} max)</div>
                <input type="range" min={0} max={totalSlots - 1} value={form.cpuCount}
                  onChange={e => setField('cpuCount', parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#7c3aed' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  <span>0 CPU</span>
                  <span style={{ color: '#a78bfa', fontWeight: 700 }}>{form.cpuCount} CPU selezionati</span>
                  <span>{totalSlots - 1} CPU max</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Posti umani disponibili: <span style={{ color: '#22c55e', fontWeight: 700 }}>{humanSlots}</span>
                </div>
              </div>
              {form.cpuCount > 0 && (
                <div>
                  <div style={labelStyle}>Nomi CPU (separati da virgola, opzionale)</div>
                  <input value={form.cpuNames}
                    onChange={e => setField('cpuNames', e.target.value)}
                    placeholder="Es. CPU-Principiante, CPU-Esperto, ..."
                    style={inputStyle} />
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    Lascia vuoto per nomi automatici
                  </div>
                </div>
              )}
              {isAdmin && (
                <div style={{ background: '#1e293b', border: '1px solid #f59e0b33', borderRadius: 12, padding: 16 }}>
                  <div style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Settings size={14} /> Impostazioni Admin
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={labelStyle}>Moltiplicatore 1° posto</div>
                      <input type="number" min={1} max={1000} value={form.winnerRewardMultiplier}
                        onChange={e => setField('winnerRewardMultiplier', parseInt(e.target.value) || 20)}
                        style={inputStyle} />
                    </div>
                    <div>
                      <div style={labelStyle}>Moltiplicatore 2° posto</div>
                      <input type="number" min={0} max={500} value={form.runnerUpRewardMultiplier}
                        onChange={e => setField('runnerUpRewardMultiplier', parseInt(e.target.value) || 5)}
                        style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}
              {/* Preview */}
              <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 14 }}>
                <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Anteprima Premi</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Crown size={16} color="#f59e0b" />
                    <div>
                      <div style={{ color: '#64748b', fontSize: 10 }}>1° posto</div>
                      <div style={{ color: '#f59e0b', fontWeight: 700 }}>{estimatedWinner} PR</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Award size={16} color="#94a3b8" />
                    <div>
                      <div style={{ color: '#64748b', fontSize: 10 }}>2° posto</div>
                      <div style={{ color: '#94a3b8', fontWeight: 700 }}>{estimatedRunnerUp} PR</div>
                    </div>
                  </div>
                </div>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>
                  * Premio basato su {totalSlots} partecipanti totali (inclusi CPU)
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 20 }}>
                <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{form.name}</div>
                {form.description && <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>{form.description}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                  {[
                    ['Max Partecipanti', form.maxParticipants],
                    ['Per Partita', `${form.playersPerMatch} giocatori`],
                    ['Eliminazione dopo', form.characterLimit === 'unlimited' ? '∞ personaggi' : `${form.characterLimit} personagg${form.characterLimit === '1' ? 'io' : 'i'}`],
                    ['CPU', form.cpuCount > 0 ? `${form.cpuCount} bot` : 'Nessuno'],
                    ['Iscrizione', form.entryFee > 0 ? `${form.entryFee} PR` : 'Gratuita'],
                    ['Premio 1°', `${estimatedWinner} PR`],
                    ['Premio 2°', `${estimatedRunnerUp} PR`],
                  ].map(([l, v]) => (
                    <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #334155' }}>
                      <span style={{ color: '#64748b', fontSize: 13 }}>{l}</span>
                      <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              {error && (
                <div style={{ background: '#7f1d1d', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13 }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #1e293b',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <button
            onClick={() => { if (step > 1) { setStep(s => s - 1); playUISound('back' as any); } else onClose(); }}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#94a3b8', padding: '9px 20px', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ChevronLeft size={16} /> {step === 1 ? 'Annulla' : 'Indietro'}
          </button>
          {step < 4 ? (
            <button
              disabled={!canProceed()}
              onClick={() => { setStep(s => s + 1); playUISound('click'); }}
              style={{ background: canProceed() ? 'linear-gradient(135deg,#7c3aed,#2563eb)' : '#1e293b', border: 'none', borderRadius: 10, color: canProceed() ? 'white' : '#4b5563', padding: '9px 24px', cursor: canProceed() ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              Avanti <ChevronRight size={16} />
            </button>
          ) : (
            <button
              disabled={loading}
              onClick={handleCreate}
              style={{ background: loading ? '#1e293b' : 'linear-gradient(135deg,#059669,#0891b2)', border: 'none', borderRadius: 10, color: 'white', padding: '9px 24px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              {loading ? <><RefreshCw size={15} className="animate-spin" /> Creazione...</> : <><Trophy size={15} /> Crea Torneo</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tournament Card ───────────────────────────────────────────────────────────

function TournamentCard({ tournament, onClick }: { tournament: Tournament; onClick: () => void }) {
  const fillPct = (tournament.currentParticipants / tournament.maxParticipants) * 100;
  return (
    <div
      onClick={onClick}
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #1a1f35 100%)',
        border: '1px solid #334155',
        borderRadius: 16,
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#7c3aed';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px #7c3aed22';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#334155';
        (e.currentTarget as HTMLDivElement).style.transform = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
      }}
    >
      {/* Glow accent */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 120, height: 120,
        background: STATUS_COLORS[tournament.status] + '11',
        borderRadius: '0 0 0 120px',
        pointerEvents: 'none',
      }} />

      {tournament.isOfficial && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'linear-gradient(135deg, #b45309, #d97706)',
          borderRadius: 6, padding: '2px 8px',
          fontSize: 10, fontWeight: 800, color: '#fff',
          letterSpacing: 1, textTransform: 'uppercase',
          boxShadow: '0 0 10px #f59e0b55',
          zIndex: 1,
        }}>⭐ UFFICIALE</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1, paddingRight: tournament.isOfficial ? 80 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>{tournament.name}</div>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }}>
            {tournament.type === 'round_robin'
              ? <span style={{ background: '#1d4ed822', border: '1px solid #3b82f644', borderRadius: 4, padding: '1px 6px', fontSize: 10, color: '#60a5fa' }}>📅 Campionato</span>
              : <span style={{ background: '#78350f22', border: '1px solid #f59e0b44', borderRadius: 4, padding: '1px 6px', fontSize: 10, color: '#fbbf24' }}>⚔️ Torneo</span>
            }
            {tournament.gameMode === 'draft'
              ? <span style={{ background: '#4c1d9522', border: '1px solid #8b5cf644', borderRadius: 4, padding: '1px 6px', fontSize: 10, color: '#a78bfa' }}>🃏 Draft</span>
              : <span style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4, padding: '1px 6px', fontSize: 10, color: '#64748b' }}>📦 Classico</span>
            }
          </div>
          <div style={{ color: '#64748b', fontSize: 11 }}>Org: {tournament.organizerName}</div>
        </div>
        <StatusBadge status={tournament.status} />
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: '#94a3b8', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Users size={11} /> {tournament.currentParticipants}/{tournament.maxParticipants}
          </span>
          <span style={{ color: '#64748b', fontSize: 11 }}>{Math.round(fillPct)}%</span>
        </div>
        <div style={{ height: 4, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${fillPct}%`, background: STATUS_COLORS[tournament.status], borderRadius: 4, transition: 'width 0.5s' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Crown size={12} color="#f59e0b" />
          <span style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700 }}>
            {tournament.estimatedWinnerPrize ?? tournament.winnerRewardMultiplier * tournament.currentParticipants} PR
          </span>
        </div>
        {tournament.cpuCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Bot size={12} color="#64748b" />
            <span style={{ color: '#64748b', fontSize: 12 }}>{tournament.cpuCount} CPU</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Sword size={12} color="#64748b" />
          <span style={{ color: '#64748b', fontSize: 12 }}>{tournament.playersPerMatch} per partita</span>
        </div>
        {tournament.entryFee > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Gift size={12} color="#64748b" />
            <span style={{ color: '#64748b', fontSize: 12 }}>{tournament.entryFee} PR</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ClassicTournamentHub({ userId, username, puntiRankiard, userEmail, onClose, onPlayMatch }: Props) {
  const [tab, setTab] = useState<'esplora' | 'miei' | 'crea'>('esplora');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showTypeSelect, setShowTypeSelect] = useState(false);
  const [selectedCompType, setSelectedCompType] = useState<CompetitionType>('torneo_classico');
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<{
    tournament: Tournament;
    participants: TournamentParticipant[];
    matches: TournamentMatch[];
    participantNames: Record<number, string>;
  } | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteTournament, setInviteTournament] = useState<Tournament | null>(null);
  const [toast, setToast] = useState('');

  const authToken = localStorage.getItem('authToken');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tournaments', { headers: { Authorization: `Bearer ${authToken}` } });
      const data = await res.json();
      if (data.success) setTournaments(data.tournaments);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  const fetchDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/tournaments/${id}`, { headers: { Authorization: `Bearer ${authToken}` } });
      const data = await res.json();
      if (data.success) {
        setDetailData({
          tournament: data.tournament,
          participants: data.participants,
          matches: data.matches,
          participantNames: data.participantNames,
        });
        setSelectedTournamentId(id);
      }
    } catch (e) {
      console.error(e);
    }
  }, [authToken]);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  const handleJoin = async () => {
    if (!selectedTournamentId) return;
    try {
      const res = await fetch(`/api/tournaments/${selectedTournamentId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        showToast('Iscrizione completata!');
        playUISound('open');
        await fetchDetail(selectedTournamentId);
        fetchTournaments();
      } else {
        showToast(data.error || 'Errore iscrizione');
      }
    } catch (e) { showToast('Errore di rete'); }
  };

  const handleStart = async () => {
    if (!selectedTournamentId) return;
    try {
      const res = await fetch(`/api/tournaments/${selectedTournamentId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        showToast('Torneo avviato! Tabellone generato.');
        playUISound('open');
        await fetchDetail(selectedTournamentId);
        fetchTournaments();
      } else {
        showToast(data.error || 'Errore avvio torneo');
      }
    } catch (e) { showToast('Errore di rete'); }
  };

  const handleDelete = async () => {
    if (!selectedTournamentId) return;
    try {
      const res = await fetch(`/api/tournaments/${selectedTournamentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        showToast('Torneo eliminato');
        setDetailData(null);
        setSelectedTournamentId(null);
        fetchTournaments();
      } else {
        showToast(data.error || 'Errore eliminazione torneo');
      }
    } catch (e) { showToast('Errore di rete'); }
  };

  const myTournaments = tournaments.filter(t =>
    detailData?.participants.some(p => p.userId === userId) ||
    t.organizerId === userId
  );

  const displayedTournaments = (tab === 'miei'
    ? tournaments.filter(t => t.organizerId === userId)
    : tournaments
  ).slice().sort((a, b) => {
    if (a.isOfficial && !b.isOfficial) return -1;
    if (!a.isOfficial && b.isOfficial) return 1;
    return 0;
  });

  const TABS = [
    { key: 'esplora', label: 'Esplora', icon: Search },
    { key: 'miei', label: 'I Miei', icon: User },
    { key: 'crea', label: 'Crea', icon: Plus },
  ] as const;

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(160deg, #0a0f1e 0%, #0f0a2e 50%, #0a0f1e 100%)',
      color: '#f1f5f9', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(90deg, #1a0a3e 0%, #0a1a3e 50%, #0e1a3e 100%)',
        borderBottom: '1px solid #1e293b',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
      }}>
        <button onClick={onClose}
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={18} />
        </button>
        <Trophy size={28} color="#f59e0b" />
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#f1f5f9', letterSpacing: -0.3 }}>Tornei Classici</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Sfida i migliori giocatori</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={fetchTournaments}
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#64748b', padding: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Stats bar */}
      <div style={{
        background: '#0f172a', borderBottom: '1px solid #1e293b',
        display: 'flex', padding: '10px 24px', gap: 24, flexShrink: 0,
      }}>
        {[
          { label: 'Tornei Attivi', value: tournaments.filter(t => t.status === 'in_progress').length, color: '#3b82f6' },
          { label: 'Iscrizioni Aperte', value: tournaments.filter(t => t.status === 'registration').length, color: '#22c55e' },
          { label: 'Completati', value: tournaments.filter(t => t.status === 'completed').length, color: '#8b5cf6' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ color: '#64748b', fontSize: 11 }}>{label}:</span>
            <span style={{ color, fontWeight: 700, fontSize: 13 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', background: '#0a0f1e', flexShrink: 0 }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key}
            onClick={() => { setTab(key); playUISound('click'); if (key === 'crea') { setShowTypeSelect(true); } }}
            style={{
              flex: 1, padding: '13px 0', background: 'none', border: 'none',
              cursor: 'pointer', color: tab === key ? '#a78bfa' : '#64748b',
              fontWeight: tab === key ? 700 : 400, fontSize: 13,
              borderBottom: tab === key ? '2px solid #7c3aed' : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.2s',
            }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Tournament list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Caricamento tornei...</span>
          </div>
        )}
        {!loading && displayedTournaments.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <Trophy size={48} color="#1e293b" />
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {tab === 'miei' ? 'Non hai tornei' : 'Nessun torneo disponibile'}
            </div>
            <div style={{ fontSize: 13 }}>
              {tab === 'miei' ? 'Crea il tuo primo torneo!' : 'Sii il primo a creare un torneo!'}
            </div>
            <button
              onClick={() => { setShowTypeSelect(true); playUISound('open'); }}
              style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)', border: 'none', borderRadius: 10, color: 'white', padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={16} /> Crea Torneo
            </button>
          </div>
        )}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
            {displayedTournaments.map(t => (
              <TournamentCard key={t.id} tournament={t} onClick={() => { fetchDetail(t.id); playUISound('open'); }} />
            ))}
          </div>
        )}
      </div>

      {/* FAB Create */}
      {tab !== 'crea' && (
        <button
          onClick={() => { setShowTypeSelect(true); playUISound('open'); }}
          style={{
            position: 'absolute', bottom: 24, right: 24,
            background: 'linear-gradient(135deg,#7c3aed,#2563eb)',
            border: 'none', borderRadius: 50, width: 56, height: 56,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 8px 24px #7c3aed44',
            zIndex: 10,
          }}>
          <Plus size={26} color="white" />
        </button>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
          padding: '12px 24px', color: '#f1f5f9', fontWeight: 600, fontSize: 14,
          zIndex: 2000, boxShadow: '0 8px 24px #00000044',
          animation: 'fadeInUp 0.3s ease',
        }}>
          {toast}
        </div>
      )}

      {/* Competition Type Selector */}
      {showTypeSelect && (
        <CompetitionTypeSelector
          onSelect={(type) => {
            setSelectedCompType(type);
            setShowTypeSelect(false);
            setShowCreate(true);
          }}
          onClose={() => { setShowTypeSelect(false); setTab('esplora'); }}
        />
      )}

      {/* Create Wizard */}
      {showCreate && (
        <CreateWizard
          userId={userId}
          userEmail={userEmail}
          puntiRankiard={puntiRankiard}
          competitionType={selectedCompType}
          onClose={() => { setShowCreate(false); setTab('esplora'); }}
          onCreated={() => { setShowCreate(false); setTab('esplora'); fetchTournaments(); showToast('Torneo creato con successo!'); }}
        />
      )}

      {/* Detail Modal */}
      {detailData && (
        <TournamentDetailModal
          tournament={detailData.tournament}
          participants={detailData.participants}
          matches={detailData.matches}
          participantNames={detailData.participantNames}
          userId={userId}
          userEmail={userEmail}
          onClose={() => { setDetailData(null); setSelectedTournamentId(null); }}
          onJoin={handleJoin}
          onStart={handleStart}
          onInvite={() => {
            setInviteTournament(detailData.tournament);
            setShowInvite(true);
          }}
          onPlayMatch={onPlayMatch}
          onDelete={handleDelete}
        />
      )}

      {/* Invite Modal */}
      {showInvite && inviteTournament && (
        <InviteModal
          tournamentId={inviteTournament.id}
          tournamentName={inviteTournament.name}
          onClose={() => { setShowInvite(false); setInviteTournament(null); }}
        />
      )}
    </div>
  );
}
