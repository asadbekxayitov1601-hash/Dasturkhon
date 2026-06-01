// Decide the API base URL at RUNTIME from the hostname, not from the build's
// mode. Vite's `import.meta.env.DEV` depends on NODE_ENV at build time, which
// can be misconfigured on the host (e.g. NODE_ENV set to a non-"production"
// value would wrongly flip the app into dev mode and point it at localhost).
// Checking the hostname avoids that whole class of problem.
const isLocalhost =
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

export const config = {
  // Priority:
  // 1. Explicit VITE_API_URL override, if ever set.
  // 2. Local development -> talk directly to the local backend on :4000.
  // 3. Any deployed environment -> relative base ('') so requests hit the same
  //    origin, where vercel.json rewrites /api/* to the Railway backend
  //    (same-origin, no CORS).
  apiBaseUrl:
    import.meta.env.VITE_API_URL || (isLocalhost ? 'http://localhost:4000' : ''),
};
