import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import type { ApiError } from '@/lib/api-client'
import { getErrorMessage, getFieldErrorMessage } from '@/lib/error-messages'

export function mapApiErrorToForm<TFieldValues extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<TFieldValues>,
  knownFields: readonly (keyof TFieldValues)[],
) {
  if (error.isValidationError && error.fieldErrors.length > 0) {
    const rootMessages: string[] = []
    for (const issue of error.fieldErrors) {
      const message = getFieldErrorMessage(issue)
      if (knownFields.includes(issue.field as keyof TFieldValues)) {
        setError(issue.field as Path<TFieldValues>, { message })
      } else {
        rootMessages.push(message)
      }
    }
    if (rootMessages.length > 0) {
      setError('root' as Path<TFieldValues>, {
        message: rootMessages.join(' '),
      })
    }
    return
  }

  setError('root' as Path<TFieldValues>, { message: getErrorMessage(error) })
}
