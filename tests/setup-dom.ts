import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs without `globals`, so Testing Library cannot register its own
// afterEach cleanup; unmount between tests here.
afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// jsdom gaps that Radix primitives (and sonner) touch. Each shim only fills a
// missing API; real implementations win if jsdom adds them.
// ---------------------------------------------------------------------------

// Radix Slider, Popper (Tooltip, DropdownMenu) measure with ResizeObserver.
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverShim {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverShim as unknown as typeof ResizeObserver;
}

// Radix Slider / Select call pointer-capture methods on pointerdown.
const elementProto = Element.prototype as Partial<Element>;
if (!elementProto.hasPointerCapture) elementProto.hasPointerCapture = () => false;
if (!elementProto.setPointerCapture) elementProto.setPointerCapture = () => {};
if (!elementProto.releasePointerCapture) elementProto.releasePointerCapture = () => {};

// Radix Select / Menu scroll the highlighted item into view.
if (!elementProto.scrollIntoView) elementProto.scrollIntoView = () => {};

// PointerEvent exists in recent jsdom; older versions need it for Radix's pointer handlers.
if (typeof window.PointerEvent === "undefined") {
  class PointerEventShim extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "mouse";
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  window.PointerEvent = PointerEventShim as unknown as typeof PointerEvent;
}

// sonner and the responsive Tabs read media queries.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
