import { describe, expect, it } from 'vitest'
import { sleep } from './sleep'

describe('sleep', () => {
  it('waits for the time, and rejects at once, not after it, when the signal aborts', async () => {
    const controller = new AbortController()
    await sleep(10, controller.signal)

    // A minute would end the test by its own timeout: only an abort that is heard can pass.
    const waiting = sleep(60_000, controller.signal)
    controller.abort(new Error('session ended'))
    await expect(waiting).rejects.toThrow('session ended')
    await expect(sleep(1, controller.signal)).rejects.toThrow('session ended')
  })
})
