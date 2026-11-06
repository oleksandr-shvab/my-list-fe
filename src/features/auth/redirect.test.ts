import { describe, expect, it } from 'vitest'
import { resolveRedirect } from './redirect'

const ORIGIN = 'http://localhost:5173'

describe('resolveRedirect', () => {
  it.each([
    // Accepted rows of the spec's "Untrusted inputs" table.
    [
      '/games/game-guesser/2026-10-01?a=1',
      '/games/game-guesser/2026-10-01?a=1',
    ],
    ['/profile', '/profile'],
    ['/%2F/evil.com', '/%2F/evil.com'],
    ['/profile#section', '/profile#section'],
    ['http://localhost:5173/profile?x=1', '/profile?x=1'],
    ['/a/./b/../profile', '/a/profile'],
  ])('accepts %j and gives the path %j', (value, expected) => {
    expect(resolveRedirect(value, ORIGIN)).toBe(expected)
  })

  it.each([
    // Rejected rows of the same table.
    ['//evil.com'],
    ['/\\evil.com'],
    ['/\t/evil.com'],
    ['https://evil.com'],
    ['javascript:alert(1)'],
    ['/\n/evil.com'],
    ['/\\/evil.com'],
    ['http://localhost:5174/profile'],
    ['http://evil.com:5173/profile'],
    ['data:text/html,<script>alert(1)</script>'],
    ['data:text/plain,/profile'],
    ['file:///profile'],
    ['file:///etc/passwd'],
    // A blob: URL takes the origin of the URL inside it, but its path is that whole URL, so it
    // would come back as an absolute URL, skip the auth-page rule and can hide a second host
    // behind `//`.
    ['blob:http://localhost:5173/profile'],
    ['blob:http://localhost:5173/login'],
    ['blob:http://localhost:5173//evil.com'],
    ['BLOB:http://localhost:5173/profile'],
    ['blob:https://evil.com/profile'],
    // Same origin after resolving, but the path starts with `//`, which history.push reads
    // as another host.
    ['/.//evil.com'],
    ['/a/../..//evil.com'],
  ])('rejects %j', (value) => {
    expect(resolveRedirect(value, ORIGIN)).toBeUndefined()
  })

  it.each([
    ['/login'],
    ['/login?redirect=/profile'],
    ['/register'],
    ['/forgot-password'],
    ['/reset-password'],
    // A token must not be copied into another URL.
    ['/reset-password?token=x'],
    // The router matches paths case-insensitively, so these are the same pages.
    ['/LOGIN'],
    ['/Forgot-Password'],
    ['/login/'],
    ['/login//'],
    ['/%6Cogin'],
    ['http://localhost:5173/login'],
  ])('sends the auth page %j to the home page by rejecting it', (value) => {
    expect(resolveRedirect(value, ORIGIN)).toBeUndefined()
  })

  it('keeps pages that only start like an auth page', () => {
    expect(resolveRedirect('/login-help', ORIGIN)).toBe('/login-help')
    expect(resolveRedirect('/profile/login', ORIGIN)).toBe('/profile/login')
  })

  it.each([[''], [undefined], [null], [123], [true], [['/profile']], [{}]])(
    'ignores the value %j that is not a non-empty string',
    (value) => {
      expect(resolveRedirect(value, ORIGIN)).toBeUndefined()
    },
  )

  it('rejects a value the URL parser cannot read', () => {
    expect(resolveRedirect('http://', ORIGIN)).toBeUndefined()
  })
})
