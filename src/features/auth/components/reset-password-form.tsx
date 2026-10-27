import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { PasswordInput } from '@/components/password-input'
import { mapApiErrorToForm } from '../map-error-to-form'
import { useResetPasswordMutation } from '../mutations'
import {
  createResetPasswordSchema,
  type ResetPasswordFormValues,
} from '../schemas'

export function ResetPasswordForm({ token }: { token: string }) {
  const { t } = useTranslation()
  const schema = useMemo(() => createResetPasswordSchema(t), [t])
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: '', confirm_password: '' },
  })
  const resetPassword = useResetPasswordMutation()

  function onSubmit(values: ResetPasswordFormValues) {
    resetPassword.mutate(
      { token, ...values },
      {
        onError: (error) =>
          mapApiErrorToForm(
            error,
            form.setError,
            ['new_password', 'confirm_password'],
            t,
          ),
      },
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('auth.reset.title')}</CardTitle>
        <CardDescription>{t('auth.reset.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            {form.formState.errors.root?.message && (
              <Alert variant="destructive">
                <AlertDescription>
                  {form.formState.errors.root.message}
                </AlertDescription>
              </Alert>
            )}

            <Field data-invalid={!!form.formState.errors.new_password}>
              <FieldLabel htmlFor="reset-password-new">
                {t('auth.reset.new_password')}
              </FieldLabel>
              <PasswordInput
                id="reset-password-new"
                autoComplete="new-password"
                aria-invalid={!!form.formState.errors.new_password}
                {...form.register('new_password')}
              />
              <FieldError errors={[form.formState.errors.new_password]} />
            </Field>

            <Field data-invalid={!!form.formState.errors.confirm_password}>
              <FieldLabel htmlFor="reset-password-confirm">
                {t('auth.reset.confirm_password')}
              </FieldLabel>
              <PasswordInput
                id="reset-password-confirm"
                autoComplete="new-password"
                aria-invalid={!!form.formState.errors.confirm_password}
                {...form.register('confirm_password')}
              />
              <FieldError errors={[form.formState.errors.confirm_password]} />
            </Field>

            <Button
              type="submit"
              className="w-full"
              disabled={resetPassword.isPending}
            >
              {resetPassword.isPending
                ? t('auth.reset.submitting')
                : t('auth.reset.submit')}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
