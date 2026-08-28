import axios, { type AxiosError } from 'axios'

export type ValidationErrorDetail = {
  loc: (string | number)[]
  msg: string
  type: string
}

type ErrorBody = {
  detail?: string | ValidationErrorDetail[]
}

export class ApiError extends Error {
  status: number
  detail: string | ValidationErrorDetail[]

  constructor(status: number, detail: string | ValidationErrorDetail[]) {
    super(typeof detail === 'string' ? detail : 'Validation error')
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }

  get isValidationError(): boolean {
    return Array.isArray(this.detail)
  }
}

export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorBody>) => {
    if (error.response) {
      return Promise.reject(
        new ApiError(
          error.response.status,
          error.response.data?.detail ?? 'Something went wrong',
        ),
      )
    }
    return Promise.reject(new ApiError(0, 'Network error. Please try again.'))
  },
)
