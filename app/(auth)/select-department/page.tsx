import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectDepartment } from '@/app/actions/auth'

export default async function SelectDepartmentPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: personnel } = await adminClient
    .from('personnel')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!personnel) redirect('/login')

  const { data: deptRows } = await adminClient
    .from('department_personnel')
    .select('department_id, system_role, departments(name)')
    .eq('personnel_id', personnel.id)
    .eq('active', true)

  const departments = deptRows ?? []

  if (departments.length === 0) redirect('/login')
  if (departments.length === 1) redirect('/dashboard')

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-700">
            <span className="text-2xl font-bold text-white">F7</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Select Department</h1>
          <p className="mt-1 text-sm text-zinc-500">You belong to more than one department. Choose which one to open.</p>
        </div>

        <div className="flex flex-col gap-3">
          {departments.map((d) => {
            const dept = d.departments as unknown as { name: string } | null
            return (
              <form key={d.department_id} action={selectDepartment}>
                <input type="hidden" name="department_id" value={d.department_id} />
                {next && <input type="hidden" name="next" value={next} />}
                <button
                  type="submit"
                  className="w-full flex items-center justify-between rounded-lg border border-zinc-300 px-4 py-3 text-left hover:border-red-500 hover:bg-red-50 transition-colors"
                >
                  <span>
                    <span className="block text-sm font-semibold text-zinc-900">{dept?.name ?? 'Unknown Department'}</span>
                    <span className="block text-xs text-zinc-500 capitalize">{d.system_role}</span>
                  </span>
                </button>
              </form>
            )
          })}
        </div>
      </div>
    </div>
  )
}
