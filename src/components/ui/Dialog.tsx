"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import { cx } from "@/lib/utils/format";

const widths = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

/**
 * Modal dialog on Radix: portal, focus trap, Escape and outside click close,
 * focus returns to the trigger. The close button sits last in the DOM (top
 * right on screen) so the first form field, not "Close", receives focus.
 * Radix only restores focus to its own Dialog.Trigger; this API is controlled
 * from outside, so the opener is remembered here and refocused on close.
 */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: string;
  /** Optional short line under the title; announced as the dialog description. */
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: keyof typeof widths;
}) {
  const openerRef = useRef<HTMLElement | null>(null);
  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fade-in fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-[2px]">
          <RadixDialog.Content
            className={cx("fade-up relative w-full rounded-xl border border-line bg-paper-2 shadow-lg", widths[width])}
            onOpenAutoFocus={() => {
              // runs before focus moves in, so activeElement is still the opener
              openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            }}
            onCloseAutoFocus={(event) => {
              const opener = openerRef.current;
              openerRef.current = null;
              if (opener?.isConnected) {
                event.preventDefault();
                opener.focus();
              }
            }}
          >
            <div className="px-6 pt-6 pr-16">
              {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
              <RadixDialog.Title className="display text-2xl">{title}</RadixDialog.Title>
              {description && <RadixDialog.Description className="mt-2 text-sm text-ink-3">{description}</RadixDialog.Description>}
            </div>
            <div className="px-6 py-5">{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
            <RadixDialog.Close
              className="focus-round absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-full text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink"
              aria-label="Close"
            >
              <X size={16} aria-hidden />
            </RadixDialog.Close>
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
