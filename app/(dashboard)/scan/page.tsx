import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import Link from 'next/link'

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; code?: string; from?: string }>
}) {
  const { type, code, from } = await searchParams
  const fromParam = from ? `?from=${encodeURIComponent(from)}` : ''

  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) {
    const scanPath = `/scan?${new URLSearchParams({ ...(type ? { type } : {}), ...(code ? { code } : {}) }).toString()}`
    redirect(`/login?next=${encodeURIComponent(scanPath)}`)
  }
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect('/select-department')
  if (!ctx.departmentId) redirect('/dashboard')

  const department_id = ctx.departmentId

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

  // Try asset (asset_tag field) — go to asset inspection if templates exist, otherwise detail page
  if (!type || type === 'asset') {
    const { data: assetData } = await adminClient
      .from('item_assets')
      .select('id, item_id')
      .eq('asset_tag', code)
      .eq('department_id', department_id)
      .limit(1)
    if (assetData?.[0]) {
      const asset = assetData[0]
      // Check if this item type has inspection templates
      const { data: templates } = await adminClient
        .from('item_inspection_templates')
        .select('id')
        .eq('item_id', asset.item_id)
        .eq('active', true)
        .limit(1)
      if (templates && templates.length > 0) {
        redirect(`/inspections/asset/${asset.id}`)
      }
      // No templates — go to service log / detail page
      redirect(`/equipment/assets/${asset.id}`)
    }
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
