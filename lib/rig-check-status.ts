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
