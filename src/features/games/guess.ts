import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { gamesSubmitGuess } from '@/api/generated/api'
import type { GameGuesserView } from '@/api/generated/models'
import { ApiError } from '@/lib/api-client'
import { refetchView, writeAnswer, type GameViewTarget } from './view-queries'

// After these the server holds a game the page may not show (a lost answer, another tab or device played), so the
// view is asked for again and only then is the message shown.
const REFETCH_CODES = new Set(['puzzle_already_finished', 'duplicate_guess'])

function leavesViewStale(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.isNetworkError || REFETCH_CODES.has(error.code))
  )
}

// A guess or a skip (`titleId` null). The answer is the new view: it is written into the cache, with no second request.
export function useGuess({
  target,
  view,
}: {
  target: GameViewTarget
  view: GameGuesserView
}) {
  const queryClient = useQueryClient()
  // A second press can come before the render that shows `isPending`, so the lock is a ref (AC-16).
  const sending = useRef(false)

  const mutation = useMutation({
    mutationFn: async (titleId: number | null) => {
      try {
        const answer = await gamesSubmitGuess(target.slug, target.date, {
          title_id: titleId,
          // The server ignores this for an account; for a guest it is the game so far (AC-51).
          previous: view.guesses.map((guess) => guess.title_id),
        })
        // Written here and not in `onSuccess`: when the answer says `signed_in: false`, the session guard has
        // already signed the page out, and the guest query must have this answer before it asks for its own.
        writeAnswer(queryClient, target, answer)
        return answer
      } catch (error) {
        // What the shown view says about the server decides, not who the page thinks is signed in: a guest's
        // game lives in the browser, and asking the server again would only give an empty one (AC-53).
        if (view.signed_in && leavesViewStale(error)) {
          await refetchView(queryClient, target)
        }
        throw error
      }
    },
    onSettled: () => {
      sending.current = false
    },
  })

  function send(titleId: number | null) {
    if (sending.current) return
    sending.current = true
    mutation.mutate(titleId)
  }

  return {
    send,
    isPending: mutation.isPending,
    error: mutation.error,
    answer: mutation.data,
  }
}
