/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MOBILE_QUERY } from './use-mobile'

// The phone layout and the sidebar must meet exactly at Tailwind's `md`, or a fractional width
// between them shows no navigation. The sidebar shows from `md:`, so everything else is a phone.
// The files are read as text: Vitest's `?raw` import gives an empty string for a stylesheet.
function readText(relative: string) {
  return readFileSync(new URL(relative, import.meta.url), 'utf8')
}

describe('the phone breakpoint', () => {
  it('is the exact complement of the Tailwind md breakpoint', () => {
    const theme = readText('../../node_modules/tailwindcss/theme.css')
    const md = /--breakpoint-md:\s*([\w.]+);/.exec(theme)?.[1]

    expect(md).toBe('48rem')
    expect(MOBILE_QUERY).toBe(`not (min-width: ${md})`)
  })

  it('is the same one the scroll padding in index.css uses', () => {
    expect(readText('../index.css')).toContain(
      `@media (${MOBILE_QUERY}) and (min-height: 500px)`,
    )
  })
})
