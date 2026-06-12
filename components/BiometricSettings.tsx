'use client'

import { useEffect, useState } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import {
  getBiometricRegistrationOptions,
  verifyBiometricRegistration,
  listBiometricCredentials,
  removeBiometricCredential,
} from '@/app/actions/biometric'

interface Credential {
  id: string
  device_label: string | null
  created_at: string
  last_used_at: string | null
}

export default function BiometricSettings({ initialCredentials }: { initialCredentials: Credential[] }) {
  const [credentials, setCredentials] = useState(initialCredentials)
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      setSupported(false)
    }
  }, [])

  async function handleAddDevice() {
    setError(null)
    setSuccess(null)
    setLoading(true)

    const optionsResult = await getBiometricRegistrationOptions()
    if (optionsResult.error || !optionsResult.options) {
      setError(optionsResult.error ?? 'Could not start registration.')
      setLoading(false)
      return
    }

    try {
      const attestation = await startRegistration({ optionsJSON: optionsResult.options })
      const verifyResult = await verifyBiometricRegistration(attestation, guessDeviceLabel())
      if (verifyResult.error) {
        setError(verifyResult.error)
        setLoading(false)
        return
      }
      setCredentials(await listBiometricCredentials())
      setSuccess('Biometric unlock enabled on this device.')
    } catch {
      setError('Could not register this device. Make sure your device supports Face ID, Touch ID, Windows Hello, or fingerprint unlock.')
    }
    setLoading(false)
  }

  async function handleRemove(id: string) {
    setRemovingId(id)
    setError(null)
    const result = await removeBiometricCredential(id)
    setRemovingId(null)
    if (result.error) { setError(result.error); return }
    setCredentials(prev => prev.filter(c => c.id !== id))
  }

  if (!supported) return null

  return (
    <div className="rounded-xl bg-white shadow-sm border border-zinc-200 p-6 mb-6">
      <h2 className="text-base font-semibold text-zinc-900 mb-1">Biometric Unlock</h2>
      <p className="text-sm text-zinc-500 mb-4">
        Use Face ID, Touch ID, Windows Hello, or your fingerprint to unlock FireOps7 on this device instead of re-entering your password.
      </p>

      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}

      {credentials.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {credentials.map(c => (
            <li key={c.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-zinc-900">{c.device_label || 'Device'}</p>
                <p className="text-xs text-zinc-400">
                  Added {new Date(c.created_at).toLocaleDateString()}
                  {c.last_used_at && ` · Last used ${new Date(c.last_used_at).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => handleRemove(c.id)}
                disabled={removingId === c.id}
                className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                {removingId === c.id ? 'Removing...' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={handleAddDevice}
        disabled={loading}
        className="rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Setting up...' : 'Enable on This Device'}
      </button>
    </div>
  )
}

function guessDeviceLabel() {
  if (typeof navigator === 'undefined') return 'Device'
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android device'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows PC'
  return 'Device'
}

function Alert({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={`mb-3 rounded-lg px-4 py-3 text-sm border ${
      type === 'success'
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-red-50 text-red-700 border-red-200'
    }`}>
      {message}
    </div>
  )
}
