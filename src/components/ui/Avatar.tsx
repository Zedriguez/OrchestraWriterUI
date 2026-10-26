import { cx } from "@/lib/utils/format";

export function Avatar({ initials, size = "md", className }: { initials: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const s = size === "sm" ? "h-7 w-7 text-[11px]" : size === "lg" ? "h-14 w-14 text-lg" : size === "xl" ? "h-24 w-24 text-3xl" : "h-9 w-9 text-xs";
  return (
    <span
      className={cx(
        "inline-grid place-items-center rounded-full font-serif font-medium text-[#1d1a16] brass-gradient shadow-sm ring-2 ring-paper",
        s,
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
