'use client'

import { useEffect } from 'react'
import { logClientError } from '@/app/actions/client-errors'
import { shouldLogClientError } from '@/lib/client-error-dedup'

export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-bold text-zinc-900">Something went wrong</h1>
        <p className="max-w-sm text-sm text-zinc-500">
          This has been reported. Try reloading the page.
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
        >
          Try Again
        </button>
      </body>
    </html>
  )
}
