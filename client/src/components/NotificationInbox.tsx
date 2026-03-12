import React, { useState, useEffect, useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";

type NotifType =
  | "fanta_invite"
  | "friend_request"
  | "game_invite"
  | "clan_request"
  | "message"
  | "achievement"
  | "market_sale"
  | "tournament"
  | "general";

interface AppNotification {
  id: number;
  userId: number;
  type: NotifType;
  title: string;
  body: string;
  data: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

interface Props {
  onNavigate?: (section: string) => void;
  socket?: Socket;
  onOpenConversation?: (conversationId: number) => void;
  onJoinGame?: (gameId: string) => void;
}

const TYPE_ICONS: Record<string, string> = {
  fanta_invite: "🏆",
  friend_request: "👤",
  game_invite: "🎮",
  clan_request: "🛡️",
  message: "💬",
  achievement: "🏅",
  market_sale: "💰",
  tournament: "🥊",
  general: "🔔",
};

const TYPE_COLORS: Record<string, string> = {
  fanta_invite: "rgba(234,179,8,0.15)",
  friend_request: "rgba(139,92,246,0.15)",
  game_invite: "rgba(59,130,246,0.15)",
  clan_request: "rgba(16,185,129,0.15)",
  message: "rgba(236,72,153,0.15)",
  achievement: "rgba(251,146,60,0.15)",
  market_sale: "rgba(234,179,8,0.12)",
  tournament: "rgba(239,68,68,0.15)",
  general: "rgba(148,163,184,0.12)",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ora";
  if (mins < 60) return `${mins}m fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h fa`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}g fa`;
  return new Date(dateStr).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function NotificationInbox({ onNavigate, socket, onOpenConversation, onJoinGame }: Props) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const authToken = () => localStorage.getItem("authToken");

  const fetchNotifs = useCallback(async () => {
    const token = authToken();
    if (!token) return;
    try {
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setNotifs(Array.isArray(data) ? data : []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifs();
    intervalRef.current = setInterval(fetchNotifs, 10000);
    const onFocus = () => fetchNotifs();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(intervalRef.current);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchNotifs]);

  useEffect(() => {
    if (!socket) return;
    const handler = (notif: AppNotification) => {
      setNotifs((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        // Play notification sound
        try {
          const audio = new Audio('/sounds/success.mp3');
          audio.volume = 0.4;
          audio.play().catch(() => {});
        } catch {}
        return [notif, ...prev];
      });
    };
    socket.on("notification:new", handler);
    return () => { socket.off("notification:new", handler); };
  }, [socket]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchNotifs().finally(() => setLoading(false));
    }
  }, [open, fetchNotifs]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const unread = notifs.filter((n) => !n.isRead).length;

  const markRead = async (id: number) => {
    const token = authToken();
    if (!token) return;
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await fetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  const markAllRead = async () => {
    const token = authToken();
    if (!token) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await fetch("/api/notifications/read-all", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  const deleteNotif = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = authToken();
    if (!token) return;
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/notifications/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  const clearAll = async () => {
    const token = authToken();
    if (!token) return;
    setNotifs([]);
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  const handleFriendRequest = async (notif: AppNotification, accept: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = authToken();
    if (!token) return;
    const requestId = notif.data?.requestId;
    if (!requestId) return;
    setActionLoading(notif.id);
    try {
      const res = await fetch(`/api/friends/requests/${requestId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      if (res.ok) {
        setNotifs((prev) => prev.map((n) =>
          n.id === notif.id
            ? { ...n, isRead: true, body: accept ? "Richiesta accettata ✅" : "Richiesta rifiutata" }
            : n
        ));
      }
    } catch {} finally {
      setActionLoading(null);
    }
  };

  const handleAcceptChallenge = async (notif: AppNotification, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = authToken();
    if (!token) return;
    setActionLoading(notif.id);
    try {
      if (notif.data?.gameId && !notif.data?.pendingChallenge) {
        markRead(notif.id);
        if (onJoinGame) onJoinGame(notif.data.gameId);
        setOpen(false);
        return;
      }

      const res = await fetch("/api/friends/invite/accept", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ senderId: notif.data?.senderId, notificationId: notif.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotifs((prev) => prev.map((n) =>
          n.id === notif.id
            ? { ...n, isRead: true, body: `Sfida accettata! Stanza: ${data.roomCode}` }
            : n
        ));
        if (data.gameId && onJoinGame) onJoinGame(data.gameId);
        setOpen(false);
      }
    } catch {} finally {
      setActionLoading(null);
    }
  };

  const handleDeclineChallenge = async (notif: AppNotification, e: React.MouseEvent) => {
    e.stopPropagation();
    markRead(notif.id);
    setNotifs((prev) => prev.map((n) =>
      n.id === notif.id ? { ...n, isRead: true, body: "Sfida rifiutata" } : n
    ));
  };

  const handleAction = (notif: AppNotification) => {
    markRead(notif.id);

    if (notif.type === "message" && notif.data?.conversationId) {
      localStorage.setItem("openConversationId", String(notif.data.conversationId));
      if (onOpenConversation) onOpenConversation(notif.data.conversationId);
      if (onNavigate) onNavigate("profile");
      setOpen(false);
      return;
    }

    const url = notif.data?.url;
    if (url && onNavigate) {
      const sectionMap: Record<string, string> = {
        "/fanta": "fanta",
        "/profilo": "profile",
        "/gioca": "play",
        "/draft": "draft",
        "/tornei": "tournaments",
        "/classifica": "leaderboard",
      };
      const section = sectionMap[url];
      if (section) { onNavigate(section); setOpen(false); return; }
    }
    setOpen(false);
  };

  const hasActionButtons = (notif: AppNotification) => {
    if (notif.type === "friend_request" && notif.data?.requestId && !notif.isRead) return true;
    if (notif.type === "game_invite" && !notif.isRead) return true;
    return false;
  };

  const TOKEN = authToken();
  if (!TOKEN) return null;

  const actionBtnStyle = (color: string): React.CSSProperties => ({
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    outline: "none",
    transition: "opacity 0.15s",
    color: "white",
    background: color,
    opacity: actionLoading !== null ? 0.5 : 1,
  });

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifiche"
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 11000,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: open
            ? "linear-gradient(135deg, #9333ea, #7c3aed)"
            : "rgba(7,11,26,0.85)",
          border: `1.5px solid ${open ? "rgba(196,148,253,0.7)" : "rgba(139,92,246,0.3)"}`,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: open
            ? "0 0 20px rgba(147,51,234,0.5)"
            : "0 2px 12px rgba(0,0,0,0.4)",
          transition: "all 0.2s",
          outline: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={open ? "white" : "rgba(192,132,252,0.9)"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: "absolute",
            top: -3,
            right: -3,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            background: "linear-gradient(135deg, #ef4444, #dc2626)",
            border: "2px solid #070b1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 800,
            color: "white",
            padding: "0 3px",
            lineHeight: 1,
          }}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10998,
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      <div
        ref={panelRef}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: Math.min(400, window.innerWidth - 16),
          zIndex: 10999,
          background: "rgba(7,9,20,0.97)",
          borderLeft: "1px solid rgba(139,92,246,0.2)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.7)",
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          willChange: "transform",
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 16px 12px",
          borderBottom: "1px solid rgba(139,92,246,0.15)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(192,132,252,0.9)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 16, color: "white", letterSpacing: "-0.01em" }}>
              Notifiche
            </span>
            {unread > 0 && (
              <span style={{
                background: "linear-gradient(135deg, #9333ea, #7c3aed)",
                color: "white",
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 20,
              }}>
                {unread} nuove
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: "rgba(139,92,246,0.12)",
                  border: "1px solid rgba(139,92,246,0.25)",
                  borderRadius: 8,
                  color: "rgba(192,132,252,0.8)",
                  fontSize: 11,
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontWeight: 600,
                  outline: "none",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                Tutte lette
              </button>
            )}
            {notifs.length > 0 && (
              <button
                onClick={clearAll}
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 8,
                  color: "rgba(239,68,68,0.7)",
                  fontSize: 11,
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontWeight: 600,
                  outline: "none",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                Elimina tutto
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: "rgba(148,163,184,0.5)",
                cursor: "pointer",
                padding: 4,
                outline: "none",
                WebkitTapHighlightColor: "transparent",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {loading && notifs.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "rgba(148,163,184,0.4)", fontSize: 13 }}>
              Caricamento...
            </div>
          ) : notifs.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
              <div style={{ color: "rgba(148,163,184,0.5)", fontSize: 13 }}>Nessuna notifica</div>
            </div>
          ) : (
            notifs.map((notif) => {
              const icon = TYPE_ICONS[notif.type] ?? "🔔";
              const bg = TYPE_COLORS[notif.type] ?? "rgba(148,163,184,0.08)";
              const showActions = hasActionButtons(notif);
              return (
                <div
                  key={notif.id}
                  onClick={() => !showActions && handleAction(notif)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "11px 14px",
                    cursor: showActions ? "default" : "pointer",
                    background: notif.isRead ? "transparent" : "rgba(139,92,246,0.05)",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    transition: "background 0.15s",
                    position: "relative",
                  }}
                >
                  {!notif.isRead && (
                    <span style={{
                      position: "absolute",
                      left: 4,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #9333ea, #c084fc)",
                      boxShadow: "0 0 6px rgba(147,51,234,0.8)",
                    }} />
                  )}

                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 17,
                    flexShrink: 0,
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    {icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: notif.isRead ? 500 : 700,
                      fontSize: 13,
                      color: notif.isRead ? "rgba(203,213,225,0.7)" : "white",
                      lineHeight: 1.3,
                      marginBottom: 2,
                    }}>
                      {notif.title}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: "rgba(148,163,184,0.55)",
                      lineHeight: 1.4,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}>
                      {notif.body}
                    </div>

                    {notif.type === "friend_request" && notif.data?.requestId && !notif.isRead && (
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button
                          onClick={(e) => handleFriendRequest(notif, true, e)}
                          disabled={actionLoading === notif.id}
                          style={actionBtnStyle("#16a34a")}
                        >
                          {actionLoading === notif.id ? "..." : "✓ Accetta"}
                        </button>
                        <button
                          onClick={(e) => handleFriendRequest(notif, false, e)}
                          disabled={actionLoading === notif.id}
                          style={actionBtnStyle("#dc2626")}
                        >
                          ✕ Rifiuta
                        </button>
                      </div>
                    )}

                    {notif.type === "game_invite" && !notif.isRead && (
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button
                          onClick={(e) => handleAcceptChallenge(notif, e)}
                          disabled={actionLoading === notif.id}
                          style={actionBtnStyle("#2563eb")}
                        >
                          {actionLoading === notif.id ? "..." : "⚔️ Accetta"}
                        </button>
                        <button
                          onClick={(e) => handleDeclineChallenge(notif, e)}
                          disabled={actionLoading === notif.id}
                          style={actionBtnStyle("#64748b")}
                        >
                          Ignora
                        </button>
                      </div>
                    )}

                    <div style={{ fontSize: 10, color: "rgba(100,116,139,0.6)", marginTop: 4 }}>
                      {timeAgo(notif.createdAt)}
                    </div>
                  </div>

                  <button
                    onClick={(e) => deleteNotif(notif.id, e)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(148,163,184,0.25)",
                      cursor: "pointer",
                      padding: "2px 4px",
                      outline: "none",
                      WebkitTapHighlightColor: "transparent",
                      flexShrink: 0,
                      marginTop: 2,
                      transition: "color 0.15s",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
