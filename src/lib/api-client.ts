import axios, { type AxiosError } from 'axios'

export type FieldError = {
  field: string
  code: string
  params: Record<string, unknown>
}

// The backend's error body: RFC 9457 problem details plus `code`, `params`, `request_id` and
// `errors` (see CONTRACTS.md, "Errors").
type ErrorBody = {
  status?: number
  title?: string
  code?: string
  params?: Record<string, unknown>
  request_id?: string
  errors?: FieldError[]
}

export class ApiError extends Error {
  status: number
  code: string
  params: Record<string, unknown>
  requestId: string | null
  fieldErrors: FieldError[]

  constructor(options: {
    status: number
    code: string
    message?: string
    params?: Record<string, unknown>
    requestId?: string | null
    fieldErrors?: FieldError[]
  }) {
    // `message` is English, for developers and logs. Users see text chosen from `code`.
    super(options.message ?? options.code)
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code
    this.params = options.params ?? {}
    this.requestId = options.requestId ?? null
    this.fieldErrors = options.fieldErrors ?? []
  }

  get isValidationError(): boolean {
    return this.code === 'validation_error'
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }
}

export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorBody>) => {
    if (!error.response) {
      return Promise.reject(
        new ApiError({
          status: 0,
          code: 'network_error',
          message: error.message,
        }),
      )
    }
    const { status, data } = error.response
    // A proxy or CDN can answer with HTML or an empty body: keep only a status-based code then.
    const body = typeof data === 'object' && data !== null ? data : {}
    return Promise.reject(
      new ApiError({
        status,
        code: body.code ?? 'http_error',
        message: body.title,
        params: body.params,
        requestId:
          body.request_id ?? error.response.headers['x-request-id'] ?? null,
        fieldErrors: Array.isArray(body.errors) ? body.errors : [],
      }),
    )
  },
)
