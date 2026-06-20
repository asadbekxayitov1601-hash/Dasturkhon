import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
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
      dy: Math.sin(angle) * distance + 60, // slight downward drift (gravity)
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 8,
      rotate: (Math.random() - 0.5) * 720,
      duration: 1.4 + Math.random() * 0.8,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    };
  });
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

interface Burst {
  id: number;
  message: string;
  particles: Particle[];
}

// Listens for `celebrate()` events and shows a centered message with a
// confetti / firecracker burst. Mounted once in App. Non-blocking (clicks pass
// through), auto-dismisses, and respects prefers-reduced-motion.
export function Celebration() {
  const [burst, setBurst] = useState<Burst | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let counter = 0;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message?: string } | undefined;
      counter += 1;
      setBurst({
        id: counter,
        message: detail?.message || '',
        particles: prefersReducedMotion() ? [] : makeParticles(),
      });
    };
    window.addEventListener('app-celebrate', handler as EventListener);
    return () => window.removeEventListener('app-celebrate', handler as EventListener);
  }, []);

  // Auto-dismiss with a brief fade-out; re-arms whenever a new burst arrives.
  useEffect(() => {
    if (!burst) return;
    setLeaving(false);
    const fade = setTimeout(() => setLeaving(true), DURATION_MS - 350);
    const remove = setTimeout(() => setBurst(null), DURATION_MS);
    return () => { clearTimeout(fade); clearTimeout(remove); };
  }, [burst?.id]);

  if (!burst) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none overflow-hidden"
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.35 }}
    >
      {/* Confetti / firecracker burst, emitted from the center.
          Plain divs animated purely in CSS (GPU) so 90+ pieces stay smooth. */}
      <div className="absolute inset-0 flex items-center justify-center">
        {burst.particles.map((p, i) => (
          <div
            key={`${burst.id}-${i}`}
            className="dx-confetti-piece absolute"
            style={{
              width: p.size,
              height: p.shape === 'rect' ? p.size * 0.5 : p.size,
              backgroundColor: p.color,
              borderRadius: p.shape === 'circle' ? '9999px' : '2px',
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rotate}deg`,
              '--dur': `${p.duration}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Centered message card */}
      <motion.div
        key={burst.id}
        initial={{ scale: 0.6, opacity: 0, y: 10 }}
        animate={leaving ? { scale: 0.9, opacity: 0, y: 0 } : { scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        className="relative flex items-center gap-3 px-7 py-5 rounded-3xl bg-card border border-border shadow-2xl max-w-[90vw]"
        role="status"
        aria-live="polite"
      >
        <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-accent/15 shrink-0">
          <PartyPopper className="w-6 h-6 text-accent" />
        </span>
        <p className="text-base sm:text-lg font-semibold text-foreground">{burst.message}</p>
      </motion.div>
    </motion.div>
  );
}
