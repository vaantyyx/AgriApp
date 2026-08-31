import { Capacitor } from '@capacitor/core';
import { BACKEND_URL } from '../utils/config.js';

let started = false;

/**
 * Registers this device for push and hands the FCM token to the backend so it
 * can target the signed-in user. Safe to call on every auth change — it only
 * wires listeners once.
 *
 * No-op on web. On native it still needs a Firebase project wired into the
 * Android app (google-services.json) — see MOBILE.md. Until then `register()`
 * just fails silently via the registrationError listener.
 *
 * @param {() => string|null} getAuthToken  returns the current bearer token
 * @param {(path: string) => void} [onOpen] navigate here when a notification is tapped
 */
export async function initPush(getAuthToken, onOpen) {
  if (!Capacitor.isNativePlatform() || started) return;
  started = true;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') {
    started = false; // let a later call retry if the user grants it in settings
    return;
  }

  await PushNotifications.addListener('registration', async ({ value }) => {
    const auth = getAuthToken?.();
    if (!auth) return;
    try {
      await fetch(`${BACKEND_URL}/api/push/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({ token: value, platform: Capacitor.getPlatform() }),
      });
    } catch {
      /* backend unreachable — retried on next launch */
    }
  });

  await PushNotifications.addListener('registrationError', (err) => {
    // Most commonly: google-services.json missing / Firebase not configured.
    console.warn('[push] registration failed', err?.error || err);
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const path = notification?.data?.path || notification?.data?.url;
    if (path && onOpen) onOpen(path);
  });

  await PushNotifications.register();
}
