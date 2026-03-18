import React from "react";

export function ActivityFeed() {
  const playerName = "Fake";
  const puntiRankiard = 1276;
  const partite = 63;
  const vittorie = 45;
  const winRate = 71;

  return (
    <div
      className="min-h-screen text-white font-sans flex justify-center pb-24"
      style={{ backgroundColor: "#070d1a" }}
    >
      <style>
        {`
          @keyframes pulse-red {
            0% { border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            70% { border-color: rgba(239, 68, 68, 0.8); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
          .card-base {
            background-color: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
          }
          .animate-pulse-red {
            animation: pulse-red 2s infinite;
          }
        `}
      </style>

      <div className="w-full max-w-[390px] p-4 flex flex-col gap-4">
        {/* Header */}
        <header className="flex items-center justify-between pt-2">
          <div className="flex flex-col">
            <span className="text-sm text-white/50 font-medium">Minkiards</span>
            <h1 className="text-xl font-bold">Ciao, {playerName} 👋</h1>
          </div>
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-lg font-bold shadow-lg">
            {playerName[0]}
          </div>
        </header>

        {/* Stats Pill */}
        <div className="card-base flex items-center justify-around p-3 text-sm font-medium backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-yellow-400">⭐</span>
            <span>{puntiRankiard}</span>
          </div>
          <div className="w-px h-4 bg-white/10"></div>
          <div className="flex items-center gap-1.5 text-white/70">
            <span>{vittorie}/{partite}</span>
          </div>
          <div className="w-px h-4 bg-white/10"></div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span>{winRate}% WR</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-2">
          {/* Card LIVE */}
          <button className="card-base animate-pulse-red p-4 flex items-center justify-between text-left group transition-transform active:scale-95">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <h2 className="text-red-400 font-bold uppercase text-xs tracking-wider">Live Now</h2>
              </div>
              <p className="font-semibold text-lg leading-tight">2 stanze attive</p>
              <p className="text-white/60 text-sm mt-0.5">Unisciti prima che inizino</p>
            </div>
            <div className="bg-red-500/20 text-red-400 px-4 py-2 rounded-xl font-bold text-sm">
              ENTRA
            </div>
          </button>

          {/* Card PRIMARY */}
          <button className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-900 border border-emerald-500/30 p-5 text-left transition-transform active:scale-95 shadow-lg shadow-emerald-900/20 group">
            <div className="absolute top-0 right-0 p-4 opacity-20 text-6xl transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
              ⚔️
            </div>
            <div className="relative z-10">
              <span className="bg-emerald-500/30 text-emerald-100 text-xs font-bold px-2 py-1 rounded-md mb-3 inline-block">
                PRINCIPALE
              </span>
              <h2 className="text-2xl font-black mb-1">GIOCA ORA</h2>
              <p className="text-emerald-100/80 font-medium">Trova un avversario del tuo livello</p>
            </div>
          </button>

          {/* Card EVENTO */}
          <button className="card-base border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent p-4 text-left transition-transform active:scale-95">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🛡️</span>
              <h2 className="text-orange-400 font-bold uppercase text-xs tracking-wider">Evento Palestra</h2>
            </div>
            <p className="font-semibold">Sfida Palestra disponibile</p>
            <p className="text-white/60 text-sm mt-1">Sconfiggi il capopalestra per ottenere il badge</p>
          </button>

          {/* Card STORICO */}
          <div className="card-base p-3 px-4 flex items-center justify-between opacity-80">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm">
                🤖
              </div>
              <div>
                <p className="text-sm font-medium">Vittoria vs CPU-Alessio</p>
                <p className="text-xs text-white/40">Ultima partita • 3 ore fa</p>
              </div>
            </div>
            <span className="text-emerald-400 text-sm font-bold">+24</span>
          </div>
        </div>

        {/* Scorciatoie */}
        <div className="mt-4">
          <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3 px-1">Esplora</h3>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: "🏆", label: "Classifica" },
              { icon: "👤", label: "Profilo" },
              { icon: "🔀", label: "Draft" },
              { icon: "👑", label: "Fanta" }
            ].map((item, i) => (
              <button key={i} className="card-base flex flex-col items-center justify-center p-3 gap-1.5 transition-transform active:scale-95 hover:bg-white/5">
                <span className="text-xl">{item.icon}</span>
                <span className="text-[10px] font-medium text-white/70">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
