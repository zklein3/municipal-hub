import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import RequestAccessModal from '@/app/components/RequestAccessModal'

const PRODUCTS = [
  {
    name: 'FireOps7',
    category: 'Fire Departments',
    description: 'Incident reporting, NERIS compliance, ISO documentation, personnel management, training records, and equipment tracking — built for fire departments.',
    accent: 'red',
    href: '/fire',
    available: true,
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
      </svg>
    ),
  },
  {
    name: 'LawOps',
    category: 'Law Enforcement',
    description: 'Contact reports, shift management, personnel tracking, training certifications, and internal documentation — purpose-built for law enforcement agencies.',
    accent: 'blue',
    href: '/police',
    available: false,
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    name: 'CivicOps',
    category: 'Public Works',
    description: 'Asset management, work orders, inspection logs, maintenance scheduling, and crew tracking — designed for public works and municipal services.',
    accent: 'green',
    href: '/public-works',
    available: false,
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
]

const accentClasses = {
  red: {
    icon: 'bg-red-700/20 text-red-400',
    border: 'border-red-800/40 hover:border-red-700/60',
    badge: 'bg-red-700 text-white',
    button: 'bg-red-700 hover:bg-red-600 text-white shadow-red-900/30',
  },
  blue: {
    icon: 'bg-blue-800/20 text-blue-400',
    border: 'border-blue-800/40',
    badge: 'bg-blue-800/30 text-blue-400 border border-blue-700/40',
    button: 'bg-zinc-800 text-zinc-500 cursor-default',
  },
  green: {
    icon: 'bg-green-800/20 text-green-400',
    border: 'border-green-800/40',
    badge: 'bg-green-800/30 text-green-400 border border-green-700/40',
    button: 'bg-zinc-800 text-zinc-500 cursor-default',
  },
}

export default async function MuniOpsHub() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-800">
              <span className="text-sm font-bold text-white">MO</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">MuniOps</span>
          </div>
          <Link
            href="/login"
            className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-800 shadow-lg shadow-blue-900/50">
          <span className="text-3xl font-bold text-white">MO</span>
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
          Municipal Operations,{' '}
          <span className="text-blue-400">Simplified.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400 leading-relaxed">
          Purpose-built operations software for fire departments, law enforcement, and public works — all on one platform.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-blue-800 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/30"
          >
            Sign In to Your Department
          </Link>
          <RequestAccessModal />
        </div>
      </section>

      {/* Products */}
      <section className="border-t border-zinc-800 bg-zinc-900">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">Choose your department</h2>
            <p className="mt-3 text-zinc-400">Each product is purpose-built for its department type — same platform, tailored workflows.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {PRODUCTS.map(product => {
              const accent = accentClasses[product.accent as keyof typeof accentClasses]
              return (
                <div
                  key={product.name}
                  className={`relative rounded-xl border bg-zinc-950 p-8 flex flex-col transition-colors ${accent.border} ${product.available ? 'hover:bg-zinc-900' : ''}`}
                >
                  {!product.available && (
                    <span className={`absolute top-4 right-4 rounded-full px-2.5 py-0.5 text-xs font-semibold ${accent.badge}`}>
                      Coming Soon
                    </span>
                  )}
                  <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-xl ${accent.icon}`}>
                    {product.icon}
                  </div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-500">{product.category}</p>
                  <h3 className="mb-3 text-xl font-bold text-white">{product.name}</h3>
                  <p className="mb-8 flex-1 text-sm leading-relaxed text-zinc-400">{product.description}</p>
                  {product.available ? (
                    <Link
                      href={product.href}
                      className={`inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors shadow-lg ${accent.button}`}
                    >
                      Learn More
                      <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                  ) : (
                    <Link
                      href={product.href}
                      className={`inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold ${accent.button}`}
                    >
                      Learn More
                      <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Value prop strip */}
      <section className="border-t border-zinc-800 bg-black">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-8 sm:grid-cols-3 text-center">
            <div>
              <p className="text-3xl font-bold text-blue-400 mb-2">One Platform</p>
              <p className="text-sm text-zinc-400">Shared infrastructure for every department type — single login, unified admin, consistent experience.</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-400 mb-2">Built for Ops</p>
              <p className="text-sm text-zinc-400">Not adapted from generic software. Every workflow is designed around how municipal departments actually operate.</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-400 mb-2">No IT Required</p>
              <p className="text-sm text-zinc-400">Cloud-hosted, zero maintenance, accessible from any device. Your department is up and running in minutes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-800">
              <span className="text-xs font-bold text-white">MO</span>
            </div>
            <span className="text-sm font-semibold text-zinc-400">MuniOps</span>
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
