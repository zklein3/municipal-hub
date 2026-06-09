import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import FeedbackForm from './FeedbackForm'

export default async function FeedbackPage({
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
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">Feedback &amp; Issues</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{dept.name}</p>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-200 px-5 py-4 mb-6 text-sm text-blue-800">
        <p>
          Use this form to share feedback about the department or report a problem with this website.
          For burn permits or records requests, use those forms instead. For emergencies, call 911.
        </p>
      </div>

      <FeedbackForm departmentId={dept.id} slug={slug} />
    </div>
  )
}
