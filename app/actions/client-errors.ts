'use server'

import { getCurrentDepartmentContext } from '@/lib/current-department'
import { logEvent } from '@/lib/logger'

// Well-known browser noise that isn't an actionable bug — filtered so the log
// doesn't fill up with things no one can fix (benign layout-thrash warning,
// and errors from cross-origin scripts like ad/extension injections that the
// browser deliberately strips all detail from).
const IGNORED_MESSAGES = [
  'ResizeObserver loop',
  'Script error.',
]

export async function logClientError(payload: {
  message: string
  stack?: string
  page: string
  kind: 'render' | 'uncaught' | 'unhandledrejection'
}) {
  const message = (payload.message || '').slice(0, 2000)
  if (!message || IGNORED_MESSAGES.some(ignored => message.includes(ignored))) return

  const ctx = await getCurrentDepartmentContext().catch(() => null)

  await logEvent({
    log_type: 'error',
    page: payload.page || 'unknown',
    message,
    personnel_id: ctx?.personnelId,
    department_id: ctx?.departmentId ?? undefined,
    metadata: {
      source: 'client',
      kind: payload.kind,
      stack: payload.stack?.slice(0, 4000),
    },
  })
}
