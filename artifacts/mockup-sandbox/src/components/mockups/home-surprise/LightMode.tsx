import React from 'react';
import { 
  Gamepad2, 
  BookOpen, 
  Shield, 
  Users, 
  User, 
  Shuffle, 
  Trophy, 
  Crown,
  ChevronRight,
  TrendingUp,
  Star,
  Activity,
  Bell
} from 'lucide-react';

export function LightMode() {
  const playerData = {
    playerName: "Fake",
    puntiRankiard: 1276,
    partite: 63,
    vittorie: 45,
    winRate: "71%",
    rango: "Sfidante"
  };

  const sections = [
    { id: 'gioca', title: 'GIOCA', icon: Gamepad2, color: 'bg-[#16a34a] text-white hover:bg-[#15803d]', description: 'Partita classificata' },
    { id: 'allenamento', title: 'ALLENAMENTO', icon: BookOpen, color: 'bg-white text-[#0f172a] hover:bg-[#f1f5f9]', description: 'Contro il bot' },
    { id: 'palestre', title: 'PALESTRE', icon: Shield, color: 'bg-white text-[#0f172a] hover:bg-[#f1f5f9]', description: 'Sfide tematiche' },
    { id: 'stanze', title: 'STANZE', icon: Users, color: 'bg-white text-[#0f172a] hover:bg-[#f1f5f9]', description: 'Gioca con amici' },
    { id: 'draft', title: 'DRAFT', icon: Shuffle, color: 'bg-white text-[#0f172a] hover:bg-[#f1f5f9]', description: 'Crea il tuo mazzo' },
    { id: 'fanta', title: 'FANTA', icon: Crown, color: 'bg-white text-[#0f172a] hover:bg-[#f1f5f9]', description: 'FantaMinkiards' },
    { id: 'classifica', title: 'CLASSIFICA', icon: Trophy, color: 'bg-white text-[#0f172a] hover:bg-[#f1f5f9]', description: 'Top giocatori' },
    { id: 'profilo', title: 'PROFILO', icon: User, color: 'bg-white text-[#0f172a] hover:bg-[#f1f5f9]', description: 'Le tue statistiche' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans overflow-x-hidden pb-20 selection:bg-[#7c3aed] selection:text-white flex justify-center">
      <style>{`
        .light-shadow {
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }
        .light-shadow-lg {
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        @keyframes ticker-scroll {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-ticker {
          display: inline-block;
          white-space: nowrap;
          animation: ticker-scroll 25s linear infinite;
        }
        .bg-pattern {
          background-image: radial-gradient(#e2e8f0 1px, transparent 1px);
          background-size: 16px 16px;
        }
      `}</style>

      <div className="w-full max-w-[390px] relative bg-[#f8fafc] min-h-screen flex flex-col bg-pattern">
        
        {/* Header */}
        <header className="bg-white border-b border-[#e2e8f0] px-5 py-4 flex items-center justify-between sticky top-0 z-20 light-shadow">
          <div>
            <h1 className="text-xl font-black text-[#7c3aed] tracking-tight">MINKIARDS</h1>
            <p className="text-sm font-medium text-[#64748b]">Ciao, <span className="text-[#0f172a] font-bold">{playerData.playerName}</span> 👋</p>
          </div>
          <button className="w-10 h-10 rounded-full bg-[#f1f5f9] flex items-center justify-center text-[#475569] hover:bg-[#e2e8f0] transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#ef4444] rounded-full border-2 border-white"></span>
          </button>
        </header>

        {/* News Ticker */}
        <div className="bg-[#f1f5f9] border-b border-[#e2e8f0] py-2 overflow-hidden flex items-center px-4">
          <div className="w-full overflow-hidden relative h-5">
            <div className="animate-ticker text-xs font-semibold text-[#475569] flex items-center gap-6">
              <span className="flex items-center gap-1"><Star size={12} className="text-[#eab308]" /> Nuova stagione "Risveglio" iniziata!</span>
              <span className="flex items-center gap-1"><Trophy size={12} className="text-[#7c3aed]" /> Torneo del fine settimana: Iscrizioni aperte</span>
              <span className="flex items-center gap-1"><Activity size={12} className="text-[#16a34a]" /> Server online - Ping: 24ms</span>
            </div>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-6 flex-1">
          
          {/* Rank Section */}
          <section className="bg-white rounded-2xl p-5 border border-[#e2e8f0] light-shadow-lg relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#f3e8ff] rounded-full opacity-50 pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="bg-[#7c3aed] text-white text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Stagione 4
                  </div>
                </div>
                <h2 className="text-2xl font-black text-[#0f172a]">{playerData.rango}</h2>
                <div className="flex items-center gap-1.5 text-[#64748b] font-medium mt-1">
                  <Trophy size={16} className="text-[#eab308]" />
                  <span>{playerData.puntiRankiard} Punti Rankiard</span>
                </div>
              </div>
              
              <div className="w-14 h-14 bg-white border-2 border-[#7c3aed] rounded-xl flex items-center justify-center light-shadow transform rotate-3">
                <Shield size={28} className="text-[#7c3aed]" />
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-5">
              <div className="flex justify-between text-xs font-bold text-[#64748b] mb-1.5 px-1">
                <span>Progresso Livello</span>
                <span className="text-[#7c3aed]">1276 / 1500</span>
              </div>
              <div className="h-3 w-full bg-[#e2e8f0] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#7c3aed] rounded-full transition-all duration-1000 ease-out relative"
                  style={{ width: '85%' }}
                >
                  <div className="absolute inset-0 bg-white/20 w-full animate-[pulse_2s_infinite]"></div>
                </div>
              </div>
            </div>
          </section>

          {/* Stats Grid */}
          <section className="grid grid-cols-3 gap-3">
            {[
              { label: 'PARTITE', value: playerData.partite, icon: Activity, color: 'text-[#3b82f6]', bg: 'bg-[#eff6ff]' },
              { label: 'VITTORIE', value: playerData.vittorie, icon: TrendingUp, color: 'text-[#16a34a]', bg: 'bg-[#f0fdf4]' },
              { label: 'WIN RATE', value: playerData.winRate, icon: Star, color: 'text-[#eab308]', bg: 'bg-[#fefce8]' }
            ].map((stat, i) => (
              <div key={i} className="bg-white border border-[#e2e8f0] rounded-xl p-3 flex flex-col items-center justify-center text-center light-shadow">
                <div className={\`w-8 h-8 rounded-full \${stat.bg} \${stat.color} flex items-center justify-center mb-2\`}>
                  <stat.icon size={16} strokeWidth={2.5} />
                </div>
                <div className="text-xl font-black text-[#0f172a] leading-none mb-1">{stat.value}</div>
                <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </section>

          {/* Primary Action */}
          <button className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white rounded-2xl p-4 flex items-center justify-between transition-all active:scale-[0.98] light-shadow-lg group border-b-4 border-[#14532d]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                <Gamepad2 size={24} className="text-white" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-black tracking-tight">GIOCA ORA</h3>
                <p className="text-green-100 text-sm font-medium">Trova una partita classificata</p>
              </div>
            </div>
            <ChevronRight size={24} className="opacity-70 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Main Navigation Grid */}
          <section className="grid grid-cols-2 gap-3 pb-8">
            {sections.slice(1).map((section) => (
              <button 
                key={section.id}
                className={\`\${section.color} border border-[#e2e8f0] rounded-xl p-4 flex flex-col items-start gap-3 transition-all active:scale-[0.98] light-shadow group relative overflow-hidden\`}
              >
                <div className="w-10 h-10 rounded-lg bg-[#f8fafc] flex items-center justify-center border border-[#e2e8f0] group-hover:scale-110 transition-transform">
                  <section.icon size={20} className="text-[#0f172a]" />
                </div>
                <div className="text-left relative z-10">
                  <h4 className="font-bold text-sm tracking-tight">{section.title}</h4>
                  <p className="text-[10px] text-[#64748b] font-medium mt-0.5 leading-tight">{section.description}</p>
                </div>
              </button>
            ))}
          </section>

        </div>
      </div>
    </div>
  );
}
