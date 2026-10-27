import type { TFunction } from 'i18next'
import { z } from 'zod'

// Schemas are built with the current `t`, so the messages follow the interface language.
// Components create them with useMemo(() => createXSchema(t), [t]).

const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 128

function newPassword(t: TFunction) {
  return z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      t('validation.password_too_short', { count: MIN_PASSWORD_LENGTH }),
    )
    .max(
      MAX_PASSWORD_LENGTH,
      t('validation.password_too_long', { count: MAX_PASSWORD_LENGTH }),
    )
}

export function createLoginSchema(t: TFunction) {
  return z.object({
    email: z.email(t('validation.email_invalid')),
    password: z.string().min(1, t('validation.password_required')),
  })
}

export type LoginFormValues = z.infer<ReturnType<typeof createLoginSchema>>

export function createRegisterSchema(t: TFunction) {
  return z.object({
    email: z.email(t('validation.email_invalid')),
    password: newPassword(t),
  })
}

export type RegisterFormValues = z.infer<
  ReturnType<typeof createRegisterSchema>
>

export function createForgotPasswordSchema(t: TFunction) {
  return z.object({
    email: z.email(t('validation.email_invalid')),
  })
}

export type ForgotPasswordFormValues = z.infer<
  ReturnType<typeof createForgotPasswordSchema>
>

export function createResetPasswordSchema(t: TFunction) {
  return z
    .object({
      new_password: newPassword(t),
      confirm_password: newPassword(t),
    })
    .refine((values) => values.new_password === values.confirm_password, {
      message: t('validation.passwords_do_not_match'),
      path: ['confirm_password'],
    })
}

export type ResetPasswordFormValues = z.infer<
  ReturnType<typeof createResetPasswordSchema>
>

export function createUpdatePasswordSchema(t: TFunction) {
  return z
    .object({
      old_password: z
        .string()
        .min(1, t('validation.current_password_required')),
      new_password: newPassword(t),
      confirm_password: newPassword(t),
    })
    .refine((values) => values.new_password === values.confirm_password, {
      message: t('validation.passwords_do_not_match'),
      path: ['confirm_password'],
    })
    .refine((values) => values.new_password !== values.old_password, {
      message: t('validation.new_password_same_as_old'),
      path: ['new_password'],
    })
}

export type UpdatePasswordFormValues = z.infer<
  ReturnType<typeof createUpdatePasswordSchema>
>
