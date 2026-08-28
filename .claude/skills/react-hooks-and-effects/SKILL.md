---
name: react-hooks-and-effects
description: Rules of hooks, useEffect correctness (dependencies, cleanup, stale closures, async effects), refs, and custom hook design for this app. Load when writing hooks, effects, or anything that synchronizes with the DOM/browser APIs.
---

# React hooks and effects

Condensed from Josh Comeau's React course. **This project uses TanStack Query for all
server state (see CLAUDE.md) — don't hand-roll `fetch` inside `useEffect`.** The effect
patterns below are for synchronizing with the DOM/browser (focus, observers, listeners,
`document.title`), not for data fetching.

## Rules of hooks

- Only call hooks in a component body (or another hook) — never at module top level or
  inside a plain helper function.
- Call hooks unconditionally, in the same order every render — never inside an `if` or
  loop. If a value is only needed conditionally, call the hook unconditionally and
  branch afterward.
- If a hook is only needed for part of a component's UI, extract that part into its own
  child component that calls the hook internally, rather than calling it conditionally.
- Move every hook call above an early return so the same hooks always run in the same
  order — or push the branching up into the parent so it renders one of two whole child
  components instead.

## useEffect

- Use it to synchronize with something outside React _after_ render completes — never
  perform side effects during render itself.
- List every value the effect reads from component scope in the dependency array. Don't
  silence `react-hooks/exhaustive-deps` to make a warning go away — use the stale-value
  patterns below instead of lying to the array.
- In Strict Mode (dev only), effects double-invoke on mount on purpose — it's surfacing
  a missing/incorrect cleanup, not a bug in Strict Mode.
- **Cleanup**: whenever an effect subscribes to something (listener, observer, timer),
  return a cleanup function that undoes it. Define handler functions inside the effect
  callback itself so cleanup can reference them directly. Always disconnect observers
  and clear intervals/timeouts in cleanup.
- When an effect's main logic only applies conditionally, use an early return at the top
  of the callback rather than wrapping the whole body in `if`.
- **Async effect gotcha**: never pass an `async` function directly to `useEffect` — it
  always returns a Promise, and React expects nothing or a sync cleanup function.
  Instead: `useEffect(() => { async function runEffect() { ... } runEffect() }, [])`.
  If cleanup is also needed, return it from the outer (non-async) callback.
- Never use the HTML `autofocus` attribute — unreliable since React dynamically injects
  most elements. Capture with `useRef` and call `.focus()` in a mount-only effect.
- To listen for events anywhere in the viewport, attach via `window.addEventListener`
  inside a mount-only effect rather than a React handler on one node — always remove it
  in cleanup.

## Stale values

- An effect/callback registered with an empty (or incomplete) dependency array captures
  state as of when it first ran — any handler defined inside keeps seeing the old value.
- Use the functional-updater form (`setValue(current => !current)`) to read the true
  current value inside a long-lived callback without adding that state to the deps array.
- Split unrelated concerns into separate effects: one for a persistent subscription
  (deps `[]`), another to react to state changes and drive related work (deps `[state]`).
- Default to plain updates (`setCount(count + 1)`); reach for the functional-updater form
  specifically when you hit (or expect) a stale-value bug, not everywhere "just in case."

## Refs

- `useRef()` gives a stable, mutable box for imperative access — attach with
  `ref={someRef}`, read via `someRef.current`. Refs can hold any value, not just DOM nodes.
- Ref objects never go stale the way state does, so they generally don't need to be in a
  `useEffect`/`useMemo` dependency array even if a linter flags it.
- Pass the whole ref object into a custom hook (not `ref.current`) when the hook reads
  the DOM node from an effect — at the moment the component body runs, `.current` is
  still `undefined`; unwrapping it too early captures `undefined` forever.

## Custom hooks

- Extract a "combo" of built-in hooks (state + effect + cleanup) implementing one
  discrete behavior into a `useX` function.
- A custom hook needing a DOM ref can either accept a caller-created ref or create and
  own it itself, returning it alongside its state — choose based on whether the caller
  needs the ref for anything else.
- If a custom hook is a drop-in replacement for `useState` (e.g. `useToggle`), support
  the same lazy-initializer-function pattern.
- To keep a custom hook's returned function referentially stable (so consumers can pass
  it to a `React.memo`-wrapped child), wrap it with `useCallback` inside the hook.

## useId

- Use `React.useId()` for unique, stable per-instance ids instead of hardcoding strings
  — keeps components safe to render multiple times without colliding `id` attributes.
- Namespace multiple related field ids off one `useId()` call:
  `const id = useId(); const usernameId = \`${id}-username\`;`.
