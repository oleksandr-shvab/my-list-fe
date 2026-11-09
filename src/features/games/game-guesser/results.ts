import type { ParseKeys } from 'i18next'
import type { GuessResult } from '@/api/generated/models'

export const RESULT_KEYS: Record<GuessResult, ParseKeys> = {
  correct: 'games.result.correct',
  franchise: 'games.result.franchise',
  wrong: 'games.result.wrong',
  skipped: 'games.result.skipped',
}
