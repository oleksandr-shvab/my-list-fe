// The pages a visitor must not be sent back to after logging in (no loops, and a reset link
// carries a token that must not be copied).
const AUTH_PATHS = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
])

function isAuthPath(pathname: string): boolean {
  let decoded = pathname
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    // Not valid percent-encoding: compare it as it is.
  }
  // The router matches paths without regard to case or a trailing slash.
  return AUTH_PATHS.has(decoded.toLowerCase().replace(/\/+$/, ''))
}

// Validates the `redirect` search parameter, which anyone can write into a link. Returns the
// path (with query and hash) to go to after login, or undefined when the value must be ignored.
// The result comes from the resolved URL, never from the raw value.
export function resolveRedirect(
  value: unknown,
  origin: string,
): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined

  let url: URL
  try {
    url = new URL(value, origin)
  } catch {
    return undefined
  }

  if (url.origin !== origin) return undefined
  // Dot segments can leave a path that starts with `//` (`/.//evil.com`): same origin here,
  // but history.push would read it as another host.
  if (url.pathname.startsWith('//')) return undefined
  if (isAuthPath(url.pathname)) return undefined

  return url.pathname + url.search + url.hash
}
