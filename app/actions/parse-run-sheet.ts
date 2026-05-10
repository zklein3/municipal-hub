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

This report has three distinct time sources — use each one correctly:

1. PAGE 1 header fields:
   - "Call Time" = when dispatch received the call → use for call_time
   - "Completed Time" = when the entire call was cleared → use for in_service_at
   - "Primary Disposition" → use for disposition

2. "Response Times" block (page 2):
   This is the PRIMARY OVERALL INCIDENT timeline for the responding department. Use it for the incident-level time fields:
   - Assigned → paged_at
   - Arrived → first_on_scene_at
   - Leaving → last_leaving_scene_at
   Do NOT use this block for individual apparatus times.

3. "Unit Response Times" section (near the end of the report):
   This lists each unit by identifier with its own timestamped events (Enroute, Arrived, Leaving Scene to, Available, Off Duty). Use ONLY this section for apparatus-level times.
   Some entries group multiple units (e.g. "WIN11, WIN24 | Leaving Scene to ...") — apply that timestamp to each unit listed.

Return a JSON object with these fields (all optional, omit if not found):
{
  "cad_number": "the CFS# value",
  "incident_number": "from IR / External Agency Numbers — the entry WITHOUT a 'PO:' prefix (e.g. WIN26-0016)",
  "incident_date": "YYYY-MM-DD",
  "address": "full incident address",
  "incident_type": one of "fire"|"rescue"|"standby"|"mutual_aid"|"special"|"other" — crashes/injuries = "rescue",
  "call_time": "YYYY-MM-DDTHH:mm" — Call Time from page 1,
  "paged_at": "YYYY-MM-DDTHH:mm" — Assigned from the Response Times block,
  "first_on_scene_at": "YYYY-MM-DDTHH:mm" — Arrived from the Response Times block,
  "last_leaving_scene_at": "YYYY-MM-DDTHH:mm" — Leaving from the Response Times block,
  "in_service_at": "YYYY-MM-DDTHH:mm" — Completed Time from page 1,
  "disposition": "Primary Disposition from page 1",
  "narrative": "1-2 sentence summary from the dispatch log comments",
  "apparatus": [
    {
      "unit_number": "plain number exactly as in the department unit list above",
      "role": "primary" for the first/lead unit, "support" for others,
      "enroute_at": "YYYY-MM-DDTHH:mm" — this unit's Enroute line in Unit Response Times,
      "on_scene_at": "YYYY-MM-DDTHH:mm" — this unit's Arrived line in Unit Response Times,
      "leaving_scene_at": "YYYY-MM-DDTHH:mm" — this unit's Leaving Scene line (may be grouped),
      "available_at": "YYYY-MM-DDTHH:mm" — this unit's Available or Off Duty line
    }
  ]
}

Only include department units that have an Enroute or Arrived time in Unit Response Times. Units with only Assign/Off Duty are skipped in the apparatus array.

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
