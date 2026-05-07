'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createDepartment(formData: FormData) {
  const name = formData.get('name') as string
  const code = formData.get('code') as string

  if (!name) return { error: 'Department name is required.' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('departments')
    .insert({ name, code: code || null, active: true })

  if (error) return { error: error.message }

  revalidatePath('/admin/departments')
  return { success: true }
}

export async function toggleDepartment(id: string, active: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('departments')
    .update({ active })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/departments')
  return { success: true }
}

export async function updateDepartmentModules(
  departmentId: string,
  modules: { module_operations?: boolean; module_iso?: boolean; public_site_enabled?: boolean }
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('departments')
    .update(modules)
    .eq('id', departmentId)

  if (error) return { error: error.message }
  revalidatePath(`/admin/dept/${departmentId}`)
  revalidatePath('/dashboard')
  return { success: true }
}
