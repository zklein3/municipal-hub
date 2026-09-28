import type { Viewport } from 'next'
import { getPublicAgilityTestContext } from '@/app/actions/agility-tests'
import AgilityTestClient from './AgilityTestClient'

export const dynamic = 'force-dynamic'

// Same PWA/notch handling as /hose-testing/[slug] — testers add this to the
// home screen on a station tablet.
export const viewport: Viewport = {
  viewportFit: 'cover',
}

export default async function AgilityTestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { enabled, departmentName, evolutions } = await getPublicAgilityTestContext(slug)

  if (!enabled) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-bold text-zinc-900 mb-2">Physical Agility Test</h1>
          <p className="text-sm text-zinc-500">This tool isn't currently active for this department. Contact your department admin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="bg-red-800 text-white shadow">
        <div
          className="max-w-xl mx-auto"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: '1rem',
            paddingLeft: 'max(1rem, env(safe-area-inset-left))',
            paddingRight: 'max(1rem, env(safe-area-inset-right))',
          }}
        >
          <h1 className="text-lg font-bold leading-tight">Physical Agility Test</h1>
          <p className="text-red-200 text-xs">{departmentName ?? 'Department'}</p>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-6">
        <AgilityTestClient slug={slug} evolutions={evolutions ?? []} />
      </main>
    </div>
  )
}
