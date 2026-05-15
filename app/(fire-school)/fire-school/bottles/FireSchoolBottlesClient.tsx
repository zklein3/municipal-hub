'use client'

import { useState, useRef, useCallback } from 'react'
import { addFireSchoolBottle, updateFireSchoolBottle } from '@/app/actions/fire-school'
import QrPrintLabel from '@/components/QrPrintLabel'
import QRScanner from '@/components/QRScanner'

const CYLINDER_TYPES = [
  { value: 'composite_15', label: 'Carbon Fiber/Composite (15yr)' },
  { value: 'composite_30', label: 'Next-Gen Composite (30yr)' },
  { value: 'hoop_wrapped', label: 'Hoop-Wrapped/Fiberglass (15yr)' },
  { value: 'steel',        label: 'Steel' },
  { value: 'aluminum',     label: 'Aluminum' },
]

const CYLINDER_TYPE_LABELS: Record<string, string> = {
  composite_15: 'Carbon Fiber (15yr)',
  composite_30: 'Next-Gen Composite (30yr)',
  hoop_wrapped: 'Hoop-Wrapped (15yr)',
  steel:        'Steel',
  aluminum:     'Aluminum',
}

const CYLINDER_TYPE_CONFIG: Record<string, { requal: number; serviceLife: number | null; requiresServiceLife: boolean }> = {
  composite_15: { requal: 5, serviceLife: 15,   requiresServiceLife: true },
  composite_30: { requal: 5, serviceLife: 30,   requiresServiceLife: true },
  hoop_wrapped: { requal: 3, serviceLife: 15,   requiresServiceLife: true },
  steel:        { requal: 5, serviceLife: null, requiresServiceLife: false },
  aluminum:     { requal: 5, serviceLife: null, requiresServiceLife: false },
}

interface Bottle {
  id: string
  bottle_id: string
  department_name: string | null
  psi: number | null
  cylinder_type: string | null
  manufacture_date: string | null
  last_requal_date: string | null
  requal_interval_years: number | null
  service_life_years: number | null
  requires_service_life: boolean | null
  active: boolean
  status_reason: string | null
}

