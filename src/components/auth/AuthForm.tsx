"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Mail } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import type { Director } from "@/shared/domain";

const ROLES: Director["role"][] = ["Music director", "Conductor", "Educator", "Student", "Listener"];

export function SignInForm() {
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const [email, setEmail] = useState("elena@cascadeyouth.org");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [magic, setMagic] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await signIn(email);
    router.push("/library");
  };

  return (
    <div className="fade-up">
      <p className="eyebrow mb-3">Welcome back</p>
      <h1 className="display text-[2.6rem] mb-2">
        Sign in to your <em>library</em>
      </h1>
      <p className="text-ink-3 text-[14.5px] mb-8">Your scores, programs and exports are waiting on the stand.</p>

      <div className="grid grid-cols-2 gap-2 mb-5">
        <Button variant="outline" leading={<GoogleMark />} type="button">
          Google
        </Button>
        <Button variant="outline" leading={<AppleMark />} type="button">
          Apple
        </Button>
      </div>
      <Divider>or with email</Divider>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} leading={<Mail size={15} />} required />
        </Field>
        {!magic && (
          <Field
            label="Password"
            trailing={
              <Link href="#" className="text-[12.5px] text-ink-3 hover:text-ink">
                Forgot?
              </Link>
            }
          >
            <div className="relative">
              <Input type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" className="pr-11" />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>
        )}
        <Button type="submit" size="lg" className="w-full" loading={busy} trailing={<ArrowRight size={16} />}>
          {magic ? "Email me a sign-in link" : "Sign in"}
        </Button>
        <button type="button" onClick={() => setMagic((m) => !m)} className="block w-full text-center text-[13px] text-ink-3 hover:text-ink">
          {magic ? "Use a password instead" : "Send me a magic link instead"}
        </button>
      </form>

      <p className="mt-8 text-[13.5px] text-ink-3">
        New here?{" "}
        <Link href="/sign-up" className="font-medium text-ink underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-6 text-[11.5px] leading-relaxed text-ink-4">
        Demo build: any email signs you in as the sample director. Clerk handles this screen in production.
      </p>
    </div>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const signUp = useSession((s) => s.signUp);
  const [form, setForm] = useState({ name: "", email: "", ensemble: "", role: "Music director" as Director["role"], password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await signUp({ name: form.name || "New director", email: form.email || "director@example.org", ensemble: form.ensemble || "My ensemble", role: form.role });
    router.push("/library");
  };

  return (
    <div className="fade-up">
      <p className="eyebrow mb-3">Create an account</p>
      <h1 className="display text-[2.6rem] mb-2">
        Light up <em>your orchestra</em>
      </h1>
      <p className="text-ink-3 text-[14.5px] mb-8">Upload a score, sync a recording, and share a listening guide with your musicians and audience.</p>

      <div className="grid grid-cols-2 gap-2 mb-5">
        <Button variant="outline" leading={<GoogleMark />} type="button">
          Google
        </Button>
        <Button variant="outline" leading={<AppleMark />} type="button">
          Apple
        </Button>
      </div>
      <Divider>or with email</Divider>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input autoComplete="name" value={form.name} onChange={set("name")} placeholder="Elena Marchetti" required />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={set("role")}>
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Ensemble or school" hint="Shown on your public program page.">
          <Input value={form.ensemble} onChange={set("ensemble")} placeholder="Cascade Youth Symphony" />
        </Field>
        <Field label="Email">
          <Input type="email" autoComplete="email" value={form.email} onChange={set("email")} leading={<Mail size={15} />} required />
        </Field>
        <Field label="Password" hint="At least 10 characters.">
          <Input type="password" autoComplete="new-password" value={form.password} onChange={set("password")} placeholder="••••••••••" minLength={10} required />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy} trailing={<ArrowRight size={16} />}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-[11.5px] leading-relaxed text-ink-4">
        By continuing you agree to the terms and privacy policy. No account is needed to use project files on your own device.
      </p>
      <p className="mt-6 text-[13.5px] text-ink-3">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
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

function AppleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.37 12.7c.02 2.7 2.37 3.6 2.4 3.61-.02.06-.38 1.3-1.24 2.56-.75 1.1-1.52 2.19-2.74 2.21-1.2.02-1.59-.71-2.96-.71-1.37 0-1.8.69-2.93.73-1.18.05-2.08-1.18-2.83-2.28-1.54-2.23-2.72-6.3-1.14-9.05a4.4 4.4 0 0 1 3.7-2.25c1.16-.02 2.25.78 2.96.78.7 0 2.03-.96 3.43-.82.58.02 2.22.23 3.27 1.76-.08.05-1.95 1.14-1.92 3.46ZM14.1 5.9c.62-.75 1.04-1.8.93-2.84-.9.04-1.98.6-2.62 1.35-.58.66-1.08 1.73-.95 2.75 1 .08 2.02-.51 2.64-1.26Z" />
    </svg>
  );
}
