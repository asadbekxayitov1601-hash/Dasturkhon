const isDev = import.meta.env.DEV;

export const config = {
  // In development: talk directly to the local backend on localhost:4000.
  // In production: use a relative base ('') so requests go to the same Vercel
  // origin, where vercel.json rewrites /api/* to the Railway backend. This
  // keeps everything same-origin and avoids CORS entirely.
  // (An explicit VITE_API_URL still overrides this if ever needed.)
  apiBaseUrl: isDev
    ? 'http://localhost:4000'
    : (import.meta.env.VITE_API_URL || ''),
};
