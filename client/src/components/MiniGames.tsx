import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CARD_DATA } from '../lib/cardData';

/* ─── Types ──────────────────────────────────────────────────── */
export interface SessionResult {
  gameId: string;
  sessionToken: string;
  result: Record<string, unknown>;
}

interface MiniGameProps {
  gameId: string;
  gameName: string;
  sessionToken: string;
  onClose: () => void;
  onComplete: (result: SessionResult) => void;
  userPR: number;
  // For server-driven games
  serverData?: Record<string, unknown>;
}

/* ─── Utility ───────────────────────────────────────────────── */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ─── Modal wrapper ─────────────────────────────────────────── */
function ModalWrapper({ title, color, onClose, children }: {
  title: string; color: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 16,
    }}>
      <div style={{
        background: 'rgba(6,8,30,0.98)', borderRadius: 20,
        border: `2px solid ${color}`,
        boxShadow: `0 0 60px ${color}44`,
        width: '100%', maxWidth: 480, maxHeight: '90vh',
        overflow: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${color}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color, fontWeight: 900, fontSize: 16 }}>{title}</span>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 13,
            padding: '4px 10px', cursor: 'pointer',
          }}>✕</button>
        </div>
        <div style={{ padding: 20, flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

/* ─── 1. Ruota della Fortuna ─────────────────────────────────
   Server provides wheelSectorIdx. We just animate to that sector.          */
export const WHEEL_SECTORS = [
  { label: '×0',   mult: 0,   color: '#ef4444' },
  { label: '×0.5', mult: 0.5, color: '#f97316' },
  { label: '×1.5', mult: 1.5, color: '#eab308' },
  { label: '×2',   mult: 2,   color: '#22c55e' },
  { label: '×3',   mult: 3,   color: '#3b82f6' },
  { label: '×5',   mult: 5,   color: '#a855f7' },
  { label: '×0',   mult: 0,   color: '#ef4444' },
  { label: '×1.5', mult: 1.5, color: '#eab308' },
];

export function RuotaDellaFortuna({ gameId, gameName, sessionToken, onClose, onComplete, userPR, serverData }: MiniGameProps) {
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<{ sectorIdx: number; mult: number; label: string } | null>(null);
  const [phase, setPhase] = useState<'bet' | 'spin' | 'result'>('bet');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const maxBet = Math.min(100, Math.max(5, userPR));
  const serverSectorIdx = Number(serverData?.wheelSectorIdx ?? 0);

  const drawWheel = useCallback((rot: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cx = canvas.width / 2, cy = canvas.height / 2, r = Math.min(cx, cy) - 10;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const n = WHEEL_SECTORS.length;
    const sliceAngle = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
      const start = rot + i * sliceAngle - Math.PI / 2;
      const end = start + sliceAngle;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, end); ctx.closePath();
      ctx.fillStyle = WHEEL_SECTORS[i].color; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(start + sliceAngle / 2);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(WHEEL_SECTORS[i].label, r - 8, 4); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1b4b'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GO', cx, cy);
    ctx.beginPath(); ctx.moveTo(cx + r - 5, cy - 10); ctx.lineTo(cx + r - 5, cy + 10); ctx.lineTo(cx + r + 16, cy);
    ctx.closePath(); ctx.fillStyle = '#fbbf24'; ctx.fill();
  }, []);

  useEffect(() => { drawWheel(0); }, [drawWheel]);

  const spin = () => {
    if (bet < 5 || bet > maxBet || spinning) return;
    const sectorAngle = (Math.PI * 2 / WHEEL_SECTORS.length) * serverSectorIdx;
    const extra = Math.PI * 2 * (8 + Math.random() * 8);
    const target = extra + sectorAngle;
    const startTime = performance.now();
    const duration = 4000 + Math.random() * 1500;
    let startRot = 0;
    setSpinning(true); setPhase('spin');
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const currentRot = startRot + (target - startRot) * eased;
      drawWheel(currentRot);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        const sector = WHEEL_SECTORS[serverSectorIdx % WHEEL_SECTORS.length];
        setResult({ sectorIdx: serverSectorIdx, mult: sector.mult, label: sector.label });
        setPhase('result');
        setSpinning(false);
        onComplete({ gameId, sessionToken, result: { bet } });
      }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);

  return (
    <ModalWrapper title={`🎡 ${gameName}`} color="#a855f7" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <canvas ref={canvasRef} width={240} height={240} style={{ borderRadius: '50%', border: '3px solid rgba(168,85,247,0.5)' }} />
        {phase === 'bet' && (
          <>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' }}>
              Scommetti da 5 a {maxBet} PR.<br />
              <span style={{ color: '#a855f7' }}>Moltiplicatori: ×0, ×0.5, ×1.5, ×2, ×3, ×5</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setBet(Math.max(5, bet - 5))} style={btnStyle('#4b5563')}>-5</button>
              <span style={{ color: '#fbbf24', fontWeight: 900, fontSize: 22, minWidth: 60, textAlign: 'center' }}>{bet} PR</span>
              <button onClick={() => setBet(Math.min(maxBet, bet + 5))} style={btnStyle('#4b5563')}>+5</button>
            </div>
            <button onClick={spin} style={btnStyle('#a855f7', true)}>🎡 Gira!</button>
          </>
        )}
        {phase === 'spin' && <div style={{ color: '#a855f7', fontWeight: 800, fontSize: 16 }}>La ruota gira…</div>}
        {phase === 'result' && result && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{result.mult === 0 ? '😢' : result.mult >= 3 ? '🎉' : '😊'}</div>
            <div style={{ color: '#a855f7', fontWeight: 900, fontSize: 24, marginBottom: 4 }}>{result.label}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Risultato inviato al server…</div>
            <button onClick={onClose} style={{ ...btnStyle('#a855f7', true), marginTop: 14 }}>Chiudi</button>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
}

