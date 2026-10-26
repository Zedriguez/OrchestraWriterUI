"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/utils/format";
import { UserMenu } from "./UserMenu";

const LINKS = [
  { href: "/library", label: "Library" },
  { href: "/programs", label: "Programs" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-5 sm:gap-6 md:px-8">
        <Logo />
        <nav className="flex items-center gap-0.5 sm:ml-2" aria-label="Primary">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cx("relative px-2.5 py-2 text-sm transition-colors sm:px-3", active ? "text-ink" : "text-ink-3 hover:text-ink")}
              >
                {l.label}
                {active && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-brass" aria-hidden />}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <Button href="/projects/new" variant="brass" size="sm" leading={<Plus size={15} aria-hidden />} className="max-sm:w-8 max-sm:px-0">
          <span className="max-sm:sr-only">New project</span>
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}
