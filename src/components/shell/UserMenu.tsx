"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, User } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { Avatar } from "@/components/ui/Avatar";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/Menu";
import { cx } from "@/lib/utils/format";

export function UserMenu({ onStage }: { onStage?: boolean }) {
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const router = useRouter();

  if (!user) {
    return (
      <Link href="/sign-in" className={cx("text-sm", onStage ? "text-stage-text-2 hover:text-stage-text" : "text-ink-2 hover:text-ink")}>
        Sign in
      </Link>
    );
  }

  return (
    <Menu
      align="end"
      className="w-64"
      trigger={
        <button type="button" className="focus-round rounded-full" aria-label="Account menu">
          <Avatar initials={user.initials} />
        </button>
      }
    >
      <MenuLabel>
        <p className="text-sm font-medium text-ink">{user.name}</p>
        <p className="truncate text-xs text-ink-3">{user.email}</p>
      </MenuLabel>
      <MenuSeparator />
      <MenuItem href="/profile" icon={<User size={15} />}>
        Profile
      </MenuItem>
      <MenuItem href="/settings" icon={<Settings size={15} />}>
        Settings
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        icon={<LogOut size={15} />}
        onSelect={() => {
          signOut();
          router.push("/sign-in");
        }}
      >
        Sign out
      </MenuItem>
    </Menu>
  );
}
