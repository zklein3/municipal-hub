import crypto from 'crypto'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermissionForDepartment } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidPinFormat } from '@/lib/hose-pin'

// Officer PIN that unlocks the whole no-login /agility-test/[slug] page —
// unlike hose testing's PIN (which only gates roster edits, since equipment
// data is low-stakes), this gates entry entirely, because every record here
// is a person's pass/fail result feeding a hiring decision or an employee's
// training file. Same crypto (hashPin/verifyPin from lib/hose-pin.ts is
// generic — it isn't actually hose-specific), separate table/token namespace
// so changing one PIN never affects the other.

export { isValidPinFormat }

export const UNLOCK_TTL_MS = 12 * 60 * 60 * 1000

function secret(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.')
  return key
}

function sign(body: string): string {
  return crypto.createHmac('sha256', secret()).update(body).digest('base64url')
}

type UnlockPayload = { t: 'agility_pin'; d: string; v: number; exp: number }

export function createUnlockToken(departmentId: string, version: number): { token: string; exp: number } {
  const exp = Date.now() + UNLOCK_TTL_MS
  const body = Buffer.from(JSON.stringify({ t: 'agility_pin', d: departmentId, v: version, exp } satisfies UnlockPayload)).toString('base64url')
  return { token: `${body}.${sign(body)}`, exp }
}

export function verifyUnlockToken(token: string | null | undefined, departmentId: string, version: number): boolean {
  if (!token) return false
  const [body, sig] = token.split('.')
  if (!body || !sig) return false
  const expected = Buffer.from(sign(body))
  const given = Buffer.from(sig)
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as UnlockPayload
    return p.t === 'agility_pin' && p.d === departmentId && p.v === version && Date.now() <= p.exp
  } catch {
    return false
  }
}

// Fails closed: with no PIN set, only a logged-in officer of the department may
// use the public page at all.
export async function canAdministerAgilityTest(departmentId: string, pinToken: string | null | undefined): Promise<boolean> {
  const ctx = await getCurrentDepartmentContext().catch(() => null)
  if (ctx && await hasPermissionForDepartment(ctx.personnelId, ctx.isSysAdmin, departmentId, 'administer_agility_test')) return true

  const { data: pin } = await createAdminClient()
    .from('agility_test_pins').select('version').eq('department_id', departmentId).maybeSingle()
  if (!pin) return false
  return verifyUnlockToken(pinToken, departmentId, pin.version)
}
