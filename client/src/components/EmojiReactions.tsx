import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Volume2 } from 'lucide-react';
import { socket } from '../lib/socket';

interface EmojiReaction {
  id: string;
  emoji: string;
  playerName: string;
  timestamp: number;
  soundEffect?: string;
}

interface EmojiReactionsProps {
  gameId: string;
  playerName: string;
}

const QUICK_EMOJIS = ['👍', '👎', '😂', '😮', '😢', '🔥', '💪', '🎉', '😤', '🤔', '❤️', '⚡'];

const SOUND_REACTIONS = [
  { id: 'applause', emoji: '👏', label: 'Applauso', frequency: [400, 800], type: 'noise' as const },
  { id: 'horn', emoji: '📯', label: 'Tromba', frequency: [523, 659, 784], type: 'horn' as const },
  { id: 'drumroll', emoji: '🥁', label: 'Rullo', frequency: [150, 200], type: 'drum' as const },
  { id: 'laugh', emoji: '🤣', label: 'Risata', frequency: [300, 500, 400, 600], type: 'laugh' as const },
  { id: 'wow', emoji: '🤯', label: 'Wow', frequency: [200, 800], type: 'sweep' as const },
  { id: 'boo', emoji: '👻', label: 'Buu', frequency: [400, 200], type: 'sweep' as const },
  { id: 'ding', emoji: '🔔', label: 'Ding', frequency: [880], type: 'bell' as const },
  { id: 'explosion', emoji: '💥', label: 'Boom', frequency: [80, 40], type: 'explosion' as const },
];

let audioCtx: AudioContext | null = null;
function getAudioContext() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playSoundEffect(effectId: string) {
  const effect = SOUND_REACTIONS.find(s => s.id === effectId);
  if (!effect) return;

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.3, now);
    masterGain.connect(ctx.destination);

    switch (effect.type) {
      case 'noise': {
        const bufferSize = ctx.sampleRate * 0.4;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.Q.setValueAtTime(0.5, now);
        src.connect(filter);
        filter.connect(masterGain);
        src.start(now);
        break;
      }
      case 'horn': {
        effect.frequency.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + i * 0.15);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, now + i * 0.15);
          g.gain.linearRampToValueAtTime(0.2, now + i * 0.15 + 0.05);
          g.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.3);
          osc.connect(g);
          g.connect(masterGain);
          osc.start(now + i * 0.15);
          osc.stop(now + i * 0.15 + 0.35);
        });
        break;
      }
      case 'drum': {
        for (let i = 0; i < 8; i++) {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(150 + Math.random() * 50, now + i * 0.06);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.3, now + i * 0.06);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.05);
          osc.connect(g);
          g.connect(masterGain);
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 0.06);
        }
        break;
      }
      case 'laugh': {
        effect.frequency.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.12);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.2, now + i * 0.12);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.1);
          osc.connect(g);
          g.connect(masterGain);
          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.12);
        });
        break;
      }
      case 'sweep': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(effect.frequency[0], now);
        osc.frequency.exponentialRampToValueAtTime(effect.frequency[1], now + 0.5);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.25, now);
        g.gain.linearRampToValueAtTime(0, now + 0.6);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.7);
        break;
      }
      case 'bell': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(effect.frequency[0], now);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 1.1);
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(effect.frequency[0] * 2.5, now);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.1, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc2.connect(g2);
        g2.connect(masterGain);
        osc2.start(now);
        osc2.stop(now + 0.7);
        break;
      }
      case 'explosion': {
        const bufferSize = ctx.sampleRate * 0.8;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.5);
        src.connect(filter);
        filter.connect(masterGain);
        masterGain.gain.setValueAtTime(0.5, now);
        src.start(now);
        break;
      }
    }
  } catch (e) {}
}

export function EmojiReactions({ gameId, playerName }: EmojiReactionsProps) {
  const [floatingEmojis, setFloatingEmojis] = useState<EmojiReaction[]>([]);
  const [soundPanelOpen, setSoundPanelOpen] = useState(false);
  const lastSoundTime = useRef(0);

  useEffect(() => {
    const handleEmojiReaction = (data: { emoji: string; playerName: string; id: string; soundEffect?: string }) => {
      const newReaction: EmojiReaction = {
        ...data,
        timestamp: Date.now()
      };
      
      setFloatingEmojis(prev => [...prev, newReaction]);
      
      if (data.soundEffect) {
        playSoundEffect(data.soundEffect);
      }
      
      setTimeout(() => {
        setFloatingEmojis(prev => prev.filter(r => r.id !== data.id));
      }, 3000);
    };

    socket.on('emoji-reaction', handleEmojiReaction);

    return () => {
      socket.off('emoji-reaction', handleEmojiReaction);
    };
  }, []);

  const sendSoundReaction = useCallback((soundId: string, emoji: string) => {
    const now = Date.now();
    if (now - lastSoundTime.current < 2000) return;
    lastSoundTime.current = now;
    
    const reactionId = `${playerName}-sound-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    socket.emit('send-emoji-reaction', {
      gameId,
      emoji,
      playerName,
      id: reactionId,
      soundEffect: soundId
    });
    setSoundPanelOpen(false);
  }, [gameId, playerName]);

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-50">
        {floatingEmojis.map((reaction) => (
          <FloatingEmoji key={reaction.id} emoji={reaction.emoji} playerName={reaction.playerName} hasSoundEffect={!!reaction.soundEffect} />
        ))}
      </div>

      <div className="fixed bottom-20 right-4 z-40 pointer-events-auto">
        <button
          onClick={() => setSoundPanelOpen(!soundPanelOpen)}
          className="p-2.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all duration-200 text-amber-400 hover:text-amber-300 hover:scale-105"
          title="Reazioni Sonore"
        >
          <Volume2 size={18} />
        </button>

        {soundPanelOpen && (
          <div className="absolute bottom-12 right-0 p-3 rounded-2xl bg-black/70 backdrop-blur-xl border border-white/15 shadow-2xl min-w-[200px]">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-2 px-1">Reazioni Sonore</div>
            <div className="grid grid-cols-4 gap-1.5">
              {SOUND_REACTIONS.map(sound => (
                <button
                  key={sound.id}
                  onClick={() => sendSoundReaction(sound.id, sound.emoji)}
                  className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-white/10 transition-all duration-150 group"
                  title={sound.label}
                >
                  <span className="text-2xl group-hover:scale-125 transition-transform duration-150">{sound.emoji}</span>
                  <span className="text-[9px] text-white/40 group-hover:text-white/70">{sound.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function FloatingEmoji({ emoji, playerName, hasSoundEffect }: { emoji: string; playerName: string; hasSoundEffect?: boolean }) {
  const position = useMemo(() => ({
    left: 20 + Math.random() * 60,
    startY: 70 + Math.random() * 20
  }), []);

  return (
    <div
      className="absolute"
      style={{
        left: `${position.left}%`,
        bottom: `${position.startY}%`,
        animation: 'floatUp 3s ease-out forwards'
      }}
    >
      <div className="flex flex-col items-center">
        <span className={`drop-shadow-lg ${hasSoundEffect ? 'text-6xl' : 'text-5xl'}`}>{emoji}</span>
        {hasSoundEffect && (
          <span className="text-[10px] text-amber-400/80 flex items-center gap-0.5 mt-0.5">
            <Volume2 size={8} />
          </span>
        )}
        <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded-full mt-1">
          {playerName}
        </span>
      </div>
    </div>
  );
}
