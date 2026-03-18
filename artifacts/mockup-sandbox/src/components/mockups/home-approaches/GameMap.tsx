import React, { useState } from 'react';

const MAP_NODES = [
  {
    id: 'arena',
    title: '⚔️ ARENA',
    subtitle: 'GIOCA',
    description: 'Entra nell\'Arena e sfida altri giocatori in partite classificate per scalare la vetta.',
    color: 'from-orange-500 to-red-600',
    shadow: 'shadow-[0_0_30px_rgba(239,68,68,0.6)]',
    size: 90,
    x: 150,
    y: 230,
    isMain: true,
  },
  {
    id: 'dojo',
    title: '📚 DOJO',
    subtitle: 'ALLENAMENTO',
    description: 'Affina le tue abilità contro l\'IA o prova nuovi deck in sicurezza.',
    color: 'from-green-400 to-emerald-600',
    shadow: 'shadow-[0_0_20px_rgba(16,185,129,0.5)]',
    size: 70,
    x: 50,
    y: 80,
    isMain: false,
  },
  {
    id: 'gym',
    title: '🛡️ GYM',
    subtitle: 'PALESTRE',
    description: 'Affronta i capipalestra e ottieni medaglie esclusive.',
    color: 'from-blue-400 to-indigo-600',
    shadow: 'shadow-[0_0_20px_rgba(59,130,246,0.5)]',
    size: 70,
    x: 270,
    y: 110,
    isMain: false,
  },
  {
    id: 'taverna',
    title: '👥 TAVERNA',
    subtitle: 'STANZE',
    description: 'Unisciti ai tuoi amici in stanze private per partite personalizzate.',
    color: 'from-purple-400 to-fuchsia-600',
    shadow: 'shadow-[0_0_20px_rgba(168,85,247,0.5)]',
    size: 60,
    x: 60,
    y: 380,
    isMain: false,
  },
  {
    id: 'castello',
    title: '👑 CASTELLO',
    subtitle: 'FANTA',
    description: 'Gestisci la tua squadra Fanta e domina il campionato.',
    color: 'from-yellow-400 to-amber-600',
    shadow: 'shadow-[0_0_20px_rgba(245,158,11,0.5)]',
    size: 60,
    x: 260,
    y: 400,
    isMain: false,
  },
  {
    id: 'draft',
    title: '🔀 DRAFT',
    subtitle: 'DRAFT',
    description: 'Costruisci un mazzo scegliendo tra carte casuali e vinci grandi premi.',
    color: 'from-cyan-400 to-teal-600',
    shadow: 'shadow-[0_0_20px_rgba(20,184,166,0.5)]',
    size: 65,
    x: 160,
    y: 50,
    isMain: false,
  },
];

const ROADS = [
  { x1: 50, y1: 80, x2: 150, y2: 230 }, // Dojo to Arena
  { x1: 270, y1: 110, x2: 150, y2: 230 }, // Gym to Arena
  { x1: 60, y1: 380, x2: 150, y2: 230 }, // Taverna to Arena
  { x1: 260, y1: 400, x2: 150, y2: 230 }, // Castello to Arena
  { x1: 50, y1: 80, x2: 270, y2: 110 }, // Dojo to Gym
  { x1: 160, y1: 50, x2: 150, y2: 230 }, // Draft to Arena
];

