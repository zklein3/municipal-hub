import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import InboxClient from './InboxClient'

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient
    .from('personnel').select('id, first_name, last_name, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]

  // Sys admin has no dept record — allow through with signatures-only view
  if (!myDept && !me.is_sys_admin) redirect('/dashboard')

  const department_id = myDept?.department_id ?? null
  const isOfficerOrAbove = me.is_sys_admin || myDept?.system_role === 'admin' || myDept?.system_role === 'officer'

  // Pending signatures — all members (incident + event)
  const [{ data: pendingIncidentSigs }, { data: pendingEventSigs }] = await Promise.all([
    adminClient.from('incident_signatures').select('id, incident_id, created_at')
      .eq('personnel_id', me.id).is('signed_at', null).order('created_at', { ascending: false }),
    adminClient.from('event_attendance_signatures').select('id, instance_id, created_at')
      .eq('personnel_id', me.id).is('signed_at', null).order('created_at', { ascending: false }),
  ])

  let signatureRows: any[] = []

  if ((pendingIncidentSigs ?? []).length > 0) {
    const incidentIds = (pendingIncidentSigs ?? []).map(s => s.incident_id)
    const { data: sigIncidents } = await adminClient
      .from('incidents')
      .select('id, incident_number, incident_date, incident_type, address, city, state')
      .in('id', incidentIds)
    const incidentMap = Object.fromEntries((sigIncidents ?? []).map(i => [i.id, i]))
    signatureRows.push(...(pendingIncidentSigs ?? []).map(s => ({
      type: 'incident' as const,
      sig_id: s.id,
      incident_id: s.incident_id,
      created_at: s.created_at,
      incident: incidentMap[s.incident_id] ?? null,
    })))
  }

  if ((pendingEventSigs ?? []).length > 0) {
    const instanceIds = (pendingEventSigs ?? []).map(s => s.instance_id)
    const { data: eventInstances } = await adminClient
      .from('event_instances')
      .select('id, event_date, location, series_id')
      .in('id', instanceIds)
    const seriesIds = [...new Set((eventInstances ?? []).map(i => i.series_id))]
    const { data: seriesData } = seriesIds.length > 0
      ? await adminClient.from('event_series').select('id, title, event_type').in('id', seriesIds)
      : { data: [] }
    const seriesMap = Object.fromEntries((seriesData ?? []).map(s => [s.id, s]))
    const instanceMap = Object.fromEntries((eventInstances ?? []).map(i => [i.id, i]))
    signatureRows.push(...(pendingEventSigs ?? []).map(s => {
      const inst = instanceMap[s.instance_id]
      const series = inst ? seriesMap[inst.series_id] : null
      return {
        type: 'event' as const,
        sig_id: s.id,
        instance_id: s.instance_id,
        created_at: s.created_at,
        event: inst && series ? {
          title: series.title,
          event_type: series.event_type,
          event_date: inst.event_date,
          location: inst.location,
        } : null,
      }
    }))
  }

  // Sort combined list by created_at desc
  signatureRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Officer+ data
  let permits: any[] = []
  let requestsRaw: any[] = []
  let deptConfig: any = null
  let restockRequests: any[] = []
  let expiredLots: { supply_name: string; storeroom_name: string; quantity_remaining: number; expiration_date: string; lot_number: string | null }[] = []

  if (isOfficerOrAbove && department_id) {
    const [deptRes, permitsRes, recordsRes] = await Promise.all([
      adminClient.from('departments').select('name, burn_permit_county_info, burn_permit_restrictions, module_medical').eq('id', department_id).single(),
      adminClient.from('burn_permits')
        .select('id, confirmation_code, contact_name, contact_email, contact_phone, burn_address, burn_date, burn_description, status, reviewer_notes, permit_expiry_date, issued_date, approved_by_personnel_id, officer_signed_at, created_at')
        .eq('department_id', department_id).order('created_at', { ascending: false }),
      adminClient.from('public_record_requests')
        .select('id, confirmation_code, contact_name, contact_email, contact_phone, request_type, description, incident_date, incident_address, status, reviewer_notes, created_at')
        .eq('department_id', department_id).order('created_at', { ascending: false }),
    ])
    deptConfig = deptRes.data

    // Reorder requests + expired lots (medical module)
    if (deptConfig?.module_medical) {
      const today = new Date().toISOString().split('T')[0]

      const [{ data: reorderRaw }, { data: expiredLotsRaw }] = await Promise.all([
        adminClient
          .from('medical_reorder_requests')
          .select('id, storeroom_inventory_id, requested_by, notes, created_at')
          .eq('department_id', department_id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        adminClient
          .from('medical_stock_lots')
          .select('id, lot_number, expiration_date, quantity_remaining, storeroom_inventory_id')
          .eq('department_id', department_id)
          .eq('active', true)
          .gt('quantity_remaining', 0)
          .lt('expiration_date', today)
          .order('expiration_date'),
      ])

      if (reorderRaw && reorderRaw.length > 0) {
        const invIds = reorderRaw.map((r: any) => r.storeroom_inventory_id)
        const [{ data: invRows }, { data: requesterRows }] = await Promise.all([
          adminClient.from('medical_storeroom_inventory').select('id, storeroom_id, supply_type_id').in('id', invIds),
          adminClient.from('personnel').select('id, first_name, last_name')
            .in('id', reorderRaw.map((r: any) => r.requested_by).filter(Boolean)),
        ])
        const srIds = [...new Set((invRows ?? []).map((i: any) => i.storeroom_id))]
        const supplyIds = [...new Set((invRows ?? []).map((i: any) => i.supply_type_id))]
        const [{ data: srRows }, { data: supplyRows }] = await Promise.all([
          adminClient.from('medical_storerooms').select('id, name').in('id', srIds),
          adminClient.from('medical_supply_types').select('id, name').in('id', supplyIds),
        ])
        const invMap = Object.fromEntries((invRows ?? []).map((i: any) => [i.id, i]))
        const srMap = Object.fromEntries((srRows ?? []).map((s: any) => [s.id, s.name]))
        const supMap = Object.fromEntries((supplyRows ?? []).map((s: any) => [s.id, s.name]))
        const reqMap = Object.fromEntries((requesterRows ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`.trim()]))
        restockRequests = reorderRaw.map((r: any) => {
          const inv = invMap[r.storeroom_inventory_id]
          return {
            id: r.id,
            supply_name: inv ? (supMap[inv.supply_type_id] ?? '—') : '—',
            storeroom_name: inv ? (srMap[inv.storeroom_id] ?? '—') : '—',
            requested_by_name: r.requested_by ? (reqMap[r.requested_by] ?? null) : null,
            notes: r.notes,
            created_at: r.created_at,
          }
        })
      }

      if (expiredLotsRaw && expiredLotsRaw.length > 0) {
        const invIds = [...new Set(expiredLotsRaw.map((l: any) => l.storeroom_inventory_id))]
        const { data: invRows } = await adminClient
          .from('medical_storeroom_inventory').select('id, storeroom_id, supply_type_id').in('id', invIds)
        const srIds = [...new Set((invRows ?? []).map((i: any) => i.storeroom_id))]
        const supIds = [...new Set((invRows ?? []).map((i: any) => i.supply_type_id))]
        const [{ data: srRows }, { data: supRows }] = await Promise.all([
          adminClient.from('medical_storerooms').select('id, name').in('id', srIds),
          adminClient.from('medical_supply_types').select('id, name').in('id', supIds),
        ])
        const invMap = Object.fromEntries((invRows ?? []).map((i: any) => [i.id, i]))
        const srMap = Object.fromEntries((srRows ?? []).map((s: any) => [s.id, s.name]))
        const supMap = Object.fromEntries((supRows ?? []).map((s: any) => [s.id, s.name]))
        expiredLots = expiredLotsRaw.map((l: any) => {
          const inv = invMap[l.storeroom_inventory_id]
          return {
            supply_name: inv ? (supMap[inv.supply_type_id] ?? '—') : '—',
            storeroom_name: inv ? (srMap[inv.storeroom_id] ?? '—') : '—',
            quantity_remaining: l.quantity_remaining,
            expiration_date: l.expiration_date,
            lot_number: l.lot_number,
          }
        })
      }
    }
    const permitsRaw = permitsRes.data ?? []
    requestsRaw = recordsRes.data ?? []

    const approverIds = [...new Set(permitsRaw.map((p: any) => p.approved_by_personnel_id).filter(Boolean))]
    const { data: approverData } = approverIds.length > 0
      ? await adminClient.from('personnel').select('id, first_name, last_name').in('id', approverIds)
      : { data: [] }
    const approverMap = Object.fromEntries(
      (approverData ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`])
    )
    permits = permitsRaw.map((p: any) => ({
      ...p,
      approved_by_name: p.approved_by_personnel_id ? (approverMap[p.approved_by_personnel_id] ?? null) : null,
    }))
  }

  const moduleMedical = deptConfig?.module_medical ?? false
  const validTabs = ['permits', 'records', 'signatures', ...(moduleMedical && isOfficerOrAbove ? ['restock'] : [])]
  const initialTab = validTabs.includes(tab ?? '') ? tab! : (isOfficerOrAbove ? 'permits' : 'signatures')

  return (
    <InboxClient
      permits={permits}
      requests={requestsRaw}
      signatureRows={signatureRows}
      restockRequests={restockRequests}
      expiredLots={expiredLots}
      memberName={`${me.first_name} ${me.last_name}`.trim()}
      initialTab={initialTab as any}
      isOfficerOrAbove={isOfficerOrAbove}
      moduleMedical={moduleMedical}
      deptName={deptConfig?.name ?? null}
      burnPermitCountyInfo={deptConfig?.burn_permit_county_info ?? null}
      burnPermitRestrictions={deptConfig?.burn_permit_restrictions ?? null}
    />
  )
}
