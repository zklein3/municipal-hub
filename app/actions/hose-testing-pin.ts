'use server'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import { hashPin, verifyPin, isValidPinFormat, createUnlockToken } from '@/lib/hose-pin'
import { logError } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

const WINDOW_MIN = 15
const MAX_FAILS_PER_IP = 5
const MAX_FAILS_PER_DEPT = 30

async function clientIp(): Promise<string> {
  const h = await headers()
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim()
}

// Public: trade the PIN for a signed, 12-hour unlock token (kept in the tester's browser).
export async function unlockHoseManagement(
  slug: string,
  pin: string,
): Promise<{ token: string; exp: number } | { error: string }> {
  const adminClient = createAdminClient()
  const { data: dept } = await adminClient
    .from('departments').select('id, hose_testing_enabled').eq('public_slug', slug).maybeSingle()
  if (!dept || !dept.hose_testing_enabled) return { error: 'Hose testing is not currently enabled.' }

  const { data: pinRow } = await adminClient
    .from('hose_testing_pins').select('pin_hash, version').eq('department_id', dept.id).maybeSingle()
  if (!pinRow) return { error: 'No PIN has been set. Ask an officer to set one in Dept Admin → Settings.' }

  const ip = await clientIp()
  const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000).toISOString()
  await adminClient.from('hose_testing_pin_attempts').delete().lt('attempted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const [{ count: ipFails }, { count: deptFails }] = await Promise.all([
    adminClient.from('hose_testing_pin_attempts').select('id', { count: 'exact', head: true })
      .eq('department_id', dept.id).eq('ip', ip).eq('succeeded', false).gte('attempted_at', since),
    adminClient.from('hose_testing_pin_attempts').select('id', { count: 'exact', head: true })
      .eq('department_id', dept.id).eq('succeeded', false).gte('attempted_at', since),
  ])
  if ((ipFails ?? 0) >= MAX_FAILS_PER_IP || (deptFails ?? 0) >= MAX_FAILS_PER_DEPT) {
    return { error: `Too many incorrect attempts. Try again in ${WINDOW_MIN} minutes.` }
  }

  const ok = isValidPinFormat(pin) && verifyPin(pin, pinRow.pin_hash)
  await adminClient.from('hose_testing_pin_attempts').insert({ department_id: dept.id, ip, succeeded: ok })
  if (!ok) return { error: 'Incorrect PIN.' }

  return createUnlockToken(dept.id, pinRow.version)
}

// Dept admin: set or change the PIN. Bumping the version locks every unlocked device.
export async function setHoseTestingPin(pin: string): Promise<{ success: true; setAt: string } | { error: string }> {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx?.departmentId) return { error: 'Not authenticated.' }
  if (!(await hasPermission(ctx, 'manage_department_settings'))) return { error: 'Only admins can update department settings.' }
  if (!isValidPinFormat(pin)) return { error: 'PIN must be 4 to 8 digits.' }

  const adminClient = createAdminClient()
  const { data: existing } = await adminClient
    .from('hose_testing_pins').select('version').eq('department_id', ctx.departmentId).maybeSingle()
  const setAt = new Date().toISOString()
  const { error: dbErr } = await adminClient.from('hose_testing_pins').upsert({
    department_id: ctx.departmentId,
    pin_hash: hashPin(pin),
    version: (existing?.version ?? 0) + 1,
    set_at: setAt,
    set_by: ctx.personnelId,
  }, { onConflict: 'department_id' })
  if (dbErr) { await logError(dbErr.message, '/dept-admin/settings', { department_id: ctx.departmentId }); return { error: dbErr.message } }

  await adminClient.from('hose_testing_pin_attempts').delete().eq('department_id', ctx.departmentId)
  revalidatePath('/dept-admin/settings')
  return { success: true, setAt }
}
