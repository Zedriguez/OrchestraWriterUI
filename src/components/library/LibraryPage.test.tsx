import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityItem, ProjectSummary } from "@/shared/domain";
import type { ProgramDto } from "@/shared/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/library" }));
const api = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listPrograms: vi.fn(),
  listActivity: vi.fn(),
  deleteProject: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api }));

import { LibraryPage } from "./LibraryPage";

const now = new Date().toISOString();

function project(over: Partial<ProjectSummary>): ProjectSummary {
  return {
    id: "1",
    title: "Symphony No. 5",
    composer: "Ludwig van Beethoven",
    movement: "I. Allegro con brio",
    parts: 18,
    measures: 502,
    durationSec: 445,
    hasRecording: true,
    scoreName: "beethoven-5.musicxml",
    stage: "customize",
    status: "ready",
    updatedAt: now,
    createdAt: now,
    programIds: [],
    thumbnail: [],
    exports: 0,
    ...over,
  };
}

const PROJECTS = [
  project({}),
  project({ id: "2", title: "Appalachian Spring", composer: "Aaron Copland", status: "needs-sync", stage: "sync", statusDetail: "Recording not synced" }),
];

const PROGRAM: ProgramDto = {
  id: "9",
  name: "Fall Gala",
  season: "2026–27",
  date: "2026-11-14",
  venue: "Benaroya Hall",
  description: "",
  projectIds: ["1", "2"],
  color: "Brass",
  notes: "",
  createdAt: now,
};

const ACTIVITY: ActivityItem[] = [{ id: "a1", kind: "import", projectId: "1", text: "Imported beethoven-5.musicxml", at: now }];

beforeEach(() => {
  vi.clearAllMocks();
  api.listProjects.mockResolvedValue(PROJECTS);
  api.listPrograms.mockResolvedValue([PROGRAM]);
  api.listActivity.mockResolvedValue(ACTIVITY);
  api.deleteProject.mockResolvedValue(undefined);
});

describe("LibraryPage", () => {
  it("renders the projects, programs and activity from the API", async () => {
    render(<LibraryPage />);

    expect(screen.getByLabelText("Loading scores")).toBeInTheDocument();
    const beethoven = await screen.findByRole("link", { name: "Symphony No. 5" });
    expect(beethoven).toHaveAttribute("href", "/projects/1/customize");
    expect(screen.getByRole("link", { name: "Appalachian Spring" })).toHaveAttribute("href", "/projects/2/sync");
    expect(screen.getByText("Needs sync", { selector: "span" })).toBeInTheDocument();

    expect(screen.getByText("2 scores")).toBeInTheDocument();
    expect(await screen.findByText("1 program")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Fall Gala/ })).toHaveAttribute("href", "/programs/9");
    expect(screen.getByText("Imported beethoven-5.musicxml")).toBeInTheDocument();
  });

  it("filters by search text", async () => {
    const user = userEvent.setup();
    render(<LibraryPage />);
    await screen.findByRole("link", { name: "Symphony No. 5" });

    await user.type(screen.getByRole("searchbox", { name: "Search scores" }), "copland");

    expect(screen.queryByRole("link", { name: "Symphony No. 5" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Appalachian Spring" })).toBeInTheDocument();
  });

  it("shows the empty state with a New project action for a new account", async () => {
    api.listProjects.mockResolvedValue([]);
    api.listPrograms.mockResolvedValue([]);
    api.listActivity.mockResolvedValue([]);
    render(<LibraryPage />);

    const heading = await screen.findByRole("heading", { name: "Start with a score" });
    // the action sits beside the heading inside the empty state, not just in the page header
    expect(within(heading.parentElement as HTMLElement).getByRole("link", { name: "New project" })).toHaveAttribute("href", "/projects/new");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(await screen.findByText("No programs yet.", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Nothing yet\./)).toBeInTheDocument();
  });

  it("shows an error card and retries", async () => {
    const user = userEvent.setup();
    api.listProjects.mockRejectedValueOnce(new Error("The server is not answering"));
    render(<LibraryPage />);

    expect(await screen.findByText("The server is not answering")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "Symphony No. 5" })).toBeInTheDocument();
    expect(api.listProjects).toHaveBeenCalledTimes(2);
  });

  it("deletes a project after confirming", async () => {
    const user = userEvent.setup();
    render(<LibraryPage />);
    await screen.findByRole("link", { name: "Symphony No. 5" });

    await user.click(screen.getByRole("button", { name: "Actions for Symphony No. 5" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete…" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete “Symphony No. 5”?" });
    expect(api.deleteProject).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Delete project" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.deleteProject).toHaveBeenCalledWith("1");
    expect(screen.queryByRole("link", { name: "Symphony No. 5" })).not.toBeInTheDocument();
    expect(screen.getByText("1 score")).toBeInTheDocument();
  });

  it("keeps the project when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    render(<LibraryPage />);
    await screen.findByRole("link", { name: "Symphony No. 5" });

    await user.click(screen.getByRole("button", { name: "Actions for Symphony No. 5" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete…" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.deleteProject).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Symphony No. 5" })).toBeInTheDocument();
  });
});
