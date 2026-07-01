import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginForm, { LoginTheme } from '@/app/(auth)/login/LoginForm'

const FIRE_THEME: LoginTheme = {
  brand: 'FireOps7',
  monogram: 'F7',
  category: 'Fire Departments',
  avatarBg: 'bg-red-700',
  inputFocus: 'focus:border-red-500 focus:ring-red-500',
  button: 'bg-red-700 hover:bg-red-800',
  backHref: '/fire',
  backLabel: 'FireOps7',
}

export default async function FireLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const { next } = await searchParams
  const safeNext = next?.startsWith('/') ? next : undefined
  return <LoginForm next={safeNext} theme={FIRE_THEME} />
}
