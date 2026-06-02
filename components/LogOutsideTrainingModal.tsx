'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { parseTrainingPhoto, submitOutsideTraining } from '@/app/actions/training'

const inputCls = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
const labelCls = "block text-xs font-medium text-zinc-600 mb-1"

const NREMT_CATEGORIES = [
  { value: 'AIRWAY', label: 'Airway, Respiration & Ventilation' },
  { value: 'CARDIOLOGY', label: 'Cardiology & Resuscitation' },
  { value: 'TRAUMA', label: 'Trauma' },
  { value: 'MEDICAL', label: 'Medical; Obstetrics & Gynecology' },
  { value: 'OPERATIONS', label: 'EMS Operations' },
]

const PURPOSE_OPTIONS = [
  { value: 'recert', label: 'Recertification' },
  { value: 'initial_cert', label: 'Initial Certification' },
  { value: 'continuing_ed', label: 'Continuing Education' },
  { value: 'other', label: 'Other' },
]

interface Props {
  onClose: () => void
}

export default function LogOutsideTrainingModal({ onClose }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [topic, setTopic] = useState('')
  const [courseDate, setCourseDate] = useState('')
  const [hours, setHours] = useState('')
  const [provider, setProvider] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [purpose, setPurpose] = useState('')
  const [nrmtCategory, setNrmtCategory] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseMsg, setParseMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setPhotoFile(file)
    setParseMsg(null)
    if (file) {
      const reader = new FileReader()
      reader.onload = ev => setPhotoPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setPhotoPreview(null)
    }
  }

  async function handleParsePhoto() {
    if (!photoFile) return
    setParsing(true)
    setParseMsg(null)
    const fd = new FormData()
    fd.append('photo', photoFile)
    const result = await parseTrainingPhoto(fd)
    setParsing(false)
    if (result.error) { setParseMsg(result.error); return }
    if (result.topic) setTopic(result.topic)
    if (result.course_date) setCourseDate(result.course_date)
    if (result.hours) setHours(result.hours)
    if (result.provider) setProvider(result.provider)
    if (result.location) setLocation(result.location)
    setParseMsg('Fields filled from photo — review and adjust as needed.')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData()
    fd.append('topic', topic)
    fd.append('course_date', courseDate)
    fd.append('hours', hours)
    fd.append('provider', provider)
    fd.append('location', location)
    fd.append('notes', notes)
    fd.append('purpose', purpose)
    fd.append('nremt_category', nrmtCategory)
    if (photoFile) fd.append('photo', photoFile)
    const result = await submitOutsideTraining(fd)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-y-auto max-h-[92dvh]">
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Log Outside Training</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Conference, seminar, or external class</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">

          {/* ── Photo capture ───────────────────────────────────────────────── */}
          <div>
            <p className={labelCls}>Course Document / Certificate <span className="text-zinc-400 font-normal">(optional)</span></p>
            <div className="flex gap-2 items-center flex-wrap">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                {photoFile ? 'Change Photo' : 'Upload Photo'}
              </button>
              {photoFile && !parsing && (
                <button type="button" onClick={handleParsePhoto}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                  Auto-Fill from Photo
                </button>
              )}
              {parsing && <span className="text-xs text-blue-600 animate-pulse">Parsing...</span>}
              {photoFile && <span className="text-xs text-zinc-400 truncate max-w-[160px]">{photoFile.name}</span>}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
            {photoPreview && (
              <img src={photoPreview} alt="Preview" className="mt-2 rounded-lg border border-zinc-200 max-h-40 object-contain" />
            )}
            {parseMsg && (
              <p className={`mt-1.5 text-xs ${parseMsg.startsWith('Fields') ? 'text-green-600' : 'text-red-600'}`}>{parseMsg}</p>
            )}
          </div>

          {/* ── Required fields ─────────────────────────────────────────────── */}
          <div>
            <label className={labelCls}>Course / Class Name <span className="text-red-500">*</span></label>
            <input value={topic} onChange={e => setTopic(e.target.value)} required className={inputCls}
              placeholder="e.g. Respiratory Distress Management" />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>Date <span className="text-red-500">*</span></label>
              <input type="date" value={courseDate} onChange={e => setCourseDate(e.target.value)} required className={inputCls} />
            </div>
            <div className="w-28">
              <label className={labelCls}>Hours <span className="text-red-500">*</span></label>
              <input type="number" step="0.25" min="0.25" value={hours} onChange={e => setHours(e.target.value)}
                required className={inputCls} placeholder="1.5" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Provider / Organization</label>
            <input value={provider} onChange={e => setProvider(e.target.value)} className={inputCls}
              placeholder="e.g. NAEMSP, State Fire Marshal" />
          </div>

          <div>
            <label className={labelCls}>Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} className={inputCls}
              placeholder="e.g. Kansas City, MO" />
          </div>

          {/* ── Optional classification ─────────────────────────────────────── */}
          <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 flex flex-col gap-3">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Classification <span className="font-normal normal-case">(optional — admin will confirm)</span></p>

            <div>
              <label className={labelCls}>Purpose</label>
              <select value={purpose} onChange={e => setPurpose(e.target.value)} className={inputCls}>
                <option value="">— Select if known —</option>
                {PURPOSE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>NREMT Category <span className="text-zinc-400 font-normal">(EMS only)</span></label>
              <select value={nrmtCategory} onChange={e => setNrmtCategory(e.target.value)} className={inputCls}>
                <option value="">— Select if known —</option>
                {NREMT_CATEGORIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls}
              placeholder="Any additional details..." />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1 pb-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
              {loading ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
