import type { ParseKeys } from 'i18next'
import type { Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'
import { getErrorMessage } from '@/lib/error-messages'

type InlineErrorProps = {
  // The backend's catalogue text for its code, else the fallback.
  error: Error | null
  fallbackKey: ParseKeys
  retryKey: ParseKeys
  // No retry means no button: some failures cannot heal.
  onRetry?: () => void
  // The retry is on its way: the button shows `busyKey`, ignores presses and keeps the focus (aria-disabled).
  busy?: boolean
  busyKey?: ParseKeys
  buttonRef?: Ref<HTMLButtonElement>
}

// An error inside a screen or a dialog, with "Try again".
export function InlineError({
  error,
  fallbackKey,
  retryKey,
  onRetry,
  busy = false,
  busyKey = retryKey,
  buttonRef,
}: InlineErrorProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-start gap-3">
      <p role="alert" className="text-sm text-destructive">
        {error instanceof ApiError
          ? getErrorMessage(error, t, fallbackKey)
          : t(fallbackKey)}
      </p>
      {onRetry && (
        <Button
          ref={buttonRef}
          type="button"
          variant="outline"
          className="max-md:h-11"
          aria-disabled={busy}
          onClick={busy ? undefined : onRetry}
        >
          {t(busy ? busyKey : retryKey)}
        </Button>
      )}
    </div>
  )
}
