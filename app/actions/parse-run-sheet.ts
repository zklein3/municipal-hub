'use server'

import Anthropic from '@anthropic-ai/sdk'
import { logError } from '@/lib/logger'

export type ParsedRunSheet = {
  cad_number?: string
  incident_number?: string
  incident_date?: string
  address?: string
  incident_type?: string
  call_time?: string
  paged_at?: string
  first_on_scene_at?: string
  last_leaving_scene_at?: string
  in_service_at?: string
  disposition?: string
  narrative?: string
  apparatus?: {
    unit_number: string
    role: string
    enroute_at?: string
    on_scene_at?: string
    leaving_scene_at?: string
    available_at?: string
  }[]
}

export async function parseRunSheet(formData: FormData): Promise<{ data?: ParsedRunSheet; error?: string }> {
  const file = formData.get('pdf') as File | null
  if (!file) return { error: 'No file provided.' }
  if (file.type !== 'application/pdf') return { error: 'File must be a PDF.' }
  if (file.size > 5 * 1024 * 1024) return { error: 'File too large (max 5MB).' }

  try {
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          } as any,
          {
            type: 'text',
            text: `Extract incident data from this Central Square CAD CFS (Call for Service) report for a fire department.

Return a JSON object with these fields (all optional, omit if not found):
{
  "cad_number": "the CFS# value",
  "incident_number": "from the IR / External Agency Numbers section — the entry that does NOT have a PO: (police officer) assignment next to it. This is the fire department's own incident number (e.g. WIN26-0015).",
  "incident_date": "YYYY-MM-DD",
  "address": "full incident location address",
  "incident_type": one of "fire"|"rescue"|"standby"|"mutual_aid"|"special"|"other" — map vehicle/injury/property damage crashes to "rescue", fire calls to "fire",
  "call_time": "YYYY-MM-DDTHH:mm",
  "paged_at": "YYYY-MM-DDTHH:mm" — earliest Assign time for fire department units,
  "first_on_scene_at": "YYYY-MM-DDTHH:mm" — earliest Arrived time across responding units,
  "last_leaving_scene_at": "YYYY-MM-DDTHH:mm" — latest Leaving Scene time,
  "in_service_at": "YYYY-MM-DDTHH:mm" — latest Available time,
  "disposition": "primary disposition",
  "narrative": "1-2 sentence summary of the incident based on the dispatch log",
  "apparatus": only include units that have Enroute or Arrived times (skip department page identifiers that only have Assign/Available):
    [{ "unit_number": "unit ID", "role": "primary" for first unit or "support" for others, "enroute_at": "YYYY-MM-DDTHH:mm", "on_scene_at": "YYYY-MM-DDTHH:mm", "leaving_scene_at": "YYYY-MM-DDTHH:mm", "available_at": "YYYY-MM-DDTHH:mm" }]
}

Return only valid JSON, no explanation or markdown.`,
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const data = JSON.parse(cleaned) as ParsedRunSheet
    return { data }
  } catch (err: any) {
    await logError(err, 'parse-run-sheet')
    return { error: 'Failed to parse run sheet. Please try again or enter manually.' }
  }
}
