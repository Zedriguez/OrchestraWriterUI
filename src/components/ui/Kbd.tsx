import type { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-strong bg-paper-2 px-1.5 font-sans text-[10.5px] font-medium text-ink-3">
      {children}
    </kbd>
  );
}
