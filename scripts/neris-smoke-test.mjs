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

const useTest = process.env.NERIS_USE_TEST === 'true'
const authMode = process.env.NERIS_AUTH_MODE === 'basic' ? 'basic' : 'oauth'
const baseUrl = useTest
  ? 'https://api-test.neris.fsri.org/v1'
  : 'https://api.neris.fsri.org/v1'
const entityId = process.env.NERIS_TEST_DEPT_ID

function mask(value) {
  if (!value) return '(missing)'
  if (value.length <= 8) return `${value.slice(0, 2)}...`
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

async function getAuthHeader() {
  if (authMode === 'basic') {
    const vendorId = process.env.NERIS_VENDOR_ID
    const password = process.env.NERIS_VENDOR_PASSWORD
    if (!vendorId || !password) {
      throw new Error('Missing NERIS_VENDOR_ID or NERIS_VENDOR_PASSWORD in .env.local')
    }

    console.log(`Vendor ID: ${mask(vendorId)}`)
    const credentials = Buffer.from(`${vendorId}:${password}`).toString('base64')
    return `Basic ${credentials}`
  }

  const clientId = process.env.NERIS_CLIENT_ID
  const clientSecret = process.env.NERIS_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Missing NERIS_CLIENT_ID or NERIS_CLIENT_SECRET in .env.local')
  }

  console.log(`Client ID: ${mask(clientId)}`)
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const tokenRes = await fetch(`${baseUrl}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    throw new Error(`Token request failed (${tokenRes.status}): ${body}`)
  }

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    throw new Error(`Token response did not include access_token: ${JSON.stringify(tokenData)}`)
  }

  console.log('Token request: OK')
  console.log(`Token type: ${tokenData.token_type ?? 'Bearer'}`)
  if (tokenData.expires_in) console.log(`Expires in: ${tokenData.expires_in}s`)
  return `Bearer ${tokenData.access_token}`
}

try {
  console.log(`NERIS base URL: ${baseUrl}`)
  console.log(`Auth mode: ${authMode}`)
  console.log(`Test entity: ${entityId ?? '(not set; skipping entity fetch)'}`)

  const authorization = await getAuthHeader()

  if (entityId) {
    const entityRes = await fetch(`${baseUrl}/entity/${encodeURIComponent(entityId)}`, {
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
      },
    })

    if (!entityRes.ok) {
      const body = await entityRes.text()
      throw new Error(`Entity fetch failed (${entityRes.status}): ${body}`)
    }

    const entity = await entityRes.json()
    console.log('Entity fetch: OK')
    console.log(JSON.stringify({
      id: entity.id ?? entity.neris_id ?? entity.entity_id ?? entityId,
      name: entity.name ?? entity.entity_name ?? entity.fd_name ?? null,
    }, null, 2))
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
