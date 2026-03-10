import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import {
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
  getExistingSubscription,
} from '../lib/pushNotifications';

const DISMISS_KEY = 'notif_prompt_dismissed_until';
const DISMISS_DAYS = 7;

interface Props {
  authToken: string | null;
}

export default function NotificationPromptBanner({ authToken }: Props) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;

    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) return;

    setVisible(true);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const reg = await registerServiceWorker();
      if (!reg) { dismiss(); return; }

      const perm = await requestNotificationPermission();
      if (perm !== 'granted') { dismiss(); return; }

      const existing = await getExistingSubscription(reg);
      const sub = existing || await subscribeToPush(reg);

      if (sub && authToken) {
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
      }

      setDone(true);
      setTimeout(() => setVisible(false), 2000);
    } catch (e) {
      console.error('[NotifBanner] error:', e);
      dismiss();
    } finally {
      setLoading(false);
    }
  };

  const dismiss = () => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9998,
      width: 'calc(100% - 32px)',
      maxWidth: 520,
      background: 'linear-gradient(135deg, #1e1b4b 0%, #1e293b 100%)',
      border: '1px solid #7c3aed',
      borderRadius: 16,
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      boxShadow: '0 8px 40px #7c3aed33',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Bell size={20} color="white" />
      </div>

      {done ? (
        <div style={{ flex: 1, color: '#22c55e', fontWeight: 700, fontSize: 14 }}>
          ✓ Notifiche attivate! Riceverai avvisi sui tornei e le partite.
        </div>
      ) : (
        <>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>
              Vuoi ricevere notifiche?
            </div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
              Tornei ufficiali, inviti alle partite e promemoria match.
            </div>
          </div>

          <button
            onClick={handleEnable}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              border: 'none', borderRadius: 10, color: 'white',
              padding: '8px 16px', fontWeight: 700, fontSize: 13,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}>
            {loading ? '...' : '🔔 Abilita'}
          </button>

          <button
            onClick={dismiss}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#64748b', padding: 4, flexShrink: 0, display: 'flex', alignItems: 'center',
            }}>
            <X size={18} />
          </button>
        </>
      )}
    </div>
  );
}
