'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startAuthentication } from '@simplewebauthn/browser'
import { getBiometricUnlockOptions, verifyBiometricUnlock } from '@/app/actions/biometric'
import { signOut } from '@/app/actions/auth'

export default function BiometricLockScreen({ name }: { name: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleUnlock() {
    setError(null)
    setLoading(true)

    const optionsResult = await getBiometricUnlockOptions()
    if (optionsResult.error || !optionsResult.options) {
      setError(optionsResult.error ?? 'Could not start unlock.')
      setLoading(false)
      return
    }

    try {
      const assertion = await startAuthentication({ optionsJSON: optionsResult.options })
      const verifyResult = await verifyBiometricUnlock(assertion)
      if (verifyResult.error) {
        setError(verifyResult.error)
        setLoading(false)
        return
      }
      router.refresh()
    } catch {
      setError('Unlock cancelled or failed.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-700">
          <span className="text-2xl font-bold text-white">F7</span>
        </div>
        <h1 className="text-xl font-bold text-zinc-900">Welcome back{name ? `, ${name}` : ''}</h1>
        <p className="mt-1 text-sm text-zinc-500">Unlock with biometrics to continue</p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <button
          onClick={handleUnlock}
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Verifying...' : 'Unlock'}
        </button>

        <form action={signOut} className="mt-3">
          <button type="submit" className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline">
            Use password instead
          </button>
        </form>
      </div>
    </div>
  )
}
