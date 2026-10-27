import type { AxiosRequestConfig } from 'axios'
import { apiClient } from '@/lib/api-client'

// Used by the generated API client (src/api/generated). Routing everything through apiClient keeps
// the base URL, the cookie setting and the ApiError conversion in one place.
export async function orvalMutator<T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await apiClient.request<T>({ ...config, ...options })
  return data
}
