import { formatSeconds } from '@/lib/agility-test-spec'

type Evolution = {
  test_id: string
  evolution_number: number
  evolution_name: string
  time_seconds: number
  cutoff_seconds: number
  result: string
}

type Test = {
  id: string
  test_date: string
  overall_result: string
  administered_by_name: string
  stopped_at_evolution: number | null
  notes: string | null
  evolutions: Evolution[]
}

// Read-only history — "worked into a training file" per the request, kept as
// its own card rather than folded into the /training module's cert-expiration
// machinery, since a timed pass/fail evolution record doesn't fit that shape.
export default function PhysicalAgilityTestSection({ tests }: { tests: Test[] }) {
  if (tests.length === 0) return null

  return (
    <div id="agility" className="rounded-xl bg-white shadow-sm border border-zinc-200 p-6">
      <h2 className="text-base font-semibold text-zinc-900 mb-4">Physical Agility Tests</h2>
      <div className="flex flex-col gap-3">
        {tests.map(t => (
          <div key={t.id} className="rounded-lg border border-zinc-200 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-zinc-700">
                {new Date(t.test_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                t.overall_result === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {t.overall_result.toUpperCase()}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {t.evolutions.map(ev => (
                <div key={ev.evolution_number} className="flex justify-between text-xs text-zinc-500">
                  <span>{ev.evolution_number}. {ev.evolution_name}</span>
                  <span className={`font-mono ${ev.result === 'pass' ? 'text-green-700' : 'text-red-700'}`}>
                    {formatSeconds(ev.time_seconds)}
                  </span>
                </div>
              ))}
            </div>
            {t.notes && <p className="text-xs text-zinc-400 mt-1.5 italic">{t.notes}</p>}
            <p className="text-xs text-zinc-400 mt-1.5">Administered by {t.administered_by_name}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
