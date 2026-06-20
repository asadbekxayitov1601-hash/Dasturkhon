import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PartyPopper } from 'lucide-react';

const COLORS = ['#4A7C7E', '#D17A52', '#E6B566', '#5A9FA3', '#E94F37', '#3CAEA3', '#F6C90E', '#FF6B9D'];
const PARTICLE_COUNT = 90;
const DURATION_MS = 2600;

interface Particle {
  dx: number;
  dy: number;
  color: string;
  size: number;
  rotate: number;
  duration: number;
  shape: 'rect' | 'circle';
}

function makeParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 120 + Math.random() * 240;
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 8,
      rotate: (Math.random() - 0.5) * 720,
      duration: 1.4 + Math.random() * 0.8,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    };
  });
}

// Listens for `celebrate()` events and shows a centered message with a
// confetti / firecracker burst. Mounted once in App. Non-blocking (clicks
// pass through) and auto-dismisses.
export function Celebration() {
  const [message, setMessage] = useState<string | null>(null);
  const [burst, setBurst] = useState(0); // bump to re-key the particle field
  const particlesRef = useRef<Particle[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message?: string } | undefined;
      particlesRef.current = makeParticles();
      setMessage(detail?.message || '');
      setBurst((b) => b + 1);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), DURATION_MS);
    };
    window.addEventListener('app-celebrate', handler as EventListener);
    return () => {
      window.removeEventListener('app-celebrate', handler as EventListener);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {message !== null && (
        <motion.div
          key="celebration"
          className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none overflow-hidden"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-live="polite"
        >
          {/* Confetti / firecracker burst, emitted from the center */}
          <div key={burst} className="absolute inset-0 flex items-center justify-center">
            {particlesRef.current.map((p, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  width: p.size,
                  height: p.shape === 'rect' ? p.size * 0.5 : p.size,
                  backgroundColor: p.color,
                  borderRadius: p.shape === 'circle' ? '9999px' : '2px',
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                animate={{
                  x: p.dx,
                  y: [0, p.dy, p.dy + 80],
                  opacity: [1, 1, 0],
                  scale: [1, 1, 0.5],
                  rotate: p.rotate,
                }}
                transition={{ duration: p.duration, ease: 'easeOut' }}
              />
            ))}
          </div>

          {/* Centered message card */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            className="relative flex items-center gap-3 px-7 py-5 rounded-3xl bg-card border border-border shadow-2xl max-w-[90vw]"
          >
            <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-accent/15 shrink-0">
              <PartyPopper className="w-6 h-6 text-accent" />
            </span>
            <p className="text-base sm:text-lg font-semibold text-foreground">{message}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
