import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
})

export type RegisterFormValues = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email'),
})

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')

export const resetPasswordSchema = z
  .object({
    new_password: newPassword,
    confirm_password: newPassword,
  })
  .refine((values) => values.new_password === values.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

export const updatePasswordSchema = z
  .object({
    old_password: z.string().min(1, 'Current password is required'),
    new_password: newPassword,
    confirm_password: newPassword,
  })
  .refine((values) => values.new_password === values.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })
  .refine((values) => values.new_password !== values.old_password, {
    message: 'New password must be different from the current password',
    path: ['new_password'],
  })

export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>
