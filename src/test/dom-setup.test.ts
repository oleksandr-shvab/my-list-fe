// @vitest-environment jsdom
import './dom-setup'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the DOM test setup', () => {
  it('leaves ResizeObserver and matchMedia replaceable with vi.stubGlobal', () => {
    class OtherObserver {}
    vi.stubGlobal('ResizeObserver', OtherObserver)
    expect(window.ResizeObserver).toBe(OtherObserver)

    const matchMedia = vi.fn()
    vi.stubGlobal('matchMedia', matchMedia)
    expect(window.matchMedia).toBe(matchMedia)

    vi.unstubAllGlobals()
    // The stubs from the setup are back.
    expect(typeof window.ResizeObserver).toBe('function')
    expect(window.matchMedia('(min-width: 1px)').matches).toBe(false)
  })
})
