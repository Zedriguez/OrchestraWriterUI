import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectSummary } from "@/shared/domain";
import type { InfoMap } from "@/shared/info-map";
import type { ParseScoreResult } from "@/shared/jobs";

const { api, router } = vi.hoisted(() => ({
  api: {
    uploadScore: vi.fn(),
    uploadAudio: vi.fn(),
    openProjectFile: vi.fn(),
    deleteProject: vi.fn(),
    getProject: vi.fn(),
    saveDisplay: vi.fn(),
    saveSync: vi.fn(),
    updateProject: vi.fn(),
    getJob: vi.fn(),
    subscribeJob: vi.fn(),
  },
  router: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const registry = await import("@/lib/jobs/registry");
  api.getJob.mockImplementation(registry.getJob);
  api.subscribeJob.mockImplementation(registry.subscribeJob);
  return {
    api,
    API_MOCK: false,
    onAuthRequired: () => () => {},
    errorMessage: (e: unknown, f: string) => (e instanceof Error ? e.message : f),
  };
});
vi.mock("@/lib/audio", () => ({ peaksFromInfoMap: () => [0.3, 0.3] }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/projects/p1/import" }));

import { createJob, updateJob } from "@/lib/jobs/registry";
import { useProject } from "@/lib/store/project";
import { forgetAllJobs } from "./projectJobs";
import { ImportPage, SCORE_TYPE_ERROR } from "./ImportPage";

const emptySummary: ProjectSummary = {
  id: "p1",
  title: "Untitled project",
  composer: "",
  movement: "",
  parts: 0,
  measures: 0,
  durationSec: 0,
  hasRecording: false,
  scoreName: "",
  stage: "import",
  status: "importing",
  statusDetail: "Waiting for a score",
  updatedAt: "2026-10-26T10:00:00Z",
  createdAt: "2026-10-26T10:00:00Z",
  programIds: [],
  thumbnail: [],
  exports: 0,
};

const infoMap: InfoMap = {
  instruments: [{ id: "P1", name: "Violin I", shortName: "Vln. I", section: "Strings", notes: [] }],
  measures: [{ number: 1, startTime: 0, duration: 2 }],
  duration: 129,
  tempo: 112,
  timeSignature: "4/4",
  warnings: ["Repeat expanded: measures 9–16 play twice."],
};

const parsed: ParseScoreResult = {
  title: "Orchestra Demo",
  composer: "Fixture Composer",
  movement: "I. Allegro",
  parts: 14,
  measures: 56,
  durationSec: 129,
  warnings: ["Repeat expanded: measures 9–16 play twice."],
};

const refresh = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  forgetAllJobs();
  refresh.mockImplementation(async () => {
    useProject.setState({ summary: { ...emptySummary, ...parsed, scoreName: "orchestra-demo.musicxml", status: "ready" }, infoMap });
  });
  useProject.setState({
    projectId: "p1",
    status: "ready",
    summary: emptySummary,
    infoMap: null,
    display: null,
    sync: null,
    peaks: null,
    audioUrl: null,
    refresh,
  });
});

describe("ImportPage", () => {
  it("uploads a score as a job, shows its progress, then the parsed facts", async () => {
    const job = createJob<ParseScoreResult>("upload-score");
    api.uploadScore.mockResolvedValue(job);
    const user = userEvent.setup();
    render(<ImportPage projectId="p1" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Add the score and recording");
    expect(screen.getByRole("button", { name: /continue to customize/i })).toBeDisabled();

    const file = new File(["<score-partwise/>"], "orchestra-demo.musicxml", { type: "application/xml" });
    await user.upload(screen.getByTestId("score-input"), file);
    expect(api.uploadScore).toHaveBeenCalledWith("p1", file);

    act(() => {
      updateJob(job.id, { status: "running", progress: 0.4, message: "Parsing score" });
    });
    expect(await screen.findByText("Parsing score…")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();

    act(() => {
      updateJob(job.id, { status: "succeeded", progress: 1, message: "Done", result: parsed });
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Parsed")).toBeInTheDocument();
    expect(screen.getByText("Orchestra Demo", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("Fixture Composer", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("56")).toBeInTheDocument();
    expect(screen.getByText("2:09")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Import warnings" })).toHaveTextContent("Repeat expanded: measures 9–16 play twice.");
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();

    const next = screen.getByRole("button", { name: /continue to customize/i });
    await waitFor(() => expect(next).toBeEnabled());
    await user.click(next);
    expect(router.push).toHaveBeenCalledWith("/projects/p1/customize");
  });

  it("rejects a file that is not MusicXML without starting an upload", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ImportPage projectId="p1" />);

    await user.upload(screen.getByTestId("score-input"), new File(["%PDF-1.7"], "score.pdf", { type: "application/pdf" }));

    expect(api.uploadScore).not.toHaveBeenCalled();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(SCORE_TYPE_ERROR);
    expect(alert).toHaveTextContent("score.pdf");
    expect(screen.getByRole("button", { name: "Choose another file" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});
