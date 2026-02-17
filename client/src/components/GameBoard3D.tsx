import React from "react";
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

const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  size: 2 + (i * 7 % 5),
  left: (i * 8.3) % 100,
  top: (i * 13.7) % 100,
  color: ['#fbbf24', '#a855f7', '#3b82f6', '#22c55e'][i % 4],
  duration: 8 + (i % 4) * 3,
  delay: (i % 5) * 2,
}));

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
    <div className="fixed inset-0 z-[15] overflow-hidden" style={{ background: '#050a12' }}>
      <style>{`
        @keyframes float-particle-3d {
          0%, 100% { transform: translateY(0); opacity: 0.2; }
          50% { transform: translateY(-30px); opacity: 0.5; }
        }
        .card-3d-hover:hover {
          transform: translateY(-6px) scale(1.03) !important;
          z-index: 50 !important;
          filter: brightness(1.15);
        }
        .card-3d-hover {
          transition: transform 0.3s ease, filter 0.3s ease;
        }
        .deck-tap-area {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          cursor: pointer;
        }
      `}</style>

      {PARTICLES.map((p, i) => (
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
            opacity: 0.2,
          }}
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
            transform: 'rotateX(32deg)',
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
            <div className="absolute inset-0 bg-black/35 rounded-3xl" />
            <div className="absolute inset-0 rounded-3xl" style={{
              background: 'repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,255,255,0.008) 40px, rgba(255,255,255,0.008) 80px)',
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

          {/* Decorative circles */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{
            width: '35%', height: '35%',
            border: '1px solid rgba(251,191,36,0.08)',
            borderRadius: '50%',
          }} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{
            width: '55%', height: '55%',
            border: '1px solid rgba(147,51,234,0.06)',
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

      {/* ====== LAYER 2: INTERACTIVE CONTENT (2D overlay, no 3D transform) ====== */}
      <div className="absolute inset-0 flex flex-col" style={{ paddingTop: '50px', paddingBottom: '50px' }}>

        {/* === TOP ZONE: Opponent cards === */}
        <div className="flex-shrink-0 flex flex-wrap justify-center gap-3 sm:gap-4 px-2 py-1 mt-1">
          {otherPlayers.map((opName) => {
            const opCards = cardsByPlayer[opName] || [];
            return (
              <div key={opName} className="flex flex-col items-center gap-1 min-w-0">
                <span className={`${opName === currentTurnPlayer ? 'bg-green-600/90 ring-2 ring-green-400' : 'bg-blue-800/80'} text-white font-bold px-2 py-0.5 rounded-full text-[10px] shadow-lg whitespace-nowrap`}>
                  {players[opName]?.avatar && <span className="mr-1">{getAvatarEmoji(players[opName]?.avatar || '')}</span>}
                  {opName}
                </span>
                <div className="flex gap-0.5 items-center flex-wrap justify-center">
                  {opCards.length > 0 ? opCards.map((card) => {
                    const attached = attachedCardsMap[card.id] || [];
                    return (
                      <div key={card.id} className="card-3d-hover flex items-center gap-0.5">
                        <div className="scale-[0.5] sm:scale-[0.55] md:scale-[0.65] origin-top">
                          <Card card={card} location="field" />
                        </div>
                        {attached.map((p) => (
                          <div key={p.id} className="scale-[0.45] origin-top">
                            <div className="border-2 border-red-500 rounded-lg shadow-lg shadow-red-500/50">
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
        <div className="flex-1 flex items-center justify-center min-h-0 px-2">
          <div className="deck-tap-area flex gap-2 sm:gap-3 items-start justify-center p-2 sm:p-3 rounded-xl" style={{
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div className="deck-tap-area scale-[0.55] sm:scale-[0.65] md:scale-[0.75] origin-center">
              <Deck name="PERSONAGGI" backImage="https://i.imgur.com/r1rfUAB.png" type="personaggi" />
            </div>
            <div className="deck-tap-area scale-[0.55] sm:scale-[0.65] md:scale-[0.75] origin-center">
              <Deck name="MOSSE" backImage="https://i.imgur.com/6MUXCZO.png" type="mosse" />
            </div>
            <div className="deck-tap-area scale-[0.55] sm:scale-[0.65] md:scale-[0.75] origin-center">
              <Deck name="BONUS" backImage="https://i.imgur.com/lEROr3r.png" type="bonus" />
            </div>
            <div className="deck-tap-area scale-[0.55] sm:scale-[0.65] md:scale-[0.75] origin-center">
              <Deck name="SPECIALI" backImage="https://i.imgur.com/ipVd57A.png" type="personaggi_speciali" />
            </div>
          </div>
        </div>

        {/* === BOTTOM ZONE: My cards === */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1 px-2 py-1 mb-1">
          <div className="flex gap-1 items-end justify-center flex-wrap max-w-full">
            {myCards.length > 0 ? myCards.map((card, i) => {
              const attached = attachedCardsMap[card.id] || [];
              return (
                <div key={card.id} className="card-3d-hover flex flex-col items-center">
                  <div className="flex items-center gap-0.5">
                    <Button
                      onClick={() => handleMoveCard(card.id, 'left')}
                      disabled={i === 0}
                      className="p-0.5 h-5 w-5 bg-gray-600/80 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50"
                      size="sm"
                    >
                      <ChevronLeft size={10} />
                    </Button>
                    <div className="scale-[0.55] sm:scale-[0.65] md:scale-[0.75] origin-bottom">
                      <Card card={card} location="field" />
                    </div>
                    {attached.map((p) => (
                      <div key={p.id} className="scale-[0.45] origin-bottom">
                        <div className="border-2 border-red-500 rounded-lg shadow-lg shadow-red-500/50">
                          <Card card={p} location="field" />
                        </div>
                      </div>
                    ))}
                    <Button
                      onClick={() => handleMoveCard(card.id, 'right')}
                      disabled={i === myCards.length - 1}
                      className="p-0.5 h-5 w-5 bg-gray-600/80 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50"
                      size="sm"
                    >
                      <ChevronRight size={10} />
                    </Button>
                  </div>
                  {hasCustomEffect(card) && (
                    <Button
                      onClick={() => handleActivateEffect(card)}
                      className="mt-0.5 px-1.5 py-0 h-5 text-[9px] bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-0.5"
                      size="sm"
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
          <span className={`${isMyTurn ? 'bg-green-500/90 ring-2 ring-green-400' : 'bg-yellow-600/80'} text-white font-bold px-3 py-1 rounded-full text-xs shadow-lg`}>
            {players[playerName]?.avatar && <span className="mr-1">{getAvatarEmoji(players[playerName]?.avatar || '')}</span>}
            {playerName} (Tu)
          </span>
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
