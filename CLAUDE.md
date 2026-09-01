# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is the frontend for "MyList". Auth (register/login/logout) is the first real feature, built on TanStack Router + TanStack Query + Zustand + axios (see Stack below). There is still no test framework configured.

## Commands

- `npm run dev` — start the Vite dev server with HMR
- `npm run build` — type-check via `tsc -b` then produce a production build with `vite build`
- `npm run lint` — run ESLint over the project
- `npm run preview` — serve the production build locally

There is no test script configured in [package.json](package.json).

## Architecture

- Entry point [src/main.tsx](src/main.tsx) creates the TanStack Router router and a `QueryClient`, then mounts `RouterProvider` (wrapped in `QueryClientProvider`) into `#root` in [index.html](index.html). There is no top-level `App.tsx` — routes under `src/routes/` own what renders.
- Static assets served as-is live in [public/](public/) (e.g. `icons.svg`, referenced via `<use href="/icons.svg#...">`); imported/bundled assets live in [src/assets/](src/assets/).
- TypeScript project uses solution-style config: [tsconfig.json](tsconfig.json) references [tsconfig.app.json](tsconfig.app.json) (app source, `src/`) and [tsconfig.node.json](tsconfig.node.json) (Vite config itself). `tsc -b` builds both as part of `npm run build`.
- ESLint config ([eslint.config.js](eslint.config.js)) is flat-config style, composing `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`. It currently uses non-type-aware TS linting (`tseslint.configs.recommended`), not the stricter type-checked variants.

# item-list-frontend

## What this is

A React SPA for a flexible item/list tracker: users create lists of "things they want" — a shopping list with prices, a personal collection without prices, etc. Each item belongs to a category, has tags and images, plus a set of fields that vary by category (price, size, condition, description, ...).

This is a learning/practice project built deliberately with production-grade patterns — the goal is real-world architecture, not shortcuts.

## This repo

Frontend only. Talks to a separate FastAPI backend (own repo: `item-list-backend`) over REST — `http://localhost:8000` in dev. The backend's own routes have no `/api` prefix (e.g. `/auth/login`, not `/api/auth/login`); the frontend calls `/api/...` and Vite's dev proxy (see `vite.config.ts`) strips the `/api` prefix and forwards to the backend, both to avoid CORS and to keep a stable frontend-facing path independent of how the backend is mounted.

## Stack

- Vite + React + TypeScript
- **TanStack Router** (file-based, routes in `src/routes/`) — not React Router
- **TanStack Query** for all server state
- **Zustand** for client-only state (auth status, UI toggles) — keep this minimal, most state should be server state via Query, not client state
- **axios** for HTTP — one shared instance in `src/lib/api-client.ts` (`baseURL: '/api'`, `withCredentials: true`), with a response interceptor that normalizes every failure into a typed `ApiError`
- Tailwind CSS v4 (no config file — `@import "tailwindcss"` in `index.css`) + shadcn/ui — installed; `components.json` uses the `radix-nova` style/preset (Radix UI primitives, `neutral` base color). Add components with `npx shadcn@latest add <name>`, which lands in `src/components/ui/` (treat as vendored — don't hand-edit beyond what the CLI generates). `cn()` helper lives at `src/lib/utils.ts`. Note: this registry's `form` item resolves to zero files — there is no classic RHF-context `Form`/`FormField` component here. Build forms with the newer `Field`/`FieldLabel`/`FieldError`/`FieldGroup` primitives (`npx shadcn add field`) wired directly to `react-hook-form`'s `register()`/`formState.errors`, no context wrapper needed.
- Zod + React Hook Form for forms — installed (`zod`, `react-hook-form`, `@hookform/resolvers`)

## Key architectural decisions

- **Variable fields per category**: each Category defines its own field schema (a JSON list of `{key, type, required}`) on the backend. Fixed fields (title, tags, images) are the only ones hardcoded anywhere in this codebase. Custom fields are rendered and validated dynamically — build the Zod schema for a category's custom fields at runtime from that JSON. Don't hand-write per-category schemas.
- **API types**: generated from the backend's OpenAPI spec (via Orval), not hand-written. If a type or Zod schema looks like it duplicates a backend Pydantic model, it should probably be generated instead.
- **Auth**: Session-cookie auth (Django-auth style), not JWT — the backend sets an httpOnly `session_id` cookie directly on `POST /api/auth/login` and `POST /api/auth/register` (register auto-logs-in, no separate login call needed). The frontend never handles a token; all requests go through the shared axios instance with `withCredentials: true`. Client-side auth status lives in a minimal Zustand store (`src/features/auth/store.ts`: `user`, `status`), never persisted to localStorage — it's seeded directly from the login/register response body, and rehydrated on every fresh page load via a `GET /api/auth/me` query run in the root route's (`src/routes/__root.tsx`) `beforeLoad`, which every other route's `beforeLoad` can then read synchronously. The backend currently implements no CSRF protection — a backend gap, not something the frontend compensates for.
- **Image uploads**: presigned-URL flow. Request a presigned URL from the backend, upload the file straight to S3/MinIO from the browser, then send the backend the resulting object key. Image bytes never pass through the API server.

## Conventions

- Routes: one file per route under `src/routes/`, file-based. `routeTree.gen.ts` is auto-generated on `npm run dev` — never hand-edit it.
- Path alias `@/` → `src/` (configured in `vite.config.ts` and the `paths` field of both `tsconfig.json` and `tsconfig.app.json`; no `baseUrl` — deprecated in the TS version this project pins)
- Anything that touches the API goes through TanStack Query; Zustand only for state with no server counterpart
- Client-side validation (Zod) is a UX convenience, not a security boundary — the backend re-validates everything regardless
- Comments: only when the why isn't obvious from the code, 1-2 sentences max

## React conventions

Component/hook/state patterns (from Josh Comeau's React course) live in project skills,
not here, since they're only relevant while actively writing components — see
`react-state-patterns`, `react-hooks-and-effects`, `react-component-api`, and
`react-rendering-and-perf` under `.claude/skills/`.

## Known cleanup item

`src/index.css` still carries the original template's CSS custom properties (`--border`, `--accent`, etc.) alongside the CSS variables `shadcn init` added for its own theme — a few names collide (e.g. `--border`, `--accent` now hold shadcn's oklch values, not the template's original hex/rgba ones). Real UI has now landed (auth pages, `src/routes/index.tsx`), so this collision is live, not just latent — worth cleaning up the next time this file is touched.

## Related

Backend repo: `item-list-backend` (has its own `CLAUDE.md` with the corresponding backend-side decisions)
