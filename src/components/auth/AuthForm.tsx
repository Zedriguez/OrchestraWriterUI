"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { ArrowRight, Eye, EyeOff, Mail } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { errorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { FormError, FormField, type FieldControlProps } from "@/components/shell/FormField";
import type { Director } from "@/shared/domain";
import { AFTER_AUTH, authHref } from "./next";

export const ROLES: Director["role"][] = ["Music director", "Conductor", "Educator", "Student", "Listener"];
export const MIN_PASSWORD = 8;

const linkClass = "font-medium text-ink underline-offset-4 hover:underline";

/* ------------------------------------------------------------------ */
/* Sign in                                                             */
/* ------------------------------------------------------------------ */

export function SignInForm({ next = null }: { next?: string | null }) {
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      // stay busy until the next page takes over, so the form cannot be sent twice
      router.replace(next ?? AFTER_AUTH);
    } catch (err) {
      setError(errorMessage(err, "Could not sign in."));
      setBusy(false);
    }
  };

  return (
    <div className="fade-up">
      <h1 className="display mb-8 text-[2rem] md:text-[2.4rem]">Sign in</h1>

      <form onSubmit={submit} className="space-y-4">
        <FormField label="Email">
          {(p) => (
            <Input {...p} type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} leading={<Mail size={15} aria-hidden />} required />
          )}
        </FormField>
        <FormField label="Password">
          {(p) => <PasswordInput control={p} autoComplete="current-password" value={password} onChange={setPassword} />}
        </FormField>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" className="w-full" loading={busy} trailing={<ArrowRight size={16} aria-hidden />}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <GoogleButton onError={setError} disabled={busy} />

      <p className="mt-8 text-[13.5px] text-ink-3">
        New here?{" "}
        <Link href={authHref("/sign-up", next)} className={linkClass}>
          Create an account
        </Link>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sign up                                                             */
/* ------------------------------------------------------------------ */

export function SignUpForm({ next = null }: { next?: string | null }) {
  const router = useRouter();
  const signUp = useSession((s) => s.signUp);
  const [form, setForm] = useState({ name: "", email: "", password: "", ensemble: "", role: ROLES[0] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (form.password.length < MIN_PASSWORD) {
      setPasswordError(`Use at least ${MIN_PASSWORD} characters.`);
      passwordRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signUp({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        ensemble: form.ensemble.trim() || undefined,
        role: form.role,
      });
      router.replace(next ?? AFTER_AUTH);
    } catch (err) {
      setError(errorMessage(err, "Could not create the account."));
      setBusy(false);
    }
  };

  return (
    <div className="fade-up">
      <h1 className="display mb-8 text-[2rem] md:text-[2.4rem]">Create an account</h1>

      <form onSubmit={submit} className="space-y-4">
        <FormField label="Name">
          {(p) => <Input {...p} name="name" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} required />}
        </FormField>
        <FormField label="Email">
          {(p) => (
            <Input {...p} type="email" name="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} leading={<Mail size={15} aria-hidden />} required />
          )}
        </FormField>
        <FormField label="Password" hint={`At least ${MIN_PASSWORD} characters.`} error={passwordError}>
          {(p) => (
            <PasswordInput
              ref={passwordRef}
              control={p}
              autoComplete="new-password"
              value={form.password}
              onChange={(v) => {
                set("password", v);
                if (passwordError && v.length >= MIN_PASSWORD) setPasswordError(null);
              }}
            />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Ensemble or school" hint="Optional">
            {(p) => <Input {...p} name="ensemble" autoComplete="organization" value={form.ensemble} onChange={(e) => set("ensemble", e.target.value)} />}
          </FormField>
          <FormField label="Role">
            {(p) => (
              <Select {...p} name="role" value={form.role} onChange={(e) => set("role", e.target.value as Director["role"])}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" className="w-full" loading={busy} trailing={<ArrowRight size={16} aria-hidden />}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <GoogleButton onError={setError} disabled={busy} />

      <p className="mt-8 text-[13.5px] text-ink-3">
        Already have an account?{" "}
        <Link href={authHref("/sign-in", next)} className={linkClass}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function PasswordInput({
  control,
  value,
  onChange,
  autoComplete,
  ref,
}: {
  control: FieldControlProps;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  ref?: Ref<HTMLInputElement>;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        {...control}
        ref={ref}
        type={show ? "text" : "password"}
        name="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-11"
        required
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="focus-round absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:text-ink"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        {show ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
      </button>
    </div>
  );
}

/** Shown only when the server has Google configured (GET /api/config). */
function GoogleButton({ onError, disabled }: { onError: (message: string) => void; disabled?: boolean }) {
  const googleEnabled = useSession((s) => s.googleEnabled);
  const signInWithGoogle = useSession((s) => s.signInWithGoogle);
  const [busy, setBusy] = useState(false);
  if (!googleEnabled) return null;
  return (
    <>
      <Divider>or</Divider>
      <Button
        variant="outline"
        size="lg"
        type="button"
        className="w-full"
        leading={<GoogleMark />}
        loading={busy}
        disabled={disabled}
        onClick={async () => {
          setBusy(true);
          try {
            // resolves as the browser leaves for Google; the session appears on return
            await signInWithGoogle();
          } catch (err) {
            onError(errorMessage(err, "Google sign-in is unavailable right now."));
            setBusy(false);
          }
        }}
      >
        Continue with Google
      </Button>
    </>
  );
}

function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-ink-4">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M21.6 12.23c0-.68-.06-1.34-.18-1.98H12v3.74h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.28Z" opacity=".9" />
      <path fill="currentColor" d="M12 21.6c2.7 0 4.97-.9 6.62-2.43l-3.24-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.75-5.58-4.1H3.07v2.58A9.99 9.99 0 0 0 12 21.6Z" opacity=".7" />
      <path fill="currentColor" d="M6.42 13.52A6 6 0 0 1 6.1 11.6c0-.67.12-1.31.32-1.92V7.1H3.07a10 10 0 0 0 0 9l3.35-2.58Z" opacity=".5" />
      <path fill="currentColor" d="M12 5.58c1.47 0 2.78.5 3.82 1.5l2.86-2.86A9.6 9.6 0 0 0 12 1.6a9.99 9.99 0 0 0-8.93 5.5l3.35 2.58C7.2 7.33 9.4 5.58 12 5.58Z" opacity=".8" />
    </svg>
  );
}
