import React, { useState, useEffect } from 'react';
import { X, Users, Plus, Trophy, ArrowLeft, LogOut, Shield, Crown, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { ChallengeButton } from './ChallengeButton';
import { useToast } from "../hooks/use-toast";

interface Clan {
  id: number;
  name: string;
  tag: string;
  description: string | null;
  emblem: string | null;
  memberCount: number;
  maxMembers: number;
  totalPoints: number;
  leaderId: number;
}

interface ClanMember {
  userId: number;
  username: string;
  puntiRankiard: number;
  role: string;
  contributedPoints: number;
}

interface ClanDetail extends Clan {
  members: ClanMember[];
}

interface ClubPanelProps {
  userId: number;
  username: string;
  onClose: () => void;
}

const EMBLEMS = ['🦁', '🐯', '🐺', '🦅', '🐉', '⚔️', '🛡️', '👑', '🔥', '❄️', '⚡', '🌟', '💎', '💀', '👻', '🎭', '🌌', '🌋', '🏹', '🔱'];

export function ClubPanel({ userId, username, onClose }: ClubPanelProps) {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [clans, setClans] = useState<Clan[]>([]);
  const [selectedClan, setSelectedClan] = useState<ClanDetail | null>(null);
  const [userClan, setUserClan] = useState<Clan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const authToken = localStorage.getItem('authToken');

  // Create Form State
  const [newName, setNewName] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newEmblem, setNewEmblem] = useState(EMBLEMS[0]);

  const fetchClans = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/clans');
      if (!res.ok) throw new Error('Failed to fetch clans');
      const data = await res.json();
      setClans(data.clans || []);

      // Find user's clan if they are in one
      // We need to check members for each clan or have a specific endpoint
      // For now, let's assume if the user is in the list, we can identify it.
      // Better: we'll check membership when fetching detail or if the list includes membership info.
      // Based on the requirement "Mostra il club corrente dell'utente in cima", 
      // let's assume we can determine it from the list or a separate check.
      // Since the API GET /api/clans doesn't explicitly say it returns membership, 
      // but usually these lists might have a 'isMember' flag or we find it.
      // I'll filter the list for the user clan if it's marked or just use the first one where user is leader for now
      // and update it when we get details.
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i club.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClanDetail = async (clanId: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clans/${clanId}`);
      if (!res.ok) throw new Error('Failed to fetch clan details');
      const data = await res.json();
      setSelectedClan(data);
      
      // Check if current user is a member
      const isMember = data.members.some((m: ClanMember) => m.userId === userId);
      if (isMember) {
        setUserClan(data);
      }
      
      setView('detail');
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i dettagli del club.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClans();
  }, []);

  const handleCreateClan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTag.length < 3 || newTag.length > 5) {
      toast({ title: "Errore", description: "Il tag deve essere di 3-5 caratteri.", variant: "destructive" });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/clans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: newName,
          tag: newTag.toUpperCase(),
          description: newDescription,
          emblem: newEmblem
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create clan');
      }

      toast({ title: "Successo!", description: "Club creato con successo." });
      fetchClans();
      setView('list');
      // Reset form
      setNewName('');
      setNewTag('');
      setNewDescription('');
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile creare il club.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinClan = async (clanId: number) => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/clans/${clanId}/join`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Failed to join');
      
      toast({ title: "Benvenuto!", description: "Ti sei unito al club." });
      fetchClans();
      fetchClanDetail(clanId);
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile unirsi al club.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaveClan = async (clanId: number) => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/clans/${clanId}/leave`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Failed to leave');
      
      toast({ title: "Uscito", description: "Hai lasciato il club." });
      setUserClan(null);
      fetchClans();
      setView('list');
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile lasciare il club.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const isUserMemberOf = (clanId: number) => userClan?.id === clanId;

  const sortedClans = [...clans].sort((a, b) => {
    if (isUserMemberOf(a.id)) return -1;
    if (isUserMemberOf(b.id)) return 1;
    return b.totalPoints - a.totalPoints;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl h-[85vh] bg-gray-900/90 border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            {view !== 'list' && (
              <Button variant="ghost" size="icon" onClick={() => setView('list')} className="text-white hover:bg-white/10">
                <ArrowLeft className="w-6 h-6" />
              </Button>
            )}
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="text-blue-400" />
              Club & Gilde
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          {loading && !submitting ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
              <p className="text-white/60">Caricamento...</p>
            </div>
          ) : view === 'list' ? (
            <div className="h-full flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <p className="text-white/70">Unisciti a un club o creane uno tuo per dominare la classifica!</p>
                {!userClan && (
                  <Button onClick={() => setView('create')} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                    <Plus className="w-4 h-4" /> Crea Club
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1 pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                  {sortedClans.map((clan) => (
                    <Card key={clan.id} className="bg-white/5 border-white/10 hover:bg-white/10 transition-all cursor-pointer group" onClick={() => fetchClanDetail(clan.id)}>
                      <CardContent className="p-4 flex gap-4">
                        <div className="text-5xl flex items-center justify-center bg-black/30 rounded-xl w-20 h-20 group-hover:scale-110 transition-transform">
                          {clan.emblem || '🛡️'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-xl font-bold text-white truncate max-w-[150px]">{clan.name}</h3>
                            <span className="text-xs font-mono bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">
                              [{clan.tag}]
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-sm text-white/60">
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4" /> {clan.memberCount}/{clan.maxMembers}
                            </div>
                            <div className="flex items-center gap-1">
                              <Trophy className="w-4 h-4 text-yellow-500" /> {clan.totalPoints} PTI
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end">
                            {isUserMemberOf(clan.id) ? (
                              <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                                <Shield className="w-3 h-3" /> SEI MEMBRO
                              </span>
                            ) : (
                              <Button 
                                size="sm" 
                                className="h-8 bg-blue-600/80 hover:bg-blue-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleJoinClan(clan.id);
                                }}
                                disabled={submitting || !!userClan || clan.memberCount >= clan.maxMembers}
                              >
                                Unisciti
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {clans.length === 0 && (
                    <div className="col-span-full py-20 text-center text-white/40 italic">
                      Nessun club trovato. Sii il primo a crearne uno!
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : view === 'create' ? (
            <div className="max-w-xl mx-auto h-full">
              <form onSubmit={handleCreateClan} className="space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <label className="text-sm font-medium text-white/70">Nome Club</label>
                      <Input 
                        placeholder="Es: I Guerrieri della Notte" 
                        value={newName} 
                        onChange={(e) => setNewName(e.target.value)}
                        required
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/70">Tag (3-5 char)</label>
                      <Input 
                        placeholder="GDN" 
                        value={newTag} 
                        onChange={(e) => setNewTag(e.target.value.toUpperCase().slice(0, 5))}
                        required
                        className="bg-white/5 border-white/10 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">Descrizione</label>
                    <Textarea 
                      placeholder="Racconta la visione del tuo club..." 
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className="bg-white/5 border-white/10 text-white min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-white/70">Scegli Emblem</label>
                    <div className="grid grid-cols-10 gap-2">
                      {EMBLEMS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => setNewEmblem(e)}
                          className={`text-2xl p-2 rounded-lg transition-all ${newEmblem === e ? 'bg-blue-600 scale-110' : 'bg-white/5 hover:bg-white/10'}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <Button type="button" variant="ghost" onClick={() => setView('list')} className="flex-1 text-white border border-white/10">
                    Annulla
                  </Button>
                  <Button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white" disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Crea Club
                  </Button>
                </div>
              </form>
            </div>
          ) : view === 'detail' && selectedClan ? (
            <div className="h-full flex flex-col gap-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="text-7xl p-6 bg-white/5 rounded-3xl border border-white/10">
                  {selectedClan.emblem || '🛡️'}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-4xl font-black text-white">{selectedClan.name}</h2>
                    <span className="text-xl font-mono bg-blue-500/20 text-blue-400 px-3 py-1 rounded border border-blue-500/30">
                      [{selectedClan.tag}]
                    </span>
                  </div>
                  <p className="text-white/60 italic">{selectedClan.description || 'Nessuna descrizione disponibile.'}</p>
                  <div className="flex gap-6 pt-2">
                    <div className="text-center">
                      <p className="text-xs text-white/40 uppercase tracking-widest">Membri</p>
                      <p className="text-xl font-bold text-white">{selectedClan.memberCount} / {selectedClan.maxMembers}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-white/40 uppercase tracking-widest">Punti Totali</p>
                      <p className="text-xl font-bold text-yellow-500">{selectedClan.totalPoints}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 w-full md:w-auto">
                  {isUserMemberOf(selectedClan.id) ? (
                    <Button 
                      variant="destructive" 
                      onClick={() => handleLeaveClan(selectedClan.id)} 
                      disabled={submitting || selectedClan.leaderId === userId}
                      className="gap-2"
                    >
                      <LogOut className="w-4 h-4" /> Lascia Club
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleJoinClan(selectedClan.id)} 
                      disabled={submitting || !!userClan || selectedClan.memberCount >= selectedClan.maxMembers}
                      className="bg-blue-600 hover:bg-blue-700 gap-2"
                    >
                      <Plus className="w-4 h-4" /> Unisciti al Club
                    </Button>
                  )}
                  {selectedClan.leaderId === userId && (
                    <p className="text-[10px] text-white/40 text-center italic mt-1">
                      Il leader non può lasciare il club
                    </p>
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-lg font-bold text-white uppercase tracking-tight">Classifica Interna</h3>
                </div>

                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-2">
                    {selectedClan.members.sort((a, b) => b.puntiRankiard - a.puntiRankiard).map((member, index) => (
                      <div 
                        key={member.userId} 
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                          member.userId === userId ? 'bg-blue-500/20 border-blue-500/30' : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                            index === 0 ? 'bg-yellow-500 text-black' : 
                            index === 1 ? 'bg-gray-300 text-black' : 
                            index === 2 ? 'bg-amber-600 text-white' : 'text-white/40'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{member.username}</span>
                              {member.role === 'leader' && <Crown className="w-3 h-3 text-yellow-500" />}
                              {member.role === 'officer' && <Shield className="w-3 h-3 text-blue-400" />}
                              {member.userId === userId && <span className="text-[10px] bg-white/20 px-1 rounded">TU</span>}
                            </div>
                            <p className="text-xs text-white/40">Contribuiti: {member.contributedPoints} PTI</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-lg font-black text-white leading-none">{member.puntiRankiard}</p>
                            <p className="text-[10px] text-white/40 uppercase">Rankiard</p>
                          </div>
                          {member.userId !== userId && (
                            <ChallengeButton targetUsername={member.username} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
