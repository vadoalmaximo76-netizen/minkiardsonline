import React, { useState, useEffect } from 'react';
import { X, Users, Crown, Shield, Search, Plus, LogOut, Trophy, Star } from 'lucide-react';

interface Clan {
  id: number;
  name: string;
  tag: string;
  description: string | null;
  emblem: string | null;
  leaderId: number;
  totalPoints: number;
  totalWins: number;
  memberCount: number;
  maxMembers: number;
  isPublic: boolean;
}

interface ClanMember {
  id: number;
  userId: number;
  role: string;
  username: string;
  avatar: string | null;
  puntiRankiard: number;
  contributedPoints: number;
}

interface ClanPanelProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
}

export function ClanPanel({ isOpen, onClose, authToken }: ClanPanelProps) {
  const [view, setView] = useState<'my-clan' | 'browse' | 'create'>('my-clan');
  const [myClan, setMyClan] = useState<Clan | null>(null);
  const [myMembership, setMyMembership] = useState<{ role: string } | null>(null);
  const [clanMembers, setClanMembers] = useState<ClanMember[]>([]);
  const [allClans, setAllClans] = useState<Clan[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    tag: '',
    description: '',
    emblem: '⚔️',
    isPublic: true
  });

  const emblems = ['⚔️', '🛡️', '🔥', '⚡', '💀', '👑', '🐉', '🦁', '🦅', '🐺', '💎', '🌟'];

  useEffect(() => {
    if (isOpen) {
      fetchMyClan();
      fetchAllClans();
    }
  }, [isOpen]);

  const fetchMyClan = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/my-clan', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setMyClan(data.clan);
        setMyMembership(data.membership);
        if (data.clan) {
          fetchClanMembers(data.clan.id);
        }
      }
    } catch (error) {
      console.error('Error fetching clan:', error);
    }
  };

  const fetchClanMembers = async (clanId: number) => {
    try {
      const res = await fetch(`/api/clans/${clanId}`);
      const data = await res.json();
      if (data.success) {
        setClanMembers(data.members);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const fetchAllClans = async () => {
    try {
      const url = searchQuery 
        ? `/api/clans?search=${encodeURIComponent(searchQuery)}`
        : '/api/clans';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setAllClans(data.clans);
      }
    } catch (error) {
      console.error('Error fetching clans:', error);
    }
  };

  const handleCreateClan = async () => {
    if (!authToken || !createForm.name || !createForm.tag) return;
    setLoading(true);
    try {
      const res = await fetch('/api/clans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(createForm)
      });
      const data = await res.json();
      if (data.success) {
        await fetchMyClan();
        setView('my-clan');
        setCreateForm({ name: '', tag: '', description: '', emblem: '⚔️', isPublic: true });
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error creating clan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClan = async (clanId: number) => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clans/${clanId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        await fetchMyClan();
        setView('my-clan');
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error joining clan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveClan = async () => {
    if (!authToken) return;
    if (!confirm('Sei sicuro di voler lasciare il clan?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/clans/leave', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setMyClan(null);
        setMyMembership(null);
        setClanMembers([]);
        await fetchAllClans();
      }
    } catch (error) {
      console.error('Error leaving clan:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-purple-500/30 shadow-2xl">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Sistema Clan</h2>
              <p className="text-slate-400 text-sm">Unisciti o crea un clan</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="flex border-b border-white/10">
          <button
            onClick={() => setView('my-clan')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              view === 'my-clan' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Il Mio Clan
          </button>
          <button
            onClick={() => setView('browse')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              view === 'browse' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Cerca Clan
          </button>
          {!myClan && (
            <button
              onClick={() => setView('create')}
              className={`flex-1 py-3 text-center font-medium transition-colors ${
                view === 'create' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              Crea Clan
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
          {view === 'my-clan' && (
            myClan ? (
              <div className="space-y-6">
                <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-xl bg-purple-500/20 flex items-center justify-center text-4xl">
                      {myClan.emblem || '⚔️'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-2xl font-bold text-white">{myClan.name}</h3>
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-sm font-mono">
                          [{myClan.tag}]
                        </span>
                      </div>
                      <p className="text-slate-400">{myClan.description || 'Nessuna descrizione'}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-slate-700/50 rounded-xl p-3 text-center">
                      <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                      <p className="text-xl font-bold text-white">{myClan.totalPoints.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">Punti Totali</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-xl p-3 text-center">
                      <Star className="w-5 h-5 text-green-400 mx-auto mb-1" />
                      <p className="text-xl font-bold text-white">{myClan.totalWins}</p>
                      <p className="text-xs text-slate-400">Vittorie</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-xl p-3 text-center">
                      <Users className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                      <p className="text-xl font-bold text-white">{myClan.memberCount}/{myClan.maxMembers}</p>
                      <p className="text-xs text-slate-400">Membri</p>
                    </div>
                  </div>

                  {myMembership?.role === 'leader' && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 rounded-lg text-amber-300 text-sm mb-4">
                      <Crown className="w-4 h-4" />
                      Sei il Leader del clan
                    </div>
                  )}

                  <button
                    onClick={handleLeaveClan}
                    disabled={loading}
                    className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Lascia Clan
                  </button>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Membri ({clanMembers.length})</h4>
                  <div className="space-y-2">
                    {clanMembers.map(member => (
                      <div key={member.id} className="bg-slate-800/50 rounded-xl p-3 flex items-center gap-3 border border-white/5">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
                          {member.avatar || member.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{member.username}</span>
                            {member.role === 'leader' && <Crown className="w-4 h-4 text-amber-400" />}
                            {member.role === 'officer' && <Shield className="w-4 h-4 text-blue-400" />}
                          </div>
                          <p className="text-xs text-slate-400">{member.puntiRankiard.toLocaleString()} PR</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Non sei in un clan</h3>
                <p className="text-slate-400 mb-6">Unisciti a un clan esistente o creane uno nuovo</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setView('browse')}
                    className="px-6 py-3 bg-purple-500 hover:bg-purple-400 text-white rounded-xl font-medium transition-colors"
                  >
                    Cerca Clan
                  </button>
                  <button
                    onClick={() => setView('create')}
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
                  >
                    Crea Clan
                  </button>
                </div>
              </div>
            )
          )}

          {view === 'browse' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cerca per nome o tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchAllClans()}
                  className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              {allClans.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  Nessun clan trovato
                </div>
              ) : (
                <div className="space-y-3">
                  {allClans.map(clan => (
                    <div key={clan.id} className="bg-slate-800/50 rounded-xl p-4 border border-white/10 hover:border-purple-500/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-2xl">
                          {clan.emblem || '⚔️'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-bold text-white">{clan.name}</h4>
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs font-mono">
                              [{clan.tag}]
                            </span>
                            {!clan.isPublic && <Shield className="w-4 h-4 text-amber-400" />}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <span>{clan.memberCount}/{clan.maxMembers} membri</span>
                            <span>{clan.totalPoints.toLocaleString()} PR</span>
                          </div>
                        </div>
                        {!myClan && (
                          <button
                            onClick={() => handleJoinClan(clan.id)}
                            disabled={loading || clan.memberCount >= clan.maxMembers}
                            className="px-4 py-2 bg-purple-500 hover:bg-purple-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                          >
                            {clan.isPublic ? 'Entra' : 'Richiedi'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'create' && !myClan && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nome del Clan</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Es: Guerrieri Z"
                  maxLength={30}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tag (2-5 caratteri)</label>
                <input
                  type="text"
                  value={createForm.tag}
                  onChange={(e) => setCreateForm({ ...createForm, tag: e.target.value.toUpperCase() })}
                  placeholder="Es: GRZ"
                  maxLength={5}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Descrizione</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Descrizione del clan..."
                  maxLength={200}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Emblema</label>
                <div className="grid grid-cols-6 gap-2">
                  {emblems.map(emblem => (
                    <button
                      key={emblem}
                      onClick={() => setCreateForm({ ...createForm, emblem })}
                      className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition-all ${
                        createForm.emblem === emblem
                          ? 'bg-purple-500/30 border-2 border-purple-500'
                          : 'bg-slate-800/50 border border-white/10 hover:bg-slate-700/50'
                      }`}
                    >
                      {emblem}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCreateForm({ ...createForm, isPublic: !createForm.isPublic })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    createForm.isPublic ? 'bg-purple-500' : 'bg-slate-600'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transform transition-transform ${
                    createForm.isPublic ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
                <span className="text-slate-300">
                  {createForm.isPublic ? 'Pubblico - Chiunque può entrare' : 'Privato - Richiede approvazione'}
                </span>
              </div>

              <button
                onClick={handleCreateClan}
                disabled={loading || !createForm.name || !createForm.tag || createForm.tag.length < 2}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Crea Clan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
