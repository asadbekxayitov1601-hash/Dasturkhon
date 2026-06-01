// src/app/components/DeliveryLinks.tsx
// New file — drop into src/app/components/
// Shows "Can't cook? Order it" section with Wolt, Yandex Food, Korzinka links

import { ShoppingBag, ExternalLink, Bike } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DeliveryLinksProps {
  recipeName: string;
}

interface Platform {
  name: string;
  color: string;
  textColor: string;
  logo: string; // emoji or text logo
  buildUrl: (query: string) => string;
  description: string;
}

const PLATFORMS: Platform[] = [
  {
    name: 'Wolt',
    color: '#009DE0',
    textColor: '#fff',
    logo: '🔵',
    buildUrl: (q) =>
      `https://wolt.com/uz/uzb/tashkent/search?q=${encodeURIComponent(q)}`,
    description: 'wolt.com',
  },
  {
    name: 'Yandex Eda',
    color: '#FC3F1D',
    textColor: '#fff',
    logo: '🔴',
    buildUrl: (q) =>
      `https://eda.yandex.uz/search?text=${encodeURIComponent(q)}`,
    description: 'eda.yandex.uz',
  },
  {
    name: 'Korzinka',
    color: '#6DBE45',
    textColor: '#fff',
    logo: '🟢',
    buildUrl: (q) =>
      `https://korzinka.uz/search?query=${encodeURIComponent(q)}`,
    description: 'korzinka.uz',
  },
];

export function DeliveryLinks({ recipeName }: DeliveryLinksProps) {
  const { t } = useTranslation();

  // Use just the first 2-3 words of the recipe name for a cleaner search
  const searchQuery = recipeName.split(' ').slice(0, 3).join(' ');

  return (
    <div
      className="rounded-[24px] p-5 mt-6"
      style={{
        background: 'linear-gradient(135deg, rgba(74,124,126,0.05), rgba(230,181,102,0.07))',
        border: '1px solid rgba(74,124,126,0.15)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(74,124,126,0.12)' }}
        >
          <Bike className="w-4 h-4" style={{ color: '#4A7C7E' }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#2C3E50' }}>
            {t('delivery.cant_cook')}
          </p>
          <p className="text-xs" style={{ color: '#7A8B99' }}>
            {t('delivery.order_from_platforms')}
          </p>
        </div>
      </div>

      {/* Platform buttons */}
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((platform) => (
          <a
            key={platform.name}
            href={platform.buildUrl(searchQuery)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105 active:scale-95 shadow-sm"
            style={{
              background: platform.color,
              color: platform.textColor,
              boxShadow: `0 2px 8px ${platform.color}40`,
            }}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            {platform.name}
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-xs mt-3" style={{ color: '#7A8B99' }}>
        {t('delivery.disclaimer', { dish: searchQuery })}
      </p>
    </div>
  );
}
