import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { socket } from "../lib/socket";
import { useGameState } from "../lib/stores/useGameState";
import { useAudio } from "../lib/stores/useAudio";
import { X } from "lucide-react";

interface GameLogProps {
  onClose: () => void;
}

interface LogEntry {
  id: string;
  playerName: string;
  message: string;
  timestamp: number;
  category: 'attack' | 'defense' | 'death' | 'card' | 'dice' | 'star' | 'turn' | 'target' | 'chat' | 'system';
  icon: string;
}

type FilterTab = 'all' | 'actions' | 'cards' | 'system';

function getCategory(message: string, isSystem: boolean): LogEntry['category'] {
  if (!isSystem) return 'chat';
  const lower = message.toLowerCase();
  if (/attacc|danni|danno/.test(lower)) return 'attack';
  if (/difes|difesa|protett|barriera|rifugio|scudo/.test(lower)) return 'defense';
  if (/cimitero|eliminat|muore|morte/.test(lower)) return 'death';
  if (/giocato|carta/.test(lower)) return 'card';
  if (/dado|dice/.test(lower)) return 'dice';
  if (/stelle|pti/.test(lower)) return 'star';
  if (/turno/.test(lower)) return 'turn';
  if (/bersagli|effetto/.test(lower)) return 'target';
  return 'system';
}

function getIcon(category: LogEntry['category']): string {
  switch (category) {
    case 'attack': return '⚔️';
    case 'defense': return '🛡️';
    case 'death': return '💀';
    case 'card': return '🃏';
    case 'dice': return '🎲';
    case 'star': return '⭐';
    case 'turn': return '🔄';
    case 'target': return '🎯';
    case 'chat': return '💬';
    case 'system': return '📋';
  }
}

function getColorClass(category: LogEntry['category']): string {
  switch (category) {
    case 'attack': return 'text-red-400';
    case 'defense': return 'text-blue-400';
    case 'death': return 'text-purple-400';
    case 'card': return 'text-green-400';
    case 'dice': return 'text-yellow-400';
    case 'star': return 'text-amber-400';
    case 'turn': return 'text-cyan-400';
    case 'target': return 'text-orange-400';
    case 'chat': return 'text-white';
    case 'system': return 'text-gray-400';
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function matchesFilter(entry: LogEntry, filter: FilterTab): boolean {
  if (filter === 'all') return true;
  if (filter === 'actions') return ['attack', 'defense', 'death'].includes(entry.category);
  if (filter === 'cards') return entry.category === 'card';
  if (filter === 'system') return !['attack', 'defense', 'death', 'card', 'chat'].includes(entry.category);
  return true;
}

export const GameLog: React.FC<GameLogProps> = ({ onClose }) => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { gameId } = useGameState();
  const { playTabSwitch } = useAudio();

  useEffect(() => {
    if (gameId) {
      try {
        const stored = localStorage.getItem(`chat_messages_${gameId}`);
        if (stored) {
          const msgs = JSON.parse(stored) as Array<{ id: string; playerName: string; message: string; timestamp: number }>;
          const loaded = msgs.map(msg => {
            const isSystem = msg.playerName === 'Sistema';
            const category = getCategory(msg.message, isSystem);
            return {
              ...msg,
              category,
              icon: getIcon(category),
            };
          });
          setEntries(loaded);
        }
      } catch {}
    }
  }, [gameId]);

  useEffect(() => {
    const handleMessage = (msg: { id: string; playerName: string; message: string; timestamp: number }) => {
      const isSystem = msg.playerName === 'Sistema';
      const category = getCategory(msg.message, isSystem);
      const entry: LogEntry = {
        ...msg,
        category,
        icon: getIcon(category),
      };
      setEntries(prev => {
        if (prev.some(e => e.id === msg.id)) return prev;
        return [...prev, entry];
      });
    };

    socket.on('chat-message', handleMessage);
    return () => { socket.off('chat-message', handleMessage); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, activeFilter]);

  const filtered = entries.filter(e => matchesFilter(e, activeFilter));

  const filters: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Tutti' },
    { key: 'actions', label: 'Azioni' },
    { key: 'cards', label: 'Carte' },
    { key: 'system', label: 'Sistema' },
  ];

  return (
    <div className="premium-panel h-full flex flex-col animate-panel-slide-up">
      <div className="flex justify-between items-center p-3 border-b border-gray-600">
        <h3 className="text-white font-semibold text-sm">📜 Game Log</h3>
        <Button
          onClick={onClose}
          className="bg-purple-600 hover:bg-purple-500 text-white p-1"
          size="sm"
        >
          <X size={16} />
        </Button>
      </div>

      <div className="flex gap-1 p-2 border-b border-gray-700">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => { playTabSwitch(); setActiveFilter(f.key); }}
            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
              activeFilter === f.key
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 && (
          <div className="text-gray-500 text-xs text-center py-4">Nessun evento</div>
        )}
        {filtered.map(entry => (
          <div
            key={entry.id}
            className={`flex items-start gap-2 px-2 py-1 rounded text-xs ${
              entry.category === 'chat' ? 'bg-gray-800/50' : 'bg-gray-800/30'
            }`}
          >
            <span className="flex-shrink-0 text-sm leading-4">{entry.icon}</span>
            <span className="flex-shrink-0 text-gray-500 font-mono text-[10px] leading-4">
              {formatTime(entry.timestamp)}
            </span>
            <span className={`${getColorClass(entry.category)} leading-4 break-words min-w-0`}>
              {entry.category === 'chat' && (
                <span className="text-sky-400 font-semibold">{entry.playerName}: </span>
              )}
              {entry.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
