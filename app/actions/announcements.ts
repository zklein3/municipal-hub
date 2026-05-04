'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

async function getContext() {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) return null
  const { data: myDeptList } = await adminClient.from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  return {
    me,
    department_id: myDept?.department_id ?? null,
    system_role: myDept?.system_role ?? null,
    isOfficerOrAbove: myDept?.system_role === 'admin' || myDept?.system_role === 'officer' || me.is_sys_admin,
    isAdmin: myDept?.system_role === 'admin' || me.is_sys_admin,
  }
}

export async function createAnnouncement(formData: FormData) {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const title = (formData.get('title') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()
  if (!title || !body) return { error: 'Title and body are required' }

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('announcements').insert({
    department_id: ctx.department_id,
    author_personnel_id: ctx.me.id,
    title,
    body,
  })
  if (dbErr) {
    await logError(dbErr, 'createAnnouncement')
    return { error: 'Failed to create announcement' }
  }

  revalidatePath('/announcements')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteAnnouncement(id: string) {
  const ctx = await getContext()
  if (!ctx || !ctx.isAdmin) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('announcements').delete().eq('id', id)
  if (dbErr) {
    await logError(dbErr, 'deleteAnnouncement')
    return { error: 'Failed to delete announcement' }
  }

  revalidatePath('/announcements')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function pinAnnouncement(id: string, pinned: boolean) {
  const ctx = await getContext()
  if (!ctx || !ctx.isAdmin) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('announcements').update({ pinned }).eq('id', id)
  if (dbErr) {
    await logError(dbErr, 'pinAnnouncement')
    return { error: 'Failed to update announcement' }
  }

  revalidatePath('/announcements')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function markAnnouncementRead(announcementId: string) {
  const ctx = await getContext()
  if (!ctx || !ctx.me.id) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('announcement_reads').upsert({
    announcement_id: announcementId,
    personnel_id: ctx.me.id,
  }, { onConflict: 'announcement_id,personnel_id', ignoreDuplicates: true })
  if (dbErr) {
    await logError(dbErr, 'markAnnouncementRead')
    return { error: 'Failed to mark as read' }
  }

  revalidatePath('/announcements')
  revalidatePath('/dashboard')
  return { success: true }
}
