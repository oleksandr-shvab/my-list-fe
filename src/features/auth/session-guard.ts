import { apiClient, ApiError } from '@/lib/api-client'
import { useAuthStore } from './store'

// getMe() only runs once per load — this catches a session expiring later.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error instanceof ApiError && error.status === 401) {
      useAuthStore.getState().clearUser()
    }
    return Promise.reject(error)
  },
)
