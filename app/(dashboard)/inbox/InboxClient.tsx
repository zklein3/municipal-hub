'use client'

import { useState } from 'react'
import BurnPermitsTab from './BurnPermitsTab'
import RecordRequestsTab from './RecordRequestsTab'

type Tab = 'permits' | 'records'

export default function InboxClient({
  permits,
  requests,
  initialTab,
  deptName,
  burnPermitCountyInfo,
  burnPermitRestrictions,
}: {
  permits: any[]
  requests: any[]
  initialTab: Tab
  deptName: string | null
  burnPermitCountyInfo: string | null
  burnPermitRestrictions: string | null
}) {
  const [tab, setTab] = useState<Tab>(initialTab)

  const pendingPermits  = permits.filter(p => p.status === 'pending').length
  const pendingRequests = requests.filter(r => r.status === 'pending').length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Public Inbox</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Burn permit requests and public records requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-zinc-200 p-1 mb-6 w-fit">
        <button
          onClick={() => setTab('permits')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'permits' ? 'bg-red-700 text-white' : 'text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          Burn Permits
          {pendingPermits > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold leading-none ${
              tab === 'permits' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'
            }`}>
              {pendingPermits}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('records')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'records' ? 'bg-red-700 text-white' : 'text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          Records Requests
          {pendingRequests > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold leading-none ${
              tab === 'records' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'
            }`}>
              {pendingRequests}
            </span>
          )}
        </button>
      </div>

      {tab === 'permits' && (
        <BurnPermitsTab
          permits={permits}
          deptName={deptName}
          burnPermitCountyInfo={burnPermitCountyInfo}
          burnPermitRestrictions={burnPermitRestrictions}
        />
      )}

      {tab === 'records' && <RecordRequestsTab requests={requests} />}
    </div>
  )
}
