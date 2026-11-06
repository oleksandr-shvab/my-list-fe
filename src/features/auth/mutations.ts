import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
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
import { meQueryOptions } from './queries'
import {
  finishLogout,
  finishPasswordReset,
  setLogoutRunning,
  startNewSessionEpoch,
} from './session'
import type {
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  UpdatePasswordPayload,
  User,
} from './types'

export function onAuthSuccess(queryClient: QueryClient, user: User) {
  // Logging in again as the same user changes no identity, so the guard cannot see the new session.
  startNewSessionEpoch()
  const meKey = meQueryOptions().queryKey
  // An `/auth/me` request still in flight started before this login: cancel it, so its late
  // answer cannot replace the user who just logged in.
  void queryClient.cancelQueries({ queryKey: meKey })
  queryClient.setQueryData(meKey, user)
}

// `redirectTo` is checked by `resolveRedirect`. It goes through history.push, as in TanStack Router's
// "Authenticated Routes" guide, because it can hold a query and a hash.
export function useLoginMutation(redirectTo?: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation<User, ApiError, LoginPayload>({
    mutationFn: loginRequest,
    onSuccess: (user) => {
      onAuthSuccess(queryClient, user)
      router.history.push(redirectTo ?? '/')
    },
  })
}

export function useRegisterMutation(redirectTo?: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation<User, ApiError, RegisterPayload>({
    mutationFn: registerRequest,
    onSuccess: (user) => {
      onAuthSuccess(queryClient, user)
      router.history.push(redirectTo ?? '/')
    },
  })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation<void, ApiError>({
    mutationFn: logoutRequest,
    onMutate: () => setLogoutRunning(true),
    onSettled: (_data, error) => {
      // Clear locally regardless of the answer. The user stays on a public page.
      void finishLogout(queryClient, router)
      setLogoutRunning(false)
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
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation<void, ApiError, ResetPasswordPayload>({
    mutationFn: resetPasswordRequest,
    onSuccess: () => {
      toast.success(i18n.t('toast.password_updated_relogin'))
      void finishPasswordReset(queryClient, router)
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
