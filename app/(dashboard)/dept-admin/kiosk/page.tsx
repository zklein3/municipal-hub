import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { listKioskDevices } from '@/app/actions/kiosk'
import KioskDevicesClient from './KioskDevicesClient'

export default async function KioskDevicesPage() {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.departmentId || (ctx.systemRole !== 'admin' && !ctx.isSysAdmin)) redirect('/dashboard')

  const result = await listKioskDevices()

  return (
    <div className="max-w-lg">
      <KioskDevicesClient devices={result.devices ?? []} />
    </div>
  )
}
