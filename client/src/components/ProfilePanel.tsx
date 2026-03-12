import React, { useState, useEffect } from "react";
import { User, Trophy, Target, Gamepad2, Clock, Medal, Users, UserPlus, Search, X, Loader2, Check, XCircle, Mail, Copy, Send } from "lucide-react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

interface ProfileData {
  user: {
    id: number;
    username: string;
    avatar: string | null;
    puntiRankiard: number;
    gamesPlayed: number;
    gamesWon: number;
    minutesPlayed: number;
  };
  rank: number;
  totalPlayers: number;
  completedMissions: number;
  totalMissions: number;
  completedAchievements: number;
  totalAchievements: number;
}

interface Friend {
  id: number;
  odisplayId: number;
  username: string;
  avatar: string | null;
  puntiRankiard: number;
  isOnline?: boolean;
}

interface FriendRequest {
  id: number;
  requesterId: number;
  requesterUsername: string;
  requesterAvatar: string | null;
  message: string | null;
  createdAt: string;
}

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
  gameId?: string;
  onInviteFriend?: (friendId: number) => void;
}

const AVATAR_EMOJIS = [
  "😎", "🔥", "⚡", "🎮", "👑", "💎", "🐉", "🦁", "🦊", "🐺",
  "🎯", "🚀", "💪", "🏆", "⭐", "🌟", "✨", "💫", "🎭", "🃏",
  "🎲", "🎪", "🎨", "🎬"
];

type TabType = 'profile' | 'friends' | 'requests';

