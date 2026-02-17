import React, { useState, useRef, useCallback, useEffect } from "react";
import { Card } from "./Card";
import { Deck } from "./Deck";
import { useGameState } from "../lib/stores/useGameState";
import { useAudio } from "../lib/stores/useAudio";
import { socket } from "../lib/socket";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { getAvatarEmoji } from "../lib/avatars";

const hasCustomEffect = (card: any): boolean => {
  const effect = card.effect || '';
  if (!effect || effect.trim() === '' || effect.trim().toLowerCase() === 'none') return false;
  const effectLower = effect.toLowerCase();
  if (effectLower.includes('[comportamento:') || effectLower.includes('[dado:') || effectLower.includes('[dettagli:') || effectLower.includes('[animazione:') || effectLower.includes('[bersaglio:')) return true;
  const effectKeywords = ['quando', 'attiva', 'assorbe', 'aggiunge', 'infligge', 'protetto', 'immune', 'clona', 'trasforma', 'ruba', 'cura', 'danno', 'aumenta', 'diminuisce', 'raddoppia', 'dimezza', 'scommessa', 'fusione', 'guadagna', 'perde'];
  for (const keyword of effectKeywords) {
    if (effectLower.includes(keyword)) return true;
  }
  return effect.trim().length > 5;
};

const AMBIENT_PARTICLES = Array.from({ length: 15 }, (_, i) => ({
  size: 2 + (i * 7 % 5),
  left: (i * 8.3) % 100,
  top: (i * 13.7) % 100,
  color: ['#fbbf24', '#a855f7', '#3b82f6', '#22c55e'][i % 4],
  duration: 10 + (i % 4) * 4,
  delay: (i % 5) * 2,
}));

interface ContextParticle {
  id: string;
  x: number;
  y: number;
  type: 'spark' | 'smoke' | 'glow';
  color: string;
  size: number;
  duration: number;
  sparkDx: number;
  sparkDy: number;
}

interface GameBoard3DProps {
  onCardClick?: (card: any) => void;
}

