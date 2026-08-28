---
name: react-rendering-and-perf
description: Re-render mechanics, memoization (React.memo/useMemo/useCallback), the key-remount trick for animations, error boundaries, portals, and lazy loading in this app. Load when investigating a performance issue, an animation that needs a clean remount, or wrapping risky UI in a fallback boundary.
---

# React rendering and performance

Condensed from Josh Comeau's React course. Note: this project has no Next.js, so lazy
loading uses `React.lazy`, not `next/dynamic`.

## Why re-renders happen

- A re-render is triggered by a state update and cascades to every descendant
  regardless of whether that descendant's own props changed.
- "Rendering" (calling component functions to build a new element tree) isn't the same
  as "painting" the DOM — React only touches DOM nodes that actually changed, so most
  cascading re-renders are cheap and don't need pre-emptive optimization.
- Creating a `<Foo />` element and reusing it twice in JSX does not mean the two usages
  share state — each renders as its own independent instance.
- When a conditional swaps between branches that render the _same component type at the
  same tree position_, React treats it as one continuously-updated instance with new
  props, not a destroy/recreate. Changing the type or position is what causes
  unmount/remount.

## Memoization

- `React.memo(Component)` skips a re-render when props are shallow-equal to last time —
  only helps if those props are referentially stable; a fresh object/array/function
  literal passed each render defeats it. Don't apply pre-emptively — comparing props has
  its own cost; reserve it for components you've identified as an actual problem.
- `useMemo(() => expensiveCalc(), [deps])` caches an expensive value, recalculating only
  when a listed dependency changes. Also use it to preserve referential equality for a
  prop passed to a `React.memo`-wrapped child.
- `useCallback(fn, deps)` memoizes a function reference — needed when passing a callback
  prop to a `React.memo`-wrapped child. Pair with the setter functional-update form
  (`setCount(c => c + 1)`) so the callback can keep a minimal dependency array.
- Don't reach for `useMemo`/`useCallback` throughout the codebase by default — they're
  targeted, measured optimizations, not a habit.

## Alternatives to memoization

- Move frequently-changing state (a ticking clock) out of a shared ancestor of an
  expensive/unrelated component and into its own sibling, so a re-render only touches
  the parts of the tree that depend on it.
- Compose via `children`/props from a stable ancestor ("lift content up") so a
  re-rendering parent doesn't force an unrelated subtree to re-render — no memoization
  needed.

## Key-based remount trick

- Changing an element's `key` forces React to destroy and recreate the DOM node — a
  reliable way to retrigger a CSS keyframe/enter animation that only fires on node
  creation. Prefer this over an effect+timeout hack that syncs two pieces of state for
  the same thing.
- Key off a value guaranteed to differ per interaction (an id, a monotonic counter), not
  the value actually displayed, when you need a reset even if the displayed value
  doesn't visibly change.
- When an underlying value changes for multiple reasons but only one should retrigger
  the animation, key off a derived value that only changes for the triggering action.

## Error boundaries

- Wrap risky, non-critical UI slices (a third-party widget, one isolated page section)
  in an Error Boundary so an unexpected runtime error shows a scoped fallback instead of
  crashing the whole app.
- Error Boundaries are one of the few APIs that still require a class component — write
  or copy one generic, reusable `ErrorBoundary` and never touch class syntax elsewhere.
- A boundary catches errors thrown anywhere in its subtree, not just its direct child —
  you don't need one at every level, only at the "blast radius" you want to contain.
  Nest multiple at different levels to draw deliberate fault lines through the app.
- Pair with an error-tracking service via `componentDidCatch` so you're notified, not
  just the user shielded.

## Portals

- Reach for `createPortal` (from `react-dom`) when a component's output needs to render
  into a different DOM subtree than its position implies — modals, tooltips, dropdowns
  that must float above everything.
- `position: fixed` elements can be broken by `will-change`/`transform`/`filter` on any
  ancestor, even a distant one — portaling removes that fragility entirely.
- `createPortal(children, containerNode)` still participates in React's normal tree for
  props/context/event bubbling — only the DOM placement is "teleported."
- `document.querySelector(...)` to find a portal target is a legitimate exception to
  "don't reach into the DOM directly" — the target node was never owned by React.
- It's fine to portal straight into `document.body` for things like modals/tooltips
  (not for mounting the whole app).

## Lazy loading

- `React.lazy(() => import('module'))` to defer downloading a heavy dependency until
  needed on the client. Pair with `<React.Suspense fallback={...}>` whenever the lazy
  component isn't rendered on the very first paint.
- Dynamic `import()` paths must be static, literal strings — bundlers statically analyze
  `import("...")` calls at build time; variables/template strings won't work.
- Even for a component present on first render, splitting it into its own chunk still
  helps by deprioritizing that chunk's download — skip the `<Suspense>` wrapper in that
  specific case since it's already in the initial render.
- Prefer "baking in" lazy loading inside a thin wrapper component you own, rather than
  requiring every consumer to remember `React.lazy` themselves — also makes a future
  library swap cheap.
