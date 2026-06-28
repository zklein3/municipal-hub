import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'

export default async function IncidentAccountabilityRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect('/select-department')
  if (!ctx.departmentId) redirect('/dashboard')
  if (ctx.departmentType !== 'fire') redirect('/dashboard')

  // Verify incident belongs to this dept
  const { data: incList } = await adminClient
    .from('incidents').select('id').eq('id', id).eq('department_id', ctx.departmentId)
  if (!incList?.[0]) notFound()

  // Look for an existing board linked to this incident
  const { data: boards } = await adminClient
    .from('accountability_boards')
    .select('id')
    .eq('department_id', ctx.departmentId)
    .eq('linked_incident_id', id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (boards?.[0]) {
    redirect(`/accountability/${boards[0].id}`)
  } else {
    redirect(`/accountability/new?incident_id=${id}`)
  }
}
