import type { TFunction } from 'i18next';

/**
 * Map an auth API error response to a translated, user-facing message.
 * The backend returns a stable `code` (e.g. "invalid_credentials"); we look up
 * `auth.err.<code>`. Falls back to the server message, then a generic string.
 */
export function authErrorMessage(data: unknown, t: TFunction): string {
  const obj = (data && typeof data === 'object') ? (data as Record<string, unknown>) : {};
  const code = typeof obj.code === 'string' ? obj.code : '';
  if (code) {
    const key = `auth.err.${code}`;
    const translated = t(key);
    if (translated !== key) return translated; // a translation exists
  }
  if (typeof obj.message === 'string' && obj.message) return obj.message;
  return t('auth.err.generic');
}
