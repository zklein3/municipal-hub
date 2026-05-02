'use client'

import { useState } from 'react'
import { createCompartmentName, updateCompartmentName, bulkSetCompartmentApparatus } from '@/app/actions/compartments'

interface Compartment {
  id: string
  compartment_code: string
  compartment_name: string | null
  sort_order: number | null
  active: boolean
}

interface Apparatus {
  id: string
  unit_number: string
  apparatus_name: string | null
}

export default function CompartmentsClient({
  compartments,
  usageMap,
  assignmentMap,
  apparatus,
  departmentName,
  departmentId,
}: {
  compartments: Compartment[]
  usageMap: Record<string, number>
  assignmentMap: Record<string, string[]>
  apparatus: Apparatus[]
  departmentName: string
  departmentId: string
}) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assignChecked, setAssignChecked] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCreate(formData: FormData) {
    setError(null); setSuccess(null); setLoading(true)
    const result = await createCompartmentName(formData)
    if (result?.error) setError(result.error)
    else { setSuccess('Compartment added.'); setShowForm(false) }
    setLoading(false)
  }

  async function handleUpdate(formData: FormData) {
    setError(null); setSuccess(null); setLoading(true)
    const result = await updateCompartmentName(formData)
    if (result?.error) setError(result.error)
    else { setSuccess('Compartment updated.'); setEditingId(null) }
    setLoading(false)
  }

  function openAssign(compartmentId: string) {
    setAssigningId(compartmentId)
    setAssignChecked(new Set(assignmentMap[compartmentId] ?? []))
    setError(null)
    setSuccess(null)
    setEditingId(null)
  }

  function closeAssign() {
    setAssigningId(null)
    setAssignChecked(new Set())
  }

  function toggleApparatus(apparatusId: string) {
    setAssignChecked(prev => {
      const next = new Set(prev)
      if (next.has(apparatusId)) next.delete(apparatusId)
      else next.add(apparatusId)
      return next
    })
  }

  async function handleSaveAssignments() {
    if (!assigningId) return
    setError(null); setSuccess(null); setLoading(true)
    const result = await bulkSetCompartmentApparatus(
      assigningId,
      Array.from(assignChecked),
      departmentId
    )
    if (result?.error) setError(result.error)
    else { setSuccess('Apparatus assignments saved.'); closeAssign() }
    setLoading(false)
  }

  const sorted = [...compartments].sort((a, b) => {
    if (a.sort_order !== null && b.sort_order !== null) return a.sort_order - b.sort_order
    if (a.sort_order !== null) return -1
    if (b.sort_order !== null) return 1
    return a.compartment_code.localeCompare(b.compartment_code)
  })

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Compartments</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{departmentName} — {compartments.length} compartment{compartments.length !== 1 ? 's' : ''} defined</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(null); setSuccess(null); closeAssign(); setEditingId(null) }}
          className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">{success}</div>
      )}

      {/* Info box */}
      <div className="mb-6 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
        Compartment names are department-wide templates. Once defined here they can be assigned to any apparatus in your department. Use the code as a short label (e.g. <span className="font-mono font-semibold">D1</span>, <span className="font-mono font-semibold">OFC</span>) and the name as a description (e.g. <span className="font-semibold">Driver Side 1</span>).
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="mb-6 rounded-xl bg-white p-5 shadow-sm border border-zinc-200">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">Add Compartment</h2>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>
          )}
          <form action={handleCreate} className="flex flex-col gap-4">
            <div className="flex gap-3">
              <div className="w-32">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Code <span className="text-red-500">*</span></label>
                <input name="compartment_code" type="text" required
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono uppercase focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="D1" />
                <p className="mt-1 text-xs text-zinc-400">Short label</p>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Name / Description</label>
                <input name="compartment_name" type="text"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Driver Side 1" />
              </div>
              <div className="w-24">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Sort Order</label>
                <input name="sort_order" type="number" min="1"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="1" />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
              {loading ? 'Adding...' : 'Add Compartment'}
            </button>
          </form>
        </div>
      )}

      {/* Compartments List */}
      <div className="rounded-xl bg-white shadow-sm border border-zinc-200 overflow-hidden">
        {sorted.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-400">
            No compartments defined yet. Add one above.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {sorted.map(c => (
              <div key={c.id}>
                {editingId === c.id ? (
                  <div className="p-4">
                    <form action={handleUpdate} className="flex flex-col gap-3">
                      <input type="hidden" name="id" value={c.id} />
                      <div className="flex gap-3">
                        <div className="w-32">
                          <label className="mb-1 block text-xs font-medium text-zinc-700">Code</label>
                          <input name="compartment_code" type="text" required defaultValue={c.compartment_code}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono uppercase focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                        </div>
                        <div className="flex-1">
                          <label className="mb-1 block text-xs font-medium text-zinc-700">Name</label>
                          <input name="compartment_name" type="text" defaultValue={c.compartment_name ?? ''}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                        </div>
                        <div className="w-24">
                          <label className="mb-1 block text-xs font-medium text-zinc-700">Sort</label>
                          <input name="sort_order" type="number" defaultValue={c.sort_order ?? ''}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                        </div>
                        <div className="w-28">
                          <label className="mb-1 block text-xs font-medium text-zinc-700">Status</label>
                          <select name="active" defaultValue={c.active ? 'true' : 'false'}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                          </select>
                        </div>
                      </div>
                      {error && (
                        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>
                      )}
                      <div className="flex gap-2">
                        <button type="submit" disabled={loading}
                          className="flex-1 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                          {loading ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" onClick={() => { setEditingId(null); setError(null) }}
                          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                ) : assigningId === c.id ? (
                  /* Assign to Apparatus panel */
                  <div className="p-4 bg-zinc-50">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-zinc-800">
                        Assign <span className="font-mono text-red-700">{c.compartment_code}</span> to apparatus
                      </p>
                      <button onClick={closeAssign} className="text-xs text-zinc-400 hover:text-zinc-600">Cancel</button>
                    </div>
                    {apparatus.length === 0 ? (
                      <p className="text-sm text-zinc-400">No active apparatus in this department.</p>
                    ) : (
                      <div className="flex flex-col gap-2 mb-4">
                        {apparatus.map(a => (
                          <label key={a.id} className="flex items-center gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={assignChecked.has(a.id)}
                              onChange={() => toggleApparatus(a.id)}
                              className="h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-500 cursor-pointer"
                            />
                            <span className="text-sm text-zinc-700 group-hover:text-zinc-900">
                              Unit {a.unit_number}{a.apparatus_name ? ` — ${a.apparatus_name}` : ''}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    {error && (
                      <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">{error}</div>
                    )}
                    {apparatus.length > 0 && (
                      <button onClick={handleSaveAssignments} disabled={loading}
                        className="w-full rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                        {loading ? 'Saving...' : 'Save Assignments'}
                      </button>
                    )}
                  </div>
                ) : (
                  /* Display row */
                  <div className="flex items-center px-5 py-4 hover:bg-zinc-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center rounded-lg bg-red-50 border border-red-100 px-2.5 py-1 text-sm font-mono font-bold text-red-700">
                          {c.compartment_code}
                        </span>
                        {c.compartment_name && (
                          <span className="text-sm text-zinc-600">{c.compartment_name}</span>
                        )}
                        {!c.active && (
                          <span className="text-xs rounded-full bg-zinc-100 text-zinc-400 px-2 py-0.5">Inactive</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        {usageMap[c.id] ? `Used on ${usageMap[c.id]} apparatus` : 'Not assigned to any apparatus'}
                        {c.sort_order !== null && ` · Sort: ${c.sort_order}`}
                      </p>
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                      <button
                        onClick={() => openAssign(c.id)}
                        className="text-xs font-semibold text-zinc-500 hover:text-zinc-700"
                      >
                        Assign
                      </button>
                      <button
                        onClick={() => { setEditingId(c.id); setError(null); setSuccess(null); closeAssign() }}
                        className="text-xs font-semibold text-red-600 hover:text-red-800"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
