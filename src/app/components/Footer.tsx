import { Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-white/50 backdrop-blur-sm border-t border-primary/10 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-2 text-center md:text-left">
            <p className="text-sm text-gray-600 flex items-center justify-center md:justify-start gap-2">
              Made with <Heart className="w-4 h-4 text-secondary fill-secondary" /> for Uzbek cuisine lovers
            </p>
            <p className="text-sm text-gray-500">
              © 2026 Dasturkhon. All rights reserved.
            </p>
          </div>

          <div className="flex flex-col items-center md:items-end gap-1 text-sm text-gray-600">
            <p>Email: <a href="mailto:dasturkhon.uz@gmail.com" className="hover:text-primary transition-colors font-medium">asadbekxayitov2010@gmail.com</a></p>
            <p>Phone: <a href="tel:+998917220044" className="hover:text-primary transition-colors font-medium">+998917220044</a></p>
          </div>
        </div>
      </div>
    </footer>
  );
}
