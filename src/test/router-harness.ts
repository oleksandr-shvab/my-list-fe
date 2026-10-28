import { createMemoryHistory, type AnyRouter } from '@tanstack/react-router'
import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import type { User } from '@/features/auth/types'
import { installSessionGuard } from '@/features/auth/session-guard'
import { apiClient } from '@/lib/api-client'
import { createQueryClient } from '@/lib/query-client'
import { createAppRouter } from '@/router'

// Builds the real router and route tree on a memory history, with a fake backend behind the
// shared axios client. Import ./browser-stubs before this file.

export const USER: User = {
  id: 'user-1',
  email: 'player@example.com',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}

// A promise is an answer that comes later: see `slowReply`.
export type Reply =
  | { status: number; data?: unknown }
  | 'network-error'
  | 'never-answers'
  | Promise<Reply>

export const ME_URL = '/v1/auth/me'

export const SIGNED_IN: Reply = { status: 200, data: USER }
export const GUEST: Reply = {
  status: 401,
  data: { status: 401, code: 'not_authenticated', request_id: 'req-401' },
}
export const SERVER_ERROR: Reply = {
  status: 500,
  data: { status: 500, code: 'internal_error', request_id: 'req-500' },
}

// An answer that arrives when the test calls `answer`, after the page has moved on.
export function slowReply() {
  let answer!: (reply: Reply) => void
  const reply = new Promise<Reply>((resolve) => {
    answer = resolve
  })
  return { reply, answer }
}

const originalAdapter = apiClient.defaults.adapter

// What the fake backend answers, by URL. A test can change it between steps.
export class FakeBackend {
  replies = new Map<string, Reply>()
  requests: string[] = []

  constructor(me: Reply) {
    this.replies.set(ME_URL, me)
  }

  count(url: string) {
    return this.requests.filter((request) => request === url).length
  }
}

function answerWith(
  reply: Reply,
  config: InternalAxiosRequestConfig,
): Promise<AxiosResponse> {
  if (reply instanceof Promise) {
    return reply.then((late) => answerWith(late, config))
  }
  if (reply === 'never-answers') return new Promise(() => {})
  if (reply === 'network-error') {
    return Promise.reject(
      new AxiosError('Network Error', 'ERR_NETWORK', config),
    )
  }
  const response = {
    status: reply.status,
    statusText: '',
    data: reply.data ?? null,
    headers: {},
    config,
  }
  return reply.status < 300
    ? Promise.resolve(response)
    : Promise.reject(
        new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, response),
      )
}

function install(backend: FakeBackend) {
  apiClient.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? ''
    backend.requests.push(url)
    return answerWith(backend.replies.get(url) ?? { status: 404 }, config)
  }
}

export function startApp({ path, me }: { path: string; me: Reply }) {
  const backend = new FakeBackend(me)
  install(backend)

  const queryClient = createQueryClient()
  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: [path] }),
  )
  const removeSessionGuard = installSessionGuard({ queryClient, router })

  return {
    backend,
    queryClient,
    router,
    stop() {
      removeSessionGuard()
      apiClient.defaults.adapter = originalAdapter
    },
  }
}

export function matchOf(router: AnyRouter, routeId: string) {
  return router.state.matches.find((match) => match.routeId === routeId)
}
