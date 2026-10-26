"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible as RadixCollapsible } from "radix-ui";
import { cx } from "@/lib/utils/format";

const triggerClass = "group flex min-h-8 items-center gap-2 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink";

function Chevron() {
  return <ChevronDown size={14} aria-hidden className="shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />;
}

/**
 * Show/hide a block (Radix Collapsible). The trigger is a button with a
 * chevron followed by `trigger`; closed content is unmounted.
 */
export function Collapsible({
  open,
  onOpenChange,
  trigger,
  children,
  className,
  triggerClassName,
  contentClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <RadixCollapsible.Root open={open} onOpenChange={onOpenChange} className={className}>
      <RadixCollapsible.Trigger className={cx(triggerClass, triggerClassName)}>
        <Chevron />
        {trigger}
      </RadixCollapsible.Trigger>
      <RadixCollapsible.Content className={cx("fade-in", contentClassName)}>{children}</RadixCollapsible.Content>
    </RadixCollapsible.Root>
  );
}

/**
 * Collapsible page panel (the Preview page's Visualizer / Score / Orchestra
 * viewer panels). A card unless `bare`; `trailing` sits at the right of the
 * header and stays visible when closed.
 */
export function Panel({
  title,
  icon,
  open,
  onToggle,
  trailing,
  bare,
  children,
  className,
  headingLevel = 2,
}: {
  title: string;
  icon?: ReactNode;
  open: boolean;
  onToggle: () => void;
  trailing?: ReactNode;
  bare?: boolean;
  children: ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <RadixCollapsible.Root
      asChild
      open={open}
      onOpenChange={(next) => {
        if (next !== open) onToggle();
      }}
    >
      <section className={cx(!bare && "card p-4", className)}>
        <div className={cx("flex items-center justify-between gap-3", open && (bare ? "mb-2" : "mb-3"))}>
          <Heading className="min-w-0">
            <RadixCollapsible.Trigger className={triggerClass}>
              <Chevron />
              {icon && (
                <span className="shrink-0" aria-hidden>
                  {icon}
                </span>
              )}
              {title}
            </RadixCollapsible.Trigger>
          </Heading>
          {trailing}
        </div>
        <RadixCollapsible.Content className="fade-in">{children}</RadixCollapsible.Content>
      </section>
    </RadixCollapsible.Root>
  );
}
