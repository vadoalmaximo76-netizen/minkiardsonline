import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './ui/button';

interface AuctionOverlayProps {
  auctionData: {
    auctionId: string;
    cardName: string;
    cardImage: string;
    cardPti: number;
    cardStars: number;
    initiator: string;
    playerRankiards: Record<string, number>;
    currentBid: number;
    currentBidder: string | null;
    countdown: number;
  };
  currentPlayerName: string;
  onPlaceBid: (amount: number) => void;
  onClose: () => void;
  bidUpdates: { bidder: string; amount: number; countdown: number } | null;
  countdownUpdate: { remaining: number; currentBid: number; currentBidder: string | null } | null;
  auctionResult: { winner: string | null; bid: number; cardName: string; cardImage: string; message: string } | null;
}

const AuctionOverlay: React.FC<AuctionOverlayProps> = ({
  auctionData,
  currentPlayerName,
  onPlaceBid,
  onClose,
  bidUpdates,
  countdownUpdate,
  auctionResult
}) => {
  const [currentBid, setCurrentBid] = useState(auctionData.currentBid);
  const [currentBidder, setCurrentBidder] = useState<string | null>(auctionData.currentBidder);
  const [countdown, setCountdown] = useState(auctionData.countdown);
  const [bidInput, setBidInput] = useState('');
  const [bidHistory, setBidHistory] = useState<Array<{ bidder: string; amount: number; timestamp: number }>>([]);
  const [showGavel, setShowGavel] = useState(false);
  const [gavelPhase, setGavelPhase] = useState(0);
  const [ended, setEnded] = useState(false);
  const [myRankiard, setMyRankiard] = useState(auctionData.playerRankiards[currentPlayerName] || 0);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bidUpdates) {
      setCurrentBid(bidUpdates.amount);
      setCurrentBidder(bidUpdates.bidder);
      setCountdown(bidUpdates.countdown);
      setBidHistory(prev => [...prev, {
        bidder: bidUpdates.bidder,
        amount: bidUpdates.amount,
        timestamp: Date.now()
      }]);
    }
  }, [bidUpdates]);

  useEffect(() => {
    if (countdownUpdate) {
      setCountdown(countdownUpdate.remaining);
      if (countdownUpdate.currentBid) setCurrentBid(countdownUpdate.currentBid);
      if (countdownUpdate.currentBidder) setCurrentBidder(countdownUpdate.currentBidder);
    }
  }, [countdownUpdate]);

  useEffect(() => {
    if (auctionResult) {
      setEnded(true);
      if (auctionResult.winner) {
        setShowGavel(true);
        setGavelPhase(1);
        setTimeout(() => setGavelPhase(2), 400);
        setTimeout(() => setGavelPhase(3), 800);
        setTimeout(() => setGavelPhase(0), 1500);
      }
      setTimeout(() => onClose(), 5000);
    }
  }, [auctionResult, onClose]);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [bidHistory]);

  const handleBid = useCallback(() => {
    const amount = parseInt(bidInput);
    if (isNaN(amount) || amount <= currentBid) return;
    if (amount > myRankiard) return;
    onPlaceBid(amount);
    setBidInput('');
  }, [bidInput, currentBid, myRankiard, onPlaceBid]);

  const handleQuickBid = useCallback((increment: number) => {
    const newBid = currentBid + increment;
    if (newBid > myRankiard) return;
    onPlaceBid(newBid);
  }, [currentBid, myRankiard, onPlaceBid]);

  const countdownColor = countdown <= 1 ? 'text-red-500' : countdown <= 2 ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="relative w-full max-w-2xl mx-2 sm:mx-4 my-2">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-900/40 to-amber-950/60 rounded-2xl blur-xl" />
        
        <div className="relative bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-500/50 rounded-2xl p-3 sm:p-6 shadow-2xl max-h-[95vh] overflow-y-auto">
          <div className="text-center mb-2 sm:mb-4">
            <h2 className="text-xl sm:text-3xl font-black text-amber-400 tracking-wider" style={{ textShadow: '0 0 20px rgba(245,158,11,0.5)' }}>
              ASTA
            </h2>
            <p className="text-amber-200/70 text-xs sm:text-sm mt-1">Giocata da {auctionData.initiator}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 items-center sm:items-start">
            <div className="flex-shrink-0 text-center">
              <div className="relative inline-block">
                <div className="absolute -inset-2 bg-amber-500/20 rounded-xl blur-md animate-pulse" />
                <img
                  src={auctionData.cardImage}
                  alt={auctionData.cardName}
                  className="relative w-24 h-32 sm:w-40 sm:h-56 object-cover rounded-lg border-2 border-amber-400/50 shadow-lg"
                />
              </div>
              <h3 className="text-white font-bold text-sm sm:text-lg mt-2 sm:mt-3">{auctionData.cardName}</h3>
              <div className="flex gap-3 justify-center mt-1">
                <span className="text-cyan-400 text-xs sm:text-sm font-bold">PTI: {auctionData.cardPti}</span>
                <span className="text-yellow-400 text-xs sm:text-sm font-bold">Stelle: {auctionData.cardStars}</span>
              </div>
            </div>

            <div className="flex-1 w-full flex flex-col gap-2 sm:gap-3">
              <div className="bg-black/40 rounded-xl p-3 sm:p-4 border border-amber-500/30">
                <div className="flex sm:flex-col items-center sm:items-center justify-between sm:justify-center gap-2">
                  <div className="text-center">
                    <p className="text-amber-200/60 text-[10px] sm:text-xs uppercase tracking-wider">Offerta attuale</p>
                    <p className="text-2xl sm:text-4xl font-black text-amber-400" style={{ textShadow: '0 0 15px rgba(245,158,11,0.4)' }}>
                      {currentBid > 0 ? currentBid : '—'}
                    </p>
                    {currentBidder && (
                      <p className="text-white/80 text-xs sm:text-sm">
                        di <span className="text-amber-300 font-bold">{currentBidder}</span>
                      </p>
                    )}
                  </div>

                  {currentBid > 0 && !ended && (
                    <div className="text-center">
                      <p className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wider">Aggiudicazione tra</p>
                      <p className={`text-3xl sm:text-5xl font-black ${countdownColor} transition-all`} style={{ textShadow: '0 0 20px currentColor' }}>
                        {countdown}
                      </p>
                    </div>
                  )}
                </div>

                {currentBid === 0 && !ended && (
                  <p className="text-amber-200/50 text-center text-xs sm:text-sm mt-2 animate-pulse">In attesa di offerte...</p>
                )}
              </div>

              <div ref={historyRef} className="bg-black/30 rounded-lg p-2 max-h-20 sm:max-h-24 overflow-y-auto border border-white/10">
                {bidHistory.length === 0 ? (
                  <p className="text-white/30 text-xs text-center py-1 sm:py-2">Nessuna offerta ancora</p>
                ) : (
                  bidHistory.map((bid, i) => (
                    <div key={i} className="flex justify-between items-center py-0.5 sm:py-1 px-2 text-xs border-b border-white/5 last:border-0">
                      <span className={`font-medium ${bid.bidder === currentPlayerName ? 'text-green-400' : 'text-white/70'}`}>
                        {bid.bidder}
                      </span>
                      <span className="text-amber-400 font-bold">{bid.amount} PR</span>
                    </div>
                  ))
                )}
              </div>

              {!ended && (
                <div className="bg-black/30 rounded-xl p-2 sm:p-3 border border-white/10">
                  <div className="flex items-center gap-2 mb-1 sm:mb-2">
                    <p className="text-white/50 text-xs">I tuoi punti: <span className="text-amber-400 font-bold">{myRankiard} PR</span></p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={bidInput}
                      onChange={(e) => setBidInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleBid()}
                      placeholder={`Min: ${currentBid + 1}`}
                      className="flex-1 min-w-0 bg-black/50 border border-amber-500/30 rounded-lg px-2 sm:px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400"
                      min={currentBid + 1}
                      max={myRankiard}
                    />
                    <Button
                      onClick={handleBid}
                      disabled={!bidInput || parseInt(bidInput) <= currentBid || parseInt(bidInput) > myRankiard}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 sm:px-4 py-2 disabled:opacity-40 whitespace-nowrap"
                    >
                      OFFRI
                    </Button>
                  </div>
                  <div className="flex gap-1 mt-1 sm:mt-2">
                    {[1, 3, 5, 10].map(inc => (
                      <Button
                        key={inc}
                        onClick={() => handleQuickBid(inc)}
                        disabled={currentBid + inc > myRankiard}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-amber-300 text-xs py-1 disabled:opacity-30"
                        size="sm"
                      >
                        +{inc}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {ended && auctionResult && (
                <div className="bg-black/50 rounded-xl p-3 sm:p-4 border border-amber-500/40 text-center">
                  {auctionResult.winner ? (
                    <>
                      <div className="relative inline-block">
                        {showGavel && (
                          <div className={`text-4xl sm:text-6xl transition-all duration-300 ${
                            gavelPhase === 1 ? 'rotate-[-30deg] scale-110' : 
                            gavelPhase === 2 ? 'rotate-[10deg] scale-125' : 
                            gavelPhase === 3 ? 'rotate-0 scale-100' : ''
                          }`}>
                            🔨
                          </div>
                        )}
                      </div>
                      <p className="text-xl sm:text-2xl font-black text-amber-400 mt-2">AGGIUDICATO!</p>
                      <p className="text-white text-sm sm:text-base mt-1">
                        <span className="text-amber-300 font-bold">{auctionResult.winner}</span> vince per{' '}
                        <span className="text-amber-400 font-bold">{auctionResult.bid} PR</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl sm:text-2xl text-white/60">Asta deserta</p>
                      <p className="text-white/40 text-xs sm:text-sm mt-1">{auctionResult.message}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuctionOverlay;
