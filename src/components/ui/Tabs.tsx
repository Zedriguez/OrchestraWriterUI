"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Tabs as RadixTabs } from "radix-ui";
import { cx } from "@/lib/utils/format";

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  /** second line in the vertical list */
  hint?: string;
  /** label in the compact horizontal list; defaults to `label` */
  shortLabel?: string;
  disabled?: boolean;
}

/**
 * - horizontal: segmented pill row (mobile, small switches)
 * - vertical: list with label and hint, sticky beside the panel (Settings)
 * - responsive: horizontal below `lg`, vertical from `lg` up
 */
export type TabsOrientation = "horizontal" | "vertical" | "responsive";

// Layout and look per mode. Responsive = horizontal classes plus `lg:` overrides.
const styles = {
  horizontal: {
    root: "flex flex-col gap-6",
    listWrap: "max-w-full overflow-x-auto scroll-thin",
    list: "inline-flex items-center rounded-full bg-paper-3 p-0.5",
    trigger:
      "focus-round inline-flex h-8 shrink-0 items-center rounded-full px-3.5 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink data-[state=active]:bg-paper-2 data-[state=active]:text-ink data-[state=active]:shadow-sm",
  },
  vertical: {
    root: "flex items-start gap-8",
    listWrap: "sticky top-24 w-60 shrink-0 self-start",
    list: "flex flex-col gap-1",
    trigger:
      "group flex w-full flex-col items-start rounded-md border border-transparent px-3.5 py-2.5 text-left transition-colors hover:bg-paper-3/60 data-[state=active]:border-line data-[state=active]:bg-paper-2 data-[state=active]:shadow-sm",
  },
  responsive: {
    root: "flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8",
    listWrap: "max-w-full overflow-x-auto scroll-thin lg:sticky lg:top-24 lg:w-60 lg:shrink-0 lg:self-start lg:overflow-visible",
    list: "inline-flex items-center rounded-full bg-paper-3 p-0.5 lg:flex lg:flex-col lg:items-stretch lg:gap-1 lg:rounded-none lg:bg-transparent lg:p-0",
    trigger:
      "group inline-flex h-8 shrink-0 items-center rounded-full px-3.5 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink data-[state=active]:bg-paper-2 data-[state=active]:text-ink data-[state=active]:shadow-sm lg:h-auto lg:w-full lg:flex-col lg:items-start lg:rounded-md lg:border lg:border-transparent lg:py-2.5 lg:text-left lg:font-normal lg:hover:bg-paper-3/60 lg:data-[state=active]:border-line",
  },
} as const;

/**
 * Tabs (Radix). Arrow keys move between tabs and select them; Home/End jump.
 * Put one `<TabPanel value=…>` per item in `children`.
 */
export function Tabs<T extends string>({
  value,
  onValueChange,
  items,
  orientation = "horizontal",
  ariaLabel,
  className,
  children,
}: {
  value: T;
  onValueChange: (value: T) => void;
  items: TabItem<T>[];
  orientation?: TabsOrientation;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const wide = useIsWide();
  // Keyboard axis and aria-orientation follow what is on screen.
  const axis = orientation === "responsive" ? (wide ? "vertical" : "horizontal") : orientation;
  const s = styles[orientation];
  return (
    <RadixTabs.Root
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      orientation={axis}
      className={cx(s.root, className)}
    >
      <div className={s.listWrap}>
        <RadixTabs.List aria-label={ariaLabel} className={s.list}>
          {items.map((item) => (
            <RadixTabs.Trigger key={item.value} value={item.value} disabled={item.disabled} className={cx(s.trigger, "disabled:cursor-not-allowed disabled:opacity-40")}>
              <TabLabel item={item} orientation={orientation} />
            </RadixTabs.Trigger>
          ))}
        </RadixTabs.List>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </RadixTabs.Root>
  );
}

const listLabel = "text-sm text-ink-2 group-data-[state=active]:font-medium group-data-[state=active]:text-ink";

/** Only the spans a mode shows are rendered, so the tab's accessible name has no duplicates. */
function TabLabel({ item, orientation }: { item: TabItem; orientation: TabsOrientation }) {
  if (orientation === "horizontal") return <>{item.shortLabel ?? item.label}</>;
  if (orientation === "vertical") {
    return (
      <>
        <span className={listLabel}>{item.label}</span>
        {item.hint && <span className="text-xs text-ink-3">{item.hint}</span>}
      </>
    );
  }
  const short = item.shortLabel && item.shortLabel !== item.label ? item.shortLabel : null;
  return (
    <>
      {short && <span className="lg:hidden">{short}</span>}
      <span className={cx(short && "hidden lg:block", "lg:text-sm lg:text-ink-2 lg:group-data-[state=active]:font-medium lg:group-data-[state=active]:text-ink")}>{item.label}</span>
      {item.hint && <span className="hidden text-xs text-ink-3 lg:block">{item.hint}</span>}
    </>
  );
}

/** Content for one tab; only the active panel is mounted. */
export function TabPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <RadixTabs.Content value={value} className={className}>
      {children}
    </RadixTabs.Content>
  );
}

const WIDE = "(min-width: 64rem)"; // Tailwind `lg`

function subscribeWide(onChange: () => void) {
  const mql = window.matchMedia(WIDE);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function useIsWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}
