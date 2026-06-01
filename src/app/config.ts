const isDev = import.meta.env.DEV;

export const config = {
  // In development: use localhost:4000
  // In production: use your Railway backend URL (set via VITE_API_URL env var in Vercel)
  apiBaseUrl: isDev
    ? 'http://localhost:4000'
    : (import.meta.env.VITE_API_URL || ''),
};
