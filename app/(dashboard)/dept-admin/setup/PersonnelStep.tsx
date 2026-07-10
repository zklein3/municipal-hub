'use client'

import { useState } from 'react'
import { createDeptMember } from '@/app/actions/users'
import { updateDeptPersonnel } from '@/app/actions/personnel'
import HelpPrompt from './HelpPrompt'

interface Role { id: string; name: string; is_officer: boolean; sort_order: number }
interface PersonnelRecord {
  id: string
  system_role: string
  signup_status: string
  active: boolean
  employee_number: string | null
  hire_date: string | null
  role_id: string | null
  personnel_id: string
  personnel: { id: string; first_name: string; last_name: string; email: string; signup_status: string } | null
  personnel_roles: { name: string; is_officer: boolean } | null
}

const ROLE_STYLES: Record<string, string> = {
  admin:   'bg-red-100 text-red-700',
  officer: 'bg-blue-100 text-blue-700',
  member:  'bg-zinc-100 text-zinc-600',
}

const STATUS_STYLES: Record<string, string> = {
  active:            'bg-green-100 text-green-700',
  temp_password:     'bg-yellow-100 text-yellow-700',
  profile_setup:     'bg-blue-100 text-blue-700',
  awaiting_approval: 'bg-orange-100 text-orange-700',
  denied:            'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  active:            'Active',
  temp_password:     'Temp Password',
  profile_setup:     'Profile Setup',
  awaiting_approval: 'Pending',
  denied:            'Denied',
}

