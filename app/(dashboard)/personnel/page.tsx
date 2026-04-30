import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function PersonnelPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient
    .from('personnel')
    .select('id, is_sys_admin')
    .eq('auth_user_id', user.id)

  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel')
    .select('department_id, system_role')
    .eq('personnel_id', me.id)
    .eq('active', true)

  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')

  const systemRole = myDept.system_role
  const canOpenAll = systemRole === 'admin' || systemRole === 'officer' || me.is_sys_admin

  const { data: roster } = await adminClient
    .from('department_personnel')
    .select(`
      id, system_role, active, employee_number, personnel_id,
      personnel(id, first_name, last_name, email, phone),
      personnel_roles(name, is_officer)
    `)
    .eq('department_id', myDept.department_id)
    .eq('active', true)
    .order('system_role')

  const roleOrder: Record<string, number> = { admin: 0, officer: 1, member: 2 }
  const sorted = (roster ?? []).sort((a, b) =>
    (roleOrder[a.system_role] ?? 9) - (roleOrder[b.system_role] ?? 9)
  )

  const rows = sorted.map((record) => {
    const p = Array.isArray(record.personnel)
      ? record.personnel[0] as any
      : record.personnel as any

    const isMe = record.personnel_id === me.id
    const canOpen = canOpenAll || isMe
    const personnelId = p?.id ?? record.personnel_id
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || '—'
    const title = (record.personnel_roles as any)?.name ?? '—'
    const phone = p?.phone ?? '—'
    const empNum = record.employee_number ?? '—'

    return { record, isMe, canOpen, personnelId, name, title, phone, empNum }
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Personnel</h1>
        <p className="text-sm text-zinc-500 mt-1">{rows.length} active member{rows.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ record, isMe, canOpen, personnelId, name, title, phone, empNum }) => (
          <div key={record.id} className="rounded-xl bg-white shadow-sm border border-zinc-200 p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900 truncate">
                  {name}
                  {isMe && <span className="ml-2 text-xs font-normal text-zinc-400">(you)</span>}
                </p>
                {title !== '—' && <p className="text-sm text-zinc-500 truncate mt-0.5">{title}</p>}
              </div>
              <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                record.system_role === 'admin' ? 'bg-red-100 text-red-700' :
                record.system_role === 'officer' ? 'bg-blue-100 text-blue-700' :
                'bg-zinc-100 text-zinc-600'
              }`}>
                {record.system_role.charAt(0).toUpperCase() + record.system_role.slice(1)}
              </span>
            </div>

            <div className="flex gap-4 text-xs text-zinc-500">
              {phone !== '—' && <span>{phone}</span>}
              {empNum !== '—' && <span className="text-zinc-400">#{empNum}</span>}
            </div>

            {canOpen && (
              <Link
                href={`/personnel/${personnelId}`}
                className="mt-auto text-xs font-semibold text-red-600 hover:text-red-800"
              >
                View Profile →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
