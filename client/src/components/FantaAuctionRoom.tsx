import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { socket } from "../lib/socket";

type FantaRarity = 'comune' | 'rara' | 'epica' | 'leggendaria';

interface FantaCard {
  id: string;
  type: 'personaggi' | 'mosse' | 'bonus';
  frontImage: string;
  name: string;
  rarity: FantaRarity;
  draftCost: number;
}

interface DeckProgress {
  personaggi: number;
  mosse: number;
  bonus: number;
}

interface Props {
  fantaId: string;
  playerName: string;
  isCreator: boolean;
  participants: string[];
  initialCredits: Record<string, number>;
  onComplete: () => void;
}

const RARITY_COLORS: Record<FantaRarity, string> = {
  comune: 'text-gray-300 bg-gray-700/50 border-gray-500',
  rara: 'text-blue-300 bg-blue-900/50 border-blue-500',
  epica: 'text-purple-300 bg-purple-900/50 border-purple-500',
  leggendaria: 'text-yellow-300 bg-yellow-900/50 border-yellow-500',
};

const RARITY_GLOW: Record<FantaRarity, string> = {
  comune: '',
  rara: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]',
  epica: 'shadow-[0_0_25px_rgba(168,85,247,0.5)]',
  leggendaria: 'shadow-[0_0_30px_rgba(234,179,8,0.6)]',
};

const TYPE_LABEL: Record<string, string> = {
  personaggi: 'PERSONAGGIO',
  mosse: 'MOSSA',
  bonus: 'BONUS',
};

const TYPE_COLOR: Record<string, string> = {
  personaggi: 'bg-red-700',
  mosse: 'bg-blue-700',
  bonus: 'bg-green-700',
};

