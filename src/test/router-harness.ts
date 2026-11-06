import { createMemoryHistory, type AnyRouter } from '@tanstack/react-router'
import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import type { GameGuesserView, GameList } from '@/api/generated/models'
import type { User } from '@/features/auth/types'
import { installSessionGuard } from '@/features/auth/session-guard'
import { apiClient, apiPathOf } from '@/lib/api-client'
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
export const GAMES_URL = '/v1/games'

// The answer of `GET /v1/games` for these slugs. Built from the generated model, so a renamed
// field fails the type check.
export function gamesReply(...slugs: string[]): Reply {
  const data: GameList = {
    items: slugs.map((slug) => ({
      slug,
      default_variant: 'default',
      launch_date: '2026-01-01',
    })),
  }
  return { status: 200, data }
}

// A puzzle view as `GET /v1/games/{slug}/puzzles/{date}` answers it. Built from the generated
// model, so a renamed field fails the type check.
export function gameView(
  overrides: Partial<GameGuesserView> = {},
): GameGuesserView {
  return {
    type: 'game_guesser',
    slug: 'game-guesser',
    variant: 'default',
    date: '2026-11-05',
    number: 308,
    status: 'in_progress',
    max_guesses: 6,
    guesses_used: 0,
    guesses_left: 6,
    guesses: [],
    steps: [],
    answer: null,
    counts_for_streak: null,
    signed_in: true,
    daily_proof: null,
    ...overrides,
  }
}

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
  // The requests as sent, with the stamps the session guard put on them.
  configs: InternalAxiosRequestConfig[] = []

  constructor(me: Reply) {
    this.replies.set(ME_URL, me)
    // The registry's game, so tests that are not about the list see the usual success path.
    this.replies.set(GAMES_URL, gamesReply('game-guesser'))
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

// The key a reply is stored under: the path after `/api` for a request to this site, so
// `/v1/auth/me`; the full address (without the query) for a request to another host. It is the
// resolved address, so the fake sees what would go over the wire, not the raw `url`.
function replyKey(config: InternalAxiosRequestConfig): string {
  const path = apiPathOf(config)
  if (path !== null) return path
  const url = new URL(apiClient.getUri(config), window.location.origin)
  return url.origin + url.pathname
}

function install(backend: FakeBackend) {
  apiClient.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    const url = replyKey(config)
    backend.requests.push(url)
    backend.configs.push(config)
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
    removeSessionGuard,
    stop() {
      removeSessionGuard()
      apiClient.defaults.adapter = originalAdapter
    },
  }
}

export function matchOf(router: AnyRouter, routeId: string) {
  return router.state.matches.find((match) => match.routeId === routeId)
}
