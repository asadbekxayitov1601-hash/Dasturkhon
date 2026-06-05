import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { config } from '../config';

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
      if (!res.ok) throw new Error(data.message || 'Google sign-in failed');
      await auth.login(data.token);
      let redirectTo = '/';
      try {
        redirectTo = sessionStorage.getItem('redirectAfterLogin') || '/';
        sessionStorage.removeItem('redirectAfterLogin');
      } catch { /* ignore */ }
      navigate(redirectTo, { replace: true });
    } catch (e: any) {
      onError?.(e.message || 'Google sign-in failed');
    }
  };

  useEffect(() => {
    if (!config.googleClientId) return;
    let cancelled = false;

    loadGis()
      .then(() => {
        if (cancelled || !ref.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: (resp: { credential?: string }) => handlerRef.current(resp),
        });
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          width: ref.current.offsetWidth || 320,
          text: 'continue_with',
          shape: 'pill',
        });
      })
      .catch(() => onError?.('Could not load Google sign-in'));

    return () => { cancelled = true; };
    // Run once on mount — handler is read via ref so it stays fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!config.googleClientId) return null;

  return <div ref={ref} className="w-full flex justify-center" />;
}
