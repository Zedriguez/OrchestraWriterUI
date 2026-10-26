import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { toast } from "./toast";
import { Toaster } from "./Toaster";

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

describe("toast", () => {
  it("shows success and error toasts in the Toaster with title and description", async () => {
    render(<Toaster />);
    act(() => {
      toast.success("Project saved");
      toast.error("Upload failed", { description: "The file is not MusicXML." });
    });
    expect(await screen.findByText("Project saved")).toBeInTheDocument();
    expect(screen.getByText("Upload failed")).toBeInTheDocument();
    expect(screen.getByText("The file is not MusicXML.")).toBeInTheDocument();
  });

  it("resolves a promise toast from loading to success", async () => {
    render(<Toaster />);
    let resolve!: (v: string) => void;
    const work = new Promise<string>((r) => (resolve = r));
    act(() => {
      toast.promise(work, { loading: "Saving…", success: (name) => `Saved ${name}`, error: "Could not save" });
    });
    expect(await screen.findByText("Saving…")).toBeInTheDocument();
    await act(async () => resolve("Symphony No. 5"));
    await waitFor(() => expect(screen.getByText("Saved Symphony No. 5")).toBeInTheDocument());
  });
});
