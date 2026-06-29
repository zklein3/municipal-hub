'use client'

import { useState } from 'react'
import {
  logBusinessCheck,
  updateBusinessCheck,
  deleteBusinessCheck,
  createBusinessCheckRound,
} from '@/app/actions/pd-business-checks'
import { addBusiness, updateBusiness, setBusinessActive, deleteBusiness } from '@/app/actions/pd-businesses'

const inputCls = 'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'
const checkboxRow = 'flex items-center gap-2 text-sm text-zinc-700'
const nowBtnCls = 'shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50'

const CHECK_TYPE_LABELS: Record<string, string> = {
  routine: 'Routine', alarm_response: 'Alarm Response', owner_request: 'Owner Request', follow_up: 'Follow-Up',
}
const DISPOSITION_LABELS: Record<string, string> = {
  all_secure: 'All Secure', report_filed: 'Report Filed', follow_up_required: 'Follow-Up Required', other: 'Other',
}
const DISPOSITION_COLORS: Record<string, string> = {
  all_secure: 'bg-green-100 text-green-700', report_filed: 'bg-blue-100 text-blue-700',
  follow_up_required: 'bg-yellow-100 text-yellow-700', other: 'bg-zinc-100 text-zinc-600',
}
const ALARM_LABELS: Record<string, string> = {
  no_alarm: 'No Alarm', alarm_active: 'Alarm Active', alarm_reset: 'Alarm Reset',
}

function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface Business {
  id: string
  name: string
  address: string | null
  active: boolean
}

interface BusinessCheck {
  id: string
  round_id: string | null
  check_date: string
  time_arrived: string | null
  time_cleared: string | null
  business_id: string | null
  business_name: string
  address: string | null
  check_type: string
  doors_secure: boolean | null
  windows_secure: boolean | null
  lights_as_expected: boolean | null
  suspicious_activity: boolean | null
  interior_check: boolean | null
  interior_authorized_by: string | null
  interior_findings: string | null
  alarm_status: string | null
  owner_notified: boolean | null
  owner_name: string | null
  owner_notified_time: string | null
  disposition: string
  notes: string | null
  secured_on_departure: boolean | null
  officer_name: string | null
}

interface RoundDetailOverride {
  check_type: string
  doors_secure: boolean
  windows_secure: boolean
  lights_as_expected: boolean
  suspicious_activity: boolean
  interior_check: boolean
  interior_authorized_by: string
  interior_findings: string
  alarm_status: string
  owner_notified: boolean
  owner_name: string
  owner_notified_time: string
  disposition: string
  notes: string
  secured_on_departure: boolean
}

const defaultRoundDetail: RoundDetailOverride = {
  check_type: 'routine',
  doors_secure: false,
  windows_secure: false,
  lights_as_expected: false,
  suspicious_activity: false,
  interior_check: false,
  interior_authorized_by: '',
  interior_findings: '',
  alarm_status: 'no_alarm',
  owner_notified: false,
  owner_name: '',
  owner_notified_time: '',
  disposition: 'all_secure',
  notes: '',
  secured_on_departure: true,
}

function isFlagged(d: RoundDetailOverride | undefined) {
  if (!d) return false
  return d.disposition !== 'all_secure' || d.suspicious_activity || !!d.notes.trim() || d.interior_check || !d.secured_on_departure
}

