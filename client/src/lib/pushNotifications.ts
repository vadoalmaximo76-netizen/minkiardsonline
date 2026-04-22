const VAPID_PUBLIC_KEY = 'BFRPyWrRZU7M4nFlJ3wI1fVKSRXaLDpJSBBNL4TmEYZ-jbn4BckvvfgnowU1Oa6Oj3z20OEVV841a3bUx_TRUQk';

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('[Push] Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[Push] Service Worker registered:', registration.scope);
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.error('[Push] Service Worker registration failed:', error);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.log('[Push] Notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  console.log('[Push] Notification permission:', permission);
  return permission;
}

export function getNotificationPermission(): NotificationPermission | null {
  if (!('Notification' in window)) {
    return null;
  }
  return Notification.permission;
}

export async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    console.log('[Push] Push subscription created:', subscription.endpoint);
    return subscription;
  } catch (error) {
    console.error('[Push] Failed to subscribe to push:', error);
    return null;
  }
}

export async function unsubscribeFromPush(registration: ServiceWorkerRegistration): Promise<boolean> {
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Push] Failed to unsubscribe from push:', error);
    return false;
  }
}

export async function getExistingSubscription(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  try {
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('[Push] Failed to get subscription:', error);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function showLocalNotification(title: string, body: string, tag?: string): void {
  if (Notification.permission === 'granted') {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body,
          icon: '/icons/icon-192x192.png',
          tag: tag || 'minkiards-local',
          vibrate: [100, 50, 100]
        });
      });
    } else {
      new Notification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        tag: tag || 'minkiards-local'
      });
    }
  }
}
