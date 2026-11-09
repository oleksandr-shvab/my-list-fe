import { useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { gamesResumePuzzle } from '@/api/generated/api'
import type { GameGuesserView, StepRead } from '@/api/generated/models'
import {
  gameViewKey,
  refetchView,
  writeAnswer,
  type GameViewTarget,
} from './view-queries'

// Gets every clue link signed again (AC-24) and gives the steps with the new links; steps that fail together share
// one request. An account's view is fetched again, and a guest's guesses are replayed through resume, as its view would be empty.
export function useRefreshLinks({
  target,
  view,
}: {
  target: GameViewTarget
  view: GameGuesserView
}): () => Promise<StepRead[] | undefined> {
  const queryClient = useQueryClient()
  const inFlight = useRef<Promise<StepRead[] | undefined> | null>(null)

  async function refresh() {
    if (view.signed_in) return (await refetchView(queryClient, target))?.steps

    // M1-32 replaces this with the guest record's guesses.
    const previous = view.guesses.map((guess) => guess.title_id)
    const answer = await gamesResumePuzzle(target.slug, target.date, {
      previous,
    })
    // A guess answered while this ran has a newer view with its own links: keep that one.
    const current = queryClient.getQueryData<GameGuesserView>(
      gameViewKey(target),
    )
    if (current && current.guesses.length !== previous.length) {
      return current.steps
    }
    writeAnswer(queryClient, target, answer)
    return answer.steps
  }

  return () => {
    inFlight.current ??= refresh().finally(() => {
      inFlight.current = null
    })
    return inFlight.current
  }
}