export function GameMap() {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('arena');

  const selectedNode = MAP_NODES.find(n => n.id === selectedNodeId) || MAP_NODES[0];

  return (
    <div className="flex justify-center items-center min-h-screen bg-black text-white font-sans overflow-hidden">
      <style>{`
        .bg-grid-pattern {
          background-image: 
            linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 20px 20px;
        }
        
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px 5px rgba(239, 68, 68, 0.5);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 40px 15px rgba(239, 68, 68, 0.8);
            transform: scale(1.05);
          }
        }
        
        .animate-pulse-glow {
          animation: pulse-glow 2s infinite ease-in-out;
        }

        @keyframes bounce-x {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(5px);
          }
        }
        
        .animate-bounce-x {
          animation: bounce-x 1s infinite;
        }

        .fog-of-war {
          background: radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.8) 80%, rgba(0,0,0,1) 100%);
        }
      `}</style>

      {/* Main App Container */}
      <div className="relative w-[390px] h-[844px] bg-slate-900 overflow-hidden flex flex-col shadow-2xl border border-slate-800">
        
        {/* HUD Top Bar */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-500 overflow-hidden">
              <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold">
                F
              </div>
            </div>
            <div>
              <div className="font-bold text-base">Fake</div>
              <div className="text-xs text-slate-300 flex items-center gap-1">
                <span className="text-yellow-400">⭐</span> 1276 Rankiard
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-sm">
              👤
            </button>
            <button className="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-sm">
              🏆
            </button>
          </div>
        </div>

        {/* Stats Summary Overlay (Optional HUD element) */}
        <div className="absolute top-20 left-4 z-20 flex gap-4 text-xs font-mono text-slate-400">
          <div>P: <span className="text-white">63</span></div>
          <div>V: <span className="text-emerald-400">45</span></div>
          <div>WR: <span className="text-blue-400">71%</span></div>
        </div>

        {/* Map Container */}
        <div className="relative flex-1 bg-slate-950 bg-grid-pattern">
          {/* Map Area */}
          <div className="absolute inset-0 top-[100px] h-[550px]">
            
            {/* Roads */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              {ROADS.map((road, i) => (
                <line 
                  key={i}
                  x1={road.x1} 
                  y1={road.y1} 
                  x2={road.x2} 
                  y2={road.y2} 
                  stroke="rgba(255,255,255,0.15)" 
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              ))}
            </svg>

            {/* Nodes */}
            {MAP_NODES.map((node) => (
              <div
                key={node.id}
                className="absolute z-10 flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 hover:scale-110 cursor-pointer"
                style={{ left: node.x, top: node.y }}
                onClick={() => setSelectedNodeId(node.id)}
              >
                <div 
                  className={\`rounded-full bg-gradient-to-br \${node.color} \${node.shadow} flex items-center justify-center text-white border-2 border-white/20 transition-all duration-300 \${selectedNodeId === node.id ? 'ring-4 ring-white/50' : ''} \${node.isMain ? 'animate-pulse-glow' : ''}\`}
                  style={{ width: node.size, height: node.size }}
                >
                  {node.isMain && (
                    <div className="font-black tracking-wider text-xl drop-shadow-md">
                      ⚔️
                    </div>
                  )}
                </div>
                
                <div className="mt-2 text-center bg-black/60 px-2 py-1 rounded backdrop-blur-sm border border-white/10">
                  <div className="font-bold text-sm tracking-wide text-slate-200">{node.title}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{node.subtitle}</div>
                </div>

                {node.isMain && selectedNodeId === node.id && (
                  <div className="absolute top-[-30px] flex items-center gap-2 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                    TOCCA PER GIOCARE
                    <span className="animate-bounce-x">▶</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Fog of War overlay */}
          <div className="absolute inset-0 fog-of-war pointer-events-none z-10"></div>
        </div>

        {/* Bottom Context Panel */}
        <div className="absolute bottom-0 left-0 right-0 h-[120px] bg-slate-900 border-t border-slate-700/50 p-4 z-20 flex flex-col justify-center transform transition-all duration-300 backdrop-blur-md bg-opacity-95">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              {selectedNode.title}
            </h3>
            <span className="text-xs font-bold px-2 py-1 rounded bg-slate-800 text-slate-300">
              {selectedNode.subtitle}
            </span>
          </div>
          <p className="text-sm text-slate-400 leading-snug">
            {selectedNode.description}
          </p>
          
          {selectedNode.isMain && (
            <button className="absolute right-4 bottom-4 w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-xl shadow-[0_0_15px_rgba(239,68,68,0.5)] active:scale-95 transition-transform">
              ▶
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
