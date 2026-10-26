import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES, type ProfileDto, type UsageDto } from "@/shared/api";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => "/settings" }));
vi.mock("@/lib/auth/client", () => ({ authClient: { signIn: {}, signUp: {}, signOut: vi.fn(), getSession: vi.fn() } }));
vi.mock("@/lib/api/http", () => ({ fetchConfig: vi.fn(async () => ({ googleEnabled: false })) }));
const api = vi.hoisted(() => ({ getUsage: vi.fn(), deleteAccount: vi.fn(), updateProfile: vi.fn(), getProfile: vi.fn() }));
vi.mock("@/lib/api", () => ({ api, API_MOCK: false, onAuthRequired: () => () => {} }));

import { useSession } from "@/lib/auth/session";
import { SettingsPage } from "./SettingsPage";

const PROFILE: ProfileDto = {
  id: "7",
  name: "Ada Brahms",
  handle: "ada-brahms",
  email: "ada@example.org",
  role: "Conductor",
  ensemble: "Cascade Youth Symphony",
  location: "Seattle",
  bio: "",
  initials: "AB",
  joinedAt: "2026-10-01T00:00:00.000Z",
  image: null,
  preferences: DEFAULT_PREFERENCES,
};

const USAGE: UsageDto = {
  scores: { count: 3, bytes: 3 * 1024 * 1024 },
  recordings: { count: 1, bytes: 8 * 1024 * 1024 },
  exports: { count: 2, bytes: 20 * 1024 * 1024 },
  totalBytes: 31 * 1024 * 1024,
};

const signOut = vi.fn(async () => {});
const updateProfile = vi.fn(async () => {});

beforeEach(() => {
  vi.clearAllMocks();
  api.getUsage.mockResolvedValue(USAGE);
  api.deleteAccount.mockResolvedValue(undefined);
  useSession.setState({ user: PROFILE, status: "signed-in", googleEnabled: false, error: null, signOut, updateProfile });
});

describe("SettingsPage", () => {
  it("switches between Account, Appearance and Export defaults", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Account/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.org");
    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
    expect(await screen.findByText("31.0 MB")).toBeInTheDocument();
    expect(screen.getByText("3 scores")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^Appearance/ }));
    expect(screen.getByRole("radio", { name: /Concert program/ })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Reduced motion" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Export defaults/ }));
    expect(screen.getByRole("radiogroup", { name: "Resolution" })).toBeInTheDocument();
    expect(screen.queryByText(/email me/i)).not.toBeInTheDocument();
  });

  it("deletes the account only after confirming, then signs out and goes to sign-up", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete your account?" });
    expect(api.deleteAccount).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Delete everything" }));

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/sign-up"));
    expect(api.deleteAccount).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("keeps the account when the confirmation is dismissed", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Keep my account" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.deleteAccount).not.toHaveBeenCalled();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("validates the handle next to the field before saving", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const handle = screen.getByLabelText("Handle");
    await user.clear(handle);
    await user.type(handle, "ab");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(handle).toHaveAttribute("aria-invalid", "true");
    expect(handle).toHaveAccessibleDescription(/3–30 lowercase letters/);
    expect(updateProfile).not.toHaveBeenCalled();

    await user.type(handle, "-conducts");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({ name: "Ada Brahms", ensemble: "Cascade Youth Symphony", role: "Conductor", handle: "ab-conducts", website: null }),
    );
  });
});
