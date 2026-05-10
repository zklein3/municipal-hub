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

  const apparatusJson = formData.get('apparatus_units') as string | null
  const apparatusUnits: string[] = apparatusJson ? JSON.parse(apparatusJson) : []

  const apparatusContext = apparatusUnits.length > 0
    ? `\nThis department's apparatus unit numbers are: ${apparatusUnits.join(', ')}. In the CFS, these units may appear with a department prefix (e.g. unit "11" may appear as "WIN11", unit "24" as "WIN24"). Only include apparatus entries that match one of these unit numbers. In the apparatus array, return the plain unit number exactly as listed above (e.g. "11" not "WIN11").`
    : ''

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
            text: `Extract incident data from this Central Square CAD CFS (Call for Service) report for a fire department.${apparatusContext}

Return a JSON object with these fields (all optional, omit if not found):
{
  "cad_number": "the CFS# value",
  "incident_number": "from the IR / External Agency Numbers section — the entry that does NOT have a PO: (police officer) assignment next to it. This is the fire department's own incident number (e.g. WIN26-0015).",
  "incident_date": "YYYY-MM-DD",
  "address": "full incident location address",
  "incident_type": one of "fire"|"rescue"|"standby"|"mutual_aid"|"special"|"other" — map vehicle/injury/property damage crashes to "rescue", fire calls to "fire",
  "call_time": "YYYY-MM-DDTHH:mm",
  "paged_at": "YYYY-MM-DDTHH:mm" — earliest Assign time for this department's units,
  "first_on_scene_at": "YYYY-MM-DDTHH:mm" — earliest Arrived time for this department's units,
  "last_leaving_scene_at": "YYYY-MM-DDTHH:mm" — latest Leaving Scene time for this department's units,
  "in_service_at": "YYYY-MM-DDTHH:mm" — latest Available time for this department's units,
  "disposition": "primary disposition",
  "narrative": "1-2 sentence summary of the incident based on the dispatch log",
  "apparatus": only include this department's units that have Enroute or Arrived times (skip units with only Assign/Off Duty):
    [{ "unit_number": "plain unit number as listed above", "role": "primary" for first unit or "support" for others, "enroute_at": "YYYY-MM-DDTHH:mm", "on_scene_at": "YYYY-MM-DDTHH:mm", "leaving_scene_at": "YYYY-MM-DDTHH:mm", "available_at": "YYYY-MM-DDTHH:mm" }]
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
