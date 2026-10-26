"use client";

import { Download, Film, Package } from "lucide-react";
import { formatBytes, relativeTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import type { HistoryRow } from "./shared";

/** Three earlier exports for the demo; the mock API has no history endpoint. */
export function mockHistory(slug: string): HistoryRow[] {
  const now = Date.now();
  const ago = (hours: number) => new Date(now - hours * 3600_000).toISOString();
  return [
    { id: "hist_1", filename: `${slug}-1080p.mp4`, kind: "mp4", bytes: 184_000_000, at: ago(2), url: "#" },
    { id: "hist_2", filename: `${slug}.ovproj`, kind: "project", bytes: 14_800_000, at: ago(26), url: "#" },
    { id: "hist_3", filename: `${slug}-720p.mp4`, kind: "mp4", bytes: 96_000_000, at: ago(5 * 24), url: "#" },
  ];
}

export function ExportHistory({ rows }: { rows: HistoryRow[] }) {
  return (
    <section className="card p-5 md:p-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">History</p>
          <h2 className="display text-[1.5rem]">Export history</h2>
        </div>
        <span className="tnum text-xs text-ink-3">{rows.length} files</span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper-3 text-ink-2">
              {r.kind === "mp4" ? <Film size={14} /> : <Package size={14} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{r.filename}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                <Chip tone={r.kind === "mp4" ? "neutral" : "brass"} className="h-5 px-2 text-[11px]">
                  {r.kind === "mp4" ? "MP4" : "Project"}
                </Chip>
                <span className="tnum">{formatBytes(r.bytes)}</span>
                <span className="text-ink-4">·</span>
                <span>{relativeTime(r.at)}</span>
              </p>
            </div>
            <Button variant="ghost" size="sm" href={r.url} leading={<Download size={13} />}>
              <span className="sr-only sm:not-sr-only">Download</span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
