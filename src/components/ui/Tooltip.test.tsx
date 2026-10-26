import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { Segmented } from "./Segmented";
import { Tooltip, TooltipProvider } from "./Tooltip";

describe("Tooltip", () => {
  it("appears on hover after the delay and describes the trigger", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <Tooltip label="Back 5 s (←)">
          <Button aria-label="Back 5 seconds">«</Button>
        </Tooltip>
        <p>elsewhere</p>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Back 5 seconds" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.hover(trigger);
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("Back 5 s (←)");
    expect(trigger).toHaveAccessibleDescription("Back 5 s (←)");

    // The content is hoverable: it stays open while the pointer is in the grace
    // area toward it. jsdom has no layout (every rect and the pointer sit at 0,0),
    // so move the pointer somewhere explicit to leave that area.
    await user.unhover(trigger);
    await user.pointer({ target: screen.getByText("elsewhere"), coords: { clientX: 400, clientY: 400 } });
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("appears on keyboard focus and closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <Tooltip label="Loop" side="bottom">
          <button type="button">Loop</button>
        </Tooltip>
      </TooltipProvider>,
    );
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Loop");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("works without a provider (falls back to its own)", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Has recording">
        <span aria-label="Has recording">mic</span>
      </Tooltip>,
    );
    await user.hover(screen.getByText("mic"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Has recording");
  });

  it("wraps a disabled button so the tooltip still has a focusable, hoverable trigger", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Finish the previous step first">
        <Button disabled>Export</Button>
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Export" });
    expect(button).toBeDisabled();
    const wrapper = button.parentElement!;
    expect(wrapper.tagName).toBe("SPAN");
    expect(wrapper).toHaveClass("tooltip-wrap");

    await user.tab();
    expect(wrapper).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Finish the previous step first");
  });

  it("wraps components that cannot take trigger props (e.g. Segmented)", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="No recording uploaded">
        <Segmented ariaLabel="Audio" value="a" onChange={() => {}} options={[{ value: "a", label: "Generated" }]} />
      </Tooltip>,
    );
    const group = screen.getByRole("radiogroup", { name: "Audio" });
    expect(group.parentElement).toHaveClass("tooltip-wrap");
    await user.hover(group);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("No recording uploaded");
  });
});
