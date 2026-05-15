import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; code?: string; from?: string }>
}) {
  const { type, code, from } = await searchParams
  const fromParam = from ? `?from=${encodeURIComponent(from)}` : ''

  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login`)

  const { data: meList } = await adminClient
    .from('personnel')
    .select('id, is_sys_admin')
    .eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel')
    .select('department_id, system_role')
    .eq('personnel_id', me.id)
    .eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')

  const department_id = myDept.department_id

  if (!code) {
    return (
      <ScanError message="No QR code provided. Please scan a valid FireOps7 label." />
    )
  }

  // Try apparatus (qr_code field)
  if (!type || type === 'apparatus') {
    const { data } = await adminClient
      .from('apparatus')
      .select('id')
      .eq('qr_code', code)
      .eq('department_id', department_id)
      .limit(1)
    if (data?.[0]) redirect(`/equipment/${data[0].id}${fromParam}`)
  }

  // Try compartment (qr_code field) — verify it belongs to this dept via apparatus
  if (!type || type === 'compartment') {
    const { data: compData } = await adminClient
      .from('apparatus_compartments')
      .select('id, apparatus_id')
      .eq('qr_code', code)
      .limit(1)
    if (compData?.[0]) {
      const { data: appData } = await adminClient
        .from('apparatus')
        .select('id')
        .eq('id', compData[0].apparatus_id)
        .eq('department_id', department_id)
        .limit(1)
      if (appData?.[0]) redirect(`/inspections/run?apparatus_id=${compData[0].apparatus_id}&compartment_id=${compData[0].id}`)
    }
  }

  // Try asset (asset_tag field)
  if (!type || type === 'asset') {
    const { data } = await adminClient
      .from('item_assets')
      .select('id')
      .eq('asset_tag', code)
      .eq('department_id', department_id)
      .limit(1)
    if (data?.[0]) redirect(`/equipment/assets?search=${encodeURIComponent(code)}${from ? '&from=' + encodeURIComponent(from) : ''}`)
  }

  return (
    <ScanError
      message={`No match found for "${code}". Make sure you're scanning a FireOps7 label for your department.`}
    />
  )
}

function ScanError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="rounded-xl bg-white border border-zinc-200 shadow-sm p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-lg font-bold text-zinc-900 mb-2">QR Code Not Found</h1>
        <p className="text-sm text-zinc-500 mb-6">{message}</p>
        <Link
          href="/dashboard"
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
