"use client";

import { useState } from "react";
import { Download, Film, Package, RefreshCw } from "lucide-react";
import type { ExportDto } from "@/shared/api";
import { api, errorMessage } from "@/lib/api";
import { formatBytes, relativeTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";

export interface HistoryState {
  status: "loading" | "ready" | "error";
  rows: ExportDto[];
  error?: string;
}

function describe(row: ExportDto): string {
  if (row.kind !== "mp4") return "Project file";
  const parts = ["MP4"];
  if (row.resolution) parts.push(row.resolution === "4k" ? "4K" : row.resolution);
  if (row.frameRate) parts.push(`${row.frameRate} fps`);
  return parts.join(" · ");
}

export function ExportHistory({ state, onRetry }: { state: HistoryState; onRetry: () => void }) {
  const [opening, setOpening] = useState<string | null>(null);

  const download = async (row: ExportDto) => {
    setOpening(row.id);
    try {
      // presigned GET with Content-Disposition: attachment, so the page stays put
      const url = await api.getExportDownloadUrl(row.id);
      window.location.assign(url);
    } catch (err) {
      toast.error("Download failed", { description: errorMessage(err, "The download link could not be created") });
    } finally {
      setOpening(null);
    }
  };

  return (
    <section className="card p-5 md:p-6" aria-labelledby="export-history-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="export-history-title" className="font-serif text-xl text-ink">
          Export history
        </h2>
        {state.status === "ready" && state.rows.length > 0 && <span className="tnum text-xs text-ink-3">{state.rows.length} files</span>}
      </div>

      {state.status === "loading" && state.rows.length === 0 && (
        <div className="space-y-3" aria-busy="true">
          <div className="h-10 rounded-[var(--radius)] shimmer" />
          <div className="h-10 rounded-[var(--radius)] shimmer" />
        </div>
      )}

      {state.status === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]" role="alert">
          <span className="text-danger">{state.error}</span>
          <Button variant="outline" size="sm" leading={<RefreshCw size={13} />} onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {state.status === "ready" && state.rows.length === 0 && <p className="text-[13px] text-ink-3">Nothing exported yet. Saved project files and videos appear here.</p>}

      {state.rows.length > 0 && (
        <ul className="divide-y divide-line">
          {state.rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper-3 text-ink-2" aria-hidden>
                {r.kind === "mp4" ? <Film size={14} /> : <Package size={14} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{r.filename}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                  <span>{describe(r)}</span>
                  <span className="text-ink-4">·</span>
                  <span className="tnum">{formatBytes(r.bytes)}</span>
                  <span className="text-ink-4">·</span>
                  <span>{relativeTime(r.createdAt)}</span>
                </p>
              </div>
              <Button variant="ghost" size="sm" loading={opening === r.id} leading={<Download size={13} />} onClick={() => void download(r)} aria-label={`Download ${r.filename}`}>
                <span className="sr-only sm:not-sr-only">Download</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
