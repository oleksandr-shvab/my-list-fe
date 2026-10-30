import { describe, expect, inject, it } from 'vitest'
import { MOBILE_QUERY } from './use-mobile'

// The phone layout and the sidebar must meet exactly at Tailwind's `md`, or a fractional width
// between them shows no navigation. The sidebar shows from `md:`, so everything else is a phone.
// The stylesheets come as text from `vitest.config.ts` (`?raw` gives an empty string for a stylesheet).
const { tailwindTheme, index } = inject('cssText')

describe('the phone breakpoint', () => {
  it('is the exact complement of the Tailwind md breakpoint', () => {
    const md = /--breakpoint-md:\s*([\w.]+);/.exec(tailwindTheme)?.[1]

    expect(md).toBe('48rem')
    expect(MOBILE_QUERY).toBe(`not (min-width: ${md})`)
  })

  it('is the same one the scroll padding in index.css uses', () => {
    expect(index).toContain(`@media (${MOBILE_QUERY}) and (min-height: 500px)`)
  })
})
