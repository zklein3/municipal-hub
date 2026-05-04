import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import RecordRequestForm from './RecordRequestForm'

export default async function RecordRequestPage({
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
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">Records Request</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{dept.name}</p>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-200 px-5 py-4 mb-6 text-sm text-blue-800">
        <p className="font-semibold mb-1">About Records Requests</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700">
          <li>Requests are reviewed by department staff and fulfilled as permitted by law</li>
          <li>Some records may require identity verification before release</li>
          <li>Processing typically takes 5–10 business days</li>
          <li>You will be contacted at the email address you provide</li>
        </ul>
      </div>

      <RecordRequestForm departmentId={dept.id} slug={slug} />
    </div>
  )
}