export const ProfilePanel: React.FC<ProfilePanelProps> = ({
  isOpen,
  onClose,
  authToken,
  gameId,
  onInviteFriend
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<number | null>(null);
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [invitingFriend, setInvitingFriend] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (isOpen && authToken) {
      fetchProfileData();
      fetchFriends();
      fetchFriendRequests();
    }
  }, [isOpen, authToken]);

  const fetchProfileData = async () => {
    if (!authToken) return;
    try {
      setLoading(true);
      const response = await fetch('/api/profile', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProfileData(data.profile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    if (!authToken) return;
    try {
      const response = await fetch('/api/friends', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const fetchFriendRequests = async () => {
    if (!authToken) return;
    try {
      const response = await fetch('/api/friends/requests', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFriendRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  const searchUsers = async (query: string) => {
    if (!authToken || query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users || []);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (userId: number) => {
    if (!authToken) return;
    try {
      setSendingRequest(userId);
      const response = await fetch('/api/friends/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ addresseeId: userId })
      });
      if (response.ok) {
        setSearchResults(prev => prev.filter(u => u.id !== userId));
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    } finally {
      setSendingRequest(null);
    }
  };

  const respondToRequest = async (requestId: number, accept: boolean) => {
    if (!authToken) return;
    try {
      setRespondingTo(requestId);
      const response = await fetch(`/api/friends/requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ accept })
      });
      if (response.ok) {
        setFriendRequests(prev => prev.filter(r => r.id !== requestId));
        if (accept) {
          fetchFriends();
        }
      }
    } catch (error) {
      console.error('Error responding to request:', error);
    } finally {
      setRespondingTo(null);
    }
  };

  const inviteFriend = async (friendId: number) => {
    if (!authToken) return;
    try {
      setInvitingFriend(friendId);
      const response = await fetch('/api/friends/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ friendId, ...(gameId ? { gameId } : {}) })
      });
      if (response.ok) {
        onInviteFriend?.(friendId);
      }
    } catch (error) {
      console.error('Error inviting friend:', error);
    } finally {
      setInvitingFriend(null);
    }
  };

  const copyGameLink = () => {
    if (!gameId) return;
    const link = `${window.location.origin}?room=${gameId.replace('room-', '')}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const getAvatar = (avatarId: string | null): string => {
    if (!avatarId) return "👤";
    const index = parseInt(avatarId.replace('avatar-', '')) - 1;
    return AVATAR_EMOJIS[index] || "👤";
  };

  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-xl border border-blue-500/30 shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <User className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Il Mio Profilo</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="flex border-b border-white/10">
          {[
            { id: 'profile', label: 'Profilo', icon: User },
            { id: 'friends', label: 'Amici', icon: Users, count: friends.length },
            { id: 'requests', label: 'Richieste', icon: UserPlus, count: friendRequests.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors ${
                activeTab === tab.id 
                  ? 'bg-blue-500/20 text-blue-400 border-b-2 border-blue-400' 
                  : 'text-white/60 hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto max-h-[60vh] p-4">
          {loading && activeTab === 'profile' ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : activeTab === 'profile' && profileData ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl border border-white/10">
                <div className="text-5xl">{getAvatar(profileData.user.avatar)}</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-white">{profileData.user.username}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-yellow-400 font-bold">{profileData.user.puntiRankiard} PR</span>
                    <span className="text-white/40">|</span>
                    <span className="text-white/60">Rank #{profileData.rank} di {profileData.totalPlayers}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
                  <Gamepad2 className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white">{profileData.user.gamesPlayed}</div>
                  <div className="text-xs text-white/60">Partite</div>
                </div>
                <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
                  <Medal className="w-6 h-6 text-green-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white">{profileData.user.gamesWon}</div>
                  <div className="text-xs text-white/60">Vittorie</div>
                </div>
                <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
                  <Clock className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white">{formatMinutes(profileData.user.minutesPlayed)}</div>
                  <div className="text-xs text-white/60">Tempo Gioco</div>
                </div>
                <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
                  <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white">
                    {profileData.user.gamesPlayed > 0 
                      ? Math.round((profileData.user.gamesWon / profileData.user.gamesPlayed) * 100) 
                      : 0}%
                  </div>
                  <div className="text-xs text-white/60">Win Rate</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-5 h-5 text-cyan-400" />
                    <span className="font-medium text-white">Missioni Completate</span>
                  </div>
                  <div className="text-3xl font-bold text-cyan-400">
                    {profileData.completedMissions}/{profileData.totalMissions}
                  </div>
                  <Progress 
                    value={(profileData.completedMissions / Math.max(profileData.totalMissions, 1)) * 100} 
                    className="mt-2 h-2"
                  />
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-5 h-5 text-purple-400" />
                    <span className="font-medium text-white">Trofei Sbloccati</span>
                  </div>
                  <div className="text-3xl font-bold text-purple-400">
                    {profileData.completedAchievements}/{profileData.totalAchievements}
                  </div>
                  <Progress 
                    value={(profileData.completedAchievements / Math.max(profileData.totalAchievements, 1)) * 100} 
                    className="mt-2 h-2"
                  />
                </div>
              </div>
            </div>
          ) : activeTab === 'friends' ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca utenti per username..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 animate-spin" />
                )}
              </div>

              {searchQuery && searchResults.length > 0 && (
                <div className="bg-white/5 rounded-lg border border-white/10 divide-y divide-white/5">
                  <div className="px-3 py-2 text-xs text-white/40 uppercase">Risultati ricerca</div>
                  {searchResults.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getAvatar(user.avatar)}</span>
                        <div>
                          <div className="font-medium text-white">{user.username}</div>
                          <div className="text-xs text-yellow-400">{user.puntiRankiard} PR</div>
                        </div>
                      </div>
                      <Button
                        onClick={() => sendFriendRequest(user.id)}
                        disabled={sendingRequest === user.id}
                        size="sm"
                        className="bg-blue-500 hover:bg-blue-600"
                      >
                        {sendingRequest === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <><UserPlus className="w-4 h-4 mr-1" /> Aggiungi</>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {gameId && (
                <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-lg p-4 border border-green-500/30">
                  <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                    <Send className="w-4 h-4 text-green-400" />
                    Invita alla Partita
                  </h4>
                  <Button
                    onClick={copyGameLink}
                    className="w-full bg-green-600 hover:bg-green-700 mb-2"
                  >
                    {linkCopied ? (
                      <><Check className="w-4 h-4 mr-2" /> Link Copiato!</>
                    ) : (
                      <><Copy className="w-4 h-4 mr-2" /> Copia Link Partita</>
                    )}
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-medium text-white/80 text-sm uppercase tracking-wide">I tuoi amici ({friends.length})</h4>
                {friends.length === 0 ? (
                  <div className="text-center py-8 text-white/40">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Non hai ancora amici</p>
                    <p className="text-sm">Cerca utenti per aggiungerli!</p>
                  </div>
                ) : (
                  friends.map(friend => (
                    <div key={friend.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getAvatar(friend.avatar)}</span>
                        <div>
                          <div className="font-medium text-white">{friend.username}</div>
                          <div className="text-xs text-yellow-400">{friend.puntiRankiard} PR</div>
                        </div>
                      </div>
                      <Button
                        onClick={() => inviteFriend(friend.id)}
                        disabled={invitingFriend === friend.id}
                        size="sm"
                        className={gameId ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"}
                      >
                        {invitingFriend === friend.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : gameId ? (
                          <><Mail className="w-4 h-4 mr-1" /> Invita</>
                        ) : (
                          <><Mail className="w-4 h-4 mr-1" /> Sfida</>
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : activeTab === 'requests' ? (
            <div className="space-y-4">
              <h4 className="font-medium text-white/80 text-sm uppercase tracking-wide">
                Richieste di amicizia ({friendRequests.length})
              </h4>
              {friendRequests.length === 0 ? (
                <div className="text-center py-8 text-white/40">
                  <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nessuna richiesta in sospeso</p>
                </div>
              ) : (
                friendRequests.map(request => (
                  <div key={request.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getAvatar(request.requesterAvatar)}</span>
                      <div>
                        <div className="font-medium text-white">{request.requesterUsername}</div>
                        {request.message && (
                          <div className="text-sm text-white/60 italic">"{request.message}"</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => respondToRequest(request.id, true)}
                        disabled={respondingTo === request.id}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {respondingTo === request.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        onClick={() => respondToRequest(request.id, false)}
                        disabled={respondingTo === request.id}
                        size="sm"
                        variant="destructive"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ProfilePanel;
