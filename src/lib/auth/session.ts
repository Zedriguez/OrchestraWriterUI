"use client";

import { create } from "zustand";
import type { Director } from "@/shared/domain";
import type { ProfileDto, ProfileUpdate } from "@/shared/api";
import { api, API_MOCK, onAuthRequired } from "@/lib/api";
import { fetchConfig } from "@/lib/api/http";
import { usePreferences } from "@/lib/store/preferences";
import { authClient } from "./client";

/**
 * Session store. Better Auth owns sign-in/up/out (cookie session); the app
 * profile (`ProfileDto` from GET /api/me) is what pages render. In mock mode
 * (NEXT_PUBLIC_API_MOCK=1) the demo director is always signed in.
 */
export type SessionStatus = "loading" | "signed-in" | "signed-out";

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  ensemble?: string;
  role?: Director["role"];
}

export interface SessionState {
  user: ProfileDto | null;
  status: SessionStatus;
  googleEnabled: boolean;
  /** last readable auth error (also thrown from signIn / signUp) */
  error: string | null;
  /** GET /api/auth/get-session → GET /api/me, plus GET /api/config */
  hydrate: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  /** redirects to Google; the session appears on return */
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<void>;
}

const MIN_PASSWORD = 8;

interface AuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

/** Better Auth error codes → sentences a director can act on. */
export function readableAuthError(error: AuthErrorLike | null | undefined, fallback: string): string {
  switch (error?.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_PASSWORD":
    case "USER_NOT_FOUND":
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return "That email and password don't match.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Sign in instead.";
    case "PASSWORD_TOO_SHORT":
      return `Use a password of at least ${MIN_PASSWORD} characters.`;
    case "PASSWORD_TOO_LONG":
      return "That password is too long.";
    case "INVALID_EMAIL":
      return "Enter a valid email address.";
    case "EMAIL_NOT_VERIFIED":
      return "Verify your email address before signing in.";
    default:
      return error?.message || fallback;
  }
}

export const useSession = create<SessionState>((set, get) => {
  const applyProfile = (profile: ProfileDto | null, patch: Partial<SessionState> = {}) => {
    if (profile) usePreferences.getState().hydrateFrom(profile.preferences);
    else usePreferences.getState().reset();
    set({ user: profile, status: profile ? "signed-in" : "signed-out", ...patch });
  };

  const loadProfile = async () => {
    const profile = await api.getProfile();
    applyProfile(profile);
    return profile;
  };

  const fail = (error: AuthErrorLike | null | undefined, fallback: string): never => {
    const message = readableAuthError(error, fallback);
    set({ error: message });
    throw new Error(message);
  };

  return {
    user: null,
    status: "loading",
    googleEnabled: false,
    error: null,

    hydrate: async () => {
      if (API_MOCK) {
        const profile = await api.getProfile().catch(() => null);
        applyProfile(profile, { googleEnabled: false, error: null });
        return;
      }
      const config = fetchConfig().catch(() => ({ googleEnabled: false }));
      try {
        const { data } = await authClient.getSession();
        const { googleEnabled } = await config;
        if (!data) {
          applyProfile(null, { googleEnabled, error: null });
          return;
        }
        const profile = await api.getProfile();
        applyProfile(profile, { googleEnabled, error: null });
      } catch {
        applyProfile(null, { googleEnabled: (await config).googleEnabled });
      }
    },

    signIn: async (email, password) => {
      set({ error: null });
      if (API_MOCK) {
        await loadProfile();
        return;
      }
      const { error } = await authClient.signIn.email({ email, password });
      if (error) fail(error, "Could not sign in.");
      const profile = await loadProfile();
      if (!profile) fail(null, "Signed in, but the profile could not be loaded.");
    },

    signUp: async ({ name, email, password, ensemble, role }) => {
      set({ error: null });
      if (API_MOCK) {
        await api.updateProfile({ name, ensemble, role });
        await loadProfile();
        return;
      }
      if (password.length < MIN_PASSWORD) fail({ code: "PASSWORD_TOO_SHORT" }, "");
      const { error } = await authClient.signUp.email({ name, email, password });
      if (error) fail(error, "Could not create the account.");
      const extras: ProfileUpdate = {};
      if (ensemble) extras.ensemble = ensemble;
      if (role) extras.role = role;
      let profile: ProfileDto | null = null;
      if (Object.keys(extras).length > 0) {
        profile = await api.updateProfile(extras).catch(() => null);
      }
      if (profile) applyProfile(profile);
      else profile = await loadProfile();
      if (!profile) fail(null, "Account created, but the profile could not be loaded.");
    },

    signInWithGoogle: async () => {
      set({ error: null });
      if (API_MOCK) {
        await loadProfile();
        return;
      }
      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const next = params?.get("next");
      const callbackURL = next && next.startsWith("/") ? next : "/library";
      const { error } = await authClient.signIn.social({ provider: "google", callbackURL });
      if (error) fail(error, "Google sign-in is unavailable right now.");
    },

    signOut: async () => {
      if (!API_MOCK) {
        try {
          await authClient.signOut();
        } catch {
          /* the cookie may already be gone; the UI signs out regardless */
        }
      }
      applyProfile(null, { error: null });
    },

    updateProfile: async (patch) => {
      const profile = await api.updateProfile(patch);
      if (get().status === "signed-in" || API_MOCK) applyProfile(profile);
    },
  };
});

// A 401 from any API call means the cookie session is gone: reflect it everywhere.
onAuthRequired(() => {
  if (useSession.getState().status === "signed-in") {
    usePreferences.getState().reset();
    useSession.setState({ user: null, status: "signed-out" });
  }
});
