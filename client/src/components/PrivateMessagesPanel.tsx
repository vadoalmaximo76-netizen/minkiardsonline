import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Search, Send, MessageCircle, X, Check, CheckCheck, Mic, Square, Trash2, Loader } from 'lucide-react';

interface ConversationWithDetails {
  id: number;
  participant1Id: number;
  participant2Id: number;
  lastMessageAt: string;
  otherUser: { id: number; username: string; avatar: string | null } | null;
  unreadCount: number;
  lastMessage: { id: number; content: string; senderId: number; createdAt: string } | null;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  isRead: boolean;
  messageType?: string;
  audioUrl?: string | null;
  createdAt: string;
}

interface PrivateMessagesPanelProps {
  authToken: string | null;
  currentUserId: number;
  socket: any;
  onClose: () => void;
  initialConversationId?: number | null;
}

const AVATARS = ['😎','🔥','⚡','🎮','👑','💎','🐉','🦁','🦊','🐺','🎯','🚀'];

function getAvatarEmoji(avatar: string | null): string {
  if (!avatar) return '👤';
  const idx = parseInt(avatar.replace('avatar-', '') || '1') - 1;
  if (!isNaN(idx) && idx >= 0) return AVATARS[idx % AVATARS.length];
  return '👤';
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Ieri';
  if (diffDays < 7) return d.toLocaleDateString('it-IT', { weekday: 'short' });
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

function formatFullTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Oggi';
  if (diffDays === 1) return 'Ieri';
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PrivateMessagesPanel({ authToken, currentUserId, socket, onClose, initialConversationId }: PrivateMessagesPanelProps) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [selectedConv, setSelectedConv] = useState<ConversationWithDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialHandled = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  }), [authToken]);

  const fetchConversations = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/messages/conversations', { headers: headers() });
      if (res.ok) setConversations(await res.json());
    } catch {} finally { setLoading(false); }
  }, [authToken, headers]);

  const fetchMessages = useCallback(async (convId: number) => {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/messages/conversation/${convId}`, { headers: headers() });
      if (res.ok) {
        setMessages(await res.json());
        fetchConversations();
      }
    } catch {}
  }, [authToken, headers, fetchConversations]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (initialConversationId && conversations.length > 0 && !initialHandled.current) {
      initialHandled.current = true;
      const conv = conversations.find(c => c.id === initialConversationId);
      if (conv) setSelectedConv(conv);
    }
  }, [initialConversationId, conversations]);

  useEffect(() => {
    if (selectedConv) fetchMessages(selectedConv.id);
  }, [selectedConv?.id]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleMsg = (data: any) => {
      if (data.conversationId === selectedConv?.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setTimeout(() => scrollToBottom(true), 50);
      }
      fetchConversations();
    };
    socket.on('new-private-message', handleMsg);
    return () => socket.off('new-private-message', handleMsg);
  }, [socket, selectedConv?.id, fetchConversations, scrollToBottom]);

  useEffect(() => {
    setTimeout(() => scrollToBottom(false), 80);
  }, [selectedConv?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollToBottom(false), 30);
    }
  }, [messages.length]);

  // Tell server we're watching a conversation (suppresses inbox notifications for it)
  useEffect(() => {
    if (!socket) return;
    if (selectedConv) {
      socket.emit('watching-conversation', { conversationId: selectedConv.id });
    } else {
      socket.emit('stop-watching-conversation');
    }
    return () => { socket.emit('stop-watching-conversation'); };
  }, [socket, selectedConv?.id]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      alert('Impossibile accedere al microfono');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
    const chunks = audioChunksRef.current;
    if (chunks.length && selectedConv) sendVoiceMessage(chunks);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
  };

  const sendVoiceMessage = async (chunks: Blob[]) => {
    if (!selectedConv || !authToken) return;
    setSendingVoice(true);
    try {
      const blob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' });
      const res = await fetch('/api/messages/voice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'x-conversation-id': String(selectedConv.id), 'Content-Type': blob.type },
        body: blob,
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        fetchConversations();
        setTimeout(() => scrollToBottom(true), 50);
      }
    } catch {}
    setSendingVoice(false);
  };

  const formatRecordingTime = (secs: number) => `${Math.floor(secs / 60).toString().padStart(2,'0')}:${(secs % 60).toString().padStart(2,'0')}`;

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !selectedConv || sending) return;
    setSending(true);
    setInput('');
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ conversationId: selectedConv.id, content: text }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        fetchConversations();
      } else {
        setInput(text);
      }
    } catch { setInput(text); }
    setSending(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const searchUsers = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/search-users?query=${encodeURIComponent(q)}`, { headers: headers() });
      if (res.ok) setSearchResults((await res.json()).filter((u: any) => u.id !== currentUserId));
    } catch {} finally { setSearchLoading(false); }
  };

  const startConversation = async (recipientId: number, user: any) => {
    try {
      const res = await fetch('/api/messages/conversation', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ recipientId }),
      });
      if (res.ok) {
        const conv = await res.json();
        setShowSearch(false); setSearchQuery(''); setSearchResults([]);
        await fetchConversations();
        setSelectedConv({
          ...conv,
          otherUser: { id: user.id, username: user.username, avatar: user.avatar },
          unreadCount: 0,
          lastMessage: null,
        });
      }
    } catch {}
  };

  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount || 0), 0);

  if (selectedConv) {
    const otherName = selectedConv.otherUser?.username || 'Utente';
    const otherAvatar = getAvatarEmoji(selectedConv.otherUser?.avatar || null);

    return createPortal((
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'linear-gradient(160deg,#060914,#08101e,#060912)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid rgba(139,92,246,0.2)',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setSelectedConv(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(192,132,252,0.8)', padding: 4, display: 'flex', outline: 'none' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div style={{ fontSize: 28, lineHeight: 1 }}>{otherAvatar}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{otherName}</div>
            <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11 }}>Messaggio privato</div>
          </div>
        </div>

        <div ref={messagesContainerRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(148,163,184,0.4)', gap: 12 }}>
              <MessageCircle size={48} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: 14 }}>Nessun messaggio ancora</div>
              <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.3)' }}>Scrivi qualcosa a {otherName}!</div>
            </div>
          ) : (() => {
            const items: React.ReactNode[] = [];
            let lastDate = '';
            messages.forEach((msg, i) => {
              const isMe = msg.senderId === currentUserId;
              const showDay = !lastDate || !isSameDay(lastDate, msg.createdAt);
              if (showDay) {
                lastDate = msg.createdAt;
                items.push(
                  <div key={`day-${i}`} style={{ textAlign: 'center', margin: '12px 0 8px' }}>
                    <span style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(148,163,184,0.6)', fontSize: 11, borderRadius: 10, padding: '3px 10px' }}>
                      {dayLabel(msg.createdAt)}
                    </span>
                  </div>
                );
              }
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const groupWithPrev = prev && prev.senderId === msg.senderId && isSameDay(prev.createdAt, msg.createdAt);
              const groupWithNext = next && next.senderId === msg.senderId && isSameDay(next.createdAt, msg.createdAt);
              const isLast = !groupWithNext;
              items.push(
                <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: isLast ? 6 : 1 }}>
                  {!isMe && isLast && (
                    <div style={{ fontSize: 20, alignSelf: 'flex-end', marginRight: 6, marginBottom: 2, opacity: 0.8 }}>{otherAvatar}</div>
                  )}
                  {!isMe && !isLast && <div style={{ width: 26, marginRight: 6 }} />}
                  <div style={{ maxWidth: '72%' }}>
                    <div style={{
                      padding: msg.messageType === 'voice' ? '8px 10px' : '8px 12px',
                      borderRadius: isMe
                        ? `16px 16px ${groupWithNext ? '16px' : '4px'} 16px`
                        : `16px 16px 16px ${groupWithNext ? '16px' : '4px'}`,
                      background: isMe
                        ? 'linear-gradient(135deg,#7c3aed,#6d28d9)'
                        : 'rgba(30,41,59,0.9)',
                      color: 'white',
                      fontSize: 14,
                      lineHeight: 1.45,
                      wordBreak: 'break-word',
                      border: isMe ? 'none' : '1px solid rgba(255,255,255,0.06)',
                      boxShadow: isMe ? '0 2px 8px rgba(109,40,217,0.3)' : '0 1px 4px rgba(0,0,0,0.3)',
                    }}>
                      {msg.messageType === 'voice' ? (
                        msg.audioUrl ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
                            <Mic size={14} color={isMe ? 'rgba(255,255,255,0.7)' : 'rgba(167,139,250,0.8)'} style={{ flexShrink: 0 }} />
                            <audio
                              controls
                              src={msg.audioUrl}
                              style={{ height: 28, flex: 1, minWidth: 0, filter: isMe ? 'invert(1) brightness(1.5)' : 'none', opacity: 0.9 }}
                            />
                          </div>
                        ) : (
                          <span style={{ opacity: 0.5, fontStyle: 'italic', fontSize: 12 }}>🎤 Messaggio vocale (scaduto)</span>
                        )
                      ) : (
                        msg.content
                      )}
                    </div>
                    {isLast && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3, justifyContent: isMe ? 'flex-end' : 'flex-start', paddingRight: isMe ? 2 : 0, paddingLeft: isMe ? 0 : 2 }}>
                        <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)' }}>{formatFullTime(msg.createdAt)}</span>
                        {isMe && (
                          msg.isRead
                            ? <CheckCheck size={12} color="rgba(167,139,250,0.8)" />
                            : <Check size={12} color="rgba(148,163,184,0.4)" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            });
            return items;
          })()}
          <div ref={messagesEndRef} />
        </div>

        <div style={{
          padding: '10px 12px',
          borderTop: '1px solid rgba(139,92,246,0.15)',
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}>
          {isRecording ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
              <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{formatRecordingTime(recordingTime)}</span>
              <span style={{ color: 'rgba(148,163,184,0.6)', fontSize: 12, flex: 1 }}>Registrazione in corso…</span>
              <button onClick={cancelRecording} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, cursor: 'pointer', color: '#ef4444', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, outline: 'none' }}>
                <Trash2 size={14} /> Annulla
              </button>
              <button onClick={stopRecording} style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'white', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, outline: 'none', boxShadow: '0 2px 10px rgba(109,40,217,0.4)' }}>
                <Square size={14} /> Invia
              </button>
            </div>
          ) : sendingVoice ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <Loader size={16} color="rgba(167,139,250,0.7)" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ color: 'rgba(148,163,184,0.6)', fontSize: 13 }}>Invio messaggio vocale…</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Scrivi un messaggio…"
                  rows={1}
                  style={{
                    flex: 1,
                    resize: 'none',
                    background: 'rgba(15,23,42,0.8)',
                    border: '1px solid rgba(139,92,246,0.25)',
                    borderRadius: 12,
                    padding: '10px 14px',
                    color: 'white',
                    fontSize: 14,
                    outline: 'none',
                    lineHeight: 1.4,
                    maxHeight: 120,
                    overflowY: 'auto',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(139,92,246,0.6)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(139,92,246,0.25)'; }}
                />
                {input.trim() ? (
                  <button onClick={sendMessage} disabled={sending} style={{ width: 40, height: 40, borderRadius: '50%', background: sending ? 'rgba(30,41,59,0.6)' : 'linear-gradient(135deg,#7c3aed,#6d28d9)', border: 'none', cursor: sending ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s', boxShadow: sending ? 'none' : '0 2px 12px rgba(109,40,217,0.4)', outline: 'none' }}>
                    <Send size={16} color={sending ? 'rgba(148,163,184,0.4)' : 'white'} />
                  </button>
                ) : (
                  <button onClick={startRecording} style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(139,92,246,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s', outline: 'none' }} title="Messaggio vocale">
                    <Mic size={16} color="rgba(148,163,184,0.7)" />
                  </button>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.3)', marginTop: 4, textAlign: 'right' }}>
                Shift+Invio per andare a capo • 🎤 tieni premuto mic per vocale
              </div>
            </>
          )}
        </div>
      </div>
    ), document.body);
  }

  return createPortal((
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'linear-gradient(160deg,#060914,#08101e,#060912)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid rgba(139,92,246,0.2)',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(192,132,252,0.8)', padding: 4, display: 'flex', outline: 'none' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>Messaggi</div>
          {totalUnread > 0 && (
            <div style={{ color: 'rgba(192,132,252,0.7)', fontSize: 11 }}>{totalUnread} non lett{totalUnread === 1 ? 'o' : 'i'}</div>
          )}
        </div>
        <button
          onClick={() => { setShowSearch(v => !v); setSearchQuery(''); setSearchResults([]); }}
          style={{
            background: showSearch ? 'rgba(139,92,246,0.2)' : 'none',
            border: `1px solid ${showSearch ? 'rgba(139,92,246,0.4)' : 'transparent'}`,
            borderRadius: 8,
            cursor: 'pointer',
            color: showSearch ? 'rgba(192,132,252,0.9)' : 'rgba(148,163,184,0.6)',
            padding: '6px 8px',
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 600,
            outline: 'none',
          }}
        >
          <Search size={14} />
          Nuova chat
        </button>
      </div>

      {showSearch && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(139,92,246,0.15)', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(148,163,184,0.4)' }} />
            <input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); searchUsers(e.target.value); }}
              placeholder="Cerca utente..."
              autoFocus
              style={{
                width: '100%',
                padding: '9px 34px 9px 32px',
                background: 'rgba(15,23,42,0.8)',
                border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: 10,
                color: 'white',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(148,163,184,0.5)', outline: 'none', display: 'flex' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          {searchLoading && (
            <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>Ricerca...</div>
          )}
          {searchResults.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {searchResults.map(user => (
                <div
                  key={user.id}
                  onClick={() => startConversation(user.id, user)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(30,41,59,0.5)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.15)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(30,41,59,0.5)')}
                >
                  <div style={{ fontSize: 24 }}>{getAvatarEmoji(user.avatar)}</div>
                  <div>
                    <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{user.username}</div>
                    {user.puntiRankiard != null && (
                      <div style={{ color: 'rgba(250,204,21,0.6)', fontSize: 11 }}>{user.puntiRankiard} PR</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!searchLoading && searchQuery && searchResults.length === 0 && (
            <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Nessun utente trovato</div>
          )}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
            <div style={{ width: 28, height: 28, border: '2px solid rgba(139,92,246,0.3)', borderTopColor: 'rgba(139,92,246,0.8)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: 'rgba(148,163,184,0.4)' }}>
            <MessageCircle size={48} style={{ opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(203,213,225,0.5)' }}>Nessuna conversazione</div>
            <div style={{ fontSize: 12 }}>Cerca un utente per iniziare a chattare</div>
          </div>
        ) : (
          conversations.map((conv, i) => {
            const avatar = getAvatarEmoji(conv.otherUser?.avatar || null);
            const name = conv.otherUser?.username || 'Utente';
            const hasUnread = conv.unreadCount > 0;
            const isLastMsg = !!conv.lastMessage;
            const isMine = conv.lastMessage?.senderId === currentUserId;
            return (
              <div
                key={conv.id}
                onClick={() => setSelectedConv(conv)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 16px',
                  borderBottom: i < conversations.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  background: hasUnread ? 'rgba(139,92,246,0.05)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = hasUnread ? 'rgba(139,92,246,0.05)' : 'transparent')}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'rgba(30,41,59,0.7)',
                    border: `1.5px solid ${hasUnread ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22,
                  }}>
                    {avatar}
                  </div>
                  {hasUnread && (
                    <div style={{
                      position: 'absolute', top: -3, right: -3,
                      minWidth: 18, height: 18,
                      background: 'linear-gradient(135deg,#9333ea,#7c3aed)',
                      borderRadius: 9, border: '2px solid #060914',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800, color: 'white', padding: '0 3px',
                    }}>
                      {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: 'white', fontWeight: hasUnread ? 700 : 500, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{name}</span>
                    <span style={{ color: hasUnread ? 'rgba(192,132,252,0.8)' : 'rgba(100,116,139,0.6)', fontSize: 11, flexShrink: 0 }}>
                      {formatTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  {isLastMsg && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {isMine && <CheckCheck size={12} color={conv.lastMessage?.senderId === currentUserId && conv.unreadCount === 0 ? 'rgba(167,139,250,0.6)' : 'rgba(100,116,139,0.5)'} style={{ flexShrink: 0 }} />}
                      <span style={{
                        color: hasUnread ? 'rgba(203,213,225,0.8)' : 'rgba(100,116,139,0.6)',
                        fontSize: 13,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontWeight: hasUnread ? 500 : 400,
                      }}>
                        {isMine ? 'Tu: ' : ''}{conv.lastMessage?.content}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  ), document.body);
}
