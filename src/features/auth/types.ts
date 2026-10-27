// The backend's models, generated from its OpenAPI snapshot (npm run api:generate). These names
// are what the rest of the app imports; do not hand-write backend shapes here.
export type {
  UserRead as User,
  UserRegister as RegisterPayload,
  UserLogin as LoginPayload,
  ForgotPasswordRequest as ForgotPasswordPayload,
  ResetPasswordRequest as ResetPasswordPayload,
  UpdatePasswordRequest as UpdatePasswordPayload,
} from '@/api/generated/models'
