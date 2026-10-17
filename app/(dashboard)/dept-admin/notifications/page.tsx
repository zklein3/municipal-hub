import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission, resolveDepartmentPermissions } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import HelpText from '@/components/HelpText'
import NotificationsClient, { type Recipient } from './NotificationsClient'

export default async function NotificationsPage() {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.departmentId) redirect('/dashboard')
  if (!(await hasPermission(ctx, 'manage_department_settings'))) redirect('/dashboard')

  const adminClient = createAdminClient()

  const [{ data: dept }, { data: dpRows }, resolved] = await Promise.all([
    adminClient.from('departments')
      .select('weekly_digest_enabled, public_site_enabled')
      .eq('id', ctx.departmentId).single(),
    adminClient.from('department_personnel')
      .select('id, personnel_id, notify_feedback, burn_permit_reviewer, notify_membership_interest')
      .eq('department_id', ctx.departmentId)
      .eq('active', true),
    resolveDepartmentPermissions(ctx.departmentId),
  ])

  // Eligibility comes from permission groups: a person can only be notified about an inbox
  // item if their group lets them act on it. Same check the send paths use.
  const eligible = (personnelId: string) => {
    const snap = resolved.get(personnelId)?.snapshot
    return {
      notify_feedback: !!snap?.manage_public_inbox,
      burn_permit_reviewer: !!snap?.review_burn_permits,
      notify_membership_interest: !!snap?.manage_public_inbox,
    }
  }
  const eligibleRows = (dpRows ?? []).filter(r => Object.values(eligible(r.personnel_id)).some(Boolean))

  const ids = eligibleRows.map(r => r.personnel_id)
  const { data: people } = ids.length
    ? await adminClient.from('personnel').select('id, first_name, last_name, email').in('id', ids)
    : { data: [] as { id: string; first_name: string | null; last_name: string | null; email: string | null }[] }
  const personMap = new Map((people ?? []).map(p => [p.id, p]))

  const recipients: Recipient[] = eligibleRows
    .map(r => {
      const p = personMap.get(r.personnel_id)
      return {
        deptPersonnelId: r.id,
        name: `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Unnamed',
        email: p?.email ?? null,
        can: eligible(r.personnel_id),
        notify_feedback: !!r.notify_feedback,
        burn_permit_reviewer: !!r.burn_permit_reviewer,
        notify_membership_interest: !!r.notify_membership_interest,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Notifications</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Who gets emailed, and for what</p>
      </div>

      <HelpText className="mb-4">
        Turn a notification on for each person who should get an email when it happens. People are listed based on
        their permission group — someone only appears for an alert if their group lets them handle it (Manage Public
        Inbox or Review Burn Permits). People without an email address on their profile are skipped.
      </HelpText>

      <NotificationsClient
        departmentId={ctx.departmentId}
        recipients={recipients}
        weeklyDigestEnabled={dept?.weekly_digest_enabled ?? false}
        publicSiteEnabled={dept?.public_site_enabled ?? false}
      />
    </div>
  )
}
