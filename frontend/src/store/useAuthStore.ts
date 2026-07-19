"use client";

import { create } from "zustand";

export type Role = "victim" | "volunteer";

export interface AuthUser {
  userId: string;
  name: string;
  role: Role;
}

interface AuthState {
  user: AuthUser | null;
  hydrated: boolean;
  setUser: (user: AuthUser) => void;
  logout: () => void;
  hydrate: () => void;
}

const STORAGE_KEY = "sos-connect-auth";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,

  setUser: (user) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    }
    set({ user });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    set({ user: null });
  },

  hydrate: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthUser & { token?: string };
        // Discard legacy local tokens. The HTTP-only cookie is the sole auth credential.
        const { token: _legacyToken, ...user } = parsed;
        set({ user, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
}));
