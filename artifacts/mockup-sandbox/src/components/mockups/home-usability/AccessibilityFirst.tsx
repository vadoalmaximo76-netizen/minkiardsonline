import React, { useState } from "react";

export function AccessibilityFirst() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const stats = {
    playerName: "Fake",
    puntiRankiard: 1276,
    partite: 63,
    vittorie: 45,
    winRate: "71%",
    rango: "Sfidante",
  };

  const sezioni = [
    { id: "allenamento", title: "ALLENAMENTO", icon: "📚" },
    { id: "palestre", title: "PALESTRE", icon: "🛡️" },
    { id: "stanze", title: "STANZE", icon: "👥" },
    { id: "profilo", title: "PROFILO", icon: "👤" },
    { id: "draft", title: "DRAFT", icon: "🔀" },
    { id: "classifica", title: "CLASSIFICA", icon: "🏆" },
    { id: "fanta", title: "FANTA", icon: "👑" },
  ];

  const handleAction = (title: string) => {
    setActiveSection(title);
    setTimeout(() => setActiveSection(null), 1500);
  };

  return (
    <div 
      className="min-h-screen bg-[#000000] text-[#FFFFFF] font-sans pb-10" 
      style={{ width: "100%", maxWidth: "390px", margin: "0 auto", border: "2px solid #333333" }}
    >
      <style>{`
        /* Reset and enforce solid colors, no animations */
        * {
          transition: none !important;
          animation: none !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
        }
      `}</style>

      {/* Header Profile Section */}
      <header className="p-[20px] border-b-2 border-[rgba(255,255,255,0.2)]">
        <h1 className="text-[24px] font-bold mb-[20px] uppercase">Minkiards</h1>
        
        <div className="border-2 border-[rgba(255,255,255,0.3)] p-[20px]">
          <div className="flex justify-between items-center mb-[20px]">
            <span className="text-[20px] font-bold">{stats.playerName}</span>
            <span className="text-[16px] text-[#4ade80] font-bold">{stats.rango}</span>
          </div>

          <div className="mb-[20px]">
            <div className="flex justify-between text-[14px] mb-[10px]">
              <span>Punti Rankiard</span>
              <span className="font-bold">{stats.puntiRankiard}</span>
            </div>
            {/* Barra rank: rettangolo solido senza gradienti, fill verde lime su nero */}
            <div className="w-full h-[24px] bg-[#000000] border-2 border-[rgba(255,255,255,0.3)] relative">
              <div className="h-full bg-[#4ade80] absolute top-0 left-0" style={{ width: "65%" }}></div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-[10px] text-center">
            <div className="border-2 border-[rgba(255,255,255,0.3)] p-[10px]">
              <div className="text-[14px]">Partite</div>
              <div className="text-[16px] font-bold">{stats.partite}</div>
            </div>
            <div className="border-2 border-[rgba(255,255,255,0.3)] p-[10px]">
              <div className="text-[14px]">Vittorie</div>
              <div className="text-[16px] font-bold text-[#4ade80]">{stats.vittorie}</div>
            </div>
            <div className="border-2 border-[rgba(255,255,255,0.3)] p-[10px]">
              <div className="text-[14px]">Win Rate</div>
              <div className="text-[16px] font-bold">{stats.winRate}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Navigation Sections */}
      <main className="p-[20px] flex flex-col gap-[40px]">
        {/* GIOCA */}
        <section>
          <h2 className="text-[20px] font-bold mb-[20px]">GIOCA</h2>
          <hr className="border-[rgba(255,255,255,0.2)] border-t-[1px] mb-[20px]" />
          <button 
            onClick={() => handleAction("GIOCA ORA")}
            className="w-full bg-[#166534] border-2 border-[rgba(255,255,255,0.3)] text-[#FFFFFF] p-[20px] flex items-center justify-center gap-[20px] hover:bg-[#14532d] focus:outline-none focus:ring-4 focus:ring-[#4ade80]"
            aria-label="GIOCA ORA"
          >
            <span className="text-[24px]" aria-hidden="true">🎮</span>
            <span className="text-[20px] font-bold uppercase">GIOCA ORA</span>
          </button>
        </section>

        {/* MODALITÀ (Groups first 3 sections) */}
        <section>
          <h2 className="text-[20px] font-bold mb-[20px]">MODALITÀ</h2>
          <hr className="border-[rgba(255,255,255,0.2)] border-t-[1px] mb-[20px]" />
          <div className="flex flex-col gap-[20px]">
            {sezioni.slice(0, 3).map((section) => (
              <button 
                key={section.id}
                onClick={() => handleAction(section.title)}
                className="w-full bg-[#000000] border-2 border-[#FFFFFF] text-[#FFFFFF] p-[20px] flex items-center gap-[20px] hover:bg-[#333333] focus:outline-none focus:ring-4 focus:ring-[#4ade80]"
                aria-label={section.title}
              >
                <span className="text-[24px]" aria-hidden="true">{section.icon}</span>
                <span className="text-[16px] font-bold uppercase">{section.title}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ALTRO (Groups remaining 4 sections) */}
        <section>
          <h2 className="text-[20px] font-bold mb-[20px]">GESTIONE & COMPETIZIONE</h2>
          <hr className="border-[rgba(255,255,255,0.2)] border-t-[1px] mb-[20px]" />
          <div className="flex flex-col gap-[20px]">
            {sezioni.slice(3).map((section) => (
              <button 
                key={section.id}
                onClick={() => handleAction(section.title)}
                className="w-full bg-[#000000] border-2 border-[#FFFFFF] text-[#FFFFFF] p-[20px] flex items-center gap-[20px] hover:bg-[#333333] focus:outline-none focus:ring-4 focus:ring-[#4ade80]"
                aria-label={section.title}
              >
                <span className="text-[24px]" aria-hidden="true">{section.icon}</span>
                <span className="text-[16px] font-bold uppercase">{section.title}</span>
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* Active State Feedback / Dialog */}
      {activeSection && (
        <div className="fixed inset-0 bg-[#000000] z-50 flex flex-col items-center justify-center p-[20px]">
          <div className="bg-[#000000] border-4 border-[#4ade80] p-[40px] w-full max-w-[350px] flex flex-col items-center gap-[20px]">
            <h2 className="text-[20px] font-bold text-[#4ade80] uppercase text-center">
              Azione confermata
            </h2>
            <p className="text-[16px] text-[#FFFFFF] font-bold uppercase text-center">
              Apertura: {activeSection}
            </p>
            <button 
              onClick={() => setActiveSection(null)}
              className="mt-[20px] bg-[#000000] border-2 border-[#FFFFFF] text-[#FFFFFF] p-[15px] px-[30px] font-bold text-[16px] hover:bg-[#333333]"
            >
              CHIUDI
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
