import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginForm, { LoginTheme } from '@/app/(auth)/login/LoginForm'

const CIVIC_THEME: LoginTheme = {
  brand: 'CivicOps',
  monogram: 'CO',
  category: 'Public Works',
  avatarBg: 'bg-green-700',
  inputFocus: 'focus:border-green-600 focus:ring-green-600',
  button: 'bg-green-700 hover:bg-green-800',
  backHref: '/public-works',
  backLabel: 'CivicOps',
}

export default async function PublicWorksLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const { next } = await searchParams
  const safeNext = next?.startsWith('/') ? next : undefined
  return <LoginForm next={safeNext} theme={CIVIC_THEME} />
}
