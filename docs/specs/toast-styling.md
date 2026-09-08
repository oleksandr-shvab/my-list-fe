# Spec: Toast styling (size + status color)

Status: proposed.

## Scope

Two visual tweaks to the toast component (`sonner`, wired in
[src/components/ui/sonner.tsx](../../src/components/ui/sonner.tsx)), from user feedback after
testing the `a2-password-reset-update` work:

1. The toast reads a bit too small.
2. The icon renders in the same neutral color for every toast type
   (success/error/warning/info/loading) — it should reflect the status instead.

No changes to toast call sites (`useUpdatePasswordMutation` / `useResetPasswordMutation` in
[src/features/auth/mutations.ts](../../src/features/auth/mutations.ts)) — those already call
`toast.success(...)` and pass through this component unchanged.

## Decisions

Resolved with the user before planning:

- **Icon color scope**: icon-only, card stays neutral. The card keeps its current
  `--normal-bg` / `--normal-border` / `--normal-text` (popover colors); only the `[data-icon]`
  swaps to the status color. Not enabling sonner's `richColors` prop (which would also tint the
  whole card background/border) — that's louder than what was asked for.
- **Color source**: use sonner's own `--success-text` / `--error-text` / `--warning-text` /
  `--info-text` CSS variables. Sonner already computes these per light/dark theme in its own
  stylesheet (scoped under `[data-sonner-toaster][data-sonner-theme='light'|'dark']`) — they're
  just unused today since nothing reads them yet. Reusing them keeps dark-mode handled for free
  instead of inventing new color tokens that could drift from sonner's palette.
- **Size bump**: modest, not a redesign.
  - toast width: 356px → 400px
  - font-size: 13px → 14px
  - padding: 16px → 18px
  - icon: 16px (`size-4`) → 18px

## Implementation notes

- `--width` is an existing sonner CSS var already read by `[data-sonner-toaster]` /
  `[data-sonner-toast]`. It's settable via the `style` prop already used in `sonner.tsx` (same
  place `--normal-bg` etc. are set today) — no new CSS needed for that one value.
- Font-size, padding, and icon sizing/color are hardcoded in sonner's own stylesheet
  (`sonner/dist/styles.css`), which the package injects via a runtime `<style>` tag when
  `Toaster` mounts — the project doesn't `@import` or otherwise control that file directly.
  Overriding them requires project CSS (in `src/index.css`) scoped under
  `[data-sonner-toast]` / `.cn-toast` / `[data-icon]` selectors with enough specificity (or
  `!important`) to win, since sonner's injected `<style>` tag isn't guaranteed to load before
  the project's own stylesheet.
- Icon color per type: target `[data-sonner-toast][data-type='success'] [data-icon]` (and
  `error` / `warning` / `info`) and set `color: var(--success-text)` etc. Lucide icons render
  via `currentColor`, so recoloring `[data-icon]` alone recolors the SVG — no per-icon class
  changes needed in `sonner.tsx`.
- `loading` keeps its current neutral spinner color — not a "status" in the same sense as the
  other four, out of scope for coloring.

## Out of scope

- `richColors` / full-card tinting.
- Toast position, duration, stacking, or other sonner behavior options.
- Retrofitting toast usage into flows beyond the two already using it (already flagged as a
  follow-up in [password-reset-update.md](password-reset-update.md)) — this spec only changes
  the shared `Toaster` component's appearance, not where toasts are used.
