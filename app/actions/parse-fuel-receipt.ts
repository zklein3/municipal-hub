'use server'

import Anthropic from '@anthropic-ai/sdk'
import { logError } from '@/lib/logger'

export type ParsedFuelReceipt = {
  gallons?: number
  cost_per_gallon?: number
  total_cost?: number
  fuel_type?: 'diesel' | 'gasoline' | 'other'
  vendor?: string
  fuel_date?: string
}

export async function parseFuelReceipt(formData: FormData): Promise<{ data?: ParsedFuelReceipt; error?: string }> {
  const file = formData.get('receipt') as File | null
  if (!file) return { error: 'No file provided.' }
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    return { error: 'File must be an image (JPEG, PNG, or WebP).' }
  }
  if (file.size > 10 * 1024 * 1024) return { error: 'Image too large (max 10MB).' }

  try {
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Extract fuel purchase information from this receipt image. Return a JSON object with these fields (omit any you cannot find):
- gallons: number (gallons purchased, e.g. 25.431)
- cost_per_gallon: number (price per gallon, e.g. 3.459)
- total_cost: number (total dollar amount paid, e.g. 87.95)
- fuel_type: "diesel" or "gasoline" or "other"
- vendor: string (gas station name, e.g. "Casey's General Store")
- fuel_date: string in YYYY-MM-DD format

Return ONLY valid JSON, no explanation.`,
          },
        ],
      }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { error: 'Could not parse receipt. Please enter values manually.' }

    const parsed = JSON.parse(jsonMatch[0]) as ParsedFuelReceipt
    return { data: parsed }
  } catch (err: any) {
    await logError(err?.message ?? 'Receipt parse error', '/fuel')
    return { error: 'Could not read receipt. Please enter values manually.' }
  }
}
