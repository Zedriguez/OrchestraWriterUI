"use client";

import { create } from "zustand";
import type { Director } from "@/shared/domain";
import { DEMO_DIRECTOR } from "@/lib/mock/library";

/**
 * Auth adapter. ADR 0004 names Clerk; these pages are designed as custom
 * forms so Clerk Elements (or `useSignIn` / `useSignUp`) can be wired in
 * without changing the layout. Until then a demo session is always present.
 */
interface SessionState {
  user: Director | null;
  status: "signed-in" | "signed-out";
  signIn: (email: string) => Promise<void>;
  signUp: (input: { name: string; email: string; ensemble: string; role: Director["role"] }) => Promise<void>;
  signOut: () => void;
  updateProfile: (patch: Partial<Director>) => void;
}

export const useSession = create<SessionState>((set) => ({
  user: DEMO_DIRECTOR,
  status: "signed-in",
  signIn: async () => {
    await new Promise((r) => setTimeout(r, 650));
    set({ user: DEMO_DIRECTOR, status: "signed-in" });
  },
  signUp: async (input) => {
    await new Promise((r) => setTimeout(r, 800));
    const initials = input.name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    set({
      user: { ...DEMO_DIRECTOR, name: input.name, email: input.email, ensemble: input.ensemble, role: input.role, initials, handle: input.email.split("@")[0] },
      status: "signed-in",
    });
  },
  signOut: () => set({ user: null, status: "signed-out" }),
  updateProfile: (patch) => set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),
}));
