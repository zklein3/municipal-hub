import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import HubCard from '@/components/HubCard'

export default async function IsoHubPage() {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.departmentId || ctx.systemRole !== 'admin') redirect('/dashboard')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">ISO</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Insurance Services Office compliance tools</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HubCard
          title="Hose Inventory"
          description="Hose sections, pressure testing, and NFPA 1962 compliance"
          href="/iso/hoses"
        />
        <HubCard
          title="Hydrants"
          description="Hydrant locations and flow test records"
          href="/iso/hydrants"
        />
        <HubCard
          title="Mutual Aid"
          description="Inter-department mutual aid agreements"
          href="/iso/mutual-aid"
        />
        <HubCard
          title="Pre-Fire Plans"
          description="Structure pre-fire plans and occupancy surveys"
          href="/iso/preplans"
        />
        <HubCard
          title="ISO Report"
          description="Compiled ISO audit report for all sections"
          href="/iso/report"
        />
      </div>
    </div>
  )
}
