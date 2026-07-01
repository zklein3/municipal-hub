import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get('item_id')
  if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  const ctx = await getCurrentDepartmentContext()
  if (!ctx?.departmentId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()

  const { data: item } = await admin
    .from('items')
    .select('id, item_name')
    .eq('id', itemId)
    .single()

  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const { data: assets } = await admin
    .from('item_assets')
    .select('id, asset_tag, serial_number')
    .eq('item_id', itemId)
    .eq('department_id', ctx.departmentId)
    .eq('active', true)
    .order('asset_tag')

  return NextResponse.json({ item_name: item.item_name, assets: assets ?? [] })
}
