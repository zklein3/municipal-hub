import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPath } from '@/lib/current-path'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { getPermissionSnapshot } from '@/lib/permissions'
import MedicalStoreClient from './MedicalStoreClient'
import HelpText from '@/components/HelpText'
import MedicalModeBar, { type MedicalMode } from './MedicalModeBar'
import RestockClient from './RestockClient'
import MedicalAdminClient from '../dept-admin/medical/MedicalAdminClient'
import { getMedicalAdminData } from '@/lib/medical-admin-data'

export default async function MedicalPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; apparatus?: string; compartment?: string }>
}) {
  const { mode: requestedMode, apparatus: restockApparatusId, compartment: restockCompartmentId } = await searchParams
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect(`/select-department?next=${encodeURIComponent(await getCurrentPath())}`)
  if (!ctx.departmentId) redirect('/dashboard')
  const me = { id: ctx.personnelId, is_sys_admin: ctx.isSysAdmin }

  // Module gate — all dept members can access if module is enabled
  const { data: deptRow } = await adminClient.from('departments').select('module_medical').eq('id', ctx.departmentId).single()
  if (!deptRow?.module_medical && !ctx.isSysAdmin) redirect('/dashboard')

  const medicalPermissions = await getPermissionSnapshot(ctx)
  const isAdmin = medicalPermissions.manage_medical_supply_setup
  const isOfficerOrAbove = medicalPermissions.manage_medical_inventory
  const department_id = ctx.departmentId

  // Restock a truck from storage (reached from the truck's "Restock from storage" button).
  if (requestedMode === 'restock' && restockApparatusId) {
    const { data: app } = await adminClient.from('apparatus')
      .select('id, unit_number, apparatus_name, department_id').eq('id', restockApparatusId).single()
    if (!app || app.department_id !== department_id) redirect('/equipment')

    const [{ data: truckRooms }, { data: srcRooms }] = await Promise.all([
      adminClient.from('medical_storerooms').select('id, name, container_kind, compartment_id')
        .eq('apparatus_id', app.id).eq('active', true).in('container_kind', ['compartment_storage', 'bag']),
      adminClient.from('medical_storerooms').select('id, name')
        .eq('department_id', department_id).eq('active', true).eq('container_kind', 'storeroom').order('name'),
    ])
    const roomIds = [...(truckRooms ?? []), ...(srcRooms ?? [])].map(r => r.id)
    const { data: inv } = roomIds.length > 0
      ? await adminClient.from('medical_storeroom_inventory').select('id, storeroom_id, supply_type_id, par_level').in('storeroom_id', roomIds)
      : { data: [] as { id: string; storeroom_id: string; supply_type_id: string; par_level: number }[] }
    const invIds = (inv ?? []).map(i => i.id)
    const typeIds = [...new Set((inv ?? []).map(i => i.supply_type_id))]
    const [{ data: lots }, { data: types }] = await Promise.all([
      invIds.length > 0
        ? adminClient.from('medical_stock_lots').select('storeroom_inventory_id, quantity_remaining').in('storeroom_inventory_id', invIds).eq('active', true).gt('quantity_remaining', 0)
        : Promise.resolve({ data: [] as { storeroom_inventory_id: string; quantity_remaining: number }[] }),
      typeIds.length > 0
        ? adminClient.from('medical_supply_types').select('id, name, unit_of_measure, is_controlled').in('id', typeIds)
        : Promise.resolve({ data: [] as { id: string; name: string; unit_of_measure: string; is_controlled: boolean }[] }),
    ])
    const onHand = new Map<string, number>()
    for (const l of lots ?? []) onHand.set(l.storeroom_inventory_id, (onHand.get(l.storeroom_inventory_id) ?? 0) + l.quantity_remaining)
    const typeById = Object.fromEntries((types ?? []).map(t => [t.id, t]))
    // ?compartment= scopes the restock to one compartment (its loose storage and the bags in it).
    const scopedRooms = (truckRooms ?? []).filter(r => !restockCompartmentId || r.compartment_id === restockCompartmentId)
    const truckRoomById = Object.fromEntries(scopedRooms.map(r => [r.id, r]))
    const scopeLabel = restockCompartmentId ? (scopedRooms.find(r => r.container_kind === 'compartment_storage')?.name ?? 'this compartment') : null

    const lines = (inv ?? []).filter(i => truckRoomById[i.storeroom_id] && typeById[i.supply_type_id]).map(i => {
      const room = truckRoomById[i.storeroom_id]
      const t = typeById[i.supply_type_id]
      return {
        destination_storeroom_id: i.storeroom_id,
        location: room.container_kind === 'bag' ? `Bag: ${room.name}` : room.name,
        supply_type_id: i.supply_type_id, supply_name: t.name, unit: t.unit_of_measure, is_controlled: t.is_controlled,
        on_hand: onHand.get(i.id) ?? 0, par: i.par_level,
      }
    })
    const srcRoomIds = new Set((srcRooms ?? []).map(r => r.id))
    const availability: Record<string, Record<string, number>> = {}
    for (const i of inv ?? []) {
      if (!srcRoomIds.has(i.storeroom_id)) continue
      ;(availability[i.storeroom_id] ??= {})[i.supply_type_id] = onHand.get(i.id) ?? 0
    }

    return (
      <RestockClient apparatus={{ id: app.id, unit_number: app.unit_number, apparatus_name: app.apparatus_name }} scopeLabel={scopeLabel}
        lines={lines} storerooms={srcRooms ?? []} availability={availability} canMoveControlled={isOfficerOrAbove} />
    )
  }

  // One Medical page, function switched by mode buttons. Medication Types and Bags are setup modes
  // (manage_medical_supply_setup); everyone else always gets Storerooms.
  const mode: MedicalMode = isAdmin && (requestedMode === 'types' || requestedMode === 'bags') ? requestedMode : 'storerooms'
  if (mode !== 'storerooms') {
    const data = await getMedicalAdminData(adminClient, department_id)
    return (
      <div className="max-w-2xl">
        <div className="mb-5">
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Medical</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {mode === 'types' ? 'Your department\'s medication and supply types' : 'Bag templates and where each bag is deployed'}
          </p>
        </div>
        <MedicalModeBar mode={mode} showSetup={isAdmin} />
        {mode === 'bags' && (
          <HelpText className="mb-4">
            The bag types here (Trauma Box, Med Bag, and so on) started as premade starters, but they are yours to
            change. Tap Manage on a bag type to edit its medications, equipment, and any bags nested inside it — for
            example, remove the Med Bag from the Trauma Box if yours doesn't carry one. Changes apply to bags you add
            afterwards; use "Bags already deployed" below a bag type to bring bags already on trucks up to date. To put
            a bag in a truck compartment, tap "+ Add Bag" on the compartment of the apparatus page.
          </HelpText>
        )}
        <MedicalAdminClient {...data} departmentId={department_id} fixedTab={mode === 'types' ? 'supplies' : 'templates'} />
      </div>
    )
  }

  // Round 1: everything that only needs the department id, in one trip. Station storerooms are
  // the 'storeroom'-kind rows of the all-storerooms list, so that list is fetched once and split.
  const [
    { data: allDeptStorerooms }, { data: catalogTypes }, { data: deptStations },
    { data: deptPersonnel }, { data: allApparatusList },
  ] = await Promise.all([
    // All storerooms (station + apparatus bags + compartments) — also the transfer destinations
    adminClient.from('medical_storerooms').select('id, name, station_id, apparatus_id, compartment_id, container_kind')
      .eq('department_id', department_id).eq('active', true).order('name'),
    // For stocking storerooms and creating new ones right on this page (admins): the department's
    // full medication catalog and all of its stations.
    isAdmin
      ? adminClient.from('medical_supply_types').select('id, name, unit_of_measure').eq('department_id', department_id).eq('active', true).order('name')
      : Promise.resolve({ data: [] as { id: string; name: string; unit_of_measure: string }[] }),
    isAdmin
      ? adminClient.from('stations').select('id, station_name, station_number').eq('department_id', department_id).eq('active', true).order('station_number')
      : Promise.resolve({ data: [] as { id: string; station_name: string; station_number: string }[] }),
    // Personnel for signer dropdowns
    adminClient.from('department_personnel').select('personnel_id, personnel(id, first_name, last_name)')
      .eq('department_id', department_id).eq('active', true),
    // All dept apparatus, for the compartment transfer destination picker
    adminClient.from('apparatus').select('id, unit_number, apparatus_types(name)')
      .eq('department_id', department_id).eq('active', true).order('unit_number'),
  ])

  // Station storerooms (displayed on this page)
  const storerooms = (allDeptStorerooms ?? [])
    .filter(s => s.container_kind === 'storeroom')
    .map(({ container_kind: _kind, ...rest }) => rest)
  const storeroomIds = storerooms.map(s => s.id)
  const storeroomIdSet = new Set(storeroomIds)
  const allStoreroomIds = (allDeptStorerooms ?? []).map(s => s.id)

  const personnel = (deptPersonnel ?? [])
    .map(dp => ({
      id: (dp.personnel as any)?.id ?? dp.personnel_id,
      name: [(dp.personnel as any)?.first_name, (dp.personnel as any)?.last_name].filter(Boolean).join(' '),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const allApparatus = (allApparatusList ?? []).map(a => ({
    id: a.id,
    unit_number: a.unit_number,
    type_name: (a.apparatus_types as any)?.name ?? null,
  }))
  const allApparatusIds = allApparatus.map(a => a.id)
  const stationIds = [...new Set(storerooms.map(s => s.station_id).filter(Boolean))] as string[]
  // Apparatus for display (apparatus-linked storerooms — use allDeptStorerooms so bags show unit numbers)
  const apparatusIds = [...new Set((allDeptStorerooms ?? []).map(s => s.apparatus_id).filter(Boolean))] as string[]
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() // history: last 90 days

  // Round 2: inventory for every storeroom, plus everything else that needs only round 1's ids
  const loadCompartments = async () => {
    const { data: compLinks } = allApparatusIds.length > 0
      ? await adminClient.from('apparatus_compartments').select('id, apparatus_id, compartment_name_id').in('apparatus_id', allApparatusIds).eq('active', true)
      : { data: [] as { id: string; apparatus_id: string; compartment_name_id: string }[] }
    const compNameIds = [...new Set((compLinks ?? []).map(c => c.compartment_name_id).filter(Boolean))]
    const { data: compNameRows } = compNameIds.length > 0
      ? await adminClient.from('compartment_names').select('id, compartment_code, compartment_name, sort_order').in('id', compNameIds)
      : { data: [] as { id: string; compartment_code: string; compartment_name: string | null; sort_order: number | null }[] }
    return { compLinks, compNameRows }
  }
  const [{ data: allInventory }, { data: stations }, { data: apparatusList }, { compLinks, compNameRows }, { data: transactions }] = await Promise.all([
    // All-storeroom inventory — also validates transfer destinations (bags + compartments)
    allStoreroomIds.length > 0
      ? adminClient.from('medical_storeroom_inventory').select('id, storeroom_id, supply_type_id, par_level').in('storeroom_id', allStoreroomIds)
      : Promise.resolve({ data: [] as { id: string; storeroom_id: string; supply_type_id: string; par_level: number }[] }),
    stationIds.length > 0
      ? adminClient.from('stations').select('id, station_name, station_number').in('id', stationIds)
      : Promise.resolve({ data: [] as { id: string; station_name: string; station_number: string }[] }),
    apparatusIds.length > 0
      ? adminClient.from('apparatus').select('id, unit_number, apparatus_types(name)').in('id', apparatusIds)
      : Promise.resolve({ data: [] as { id: string; unit_number: string; apparatus_types: unknown }[] }),
    loadCompartments(),
    // Transaction history — last 90 days
    storeroomIds.length > 0
      ? adminClient.from('medical_stock_transactions')
          .select('id, storeroom_id, supply_type_id, supply_type_name, lot_id, transaction_type, quantity, administered_amount, waste_amount, volume_unit, administered_dose, waste_dose, dose_unit, performed_by, signer_1_id, signer_2_id, notes, created_at')
          .in('storeroom_id', storeroomIds).gte('created_at', since).order('created_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [] as any[] }),
  ])

  // Inventory (supply types per station storeroom — for display) is the station slice of allInventory
  const inventory = (allInventory ?? []).filter(i => storeroomIdSet.has(i.storeroom_id))
  const inventoryIds = inventory.map(i => i.id)
  const supplyTypeIds = [...new Set(inventory.map(i => i.supply_type_id))]
  const txLotIds = [...new Set((transactions ?? []).map((t: any) => t.lot_id).filter(Boolean))] as string[]

  // Round 3: the details of that inventory
  const [{ data: supplyTypes }, { data: lots }, { data: reorderRequests }, { data: txLots }] = await Promise.all([
    supplyTypeIds.length > 0
      ? adminClient.from('medical_supply_types').select('id, name, category, unit_of_measure, is_controlled, tracks_expiration, required_signatures').in('id', supplyTypeIds)
      : Promise.resolve({ data: [] as any[] }),
    // Lots (active stock)
    inventoryIds.length > 0
      ? adminClient.from('medical_stock_lots')
          .select('id, storeroom_inventory_id, lot_number, expiration_date, quantity_received, quantity_remaining, received_date, concentration_amount, concentration_unit, volume_per_unit, volume_unit')
          .in('storeroom_inventory_id', inventoryIds).eq('active', true).gt('quantity_remaining', 0)
          .order('expiration_date', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] as any[] }),
    // Pending reorder requests for this dept's storerooms
    inventoryIds.length > 0
      ? adminClient.from('medical_reorder_requests').select('id, storeroom_inventory_id, status').in('storeroom_inventory_id', inventoryIds).eq('status', 'pending')
      : Promise.resolve({ data: [] as { id: string; storeroom_inventory_id: string; status: string }[] }),
    // Lot number lookup for history (include inactive lots referenced in transactions)
    txLotIds.length > 0
      ? adminClient.from('medical_stock_lots').select('id, lot_number').in('id', txLotIds)
      : Promise.resolve({ data: [] as { id: string; lot_number: string | null }[] }),
  ])
  const pendingReorderIds = new Set((reorderRequests ?? []).map(r => r.storeroom_inventory_id))
  const lotNumberMap = Object.fromEntries((txLots ?? []).map(l => [l.id, l.lot_number]))

  // Round 4: control-numbered vials for controlled-substance lots
  const lotIds = (lots ?? []).map((l: any) => l.id)
  const { data: units } = lotIds.length > 0
    ? await adminClient.from('medical_stock_units').select('id, lot_id, control_number, status')
        .in('lot_id', lotIds).eq('status', 'available').order('created_at', { ascending: true })
    : { data: [] }

  const apparatusMap = Object.fromEntries(
    (apparatusList ?? []).map(a => [a.id, {
      unit_number: a.unit_number,
      type_name: (a.apparatus_types as any)?.name ?? null,
    }])
  )

  const compNameMap = Object.fromEntries((compNameRows ?? []).map(c => [c.id, c]))
  const allCompartments = (compLinks ?? []).map(c => ({
    id: c.id,
    apparatus_id: c.apparatus_id,
    compartment_code: compNameMap[c.compartment_name_id]?.compartment_code ?? '—',
    compartment_name: compNameMap[c.compartment_name_id]?.compartment_name ?? null,
    sort_order: compNameMap[c.compartment_name_id]?.sort_order ?? 999,
  })).sort((a, b) => a.sort_order - b.sort_order)

  // Personnel id→name map for history display
  const personnelMap = Object.fromEntries(personnel.map(p => [p.id, p.name]))

  return (
    <MedicalStoreClient
      storerooms={storerooms ?? []}
      inventory={inventory ?? []}
      allTransferStorerooms={allDeptStorerooms ?? []}
      allTransferInventory={allInventory ?? []}
      supplyTypes={supplyTypes ?? []}
      lots={lots ?? []}
      units={units ?? []}
      personnel={personnel}
      stations={stations ?? []}
      apparatusMap={apparatusMap}
      allApparatus={allApparatus}
      allCompartments={allCompartments}
      isAdmin={isAdmin}
      isOfficerOrAbove={isOfficerOrAbove}
      myPersonnelId={me.id}
      transactions={transactions ?? []}
      lotNumberMap={lotNumberMap}
      personnelMap={personnelMap}
      pendingReorderIds={pendingReorderIds}
      departmentTimezone={ctx.departmentTimezone}
      catalogTypes={catalogTypes ?? []}
      deptStations={deptStations ?? []}
      modeBar={<MedicalModeBar mode="storerooms" showSetup={isAdmin} />}
    />
  )
}
