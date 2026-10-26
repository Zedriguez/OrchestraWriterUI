"use client";

import { Children, cloneElement, forwardRef, isValidElement, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/utils/format";

const control =
  "w-full rounded-[var(--radius)] border border-line bg-paper-2 px-3.5 text-sm text-ink placeholder:text-ink-4 transition focus:border-brass focus:shadow-[var(--focus)] focus:outline-none disabled:opacity-50";

/**
 * Label + control + hint/error. When the child is a single element the label
 * is linked with `htmlFor` and the hint or error with `aria-describedby`
 * (unless the child already sets `id`).
 */
export function Field({
  label,
  hint,
  error,
  children,
  className,
  trailing,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  trailing?: ReactNode;
}) {
  const generated = useId();
  const only = Children.count(children) === 1 ? Children.only(children) : null;
  const child = isValidElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>(only) ? only : null;
  const controlId = child?.props.id ?? generated;
  const messageId = error || hint ? `${controlId}-message` : undefined;
  const control = child
    ? cloneElement(child, {
        id: controlId,
        "aria-describedby": [child.props["aria-describedby"], messageId].filter(Boolean).join(" ") || undefined,
        "aria-invalid": error ? true : child.props["aria-invalid"],
      })
    : children;
  return (
    <div className={cx("space-y-1.5", className)}>
      {(label || trailing) && (
        <div className="flex items-center justify-between">
          {label && (
            <label htmlFor={child ? controlId : undefined} className="text-[13px] font-medium text-ink-2">
              {label}
            </label>
          )}
          {trailing}
        </div>
      )}
      {control}
      {error ? (
        <p id={messageId} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode }>(function Input(
  { className, leading, ...rest },
  ref,
) {
  if (leading) {
    return (
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none">{leading}</span>
        <input ref={ref} className={cx(control, "h-11 pl-10", className)} {...rest} />
      </div>
    );
  }
  return <input ref={ref} className={cx(control, "h-11", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx(control, "py-2.5 min-h-24 resize-y", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cx(control, "h-11 appearance-none pr-9", className)} {...rest}>
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
});
