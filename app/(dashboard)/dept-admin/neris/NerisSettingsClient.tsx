'use client'

import { useState } from 'react'
import { saveDeptAdminNerisEntityId } from '@/app/actions/departments'

export default function NerisSettingsClient({
  departmentId,
  nerisEntityId: initial,
}: {
  departmentId: string
  nerisEntityId: string | null
}) {
  const [entityId, setEntityId] = useState(initial ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSave() {
    setLoading(true); setError(null); setSuccess(null)
    const result = await saveDeptAdminNerisEntityId(departmentId, entityId.trim())
    if (result?.error) setError(result.error)
    else setSuccess('NERIS Entity ID saved.')
    setLoading(false)
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">NERIS Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Configure your department&apos;s NERIS incident reporting connection.</p>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>}

      <div className="rounded-xl bg-white border border-zinc-200 p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">NERIS Entity ID</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Your department&apos;s NERIS entity ID assigned by FSRI (e.g. FD35049607).
            Required to submit incidents to the NERIS API.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={entityId}
            onChange={e => setEntityId(e.target.value)}
            placeholder="e.g. FD35049607"
            className="w-64 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <button
            onClick={handleSave}
            disabled={loading}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
        {initial && (
          <p className="text-xs text-zinc-400">Current: <span className="font-mono">{initial}</span></p>
        )}
      </div>
    </div>
  )
}
