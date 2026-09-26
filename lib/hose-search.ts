// Ignores case, dashes and spaces so "231", "23-1" and "23 1" all find 23-10 … 23-19.
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function matchesHoseSearch(hoseIdentifier: string, search: string): boolean {
  const term = squash(search)
  return !term || squash(hoseIdentifier).includes(term)
}
