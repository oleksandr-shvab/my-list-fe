# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is the frontend of Daily Game Challenge. Auth (register/login/logout) is the first real feature, built on TanStack Router + TanStack Query + Zustand + axios (see Stack below). Unit tests run on Vitest (`npm test`; config in `vitest.config.ts`, files named `*.test.ts` next to the code). CI (`.github/workflows/ci.yml`) runs lint, format check, type check and build, and the tests. Component tests run in jsdom with Testing Library (see Conventions). There are no end-to-end tests yet.

## Commands

- `npm run dev` — start the Vite dev server with HMR
- `npm run build` — type-check via `tsc -b` then produce a production build with `vite build`
- `npm run lint` — run ESLint over the project
- `npm run format` — format the project with Prettier (`npm run format:check` only checks)
- `npm run api:generate` — regenerate the API client in `src/api/generated/` from the backend OpenAPI snapshot
- `npm run preview` — serve the production build locally

- `npm test` — run the Vitest unit tests once (`npm run test:watch` to watch)

## Architecture

- Entry point [src/main.tsx](src/main.tsx) builds the `QueryClient` ([src/lib/query-client.ts](src/lib/query-client.ts)) and the router ([src/router.ts](src/router.ts)), installs the session guard, then mounts `RouterProvider` (wrapped in `QueryClientProvider`) into `#root` in [index.html](index.html). Both are factory functions, so tests can build their own. There is no top-level `App.tsx` — routes under `src/routes/` own what renders.
- Static assets served as-is live in [public/](public/) (today only the favicon).
- TypeScript project uses solution-style config: [tsconfig.json](tsconfig.json) references [tsconfig.app.json](tsconfig.app.json) (app source, `src/`) and [tsconfig.node.json](tsconfig.node.json) (Vite config itself). `tsc -b` builds both as part of `npm run build`.
- ESLint config ([eslint.config.js](eslint.config.js)) is flat-config style, composing `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`. It currently uses non-type-aware TS linting (`tseslint.configs.recommended`), not the stricter type-checked variants.

## This repo

Frontend only. It talks to the FastAPI backend in the `my-list-be` repo, on `http://localhost:8000` in dev.
The app calls `/api/v1/...`; Vite's dev proxy (`vite.config.ts`) strips `/api` and forwards `/v1/...` to the backend.
Open the app at `http://localhost:5173`, not `127.0.0.1`, because the session cookie is host-scoped.

## Stack