/* ─── 2. Memory delle Carte ─────────────────────────────────── */
export function MemoryGame({ gameId, gameName, sessionToken, onClose, onComplete }: MiniGameProps) {
  const PAIRS = 8;
  const [cards, setCards] = useState<{ id: number; img: string; flipped: boolean; matched: boolean }[]>(() => {
    const picked = shuffle(CARD_DATA.personaggi.slice(0, 40)).slice(0, PAIRS);
    return shuffle([...picked, ...picked].map((img, id) => ({ id, img, flipped: false, matched: false })));
  });
  const [selected, setSelected] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [phase, setPhase] = useState<'playing' | 'won' | 'lost'>('playing');
  const [moves, setMoves] = useState(0);
  const checking = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const timeLeftRef = useRef(60);

  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        timeLeftRef.current = t - 1;
        if (t <= 1) { setPhase('lost'); clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const matchedCount = cards.filter(c => c.matched).length;

  useEffect(() => {
    if (matchedCount === cards.length && phase === 'playing') {
      setPhase('won');
      clearInterval(timerRef.current);
      onComplete({ gameId, sessionToken, result: { pairs: PAIRS, totalPairs: PAIRS, timeLeft: timeLeftRef.current } });
    }
  }, [matchedCount, cards.length, phase, onComplete, gameId, sessionToken]);

  const flip = (idx: number) => {
    if (checking.current || phase !== 'playing') return;
    if (cards[idx].flipped || cards[idx].matched) return;
    if (selected.length === 1 && selected[0] === idx) return;
    const newCards = cards.map((c, i) => i === idx ? { ...c, flipped: true } : c);
    const newSel = [...selected, idx];
    setCards(newCards); setSelected(newSel); setMoves(m => m + 1);
    if (newSel.length === 2) {
      checking.current = true;
      const [a, b] = newSel;
      setTimeout(() => {
        if (newCards[a].img === newCards[b].img) {
          setCards(prev => prev.map((c, i) => (i === a || i === b) ? { ...c, matched: true } : c));
        } else {
          setCards(prev => prev.map((c, i) => (i === a || i === b) ? { ...c, flipped: false } : c));
        }
        setSelected([]); checking.current = false;
      }, 800);
    }
  };

  return (
    <ModalWrapper title={`🃏 ${gameName}`} color="#818cf8" onClose={onClose}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ color: '#818cf8', fontWeight: 700 }}>⏱ {timeLeft}s</span>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>🃏 {matchedCount / 2}/{PAIRS}</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Mosse: {moves}</span>
        </div>
        {phase === 'playing' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {cards.map((c, i) => (
              <div key={c.id} onClick={() => flip(i)} style={{
                width: '100%', paddingBottom: '140%', position: 'relative',
                cursor: c.matched || c.flipped ? 'default' : 'pointer', borderRadius: 8, overflow: 'hidden',
                border: c.matched ? '2px solid #4ade80' : c.flipped ? '2px solid #818cf8' : '2px solid rgba(255,255,255,0.15)',
                transform: c.flipped || c.matched ? 'rotateY(0deg)' : 'rotateY(180deg)',
              }}>
                <div style={{ position: 'absolute', inset: 0 }}>
                  {c.flipped || c.matched ? (
                    <img src={c.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#312e81,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🃏</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {phase === 'won' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48 }}>🎉</div>
            <div style={{ color: '#4ade80', fontWeight: 900, fontSize: 22, margin: '10px 0' }}>Hai vinto!</div>
            <button onClick={onClose} style={{ ...btnStyle('#4ade80', true), marginTop: 16 }}>Chiudi</button>
          </div>
        )}
        {phase === 'lost' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48 }}>⏰</div>
            <div style={{ color: '#ef4444', fontWeight: 900, fontSize: 22, margin: '10px 0' }}>Tempo scaduto!</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{matchedCount / 2}/{PAIRS} coppie</div>
            <button onClick={() => onComplete({ gameId, sessionToken, result: { pairs: matchedCount / 2, totalPairs: PAIRS, timeLeft: 0 } })} style={{ ...btnStyle('#ef4444', true), marginTop: 16 }}>Chiudi</button>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
}

/* ─── 3. Sfida al Dado ────────────────────────────────────────
   Server provides playerDice and cpuDice. Client just animates.            */
const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function SfidaAlDado({ gameId, gameName, sessionToken, onClose, onComplete, userPR, serverData }: MiniGameProps) {
  const [bet, setBet] = useState(10);
  const [phase, setPhase] = useState<'bet' | 'rolling' | 'result'>('bet');
  const [displayPlayer, setDisplayPlayer] = useState([1, 1, 1]);
  const [displayCpu, setDisplayCpu] = useState([1, 1, 1]);
  const [outcome, setOutcome] = useState<'win' | 'lose' | 'draw' | null>(null);
  const maxBet = Math.min(userPR, 200);

  const finalPlayerDice: number[] = Array.isArray(serverData?.playerDice) ? (serverData.playerDice as number[]) : [1, 1, 1];
  const finalCpuDice: number[] = Array.isArray(serverData?.cpuDice) ? (serverData.cpuDice as number[]) : [1, 1, 1];

  const roll = () => {
    if (bet < 5 || bet > maxBet) return;
    setPhase('rolling');
    let count = 0;
    const iv = setInterval(() => {
      setDisplayPlayer([1, 2, 3].map(() => Math.ceil(Math.random() * 6)));
      setDisplayCpu([1, 2, 3].map(() => Math.ceil(Math.random() * 6)));
      count++;
      if (count >= 20) {
        clearInterval(iv);
        setDisplayPlayer(finalPlayerDice);
        setDisplayCpu(finalCpuDice);
        const ps = finalPlayerDice.reduce((a, b) => a + b, 0);
        const cs = finalCpuDice.reduce((a, b) => a + b, 0);
        setOutcome(ps > cs ? 'win' : ps < cs ? 'lose' : 'draw');
        setPhase('result');
        onComplete({ gameId, sessionToken, result: { bet } });
      }
    }, 80);
  };

  return (
    <ModalWrapper title={`🎲 ${gameName}`} color="#f97316" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {phase === 'bet' && (
          <>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' }}>
              Tira 3 dadi contro la CPU. Chi ha il totale più alto vince la posta!
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setBet(Math.max(5, bet - 5))} style={btnStyle('#4b5563')}>-5</button>
              <span style={{ color: '#fbbf24', fontWeight: 900, fontSize: 22, minWidth: 60, textAlign: 'center' }}>{bet} PR</span>
              <button onClick={() => setBet(Math.min(maxBet, bet + 5))} style={btnStyle('#4b5563')}>+5</button>
            </div>
            <button onClick={roll} style={btnStyle('#f97316', true)}>🎲 Lancia!</button>
          </>
        )}
        {(phase === 'rolling' || phase === 'result') && (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#818cf8', fontWeight: 800, marginBottom: 8 }}>Tu</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {displayPlayer.map((d, i) => <span key={i} style={{ fontSize: 36 }}>{DIE_FACES[d - 1]}</span>)}
                </div>
                <div style={{ color: '#fbbf24', fontWeight: 700, marginTop: 6 }}>Totale: {displayPlayer.reduce((a, b) => a + b, 0)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#ef4444', fontWeight: 800, marginBottom: 8 }}>CPU</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {displayCpu.map((d, i) => <span key={i} style={{ fontSize: 36 }}>{DIE_FACES[d - 1]}</span>)}
                </div>
                <div style={{ color: '#fbbf24', fontWeight: 700, marginTop: 6 }}>Totale: {displayCpu.reduce((a, b) => a + b, 0)}</div>
              </div>
            </div>
            {phase === 'result' && outcome && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: outcome === 'win' ? '#4ade80' : outcome === 'lose' ? '#ef4444' : '#fbbf24', fontWeight: 900, fontSize: 24 }}>
                  {outcome === 'win' ? 'Hai vinto!' : outcome === 'lose' ? 'Hai perso!' : 'Pareggio!'}
                </div>
                <button onClick={onClose} style={{ ...btnStyle('#f97316', true), marginTop: 16 }}>Chiudi</button>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalWrapper>
  );
}

/* ─── 4. Reazione Rapida ─────────────────────────────────────── */
export function ReazioneRapida({ gameId, gameName, sessionToken, onClose, onComplete }: MiniGameProps) {
  const TOTAL = 10;
  const SHOW_MS = 1200;
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro');
  const [current, setCurrent] = useState(0);
  const [cardImg, setCardImg] = useState('');
  const [cardPos, setCardPos] = useState({ x: 50, y: 50 });
  const [visible, setVisible] = useState(false);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const cardsPool = useRef(shuffle([...CARD_DATA.personaggi, ...CARD_DATA.mosse]).slice(0, TOTAL));
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const currentRef = useRef(0);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);

  const showNext = useCallback((idx: number) => {
    if (idx >= TOTAL) {
      setPhase('done');
      onComplete({ gameId, sessionToken, result: { hits: hitsRef.current, misses: missesRef.current, total: TOTAL } });
      return;
    }
    setCurrent(idx); currentRef.current = idx;
    setCardImg(cardsPool.current[idx]);
    setCardPos({ x: 10 + Math.random() * 70, y: 10 + Math.random() * 60 });
    setVisible(true);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setMisses(m => { missesRef.current = m + 1; return m + 1; });
      timerRef.current = setTimeout(() => showNext(idx + 1), 300);
    }, SHOW_MS);
  }, [gameId, sessionToken, onComplete]);

  const start = () => {
    hitsRef.current = 0; missesRef.current = 0; currentRef.current = 0;
    setHits(0); setMisses(0); setPhase('playing');
    setTimeout(() => showNext(0), 300);
  };

  const hit = () => {
    if (!visible || phase !== 'playing') return;
    clearTimeout(timerRef.current); setVisible(false);
    setHits(h => { hitsRef.current = h + 1; return h + 1; });
    setTimeout(() => showNext(currentRef.current + 1), 300);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <ModalWrapper title={`⚡ ${gameName}`} color="#fbbf24" onClose={onClose}>
      {phase === 'intro' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
            Appariranno {TOTAL} carte per {SHOW_MS / 1000}s ciascuna.<br />
            Clicca/tocca ogni carta prima che sparisca!<br />
            <span style={{ color: '#4ade80' }}>+10 PR</span> per ogni carta colpita,{' '}
            <span style={{ color: '#ef4444' }}>-2 PR</span> per ogni mancata.
          </div>
          <button onClick={start} style={btnStyle('#fbbf24', true)}>⚡ Inizia!</button>
        </div>
      )}
      {phase === 'playing' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#4ade80', fontWeight: 700 }}>✓ {hits}</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{current + 1}/{TOTAL}</span>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>✗ {misses}</span>
          </div>
          <div style={{ position: 'relative', width: '100%', height: 280, background: 'rgba(0,0,0,0.4)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            {visible && (
              <div onClick={hit} style={{ position: 'absolute', left: `${cardPos.x}%`, top: `${cardPos.y}%`, transform: 'translate(-50%,-50%)', width: 64, height: 90, borderRadius: 8, overflow: 'hidden', border: '2px solid #fbbf24', cursor: 'pointer', boxShadow: '0 0 20px rgba(251,191,36,0.5)' }}>
                <img src={cardImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
          </div>
        </div>
      )}
      {phase === 'done' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>{hits >= 8 ? '🏆' : hits >= 5 ? '🎯' : '😅'}</div>
          <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: 22, margin: '10px 0' }}>Colpite: {hits}/{TOTAL}</div>
          <button onClick={onClose} style={{ ...btnStyle('#fbbf24', true), marginTop: 16 }}>Chiudi</button>
        </div>
      )}
    </ModalWrapper>
  );
}

