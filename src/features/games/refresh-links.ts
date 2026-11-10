import { useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import type { GameGuesserView, StepRead } from '@/api/generated/models'
import {
  gameViewKey,
  loadView,
  refetchView,
  viewTargetOf,
  writeAnswer,
  type GameViewTarget,
} from './view-queries'

// Gets every clue link signed again (AC-24) and gives the steps with the new links; steps that fail together share
// one request. An account's view is fetched again; a guest's is loaded as on a reload, resumed from the record.
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
    const shown = viewTargetOf(target, view) ?? target
    if (view.signed_in) return (await refetchView(queryClient, shown))?.steps

    const key = gameViewKey(shown)
    const answer = await loadView({
      ...shown,
      cached: queryClient.getQueryData<GameGuesserView>(key),
      fallback: view.guesses.map((guess) => guess.title_id),
    })
    // A guess answered while this ran has a newer view with its own links: keep that one.
    const current = queryClient.getQueryData<GameGuesserView>(key)
    if (current && current.guesses.length !== view.guesses.length) {
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
