'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logError } from '@/lib/logger'

export async function resolveLog(id: string) {
  try {
    const admin = createAdminClient()
    const { error: dbErr } = await admin
      .from('system_logs')
      .update({ resolved: true })
      .eq('id', id)
    if (dbErr) throw dbErr
    revalidatePath('/admin/logs')
  } catch (err) {
    await logError(err, '/admin/logs')
    return { error: 'Failed to resolve log.' }
  }
}

export async function setSystemSetting(key: string, value: string) {
  const admin = createAdminClient()
  const { error: dbErr } = await admin
    .from('system_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() })
  if (dbErr) { await logError(dbErr.message, '/admin/departments', { metadata: { key } }); return { error: dbErr.message } }
  revalidatePath('/admin/departments')
  revalidatePath('/fire-school')
  return { success: true }
}

export async function submitFireSchoolInquiry(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const dept = (formData.get('dept') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const message = (formData.get('message') as string)?.trim()

  if (!name || !message) return { error: 'Name and message are required.' }

  const admin = createAdminClient()
  const { error: dbErr } = await admin
    .from('system_logs')
    .insert({
      log_type: 'fire_school_inquiry',
      message: `Fire School Inquiry\nFrom: ${name}${dept ? ` — ${dept}` : ''}${email ? ` (${email})` : ''}\n\n${message}`,
      resolved: false,
    })

  if (dbErr) { await logError(dbErr.message, '/fire-school', { metadata: { name, email } }); return { error: 'Failed to submit. Please try again.' } }
  return { success: true }
}

export async function resolveAllLogs(logType?: string) {
  try {
    const admin = createAdminClient()
    let query = admin
      .from('system_logs')
      .update({ resolved: true })
      .eq('resolved', false)
    if (logType) query = query.eq('log_type', logType)
    const { error: dbErr } = await query
    if (dbErr) throw dbErr
    revalidatePath('/admin/logs')
  } catch (err) {
    await logError(err, '/admin/logs')
    return { error: 'Failed to resolve logs.' }
  }
}
