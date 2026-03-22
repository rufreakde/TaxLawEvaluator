import { create } from 'zustand';
import type { UserRow } from '../types/db.js';

interface AuthState {
  user: UserRow | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(data.error ?? 'Login failed');
      }
      const user = (await response.json()) as UserRow;
      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Login failed', isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      set({ user: null, isAuthenticated: false });
    }
  },

  fetchCurrentUser: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include',
      });
      if (response.ok) {
        const user = (await response.json()) as UserRow;
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
