'use client'

import { useEffect } from 'react'
import { logClientError } from '@/app/actions/client-errors'
import { shouldLogClientError } from '@/lib/client-error-dedup'

export default function ClientErrorListener() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      const message = event.message || event.error?.message || 'Unknown error'
      if (!shouldLogClientError(message)) return
      logClientError({
        message,
        stack: event.error?.stack,
        page: window.location.pathname,
        kind: 'uncaught',
      }).catch(() => {})
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason
      const message = reason instanceof Error ? reason.message : String(reason)
      if (!shouldLogClientError(message)) return
      const stack = reason instanceof Error ? reason.stack : undefined
      logClientError({
        message,
        stack,
        page: window.location.pathname,
        kind: 'unhandledrejection',
      }).catch(() => {})
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
