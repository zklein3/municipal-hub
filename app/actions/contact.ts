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

  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#b91c1c">New Access Request — FireOps7</h2>
        <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:4px 0"><strong>Name:</strong> ${name}</p>
          <p style="margin:4px 0"><strong>Department:</strong> ${department}</p>
          <p style="margin:4px 0"><strong>Email:</strong> ${email}</p>
          ${phone ? `<p style="margin:4px 0"><strong>Phone:</strong> ${phone}</p>` : ''}
        </div>
      </div>
    `

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'FireOps7 <noreply@fireops7.com>',
        to: 'zklein3@gmail.com',
        reply_to: email,
        subject: `New Access Request — ${department}`,
        html,
      }),
    })

    if (!emailRes.ok) {
      console.error('contact_request email failed:', await emailRes.text())
    }
  }

  return { ok: true }
}
