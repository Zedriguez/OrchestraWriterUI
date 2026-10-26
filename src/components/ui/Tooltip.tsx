"use client";

import { Children, createContext, isValidElement, useContext, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { Tooltip as RadixTooltip } from "radix-ui";
import { Button } from "./Button";

export type TooltipSide = "top" | "bottom" | "left" | "right";

const HasProvider = createContext(false);

/**
 * One provider at the root (src/app/layout.tsx) so moving between tooltips
 * skips the delay. Tooltips rendered outside it (tests, isolated stories)
 * fall back to their own provider.
 */
export function TooltipProvider({ children, delayDuration = 300 }: { children: ReactNode; delayDuration?: number }) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration} skipDelayDuration={300}>
      <HasProvider.Provider value>{children}</HasProvider.Provider>
    </RadixTooltip.Provider>
  );
}

/** Short hint on hover and keyboard focus. Content must be short and must not be the only label. */
export function Tooltip({ label, children, side = "top" }: { label: string; children: ReactNode; side?: TooltipSide }) {
  const hasProvider = useContext(HasProvider);
  const tip = (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{triggerFor(children)}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="pop-in z-60 max-w-xs rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-paper shadow-md"
        >
          {label}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
  return hasProvider ? tip : <TooltipProvider>{tip}</TooltipProvider>;
}

type MaybeDisabled = { disabled?: boolean; loading?: boolean };

/**
 * Radix `asChild` needs a single child that forwards its ref and spreads the
 * trigger props. Native elements, Button and Link do; anything else (custom
 * components, text, fragments) gets a span wrapper, as does a disabled
 * control, which would otherwise never receive hover or focus.
 */
function triggerFor(children: ReactNode): ReactElement {
  if (Children.count(children) === 1 && isValidElement<MaybeDisabled>(children)) {
    const { disabled, loading } = children.props;
    const forwardsProps = typeof children.type === "string" || children.type === Button || children.type === Link;
    if (forwardsProps && !disabled && !loading) return children;
    if (disabled || loading) {
      return (
        <span className="tooltip-wrap inline-flex" tabIndex={0}>
          {children}
        </span>
      );
    }
  }
  return <span className="tooltip-wrap inline-flex">{children}</span>;
}
