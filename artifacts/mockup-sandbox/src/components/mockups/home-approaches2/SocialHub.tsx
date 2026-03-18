import React, { useState } from 'react';
import { 
  Menu, 
  Bell, 
  Trophy, 
  User, 
  Swords, 
  Users, 
  Shield, 
  BookOpen, 
  Shuffle, 
  Crown, 
  ChevronRight,
  Play
} from 'lucide-react';

export function SocialHub() {
  const [activeTab, setActiveTab] = useState('home');

  // Hardcoded data
  const user = {
    playerName: "Fake",
    puntiRankiard: 1276,
    partite: 63,
    vittorie: 45,
    winRate: "71%",
    rango: "Sfidante"
  };

  const activeGames = [
    { id: 1, p1: "Marco", p2: "CPU-Alessio", p1Initial: "M", p2Initial: "C", type: "Ranked" },
    { id: 2, p1: "Sara", p2: "Luca", p1Initial: "S", p2Initial: "L", type: "Amichevole" },
    { id: 3, p1: "Giulia", p2: "CPU-Bozz", p1Initial: "G", p2Initial: "C", type: "Allenamento" }
  ];

  const feedEvents = [
    { id: 1, icon: "🏆", text: "Fake ha vinto +28⭐", time: "2 min fa", action: null },
    { id: 2, icon: "⚔️", text: "Marco ha aperto stanza — 2 posti", time: "5 min fa", action: "UNISCITI" },
    { id: 3, icon: "🎖️", text: "Sara è salita a Campione", time: "12 min fa", action: null },
    { id: 4, icon: "🔥", text: "Luca è in serie di vittorie (5)", time: "1 ora fa", action: null }
  ];

  const secondaryIcons = [
    { id: 'allenamento', icon: <BookOpen size={20} />, label: "Allenamento" },
    { id: 'palestre', icon: <Shield size={20} />, label: "Palestre" },
    { id: 'stanze', icon: <Users size={20} />, label: "Stanze" },
    { id: 'draft', icon: <Shuffle size={20} />, label: "Draft" },
    { id: 'fanta', icon: <Crown size={20} />, label: "Fanta" }
  ];

  return (
    <div 
      className="relative w-full max-w-[390px] mx-auto min-h-screen overflow-x-hidden font-sans text-white pb-24 shadow-2xl"
      style={{ backgroundColor: '#070c16' }}
    >
      <style>{`
        @keyframes pulse-border {
          0% { border-color: rgba(220, 38, 38, 0.4); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
          50% { border-color: rgba(220, 38, 38, 0.8); box-shadow: 0 0 0 4px rgba(220, 38, 38, 0); }
          100% { border-color: rgba(220, 38, 38, 0.4); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
        }
        .live-border {
          animation: pulse-border 2s infinite;
          border: 1px solid rgba(220, 38, 38, 0.5);
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .gradient-text {
          background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      {/* Header */}
      <header className="px-5 pt-12 pb-4 flex justify-between items-center sticky top-0 z-20" style={{ background: 'linear-gradient(to bottom, #070c16 80%, transparent)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-xl shadow-lg">
            M
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-lg">Minkiards</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs text-slate-400 font-medium">Online</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-full glass-card flex items-center justify-center relative active:scale-95 transition-transform">
            <Bell size={18} className="text-slate-300" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500"></span>
          </button>
          
          <div className="glass-card rounded-full pl-1 pr-3 py-1 flex items-center gap-2 cursor-pointer active:scale-95 transition-transform">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm">
              {user.playerName[0]}
            </div>
            <span className="text-sm font-semibold">{user.playerName}</span>
          </div>
        </div>
      </header>

      <div className="px-5 space-y-6 mt-2">
        
        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card rounded-2xl p-4 flex flex-col">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Rankiard</span>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black gradient-text">{user.puntiRankiard}</span>
              <Trophy size={14} className="text-amber-400 mb-1.5" />
            </div>
            <span className="text-xs text-indigo-400 font-medium mt-1">{user.rango}</span>
          </div>
          
          <div className="glass-card rounded-2xl p-4 flex flex-col">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Win Rate</span>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black gradient-text">{user.winRate}</span>
            </div>
            <span className="text-xs text-slate-500 font-medium mt-1">{user.vittorie}W - {user.partite - user.vittorie}L</span>
          </div>
        </div>

        {/* 🔴 ORA IN GIOCO */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <h2 className="text-sm font-bold text-red-500 tracking-wider uppercase">Ora in gioco</h2>
          </div>
          
          <div className="glass-card rounded-2xl p-1 live-border relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl"></div>
            
            <div className="flex flex-col gap-1 relative z-10">
              {activeGames.map((game, i) => (
                <div key={game.id} className={`flex items-center justify-between p-3 rounded-xl ${i !== activeGames.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-[#070c16] flex items-center justify-center text-xs font-bold">
                        {game.p1Initial}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-indigo-900 border-2 border-[#070c16] flex items-center justify-center text-xs font-bold">
                        {game.p2Initial}
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{game.p1} <span className="text-slate-500 text-xs mx-1">vs</span> {game.p2}</span>
                      <span className="text-[10px] text-slate-400">{game.type}</span>
                    </div>
                  </div>
                  
                  <div className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-1 rounded-full border border-red-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    IN CORSO
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEED */}
        <section>
          <h2 className="text-sm font-bold text-slate-300 tracking-wider uppercase mb-3 px-1">Feed Social</h2>
          
          <div className="flex overflow-x-auto hide-scrollbar gap-3 pb-4 -mx-5 px-5">
            {feedEvents.map(event => (
              <div key={event.id} className="glass-card min-w-[240px] rounded-2xl p-4 flex flex-col shrink-0 relative overflow-hidden group active:scale-95 transition-transform">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-2xl">{event.icon}</span>
                  <span className="text-[10px] text-slate-500 font-medium">{event.time}</span>
                </div>
                <p className="text-sm font-medium text-slate-200 mt-1 mb-3">{event.text}</p>
                
                {event.action && (
                  <button className="mt-auto w-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold py-2 rounded-lg transition-colors border border-indigo-500/30">
                    {event.action}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] p-5 pb-8 z-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-[#070c16] via-[#070c16]/90 to-transparent pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col gap-4 pointer-events-auto">
          
          {/* Main Action */}
          <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#070c16] font-black text-lg py-4 rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 transition-all">
            <Swords size={24} />
            GIOCA ORA
          </button>
          
          {/* Secondary Nav */}
          <div className="flex justify-between items-center glass-card rounded-2xl p-2 px-4">
            {secondaryIcons.map(item => (
              <button 
                key={item.id}
                className="flex flex-col items-center justify-center gap-1 p-2 text-slate-400 hover:text-white active:scale-90 transition-all"
              >
                {item.icon}
                <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
              </button>
            ))}
          </div>
          
        </div>
      </div>

    </div>
  );
}
