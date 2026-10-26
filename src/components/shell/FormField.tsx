"use client";

import { useId, type ReactNode } from "react";
import { cx } from "@/lib/utils/format";

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

/**
 * Labelled form row with the same look as `ui/Field`, but wired for
 * assistive tech: the label points at the control, and the hint or error is
 * the control's description. `children` receives the props to spread on the
 * input, select or textarea.
 *
 *   <FormField label="Email" error={errors.email}>
 *     {(p) => <Input {...p} type="email" … />}
 *   </FormField>
 */
export function FormField({
  label,
  hint,
  error,
  trailing,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  trailing?: ReactNode;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error || hint;
  return (
    <div className={cx("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
          {label}
        </label>
        {trailing}
      </div>
      {children({ id, "aria-describedby": note ? noteId : undefined, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={noteId} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={noteId} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Form-level failure (e.g. the server rejected the request). Announced when it appears. */
export function FormError({ children, className }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className={cx("rounded-[var(--radius-sm)] border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-[13px] text-danger", className)}>
      {children}
    </p>
  );
}
