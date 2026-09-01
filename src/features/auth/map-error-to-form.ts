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
    const rootMessages: string[] = []
    for (const issue of error.detail as ValidationErrorDetail[]) {
      const field = issue.loc.at(-1)
      if (field === 'email' || field === 'password') {
        setError(field, { message: issue.msg })
      } else {
        rootMessages.push(issue.msg)
      }
    }
    if (rootMessages.length > 0) {
      setError('root', { message: rootMessages.join(' ') })
    }
    return
  }

  setError('root', { message: error.detail as string })
}
