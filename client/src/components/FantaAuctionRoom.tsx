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

const RARITY_BORDER: Record<FantaRarity, string> = {
  comune: 'border-gray-500',
  rara: 'border-blue-400',
  epica: 'border-purple-400',
  leggendaria: 'border-yellow-400',
};

const RARITY_LABEL_COLOR: Record<FantaRarity, string> = {
  comune: 'bg-gray-600 text-gray-200',
  rara: 'bg-blue-700 text-blue-100',
  epica: 'bg-purple-700 text-purple-100',
  leggendaria: 'bg-yellow-600 text-yellow-100',
};

const RARITY_GLOW: Record<FantaRarity, string> = {
  comune: '',
  rara: 'shadow-[0_0_18px_rgba(59,130,246,0.5)]',
  epica: 'shadow-[0_0_22px_rgba(168,85,247,0.6)]',
  leggendaria: 'shadow-[0_0_28px_rgba(234,179,8,0.7)]',
};

const TYPE_LABEL: Record<string, string> = {
  personaggi: 'PERSONAGGIO',
  mosse: 'MOSSA',
  bonus: 'BONUS',
};

const TYPE_BG: Record<string, string> = {
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
  const [recentAwarded, setRecentAwarded] = useState<Array<{ card: FantaCard; winner: string; amount: number }>>([]);
  const [customBid, setCustomBid] = useState('');
  const [awardedCard, setAwardedCard] = useState<{ card: FantaCard; winner: string } | null>(null);
  const [skippedCard, setSkippedCard] = useState<FantaCard | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showParticipants, setShowParticipants] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const myCredits = credits[playerName] ?? 500;
  const myProgress = deckProgress[playerName] ?? { personaggi: 0, mosse: 0, bonus: 0 };

  useEffect(() => {
    socket.on('fanta:card-up', (data: { card: FantaCard; timer: number; deckProgress: Record<string, DeckProgress>; credits: Record<string, number> }) => {
      setCurrentCard(data.card);
      setCurrentBid(0);
      setCurrentBidder(null);
      setCountdown(data.timer ?? 15);
      setDeckProgress(data.deckProgress ?? {});
      setCredits(data.credits ?? {});
      setAwardedCard(null);
      setSkippedCard(null);
      setCustomBid('');
    });

    socket.on('fanta:bid-update', (data: { bidder: string; amount: number; countdown: number; credits: Record<string, number> }) => {
      setCurrentBid(data.amount);
      setCurrentBidder(data.bidder);
      setCountdown(data.countdown);
      setCredits(data.credits ?? {});
    });

    socket.on('fanta:countdown', (data: { seconds: number }) => {
      setCountdown(data.seconds);
    });

    socket.on('fanta:card-awarded', (data: { winner: string; card: FantaCard; amount: number; creditsRemaining: number; deckProgress: Record<string, DeckProgress>; credits: Record<string, number> }) => {
      setAwardedCard({ card: data.card, winner: data.winner });
      setDeckProgress(data.deckProgress ?? {});
      setCredits(data.credits ?? {});
      setRecentAwarded(prev => [{ card: data.card, winner: data.winner, amount: data.amount }, ...prev].slice(0, 15));
      setCurrentCard(null);
    });

    socket.on('fanta:card-skipped', (data: { card: FantaCard; reason?: string }) => {
      setSkippedCard(data.card);
      setCurrentCard(null);
    });

    socket.on('fanta:deck-progress', (data: { progress: Record<string, DeckProgress> }) => {
      setDeckProgress(data.progress ?? {});
    });

    socket.on('fanta:auction-complete', () => {
      onComplete();
    });

    socket.on('fanta:error', (data: { message: string }) => {
      setErrorMsg(data.message);
      setTimeout(() => setErrorMsg(''), 4000);
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
  const countdownColor = countdown <= 3 ? 'bg-red-500' : countdown <= 6 ? 'bg-orange-400' : 'bg-emerald-500';
  const timerTextColor = countdown <= 3 ? 'text-red-400' : countdown <= 6 ? 'text-orange-400' : 'text-white';

  const canBid = !!(currentCard &&
    myCredits > currentBid &&
    (myProgress[currentCard.type] ?? 0) < 33 &&
    currentBidder !== playerName);

  const quickBids = [1, 5, 10];

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-y-auto">

      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="bg-red-800 border-b border-red-500 text-red-100 px-4 py-2 text-sm text-center font-medium z-50">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* TIMER BAR */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white/50 font-semibold uppercase tracking-wider">Timer</span>
          <span className={`text-2xl font-black tabular-nums ${timerTextColor} ${countdown <= 3 ? 'animate-pulse' : ''}`}>
            {countdown}s
          </span>
        </div>
        <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${countdownColor}`}
            style={{ width: `${countdownPct}%` }}
          />
        </div>
      </div>

      {/* MAIN CONTENT: card + bid side by side */}
      <div className="flex gap-3 px-4 py-3">

        {/* CARD */}
        <div className="w-36 flex-shrink-0" ref={cardRef}>
          {currentCard ? (
            <div className={`relative rounded-xl border-2 overflow-hidden ${RARITY_BORDER[currentCard.rarity] ?? 'border-gray-600'} ${RARITY_GLOW[currentCard.rarity] ?? ''}`}>
              <img
                src={currentCard.frontImage}
                alt={currentCard.name}
                className="w-full aspect-[2/3] object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-card.png'; }}
              />
              <div className="absolute top-1.5 left-1.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${TYPE_BG[currentCard.type] ?? 'bg-gray-700'}`}>
                  {TYPE_LABEL[currentCard.type]}
                </span>
              </div>
              <div className={`absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded capitalize ${RARITY_LABEL_COLOR[currentCard.rarity] ?? 'bg-gray-700 text-white'}`}>
                {currentCard.rarity}
              </div>
              <div className="px-1.5 py-1 bg-black/80">
                <div className="text-[11px] font-bold text-white leading-tight truncate">{currentCard.name}</div>
              </div>
            </div>
          ) : awardedCard ? (
            <div className="rounded-xl border-2 border-yellow-500 bg-yellow-900/30 p-3 text-center aspect-[2/3] flex flex-col items-center justify-center">
              <div className="text-3xl mb-1">🔨</div>
              <div className="text-yellow-300 font-bold text-xs">AGGIUDICATO</div>
              <div className="text-white text-[10px] mt-1 leading-tight">{awardedCard.card.name}</div>
              <div className="text-green-300 text-[10px] font-bold mt-1">→ {awardedCard.winner}</div>
            </div>
          ) : skippedCard ? (
            <div className="rounded-xl border-2 border-gray-600 bg-gray-800/50 p-3 text-center aspect-[2/3] flex flex-col items-center justify-center">
              <div className="text-2xl mb-1">⏭️</div>
              <div className="text-gray-400 text-xs font-bold">SALTATA</div>
              <div className="text-white text-[10px] mt-1 leading-tight">{skippedCard.name}</div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-gray-700 bg-gray-800/30 p-3 text-center aspect-[2/3] flex flex-col items-center justify-center">
              <div className="text-2xl mb-1">⏳</div>
              <div className="text-gray-500 text-xs">Prossima carta...</div>
            </div>
          )}
        </div>

        {/* BID AREA */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">

          {/* Current offer */}
          <div className="bg-gray-800 rounded-xl px-3 py-2.5 border border-gray-700 text-center">
            <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold mb-0.5">Offerta attuale</div>
            <div className={`text-3xl font-black tabular-nums ${currentBid > 0 ? 'text-yellow-300' : 'text-gray-500'}`}>
              {currentBid > 0 ? currentBid : '—'}
            </div>
            {currentBidder ? (
              <div className={`text-xs font-bold mt-0.5 truncate ${currentBidder === playerName ? 'text-green-400' : 'text-white/70'}`}>
                {currentBidder === playerName ? '✅ Sei il migliore!' : `🔨 ${currentBidder}`}
              </div>
            ) : (
              <div className="text-xs text-white/30 mt-0.5">Nessuna offerta</div>
            )}
          </div>

          {/* My credits */}
          <div className="bg-gray-800 rounded-lg px-3 py-2 border border-gray-700 flex items-center justify-between">
            <span className="text-xs text-white/50">I tuoi crediti</span>
            <span className="text-lg font-black text-yellow-300 tabular-nums">{myCredits}</span>
          </div>

          {/* My deck */}
          <div className="bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Tuo mazzo</div>
            <div className="flex gap-1.5 text-[10px] font-bold">
              <span className={`px-2 py-0.5 rounded ${myProgress.personaggi >= 33 ? 'bg-green-600' : 'bg-red-800/70'} text-white`}>
                P {myProgress.personaggi}/33
              </span>
              <span className={`px-2 py-0.5 rounded ${myProgress.mosse >= 33 ? 'bg-green-600' : 'bg-blue-800/70'} text-white`}>
                M {myProgress.mosse}/33
              </span>
              <span className={`px-2 py-0.5 rounded ${myProgress.bonus >= 33 ? 'bg-green-600' : 'bg-emerald-900/70'} text-white`}>
                B {myProgress.bonus}/33
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* BID BUTTONS */}
      <div className="px-4 pb-3">
        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
          <div className="text-xs text-white/50 font-semibold mb-2">Fai un'offerta</div>
          <div className="grid grid-cols-3 gap-3 mb-2.5">
            {quickBids.map(inc => {
              const bidAmount = currentBid + inc;
              const disabled = !canBid || myCredits < bidAmount;
              return (
                <button
                  key={inc}
                  disabled={disabled}
                  onClick={() => placeBid(bidAmount)}
                  className={`rounded-lg py-2.5 text-sm font-black transition-all border-2 ${
                    disabled
                      ? 'border-gray-700 bg-gray-800 text-gray-600 cursor-not-allowed'
                      : 'border-yellow-500 bg-yellow-600/20 text-yellow-300 hover:bg-yellow-600/40 active:scale-95'
                  }`}
                >
                  +{inc}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={`Offri (min ${currentBid + 1})`}
              value={customBid}
              onChange={e => setCustomBid(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustomBid()}
              className="bg-gray-700 border-gray-600 text-white text-sm h-10 flex-1"
              min={currentBid + 1}
              max={myCredits}
            />
            <Button
              className={`h-10 px-4 font-black text-sm transition-all ${
                canBid && customBid && parseInt(customBid) > currentBid && parseInt(customBid) <= myCredits
                  ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
              disabled={!canBid || !customBid || parseInt(customBid) <= currentBid || parseInt(customBid) > myCredits}
              onClick={handleCustomBid}
            >
              Offri
            </Button>
          </div>
        </div>
      </div>

      {/* CREATOR CONTROLS */}
      {isCreator && (
        <div className="px-4 pb-3">
          <div className="bg-amber-950/40 rounded-xl p-3 border border-amber-700/50">
            <div className="text-xs text-amber-400 font-bold uppercase tracking-wider mb-2">Controlli creatore</div>
            <div className="flex gap-2 mb-2">
              <Button
                className="flex-1 h-9 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white text-sm font-semibold"
                onClick={handleSkip}
              >
                ⏭ Salta carta
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Cerca carta per nome..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="bg-gray-700 border-gray-600 text-white text-sm h-9 flex-1"
              />
              <Button
                className="h-9 px-4 bg-amber-700 hover:bg-amber-600 text-white text-sm font-bold"
                onClick={handleSearch}
              >
                Cerca
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PARTICIPANTS TOGGLE */}
      <div className="px-4 pb-2">
        <button
          onClick={() => setShowParticipants(v => !v)}
          className="w-full bg-gray-800 rounded-xl px-4 py-2.5 border border-gray-700 flex items-center justify-between text-sm font-semibold text-white"
        >
          <span>👥 Partecipanti ({participants.length})</span>
          <span className="text-gray-400">{showParticipants ? '▲' : '▼'}</span>
        </button>
        {showParticipants && (
          <div className="mt-2 space-y-2">
            {participants.map(name => {
              const prog = deckProgress[name] ?? { personaggi: 0, mosse: 0, bonus: 0 };
              const cr = credits[name] ?? 500;
              const isMe = name === playerName;
              const isBidding = name === currentBidder;
              return (
                <div
                  key={name}
                  className={`rounded-lg px-3 py-2 border text-sm flex items-center gap-3 ${
                    isBidding ? 'border-yellow-500 bg-yellow-900/20' : isMe ? 'border-blue-500 bg-blue-900/10' : 'border-gray-700 bg-gray-800'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {isBidding && <span className="text-yellow-400 text-sm">🔨</span>}
                      <span className={`font-bold text-sm truncate ${isMe ? 'text-blue-300' : 'text-white'}`}>
                        {name}{name.startsWith('CPU') ? ' 🤖' : ''}
                      </span>
                      <span className="ml-auto text-yellow-300 font-black text-sm tabular-nums">{cr}</span>
                    </div>
                    <div className="flex gap-1.5 text-[10px] font-bold">
                      <span className={`px-1.5 py-0.5 rounded ${prog.personaggi >= 33 ? 'bg-green-600' : 'bg-red-900/60'} text-white`}>P:{prog.personaggi}</span>
                      <span className={`px-1.5 py-0.5 rounded ${prog.mosse >= 33 ? 'bg-green-600' : 'bg-blue-900/60'} text-white`}>M:{prog.mosse}</span>
                      <span className={`px-1.5 py-0.5 rounded ${prog.bonus >= 33 ? 'bg-green-600' : 'bg-emerald-900/60'} text-white`}>B:{prog.bonus}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* HISTORY TOGGLE */}
      {recentAwarded.length > 0 && (
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="w-full bg-gray-800 rounded-xl px-4 py-2.5 border border-gray-700 flex items-center justify-between text-sm font-semibold text-white"
          >
            <span>📋 Ultime aggiudicate ({recentAwarded.length})</span>
            <span className="text-gray-400">{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1.5">
              {recentAwarded.map((item, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700 text-sm">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded capitalize ${RARITY_LABEL_COLOR[item.card.rarity] ?? 'bg-gray-700 text-white'}`}>
                    {(item.card.rarity ?? 'c')[0].toUpperCase()}
                  </span>
                  <span className="text-white flex-1 truncate font-medium">{item.card.name}</span>
                  <span className="text-yellow-300 font-bold tabular-nums">{item.amount}</span>
                  <span className="text-green-300 font-bold">→ {item.winner}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
