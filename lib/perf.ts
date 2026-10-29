// Optional timing for every Supabase request, used to find slow pages. Off unless PERF_LOG=1 is
// set in the environment (dev only) -- when off, `perfGlobal` is empty and the clients behave
// exactly as before.
//
// Each request logs one line: "[perf] 123ms GET rest/v1/medical_stock_lots". scripts/pw/perf-pages.mjs
// reads those lines to count queries and total time per page.
const enabled = process.env.PERF_LOG === '1'

const perfFetch: typeof fetch = async (input, init) => {
  const start = performance.now()
  try {
    return await fetch(input, init)
  } finally {
    const ms = Math.round(performance.now() - start)
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    let label = raw
    try { label = new URL(raw).pathname.replace(/^\//, '') } catch {}
    console.log(`[perf] ${ms}ms ${init?.method ?? 'GET'} ${label}`)
  }
}

export const perfGlobal: { global?: { fetch: typeof fetch } } = enabled ? { global: { fetch: perfFetch } } : {}
