import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import DeptSettingsClient from './DeptSettingsClient'

export default async function DeptSettingsPage() {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.departmentId || (ctx.systemRole !== 'admin' && !ctx.isSysAdmin)) redirect('/dashboard')

  return (
    <div className="max-w-lg">
      <DeptSettingsClient
        departmentId={ctx.departmentId}
        timezone={ctx.departmentTimezone}
      />
    </div>
  )
}
