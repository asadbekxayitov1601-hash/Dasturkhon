import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNotifications, markNotificationsRead, AppNotification } from '../api/notificationsApi';

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking anywhere outside the bell/dropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const load = async () => {
    try {
      const d = await getNotifications();
      setItems(d.items);
      setUnread(d.unread);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60000); // poll every minute
    return () => clearInterval(id);
  }, []);

  const toggle = async () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && unread > 0) {
      setUnread(0);
      try {
        await markNotificationsRead();
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      } catch {
        /* ignore */
      }
    }
  };

  const go = (n: AppNotification) => {
    setOpen(false);
    navigate(`/chef/${n.actorId}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label={t('notif.title')}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-700"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl bg-white shadow-xl border border-primary/10 z-50 p-1.5"
            >
              <p className="px-3 py-2 text-sm font-semibold text-gray-900">{t('notif.title')}</p>
              {items.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-gray-400">{t('notif.empty')}</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => go(n)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors flex gap-2 ${n.read ? '' : 'bg-primary/5'}`}
                  >
                    <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: n.read ? 'transparent' : 'var(--primary)' }} />
                    <span className="text-sm text-gray-700 leading-snug">
                      <span className="font-medium">{t('notif.new_recipe', { name: n.actorName || t('chef.anonymous') })}</span>
                      {n.recipeTitle && <span className="text-gray-500">: {n.recipeTitle}</span>}
                    </span>
                  </button>
                ))
              )}
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
