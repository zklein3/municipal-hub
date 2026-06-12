'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/logger'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server'
import { getRpID, getOrigin, RP_NAME } from '@/lib/webauthn'

const CHALLENGE_COOKIE = 'webauthn_challenge'
const UNLOCK_COOKIE = 'bio_unlock'

async function getCurrentPersonnel() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const adminClient = createAdminClient()
  const { data: meList } = await adminClient
    .from('personnel')
    .select('id, email, first_name, last_name')
    .eq('auth_user_id', user.id)
  return meList?.[0] ?? null
}

// ─── Registration ──────────────────────────────────────────────────────────
export async function getBiometricRegistrationOptions() {
  const personnel = await getCurrentPersonnel()
  if (!personnel) return { error: 'Not signed in.' }

  const adminClient = createAdminClient()
  const { data: existing } = await adminClient
    .from('biometric_credentials')
    .select('credential_id, transports')
    .eq('personnel_id', personnel.id)

  const rpID = await getRpID()

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: personnel.email,
    userDisplayName: `${personnel.first_name} ${personnel.last_name}`,
    attestationType: 'none',
    excludeCredentials: (existing ?? []).map(c => ({
      id: c.credential_id,
      transports: c.transports ?? undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  })

  return { options }
}

export async function verifyBiometricRegistration(response: RegistrationResponseJSON, deviceLabel: string) {
  const personnel = await getCurrentPersonnel()
  if (!personnel) return { error: 'Not signed in.' }

  const cookieStore = await cookies()
  const expectedChallenge = cookieStore.get(CHALLENGE_COOKIE)?.value
  if (!expectedChallenge) return { error: 'Registration expired. Please try again.' }

  const rpID = await getRpID()
  const origin = await getOrigin()

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })
  } catch (err) {
    await logError(err, '/profile', { personnel_id: personnel.id, metadata: { action: 'verifyBiometricRegistration' } })
    return { error: 'Could not verify this device. Please try again.' }
  }

  if (!verification.verified || !verification.registrationInfo) {
    return { error: 'Could not verify this device. Please try again.' }
  }

  const { credential } = verification.registrationInfo

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('biometric_credentials').insert({
    personnel_id: personnel.id,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    device_label: deviceLabel || 'This device',
    transports: credential.transports ?? null,
  })

  cookieStore.delete(CHALLENGE_COOKIE)

  if (dbErr) {
    await logError(dbErr, '/profile', { personnel_id: personnel.id, metadata: { action: 'verifyBiometricRegistration' } })
    return { error: 'Could not save this device.' }
  }

  return { success: true }
}

// ─── Unlock (Authentication) ─────────────────────────────────────────────────
export async function getBiometricUnlockOptions() {
  const personnel = await getCurrentPersonnel()
  if (!personnel) return { error: 'Not signed in.' }

  const adminClient = createAdminClient()
  const { data: existing } = await adminClient
    .from('biometric_credentials')
    .select('credential_id, transports')
    .eq('personnel_id', personnel.id)

  if (!existing || existing.length === 0) return { error: 'No biometric credentials registered on this account.' }

  const rpID = await getRpID()

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: existing.map(c => ({
      id: c.credential_id,
      transports: c.transports ?? undefined,
    })),
    userVerification: 'required',
  })

  const cookieStore = await cookies()
  cookieStore.set(CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  })

  return { options }
}

export async function verifyBiometricUnlock(response: AuthenticationResponseJSON) {
  const personnel = await getCurrentPersonnel()
  if (!personnel) return { error: 'Not signed in.' }

  const cookieStore = await cookies()
  const expectedChallenge = cookieStore.get(CHALLENGE_COOKIE)?.value
  if (!expectedChallenge) return { error: 'Unlock expired. Please try again.' }

  const adminClient = createAdminClient()
  const { data: storedList } = await adminClient
    .from('biometric_credentials')
    .select('*')
    .eq('personnel_id', personnel.id)
    .eq('credential_id', response.id)
  const stored = storedList?.[0]

  if (!stored) return { error: 'Unrecognized device.' }

  const rpID = await getRpID()
  const origin = await getOrigin()

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: stored.credential_id,
        publicKey: Buffer.from(stored.public_key, 'base64url'),
        counter: stored.counter,
        transports: stored.transports ?? undefined,
      },
    })
  } catch (err) {
    await logError(err, '/dashboard', { personnel_id: personnel.id, metadata: { action: 'verifyBiometricUnlock' } })
    return { error: 'Could not verify. Please try again.' }
  }

  if (!verification.verified) {
    return { error: 'Could not verify. Please try again.' }
  }

  await adminClient
    .from('biometric_credentials')
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq('id', stored.id)

  cookieStore.delete(CHALLENGE_COOKIE)
  cookieStore.set(UNLOCK_COOKIE, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // No maxAge — session cookie, cleared when the browser/PWA is fully closed.
  })

  return { success: true }
}

// ─── Management ──────────────────────────────────────────────────────────────
export async function listBiometricCredentials() {
  const personnel = await getCurrentPersonnel()
  if (!personnel) return []

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('biometric_credentials')
    .select('id, device_label, created_at, last_used_at')
    .eq('personnel_id', personnel.id)
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function removeBiometricCredential(id: string) {
  const personnel = await getCurrentPersonnel()
  if (!personnel) return { error: 'Not signed in.' }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('biometric_credentials')
    .delete()
    .eq('id', id)
    .eq('personnel_id', personnel.id)

  if (error) return { error: 'Could not remove this device.' }
  return { success: true }
}

// ─── Lock gate (used by dashboard layout) ─────────────────────────────────────
export async function hasBiometricCredentials() {
  const personnel = await getCurrentPersonnel()
  if (!personnel) return false

  const adminClient = createAdminClient()
  const { count } = await adminClient
    .from('biometric_credentials')
    .select('id', { count: 'exact', head: true })
    .eq('personnel_id', personnel.id)

  return (count ?? 0) > 0
}

export async function isBiometricUnlocked() {
  const cookieStore = await cookies()
  return cookieStore.get(UNLOCK_COOKIE)?.value === '1'
}
