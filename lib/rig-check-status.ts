import type { SupabaseClient } from '@supabase/supabase-js'
import { formatLocalDateTime } from './format-datetime'

// The vehicle check and the inventory inspection are separate processes, but finishing one offers
// the other. These report whether the other one was already done today (department-local date).

function localDate(iso: string, timeZone: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone })
}

export type OtherCheckStatus = { doneToday: boolean; lastLabel: string | null }

function toStatus(lastAt: string | null | undefined, timeZone: string): OtherCheckStatus {
  if (!lastAt) return { doneToday: false, lastLabel: null }
  return {
    doneToday: localDate(lastAt, timeZone) === localDate(new Date().toISOString(), timeZone),
    lastLabel: formatLocalDateTime(lastAt, timeZone, { dateStyle: 'medium', timeStyle: 'short' }),
  }
}

export async function lastVehicleCheck(adminClient: SupabaseClient, apparatus_id: string, timeZone: string) {
  const { data } = await adminClient.from('vehicle_inspections')
    .select('inspected_at').eq('apparatus_id', apparatus_id)
    .order('inspected_at', { ascending: false }).limit(1)
  return toStatus(data?.[0]?.inspected_at, timeZone)
}

export async function lastInventoryInspection(adminClient: SupabaseClient, apparatus_id: string, timeZone: string) {
  const { data } = await adminClient.from('inspection_sessions')
    .select('completed_at').eq('apparatus_id', apparatus_id).eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false }).limit(1)
  return toStatus(data?.[0]?.completed_at, timeZone)
}

// Medical lines on a truck (compartments and bags in them) that are below PAR — total for the
// end-of-inspection prompt, and per compartment for the badges on the compartment list.
export async function truckRestockCount(adminClient: SupabaseClient, apparatus_id: string) {
  const empty = { total: 0, byCompartment: {} as Record<string, number> }
  const { data: rooms } = await adminClient.from('medical_storerooms').select('id, compartment_id')
    .eq('apparatus_id', apparatus_id).eq('active', true).in('container_kind', ['compartment_storage', 'bag'])
  const roomIds = (rooms ?? []).map(r => r.id)
  if (roomIds.length === 0) return empty
  const { data: inv } = await adminClient.from('medical_storeroom_inventory').select('id, storeroom_id, par_level').in('storeroom_id', roomIds)
  const invIds = (inv ?? []).map(i => i.id)
  if (invIds.length === 0) return empty
  const { data: lots } = await adminClient.from('medical_stock_lots').select('storeroom_inventory_id, quantity_remaining')
    .in('storeroom_inventory_id', invIds).eq('active', true).gt('quantity_remaining', 0)
  const onHand = new Map<string, number>()
  for (const l of lots ?? []) onHand.set(l.storeroom_inventory_id, (onHand.get(l.storeroom_inventory_id) ?? 0) + l.quantity_remaining)
  const compOf = Object.fromEntries((rooms ?? []).map(r => [r.id, r.compartment_id]))
  const below = (inv ?? []).filter(i => i.par_level > 0 && (onHand.get(i.id) ?? 0) < i.par_level)
  const byCompartment: Record<string, number> = {}
  for (const i of below) {
    const c = compOf[i.storeroom_id]
    if (c) byCompartment[c] = (byCompartment[c] ?? 0) + 1
  }
  return { total: below.length, byCompartment }
}
