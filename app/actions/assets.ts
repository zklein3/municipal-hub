'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { revalidatePath } from 'next/cache'

// ─── Custom Field Definitions ─────────────────────────────────────────────────

export async function saveCustomFieldDefinitions(
  itemId: string,
  departmentId: string,
  labels: string[]
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { error: delErr } = await admin
    .from('item_custom_field_definitions')
    .delete()
    .eq('item_id', itemId)
    .eq('department_id', departmentId)

  if (delErr) return { error: delErr.message }

  const trimmed = labels.filter(l => l.trim())
  if (trimmed.length > 0) {
    const rows = trimmed.map((label, i) => ({
      item_id: itemId,
      department_id: departmentId,
      field_label: label.trim(),
      field_order: i,
    }))
    const { error: insErr } = await admin
      .from('item_custom_field_definitions')
      .insert(rows)
    if (insErr) return { error: insErr.message }
  }

  revalidatePath('/dept-admin/setup')
  return {}
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

// ─── Service Logs ─────────────────────────────────────────────────────────────

export async function addServiceLog(formData: FormData): Promise<{ error?: string }> {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx?.departmentId) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const assetId = formData.get('asset_id') as string
  const serviceType = formData.get('service_type') as string
  const serviceDate = formData.get('service_date') as string
  const result = (formData.get('result') as string) || null
  const technician = (formData.get('technician') as string) || null
  const vendor = (formData.get('vendor') as string) || null
  const notes = (formData.get('notes') as string) || null
  const customFieldValuesJson = (formData.get('custom_field_values_json') as string) || null
  const assetSerialNumber = (formData.get('asset_serial_number') as string) || null

  // Upload document if provided
  let documentPath: string | null = null
  const file = formData.get('document') as File | null
  if (file && file.size > 0) {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = file.type === 'application/pdf' ? 'pdf'
      : file.type === 'image/png' ? 'png'
      : file.type === 'image/webp' ? 'webp'
      : 'jpg'
    const path = `${ctx.departmentId}/${assetId}/${Date.now()}.${ext}`
    const { error: uploadErr } = await admin.storage
      .from('asset-documents')
      .upload(path, buffer, { contentType: file.type, upsert: false })
    if (uploadErr) return { error: `Upload failed: ${uploadErr.message}` }
    documentPath = path
  }

  const { error: dbErr } = await admin
    .from('asset_service_logs')
    .insert({
      department_id: ctx.departmentId,
      asset_id: assetId,
      service_type: serviceType,
      service_date: serviceDate,
      result: result || null,
      technician: technician || null,
      vendor: vendor || null,
      notes: notes || null,
      document_path: documentPath,
      logged_by: ctx.personnelId,
    })

  if (dbErr) return { error: dbErr.message }

  // Also save the document to asset_documents so it appears in the Documents section
  if (documentPath && file) {
    const autoName = `${SERVICE_TYPE_LABELS[serviceType] ?? serviceType} — ${serviceDate}`
    await admin.from('asset_documents').insert({
      department_id: ctx.departmentId,
      asset_id: assetId,
      document_name: autoName,
      document_path: documentPath,
      uploaded_by: ctx.personnelId,
    })
  }

  // Update asset record with any Haiku-extracted data
  const assetUpdates: Record<string, unknown> = {}
  if (customFieldValuesJson) {
    try { assetUpdates.custom_field_values = JSON.parse(customFieldValuesJson) } catch { /* ignore */ }
  }
  if (assetSerialNumber) assetUpdates.serial_number = assetSerialNumber

  if (Object.keys(assetUpdates).length > 0) {
    await admin.from('item_assets').update(assetUpdates).eq('id', assetId)
  }

  revalidatePath(`/equipment/assets/${assetId}`)
  return {}
}

export async function updateAssetCustomFieldsDirect(
  assetId: string,
  values: Record<string, string>
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('item_assets')
    .update({ custom_field_values: values })
    .eq('id', assetId)
  if (error) return { error: error.message }
  revalidatePath('/dept-admin/setup')
  return {}
}

