import { apiClient } from '@/lib/api-client'
import type {
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  UpdatePasswordPayload,
  User,
} from './types'

export async function registerRequest(payload: RegisterPayload): Promise<User> {
  const { data } = await apiClient.post<User>('/auth/register', payload)
  return data
}

export async function loginRequest(payload: LoginPayload): Promise<User> {
  const { data } = await apiClient.post<User>('/auth/login', payload)
  return data
}

export async function logoutRequest(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me')
  return data
}

export async function forgotPasswordRequest(
  payload: ForgotPasswordPayload,
): Promise<{ detail: string }> {
  const { data } = await apiClient.post<{ detail: string }>(
    '/auth/forgot-password',
    payload,
  )
  return data
}

export async function resetPasswordRequest(
  payload: ResetPasswordPayload,
): Promise<void> {
  await apiClient.post('/auth/reset-password', payload)
}

export async function updatePasswordRequest(
  payload: UpdatePasswordPayload,
): Promise<void> {
  await apiClient.post('/auth/update-password', payload)
}
