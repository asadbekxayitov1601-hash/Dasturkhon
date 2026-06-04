import React, { createContext, useContext, useEffect, useState } from 'react';

import { authFetch } from './authFetch';
import type { SocialLinks } from '../api/chefApi';

interface User {
  id: number | string;
  email: string;
  name?: string;
  isAdmin?: boolean;
  isPro?: boolean;
  photoURL?: string;
  avatarUrl?: string;
  bio?: string;
  socialLinks?: SocialLinks;
  cardLast4?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('authToken'));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(!!token);

  const fetchMe = async (tkn?: string) => {
    const tok = tkn ?? token;
    if (!tok) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // We pass token explicitly to authFetch headers if needed, but authFetch reads from localStorage.
      // Since token might not be in localStorage yet during login flow if we just called setToken but state hasn't updated or we just have tkn arg.
      // Actually authFetch reads localStorage. So for login(token), we set localStorage first.

      // However, authFetch reads localStorage. let's rely on it or pass headers manually.
      // authFetch implementation: 
      // const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

      const res = await authFetch('/api/me', {
        headers: { Authorization: `Bearer ${tok}` }
      });

      if (!res.ok) {
        setUser(null);
        setToken(null);
        localStorage.removeItem('authToken');
      } else {
        const data = await res.json();
        setUser(data.user ?? null);
      }
    } catch (e) {
      setUser(null);
      setToken(null);
      localStorage.removeItem('authToken');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchMe(token);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (tkn: string) => {
    setToken(tkn);
    localStorage.setItem('authToken', tkn);
    await fetchMe(tkn);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
  };

  const refresh = async () => {
    await fetchMe();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
