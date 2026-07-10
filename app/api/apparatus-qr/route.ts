import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const apparatusId = req.nextUrl.searchParams.get('apparatus_id')
  if (!apparatusId) return NextResponse.json({ error: 'apparatus_id required' }, { status: 400 })

  const ctx = await getCurrentDepartmentContext()
  if (!ctx?.departmentId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()

  const { data: apparatus } = await admin
    .from('apparatus')
    .select('id, unit_number, apparatus_name, qr_code')
    .eq('id', apparatusId)
    .eq('department_id', ctx.departmentId)
    .single()

  if (!apparatus) return NextResponse.json({ error: 'Apparatus not found' }, { status: 404 })
  if (!apparatus.qr_code) return NextResponse.json({ error: 'This apparatus has no QR code set. Add one on the apparatus edit page first.' }, { status: 400 })

  return NextResponse.json({ apparatus })
}
