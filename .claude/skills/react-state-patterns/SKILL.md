---
name: react-state-patterns
description: State management patterns for React components in this app — immutability, keys, lifting state, deriving vs. storing state, useReducer, Immer, controlled/uncontrolled components, and handler design. Load when writing or reviewing component state logic.
---

# React state patterns

Condensed from Josh Comeau's React course. Applies to local component state — for
server state, use TanStack Query per CLAUDE.md, not hand-rolled state.

## useState basics

- State setters are async/scheduled — code right after a setter call still sees the
  old value. If you need the updated value immediately, compute it into a local
  variable first and use that.
- Multiple setter calls in the same handler batch into one re-render.
- For an expensive initial value (e.g. reading `localStorage`), pass an initializer
  function — `useState(() => expensiveCalc())` — not a direct call, so it only runs once.

## Immutability

- Always create a new object/array when updating state that holds one — React compares
  by reference, not deep equality. Clone, modify the clone, then set it.
- Never mutate the array/object currently in state, even briefly before calling the
  setter — causes stale-UI and misplaced-DOM-node bugs.
- Reach for Immer's `produce()` for deeply nested state updates instead of hand-spreading
  every level — it's ~3-5kb gzipped, low bar to add if updates get painful.

## Keys

- Generate a stable unique id at creation time (`crypto.randomUUID()`) and store it as
  part of the item's own data — don't regenerate on every render.
- Array index (or `array.length`) as `key` breaks once items can be deleted, reordered,
  or filtered — only safe when order/membership never change.
- Keys only need to be unique within their own `.map()` call, not globally.

## Lifting state up

- When sibling components need to share/sync state, move it to their closest common
  parent and pass it down via props + a handler — don't duplicate it per sibling.
- An unmounted component's state is destroyed permanently. If state needs to survive
  being hidden, keep the component mounted and hide it visually instead.

## Deriving state

- Prefer computing a value from existing state during render over storing it in its own
  state variable — keeps state easier to reason about, no two variables to keep in sync.
- Don't assume a derived calculation is "too expensive" without measuring — most
  everyday string/array processing is a non-issue at typical scale.
- Exception: it's fine to keep something in its own state variable when it's a genuinely
  distinct concern in your mental model (e.g. a `status` enum you expect to grow more
  states), not purely a byproduct of other state.

## useReducer

- Reach for it when state-updating logic is complex enough that grouping it beats
  scattering multiple `setX` calls across handlers — not by default for simple cases.
- Keep reducers pure: same `(state, action)` in → same output. Don't generate
  `crypto.randomUUID()`/`Math.random()` inside the reducer — compute it beforehand and
  pass it in via the action.
- Design actions around what happened (`'item-added'`), not generic `update-x`/`set-x`
  types that just hand the reducer a precomputed next value.
- `switch (action.type)`, each case in its own `{ }` block, end with `return` or `break`.
  Skip the `default` case — safe to disable that lint rule for `useReducer`-style reducers.

## Controlled vs. uncontrolled (single source of truth)

- A component is uncontrolled when it manages its own internal state, controlled when
  the consumer supplies both the value and an onChange-style callback — pick one model
  per component, never both at once (forces a syncing effect and subtle bugs, e.g. a
  forgotten `onChange` call silently breaking an external reset).
- When a parent needs to read or reset a child's value externally, make the child fully
  controlled rather than layering external control onto an uncontrolled component.
- A prop used only to seed initial state (`useState(initialVal)`) is fine, as long as
  it's clear later prop changes won't resync the state.

## Principle of least privilege

- Don't pass a raw setter (`setItems`) down to a descendant just to let it make one
  specific update — it grants power to make arbitrary unrelated changes.
- Define a narrowly-scoped handler in the state's owner (`handleAddItem(label)`) and
  pass that down instead. Centralizing update logic in a handful of named handlers
  (rather than scattering `setX` calls through descendants) makes the codebase easier
  to follow for a newcomer.
