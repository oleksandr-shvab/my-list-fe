import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { PasswordInput } from '@/components/password-input'
import { mapApiErrorToForm } from '../map-error-to-form'
import { useUpdatePasswordMutation } from '../mutations'
import { updatePasswordSchema, type UpdatePasswordFormValues } from '../schemas'

export function UpdatePasswordForm() {
  const form = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      old_password: '',
      new_password: '',
      confirm_password: '',
    },
  })
  const updatePassword = useUpdatePasswordMutation()

  function onSubmit(values: UpdatePasswordFormValues) {
    updatePassword.mutate(values, {
      onSuccess: () => form.reset(),
      onError: (error) =>
        mapApiErrorToForm(error, form.setError, [
          'old_password',
          'new_password',
          'confirm_password',
        ]),
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {form.formState.errors.root?.message && (
          <Alert variant="destructive">
            <AlertDescription>
              {form.formState.errors.root.message}
            </AlertDescription>
          </Alert>
        )}

        <Field data-invalid={!!form.formState.errors.old_password}>
          <FieldLabel htmlFor="update-password-old">
            Current password
          </FieldLabel>
          <PasswordInput
            id="update-password-old"
            autoComplete="current-password"
            aria-invalid={!!form.formState.errors.old_password}
            {...form.register('old_password')}
          />
          <FieldError errors={[form.formState.errors.old_password]} />
        </Field>

        <Field data-invalid={!!form.formState.errors.new_password}>
          <FieldLabel htmlFor="update-password-new">New password</FieldLabel>
          <PasswordInput
            id="update-password-new"
            autoComplete="new-password"
            aria-invalid={!!form.formState.errors.new_password}
            {...form.register('new_password')}
          />
          <FieldError errors={[form.formState.errors.new_password]} />
        </Field>

        <Field data-invalid={!!form.formState.errors.confirm_password}>
          <FieldLabel htmlFor="update-password-confirm">
            Confirm new password
          </FieldLabel>
          <PasswordInput
            id="update-password-confirm"
            autoComplete="new-password"
            aria-invalid={!!form.formState.errors.confirm_password}
            {...form.register('confirm_password')}
          />
          <FieldError errors={[form.formState.errors.confirm_password]} />
        </Field>

        <Button
          type="submit"
          className="w-full"
          disabled={updatePassword.isPending}
        >
          {updatePassword.isPending ? 'Updating…' : 'Update password'}
        </Button>
      </FieldGroup>
    </form>
  )
}
