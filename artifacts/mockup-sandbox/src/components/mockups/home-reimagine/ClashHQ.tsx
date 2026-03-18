import React from 'react';
import { Gamepad2, GraduationCap, Shield, Users, User, Shuffle, Trophy, Crown, Star } from 'lucide-react';

export function ClashHQ() {
  const stats = {
    playerName: "Fake",
    puntiRankiard: 1276,
    gamesPlayed: 63,
    gamesWon: 45,
    winRate: "71%"
  };

  const navItems = [
    { label: "ALLENAMENTO", icon: GraduationCap, color: "from-green-500 to-emerald-600", shadow: "shadow-emerald-500/20" },
    { label: "PALESTRE", icon: Shield, color: "from-blue-500 to-indigo-600", shadow: "shadow-blue-500/20" },
    { label: "STANZE", icon: Users, color: "from-cyan-500 to-blue-500", shadow: "shadow-cyan-500/20" },
    { label: "PROFILO", icon: User, color: "from-slate-500 to-slate-700", shadow: "shadow-slate-500/20" },
    { label: "DRAFT", icon: Shuffle, color: "from-purple-500 to-fuchsia-600", shadow: "shadow-purple-500/20" },
    { label: "CLASSIFICA", icon: Trophy, color: "from-yellow-400 to-orange-500", shadow: "shadow-yellow-500/20" },
    { label: "FANTA", icon: Crown, color: "from-pink-500 to-rose-600", shadow: "shadow-pink-500/20" },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans overflow-x-hidden relative flex flex-col items-center">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 z-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="w-full max-w-[414px] flex flex-col min-h-screen relative z-10 px-4">
        
        {/* Top Bar */}
        <header className="flex justify-between items-center py-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-widest text-white/50 mb-0.5">MINKIARDS</span>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                <User size={16} className="text-slate-300" />
              </div>
              <span className="font-bold text-lg">{stats.playerName}</span>
            </div>
          </div>
          <div className="flex items-center bg-yellow-500/10 border border-yellow-500/30 px-3 py-1.5 rounded-full">
            <Star size={16} className="text-yellow-400 fill-yellow-400 mr-2" />
            <span className="font-bold text-yellow-400">{stats.puntiRankiard}</span>
          </div>
        </header>

        {/* Hero Section - Play Button */}
        <main className="flex-1 flex flex-col items-center justify-center py-8">
          <button className="relative w-full max-w-[340px] aspect-[4/3] max-h-[240px] rounded-[24px] bg-gradient-to-br from-orange-400 to-red-600 p-1 mb-6 group transform transition-transform active:scale-95 shadow-[0_0_40px_rgba(239,68,68,0.3)] hover:shadow-[0_0_60px_rgba(239,68,68,0.5)]">
            {/* Inner border */}
            <div className="absolute inset-1 rounded-[20px] border-2 border-white/20 z-10 pointer-events-none" />
            
            {/* Shine effect */}
            <div className="absolute inset-0 rounded-[24px] bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Content */}
            <div className="w-full h-full rounded-[20px] flex flex-col items-center justify-center bg-gradient-to-br from-orange-500 to-red-600 overflow-hidden relative">
              
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center animate-pulse-slow">
                <Gamepad2 size={56} strokeWidth={1.5} className="mb-2 text-white drop-shadow-md" />
                <span className="text-4xl font-black tracking-tight drop-shadow-md">GIOCA</span>
              </div>
            </div>
            
            {/* CSS Animation for the button */}
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes pulse-slow {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
              }
              .animate-pulse-slow {
                animation: pulse-slow 3s ease-in-out infinite;
              }
            `}} />
          </button>

          {/* Stats below hero */}
          <div className="flex items-center justify-center gap-3 text-sm font-medium text-white/70 bg-white/5 px-6 py-2.5 rounded-full border border-white/10 backdrop-blur-sm">
            <span>{stats.gamesPlayed} partite</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>{stats.gamesWon} vittorie</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span className="text-emerald-400">{stats.winRate} win rate</span>
          </div>
        </main>

        {/* Secondary Grid */}
        <section className="mb-8">
          <div className="grid grid-cols-4 gap-3">
            {navItems.map((item, i) => (
              <button key={i} className="flex flex-col items-center justify-center gap-2 aspect-square rounded-2xl bg-[#161b22] border border-white/5 active:scale-95 transition-transform hover:bg-[#1c2128]">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg ${item.shadow}`}>
                  <item.icon size={20} className="text-white drop-shadow-sm" />
                </div>
                <span className="text-[10px] font-bold text-white/80">{item.label}</span>
              </button>
            ))}
            
            {/* Empty slot or additional action to fill 4x2 if needed. Currently 7 items, 1 empty. Let's make it an 8th generic item like "SHOP" or "IMPOSTAZIONI" if needed, but the spec says 7 specific ones. Wait, spec says "Navigazione disponibile (8 voci principali)" but lists 8: GIOCA (which is hero), ALLENAMENTO, PALESTRE, STANZE, PROFILO, DRAFT, CLASSIFICA, FANTA. So 7 in the grid.
            Let's add a placeholder or duplicate for balance, or just leave 7. A 4x2 grid with 7 items leaves 1 empty. Let's add IMPOSTAZIONI. */}
            <button className="flex flex-col items-center justify-center gap-2 aspect-square rounded-2xl bg-[#161b22] border border-white/5 active:scale-95 transition-transform hover:bg-[#1c2128]">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center shadow-lg shadow-gray-900/50">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white drop-shadow-sm"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                </div>
                <span className="text-[10px] font-bold text-white/80">OPZIONI</span>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
