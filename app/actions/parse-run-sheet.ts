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

IMPORTANT: Return all timestamps exactly as the digits appear in the document — do not convert to UTC or adjust for any timezone. Use the date and time numbers as printed.

This report has three distinct time sources. Use each one correctly:

1. PAGE 1 header fields:
   - "Call Time" → call_time
   - "Completed Time" → in_service_at
   - "Primary Disposition" → disposition

2. "Response Times" block (department-level incident timeline):
   - Assigned → paged_at
   - Arrived → first_on_scene_at
   - Leaving → last_leaving_scene_at
   Do NOT use this block for individual apparatus times.

3. "Unit Response Times" section (per-vehicle times, near the end):
   Each unit has its own subsection headed by its identifier (e.g. "WIN11"). Under each header are lines in the format "MM/DD/YY HH:MM:SS | Event". Read each unit's lines individually:
   - A line containing "| Enroute" → enroute_at for that unit
   - A line containing "| Arrived" → on_scene_at for that unit
   - A line containing "| Leaving Scene" → leaving_scene_at for that unit
   - A line containing "| Available" or "| Off Duty" → available_at for that unit
   Some headers list multiple units (e.g. "WIN11, WIN24") — apply that timestamp to ALL units listed.

Return a JSON object (all fields optional, omit if not found):
{
  "cad_number": "CFS# value",
  "incident_number": "from IR / External Agency Numbers — entry WITHOUT a PO: prefix (e.g. WIN26-0016)",
  "incident_date": "YYYY-MM-DD",
  "address": "full incident address",
  "incident_type": one of "fire"|"rescue"|"standby"|"mutual_aid"|"special"|"other" — crashes/injuries = "rescue",
  "call_time": "YYYY-MM-DDTHH:mm",
  "paged_at": "YYYY-MM-DDTHH:mm",
  "first_on_scene_at": "YYYY-MM-DDTHH:mm",
  "last_leaving_scene_at": "YYYY-MM-DDTHH:mm",
  "in_service_at": "YYYY-MM-DDTHH:mm",
  "disposition": "string",
  "narrative": "1-2 sentence summary from the dispatch log comments",
  "apparatus": [
    {
      "unit_number": "plain number exactly as listed in the department unit list",
      "role": "primary" for first/lead unit, "support" for others,
      "enroute_at": "YYYY-MM-DDTHH:mm — from this unit's Enroute line in Unit Response Times",
      "on_scene_at": "YYYY-MM-DDTHH:mm — from this unit's Arrived line in Unit Response Times",
      "leaving_scene_at": "YYYY-MM-DDTHH:mm — from this unit's Leaving Scene line (may be a grouped entry)",
      "available_at": "YYYY-MM-DDTHH:mm — from this unit's Available or Off Duty line"
    }
  ]
}

Only include department units that have an Enroute or Arrived time in the Unit Response Times section.

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
