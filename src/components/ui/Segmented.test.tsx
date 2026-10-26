import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Segmented } from "./Segmented";

type Res = "720p" | "1080p" | "4k";
const OPTIONS: { value: Res; label: string; disabled?: boolean }[] = [
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
  { value: "4k", label: "4K" },
];

function Harness({ onChange }: { onChange?: (v: Res) => void }) {
  const [value, setValue] = useState<Res>("1080p");
  return (
    <Segmented
      ariaLabel="Resolution"
      value={value}
      options={OPTIONS}
      onChange={(v) => {
        onChange?.(v);
        setValue(v);
      }}
    />
  );
}

describe("Segmented", () => {
  it("is a named radiogroup whose radios report aria-checked", () => {
    render(<Harness />);
    const group = screen.getByRole("radiogroup", { name: "Resolution" });
    const radios = screen.getAllByRole("radio");
    expect(group).toContainElement(radios[0]);
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
  });

  it("selects on click and never deselects to empty", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "4K" }));
    expect(onChange).toHaveBeenLastCalledWith("4k");
    expect(screen.getByRole("radio", { name: "4K" })).toHaveAttribute("aria-checked", "true");

    // clicking the active option keeps it selected and does not call onChange
    await user.click(screen.getByRole("radio", { name: "4K" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("radio", { name: "4K" })).toHaveAttribute("aria-checked", "true");
  });

  it("moves focus with arrow keys (wrapping) and selects with Space", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.tab();
    expect(screen.getByRole("radio", { name: "1080p" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "4K" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "720p" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "4K" })).toHaveFocus();

    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith("4k");
  });

  it("skips disabled options", () => {
    render(<Segmented ariaLabel="Audio" value="a" onChange={() => {}} options={[{ value: "a", label: "Recording" }, { value: "b", label: "Generated", disabled: true }]} />);
    expect(screen.getByRole("radio", { name: "Generated" })).toBeDisabled();
  });
});
