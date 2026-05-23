'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function submitContactRequest(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const department = (formData.get('department') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()

  if (!name || !department || !email) {
    return { error: 'Name, department, and email are required.' }
  }

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('system_logs').insert({
    log_type: 'contact_request',
    page: 'landing',
    message: `Access request from ${name} — ${department}`,
    metadata: { name, department, email, phone: phone || null },
  })

  if (dbErr) {
    console.error('contact_request insert failed:', dbErr)
    return { error: 'Failed to save your request. Please email zklein3@gmail.com directly.' }
  }

  return { ok: true }
}
