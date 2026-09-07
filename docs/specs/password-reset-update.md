# Spec: Password reset & authenticated password update

Status: draft — implementation not started.
Backend workflow is already shipped (`my-list-be`, branch `a2-password-reset-update`,
merged) and documented in full in `../../../CONTRACTS.md` under "Password reset" /
"Password update (authenticated)". This spec covers the frontend only and doesn't
restate the backend contract beyond what's needed to justify a UI decision.

## Scope

Three new user-facing flows:

1. **Forgot password** — unauthenticated user requests a reset link by email.
2. **Reset password** — unauthenticated user lands on a link with a token and sets a
   new password.
3. **Update password** — authenticated user changes their password from a new
   `/account` page while logged in.

## Decisions

Resolved with the user before planning:

- **Update-password location**: new `/account` route (file-based, `src/routes/account.tsx`),
  authenticated-only. Minimal for now — just the password-update form; a natural home
  for future account settings.
- **Success feedback**: install `sonner` (via `npx shadcn@latest add sonner`) for
  toast notifications, rather than reusing the inline `Alert` pattern used for
  errors. Mount `<Toaster />` once, near the router root.
- **Post-reset-password flow**: since the backend revokes all sessions on reset,
  after a successful `POST /auth/reset-password` the frontend shows a success toast
  and redirects to `/login` (not just a silent redirect, not a manual link).
- **Login page**: add a "Forgot password?" link next to the password field on
  `LoginForm`, pointing to `/forgot-password`, styled like the existing "Sign up"
  link.

## Routes

| Route              | Auth                                                                             | Purpose                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `/forgot-password` | public (redirect away if already authenticated, matching `/login` / `/register`) | Email entry form → `POST /auth/forgot-password`                                                                 |
| `/reset-password`  | public                                                                           | Reads `?token=` from the query string, form for `new_password`/`confirm_password` → `POST /auth/reset-password` |
| `/account`         | authenticated only (redirect to `/login` if not)                                 | Password-update form (`old_password`/`new_password`/`confirm_password`) → `POST /auth/update-password`          |

`/reset-password` with no `token` in the query string is a broken/incomplete link —
render an inline "this link is invalid" state with a link back to `/forgot-password`
rather than rendering the form.

## Data layer additions (`src/features/auth/`)

- **`types.ts`**: add `ForgotPasswordPayload { email: string }`,
  `ResetPasswordPayload { token: string; new_password: string; confirm_password: string }`,
  `UpdatePasswordPayload { old_password: string; new_password: string; confirm_password: string }`.
  Field names stay snake_case to match the backend payload shape directly, consistent
  with the existing `User`/`RegisterPayload`/`LoginPayload` types (no camelCase
  translation layer anywhere in this feature).
- **`api.ts`**: add `forgotPasswordRequest`, `resetPasswordRequest`,
  `updatePasswordRequest` — same thin-wrapper-over-`apiClient` shape as the existing
  four functions. `resetPasswordRequest`/`updatePasswordRequest` resolve `void` (204,
  no body); `forgotPasswordRequest` resolves the `{ detail }` message body (202).
- **`schemas.ts`**: add Zod schemas for each form —
  - `forgotPasswordSchema`: `{ email }`.
  - `resetPasswordSchema`: `{ new_password, confirm_password }` (token is carried as
    route state, not a form field) with a `.refine` for password match, mirroring
    the backend's `PasswordConfirmationMixin`, so the UX is not solely a
    server round-trip.
  - `updatePasswordSchema`: `{ old_password, new_password, confirm_password }` with
    the same match refine, plus (client-side convenience only, still
    server-validated) a refine that `new_password !== old_password`.
    All three use the existing `min(8).max(128)` bounds already used in `registerSchema`.
- **`mutations.ts`**: add `useForgotPasswordMutation`, `useResetPasswordMutation`,
  `useUpdatePasswordMutation`.
  - `useForgotPasswordMutation`: no auth-store/query-cache side effects (this is the
    generic-response flow — the UI must not infer anything from success/failure
    beyond "request sent").
  - `useResetPasswordMutation`: on success, `toast.success(...)` +
    `navigate({ to: '/login' })`. Does **not** call `useAuthStore.getState().clearUser()`
    /`queryClient.clear()` itself — the user was never authenticated in this flow (no
    session existed client-side to begin with, since this is the logged-out flow).
  - `useUpdatePasswordMutation`: on success, `toast.success(...)` only — no
    navigation, no store/cache changes (current session stays valid per the
    contract), the form resets itself via RHF's `reset()` after success.

## Error handling

`mapAuthErrorToForm` (`map-error-to-form.ts`) is currently hardcoded to
`UseFormSetError<{ email: string; password: string }>`, so it can't be reused as-is
for the new forms' field sets. Generalize it:

```ts
export function mapApiErrorToForm<TFieldValues extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<TFieldValues>,
  knownFields: readonly (keyof TFieldValues)[],
)
```

Same body as today, but `field === 'email' || field === 'password'` becomes
`knownFields.includes(field as keyof TFieldValues)`. Existing call sites
(`LoginForm`, `RegisterForm`) pass `['email', 'password']` and behavior is unchanged.
All non-field-matched errors (including the reset flow's `400` invalid/expired-token
response and the update flow's `400` wrong-old-password response — both plain-string
`detail`, not a validation array) fall through to `setError('root', ...)`, same as
today's default. No special-casing of the `old_password`-wrong case onto the
`old_password` field — the backend error is a root-level message, not a per-field
validation error, and guessing at its text to redirect it to a field would be brittle.

## UI components (`src/features/auth/components/`)

- `forgot-password-form.tsx` — `Card` layout matching `LoginForm`/`RegisterForm`.
  Single email field. On submit, always shows the same success state regardless of
  whether the account exists (per backend contract — never infer existence). Submit
  button disabled while pending; on success, replace the form with a confirmation
  message ("If an account with that email exists...") rather than toasting, since
  the user needs this message to persist on-screen (unlike the other two flows,
  there's no subsequent navigation to anchor a toast to).
- `reset-password-form.tsx` — reads `token` via the route's search params (not
  props), `new_password`/`confirm_password` fields using the existing
  `PasswordInput` component. Invalid/missing token handled by the route (see
  Routes section), not this component.
- `update-password-form.tsx` — `old_password`/`new_password`/`confirm_password`
  fields, all `PasswordInput`. No `Card`/centered-page chrome — `/account` supplies
  its own page shell since it's an authenticated in-app page, not a standalone
  auth page like login/register.

## Out of scope (explicitly not building now)

- Any broader `/account` page content beyond the password form (profile fields,
  email change, etc.) — not requested, no backend support yet.
- Rate-limit UX for `forgot-password` (backend has no rate limiting yet, per
  `CONTRACTS.md`).
- Toast usage anywhere outside these two success paths — not retrofitting existing
  login/register/logout flows to use `sonner` in this pass, to keep the change
  scoped. (Worth a follow-up once `sonner` is in the tree.)
