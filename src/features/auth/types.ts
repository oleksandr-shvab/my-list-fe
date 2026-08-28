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
