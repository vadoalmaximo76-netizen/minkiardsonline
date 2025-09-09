import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { X, Send } from "lucide-react";

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
  const { playerName, gameId } = useGameState();
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    <div className="bg-gray-800 rounded-lg shadow-lg h-full flex flex-col">
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
      <div className="p-3 border-t border-gray-600 flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
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
  );
};