/* ─── 5. Quiz del Minkiard ────────────────────────────────────
   Server provides questions (without answers). Client submits answers array. */
interface QuizQuestion {
  name: string;
  questionType: 'stars' | 'pti';
  options: string[];
}

export function QuizMinkiard({ gameId, gameName, sessionToken, onClose, onComplete, serverData }: MiniGameProps) {
  const questions: QuizQuestion[] = Array.isArray(serverData?.questions) ? (serverData.questions as QuizQuestion[]) : [];
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [phase, setPhase] = useState<'playing' | 'done'>('playing');
  const [correctCount, setCorrectCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const handleAnswer = useCallback((opt: string | null) => {
    clearInterval(timerRef.current);
    const newAnswers = [...answers, opt ?? ''];
    setAnswers(newAnswers);
    setSelected(opt);
    if (current + 1 >= questions.length) {
      setTimeout(() => {
        setPhase('done');
        onComplete({ gameId, sessionToken, result: { answers: newAnswers } });
      }, 1000);
    } else {
      setTimeout(() => {
        setCurrent(c => c + 1);
        setSelected(null);
        setTimeLeft(15);
      }, 1000);
    }
  }, [current, questions.length, answers, gameId, sessionToken, onComplete]);

  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { handleAnswer(null); return 15; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [current, phase, handleAnswer]);

  if (questions.length === 0) {
    return (
      <ModalWrapper title={`❓ ${gameName}`} color="#06b6d4" onClose={onClose}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😢</div>
          Nessuna domanda disponibile. Riprova più tardi.
        </div>
      </ModalWrapper>
    );
  }

  const q = questions[current];

  return (
    <ModalWrapper title={`❓ ${gameName}`} color="#06b6d4" onClose={onClose}>
      {phase === 'playing' && q && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#06b6d4', fontWeight: 700 }}>Domanda {current + 1}/{questions.length}</span>
            <span style={{ color: timeLeft <= 5 ? '#ef4444' : '#fbbf24', fontWeight: 800 }}>⏱ {timeLeft}s</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 800, fontSize: 15, marginBottom: 16, lineHeight: 1.4, textAlign: 'center' }}>
            {q.questionType === 'stars'
              ? `Quante stelle ⭐ ha ${q.name}?`
              : `Qual è il PTI di ${q.name}?`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {q.options.map(opt => {
              let bg = 'rgba(255,255,255,0.07)';
              let border = 'rgba(255,255,255,0.15)';
              if (selected !== null) {
                if (opt === selected) { bg = 'rgba(255,193,7,0.2)'; border = '#fbbf24'; }
              }
              return (
                <button key={opt} onClick={() => !selected && handleAnswer(opt)} style={{
                  background: bg, border: `1.5px solid ${border}`,
                  borderRadius: 10, color: 'white', fontWeight: 700, fontSize: 14,
                  padding: '12px 16px', cursor: selected ? 'default' : 'pointer', textAlign: 'left',
                }}>
                  {q.questionType === 'stars' ? '⭐'.repeat(Number(opt)) + ` (${opt})` : `${opt} PTI`}
                </button>
              );
            })}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 12, textAlign: 'center' }}>
            Le risposte vengono verificate dal server
          </div>
        </div>
      )}
      {phase === 'done' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>📊</div>
          <div style={{ color: '#06b6d4', fontWeight: 900, fontSize: 20, margin: '10px 0' }}>
            Risultato inviato al server!
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            Il punteggio viene calcolato in base alle risposte corrette.
          </div>
          <button onClick={onClose} style={{ ...btnStyle('#06b6d4', true), marginTop: 16 }}>Chiudi</button>
        </div>
      )}
    </ModalWrapper>
  );
}

