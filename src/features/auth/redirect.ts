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

  // Only web pages. A `blob:http://localhost:5173/login` URL has this origin, but its path is the
  // whole inner URL, which would skip the auth-page rule and be returned as an absolute URL.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
  if (url.origin !== origin) return undefined
  if (isAuthPath(url.pathname)) return undefined

  const target = url.pathname + url.search + url.hash
  // Exactly one leading slash. Dot segments can leave a path that starts with `//`
  // (`/.//evil.com`): same origin here, but history.push would read it as another host.
  if (!/^\/(?!\/)/.test(target)) return undefined

  return target
}
