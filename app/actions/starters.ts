'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import { logError, logEvent } from '@/lib/logger'
import { seedDepartmentStarters, type StarterSeedSummary } from '@/lib/starter-seed'
import { revalidatePath } from 'next/cache'

function revalidateSetup() {
  revalidatePath('/dept-admin/setup')
  revalidatePath('/equipment')
}

// ─── Dept admin: add any starter content this department hasn't received yet ──
export async function addMissingStarters(): Promise<{ summary?: StarterSeedSummary; error?: string }> {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) return { error: 'Not authenticated.' }
  if (!ctx.departmentId) return { error: 'No department selected.' }
  if (!ctx.isSysAdmin && !(await hasPermission(ctx, 'manage_dept_setup'))) {
    return { error: 'You do not have permission to manage department setup.' }
  }

  const adminClient = createAdminClient()
  const result = await seedDepartmentStarters(adminClient, ctx.departmentId)
  if (result.error) {
    await logError(result.error, '/dept-admin/setup', { department_id: ctx.departmentId, personnel_id: ctx.personnelId })
    return { error: result.error }
  }
  revalidateSetup()
  return result
}

// ─── Sys admin: push starter content to every active fire department ──────────
export async function pushStartersToAllDepartments(): Promise<{
  results?: { department_id: string; name: string; summary?: StarterSeedSummary; error?: string }[]
  error?: string
}> {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx?.isSysAdmin) return { error: 'Sys admin only.' }

  const adminClient = createAdminClient()
  const { data: depts, error: dbErr } = await adminClient
    .from('departments')
    .select('id, name')
    .eq('active', true)
    .eq('department_type', 'fire')
  if (dbErr) return { error: dbErr.message }

  const results: { department_id: string; name: string; summary?: StarterSeedSummary; error?: string }[] = []
  for (const d of depts ?? []) {
    const r = await seedDepartmentStarters(adminClient, d.id)
    results.push({ department_id: d.id, name: d.name, ...r })
    if (r.error) await logError(r.error, '/admin', { department_id: d.id, personnel_id: ctx.personnelId })
  }

  await logEvent({
    log_type: 'info',
    page: '/admin',
    message: `Starter catalog pushed to ${results.length} fire department(s); ${results.filter(r => r.error).length} failed.`,
    personnel_id: ctx.personnelId,
    metadata: { results: results.map(r => ({ name: r.name, error: r.error ?? null, summary: r.summary ?? null })) },
  })

  revalidateSetup()
  return { results }
}