/* ─── 6. Sasso Carta Forbice ──────────────────────────────────
   Server provides cpuRounds. Client sends playerChoices for validation.     */
const RPS_ICONS: Record<string, string> = { sasso: '🪨', carta: '📄', forbice: '✂️' };
const RPS_CHOICES = ['sasso', 'carta', 'forbice'] as const;
type RpsChoice = typeof RPS_CHOICES[number];

function rpsResult(p: RpsChoice, c: string): 'win' | 'lose' | 'draw' {
  if (p === c) return 'draw';
  if ((p === 'sasso' && c === 'forbice') || (p === 'carta' && c === 'sasso') || (p === 'forbice' && c === 'carta')) return 'win';
  return 'lose';
}

export function SassoCartaForbice({ gameId, gameName, sessionToken, onClose, onComplete, userPR, serverData }: MiniGameProps) {
  const [bet, setBet] = useState(10);
  const [phase, setPhase] = useState<'bet' | 'playing' | 'result'>('bet');
  const [round, setRound] = useState(0);
  const [scores, setScores] = useState({ p: 0, c: 0 });
  const [roundHistory, setRoundHistory] = useState<{ p: RpsChoice; c: string; res: 'win' | 'lose' | 'draw' }[]>([]);
  const [playerChoices, setPlayerChoices] = useState<string[]>([]);
  const [counting, setCounting] = useState(false);
  const [countNum, setCountNum] = useState(3);
  const maxBet = Math.min(userPR, 200);
  const cpuRounds: string[] = Array.isArray(serverData?.rpsRounds) ? (serverData.rpsRounds as string[]) : ['sasso', 'sasso', 'sasso'];

  const playRound = (choice: RpsChoice) => {
    if (round >= 3) return;
    const newChoices = [...playerChoices, choice];
    setPlayerChoices(newChoices);
    setCounting(true); let n = 3; setCountNum(n);
    const iv = setInterval(() => {
      n--;
      if (n === 0) {
        clearInterval(iv);
        const cpu = cpuRounds[round] ?? 'sasso';
        const res = rpsResult(choice, cpu);
        setCounting(false);
        const newScores = { ...scores };
        if (res === 'win') newScores.p++;
        if (res === 'lose') newScores.c++;
        setScores(newScores);
        setRoundHistory(h => [...h, { p: choice, c: cpu, res }]);
        const newRound = round + 1;
        setRound(newRound);
        if (newScores.p >= 2 || newScores.c >= 2 || newRound >= 3) {
          setTimeout(() => {
            setPhase('result');
            onComplete({ gameId, sessionToken, result: { bet, playerChoices: newChoices } });
          }, 1200);
        }
      } else setCountNum(n);
    }, 700);
  };

  const finalOutcome = scores.p >= 2 ? 'win' : scores.c >= 2 ? 'lose' : scores.p > scores.c ? 'win' : scores.p < scores.c ? 'lose' : 'draw';

  return (
    <ModalWrapper title={`✂️ ${gameName}`} color="#ec4899" onClose={onClose}>
      {phase === 'bet' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' }}>
            Best of 3 contro la CPU. Chi vince 2 round si aggiudica la posta!
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setBet(Math.max(5, bet - 5))} style={btnStyle('#4b5563')}>-5</button>
            <span style={{ color: '#fbbf24', fontWeight: 900, fontSize: 22, minWidth: 60, textAlign: 'center' }}>{bet} PR</span>
            <button onClick={() => setBet(Math.min(maxBet, bet + 5))} style={btnStyle('#4b5563')}>+5</button>
          </div>
          <button onClick={() => setPhase('playing')} style={btnStyle('#ec4899', true)}>✂️ Gioca!</button>
        </div>
      )}
      {phase === 'playing' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#818cf8', fontWeight: 800 }}>Tu</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#818cf8' }}>{scores.p}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Round {Math.min(round + 1, 3)}/3</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#ef4444', fontWeight: 800 }}>CPU</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#ef4444' }}>{scores.c}</div>
            </div>
          </div>
          {roundHistory.slice(-1).map((rh, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: 16, padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
              <span style={{ fontSize: 32 }}>{RPS_ICONS[rh.p]}</span>
              <span style={{ color: rh.res === 'win' ? '#4ade80' : rh.res === 'lose' ? '#ef4444' : '#fbbf24', fontWeight: 900 }}>
                {rh.res === 'win' ? 'Vinto!' : rh.res === 'lose' ? 'Perso!' : 'Pari'}
              </span>
              <span style={{ fontSize: 32 }}>{RPS_ICONS[rh.c] ?? '❓'}</span>
            </div>
          ))}
          {counting ? (
            <div style={{ textAlign: 'center', fontSize: 64, color: '#fbbf24', fontWeight: 900 }}>{countNum}</div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              {RPS_CHOICES.map(c => (
                <button key={c} onClick={() => playRound(c)} style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 14, color: 'white', fontSize: 36, padding: '14px 20px', cursor: 'pointer' }}>
                  {RPS_ICONS[c]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {phase === 'result' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>{finalOutcome === 'win' ? '🎉' : finalOutcome === 'lose' ? '😢' : '🤝'}</div>
          <div style={{ color: finalOutcome === 'win' ? '#4ade80' : finalOutcome === 'lose' ? '#ef4444' : '#fbbf24', fontWeight: 900, fontSize: 24, margin: '10px 0' }}>
            {finalOutcome === 'win' ? 'Hai vinto!' : finalOutcome === 'lose' ? 'Hai perso!' : 'Pareggio!'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Risultato verificato dal server</div>
          <button onClick={onClose} style={{ ...btnStyle('#ec4899', true), marginTop: 16 }}>Chiudi</button>
        </div>
      )}
    </ModalWrapper>
  );
}

/* ─── Shared button style ────────────────────────────────────── */
function btnStyle(color: string, primary = false): React.CSSProperties {
  return {
    background: primary ? color : 'rgba(255,255,255,0.08)',
    border: primary ? 'none' : `1px solid ${color}`,
    borderRadius: 10, color: primary ? '#fff' : color,
    fontWeight: 800, fontSize: 14, padding: '10px 22px',
    cursor: 'pointer', transition: 'opacity 0.15s',
  };
}
