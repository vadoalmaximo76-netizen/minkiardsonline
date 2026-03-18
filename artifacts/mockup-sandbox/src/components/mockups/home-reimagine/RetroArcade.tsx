import React, { useState, useEffect } from 'react';

export function RetroArcade() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  const menuItems = [
    { label: 'GIOCA', subtitle: '[ATTIVO]' },
    { label: 'ALLENAMENTO', subtitle: '[CPU MODE]' },
    { label: 'PALESTRE', subtitle: '[GYM BATTLE]' },
    { label: 'STANZE', subtitle: '[ONLINE]' },
    { label: 'PROFILO', subtitle: '[FAKE]' },
    { label: 'DRAFT', subtitle: '[CARD PICK]' },
    { label: 'CLASSIFICA', subtitle: '[TOP 100]' },
    { label: 'FANTA', subtitle: '[ASTA]' },
  ];

  // Blinking cursor effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);
    return () => clearInterval(cursorInterval);
  }, []);

  // Keyboard navigation for interactivity
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : menuItems.length - 1));
      } else if (e.key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev < menuItems.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuItems.length]);

  return (
    <div className="relative min-h-screen w-full bg-black flex justify-center overflow-hidden font-mono uppercase selection:bg-[#00ff41] selection:text-black text-[#00ff41]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
        
        .retro-font {
          font-family: 'VT323', monospace, 'Courier New';
          letter-spacing: 0.05em;
        }

        @keyframes crtFlicker {
          0% { opacity: 0.98; }
          5% { opacity: 0.95; }
          10% { opacity: 0.99; }
          15% { opacity: 1; }
          50% { opacity: 0.96; }
          80% { opacity: 0.99; }
          100% { opacity: 0.97; }
        }
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes blinkBorder {
          0%, 49% { border-color: #00ff41; box-shadow: 0 0 10px #00ff41; }
          50%, 100% { border-color: transparent; box-shadow: none; }
        }
        @keyframes scanlineMove {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .crt-container {
          animation: crtFlicker 0.15s infinite;
          text-shadow: 0 0 5px rgba(0, 255, 65, 0.5), 0 0 10px rgba(0, 255, 65, 0.3);
        }
        .scanlines {
          background: linear-gradient(
            to bottom,
            rgba(255,255,255,0),
            rgba(255,255,255,0) 50%,
            rgba(0,0,0,0.2) 50%,
            rgba(0,0,0,0.2)
          );
          background-size: 100% 4px;
        }
        .scanline-bar {
          background: linear-gradient(to bottom, rgba(0,255,65,0), rgba(0,255,65,0.1) 50%, rgba(0,255,65,0));
          height: 10vh;
          animation: scanlineMove 8s linear infinite;
        }
        .vignette {
          background: radial-gradient(circle, transparent 50%, rgba(0,0,0,0.8) 100%);
        }
        .gioca-highlight {
          color: white;
          background-color: #00ff41;
          border: 2px solid #00ff41;
          animation: blinkBorder 1s infinite;
          text-shadow: none;
        }
        .gioca-highlight .subtitle {
          color: black;
        }
      `}</style>

      {/* CRT Overlay Effects */}
      <div className="absolute inset-0 pointer-events-none z-50 scanlines opacity-50"></div>
      <div className="absolute inset-0 pointer-events-none z-50 scanline-bar w-full"></div>
      <div className="absolute inset-0 pointer-events-none z-50 vignette"></div>

      {/* Main Content Container - Mobile Constrained */}
      <div className="w-full max-w-[414px] h-full min-h-screen flex flex-col p-4 crt-container relative z-10 retro-font">
        
        {/* Header ASCII Art */}
        <div className="mt-8 mb-6 text-center text-xl sm:text-2xl leading-tight">
          <div className="whitespace-pre">╔════════════════════╗</div>
          <div className="whitespace-pre font-bold">║   MINKIARDS v2.0   ║</div>
          <div className="whitespace-pre">╚════════════════════╝</div>
        </div>

        {/* Stats Section */}
        <div className="mb-10 text-lg border-b border-[#00ff41] pb-4 border-dashed border-opacity-50">
          <div className="flex justify-between mb-2">
            <span>PLAYER: FAKE</span>
            <span>RANKIARD: <span className="text-[#00cc33]">1276</span></span>
          </div>
          <div className="flex justify-between">
            <span>VITTORIE: 45/63</span>
            <span>WIN%: <span className="text-[#00cc33]">71%</span></span>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-grow flex flex-col justify-start">
          <div className="space-y-4 px-2 text-xl">
            {menuItems.map((item, index) => {
              const isSelected = selectedIndex === index;
              const isGioca = item.label === 'GIOCA';
              
              return (
                <div 
                  key={item.label}
                  className={\`flex items-center cursor-pointer transition-all duration-100 p-2 \${
                    isSelected && isGioca ? 'gioca-highlight' : 
                    isSelected ? 'bg-[#00ff41] text-black' : 'hover:bg-[#003311]'
                  }\`}
                  onClick={() => setSelectedIndex(index)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="w-8 flex justify-center">
                    {isSelected && <span className={showCursor ? 'opacity-100' : 'opacity-0'}>►</span>}
                  </div>
                  <div className="flex-grow flex justify-between">
                    <span className="font-bold tracking-widest">
                      {item.label}
                    </span>
                    <span className={\`subtitle \${
                      isSelected && isGioca ? 'text-black' : 
                      isSelected ? 'text-black opacity-80' : 'text-[#009922]'
                    }\`}>
                      {item.subtitle}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pb-8 text-center">
          <div className="animate-[blink_1s_infinite] text-[#009922] text-xl tracking-wider">
            PREMI [ENTER] PER SELEZIONARE
          </div>
        </div>
      </div>
    </div>
  );
}
