"use client";

import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type MouseEvent, type ReactNode, type Ref } from "react";
import Link from "next/link";
import { cx } from "@/lib/utils/format";

export type ButtonVariant = "primary" | "brass" | "secondary" | "ghost" | "outline" | "danger" | "stage";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "focus-round inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none transition-[background-color,color,box-shadow,transform,opacity] duration-150 ease-out disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.985]";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-2 shadow-sm",
  brass: "brass-gradient text-[#1d1a16] shadow-sm hover:brightness-[1.04]",
  secondary: "bg-paper-3 text-ink hover:bg-paper-4",
  ghost: "text-ink-2 hover:bg-paper-3 hover:text-ink",
  outline: "border border-line-strong text-ink bg-paper-2 hover:bg-paper-3",
  danger: "bg-danger text-white hover:brightness-95",
  stage: "stage-glass text-stage-text hover:bg-white/10",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] rounded-full",
  md: "h-10 px-4 text-sm rounded-full",
  lg: "h-12 px-6 text-[15px] rounded-full",
  icon: "h-10 w-10 rounded-full",
  "icon-sm": "h-8 w-8 rounded-full",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", href, leading, trailing, loading, className, children, disabled, ...rest },
  ref,
) {
  const cls = cx(base, variants[variant], sizes[size], className);
  const content = (
    <>
      {loading ? <Spinner /> : leading}
      {children}
      {trailing}
    </>
  );
  if (href) {
    // Forward the ref and the remaining props so a link-button works as a
    // Radix `asChild` trigger (Tooltip, Menu) and keeps aria-label/title.
    const inactive = disabled || loading;
    const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <Link
        {...anchorProps}
        ref={ref as unknown as Ref<HTMLAnchorElement>}
        href={href}
        className={cx(cls, inactive && "cursor-not-allowed opacity-45")}
        aria-disabled={inactive || undefined}
        tabIndex={inactive ? -1 : anchorProps.tabIndex}
        onClick={(e: MouseEvent<HTMLAnchorElement>) => {
          if (inactive) {
            e.preventDefault();
            return;
          }
          anchorProps.onClick?.(e);
        }}
      >
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} className={cls} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx("inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent animate-spin", className)}
      aria-hidden
    />
  );
}
