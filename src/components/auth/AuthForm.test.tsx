import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES, type ProfileDto } from "@/shared/api";

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => "/sign-in" }));

// Better Auth's browser client and the HTTP API are the session store's only I/O.
const authClient = vi.hoisted(() => ({
  signIn: { email: vi.fn(), social: vi.fn() },
  signUp: { email: vi.fn() },
  signOut: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("@/lib/auth/client", () => ({ authClient }));
vi.mock("@/lib/api/http", () => ({ fetchConfig: vi.fn(async () => ({ googleEnabled: false })) }));
const api = vi.hoisted(() => ({ getProfile: vi.fn(), updateProfile: vi.fn() }));
vi.mock("@/lib/api", () => ({ api, API_MOCK: false, onAuthRequired: () => () => {} }));

import { useSession } from "@/lib/auth/session";
import { SignInForm, SignUpForm } from "./AuthForm";
import { safeNext } from "./next";

const PROFILE: ProfileDto = {
  id: "7",
  name: "Ada Brahms",
  handle: "ada-brahms",
  email: "ada@example.org",
  role: "Conductor",
  ensemble: "",
  location: "",
  bio: "",
  initials: "AB",
  joinedAt: "2026-10-01T00:00:00.000Z",
  image: null,
  preferences: DEFAULT_PREFERENCES,
};

beforeEach(() => {
  vi.clearAllMocks();
  useSession.setState({ user: null, status: "signed-out", googleEnabled: false, error: null });
});

describe("SignInForm", () => {
  it("submits the email and password, then goes to `next`", async () => {
    const user = userEvent.setup();
    authClient.signIn.email.mockResolvedValue({ data: { user: {} }, error: null });
    api.getProfile.mockResolvedValue(PROFILE);
    render(<SignInForm next="/programs/3" />);

    await user.type(screen.getByLabelText("Email"), "ada@example.org");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/programs/3"));
    expect(authClient.signIn.email).toHaveBeenCalledWith({ email: "ada@example.org", password: "correct horse" });
    expect(useSession.getState().status).toBe("signed-in");
  });

  it("goes to the library when there is no `next`", async () => {
    const user = userEvent.setup();
    authClient.signIn.email.mockResolvedValue({ data: { user: {} }, error: null });
    api.getProfile.mockResolvedValue(PROFILE);
    render(<SignInForm />);

    await user.type(screen.getByLabelText("Email"), "ada@example.org");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/library"));
  });

  it("shows the readable error and stays on the page", async () => {
    const user = userEvent.setup();
    authClient.signIn.email.mockResolvedValue({ data: null, error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password", status: 401 } });
    render(<SignInForm />);

    await user.type(screen.getByLabelText("Email"), "ada@example.org");
    await user.type(screen.getByLabelText("Password"), "wrong password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password don't match.");
    expect(nav.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("shows the Google button only when the server has Google configured", () => {
    render(<SignInForm />);
    expect(screen.queryByRole("button", { name: /google/i })).not.toBeInTheDocument();

    act(() => useSession.setState({ googleEnabled: true }));
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
  });

  it("links to sign-up and keeps `next`", () => {
    render(<SignInForm next="/settings" />);
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/sign-up?next=%2Fsettings");
  });
});

describe("SignUpForm", () => {
  it("rejects a short password next to the field without calling the server", async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText("Name"), "Ada Brahms");
    await user.type(screen.getByLabelText("Email"), "ada@example.org");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAccessibleDescription("Use at least 8 characters.");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveFocus();
    expect(authClient.signUp.email).not.toHaveBeenCalled();
  });

  it("creates the account with the optional fields and goes on", async () => {
    const user = userEvent.setup();
    authClient.signUp.email.mockResolvedValue({ data: { user: {} }, error: null });
    api.updateProfile.mockResolvedValue({ ...PROFILE, ensemble: "Cascade Youth" });
    render(<SignUpForm next="/programs" />);

    await user.type(screen.getByLabelText("Name"), "Ada Brahms");
    await user.type(screen.getByLabelText("Email"), "ada@example.org");
    await user.type(screen.getByLabelText("Password"), "long enough");
    await user.type(screen.getByLabelText("Ensemble or school"), "Cascade Youth");
    await user.selectOptions(screen.getByLabelText("Role"), "Conductor");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/programs"));
    expect(authClient.signUp.email).toHaveBeenCalledWith({ name: "Ada Brahms", email: "ada@example.org", password: "long enough" });
    expect(api.updateProfile).toHaveBeenCalledWith({ ensemble: "Cascade Youth", role: "Conductor" });
  });
});

describe("safeNext", () => {
  it("keeps same-origin paths only", () => {
    expect(safeNext("/projects/4/sync")).toBe("/projects/4/sync");
    expect(safeNext(["/library?q=1", "/x"])).toBe("/library?q=1");
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("/sign-in?next=/library")).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});
