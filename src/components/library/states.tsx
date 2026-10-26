"use client";

import { usePathname } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AuthRequiredError } from "@/lib/api/errors";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/utils/format";

/** Shimmer block for loading layouts; size it with classes to match what loads. */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cx("shimmer block rounded-[var(--radius-xs)]", className)} aria-hidden />;
}

function signInHref(pathname: string | null) {
  return `/sign-in?next=${encodeURIComponent(pathname || "/library")}`;
}

/**
 * A section that failed to load. `card` fills the space the content would
 * have taken; `inline` is one quiet line for side rails. A 401 offers sign-in
 * instead of a retry that would fail again.
 */
export function LoadError({
  error,
  message,
  onRetry,
  variant = "card",
  className,
}: {
  error: unknown;
  message: string | null;
  onRetry: () => void;
  variant?: "card" | "inline";
  className?: string;
}) {
  const pathname = usePathname();
  const signedOut = error instanceof AuthRequiredError;
  const text = signedOut ? "Your session has ended." : (message ?? "Something went wrong.");

  if (variant === "inline") {
    return (
      <p role="alert" className={cx("flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3", className)}>
        <span>{text}</span>
        {signedOut ? (
          <a href={signInHref(pathname)} className="font-medium text-ink underline-offset-4 hover:underline">
            Sign in
          </a>
        ) : (
          <button type="button" onClick={onRetry} className="font-medium text-ink underline-offset-4 hover:underline">
            Try again
          </button>
        )}
      </p>
    );
  }

  return (
    <div role="alert" className={cx("card flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <span className="grid h-10 w-10 place-items-center rounded-full bg-paper-3 text-danger">
        <AlertTriangle size={18} aria-hidden />
      </span>
      <p className="max-w-md text-sm text-ink-2">{text}</p>
      {signedOut ? (
        <Button href={signInHref(pathname)} variant="primary" size="sm">
          Sign in
        </Button>
      ) : (
        <Button variant="outline" size="sm" leading={<RefreshCw size={14} aria-hidden />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
