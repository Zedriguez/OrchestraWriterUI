# 0011. UI primitives on Radix UI; toasts with sonner

Date: 2026-10-26
Status: accepted

## Context
The first front end hand-rolled dialogs, tooltips, switches and menus. They
looked right but lacked focus trapping, portals, keyboard navigation and
screen-reader semantics, and every new control cost new code.

## Decision
- `radix-ui` (MIT, unstyled primitives) backs Dialog, Tooltip, Switch, Toggle
  Group, Tabs, Dropdown Menu, Slider, Collapsible and Progress in
  `src/components/ui/`. The components keep their prop APIs and the design
  tokens; Radix supplies behavior and accessibility.
- `sonner` (MIT) provides toasts (save, export, errors).
- Native `<select>`, `<input>` and `<textarea>` stay native.
- Screens are decluttered: one heading per page, one label per card, no
  demo copy or placeholder numbers (see `docs/plan/backend-integration.md`).

## Consequences
- A Tooltip provider and the Toaster mount in the root layout.
- Component tests use Testing Library with jsdom shims for ResizeObserver
  and pointer events.
