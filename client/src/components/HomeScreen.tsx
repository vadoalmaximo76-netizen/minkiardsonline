import React, { useState, useEffect } from 'react';
import { Gamepad2, GraduationCap, Users, User, Trophy, Clock, Star, Award, Sparkles, Settings } from 'lucide-react';
import { TournamentPanel } from './TournamentPanel';
import { SeasonalEventsPanel } from './SeasonalEventsPanel';

interface HomeScreenProps {
  playerName: string;
  userId?: number;
  onNavigate: (section: 'play' | 'training' | 'rooms' | 'profile' | 'admin') => void;
  onJoinTournamentMatch?: (gameId: string, matchId: number, tournamentName: string) => void;
  userEmail?: string;
}

interface UserStats {
  puntiRankiard: number;
  gamesPlayed: number;
  gamesWon: number;
}

export function HomeScreen({ playerName, userId, onNavigate, onJoinTournamentMatch, userEmail }: HomeScreenProps) {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [activeRoomsCount, setActiveRoomsCount] = useState(0);
  const [randomQuote, setRandomQuote] = useState("");
  const isAdmin = userEmail === 'lucaforte94@gmail.com';

  useEffect(() => {
    const quotes = [
      "Viva il Pelux",
      "Entra nel vivo del gioco scegliendo la sezione che preferisci",
      "Lo sapevi che puoi compare skin speciali per le tue carte? Vai su PROFILO E STORE e scegli SKIN CARTE",
      "Vuoi capire meglio il meccanismo delle Minkiards? Vai su ALLENAMENTO e premi su REGOLAMENTO per non avere più dubbi!",
      "Minkiards è un progetto indipendente nato nel 2012, per maggiori info contatta vadoalmaximo76@gmail.com"
    ];
    setRandomQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);
  const [showTournaments, setShowTournaments] = useState(false);
  const [showSeasonalEvents, setShowSeasonalEvents] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
          const statsRes = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (statsRes.ok) {
            const data = await statsRes.json();
            setUserStats({
              puntiRankiard: data.user.puntiRankiard || 0,
              gamesPlayed: data.user.gamesPlayed || 0,
              gamesWon: data.user.gamesWon || 0
            });
          }
        }

        const roomsRes = await fetch('/api/active-rooms');
        if (roomsRes.ok) {
          const rooms = await roomsRes.json();
          setActiveRoomsCount(rooms.length || 0);
        }
      } catch (error) {
        console.error('Error fetching home screen data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    {
      id: 'play' as const,
      title: 'Gioca',
      subtitle: 'Partita completa con missioni e premi',
      icon: Gamepad2,
      gradient: 'from-purple-600 via-purple-500 to-indigo-600',
      hoverGradient: 'hover:from-purple-500 hover:via-purple-400 hover:to-indigo-500',
      shadowColor: 'shadow-purple-500/30',
      badge: userStats ? `${userStats.puntiRankiard} Rankiard` : null,
      badgeIcon: Trophy,
      action: () => onNavigate('play')
    },
    {
      id: 'training' as const,
      title: 'Allenamento',
      subtitle: 'Impara a giocare contro la CPU',
      icon: GraduationCap,
      gradient: 'from-emerald-600 via-emerald-500 to-teal-600',
      hoverGradient: 'hover:from-emerald-500 hover:via-emerald-400 hover:to-teal-500',
      shadowColor: 'shadow-emerald-500/30',
      badge: 'Tutorial',
      badgeIcon: Star,
      action: () => onNavigate('training')
    },
    {
      id: 'rooms' as const,
      title: 'Stanze di Gioco',
      subtitle: 'Entra in una partita attiva',
      icon: Users,
      gradient: 'from-amber-600 via-orange-500 to-red-600',
      hoverGradient: 'hover:from-amber-500 hover:via-orange-400 hover:to-red-500',
      shadowColor: 'shadow-orange-500/30',
      badge: activeRoomsCount > 0 ? `${activeRoomsCount} attive` : 'Nessuna',
      badgeIcon: Users,
      action: () => onNavigate('rooms')
    },
    {
      id: 'tournaments' as const,
      title: 'Tornei',
      subtitle: 'Competizioni ufficiali',
      icon: Award,
      gradient: 'from-rose-600 via-pink-500 to-fuchsia-600',
      hoverGradient: 'hover:from-rose-500 hover:via-pink-400 hover:to-fuchsia-500',
      shadowColor: 'shadow-pink-500/30',
      badge: 'Competitivo',
      badgeIcon: Award,
      action: () => setShowTournaments(true)
    },
    {
      id: 'events' as const,
      title: 'Eventi',
      subtitle: 'Eventi stagionali e carte esclusive',
      icon: Sparkles,
      gradient: 'from-violet-600 via-fuchsia-500 to-pink-600',
      hoverGradient: 'hover:from-violet-500 hover:via-fuchsia-400 hover:to-pink-500',
      shadowColor: 'shadow-fuchsia-500/30',
      badge: 'Speciale',
      badgeIcon: Sparkles,
      action: () => setShowSeasonalEvents(true)
    },
    {
      id: 'profile' as const,
      title: 'Profilo e Store',
      subtitle: 'Statistiche, skin e impostazioni',
      icon: User,
      gradient: 'from-blue-600 via-cyan-500 to-blue-600',
      hoverGradient: 'hover:from-blue-500 hover:via-cyan-400 hover:to-blue-500',
      shadowColor: 'shadow-blue-500/30',
      badge: userStats ? `${userStats.gamesWon}/${userStats.gamesPlayed} vinte` : null,
      badgeIcon: Trophy,
      action: () => onNavigate('profile')
    },
    ...(isAdmin ? [{
      id: 'admin' as const,
      title: 'Gestione Carte',
      subtitle: 'Modifica carte e invia aggiornamenti',
      icon: Settings,
      gradient: 'from-red-600 via-rose-500 to-red-600',
      hoverGradient: 'hover:from-red-500 hover:via-rose-400 hover:to-red-500',
      shadowColor: 'shadow-red-500/30',
      badge: 'Admin',
      badgeIcon: Settings,
      action: () => onNavigate('admin')
    }] : [])
  ];

  return (
    <div className="min-h-screen bg-arena-deep flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Same background as game board */}
      <div 
        className="fixed inset-0 bg-cover bg-center opacity-50"
        style={{
          backgroundImage: 'url(https://files.123freevectors.com/wp-content/original/113342-royal-blue-blurred-background-vector.jpg)'
        }}
      />
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="text-center mb-12 relative z-10">
        <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 tracking-wider mb-4"
            style={{ 
              textShadow: '0 0 40px rgba(168, 85, 247, 0.5), 0 0 80px rgba(168, 85, 247, 0.3)',
              fontFamily: 'Inter, sans-serif'
            }}>
          MINKIARDS
        </h1>
        <p className="text-slate-400 text-lg">
          Benvenuto, <span className="text-white font-semibold">{playerName}</span>
        </p>
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full relative z-10">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const BadgeIcon = item.badgeIcon;
          
          return (
            <button
              key={item.id}
              onClick={item.action}
              className={`
                group relative overflow-hidden
                bg-gradient-to-br ${item.gradient} ${item.hoverGradient}
                rounded-3xl p-6 md:p-8
                transform transition-all duration-300 ease-out
                hover:scale-105 hover:-translate-y-1
                shadow-2xl ${item.shadowColor}
                border border-white/10
                focus:outline-none focus:ring-4 focus:ring-white/20
              `}
            >
              {/* Shine effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </div>

              {/* Content */}
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-8 h-8 md:w-10 md:h-10 text-white" />
                </div>
                
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                  {item.title}
                </h2>
                
                <p className="text-white/70 text-sm md:text-base mb-4">
                  {item.subtitle}
                </p>

                {/* Badge */}
                {item.badge && (
                  <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2">
                    <BadgeIcon className="w-4 h-4 text-white/80" />
                    <span className="text-white/90 text-sm font-medium">{item.badge}</span>
                  </div>
                )}
              </div>

              {/* Corner decoration */}
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/5 rounded-full blur-xl" />
              <div className="absolute -top-4 -left-4 w-16 h-16 bg-white/5 rounded-full blur-xl" />
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center relative z-10 max-w-xl">
        <p className="text-slate-500 text-sm leading-relaxed">
          {randomQuote}
        </p>
      </div>

      {/* Tournament Panel */}
      <TournamentPanel
        isOpen={showTournaments}
        onClose={() => setShowTournaments(false)}
        authToken={localStorage.getItem('authToken')}
        userId={userId}
        onJoinMatch={onJoinTournamentMatch}
      />

      {/* Seasonal Events Panel */}
      <SeasonalEventsPanel
        isOpen={showSeasonalEvents}
        onClose={() => setShowSeasonalEvents(false)}
      />
    </div>
  );
}
