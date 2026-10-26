"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, Settings, User } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { Avatar } from "@/components/ui/Avatar";

export function UserMenu({ onStage }: { onStage?: boolean }) {
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) {
    return (
      <Link href="/sign-in" className="text-sm text-ink-2 hover:text-ink">
        Sign in
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-full" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        <Avatar initials={user.initials} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-64 rounded-[var(--radius-lg)] border border-line bg-paper-2 p-1.5 shadow-lg fade-up">
          <div className="px-3 py-2.5">
            <p className="text-sm font-medium text-ink">{user.name}</p>
            <p className="text-xs text-ink-3 truncate">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <MenuItem href="/profile" icon={<User size={15} />} onClick={() => setOpen(false)}>
            Profile
          </MenuItem>
          <MenuItem href="/settings" icon={<Settings size={15} />} onClick={() => setOpen(false)}>
            Settings
          </MenuItem>
          <div className="my-1 h-px bg-line" />
          <button
            role="menuitem"
            onClick={() => {
              signOut();
              setOpen(false);
              router.push("/sign-in");
            }}
            className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm text-ink-2 hover:bg-paper-3 hover:text-ink"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
      {onStage && null}
    </div>
  );
}

function MenuItem({ href, icon, children, onClick }: { href: string; icon: React.ReactNode; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link role="menuitem" href={href} onClick={onClick} className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm text-ink-2 hover:bg-paper-3 hover:text-ink">
      {icon}
      {children}
    </Link>
  );
}
