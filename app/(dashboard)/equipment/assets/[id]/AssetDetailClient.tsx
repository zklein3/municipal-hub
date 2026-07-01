'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  addServiceLog,
  updateAssetCustomFieldsDirect,
  getAssetDocumentUrl,
  parseAssetDocument,
  uploadAssetDocument,
  deleteAssetDocument,
  type ParsedAssetDoc,
} from '@/app/actions/assets'

type FieldDef = { id: string; field_label: string; field_order: number }
type AssetDoc = {
  id: string
  document_name: string
  document_path: string
  created_at: string
  uploaded_by: string | null
}

type ServiceLog = {
  id: string
  service_type: string
  service_date: string
  result: string | null
  technician: string | null
  vendor: string | null
  notes: string | null
  document_path: string | null
  logged_by_name: string | null
  created_at: string
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  flow_test: 'Flow Test',
  annual_service: 'Annual Service',
  hydrostatic_test: 'Hydrostatic Test',
  cylinder_fill: 'Cylinder Fill',
  repair: 'Repair',
  fit_test: 'Fit Test',
  inspection: 'Inspection',
  other: 'Other',
}

function fmt(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString()
}

export default function AssetDetailClient({
  asset,
  item,
  fieldDefs,
  logs,
  documents: initialDocuments,
  isOfficer,
}: {
  asset: {
    id: string
    asset_tag: string
    serial_number: string | null
    status: string
    in_service_date: string | null
    notes: string | null
    item_id: string
    apparatus_id: string | null
    custom_field_values: Record<string, string>
  }
  item: { id: string; item_name: string; category_id: string | null }
  fieldDefs: FieldDef[]
  logs: ServiceLog[]
  documents: AssetDoc[]
  isOfficer: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Documents (use initialDocuments directly — router.refresh() re-fetches from server)
  const [showDocUpload, setShowDocUpload] = useState(false)
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docName, setDocName] = useState('')
  const [docUploading, setDocUploading] = useState(false)
  const docFileRef = useRef<HTMLInputElement>(null)

  // Custom field editing
  const [editingFields, setEditingFields] = useState(false)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(asset.custom_field_values ?? {})
  const [savingFields, startSavingFields] = useTransition()

  // Service log form
  const [showLogForm, setShowLogForm] = useState(false)
  const [logLoading, setLogLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedAssetDoc | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Pre-filled log form state (populated by Haiku parse)
  const [logDate, setLogDate] = useState('')
  const [logType, setLogType] = useState('flow_test')
  const [logResult, setLogResult] = useState('')
  const [logTech, setLogTech] = useState('')
  const [logVendor, setLogVendor] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [parsedCfValues, setParsedCfValues] = useState<Record<string, string>>({})
  const [parsedSerialNumber, setParsedSerialNumber] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setSelectedFile(f)
    setParsed(null)
    setParsedCfValues({})
  }

  async function handleParseDocument() {
    if (!selectedFile) return
    setParsing(true)
    setError(null)
    const fd = new FormData()
    fd.append('document', selectedFile)
    fd.append('field_labels', JSON.stringify(fieldDefs.map(d => d.field_label)))
    fd.append('asset_tag', asset.asset_tag)
    const result = await parseAssetDocument(fd)
    setParsing(false)
    if (result.error) { setError(result.error); return }
    const d = result.data!
    setParsed(d)
    if (d.serial_number) setParsedSerialNumber(d.serial_number)
    if (d.service_date) setLogDate(d.service_date)
    if (d.result) setLogResult(d.result)
    if (d.technician) setLogTech(d.technician)
    if (d.vendor) setLogVendor(d.vendor)
    if (d.notes) setLogNotes(d.notes)

    // Map parsed custom field values to def IDs
    const cfVals: Record<string, string> = {}
    for (const def of fieldDefs) {
      const v = d.custom_fields?.[def.field_label]
      if (v) cfVals[def.id] = v
    }
    setParsedCfValues(cfVals)
  }

  async function handleSubmitLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLogLoading(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    if (selectedFile) fd.set('document', selectedFile)

    // Merge current field values with AI-parsed ones
    const mergedCf = { ...fieldValues, ...parsedCfValues }
    if (Object.keys(mergedCf).length > 0) {
      fd.set('custom_field_values_json', JSON.stringify(mergedCf))
    }
    if (parsedSerialNumber) fd.set('asset_serial_number', parsedSerialNumber)

    const result = await addServiceLog(fd)
    setLogLoading(false)
    if (result.error) { setError(result.error); return }

    // Update local custom field values display
    setFieldValues(prev => ({ ...prev, ...parsedCfValues }))
    setSuccess('Service log saved.')
    setShowLogForm(false)
    router.refresh()
    setSelectedFile(null)
    setParsed(null)
    setParsedCfValues({})
    setParsedSerialNumber(null)
    setLogDate(''); setLogType('flow_test'); setLogResult(''); setLogTech(''); setLogVendor(''); setLogNotes('')
  }

  function handleSaveFields() {
    startSavingFields(async () => {
      const result = await updateAssetCustomFieldsDirect(asset.id, fieldValues)
      if (result.error) setError(result.error)
      else { setSuccess('Component numbers saved.'); setEditingFields(false) }
    })
  }

  async function handleViewDocument(path: string) {
    const result = await getAssetDocumentUrl(path)
    if (result.error) { setError(result.error); return }
    window.open(result.url, '_blank')
  }

  async function handleUploadDoc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!docFile) return
    setDocUploading(true)
    setError(null)
    const fd = new FormData()
    fd.append('asset_id', asset.id)
    fd.append('document', docFile)
    fd.append('document_name', docName || docFile.name)
    const result = await uploadAssetDocument(fd)
    setDocUploading(false)
    if (result.error) { setError(result.error); return }
    setSuccess('Document uploaded.')
    setShowDocUpload(false)
    setDocFile(null)
    setDocName('')
    if (docFileRef.current) docFileRef.current.value = ''
    router.refresh()
  }

  async function handleDeleteDoc(docId: string) {
    if (!confirm('Remove this document?')) return
    setError(null)
    const result = await deleteAssetDocument(docId, asset.id)
    if (result.error) { setError(result.error); return }
    setSuccess('Document removed.')
    router.refresh()
  }

  async function handleParseStoredDoc(path: string, name: string) {
    setError(null)
    setParsing(true)
    setShowLogForm(true)
    // Fetch the signed URL, then re-fetch as blob to pass to parseAssetDocument
    const urlResult = await getAssetDocumentUrl(path)
    if (urlResult.error) { setError(urlResult.error); setParsing(false); return }
    const blob = await fetch(urlResult.url!).then(r => r.blob())
    const file = new File([blob], name, { type: blob.type })
    const fd = new FormData()
    fd.append('document', file)
    fd.append('field_labels', JSON.stringify(fieldDefs.map(d => d.field_label)))
    fd.append('asset_tag', asset.asset_tag)
    const result = await parseAssetDocument(fd)
    setParsing(false)
    if (result.error) { setError(result.error); return }
    const d = result.data!
    setParsed(d)
    if (d.serial_number) setParsedSerialNumber(d.serial_number)
    if (d.service_date) setLogDate(d.service_date)
    if (d.result) setLogResult(d.result)
    if (d.technician) setLogTech(d.technician)
    if (d.vendor) setLogVendor(d.vendor)
    if (d.notes) setLogNotes(d.notes)
    const cfVals: Record<string, string> = {}
    for (const def of fieldDefs) {
      const v = d.custom_fields?.[def.field_label]
      if (v) cfVals[def.id] = v
    }
    setParsedCfValues(cfVals)
    setSuccess('Document parsed — review the pre-filled service log below.')
  }

  const statusBadge =
    asset.status === 'IN SERVICE' ? 'bg-green-100 text-green-700' :
    asset.status === 'OUT OF SERVICE' ? 'bg-yellow-100 text-yellow-700' :
    'bg-zinc-100 text-zinc-500'
  const statusLabel =
    asset.status === 'IN SERVICE' ? 'In Service' :
    asset.status === 'OUT OF SERVICE' ? 'Out of Service' : 'Retired'

  return (
    <div className="max-w-2xl">
      {/* Back + header */}
      <div className="mb-6">
        <Link href="/dept-admin/setup" className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors">
          ← Equipment Setup
        </Link>
        <div className="flex items-start justify-between mt-2 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 font-mono">{asset.asset_tag}</h1>
            <p className="text-sm text-zinc-500">{item.item_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${statusBadge}`}>
              {statusLabel}
            </span>
            <a
              href={`/print/qr?code=${encodeURIComponent(asset.asset_tag)}&type=asset&title=${encodeURIComponent(asset.asset_tag)}&subtitle=${encodeURIComponent(item.item_name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition-colors"
            >
              Print QR
            </a>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>}

      {/* Asset info */}
      <div className="rounded-xl bg-white border border-zinc-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-700">Asset Info</h2>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
          {asset.serial_number && (
            <div>
              <span className="text-xs text-zinc-400 block">Serial #</span>
              <span className="font-mono text-zinc-900">{asset.serial_number}</span>
            </div>
          )}
          {asset.in_service_date && (
            <div>
              <span className="text-xs text-zinc-400 block">In Service</span>
              <span className="text-zinc-900">{fmt(asset.in_service_date)}</span>
            </div>
          )}
        </div>

        {/* Custom field values */}
        {fieldDefs.length > 0 && (
          <div className="border-t border-zinc-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-zinc-700">Component Numbers</p>
              {isOfficer && !editingFields && (
                <button
                  onClick={() => setEditingFields(true)}
                  className="text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
            {editingFields ? (
              <div className="flex flex-col gap-2">
                {fieldDefs.map(def => (
                  <div key={def.id}>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">{def.field_label}</label>
                    <input
                      type="text"
                      value={fieldValues[def.id] ?? ''}
                      onChange={e => setFieldValues(prev => ({ ...prev, [def.id]: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-mono focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                ))}
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={handleSaveFields}
                    disabled={savingFields}
                    className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
                  >
                    {savingFields ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditingFields(false); setFieldValues(asset.custom_field_values ?? {}) }}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {fieldDefs.map(def => (
                  <div key={def.id}>
                    <span className="text-xs text-zinc-400 block">{def.field_label}</span>
                    <span className="font-mono text-zinc-900">{fieldValues[def.id] ?? <span className="text-zinc-400 not-italic">—</span>}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 bg-zinc-50">
          <h2 className="text-sm font-semibold text-zinc-700">Documents</h2>
          {isOfficer && (
            <button
              onClick={() => { setShowDocUpload(!showDocUpload); setError(null) }}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 transition-colors"
            >
              {showDocUpload ? 'Cancel' : '+ Upload'}
            </button>
          )}
        </div>

        {showDocUpload && (
          <form onSubmit={handleUploadDoc} className="border-b border-zinc-200 p-4">
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Document Name</label>
                <input
                  type="text"
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  placeholder="MES Flow Test 2026"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">File <span className="text-red-500">*</span></label>
                <input
                  ref={docFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={e => setDocFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-zinc-600"
                />
                <p className="mt-1 text-xs text-zinc-400">JPG, PNG, WEBP, or PDF · max 10 MB</p>
              </div>
              <button
                type="submit"
                disabled={!docFile || docUploading}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
              >
                {docUploading ? 'Uploading…' : 'Upload Document'}
              </button>
            </div>
          </form>
        )}

        {initialDocuments.length === 0 && !showDocUpload ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-400">No documents attached.</div>
        ) : initialDocuments.length > 0 ? (
          <div className="divide-y divide-zinc-100">
            {initialDocuments.map(doc => (
              <div key={doc.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{doc.document_name}</p>
                  <p className="text-xs text-zinc-400">{new Date(doc.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleParseStoredDoc(doc.document_path, doc.document_name)}
                    disabled={parsing}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  >
                    {parsing ? 'Parsing…' : 'Parse with AI'}
                  </button>
                  <button
                    onClick={() => handleViewDocument(doc.document_path)}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition-colors"
                  >
                    View
                  </button>
                  {isOfficer && (
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Service history */}
      <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 bg-zinc-50">
          <h2 className="text-sm font-semibold text-zinc-700">Service History</h2>
          {isOfficer && (
            <button
              onClick={() => { setShowLogForm(!showLogForm); setError(null); setSuccess(null) }}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 transition-colors"
            >
              {showLogForm ? 'Cancel' : '+ Add Log'}
            </button>
          )}
        </div>

        {/* Add log form */}
        {showLogForm && (
          <form onSubmit={handleSubmitLog} className="border-b border-zinc-200 p-4">
            <input type="hidden" name="asset_id" value={asset.id} />
            <p className="text-sm font-semibold text-zinc-800 mb-3">New Service Log</p>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Service Type <span className="text-red-500">*</span></label>
                <select
                  name="service_type"
                  value={logType}
                  onChange={e => setLogType(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  {Object.entries(SERVICE_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Date <span className="text-red-500">*</span></label>
                <input
                  name="service_date"
                  type="date"
                  required
                  value={logDate}
                  onChange={e => setLogDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Result</label>
                <select
                  name="result"
                  value={logResult}
                  onChange={e => setLogResult(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="">N/A</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Technician</label>
                <input
                  name="technician"
                  type="text"
                  value={logTech}
                  onChange={e => setLogTech(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Vendor / Company</label>
                <input
                  name="vendor"
                  type="text"
                  value={logVendor}
                  onChange={e => setLogVendor(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Numbers extracted by AI (serial + component fields) */}
            {(parsedSerialNumber || Object.keys(parsedCfValues).length > 0) && (
              <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-3 mb-3">
                <p className="text-xs font-semibold text-indigo-700 mb-2">Numbers extracted from document</p>
                <div className="grid grid-cols-2 gap-2">
                  {parsedSerialNumber && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-indigo-600 shrink-0">Serial #:</span>
                      <input
                        type="text"
                        value={parsedSerialNumber}
                        onChange={e => setParsedSerialNumber(e.target.value)}
                        className="flex-1 rounded border border-indigo-200 bg-white px-2 py-0.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                  )}
                  {fieldDefs.map(def => {
                    const val = parsedCfValues[def.id]
                    return val ? (
                      <div key={def.id} className="flex items-center gap-2">
                        <span className="text-xs text-indigo-600 shrink-0">{def.field_label}:</span>
                        <input
                          type="text"
                          value={val}
                          onChange={e => setParsedCfValues(prev => ({ ...prev, [def.id]: e.target.value }))}
                          className="flex-1 rounded border border-indigo-200 bg-white px-2 py-0.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                    ) : null
                  })}
                </div>
                <p className="text-xs text-indigo-500 mt-2">Review and correct, then Save — these will update the asset record.</p>
              </div>
            )}

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-zinc-600">Notes</label>
              <textarea
                name="notes"
                rows={2}
                value={logNotes}
                onChange={e => setLogNotes(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
              />
            </div>

            {/* Document upload + Haiku parse */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-zinc-600">Service Report (optional)</label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  {selectedFile ? selectedFile.name : 'Choose file…'}
                </button>
                {selectedFile && (
                  <button
                    type="button"
                    onClick={handleParseDocument}
                    disabled={parsing}
                    className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50 transition-colors"
                  >
                    {parsing ? 'Parsing…' : 'Parse with AI'}
                  </button>
                )}
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); setParsed(null); setParsedCfValues({}); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
                  >✕</button>
                )}
              </div>
              {parsed && (
                <p className="mt-1 text-xs text-green-600">AI parsed successfully — review the pre-filled fields above.</p>
              )}
              <p className="mt-1 text-xs text-zinc-400">JPG, PNG, WEBP, or PDF · max 10 MB</p>
            </div>

            <button
              type="submit"
              disabled={logLoading}
              className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
            >
              {logLoading ? 'Saving…' : 'Save Service Log'}
            </button>
          </form>
        )}

        {/* Log list */}
        {logs.length === 0 && !showLogForm ? (
          <div className="px-5 py-10 text-center text-sm text-zinc-400">No service logs yet.</div>
        ) : logs.length > 0 ? (
          <div className="divide-y divide-zinc-100">
            {logs.map(log => (
              <div key={log.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-zinc-900">{fmt(log.service_date)}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      {SERVICE_TYPE_LABELS[log.service_type] ?? log.service_type}
                    </span>
                    {log.result === 'pass' && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Pass</span>
                    )}
                    {log.result === 'fail' && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Fail</span>
                    )}
                  </div>
                  {log.document_path && (
                    <button
                      onClick={() => handleViewDocument(log.document_path!)}
                      className="shrink-0 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
                    >
                      View Doc
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-zinc-500">
                  {log.technician && <span>Tech: {log.technician}</span>}
                  {log.vendor && <span>Vendor: {log.vendor}</span>}
                  {log.logged_by_name && <span>Logged by: {log.logged_by_name}</span>}
                </div>
                {log.notes && <p className="mt-1 text-xs text-zinc-600">{log.notes}</p>}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
