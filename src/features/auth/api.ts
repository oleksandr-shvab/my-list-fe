import {
  authForgotPassword,
  authLogin,
  authLogout,
  authMe,
  authRegister,
  authResetPassword,
  authUpdatePassword,
} from '@/api/generated/api'
import type { AuthForgotPassword202 } from '@/api/generated/models'
import { ApiError } from '@/lib/api-client'
import type {
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  UpdatePasswordPayload,
  User,
} from './types'

// Thin wrappers over the generated client, so queries and mutations keep their call sites.

export function registerRequest(payload: RegisterPayload): Promise<User> {
  return authRegister(payload)
}

export function loginRequest(payload: LoginPayload): Promise<User> {
  return authLogin(payload)
}

export async function logoutRequest(): Promise<void> {
  await authLogout()
}

// A visitor with no session is normal, not an error: a 401 here means "guest" (null). Any other
// failure (network, 5xx) is thrown, because then the sign-in state is unknown. The query's signal
// is passed on, so a request that login or logout replaced is aborted and its late 401 never
// reaches the session guard.
export async function getMe(signal?: AbortSignal): Promise<User | null> {
  try {
    return await authMe({ signal })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export function forgotPasswordRequest(
  payload: ForgotPasswordPayload,
): Promise<AuthForgotPassword202> {
  return authForgotPassword(payload)
}

export async function resetPasswordRequest(
  payload: ResetPasswordPayload,
): Promise<void> {
  await authResetPassword(payload)
}

export async function updatePasswordRequest(
  payload: UpdatePasswordPayload,
): Promise<void> {
  await authUpdatePassword(payload)
}
