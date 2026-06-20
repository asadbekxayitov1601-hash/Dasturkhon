import { authFetch } from '../auth/authFetch';

// Minimal shape of the Telegram WebApp object injected when the site runs as a
// Telegram Mini App (telegram-web-app.js, loaded in index.html).
interface TelegramWebApp {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
}

export function getTelegramWebApp(): TelegramWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

// If the app is open inside Telegram, link the logged-in account to the user's
// Telegram chat so the bot can deliver notifications. No-op anywhere else.
export async function linkTelegramIfInMiniApp(): Promise<void> {
  const wa = getTelegramWebApp();
  const initData = wa?.initData;
  if (!initData) return;
  try {
    wa?.ready?.();
    await authFetch('/api/me/telegram-link', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    });
  } catch {
    /* best-effort: notifications are a nice-to-have */
  }
}
