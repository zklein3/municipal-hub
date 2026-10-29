import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { assignCompartmentQr } from '@/lib/preset-deploy'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const apparatusId = req.nextUrl.searchParams.get('apparatus_id')
  if (!apparatusId) return NextResponse.json({ error: 'apparatus_id required' }, { status: 400 })

  const ctx = await getCurrentDepartmentContext()
  if (!ctx?.departmentId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()

  const { data: apparatus } = await admin
    .from('apparatus')
    .select('id, unit_number, qr_code')
    .eq('id', apparatusId)
    .eq('department_id', ctx.departmentId)
    .single()

  if (!apparatus) return NextResponse.json({ error: 'Apparatus not found' }, { status: 404 })

  const { data: comps } = await admin
    .from('apparatus_compartments')
    .select('id, qr_code, compartment_name_id')
    .eq('apparatus_id', apparatusId)
    .eq('active', true)

  const nameIds = [...new Set((comps ?? []).map(c => c.compartment_name_id))]
  const { data: names } = await admin
    .from('compartment_names')
    .select('id, compartment_code, compartment_name')
    .in('id', nameIds.length ? nameIds : [''])

  const nameMap = new Map((names ?? []).map(n => [n.id, n]))

  // Compartments created without a QR code would otherwise be silently left off the sheet — give them one.
  const qrById = new Map<string, string | null>((comps ?? []).map(c => [c.id, c.qr_code]))
  for (const c of comps ?? []) {
    if (c.qr_code) continue
    const code = nameMap.get(c.compartment_name_id)?.compartment_code
    if (!code) continue
    await assignCompartmentQr(admin, c.id, `${apparatus.qr_code ?? apparatus.unit_number}-${code}`)
    const { data: fresh } = await admin.from('apparatus_compartments').select('qr_code').eq('id', c.id).single()
    qrById.set(c.id, fresh?.qr_code ?? null)
  }

  const compartments = (comps ?? [])
    .filter(c => qrById.get(c.id))
    .map(c => {
      const n = nameMap.get(c.compartment_name_id)
      return {
        id: c.id,
        qr_code: qrById.get(c.id) as string,
        compartment_code: n?.compartment_code ?? '',
        compartment_name: n?.compartment_name ?? '',
      }
    })
    .sort((a, b) => a.compartment_code.localeCompare(b.compartment_code))

  return NextResponse.json({ unit_number: apparatus.unit_number, compartments })
}
