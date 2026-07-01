import Link from 'next/link'

const PLANNED_FEATURES = [
  { title: 'Asset Management', description: 'Track vehicles, equipment, and infrastructure assets with maintenance history.' },
  { title: 'Work Orders', description: 'Create, assign, and close work orders with crew tracking and time logging.' },
  { title: 'Inspection Logs', description: 'Scheduled inspections for roads, bridges, utilities, and facilities.' },
  { title: 'Maintenance Scheduling', description: 'Preventive maintenance calendars with automated alerts before items are due.' },
  { title: 'Crew & Personnel', description: 'Shift scheduling, crew assignments, and certification tracking.' },
  { title: 'Reporting & Compliance', description: 'Generate operational reports for regulatory and budget review.' },
]

export default function PublicWorksComingSoon() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mr-3">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              MuniOps
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-700">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">CivicOps</span>
          </div>
          <Link
            href="/public-works/login"
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">A MuniOps Product</span>
        </div>
        <div className="mx-auto mb-6 mt-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-700 shadow-lg shadow-green-900/50">
          <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
          </svg>
        </div>
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full bg-green-700/20 border border-green-700/40 px-4 py-1.5">
          <span className="text-sm font-semibold text-green-400">Coming Soon</span>
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
          Public Works Operations,{' '}
          <span className="text-green-400">Simplified.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400 leading-relaxed">
          Asset management, work orders, maintenance scheduling, and crew tracking — purpose-built for public works and municipal services. Built on the same platform as FireOps7.
        </p>
        <div className="mt-10">
          <a
            href="mailto:zklein3@gmail.com?subject=CivicOps Interest"
            className="rounded-lg bg-green-700 px-8 py-3 text-base font-semibold text-white hover:bg-green-600 transition-colors shadow-lg shadow-green-900/30"
          >
            Express Interest
          </a>
        </div>
      </section>

      {/* Planned features */}
      <section className="border-t border-zinc-800 bg-zinc-900">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">What&apos;s planned</h2>
            <p className="mt-3 text-zinc-400">Core workflows in development for public works departments.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PLANNED_FEATURES.map(f => (
              <div key={f.title} className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 opacity-80">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-green-700/20 text-green-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-sm font-semibold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-700">
              <span className="text-xs font-bold text-white">CO</span>
            </div>
            <span className="text-sm font-semibold text-zinc-400">CivicOps</span>
            <span className="text-zinc-700">·</span>
            <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">MuniOps</Link>
          </div>
          <p className="text-xs text-zinc-600">Built for the people who keep communities running. &copy; {new Date().getFullYear()} MuniOps.</p>
          <a href="mailto:zklein3@gmail.com" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            zklein3@gmail.com
          </a>
        </div>
      </footer>

    </div>
  )
}
