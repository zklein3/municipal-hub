import LoginForm from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const safeNext = next?.startsWith('/') ? next : undefined
  return <LoginForm next={safeNext} />
}
