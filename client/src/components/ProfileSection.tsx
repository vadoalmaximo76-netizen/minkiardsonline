import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Trophy, Clock, Target, Users, Edit3, Save, X, Key, Mail, Camera, Award, Gamepad2, Star, TrendingUp } from 'lucide-react';
import { AVATARS } from '../lib/avatars';

interface ProfileSectionProps {
  playerName: string;
  userId?: number;
  userEmail?: string | null;
  userAvatar?: string | null;
  onBack: () => void;
  onUpdateProfile: (updates: { username?: string; avatar?: string }) => void;
}

interface UserStats {
  puntiRankiard: number;
  gamesPlayed: number;
  gamesWon: number;
  totalPlayTime: number;
  rank: number;
  totalPlayers: number;
  completedMissions: number;
  totalMissions: number;
  completedAchievements: number;
  totalAchievements: number;
  achievements: Array<{ id: number; name: string; description: string; unlockedAt: string }>;
  friends: Array<{ id: number; username: string; avatar: string | null; online: boolean }>;
}

export function ProfileSection({ playerName, userId, userEmail, userAvatar, onBack, onUpdateProfile }: ProfileSectionProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editedUsername, setEditedUsername] = useState(playerName);
  const [editedAvatar, setEditedAvatar] = useState(userAvatar || '');
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showEmailRecovery, setShowEmailRecovery] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) return;

        const [profileRes, friendsRes] = await Promise.all([
          fetch('/api/profile', { headers: { 'Authorization': `Bearer ${authToken}` } }),
          fetch('/api/friends', { headers: { 'Authorization': `Bearer ${authToken}` } })
        ]);

        let profileData = null;
        let friendsData: UserStats['friends'] = [];

        if (profileRes.ok) {
          const data = await profileRes.json();
          profileData = data.profile;
        }

        if (friendsRes.ok) {
          const data = await friendsRes.json();
          friendsData = data.friends || [];
        }

        if (profileData) {
          setStats({
            puntiRankiard: profileData.user?.puntiRankiard || 0,
            gamesPlayed: profileData.user?.gamesPlayed || 0,
            gamesWon: profileData.user?.gamesWon || 0,
            totalPlayTime: profileData.user?.minutesPlayed || 0,
            rank: profileData.rank || 0,
            totalPlayers: profileData.totalPlayers || 0,
            completedMissions: profileData.completedMissions || 0,
            totalMissions: profileData.totalMissions || 0,
            completedAchievements: profileData.completedAchievements || 0,
            totalAchievements: profileData.totalAchievements || 0,
            achievements: [],
            friends: friendsData
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  const handleSaveProfile = async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          username: editedUsername,
          avatar: editedAvatar
        })
      });

      if (res.ok) {
        onUpdateProfile({ username: editedUsername, avatar: editedAvatar });
        setEditingProfile(false);
        setMessage({ type: 'success', text: 'Profilo aggiornato con successo!' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.message || 'Errore durante l\'aggiornamento' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore di connessione' });
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Le password non coincidono' });
      return;
    }

    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Password cambiata con successo!' });
        setShowPasswordChange(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.message || 'Errore durante il cambio password' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore di connessione' });
    }
  };

  const handleSetRecoveryEmail = async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/set-recovery-email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ recoveryEmail })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Email di recupero impostata!' });
        setShowEmailRecovery(false);
        setRecoveryEmail('');
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.message || 'Errore' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore di connessione' });
    }
  };

  const formatPlayTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const winRate = stats ? (stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900/10 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Il Mio Profilo</h1>
            <p className="text-slate-400">Gestisci il tuo account e visualizza le statistiche</p>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
            <button onClick={() => setMessage(null)} className="float-right">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Caricamento profilo...</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Profile Card */}
            <div className="bg-gradient-to-r from-slate-800/80 to-slate-700/50 rounded-2xl p-6 border border-white/10">
              <div className="flex items-start gap-6 flex-wrap">
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl">
                    {editedAvatar || userAvatar || '👤'}
                  </div>
                  {editingProfile && (
                    <button
                      onClick={() => setShowAvatarSelector(true)}
                      className="absolute -bottom-2 -right-2 p-2 bg-blue-500 rounded-full text-white hover:bg-blue-600"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex-1">
                  {editingProfile ? (
                    <input
                      type="text"
                      value={editedUsername}
                      onChange={(e) => setEditedUsername(e.target.value)}
                      className="bg-slate-700 text-white text-2xl font-bold px-4 py-2 rounded-xl w-full max-w-xs"
                    />
                  ) : (
                    <h2 className="text-2xl font-bold text-white">{playerName}</h2>
                  )}
                  <p className="text-slate-400">{userEmail || 'Email non impostata'}</p>
                  
                  {stats && stats.rank > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-400" />
                      <span className="text-amber-400 font-semibold">Posizione #{stats.rank}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {editingProfile ? (
                    <>
                      <button
                        onClick={handleSaveProfile}
                        className="p-3 bg-green-500 hover:bg-green-600 rounded-xl text-white"
                      >
                        <Save className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingProfile(false);
                          setEditedUsername(playerName);
                          setEditedAvatar(userAvatar || '');
                        }}
                        className="p-3 bg-slate-600 hover:bg-slate-500 rounded-xl text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditingProfile(true)}
                      className="p-3 bg-blue-500/20 hover:bg-blue-500/30 rounded-xl text-blue-400"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 rounded-2xl p-5 border border-white/10 text-center">
                <Star className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <p className="text-3xl font-bold text-white">{stats?.puntiRankiard || 0}</p>
                <p className="text-slate-400 text-sm">Punti Rankiard</p>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-5 border border-white/10 text-center">
                <Gamepad2 className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <p className="text-3xl font-bold text-white">{stats?.gamesPlayed || 0}</p>
                <p className="text-slate-400 text-sm">Partite Giocate</p>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-5 border border-white/10 text-center">
                <Trophy className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-3xl font-bold text-white">{stats?.gamesWon || 0}</p>
                <p className="text-slate-400 text-sm">Vittorie</p>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-5 border border-white/10 text-center">
                <TrendingUp className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <p className="text-3xl font-bold text-white">{winRate}%</p>
                <p className="text-slate-400 text-sm">Win Rate</p>
              </div>
            </div>

            {/* Rank and Progress */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800/50 rounded-2xl p-5 border border-white/10 text-center">
                <Award className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                <p className="text-3xl font-bold text-white">#{stats?.rank || '-'}</p>
                <p className="text-slate-400 text-sm">Posizione Classifica</p>
                <p className="text-xs text-slate-500 mt-1">su {stats?.totalPlayers || 0} giocatori</p>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-5 border border-white/10 text-center">
                <Target className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                <p className="text-3xl font-bold text-white">{stats?.completedMissions || 0}/{stats?.totalMissions || 0}</p>
                <p className="text-slate-400 text-sm">Missioni Completate</p>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-5 border border-white/10 text-center">
                <Trophy className="w-8 h-8 text-pink-400 mx-auto mb-2" />
                <p className="text-3xl font-bold text-white">{stats?.completedAchievements || 0}/{stats?.totalAchievements || 0}</p>
                <p className="text-slate-400 text-sm">Achievements</p>
              </div>
            </div>

            {/* Play Time */}
            <div className="bg-slate-800/50 rounded-2xl p-5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-6 h-6 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">Tempo di Gioco</h3>
              </div>
              <p className="text-3xl font-bold text-white">{formatPlayTime(stats?.totalPlayTime || 0)}</p>
              <p className="text-slate-400">Tempo totale trascorso a giocare</p>
            </div>

            {/* Friends */}
            {stats && stats.friends.length > 0 && (
              <div className="bg-slate-800/50 rounded-2xl p-5 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-6 h-6 text-pink-400" />
                  <h3 className="text-lg font-semibold text-white">Amici ({stats.friends.length})</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  {stats.friends.slice(0, 10).map(friend => (
                    <div key={friend.id} className="flex items-center gap-2 bg-slate-700/50 rounded-full px-3 py-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-sm">
                        {friend.avatar || friend.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white text-sm">{friend.username}</span>
                      <div className={`w-2 h-2 rounded-full ${friend.online ? 'bg-green-400' : 'bg-slate-500'}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Account Settings */}
            <div className="bg-slate-800/50 rounded-2xl p-5 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Impostazioni Account</h3>
              <div className="grid gap-3">
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="flex items-center gap-3 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors text-left"
                >
                  <Key className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-white font-medium">Cambia Password</p>
                    <p className="text-slate-400 text-sm">Modifica la password del tuo account</p>
                  </div>
                </button>
                <button
                  onClick={() => setShowEmailRecovery(true)}
                  className="flex items-center gap-3 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors text-left"
                >
                  <Mail className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-white font-medium">Email di Recupero</p>
                    <p className="text-slate-400 text-sm">Imposta un'email per recuperare la password</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Avatar Selector Modal */}
        {showAvatarSelector && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Scegli Avatar</h3>
                <button onClick={() => setShowAvatarSelector(false)} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="grid grid-cols-6 gap-3 max-h-80 overflow-y-auto p-2">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => {
                      setEditedAvatar(avatar.id);
                      setShowAvatarSelector(false);
                    }}
                    className={`
                      w-12 h-12 flex items-center justify-center rounded-xl text-2xl
                      transition-all duration-200 hover:scale-110
                      ${editedAvatar === avatar.id 
                        ? 'bg-purple-600 ring-2 ring-white shadow-lg' 
                        : 'bg-gray-700 hover:bg-gray-600'
                      }
                    `}
                  >
                    {avatar.emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Password Change Modal */}
        {showPasswordChange && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Cambia Password</h3>
                <button onClick={() => setShowPasswordChange(false)} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Password Attuale</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-slate-700 text-white px-4 py-3 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Nuova Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-700 text-white px-4 py-3 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Conferma Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-700 text-white px-4 py-3 rounded-xl"
                  />
                </div>
                <button
                  onClick={handleChangePassword}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium"
                >
                  Cambia Password
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email Recovery Modal */}
        {showEmailRecovery && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Email di Recupero</h3>
                <button onClick={() => setShowEmailRecovery(false)} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-slate-400 mb-4">
                Inserisci un'email per poter recuperare la password in caso di smarrimento.
              </p>
              <div className="space-y-4">
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="email@esempio.com"
                  className="w-full bg-slate-700 text-white px-4 py-3 rounded-xl"
                />
                <button
                  onClick={handleSetRecoveryEmail}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium"
                >
                  Imposta Email
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
