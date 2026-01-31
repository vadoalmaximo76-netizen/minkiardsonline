import React, { useState, useEffect } from 'react';
import { X, Trophy, Users, Calendar, Award, Crown, Plus, Play, ChevronRight } from 'lucide-react';

interface Tournament {
  id: number;
  name: string;
  description: string | null;
  type: string;
  status: string;
  maxParticipants: number;
  currentParticipants: number;
  prizePool: number;
  entryFee: number;
  organizerId: number;
  winnerId: number | null;
  startDate: string | null;
}

interface TournamentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
}

export function TournamentPanel({ isOpen, onClose, authToken }: TournamentPanelProps) {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('');
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    type: 'elimination',
    maxParticipants: 8,
    prizePool: 100,
    entryFee: 0
  });

  useEffect(() => {
    if (isOpen) {
      fetchTournaments();
    }
  }, [isOpen, filter]);

  const fetchTournaments = async () => {
    try {
      const url = filter ? `/api/tournaments?status=${filter}` : '/api/tournaments';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setTournaments(data.tournaments);
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    }
  };

  const fetchTournamentDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/tournaments/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedTournament(data.tournament);
        setParticipants(data.participants);
        setView('detail');
      }
    } catch (error) {
      console.error('Error fetching tournament:', error);
    }
  };

  const handleCreate = async () => {
    if (!authToken || !createForm.name) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(createForm)
      });
      const data = await res.json();
      if (data.success) {
        await fetchTournaments();
        setView('list');
        setCreateForm({ name: '', description: '', type: 'elimination', maxParticipants: 8, prizePool: 100, entryFee: 0 });
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error creating tournament:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (tournamentId: number) => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        if (selectedTournament) {
          await fetchTournamentDetail(tournamentId);
        }
        await fetchTournaments();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error joining tournament:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (tournamentId: number) => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        await fetchTournamentDetail(tournamentId);
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error starting tournament:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'registration': return 'bg-green-500/20 text-green-400';
      case 'in_progress': return 'bg-amber-500/20 text-amber-400';
      case 'completed': return 'bg-slate-500/20 text-slate-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'registration': return 'Iscrizioni Aperte';
      case 'in_progress': return 'In Corso';
      case 'completed': return 'Completato';
      default: return status;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-gradient-to-br from-slate-900 via-amber-900/10 to-slate-900 rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-amber-500/30 shadow-2xl">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Tornei</h2>
              <p className="text-slate-400 text-sm">Compete per Punti Rankiard</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {view === 'list' && (
          <>
            <div className="flex items-center gap-2 p-4 border-b border-white/10">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm flex-1"
              >
                <option value="">Tutti</option>
                <option value="registration">Iscrizioni Aperte</option>
                <option value="in_progress">In Corso</option>
                <option value="completed">Completati</option>
              </select>
              <button
                onClick={() => setView('create')}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Crea
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(80vh-200px)]">
              {tournaments.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Nessun torneo</h3>
                  <p className="text-slate-400">Crea il primo torneo!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tournaments.map(tournament => (
                    <button
                      key={tournament.id}
                      onClick={() => fetchTournamentDetail(tournament.id)}
                      className="w-full bg-slate-800/50 rounded-xl p-4 border border-white/10 hover:border-amber-500/30 transition-all text-left"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-lg font-bold text-white">{tournament.name}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(tournament.status)}`}>
                          {getStatusLabel(tournament.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {tournament.currentParticipants}/{tournament.maxParticipants}
                        </span>
                        <span className="flex items-center gap-1">
                          <Trophy className="w-4 h-4 text-amber-400" />
                          {tournament.prizePool} PR
                        </span>
                        {tournament.entryFee > 0 && (
                          <span className="text-red-400">Quota: {tournament.entryFee} PR</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {view === 'detail' && selectedTournament && (
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
            <button
              onClick={() => { setView('list'); setSelectedTournament(null); }}
              className="text-slate-400 hover:text-white mb-4 flex items-center gap-1"
            >
              ← Torna alla lista
            </button>

            <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/10 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-white">{selectedTournament.name}</h3>
                  <p className="text-slate-400">{selectedTournament.description || 'Torneo di MINKIARDS'}</p>
                </div>
                <span className={`px-3 py-1 rounded-lg text-sm font-medium ${getStatusColor(selectedTournament.status)}`}>
                  {getStatusLabel(selectedTournament.status)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-slate-700/50 rounded-xl p-3 text-center">
                  <Users className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-white">{selectedTournament.currentParticipants}/{selectedTournament.maxParticipants}</p>
                  <p className="text-xs text-slate-400">Partecipanti</p>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-3 text-center">
                  <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-white">{selectedTournament.prizePool}</p>
                  <p className="text-xs text-slate-400">Montepremi PR</p>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-3 text-center">
                  <Award className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-white">{selectedTournament.entryFee}</p>
                  <p className="text-xs text-slate-400">Quota Ingresso</p>
                </div>
              </div>

              {selectedTournament.status === 'registration' && (
                <button
                  onClick={() => handleJoin(selectedTournament.id)}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl font-bold transition-all"
                >
                  Iscriviti al Torneo
                </button>
              )}
            </div>

            <div>
              <h4 className="text-lg font-semibold text-white mb-3">Partecipanti ({participants.length})</h4>
              <div className="space-y-2">
                {participants.map((p, idx) => (
                  <div key={p.id} className="bg-slate-800/50 rounded-xl p-3 flex items-center gap-3 border border-white/5">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold">
                      {p.avatar || p.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{p.username}</p>
                      <p className="text-xs text-slate-400">{p.wins}W - {p.losses}L</p>
                    </div>
                    {p.status === 'winner' && <Crown className="w-5 h-5 text-amber-400" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'create' && (
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
            <button
              onClick={() => setView('list')}
              className="text-slate-400 hover:text-white mb-4 flex items-center gap-1"
            >
              ← Torna alla lista
            </button>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nome del Torneo</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Es: Torneo dei Campioni"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Descrizione</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Descrizione del torneo..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Max Partecipanti</label>
                  <select
                    value={createForm.maxParticipants}
                    onChange={(e) => setCreateForm({ ...createForm, maxParticipants: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white"
                  >
                    <option value={4}>4</option>
                    <option value={8}>8</option>
                    <option value={16}>16</option>
                    <option value={32}>32</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Formato</label>
                  <select
                    value={createForm.type}
                    onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white"
                  >
                    <option value="elimination">Eliminazione</option>
                    <option value="round_robin">Round Robin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Montepremi (PR)</label>
                  <input
                    type="number"
                    value={createForm.prizePool}
                    onChange={(e) => setCreateForm({ ...createForm, prizePool: parseInt(e.target.value) || 0 })}
                    min={0}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Quota Ingresso (PR)</label>
                  <input
                    type="number"
                    value={createForm.entryFee}
                    onChange={(e) => setCreateForm({ ...createForm, entryFee: parseInt(e.target.value) || 0 })}
                    min={0}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white"
                  />
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={loading || !createForm.name}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Crea Torneo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
