'use client'

import { useEffect } from 'react'
import { logClientError } from '@/app/actions/client-errors'
import { shouldLogClientError } from '@/lib/client-error-dedup'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (!shouldLogClientError(error.message)) return
    logClientError({
      message: error.message,
      stack: error.stack,
      page: window.location.pathname,
      kind: 'render',
    }).catch(() => {})
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold text-zinc-900">Something went wrong</h1>
      <p className="max-w-sm text-sm text-zinc-500">
        This has been reported. Try again, or head back to your dashboard.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
        >
          Try Again
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Dashboard
        </a>
      </div>
    </div>
  )
}
