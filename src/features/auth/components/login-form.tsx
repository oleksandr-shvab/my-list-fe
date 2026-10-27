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
import { PasswordInput } from '@/components/password-input'
import { mapApiErrorToForm } from '../map-error-to-form'
import { useLoginMutation } from '../mutations'
import { createLoginSchema, type LoginFormValues } from '../schemas'

export function LoginForm() {
  const { t } = useTranslation()
  const schema = useMemo(() => createLoginSchema(t), [t])
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })
  const login = useLoginMutation()

  function onSubmit(values: LoginFormValues) {
    login.mutate(values, {
      onError: (error) =>
        mapApiErrorToForm(error, form.setError, ['email', 'password'], t),
    })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('auth.login.title')}</CardTitle>
        <CardDescription>{t('auth.login.description')}</CardDescription>
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
              <FieldLabel htmlFor="login-email">{t('auth.email')}</FieldLabel>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                aria-invalid={!!form.formState.errors.email}
                {...form.register('email')}
              />
              <FieldError errors={[form.formState.errors.email]} />
            </Field>

            <Field data-invalid={!!form.formState.errors.password}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="login-password">
                  {t('auth.password')}
                </FieldLabel>
                <Link
                  to="/forgot-password"
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {t('auth.login.forgot_link')}
                </Link>
              </div>
              <PasswordInput
                id="login-password"
                autoComplete="current-password"
                aria-invalid={!!form.formState.errors.password}
                {...form.register('password')}
              />
              <FieldError errors={[form.formState.errors.password]} />
            </Field>

            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending
                ? t('auth.login.submitting')
                : t('auth.login.submit')}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        {t('auth.login.no_account')}&nbsp;
        <Link
          to="/register"
          className="font-medium text-foreground underline underline-offset-4"
        >
          {t('auth.login.sign_up')}
        </Link>
      </CardFooter>
    </Card>
  )
}
