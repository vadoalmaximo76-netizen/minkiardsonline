import React, { useState } from "react";

export function Editorial() {
  const [activeTab, setActiveTab] = useState<string>("GIOCA");

  const menuItems = [
    { id: "ALLENAMENTO", title: "ALLENAMENTO", roman: "II", icon: "📚" },
    { id: "PALESTRE", title: "PALESTRE", roman: "III", icon: "🛡️" },
    { id: "STANZE", title: "STANZE", roman: "IV", icon: "👥" },
    { id: "PROFILO", title: "PROFILO", roman: "V", icon: "👤" },
    { id: "DRAFT", title: "DRAFT", roman: "VI", icon: "🔀" },
    { id: "CLASSIFICA", title: "CLASSIFICA", roman: "VII", icon: "🏆" },
    { id: "FANTA", title: "FANTA", roman: "VIII", icon: "👑" },
  ];

  return (
    <div className="min-h-screen w-full relative overflow-x-hidden font-sans bg-[#1a1a1a] flex justify-center">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,900;1,400;1,900&family=Inter:wght@300;400;500;700;900&display=swap');
          
          .font-editorial {
            font-family: 'Playfair Display', serif;
          }
          .font-body {
            font-family: 'Inter', sans-serif;
          }
          
          @keyframes ticker {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
          .animate-ticker {
            display: inline-block;
            white-space: nowrap;
            animation: ticker 15s linear infinite;
          }
        `}
      </style>

      <div className="w-full max-w-[390px] mx-auto bg-[#faf9f6] min-h-screen relative flex flex-col font-body text-[#1a1a1a]">
        
        {/* Ticker - Breaking News style */}
        <div className="w-full overflow-hidden whitespace-nowrap py-1 bg-[#dc2626] text-white flex-shrink-0">
          <div className="animate-ticker text-[10px] font-bold tracking-[0.2em] uppercase">
            +++ ULTIME NOTIZIE: NUOVA STAGIONE AL VIA +++ TORNEO NAZIONALE IN FASE DI DRAFT +++ REGOLE AGGIORNATE PER LE PALESTRE +++
          </div>
        </div>

        {/* Header Magazine Style */}
        <header className="px-5 pt-6 pb-2 bg-[#faf9f6]">
          <div className="flex justify-between items-baseline mb-2">
            <h1 
              className="font-editorial text-[28px] font-black italic m-0 leading-none tracking-tight uppercase"
              style={{ borderBottom: "3px solid #dc2626", paddingBottom: "2px" }}
            >
              MINKIARDS
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#dc2626]">
              N° 47 · Mar 2026
            </span>
          </div>
          <div className="mt-2">
            <span className="text-[14px] italic font-light text-[#6b7280]">
              Ciao, Fake
            </span>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 px-5 py-6 flex flex-col gap-8">
          
          {/* Rank Section */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-[3px] h-3 bg-[#dc2626]"></div>
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] m-0 leading-none">
                PROFILO GIOCATORE
              </h2>
            </div>
            
            <div className="mt-1">
              <h3 className="font-editorial text-[22px] font-black italic leading-tight uppercase">
                SFIDANTE — 1276 Rankiard
              </h3>
              
              <div className="w-full h-[4px] bg-[#e5e7eb] mt-3 relative">
                <div className="absolute left-0 top-0 h-full w-[65%] bg-[#1a1a1a]"></div>
              </div>
            </div>
          </section>

          {/* Stats Table */}
          <section className="flex flex-col gap-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] m-0 leading-none">
              RISULTATI
            </h2>
            <div className="border-t-[1px] border-b-[1px] border-[#1a1a1a] py-3 flex justify-between items-center text-center">
              <div className="flex-1 flex flex-col px-2">
                <span className="text-[18px] font-black font-editorial italic">63</span>
                <span className="text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mt-1">PARTITE</span>
              </div>
              <div className="w-[1px] h-8 bg-[#1a1a1a]"></div>
              <div className="flex-1 flex flex-col px-2">
                <span className="text-[18px] font-black font-editorial italic text-[#dc2626]">45</span>
                <span className="text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mt-1">VITTORIE</span>
              </div>
              <div className="w-[1px] h-8 bg-[#1a1a1a]"></div>
              <div className="flex-1 flex flex-col px-2">
                <span className="text-[18px] font-black font-editorial italic">71%</span>
                <span className="text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mt-1">WR</span>
              </div>
            </div>
          </section>

          {/* Featured Action: GIOCA */}
          <section className="flex flex-col gap-0">
            <div className="flex items-center gap-4 border-b border-[#1a1a1a] pb-2 mb-2">
              <span className="text-[12px] font-bold font-editorial italic text-[#dc2626] w-[20px]">
                I
              </span>
              <span className="text-[16px] font-black tracking-widest uppercase text-[#dc2626]">
                GIOCA 🎮
              </span>
            </div>
            
            <button 
              className="w-full bg-[#1a1a1a] text-white p-6 cursor-pointer text-center transform transition-transform active:scale-[0.98] mt-2 group"
              onClick={() => setActiveTab("GIOCA")}
            >
              <p className="text-[18px] font-black m-0 tracking-widest uppercase transition-transform group-hover:scale-105">
                SCEGLI LA PARTITA →
              </p>
            </button>
          </section>

          {/* Index / Menu */}
          <section className="flex flex-col gap-0 border-t-2 border-[#1a1a1a] pt-4">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] mb-4 leading-none">
              INDICE
            </h2>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="w-full flex items-center justify-between py-4 border-b border-[#e5e7eb] group text-left transition-colors hover:bg-black/5"
              >
                <div className="flex items-center gap-4">
                  <span className="text-[12px] font-bold font-editorial italic text-[#6b7280] w-[20px]">
                    {item.roman}
                  </span>
                  <span className={`text-[15px] font-black tracking-widest uppercase ${
                    activeTab === item.id ? 'text-[#1a1a1a]' : 'text-[#1a1a1a]'
                  }`}>
                    {item.title} {item.icon}
                  </span>
                </div>
              </button>
            ))}
          </section>

        </main>
        
        {/* Footer */}
        <footer className="py-6 text-center mt-auto border-t border-[#e5e7eb]">
          <p className="text-[9px] uppercase tracking-widest text-[#6b7280] font-bold">
            © 2026 Minkiards Magazine
          </p>
        </footer>
      </div>
    </div>
  );
}
