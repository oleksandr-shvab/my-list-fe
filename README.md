# Daily Game Challenge: frontend

The web app of Daily Game Challenge, a site of daily puzzle games. It is a single-page app built with Vite, React and TypeScript.

The backend is the `my-list-be` repo (FastAPI). The contract between the two is `CONTRACTS.md` in the folder that holds both repos.

## Install

```sh
npm ci
```

## Run

Start the backend first (see its README), then:

```sh
npm run dev
```

Open `http://localhost:5173`. Use `localhost`, not `127.0.0.1`, because the session cookie is host-scoped. The dev server forwards `/api` to the backend on `http://localhost:8000`.

## Check

```sh
npm run lint
npm run format:check
npm run build   # type check, then the production build
npm test
```

## Regenerate the API client

```sh
npm run api:generate
```

This reads `../my-list-be/openapi/openapi.json` and rewrites `src/api/generated/`. Do not edit those files by hand.
