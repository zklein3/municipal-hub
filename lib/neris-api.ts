// NERIS API client — OAuth2 client_credentials + incident/entity endpoints
// Credentials: NERIS_CLIENT_ID, NERIS_CLIENT_SECRET in .env.local + Vercel env vars
// Set NERIS_USE_TEST=true to target the test API

const BASE_URL = process.env.NERIS_USE_TEST === 'true'
  ? 'https://api-test.neris.fsri.org/v1'
  : 'https://api.neris.fsri.org/v1'

async function getToken(): Promise<string> {
  const id = process.env.NERIS_CLIENT_ID
  const secret = process.env.NERIS_CLIENT_SECRET
  if (!id || !secret) throw new Error('NERIS_CLIENT_ID / NERIS_CLIENT_SECRET not configured')

  const credentials = Buffer.from(`${id}:${secret}`).toString('base64')
  const res = await fetch(`${BASE_URL}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`NERIS auth failed ${res.status}: ${body}`)
  }
  const data = await res.json()
  return data.access_token
}

// Validate an incident payload — returns 204 on success, error detail on failure
export async function nerisValidateIncident(
  nerisEntityId: string,
  payload: object
): Promise<{ ok: boolean; error?: string }> {
  const token = await getToken()
  const res = await fetch(`${BASE_URL}/incident/${nerisEntityId}/validate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (res.status === 204) return { ok: true }
  const body = await res.json().catch(() => ({}))
  const msg = body?.detail ?? body?.message ?? `Validation failed (${res.status})`
  return { ok: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) }
}

// Submit an incident — returns the NERIS-assigned incident UID
export async function nerisSubmitIncident(
  nerisEntityId: string,
  payload: object
): Promise<{ neris_id: string }> {
  const token = await getToken()
  const res = await fetch(`${BASE_URL}/incident/${nerisEntityId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = body?.detail ?? body?.message ?? `Submission failed (${res.status})`
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  const data = await res.json()
  // NERIS returns the incident UID — field name TBD until we can test against API
  // TODO: verify response field name (neris_id vs id vs neris_uid)
  return { neris_id: data.neris_id ?? data.id ?? data.neris_uid ?? '' }
}

// POST a station to an entity (used for NERIS compatibility check)
export async function nerisCreateStation(
  nerisEntityId: string,
  payload: object
): Promise<{ neris_id: string }> {
  const token = await getToken()
  const res = await fetch(`${BASE_URL}/entity/${nerisEntityId}/station`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `Station create failed (${res.status})`)
  }
  const data = await res.json()
  return { neris_id: data.neris_id ?? data.id ?? '' }
}

// POST a unit to a station (used for NERIS compatibility check)
export async function nerisCreateUnit(
  nerisEntityId: string,
  nerisStationId: string,
  payload: object
): Promise<{ neris_id: string }> {
  const token = await getToken()
  const res = await fetch(`${BASE_URL}/entity/${nerisEntityId}/station/${nerisStationId}/unit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `Unit create failed (${res.status})`)
  }
  const data = await res.json()
  return { neris_id: data.neris_id ?? data.id ?? '' }
}
