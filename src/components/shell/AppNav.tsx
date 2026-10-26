"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Plus, Search, Bell } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/utils/format";
import { UserMenu } from "./UserMenu";

const LINKS = [
  { href: "/library", label: "Library" },
  { href: "/programs", label: "Programs" },
  { href: "/profile", label: "Profile" },
];

export function AppNav() {
  const pathname = usePathname();
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-5 md:px-8">
        <Logo />
        <nav className="hidden md:flex items-center gap-1 ml-4" aria-label="Primary">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cx(
                  "relative px-3 py-2 text-sm transition-colors",
                  active ? "text-ink" : "text-ink-3 hover:text-ink",
                )}
              >
                {l.label}
                {active && <span className="absolute left-3 right-3 -bottom-[13px] h-[2px] rounded-full bg-brass" />}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <label className="hidden lg:flex items-center gap-2 h-9 w-64 rounded-full border border-line bg-paper-2 px-3.5 text-sm text-ink-3 focus-within:border-brass focus-within:shadow-[var(--focus)]">
          <Search size={14} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search scores, composers…"
            className="w-full bg-transparent text-ink placeholder:text-ink-4 focus:outline-none"
          />
        </label>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="hidden sm:inline-flex">
          <Bell size={17} />
        </Button>
        <Button href="/projects/new" variant="brass" size="sm" leading={<Plus size={15} />}>
          New project
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}
