---
name: react-component-api
description: Component API design for this app — JSX footguns, prop delegation, polymorphism, context, forwarding refs (React 19), and working with shadcn/Radix unstyled primitives. Load when designing a new reusable component, a form input wrapper, or wiring up context/providers.
---

# React component API design

Condensed from Josh Comeau's React course, adjusted for this project's React 19 +
shadcn/Radix stack.

## JSX footguns worth remembering

- `{isOnline && <Dot />}` renders a literal `"0"` if the left side is a number like
  `0`, not just falsy — coerce explicitly (`count > 0 && ...` or `!!count && ...`).
- Trust Prettier for the `{' '}` whitespace-between-elements fix rather than hand-adding it.
- Convey visually-only information (a colored status dot) to screen readers with
  visually-hidden text, not `aria-label` on a non-semantic element like a `div` —
  screen readers ignore `aria-label` on divs.
- When a component's visual variants map to a fixed set of meanings (cancel vs.
  confirm), expose a semantic prop like `status`, not raw style props like `color`.

## Producers and consumers

- Every component is a small closed API — consumers only see the props you expose.
  Prioritize the consumer experience over the producer experience; a component is
  consumed far more often than it's authored. Keep naming/patterns consistent across
  your component APIs.
- Split a component mixing a generic "shape" with specific business logic into two
  layers: a low-level reusable component, and a wrapper that layers the business rule
  on top.
- Don't over-parameterize a one-off component with props it doesn't need.

## Prop delegation

- Forward an arbitrary number of props with rest/spread rather than listing each one:
  `function Wrapper({ user, ...delegated }) { return <Base {...delegated} /> }`.
- Design low-level input-wrapping components (a custom `TextInput`) to spread arbitrary
  extra props onto the underlying native element, including `className` and data attrs.
- **Conflict ordering**: attributes listed _after_ `{...delegated}` always win (locks
  that attribute down); attributes listed _before_ it can be overridden by the consumer.
  Choose this deliberately per prop.
- For props that must be _combined_, not one replacing the other (`className`, `style`),
  don't rely on spread ordering — merge manually:
  `className={\`built-in-class ${className}\`}`or`style={{ ...builtInStyle, ...style }}`.
- When a generated value is applied to two elements (an `id` on both `<input id>` and
  `<label htmlFor>`), compute it once and reuse it in both places.

## Polymorphism

- Choose HTML tags by semantics, not appearance (`<button>` for actions, `<a>` for
  navigation) — removing default styles is easier than recreating native a11y behavior.
- Build polymorphic components that pick a tag based on a prop, e.g.
  `const Tag = typeof href === 'string' ? 'a' : 'button'`. Prefer a precise check
  (`typeof href === 'string'`) over truthiness when a value can be valid-but-falsy
  (`href=""` is a legitimate same-page link).
- A generic `as` prop works when a component must render several possible tags across
  many situations; a boolean prop (`ordered` → `ol`/`ul`) is simpler when there are
  exactly two options.
- Choose heading levels (`<h1>`-`<h6>`) by document hierarchy, not desired size — style
  size with CSS. Build heading wrappers that accept the level as a prop.

## Forwarding refs (React 19)

- This project is on React 19 — ref forwarding needs no special API. Destructure `ref`
  like any other prop and pass it to the underlying element. `React.forwardRef` is only
  needed for React ≤18 code you might encounter in examples/libraries.

## Context

- Reach for context specifically to avoid "prop drilling" — threading a value through
  intermediate components that don't use it themselves.
- On React 19 you can render the context object directly as the provider
  (`<ThemeContext value={...}>`) and consume with `use(ThemeContext)` instead of
  `useContext` — `use` can be called conditionally or after an early return, unlike
  `useContext`.
- To let descendants read _and_ update a value, pass an object bundling state + setter
  through `value` — a bare primitive gives no way to change it.
- It's fine to keep passing a value via normal props to components that use it directly
  (no drilling involved), even after creating a context for it elsewhere.
- **Provider components**: extract each context's `createContext()` + `useState` +
  `<Context.Provider>` JSX into its own dedicated component wrapping `children`, rather
  than dumping every context definition into `App`.
- **Performance**: a `React.memo`-wrapped consumer still re-renders whenever the context
  value changes (treat context as internal props). An inline object literal passed as
  `value` is a new reference every render, defeating memoization for every consumer —
  fix by memoizing the value object with `useMemo`, keyed on what it contains. Wrapping
  the _Provider component_ in `React.memo` does not fix this; memoize the value, not
  the provider.

## Compound components — avoid

- Prefer plain named exports over the compound-component pattern (`Dropdown.Toggle`,
  `Dropdown.Menu`) for this codebase's own components — it loses standard tree-shaking
  and confuses developers unfamiliar with it. (This matches shadcn's own generated
  components, which use plain exports.)

## Working with shadcn/Radix (unstyled primitives)

- Use unstyled/headless libraries (Radix Primitives, underlying shadcn/ui here) for
  hard-to-get-right widgets — modals, comboboxes, menus, tooltips, accordions — instead
  of hand-rolling accessibility from scratch.
- When you adopt a primitive's dialog/modal, don't also hand-roll Escape handling,
  focus trap, scroll lock, or ARIA attributes — the primitive already provides them.
- Use a library's compound components (`Accordion.Root`/`Item`/`Trigger`/`Content`) for
  the interactive wiring, and apply your own Tailwind classes to match this project's
  design — this is different from "avoid compound components" above, which is about
  _this codebase's own_ component exports, not consuming a primitives library's API.
- Pick the semantically correct primitive: a Tooltip describes a control, a Popover is
  the general-purpose "floats over other content" component.

## Modals — accessibility checklist

- `role="dialog"`, `aria-modal="true"`, and `aria-label`/`aria-labelledby`.
- Move focus into the modal on open, restore it to the previously-focused element on
  close, and trap focus inside while open.
- Support Escape to close (call `preventDefault`), let backdrop clicks dismiss, prevent
  background scroll while open.
- Give an icon-only close button an accessible name via visually-hidden text.
