'use client'

import { useState } from 'react'
import { createContact, updateContact, deleteContact, updatePersonDangerFlag, assignPdCaseNumber } from '@/app/actions/pd-contacts'

const inputCls = 'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'
const nowBtnCls = 'shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50'

const CONTACT_TYPE_COLORS: Record<string, string> = {
  'Field Interview': 'bg-blue-100 text-blue-700',
  'Traffic Stop': 'bg-purple-100 text-purple-700',
  'Pedestrian Check': 'bg-cyan-100 text-cyan-700',
  'Business Contact': 'bg-amber-100 text-amber-700',
  'Follow-Up': 'bg-zinc-100 text-zinc-600',
  'Other': 'bg-zinc-100 text-zinc-600',
}

function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface Address {
  id: string
  address: string
}

interface ListOption {
  id: string
  label: string
}

interface Person {
  id: string
  first_name: string
  last_name: string
  dob: string | null
  phone: string | null
  address: string | null
  is_dangerous: boolean
  danger_reason: string | null
}

interface Contact {
  id: string
  address_id: string | null
  address: string | null
  location_detail: string | null
  contact_date: string
  contact_time: string | null
  contact_type: string
  narrative: string | null
  report_number: string | null
  officer_name: string | null
  created_at: string
}

interface PersonChip {
  key: string
  person_id?: string
  first_name: string
  last_name: string
  dob: string
  phone: string
  address: string
  is_dangerous: boolean
  danger_reason: string
}