export default function PersonnelStep({
  personnel,
  roles,
  departmentId,
  showHelp,
  helpResetKey,
}: {
  personnel: PersonnelRecord[]
  roles: Role[]
  departmentId: string
  showHelp: boolean
  helpResetKey: number
}) {
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCreate(formData: FormData) {
    setError(null); setSuccess(null); setLoading(true)
    const result = await createDeptMember(formData)
    if (result?.error) setError(result.error)
    else {
      setSuccess(
        result?.emailSent
          ? 'Personnel added. A welcome email with login instructions was sent.'
          : `Personnel added. Temporary password: ${result?.tempPassword ?? 'Hello1!'} — share this with them directly.`
      )
      setShowForm(false)
    }
    setLoading(false)
  }

  async function handleUpdate(formData: FormData) {
    setError(null); setSuccess(null); setLoading(true)
    const result = await updateDeptPersonnel(formData)
    if (result?.error) setError(result.error)
    else setEditingId(null)
    setLoading(false)
  }

  const roleOrder: Record<string, number> = { admin: 0, officer: 1, member: 2 }
  const sorted = [...personnel].sort((a, b) => (roleOrder[a.system_role] ?? 9) - (roleOrder[b.system_role] ?? 9))
  const q = search.toLowerCase()
  const filteredPersonnel = q ? sorted.filter(r => {
    const p = r.personnel
    return (p ? `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) : false) ||
      (p?.email ?? '').toLowerCase().includes(q)
  }) : sorted

  return (
    <div>
      <HelpPrompt id="personnel" showHelp={showHelp} helpResetKey={helpResetKey}>
        Add members here. New accounts are created with a temporary password — the member must change it on first login.
      </HelpPrompt>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Personnel</h2>
          <p className="text-sm text-zinc-500">{personnel.filter(p => p.active).length} active</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setError(null); setSuccess(null) }}
          className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Personnel'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">{success}</div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="mb-4 rounded-xl bg-white p-5 shadow-sm border border-zinc-200">
          <p className="text-sm font-semibold text-zinc-900 mb-1">Add Personnel</p>
          <p className="text-xs text-zinc-500 mb-4">
            A temporary password is generated and must be changed on first login.
          </p>
          <form action={handleCreate} className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-600">First Name</label>
                <input name="first_name" type="text" placeholder="Optional"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-600">Last Name</label>
                <input name="last_name" type="text" placeholder="Optional"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Email <span className="text-red-500">*</span></label>
              <input name="email" type="email" required placeholder="member@department.com"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
            </div>
            <div className="flex gap-3">
              <div className="w-44">
                <label className="mb-1 block text-xs font-medium text-zinc-600">Access Level <span className="text-red-500">*</span></label>
                <select name="system_role" required defaultValue="member"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                  <option value="admin">Admin</option>
                  <option value="officer">Officer</option>
                  <option value="member">Member</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-600">Title / Rank</label>
                <select name="role_id"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                  <option value="">Select title...</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-44">
                <label className="mb-1 block text-xs font-medium text-zinc-600">Employee #</label>
                <input name="employee_number" type="text" placeholder="Optional"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-600">Hire Date</label>
                <input name="hire_date" type="date"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="send_welcome_email" value="true" defaultChecked className="mt-0.5" />
              <span>
                Send welcome email with a random temporary password
                <span className="block text-xs text-zinc-500">Uncheck for test/demo accounts — uses the default password Hello1! and sends no email.</span>
              </span>
            </label>
            <button type="submit" disabled={loading}
              className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
              {loading ? 'Adding...' : 'Add Personnel'}
            </button>
          </form>
        </div>
      )}

      {sorted.length > 0 && (
        <input type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search personnel..."
          className="w-full mb-4 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
      )}

      {/* Cards */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-6 py-12 text-center text-sm text-zinc-400">
          No personnel yet — add your first member above.
        </div>
      ) : filteredPersonnel.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-6 py-12 text-center text-sm text-zinc-400">No personnel match "{search}".</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredPersonnel.map(record => {
            const p = record.personnel
            const name = p ? `${p.first_name} ${p.last_name}`.trim() : '—'
            const status = p?.signup_status ?? record.signup_status

            return (
              <div key={record.id} className={`rounded-xl bg-white border shadow-sm ${
                record.active ? 'border-zinc-200' : 'border-zinc-100 opacity-60'
              }`}>
                {editingId === record.id ? (
                  <div className="p-5">
                    <p className="text-sm font-semibold text-zinc-900 mb-1">{name || 'Edit Member'}</p>
                    {p?.email && <p className="text-xs text-zinc-500 mb-4">{p.email}</p>}
                    <form action={handleUpdate} className="flex flex-col gap-3">
                      <input type="hidden" name="dept_personnel_id" value={record.id} />
                      <input type="hidden" name="personnel_id" value={record.personnel_id} />
                      <div className="flex gap-3">
                        <div className="w-44">
                          <label className="mb-1 block text-xs font-medium text-zinc-600">Access Level</label>
                          <select name="system_role" defaultValue={record.system_role}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                            <option value="admin">Admin</option>
                            <option value="officer">Officer</option>
                            <option value="member">Member</option>
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="mb-1 block text-xs font-medium text-zinc-600">Title / Rank</label>
                          <select name="role_id" defaultValue={record.role_id ?? ''}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                            <option value="">Select title...</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-44">
                          <label className="mb-1 block text-xs font-medium text-zinc-600">Employee #</label>
                          <input name="employee_number" type="text" defaultValue={record.employee_number ?? ''}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                        </div>
                        <div className="flex-1">
                          <label className="mb-1 block text-xs font-medium text-zinc-600">Hire Date</label>
                          <input name="hire_date" type="date" defaultValue={record.hire_date ?? ''}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-600">Status</span>
                        <select name="active" defaultValue={record.active ? 'true' : 'false'}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button type="submit" disabled={loading}
                          className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                          {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)}
                          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-zinc-900">{name || '(No name yet)'}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[record.system_role] ?? 'bg-zinc-100 text-zinc-600'}`}>
                          {record.system_role.charAt(0).toUpperCase() + record.system_role.slice(1)}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-zinc-100 text-zinc-500'}`}>
                          {STATUS_LABELS[status] ?? status}
                        </span>
                      </div>
                      {p?.email && <p className="text-xs text-zinc-500">{p.email}</p>}
                      <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-zinc-400">
                        {record.personnel_roles?.name && <span>{record.personnel_roles.name}</span>}
                        {record.employee_number && <span>Emp# {record.employee_number}</span>}
                        {record.hire_date && <span>Hired {record.hire_date}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => { setEditingId(record.id); setShowForm(false); setError(null); setSuccess(null) }}
                      className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
