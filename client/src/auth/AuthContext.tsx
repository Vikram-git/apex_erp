import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onSessionExpired, refreshSession, setAccessToken } from '../api/client';
import type { Session, UserProfile } from '../api/types';
import { hasPermission } from './permissions';

interface AuthContextValue {
  user: UserProfile | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;
    refreshSession().then((session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setInitializing(false);
    });
    onSessionExpired(() => {
      setAccessToken(null);
      setUser(null);
      queryClient.clear();
    });
    return () => {
      active = false;
    };
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<Session>('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const can = useCallback((permission: string) => hasPermission(user?.permissions, permission), [user]);

  const value = useMemo(() => ({ user, initializing, login, logout, can }), [user, initializing, login, logout, can]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
