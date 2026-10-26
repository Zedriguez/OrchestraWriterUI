import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Progress } from "./Progress";
import { Slider } from "./Slider";

function Harness({ onChange }: { onChange: (v: number) => void }) {
  const [value, setValue] = useState(1);
  return (
    <Slider
      ariaLabel="Glow size"
      min={0.6}
      max={1.4}
      step={0.05}
      value={value}
      formatValue={(v) => `${Math.round(v * 100)}%`}
      onChange={(v) => {
        onChange(v);
        setValue(v);
      }}
    />
  );
}

describe("Slider", () => {
  it("is a named slider with range and readable value", () => {
    render(<Harness onChange={() => {}} />);
    const slider = screen.getByRole("slider", { name: "Glow size" });
    expect(slider).toHaveAttribute("aria-valuemin", "0.6");
    expect(slider).toHaveAttribute("aria-valuemax", "1.4");
    expect(slider).toHaveAttribute("aria-valuenow", "1");
    expect(slider).toHaveAttribute("aria-valuetext", "100%");
  });

  it("steps with arrow keys and jumps with Home/End", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith(1.05);
    await user.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith(1.4);
    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith(0.6);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "60%");
  });
});

describe("Progress", () => {
  it("reports a 0–100 value from a 0–1 input, clamped", () => {
    const { rerender } = render(<Progress value={0.42} ariaLabel="Rendering video" />);
    const bar = screen.getByRole("progressbar", { name: "Rendering video" });
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    rerender(<Progress value={1.7} ariaLabel="Rendering video" />);
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });

  it("announces no value while indeterminate", () => {
    render(<Progress value={0.64} indeterminate ariaLabel="Importing" />);
    const bar = screen.getByRole("progressbar", { name: "Importing" });
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar).toHaveAttribute("data-state", "indeterminate");
  });
});
