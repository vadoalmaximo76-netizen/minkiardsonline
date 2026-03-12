import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Link, Check, Search, Send, UserPlus } from "lucide-react";
import { socket } from "../lib/socket";

interface InvitePanelProps {
  gameId: string;
  authToken?: string | null;
  onClose: () => void;
}

export const InvitePanel: React.FC<InvitePanelProps> = ({ gameId, authToken, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: number; username: string; puntiRankiard?: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const gameLink = `${window.location.origin}?gameId=${gameId}`;

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(gameLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = gameLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !authToken) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success && data.users) {
        setSearchResults(data.users);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => searchUsers(searchQuery), 280);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery, searchUsers]);

  const handleInvite = async (userId: number, username: string) => {
    if (!authToken) return;
    setInviting(username);
    try {
      const res = await fetch('/api/friends/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ friendId: userId, gameId }),
      });
      const data = await res.json();
      if (data.success) {
        setInvitedUsers(prev => new Set(prev).add(username));
      }
    } catch {
    } finally {
      setInviting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-white/15 shadow-2xl overflow-hidden"
        style={{ background: 'rgba(10,8,30,0.97)', backdropFilter: 'blur(20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <UserPlus size={15} className="text-cyan-400" />
            <span className="text-white font-bold text-sm">Invita Amici</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-white/5">
            <X size={15} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-white/50 text-xs mb-2">Link partita</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/5 rounded-xl px-3 py-2 border border-white/10 truncate">
                <span className="text-white/50 text-xs truncate block">{gameLink}</span>
              </div>
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 flex-shrink-0 ${
                  copied
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                    : 'bg-white/10 border-white/10 text-white hover:bg-white/15'
                }`}
              >
                {copied ? <Check size={13} /> : <Link size={13} />}
                {copied ? 'Copiato!' : 'Copia'}
              </button>
            </div>
          </div>

          {authToken && (
            <div>
              <p className="text-white/50 text-xs mb-2">Cerca e invita un utente</p>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca per username..."
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-500/40 focus:bg-white/8 transition-all"
                />
              </div>

              {searching && (
                <p className="text-white/40 text-xs mt-2 text-center">Ricerca...</p>
              )}

              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                  {searchResults.map((user) => (
                    <div key={user.id} className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white/80 text-sm truncate flex-1">{user.username}</span>
                      {user.puntiRankiard !== undefined && (
                        <span className="text-yellow-400 text-xs font-bold">{user.puntiRankiard}</span>
                      )}
                      {invitedUsers.has(user.username) ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium flex-shrink-0">
                          <Check size={11} /> Inviato
                        </span>
                      ) : (
                        <button
                          onClick={() => handleInvite(user.id, user.username)}
                          disabled={inviting === user.username}
                          className="flex items-center gap-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs font-semibold px-2.5 py-1 rounded-lg border border-cyan-500/20 transition-all disabled:opacity-50 flex-shrink-0"
                        >
                          <Send size={10} />
                          {inviting === user.username ? '...' : 'Invita'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-white/40 text-xs mt-2 text-center">Nessun utente trovato</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
