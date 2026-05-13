// NERIS compatibility badge test — runs all 4 required operations in sequence.
// All must return 200-series against the test environment before applying for the badge.
//
// Criteria:
//   1. POST /incident           → create incident
//   2. PATCH /incident/{id}     → update previously created incident
//   3. PATCH /entity/{id}       → update entity record
//   4. POST /entity/{id}/station (or /unit) → create station or unit

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+?)\s*=\s*(.*)\s*$/)
    if (!match) continue
    const key = match[1].trim()
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] ??= value
  }
}

const baseUrl = process.env.NERIS_USE_TEST === 'true'
  ? 'https://api-test.neris.fsri.org/v1'
  : 'https://api.neris.fsri.org/v1'

const entityId = process.env.NERIS_TEST_DEPT_ID
if (!entityId) {
  console.error('NERIS_TEST_DEPT_ID not set in .env.local')
  process.exit(1)
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getToken() {
  const clientId = process.env.NERIS_CLIENT_ID
  const clientSecret = process.env.NERIS_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Missing NERIS_CLIENT_ID or NERIS_CLIENT_SECRET')
  }
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(`${baseUrl}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Token request failed (${res.status}): ${body}`)
  }
  const data = await res.json()
  return `Bearer ${data.access_token}`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passCount = 0
let failCount = 0

async function step(label, fn) {
  process.stdout.write(`\n[${label}] `)
  try {
    const result = await fn()
    console.log('✓ PASS')
    passCount++
    return result
  } catch (err) {
    console.log('✗ FAIL')
    console.error(`   ${err.message}`)
    failCount++
    return null
  }
}

async function nerisRequest(authorization, method, path, body) {
  const url = `${baseUrl}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = null }

  if (!res.ok) {
    const detail = json?.detail ?? json?.message ?? text
    const msg = typeof detail === 'string' ? detail : JSON.stringify(detail)
    throw new Error(`HTTP ${res.status} ${method} ${url}\n   Response: ${msg.slice(0, 800)}`)
  }

  return { status: res.status, json }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log('NERIS Compatibility Badge Test')
console.log(`Base URL: ${baseUrl}`)
console.log(`Entity:   ${entityId}`)

let authorization
try {
  authorization = await getToken()
  console.log('Token:    OK')
} catch (err) {
  console.error(`Token failed: ${err.message}`)
  process.exit(1)
}

const now = new Date().toISOString()
const internalId = `BADGE-${Date.now()}`

// Criterion 1 — POST /incident
let nerisIncidentId = null
await step('1 POST /incident', async () => {
  const { json } = await nerisRequest(authorization, 'POST', `/incident/${entityId}`, {
    base: {
      department_neris_id: entityId,
      incident_number: internalId,
      location: { state: 'AZ' },
    },
    dispatch: {
      internal_id: internalId,
      call_create: now,
      call_answered: now,
      call_arrival: now,
      location: { state: 'AZ' },
      unit_responses: [{ reported_id_unit: 'BADGE-UNIT-01' }],
    },
    incident_types: [{ type: 'FIRE||OUTSIDE_FIRE||OTHER_OUTSIDE_FIRE' }],
  })
  nerisIncidentId = json?.id ?? json?.neris_id ?? json?.neris_uid ?? json?.incident_id ?? null
  if (nerisIncidentId) console.log(`   Incident ID: ${nerisIncidentId}`)
  else console.log(`   Response: ${JSON.stringify(json).slice(0, 200)}`)
})

// Criterion 2 — PATCH /incident (previously created)
// Incidents start in SUBMITTED status; NERIS only allows PATCH once they move to a patchable state.
// Poll up to ~30s for the status to change before giving up.
await step('2 PATCH /incident', async () => {
  if (!nerisIncidentId) throw new Error('Skipped — no incident ID from step 1')

  const patchableStatuses = ['REJECTED', 'PENDING_APPROVAL', 'PENDING_INCIDENT_DATA', 'APPROVED']
  const maxAttempts = 10
  const delayMs = 3000

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await nerisRequest(authorization, 'PATCH', `/incident/${entityId}/${nerisIncidentId}`, {
        neris_id: nerisIncidentId,
        action: 'patch',
        properties: {},
      })
      return
    } catch (err) {
      const isStatusError = patchableStatuses.some(s => err.message.includes('SUBMITTED'))
      if (!isStatusError || attempt === maxAttempts) throw err
      process.stdout.write(`   Waiting for incident to leave SUBMITTED status (attempt ${attempt}/${maxAttempts})...\n`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
})

// Criterion 3 — PATCH /entity
await step('3 PATCH /entity', async () => {
  await nerisRequest(authorization, 'PATCH', `/entity/${entityId}`, {})
})

// Criterion 4 — POST /entity/station/{id}/unit (station already exists from prior run)
const existingStationId = 'FD35049607S000'
await step('4 POST /entity/station/unit', async () => {
  const { json } = await nerisRequest(
    authorization, 'POST',
    `/entity/${entityId}/station/${existingStationId}/unit`,
    {
      cad_designation_1: `BADGE-UNIT-${Date.now()}`,
      type: 'ENGINE_STRUCT',
      staffing: 4,
    }
  )
  const unitId = json?.id ?? json?.neris_id ?? json?.unit_id ?? null
  if (unitId) console.log(`   Unit ID: ${unitId}`)
  else console.log(`   Response: ${JSON.stringify(json).slice(0, 200)}`)
})

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`Results: ${passCount} passed, ${failCount} failed`)
if (failCount === 0) {
  console.log('All badge criteria met. Ready to apply for the compatibility badge.')
} else {
  console.log('Fix the failing steps above, then re-run.')
  process.exit(1)
}
