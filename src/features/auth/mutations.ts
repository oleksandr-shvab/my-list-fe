import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ApiError } from '@/lib/api-client'
import { loginRequest, logoutRequest, registerRequest } from './api'
import { authKeys } from './queries'
import { useAuthStore } from './store'
import type { LoginPayload, RegisterPayload, User } from './types'

function onAuthSuccess(queryClient: QueryClient, user: User) {
  useAuthStore.getState().setUser(user)
  queryClient.setQueryData(authKeys.me, user)
}

export function useLoginMutation() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation<User, ApiError, LoginPayload>({
    mutationFn: loginRequest,
    onSuccess: (user) => {
      onAuthSuccess(queryClient, user)
      navigate({ to: '/' })
    },
  })
}

export function useRegisterMutation() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation<User, ApiError, RegisterPayload>({
    mutationFn: registerRequest,
    onSuccess: (user) => {
      onAuthSuccess(queryClient, user)
      navigate({ to: '/' })
    },
  })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation<void, ApiError>({
    mutationFn: logoutRequest,
    onSettled: (_data, error) => {
      // Clear locally regardless — a stale server session gets re-synced by getMe().
      useAuthStore.getState().clearUser()
      queryClient.clear()
      navigate({ to: '/login' })
      if (error) {
        console.error(
          'Logout request failed; local session was cleared anyway.',
          error,
        )
      }
    },
  })
}
