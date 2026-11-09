import { Lock } from 'lucide-react'
import type { ParseKeys } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { HintRead, StepRead } from '@/api/generated/models'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClueMedia } from './clue-media'

const HINT_LABEL_KEYS: Record<string, ParseKeys> = {
  metacritic_score: 'games.hint.metacritic_score',
  platform: 'games.hint.platform',
  genre: 'games.hint.genre',
  year: 'games.hint.year',
  developer: 'games.hint.developer',
}

// The backend's kinds are free strings (Q10): any other kind gets the generic label. Values stay as sent.
function Hint({ hint }: { hint: HintRead }) {
  const { t } = useTranslation()
  const labelKey = Object.hasOwn(HINT_LABEL_KEYS, hint.kind)
    ? HINT_LABEL_KEYS[hint.kind]
    : 'games.hint.hint'

  return (
    <p className="text-sm">
      {t('games.hint_line', { label: t(labelKey), value: hint.value })}
    </p>
  )
}

type ClueLadderProps = {
  // Only the steps the player has earned.
  steps: StepRead[]
  // How many steps the game has in all (the view's `max_guesses`).
  totalSteps: number
  selected: number
  onSelect: (step: number) => void
  // Gets every clue link signed again (AC-24) and gives the steps with the new links.
  onRefreshLinks: () => Promise<StepRead[] | undefined>
}

// The clue steps of a game: a tab per step, locked until earned. It knows nothing about guesses or the answer.
export function ClueLadder({
  steps,
  totalSteps,
  selected,
  onSelect,
  onRefreshLinks,
}: ClueLadderProps) {
  const { t } = useTranslation()
  const earned = new Map(steps.map((step) => [step.step, step]))

  return (
    <Tabs
      value={String(selected)}
      onValueChange={(value) => onSelect(Number(value))}
    >
      <TabsList
        aria-label={t('games.steps_label')}
        className="h-auto w-full max-md:gap-1"
      >
        {Array.from({ length: totalSteps }, (_, index) => index + 1).map(
          (step) => {
            const isEarned = earned.has(step)
            return (
              <TabsTrigger
                key={step}
                value={String(step)}
                disabled={!isEarned}
                aria-label={t(isEarned ? 'games.step' : 'games.step_locked', {
                  n: step,
                })}
                // A locked step has no panel to point at.
                {...(isEarned ? {} : { 'aria-controls': undefined })}
                className="h-9 min-w-6 max-md:h-11"
              >
                {isEarned ? step : <Lock aria-hidden />}
              </TabsTrigger>
            )
          },
        )}
      </TabsList>
      {/* Every earned step stays mounted and only the selected one shows, so going back to a step
          does not ask for its (possibly expired) link again. */}
      {steps.map((step) => (
        <TabsContent
          key={step.step}
          value={String(step.step)}
          forceMount
          hidden={step.step !== selected}
          className="flex flex-col gap-2"
        >
          <ClueMedia
            media={step.media}
            alt={t('games.clue_alt', { n: step.step, total: totalSteps })}
            active={step.step === selected}
            onRefreshLinks={() =>
              onRefreshLinks().then(
                (fresh) =>
                  fresh?.find((item) => item.step === step.step)?.media,
              )
            }
          />
          {step.hint && <Hint hint={step.hint} />}
        </TabsContent>
      ))}
    </Tabs>
  )
}
