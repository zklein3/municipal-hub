'use client'

// Arrange a truck's compartments right on its inventory screen (C4 — one truck screen): add one from
// the department's compartment library, from a preset (comes stocked), or brand new; and per card,
// the compartment's QR code (print / edit) and remove.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  assignCompartmentToApparatus, createCompartmentName, removeCompartmentFromApparatus, setCompartmentQrCode,
} from '@/app/actions/compartments'
import { deployPresetToApparatus } from '@/app/actions/presets'
import QrPrintLabel from '@/components/QrPrintLabel'

const inputCls = 'rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'

export function AddCompartmentPanel({
  apparatusId, library, presets, onClose,
}: {
  apparatusId: string
  library: { id: string; compartment_code: string; compartment_name: string | null }[]
  presets: { id: string; name: string; default_code: string }[]
  onClose: () => void
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'library' | 'preset' | 'new'>(library.length > 0 ? 'library' : presets.length > 0 ? 'preset' : 'new')
  const [pick, setPick] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    setBusy(true); setError(null)
    let err: string | undefined
    if (mode === 'library') {
      const r = await assignCompartmentToApparatus(apparatusId, pick)
      err = r?.error
    } else if (mode === 'preset') {
      const r = await deployPresetToApparatus(pick, [{ apparatus_id: apparatusId, compartment_id: null }])
      err = r.error ?? r.results?.find(x => x.error)?.error
    } else {
      const fd = new FormData()
      fd.set('compartment_code', code)
      fd.set('compartment_name', name)
      const c = await createCompartmentName(fd)
      if (c?.error) err = c.error
      else if ('id' in c && c.id) err = (await assignCompartmentToApparatus(apparatusId, c.id))?.error
    }
    setBusy(false)
    if (err) { setError(err); return }
    router.refresh()
    onClose()
  }

  const ready = mode === 'new' ? !!code.trim() : !!pick
  return (
    <div className="mb-4 rounded-xl bg-white border border-zinc-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-zinc-900">Add a compartment</p>
        <button onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-600">Cancel</button>
      </div>
      <div className="flex gap-1 bg-zinc-50 rounded-lg border border-zinc-200 p-1 mb-3 w-fit text-xs font-semibold">
        {([['library', 'From your compartments'], ['preset', 'From a preset (stocked)'], ['new', 'New']] as const).map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); setPick(''); setError(null) }}
            className={`rounded-md px-3 py-1 ${mode === m ? 'bg-red-700 text-white' : 'text-zinc-600 hover:bg-white'}`}>{label}</button>
        ))}
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-2">
        {mode === 'library' && (
          library.length === 0
            ? <p className="text-sm text-zinc-500">Every compartment in your library is already on this truck — use New.</p>
            : <select value={pick} onChange={e => setPick(e.target.value)} className={`${inputCls} flex-1`}>
                <option value="">Choose a compartment…</option>
                {library.map(c => <option key={c.id} value={c.id}>{c.compartment_code}{c.compartment_name ? ` — ${c.compartment_name}` : ''}</option>)}
              </select>
        )}
        {mode === 'preset' && (
          presets.length === 0
            ? <p className="text-sm text-zinc-500">No presets yet.</p>
            : <select value={pick} onChange={e => setPick(e.target.value)} className={`${inputCls} flex-1`}>
                <option value="">Choose a preset…</option>
                {presets.map(p => <option key={p.id} value={p.id}>{p.name} ({p.default_code})</option>)}
              </select>
        )}
        {mode === 'new' && (<>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Code (e.g. D3)" className={`${inputCls} sm:w-32 font-mono uppercase`} />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (optional)" className={`${inputCls} flex-1`} />
        </>)}
        <button disabled={busy || !ready} onClick={add}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
      {mode === 'preset' && <p className="text-xs text-zinc-400 mt-2">Creates the compartment with the preset&apos;s items and medications; only adds what&apos;s missing if it&apos;s already here.</p>}
    </div>
  )
}

export function CompartmentQrControl({
  compartmentId, apparatusId, qrCode, title, subtitle, canEdit,
}: {
  compartmentId: string
  apparatusId: string
  qrCode: string | null
  title: string
  subtitle: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(qrCode ?? '')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    const fd = new FormData()
    fd.set('qr_code', value)
    const r = await setCompartmentQrCode(compartmentId, apparatusId, fd)
    if (r?.error) { setError(r.error.includes('duplicate') ? 'That code is already used by another compartment.' : r.error); return }
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input value={value} onChange={e => setValue(e.target.value.toUpperCase())} className="w-32 rounded border border-zinc-300 px-2 py-0.5 text-xs font-mono" />
        <button onClick={save} className="text-xs font-semibold text-red-700 hover:underline">Save</button>
        <button onClick={() => setEditing(false)} className="text-xs text-zinc-400 hover:underline">Cancel</button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
      {qrCode ? (
        <>
          <span className="font-mono">QR {qrCode}</span>
          <QrPrintLabel code={qrCode} type="compartment" title={title} subtitle={subtitle}
            buttonClassName="font-semibold text-zinc-500 hover:text-red-700" />
        </>
      ) : <span>No QR code</span>}
      {canEdit && <button onClick={() => setEditing(true)} className="hover:text-zinc-700 underline decoration-dotted">{qrCode ? 'Edit' : 'Set'}</button>}
    </span>
  )
}

export function RemoveCompartmentButton({ compartmentId, apparatusId, label }: { compartmentId: string; apparatusId: string; label: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setBusy(true); setError(null)
    const r = await removeCompartmentFromApparatus(compartmentId, apparatusId)
    setBusy(false)
    if (r?.error) { setError(r.error); return }
    router.refresh()
  }

  if (error) return <span className="text-xs text-red-600">{error} <button onClick={() => { setError(null); setConfirm(false) }} className="underline">OK</button></span>
  if (confirm) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="text-zinc-600">Remove {label}?</span>
        <button disabled={busy} onClick={remove} className="font-semibold text-red-700 hover:underline disabled:opacity-50">{busy ? 'Removing…' : 'Remove'}</button>
        <button onClick={() => setConfirm(false)} className="text-zinc-400 hover:underline">Cancel</button>
      </span>
    )
  }
  return <button onClick={() => setConfirm(true)} className="text-xs text-zinc-400 hover:text-red-600">Remove</button>
}
