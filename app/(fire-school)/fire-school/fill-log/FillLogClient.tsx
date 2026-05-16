'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TZ_KEY, TZ_DEFAULT } from '../settings/page'

interface FillLog {
  id: string
  bottle_id: string
  filled_at: string
  fill_result: string
  notes: string | null
}

export default function FillLogClient({ logs: initialLogs }: { logs: FillLog[] }) {
  const [logs, setLogs] = useState<FillLog[]>(initialLogs)
  const [timezone, setTimezone] = useState(TZ_DEFAULT)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const stored = localStorage.getItem(TZ_KEY)
    if (stored) setTimezone(stored)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('fill_log_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fire_school_fill_logs' },
        payload => {
          const incoming = payload.new as FillLog
          setLogs(prev => {
            if (prev.some(l => l.id === incoming.id)) return prev
            return [incoming, ...prev]
          })
          setNewIds(prev => new Set(prev).add(incoming.id))
          setTimeout(() => {
            setNewIds(prev => {
              const next = new Set(prev)
              next.delete(incoming.id)
              return next
            })
          }, 3000)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="rounded-xl bg-white shadow-sm border border-zinc-200 overflow-x-auto">
      {logs.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-zinc-400">No fills logged yet.</div>
      ) : (
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-zinc-600">Bottle ID</th>
              <th className="px-4 py-3 text-left font-semibold text-zinc-600">Date &amp; Time</th>
              <th className="px-4 py-3 text-left font-semibold text-zinc-600">Result</th>
              <th className="px-4 py-3 text-left font-semibold text-zinc-600">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {logs.map(log => (
              <tr
                key={log.id}
                className={`transition-colors duration-1000 ${
                  newIds.has(log.id) ? 'bg-green-50' : 'hover:bg-zinc-50'
                }`}
              >
                <td className="px-4 py-3 font-mono font-bold text-zinc-900">{log.bottle_id}</td>
                <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                  {new Date(log.filled_at).toLocaleString('en-US', {
                    timeZone: timezone,
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                    {log.fill_result}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400">{log.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
