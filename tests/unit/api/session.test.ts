import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileDto } from "@/shared/api";

const { authClient, api, fetchConfig } = vi.hoisted(() => ({
  authClient: {
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: vi.fn() },
    signOut: vi.fn(),
    getSession: vi.fn(),
  },
  api: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
  fetchConfig: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({ authClient }));
vi.mock("@/lib/api", () => ({
  api,
  API_MOCK: false,
  onAuthRequired: () => () => {},
  errorMessage: (e: unknown, f: string) => (e instanceof Error ? e.message : f),
}));
vi.mock("@/lib/api/http", () => ({ fetchConfig }));

import { useSession } from "@/lib/auth/session";
import { usePreferences } from "@/lib/store/preferences";

const profile: ProfileDto = {
  id: "u1",
  name: "Elena Marchetti",
  handle: "elena",
  email: "elena@example.org",
  role: "Music director",
  ensemble: "Cascade Youth Symphony",
  location: "",
  bio: "",
  initials: "EM",
  joinedAt: "2026-01-01T00:00:00Z",
  image: null,
  preferences: { theme: "stage", reducedMotion: true, showLabelsDefault: true, exportResolution: "4k", exportFrameRate: 30, emailOnExport: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  useSession.setState({ user: null, status: "loading", googleEnabled: false, error: null });
  usePreferences.getState().reset();
  fetchConfig.mockResolvedValue({ googleEnabled: true });
  api.getProfile.mockResolvedValue(profile);
  api.updateProfile.mockImplementation(async (patch: Partial<ProfileDto>) => ({ ...profile, ...patch }));
});

describe("useSession", () => {
  it("signs in through Better Auth, then loads the profile and preferences", async () => {
    authClient.signIn.email.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await useSession.getState().signIn("elena@example.org", "correct horse");
    expect(authClient.signIn.email).toHaveBeenCalledWith({ email: "elena@example.org", password: "correct horse" });
    expect(api.getProfile).toHaveBeenCalledTimes(1);
    const s = useSession.getState();
    expect(s.status).toBe("signed-in");
    expect(s.user?.name).toBe("Elena Marchetti");
    expect(s.error).toBeNull();
    expect(usePreferences.getState().theme).toBe("stage");
    expect(usePreferences.getState().exportResolution).toBe("4k");
    expect(usePreferences.getState().hydrated).toBe(true);
  });

  it("maps Better Auth error codes to readable messages and throws", async () => {
    authClient.signIn.email.mockResolvedValue({ data: null, error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password", status: 401 } });
    await expect(useSession.getState().signIn("x@y.z", "nope")).rejects.toThrow("That email and password don't match.");
    expect(useSession.getState().error).toBe("That email and password don't match.");
    expect(useSession.getState().status).toBe("loading");
    expect(api.getProfile).not.toHaveBeenCalled();

    authClient.signUp.email.mockResolvedValue({ data: null, error: { code: "USER_ALREADY_EXISTS", status: 422 } });
    await expect(useSession.getState().signUp({ name: "A", email: "a@b.c", password: "longenough" })).rejects.toThrow(/already exists/);
    await expect(useSession.getState().signUp({ name: "A", email: "a@b.c", password: "short" })).rejects.toThrow(/at least 8 characters/);
  });

  it("signs up, then stores ensemble and role on the profile", async () => {
    authClient.signUp.email.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await useSession.getState().signUp({ name: "Ada", email: "ada@example.org", password: "longenough", ensemble: "Analytical Engine Band", role: "Conductor" });
    expect(authClient.signUp.email).toHaveBeenCalledWith({ name: "Ada", email: "ada@example.org", password: "longenough" });
    expect(api.updateProfile).toHaveBeenCalledWith({ ensemble: "Analytical Engine Band", role: "Conductor" });
    expect(useSession.getState().status).toBe("signed-in");
    expect(useSession.getState().user?.ensemble).toBe("Analytical Engine Band");
  });

  it("hydrates from the cookie session and reads googleEnabled from /api/config", async () => {
    authClient.getSession.mockResolvedValue({ data: { session: { id: "s1" }, user: { id: "u1" } }, error: null });
    await useSession.getState().hydrate();
    expect(useSession.getState().status).toBe("signed-in");
    expect(useSession.getState().googleEnabled).toBe(true);

    authClient.getSession.mockResolvedValue({ data: null, error: null });
    api.getProfile.mockClear();
    await useSession.getState().hydrate();
    expect(useSession.getState().status).toBe("signed-out");
    expect(useSession.getState().user).toBeNull();
    expect(api.getProfile).not.toHaveBeenCalled();
  });

  it("signs out and resets preferences", async () => {
    authClient.signIn.email.mockResolvedValue({ data: {}, error: null });
    await useSession.getState().signIn("elena@example.org", "correct horse");
    authClient.signOut.mockResolvedValue({ data: { success: true }, error: null });
    await useSession.getState().signOut();
    expect(authClient.signOut).toHaveBeenCalled();
    expect(useSession.getState().status).toBe("signed-out");
    expect(usePreferences.getState().theme).toBe("program");
    expect(usePreferences.getState().hydrated).toBe(false);
  });

  it("updateProfile PUTs the patch and refreshes the user", async () => {
    authClient.signIn.email.mockResolvedValue({ data: {}, error: null });
    await useSession.getState().signIn("elena@example.org", "correct horse");
    await useSession.getState().updateProfile({ name: "Elena M." });
    expect(api.updateProfile).toHaveBeenCalledWith({ name: "Elena M." });
    expect(useSession.getState().user?.name).toBe("Elena M.");
  });
});
