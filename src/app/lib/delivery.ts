// Central config for food/grocery delivery deep-links and affiliate tracking.
//
// Revenue model: we earn a referral commission when a user orders ingredients
// or a dish through these links. The commission only actually pays out once you
// have an affiliate/partner agreement with each platform — at which point you
// drop the tracking query string into the matching Vite env var below and
// redeploy. Until then the links still work (and carry a utm_source so you can
// prove to partners how much traffic you send).
//
// Example env value:
//   VITE_KORZINKA_AFFILIATE="ref=DASTURKHON123&utm_medium=affiliate"

const UTM = 'utm_source=dasturkhon';

// Raw query-string suffix per platform, supplied once you have a partner deal.
const AFFILIATE: Record<PlatformKey, string> = {
  uzum: (import.meta.env.VITE_UZUM_AFFILIATE as string) || '',
  yandex: (import.meta.env.VITE_YANDEX_AFFILIATE as string) || '',
  korzinka: (import.meta.env.VITE_KORZINKA_AFFILIATE as string) || '',
};

export type PlatformKey = 'uzum' | 'yandex' | 'korzinka';

export interface DeliveryPlatform {
  key: PlatformKey;
  name: string;
  color: string;
  textColor: string;
  description: string;
  /** Build a search URL for a dish or ingredient query (already affiliated). */
  searchUrl: (query: string) => string;
}

function appendParams(url: string, ...parts: string[]): string {
  const suffix = parts.filter(Boolean).join('&');
  if (!suffix) return url;
  return url + (url.includes('?') ? '&' : '?') + suffix;
}

function build(key: PlatformKey, base: string): string {
  return appendParams(base, UTM, AFFILIATE[key]);
}

export const DELIVERY_PLATFORMS: DeliveryPlatform[] = [
  {
    key: 'uzum',
    name: 'Uzum Tezkor',
    color: '#7000FF',
    textColor: '#fff',
    description: 'uzumtezkor.uz',
    searchUrl: () => build('uzum', 'https://www.uzumtezkor.uz/'),
  },
  {
    key: 'yandex',
    name: 'Yandex Eats',
    color: '#FC3F1D',
    textColor: '#fff',
    description: 'eats.yandex.com',
    searchUrl: () => build('yandex', 'https://eats.yandex.com/en-uz/'),
  },
  {
    key: 'korzinka',
    name: 'Korzinka',
    color: '#6DBE45',
    textColor: '#fff',
    description: 'korzinka.uz',
    // Link to the site root so mobile universal links open the Korzinka app
    // (if installed); otherwise it opens the Korzinka website.
    searchUrl: () => build('korzinka', 'https://korzinka.uz/'),
  },
];
