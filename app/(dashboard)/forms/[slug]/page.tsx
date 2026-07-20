import { redirect } from 'next/navigation'
import { getCurrentPath } from '@/lib/current-path'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import BackButton from '@/components/BackButton'

const FORM_LABELS: Record<string, { title: string; description: string }> = {
  'business-check': {
    title: 'Business Check',
    description: 'Log a business welfare or security check.',
  },
  contact: {
    title: 'Contact Form',
    description: 'Document a field contact or interview.',
  },
  'traffic-stop': {
    title: 'Traffic Stop',
    description: 'Log a traffic stop and any citation or warning issued.',
  },
}

export default async function PlaceholderFormPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.selectionPending) redirect(`/select-department?next=${encodeURIComponent(await getCurrentPath())}`)
  if (!ctx.departmentId) redirect('/dashboard')

  const form = FORM_LABELS[slug] ?? {
    title: slug.split('-').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' '),
    description: 'This form is being built for your department.',
  }

  return (
    <div className="max-w-md">
      <BackButton href="/dashboard" className="mb-4 inline-block text-sm text-zinc-500 hover:text-zinc-700" />
      <div className="rounded-xl bg-white shadow-sm border border-zinc-200 px-6 py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Coming Soon</p>
        <h1 className="text-xl font-bold text-zinc-900 mb-2">{form.title}</h1>
        <p className="text-sm text-zinc-500">{form.description}</p>
      </div>
    </div>
  )
}
