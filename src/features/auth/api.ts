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

export function getMe(): Promise<User> {
  return authMe()
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
