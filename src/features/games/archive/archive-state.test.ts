import { describe, expect, it } from 'vitest'
import { boxesOf, type BoxMark, type RowState } from './archive-state'

describe('boxesOf (AC-84)', () => {
  const E: BoxMark = 'empty'
  const F: BoxMark = 'filled'
  const C: BoxMark = 'correct'
  const X: BoxMark = 'failed'

  it.each<[string, RowState, BoxMark[]]>([
    ['not played', { state: 'not_played', guessesUsed: 0 }, [E, E, E, E, E, E]],
    [
      'in progress',
      { state: 'in_progress', guessesUsed: 2 },
      [F, F, E, E, E, E],
    ],
    [
      'won with the first guess',
      { state: 'won', guessesUsed: 1 },
      [C, E, E, E, E, E],
    ],
    ['won with three', { state: 'won', guessesUsed: 3 }, [F, F, C, E, E, E]],
    [
      'won with the last guess',
      { state: 'won', guessesUsed: 6 },
      [F, F, F, F, F, C],
    ],
    ['lost', { state: 'lost', guessesUsed: 6 }, [X, X, X, X, X, X]],
    // A tampered record can hold more than six guesses, or a negative count.
    [
      'more guesses than slots',
      { state: 'won', guessesUsed: 9 },
      [F, F, F, F, F, C],
    ],
    [
      'a negative count',
      { state: 'in_progress', guessesUsed: -1 },
      [E, E, E, E, E, E],
    ],
  ])('%s', (_name, rowState, expected) => {
    expect(boxesOf(rowState)).toEqual(expected)
  })
})
