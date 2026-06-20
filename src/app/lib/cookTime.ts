// Cook time is stored canonically as a string of total minutes (e.g. "90").
// Legacy recipes may hold freeform strings ("45 min", "1 soat") — those are
// shown as-is. New recipes use hours + minutes inputs combined into minutes.

type TFunc = (key: string) => string;

const isCanonical = (value?: string | null): value is string =>
  typeof value === 'string' && /^\d+$/.test(value.trim());

export function parseCookTime(value?: string | null): { hours: number; minutes: number } {
  if (!isCanonical(value)) return { hours: 0, minutes: 0 };
  const total = Math.max(0, parseInt(value.trim(), 10));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export function composeCookTime(hours: number, minutes: number): string {
  const total = Math.max(0, (Number(hours) || 0) * 60 + (Number(minutes) || 0));
  return String(total);
}

// Localized display. Falls back to the raw string for legacy freeform values.
export function formatCookTime(value: string | undefined | null, t: TFunc): string {
  if (value == null || value === '') return '';
  const raw = String(value).trim();
  if (!isCanonical(raw)) return raw; // legacy freeform — show unchanged
  const total = Math.max(0, parseInt(raw, 10));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${t('recipes.unit_h')}`);
  if (m > 0 || h === 0) parts.push(`${m} ${t('recipes.unit_min')}`);
  return parts.join(' ');
}
