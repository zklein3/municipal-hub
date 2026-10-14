'use client'

import { useRouter, usePathname } from 'next/navigation'
import HoseReportView, { type ReportNav, type ReportTab } from '@/components/HoseReportView'
import type { HoseReportData, TestSessionReport, TestSessionSummary } from '@/lib/hose-report'

export default function HoseTestingReportClient({
  departmentName, report, dateFrom, dateTo, data, sessions, sessionReport,
}: {
  departmentName: string
  report: ReportTab
  dateFrom: string
  dateTo: string
  data: HoseReportData
  sessions: TestSessionSummary[]
  sessionReport: TestSessionReport | null
}) {
  const router = useRouter()
  const pathname = usePathname()

  function go(nav: ReportNav) {
    const params = new URLSearchParams({ report: nav.report ?? report, from: nav.from ?? dateFrom, to: nav.to ?? dateTo })
    const sessionId = nav.session === undefined ? sessionReport?.id : nav.session
    if (sessionId) params.set('session', sessionId)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <HoseReportView
      departmentName={departmentName}
      report={report}
      dateFrom={dateFrom}
      dateTo={dateTo}
      data={data}
      sessions={sessions}
      sessionReport={sessionReport}
      onNavigate={go}
    />
  )
}
