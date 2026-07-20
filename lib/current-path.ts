import { headers } from 'next/headers'

// Reads the path middleware.ts stamps on every request (x-pathname) so a Server
// Component can build a ?next= param when it has to bounce to /login or
// /select-department mid-route, without each call site hardcoding its own path.
export async function getCurrentPath(): Promise<string> {
  const h = await headers()
  return h.get('x-pathname') ?? '/dashboard'
}
