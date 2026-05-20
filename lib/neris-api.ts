// NERIS API client: incident/entity endpoints.
// Auth is isolated while FSRI confirms the certified vendor flow.
// OAuth2: NERIS_CLIENT_ID, NERIS_CLIENT_SECRET
// Basic: NERIS_VENDOR_ID, NERIS_VENDOR_PASSWORD
// Set NERIS_USE_TEST=true to target the test API.

const BASE_URL = process.env.NERIS_USE_TEST === 'true'
  ? 'https://api-test.neris.fsri.org/v1'
  : 'https://api.neris.fsri.org/v1'

const TIMEOUT_MS = 20000 // 20 second timeout on all NERIS API calls

type NerisAuthHeaders = {
  Authorization: string
}

async function getOAuthToken(): Promise<string> {
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
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`NERIS auth failed ${res.status}: ${body}`)
  }
  const data = await res.json()
  return data.access_token
}

async function getAuthHeaders(): Promise<NerisAuthHeaders> {
  if (process.env.NERIS_AUTH_MODE === 'basic') {
    const vendorId = process.env.NERIS_VENDOR_ID
    const password = process.env.NERIS_VENDOR_PASSWORD
    if (!vendorId || !password) {
      throw new Error('NERIS_VENDOR_ID / NERIS_VENDOR_PASSWORD not configured')
    }

    const credentials = Buffer.from(`${vendorId}:${password}`).toString('base64')
    return { Authorization: `Basic ${credentials}` }
  }

  const token = await getOAuthToken()
  return { Authorization: `Bearer ${token}` }
}

// Validate an incident payload. NERIS returns 204 on success.
export async function nerisValidateIncident(
  nerisEntityId: string,
  payload: object
): Promise<{ ok: boolean; error?: string }> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/incident/${nerisEntityId}/validate`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (res.status === 204) return { ok: true }
  const body = await res.json().catch(() => ({}))
  const msg = body?.detail ?? body?.message ?? `Validation failed (${res.status})`
  return { ok: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) }
}

// Submit an incident and return the NERIS-assigned incident UID.
export async function nerisSubmitIncident(
  nerisEntityId: string,
  payload: object
): Promise<{ neris_id: string }> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/incident/${nerisEntityId}`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = body?.detail ?? body?.message ?? `Submission failed (${res.status})`
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  const data = await res.json()
  // TODO: verify response field name once FSRI enables the test enrollment.
  return { neris_id: data.neris_id ?? data.id ?? data.neris_uid ?? '' }
}

// POST a station to an entity. Used for NERIS compatibility checks.
export async function nerisCreateStation(
  nerisEntityId: string,
  payload: object
): Promise<{ neris_id: string }> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/entity/${nerisEntityId}/station`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `Station create failed (${res.status})`)
  }
  const data = await res.json()
  return { neris_id: data.neris_id ?? data.id ?? '' }
}

// PATCH an existing incident. Used for NERIS compatibility badge criterion #2.
export async function nerisUpdateIncident(
  nerisEntityId: string,
  nerisIncidentId: string,
  payload: object
): Promise<void> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/incident/${nerisEntityId}/${nerisIncidentId}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = body?.detail ?? body?.message ?? `Incident update failed (${res.status})`
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
}

// PATCH the entity record for a department. Used for NERIS compatibility badge criterion #3.
export async function nerisUpdateEntity(
  nerisEntityId: string,
  payload: object
): Promise<void> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/entity/${nerisEntityId}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = body?.detail ?? body?.message ?? `Entity update failed (${res.status})`
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
}

// Check that an entity ID is valid and auth is working.
// Uses the validate endpoint — 422 means entity is recognized (payload just needs fields).
export async function nerisCheckEntityExists(nerisEntityId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const authHeaders = await getAuthHeaders()
    const res = await fetch(`${BASE_URL}/incident/${nerisEntityId}/validate`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status === 204 || res.status === 422 || res.status === 400) return { ok: true }
    if (res.status === 404) return { ok: false, error: 'Entity ID not found in NERIS. Verify the value on your NERIS department profile.' }
    if (res.status === 401 || res.status === 403) return { ok: false, error: 'Authentication failed. Contact FireOps7 support.' }
    return { ok: false, error: `Unexpected response from NERIS (${res.status})` }
  } catch (err: any) {
    return { ok: false, error: err.message ?? 'Could not reach NERIS servers.' }
  }
}

// POST a unit to a station. Used for NERIS compatibility checks.
export async function nerisCreateUnit(
  nerisEntityId: string,
  nerisStationId: string,
  payload: object
): Promise<{ neris_id: string }> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/entity/${nerisEntityId}/station/${nerisStationId}/unit`, {
    method: 'POST',
    headers: {
      ...authHeaders,
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
