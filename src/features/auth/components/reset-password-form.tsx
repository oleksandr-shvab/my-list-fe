import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
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
import { resetPasswordSchema, type ResetPasswordFormValues } from '../schemas'

export function ResetPasswordForm({ token }: { token: string }) {
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { new_password: '', confirm_password: '' },
  })
  const resetPassword = useResetPasswordMutation()

  function onSubmit(values: ResetPasswordFormValues) {
    resetPassword.mutate(
      { token, ...values },
      {
        onError: (error) =>
          mapApiErrorToForm(error, form.setError, [
            'new_password',
            'confirm_password',
          ]),
      },
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>
          Choose a new password for your account.
        </CardDescription>
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
              <FieldLabel htmlFor="reset-password-new">New password</FieldLabel>
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
                Confirm new password
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
              {resetPassword.isPending ? 'Resetting…' : 'Reset password'}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