- Vite + React + TypeScript
- **TanStack Router** (file-based, routes in `src/routes/`) — not React Router
- **TanStack Query** for all server state
- **Zustand** for client-only state (the theme today) — keep this minimal, most state should be server state via Query, not client state. The signed-in state is server state: it is not in Zustand.
- **axios** for HTTP — one shared instance in `src/lib/api-client.ts` (`baseURL: '/api'`, `withCredentials: true`), with a response interceptor that normalizes every failure into a typed `ApiError`
- Tailwind CSS v4 (no config file — `@import "tailwindcss"` in `index.css`) + shadcn/ui — installed; `components.json` uses the `radix-nova` style/preset (Radix UI primitives, `neutral` base color). Add components with `npx shadcn@latest add <name>`, which lands in `src/components/ui/` (treat as vendored — don't hand-edit beyond what the CLI generates; the edits listed under "Vendored edits" below are the only ones). `cn()` helper lives at `src/lib/utils.ts`. Note: this registry's `form` item resolves to zero files — there is no classic RHF-context `Form`/`FormField` component here. Build forms with the newer `Field`/`FieldLabel`/`FieldError`/`FieldGroup` primitives (`npx shadcn add field`) wired directly to `react-hook-form`'s `register()`/`formState.errors`, no context wrapper needed.
- Zod + React Hook Form for forms — installed (`zod`, `react-hook-form`, `@hookform/resolvers`)

## Key architectural decisions

- **API types and client**: generated from the backend's OpenAPI snapshot with Orval (`npm run api:generate`, config in `orval.config.ts`; locally it reads `../my-list-be/openapi/openapi.json`, CI reads the snapshot on the backend's `main`). The output is committed in `src/api/generated/` (never hand-edit it) and every request goes through `apiClient` via `src/lib/orval-mutator.ts`, so errors become `ApiError`. `src/features/auth/types.ts` only aliases the generated models. CI's `api-types` job fails when the committed code differs from the backend contract. Backend paths are under `/v1`, so the app calls `/api/v1/...`.
- **Auth**: Session-cookie auth (Django-auth style), not JWT. The backend sets an httpOnly `session_id` cookie on login and register (register logs in too). The frontend never handles a token; all requests use the shared axios instance with `withCredentials: true`. Login is optional: the `_app` layout and its pages are public, and only the pages under `src/routes/_app/_account/` (today `/profile`) need an account. The backend currently implements no CSRF protection — a backend gap, not something the frontend compensates for.
  - **One source of truth.** The signed-in state lives only in the `GET /auth/me` query (`meQueryOptions`). Its data is the user, or `null` for a guest (`getMe` turns a 401 into `null`). A query error means "unknown" (network, 5xx). Nothing copies it into other state. Read it with `useSession()` (`src/features/auth/session.ts`): status `pending`, `signed_in`, `guest` or `error`, plus `user` and `retry`. Route guards call `ensureSession(queryClient)`.
  - **Guards.** The root route starts `/auth/me` and does not wait, so public pages show at once. `_app/_account.tsx` waits for it: a guest goes to `/login?redirect=<page>`, and a failed check shows the error screen with the request id inside the layout. Login, sign-up and forgot-password wait too and send a signed-in user to `/`; if the check fails they show anyway. Reset-password does not wait and keeps its token for a signed-in user. These guards are a convenience: the backend answers 401 on account endpoints either way.
  - **`redirect` search parameter.** Anyone can write it into a link. `resolveRedirect` (`src/features/auth/redirect.ts`) accepts only the site's own origin, returns the resolved path, query and hash, and rejects the auth pages and paths that start with `//`. Never navigate to the raw value.
  - **401 mid-session.** `installSessionGuard` (`session-guard.ts`) reacts to a 401 on any call while a user is shown: it sets the `me` data to `null` and drops all other cached queries (`signOutLocally`). On an `accountOnly` page it also shows the "session ended" toast and invalidates the router, so `_account` sends the user to login. On a public page the user stays. `getMe` passes the query's abort signal, so a `/auth/me` request that a login or logout replaced is dropped and its late 401 cannot sign the new user out. Do not use `queryClient.clear()` or remove the `me` query to sign out: a mounted `useQuery` keeps reading the removed query and shows the old user.
  - **Logout and reset.** `finishLogout` signs out locally and goes to `/` only from an account page. `finishPasswordReset` signs out locally and goes to `/login`, because the backend ends all sessions of the reset account.

## Games

- The registry is `src/features/games/registry.ts`, a static list for now (Phase 1 moves the list to the backend). An entry has exactly five items: `slug`, `nameKey`, `order`, `isDefault`, `screen` (`src/features/games/types.ts`). Adding a game is adding one entry.
- Exactly one entry is the default, and `/` shows it. Slugs match `^[a-z0-9]+(-[a-z0-9]+)*$` and are unique, and every `nameKey` exists in both catalogues. `validateRegistry` checks this; `validate-registry.test.ts` runs it on the real registry.
- The shell gives a screen only `slug`, `date` (YYYY-MM-DD, UTC) and `isToday`. A screen is a lazy component, so a game's code downloads when its page opens.
- `GameScreen` (`src/features/games/game-screen.tsx`) renders the screen inside `GameErrorBoundary` and a `Suspense`. A crash shows an error with "Try again" inside the layout, and the sidebar keeps working. The boundary is keyed by game and day, never by language, so a language switch keeps the screen and its state. A game module must not key its progress by language either.
- "Today" is the UTC day (`src/lib/utc-date.ts`), never the device's day. It is read once per route load, so an open page keeps its day past 00:00 UTC.
- Routes: `/` (the default game, today), `/games/$slug` (today), `/games/$slug/$date` and `/games/$slug/archive`. `games/$slug.tsx` checks the slug against the registry (exact and case-sensitive), and `$date.tsx` checks the date. A bad slug or date throws `notFound()`, and the "not found" screen renders inside the layout. Today's date shows the same screen as `/games/$slug`, with no redirect. A date is a puzzle date only from `FIRST_PUZZLE_DATE` (2026-01-01, a temporary bound until Phase 1's backend answers which days exist) up to today.
- The placeholder is `src/features/games/game-guesser/placeholder-screen.tsx`. Phase 2 replaces only that entry's `screen`.

