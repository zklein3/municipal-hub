import type { SupabaseClient } from '@supabase/supabase-js'
import { slugify, validateSlug, SLUG_MAX } from '@/lib/slug'

async function isTaken(adminClient: SupabaseClient, slug: string, excludeDepartmentId?: string) {
  let q = adminClient.from('departments').select('id').eq('public_slug', slug)
  if (excludeDepartmentId) q = q.neq('id', excludeDepartmentId)
  const { data } = await q.limit(1)
  return (data?.length ?? 0) > 0
}

// First free variant of `base`: base, base-2, base-3, ...
export async function findAvailableSlug(adminClient: SupabaseClient, base: string, excludeDepartmentId?: string): Promise<string | null> {
  if (validateSlug(base)) return null
  if (!(await isTaken(adminClient, base, excludeDepartmentId))) return base
  for (let n = 2; n <= 50; n++) {
    const suffix = `-${n}`
    const candidate = base.slice(0, SLUG_MAX - suffix.length).replace(/-$/, '') + suffix
    if (!(await isTaken(adminClient, candidate, excludeDepartmentId))) return candidate
  }
  return null
}

// Normalizes, validates, and checks availability of a slug a user typed.
export async function prepareSlug(
  adminClient: SupabaseClient,
  raw: string,
  excludeDepartmentId?: string,
): Promise<{ slug: string } | { error: string; suggestion?: string }> {
  const slug = slugify(raw)
  const formatErr = validateSlug(slug)
  if (formatErr) return { error: formatErr }
  if (await isTaken(adminClient, slug, excludeDepartmentId)) {
    const suggestion = await findAvailableSlug(adminClient, slug, excludeDepartmentId)
    return {
      error: suggestion
        ? `"${slug}" is already taken by another department. How about "${suggestion}"?`
        : `"${slug}" is already taken by another department.`,
      suggestion: suggestion ?? undefined,
    }
  }
  return { slug }
}
