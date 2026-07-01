import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginForm, { LoginTheme } from '@/app/(auth)/login/LoginForm'

const LAW_THEME: LoginTheme = {
  brand: 'LawOps',
  monogram: 'LO',
  category: 'Law Enforcement',
  avatarBg: 'bg-blue-700',
  inputFocus: 'focus:border-blue-600 focus:ring-blue-600',
  button: 'bg-blue-700 hover:bg-blue-800',
  backHref: '/police',
  backLabel: 'LawOps',
}

export default async function PoliceLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const { next } = await searchParams
  const safeNext = next?.startsWith('/') ? next : undefined
  return <LoginForm next={safeNext} theme={LAW_THEME} />
}
