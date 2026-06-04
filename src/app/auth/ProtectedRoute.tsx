import React from 'react';
import { useAuth } from './AuthProvider';
import { PanLoader } from '../components/PanLoader';

// Pure render guard. The actual redirect for unauthenticated users happens at
// the top of AnimatedRoutes (outside AnimatePresence) to avoid framer-motion
// deadlocks, so by the time this renders the user is present (or still loading).
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <PanLoader />
      </div>
    );
  }
  return <>{children}</>;
}
