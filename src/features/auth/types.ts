export type User = {
  id: string
  email: string
  is_active: boolean
  created_at: string
}

export type RegisterPayload = {
  email: string
  password: string
}

export type LoginPayload = {
  email: string
  password: string
}

export type ForgotPasswordPayload = {
  email: string
}

export type ResetPasswordPayload = {
  token: string
  new_password: string
  confirm_password: string
}

export type UpdatePasswordPayload = {
  old_password: string
  new_password: string
  confirm_password: string
}
