import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function DeptPublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const adminClient = createAdminClient()

  const { data: deptList } = await adminClient
    .from('departments')
    .select('id, name, public_site_enabled, public_tagline')
    .eq('public_slug', slug)
    .limit(1)

  const dept = deptList?.[0]
  if (!dept || !dept.public_site_enabled) notFound()

  const base = `/dept/${slug}`

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Top nav */}
      <header className="bg-red-800 text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href={base} className="font-bold text-lg truncate shrink-0 hover:text-red-200 transition-colors">
              {dept.name}
            </Link>

            <nav className="hidden sm:flex items-center gap-1 text-sm font-medium">
              <Link href={base} className="px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors">
                Home
              </Link>
              <Link href={`${base}/events`} className="px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors">
                Events
              </Link>
              <Link href={`${base}/burn-permit`} className="px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors">
                Burn Permit
              </Link>
              <Link href={`${base}/records`} className="px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors">
                Records Request
              </Link>
              <Link href={`${base}/permit-status`} className="px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors">
                Permit Status
              </Link>
            </nav>

            <Link
              href="/login"
              className="shrink-0 rounded-lg border border-red-400 px-3 py-1.5 text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Member Login
            </Link>
          </div>

          {/* Mobile nav */}
          <nav className="sm:hidden flex gap-1 text-xs font-medium pb-2 overflow-x-auto">
            <Link href={base} className="shrink-0 px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors">Home</Link>
            <Link href={`${base}/events`} className="shrink-0 px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors">Events</Link>
            <Link href={`${base}/burn-permit`} className="shrink-0 px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors">Burn Permit</Link>
            <Link href={`${base}/records`} className="shrink-0 px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors">Records</Link>
            <Link href={`${base}/permit-status`} className="shrink-0 px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors">Permit Status</Link>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-400">
          <span>{dept.name}</span>
          <span>Powered by <span className="font-semibold text-zinc-500">FireOps7</span></span>
        </div>
      </footer>
    </div>
  )
}
