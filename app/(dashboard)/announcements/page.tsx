import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AnnouncementsClient from './AnnouncementsClient'

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, first_name, last_name, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient.from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')

  const departmentId = myDept.department_id
  const systemRole = myDept.system_role
  const isOfficerOrAbove = systemRole === 'admin' || systemRole === 'officer'
  const isAdmin = systemRole === 'admin'

  const [{ data: announcements }, { data: reads }] = await Promise.all([
    adminClient.from('announcements')
      .select('id, title, body, pinned, created_at, author_personnel_id')
      .eq('department_id', departmentId)
      .order('created_at', { ascending: false }),
    adminClient.from('announcement_reads')
      .select('announcement_id')
      .eq('personnel_id', me.id),
  ])

  // Fetch author names flat
  const authorIds = [...new Set((announcements ?? []).map(a => a.author_personnel_id))]
  const { data: authors } = authorIds.length > 0
    ? await adminClient.from('personnel').select('id, first_name, last_name').in('id', authorIds)
    : { data: [] }
  const authorMap = Object.fromEntries((authors ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`.trim()]))

  const readSet = new Set((reads ?? []).map(r => r.announcement_id))

  const items = (announcements ?? []).map(a => ({
    id: a.id,
    title: a.title,
    body: a.body,
    pinned: a.pinned,
    created_at: a.created_at,
    author_name: authorMap[a.author_personnel_id] ?? 'Unknown',
    read: readSet.has(a.id),
  }))

  return (
    <AnnouncementsClient
      announcements={items}
      isOfficerOrAbove={isOfficerOrAbove}
      isAdmin={isAdmin}
    />
  )
}
