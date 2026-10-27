import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { ApiError, apiClient } from '@/lib/api-client'

const originalAdapter = apiClient.defaults.adapter

function failWith(
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
) {
  apiClient.defaults.adapter = (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, {
        status,
        statusText: '',
        data,
        headers,
        config,
      }),
    )
}

async function catchApiError(): Promise<ApiError> {
  try {
    await apiClient.post('/auth/login', {})
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('expected the request to fail')
}

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('apiClient error interceptor', () => {
  it('turns a problem-details body into an ApiError with code, params, request id and field errors', async () => {
    failWith(422, {
      status: 422,
      title: 'Request validation failed',
      code: 'validation_error',
      params: {},
      request_id: 'abc123',
      errors: [{ field: 'password', code: 'too_short', params: { min: 8 } }],
    })

    const error = await catchApiError()

    expect(error.status).toBe(422)
    expect(error.code).toBe('validation_error')
    expect(error.isValidationError).toBe(true)
    expect(error.requestId).toBe('abc123')
    expect(error.fieldErrors).toEqual([
      { field: 'password', code: 'too_short', params: { min: 8 } },
    ])
  })

  it('keeps a status-based code when a proxy answers with an HTML page', async () => {
    failWith(502, '<html>Bad gateway</html>', { 'x-request-id': 'proxy-1' })

    const error = await catchApiError()

    expect(error.status).toBe(502)
    expect(error.code).toBe('http_error')
    expect(error.requestId).toBe('proxy-1')
  })

  it('reports a missing response as a network error', async () => {
    apiClient.defaults.adapter = (config: InternalAxiosRequestConfig) =>
      Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config))

    const error = await catchApiError()

    expect(error.isNetworkError).toBe(true)
    expect(error.code).toBe('network_error')
  })
})
