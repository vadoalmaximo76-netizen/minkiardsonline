import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { useAudio } from "../lib/stores/useAudio";
import { socket } from "../lib/socket";
import { X, Send, Smile } from "lucide-react";

const QUICK_EMOJIS = ['👍', '👎', '😂', '😮', '😢', '🔥', '💪', '🎉', '😤', '🤔', '❤️', '⚡'];

interface ChatProps {
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export const Chat: React.FC<ChatProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCooldown, setEmojiCooldown] = useState(false);
  const { playerName, gameId } = useGameState();
  const { playButtonClick } = useAudio();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendEmoji = (emoji: string) => {
    if (emojiCooldown || !gameId) return;
    
    const reactionId = `${playerName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    socket.emit('send-emoji-reaction', { gameId, emoji, playerName, id: reactionId });
    
    setEmojiCooldown(true);
    setTimeout(() => setEmojiCooldown(false), 1000);
    
    setShowEmojiPicker(false);
  };

  // Load persisted messages when chat opens
  useEffect(() => {
    const loadPersistedMessages = () => {
      if (gameId) {
        const storedMessages = localStorage.getItem(`chat_messages_${gameId}`);
        if (storedMessages) {
          try {
            const parsedMessages = JSON.parse(storedMessages);
            setMessages(parsedMessages);
          } catch (error) {
            console.error('Error loading chat messages:', error);
          }
        }
      }
    };

    loadPersistedMessages();
  }, [gameId]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (gameId && messages.length > 0) {
      localStorage.setItem(`chat_messages_${gameId}`, JSON.stringify(messages));
    }
  }, [messages, gameId]);

  useEffect(() => {
    const handleChatMessage = (message: ChatMessage) => {
      setMessages(prev => {
        const newMessages = [...prev, message];
        // Persist immediately when new message arrives
        if (gameId) {
          localStorage.setItem(`chat_messages_${gameId}`, JSON.stringify(newMessages));
        }
        return newMessages;
      });
    };

    socket.on('chat-message', handleChatMessage);

    return () => {
      socket.off('chat-message', handleChatMessage);
    };
  }, [gameId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    playButtonClick();
    if (inputValue.trim()) {
      socket.emit('send-chat-message', {
        message: inputValue.trim(),
        playerName
      });
      setInputValue("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="premium-panel h-full flex flex-col animate-panel-slide-up">
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-gray-600">
        <h3 className="text-white font-semibold">Chat</h3>
        <Button
          onClick={onClose}
          className="bg-sky-blue hover:bg-sky-blue/80 text-white p-1"
          size="sm"
        >
          <X size={16} />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className="text-sm">
            <span className="text-sky-blue font-semibold">{msg.playerName}:</span>
            <span className="text-white ml-2">{msg.message}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-600 relative">
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="absolute bottom-16 left-3 right-3 bg-slate-800/95 backdrop-blur-sm rounded-xl p-3 shadow-2xl border border-white/20 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="grid grid-cols-6 gap-2">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendEmoji(emoji)}
                  disabled={emojiCooldown}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl transition-all hover:scale-125 hover:bg-white/10 ${
                    emojiCooldown ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-2 rounded-lg transition-all ${
              showEmojiPicker 
                ? 'bg-purple-500 text-white' 
                : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
            }`}
          >
            <Smile size={20} />
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Scrivi un messaggio..."
            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border-0 focus:outline-none focus:ring-2 focus:ring-sky-blue"
          />
          <Button
            onClick={handleSendMessage}
            className="bg-sky-blue hover:bg-sky-blue/80 text-white px-3"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};
