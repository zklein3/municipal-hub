export interface CountyContact {
  name: string
  phone: string
}

// Stored as one contact per line, "Name|Phone". Falls back to peeling a
// trailing phone number off legacy freeform lines that predate this format.
export function parseCountyContacts(raw: string | null): CountyContact[] {
  if (!raw) return []
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const idx = line.indexOf('|')
      if (idx >= 0) {
        return { name: line.slice(0, idx).trim(), phone: line.slice(idx + 1).trim() }
      }
      const match = line.match(/^(.*?)[\s\t]*(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\s*$/)
      if (match) return { name: match[1].trim(), phone: match[2].trim() }
      return { name: line, phone: '' }
    })
}

export function serializeCountyContacts(contacts: CountyContact[]): string {
  return contacts
    .filter(c => c.name.trim() || c.phone.trim())
    .map(c => `${c.name.trim()}|${c.phone.trim()}`)
    .join('\n')
}
