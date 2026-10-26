"use client";

import { useEffect } from "react";
import { useSession } from "./session";

let started = false;

/**
 * Mount once near the root (phase 2 adds it to the layouts). Loads the cookie
 * session and profile into `useSession`; guarded so nested layouts and React
 * StrictMode never hydrate twice.
 */
export function SessionHydrator() {
  useEffect(() => {
    if (started) return;
    started = true;
    void useSession.getState().hydrate();
  }, []);
  return null;
}
