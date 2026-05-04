import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import BurnPermitForm from './BurnPermitForm'

export default async function BurnPermitPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const adminClient = createAdminClient()

  const { data: deptList } = await adminClient
    .from('departments')
    .select('id, name, public_site_enabled')
    .eq('public_slug', slug)
    .limit(1)

  const dept = deptList?.[0]
  if (!dept || !dept.public_site_enabled) notFound()

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <a href={`/dept/${slug}`} className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
          ← Back
        </a>
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">Burn Permit Request</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{dept.name}</p>
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 mb-6 text-sm text-amber-800">
        <p className="font-semibold mb-1">Before you burn:</p>
        <ul className="list-disc list-inside space-y-0.5 text-amber-700">
          <li>Check local and state burn ban status before your burn date</li>
          <li>Keep a water source and hand tools nearby at all times</li>
          <li>Never leave a fire unattended</li>
          <li>A department representative may contact you to confirm details</li>
        </ul>
      </div>

      <BurnPermitForm departmentId={dept.id} slug={slug} />
    </div>
  )
}
