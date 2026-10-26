"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Better Auth browser client. Same origin as the app, so the session cookie
 * (HttpOnly) rides along automatically; endpoints live under /api/auth/*.
 */
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : process.env.BETTER_AUTH_URL,
});

export type AuthClient = typeof authClient;
