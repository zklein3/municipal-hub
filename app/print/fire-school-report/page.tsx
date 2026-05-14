import { createAdminClient } from '@/lib/supabase/admin'
import ReportView from './ReportView'

const CYLINDER_TYPE_LABELS: Record<string, string> = {
  composite_15: 'Carbon Fiber (15yr)',
  composite_30: 'Next-Gen Composite (30yr)',
  hoop_wrapped: 'Hoop-Wrapped (15yr)',
  steel:        'Steel',
  aluminum:     'Aluminum',
}

function getStatusInfo(bottle: {
  active: boolean
  last_requal_date: string | null
  requal_interval_years: number | null
  requires_service_life: boolean | null
  manufacture_date: string | null
  service_life_years: number | null
}, today: Date): { label: string; in_spec: boolean } {
  if (!bottle.active) return { label: 'Inactive', in_spec: false }

  if (bottle.last_requal_date && bottle.requal_interval_years) {
    const expiry = new Date(bottle.last_requal_date)
    expiry.setFullYear(expiry.getFullYear() + bottle.requal_interval_years)
    if (today > expiry) return { label: 'Requal Expired', in_spec: false }
  }

  if (bottle.requires_service_life && bottle.manufacture_date && bottle.service_life_years) {
    const eol = new Date(bottle.manufacture_date)
    eol.setFullYear(eol.getFullYear() + bottle.service_life_years)
    if (today > eol) return { label: 'End of Life', in_spec: false }
  }

  return { label: 'OK', in_spec: true }
}

function calcExpiry(baseDate: string, years: number): string {
  const d = new Date(baseDate)
  d.setFullYear(d.getFullYear() + years)
  return d.toLocaleDateString()
}

export default async function FireSchoolReportPage() {
  const admin = createAdminClient()

  const [{ data: bottles }, { data: fillLogs }] = await Promise.all([
    admin.from('fire_school_bottles').select('*').order('bottle_id'),
    admin.from('fire_school_fill_logs').select('bottle_id, filled_at'),
  ])

  const fillCounts: Record<string, number> = {}
  const lastFill: Record<string, string> = {}
  for (const log of fillLogs ?? []) {
    fillCounts[log.bottle_id] = (fillCounts[log.bottle_id] ?? 0) + 1
    if (!lastFill[log.bottle_id] || log.filled_at > lastFill[log.bottle_id]) {
      lastFill[log.bottle_id] = log.filled_at
    }
  }

  const today = new Date()

  const rows = (bottles ?? [])
    .map(b => {
      const { label, in_spec } = getStatusInfo(b, today)
      return {
        bottle_id: b.bottle_id,
        department_name: b.department_name as string | null,
        type_label: b.cylinder_type ? (CYLINDER_TYPE_LABELS[b.cylinder_type] ?? b.cylinder_type) : '—',
        psi: b.psi as number | null,
        requal_expires: b.last_requal_date && b.requal_interval_years
          ? calcExpiry(b.last_requal_date, b.requal_interval_years)
          : null,
        service_life_ends: b.requires_service_life && b.manufacture_date && b.service_life_years
          ? calcExpiry(b.manufacture_date, b.service_life_years)
          : null,
        status_label: label,
        in_spec,
        fills: fillCounts[b.bottle_id] ?? 0,
        last_fill: lastFill[b.bottle_id]
          ? new Date(lastFill[b.bottle_id]).toLocaleDateString()
          : null,
      }
    })
    .sort((a, b) => {
      if (!a.in_spec && b.in_spec) return -1
      if (a.in_spec && !b.in_spec) return 1
      return a.bottle_id.localeCompare(b.bottle_id)
    })

  const generatedAt = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <ReportView
      bottles={rows}
      totalFills={fillLogs?.length ?? 0}
      generatedAt={generatedAt}
    />
  )
}
