import { Heart, Instagram, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SOCIALS = [
  { name: 'Instagram', Icon: Instagram, url: 'https://www.instagram.com/dasturkhonhub?igsh=c2k2Nm54dGRsMzc=' },
  { name: 'Telegram', Icon: Send, url: 'https://t.me/dasturkhonhub' },
];

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-white/50 backdrop-blur-sm border-t border-primary/10 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-2 text-center md:text-left">
            <p className="text-sm text-gray-600 flex items-center justify-center md:justify-start gap-2">
              {t('footer.made_with')} <Heart className="w-4 h-4 text-secondary fill-secondary" /> {t('footer.for_lovers')}
            </p>
            <p className="text-sm text-gray-500">
              {t('footer.rights')}
            </p>
          </div>

          {/* Company social links */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-gray-500">{t('footer.follow_us')}</p>
            <div className="flex items-center gap-2">
              {SOCIALS.map(({ name, Icon, url }) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={name}
                  title={name}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white bg-gradient-to-br from-primary to-primary/80 hover:scale-110 hover:shadow-lg transition-all"
                >
                  <Icon className="w-[18px] h-[18px]" />
                </a>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end gap-1 text-sm text-gray-600">
            <p>{t('footer.email')}: <a href="mailto:dasturkhon.uz@gmail.com" className="hover:text-primary transition-colors font-medium">dasturkhon.uz@gmail.com</a></p>
            <p>{t('footer.phone')}: <a href="tel:+998917220044" className="hover:text-primary transition-colors font-medium">+998917220044</a></p>
          </div>
        </div>
      </div>
    </footer>
  );
}
