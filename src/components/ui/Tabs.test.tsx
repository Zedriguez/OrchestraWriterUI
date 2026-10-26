import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TabPanel, Tabs, type TabsOrientation } from "./Tabs";

type Tab = "account" | "appearance" | "export";
const ITEMS = [
  { value: "account" as const, label: "Account", hint: "Email, password, storage" },
  { value: "appearance" as const, label: "Appearance", hint: "Theme and motion" },
  { value: "export" as const, label: "Export defaults", shortLabel: "Export", hint: "Resolution and frame rate" },
];

function Harness({ orientation, onChange }: { orientation: TabsOrientation; onChange?: (v: Tab) => void }) {
  const [tab, setTab] = useState<Tab>("account");
  return (
    <Tabs
      ariaLabel="Settings sections"
      orientation={orientation}
      value={tab}
      items={ITEMS}
      onValueChange={(v) => {
        onChange?.(v);
        setTab(v);
      }}
    >
      <TabPanel value="account">Account panel</TabPanel>
      <TabPanel value="appearance">Appearance panel</TabPanel>
      <TabPanel value="export">Export panel</TabPanel>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("renders a named tablist with the active tab selected and its panel labelled by it", () => {
    render(<Harness orientation="horizontal" />);
    expect(screen.getByRole("tablist", { name: "Settings sections" })).toHaveAttribute("aria-orientation", "horizontal");
    const account = screen.getByRole("tab", { name: "Account" });
    expect(account).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Account" })).toHaveTextContent("Account panel");
    // horizontal mode shows the short label only
    expect(screen.getByRole("tab", { name: "Export" })).toBeInTheDocument();
  });

  it("horizontal: Left/Right arrows move and select, wrapping at the ends", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness orientation="horizontal" onChange={onChange} />);

    await user.tab();
    expect(screen.getByRole("tab", { name: "Account" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Appearance" })).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("appearance");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Appearance panel");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Export" })).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("export");

    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Account" })).toHaveAttribute("aria-selected", "true");
  });

  it("vertical: Up/Down arrows move; the label and hint both show", async () => {
    const user = userEvent.setup();
    render(<Harness orientation="vertical" />);
    expect(screen.getByRole("tablist")).toHaveAttribute("aria-orientation", "vertical");
    expect(screen.getByText("Theme and motion")).toBeInTheDocument();

    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: /Appearance/ })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Appearance panel");

    await user.keyboard("{ArrowRight}"); // wrong axis: ignored
    expect(screen.getByRole("tab", { name: /Appearance/ })).toHaveFocus();
  });

  it("Tab moves from the tablist into the active panel", async () => {
    const user = userEvent.setup();
    render(<Harness orientation="horizontal" />);
    await user.tab();
    await user.tab();
    expect(screen.getByRole("tabpanel")).toHaveFocus();
  });
});
