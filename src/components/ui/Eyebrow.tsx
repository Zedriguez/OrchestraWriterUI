import type { ReactNode } from "react";
import { cx } from "@/lib/utils/format";

export function Eyebrow({ children, muted, className }: { children: ReactNode; muted?: boolean; className?: string }) {
  return <p className={cx("eyebrow", muted && "eyebrow-muted", className)}>{children}</p>;
}
