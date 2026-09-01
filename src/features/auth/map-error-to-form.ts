import type { UseFormSetError } from 'react-hook-form'
import { type ValidationErrorDetail } from '@/lib/api-client'
import type { ApiError } from '@/lib/api-client'

type AuthFormValues = {
  email: string
  password: string
}

export function mapAuthErrorToForm(
  error: ApiError,
  setError: UseFormSetError<AuthFormValues>,
) {
  if (error.isValidationError) {
    for (const issue of error.detail as ValidationErrorDetail[]) {
      const field = issue.loc.at(-1)
      if (field === 'email' || field === 'password') {
        setError(field, { message: issue.msg })
      } else {
        setError('root', { message: issue.msg })
      }
    }
    return
  }

  setError('root', { message: error.detail as string })
}
