import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import BackButton from '@/components/BackButton'
import ContactClient from './ContactClient'

export default async function ContactFormPage() {
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.selectionPending) redirect('/select-department')
  if (!ctx.departmentId) redirect('/dashboard')

  const isOfficerOrAbove = ctx.systemRole === 'admin' || ctx.systemRole === 'officer' || ctx.isSysAdmin
  const department_id = ctx.departmentId

  const [{ data: addressesRaw }, { data: personsRaw }, { data: contactsRaw }] = await Promise.all([
    adminClient.from('pd_addresses').select('id, address').eq('department_id', department_id).order('address'),
    adminClient.from('pd_persons').select('id, first_name, last_name, dob, phone, is_dangerous, danger_reason').eq('department_id', department_id).order('last_name'),
    adminClient
      .from('pd_contacts')
      .select('id, address_id, address, location_detail, contact_date, contact_time, contact_type, reason, action_taken, report_number, notes, officer_name, created_at')
      .eq('department_id', department_id)
      .order('contact_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const contactIds = (contactsRaw ?? []).map(c => c.id)
  const { data: contactPersonsRaw } = contactIds.length > 0
    ? await adminClient.from('pd_contact_persons').select('contact_id, person_id').in('contact_id', contactIds)
    : { data: [] }

  return (
    <div className="max-w-2xl">
      <div className="mb-2">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Contact Log</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Field interviews and daytime contacts</p>
      </div>
      <div className="mb-5">
        <BackButton />
      </div>
      <ContactClient
        addresses={addressesRaw ?? []}
        persons={personsRaw ?? []}
        contacts={contactsRaw ?? []}
        contactPersons={contactPersonsRaw ?? []}
        isOfficerOrAbove={isOfficerOrAbove}
      />
    </div>
  )
}
