import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Check, X } from 'lucide-react';
import { Button } from './ui/button';
import {
  registerServiceWorker,
  requestNotificationPermission,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getExistingSubscription
} from '../lib/pushNotifications';

interface NotificationSettingsProps {
  authToken: string | null;
}

export default function NotificationSettings({ authToken }: NotificationSettingsProps) {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    initNotifications();
  }, []);

  const initNotifications = async () => {
    setLoading(true);
    const currentPermission = getNotificationPermission();
    setPermission(currentPermission);

    const reg = await registerServiceWorker();
    setRegistration(reg);

    if (reg && currentPermission === 'granted') {
      const subscription = await getExistingSubscription(reg);
      setIsSubscribed(!!subscription);
    }
    setLoading(false);
  };

  const handleEnableNotifications = async () => {
    setLoading(true);
    
    const perm = await requestNotificationPermission();
    setPermission(perm);

    if (perm === 'granted' && registration) {
      const subscription = await subscribeToPush(registration);
      
      if (subscription && authToken) {
        try {
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify({ subscription: subscription.toJSON() })
          });
          setIsSubscribed(true);
        } catch (error) {
          console.error('Failed to save subscription:', error);
        }
      }
    }
    setLoading(false);
  };

  const handleDisableNotifications = async () => {
    setLoading(true);
    
    if (registration) {
      const subscription = await getExistingSubscription(registration);
      
      if (subscription && authToken) {
        try {
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify({ endpoint: subscription.endpoint })
          });
        } catch (error) {
          console.error('Failed to remove subscription:', error);
        }
      }
      
      await unsubscribeFromPush(registration);
      setIsSubscribed(false);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg">
        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-purple-500"></div>
        <span className="text-gray-400">Caricamento...</span>
      </div>
    );
  }

  if (permission === null) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-900/30 rounded-lg border border-red-500/30">
        <X className="w-5 h-5 text-red-400" />
        <span className="text-red-300">Notifiche non supportate</span>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="p-3 bg-amber-900/30 rounded-lg border border-amber-500/30">
        <div className="flex items-center gap-2 mb-2">
          <BellOff className="w-5 h-5 text-amber-400" />
          <span className="text-amber-300 font-medium">Notifiche bloccate</span>
        </div>
        <p className="text-sm text-amber-200/70">
          Le notifiche sono state bloccate. Abilita le notifiche nelle impostazioni del browser.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-800/50 rounded-lg border border-purple-500/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSubscribed ? (
            <Bell className="w-6 h-6 text-green-400" />
          ) : (
            <BellOff className="w-6 h-6 text-gray-400" />
          )}
          <div>
            <h3 className="text-white font-medium">Notifiche Push</h3>
            <p className="text-sm text-gray-400">
              {isSubscribed 
                ? 'Riceverai notifiche per messaggi e inviti'
                : 'Attiva le notifiche per non perdere nulla'
              }
            </p>
          </div>
        </div>
        
        {isSubscribed ? (
          <Button
            onClick={handleDisableNotifications}
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/20"
          >
            Disattiva
          </Button>
        ) : (
          <Button
            onClick={handleEnableNotifications}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Attiva
          </Button>
        )}
      </div>
    </div>
  );
}
