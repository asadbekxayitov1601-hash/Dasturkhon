import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { config } from '../config';
import { authErrorMessage } from '../lib/authError';

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

/**
 * "Log in with Telegram" — renders the official Telegram Login Widget.
 * Hidden unless VITE_TELEGRAM_BOT (the bot username) is set, and the bot's
 * domain must be set to this site via @BotFather (/setdomain).
 *
 * Registering/logging in here creates a Telegram-only account (telegramId, no
 * email), so notifications for that user are delivered via the Telegram bot.
 */
export function TelegramLoginButton({ onError }: { onError?: (msg: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const auth = useAuth();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'en';

  // Keep the latest handler in a ref so the widget's global callback stays fresh.
  const handlerRef = useRef<(user: Record<string, unknown>) => void>(() => {});
  handlerRef.current = async (user) => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(authErrorMessage(data, t));
      await auth.login(data.token);
      let redirectTo = '/';
      try {
        redirectTo = sessionStorage.getItem('redirectAfterLogin') || '/';
        sessionStorage.removeItem('redirectAfterLogin');
      } catch { /* ignore */ }
      navigate(redirectTo, { replace: true });
    } catch (e: any) {
      onError?.(e.message || t('auth.err.generic'));
    }
  };

  useEffect(() => {
    if (!config.telegramBot || !ref.current) return;
    window.onTelegramAuth = (user) => handlerRef.current(user);
    const node = ref.current;
    node.innerHTML = ''; // re-render when the language changes
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', config.telegramBot);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '20');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-lang', lang); // localize the widget's button text
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    node.appendChild(script);
    return () => { node.innerHTML = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  if (!config.telegramBot) return null;

  return <div ref={ref} className="flex justify-center" />;
}
