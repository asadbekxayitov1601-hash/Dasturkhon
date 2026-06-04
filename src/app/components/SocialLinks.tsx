import { Instagram, Youtube, Facebook, Send, Music2, Globe } from 'lucide-react';
import type { SocialLinks } from '../api/chefApi';

type Platform = keyof SocialLinks;

const PLATFORMS: { key: Platform; label: string; placeholder: string; Icon: typeof Instagram }[] = [
  { key: 'instagram', label: 'Instagram', placeholder: '@username', Icon: Instagram },
  { key: 'telegram', label: 'Telegram', placeholder: '@username', Icon: Send },
  { key: 'youtube', label: 'YouTube', placeholder: '@channel', Icon: Youtube },
  { key: 'tiktok', label: 'TikTok', placeholder: '@username', Icon: Music2 },
  { key: 'facebook', label: 'Facebook', placeholder: 'username', Icon: Facebook },
  { key: 'website', label: 'Website', placeholder: 'https://example.com', Icon: Globe },
];

/** Turn a stored handle/URL into a full clickable URL. */
export function socialUrl(platform: Platform, value: string): string {
  const v = value.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, '');
  switch (platform) {
    case 'instagram': return `https://instagram.com/${handle}`;
    case 'telegram': return `https://t.me/${handle}`;
    case 'youtube': return `https://youtube.com/@${handle}`;
    case 'tiktok': return `https://tiktok.com/@${handle}`;
    case 'facebook': return `https://facebook.com/${handle}`;
    case 'website': return `https://${handle}`;
    default: return v;
  }
}

/** Row of circular icon links. Renders nothing if there are no links. */
export function SocialLinksDisplay({ links, size = 'md' }: { links?: SocialLinks; size?: 'sm' | 'md' }) {
  if (!links) return null;
  const entries = PLATFORMS.filter(p => links[p.key]);
  if (entries.length === 0) return null;
  const box = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
  const icon = size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]';
  return (
    <div className="flex flex-wrap items-center gap-2">
      {entries.map(({ key, label, Icon }) => (
        <a
          key={key}
          href={socialUrl(key, links[key] as string)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className={`${box} rounded-full flex items-center justify-center text-white bg-gradient-to-br from-primary to-primary/80 hover:scale-110 hover:shadow-lg transition-all`}
        >
          <Icon className={icon} />
        </a>
      ))}
    </div>
  );
}

/** Stacked inputs for editing each social platform. */
export function SocialLinksEditor({
  value,
  onChange,
}: {
  value: SocialLinks;
  onChange: (next: SocialLinks) => void;
}) {
  return (
    <div className="space-y-2">
      {PLATFORMS.map(({ key, label, placeholder, Icon }) => (
        <div key={key} className="flex items-center gap-2">
          <div className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center bg-muted text-primary">
            <Icon className="w-[18px] h-[18px]" />
          </div>
          <input
            type="text"
            value={value[key] ?? ''}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            placeholder={`${label} — ${placeholder}`}
            className="flex-1 px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      ))}
    </div>
  );
}
