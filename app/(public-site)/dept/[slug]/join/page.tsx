import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import JoinForm from './JoinForm'

export default async function JoinPage({
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
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">Membership Interest</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{dept.name}</p>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-200 px-5 py-4 mb-6 text-sm text-blue-800">
        <p className="font-semibold mb-1">Thinking About Joining?</p>
        <p className="text-blue-700">
          Whether you&apos;re interested in firefighting, emergency medical services, or both, we&apos;d like to learn a little about you.
          This form is just the first step — there is no obligation to join by submitting it. A department representative will follow up with you.
        </p>
      </div>

      <JoinForm departmentId={dept.id} departmentName={dept.name} slug={slug} />
    </div>
  )
}
