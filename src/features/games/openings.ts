let openings = 0

// A new number for each time a route without a date loads, also when the player follows a link to the page they are
// on. The game screen is keyed by it, so such a visit asks for today again (a refetch or a tab focus never does).
export function nextOpening(): number {
  openings += 1
  return openings
}
