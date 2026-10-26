import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("is a switch named by its label and described by its description", () => {
    render(<Toggle checked={false} onChange={() => {}} label="Reduced motion" description="Fades become instant switches." />);
    const toggle = screen.getByRole("switch", { name: "Reduced motion" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveAccessibleDescription("Fades become instant switches.");
  });

  it("reflects checked in aria-checked", () => {
    render(<Toggle checked onChange={() => {}} label="Show part labels" />);
    expect(screen.getByRole("switch", { name: "Show part labels" })).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange with the next value from the switch, the label text, and the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Show part labels" />);

    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByText("Show part labels"));
    expect(onChange).toHaveBeenCalledTimes(2);

    screen.getByRole("switch").focus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("uses ariaLabel when there is no visible label, and ignores clicks when disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked onChange={onChange} ariaLabel="Follow playback" disabled size="sm" />);
    const toggle = screen.getByRole("switch", { name: "Follow playback" });
    expect(toggle).toBeDisabled();
    await user.click(toggle);
    expect(onChange).not.toHaveBeenCalled();
  });
});
