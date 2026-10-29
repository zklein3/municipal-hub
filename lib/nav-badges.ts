import type { PermissionSnapshot } from '@/lib/permissions'

// Raw counts returned by the layout_counts() database function.
export type LayoutCounts = {
  public_site_enabled: boolean; module_operations: boolean; module_iso: boolean
  module_neris: boolean; module_medical: boolean; module_ics: boolean
  announcements_unread: number; pending_permits: number; pending_requests: number
  pending_signatures: number; unread_messages: number; medical_alerts: number
}

// The sidebar badge numbers for one viewer. Shared by the layout (initial render) and
// /api/nav-counts (background refresh) so both always agree on what a viewer may see.
export function computeNavBadges(counts: LayoutCounts, permissions: PermissionSnapshot | undefined) {
  const medicalAlerts = counts.module_medical && permissions?.manage_medical_inventory ? counts.medical_alerts : 0
  const inboxPending =
    (permissions?.review_burn_permits ? counts.pending_permits : 0) +
    (permissions?.manage_public_inbox ? counts.pending_requests : 0) +
    medicalAlerts
  return {
    announcementUnread: counts.announcements_unread,
    inboxPending,
    pendingSignatures: counts.pending_signatures + counts.unread_messages,
  }
}
