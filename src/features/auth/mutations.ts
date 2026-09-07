import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-client'
import {
  forgotPasswordRequest,
  loginRequest,
  logoutRequest,
  registerRequest,
  resetPasswordRequest,
  updatePasswordRequest,
} from './api'
import { authKeys } from './queries'
import { useAuthStore } from './store'
import type {
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  UpdatePasswordPayload,
  User,
} from './types'

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

export function useForgotPasswordMutation() {
  return useMutation<{ detail: string }, ApiError, ForgotPasswordPayload>({
    mutationFn: forgotPasswordRequest,
  })
}

export function useResetPasswordMutation() {
  const navigate = useNavigate()

  return useMutation<void, ApiError, ResetPasswordPayload>({
    mutationFn: resetPasswordRequest,
    onSuccess: () => {
      toast.success('Password updated. Please log in again.')
      navigate({ to: '/login' })
    },
  })
}

export function useUpdatePasswordMutation() {
  return useMutation<void, ApiError, UpdatePasswordPayload>({
    mutationFn: updatePasswordRequest,
    onSuccess: () => {
      toast.success('Password updated.')
    },
  })
}
