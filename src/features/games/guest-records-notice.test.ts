// @vitest-environment jsdom
import '@/test/dom-setup'
import { toast } from 'sonner'
import { afterEach, expect, it, vi } from 'vitest'
import { isNudgeDismissed } from './guest-records'

afterEach(() => {
  vi.restoreAllMocks()
})

// This file has its own module state: the notice is shown once per page.
it('shows the storage notice once, after the failing call has returned, so no render ever shows it', async () => {
  const info = vi.spyOn(toast, 'info').mockImplementation(() => 1)
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('denied')
  })

  // A read that fails inside a component's render: the call must not toast while it runs.
  expect(isNudgeDismissed()).toBe(false)
  expect(info).not.toHaveBeenCalled()

  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(info).toHaveBeenCalledTimes(1)
  isNudgeDismissed()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(info).toHaveBeenCalledTimes(1)
})
