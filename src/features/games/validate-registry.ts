type Catalogue = { [key: string]: string | Catalogue }

const SLUG_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/

function hasKey(catalogue: Catalogue, key: string): boolean {
  let node: string | Catalogue | undefined = catalogue
  for (const part of key.split('.')) {
    if (typeof node !== 'object') return false
    node = node[part]
  }
  return typeof node === 'string'
}

function findDuplicates<T>(values: readonly T[]): T[] {
  return [...new Set(values.filter((v, i) => values.indexOf(v) !== i))]
}

// What the checks read of a registry entry. A `GameEntry` fits; the type is looser so a test can
// try a name key that no catalogue has.
type RegistryEntry = {
  slug: string
  nameKey: string
  order: number
  isDefault: boolean
}

// Checks the rules a registry must keep (AC-50, AC-51) and returns what is wrong, one text per
// problem. An empty list means the registry is fine.
export function validateRegistry(
  entries: readonly RegistryEntry[],
  catalogues: Record<string, Catalogue>,
): string[] {
  const problems: string[] = []

  const defaults = entries.filter((entry) => entry.isDefault)
  if (defaults.length !== 1) {
    problems.push(`expected exactly one default game, found ${defaults.length}`)
  }

  for (const entry of entries) {
    if (!SLUG_FORMAT.test(entry.slug)) {
      problems.push(`slug "${entry.slug}" does not match ${SLUG_FORMAT}`)
    }
    for (const [language, catalogue] of Object.entries(catalogues)) {
      if (!hasKey(catalogue, entry.nameKey)) {
        problems.push(
          `name key "${entry.nameKey}" of "${entry.slug}" is missing in "${language}"`,
        )
      }
    }
  }

  for (const slug of findDuplicates(entries.map((entry) => entry.slug))) {
    problems.push(`slug "${slug}" is used more than once`)
  }
  // Not required by the spec: it keeps the navigation order from being ambiguous.
  for (const order of findDuplicates(entries.map((entry) => entry.order))) {
    problems.push(`order ${order} is used more than once`)
  }

  return problems
}
