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
  const [floatingEmojis, setFloatingEmojis] = useState<EmojiReaction[]>([]);

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

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {floatingEmojis.map((reaction) => (
        <FloatingEmoji key={reaction.id} emoji={reaction.emoji} playerName={reaction.playerName} />
      ))}
    </div>
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
