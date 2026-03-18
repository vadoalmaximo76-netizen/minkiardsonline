import React, { useEffect, useRef } from "react";
import { Play, Shield, Users, User, Trophy, Crown, BookOpen, Shuffle } from "lucide-react";

export function StoryPath() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to current node on load
  useEffect(() => {
    if (containerRef.current) {
      const currentNode = containerRef.current.querySelector(".current-node");
      if (currentNode) {
        currentNode.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, []);

  const tiers = [
    { id: "leggenda", name: "Leggenda", points: 2500, status: "future" },
    { id: "maestro", name: "Maestro", points: 2000, status: "future" },
    { id: "campione", name: "Campione", points: 1500, status: "future" },
    { id: "sfidante", name: "Sfidante", points: 1250, currentPoints: 1276, status: "current" },
    { id: "competitore", name: "Competitore", points: 1000, status: "completed" },
    { id: "dilettante", name: "Dilettante", points: 500, status: "completed" },
    { id: "esordiente", name: "Esordiente", points: 0, status: "completed" },
  ];

  return (
    <div className="relative w-full min-h-screen flex flex-col font-sans overflow-hidden" style={{ backgroundColor: "#080818", color: "#e2e8f0" }}>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px 5px rgba(124, 58, 237, 0.4), inset 0 0 10px rgba(124, 58, 237, 0.4); }
          50% { box-shadow: 0 0 35px 15px rgba(124, 58, 237, 0.7), inset 0 0 20px rgba(124, 58, 237, 0.6); }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes dash {
          to { stroke-dashoffset: 0; }
        }
        .path-line {
          background: linear-gradient(to bottom, #1e40af 0%, #7c3aed 50%, #1e1b4b 100%);
        }
      `}</style>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#080818]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between max-w-[390px] mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center font-bold text-white text-lg shadow-[0_0_10px_rgba(124,58,237,0.5)]">
            M
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight text-white">Fake</h1>
            <p className="text-xs text-purple-400 font-medium">Sfidante</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button className="text-gray-400 hover:text-white transition-colors">
            <Trophy className="w-5 h-5" />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors">
            <User className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content - Progression Map */}
      <main 
        ref={containerRef}
        className="flex-1 overflow-y-auto w-full max-w-[390px] mx-auto pt-24 pb-32 relative scroll-smooth"
      >
        {/* The Path Line */}
        <div className="absolute left-1/2 top-24 bottom-32 w-1 -translate-x-1/2 path-line rounded-full shadow-[0_0_15px_rgba(124,58,237,0.3)] z-0" />

        <div className="flex flex-col gap-16 relative z-10 px-4 py-8">
          {tiers.map((tier, index) => {
            const isCurrent = tier.status === "current";
            const isCompleted = tier.status === "completed";
            const isFuture = tier.status === "future";

            // Alternate sides for a more dynamic map look, but keeping the requested icon/label positions relative to the center
            const isLeft = index % 2 === 0;

            return (
              <div 
                key={tier.id} 
                className={`flex items-center justify-center w-full relative ${isCurrent ? 'current-node my-8' : ''}`}
              >
                {/* Status Icon (Left) */}
                <div className={`absolute left-4 flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-[#0f0f2a] shadow-lg ${isCurrent ? 'hidden' : ''}`}>
                  {isCompleted && <span className="text-green-400 text-lg">✓</span>}
                  {isFuture && <span className="text-gray-500 text-lg">🔒</span>}
                </div>

                {/* Central Node */}
                <div className={`relative flex items-center justify-center rounded-full z-10 
                  ${isCurrent ? 'w-20 h-20 border-2 border-purple-500 bg-[#1a1a3a] animate-pulse-glow' : 
                    isCompleted ? 'w-12 h-12 border-2 border-purple-600/50 bg-[#1e1b4b]' : 
                    'w-11 h-11 border-2 border-white/20 bg-[#0f0f2a] opacity-80'}`}
                >
                  {isCurrent ? (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white text-3xl font-bold shadow-inner border border-white/20">
                      F
                    </div>
                  ) : (
                    <div className={`w-3 h-3 rounded-full ${isCompleted ? 'bg-purple-500 shadow-[0_0_10px_rgba(124,58,237,0.8)]' : 'bg-white/20'}`} />
                  )}
                </div>

                {/* Label (Right) */}
                <div className={`absolute right-4 w-[110px] ${isCurrent ? 'hidden' : ''}`}>
                  <div className={`p-2 rounded-lg border border-white/5 shadow-md backdrop-blur-sm
                    ${isCompleted ? 'bg-[#1e1b4b]/80 border-purple-500/30' : 'bg-[#0f0f2a]/80'}`}>
                    <h3 className={`font-bold text-sm ${isCompleted ? 'text-white' : 'text-gray-500'}`}>{tier.name}</h3>
                    <p className={`text-xs ${isCompleted ? 'text-purple-300' : 'text-gray-600'}`}>{tier.points} pt</p>
                  </div>
                </div>

                {/* Current Node Special Label */}
                {isCurrent && (
                  <div className="absolute top-full mt-4 bg-gradient-to-r from-purple-900/80 to-indigo-900/80 border border-purple-500/50 rounded-full px-5 py-2 backdrop-blur-md shadow-[0_5px_15px_rgba(0,0,0,0.5)] flex items-center gap-2">
                    <span className="text-yellow-400 text-sm">★</span>
                    <span className="text-white font-bold text-sm">TU | {tier.currentPoints} pt</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Sticky Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-[#080818] via-[#080818]/90 to-transparent max-w-[390px] mx-auto w-full">
        <button className="w-full h-14 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center gap-3 transform transition active:scale-95 border border-emerald-400/50">
          <span className="text-xl">⚔️</span>
          GIOCA — Avanza nel percorso
        </button>
      </div>

    </div>
  );
}