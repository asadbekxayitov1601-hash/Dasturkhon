import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

/** Sun/Moon toggle that switches the app between light and dark mode. */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') return document.documentElement.classList.contains('dark');
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('dasturxon-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      aria-label="Toggle theme"
      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-200"
    >
      {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
