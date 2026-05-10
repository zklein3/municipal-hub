'use client'

import { useState } from 'react'
import { updateDepartmentModules } from '@/app/actions/departments'

interface Bundle {
  key: 'module_operations' | 'module_iso' | 'public_site_enabled'
  label: string
  description: string
  features: string[]
  enabled: boolean
}

export default function ModulesTab({
  departmentId,
  moduleOperations,
  moduleIso,
  publicSiteEnabled,
}: {
  departmentId: string
  moduleOperations: boolean
  moduleIso: boolean
  publicSiteEnabled: boolean
}) {
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState({
    module_operations: moduleOperations,
    module_iso: moduleIso,
    public_site_enabled: publicSiteEnabled,
  })

  async function handleToggle(key: Bundle['key']) {
    setSaving(key)
    setError(null)
    const newValue = !state[key]
    const result = await updateDepartmentModules(departmentId, { [key]: newValue })
    if (result?.error) {
      setError(result.error)
    } else {
      setState(prev => ({ ...prev, [key]: newValue }))
    }
    setSaving(null)
  }

  const bundles: Bundle[] = [
    {
      key: 'module_operations',
      label: 'Bundle A — Operations',
      description: 'Incident reporting, run sheet PDF import, and NERIS API submission.',
      features: ['Incident log & reporting', 'Run sheet PDF import (AI-parsed)', 'NERIS compliance & API submission', 'Incident-level apparatus & personnel tracking'],
      enabled: state.module_operations,
    },
    {
      key: 'module_iso',
      label: 'Bundle B — ISO / Compliance',
      description: 'ISO grading tools including hose inventory, hydrant tracking, and the ISO report.',
      features: ['Hose inventory & testing records', 'Hydrant tracking', 'ISO audit report'],
      enabled: state.module_iso,
    },
    {
      key: 'public_site_enabled',
      label: 'Bundle C — Public Engagement',
      description: 'Public-facing website, burn permits, records requests, and public inbox.',
      features: ['Public department website', 'Online burn permit requests', 'Public records requests', 'Public inbox (officer-managed)'],
      enabled: state.public_site_enabled,
    },
  ]

  const baseFeatures = [
    'Personnel & roster management',
    'Apparatus & station management',
    'Equipment & inventory',
    'Inspections',
    'Events, attendance & training certifications',
    'Announcements',
    'Basic reports',
  ]

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Base */}
      <div className="rounded-xl bg-white border border-zinc-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Base — Always Included</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Core features enabled for all departments.</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Active</span>
        </div>
        <ul className="space-y-1">
          {baseFeatures.map(f => (
            <li key={f} className="flex items-center gap-2 text-sm text-zinc-600">
              <span className="text-green-500">✓</span> {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Bundles */}
      {bundles.map(bundle => (
        <div key={bundle.key} className="rounded-xl bg-white border border-zinc-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-zinc-900">{bundle.label}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{bundle.description}</p>
              <ul className="mt-3 space-y-1">
                {bundle.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-600">
                    <span className={bundle.enabled ? 'text-green-500' : 'text-zinc-300'}>✓</span>
                    <span className={bundle.enabled ? '' : 'text-zinc-400'}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                bundle.enabled ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
              }`}>
                {bundle.enabled ? 'Enabled' : 'Disabled'}
              </span>
              <button
                onClick={() => handleToggle(bundle.key)}
                disabled={saving === bundle.key}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                  bundle.enabled
                    ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    : 'bg-red-700 text-white hover:bg-red-800'
                }`}
              >
                {saving === bundle.key ? 'Saving…' : bundle.enabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