## Shell

- Every page under the `_app` layout (`src/routes/_app.tsx`) has the same frame: a skip link (`src/components/skip-link.tsx`, the first focusable element, it moves focus to `main`), the sidebar, and one `main` (id `main`, `tabIndex` -1) that holds the page. The layout does not use `SidebarInset`, so the phone header is not inside `main`.
- The sidebar (`src/components/app-sidebar.tsx`) holds, in this order: the brand link, a `nav` labelled "Games" with one entry per registry game (in `order`) and the archive link, then at the bottom the language switcher, the theme toggle, the account area and the collapse button. It stays open beside the content from 768 px and keeps its icon-collapse mode and the `sidebar_state` cookie.
- The current game (`src/features/games/use-current-game.ts`) is the game of the `slug` in the address, or the default game on `/`. Exactly one game entry gets `aria-current="page"`, and none on the archive page (the archive link has it) or on pages that are not a game. The entry sets the attribute itself, because `activeOptions.exact` stops the router marking it on the archive page and does not match `/` or a dated page.
- Below 768 px `PhoneHeader` (`src/components/phone-header.tsx`) shows one row: the sidebar button, the brand and the compact account control. It is the page banner, and sticks to the top only on screens at least 500 px tall. `src/index.css` adds `scroll-padding-top` so it never covers the focused element. The sidebar becomes a panel (a Radix dialog). It is opened by a plain button, not a dialog trigger, so Radix cannot return focus; `PhoneHeader` focuses its button when the panel closes without navigation (Escape, a tap outside, the close button), and `main` when a link in the panel closed it (the sidebar's links set a ref the layout shares). The phone breakpoint is `not (min-width: 48rem)`, the exact complement of Tailwind's `md`, in `use-mobile.ts` and in the `index.css` media query. Wider screens do not render the header at all, and the collapse button shows only there.
- The account area (`src/features/auth/components/account-area.tsx`) has a `sidebar` and a `compact` variant. Its states are a placeholder of the same size, "Retry", "Log in" and "Sign up" (each carrying the current page as `redirect`), and for a signed-in user a dropdown menu (Profile, Log out) whose button is named with the email. While a logout runs, the button is `aria-disabled` (never `disabled`, which drops the focus), ignores the open keys, and is busy and named "Logging out…" (the menu closes on select), and afterwards the focus moves to "Log in". Choosing Profile in the panel focuses `main` once the menu is gone (the menu's own focus return is skipped). The sidebar's links close the phone panel only on a plain click (`src/lib/plain-click.ts`); a ctrl, cmd, shift, alt or non-primary click is left to the browser.
- Touch controls are 44 px high below 768 px (`max-md:` classes on our own components), and at least 24 px everywhere.

## Vendored edits

- `src/components/ui/sidebar.tsx`: `Sidebar` takes `mobileTitle` and `mobileDescription` (defaults are the CLI's English). The phone panel's hidden title and description come from the catalogues through them. The edit is marked with an `EDIT` comment. Reapply it after `shadcn add sidebar --overwrite`.
- `src/components/ui/dropdown-menu.tsx`: added with the CLI. The CLI wrote `import { cn } from "cn"` and added a `cn` package; both were undone and the import is `@/lib/utils`, like the other `ui` files.

## Conventions

- Routes: one file per route under `src/routes/`, file-based. `routeTree.gen.ts` is auto-generated on `npm run dev` — never hand-edit it. After you add, move or delete a route file, run `npx vite build` first: `tsc -b` fails on a stale tree.
- Page titles: a page route sets `staticData: { pageTitle: '<catalogue key>' }`. `useDocumentTitle` (`src/lib/page-title.ts`) shows it as "{page} | {app name}" and follows the language. A game page sets `GAME_NAME_TITLE` instead, which becomes the name of the game in the `slug` param (the default game on `/`). An unknown path falls to `src/routes/_app/$.tsx`, so the "not found" screen stays inside the layout.
- Tests: `*.test.ts` next to the code. Router tests are in `src/test/`: they build the real route tree from `src/router.ts` on a memory history, with a fake backend behind the axios client (`router-harness.ts`), and run in Node. Import `src/test/browser-stubs.ts` first in such a file. Never put a test file in `src/routes/`: the router plugin would treat it as a route. A test that needs a stylesheet's text gets it from `vitest.config.ts` through `provide` and `inject('cssText')` (typed in `src/test/provided-context.d.ts`): `?raw` returns an empty string for CSS, and importing `node:fs` in `src/` would leak Node types into the app type check.
- Component tests: the first line is `// @vitest-environment jsdom` (Node stays the default), and `src/test/dom-setup.ts` is the first import (a `matchMedia` stub and Testing Library cleanup; there is no `scrollIntoView` stub, the sidebar scrolls its own list). `src/test/app.test.tsx` and `src/test/shell.test.tsx` render the real route tree in jsdom with the same fake backend (the shell tests cover the current-game mark, the account menu keys, the skip link, the landmarks and the phone panel; `vi.stubGlobal('matchMedia', …)` makes the screen a phone); hook tests use `renderHook` with `RouterContextProvider`. Query by role and text and use `userEvent`. `jest-dom` is not installed, so assertions are plain (`textContent`, `getAttribute`).
- Path alias `@/` → `src/` (configured in `vite.config.ts` and the `paths` field of both `tsconfig.json` and `tsconfig.app.json`; no `baseUrl` — deprecated in the TS version this project pins)
- Anything that touches the API goes through TanStack Query; Zustand only for state with no server counterpart
- Client-side validation (Zod) is a UX convenience, not a security boundary — the backend re-validates everything regardless
- Comments: only when the why isn't obvious from the code, 1-2 sentences max

## React conventions

Component/hook/state patterns (from Josh Comeau's React course) live in project skills,
not here, since they're only relevant while actively writing components — see
`react-state-patterns`, `react-hooks-and-effects`, `react-component-api`, and
`react-rendering-and-perf` under `.claude/skills/`.

## Translations (English and Russian)

- react-i18next, set up in `src/i18n/` (imported first in `main.tsx`). Texts live in `src/i18n/locales/en.json` and `ru.json`; keys are typed from the English file, so `t('auth.login.title')` is checked by `tsc`. A Vitest test fails when the two files have different keys (plural suffixes aside).
- Never write user-visible text in a component: add a key to both catalogues. Russian plurals need `_one`, `_few`, `_many`, `_other` forms and a `count` param.
- The language is chosen by: the saved choice (`localStorage` key `language`), else the browser's language if it is English or Russian, else English (`src/i18n/language.ts`). `<html lang>` follows. The language switcher is `src/components/language-switcher.tsx`. Saving it on the account comes with a backend field later.
- Backend errors are translated by `code`: `errors.<code>` in the catalogues (`src/lib/error-messages.ts`); an unknown code shows `errors.unknown`, never the backend's English. Zod schemas are built with the current `t` (`createLoginSchema(t)` in `useMemo`).
- Errors: unexpected errors go through `src/lib/report-error.ts` (the future error tracker hook); Query retries only network errors, 5xx, 408 and 429, at most twice (`src/lib/query-retry.ts`); an old tab that fails to load a lazy chunk after a deploy reloads once (`src/lib/version-skew.ts`).

## Related

Backend repo: `my-list-be` (has its own `CLAUDE.md` with the corresponding backend-side decisions). Cross-repo contract (auth cookie/session details, `/api` proxy convention, OpenAPI/Orval sync) lives in `../CONTRACTS.md` — check it before changing anything that touches the backend boundary, and update it in the same pass if the contract shifts.
