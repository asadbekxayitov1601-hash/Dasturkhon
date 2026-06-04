// src/app/components/DeliveryLinks.tsx
// Shows "Can't cook? Order it" section with affiliate-tracked delivery links.

import { ShoppingBag, ExternalLink, Bike } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DELIVERY_PLATFORMS } from '../lib/delivery';

interface DeliveryLinksProps {
  recipeName: string;
}

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
          <Bike className="w-4 h-4" style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            {t('delivery.cant_cook')}
          </p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {t('delivery.order_from_platforms')}
          </p>
        </div>
      </div>

      {/* Platform buttons */}
      <div className="flex flex-wrap gap-2">
        {DELIVERY_PLATFORMS.map((platform) => (
          <a
            key={platform.name}
            href={platform.searchUrl(searchQuery)}
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
      <p className="text-xs mt-3" style={{ color: 'var(--muted-foreground)' }}>
        {t('delivery.disclaimer', { dish: searchQuery })}
      </p>
    </div>
  );
}
