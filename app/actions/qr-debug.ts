'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logError } from '@/lib/logger'

async function assertSysAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Not authenticated.'
  const adminClient = createAdminClient()
  const { data: meList } = await adminClient.from('personnel').select('is_sys_admin').eq('auth_user_id', user.id)
  if (!meList?.[0]?.is_sys_admin) return 'Not authorized.'
  return null
}

export async function deleteDebugScan(id: string) {
  const authErr = await assertSysAdmin()
  if (authErr) return { error: authErr }

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('qr_debug_scans').delete().eq('id', id)
  if (error) { await logError(error.message, '/admin/qr-debug-scans', { metadata: { id } }); return { error: error.message } }

  revalidatePath('/admin/qr-debug-scans')
  return { success: true }
}

export async function clearAllDebugScans() {
  const authErr = await assertSysAdmin()
  if (authErr) return { error: authErr }

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('qr_debug_scans').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) { await logError(error.message, '/admin/qr-debug-scans'); return { error: error.message } }

  revalidatePath('/admin/qr-debug-scans')
  return { success: true }
}
