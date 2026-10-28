# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is the frontend of Daily Game Challenge. Auth (register/login/logout) is the first real feature, built on TanStack Router + TanStack Query + Zustand + axios (see Stack below). Unit tests run on Vitest (`npm test`; config in `vitest.config.ts`, files named `*.test.ts` next to the code). CI (`.github/workflows/ci.yml`) runs lint, format check, type check and build, and the tests. No component or end-to-end tests yet.

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
- Tailwind CSS v4 (no config file — `@import "tailwindcss"` in `index.css`) + shadcn/ui — installed; `components.json` uses the `radix-nova` style/preset (Radix UI primitives, `neutral` base color). Add components with `npx shadcn@latest add <name>`, which lands in `src/components/ui/` (treat as vendored — don't hand-edit beyond what the CLI generates). `cn()` helper lives at `src/lib/utils.ts`. Note: this registry's `form` item resolves to zero files — there is no classic RHF-context `Form`/`FormField` component here. Build forms with the newer `Field`/`FieldLabel`/`FieldError`/`FieldGroup` primitives (`npx shadcn add field`) wired directly to `react-hook-form`'s `register()`/`formState.errors`, no context wrapper needed.
- Zod + React Hook Form for forms — installed (`zod`, `react-hook-form`, `@hookform/resolvers`)

## Key architectural decisions

- **API types and client**: generated from the backend's OpenAPI snapshot with Orval (`npm run api:generate`, config in `orval.config.ts`; locally it reads `../my-list-be/openapi/openapi.json`, CI reads the snapshot on the backend's `main`). The output is committed in `src/api/generated/` (never hand-edit it) and every request goes through `apiClient` via `src/lib/orval-mutator.ts`, so errors become `ApiError`. `src/features/auth/types.ts` only aliases the generated models. CI's `api-types` job fails when the committed code differs from the backend contract. Backend paths are under `/v1`, so the app calls `/api/v1/...`.
- **Auth**: Session-cookie auth (Django-auth style), not JWT. The backend sets an httpOnly `session_id` cookie on login and register (register logs in too). The frontend never handles a token; all requests use the shared axios instance with `withCredentials: true`. Login is optional: the `_app` layout and its pages are public, and only the pages under `src/routes/_app/_account/` (today `/profile`) need an account. The backend currently implements no CSRF protection — a backend gap, not something the frontend compensates for.
  - **One source of truth.** The signed-in state lives only in the `GET /auth/me` query (`meQueryOptions`). Its data is the user, or `null` for a guest (`getMe` turns a 401 into `null`). A query error means "unknown" (network, 5xx). Nothing copies it into other state. Read it with `useSession()` (`src/features/auth/session.ts`): status `pending`, `signed_in`, `guest` or `error`, plus `user` and `retry`. Route guards call `ensureSession(queryClient)`.
  - **Guards.** The root route starts `/auth/me` and does not wait, so public pages show at once. `_app/_account.tsx` waits for it: a guest goes to `/login?redirect=<page>`, and a failed check shows the error screen with the request id inside the layout. Login, sign-up and forgot-password wait too and send a signed-in user to `/`; if the check fails they show anyway. Reset-password does not wait and keeps its token for a signed-in user. These guards are a convenience: the backend answers 401 on account endpoints either way.
  - **`redirect` search parameter.** Anyone can write it into a link. `resolveRedirect` (`src/features/auth/redirect.ts`) accepts only the site's own origin, returns the resolved path, query and hash, and rejects the auth pages and paths that start with `//`. Never navigate to the raw value.
  - **401 mid-session.** `installSessionGuard` (`session-guard.ts`) reacts to a 401 on any call while a user is shown: it sets the `me` data to `null` and drops all other cached queries (`signOutLocally`). On an `accountOnly` page it also shows the "session ended" toast and invalidates the router, so `_account` sends the user to login. On a public page the user stays. Do not use `queryClient.clear()` or remove the `me` query to sign out: a mounted `useQuery` keeps reading the removed query and shows the old user.
  - **Logout and reset.** `finishLogout` signs out locally and goes to `/` only from an account page. `finishPasswordReset` signs out locally and goes to `/login`, because the backend ends all sessions of the reset account.

## Conventions

- Routes: one file per route under `src/routes/`, file-based. `routeTree.gen.ts` is auto-generated on `npm run dev` — never hand-edit it. After you add, move or delete a route file, run `npx vite build` first: `tsc -b` fails on a stale tree.
- Page titles: a page route sets `staticData: { pageTitle: '<catalogue key>' }`. `useDocumentTitle` (`src/lib/page-title.ts`) shows it as "{page} | {app name}" and follows the language. An unknown path falls to `src/routes/_app/$.tsx`, so the "not found" screen stays inside the layout.
- Tests: `*.test.ts` next to the code. Router tests are in `src/test/`: they build the real route tree from `src/router.ts` on a memory history, with a fake backend behind the axios client (`router-harness.ts`), and run in Node. Import `src/test/browser-stubs.ts` first in such a file. Never put a test file in `src/routes/`: the router plugin would treat it as a route.
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
