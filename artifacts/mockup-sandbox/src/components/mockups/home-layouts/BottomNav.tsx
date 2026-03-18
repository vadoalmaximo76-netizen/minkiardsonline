import React, { useState } from 'react';
import { Trophy, Star, Swords, BookOpen, User, MoreHorizontal, Play, Users, CheckCircle2 } from 'lucide-react';

export function BottomNav() {
  const [activeTab, setActiveTab] = useState('gioca');

  // Hardcoded data
  const user = {
    playerName: "Fake",
    puntiRankiard: 1276,
    partite: 63,
    vittorie: 45,
    winRate: 71
  };

  const tabs = [
    { id: 'gioca', label: 'Gioca', icon: <Swords size={24} /> },
    { id: 'allena', label: 'Allena', icon: <BookOpen size={24} /> },
    { id: 'profilo', label: 'Profilo', icon: <User size={24} /> },
    { id: 'altro', label: 'Altro', icon: <MoreHorizontal size={24} /> },
  ];

  const activeRooms = [
    { id: 1, name: "Stanza di Marco", players: 2, maxPlayers: 4 },
    { id: 2, name: "Torneo Serale", players: 3, maxPlayers: 4 }
  ];

  return (
    <div 
      className="relative mx-auto overflow-hidden font-sans text-white flex flex-col"
      style={{ 
        backgroundColor: '#08101e',
        minHeight: '100vh',
        maxWidth: '430px', // Mobile constraints
        boxShadow: '0 0 20px rgba(0,0,0,0.5)'
      }}
    >
      <style>
        {`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .glass-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
          }
          .glass-card:active {
            background: rgba(255, 255, 255, 0.08);
          }
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 15px rgba(34, 197, 94, 0.3); }
            50% { box-shadow: 0 0 25px rgba(34, 197, 94, 0.6); }
          }
        `}
      </style>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar pb-24">
        
        {/* Header */}
        <header className="flex justify-between items-center p-5 sticky top-0 z-10" style={{ background: 'rgba(8, 16, 30, 0.85)', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-xl font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            MINKIARDS
          </h1>
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/5">
            <Star size={14} className="text-yellow-400 fill-yellow-400" />
            <span className="font-bold text-sm text-yellow-50">{user.puntiRankiard}</span>
          </div>
        </header>

        {activeTab === 'gioca' && (
          <div className="p-5 flex flex-col gap-6">
            
            {/* Hero Section */}
            <section>
              <button 
                className="w-full relative overflow-hidden rounded-2xl p-6 text-left group transition-transform active:scale-95"
                style={{ 
                  background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                  animation: 'pulse-glow 3s infinite',
                }}
              >
                <div className="absolute top-0 right-0 -mt-4 -mr-4 opacity-20">
                  <Swords size={120} />
                </div>
                <div className="relative z-10">
                  <h2 className="text-3xl font-black text-white mb-1 drop-shadow-md">NUOVA PARTITA</h2>
                  <p className="text-green-100 font-medium mb-6 text-sm">Trova un avversario del tuo livello</p>
                  
                  <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full font-bold text-white shadow-lg">
                    <Play size={18} className="fill-white" />
                    <span>CERCA AVVERSARIO</span>
                  </div>
                </div>
              </button>
            </section>

            {/* Stanze Attive */}
            <section>
              <div className="flex justify-between items-end mb-3 px-1">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Stanze Attive</h3>
                <span className="text-xs text-green-400 font-semibold cursor-pointer">Vedi tutte</span>
              </div>
              <div className="flex flex-col gap-3">
                {activeRooms.map((room) => (
                  <div key={room.id} className="glass-card p-4 flex justify-between items-center transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/10 p-2 rounded-lg">
                        <Users size={18} className="text-blue-300" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-100 text-sm">{room.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{room.players}/{room.maxPlayers} giocatori</div>
                      </div>
                    </div>
                    <button className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors">
                      UNISCITI
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Ultima Partita */}
            <section>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Ultima Partita</h3>
              <div className="glass-card p-4 flex items-center gap-4">
                <div className="bg-green-500/20 p-2 rounded-full border border-green-500/30">
                  <CheckCircle2 size={24} className="text-green-400" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-gray-100 mb-0.5">Vittoria vs CPU-Alessio</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">Rankiard:</span>
                    <span className="text-green-400 font-bold">+45</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-yellow-400 font-bold flex items-center gap-0.5">
                      <Star size={10} className="fill-yellow-400" /> 1276
                    </span>
                  </div>
                </div>
              </div>
            </section>

          </div>
        )}

        {activeTab !== 'gioca' && (
          <div className="flex items-center justify-center h-64 text-gray-500 font-medium">
            Sezione in costruzione
          </div>
        )}

      </div>

      {/* Persistent Bottom Tab Bar */}
      <nav 
        className="absolute bottom-0 left-0 w-full flex justify-around items-end px-2 pb-5 pt-3 z-50"
        style={{ 
          backgroundColor: '#0d1525',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
          height: '80px' // giving a bit more room for home indicator area
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center gap-1 w-16 relative"
            >
              <div 
                className={\`transition-all duration-300 \${isActive ? 'text-green-500 -translate-y-1' : 'text-gray-500 hover:text-gray-400'}\`}
              >
                {tab.icon}
              </div>
              <span 
                className={\`text-[10px] font-bold transition-colors duration-300 \${isActive ? 'text-green-500' : 'text-gray-500'}\`}
              >
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute -top-3 w-8 h-1 bg-green-500 rounded-b-full shadow-[0_2px_8px_rgba(34,197,94,0.6)]" />
              )}
            </button>
          )
        })}
      </nav>

    </div>
  );
}
