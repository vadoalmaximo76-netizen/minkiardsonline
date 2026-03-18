import React, { useState } from "react";
import { 
  Gamepad2, BookOpen, Shield, Users, User, Shuffle, Trophy, Crown, 
  ChevronRight, CheckCircle2, Play, Flame, TrendingUp
} from "lucide-react";

export function ProgressionFirst() {
  const [clickedLink, setClickedLink] = useState<string | null>(null);

  const handleLinkClick = (linkName: string) => {
    setClickedLink(linkName);
    setTimeout(() => setClickedLink(null), 300);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans w-full max-w-[390px] mx-auto overflow-hidden relative shadow-2xl flex flex-col">
      <style>{`
        @keyframes pulse-border {
          0% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(168, 85, 247, 0); }
          100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        @keyframes fill-bar {
          from { width: 0%; }
          to { width: 85%; }
        }
        .animate-rank-badge {
          animation: float 4s ease-in-out infinite;
        }
        .progress-fill-anim {
          animation: fill-bar 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header */}
      <header className="px-6 py-5 flex justify-between items-center z-10 relative">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center font-bold text-sm shadow-[0_0_15px_rgba(168,85,247,0.5)]">
            M
          </div>
          <h1 className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
            MINKIARDS
          </h1>
        </div>
        <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800 backdrop-blur-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-sm font-medium">Ciao, <span className="text-purple-400">Fake</span></span>
        </div>
      </header>

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto pb-32 no-scrollbar">
        {/* RANK SECTION (40% of screen approx) */}
        <section className="px-6 pt-4 pb-8 flex flex-col items-center justify-center relative">
          {/* Decorative background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-600/20 blur-[60px] rounded-full pointer-events-none"></div>
          
          <div className="flex flex-col items-center w-full z-10">
            <h2 className="text-xs font-bold text-slate-400 tracking-[0.2em] mb-4 uppercase">Il tuo rango</h2>
            
            {/* Rank Badge */}
            <div className="relative mb-8 animate-rank-badge group cursor-pointer" onClick={() => handleLinkClick("rank-details")}>
              <div className="absolute inset-0 bg-gradient-to-b from-purple-500 to-indigo-600 rounded-[2rem] blur-md opacity-50 group-hover:opacity-80 transition-opacity"></div>
              <div className="relative w-32 h-36 bg-gradient-to-b from-slate-800 to-slate-900 rounded-t-[3rem] rounded-b-[4rem] border-2 border-purple-500 flex flex-col items-center justify-center shadow-2xl overflow-hidden" style={{ animation: 'pulse-border 2s infinite' }}>
                <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent"></div>
                <Flame className="w-12 h-12 text-purple-400 mb-2 drop-shadow-[0_0_10px_rgba(192,132,252,0.8)]" />
                <span className="text-3xl font-black text-white tracking-tighter drop-shadow-md">1276</span>
                <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider mt-1">Sfidante</span>
              </div>
              
              {/* Rank Tier indicator */}
              <div className="absolute -bottom-3 -right-3 w-10 h-10 bg-slate-900 rounded-full border border-slate-700 flex items-center justify-center shadow-lg">
                <span className="text-xs font-bold text-slate-300">III</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-xs mb-6">
              <div className="flex justify-between text-xs font-medium mb-2">
                <span className="text-slate-300">Sfidante</span>
                <span className="text-purple-400">Campione <span className="text-slate-500">(1500)</span></span>
              </div>
              <div className="h-3 w-full bg-slate-900 rounded-full border border-slate-800 overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 via-indigo-500 to-blue-400 rounded-full progress-fill-anim relative">
                  <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-r from-transparent to-white/30"></div>
                </div>
              </div>
              <p className="text-center text-[11px] text-slate-500 mt-3 font-medium">
                <span className="text-slate-300">224 punti</span> al prossimo grado
              </p>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-xs bg-slate-900/50 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80">
              <div className="flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-white">63</span>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Partite</span>
              </div>
              <div className="flex flex-col items-center justify-center border-x border-slate-800">
                <span className="text-lg font-bold text-green-400">45</span>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Vittorie</span>
              </div>
              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-1 text-blue-400">
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-lg font-bold">71%</span>
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Win Rate</span>
              </div>
            </div>
          </div>
        </section>

        {/* DAILY MISSIONS */}
        <section className="px-0 pb-6">
          <div className="px-6 flex justify-between items-end mb-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-purple-500 rounded-full"></span>
              Missioni Giornaliere
            </h3>
            <span className="text-[10px] text-slate-500 font-medium bg-slate-900 px-2 py-0.5 rounded-full">Aggiornamento in 4h</span>
          </div>
          
          {/* Horizontal scroll for missions */}
          <div className="flex gap-4 overflow-x-auto px-6 pb-4 snap-x snap-mandatory no-scrollbar">
            {/* Mission 1 - In Progress */}
            <div className="snap-center shrink-0 w-[240px] bg-gradient-to-br from-slate-900 to-slate-900/80 rounded-2xl p-4 border border-slate-800 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-bl-full pointer-events-none"></div>
              <div className="flex justify-between items-start mb-3">
                <div className="bg-blue-500/20 p-2 rounded-xl text-blue-400">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md">
                  +50 <Flame className="w-3 h-3" />
                </div>
              </div>
              <h4 className="font-semibold text-sm mb-1 text-slate-200">Vinci 1 partita ranked</h4>
              <p className="text-[11px] text-slate-500 mb-4 line-clamp-1">Ottieni una vittoria in modalità Gioca.</p>
              
              <div className="mb-3">
                <div className="flex justify-between text-[10px] mb-1.5 font-medium">
                  <span className="text-slate-400">Progresso</span>
                  <span className="text-blue-400">0/1</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[10%] rounded-full"></div>
                </div>
              </div>
              
              <button 
                onClick={() => handleLinkClick("mission-1")}
                className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${clickedLink === "mission-1" ? 'bg-blue-600 scale-95' : 'bg-blue-500 hover:bg-blue-400'} text-white shadow-[0_0_10px_rgba(59,130,246,0.3)] flex items-center justify-center gap-1`}
              >
                Gioca Ora <Play className="w-3 h-3 fill-current" />
              </button>
            </div>

            {/* Mission 2 - In Progress */}
            <div className="snap-center shrink-0 w-[240px] bg-gradient-to-br from-slate-900 to-slate-900/80 rounded-2xl p-4 border border-slate-800 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rounded-bl-full pointer-events-none"></div>
              <div className="flex justify-between items-start mb-3">
                <div className="bg-orange-500/20 p-2 rounded-xl text-orange-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md">
                  +25 <Flame className="w-3 h-3" />
                </div>
              </div>
              <h4 className="font-semibold text-sm mb-1 text-slate-200">Allena contro CPU</h4>
              <p className="text-[11px] text-slate-500 mb-4 line-clamp-1">Completa un match di allenamento.</p>
              
              <div className="mb-3">
                <div className="flex justify-between text-[10px] mb-1.5 font-medium">
                  <span className="text-slate-400">Progresso</span>
                  <span className="text-orange-400">0/1</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 w-[5%] rounded-full"></div>
                </div>
              </div>
              
              <button 
                onClick={() => handleLinkClick("mission-2")}
                className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${clickedLink === "mission-2" ? 'bg-slate-700 scale-95' : 'bg-slate-800 hover:bg-slate-700'} text-slate-200 flex items-center justify-center gap-1`}
              >
                Vai all'Allenamento <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Mission 3 - Completed */}
            <div className="snap-center shrink-0 w-[240px] bg-gradient-to-br from-slate-900/50 to-slate-900/30 rounded-2xl p-4 border border-slate-800/50 relative overflow-hidden opacity-80">
              <div className="flex justify-between items-start mb-3">
                <div className="bg-green-500/20 p-2 rounded-xl text-green-400">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-green-400">
                  Completata
                </div>
              </div>
              <h4 className="font-semibold text-sm mb-1 text-slate-400 line-through decoration-slate-600">Visita la Classifica</h4>
              <p className="text-[11px] text-slate-500 mb-4">Controlla la tua posizione oggi.</p>
              
              <div className="mb-3">
                <div className="flex justify-between text-[10px] mb-1.5 font-medium">
                  <span className="text-green-500">Completato</span>
                  <span className="text-green-500">1/1</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 w-full rounded-full"></div>
                </div>
              </div>
              
              <button disabled className="w-full py-2 rounded-xl text-xs font-bold bg-slate-800/50 text-slate-500 flex items-center justify-center gap-1 cursor-not-allowed">
                Riscosso <CheckCircle2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* QUICK ACTION & BOTTOM NAV (Fixed) */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent pt-12 pb-6 px-6 z-20 pointer-events-none">
        <div className="pointer-events-auto">
          {/* Main Action Button */}
          <button 
            onClick={() => handleLinkClick("play-main")}
            className={`w-full relative group mb-5 transition-transform duration-200 ${clickedLink === "play-main" ? 'scale-[0.98]' : 'hover:-translate-y-1'}`}
          >
            <div className="absolute inset-0 bg-green-500 rounded-2xl blur-md opacity-40 group-hover:opacity-60 transition-opacity"></div>
            <div className="relative bg-gradient-to-b from-green-400 to-green-600 rounded-2xl p-[2px] shadow-xl">
              <div className="bg-gradient-to-b from-green-500 to-green-700 rounded-[14px] px-6 py-4 flex items-center justify-between border-t border-green-400/30">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                    <Gamepad2 className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left flex flex-col">
                    <span className="text-lg font-black text-white tracking-wide">GIOCA ORA</span>
                    <span className="text-[10px] font-bold text-green-100 uppercase tracking-wider opacity-90">Guadagna Rankiard</span>
                  </div>
                </div>
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
                  <Play className="w-4 h-4 text-white fill-current" />
                </div>
              </div>
            </div>
          </button>

          {/* Quick Links Grid */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'allenamento', icon: BookOpen, label: 'Allena' },
              { id: 'palestre', icon: Shield, label: 'Palestre' },
              { id: 'draft', icon: Shuffle, label: 'Draft' },
              { id: 'menu', icon: Crown, label: 'Altro' }
            ].map((item) => (
              <button 
                key={item.id}
                onClick={() => handleLinkClick(item.id)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${clickedLink === item.id ? 'bg-slate-800' : 'hover:bg-slate-900'}`}
              >
                <item.icon className={`w-5 h-5 ${item.id === 'menu' ? 'text-yellow-500' : 'text-slate-400'}`} />
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
