import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
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
import {
  createUpdatePasswordSchema,
  type UpdatePasswordFormValues,
} from '../schemas'

export function UpdatePasswordForm() {
  const { t } = useTranslation()
  const schema = useMemo(() => createUpdatePasswordSchema(t), [t])
  const form = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(schema),
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
        mapApiErrorToForm(
          error,
          form.setError,
          ['old_password', 'new_password', 'confirm_password'],
          t,
        ),
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
            {t('auth.update.current_password')}
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
          <FieldLabel htmlFor="update-password-new">
            {t('auth.update.new_password')}
          </FieldLabel>
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
            {t('auth.update.confirm_password')}
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
          {updatePassword.isPending
            ? t('auth.update.submitting')
            : t('auth.update.submit')}
        </Button>
      </FieldGroup>
    </form>
  )
}