function PersonCardModal({
  person,
  contacts,
  isOfficerOrAbove,
  onClose,
  onOpenContact,
  onSaveFlag,
}: {
  person: Person
  contacts: Contact[]
  isOfficerOrAbove: boolean
  onClose: () => void
  onOpenContact: (c: Contact) => void
  onSaveFlag: (isDangerous: boolean, reason: string | null) => Promise<{ error?: string } | undefined>
}) {
  const [editingFlag, setEditingFlag] = useState(false)
  const [flagDraft, setFlagDraft] = useState({ is_dangerous: person.is_dangerous, danger_reason: person.danger_reason ?? '' })
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [current, setCurrent] = useState(person)

  async function handleSave() {
    setSaving(true)
    setLocalError(null)
    const result = await onSaveFlag(flagDraft.is_dangerous, flagDraft.danger_reason || null)
    if (result?.error) setLocalError(result.error)
    else {
      setCurrent(prev => ({ ...prev, is_dangerous: flagDraft.is_dangerous, danger_reason: flagDraft.danger_reason || null }))
      setEditingFlag(false)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white border border-zinc-200" onClick={e => e.stopPropagation()}>
        <div className={`px-5 py-4 border-b border-zinc-100 sticky top-0 ${current.is_dangerous ? 'bg-red-50' : 'bg-zinc-50'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Person Card</p>
          <p className="text-lg font-bold text-zinc-900 mt-0.5">
            {current.is_dangerous && '⚠ '}{current.first_name} {current.last_name}
          </p>
          {(current.dob || current.phone || current.address) && (
            <p className="text-xs text-zinc-500">
              {current.dob ? `DOB ${current.dob}` : null}{current.dob && current.phone ? ' · ' : null}{current.phone}
              {(current.dob || current.phone) && current.address ? ' · ' : null}{current.address}
            </p>
          )}
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <div className={`rounded-lg border-2 p-3 ${current.is_dangerous ? 'border-red-300 bg-red-50' : 'border-zinc-200'}`}>
            {editingFlag ? (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={flagDraft.is_dangerous} onChange={e => setFlagDraft(p => ({ ...p, is_dangerous: e.target.checked }))} />
                  <span className={flagDraft.is_dangerous ? 'text-red-700' : 'text-zinc-700'}>⚠ Officer safety flag</span>
                </label>
                {flagDraft.is_dangerous && (
                  <input type="text" value={flagDraft.danger_reason} onChange={e => setFlagDraft(p => ({ ...p, danger_reason: e.target.value }))}
                    placeholder="e.g. Violence against officer" className={inputCls} />
                )}
                {localError && <p className="text-xs text-red-600">{localError}</p>}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setEditingFlag(false)} className="text-xs text-zinc-400 hover:text-zinc-700">Cancel</button>
                  <button type="button" onClick={handleSave} disabled={saving}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-900 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save Flag'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm ${current.is_dangerous ? 'text-red-700 font-semibold' : 'text-zinc-500'}`}>
                  {current.is_dangerous ? `⚠ ${current.danger_reason || 'Officer safety flag set'}` : 'No officer safety flag on file.'}
                </p>
                {isOfficerOrAbove && (
                  <button type="button" onClick={() => { setFlagDraft({ is_dangerous: current.is_dangerous, danger_reason: current.danger_reason ?? '' }); setEditingFlag(true) }}
                    className="shrink-0 text-xs font-semibold text-zinc-500 hover:text-zinc-800 underline">
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-zinc-500 mb-1">Contacts ({contacts.length})</p>
            {contacts.length === 0 ? (
              <p className="text-sm text-zinc-400 italic">No contacts on file.</p>
            ) : (
              <div className="rounded-lg border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
                {contacts.map(c => (
                  <button key={c.id} type="button" onClick={() => onOpenContact(c)}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-50">
                    <p className="text-sm text-zinc-800">{c.address || 'No address recorded'}</p>
                    <p className="text-xs text-zinc-400">
                      {new Date(c.contact_date + 'T12:00:00').toLocaleDateString()} · {c.contact_type}
                      {c.officer_name ? ` · ${c.officer_name}` : ''}
                    </p>
                    {c.narrative && <p className="text-xs text-zinc-500 mt-0.5">{c.narrative}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50 flex justify-end sticky bottom-0">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

const emptyForm = {
  contact_date: '',
  contact_time: '',
  report_number: '',
  address_id: '',
  address: '',
  location_detail: '',
  contact_type: '',
  narrative: '',
}

const emptyNewPerson = { first_name: '', last_name: '', dob: '', phone: '', address: '', is_dangerous: false, danger_reason: '' }

export default function ContactClient({
  addresses,
  persons: initialPersons,
  contacts: initialContacts,
  contactPersons,
  contactActions,
  contactTypes,
  actionTypes,
  caseNumberMode,
  isOfficerOrAbove,
}: {
  addresses: Address[]
  persons: Person[]
  contacts: Contact[]
  contactPersons: { contact_id: string; person_id: string }[]
  contactActions: { contact_id: string; action_type_id: string }[]
  contactTypes: ListOption[]
  actionTypes: ListOption[]
  caseNumberMode: 'auto' | 'manual'
  isOfficerOrAbove: boolean
}) {
  const [persons, setPersons] = useState(initialPersons)
  const [contacts, setContacts] = useState(initialContacts)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const personMap = Object.fromEntries(persons.map(p => [p.id, p]))
  const actionTypeMap = Object.fromEntries(actionTypes.map(a => [a.id, a.label]))

  const contactPersonsMap: Record<string, string[]> = {}
  contactPersons.forEach(cp => {
    if (!contactPersonsMap[cp.contact_id]) contactPersonsMap[cp.contact_id] = []
    contactPersonsMap[cp.contact_id].push(cp.person_id)
  })

  const contactActionsMap: Record<string, string[]> = {}
  contactActions.forEach(ca => {
    if (!contactActionsMap[ca.contact_id]) contactActionsMap[ca.contact_id] = []
    contactActionsMap[ca.contact_id].push(ca.action_type_id)
  })

  function personNames(contactId: string) {
    return (contactPersonsMap[contactId] ?? []).map(pid => {
      const p = personMap[pid]
      return p ? `${p.first_name} ${p.last_name}` : null
    }).filter(Boolean) as string[]
  }

  function contactPersonsList(contactId: string): Person[] {
    return (contactPersonsMap[contactId] ?? []).map(pid => personMap[pid]).filter(Boolean) as Person[]
  }

  function contactActionLabels(contactId: string): string[] {
    return (contactActionsMap[contactId] ?? []).map(id => actionTypeMap[id]).filter(Boolean) as string[]
  }

  function contactHasDanger(contactId: string) {
    return contactPersonsList(contactId).some(p => p.is_dangerous)
  }

  const [viewingContact, setViewingContact] = useState<Contact | null>(null)
  const [viewingPersonId, setViewingPersonId] = useState<string | null>(null)

  function openContactCard(c: Contact) {
    setViewingPersonId(null)
    setViewingContact(c)
  }

  function openPersonCard(personId: string) {
    setViewingContact(null)
    setViewingPersonId(personId)
  }

  async function handleSaveDangerFlag(personId: string, isDangerous: boolean, reason: string | null) {
    const result = await updatePersonDangerFlag(personId, isDangerous, reason)
    if (!result?.error) {
      setPersons(prev => prev.map(p => p.id === personId ? { ...p, is_dangerous: isDangerous, danger_reason: reason } : p))
    }
    return result
  }

  // ─── New / edit contact form ──────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTime, setEditingTime] = useState(false)
  const [form, setForm] = useState({ ...emptyForm, contact_date: today, contact_type: contactTypes[0]?.label ?? '' })
  const [addressSearch, setAddressSearch] = useState('')
  const [personSearch, setPersonSearch] = useState('')
  const [personChips, setPersonChips] = useState<PersonChip[]>([])
  const [addingNewPerson, setAddingNewPerson] = useState(false)
  const [newPerson, setNewPerson] = useState(emptyNewPerson)
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([])
  const [assigningCaseNumber, setAssigningCaseNumber] = useState(false)

  function resetForm() {
    setForm({ ...emptyForm, contact_date: today, contact_type: contactTypes[0]?.label ?? '' })
    setAddressSearch('')
    setPersonSearch('')
    setPersonChips([])
    setAddingNewPerson(false)
    setNewPerson(emptyNewPerson)
    setSelectedActionIds([])
  }

  function handleOpenNew() {
    setEditingId(null)
    resetForm()
    setShowForm(true)
    setError(null)
    setSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelForm() {
    setShowForm(false)
    setEditingId(null)
    setError(null)
    setSuccess(null)
    resetForm()
  }

  function handleEdit(c: Contact) {
    setEditingId(c.id)
    setForm({
      contact_date: c.contact_date,
      contact_time: c.contact_time ?? '',
      report_number: c.report_number ?? '',
      address_id: c.address_id ?? '',
      address: c.address ?? '',
      location_detail: c.location_detail ?? '',
      contact_type: c.contact_type,
      narrative: c.narrative ?? '',
    })
    setAddressSearch(c.address ?? '')
    setPersonSearch('')
    const chips = (contactPersonsMap[c.id] ?? []).map(pid => {
      const p = personMap[pid]
      return p ? {
        key: p.id, person_id: p.id, first_name: p.first_name, last_name: p.last_name, dob: p.dob ?? '', phone: p.phone ?? '',
        address: p.address ?? '', is_dangerous: p.is_dangerous, danger_reason: p.danger_reason ?? '',
      } : null
    }).filter(Boolean) as PersonChip[]
    setPersonChips(chips)
    setAddingNewPerson(false)
    setSelectedActionIds(contactActionsMap[c.id] ?? [])
    setShowForm(true)
    setError(null)
    setSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function selectAddress(a: Address) {
    setForm(p => ({ ...p, address_id: a.id, address: a.address }))
    setAddressSearch(a.address)
  }

  function handleAddressTextChange(value: string) {
    setAddressSearch(value)
    setForm(p => ({ ...p, address_id: '', address: value }))
  }

  const filteredAddresses = addressSearch.trim()
    ? addresses.filter(a => a.address.toLowerCase().includes(addressSearch.trim().toLowerCase()) && a.address !== addressSearch).slice(0, 6)
    : []

  // Recent contacts at the currently selected/typed address
  const recentAtAddress = form.address_id
    ? contacts.filter(c => c.address_id === form.address_id && c.id !== editingId).slice(0, 5)
    : []

  function addPersonChip(p: Person) {
    if (personChips.some(c => c.person_id === p.id)) return
    setPersonChips(prev => [...prev, {
      key: p.id, person_id: p.id, first_name: p.first_name, last_name: p.last_name, dob: p.dob ?? '', phone: p.phone ?? '',
      address: p.address ?? '', is_dangerous: p.is_dangerous, danger_reason: p.danger_reason ?? '',
    }])
    setPersonSearch('')
  }

  function addNewPersonChip() {
    if (!newPerson.first_name.trim() || !newPerson.last_name.trim() || !newPerson.dob) return
    setPersonChips(prev => [...prev, {
      key: `new-${Date.now()}`,
      first_name: newPerson.first_name.trim(),
      last_name: newPerson.last_name.trim(),
      dob: newPerson.dob,
      phone: newPerson.phone,
      address: newPerson.address,
      is_dangerous: newPerson.is_dangerous,
      danger_reason: newPerson.danger_reason,
    }])
    setNewPerson(emptyNewPerson)
    setAddingNewPerson(false)
  }

  function removePersonChip(key: string) {
    setPersonChips(prev => prev.filter(c => c.key !== key))
  }

  const filteredPersons = personSearch.trim()
    ? persons.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(personSearch.trim().toLowerCase())
        && !personChips.some(c => c.person_id === p.id)
      ).slice(0, 6)
    : []

  function toggleActionType(id: string) {
    setSelectedActionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleAssignCaseNumber() {
    setAssigningCaseNumber(true)
    setError(null)
    const result = await assignPdCaseNumber()
    setAssigningCaseNumber(false)
    if (result?.error) { setError(result.error); return }
    if (result?.caseNumber) setForm(p => ({ ...p, report_number: result.caseNumber }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!form.contact_time) { setError('Tap "Now" on the contact time before saving — it can\'t be left blank.'); return }

    // Catch a person typed into "Add New Person" but never confirmed with
    // the Add Person button — don't silently drop them from the contact.
    const pendingChips = [...personChips]
    if (addingNewPerson && newPerson.first_name.trim() && newPerson.last_name.trim() && newPerson.dob) {
      pendingChips.push({
        key: `pending-${Date.now()}`,
        first_name: newPerson.first_name.trim(),
        last_name: newPerson.last_name.trim(),
        dob: newPerson.dob,
        phone: newPerson.phone,
        address: newPerson.address,
        is_dangerous: newPerson.is_dangerous,
        danger_reason: newPerson.danger_reason,
      })
    }

    setLoading(true)
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v) fd.set(k, v) })
    fd.set('persons', JSON.stringify(pendingChips.map(c => ({
      person_id: c.person_id,
      first_name: c.first_name,
      last_name: c.last_name,
      dob: c.dob || null,
      phone: c.phone || null,
      address: c.address || null,
      is_dangerous: c.is_dangerous,
      danger_reason: c.danger_reason || null,
    }))))
    fd.set('action_type_ids', JSON.stringify(selectedActionIds))

    const result = editingId
      ? await updateContact(editingId, fd)
      : await createContact(fd)

    if (result?.error) { setError(result.error); setLoading(false); return }

    setSuccess(editingId ? 'Contact updated.' : 'Contact logged.')
    setShowForm(false)
    setEditingId(null)
    resetForm()
    setLoading(false)
    window.location.reload()
  }

  const [deletingId, setDeletingId] = useState<string | null>(null)
  async function handleDelete(id: string) {
    setDeletingId(id)
    const result = await deleteContact(id)
    if (result?.error) setError(result.error)
    else setContacts(prev => prev.filter(c => c.id !== id))
    setDeletingId(null)
  }

  // ─── Reverse lookup: search by person ─────────────────────────────────────
  const [reverseSearch, setReverseSearch] = useState('')

  const reverseMatches = reverseSearch.trim()
    ? persons.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(reverseSearch.trim().toLowerCase())).slice(0, 8)
    : []

  // New contact in auto mode: case number isn't generated automatically —
  // the officer taps "Assign Case Number" only when this contact warrants one.
  const showAssignButton = caseNumberMode === 'auto' && !editingId && !form.report_number

  return (
    <div className="max-w-2xl">
      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-zinc-900">Contacts Logged</h2>
        <button onClick={() => showForm ? handleCancelForm() : handleOpenNew()}
          className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800">
          {showForm ? 'Cancel' : '+ New Contact'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-xl bg-white border border-zinc-200 p-5 shadow-sm flex flex-col gap-3">
          <p className="text-sm font-semibold text-zinc-700 mb-1">{editingId ? 'Edit Contact' : 'New Contact'}</p>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-700">Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.contact_date} onChange={e => setForm(p => ({ ...p, contact_date: e.target.value }))} required className={inputCls} />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                Time {!form.contact_time && <span className="text-red-500">*</span>}
              </label>
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${form.contact_time ? 'border-zinc-300 bg-zinc-50' : 'border-red-300 bg-red-50'}`}>
                {editingTime ? (
                  <input type="time" value={form.contact_time} onChange={e => setForm(p => ({ ...p, contact_time: e.target.value }))} className="flex-1 bg-transparent text-base font-semibold text-zinc-800 focus:outline-none" autoFocus />
                ) : (
                  <span className="flex-1 text-base font-semibold text-zinc-800 tabular-nums">{form.contact_time || 'Not set'}</span>
                )}
                <button type="button" onClick={() => setForm(p => ({ ...p, contact_time: nowTime() }))} className={nowBtnCls}>Now</button>
                <button type="button" onClick={() => setEditingTime(s => !s)}
                  className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-700 underline">
                  {editingTime ? 'Done' : 'Edit'}
                </button>
              </div>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-700">Case Number</label>
              {showAssignButton ? (
                <button type="button" onClick={handleAssignCaseNumber} disabled={assigningCaseNumber}
                  className="w-full rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-500 hover:border-red-400 hover:text-red-700 disabled:opacity-50">
                  {assigningCaseNumber ? 'Assigning…' : '+ Assign Case Number'}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="text" value={form.report_number} onChange={e => setForm(p => ({ ...p, report_number: e.target.value }))}
                    readOnly={caseNumberMode === 'auto' && !editingId}
                    className={`${inputCls} ${caseNumberMode === 'auto' && !editingId ? 'bg-zinc-100 text-zinc-600' : ''}`} />
                  {caseNumberMode === 'auto' && !editingId && (
                    <button type="button" onClick={() => setForm(p => ({ ...p, report_number: '' }))}
                      className="shrink-0 text-xs text-zinc-400 hover:text-zinc-700 underline">Clear</button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-xs font-semibold text-zinc-700 mb-2">
              People Involved {personChips.length === 0 && <span className="text-zinc-400 font-normal">— none added yet</span>}
            </p>

            {personChips.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-2">
                {personChips.map(c => (
                  <div key={c.key}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                      c.is_dangerous ? 'border-red-300 bg-red-50' : 'border-zinc-200 bg-zinc-50'
                    }`}>
                    <div className="min-w-0">
                      {c.person_id ? (
                        <button type="button" onClick={() => openPersonCard(c.person_id!)}
                          className={`text-sm font-semibold hover:underline ${c.is_dangerous ? 'text-red-800' : 'text-zinc-800'}`}>
                          {c.is_dangerous && '⚠ '}{c.first_name} {c.last_name}
                        </button>
                      ) : (
                        <p className={`text-sm font-semibold ${c.is_dangerous ? 'text-red-800' : 'text-zinc-800'}`}>
                          {c.is_dangerous && '⚠ '}{c.first_name} {c.last_name}
                        </p>
                      )}
                      <p className="text-xs text-zinc-500">
                        {c.dob ? `DOB ${c.dob}` : 'No DOB on file'}{c.phone ? ` · ${c.phone}` : ''}{c.address ? ` · ${c.address}` : ''}
                      </p>
                    </div>
                    <button type="button" onClick={() => removePersonChip(c.key)} className="shrink-0 text-zinc-400 hover:text-red-600">✕</button>
                  </div>
                ))}
              </div>
            )}

            <input type="text" value={personSearch} onChange={e => setPersonSearch(e.target.value)}
              placeholder="Search existing people by name..." className={inputCls} />
            {filteredPersons.length > 0 && (
              <div className="mt-1 rounded-lg border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
                {filteredPersons.map(p => (
                  <button key={p.id} type="button" onClick={() => addPersonChip(p)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 ${p.is_dangerous ? 'bg-red-50 text-red-800 font-medium' : 'text-zinc-700'}`}>
                    {p.is_dangerous && '⚠ '}{p.first_name} {p.last_name}{p.dob ? <span className="text-zinc-400 font-normal"> — DOB {p.dob}</span> : null}
                  </button>
                ))}
              </div>
            )}

            {addingNewPerson ? (
              <div className="mt-2 rounded-lg border border-zinc-200 p-3 bg-zinc-50 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input type="text" value={newPerson.first_name} onChange={e => setNewPerson(p => ({ ...p, first_name: e.target.value }))} placeholder="First name" className={inputCls} />
                  <input type="text" value={newPerson.last_name} onChange={e => setNewPerson(p => ({ ...p, last_name: e.target.value }))} placeholder="Last name" className={inputCls} />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-700">DOB <span className="text-red-500">*</span></label>
                    <input type="date" value={newPerson.dob} onChange={e => setNewPerson(p => ({ ...p, dob: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Phone <span className="text-zinc-400 font-normal">(optional)</span></label>
                    <input type="text" value={newPerson.phone} onChange={e => setNewPerson(p => ({ ...p, phone: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Address <span className="text-zinc-400 font-normal">(optional)</span></label>
                  <input type="text" value={newPerson.address} onChange={e => setNewPerson(p => ({ ...p, address: e.target.value }))} placeholder="Personal address" className={inputCls} />
                </div>
                <div className={`rounded-lg border-2 p-2.5 ${newPerson.is_dangerous ? 'border-red-300 bg-red-50' : 'border-zinc-200'}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={newPerson.is_dangerous} onChange={e => setNewPerson(p => ({ ...p, is_dangerous: e.target.checked }))} />
                    <span className={newPerson.is_dangerous ? 'text-red-700' : 'text-zinc-700'}>⚠ Officer safety flag</span>
                  </label>
                  {newPerson.is_dangerous && (
                    <input type="text" value={newPerson.danger_reason} onChange={e => setNewPerson(p => ({ ...p, danger_reason: e.target.value }))}
                      placeholder="e.g. Violence against officer" className={`${inputCls} mt-2`} />
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setAddingNewPerson(false); setNewPerson(emptyNewPerson) }} className="text-xs text-zinc-400 hover:text-zinc-700">Cancel</button>
                  <button type="button" onClick={addNewPersonChip} disabled={!newPerson.first_name.trim() || !newPerson.last_name.trim() || !newPerson.dob}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-900 disabled:opacity-50">
                    Add Person
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setAddingNewPerson(true)} className="mt-2 text-xs font-semibold text-red-600 hover:text-red-800">
                + Add New Person
              </button>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Called To Address</label>
            <input type="text" value={addressSearch} onChange={e => handleAddressTextChange(e.target.value)}
              placeholder="Type an address — pick a match or enter a new one" className={inputCls} />
            {filteredAddresses.length > 0 && (
              <div className="mt-1 rounded-lg border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
                {filteredAddresses.map(a => (
                  <button key={a.id} type="button" onClick={() => selectAddress(a)}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
                    {a.address}
                  </button>
                ))}
              </div>
            )}
            {recentAtAddress.length > 0 && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800 mb-1.5">
                  Recent contacts at this address ({recentAtAddress.length})
                </p>
                <div className="flex flex-col gap-1">
                  {recentAtAddress.map(c => (
                    <p key={c.id} className="text-xs text-amber-700">
                      {new Date(c.contact_date + 'T12:00:00').toLocaleDateString()} — {personNames(c.id).join(', ') || 'No names recorded'}
                      {c.officer_name ? ` · ${c.officer_name}` : ''}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Location Detail</label>
            <input type="text" value={form.location_detail} onChange={e => setForm(p => ({ ...p, location_detail: e.target.value }))}
              className={inputCls} placeholder="e.g. Apt 3, behind building" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Contact Type</label>
            <select value={form.contact_type} onChange={e => setForm(p => ({ ...p, contact_type: e.target.value }))} className={inputCls}>
              {contactTypes.map(t => <option key={t.id} value={t.label}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Action Taken</label>
            <div className="flex flex-wrap gap-2">
              {actionTypes.length === 0 && <p className="text-xs text-zinc-400 italic">No action-taken options configured.</p>}
              {actionTypes.map(a => {
                const checked = selectedActionIds.includes(a.id)
                return (
                  <button key={a.id} type="button" onClick={() => toggleActionType(a.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                      checked ? 'bg-red-700 border-red-700 text-white' : 'bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50'
                    }`}>
                    {a.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Narrative</label>
            <textarea value={form.narrative} onChange={e => setForm(p => ({ ...p, narrative: e.target.value }))} className={inputCls} rows={5} />
          </div>

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
            {loading ? 'Saving…' : editingId ? 'Update Contact' : 'Save Contact'}
          </button>
        </form>
      )}

      {/* ─── Reverse lookup ─── */}
      <div className="mb-6 rounded-xl bg-white border border-zinc-200 p-5 shadow-sm">
        <p className="text-sm font-semibold text-zinc-900 mb-1">Search by Person</p>
        <p className="text-xs text-zinc-400 mb-3">Find every contact and address a person has been logged at.</p>
        <input type="text" value={reverseSearch} onChange={e => setReverseSearch(e.target.value)}
          placeholder="Search by name..." className={inputCls} />
        {reverseSearch.trim() && (
          reverseMatches.length > 0 ? (
            <div className="mt-1 rounded-lg border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
              {reverseMatches.map(p => (
                <button key={p.id} type="button" onClick={() => openPersonCard(p.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 ${p.is_dangerous ? 'bg-red-50 text-red-800 font-medium' : 'text-zinc-700'}`}>
                  {p.is_dangerous && '⚠ '}{p.first_name} {p.last_name}{p.dob ? <span className="text-zinc-400 font-normal"> — DOB {p.dob}</span> : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-zinc-400 italic px-1">No people on file match &quot;{reverseSearch.trim()}&quot;.</p>
          )
        )}
      </div>

      {/* ─── History ─── */}
      {contacts.length === 0 ? (
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
          No contacts logged yet.
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden divide-y divide-zinc-100">
          {contacts.map(c => {
            const danger = contactHasDanger(c.id)
            return (
              <div key={c.id} onClick={() => openContactCard(c)}
                className={`px-4 py-3 cursor-pointer hover:bg-zinc-50 transition-colors ${danger ? 'border-l-4 border-red-500 bg-red-50/60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-900">
                        {new Date(c.contact_date + 'T12:00:00').toLocaleDateString()}
                      </span>
                      <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${CONTACT_TYPE_COLORS[c.contact_type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {c.contact_type}
                      </span>
                      {danger && (
                        <span className="text-xs rounded-full px-2 py-0.5 font-medium bg-red-600 text-white">⚠ Officer Safety</span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-0.5 text-xs text-zinc-500 flex-wrap">
                      {c.address && <span>{c.address}{c.location_detail ? ` (${c.location_detail})` : ''}</span>}
                      {c.contact_time && <span>{c.contact_time.slice(0, 5)}</span>}
                      {c.report_number && <span>#{c.report_number}</span>}
                      {c.officer_name && <span>· {c.officer_name}</span>}
                    </div>
                    {c.narrative && <p className="text-sm text-zinc-700 mt-1">{c.narrative}</p>}
                    {contactPersonsList(c.id).length > 0 && (
                      <p className="text-xs text-zinc-500 mt-0.5 flex flex-wrap gap-x-1">
                        People:{' '}
                        {contactPersonsList(c.id).map((p, i) => (
                          <span key={p.id}>
                            <button type="button" onClick={e => { e.stopPropagation(); openPersonCard(p.id) }}
                              className={`underline hover:no-underline ${p.is_dangerous ? 'text-red-700 font-semibold' : 'text-zinc-500'}`}>
                              {p.is_dangerous && '⚠ '}{p.first_name} {p.last_name}
                            </button>
                            {i < contactPersonsList(c.id).length - 1 ? ',' : ''}
                          </span>
                        ))}
                      </p>
                    )}
                    {contactActionLabels(c.id).length > 0 && (
                      <p className="text-xs text-zinc-400 mt-0.5">Action: {contactActionLabels(c.id).join(', ')}</p>
                    )}
                  </div>
                  {isOfficerOrAbove && (
                    <div className="shrink-0 flex gap-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleEdit(c)} className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">Edit</button>
                      <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id}
                        className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50 transition-colors">
                        {deletingId === c.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {viewingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewingContact(null)}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white border border-zinc-200" onClick={e => e.stopPropagation()}>
            <div className={`px-5 py-4 border-b border-zinc-100 sticky top-0 ${contactHasDanger(viewingContact.id) ? 'bg-red-50' : 'bg-zinc-50'}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Contact Detail</p>
                {contactHasDanger(viewingContact.id) && (
                  <span className="text-xs rounded-full px-2 py-0.5 font-semibold bg-red-600 text-white">⚠ Officer Safety</span>
                )}
              </div>
              <p className="text-lg font-bold text-zinc-900 mt-0.5">{viewingContact.address || 'No address recorded'}</p>
              {viewingContact.location_detail && <p className="text-xs text-zinc-500">{viewingContact.location_detail}</p>}
            </div>

            <div className="px-5 py-4 flex flex-col gap-3 text-sm">
              <div className="flex gap-3 text-xs text-zinc-500 flex-wrap">
                <span>{new Date(viewingContact.contact_date + 'T12:00:00').toLocaleDateString()}</span>
                {viewingContact.contact_time && <span>{viewingContact.contact_time.slice(0, 5)}</span>}
                <span className={`rounded-full px-2 py-0.5 font-medium ${CONTACT_TYPE_COLORS[viewingContact.contact_type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                  {viewingContact.contact_type}
                </span>
                {viewingContact.officer_name && <span>· {viewingContact.officer_name}</span>}
              </div>

              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-1">People Involved</p>
                {contactPersonsList(viewingContact.id).length === 0 ? (
                  <p className="text-zinc-400 italic text-sm">None recorded.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {contactPersonsList(viewingContact.id).map(p => (
                      <button key={p.id} type="button" onClick={() => openPersonCard(p.id)}
                        title={p.is_dangerous ? (p.danger_reason || 'Officer safety flag') : undefined}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium hover:opacity-80 ${
                          p.is_dangerous ? 'bg-red-100 text-red-800 ring-1 ring-red-300' : 'bg-zinc-100 text-zinc-700'
                        }`}>
                        {p.is_dangerous && '⚠ '}{p.first_name} {p.last_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {contactActionLabels(viewingContact.id).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 mb-1">Action Taken</p>
                  <div className="flex flex-wrap gap-2">
                    {contactActionLabels(viewingContact.id).map(label => (
                      <span key={label} className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-700">{label}</span>
                    ))}
                  </div>
                </div>
              )}

              {viewingContact.report_number && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 mb-0.5">Case Number</p>
                  <p className="text-zinc-800">{viewingContact.report_number}</p>
                </div>
              )}

              {viewingContact.narrative && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 mb-0.5">Narrative</p>
                  <p className="text-zinc-800 whitespace-pre-wrap">{viewingContact.narrative}</p>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-2 sticky bottom-0">
              <button type="button" onClick={() => setViewingContact(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">
                Close
              </button>
              {isOfficerOrAbove && (
                <button type="button" onClick={() => { const c = viewingContact; setViewingContact(null); handleEdit(c) }}
                  className="rounded-lg bg-red-700 px-5 py-2 text-sm font-semibold text-white hover:bg-red-800">
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {viewingPersonId && personMap[viewingPersonId] && (
        <PersonCardModal
          key={viewingPersonId}
          person={personMap[viewingPersonId]}
          contacts={contacts.filter(c => (contactPersonsMap[c.id] ?? []).includes(viewingPersonId))}
          isOfficerOrAbove={isOfficerOrAbove}
          onClose={() => setViewingPersonId(null)}
          onOpenContact={openContactCard}
          onSaveFlag={(isDangerous, reason) => handleSaveDangerFlag(viewingPersonId, isDangerous, reason)}
        />
      )}
    </div>
  )
}
