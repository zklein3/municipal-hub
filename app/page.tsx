import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import RequestAccessModal from '@/app/components/RequestAccessModal'

const FEATURES = [
  {
    title: 'Incident Reporting',
    description: 'Log calls from dispatch to close-out. CAD run sheet import, apparatus tracking, and full incident narratives in one place.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  },
  {
    title: 'NERIS Integration',
    description: 'Submit incident data directly to the National Emergency Response Information System. Guided forms ensure compliant, complete payloads every time.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m0-3l-3-3m0 0l-3 3m3-3v11.25m6-2.25h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75" />
      </svg>
    ),
  },
  {
    title: 'Personnel & Attendance',
    description: 'Manage rosters, track event attendance, and handle excuse requests — with role-based access for members, officers, and administrators.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    title: 'Training & Certifications',
    description: 'Track training events, certifications, and expiration dates. Bulk-log attendance and auto-issue certs when training events are verified.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    ),
  },
  {
    title: 'ISO Compliance',
    description: 'Apparatus specs, pump tests, hose inventory and pressure testing, hydrant flow tests, and mutual aid agreements — all feeding a single audit-ready report.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: 'Equipment & Inspections',
    description: 'Track apparatus, tools, and medications. Schedule recurring inspections, log results, and get alerts before items lapse or expire.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
]

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-700">
              <span className="text-sm font-bold text-white">F7</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">FireOps7</span>
          </div>
          <Link
            href="/login"
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-700 shadow-lg shadow-red-900/50">
          <span className="text-3xl font-bold text-white">F7</span>
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
          Fire Department Operations,{' '}
          <span className="text-red-500">Simplified.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400 leading-relaxed">
          Incident reporting, NERIS compliance, personnel management, ISO documentation, training records, and equipment tracking — built for the people who run fire departments.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-red-700 px-8 py-3 text-base font-semibold text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-900/30"
          >
            Sign In to Your Department
          </Link>
          <RequestAccessModal />
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-zinc-800 bg-zinc-900">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">Everything your department needs</h2>
            <p className="mt-3 text-zinc-400">One platform connecting every part of department operations.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-700/20 text-red-400">
                  {f.icon}
                </div>
                <h3 className="mb-2 text-sm font-semibold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NERIS Badge */}
      <section className="border-t border-zinc-800 bg-black">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex flex-col items-center gap-10 sm:flex-row sm:items-center sm:gap-16">
            <div className="shrink-0">
              <Image
                src="/NERIS_Data_Exchange_Compatible__SealV1.png"
                alt="NERIS V1 Data Exchange Compatible"
                width={160}
                height={160}
                className="rounded-full"
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-red-500">Certified Compatibility</p>
              <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">
                NERIS V1 Data Exchange Compatible
              </h2>
              <p className="text-zinc-400 leading-relaxed max-w-xl">
                FireOps7 meets the NERIS V1 technical standards for data exchange compatibility with the National Emergency Response Information System. Submit incident reports directly from FireOps7 to NERIS — no manual re-entry, no separate portals.
              </p>
              <p className="mt-3 text-xs text-zinc-600">
                The NERIS V1 badge indicates technical compatibility only and does not imply endorsement or recommendation by NERIS or FSRI.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-700">
              <span className="text-xs font-bold text-white">F7</span>
            </div>
            <span className="text-sm font-semibold text-zinc-400">FireOps7</span>
          </div>
          <p className="text-xs text-zinc-600">Built for fire departments. &copy; {new Date().getFullYear()} FireOps7.</p>
          <a href="mailto:zklein3@gmail.com" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            zklein3@gmail.com
          </a>
        </div>
      </footer>

    </div>
  )
}
