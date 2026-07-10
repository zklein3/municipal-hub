import crypto from 'crypto'

export type CheckinType = 'event_instance' | 'training_event' | 'incident'

type CheckinPayload = { type: CheckinType; id: string; exp: number }

function secret(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.')
  return key
}

function sign(body: string): string {
  return crypto.createHmac('sha256', secret()).update(body).digest('base64url')
}

export function createCheckinToken(payload: { type: CheckinType; id: string }, ttlMs: number): string {
  const full: CheckinPayload = { ...payload, exp: Date.now() + ttlMs }
  const body = Buffer.from(JSON.stringify(full)).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifyCheckinToken(token: string): CheckinPayload | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null

  const expected = sign(body)
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as CheckinPayload
    if (Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}
