import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { redirect } from 'next/navigation'
import AssetInspectionClient from './AssetInspectionClient'

export default async function AssetInspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.departmentId) redirect('/dashboard')

  const admin = createAdminClient()

  const { data: asset } = await admin
    .from('item_assets')
    .select('id, asset_tag, serial_number, item_id, apparatus_id, status')
    .eq('id', id)
    .eq('department_id', ctx.departmentId)
    .single()

  if (!asset) redirect('/inspections')

  const { data: item } = await admin
    .from('items')
    .select('id, item_name')
    .eq('id', asset.item_id)
    .single()

  const { data: templates } = await admin
    .from('item_inspection_templates')
    .select('id, template_name, template_description')
    .eq('item_id', asset.item_id)
    .eq('active', true)

  if (!templates || templates.length === 0) redirect(`/equipment/assets/${id}`)

  const templateIds = templates.map(t => t.id)
  const { data: steps } = await admin
    .from('item_inspection_template_steps')
    .select('id, template_id, step_text, step_type, required, fail_if_negative, sort_order')
    .in('template_id', templateIds)
    .eq('active', true)
    .order('sort_order')

  const stepsByTemplate = Object.fromEntries(
    templates.map(t => [t.id, (steps ?? []).filter(s => s.template_id === t.id)])
  )

  const { data: personnel } = await admin
    .from('personnel')
    .select('first_name, last_name')
    .eq('id', ctx.personnelId)
    .single()

  const inspectorName = personnel
    ? `${personnel.first_name} ${personnel.last_name}`
    : 'Unknown'

  return (
    <AssetInspectionClient
      asset={asset}
      item={item ?? { id: asset.item_id, item_name: 'Unknown Item' }}
      templates={templates.map(t => ({ ...t, steps: stepsByTemplate[t.id] ?? [] }))}
      inspectorName={inspectorName}
      personnelId={ctx.personnelId}
      departmentId={ctx.departmentId}
    />
  )
}
