import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { config } from '../config';
import { authErrorMessage } from '../lib/authError';

declare global {
  interface Window {
    google?: any;
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

// Load the Google Identity Services script once and resolve when ready.
let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google script')));
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google script'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

/** "Continue with Google" button. Renders nothing if no client ID is configured. */
export function GoogleSignInButton({ onError }: { onError?: (msg: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const auth = useAuth();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'en';
  const initializedRef = useRef(false);

  // Keep the latest callback in a ref so the init effect can run exactly once
  // (avoids "google.accounts.id.initialize() is called multiple times").
  const handlerRef = useRef<(resp: { credential?: string }) => void>(() => {});
  handlerRef.current = async (response: { credential?: string }) => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
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
    if (!config.googleClientId) return;
    let cancelled = false;

    loadGis()
      .then(() => {
        if (cancelled || !ref.current || !window.google?.accounts?.id) return;
        // initialize() only once; re-render the button when the language changes.
        if (!initializedRef.current) {
          window.google.accounts.id.initialize({
            client_id: config.googleClientId,
            callback: (resp: { credential?: string }) => handlerRef.current(resp),
          });
          initializedRef.current = true;
        }
        ref.current.innerHTML = ''; // clear any previously rendered button
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          width: ref.current.offsetWidth || 320,
          text: 'continue_with',
          shape: 'pill',
          locale: lang,
        });
      })
      .catch(() => onError?.(t('auth.err.generic')));

    return () => { cancelled = true; };
    // Re-render the Google button when the app language changes; handler is read
    // via ref so it stays fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  if (!config.googleClientId) return null;

  return <div ref={ref} className="w-full flex justify-center" />;
}
