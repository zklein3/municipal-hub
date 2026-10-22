'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import { logError, logEvent } from '@/lib/logger'
import {
  previewItemToMedical, moveItemToMedical, previewMedicalToItem, moveMedicalToItem, type MedicalCategory,
} from '@/lib/catalog-move'
import { revalidatePath } from 'next/cache'

// Moving between the equipment and medical catalogs touches both, so it needs both setup permissions.
async function requireBoth() {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx?.departmentId) return { error: 'No department selected.' as const }
  if (!ctx.isSysAdmin) {
    const [equip, med] = await Promise.all([
      hasPermission(ctx, 'manage_equipment_standard'),
      hasPermission(ctx, 'manage_medical_supply_setup'),
    ])
    if (!equip || !med) return { error: 'Moving between lists needs both equipment and medical setup permissions.' as const }
  }
  return { department_id: ctx.departmentId, personnel_id: ctx.personnelId }
}

function revalidateBoth() {
  revalidatePath('/dept-admin/setup')
  revalidatePath('/medical')
  revalidatePath('/equipment')
}

export async function previewMoveItemToMedical(item_id: string) {
  const ctx = await requireBoth()
  if ('error' in ctx) return ctx
  return previewItemToMedical(createAdminClient(), ctx.department_id, item_id)
}

export async function moveItemToMedicalCatalog(item_id: string, opts: { category: MedicalCategory; unit_of_measure: string; openingCounts: boolean }) {
  const ctx = await requireBoth()
  if ('error' in ctx) return ctx
  const r = await moveItemToMedical(createAdminClient(), { department_id: ctx.department_id, item_id, performed_by: ctx.personnel_id, ...opts })
  if (r.error) { await logError(r.error, '/dept-admin/setup', { department_id: ctx.department_id, metadata: { item_id } }); return r }
  await logEvent({ log_type: 'info', page: '/dept-admin/setup', message: `Moved equipment item to the medical catalog (${r.moved} placement(s)).`, department_id: ctx.department_id, personnel_id: ctx.personnel_id, metadata: { item_id, supply_type_id: r.supply_type_id } })
  revalidateBoth()
  return r
}

export async function previewMoveMedicalToItem(supply_type_id: string) {
  const ctx = await requireBoth()
  if ('error' in ctx) return ctx
  return previewMedicalToItem(createAdminClient(), ctx.department_id, supply_type_id)
}

export async function moveMedicalToItemCatalog(supply_type_id: string, opts: { category_id: string | null }) {
  const ctx = await requireBoth()
  if ('error' in ctx) return ctx
  const r = await moveMedicalToItem(createAdminClient(), { department_id: ctx.department_id, supply_type_id, ...opts })
  if (r.error) { await logError(r.error, '/medical', { department_id: ctx.department_id, metadata: { supply_type_id } }); return r }
  await logEvent({ log_type: 'info', page: '/medical', message: `Moved medical type to the equipment catalog (${r.moved} placement(s)).`, department_id: ctx.department_id, personnel_id: ctx.personnel_id, metadata: { supply_type_id, item_id: r.item_id } })
  revalidateBoth()
  return r
}