// ── Shared edit form ──────────────────────────────────────────────────────────
function EditForm({
  bottle,
  editSelectedType,
  setEditSelectedType,
  editError,
  editLoading,
  onSave,
  onCancel,
}: {
  bottle: Bottle
  editSelectedType: string
  setEditSelectedType: (t: string) => void
  editError: string | null
  editLoading: boolean
  onSave: (bottleId: string, fd: FormData) => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-lg border border-orange-200 bg-white p-4">
      <p className="text-sm font-semibold text-zinc-900 mb-3">
        Editing <span className="font-mono">{bottle.bottle_id}</span>
      </p>
      {editError && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">{editError}</div>
      )}
      <form action={(fd) => onSave(bottle.bottle_id, fd)} className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Department / Owner</label>
            <input name="department_name" type="text"
              defaultValue={bottle.department_name ?? ''}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
          <div className="sm:w-28">
            <label className="mb-1 block text-xs font-medium text-zinc-600">PSI</label>
            <select name="psi" defaultValue={bottle.psi ?? 4500}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500">
              <option value="4500">4500</option>
              <option value="2216">2216</option>
            </select>
          </div>
          <div className="sm:w-28">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Status</label>
            <select name="active" defaultValue={bottle.active ? 'true' : 'false'}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Cylinder Type</label>
            <select name="cylinder_type" value={editSelectedType} onChange={e => setEditSelectedType(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500">
              {CYLINDER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="sm:w-32">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Hydro Interval</label>
            <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-600">
              {CYLINDER_TYPE_CONFIG[editSelectedType].requal} yr
            </div>
          </div>
          {CYLINDER_TYPE_CONFIG[editSelectedType].requiresServiceLife && (
            <div className="sm:w-32">
              <label className="mb-1 block text-xs font-medium text-zinc-600">Service Life</label>
              <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-600">
                {CYLINDER_TYPE_CONFIG[editSelectedType].serviceLife} yr
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Manufacture Date</label>
            <input name="manufacture_date" type="date"
              defaultValue={bottle.manufacture_date ?? ''}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Last Requal Date</label>
            <input name="last_requal_date" type="date"
              defaultValue={bottle.last_requal_date ?? ''}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
        </div>
        <input type="hidden" name="requal_interval_years" value={CYLINDER_TYPE_CONFIG[editSelectedType].requal} />
        <input type="hidden" name="requires_service_life" value={CYLINDER_TYPE_CONFIG[editSelectedType].requiresServiceLife ? 'true' : 'false'} />
        {CYLINDER_TYPE_CONFIG[editSelectedType].requiresServiceLife && (
          <input type="hidden" name="service_life_years" value={CYLINDER_TYPE_CONFIG[editSelectedType].serviceLife!} />
        )}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={editLoading}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors">
            {editLoading ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={onCancel}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FireSchoolBottlesClient({
  bottles,
  fillCounts,
  prefillBottleId,
  prefillEditBottleId,
}: {
  bottles: Bottle[]
  fillCounts: Record<string, number>
  prefillBottleId: string | null
  prefillEditBottleId?: string | null
}) {
  const [showForm, setShowForm]             = useState(!!prefillBottleId)
  const [formKey, setFormKey]               = useState(0)
  const [addError, setAddError]             = useState<string | null>(null)
  const [success, setSuccess]               = useState<string | null>(null)
  const [addedBottleId, setAddedBottleId]   = useState<string | null>(null)
  const [addedDeptName, setAddedDeptName]   = useState<string | null>(null)
  const [addLoading, setAddLoading]         = useState(false)
  const [selectedType, setSelectedType]     = useState('composite_15')
  const [scannerOpen, setScannerOpen]       = useState(false)
  const [scannedBottleId, setScannedBottleId] = useState<string | null>(null)
  const bottleIdRef = useRef<HTMLInputElement>(null)

  const extractBottleId = useCallback((raw: string): string => {
    const trimmed = raw.trim()
    if (!trimmed.includes('://') && !trimmed.includes('scan=')) return trimmed.toUpperCase()
    try {
      const url = new URL(trimmed)
      const scanParam = url.searchParams.get('scan')
      if (scanParam?.trim()) return scanParam.trim().toUpperCase()
      const pathParts = url.pathname.split('/').filter(Boolean)
      const last = pathParts[pathParts.length - 1]
      if (last) return last.trim().toUpperCase()
    } catch { /* fall through */ }
    const match = trimmed.match(/[?&]scan=([^&]+)/i)
    if (match?.[1]) {
      try { return decodeURIComponent(match[1]).trim().toUpperCase() } catch { return match[1].trim().toUpperCase() }
    }
    return trimmed.toUpperCase()
  }, [])

  function handleScan(raw: string) {
    setScannerOpen(false)
    const id = extractBottleId(raw)
    setScannedBottleId(id)
    // Focus bottle ID field after scan
    setTimeout(() => bottleIdRef.current?.focus(), 50)
  }

  const [editingBottleId, setEditingBottleId]     = useState<string | null>(prefillEditBottleId ?? null)
  const [editSelectedType, setEditSelectedType]   = useState('composite_15')
  const [editError, setEditError]                 = useState<string | null>(null)
  const [editLoading, setEditLoading]             = useState(false)

  function startEdit(bottle: Bottle) {
    setEditingBottleId(bottle.bottle_id)
    setEditSelectedType(bottle.cylinder_type ?? 'composite_15')
    setEditError(null)
  }

  function cancelEdit() {
    setEditingBottleId(null)
    setEditError(null)
  }

  async function handleAdd(formData: FormData) {
    setAddError(null)
    setSuccess(null)
    setAddLoading(true)
    const result = await addFireSchoolBottle(formData)
    if (result?.error) {
      setAddError(result.error)
    } else {
      const bottleId = (formData.get('bottle_id') as string)?.trim().toUpperCase()
      const deptName = (formData.get('department_name') as string)?.trim() || null
      setAddedBottleId(bottleId)
      setAddedDeptName(deptName)
      setSuccess('Bottle added successfully.')
      setShowForm(false)
    }
    setAddLoading(false)
  }

  async function handleEdit(bottleId: string, formData: FormData) {
    setEditError(null)
    setEditLoading(true)
    const result = await updateFireSchoolBottle(bottleId, formData)
    if (result?.error) {
      setEditError(result.error)
    } else {
      setEditingBottleId(null)
    }
    setEditLoading(false)
  }

  const today = new Date()

  function getStatus(bottle: Bottle) {
    if (!bottle.active) return { label: 'Inactive', color: 'bg-zinc-100 text-zinc-500' }
    if (bottle.last_requal_date && bottle.requal_interval_years) {
      const expiry = new Date(bottle.last_requal_date)
      expiry.setFullYear(expiry.getFullYear() + bottle.requal_interval_years)
      if (today > expiry) return { label: 'Requal Expired', color: 'bg-red-100 text-red-700' }
    }
    if (bottle.requires_service_life && bottle.manufacture_date && bottle.service_life_years) {
      const endOfLife = new Date(bottle.manufacture_date)
      endOfLife.setFullYear(endOfLife.getFullYear() + bottle.service_life_years)
      if (today > endOfLife) return { label: 'End of Life', color: 'bg-red-100 text-red-700' }
    }
    return { label: 'OK', color: 'bg-green-100 text-green-700' }
  }

  const editFormProps = {
    editSelectedType,
    setEditSelectedType,
    editError,
    editLoading,
    onSave: handleEdit,
    onCancel: cancelEdit,
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Bottles</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{bottles.length} bottle{bottles.length !== 1 ? 's' : ''} in system</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/print/fire-school-report"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 transition-colors print:hidden"
          >
            Report
          </a>
          <button
            onClick={() => {
              if (!showForm) {
                setSelectedType('composite_15')
                setScannedBottleId(null)
                setScannerOpen(false)
                setFormKey(k => k + 1)
                setAddError(null)
                setSuccess(null)
              }
              setShowForm(!showForm)
            }}
            className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        </div>
      </div>

      {success && addedBottleId && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200 flex items-center justify-between gap-4">
          <span>{success}</span>
          <QrPrintLabel
            code={addedBottleId}
            type="bottle"
            title={addedBottleId}
            subtitle={addedDeptName ?? undefined}
            buttonClassName="shrink-0 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 print:hidden"
          />
        </div>
      )}

      {/* Add Bottle Form */}
      {showForm && (
        <div className="mb-6 rounded-xl bg-white p-5 shadow-sm border border-zinc-200">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">Add Bottle</h2>
          {addError && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{addError}</div>
          )}
          {/* QR Scanner */}
          {scannerOpen && (
            <div className="mb-4">
              <QRScanner
                onScan={handleScan}
                onClose={() => setScannerOpen(false)}
                hint="Point camera at bottle QR label"
              />
            </div>
          )}

          <form key={formKey} action={handleAdd} autoComplete="off" className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="sm:w-36">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Bottle ID <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                <input name="bottle_id" type="text" required autoComplete="off"
                  ref={bottleIdRef}
                  defaultValue={scannedBottleId ?? prefillBottleId ?? ''}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono uppercase focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="B-0001" />
                <button type="button" onClick={() => setScannerOpen(s => !s)}
                  className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-2 text-sm hover:bg-zinc-50 transition-colors"
                  title="Scan QR code">
                  📷
                </button>
                </div>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Department / Owner</label>
                <input name="department_name" type="text"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="Winslow Fire" />
              </div>
              <div className="sm:w-32">
                <label className="mb-1 block text-sm font-medium text-zinc-700">PSI</label>
                <select name="psi" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500">
                  <option value="4500">4500</option>
                  <option value="2216">2216</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Cylinder Type</label>
                <select name="cylinder_type" value={selectedType} onChange={e => setSelectedType(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500">
                  {CYLINDER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="sm:w-32">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Hydro Interval</label>
                <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-600">
                  {CYLINDER_TYPE_CONFIG[selectedType].requal} yr
                </div>
              </div>
              {CYLINDER_TYPE_CONFIG[selectedType].requiresServiceLife && (
                <div className="sm:w-32">
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Service Life</label>
                  <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-600">
                    {CYLINDER_TYPE_CONFIG[selectedType].serviceLife} yr
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Manufacture Date</label>
                <input name="manufacture_date" type="date"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Last Requal Date</label>
                <input name="last_requal_date" type="date"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
            </div>
            <input type="hidden" name="requal_interval_years" value={CYLINDER_TYPE_CONFIG[selectedType].requal} />
            <input type="hidden" name="requires_service_life" value={CYLINDER_TYPE_CONFIG[selectedType].requiresServiceLife ? 'true' : 'false'} />
            {CYLINDER_TYPE_CONFIG[selectedType].requiresServiceLife && (
              <input type="hidden" name="service_life_years" value={CYLINDER_TYPE_CONFIG[selectedType].serviceLife!} />
            )}
            <button type="submit" disabled={addLoading}
              className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors">
              {addLoading ? 'Adding...' : 'Add Bottle'}
            </button>
          </form>
        </div>
      )}

      {/* ── Mobile card list ─────────────────────────────────────────────────── */}
      <div className="sm:hidden space-y-3">
        {bottles.map(bottle => {
          const status = getStatus(bottle)
          const isEditing = editingBottleId === bottle.bottle_id
          return (
            <div key={bottle.id}>
              <div className={`rounded-xl bg-white border p-4 ${isEditing ? 'border-orange-300' : 'border-zinc-200'}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="font-mono font-bold text-lg text-zinc-900">{bottle.bottle_id}</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-zinc-600 mb-3">
                  <p className="font-medium text-zinc-800">{bottle.department_name ?? '—'}</p>
                  <p>{bottle.cylinder_type ? CYLINDER_TYPE_LABELS[bottle.cylinder_type] ?? bottle.cylinder_type : '—'} · {bottle.psi ?? '—'} PSI</p>
                  <p>Last Requal: {bottle.last_requal_date ? new Date(bottle.last_requal_date).toLocaleDateString() : '—'}</p>
                  <p>{fillCounts[bottle.bottle_id] ?? 0} fill{(fillCounts[bottle.bottle_id] ?? 0) !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-4 pt-2 border-t border-zinc-100">
                  <button
                    onClick={() => isEditing ? cancelEdit() : startEdit(bottle)}
                    className="text-sm font-medium text-orange-600 hover:text-orange-800"
                  >
                    {isEditing ? 'Cancel Edit' : 'Edit'}
                  </button>
                  <QrPrintLabel
                    code={bottle.bottle_id}
                    type="bottle"
                    title={bottle.bottle_id}
                    subtitle={bottle.department_name ?? undefined}
                    buttonClassName="text-sm font-medium text-zinc-500 hover:text-zinc-700"
                  />
                </div>
              </div>
              {isEditing && (
                <div className="mt-2 ml-2">
                  <EditForm bottle={bottle} {...editFormProps} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Desktop table ────────────────────────────────────────────────────── */}
      <div className="hidden sm:block rounded-xl bg-white shadow-sm border border-zinc-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-zinc-600">Bottle ID</th>
              <th className="px-4 py-3 text-left font-semibold text-zinc-600">Department</th>
              <th className="px-4 py-3 text-left font-semibold text-zinc-600">Type</th>
              <th className="px-4 py-3 text-left font-semibold text-zinc-600">Last Requal</th>
              <th className="px-4 py-3 text-left font-semibold text-zinc-600">Fills</th>
              <th className="px-4 py-3 text-left font-semibold text-zinc-600">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-zinc-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {bottles.map(bottle => {
              const status = getStatus(bottle)
              const isEditing = editingBottleId === bottle.bottle_id
              return (
                <>
                  <tr key={bottle.id} className={`hover:bg-zinc-50 ${isEditing ? 'bg-orange-50' : ''}`}>
                    <td className="px-4 py-3 font-mono font-bold text-zinc-900">{bottle.bottle_id}</td>
                    <td className="px-4 py-3 text-zinc-500">{bottle.department_name ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-500">{bottle.cylinder_type ? CYLINDER_TYPE_LABELS[bottle.cylinder_type] ?? bottle.cylinder_type : '—'}</td>
                    <td className="px-4 py-3 text-zinc-500">{bottle.last_requal_date ? new Date(bottle.last_requal_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-zinc-500">{fillCounts[bottle.bottle_id] ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <QrPrintLabel
                          code={bottle.bottle_id}
                          type="bottle"
                          title={bottle.bottle_id}
                          subtitle={bottle.department_name ?? undefined}
                          buttonClassName="text-xs font-medium text-orange-600 hover:underline print:hidden"
                        />
                        <button
                          onClick={() => isEditing ? cancelEdit() : startEdit(bottle)}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-800 print:hidden"
                        >
                          {isEditing ? 'Cancel' : 'Edit'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr key={`${bottle.id}-edit`}>
                      <td colSpan={7} className="px-4 py-4 bg-orange-50 border-b border-orange-100">
                        <EditForm bottle={bottle} {...editFormProps} />
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