export const GameBoard3D: React.FC<GameBoard3DProps> = ({ onCardClick }) => {
  const { gameState, playerName, gameId } = useGameState();
  const { playButtonClick } = useAudio();

  const fieldCards = gameState?.field || [];
  const players = gameState?.players || {};
  const allPlayerNames = Object.keys(players);
  const currentTurnPlayer = gameState?.turnOrder?.[gameState?.currentTurnIndex ?? 0] || '';
  const isMyTurn = currentTurnPlayer === playerName;
  const myHand = players[playerName]?.hand || [];

  const turnOrder = gameState?.turnOrder || [];

  // === INTERACTIVE TABLE ROTATION ===
  const [tableRotation, setTableRotation] = useState({ x: 32, y: 0 });
  const isDragging = useRef(false);
  const lastTouch = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.deck-tap-area, .card-3d-opponent, .card-3d-mine, .card-interactive, button')) return;
    isDragging.current = true;
    lastTouch.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastTouch.current.x;
    const dy = e.clientY - lastTouch.current.y;
    lastTouch.current = { x: e.clientX, y: e.clientY };
    setTableRotation(prev => ({
      x: Math.max(15, Math.min(55, prev.x - dy * 0.3)),
      y: Math.max(-25, Math.min(25, prev.y + dx * 0.3)),
    }));
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // === CONTEXTUAL PARTICLES ===
  const [contextParticles, setContextParticles] = useState<ContextParticle[]>([]);
  const prevFieldCardIds = useRef<string[]>([]);
  const prevFieldCount = useRef(0);

  useEffect(() => {
    const currentIds = fieldCards.map((c: any) => c.id);
    const prevIds = prevFieldCardIds.current;

    const newCards = currentIds.filter((id: string) => !prevIds.includes(id));
    const removedCards = prevIds.filter((id: string) => !currentIds.includes(id));

    if (newCards.length > 0 && prevIds.length > 0) {
      const particles: ContextParticle[] = [];
      for (let i = 0; i < 8; i++) {
        particles.push({
          id: `glow-${Date.now()}-${i}`,
          x: 40 + Math.random() * 20,
          y: 40 + Math.random() * 20,
          type: 'glow',
          color: ['#fbbf24', '#a855f7', '#3b82f6', '#22c55e'][i % 4],
          size: 4 + Math.random() * 6,
          duration: 1 + Math.random() * 0.5,
          sparkDx: 0,
          sparkDy: 0,
        });
      }
      setContextParticles(prev => [...prev, ...particles]);
      setTimeout(() => {
        setContextParticles(prev => prev.filter(p => !particles.find(np => np.id === p.id)));
      }, 2000);
    }

    if (removedCards.length > 0 && prevIds.length > 0) {
      const particles: ContextParticle[] = [];
      for (let i = 0; i < 12; i++) {
        particles.push({
          id: `smoke-${Date.now()}-${i}`,
          x: 30 + Math.random() * 40,
          y: 30 + Math.random() * 40,
          type: 'smoke',
          color: `rgba(${100 + Math.random() * 100}, ${80 + Math.random() * 60}, ${60 + Math.random() * 40}, 0.6)`,
          size: 8 + Math.random() * 12,
          duration: 1.5 + Math.random() * 1,
          sparkDx: 0,
          sparkDy: 0,
        });
      }
      setContextParticles(prev => [...prev, ...particles]);
      setTimeout(() => {
        setContextParticles(prev => prev.filter(p => !particles.find(np => np.id === p.id)));
      }, 3000);
    }

    prevFieldCardIds.current = currentIds;
    prevFieldCount.current = fieldCards.length;
  }, [fieldCards]);

  // === ATTACK PARTICLES (listen for attack events) ===
  useEffect(() => {
    const handleAttack = () => {
      const particles: ContextParticle[] = [];
      for (let i = 0; i < 15; i++) {
        particles.push({
          id: `spark-${Date.now()}-${i}`,
          x: 35 + Math.random() * 30,
          y: 25 + Math.random() * 50,
          type: 'spark',
          color: ['#ff4444', '#ff8800', '#ffcc00', '#ff6622'][i % 4],
          size: 3 + Math.random() * 5,
          duration: 0.6 + Math.random() * 0.8,
          sparkDx: (Math.random() - 0.5) * 80,
          sparkDy: (Math.random() - 0.5) * 80,
        });
      }
      setContextParticles(prev => [...prev, ...particles]);
      setTimeout(() => {
        setContextParticles(prev => prev.filter(p => !particles.find(np => np.id === p.id)));
      }, 2000);
    };

    socket.on('attack-result', handleAttack);
    socket.on('recursive-damage-result', handleAttack);
    return () => {
      socket.off('attack-result', handleAttack);
      socket.off('recursive-damage-result', handleAttack);
    };
  }, []);

  const getOrderedPlayers = () => {
    let orderedList: string[];
    if (turnOrder.length > 0) {
      orderedList = Array.from(new Set(turnOrder));
    } else {
      orderedList = Array.from(new Set(allPlayerNames));
    }
    const currentPlayerIndex = orderedList.indexOf(playerName);
    if (currentPlayerIndex === -1) return orderedList.filter(name => name !== playerName);
    const reorderedPlayers: string[] = [];
    const totalPlayers = orderedList.length;
    for (let i = 1; i < totalPlayers; i++) {
      const playerIndex = (currentPlayerIndex + i) % totalPlayers;
      reorderedPlayers.push(orderedList[playerIndex]);
    }
    return reorderedPlayers;
  };

  const otherPlayers = getOrderedPlayers();

  const attachedParasiticCards = fieldCards.filter(card => card.attachedTo);
  const regularCards = fieldCards.filter(card => !card.attachedTo);
  const attachedCardsMap = attachedParasiticCards.reduce((acc, card) => {
    if (card.attachedTo) {
      if (!acc[card.attachedTo]) acc[card.attachedTo] = [];
      acc[card.attachedTo].push(card);
    }
    return acc;
  }, {} as Record<string, typeof fieldCards>);

  const cardsByPlayer = regularCards.reduce((acc, card) => {
    if (!acc[card.owner]) acc[card.owner] = [];
    acc[card.owner].push(card);
    return acc;
  }, {} as Record<string, typeof fieldCards>);

  const handleMoveCard = (cardId: string, direction: 'left' | 'right') => {
    socket.emit('move-card-position', { cardId, direction, playerName, gameId });
  };

  const handleActivateEffect = (card: any) => {
    socket.emit('activate-custom-effect', { cardId: card.id, playerName, gameId });
  };

  const myCards = cardsByPlayer[playerName] || [];

  return (
    <div
      className="fixed inset-0 z-[15] overflow-hidden select-none"
      style={{ background: '#050a12' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <style>{`
        @keyframes float-particle-3d {
          0%, 100% { transform: translateY(0); opacity: 0.15; }
          50% { transform: translateY(-25px); opacity: 0.4; }
        }
        @keyframes card-enter-3d {
          0% { opacity: 0; transform: scale(0.3) translateY(40px) rotateY(180deg); }
          50% { opacity: 0.7; transform: scale(1.15) translateY(-10px) rotateY(10deg); }
          100% { opacity: 1; transform: scale(1) translateY(0) rotateY(0deg); }
        }
        @keyframes spark-burst {
          0% { opacity: 1; transform: scale(1) translate(0, 0); }
          100% { opacity: 0; transform: scale(0.2) translate(var(--spark-dx), var(--spark-dy)); }
        }
        @keyframes smoke-rise {
          0% { opacity: 0.6; transform: scale(1) translateY(0); filter: blur(2px); }
          100% { opacity: 0; transform: scale(2.5) translateY(-40px); filter: blur(8px); }
        }
        @keyframes glow-appear {
          0% { opacity: 0; transform: scale(0.5); }
          40% { opacity: 0.9; transform: scale(1.3); }
          100% { opacity: 0; transform: scale(2); }
        }
        .card-3d-opponent {
          transform: perspective(600px) rotateX(8deg) scale(0.92);
          filter: brightness(0.85) saturate(0.9);
          transition: transform 0.3s ease, filter 0.3s ease;
        }
        .card-3d-opponent:hover {
          transform: perspective(600px) rotateX(2deg) scale(1.0) translateY(-4px) !important;
          filter: brightness(1.05) saturate(1.0) !important;
          z-index: 50 !important;
        }
        .card-3d-mine {
          transform: perspective(800px) rotateX(-3deg) scale(1.0);
          filter: brightness(1.05);
          transition: transform 0.3s ease, filter 0.3s ease, box-shadow 0.3s ease;
        }
        .card-3d-mine:hover {
          transform: perspective(800px) rotateX(-1deg) scale(1.08) translateY(-8px) !important;
          filter: brightness(1.2) !important;
          z-index: 50 !important;
        }
        .card-shadow-float {
          box-shadow: 0 8px 20px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3);
        }
        .card-shadow-float-mine {
          box-shadow: 0 12px 30px rgba(0,0,0,0.6), 0 4px 10px rgba(0,0,0,0.4), 0 0 20px rgba(147,51,234,0.15);
        }
        .card-enter-anim {
          animation: card-enter-3d 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .deck-tap-area {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          cursor: pointer;
        }
        .zone-depth {
          backdrop-filter: blur(4px);
          border: 1px solid rgba(255,255,255,0.06);
          transition: box-shadow 0.4s ease;
        }
        .zone-top {
          background: linear-gradient(180deg, rgba(0,30,60,0.4) 0%, rgba(0,20,40,0.2) 100%);
          box-shadow: 0 4px 20px rgba(0,0,0,0.3), inset 0 -1px 0 rgba(59,130,246,0.15);
        }
        .zone-middle {
          background: linear-gradient(180deg, rgba(10,10,30,0.25) 0%, rgba(5,5,20,0.35) 100%);
          box-shadow: 0 6px 25px rgba(0,0,0,0.35), inset 0 1px 0 rgba(251,191,36,0.1), inset 0 -1px 0 rgba(251,191,36,0.1);
        }
        .zone-bottom {
          background: linear-gradient(0deg, rgba(60,0,80,0.3) 0%, rgba(30,0,50,0.15) 100%);
          box-shadow: 0 -4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(147,51,234,0.2), 0 0 30px rgba(147,51,234,0.08);
        }
      `}</style>

      {/* Ambient particles */}
      {AMBIENT_PARTICLES.map((p, i) => (
        <div
          key={`p3d-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            left: `${p.left}%`,
            top: `${p.top}%`,
            background: p.color,
            animation: `float-particle-3d ${p.duration}s ease-in-out ${p.delay}s infinite`,
            opacity: 0.15,
          }}
        />
      ))}

      {/* Contextual particles */}
      {contextParticles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: p.color,
            animation: `${p.type === 'spark' ? 'spark-burst' : p.type === 'smoke' ? 'smoke-rise' : 'glow-appear'} ${p.duration}s ease-out forwards`,
            '--spark-dx': `${p.sparkDx}px`,
            '--spark-dy': `${p.sparkDy}px`,
            zIndex: 30,
          } as React.CSSProperties}
        />
      ))}

      {/* ====== LAYER 1: 3D TABLE (visual only, no interaction) ====== */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          perspective: '1400px',
          perspectiveOrigin: '50% 40%',
        }}
      >
        <div
          className="relative"
          style={{
            width: 'min(95vw, 950px)',
            height: 'min(82vh, 720px)',
            transform: `rotateX(${tableRotation.x}deg) rotateY(${tableRotation.y}deg)`,
            transition: isDragging.current ? 'none' : 'transform 0.5s ease-out',
          }}
        >
          {/* Table surface */}
          <div
            className="absolute inset-0 rounded-3xl overflow-hidden"
            style={{
              backgroundImage: `url('https://i.ibb.co/Y4bv4xwz/sfondo-minkiards.png')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              boxShadow: '0 30px 60px rgba(0,0,0,0.8), 0 0 80px rgba(147,51,234,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <div className="absolute inset-0 bg-black/30 rounded-3xl" />
            {/* Directional light from top */}
            <div className="absolute inset-0 rounded-3xl" style={{
              background: 'radial-gradient(ellipse 70% 50% at 50% 20%, rgba(255,250,230,0.12) 0%, transparent 60%)',
            }} />
            {/* Subtle vignette */}
            <div className="absolute inset-0 rounded-3xl" style={{
              background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
            }} />
            {/* Felt texture */}
            <div className="absolute inset-0 rounded-3xl" style={{
              background: 'repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,255,255,0.006) 40px, rgba(255,255,255,0.006) 80px)',
            }} />
          </div>

          {/* Wood border frame */}
          <div className="absolute inset-[-8px] rounded-[28px]" style={{
            border: '8px solid transparent',
            backgroundImage: 'linear-gradient(135deg, #3d2817 0%, #5c3d24 30%, #3d2817 60%, #2a1a0e 100%)',
            backgroundClip: 'border-box',
            boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.6)',
            zIndex: -1,
          }} />

          {/* Purple border glow */}
          <div className="absolute inset-[-4px] rounded-[26px]" style={{
            border: '4px solid rgba(147,51,234,0.3)',
            boxShadow: '0 0 40px rgba(147,51,234,0.2)',
          }} />

          {/* Decorative circles with light reflection */}
          <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2" style={{
            width: '30%', height: '30%',
            border: '1px solid rgba(251,191,36,0.1)',
            borderRadius: '50%',
            boxShadow: '0 0 20px rgba(251,191,36,0.03)',
          }} />
          <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2" style={{
            width: '50%', height: '50%',
            border: '1px solid rgba(147,51,234,0.07)',
            borderRadius: '50%',
          }} />

          {/* Floor shadow */}
          <div className="absolute inset-0" style={{
            transform: 'translateZ(-20px) translateY(30px) scale(1.05)',
            background: 'rgba(0,0,0,0.35)',
            borderRadius: '30px',
            filter: 'blur(25px)',
          }} />
        </div>
      </div>

      {/* ====== LAYER 2: INTERACTIVE CONTENT with perspective ====== */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          perspective: '1400px',
          perspectiveOrigin: '50% 40%',
        }}
      >
        <div
          className="relative flex flex-col"
          style={{
            width: 'min(95vw, 950px)',
            height: 'min(82vh, 720px)',
            transform: `rotateX(${tableRotation.x}deg) rotateY(${tableRotation.y}deg)`,
            transition: isDragging.current ? 'none' : 'transform 0.5s ease-out',
            transformStyle: 'preserve-3d',
            paddingTop: '8px',
            paddingBottom: '8px',
          }}
        >

        {/* === TOP ZONE: Opponent cards === */}
        <div className="flex-shrink-0 flex flex-wrap justify-center gap-2 sm:gap-3 px-2 py-1 mt-1 mx-2 rounded-xl zone-depth zone-top" style={{ transformStyle: 'preserve-3d' }}>
          {otherPlayers.map((opName) => {
            const opCards = cardsByPlayer[opName] || [];
            return (
              <div key={opName} className="flex flex-col items-center gap-1 min-w-0">
                <span className={`${opName === currentTurnPlayer ? 'bg-green-600/90 ring-2 ring-green-400' : 'bg-blue-800/80'} text-white font-bold px-2 py-0.5 rounded-full text-[10px] shadow-lg whitespace-nowrap`}>
                  {players[opName]?.avatar && <span className="mr-1">{getAvatarEmoji(players[opName]?.avatar || '')}</span>}
                  {opName}
                </span>
                <div className="flex gap-0.5 items-center flex-wrap justify-center" style={{ transformStyle: 'preserve-3d' }}>
                  {opCards.length > 0 ? opCards.map((card) => {
                    const attached = attachedCardsMap[card.id] || [];
                    return (
                      <div key={card.id} className="card-3d-opponent card-interactive card-enter-anim flex items-center gap-0.5" style={{ transformStyle: 'preserve-3d' }}>
                        <div className="scale-[0.48] sm:scale-[0.53] md:scale-[0.6] origin-top card-shadow-float rounded-lg" style={{ transform: 'translateZ(15px)' }}>
                          <Card card={card} location="field" />
                        </div>
                        {attached.map((p) => (
                          <div key={p.id} className="scale-[0.42] origin-top" style={{ transform: 'translateZ(20px)' }}>
                            <div className="border-2 border-red-500 rounded-lg shadow-lg shadow-red-500/50 card-shadow-float">
                              <Card card={p} location="field" />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }) : (
                    <span className="text-white/40 text-[10px] italic">Nessuna carta</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* === MIDDLE ZONE: Decks === */}
        <div className="flex-1 flex items-center justify-center min-h-0 px-2" style={{ transformStyle: 'preserve-3d' }}>
          <div className="deck-tap-area flex gap-2 sm:gap-3 items-start justify-center p-3 sm:p-4 rounded-2xl zone-depth zone-middle" style={{ transform: 'translateZ(10px)', transformStyle: 'preserve-3d' }}>
            <div className="deck-tap-area scale-[0.55] sm:scale-[0.65] md:scale-[0.75] origin-center" style={{ transform: 'translateZ(8px)' }}>
              <Deck name="PERSONAGGI" backImage="https://i.imgur.com/r1rfUAB.png" type="personaggi" />
            </div>
            <div className="deck-tap-area scale-[0.55] sm:scale-[0.65] md:scale-[0.75] origin-center" style={{ transform: 'translateZ(8px)' }}>
              <Deck name="MOSSE" backImage="https://i.imgur.com/6MUXCZO.png" type="mosse" />
            </div>
            <div className="deck-tap-area scale-[0.55] sm:scale-[0.65] md:scale-[0.75] origin-center" style={{ transform: 'translateZ(8px)' }}>
              <Deck name="BONUS" backImage="https://i.imgur.com/lEROr3r.png" type="bonus" />
            </div>
            <div className="deck-tap-area scale-[0.55] sm:scale-[0.65] md:scale-[0.75] origin-center" style={{ transform: 'translateZ(8px)' }}>
              <Deck name="SPECIALI" backImage="https://i.imgur.com/ipVd57A.png" type="personaggi_speciali" />
            </div>
          </div>
        </div>

        {/* === BOTTOM ZONE: My cards === */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1 px-2 py-1.5 mb-1 mx-2 rounded-xl zone-depth zone-bottom" style={{ transformStyle: 'preserve-3d' }}>
          <div className="flex gap-1.5 items-end justify-center flex-wrap max-w-full" style={{ transformStyle: 'preserve-3d' }}>
            {myCards.length > 0 ? myCards.map((card, i) => {
              const attached = attachedCardsMap[card.id] || [];
              return (
                <div key={card.id} className="card-3d-mine card-interactive card-enter-anim flex flex-col items-center" style={{ transformStyle: 'preserve-3d' }}>
                  <div className="flex items-center gap-0.5" style={{ transformStyle: 'preserve-3d' }}>
                    <Button
                      onClick={() => handleMoveCard(card.id, 'left')}
                      disabled={i === 0}
                      className="p-0.5 h-5 w-5 bg-gray-600/80 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50"
                      size="sm"
                      style={{ transform: 'translateZ(25px)' }}
                    >
                      <ChevronLeft size={10} />
                    </Button>
                    <div className="scale-[0.58] sm:scale-[0.68] md:scale-[0.78] origin-bottom card-shadow-float-mine rounded-lg" style={{ transform: 'translateZ(25px)' }}>
                      <Card card={card} location="field" />
                    </div>
                    {attached.map((p) => (
                      <div key={p.id} className="scale-[0.48] origin-bottom" style={{ transform: 'translateZ(30px)' }}>
                        <div className="border-2 border-red-500 rounded-lg shadow-lg shadow-red-500/50 card-shadow-float">
                          <Card card={p} location="field" />
                        </div>
                      </div>
                    ))}
                    <Button
                      onClick={() => handleMoveCard(card.id, 'right')}
                      disabled={i === myCards.length - 1}
                      className="p-0.5 h-5 w-5 bg-gray-600/80 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50"
                      size="sm"
                      style={{ transform: 'translateZ(25px)' }}
                    >
                      <ChevronRight size={10} />
                    </Button>
                  </div>
                  {hasCustomEffect(card) && (
                    <Button
                      onClick={() => handleActivateEffect(card)}
                      className="mt-0.5 px-1.5 py-0 h-5 text-[9px] bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-0.5"
                      size="sm"
                      style={{ transform: 'translateZ(30px)' }}
                    >
                      <Zap size={9} />
                      Effetto
                    </Button>
                  )}
                </div>
              );
            }) : (
              <span className="text-white/40 text-xs italic">Nessuna carta in campo</span>
            )}
          </div>
          <span className={`${isMyTurn ? 'bg-green-500/90 ring-2 ring-green-400' : 'bg-yellow-600/80'} text-white font-bold px-3 py-1 rounded-full text-xs shadow-lg`} style={{ transform: 'translateZ(20px)' }}>
            {players[playerName]?.avatar && <span className="mr-1">{getAvatarEmoji(players[playerName]?.avatar || '')}</span>}
            {playerName} (Tu)
          </span>
        </div>
        </div>
      </div>

      {/* Turn indicator */}
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-20">
        <div className={`px-4 py-1.5 rounded-2xl text-sm font-bold whitespace-nowrap border ${
          isMyTurn
            ? 'border-yellow-400/40 text-yellow-100'
            : 'border-blue-400/30 text-blue-100'
        }`} style={{
          background: isMyTurn
            ? 'linear-gradient(135deg, rgba(245,158,11,0.3) 0%, rgba(234,179,8,0.15) 100%)'
            : 'linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(139,92,246,0.15) 100%)',
          backdropFilter: 'blur(12px)',
          textShadow: isMyTurn ? '0 0 12px rgba(250,204,21,0.5)' : '0 0 8px rgba(147,197,253,0.4)',
        }}>
          {isMyTurn ? '👑 TOCCA A TE!' : `⏳ Turno di ${currentTurnPlayer}`}
        </div>
      </div>

      {/* Info bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20">
        <div className="flex gap-3 items-center px-4 py-2 rounded-2xl" style={{
          background: 'rgba(10,8,30,0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <span className="text-slate-400 text-xs">Campo: {fieldCards.length}</span>
          <span className="text-slate-600 text-xs">|</span>
          <span className="text-slate-400 text-xs">Mano: {myHand.length}</span>
          <span className="text-slate-600 text-xs">|</span>
          <span className="text-slate-400 text-xs">Giocatori: {allPlayerNames.length}</span>
        </div>
      </div>
    </div>
  );
};
