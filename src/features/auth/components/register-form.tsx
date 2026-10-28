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
import { useRegisterMutation } from '../mutations'
import { createRegisterSchema, type RegisterFormValues } from '../schemas'

// `redirectTo` is the validated page to return to after sign-up; it is kept on the link to login.
export function RegisterForm({ redirectTo }: { redirectTo?: string }) {
  const { t } = useTranslation()
  const schema = useMemo(() => createRegisterSchema(t), [t])
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })
  const register = useRegisterMutation(redirectTo)

  function onSubmit(values: RegisterFormValues) {
    register.mutate(values, {
      onError: (error) =>
        mapApiErrorToForm(error, form.setError, ['email', 'password'], t),
    })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('auth.register.title')}</CardTitle>
        <CardDescription>{t('auth.register.description')}</CardDescription>
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
              <FieldLabel htmlFor="register-email">
                {t('auth.email')}
              </FieldLabel>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                aria-invalid={!!form.formState.errors.email}
                {...form.register('email')}
              />
              <FieldError errors={[form.formState.errors.email]} />
            </Field>

            <Field data-invalid={!!form.formState.errors.password}>
              <FieldLabel htmlFor="register-password">
                {t('auth.password')}
              </FieldLabel>
              <PasswordInput
                id="register-password"
                autoComplete="new-password"
                aria-invalid={!!form.formState.errors.password}
                {...form.register('password')}
              />
              <FieldError errors={[form.formState.errors.password]} />
            </Field>

            <Button
              type="submit"
              className="w-full"
              disabled={register.isPending}
            >
              {register.isPending
                ? t('auth.register.submitting')
                : t('auth.register.submit')}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        {t('auth.register.have_account')}&nbsp;
        <Link
          to="/login"
          search={{ redirect: redirectTo }}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {t('auth.register.log_in')}
        </Link>
      </CardFooter>
    </Card>
  )
}
