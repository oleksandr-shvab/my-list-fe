import type { AxiosRequestConfig } from 'axios'
import { apiClient } from '@/lib/api-client'

// Routes the generated client through apiClient: one place for the base URL, the cookie setting and the ApiError conversion.
export async function orvalMutator<T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await apiClient.request<T>({ ...config, ...options })
  return data
}
