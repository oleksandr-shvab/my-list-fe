import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { type ValidationErrorDetail } from '@/lib/api-client'
import type { ApiError } from '@/lib/api-client'

export function mapApiErrorToForm<TFieldValues extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<TFieldValues>,
  knownFields: readonly (keyof TFieldValues)[],
) {
  if (error.isValidationError) {
    const rootMessages: string[] = []
    for (const issue of error.detail as ValidationErrorDetail[]) {
      const field = issue.loc.at(-1)
      if (knownFields.includes(field as keyof TFieldValues)) {
        setError(field as Path<TFieldValues>, { message: issue.msg })
      } else {
        rootMessages.push(issue.msg)
      }
    }
    if (rootMessages.length > 0) {
      setError('root' as Path<TFieldValues>, {
        message: rootMessages.join(' '),
      })
    }
    return
  }

  setError('root' as Path<TFieldValues>, { message: error.detail as string })
}
