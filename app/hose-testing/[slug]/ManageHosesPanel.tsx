'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { editPublicHose, listHosesForManagement, setPublicHoseStatus, type ManagedHose } from '@/app/actions/hose-testing'
import { matchesHoseSearch } from '@/lib/hose-search'

type Status = 'in_service' | 'out_of_service' | 'retired'
type Filter = 'all' | 'in_service' | 'attention' | 'retired'

const STATUS_LABEL: Record<string, string> = { in_service: 'In service', out_of_service: 'Out of service', retired: 'Retired' }

// Failed = latest test failed while still in service; out of service always counts.
const needsAttention = (h: ManagedHose) =>
  h.status === 'out_of_service' || (h.status === 'in_service' && h.last_test_passed === false)

export default function ManageHosesPanel({
  slug, pinToken, hoseTypes, recentlyTestedIds, forcedIds, onForceInclude, onPinRequired, onHoseChanged,
}: {
  slug: string
  pinToken: string | null
  hoseTypes: { value: string; label: string }[]
  recentlyTestedIds: Set<string>
  forcedIds: Set<string>
  onForceInclude: (hoseId: string) => void
  onPinRequired: () => void
  // Keeps the testing list in step: a hose that is no longer in service leaves it,
  // one returned to service (or edited) is updated/added.
  onHoseChanged: (hose: { id: string; hose_identifier: string; hose_type: string; diameter_in: number; length_ft: number; status: string }) => void
}) {
  const [hoses, setHoses] = useState<ManagedHose[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Parent passes fresh function objects every render; read them through refs so
  // they never retrigger the load below.
  const pinRequiredRef = useRef(onPinRequired)
  const hoseChangedRef = useRef(onHoseChanged)
  useEffect(() => {
    pinRequiredRef.current = onPinRequired
    hoseChangedRef.current = onHoseChanged
  })

  useEffect(() => {
    let cancelled = false
    listHosesForManagement(slug, pinToken).then(res => {
      if (cancelled) return
      if ('error' in res) {
        if (res.pinRequired) pinRequiredRef.current()
        else setError(res.error)
        return
      }
      setHoses(res.hoses)
    })
    return () => { cancelled = true }
  }, [slug, pinToken])

  const counts = useMemo(() => {
    const all = hoses ?? []
    return {
      all: all.filter(h => h.status !== 'retired').length,
      in_service: all.filter(h => h.status === 'in_service').length,
      attention: all.filter(needsAttention).length,
      retired: all.filter(h => h.status === 'retired').length,
    }
  }, [hoses])

  const visible = useMemo(() => {
    const all = hoses ?? []
    const byFilter = all.filter(h =>
      filter === 'all' ? h.status !== 'retired'
      : filter === 'in_service' ? h.status === 'in_service'
      : filter === 'attention' ? needsAttention(h)
      : h.status === 'retired')
    return byFilter.filter(h => matchesHoseSearch(h.hose_identifier, search))
  }, [hoses, filter, search])

  const sizes = [...new Set(visible.map(h => h.diameter_in))].sort((a, b) => a - b)

  async function changeStatus(h: ManagedHose, status: Status, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return
    setError(null)
    setBusyId(h.id)
    const res = await setPublicHoseStatus(slug, h.id, status, pinToken)
    setBusyId(null)
    if (res?.pinRequired) { pinRequiredRef.current(); return }
    if (res?.error) { setError(res.error); return }
    setHoses(prev => (prev ?? []).map(x => (x.id === h.id ? { ...x, status } : x)))
    hoseChangedRef.current({ id: h.id, hose_identifier: h.hose_identifier, hose_type: h.hose_type, diameter_in: h.diameter_in, length_ft: h.length_ft, status })
  }

  async function handleEdit(h: ManagedHose, formData: FormData) {
    setEditError(null)
    setBusyId(h.id)
    formData.set('pin_token', pinToken ?? '')
    const res = await editPublicHose(slug, h.id, formData)
    setBusyId(null)
    if (res?.pinRequired) { pinRequiredRef.current(); return }
    if (res?.error || !res.hose) { setEditError(res?.error ?? 'Failed to update hose.'); return }
    const u = res.hose
    setHoses(prev => (prev ?? []).map(x => (x.id === h.id ? { ...x, hose_identifier: u.hose_identifier, hose_type: u.hose_type, diameter_in: Number(u.diameter_in), length_ft: u.length_ft } : x)))
    hoseChangedRef.current({ ...u, diameter_in: Number(u.diameter_in) })
    setEditingId(null)
  }

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${active ? 'bg-red-700 text-white border-red-700' : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'}`
  const input = 'rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'

  if (!hoses) {
    return <p className="mb-5 text-sm text-zinc-500">{error ?? 'Loading hoses…'}</p>
  }

  return (
    <div>
      {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>}

      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => setFilter('all')} className={chip(filter === 'all')}>All ({counts.all})</button>
        <button onClick={() => setFilter('in_service')} className={chip(filter === 'in_service')}>In Service ({counts.in_service})</button>
        <button onClick={() => setFilter('attention')} className={chip(filter === 'attention')}>Failed / Out of Service ({counts.attention})</button>
        <button onClick={() => setFilter('retired')} className={chip(filter === 'retired')}>Retired ({counts.retired})</button>
      </div>

      <div className="relative mb-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hose ID..." className={`w-full ${input} px-3 py-2`} />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400 hover:text-zinc-700">Clear</button>
        )}
      </div>

      {filter === 'retired' && (
        <p className="mb-3 text-xs text-zinc-500">Retired hose is kept for history. Its test records stay on file; Restore puts it back in service.</p>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400 mb-5">
          {search ? <>No hoses match &quot;{search}&quot;.</> : 'No hoses in this list.'}
        </div>
      ) : (
        <div className="mb-5 space-y-4">
          {sizes.map(size => {
            const group = visible.filter(h => h.diameter_in === size)
            return (
              <div key={size}>
                <h3 className="text-xs font-semibold text-zinc-500 mb-1.5 px-1">
                  {size}&quot; Hose <span className="text-zinc-400 font-normal">({group.length})</span>
                </h3>
                <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden divide-y divide-zinc-100">
                  {group.map(h => editingId === h.id ? (
                    <form key={h.id} action={fd => handleEdit(h, fd)} className="px-4 py-3 flex flex-col gap-2 bg-zinc-50">
                      {editError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{editError}</div>}
                      <div className="flex gap-2">
                        <input name="hose_identifier" type="text" required defaultValue={h.hose_identifier} className={`min-w-0 flex-1 font-mono ${input}`} />
                        <select name="hose_type" required defaultValue={h.hose_type} className={input}>
                          {hoseTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <input name="diameter_in" type="number" step="0.25" min="0.5" required defaultValue={h.diameter_in} placeholder="Diameter" className={`w-24 ${input}`} />
                        <input name="length_ft" type="number" min="0" required defaultValue={h.length_ft} placeholder="Length (ft)" className={`w-28 ${input}`} />
                        <button type="submit" disabled={busyId === h.id} className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                          {busyId === h.id ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" onClick={() => { setEditingId(null); setEditError(null) }} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div key={h.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                      <div className="min-w-0 flex-1">
                        <span className={`font-mono font-semibold ${h.status === 'in_service' ? 'text-zinc-900' : 'text-zinc-500'}`}>{h.hose_identifier}</span>
                        <span className="text-xs text-zinc-400 ml-2">{h.length_ft} ft · {h.hose_type}</span>
                        {h.status !== 'in_service' && (
                          <span className={`ml-2 text-xs font-medium ${h.status === 'retired' ? 'text-zinc-500' : 'text-amber-700'}`}>· {STATUS_LABEL[h.status]}</span>
                        )}
                        {h.status === 'in_service' && recentlyTestedIds.has(h.id) && !forcedIds.has(h.id) && (
                          <span className="ml-2 text-xs text-amber-600">· tested recently</span>
                        )}
                        {h.last_test_passed === false && h.status === 'in_service' && (
                          <span className="ml-2 text-xs font-medium text-red-700">· last test failed</span>
                        )}
                      </div>
                      <div className="flex gap-3 shrink-0">
                        {h.status === 'in_service' && recentlyTestedIds.has(h.id) && !forcedIds.has(h.id) && (
                          <button onClick={() => onForceInclude(h.id)} className="text-xs font-semibold text-amber-700 hover:text-amber-900">Force Test</button>
                        )}
                        <button onClick={() => { setEditingId(h.id); setEditError(null) }} className="text-xs font-semibold text-zinc-500 hover:text-red-700">Edit</button>
                        {h.status === 'in_service' && (
                          <button disabled={busyId === h.id} onClick={() => changeStatus(h, 'out_of_service', 'Take this hose out of service? It will no longer show up for testing.')}
                            className="text-xs font-semibold text-zinc-400 hover:text-red-700 disabled:opacity-50">Out of Service</button>
                        )}
                        {h.status === 'out_of_service' && (
                          <button disabled={busyId === h.id} onClick={() => changeStatus(h, 'in_service')}
                            className="text-xs font-semibold text-green-700 hover:underline disabled:opacity-50">Return to Service</button>
                        )}
                        {h.status !== 'retired' ? (
                          <button disabled={busyId === h.id} onClick={() => changeStatus(h, 'retired', 'Retire this hose? It leaves the lists and reports; its test history is kept and you can restore it later.')}
                            className="text-xs font-semibold text-zinc-400 hover:text-red-700 disabled:opacity-50">Retire</button>
                        ) : (
                          <button disabled={busyId === h.id} onClick={() => changeStatus(h, 'in_service')}
                            className="text-xs font-semibold text-green-700 hover:underline disabled:opacity-50">Restore</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
