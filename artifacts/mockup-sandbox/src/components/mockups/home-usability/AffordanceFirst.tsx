import React, { useState } from 'react';
import { ChevronRight, Gamepad2, BookOpen, Shield, Users, User, Shuffle, Trophy, Crown } from 'lucide-react';

export function AffordanceFirst() {
  const [clickedId, setClickedId] = useState<string | null>(null);

  const handleClick = (id: string) => {
    setClickedId(id);
    setTimeout(() => setClickedId(null), 300);
  };

  const getClickClass = (id: string) => {
    return clickedId === id ? 'ring-4 ring-green-500 bg-zinc-800 transition-all duration-75' : 'transition-all duration-300';
  };

  const menuItems = [
    { id: 'allenamento', icon: <BookOpen size={24} className="text-blue-400" />, title: 'ALLENAMENTO', desc: '📚' },
    { id: 'palestre', icon: <Shield size={24} className="text-red-400" />, title: 'PALESTRE', desc: '🛡️' },
    { id: 'stanze', icon: <Users size={24} className="text-purple-400" />, title: 'STANZE', desc: '👥' },
    { id: 'profilo', icon: <User size={24} className="text-gray-400" />, title: 'PROFILO', desc: '👤' },
    { id: 'draft', icon: <Shuffle size={24} className="text-yellow-400" />, title: 'DRAFT', desc: '🔀' },
    { id: 'classifica', icon: <Trophy size={24} className="text-yellow-500" />, title: 'CLASSIFICA', desc: '🏆' },
    { id: 'fanta', icon: <Crown size={24} className="text-pink-400" />, title: 'FANTA', desc: '👑' },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col items-center overflow-x-hidden pb-12">
      <style>{`
        @keyframes flash {
          0% { border-color: #22c55e; background-color: rgba(34, 197, 94, 0.2); }
          100% { border-color: transparent; background-color: transparent; }
        }
      `}</style>

      <div className="w-full max-w-[390px] px-5 pt-8 flex flex-col gap-5">
        
        {/* Header / Stats */}
        <div className="flex flex-col gap-5">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Fake</h1>
            <p className="text-[15px] text-zinc-400 mt-1">Sfidante</p>
          </div>

          <div className="flex flex-row flex-wrap justify-center gap-[20px]">
            <button 
              onClick={() => handleClick('stat1')}
              className={`flex flex-col items-center justify-center px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-[20px] min-w-[100px] flex-1 relative ${getClickClass('stat1')}`}
            >
              <span className="text-xl font-bold text-white">1276</span>
              <span className="text-[15px] text-zinc-400">Punti</span>
              <ChevronRight size={14} className="text-zinc-500 opacity-60 absolute right-2 top-1/2 -translate-y-1/2" />
            </button>
            <button 
              onClick={() => handleClick('stat2')}
              className={`flex flex-col items-center justify-center px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-[20px] min-w-[100px] flex-1 relative ${getClickClass('stat2')}`}
            >
              <span className="text-xl font-bold text-white">63</span>
              <span className="text-[15px] text-zinc-400">Partite</span>
              <ChevronRight size={14} className="text-zinc-500 opacity-60 absolute right-2 top-1/2 -translate-y-1/2" />
            </button>
            <button 
              onClick={() => handleClick('stat3')}
              className={`flex flex-col items-center justify-center px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-[20px] min-w-[100px] flex-1 relative ${getClickClass('stat3')}`}
            >
              <span className="text-xl font-bold text-white">71%</span>
              <span className="text-[15px] text-zinc-400">Vittorie</span>
              <ChevronRight size={14} className="text-zinc-500 opacity-60 absolute right-2 top-1/2 -translate-y-1/2" />
            </button>
          </div>
        </div>

        <div className="h-[20px]"></div>

        {/* GIOCA Button */}
        <div className="flex flex-col items-center w-full">
          <button
            onClick={() => handleClick('gioca')}
            className={`w-full h-[80px] bg-green-600 rounded-[24px] flex items-center justify-between px-6 ${getClickClass('gioca')}`}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">🎮</span>
              <span className="text-2xl font-bold tracking-wide text-white">GIOCA</span>
            </div>
            <ChevronRight size={36} className="text-green-200 opacity-90" />
          </button>
          <span className="text-[11px] text-zinc-400 mt-[11px] uppercase tracking-wider font-semibold">Tocca per giocare</span>
        </div>

        <div className="h-[20px]"></div>

        {/* Navigation List */}
        <div className="bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 flex flex-col w-full">
          {menuItems.map((item, index) => (
            <React.Fragment key={item.id}>
              <button
                onClick={() => handleClick(item.id)}
                className={`w-full h-[68px] flex items-center px-4 bg-zinc-900 hover:bg-zinc-800 ${getClickClass(item.id)}`}
              >
                <div className="w-[44px] h-[44px] rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                  <span className="text-2xl">{item.desc}</span>
                </div>
                <span className="ml-4 text-[16px] font-bold text-white flex-1 text-left">
                  {item.title}
                </span>
                <ChevronRight size={20} className="text-zinc-500 opacity-60 shrink-0" />
              </button>
              {index < menuItems.length - 1 && (
                <div className="h-[1px] bg-zinc-800 w-[calc(100%-60px)] ml-[60px]" />
              )}
            </React.Fragment>
          ))}
        </div>

      </div>
    </div>
  );
}
