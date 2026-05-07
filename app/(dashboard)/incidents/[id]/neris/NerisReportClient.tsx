'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveNerisReport, saveApparatusResponseMode } from '@/app/actions/neris'
import {
  getFilteredIncidentTypes,
  getIncidentTypeLabel,
  getPropertyUseLabel,
  NERIS_PROPERTY_USE,
  NERIS_ACTIONS_TAKEN,
  NERIS_RESPONSE_MODE,
  NERIS_FIRE_CONDITION_ARRIVAL,
  NERIS_BUILDING_DAMAGE,
  NERIS_SUPPRESSION_APPLIANCE,
  NERIS_FIRE_CAUSE_IN,
  NERIS_FIRE_CAUSE_OUT,
  COVER_TYPE_LABEL,
} from '@/lib/neris-value-sets'

const inputCls = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
const labelCls = "block text-sm font-medium text-zinc-700 mb-1"
const sectionCls = "rounded-xl bg-white border border-zinc-200 p-5 space-y-4"

function formatDT(dt: string | null) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}

const COVER_TYPE_LABELS: Record<string, string> = {
  fire: 'Fire', rescue: 'Rescue', standby: 'Standby',
  mutual_aid: 'Mutual Aid', special: 'Special', other: 'Other',
}
const FIRE_SUBTYPE_LABELS: Record<string, string> = {
  structure: 'Structure Fire', vehicle: 'Vehicle Fire', grass: 'Grass Fire',
  wildland: 'Wildland Fire', other_fire: 'Other Fire',
}
const APPARATUS_ROLE_LABELS: Record<string, string> = {
  primary: 'Primary', support: 'Support', staging: 'Staging',
}

