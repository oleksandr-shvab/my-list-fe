import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import i18n from '@/i18n'
import { toast } from 'sonner'
import type { AuthForgotPassword202 } from '@/api/generated/models'
import { reportError } from '@/lib/report-error'
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
        reportError(
          error,
          'logout request failed; local session cleared anyway',
        )
      }
    },
  })
}

export function useForgotPasswordMutation() {
  return useMutation<AuthForgotPassword202, ApiError, ForgotPasswordPayload>({
    mutationFn: forgotPasswordRequest,
  })
}

export function useResetPasswordMutation() {
  const navigate = useNavigate()

  return useMutation<void, ApiError, ResetPasswordPayload>({
    mutationFn: resetPasswordRequest,
    onSuccess: () => {
      toast.success(i18n.t('toast.password_updated_relogin'))
      navigate({ to: '/login' })
    },
  })
}

export function useUpdatePasswordMutation() {
  return useMutation<void, ApiError, UpdatePasswordPayload>({
    mutationFn: updatePasswordRequest,
    onSuccess: () => {
      toast.success(i18n.t('toast.password_updated'))
    },
  })
}
