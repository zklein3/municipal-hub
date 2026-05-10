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
      max_tokens: 2048,
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
            text: `Extract incident data from this Central Square CAD CFS (Call for Service) report.${apparatusContext}

CRITICAL — there are two separate time sections in this report. Use them correctly:

1. The "Response Times" block near the top of the report (Assigned / Enroute / Arrived / Leaving / Completed) belongs to ONE specific primary dispatch unit, often a police or EMS unit. DO NOT use these times for fire department apparatus times.

2. The "Unit Response Times" section near the end of the report lists each unit by identifier with individual timestamped events (e.g. "Enroute", "Arrived", "Leaving Scene to", "Available", "Off Duty"). Use ONLY this section for all apparatus and incident-level times. Some entries list multiple units together (e.g. "WIN11, WIN24 | Leaving Scene to ...") — apply that timestamp to each unit listed.

Return a JSON object with these fields (all optional, omit if not found):
{
  "cad_number": "the CFS# value",
  "incident_number": "from IR / External Agency Numbers — the entry WITHOUT a 'PO:' prefix. This is the fire dept's own number (e.g. WIN26-0016).",
  "incident_date": "YYYY-MM-DD",
  "address": "full incident address",
  "incident_type": one of "fire"|"rescue"|"standby"|"mutual_aid"|"special"|"other" — crashes/injuries map to "rescue",
  "call_time": "YYYY-MM-DDTHH:mm" — the Call Time field at the top of the report,
  "paged_at": "YYYY-MM-DDTHH:mm" — earliest Assign timestamp for this department's units in the Unit Response Times section,
  "first_on_scene_at": "YYYY-MM-DDTHH:mm" — earliest Arrived timestamp for this department's units in Unit Response Times,
  "last_leaving_scene_at": "YYYY-MM-DDTHH:mm" — latest Leaving Scene timestamp for this department's units,
  "in_service_at": "YYYY-MM-DDTHH:mm" — latest Available or Off Duty timestamp for this department's units,
  "disposition": "primary disposition from the top of the report",
  "narrative": "1-2 sentence summary from the dispatch log comments",
  "apparatus": [
    {
      "unit_number": "plain number exactly as in the department unit list above",
      "role": "primary" for the first/lead unit, "support" for others,
      "enroute_at": "YYYY-MM-DDTHH:mm" — from this unit's own Enroute line in Unit Response Times,
      "on_scene_at": "YYYY-MM-DDTHH:mm" — from this unit's own Arrived line in Unit Response Times,
      "leaving_scene_at": "YYYY-MM-DDTHH:mm" — from this unit's Leaving Scene line (may be a grouped entry shared with other units),
      "available_at": "YYYY-MM-DDTHH:mm" — from this unit's Available or Off Duty line
    }
  ]
}

Only include department units that have an Enroute or Arrived time in Unit Response Times. Units with only Assign or Off Duty (department page identifiers like WINFIRE) are skipped in the apparatus array but their Assign time counts for paged_at.

Return only valid JSON, no markdown or explanation.`,
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