export async function getAssetDocumentUrl(path: string): Promise<{ url?: string; error?: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('asset-documents')
    .createSignedUrl(path, 3600)
  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

// ─── Asset Documents (standalone, not tied to a service log) ──────────────────

export async function uploadAssetDocument(formData: FormData): Promise<{ error?: string }> {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx?.departmentId) return { error: 'Not authenticated' }

  const admin = createAdminClient()
  const assetId = formData.get('asset_id') as string
  const file = formData.get('document') as File | null
  if (!file || file.size === 0) return { error: 'No file selected.' }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!allowedTypes.includes(file.type)) return { error: 'Use JPG, PNG, WEBP, or PDF.' }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const ext = file.type === 'application/pdf' ? 'pdf'
    : file.type === 'image/png' ? 'png'
    : file.type === 'image/webp' ? 'webp'
    : 'jpg'
  const path = `${ctx.departmentId}/${assetId}/docs/${Date.now()}.${ext}`

  const { error: uploadErr } = await admin.storage
    .from('asset-documents')
    .upload(path, buffer, { contentType: file.type, upsert: false })
  if (uploadErr) return { error: `Upload failed: ${uploadErr.message}` }

  const documentName = (formData.get('document_name') as string)?.trim() || file.name

  const { error: dbErr } = await admin.from('asset_documents').insert({
    department_id: ctx.departmentId,
    asset_id: assetId,
    document_name: documentName,
    document_path: path,
    uploaded_by: ctx.personnelId,
  })
  if (dbErr) return { error: dbErr.message }

  revalidatePath(`/equipment/assets/${assetId}`)
  return {}
}

export async function deleteAssetDocument(docId: string, assetId: string): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { data: doc } = await admin
    .from('asset_documents')
    .select('document_path')
    .eq('id', docId)
    .single()

  if (doc?.document_path) {
    await admin.storage.from('asset-documents').remove([doc.document_path])
  }

  const { error } = await admin.from('asset_documents').delete().eq('id', docId)
  if (error) return { error: error.message }

  revalidatePath(`/equipment/assets/${assetId}`)
  return {}
}

// ─── Parse Asset Document with Haiku ─────────────────────────────────────────

export type ParsedAssetDoc = {
  serial_number: string | null
  service_date: string | null
  result: 'pass' | 'fail' | null
  technician: string | null
  vendor: string | null
  notes: string | null
  custom_fields: Record<string, string | null>
}

export async function parseAssetDocument(
  formData: FormData
): Promise<{ data?: ParsedAssetDoc; error?: string }> {
  const file = formData.get('document') as File | null
  if (!file || file.size === 0) return { error: 'No file provided.' }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!allowedTypes.includes(file.type)) return { error: 'Use JPG, PNG, WEBP, or PDF.' }

  const fieldLabelsJson = (formData.get('field_labels') as string) || '[]'
  const assetTag = (formData.get('asset_tag') as string) ?? 'unknown'
  const fieldLabels: string[] = JSON.parse(fieldLabelsJson)

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  const cfLines = fieldLabels.length > 0
    ? fieldLabels.map(l => `    "${l}": "value or null"`).join(',\n')
    : '    "__none__": null'

  const prompt = `Parse this fire department equipment service/inspection report for asset: ${assetTag}

Return ONLY a JSON object with no other text:
{
  "serial_number": "Unit ID number from the form (NOT the testing machine serial number) or null",
  "service_date": "YYYY-MM-DD or null",
  "result": "pass" or "fail" or null,
  "technician": "name/initials or null",
  "vendor": "company name or null",
  "notes": "any other relevant info or null",
  "custom_fields": {
${cfLines}
  }
}`

  const isImage = file.type.startsWith('image/')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          isImage
            ? { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } }
            : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })

  if (!response.ok) return { error: 'AI service unavailable.' }
  const result = await response.json()
  const text = result.content?.[0]?.text ?? ''

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { error: 'Could not parse AI response.' }
    return { data: JSON.parse(jsonMatch[0]) as ParsedAssetDoc }
  } catch {
    return { error: 'Could not parse AI response.' }
  }
}
