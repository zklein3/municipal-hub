import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import HubCard from '@/components/HubCard'

export default async function ReportsPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel')
    .select('department_id, system_role')
    .eq('personnel_id', me.id)
    .eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')

  const isOfficerOrAbove = myDept.system_role === 'admin' || myDept.system_role === 'officer'

  const { data: deptRow } = await adminClient.from('departments').select('module_medical').eq('id', myDept.department_id).single()
  const moduleMedical = deptRow?.module_medical ?? false

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Reports</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Activity, compliance, and department reports</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HubCard
          title="My Activity"
          description="Your attendance history and personal records"
          href="/reports/my-activity"
        />
        {isOfficerOrAbove && (
          <HubCard
            title="Run Report"
            description="Incident run sheets — filter by date and type, print any incident"
            href="/reports/run-report"
          />
        )}
        {isOfficerOrAbove && (
          <>
            <HubCard
              title="Asset Roster"
              description="Department-wide tracked asset inventory and status"
              href="/equipment/assets"
            />
            <HubCard
              title="Attendance"
              description="Department-wide event attendance records"
              href="/reports/attendance"
            />
            <HubCard
              title="Training"
              description="Training participation and certification status"
              href="/reports/training"
            />
            <HubCard
              title="Inspections"
              description="Equipment inspection history and compliance"
              href="/reports/inspections"
            />
            <HubCard
              title="Inventory Status"
              description="Equipment inventory levels and asset tracking"
              href="/reports/inventory-status"
            />
            <HubCard
              title="Fuel Report"
              description="Apparatus fuel usage and cost tracking"
              href="/reports/fuel"
            />
            {moduleMedical && (
              <HubCard
                title="Medical Supplies"
                description="Stock levels, consumption summary, and expiring lots"
                href="/reports/medical"
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
