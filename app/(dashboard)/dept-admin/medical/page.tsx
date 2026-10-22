import { redirect } from 'next/navigation'

// Medical setup lives on the one Medical page now (Medication Types / Bags modes).
export default function MedicalAdminPage() {
  redirect('/medical?mode=types')
}
