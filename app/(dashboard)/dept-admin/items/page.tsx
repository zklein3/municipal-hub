import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import ItemsClient from './ItemsClient'

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; item_id?: string }>
}) {
  const { tab, item_id } = await searchParams
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.departmentId || (ctx.systemRole !== 'admin' && !ctx.isSysAdmin)) redirect('/dashboard')

  const department_id = ctx.departmentId
  const department_name = ctx.departmentName ?? 'Your Department'

  const { data: categories } = await adminClient
    .from('item_categories')
    .select('id, category_name, active, sort_order')
    .eq('department_id', department_id)
    .order('sort_order')

  const { data: items } = await adminClient
    .from('items')
    .select('id, item_name, item_description, category_id, tracks_quantity, tracks_assets, requires_presence_check, requires_inspection, tracks_expiration, active')
    .eq('department_id', department_id)
    .order('item_name')

  // Fetch assets for asset-tracked items
  const assetItemIds = (items ?? []).filter(i => i.tracks_assets).map(i => i.id)
  const { data: assets } = assetItemIds.length > 0
    ? await adminClient
        .from('item_assets')
        .select('id, item_id, asset_tag, serial_number, in_service_date, out_of_service_date, status, active, notes')
        .eq('department_id', department_id)
        .in('item_id', assetItemIds)
        .order('asset_tag')
    : { data: [] }

  // Fetch inspection templates for inspectable items
  const inspectionItemIds = (items ?? []).filter(i => i.requires_inspection).map(i => i.id)
  const { data: templates } = inspectionItemIds.length > 0
    ? await adminClient
        .from('item_inspection_templates')
        .select('id, item_id, template_name, template_description, active')
        .eq('department_id', department_id)
        .in('item_id', inspectionItemIds)
        .order('template_name')
    : { data: [] }

  // Fetch all steps for those templates
  const templateIds = (templates ?? []).map(t => t.id)
  const { data: steps } = templateIds.length > 0
    ? await adminClient
        .from('item_inspection_template_steps')
        .select('id, template_id, step_text, step_description, step_type, response_type, required, fail_if_negative, sort_order, active')
        .in('template_id', templateIds)
        .eq('active', true)
        .order('sort_order')
    : { data: [] }

  return (
    <ItemsClient
      categories={categories ?? []}
      items={items ?? []}
      assets={assets ?? []}
      templates={templates ?? []}
      steps={steps ?? []}
      departmentName={department_name}
      departmentId={department_id}
      initialTab={(tab as any) ?? 'categories'}
      focusItemId={item_id ?? null}
    />
  )
}
