import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPath } from '@/lib/current-path'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { getMedicalSupplyStatus } from '@/lib/medical-status'
import { ensureBagSessionRows } from '@/lib/inspection-bag-rows'
import InspectionRunClient from './InspectionRunClient'

export default async function InspectionRunPage({
  searchParams,
}: {
  searchParams: Promise<{ apparatus_id?: string; compartment_id?: string; mode?: string; session_id?: string; session_compartment_id?: string; storeroom_id?: string }>
}) {
  const { apparatus_id, compartment_id, mode, session_id, session_compartment_id, storeroom_id } = await searchParams
  if (!apparatus_id || !compartment_id) redirect('/inspections')
  const presenceOnly = mode === 'presence'

  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect(`/select-department?next=${encodeURIComponent(await getCurrentPath())}`)
  if (!ctx.departmentId) redirect('/dashboard')
  const me = { id: ctx.personnelId, first_name: ctx.firstName, last_name: ctx.lastName }

  // Fetch apparatus info
  const { data: appList } = await adminClient
    .from('apparatus')
    .select('id, unit_number, apparatus_name')
    .eq('id', apparatus_id)
  const apparatus = appList?.[0]
  if (!apparatus) redirect('/inspections')

  // Fetch compartment info
  const { data: compLinkList } = await adminClient
    .from('apparatus_compartments')
    .select('id, compartment_name_id')
    .eq('id', compartment_id)
  const compLink = compLinkList?.[0]
  if (!compLink) redirect('/inspections')

  const { data: compNameList } = await adminClient
    .from('compartment_names')
    .select('compartment_code, compartment_name')
    .eq('id', compLink.compartment_name_id)
  const compName = compNameList?.[0]

  // A bag check is scoped to that one bag; a compartment check to its loose contents (its bags are
  // separate lines that drill into their own checks).
  let bagInfo: { id: string; name: string } | null = null
  if (storeroom_id) {
    const { data: bagRow } = await adminClient.from('medical_storerooms')
      .select('id, name, department_id, container_kind').eq('id', storeroom_id).single()
    if (!bagRow || bagRow.department_id !== ctx.departmentId || bagRow.container_kind !== 'bag') redirect('/inspections')
    bagInfo = { id: bagRow.id, name: bagRow.name }
  }

  // Fetch items in this compartment (or bag)
  const { data: locationStandards } = await (storeroom_id
    ? adminClient.from('item_location_standards').select('id, item_id, expected_quantity').eq('storeroom_id', storeroom_id).eq('active', true)
    : adminClient.from('item_location_standards').select('id, item_id, expected_quantity').eq('apparatus_compartment_id', compartment_id).eq('active', true))

  const itemIds = (locationStandards ?? []).map(ls => ls.item_id)
  const { data: itemsRaw } = itemIds.length > 0
    ? await adminClient
        .from('items')
        .select('id, item_name, requires_inspection, tracks_assets, requires_presence_check')
        .in('id', itemIds)
    : { data: [] }
  const itemMap = Object.fromEntries((itemsRaw ?? []).map(i => [i.id, i]))

  // For asset-tracked items, fetch their assets
  const assetItemIds = (itemsRaw ?? []).filter(i => i.tracks_assets).map(i => i.id)
  const { data: assets } = assetItemIds.length > 0
    ? await adminClient
        .from('item_assets')
        .select('id, item_id, asset_tag, serial_number, status, apparatus_id')
        .eq('department_id', ctx.departmentId)
        .in('item_id', assetItemIds)
        .eq('active', true)
        .neq('status', 'RETIRED')
    : { data: [] }

  // Exclude assets already confirmed in OTHER compartments this session
  // (assets from the current compartment stay visible so they show as already-submitted on resume)
  let usedAssetIds = new Set<string>()
  let initialSubmittedAssets: string[] = []
  let initialSelectedAssets: Record<string, string[]> = {}
  if (session_id && assetItemIds.length > 0) {
    const base = () => adminClient.from('item_asset_inspection_logs').select('asset_id').eq('inspection_session_id', session_id)
    const [{ data: otherLogs }, { data: currentLogs }] = await Promise.all(storeroom_id
      ? [
          base().or(`storeroom_id.is.null,storeroom_id.neq.${storeroom_id}`),
          base().eq('storeroom_id', storeroom_id),
        ]
      : [
          base().or(`compartment_id.neq.${compartment_id},storeroom_id.not.is.null`),
          base().eq('compartment_id', compartment_id).is('storeroom_id', null),
        ])
    usedAssetIds = new Set((otherLogs ?? []).map(l => l.asset_id))
    initialSubmittedAssets = (currentLogs ?? []).map(l => l.asset_id)

    // Rebuild selectedAssets so each slot shows the asset that was previously saved
    const assetToItemId = Object.fromEntries((assets ?? []).map(a => [a.id, a.item_id]))
    const itemIdToLocStdId = Object.fromEntries((locationStandards ?? []).map(ls => [ls.item_id, ls.id]))
    for (const log of currentLogs ?? []) {
      const itemId = assetToItemId[log.asset_id]
      const locStdId = itemId ? itemIdToLocStdId[itemId] : null
      if (locStdId) {
        if (!initialSelectedAssets[locStdId]) initialSelectedAssets[locStdId] = []
        initialSelectedAssets[locStdId].push(log.asset_id)
      }
    }
  }

  // For each asset-tracked item, fetch its inspection templates + steps
  const { data: templates } = assetItemIds.length > 0
    ? await adminClient
        .from('item_inspection_templates')
        .select('id, item_id, template_name')
        .eq('department_id', ctx.departmentId)
        .in('item_id', assetItemIds)
        .eq('active', true)
    : { data: [] }

  const templateIds = (templates ?? []).map(t => t.id)
  const { data: steps } = templateIds.length > 0
    ? await adminClient
        .from('item_inspection_template_steps')
        .select('id, template_id, step_text, step_type, required, fail_if_negative, sort_order')
        .in('template_id', templateIds)
        .eq('active', true)
        .order('sort_order')
    : { data: [] }

  // Build checklist items
  const checklistItems = (locationStandards ?? []).map(ls => {
    const item = itemMap[ls.item_id]
    if (!item) return null

    const itemAssets = (assets ?? []).filter(a => a.item_id === ls.item_id && !usedAssetIds.has(a.id))
    const itemTemplates = (templates ?? []).filter(t => t.item_id === ls.item_id)

    return {
      location_standard_id: ls.id,
      item_id: ls.item_id,
      item_name: item.item_name,
      requires_inspection: item.requires_inspection,
      tracks_assets: item.tracks_assets,
      requires_presence_check: item.requires_presence_check,
      expected_quantity: ls.expected_quantity,
      assets: itemAssets.map(a => ({
        id: a.id,
        asset_tag: a.asset_tag,
        serial_number: a.serial_number,
        status: a.status,
        apparatus_id: a.apparatus_id ?? null,
      })),
      templates: itemTemplates.map(t => ({
        id: t.id,
        template_name: t.template_name,
        steps: (steps ?? [])
          .filter(s => s.template_id === t.id && s.step_type !== 'ASSET_LINK')
          .map(s => ({
            id: s.id,
            step_text: s.step_text,
            step_type: s.step_type,
            required: s.required,
            fail_if_negative: s.fail_if_negative,
          })),
      })),
    }
  }).filter(Boolean)

  // Medications assigned to this compartment (if module_medical is on)
  let medicationItems: {
    storeroom_id: string
    storeroom_inventory_id: string
    supply_type_id: string
    supply_name: string
    unit_of_measure: string
    par_level: number
    tracks_expiration: boolean
    is_controlled: boolean
    current_quantity: number
    lots: { id: string; lot_number: string | null; expiration_date: string | null; quantity_remaining: number }[]
    status: string
    refill_sources: { storeroom_id: string; name: string; available: number }[]
  }[] = []

  const { data: deptRow } = await adminClient.from('departments').select('module_medical').eq('id', ctx.departmentId).single()
  if (deptRow?.module_medical) {
    // The compartment's loose storage plus every bag placed in it. (Interim until bags get their own
    // drill-in checks — step 2D; until then a bag's medications are listed here, labeled by bag.)
    const { data: roomList } = await (storeroom_id
      ? adminClient.from('medical_storerooms').select('id, name, container_kind').eq('id', storeroom_id).eq('active', true)
      : adminClient.from('medical_storerooms').select('id, name, container_kind')
          .eq('apparatus_id', apparatus_id).eq('compartment_id', compartment_id)
          .eq('container_kind', 'compartment_storage').eq('active', true))
    const rooms = roomList ?? []
    const roomById = Object.fromEntries(rooms.map(r => [r.id, r]))

    if (rooms.length > 0) {
      const { data: invRows } = await adminClient
        .from('medical_storeroom_inventory')
        .select('id, storeroom_id, supply_type_id, par_level')
        .in('storeroom_id', rooms.map(r => r.id))

      const invIds = (invRows ?? []).map(i => i.id)
      const supplyTypeIds = [...new Set((invRows ?? []).map(i => i.supply_type_id))]

      const [{ data: lots }, { data: supplyTypes }] = await Promise.all([
        invIds.length > 0
          ? adminClient
              .from('medical_stock_lots')
              .select('id, storeroom_inventory_id, lot_number, expiration_date, quantity_remaining')
              .in('storeroom_inventory_id', invIds)
              .eq('active', true)
              .gt('quantity_remaining', 0)
              .order('expiration_date', { ascending: true, nullsFirst: false })
          : Promise.resolve({ data: [] }),
        supplyTypeIds.length > 0
          ? adminClient.from('medical_supply_types').select('id, name, unit_of_measure, tracks_expiration, is_controlled').in('id', supplyTypeIds)
          : Promise.resolve({ data: [] }),
      ])

      // Where each item could be refilled from right now: station storerooms with stock on hand.
      const { data: srcRooms } = await adminClient.from('medical_storerooms').select('id, name')
        .eq('department_id', ctx.departmentId).eq('active', true).eq('container_kind', 'storeroom')
      const srcRoomIds = (srcRooms ?? []).map(r => r.id)
      const { data: srcInv } = srcRoomIds.length > 0 && supplyTypeIds.length > 0
        ? await adminClient.from('medical_storeroom_inventory').select('id, storeroom_id, supply_type_id')
            .in('storeroom_id', srcRoomIds).in('supply_type_id', supplyTypeIds)
        : { data: [] as { id: string; storeroom_id: string; supply_type_id: string }[] }
      const { data: srcLots } = (srcInv ?? []).length > 0
        ? await adminClient.from('medical_stock_lots').select('storeroom_inventory_id, quantity_remaining')
            .in('storeroom_inventory_id', (srcInv ?? []).map(i => i.id)).eq('active', true).gt('quantity_remaining', 0)
        : { data: [] as { storeroom_inventory_id: string; quantity_remaining: number }[] }
      const srcQty = new Map<string, number>()
      for (const l of srcLots ?? []) srcQty.set(l.storeroom_inventory_id, (srcQty.get(l.storeroom_inventory_id) ?? 0) + l.quantity_remaining)
      const srcName = Object.fromEntries((srcRooms ?? []).map(r => [r.id, r.name]))
      const sourcesFor = (supplyTypeId: string) => (srcInv ?? [])
        .filter(i => i.supply_type_id === supplyTypeId && (srcQty.get(i.id) ?? 0) > 0)
        .map(i => ({ storeroom_id: i.storeroom_id, name: srcName[i.storeroom_id] ?? 'Storeroom', available: srcQty.get(i.id) ?? 0 }))
        .sort((a, b) => b.available - a.available)

      medicationItems = (invRows ?? []).map(inv => {
        const supply = (supplyTypes ?? []).find(s => s.id === inv.supply_type_id)
        const invLots = (lots ?? []).filter(l => l.storeroom_inventory_id === inv.id)
        const current_quantity = invLots.reduce((sum, l) => sum + l.quantity_remaining, 0)
        const room = roomById[inv.storeroom_id]
        return {
          storeroom_id: inv.storeroom_id,
          storeroom_inventory_id: inv.id,
          supply_type_id: inv.supply_type_id,
          supply_name: supply?.name ?? 'Unknown',
          unit_of_measure: supply?.unit_of_measure ?? '',
          par_level: inv.par_level,
          tracks_expiration: supply?.tracks_expiration ?? false,
          is_controlled: supply?.is_controlled ?? false,
          current_quantity,
          lots: invLots.map(l => ({ id: l.id, lot_number: l.lot_number, expiration_date: l.expiration_date, quantity_remaining: l.quantity_remaining })),
          status: getMedicalSupplyStatus(current_quantity, inv.par_level, invLots),
          refill_sources: sourcesFor(inv.supply_type_id),
        }
      })
    }
  }

  // Bags that have their own check under this compartment / bag, with their session status.
  let childBags: { row_id: string; storeroom_id: string; name: string; status: string }[] = []
  if (session_id) {
    await ensureBagSessionRows(adminClient, session_id, apparatus_id, ctx.departmentId)
    const { data: bagList } = await (storeroom_id
      ? adminClient.from('medical_storerooms').select('id, name').eq('parent_storeroom_id', storeroom_id)
      : adminClient.from('medical_storerooms').select('id, name').eq('compartment_id', compartment_id).eq('apparatus_id', apparatus_id))
    const activeBags = (bagList ?? []) as { id: string; name: string }[]
    if (activeBags.length > 0) {
      const { data: bagRows } = await adminClient.from('inspection_session_compartments')
        .select('id, storeroom_id, status').eq('session_id', session_id).in('storeroom_id', activeBags.map(b => b.id))
      const rowByBag = new Map((bagRows ?? []).map(r => [r.storeroom_id as string, r]))
      childBags = activeBags.flatMap(b => {
        const row = rowByBag.get(b.id)
        return row ? [{ row_id: row.id, storeroom_id: b.id, name: b.name, status: row.status }] : []
      }).sort((a, b) => a.name.localeCompare(b.name))
    }
  }

  return (
    <InspectionRunClient
      apparatus={{ id: apparatus.id, unit_number: apparatus.unit_number, apparatus_name: apparatus.apparatus_name }}
      compartment={bagInfo ? { code: bagInfo.name, name: 'Bag' } : { code: compName?.compartment_code ?? '—', name: compName?.compartment_name ?? null }}
      storeroomId={storeroom_id}
      childBags={childBags}
      compartmentId={compartment_id}
      checklistItems={checklistItems as any}
      medicationItems={medicationItems}
      inspectorName={`${me.first_name} ${me.last_name}`}
      personnelId={me.id}
      departmentId={ctx.departmentId}
      presenceOnly={presenceOnly}
      inspectionSessionId={session_id}
      sessionCompartmentId={session_compartment_id}
      initialSubmittedAssets={initialSubmittedAssets}
      initialSelectedAssets={initialSelectedAssets}
    />
  )
}
