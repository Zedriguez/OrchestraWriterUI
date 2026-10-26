"use client";

import { useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/utils/format";

/**
 * A drag-and-drop target. The parent owns the hidden `<input type="file">`
 * and passes `onOpen` so the same picker serves the dropzone and any
 * "Replace" / "Choose another file" buttons.
 */
export function Dropzone({
  label,
  onFile,
  onOpen,
  children,
  className,
}: {
  /** accessible name for the drop target */
  label: string;
  onFile: (file: File) => void;
  onOpen: () => void;
  children: ReactNode;
  className?: string;
}) {
  const [over, setOver] = useState(false);

  const onDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!over) setOver(true);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      onDragEnter={onDrag}
      onDragOver={onDrag}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cx(
        "relative overflow-hidden rounded-[var(--radius-lg)] border border-dashed transition-colors duration-150 cursor-pointer select-none",
        over ? "border-brass bg-brass-soft" : "border-line-strong hover:border-ink-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** True when the filename ends in one of the given extensions (case-insensitive). */
export function hasExtension(name: string, extensions: string[]) {
  const lower = name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}
