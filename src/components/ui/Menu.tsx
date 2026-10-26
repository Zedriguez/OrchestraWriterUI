"use client";

import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { cx } from "@/lib/utils/format";

/**
 * Dropdown menu (Radix). `trigger` must be one element that forwards its ref
 * and props: a native <button>, or <Button>. Arrow keys move, Enter selects,
 * Escape closes and returns focus to the trigger.
 */
export function Menu({
  trigger,
  children,
  align = "end",
  side = "bottom",
  sideOffset = 8,
  className,
  ariaLabel,
}: {
  trigger: ReactElement;
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  className?: string;
  /** name for the menu itself, when the trigger's name is not enough */
  ariaLabel?: string;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          side={side}
          sideOffset={sideOffset}
          collisionPadding={8}
          aria-label={ariaLabel}
          className={cx("pop-in z-50 min-w-48 rounded-lg border border-line bg-paper-2 p-1.5 shadow-lg", className)}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const itemClass =
  "flex w-full min-h-9 cursor-pointer select-none items-center gap-2.5 rounded-sm px-3 py-2 text-sm outline-none transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45";

const tones = {
  default: "text-ink-2 data-[highlighted]:bg-paper-3 data-[highlighted]:text-ink",
  danger: "text-danger data-[highlighted]:bg-paper-3",
} as const;

/** A menu row. With `href` it is a link; otherwise `onSelect` runs and the menu closes. */
export function MenuItem({
  children,
  icon,
  href,
  onSelect,
  disabled,
  tone = "default",
}: {
  children: ReactNode;
  icon?: ReactNode;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  tone?: keyof typeof tones;
}) {
  const cls = cx(itemClass, tones[tone]);
  const content = (
    <>
      {icon && (
        <span className="shrink-0" aria-hidden>
          {icon}
        </span>
      )}
      {children}
    </>
  );
  if (href) {
    return (
      <DropdownMenu.Item asChild disabled={disabled} onSelect={onSelect} className={cls}>
        <Link href={href}>{content}</Link>
      </DropdownMenu.Item>
    );
  }
  return (
    <DropdownMenu.Item disabled={disabled} onSelect={onSelect} className={cls}>
      {content}
    </DropdownMenu.Item>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="-mx-1.5 my-1 h-px bg-line" />;
}

/** Non-interactive heading row, e.g. the signed-in name and email. */
export function MenuLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <DropdownMenu.Label className={cx("px-3 py-2.5", className)}>{children}</DropdownMenu.Label>;
}
