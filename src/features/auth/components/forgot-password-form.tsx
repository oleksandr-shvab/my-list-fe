import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { mapApiErrorToForm } from '../map-error-to-form'
import { useForgotPasswordMutation } from '../mutations'
import {
  createForgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '../schemas'

export function ForgotPasswordForm() {
  const { t } = useTranslation()
  const schema = useMemo(() => createForgotPasswordSchema(t), [t])
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })
  const forgotPassword = useForgotPasswordMutation()

  function onSubmit(values: ForgotPasswordFormValues) {
    forgotPassword.mutate(values, {
      onError: (error) => mapApiErrorToForm(error, form.setError, ['email'], t),
    })
  }

  if (forgotPassword.isSuccess) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('auth.forgot.sent_title')}</CardTitle>
          <CardDescription>{t('auth.forgot.sent_description')}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          <Link
            to="/login"
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t('auth.forgot.back_to_login')}
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('auth.forgot.title')}</CardTitle>
        <CardDescription>{t('auth.forgot.description')}</CardDescription>
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

            <Field data-invalid={!!form.formState.errors.email}>
              <FieldLabel htmlFor="forgot-password-email">
                {t('auth.email')}
              </FieldLabel>
              <Input
                id="forgot-password-email"
                type="email"
                autoComplete="email"
                aria-invalid={!!form.formState.errors.email}
                {...form.register('email')}
              />
              <FieldError errors={[form.formState.errors.email]} />
            </Field>

            <Button
              type="submit"
              className="w-full"
              disabled={forgotPassword.isPending}
            >
              {forgotPassword.isPending
                ? t('auth.forgot.submitting')
                : t('auth.forgot.submit')}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        {t('auth.forgot.remembered')}&nbsp;
        <Link
          to="/login"
          className="font-medium text-foreground underline underline-offset-4"
        >
          {t('auth.forgot.log_in')}
        </Link>
      </CardFooter>
    </Card>
  )
}
