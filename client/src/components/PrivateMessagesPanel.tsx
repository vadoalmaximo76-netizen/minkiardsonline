import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, ArrowLeft, Bell, BellOff, Search, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface ConversationWithDetails {
  id: number;
  participant1Id: number;
  participant2Id: number;
  lastMessageAt: string;
  otherUser: {
    id: number;
    username: string;
    avatar: string | null;
  } | null;
  unreadCount: number;
  lastMessage: {
    id: number;
    content: string;
    senderId: number;
    createdAt: string;
  } | null;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface PrivateMessagesPanelProps {
  authToken: string | null;
  currentUserId: number;
  socket: any;
  onClose: () => void;
  initialConversationId?: number | null;
}

export default function PrivateMessagesPanel({ authToken, currentUserId, socket, onClose, initialConversationId }: PrivateMessagesPanelProps) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialConvHandled = useRef(false);

  useEffect(() => {
    fetchConversations();
  }, [authToken]);

  useEffect(() => {
    if (initialConversationId && conversations.length > 0 && !initialConvHandled.current) {
      initialConvHandled.current = true;
      const conv = conversations.find(c => c.id === initialConversationId);
      if (conv) setSelectedConversation(conv);
    }
  }, [initialConversationId, conversations]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (socket) {
      const handleNewMessage = (data: any) => {
        if (data.recipientId === currentUserId) {
          if (selectedConversation && data.conversationId === selectedConversation.id) {
            setMessages(prev => [...prev, data.message]);
            scrollToBottom();
          }
          fetchConversations();
        }
      };

      socket.on('new-private-message', handleNewMessage);
      return () => {
        socket.off('new-private-message', handleNewMessage);
      };
    }
  }, [socket, selectedConversation, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/messages/conversations', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: number) => {
    try {
      const response = await fetch(`/api/messages/conversation/${conversationId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        fetchConversations();
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          content: newMessage.trim()
        })
      });

      if (response.ok) {
        const message = await response.json();
        setMessages(prev => [...prev, message]);
        setNewMessage('');
        scrollToBottom();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/search-users?query=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (response.ok) {
        const users = await response.json();
        setSearchResults(users.filter((u: any) => u.id !== currentUserId));
      }
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const startConversation = async (recipientId: number) => {
    try {
      const response = await fetch('/api/messages/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ recipientId })
      });

      if (response.ok) {
        const conv = await response.json();
        await fetchConversations();
        const fullConv = conversations.find(c => c.id === conv.id);
        if (fullConv) {
          setSelectedConversation(fullConv);
        } else {
          const recipient = searchResults.find(u => u.id === recipientId);
          setSelectedConversation({
            ...conv,
            otherUser: recipient ? { id: recipient.id, username: recipient.username, avatar: recipient.avatar } : null,
            unreadCount: 0,
            lastMessage: null
          });
        }
        setShowSearch(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Ieri';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('it-IT', { weekday: 'short' });
    }
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  };

  const getAvatarEmoji = (avatar: string | null) => {
    if (!avatar) return '👤';
    const avatars: Record<string, string> = {
      'goku': '🔥', 'vegeta': '👑', 'gohan': '📚', 'piccolo': '🟢',
      'trunks': '⚔️', 'goten': '😊', 'krillin': '🥚', 'yamcha': '⚾',
      'tien': '👁️', 'frieza': '❄️', 'cell': '🦠', 'buu': '🍬',
      'android18': '💎', 'broly': '💪', 'beerus': '😼', 'whis': '👼',
      'jiren': '🔴', 'hit': '⏱️', 'zamasu': '👹', 'goku_black': '🖤',
      'bardock': '🌟', 'raditz': '🦁', 'nappa': '🦲', 'ginyu': '💜'
    };
    return avatars[avatar] || '👤';
  };

  if (selectedConversation) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-purple-500/30 bg-black/30">
          <Button
            onClick={() => setSelectedConversation(null)}
            variant="ghost"
            className="text-white hover:bg-purple-600/30"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-3xl">{getAvatarEmoji(selectedConversation.otherUser?.avatar || null)}</div>
          <div>
            <h2 className="text-white font-bold text-lg">{selectedConversation.otherUser?.username || 'Utente'}</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-8">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Inizia una conversazione!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    msg.senderId === currentUserId
                      ? 'bg-purple-600 text-white rounded-br-sm'
                      : 'bg-slate-700 text-white rounded-bl-sm'
                  }`}
                >
                  <p className="break-words">{msg.content}</p>
                  <p className={`text-xs mt-1 ${msg.senderId === currentUserId ? 'text-purple-200' : 'text-gray-400'}`}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-purple-500/30 bg-black/30">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Scrivi un messaggio..."
              className="flex-1 bg-slate-800 border-purple-500/30 text-white"
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-purple-500/30 bg-black/30">
        <div className="flex items-center gap-3">
          <Button
            onClick={onClose}
            variant="ghost"
            className="text-white hover:bg-purple-600/30"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-white font-bold text-xl">Messaggi</h1>
        </div>
        <Button
          onClick={() => setShowSearch(!showSearch)}
          variant="ghost"
          className="text-white hover:bg-purple-600/30"
        >
          <Search className="w-5 h-5" />
        </Button>
      </div>

      {showSearch && (
        <div className="p-4 border-b border-purple-500/30 bg-black/20">
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              searchUsers(e.target.value);
            }}
            placeholder="Cerca utenti..."
            className="bg-slate-800 border-purple-500/30 text-white"
          />
          {searchResults.length > 0 && (
            <div className="mt-2 space-y-1">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => startConversation(user.id)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-purple-600/30 cursor-pointer transition-colors"
                >
                  <div className="text-2xl">{getAvatarEmoji(user.avatar)}</div>
                  <span className="text-white font-medium">{user.username}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-500"></div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center text-gray-400 mt-12">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Nessuna conversazione</p>
            <p className="text-sm">Cerca un utente per iniziare a chattare!</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className="flex items-center gap-3 p-4 border-b border-purple-500/20 hover:bg-purple-600/20 cursor-pointer transition-colors"
            >
              <div className="relative">
                <div className="text-3xl">{getAvatarEmoji(conv.otherUser?.avatar || null)}</div>
                {conv.unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold truncate">{conv.otherUser?.username || 'Utente'}</h3>
                  <span className="text-gray-400 text-xs">{formatTime(conv.lastMessageAt)}</span>
                </div>
                {conv.lastMessage && (
                  <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-white font-medium' : 'text-gray-400'}`}>
                    {conv.lastMessage.senderId === currentUserId ? 'Tu: ' : ''}
                    {conv.lastMessage.content}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
