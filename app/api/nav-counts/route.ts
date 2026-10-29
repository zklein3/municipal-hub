import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { getPermissionSnapshot } from '@/lib/permissions'
import { computeNavBadges, type LayoutCounts } from '@/lib/nav-badges'

// Light-weight badge numbers for the sidebar's background refresh (one database call).
// Keys are the nav hrefs the numbers belong to.
export async function GET() {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx?.departmentId) return NextResponse.json({}, { headers: { 'Cache-Control': 'no-store' } })

  const permissions = await getPermissionSnapshot(ctx)
  const { data } = await createAdminClient().rpc('layout_counts', { p_department: ctx.departmentId, p_personnel: ctx.personnelId })
  if (!data) return NextResponse.json({}, { headers: { 'Cache-Control': 'no-store' } })

  const b = computeNavBadges(data as LayoutCounts, permissions)
  return NextResponse.json(
    { '/operations': b.announcementUnread, '/inbox': b.inboxPending + b.pendingSignatures },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
