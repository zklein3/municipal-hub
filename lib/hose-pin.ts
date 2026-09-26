import crypto from 'crypto'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermissionForDepartment } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

// Officer PIN that unlocks "+ Add Hose" / "Manage Hoses" on the no-login
// /hose-testing/[slug] page. Testing itself stays open; only roster changes
// need the PIN. The hash lives in its own RLS-locked table (hose_testing_pins)
// so no client-facing department query can ever return it.

export const UNLOCK_TTL_MS = 12 * 60 * 60 * 1000

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,8}$/.test(pin)
}

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(pin, salt, 32)
  return `s1:${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyPin(pin: string, stored: string): boolean {
  const [ver, saltHex, hashHex] = stored.split(':')
  if (ver !== 's1' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = crypto.scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length)
  return crypto.timingSafeEqual(actual, expected)
}

function secret(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.')
  return key
}

function sign(body: string): string {
  return crypto.createHmac('sha256', secret()).update(body).digest('base64url')
}

type UnlockPayload = { t: 'hose_pin'; d: string; v: number; exp: number }

// Bound to the department and the PIN version, so changing the PIN
// invalidates every unlocked device at once.
export function createUnlockToken(departmentId: string, version: number): { token: string; exp: number } {
  const exp = Date.now() + UNLOCK_TTL_MS
  const body = Buffer.from(JSON.stringify({ t: 'hose_pin', d: departmentId, v: version, exp } satisfies UnlockPayload)).toString('base64url')
  return { token: `${body}.${sign(body)}`, exp }
}

function verifyUnlockToken(token: string | null | undefined, departmentId: string, version: number): boolean {
  if (!token) return false
  const [body, sig] = token.split('.')
  if (!body || !sig) return false
  const expected = Buffer.from(sign(body))
  const given = Buffer.from(sig)
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as UnlockPayload
    return p.t === 'hose_pin' && p.d === departmentId && p.v === version && Date.now() <= p.exp
  } catch {
    return false
  }
}

// Fails closed: with no PIN set, only a logged-in officer of the department may
// change the roster from the public page.
export async function canManageHoses(departmentId: string, pinToken: string | null | undefined): Promise<boolean> {
  const ctx = await getCurrentDepartmentContext().catch(() => null)
  if (ctx && await hasPermissionForDepartment(ctx.personnelId, ctx.isSysAdmin, departmentId, 'perform_iso_testing')) return true

  const { data: pin } = await createAdminClient()
    .from('hose_testing_pins').select('version').eq('department_id', departmentId).maybeSingle()
  if (!pin) return false
  return verifyUnlockToken(pinToken, departmentId, pin.version)
}
