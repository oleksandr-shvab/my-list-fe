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
import { finishLogout, finishPasswordReset } from './session'
import type {
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  UpdatePasswordPayload,
  User,
} from './types'

function onAuthSuccess(queryClient: QueryClient, user: User) {
  queryClient.setQueryData(meQueryOptions().queryKey, user)
}

// `redirectTo` comes from the login or sign-up page's search, already checked by
// `resolveRedirect`, so it is a path on this site. It goes through history.push, as in
// TanStack Router's "Authenticated Routes" guide, because it can hold a query and a hash.
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
    onSettled: (_data, error) => {
      // Clear locally regardless of the answer. The user stays on a public page.
      void finishLogout(queryClient, router)
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
