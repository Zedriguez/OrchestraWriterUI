import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportDto } from "@/shared/api";
import type { ProjectSummary } from "@/shared/domain";
import type { InfoMap } from "@/shared/info-map";
import type { ExportResult } from "@/shared/jobs";

const { api, exportLib } = vi.hoisted(() => ({
  api: {
    exportMp4: vi.fn(),
    exportProjectFile: vi.fn(),
    listExports: vi.fn(),
    getExportDownloadUrl: vi.fn(),
    getProject: vi.fn(),
    saveDisplay: vi.fn(),
    saveSync: vi.fn(),
    updateProject: vi.fn(),
    getJob: vi.fn(),
    subscribeJob: vi.fn(),
  },
  exportLib: {
    AUDIO_BITRATE: 192_000,
    defaultVideoBitrate: () => 3_000_000,
    mp4ExportUnsupportedReason: vi.fn<() => string | null>(() => null),
    estimateMp4Bytes: vi.fn(() => 48_000_000),
  },
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
vi.mock("@/lib/export", () => exportLib);
vi.mock("@/lib/audio", () => ({ peaksFromInfoMap: () => [0.3, 0.3] }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/projects/p1/export" }));

import { createJob, updateJob } from "@/lib/jobs/registry";
import { useProject } from "@/lib/store/project";
import { forgetAllJobs } from "@/components/import/projectJobs";
import { ExportPage } from "./ExportPage";

const summary: ProjectSummary = {
  id: "p1",
  title: "Orchestra Demo",
  composer: "Fixture Composer",
  movement: "I. Allegro",
  parts: 14,
  measures: 56,
  durationSec: 129,
  hasRecording: false,
  scoreName: "orchestra-demo.musicxml",
  stage: "export",
  status: "ready",
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
  warnings: [],
};

const projectExport: ExportDto = {
  id: "e1",
  projectId: "p1",
  kind: "project",
  filename: "orchestra-demo.ovproj",
  key: "users/1/projects/p1/exports/orchestra-demo.ovproj",
  bytes: 2_400_000,
  resolution: null,
  frameRate: null,
  createdAt: "2026-10-26T09:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  forgetAllJobs();
  exportLib.mp4ExportUnsupportedReason.mockReturnValue(null);
  api.listExports.mockResolvedValue([projectExport]);
  useProject.setState({
    projectId: "p1",
    status: "ready",
    summary,
    infoMap,
    display: null,
    sync: null,
    peaks: null,
    audioUrl: null,
  });
});

describe("ExportPage", () => {
  it("shows why MP4 export is unavailable instead of the render button", async () => {
    exportLib.mp4ExportUnsupportedReason.mockReturnValue("This browser cannot encode video (WebCodecs is missing).");
    render(<ExportPage projectId="p1" />);

    expect(screen.getByRole("heading", { level: 1, name: "Export" })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("This browser cannot encode video (WebCodecs is missing).");
    expect(screen.queryByRole("button", { name: "Render MP4" })).not.toBeInTheDocument();
    // the project file still works
    expect(screen.getByRole("button", { name: "Save project file" })).toBeEnabled();
    expect(await screen.findByText("orchestra-demo.ovproj")).toBeInTheDocument();
  });

  it("renders an MP4 and shows the result with codec, warnings and a download link", async () => {
    const job = createJob<ExportResult>("export-mp4");
    api.exportMp4.mockResolvedValue(job);
    const user = userEvent.setup();
    render(<ExportPage projectId="p1" />);
    await screen.findByText("orchestra-demo.ovproj");

    await user.click(screen.getByRole("radio", { name: "720p" }));
    await user.click(screen.getByRole("radio", { name: "30 fps" }));
    await user.click(screen.getByRole("button", { name: "Render MP4" }));
    await waitFor(() =>
      expect(api.exportMp4).toHaveBeenCalledWith({ projectId: "p1", filename: "orchestra-demo-720p", resolution: "720p", frameRate: 30, audio: "generated" }),
    );

    act(() => {
      updateJob(job.id, { status: "running", progress: 0.3, message: "Rendering frames" });
    });
    expect(await screen.findByText("Rendering frames…")).toBeInTheDocument();

    api.listExports.mockResolvedValue([
      { ...projectExport, id: "e2", kind: "mp4", filename: "orchestra-demo-720p.mp4", resolution: "720p", frameRate: 30, createdAt: "2026-10-26T10:00:00Z" },
      projectExport,
    ]);
    act(() => {
      updateJob(job.id, {
        status: "succeeded",
        progress: 1,
        message: "Done",
        result: {
          filename: "orchestra-demo-720p.mp4",
          bytes: 5_000_000,
          url: "blob:http://localhost/abc",
          exportId: "e2",
          codec: "H.264",
          warnings: ["No AAC encoder in this browser; the video has no audio track."],
        },
      });
    });

    const result = await screen.findByTestId("export-result");
    expect(within(result).getByText("orchestra-demo-720p.mp4")).toBeInTheDocument();
    expect(within(result).getByText("H.264")).toBeInTheDocument();
    expect(within(result).getByRole("list", { name: "Export warnings" })).toHaveTextContent("No AAC encoder in this browser; the video has no audio track.");
    const download = within(result).getByRole("link", { name: "Download" });
    expect(download).toHaveAttribute("href", "blob:http://localhost/abc");
    expect(download).toHaveAttribute("download", "orchestra-demo-720p.mp4");

    // history is reloaded after the export
    await waitFor(() => expect(api.listExports).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("MP4 · 720p · 30 fps")).toBeInTheDocument();
  });
});
