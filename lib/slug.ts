export const SLUG_MIN = 3
export const SLUG_MAX = 60

// Top-level routes and brand names a department slug must never shadow.
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'auth', 'board-guest', 'change-password', 'checkin', 'dashboard', 'denied',
  'dept', 'digest-ack', 'fire', 'fire-school', 'help', 'hose-testing', 'kiosk', 'login',
  'logout', 'municipal-hub', 'muniops', 'pending', 'police', 'print', 'profile-setup', 'public-works',
  'scan', 'select-department', 'signup', 'support', 'www',
])

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-$/g, '')
}

// Returns an error message, or null when the slug is acceptable.
export function validateSlug(slug: string): string | null {
  if (!slug) return 'A URL slug is required.'
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'Slug can only use lowercase letters, numbers, and single hyphens (no leading or trailing hyphen).'
  if (slug.length < SLUG_MIN) return `Slug must be at least ${SLUG_MIN} characters.`
  if (slug.length > SLUG_MAX) return `Slug must be ${SLUG_MAX} characters or fewer.`
  if (RESERVED_SLUGS.has(slug)) return `"${slug}" is a reserved word and can't be used as a slug.`
  return null
}
