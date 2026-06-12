import { headers } from 'next/headers'

export const RP_NAME = 'FireOps7'

/** Relying Party ID — the domain the credential is scoped to. Derived from the request host. */
export async function getRpID(): Promise<string> {
  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  return host.split(':')[0]
}

/** Expected origin for WebAuthn verification. Derived from the request host/protocol. */
export async function getOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
