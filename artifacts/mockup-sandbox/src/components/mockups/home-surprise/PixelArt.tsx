import React, { useState } from 'react';

export function PixelArt() {
  const [activeTab, setActiveTab] = useState('GIOCA');

  const palette = {
    bgScuro: '#1a1c2c',
    bgCard: '#29366f',
    blu: '#3b5dc9',
    verdeLime: '#a8ff60',
    giallo: '#ffcd75',
    rosso: '#ff6b6b',
    bianco: '#ffffff',
    nero: '#000000'
  };

  const getPixelBorder = (color: string) => {
    return `2px 0 0 ${color}, -2px 0 0 ${color}, 0 2px 0 ${color}, 0 -2px 0 ${color}`;
  };

  const menuItems = [
    { id: 'GIOCA', label: 'GIOCA', icon: '🎮' },
    { id: 'ALLENAMENTO', label: 'ALLENA', icon: '📚' },
    { id: 'PALESTRE', label: 'PALESTRE', icon: '🛡️' },
    { id: 'STANZE', label: 'STANZE', icon: '👥' },
    { id: 'PROFILO', label: 'PROFILO', icon: '👤' },
    { id: 'DRAFT', label: 'DRAFT', icon: '🔀' },
    { id: 'CLASSIFICA', label: 'RANK', icon: '🏆' },
    { id: 'FANTA', label: 'FANTA', icon: '👑' }
  ];

  return (
    <div 
      className="min-h-screen w-full flex justify-center font-mono uppercase tracking-tighter select-none"
      style={{
        backgroundColor: palette.bgScuro,
        backgroundImage: `radial-gradient(circle at 1px 1px, ${palette.bgCard} 1px, transparent 0)`,
        backgroundSize: '8px 8px',
        color: palette.bianco
      }}
    >
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s step-end infinite;
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .crt-overlay::before {
          content: " ";
          display: block;
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          right: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
          z-index: 2;
          background-size: 100% 2px, 3px 100%;
          pointer-events: none;
        }
      `}</style>

      {/* Mobile Container */}
      <div 
        className="w-full max-w-[390px] min-h-screen relative flex flex-col"
        style={{ 
          backgroundColor: palette.bgScuro,
          boxShadow: `0 0 20px rgba(0,0,0,0.5)`,
          borderLeft: `2px solid ${palette.bgCard}`,
          borderRight: `2px solid ${palette.bgCard}`,
        }}
      >
        {/* Header Bar */}
        <div 
          className="w-full h-12 flex items-center justify-between px-4 z-10"
          style={{ backgroundColor: palette.bgCard, borderBottom: `2px solid ${palette.blu}` }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: palette.verdeLime, fontSize: '18px', fontWeight: 'bold' }}>[ MINKIARDS ]</span>
          </div>
          <div className="flex items-center gap-1">
            <span style={{ color: palette.bianco, fontSize: '12px' }}>FAKE</span>
            <div className="w-6 h-6 bg-black flex items-center justify-center rounded-sm" style={{ border: `1px solid ${palette.blu}` }}>
              👤
            </div>
          </div>
        </div>

        {/* Main Content Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 flex flex-col gap-6">

          {/* User Rank & Progress */}
          <div className="flex gap-4 items-center">
            {/* Rank Badge */}
            <div 
              className="flex flex-col items-center justify-center p-2 relative"
              style={{
                width: '96px',
                height: '80px',
                backgroundColor: palette.bgCard,
                boxShadow: getPixelBorder(palette.bianco),
                margin: '2px' // offset for box-shadow
              }}
            >
              <span style={{ color: palette.verdeLime, fontSize: '16px', fontWeight: 'bold' }}>1276 PT</span>
              <span style={{ color: palette.giallo, fontSize: '10px', marginTop: '4px' }}>SFIDANTE</span>
            </div>

            {/* Progress Bar */}
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex justify-between text-[10px]" style={{ color: palette.giallo }}>
                <span>LV 42</span>
                <span>LV 43</span>
              </div>
              <div 
                className="w-full h-4 relative"
                style={{ 
                  backgroundColor: palette.bgScuro,
                  boxShadow: getPixelBorder(palette.blu),
                  margin: '2px'
                }}
              >
                <div 
                  className="h-full"
                  style={{ width: '75%', backgroundColor: palette.verdeLime }}
                />
              </div>
            </div>
          </div>

          {/* CRT Stats HUD */}
          <div 
            className="w-full p-4 relative crt-overlay overflow-hidden"
            style={{ 
              backgroundColor: palette.nero,
              boxShadow: getPixelBorder(palette.blu),
              margin: '2px',
              width: 'calc(100% - 4px)'
            }}
          >
            <div className="relative z-10 text-[12px] flex flex-col gap-2" style={{ color: palette.verdeLime }}>
              <div className="flex justify-between border-b border-dashed border-[#3b5dc9] pb-1">
                <span>&gt; PARTITE_GIOCATE</span>
                <span>063</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-[#3b5dc9] pb-1">
                <span>&gt; VITTORIE_TOTALI</span>
                <span>045</span>
              </div>
              <div className="flex justify-between pb-1">
                <span>&gt; WIN_RATE_CORRENTE</span>
                <span>71%</span>
              </div>
            </div>
          </div>

          {/* Action Window */}
          <div 
            className="w-full flex flex-col"
            style={{
              boxShadow: getPixelBorder(palette.bianco),
              backgroundColor: palette.bgScuro,
              margin: '2px',
              width: 'calc(100% - 4px)'
            }}
          >
            {/* Title Bar */}
            <div 
              className="h-6 w-full flex items-center px-2 text-[10px]"
              style={{ backgroundColor: palette.blu, color: palette.bianco }}
            >
              <span>SYS.MODULO_PRINCIPALE.EXE</span>
            </div>
            
            {/* Content Area */}
            <div className="p-6 flex flex-col items-center justify-center bg-[#1a1c2c] min-h-[160px]">
              <button 
                className="w-full py-4 relative group active:translate-y-[2px] transition-transform"
                style={{
                  backgroundColor: palette.nero,
                  boxShadow: getPixelBorder(palette.rosso),
                }}
              >
                <div className="absolute inset-0 bg-[#ff6b6b] opacity-10 group-hover:opacity-20 transition-opacity" />
                <span className="animate-blink block text-xl" style={{ color: palette.rosso }}>
                  [ PREMI START ]
                </span>
                <span className="block text-[10px] mt-2" style={{ color: palette.bianco }}>
                  INIZIA MATCH CLASSIFICATO
                </span>
              </button>
            </div>
          </div>

          {/* Grid Menu Panels */}
          <div className="grid grid-cols-2 gap-4 mt-2 px-[2px]">
            {['ALLENAMENTO', 'PALESTRE', 'DRAFT', 'FANTA'].map((item) => (
              <button
                key={item}
                className="h-20 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
                style={{
                  backgroundColor: palette.bgCard,
                  boxShadow: getPixelBorder(palette.blu)
                }}
              >
                <span className="text-xl">
                  {menuItems.find(m => m.id === item)?.icon}
                </span>
                <span className="text-[10px]" style={{ color: palette.giallo }}>
                  {item}
                </span>
              </button>
            ))}
          </div>

        </div>

        {/* Bottom Navigation */}
        <div 
          className="absolute bottom-0 w-full h-16 flex items-center justify-between px-2 z-20 pb-2"
          style={{ 
            backgroundColor: palette.bgScuro,
            borderTop: `2px solid ${palette.blu}`
          }}
        >
          {menuItems.filter(m => ['GIOCA', 'STANZE', 'CLASSIFICA', 'PROFILO'].includes(m.id)).map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex-1 flex flex-col items-center justify-center gap-1 h-full relative"
              >
                {isActive && (
                  <div 
                    className="absolute top-0 w-full h-[2px]" 
                    style={{ backgroundColor: palette.verdeLime }} 
                  />
                )}
                <span className={`text-xl ${isActive ? 'opacity-100' : 'opacity-50'}`}>
                  {item.icon}
                </span>
                <span 
                  className="text-[8px]" 
                  style={{ color: isActive ? palette.verdeLime : palette.bianco, opacity: isActive ? 1 : 0.5 }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
