import React, { useRef, useState, useEffect } from "react";
import { Star, Gamepad2, Trophy, Users, Shield, BookOpen, Shuffle, Crown } from "lucide-react";

export function HorizontalScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const stats = {
    playerName: "Fake",
    puntiRankiard: 1276,
    partite: 63,
    vittorie: 45,
    winRate: "71%"
  };

  const sections = [
    {
      id: "play",
      title: "GIOCA",
      icon: <Gamepad2 size={36} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />,
      color: "from-green-600 to-emerald-900",
      border: "border-green-400 border-2 shadow-[0_0_15px_rgba(74,222,128,0.5)]",
      badge: "RANKED",
      width: "w-[190px]",
    },
    {
      id: "training",
      title: "ALLENAMENTO",
      icon: <BookOpen size={36} className="text-white" />,
      color: "from-blue-600 to-indigo-900",
      border: "border-blue-400/50 border",
      badge: "PRATICA",
      width: "w-[160px]",
    },
    {
      id: "gyms",
      title: "PALESTRE",
      icon: <Shield size={36} className="text-white" />,
      color: "from-orange-600 to-red-900",
      border: "border-orange-400/50 border",
      badge: "SFIDE",
      width: "w-[160px]",
    },
    {
      id: "rooms",
      title: "STANZE",
      icon: <Users size={36} className="text-white" />,
      color: "from-purple-600 to-fuchsia-900",
      border: "border-purple-400/50 border",
      badge: "MULTIPLAYER",
      width: "w-[160px]",
    },
    {
      id: "profile",
      title: "PROFILO",
      icon: <Star size={36} className="text-white" />,
      color: "from-cyan-600 to-blue-900",
      border: "border-cyan-400/50 border",
      badge: "LIVELLO 42",
      width: "w-[160px]",
    },
    {
      id: "draft",
      title: "DRAFT",
      icon: <Shuffle size={36} className="text-white" />,
      color: "from-yellow-600 to-amber-900",
      border: "border-yellow-400/50 border",
      badge: "EVENTO",
      width: "w-[160px]",
    },
    {
      id: "leaderboard",
      title: "CLASSIFICA",
      icon: <Trophy size={36} className="text-white" />,
      color: "from-rose-600 to-pink-900",
      border: "border-rose-400/50 border",
      badge: "STAGIONE 5",
      width: "w-[160px]",
    },
    {
      id: "fanta",
      title: "FANTA",
      icon: <Crown size={36} className="text-white" />,
      color: "from-violet-600 to-purple-900",
      border: "border-violet-400/50 border",
      badge: "MERCATO",
      width: "w-[160px]",
    }
  ];

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current) return;
      
      const scrollPosition = scrollRef.current.scrollLeft;
      const cardWidth = 170; // approximate average width + gap
      
      const newIndex = Math.round(scrollPosition / cardWidth);
      
      // Map the 8 cards to 3 dots (just a rough representation of progress)
      const dotIndex = Math.min(2, Math.floor((newIndex / (sections.length - 1)) * 3));
      setActiveIndex(dotIndex);
    };

    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', handleScroll, { passive: true });
      return () => scrollEl.removeEventListener('scroll', handleScroll);
    }
  }, [sections.length]);

  return (
    <div className="flex flex-col min-h-screen bg-neutral-950 text-white w-full max-w-[390px] mx-auto relative overflow-hidden font-sans">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Header */}
      <header className="px-4 py-6 flex items-center justify-between z-10">
        <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent">
          MINKIARDS
        </h1>
        
        <div className="flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 rounded-full px-3 py-1.5 backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-1 text-yellow-400">
            <Star size={12} className="fill-yellow-400" />
            <span className="text-xs font-bold">{stats.puntiRankiard}</span>
          </div>
          <div className="w-px h-3 bg-neutral-700" />
          <div className="flex items-center gap-1 text-blue-400">
            <Gamepad2 size={12} />
            <span className="text-xs font-bold">{stats.partite}</span>
          </div>
          <div className="w-px h-3 bg-neutral-700" />
          <div className="text-xs font-bold text-green-400">
            {stats.winRate}
          </div>
        </div>
      </header>

      {/* Main Body - Centered Vertically */}
      <main className="flex-1 flex flex-col justify-center pb-20 relative">
        
        {/* Ambient background glow based on active selection could go here */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[300px] bg-green-500/5 blur-[100px] rounded-full pointer-events-none" />

        <div 
          ref={scrollRef}
          className="w-full overflow-x-auto hide-scrollbar snap-x snap-mandatory flex items-center gap-4 px-[50vw] pb-8 pt-4"
          style={{
            // The padding creates the effect where the first/last item can be centered.
            // Using a calc to center exactly based on 390px viewport and card width
            scrollPaddingLeft: 'calc(50% - 95px)' // for GIOCA (190px / 2 = 95px)
          }}
        >
          {sections.map((section, index) => {
            const isGioca = index === 0;
            return (
              <div
                key={section.id}
                className={\`
                  shrink-0 h-[220px] rounded-[24px] snap-center flex flex-col items-center justify-between p-6
                  bg-gradient-to-b \${section.color} \${section.border} \${section.width}
                  transition-transform duration-300 hover:scale-105 active:scale-95 cursor-pointer
                  relative overflow-hidden group
                \`}
                // Offset the margin on the first element so it centers nicely with the scroll padding
                style={{
                  marginLeft: index === 0 ? '-95px' : '0',
                  marginRight: index === sections.length - 1 ? 'calc(50vw - 80px)' : '0'
                }}
                onClick={() => {
                  if (scrollRef.current) {
                    const cardNodes = scrollRef.current.children;
                    if (cardNodes[index]) {
                      cardNodes[index].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }
                  }
                }}
              >
                {/* Glossy overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50" />
                
                <div className="relative z-10 flex flex-col items-center gap-4 w-full pt-2">
                  <div className={\`p-3 rounded-full bg-black/20 backdrop-blur-sm shadow-inner \${isGioca ? 'ring-2 ring-green-400/50' : ''}\`}>
                    {section.icon}
                  </div>
                  <h2 className={\`font-black text-center tracking-wide \${isGioca ? 'text-2xl' : 'text-xl'}\`}>
                    {section.title}
                  </h2>
                </div>

                <div className="relative z-10 w-full mt-auto">
                  <div className="bg-black/30 backdrop-blur-md rounded-full py-1.5 px-3 w-full text-center text-xs font-bold tracking-wider text-white/90 border border-white/10">
                    {section.badge}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Dots */}
        <div className="flex justify-center gap-2 mt-6">
          {[0, 1, 2].map((i) => (
            <div 
              key={i}
              className={\`h-1.5 rounded-full transition-all duration-300 \${
                activeIndex === i ? 'w-6 bg-white' : 'w-2 bg-neutral-700'
              }\`}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
