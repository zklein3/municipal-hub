import Link from 'next/link'

const PLANNED_FEATURES = [
  { title: 'Contact Reports', description: 'Log field contacts, traffic stops, and incident reports with structured forms.' },
  { title: 'Shift Management', description: 'Schedule shifts, track overtime, and manage on-call rotations.' },
  { title: 'Personnel & Certifications', description: 'Roster management, training records, and certification tracking.' },
  { title: 'Internal Documentation', description: 'Memos, directives, and policy acknowledgements with digital signatures.' },
  { title: 'Evidence & Case Tracking', description: 'Chain of custody logs and case file management.' },
  { title: 'Use of Force Reporting', description: 'Structured forms for use of force incidents with review workflow.' },
]

export default function LawEnforcementComingSoon() {
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
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-700">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">LawOps</span>
          </div>
          <Link
            href="/login"
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 transition-colors"
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
        <div className="mx-auto mb-6 mt-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-700 shadow-lg shadow-blue-900/50">
          <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full bg-blue-700/20 border border-blue-700/40 px-4 py-1.5">
          <span className="text-sm font-semibold text-blue-400">Coming Soon</span>
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
          Law Enforcement Operations,{' '}
          <span className="text-blue-400">Simplified.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400 leading-relaxed">
          Purpose-built operations software for law enforcement agencies — contact reports, shift management, personnel tracking, and more. Built on the same platform as FireOps7.
        </p>
        <div className="mt-10">
          <a
            href="mailto:zklein3@gmail.com?subject=LawOps Interest"
            className="rounded-lg bg-blue-700 px-8 py-3 text-base font-semibold text-white hover:bg-blue-600 transition-colors shadow-lg shadow-blue-900/30"
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
            <p className="mt-3 text-zinc-400">Core workflows in development for law enforcement agencies.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PLANNED_FEATURES.map(f => (
              <div key={f.title} className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 opacity-80">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-700/20 text-blue-400">
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
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-700">
              <span className="text-xs font-bold text-white">LO</span>
            </div>
            <span className="text-sm font-semibold text-zinc-400">LawOps</span>
            <span className="text-zinc-700">·</span>
            <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">MuniOps</Link>
          </div>
          <p className="text-xs text-zinc-600">Built for the people who keep communities safe. &copy; {new Date().getFullYear()} MuniOps.</p>
          <a href="mailto:zklein3@gmail.com" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            zklein3@gmail.com
          </a>
        </div>
      </footer>

    </div>
  )
}