export default function NerisReportClient({
  incident,
  fireDetails,
  incidentApparatus,
  incidentPersonnel,
  nerisRecord,
  isAdmin,
}: {
  incident: any
  fireDetails: any
  incidentApparatus: { id: string; apparatus_id: string; unit_number: string; apparatus_name: string | null; role: string; response_mode: string | null; paged_at: string | null; on_scene_at: string | null; leaving_scene_at: string | null; available_at: string | null }[]
  incidentPersonnel: { id: string; personnel_id: string; role: string; name: string }[]
  nerisRecord: any
  isAdmin: boolean
}) {
  const router = useRouter()
  const isFireType = incident.incident_type === 'fire'
  const isOutsideFire = ['grass', 'wildland', 'other_fire'].includes(incident.fire_subtype ?? '')
  const isSubmitted = nerisRecord?.neris_status === 'submitted'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // NERIS core fields
  const [nerisType, setNerisType] = useState<number | ''>(nerisRecord?.neris_incident_type ?? '')
  const [propertyUse, setPropertyUse] = useState<string>(nerisRecord?.property_use ?? '')
  const [displacedPersons, setDisplacedPersons] = useState<string>(
    nerisRecord?.displaced_persons != null ? String(nerisRecord.displaced_persons) : ''
  )
  const [actionsTaken, setActionsTaken] = useState<string[]>(nerisRecord?.actions_taken ?? [])

  // Fire module fields
  const [fireCondition, setFireCondition] = useState<string>(nerisRecord?.fire_condition_arrival ?? '')
  const [buildingDamage, setBuildingDamage] = useState<string>(nerisRecord?.building_damage ?? '')
  const [suppressionAppliances, setSuppressionAppliances] = useState<string[]>(nerisRecord?.suppression_appliance ?? [])
  const [floorOfOrigin, setFloorOfOrigin] = useState<string>(
    nerisRecord?.floor_of_origin != null ? String(nerisRecord.floor_of_origin) : ''
  )
  const [roomOfOrigin, setRoomOfOrigin] = useState<string>(nerisRecord?.room_of_origin ?? '')
  const [fireCauseCode, setFireCauseCode] = useState<string>(nerisRecord?.fire_cause_code ?? '')

  // Response modes per apparatus (apparatus incident row id → mode)
  const [responseModes, setResponseModes] = useState<Record<string, string>>(
    Object.fromEntries(incidentApparatus.map(a => [a.id, a.response_mode ?? '']))
  )
  const [responseModeSaving, setResponseModeSaving] = useState<string | null>(null)

  function toggleAction(code: string) {
    setActionsTaken(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  function toggleAppliance(code: string) {
    setSuppressionAppliances(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)
    const result = await saveNerisReport(incident.id, {
      neris_incident_type: nerisType !== '' ? Number(nerisType) : null,
      property_use: propertyUse || null,
      actions_taken: actionsTaken,
      displaced_persons: displacedPersons !== '' ? parseInt(displacedPersons) : null,
      fire_condition_arrival: isFireType ? fireCondition || null : null,
      building_damage: isFireType ? buildingDamage || null : null,
      suppression_appliance: isFireType ? suppressionAppliances : [],
      floor_of_origin: isFireType && floorOfOrigin !== '' ? parseInt(floorOfOrigin) : null,
      room_of_origin: isFireType ? roomOfOrigin || null : null,
      fire_cause_code: isFireType ? fireCauseCode || null : null,
    })
    if (result?.error) { setError(result.error); setLoading(false); return }
    setSaved(true)
    setLoading(false)
  }

  async function handleResponseModeChange(apparatusIncidentId: string, mode: string) {
    setResponseModes(prev => ({ ...prev, [apparatusIncidentId]: mode }))
    setResponseModeSaving(apparatusIncidentId)
    await saveApparatusResponseMode(apparatusIncidentId, mode)
    setResponseModeSaving(null)
  }

  const filteredIncidentTypes = getFilteredIncidentTypes(incident.incident_type)
  const fireCauseCodes = isOutsideFire ? NERIS_FIRE_CAUSE_OUT : NERIS_FIRE_CAUSE_IN

  return (
    <div>
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            nerisRecord?.neris_status === 'submitted' ? 'bg-green-100 text-green-700' :
            nerisRecord?.completed_at ? 'bg-blue-100 text-blue-700' :
            'bg-zinc-100 text-zinc-500'
          }`}>
            NERIS — {nerisRecord?.neris_status === 'submitted' ? 'Submitted' : nerisRecord?.completed_at ? 'Completed' : 'Draft'}
          </span>
        </div>
        <h1 className="text-xl font-bold text-zinc-900">NERIS Report</h1>
        <p className="text-sm text-zinc-500">
          Incident #{incident.incident_number ?? '—'} · {formatDate(incident.incident_date)}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          type="button"
          onClick={() => router.push(`/incidents/${incident.id}`)}
          className="rounded-lg bg-white border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
        >
          ← Back to Incident
        </button>
      </div>

      {/* Cover sheet summary — read-only reference */}
      <div className={`${sectionCls} mb-4 bg-zinc-50`}>
        <h2 className="text-sm font-semibold text-zinc-700">Cover Sheet (read-only reference)</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-zinc-400 text-xs">Type</span>
            <p className="font-medium text-zinc-800">
              {COVER_TYPE_LABELS[incident.incident_type] ?? incident.incident_type}
              {incident.fire_subtype ? ` — ${FIRE_SUBTYPE_LABELS[incident.fire_subtype] ?? incident.fire_subtype}` : ''}
            </p>
          </div>
          <div>
            <span className="text-zinc-400 text-xs">Address</span>
            <p className="font-medium text-zinc-800">{incident.address ?? '—'}</p>
          </div>
          <div>
            <span className="text-zinc-400 text-xs">Call Time</span>
            <p className="font-medium text-zinc-800">{formatDT(incident.call_time)}</p>
          </div>
          <div>
            <span className="text-zinc-400 text-xs">First On Scene</span>
            <p className="font-medium text-zinc-800">{formatDT(incident.first_on_scene_at)}</p>
          </div>
          {incident.narrative && (
            <div className="col-span-2">
              <span className="text-zinc-400 text-xs">Narrative</span>
              <p className="font-medium text-zinc-800 line-clamp-2">{incident.narrative}</p>
            </div>
          )}
        </div>
      </div>

      {isSubmitted && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          This report has been submitted to NERIS (ID: {nerisRecord.neris_submission_id ?? '—'}) and is locked for editing.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {saved && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Saved successfully.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">

        {/* NERIS Core — Incident Type */}
        <section className={sectionCls}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">NERIS Incident Type</h2>
            <span className="text-xs text-zinc-400">
              Filtered for: {COVER_TYPE_LABEL[incident.incident_type] ?? incident.incident_type}
            </span>
          </div>
          {nerisType && (
            <p className="text-xs text-zinc-500 -mt-1">
              Selected: <span className="font-semibold text-zinc-700">{getIncidentTypeLabel(Number(nerisType))}</span>
            </p>
          )}
          <select
            value={nerisType}
            onChange={e => setNerisType(e.target.value ? Number(e.target.value) : '')}
            disabled={isSubmitted}
            className={inputCls}
          >
            <option value="">Select NERIS incident type…</option>
            {filteredIncidentTypes.map(group => (
              <optgroup key={group.group} label={group.group}>
                {group.codes.map(c => (
                  <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-xs text-zinc-400">
            Showing types relevant to "{COVER_TYPE_LABELS[incident.incident_type] ?? incident.incident_type}" incidents.
            If none match, all types are available —
            <button type="button" onClick={() => {}} className="ml-1 underline text-zinc-500">show all</button>.
          </p>
        </section>

        {/* Property Use + Displaced Persons */}
        <section className={sectionCls}>
          <h2 className="text-sm font-semibold text-zinc-900">Scene Information</h2>
          <div>
            <label className={labelCls}>Property Use</label>
            {propertyUse && (
              <p className="text-xs text-zinc-500 mb-1">{getPropertyUseLabel(propertyUse)}</p>
            )}
            <select
              value={propertyUse}
              onChange={e => setPropertyUse(e.target.value)}
              disabled={isSubmitted}
              className={inputCls}
            >
              <option value="">Select property use…</option>
              {NERIS_PROPERTY_USE.map(group => (
                <optgroup key={group.group} label={group.group}>
                  {group.codes.map(c => (
                    <option key={c.code} value={String(c.code)}>{c.code} — {c.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Displaced Persons</label>
            <input
              type="number"
              min={0}
              value={displacedPersons}
              onChange={e => setDisplacedPersons(e.target.value)}
              disabled={isSubmitted}
              placeholder="0"
              className={inputCls}
            />
          </div>
        </section>

        {/* Actions Taken */}
        <section className={sectionCls}>
          <h2 className="text-sm font-semibold text-zinc-900">Actions Taken on Scene</h2>
          {actionsTaken.length > 0 && (
            <p className="text-xs text-zinc-500">{actionsTaken.length} action{actionsTaken.length !== 1 ? 's' : ''} selected</p>
          )}
          <div className="space-y-3">
            {NERIS_ACTIONS_TAKEN.map(group => (
              <div key={group.group}>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">{group.group}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {group.codes.map(c => (
                    <label key={String(c.code)} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={actionsTaken.includes(String(c.code))}
                        onChange={() => !isSubmitted && toggleAction(String(c.code))}
                        disabled={isSubmitted}
                        className="rounded border-zinc-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-zinc-700 group-hover:text-zinc-900">{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Apparatus — Response Mode */}
        {incidentApparatus.length > 0 && (
          <section className={sectionCls}>
            <h2 className="text-sm font-semibold text-zinc-900">Apparatus Response Mode</h2>
            <p className="text-xs text-zinc-400 -mt-1">Set per-unit whether response was emergent (lights &amp; siren) or non-emergent.</p>
            <div className="divide-y divide-zinc-100">
              {incidentApparatus.map(a => (
                <div key={a.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      Unit {a.unit_number}{a.apparatus_name ? ` — ${a.apparatus_name}` : ''}
                    </p>
                    <p className="text-xs text-zinc-400 capitalize">{APPARATUS_ROLE_LABELS[a.role] ?? a.role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {responseModeSaving === a.id && (
                      <span className="text-xs text-zinc-400">Saving…</span>
                    )}
                    <select
                      value={responseModes[a.id] ?? ''}
                      onChange={e => handleResponseModeChange(a.id, e.target.value)}
                      disabled={isSubmitted}
                      className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="">Select…</option>
                      {NERIS_RESPONSE_MODE.map(m => (
                        <option key={String(m.code)} value={String(m.code)}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Personnel summary — read-only */}
        {incidentPersonnel.length > 0 && (
          <section className={sectionCls}>
            <h2 className="text-sm font-semibold text-zinc-900">Personnel on Scene</h2>
            <p className="text-xs text-zinc-400 -mt-1">From cover sheet — flows directly to NERIS payload.</p>
            <div className="flex flex-wrap gap-1.5">
              {incidentPersonnel.map(p => (
                <span key={p.id} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700">
                  {p.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Fire Module */}
        {isFireType && (
          <section className={sectionCls}>
            <h2 className="text-sm font-semibold text-zinc-900">Fire Module</h2>

            <div>
              <label className={labelCls}>Condition on Arrival</label>
              <select value={fireCondition} onChange={e => setFireCondition(e.target.value)} disabled={isSubmitted} className={inputCls}>
                <option value="">Select…</option>
                {NERIS_FIRE_CONDITION_ARRIVAL.map(c => (
                  <option key={String(c.code)} value={String(c.code)}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Building Damage</label>
              <select value={buildingDamage} onChange={e => setBuildingDamage(e.target.value)} disabled={isSubmitted} className={inputCls}>
                <option value="">Select…</option>
                {NERIS_BUILDING_DAMAGE.map(c => (
                  <option key={String(c.code)} value={String(c.code)}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Fire Cause</label>
              <p className="text-xs text-zinc-400 mb-1.5">
                {isOutsideFire ? 'Outside / vegetation fire cause' : 'Interior / structure fire cause'}
              </p>
              <select value={fireCauseCode} onChange={e => setFireCauseCode(e.target.value)} disabled={isSubmitted} className={inputCls}>
                <option value="">Select…</option>
                {fireCauseCodes.map(c => (
                  <option key={String(c.code)} value={String(c.code)}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Floor of Origin</label>
                <input
                  type="number"
                  value={floorOfOrigin}
                  onChange={e => setFloorOfOrigin(e.target.value)}
                  disabled={isSubmitted}
                  placeholder="e.g. 1"
                  min={0}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Room / Area of Origin</label>
                <input
                  type="text"
                  value={roomOfOrigin}
                  onChange={e => setRoomOfOrigin(e.target.value)}
                  disabled={isSubmitted}
                  placeholder="e.g. Kitchen"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Suppression Appliances Used</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                {NERIS_SUPPRESSION_APPLIANCE.map(c => (
                  <label key={String(c.code)} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={suppressionAppliances.includes(String(c.code))}
                      onChange={() => !isSubmitted && toggleAppliance(String(c.code))}
                      disabled={isSubmitted}
                      className="rounded border-zinc-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-zinc-700">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Cover sheet fire details — read-only */}
            {fireDetails && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3">
                <p className="text-xs font-semibold text-zinc-500 mb-2">Cover Sheet Fire Details (flows to NERIS)</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-600">
                  {fireDetails.dollar_loss != null && <div><span className="text-zinc-400">Dollar loss: </span>${Number(fireDetails.dollar_loss).toLocaleString()}</div>}
                  {fireDetails.injuries_civilian != null && <div><span className="text-zinc-400">Civilian injuries: </span>{fireDetails.injuries_civilian}</div>}
                  {fireDetails.injuries_firefighter != null && <div><span className="text-zinc-400">FF injuries: </span>{fireDetails.injuries_firefighter}</div>}
                  {fireDetails.fatalities != null && <div><span className="text-zinc-400">Fatalities: </span>{fireDetails.fatalities}</div>}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Save */}
        {!isSubmitted && (
          <div className="flex gap-3 pb-8">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving…' : 'Save NERIS Report'}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/incidents/${incident.id}`)}
              className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
