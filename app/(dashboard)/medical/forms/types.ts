export interface SupplyType {
  id: string; name: string; category: string; unit_of_measure: string
  is_controlled: boolean; tracks_expiration: boolean; required_signatures: number
}
export interface Lot {
  id: string; storeroom_inventory_id: string; lot_number: string | null; expiration_date: string | null
  quantity_received: number; quantity_remaining: number; received_date: string
  concentration_amount: number | null; concentration_unit: string | null
  volume_per_unit: number | null; volume_unit: string | null
}
export interface ControlUnit { id: string; lot_id: string; control_number: string; status: string }
export interface Personnel { id: string; name: string }

export const WASTE_REASONS = ['Expired', 'Damaged', 'Contaminated', 'Recalled', 'Administered / Used on Scene', 'Other']

export function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const inputCls = 'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'
