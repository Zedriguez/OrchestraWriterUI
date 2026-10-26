import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Collapsible, Panel } from "./Collapsible";

describe("Panel", () => {
  function Harness({ onToggle }: { onToggle?: () => void }) {
    const [open, setOpen] = useState(true);
    return (
      <Panel
        title="Score"
        open={open}
        onToggle={() => {
          onToggle?.();
          setOpen((o) => !o);
        }}
        trailing={<span>Follow</span>}
      >
        <p>measures</p>
      </Panel>
    );
  }

  it("has a heading with an expandable button; closing unmounts the content but keeps trailing", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<Harness onToggle={onToggle} />);
    const button = screen.getByRole("button", { name: "Score" });
    expect(screen.getByRole("heading", { level: 2, name: "Score" })).toContainElement(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("measures")).toBeInTheDocument();

    await user.click(button);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("measures")).not.toBeInTheDocument();
    expect(screen.getByText("Follow")).toBeInTheDocument();
  });
});

describe("Collapsible", () => {
  it("toggles from the keyboard and reports the next state", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Collapsible open={false} onOpenChange={onOpenChange} trigger="Advanced">
        <p>ms fields</p>
      </Collapsible>,
    );
    const button = screen.getByRole("button", { name: "Advanced" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("ms fields")).not.toBeInTheDocument();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
