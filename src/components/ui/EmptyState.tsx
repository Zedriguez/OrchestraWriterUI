import type { ReactNode } from "react";
import { Aurora } from "@/components/brand/Aurora";

export function EmptyState({ eyebrow, title, body, action }: { eyebrow: string; title: ReactNode; body: string; action?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-line bg-paper-2 px-8 py-16 text-center grain">
      <Aurora subtle />
      <div className="relative z-10 mx-auto max-w-md">
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h3 className="display text-3xl md:text-4xl mb-3">{title}</h3>
        <p className="text-ink-3 text-sm leading-relaxed mb-6">{body}</p>
        {action}
      </div>
    </div>
  );
}