export function FantaAuctionRoom({ fantaId, playerName, isCreator, participants, initialCredits, onComplete }: Props) {
  const [currentCard, setCurrentCard] = useState<FantaCard | null>(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [currentBidder, setCurrentBidder] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(15);
  const [credits, setCredits] = useState<Record<string, number>>(initialCredits);
  const [deckProgress, setDeckProgress] = useState<Record<string, DeckProgress>>({});
  const [recentAwarded, setRecentAwarded] = useState<Array<{ card: FantaCard; winner: string }>>([]);
  const [customBid, setCustomBid] = useState('');
  const [awardedCard, setAwardedCard] = useState<{ card: FantaCard; winner: string } | null>(null);
  const [skippedCard, setSkippedCard] = useState<FantaCard | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

  const myCredits = credits[playerName] ?? 500;
  const myProgress = deckProgress[playerName] ?? { personaggi: 0, mosse: 0, bonus: 0 };

  useEffect(() => {
    socket.on('fanta:card-up', (data: { card: FantaCard; timer: number; deckProgress: Record<string, DeckProgress>; credits: Record<string, number> }) => {
      setCurrentCard(data.card);
      setCurrentBid(0);
      setCurrentBidder(null);
      setCountdown(data.timer);
      setDeckProgress(data.deckProgress || {});
      setCredits(data.credits || {});
      setAwardedCard(null);
      setSkippedCard(null);
      setCustomBid('');
      if (cardRef.current) {
        cardRef.current.classList.remove('animate-bounce-in');
        void cardRef.current.offsetWidth;
        cardRef.current.classList.add('animate-bounce-in');
      }
    });

    socket.on('fanta:bid-update', (data: { bidder: string; amount: number; countdown: number; credits: Record<string, number> }) => {
      setCurrentBid(data.amount);
      setCurrentBidder(data.bidder);
      setCountdown(data.countdown);
      setCredits(data.credits || {});
    });

    socket.on('fanta:countdown', (data: { seconds: number }) => {
      setCountdown(data.seconds);
    });

    socket.on('fanta:card-awarded', (data: { winner: string; card: FantaCard; amount: number; creditsRemaining: number; deckProgress: Record<string, DeckProgress>; credits: Record<string, number> }) => {
      setAwardedCard({ card: data.card, winner: data.winner });
      setDeckProgress(data.deckProgress || {});
      setCredits(data.credits || {});
      setRecentAwarded(prev => [{ card: data.card, winner: data.winner }, ...prev].slice(0, 10));
      setCurrentCard(null);
    });

    socket.on('fanta:card-skipped', (data: { card: FantaCard; reason?: string }) => {
      setSkippedCard(data.card);
      setCurrentCard(null);
    });

    socket.on('fanta:deck-progress', (data: { progress: Record<string, DeckProgress> }) => {
      setDeckProgress(data.progress);
    });

    socket.on('fanta:auction-complete', () => {
      onComplete();
    });

    socket.on('fanta:error', (data: { message: string }) => {
      setErrorMsg(data.message);
      setTimeout(() => setErrorMsg(''), 3000);
    });

    return () => {
      socket.off('fanta:card-up');
      socket.off('fanta:bid-update');
      socket.off('fanta:countdown');
      socket.off('fanta:card-awarded');
      socket.off('fanta:card-skipped');
      socket.off('fanta:deck-progress');
      socket.off('fanta:auction-complete');
      socket.off('fanta:error');
    };
  }, [onComplete]);

  const placeBid = (amount: number) => {
    socket.emit('fanta:place-bid', { fantaId, playerName, amount });
  };

  const handleCustomBid = () => {
    const amount = parseInt(customBid);
    if (!isNaN(amount) && amount > 0) {
      placeBid(amount);
      setCustomBid('');
    }
  };

  const handleSkip = () => {
    socket.emit('fanta:skip-card', { fantaId, playerName });
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    socket.emit('fanta:search-card', { fantaId, playerName, query: searchQuery.trim() });
    setSearchQuery('');
  };

  const countdownPct = Math.max(0, (countdown / 15) * 100);
  const countdownColor = countdown <= 3 ? 'bg-red-500' : countdown <= 6 ? 'bg-orange-500' : 'bg-green-500';

  const canBid = currentCard &&
    myCredits > currentBid &&
    (myProgress[currentCard.type] ?? 0) < 33 &&
    currentBidder !== playerName;

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
      {errorMsg && (
        <div className="bg-red-900 border border-red-500 text-red-200 px-4 py-2 text-sm text-center">
          {errorMsg}
        </div>
      )}

      <div className="flex gap-3 p-3 flex-1 min-h-0 overflow-hidden">
        {/* Left: Card */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-2">
          <div className="text-xs font-bold text-white/50 uppercase tracking-widest">Carta in asta</div>
          {currentCard ? (
            <div ref={cardRef} className={`relative rounded-xl border-2 overflow-hidden ${RARITY_COLORS[currentCard.rarity]} ${RARITY_GLOW[currentCard.rarity]} transition-all`}>
              <img
                src={currentCard.frontImage}
                alt={currentCard.name}
                className="w-full aspect-[2/3] object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-card.png'; }}
              />
              <div className="absolute top-2 left-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${TYPE_COLOR[currentCard.type]}`}>
                  {TYPE_LABEL[currentCard.type]}
                </span>
              </div>
              <div className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded border capitalize ${RARITY_COLORS[currentCard.rarity]}`}>
                {currentCard.rarity}
              </div>
              <div className="p-2 bg-black/70">
                <div className="text-xs font-bold text-white leading-tight">{currentCard.name}</div>
              </div>
            </div>
          ) : awardedCard ? (
            <div className="rounded-xl border-2 border-yellow-500 bg-yellow-900/30 p-4 text-center">
              <div className="text-2xl mb-1">🔨</div>
              <div className="text-yellow-300 font-bold text-sm">AGGIUDICATO!</div>
              <div className="text-white text-xs mt-1">{awardedCard.card.name}</div>
              <div className="text-green-300 text-xs mt-1">→ {awardedCard.winner}</div>
            </div>
          ) : skippedCard ? (
            <div className="rounded-xl border-2 border-gray-600 bg-gray-800/50 p-4 text-center">
              <div className="text-2xl mb-1">⏭️</div>
              <div className="text-gray-400 text-sm">Saltata</div>
              <div className="text-white text-xs mt-1">{skippedCard.name}</div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-gray-700 bg-gray-800/30 p-6 text-center text-gray-500">
              <div className="text-2xl mb-2">⏳</div>
              <div className="text-xs">Prossima carta...</div>
            </div>
          )}

          {/* My stats */}
          <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
            <div className="text-xs font-bold text-white/60 mb-1">I tuoi crediti</div>
            <div className="text-xl font-bold text-yellow-300">{myCredits}</div>
            <div className="text-xs font-bold text-white/60 mt-2 mb-1">Il tuo mazzo</div>
            <div className="flex gap-1 text-[10px]">
              <span className="bg-red-700/50 px-1.5 py-0.5 rounded">P: {myProgress.personaggi}/33</span>
              <span className="bg-blue-700/50 px-1.5 py-0.5 rounded">M: {myProgress.mosse}/33</span>
              <span className="bg-green-700/50 px-1.5 py-0.5 rounded">B: {myProgress.bonus}/33</span>
            </div>
          </div>
        </div>

        {/* Center: Bidding area */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Countdown */}
          <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-white/70">Timer</span>
              <span className={`text-2xl font-bold tabular-nums ${countdown <= 3 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                {countdown}s
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${countdownColor}`}
                style={{ width: `${countdownPct}%` }}
              />
            </div>
          </div>

          {/* Current bid */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <div className="text-xs text-white/50 mb-1">Offerta attuale</div>
            <div className="text-4xl font-bold text-yellow-300 tabular-nums">
              {currentBid > 0 ? currentBid : '—'}
            </div>
            {currentBidder && (
              <div className="text-sm text-white/70 mt-1">
                <span className={currentBidder === playerName ? 'text-green-400 font-bold' : ''}>{currentBidder}</span>
              </div>
            )}
          </div>

          {/* Bid controls */}
          <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
            <div className="text-xs text-white/50 mb-2">Fai un'offerta</div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[5, 10, 25, 50].map(inc => (
                <Button
                  key={inc}
                  size="sm"
                  variant="outline"
                  className={`text-xs border-gray-600 ${!canBid || myCredits < currentBid + inc ? 'opacity-40' : 'hover:bg-yellow-700/30 hover:border-yellow-500'}`}
                  disabled={!canBid || myCredits < currentBid + inc}
                  onClick={() => placeBid(currentBid + inc)}
                >
                  +{inc}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Importo"
                value={customBid}
                onChange={e => setCustomBid(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCustomBid()}
                className="bg-gray-700 border-gray-600 text-white text-sm h-8 flex-1"
                min={currentBid + 1}
                max={myCredits}
              />
              <Button
                size="sm"
                className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-3"
                disabled={!canBid || !customBid || parseInt(customBid) <= currentBid || parseInt(customBid) > myCredits}
                onClick={handleCustomBid}
              >
                Offri
              </Button>
            </div>
            {currentBidder === playerName && (
              <div className="mt-2 text-xs text-green-400 text-center font-bold">Sei il miglior offerente!</div>
            )}
          </div>

          {/* Creator controls */}
          {isCreator && (
            <div className="bg-gray-800 rounded-xl p-3 border border-amber-800/50">
              <div className="text-xs text-amber-400/70 font-bold mb-2">Controlli creatore</div>
              <div className="flex gap-2 mb-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-600 text-white text-xs hover:bg-gray-700"
                  onClick={handleSkip}
                >
                  Salta →
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Cerca carta..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="bg-gray-700 border-gray-600 text-white text-sm h-8 flex-1"
                />
                <Button
                  size="sm"
                  className="bg-amber-700 hover:bg-amber-600 text-white px-3 text-xs"
                  onClick={handleSearch}
                >
                  Cerca
                </Button>
              </div>
            </div>
          )}

          {/* Recent awarded */}
          {recentAwarded.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 flex-1 min-h-0 overflow-y-auto">
              <div className="text-xs text-white/50 mb-2">Ultime aggiudicate</div>
              <div className="space-y-1">
                {recentAwarded.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`capitalize text-[10px] px-1 py-0.5 rounded border ${RARITY_COLORS[item.card.rarity]}`}>
                      {item.card.rarity[0].toUpperCase()}
                    </span>
                    <span className="text-white/80 flex-1 truncate">{item.card.name}</span>
                    <span className="text-green-300 font-bold">{item.winner}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: All participants */}
        <div className="w-52 flex-shrink-0 flex flex-col gap-2">
          <div className="text-xs font-bold text-white/50 uppercase tracking-widest">Partecipanti</div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {participants.map(name => {
              const prog = deckProgress[name] ?? { personaggi: 0, mosse: 0, bonus: 0 };
              const cr = credits[name] ?? 500;
              const isMe = name === playerName;
              const isBidding = name === currentBidder;
              return (
                <div
                  key={name}
                  className={`rounded-lg p-2 border text-xs ${isBidding ? 'border-yellow-500 bg-yellow-900/20' : isMe ? 'border-blue-500 bg-blue-900/10' : 'border-gray-700 bg-gray-800'}`}
                >
                  <div className="flex items-center gap-1 mb-1">
                    {isBidding && <span className="text-yellow-400">🔨</span>}
                    <span className={`font-bold truncate ${isMe ? 'text-blue-300' : 'text-white'}`}>
                      {name}{name.startsWith('CPU') ? ' 🤖' : ''}
                    </span>
                    <span className="ml-auto text-yellow-300 font-bold">{cr}</span>
                  </div>
                  <div className="flex gap-1 text-[9px]">
                    <span className={`px-1 rounded ${prog.personaggi >= 33 ? 'bg-green-700' : 'bg-red-900/50'}`}>P:{prog.personaggi}</span>
                    <span className={`px-1 rounded ${prog.mosse >= 33 ? 'bg-green-700' : 'bg-blue-900/50'}`}>M:{prog.mosse}</span>
                    <span className={`px-1 rounded ${prog.bonus >= 33 ? 'bg-green-700' : 'bg-green-900/50'}`}>B:{prog.bonus}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
