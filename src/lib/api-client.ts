import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    sessionEpoch?: number
  }
}

export type FieldError = {
  field: string
  code: string
  params: Record<string, unknown>
}

// The backend error body (CONTRACTS.md, "Errors").
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
  // The session stamp, never the request: its body can hold a password or a token.
  sentInEpoch: number | undefined

  constructor(options: {
    status: number
    code: string
    message?: string
    params?: Record<string, unknown>
    requestId?: string | null
    fieldErrors?: FieldError[]
    sentInEpoch?: number
  }) {
    // `message` is English, for developers and logs. Users see text chosen from `code`.
    super(options.message ?? options.code)
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code
    this.params = options.params ?? {}
    this.requestId = options.requestId ?? null
    this.fieldErrors = options.fieldErrors ?? []
    this.sentInEpoch = options.sentInEpoch
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
        sentInEpoch: error.config?.sessionEpoch,
      }),
    )
  },
)

// The path after `baseURL` for a request to this site's API, or null for any other host. Uses the resolved
// address, so an absolute url, `//host/...` and `..` give what the browser would send.
export function apiPathOf(config: AxiosRequestConfig): string | null {
  const url = new URL(apiClient.getUri(config), window.location.origin)
  const base = new URL(apiClient.getUri({ url: '/' }), window.location.origin)
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    return null
  }
  return '/' + url.pathname.slice(base.pathname.length)
}
