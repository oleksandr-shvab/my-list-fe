import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { gamesSubmitGuess } from '@/api/generated/api'
import type { GameGuesserView } from '@/api/generated/models'
import { ApiError } from '@/lib/api-client'
import {
  differsFromShown,
  dropDamagedRecord,
  isInvalidHistory,
  previousOf,
  readRecord,
  recordGuestAnswer,
  sameGuesses,
} from './guest-progress'
import type { GuestRecord } from './guest-records'
import {
  refetchView,
  viewTargetOf,
  writeAnswer,
  type GameViewTarget,
} from './view-queries'

// After these the server holds a game the page may not show, so the view is asked for again before the message shows.
const REFETCH_CODES = new Set(['puzzle_already_finished', 'duplicate_guess'])

function isRefetchCode(error: unknown): boolean {
  return error instanceof ApiError && REFETCH_CODES.has(error.code)
}

function leavesViewStale(error: unknown): boolean {
  return (
    isRefetchCode(error) || (error instanceof ApiError && error.isNetworkError)
  )
}

// What the player is told when the stored game turns out to be over: the same as the server's 409.
function finishedElsewhere() {
  return new ApiError({ status: 409, code: 'puzzle_already_finished' })
}

const GAME_CHANGED = 'game_changed'

// Another tab played while this guess was on its way; the screen has caught up, and the status line says so.
function changedElsewhere() {
  return new ApiError({ status: 409, code: GAME_CHANGED })
}

export function isGameChanged(error: unknown): boolean {
  return error instanceof ApiError && error.code === GAME_CHANGED
}

// A guest's guess failed: the screen catches up from the record when another tab played, never from the empty view.
// A 422 drops only the record that was `sent`; one that changed or finished meanwhile is resumed and kept.
async function settleGuestError(
  client: QueryClient,
  shown: GameViewTarget,
  view: GameGuesserView,
  sent: GuestRecord | undefined,
  error: unknown,
): Promise<unknown> {
  const record = readRecord(shown.slug, shown.date)
  if (isInvalidHistory(error)) {
    if (record && record.status !== 'in_progress') {
      await refetchView(client, shown)
      return finishedElsewhere()
    }
    if (!sameGuesses(record, sent)) {
      await refetchView(client, shown)
      return changedElsewhere()
    }
    dropDamagedRecord(shown, false)
    await refetchView(client, shown)
  } else if (isRefetchCode(error) && differsFromShown(record, view)) {
    await refetchView(client, shown)
  }
  return error
}

// A guess or a skip (`titleId` null). The answer is the new view: it is written into the cache, with no second request.
export function useGuess({
  target,
  view,
  onSend,
}: {
  target: GameViewTarget
  view: GameGuesserView
  // Runs just before a request is sent, not for a press that sends nothing.
  onSend?: () => void
}) {
  const queryClient = useQueryClient()
  // A second press can come before the render that shows `isPending`, so the lock is a ref (AC-16).
  const sending = useRef(false)

  const mutation = useMutation({
    mutationFn: async (titleId: number | null) => {
      const shown = viewTargetOf(target, view) ?? target
      // Read once, now: it holds what another tab did (AC-38), and an answer that turns out to be a guest's (AC-52)
      // keeps its values.
      const record = readRecord(target.slug, target.date)
      // A finished record is no `previous` (a lost game is six guesses, more than a guess may carry): nothing is
      // sent, and the screen catches up from it (AC-43).
      if (!view.signed_in && record && record.status !== 'in_progress') {
        await refetchView(queryClient, shown)
        throw finishedElsewhere()
      }
      onSend?.()
      try {
        const answer = await gamesSubmitGuess(target.slug, target.date, {
          title_id: titleId,
          previous: previousOf(view, record),
        })
        // Here and not in `onSuccess`: the session guard has already signed the page out for `signed_in: false`, and
        // the guest query must have this answer before it asks for its own. The record comes first (AC-41).
        const kept = recordGuestAnswer(answer, true, record ?? null)
        writeAnswer(queryClient, target, answer, kept)
        return answer
      } catch (error) {
        // The shown view decides who the game belongs to, not the page's viewer: a guest's game lives in the browser,
        // and the server's empty one would replace it (AC-53).
        if (view.signed_in) {
          if (leavesViewStale(error)) await refetchView(queryClient, shown)
          throw error
        }
        throw await settleGuestError(queryClient, shown, view, record, error)
      }
    },
    onSettled: () => {
      sending.current = false
    },
  })

  // The callbacks run only while the screen is still shown, so the box that sent the guess can clear itself.
  const { mutate } = mutation
  const send = useCallback(
    (
      titleId: number | null,
      callbacks?: {
        onSuccess?: (answer: GameGuesserView) => void
        onError?: (error: unknown) => void
      },
    ) => {
      if (sending.current) return
      sending.current = true
      mutate(titleId, callbacks)
    },
    [mutate],
  )

  return {
    send,
    isPending: mutation.isPending,
    error: mutation.error,
    answer: mutation.data,
  }
}