function RoundDetailModal({
  business,
  initial,
  onSave,
  onClose,
}: {
  business: Business
  initial: RoundDetailOverride
  onSave: (value: RoundDetailOverride) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<RoundDetailOverride>(initial)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white border border-zinc-200">
        <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50 sticky top-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Business Detail</p>
          <p className="text-lg font-bold text-zinc-900 mt-0.5">{business.name}</p>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-xs font-semibold text-zinc-700 mb-2">Exterior Findings</p>
            <div className="grid grid-cols-2 gap-2">
              <label className={checkboxRow}><input type="checkbox" checked={form.doors_secure} onChange={e => setForm(p => ({ ...p, doors_secure: e.target.checked }))} /> Doors secure</label>
              <label className={checkboxRow}><input type="checkbox" checked={form.windows_secure} onChange={e => setForm(p => ({ ...p, windows_secure: e.target.checked }))} /> Windows secure</label>
              <label className={checkboxRow}><input type="checkbox" checked={form.lights_as_expected} onChange={e => setForm(p => ({ ...p, lights_as_expected: e.target.checked }))} /> Lights as expected</label>
              <label className={checkboxRow}><input type="checkbox" checked={form.suspicious_activity} onChange={e => setForm(p => ({ ...p, suspicious_activity: e.target.checked }))} /> Suspicious activity</label>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3">
            <label className={`${checkboxRow} mb-2`}>
              <input type="checkbox" checked={form.interior_check} onChange={e => setForm(p => ({ ...p, interior_check: e.target.checked }))} />
              Interior check performed
            </label>
            {form.interior_check && (
              <div className="flex flex-col gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Authorized By</label>
                  <input type="text" value={form.interior_authorized_by} onChange={e => setForm(p => ({ ...p, interior_authorized_by: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Interior Findings</label>
                  <input type="text" value={form.interior_findings} onChange={e => setForm(p => ({ ...p, interior_findings: e.target.value }))} className={inputCls} />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-xs font-semibold text-zinc-700 mb-2">Alarm</p>
            <div className="flex flex-col gap-2">
              <select value={form.alarm_status} onChange={e => setForm(p => ({ ...p, alarm_status: e.target.value }))} className={inputCls}>
                {Object.entries(ALARM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <label className={checkboxRow}>
                <input type="checkbox" checked={form.owner_notified} onChange={e => setForm(p => ({ ...p, owner_notified: e.target.checked }))} /> Owner notified
              </label>
              {form.owner_notified && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Owner Name</label>
                    <input type="text" value={form.owner_name} onChange={e => setForm(p => ({ ...p, owner_name: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Time Notified</label>
                    <input type="time" value={form.owner_notified_time} onChange={e => setForm(p => ({ ...p, owner_notified_time: e.target.value }))} className={inputCls} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Disposition</label>
            <select value={form.disposition} onChange={e => setForm(p => ({ ...p, disposition: e.target.value }))} className={inputCls}>
              {Object.entries(DISPOSITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={inputCls} rows={3} />
          </div>

          <div className={`rounded-lg border-2 p-3 ${form.secured_on_departure ? 'border-green-200 bg-green-50' : 'border-red-300 bg-red-50'}`}>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={form.secured_on_departure} onChange={e => setForm(p => ({ ...p, secured_on_departure: e.target.checked }))} />
              <span className={form.secured_on_departure ? 'text-green-800' : 'text-red-700'}>
                Building secured before leaving
              </span>
            </label>
            {!form.secured_on_departure && (
              <p className="text-xs text-red-600 mt-1 pl-6">Left unsecured — make sure disposition reflects follow-up needed.</p>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-2 sticky bottom-0">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">
            Cancel
          </button>
          <button type="button" onClick={() => onSave(form)}
            className="rounded-lg bg-red-700 px-5 py-2 text-sm font-semibold text-white hover:bg-red-800">
            Save &amp; Back to Round
          </button>
        </div>
      </div>
    </div>
  )
}

const emptyDetailForm = {
  business_id: '',
  business_name: '',
  check_date: '',
  time_arrived: '',
  time_cleared: '',
  address: '',
  check_type: 'follow_up',
  doors_secure: false,
  windows_secure: false,
  lights_as_expected: false,
  suspicious_activity: false,
  interior_check: false,
  interior_authorized_by: '',
  interior_findings: '',
  alarm_status: 'no_alarm',
  owner_notified: false,
  owner_name: '',
  owner_notified_time: '',
  disposition: 'all_secure',
  notes: '',
  secured_on_departure: true,
}

export default function BusinessCheckClient({
  entries: initialEntries,
  businesses: initialBusinesses,
  isOfficerOrAbove,
}: {
  entries: BusinessCheck[]
  businesses: Business[]
  isOfficerOrAbove: boolean
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [businesses, setBusinesses] = useState(initialBusinesses)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const activeBusinesses = businesses.filter(b => b.active)

  // ─── Round (cover sheet) state ───────────────────────────────────────────
  const [roundDate, setRoundDate] = useState(today)
  const [roundStart, setRoundStart] = useState('')
  const [roundEnd, setRoundEnd] = useState('')
  const [editingStart, setEditingStart] = useState(false)
  const [editingEnd, setEditingEnd] = useState(false)
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<string[]>([])
  const [roundLoading, setRoundLoading] = useState(false)
  const [businessSearch, setBusinessSearch] = useState('')
  const [roundDetails, setRoundDetails] = useState<Record<string, RoundDetailOverride>>({})
  const [detailModalBusinessId, setDetailModalBusinessId] = useState<string | null>(null)

  function toggleBusiness(id: string) {
    setSelectedBusinessIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleSaveRoundDetail(businessId: string, value: RoundDetailOverride) {
    setRoundDetails(prev => ({ ...prev, [businessId]: value }))
    setDetailModalBusinessId(null)
  }

  const filteredBusinesses = activeBusinesses.filter(b =>
    b.name.toLowerCase().includes(businessSearch.trim().toLowerCase())
  )

  async function handleSubmitRound(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!roundStart) { setError('Tap "Now" on Started before logging the round — it can\'t be left blank.'); return }

    // Ended is captured automatically the moment the round is logged, unless
    // the officer already set it manually via Edit.
    const finalEnd = roundEnd || nowTime()
    setRoundEnd(finalEnd)
    setRoundLoading(true)

    const fd = new FormData()
    fd.set('check_date', roundDate)
    fd.set('time_arrived', roundStart)
    fd.set('time_cleared', finalEnd)
    selectedBusinessIds.forEach(id => fd.append('business_ids', id))
    fd.set('details', JSON.stringify(roundDetails))

    const result = await createBusinessCheckRound(fd)
    if (result?.error) { setError(result.error); setRoundLoading(false); return }

    const flaggedCount = selectedBusinessIds.filter(id => isFlagged(roundDetails[id])).length
    setSuccess(`Logged round — ${result.count} business${result.count !== 1 ? 'es' : ''} checked${flaggedCount > 0 ? `, ${flaggedCount} with findings noted` : ', all secure'}.`)
    setSelectedBusinessIds([])
    setRoundDetails({})
    setRoundStart('')
    setRoundEnd('')
    setRoundLoading(false)
    window.location.reload()
  }

  // ─── Manage business list ────────────────────────────────────────────────
  const [showManage, setShowManage] = useState(false)
  const [newBizName, setNewBizName] = useState('')
  const [newBizAddress, setNewBizAddress] = useState('')
  const [bizLoading, setBizLoading] = useState(false)
  const [editingBizId, setEditingBizId] = useState<string | null>(null)
  const [editBizName, setEditBizName] = useState('')
  const [editBizAddress, setEditBizAddress] = useState('')

  async function handleAddBusiness(e: React.FormEvent) {
    e.preventDefault()
    if (!newBizName.trim()) return
    setBizLoading(true)
    const fd = new FormData()
    fd.set('name', newBizName.trim())
    if (newBizAddress.trim()) fd.set('address', newBizAddress.trim())
    const result = await addBusiness(fd)
    if (result?.error) setError(result.error)
    else {
      setNewBizName('')
      setNewBizAddress('')
      window.location.reload()
    }
    setBizLoading(false)
  }

  function startEditBusiness(b: Business) {
    setEditingBizId(b.id)
    setEditBizName(b.name)
    setEditBizAddress(b.address ?? '')
  }

  async function handleSaveBusiness(id: string) {
    if (!editBizName.trim()) return
    setBizLoading(true)
    const fd = new FormData()
    fd.set('name', editBizName.trim())
    if (editBizAddress.trim()) fd.set('address', editBizAddress.trim())
    const result = await updateBusiness(id, fd)
    if (result?.error) setError(result.error)
    else {
      setBusinesses(prev => prev.map(b => b.id === id ? { ...b, name: editBizName.trim(), address: editBizAddress.trim() || null } : b))
      setEditingBizId(null)
    }
    setBizLoading(false)
  }

  async function handleToggleActive(b: Business) {
    setBizLoading(true)
    const result = await setBusinessActive(b.id, !b.active)
    if (result?.error) setError(result.error)
    else setBusinesses(prev => prev.map(x => x.id === b.id ? { ...x, active: !b.active } : x))
    setBizLoading(false)
  }

  async function handleDeleteBusiness(id: string) {
    setBizLoading(true)
    const result = await deleteBusiness(id)
    if (result?.error) setError(result.error)
    else setBusinesses(prev => prev.filter(b => b.id !== id))
    setBizLoading(false)
  }

  // ─── Detail form (manual entry / document a finding) ────────────────────
  const [showDetailForm, setShowDetailForm] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [detailForm, setDetailForm] = useState({ ...emptyDetailForm, check_date: today })

  function resetDetailForm() {
    setDetailForm({ ...emptyDetailForm, check_date: today })
  }

  function handleOpenManualEntry() {
    setEditingId(null)
    resetDetailForm()
    setShowDetailForm(true)
    setError(null)
    setSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleEdit(entry: BusinessCheck) {
    setEditingId(entry.id)
    setDetailForm({
      business_id: entry.business_id ?? '',
      business_name: entry.business_name,
      check_date: entry.check_date,
      time_arrived: entry.time_arrived ?? '',
      time_cleared: entry.time_cleared ?? '',
      address: entry.address ?? '',
      check_type: entry.check_type,
      doors_secure: entry.doors_secure ?? false,
      windows_secure: entry.windows_secure ?? false,
      lights_as_expected: entry.lights_as_expected ?? false,
      suspicious_activity: entry.suspicious_activity ?? false,
      interior_check: entry.interior_check ?? false,
      interior_authorized_by: entry.interior_authorized_by ?? '',
      interior_findings: entry.interior_findings ?? '',
      alarm_status: entry.alarm_status ?? 'no_alarm',
      owner_notified: entry.owner_notified ?? false,
      owner_name: entry.owner_name ?? '',
      owner_notified_time: entry.owner_notified_time ?? '',
      disposition: entry.disposition,
      notes: entry.notes ?? '',
      secured_on_departure: entry.secured_on_departure ?? true,
    })
    setShowDetailForm(true)
    setError(null)
    setSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelDetailForm() {
    setShowDetailForm(false)
    setEditingId(null)
    setError(null)
    setSuccess(null)
    resetDetailForm()
  }

  function handleBusinessSelect(business_id: string) {
    const biz = businesses.find(b => b.id === business_id)
    setDetailForm(p => ({
      ...p,
      business_id,
      business_name: biz ? biz.name : p.business_name,
      address: biz?.address ?? p.address,
    }))
  }

  async function handleSubmitDetail(e: React.FormEvent) {
    e.preventDefault()
    setDetailLoading(true)
    setError(null)
    setSuccess(null)

    const fd = new FormData()
    Object.entries(detailForm).forEach(([k, v]) => {
      if (k === 'secured_on_departure') return
      if (typeof v === 'boolean') { if (v) fd.set(k, 'on') }
      else if (v) fd.set(k, v)
    })
    fd.set('secured_on_departure', String(detailForm.secured_on_departure))

    const result = editingId
      ? await updateBusinessCheck(editingId, fd)
      : await logBusinessCheck(fd)

    if (result?.error) { setError(result.error); setDetailLoading(false); return }

    setSuccess(editingId ? 'Business check updated.' : 'Business check logged.')
    setShowDetailForm(false)
    setEditingId(null)
    resetDetailForm()
    window.location.reload()
  }

  const [deletingId, setDeletingId] = useState<string | null>(null)
  async function handleDelete(id: string) {
    setDeletingId(id)
    const result = await deleteBusinessCheck(id)
    if (result?.error) setError(result.error)
    else setEntries(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
  }

  // Group history entries by round (adjacent rows sharing the same round_id)
  const groups: { round_id: string | null; items: BusinessCheck[] }[] = []
  for (const entry of entries) {
    const last = groups[groups.length - 1]
    if (last && entry.round_id && last.round_id === entry.round_id) last.items.push(entry)
    else groups.push({ round_id: entry.round_id, items: [entry] })
  }

  return (
    <div className="max-w-2xl">
      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>}

      {/* ─── Routine Round (Cover Sheet) ─── */}
      <div className="mb-6 rounded-xl bg-white border border-zinc-200 p-5 shadow-sm">
        <p className="text-sm font-semibold text-zinc-900 mb-1">Routine Round</p>
        <p className="text-xs text-zinc-400 mb-4">Walk the block, then check off what you covered.</p>

        <form onSubmit={handleSubmitRound} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Date</label>
            <input type="date" value={roundDate} onChange={e => setRoundDate(e.target.value)} required className={`${inputCls} max-w-[160px]`} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              Started {!roundStart && <span className="text-red-500">*</span>}
            </label>
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${roundStart ? 'border-zinc-300 bg-zinc-50' : 'border-red-300 bg-red-50'}`}>
              {editingStart ? (
                <input type="time" value={roundStart} onChange={e => setRoundStart(e.target.value)} className="flex-1 bg-transparent text-lg font-semibold text-zinc-800 focus:outline-none" autoFocus />
              ) : (
                <span className="flex-1 text-lg font-semibold text-zinc-800 tabular-nums">{roundStart || 'Not set'}</span>
              )}
              <button type="button" onClick={() => setRoundStart(nowTime())} className={nowBtnCls}>Now</button>
              <button type="button" onClick={() => setEditingStart(s => !s)}
                className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-700 underline">
                {editingStart ? 'Done' : 'Edit'}
              </button>
            </div>
            {!roundStart && <p className="text-xs text-red-600 mt-1">Tap Now when you actually start the round.</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-zinc-700">Businesses Checked</label>
              <button type="button" onClick={() => setShowManage(s => !s)} className="text-xs font-semibold text-red-600 hover:text-red-800">
                {showManage ? 'Done' : 'Manage List'}
              </button>
            </div>

            {activeBusinesses.length === 0 ? (
              <p className="text-sm text-zinc-400 italic px-1 py-2">No businesses on the list yet — click &quot;Manage List&quot; to add some.</p>
            ) : (
              <>
                <input
                  type="text"
                  value={businessSearch}
                  onChange={e => setBusinessSearch(e.target.value)}
                  placeholder="Type to search businesses..."
                  className={`${inputCls} mb-2`}
                />
                {filteredBusinesses.length === 0 ? (
                  <p className="text-sm text-zinc-400 italic px-1 py-2">No businesses match &quot;{businessSearch}&quot;.</p>
                ) : (
              <div className="flex flex-col gap-2 max-h-[13rem] overflow-y-auto pr-1">
                {filteredBusinesses.map(b => {
                  const selected = selectedBusinessIds.includes(b.id)
                  const flagged = selected && isFlagged(roundDetails[b.id])
                  return (
                    <div
                      key={b.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleBusiness(b.id)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggleBusiness(b.id) }}
                      className={`w-full shrink-0 h-16 cursor-pointer text-left rounded-xl border-2 px-4 transition-colors flex items-center justify-between gap-3 ${
                        flagged ? 'border-yellow-500 bg-yellow-50' : selected ? 'border-red-600 bg-red-50' : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`text-base font-semibold truncate ${flagged ? 'text-yellow-800' : selected ? 'text-red-800' : 'text-zinc-800'}`}>{b.name}</p>
                        {b.address && <p className="text-sm text-zinc-400 truncate">{b.address}</p>}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {selected && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setDetailModalBusinessId(b.id) }}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                              flagged ? 'border-yellow-500 bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'
                            }`}
                          >
                            {flagged ? '⚠ Flagged' : 'Detail'}
                          </button>
                        )}
                        <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          selected ? 'border-red-600 bg-red-600' : 'border-zinc-300'
                        }`}>
                          {selected && <span className="text-white text-sm leading-none">✓</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
                )}
              </>
            )}
          </div>

          {showManage && (
            <div className="rounded-lg border border-zinc-200 p-3 bg-zinc-50">
              <p className="text-xs font-semibold text-zinc-700 mb-2">Manage Business List</p>
              <div className="flex gap-2 mb-3">
                <input type="text" value={newBizName} onChange={e => setNewBizName(e.target.value)} placeholder="Business name" className={inputCls} />
                <input type="text" value={newBizAddress} onChange={e => setNewBizAddress(e.target.value)} placeholder="Address (optional)" className={inputCls} />
                <button type="button" onClick={handleAddBusiness} disabled={bizLoading || !newBizName.trim()}
                  className="shrink-0 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-900 disabled:opacity-50">
                  Add
                </button>
              </div>
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                {businesses.map(b => (
                  <div key={b.id} className="flex items-center gap-2 rounded-md bg-white border border-zinc-200 px-2 py-1.5">
                    {editingBizId === b.id ? (
                      <>
                        <input type="text" value={editBizName} onChange={e => setEditBizName(e.target.value)} className={inputCls} />
                        <input type="text" value={editBizAddress} onChange={e => setEditBizAddress(e.target.value)} className={inputCls} />
                        <button type="button" onClick={() => handleSaveBusiness(b.id)} disabled={bizLoading} className="shrink-0 text-xs font-semibold text-green-700 hover:text-green-900">Save</button>
                        <button type="button" onClick={() => setEditingBizId(null)} className="shrink-0 text-xs text-zinc-400 hover:text-zinc-700">Cancel</button>
                      </>
                    ) : (
                      <>
                        <div className={`flex-1 text-sm ${b.active ? 'text-zinc-800' : 'text-zinc-400 line-through'}`}>
                          {b.name}{b.address ? <span className="text-zinc-400"> — {b.address}</span> : null}
                        </div>
                        <button type="button" onClick={() => startEditBusiness(b)} className="shrink-0 text-xs text-zinc-400 hover:text-zinc-700">Edit</button>
                        <button type="button" onClick={() => handleToggleActive(b)} disabled={bizLoading} className="shrink-0 text-xs text-zinc-400 hover:text-zinc-700">
                          {b.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button type="button" onClick={() => handleDeleteBusiness(b.id)} disabled={bizLoading} className="shrink-0 text-xs text-zinc-400 hover:text-red-600">Delete</button>
                      </>
                    )}
                  </div>
                ))}
                {businesses.length === 0 && <p className="text-xs text-zinc-400 italic">No businesses added yet.</p>}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2">
            <span className="text-xs font-medium text-zinc-500 shrink-0">Ended</span>
            {editingEnd ? (
              <input type="time" value={roundEnd} onChange={e => setRoundEnd(e.target.value)} className="flex-1 bg-transparent text-lg font-semibold text-zinc-800 focus:outline-none" autoFocus />
            ) : (
              <span className="flex-1 text-lg font-semibold text-zinc-800 tabular-nums">{roundEnd || 'Set when you log the round'}</span>
            )}
            <button type="button" onClick={() => setEditingEnd(s => !s)}
              className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-700 underline">
              {editingEnd ? 'Done' : 'Edit'}
            </button>
          </div>

          <button type="submit" disabled={roundLoading || selectedBusinessIds.length === 0 || !roundStart}
            className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
            {roundLoading ? 'Saving…' : `Log Round${selectedBusinessIds.length > 0 ? ` (${selectedBusinessIds.length} selected)` : ''}`}
          </button>
        </form>
      </div>

      {/* ─── History + manual entry / document a finding ─── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-zinc-900">Checks Logged</h2>
        <button onClick={() => showDetailForm ? handleCancelDetailForm() : handleOpenManualEntry()}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
          {showDetailForm ? 'Cancel' : '+ Manual Entry'}
        </button>
      </div>

      {showDetailForm && (
        <form onSubmit={handleSubmitDetail} className="mb-6 rounded-xl bg-white border border-zinc-200 p-5 shadow-sm flex flex-col gap-3">
          <p className="text-sm font-semibold text-zinc-700 mb-1">{editingId ? 'Document a Finding' : 'New Manual Entry'}</p>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-700">Date <span className="text-red-500">*</span></label>
              <input type="date" value={detailForm.check_date} onChange={e => setDetailForm(p => ({ ...p, check_date: e.target.value }))} required className={inputCls} />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-700">Time Arrived</label>
              <input type="time" value={detailForm.time_arrived} onChange={e => setDetailForm(p => ({ ...p, time_arrived: e.target.value }))} className={inputCls} />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-700">Time Cleared</label>
              <input type="time" value={detailForm.time_cleared} onChange={e => setDetailForm(p => ({ ...p, time_cleared: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Business <span className="text-red-500">*</span></label>
            <select value={detailForm.business_id} onChange={e => handleBusinessSelect(e.target.value)} className={inputCls}>
              <option value="">Select from list...</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              <option value="">Other (type below)</option>
            </select>
            {!detailForm.business_id && (
              <input type="text" value={detailForm.business_name} onChange={e => setDetailForm(p => ({ ...p, business_name: e.target.value }))}
                required className={`${inputCls} mt-2`} placeholder="Business name" />
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Address</label>
            <input type="text" value={detailForm.address} onChange={e => setDetailForm(p => ({ ...p, address: e.target.value }))} className={inputCls} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Check Type</label>
            <select value={detailForm.check_type} onChange={e => setDetailForm(p => ({ ...p, check_type: e.target.value }))} className={inputCls}>
              {Object.entries(CHECK_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-xs font-semibold text-zinc-700 mb-2">Exterior Findings</p>
            <div className="grid grid-cols-2 gap-2">
              <label className={checkboxRow}><input type="checkbox" checked={detailForm.doors_secure} onChange={e => setDetailForm(p => ({ ...p, doors_secure: e.target.checked }))} /> Doors secure</label>
              <label className={checkboxRow}><input type="checkbox" checked={detailForm.windows_secure} onChange={e => setDetailForm(p => ({ ...p, windows_secure: e.target.checked }))} /> Windows secure</label>
              <label className={checkboxRow}><input type="checkbox" checked={detailForm.lights_as_expected} onChange={e => setDetailForm(p => ({ ...p, lights_as_expected: e.target.checked }))} /> Lights as expected</label>
              <label className={checkboxRow}><input type="checkbox" checked={detailForm.suspicious_activity} onChange={e => setDetailForm(p => ({ ...p, suspicious_activity: e.target.checked }))} /> Suspicious activity</label>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3">
            <label className={`${checkboxRow} mb-2`}>
              <input type="checkbox" checked={detailForm.interior_check} onChange={e => setDetailForm(p => ({ ...p, interior_check: e.target.checked }))} />
              Interior check performed
            </label>
            {detailForm.interior_check && (
              <div className="flex flex-col gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Authorized By</label>
                  <input type="text" value={detailForm.interior_authorized_by} onChange={e => setDetailForm(p => ({ ...p, interior_authorized_by: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Interior Findings</label>
                  <input type="text" value={detailForm.interior_findings} onChange={e => setDetailForm(p => ({ ...p, interior_findings: e.target.value }))} className={inputCls} />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-xs font-semibold text-zinc-700 mb-2">Alarm</p>
            <div className="flex flex-col gap-2">
              <select value={detailForm.alarm_status} onChange={e => setDetailForm(p => ({ ...p, alarm_status: e.target.value }))} className={inputCls}>
                {Object.entries(ALARM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <label className={checkboxRow}>
                <input type="checkbox" checked={detailForm.owner_notified} onChange={e => setDetailForm(p => ({ ...p, owner_notified: e.target.checked }))} /> Owner notified
              </label>
              {detailForm.owner_notified && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Owner Name</label>
                    <input type="text" value={detailForm.owner_name} onChange={e => setDetailForm(p => ({ ...p, owner_name: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Time Notified</label>
                    <input type="time" value={detailForm.owner_notified_time} onChange={e => setDetailForm(p => ({ ...p, owner_notified_time: e.target.value }))} className={inputCls} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Disposition</label>
            <select value={detailForm.disposition} onChange={e => setDetailForm(p => ({ ...p, disposition: e.target.value }))} className={inputCls}>
              {Object.entries(DISPOSITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
            <textarea value={detailForm.notes} onChange={e => setDetailForm(p => ({ ...p, notes: e.target.value }))} className={inputCls} rows={2} />
          </div>

          <div className={`rounded-lg border-2 p-3 ${detailForm.secured_on_departure ? 'border-green-200 bg-green-50' : 'border-red-300 bg-red-50'}`}>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={detailForm.secured_on_departure} onChange={e => setDetailForm(p => ({ ...p, secured_on_departure: e.target.checked }))} />
              <span className={detailForm.secured_on_departure ? 'text-green-800' : 'text-red-700'}>
                Building secured before leaving
              </span>
            </label>
            {!detailForm.secured_on_departure && (
              <p className="text-xs text-red-600 mt-1 pl-6">Left unsecured — make sure disposition reflects follow-up needed.</p>
            )}
          </div>

          <button type="submit" disabled={detailLoading}
            className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
            {detailLoading ? 'Saving…' : editingId ? 'Update Check' : 'Save Check'}
          </button>
        </form>
      )}

      {groups.length === 0 ? (
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
          No business checks logged yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group, gi) => (
            <div key={group.round_id ?? `single-${gi}`} className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
              {group.round_id && group.items.length > 1 && (
                <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-100 text-xs font-semibold text-zinc-500">
                  Round — {new Date(group.items[0].check_date + 'T12:00:00').toLocaleDateString()}
                  {group.items[0].time_arrived ? ` · ${group.items[0].time_arrived.slice(0, 5)}` : ''}
                  {group.items[0].time_cleared ? `–${group.items[0].time_cleared.slice(0, 5)}` : ''}
                  {group.items[0].officer_name ? ` · ${group.items[0].officer_name}` : ''}
                </div>
              )}
              <div className="divide-y divide-zinc-100">
                {group.items.map(entry => (
                  <div key={entry.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!(group.round_id && group.items.length > 1) && (
                            <span className="text-sm font-semibold text-zinc-900">
                              {new Date(entry.check_date + 'T12:00:00').toLocaleDateString()}
                            </span>
                          )}
                          <span className="text-sm text-zinc-700">{entry.business_name}</span>
                          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${DISPOSITION_COLORS[entry.disposition] ?? 'bg-zinc-100 text-zinc-600'}`}>
                            {DISPOSITION_LABELS[entry.disposition] ?? entry.disposition}
                          </span>
                          {entry.suspicious_activity && (
                            <span className="text-xs rounded-full px-2 py-0.5 font-medium bg-red-100 text-red-700">Suspicious Activity</span>
                          )}
                          {entry.secured_on_departure === false && (
                            <span className="text-xs rounded-full px-2 py-0.5 font-medium bg-red-100 text-red-700">⚠ Not Secured</span>
                          )}
                        </div>
                        <div className="flex gap-3 mt-0.5 text-xs text-zinc-500 flex-wrap">
                          <span>{CHECK_TYPE_LABELS[entry.check_type] ?? entry.check_type}</span>
                          {entry.address && <span>{entry.address}</span>}
                          {!(group.round_id && group.items.length > 1) && entry.time_arrived && <span>Arrived {entry.time_arrived.slice(0, 5)}</span>}
                          {!(group.round_id && group.items.length > 1) && entry.time_cleared && <span>Cleared {entry.time_cleared.slice(0, 5)}</span>}
                          {!(group.round_id && group.items.length > 1) && entry.officer_name && <span>· {entry.officer_name}</span>}
                        </div>
                        {entry.notes && <p className="text-xs text-zinc-400 mt-0.5 italic">{entry.notes}</p>}
                      </div>
                      {isOfficerOrAbove && (
                        <div className="shrink-0 flex gap-3">
                          <button onClick={() => handleEdit(entry)}
                            className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
                            {entry.disposition === 'all_secure' && !entry.notes ? 'Document Finding' : 'Edit'}
                          </button>
                          <button onClick={() => handleDelete(entry.id)} disabled={deletingId === entry.id}
                            className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50 transition-colors">
                            {deletingId === entry.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {detailModalBusinessId && (() => {
        const biz = businesses.find(b => b.id === detailModalBusinessId)
        if (!biz) return null
        return (
          <RoundDetailModal
            business={biz}
            initial={roundDetails[detailModalBusinessId] ?? defaultRoundDetail}
            onSave={value => handleSaveRoundDetail(detailModalBusinessId, value)}
            onClose={() => setDetailModalBusinessId(null)}
          />
        )
      })()}
    </div>
  )
}
