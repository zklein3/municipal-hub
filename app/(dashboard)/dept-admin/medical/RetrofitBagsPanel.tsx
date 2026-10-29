'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { previewBagRetrofit, applyBagRetrofit, type BagRetrofitPlan } from '@/app/actions/medical'

// "Bags already deployed" — a bag copies its template's contents when it's deployed, so a bag
// deployed before the template gained contents doesn't have them. This shows exactly what each bag
// is missing and adds only that (never touching stock, PAR or quantities already set).
export default function RetrofitBagsPanel() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [plans, setPlans] = useState<BagRetrofitPlan[] | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function check() {
    setBusy(true); setError(null); setDone(null)
    const r = await previewBagRetrofit()
    setBusy(false)
    if ('error' in r && r.error) { setError(r.error); return }
    setPlans(r.plans ?? []); setSkipped(r.skippedIndependent ?? 0)
  }

  async function apply() {
    setBusy(true); setError(null)
    const r = await applyBagRetrofit()
    setBusy(false)
    if ('error' in r && r.error) { setError(r.error); return }
    setPlans(null)
    setDone(`Updated ${r.bagsUpdated} bag${r.bagsUpdated === 1 ? '' : 's'}: added ${r.medications} medication${r.medications === 1 ? '' : 's'}, ${r.equipment} equipment item${r.equipment === 1 ? '' : 's'} and ${r.bagsCreated} nested bag${r.bagsCreated === 1 ? '' : 's'}.`)
    router.refresh()
  }

  const total = (plans ?? []).reduce((s, p) => s + p.medications.length + p.equipment.length + p.bags.reduce((n, b) => n + b.count, 0), 0)

  return (
    <div className="mb-4 rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">Bags already deployed</p>
          <p className="text-xs text-zinc-500">
            A bag gets its template&apos;s contents when it&apos;s deployed. If you&apos;ve added to a template since, check what your deployed bags are missing.
            Only missing items are added — stock, PAR and quantities you&apos;ve set are never changed.
          </p>
        </div>
        <button onClick={check} disabled={busy}
          className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
          {busy && !plans ? 'Checking…' : 'Check deployed bags'}
        </button>
      </div>

      {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">{error}</div>}
      {done && <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 border border-green-200">{done}</div>}

      {plans && plans.length === 0 && (
        <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600 border border-zinc-200">
          Every deployed bag already has everything its template contains.
          {skipped > 0 && ` (${skipped} bag${skipped === 1 ? ' is' : 's are'} set to Independent and was skipped.)`}
        </div>
      )}

      {plans && plans.length > 0 && (
        <div className="mt-3">
          <div className="flex flex-col gap-2">
            {plans.map(p => (
              <div key={p.bag_id} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="text-sm font-semibold text-zinc-900">
                  {p.bag_name}
                  <span className="ml-2 text-xs font-normal text-zinc-500">{p.apparatus_unit ? `Unit ${p.apparatus_unit}` : 'not on a truck'} · from template “{p.template_name}”</span>
                </p>
                {p.bags.length > 0 && <p className="mt-1 text-xs text-zinc-700"><span className="font-semibold">Bags:</span> {p.bags.map(b => `${b.name}${b.count > 1 ? ` ×${b.count}` : ''}`).join(', ')}</p>}
                {p.medications.length > 0 && <p className="mt-1 text-xs text-zinc-700"><span className="font-semibold">Medications:</span> {p.medications.map(m => `${m.name} (PAR ${m.par_level})`).join(', ')}</p>}
                {p.equipment.length > 0 && <p className="mt-1 text-xs text-zinc-700"><span className="font-semibold">Equipment:</span> {p.equipment.map(e => `${e.name} ×${e.expected_qty}`).join(', ')}</p>}
              </div>
            ))}
          </div>
          {skipped > 0 && <p className="mt-2 text-xs text-zinc-400">{skipped} bag{skipped === 1 ? ' is' : 's are'} set to Independent (a custom loadout) and will be left alone.</p>}
          <div className="mt-3 flex items-center gap-3">
            <button onClick={apply} disabled={busy}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
              {busy ? 'Adding…' : `Add ${total} missing item${total === 1 ? '' : 's'} to ${plans.length} bag${plans.length === 1 ? '' : 's'}`}
            </button>
            <button onClick={() => setPlans(null)} disabled={busy} className="text-sm text-zinc-500 hover:text-zinc-700">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
