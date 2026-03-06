import React, { useState, useEffect } from 'react';
import { X, Trophy, Users, Plus, Play, ChevronRight, Award } from 'lucide-react';

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
}

export function TournamentPanel({ userId, username, onClose }: TournamentPanelProps) {
  const [view, setView] = useState<'list' | 'create' | 'bracket'>('list');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [bracketData, setBracketData] = useState<{ tournament: Tournament; matches: TournamentMatch[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const authToken = localStorage.getItem('authToken');

  // Create Form State
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
      if (data.success) {
        setTournaments(data.tournaments);
      }
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
      // Fallback if /bracket doesn't exist yet (based on my findings in routes.ts)
      const res = await fetch(`/api/tournaments/${id}`);
      const fallbackData = await res.json();
      if (fallbackData.success) {
        // Enriched matches with names from participants
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
      if (data.success) {
        fetchTournaments();
      } else {
        alert(data.error || 'Errore durante l\'iscrizione');
      }
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
      if (data.success) {
        fetchTournaments();
      } else {
        alert(data.error || 'Errore durante l\'avvio');
      }
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        fetchTournaments();
        setView('list');
      } else {
        alert(data.error || 'Errore durante la creazione');
      }
    } catch (err) {
      console.error('Error creating tournament:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'registration':
        return <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Iscrizioni Aperte</span>;
      case 'in_progress':
        return <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">In Corso</span>;
      case 'completed':
        return <span className="bg-slate-500/20 text-slate-400 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Completato</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900/95 border border-white/10 rounded-3xl overflow-hidden flex flex-col text-white shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-4">
            <Trophy className="w-8 h-8 text-amber-400" />
            <div>
              <h2 className="text-2xl font-black italic uppercase tracking-tighter">Tornei Draft</h2>
              <p className="text-xs text-slate-400 font-medium">Competi per il montepremi finale</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {view === 'list' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Tornei Disponibili</h3>
                <button 
                  onClick={() => setView('create')}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-xl font-bold transition-all transform hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  Crea Torneo
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tournaments.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/10">
                      <p className="text-slate-500">Nessun torneo disponibile al momento.</p>
                    </div>
                  ) : (
                    tournaments.map((t) => (
                      <div key={t.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="text-lg font-bold leading-tight mb-1">{t.name}</h4>
                            {getStatusBadge(t.status)}
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-amber-400 font-bold">
                              <Award className="w-4 h-4" />
                              {t.prizePool} PR
                            </div>
                            <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
                              <Users className="w-3 h-3" />
                              {t.currentParticipants}/{t.maxParticipants}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                          {t.status === 'registration' && (
                            <>
                              <button 
                                onClick={() => handleJoin(t.id)}
                                className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl font-bold transition-all"
                              >
                                Iscriviti
                              </button>
                              {t.organizerId === userId && t.currentParticipants >= 4 && (
                                <button 
                                  onClick={() => handleStart(t.id)}
                                  className="flex-1 bg-green-500 hover:bg-green-400 text-black py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1"
                                >
                                  <Play className="w-4 h-4 fill-current" />
                                  Avvia
                                </button>
                              )}
                            </>
                          )}
                          {(t.status === 'in_progress' || t.status === 'completed') && (
                            <button 
                              onClick={() => fetchBracket(t.id)}
                              className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                            >
                              Guarda Bracket
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {view === 'create' && (
            <div className="max-w-md mx-auto">
              <div className="flex items-center gap-2 mb-8">
                <button onClick={() => setView('list')} className="p-2 hover:bg-white/10 rounded-lg text-slate-400">
                  <ChevronRight className="w-6 h-6 rotate-180" />
                </button>
                <h3 className="text-2xl font-bold">Crea Nuovo Torneo</h3>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Nome Torneo</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    placeholder="Esempio: Grand Prix d'Estate"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Partecipanti</label>
                    <select 
                      value={formData.maxParticipants}
                      onChange={(e) => setFormData({...formData, maxParticipants: parseInt(e.target.value)})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none"
                    >
                      <option value={4} className="bg-slate-900">4 Giocatori</option>
                      <option value={8} className="bg-slate-900">8 Giocatori</option>
                      <option value={16} className="bg-slate-900">16 Giocatori</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Montepremi</label>
                    <input 
                      type="number" 
                      value={formData.prizePool}
                      onChange={(e) => setFormData({...formData, prizePool: parseInt(e.target.value) || 0})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Quota Iscrizione (PR)</label>
                  <input 
                    type="number" 
                    value={formData.entryFee}
                    onChange={(e) => setFormData({...formData, entryFee: parseInt(e.target.value) || 0})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black py-4 rounded-2xl font-black text-lg uppercase tracking-widest mt-8 transition-all disabled:opacity-50"
                >
                  {loading ? 'Creazione...' : 'Crea Torneo'}
                </button>
              </form>
            </div>
          )}

          {view === 'bracket' && bracketData && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <button onClick={() => setView('list')} className="p-2 hover:bg-white/10 rounded-lg text-slate-400">
                    <ChevronRight className="w-6 h-6 rotate-180" />
                  </button>
                  <h3 className="text-2xl font-bold italic uppercase">{bracketData.tournament.name}</h3>
                </div>
                {getStatusBadge(bracketData.tournament.status)}
              </div>

              {/* Bracket Tree View */}
              <div className="flex-1 overflow-x-auto">
                <div className="inline-flex gap-12 min-w-full pb-8 px-4">
                  {/* Round columns */}
                  {Array.from({ length: Math.ceil(Math.log2(bracketData.tournament.maxParticipants)) }).map((_, roundIdx) => {
                    const roundNum = roundIdx + 1;
                    const roundMatches = bracketData.matches.filter(m => m.round === roundNum);
                    
                    let roundTitle = `Round ${roundNum}`;
                    if (roundNum === Math.ceil(Math.log2(bracketData.tournament.maxParticipants))) roundTitle = "Finale";
                    else if (roundNum === Math.ceil(Math.log2(bracketData.tournament.maxParticipants)) - 1) roundTitle = "Semifinale";

                    return (
                      <div key={roundNum} className="flex flex-col gap-8 w-64 shrink-0">
                        <div className="text-center py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
                          {roundTitle}
                        </div>
                        <div className="flex-1 flex flex-col justify-around gap-4">
                          {roundMatches.map((match) => (
                            <div 
                              key={match.id} 
                              className={`relative p-3 rounded-xl border transition-all ${
                                match.status === 'in_progress' 
                                  ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                                  : 'bg-white/5 border-white/10'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className={`flex justify-between items-center p-2 rounded-lg ${match.winnerId && match.winnerId === match.player1Id ? 'bg-green-500/20 text-green-400' : ''}`}>
                                  <span className="font-bold truncate max-w-[120px]">{match.player1Name || '???'}</span>
                                  {match.winnerId && match.winnerId === match.player1Id && <Trophy className="w-3 h-3" />}
                                </div>
                                <div className="h-px bg-white/5 mx-2" />
                                <div className={`flex justify-between items-center p-2 rounded-lg ${match.winnerId && match.winnerId === match.player2Id ? 'bg-green-500/20 text-green-400' : ''}`}>
                                  <span className="font-bold truncate max-w-[120px]">{match.player2Name || '???'}</span>
                                  {match.winnerId && match.winnerId === match.player2Id && <Trophy className="w-3 h-3" />}
                                </div>
                              </div>
                              
                              {match.status === 'in_progress' && (
                                <div className="absolute -top-2 -right-2 bg-blue-500 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                                  LIVE
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
