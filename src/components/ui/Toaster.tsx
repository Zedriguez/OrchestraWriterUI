"use client";

import { useSyncExternalStore } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { Toaster as Sonner } from "sonner";
import { Spinner } from "./Button";

// Follow html[data-theme] (set by ThemeSync) so sonner's own bits match Direction A or B.
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function readTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "stage" ? "dark" : "light";
}

/** Toast outlet; mount once in the root layout. Use `toast` from ./toast to show one. */
export function Toaster() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as const);
  return (
    <Sonner
      position="bottom-right"
      theme={theme}
      gap={10}
      offset={16}
      icons={{
        success: <CircleCheck size={16} className="text-ok" />,
        error: <CircleAlert size={16} className="text-danger" />,
        warning: <TriangleAlert size={16} className="text-warn" />,
        info: <Info size={16} className="text-info" />,
        loading: <Spinner className="text-brass" />,
        close: <X size={12} />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "flex w-full items-start gap-3 rounded-md border border-line bg-paper-2 px-4 py-3 font-sans text-sm text-ink shadow-lg",
          icon: "relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "font-medium leading-snug text-ink",
          description: "text-xs leading-snug text-ink-3",
          actionButton: "focus-round inline-flex h-8 shrink-0 items-center rounded-full bg-ink px-3 text-[13px] font-medium text-paper hover:bg-ink-2",
          cancelButton: "focus-round inline-flex h-8 shrink-0 items-center rounded-full bg-paper-3 px-3 text-[13px] font-medium text-ink hover:bg-paper-4",
          closeButton:
            "focus-round absolute -left-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-line bg-paper-2 text-ink-3 shadow-sm hover:text-ink",
        },
      }}
    />
  );
}
