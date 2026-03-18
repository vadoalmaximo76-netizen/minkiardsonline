import React, { useState } from "react";
import { Search, ChevronRight, Home, Users, User, Trophy, PlayCircle } from "lucide-react";

export function QuickPlay() {
  const [isSearching, setIsSearching] = useState(false);

  const playerData = {
    playerName: "Fake",
    puntiRankiard: 1276,
    partite: 63,
    vittorie: 45,
    winRate: "71%",
    rango: "Sfidante"
  };

  return (
    <div className="relative mx-auto w-full max-w-[390px] min-h-screen overflow-hidden font-sans text-white pb-20" style={{ backgroundColor: "#030f0a" }}>
      <style>
        {`
          @keyframes ripple {
            0% {
              transform: scale(0.8);
              opacity: 1;
            }
            100% {
              transform: scale(2.5);
              opacity: 0;
            }
          }
          .animate-ripple {
            animation: ripple 2s cubic-bezier(0, 0.2, 0.8, 1) infinite;
          }
          .animate-ripple-delay-1 {
            animation: ripple 2s cubic-bezier(0, 0.2, 0.8, 1) 0.6s infinite;
          }
          .animate-ripple-delay-2 {
            animation: ripple 2s cubic-bezier(0, 0.2, 0.8, 1) 1.2s infinite;
          }
        `}
      </style>

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 sticky top-0 z-20" style={{ backgroundColor: "#030f0a" }}>
        <h1 className="text-xl font-black tracking-tighter text-white">MINKIARDS</h1>
        <div className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full border border-white/10">
          <span className="text-sm">⭐</span>
          <span className="text-sm font-bold">{playerData.puntiRankiard}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 flex flex-col gap-6 mt-2">
        
        {/* Hero - Matchmaking */}
        <div className="relative h-[130px] flex items-center justify-center rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(22,163,74,0.15)]" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
          {isSearching && (
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
              <div className="absolute w-24 h-24 rounded-full border border-green-500/50 animate-ripple"></div>
              <div className="absolute w-24 h-24 rounded-full border border-green-500/50 animate-ripple-delay-1"></div>
              <div className="absolute w-24 h-24 rounded-full border border-green-500/50 animate-ripple-delay-2"></div>
            </div>
          )}
          <button 
            onClick={() => setIsSearching(!isSearching)}
            className="relative z-10 w-[90%] h-16 rounded-xl font-black text-lg tracking-wide shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
            style={{ 
              backgroundColor: isSearching ? "#b91c1c" : "#16a34a",
              color: "white" 
            }}
          >
            {isSearching ? (
              <>ANNULLA RICERCA...</>
            ) : (
              <>⚔️ CERCA PARTITA</>
            )}
          </button>
        </div>

        {/* Stanze Attive */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-white/50 tracking-wider">STANZE ATTIVE</h2>
            <span className="text-xs font-medium text-green-400">2 stanze</span>
          </div>
          
          <div className="flex flex-col gap-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex flex-col">
                  <span className="font-bold text-sm">Stanza di {i === 1 ? "Marco" : "Luca"}</span>
                  <span className="text-xs text-white/50">{i === 1 ? "2/4" : "3/4"} giocatori</span>
                </div>
                <button className="px-4 py-1.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#16a34a" }}>
                  ENTRA
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Ultima Partita */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold text-white/50 tracking-wider">ULTIMA PARTITA</h2>
          <button className="w-full flex items-center justify-between p-4 rounded-xl text-left active:scale-[0.98] transition-transform" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-sm">✅ Vittoria vs CPU-Alessio</span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-400 font-bold">+28 Rankiard</span>
                <span className="text-white/30">•</span>
                <span className="text-white/50">3h fa</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/30" />
          </button>
        </section>

      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] h-[72px] flex items-center justify-around px-2 z-30 backdrop-blur-md" style={{ backgroundColor: "rgba(3, 15, 10, 0.85)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <button className="flex flex-col items-center justify-center w-12 h-12 gap-1 text-green-400">
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-bold">GIOCA</span>
        </button>
        <button className="flex flex-col items-center justify-center w-12 h-12 gap-1 text-white/40 hover:text-white/80 transition-colors">
          <PlayCircle className="w-6 h-6" />
          <span className="text-[10px] font-bold">ALLEN.</span>
        </button>
        <button className="flex flex-col items-center justify-center w-12 h-12 gap-1 text-white/40 hover:text-white/80 transition-colors">
          <Users className="w-6 h-6" />
          <span className="text-[10px] font-bold">STANZE</span>
        </button>
        <button className="flex flex-col items-center justify-center w-12 h-12 gap-1 text-white/40 hover:text-white/80 transition-colors">
          <Trophy className="w-6 h-6" />
          <span className="text-[10px] font-bold">CLASSIF.</span>
        </button>
        <button className="flex flex-col items-center justify-center w-12 h-12 gap-1 text-white/40 hover:text-white/80 transition-colors">
          <User className="w-6 h-6" />
          <span className="text-[10px] font-bold">PROFILO</span>
        </button>
      </nav>

    </div>
  );
}
