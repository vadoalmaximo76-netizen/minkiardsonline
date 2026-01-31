import React, { useState, useEffect } from 'react';
import { Smile } from 'lucide-react';
import { socket } from '../lib/socket';

interface EmojiReaction {
  id: string;
  emoji: string;
  playerName: string;
  timestamp: number;
}

interface EmojiReactionsProps {
  gameId: string;
  playerName: string;
}

const QUICK_EMOJIS = ['👍', '👎', '😂', '😮', '😢', '🔥', '💪', '🎉', '😤', '🤔', '❤️', '⚡'];

export function EmojiReactions({ gameId, playerName }: EmojiReactionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<EmojiReaction[]>([]);
  const [cooldown, setCooldown] = useState(false);

  useEffect(() => {
    const handleEmojiReaction = (data: { emoji: string; playerName: string; id: string }) => {
      const newReaction: EmojiReaction = {
        ...data,
        timestamp: Date.now()
      };
      
      setFloatingEmojis(prev => [...prev, newReaction]);
      
      setTimeout(() => {
        setFloatingEmojis(prev => prev.filter(r => r.id !== data.id));
      }, 3000);
    };

    socket.on('emoji-reaction', handleEmojiReaction);

    return () => {
      socket.off('emoji-reaction', handleEmojiReaction);
    };
  }, []);

  const sendEmoji = (emoji: string) => {
    if (cooldown) return;
    
    const reactionId = `${playerName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    socket.emit('send-emoji-reaction', { gameId, emoji, playerName, id: reactionId });
    
    setCooldown(true);
    setTimeout(() => setCooldown(false), 1000);
    
    setIsOpen(false);
  };

  return (
    <>
      <div className="fixed bottom-24 right-4 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
            isOpen 
              ? 'bg-purple-500 text-white scale-110' 
              : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700/90 hover:scale-105'
          } border border-white/20`}
        >
          <Smile className="w-6 h-6" />
        </button>

        {isOpen && (
          <div className="absolute bottom-14 right-0 bg-slate-800/95 backdrop-blur-sm rounded-2xl p-3 shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="grid grid-cols-4 gap-2">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendEmoji(emoji)}
                  disabled={cooldown}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-2xl transition-all hover:scale-125 hover:bg-white/10 ${
                    cooldown ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="fixed inset-0 pointer-events-none z-50">
        {floatingEmojis.map((reaction) => (
          <FloatingEmoji key={reaction.id} emoji={reaction.emoji} playerName={reaction.playerName} />
        ))}
      </div>
    </>
  );
}

function FloatingEmoji({ emoji, playerName }: { emoji: string; playerName: string }) {
  const [position] = useState(() => ({
    left: 20 + Math.random() * 60,
    startY: 70 + Math.random() * 20
  }));

  return (
    <div
      className="absolute animate-float-up"
      style={{
        left: `${position.left}%`,
        bottom: `${position.startY}%`,
        animation: 'floatUp 3s ease-out forwards'
      }}
    >
      <div className="flex flex-col items-center">
        <span className="text-5xl drop-shadow-lg">{emoji}</span>
        <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded-full mt-1">
          {playerName}
        </span>
      </div>
    </div>
  );
}
