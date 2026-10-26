import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "./Menu";

function Harness({ onSignOut = () => {} }: { onSignOut?: () => void }) {
  return (
    <Menu
      trigger={
        <button type="button" aria-label="Account menu">
          AB
        </button>
      }
    >
      <MenuLabel>
        <p>Ada Brahms</p>
        <p>ada@example.com</p>
      </MenuLabel>
      <MenuSeparator />
      <MenuItem href="/profile">Profile</MenuItem>
      <MenuItem href="/settings">Settings</MenuItem>
      <MenuSeparator />
      <MenuItem onSelect={onSignOut}>Sign out</MenuItem>
    </Menu>
  );
}

describe("Menu", () => {
  it("opens from the trigger and lists its items", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Account menu" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Profile", "Settings", "Sign out"]);
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getAllByRole("separator")).toHaveLength(2);
  });

  it("opens from the keyboard, arrows move between items, Escape closes and refocuses the trigger", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Account menu" });

    await user.tab();
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("menu");
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("runs onSelect and closes", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    render(<Harness onSignOut={onSignOut} />);
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
});
