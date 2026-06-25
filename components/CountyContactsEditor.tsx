'use client'

import { useState } from 'react'
import { parseCountyContacts, serializeCountyContacts, type CountyContact } from '@/lib/county-contacts'

export default function CountyContactsEditor({
  name,
  defaultValue,
}: {
  name: string
  defaultValue: string | null
}) {
  const [contacts, setContacts] = useState<CountyContact[]>(() => {
    const parsed = parseCountyContacts(defaultValue)
    return parsed.length > 0 ? parsed : [{ name: '', phone: '' }]
  })

  function updateRow(i: number, field: 'name' | 'phone', value: string) {
    setContacts(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  function addRow() {
    setContacts(prev => [...prev, { name: '', phone: '' }])
  }

  function removeRow(i: number) {
    setContacts(prev => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={serializeCountyContacts(contacts)} />
      {contacts.map((c, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={c.name}
            onChange={e => updateRow(i, 'name', e.target.value)}
            placeholder="e.g. Dodge County Sheriff"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <input
            type="text"
            value={c.phone}
            onChange={e => updateRow(i, 'phone', e.target.value)}
            placeholder="(402) 727-2677"
            className="w-44 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            disabled={contacts.length === 1}
            className="px-2 text-zinc-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-zinc-400"
            aria-label="Remove row"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="self-start text-xs font-semibold text-red-700 hover:text-red-800"
      >
        + Add another county
      </button>
    </div>
  )
}
