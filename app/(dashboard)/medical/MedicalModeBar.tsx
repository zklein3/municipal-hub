'use client'

// The one Medical page switches function with these buttons instead of sending people to separate
// setup pages: Storerooms (everyone) · Medication Types · Bags (medical setup admins).

import Link from 'next/link'

export type MedicalMode = 'storerooms' | 'types' | 'bags'

export default function MedicalModeBar({ mode, showSetup }: { mode: MedicalMode; showSetup: boolean }) {
  if (!showSetup) return null
  const modes: [MedicalMode, string][] = [['storerooms', 'Storerooms'], ['types', 'Medication Types'], ['bags', 'Bags']]
  return (
    <div className="flex gap-1 bg-white rounded-xl border border-zinc-200 p-1 mb-5 w-fit">
      {modes.map(([m, label]) => (
        <Link key={m} href={m === 'storerooms' ? '/medical' : `/medical?mode=${m}`}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${mode === m ? 'bg-red-700 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}>
          {label}
        </Link>
      ))}
    </div>
  )
}
