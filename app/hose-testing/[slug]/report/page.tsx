import type { Viewport } from 'next'
import { getPublicHoseTestingContext } from '@/app/actions/hose-testing'
import PublicReportClient from './PublicReportClient'

export const dynamic = 'force-dynamic'
export const viewport: Viewport = { viewportFit: 'cover' }

export default async function PublicHoseReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { enabled, departmentName } = await getPublicHoseTestingContext(slug)

  if (!enabled) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-bold text-zinc-900 mb-2">Hose Testing</h1>
          <p className="text-sm text-zinc-500">This tool isn&apos;t currently active for this department. Contact your department admin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="bg-red-800 text-white shadow print:hidden">
        <div
          className="max-w-3xl mx-auto"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: '1rem',
            paddingLeft: 'max(1rem, env(safe-area-inset-left))',
            paddingRight: 'max(1rem, env(safe-area-inset-right))',
          }}
        >
          <h1 className="text-lg font-bold leading-tight">Hose Testing Reports</h1>
          <p className="text-red-200 text-xs">NFPA 1962 · {departmentName ?? 'Department'}</p>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        <PublicReportClient slug={slug} />
      </main>
    </div>
  )
}
