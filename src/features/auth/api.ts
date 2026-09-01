import { apiClient } from '@/lib/api-client'
import type { LoginPayload, RegisterPayload, User } from './types'

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
