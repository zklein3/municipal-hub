'use client'

import { useEffect, useState, useCallback } from 'react'
import QRScanner from '@/components/QRScanner'
import { getKioskContext, kioskScan, kioskManualEntry, getKioskRosterPickerList } from '@/app/actions/kiosk'

type RosterEntry = { id: string; name: string; dept: string | null; checked_in_at: string }
type PickerEntry = { id: string; name: string }

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function KioskPage() {
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [deptName, setDeptName] = useState('')
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerList, setPickerList] = useState<PickerEntry[]>([])
  const [pickerSearch, setPickerSearch] = useState('')
  const [banner, setBanner] = useState<{ action: 'checked_in' | 'checked_out'; name: string } | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  useEffect(() => {
    setDeviceId(localStorage.getItem('kiosk_device_id'))
    setSecret(localStorage.getItem('kiosk_device_secret'))
  }, [])

  const refresh = useCallback(async (id: string, sec: string) => {
    const result = await getKioskContext(id, sec)
    if (result.error) { setSetupError(result.error); setLoading(false); return }
    setDeptName(result.deptName ?? '')
    setRoster(result.roster ?? [])
    setSetupError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!deviceId || !secret) { setLoading(false); return }
    refresh(deviceId, secret)
    const interval = setInterval(() => refresh(deviceId, secret), 30000)
    return () => clearInterval(interval)
  }, [deviceId, secret, refresh])

  async function handleScan(raw: string) {
    setScannerOpen(false)
    if (!deviceId || !secret) return
    const result = await kioskScan(deviceId, secret, raw)
    if (result.error) { setScanError(result.error); setTimeout(() => setScanError(null), 4000); return }
    if (result.action && result.displayName) {
      setBanner({ action: result.action, name: result.displayName })
      setTimeout(() => setBanner(null), 4000)
    }
    if (result.roster) setRoster(result.roster)
  }

  async function openPicker() {
    if (!deviceId || !secret) return
    const result = await getKioskRosterPickerList(deviceId, secret)
    setPickerList(result.list ?? [])
    setPickerSearch('')
    setPickerOpen(true)
  }

  async function handlePick(personnelId: string) {
    if (!deviceId || !secret) return
    setPickerOpen(false)
    const result = await kioskManualEntry(deviceId, secret, personnelId)
    if (result.error) { setScanError(result.error); setTimeout(() => setScanError(null), 4000); return }
    if (result.action && result.displayName) {
      setBanner({ action: result.action, name: result.displayName })
      setTimeout(() => setBanner(null), 4000)
    }
    if (result.roster) setRoster(result.roster)
  }

  function clearDevice() {
    localStorage.removeItem('kiosk_device_id')
    localStorage.removeItem('kiosk_device_secret')
    setDeviceId(null)
    setSecret(null)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">Loading…</div>
  }

  if (!deviceId || !secret || setupError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-white mb-3">This device isn&apos;t set up</h1>
          <p className="text-sm text-zinc-400 mb-4">
            {setupError ?? 'No kiosk credential found on this device.'}
          </p>
          <p className="text-sm text-zinc-500">
            On a logged-in admin account, go to <span className="font-mono text-zinc-300">Dept Admin → Kiosk Devices</span>, create a device, and tap "Set Up This Device Now" from this tablet.
          </p>
          {setupError && (
            <button onClick={clearDevice} className="mt-4 text-xs text-zinc-500 underline hover:text-zinc-300">
              Clear saved credential
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center px-4 py-8">
      <h1 className="text-2xl font-bold">{deptName}</h1>
      <p className="text-sm text-zinc-400 mb-8">Station Presence</p>

      {banner && (
        <div className={`w-full max-w-md rounded-2xl px-6 py-5 mb-6 text-center ${banner.action === 'checked_in' ? 'bg-green-700' : 'bg-zinc-700'}`}>
          <p className="text-2xl font-bold">{banner.action === 'checked_in' ? `Welcome, ${banner.name}!` : `See you later, ${banner.name}!`}</p>
        </div>
      )}
      {scanError && (
        <div className="w-full max-w-md rounded-2xl px-6 py-5 mb-6 text-center bg-red-800">
          <p className="text-lg font-semibold">{scanError}</p>
        </div>
      )}

      <div className="flex gap-3 mb-8">
        <button
          onClick={() => setScannerOpen(true)}
          className="rounded-2xl bg-red-700 hover:bg-red-800 transition-colors px-8 py-5 text-xl font-bold"
        >
          Scan Card
        </button>
        <button
          onClick={openPicker}
          className="rounded-2xl border border-zinc-700 hover:bg-zinc-900 transition-colors px-6 py-5 text-lg font-semibold text-zinc-300"
        >
          Manual Check-In
        </button>
      </div>

      <div className="w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
          Currently At Station ({roster.length})
        </p>
        {roster.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center py-6">No one checked in.</p>
        ) : (
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 divide-y divide-zinc-800">
            {roster.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{r.name}</p>
                  {r.dept && <p className="text-xs text-zinc-500">{r.dept}</p>}
                </div>
                <span className="text-xs text-zinc-500">{formatTime(r.checked_in_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <QRScanner onScan={handleScan} onClose={() => setScannerOpen(false)} hint="Scan FireOps7 QR or Salamander card" />
        </div>
      )}

      {pickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700 p-5 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <p className="text-lg font-semibold">Select Your Name</p>
              <button onClick={() => setPickerOpen(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            <input
              type="text"
              autoFocus
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white mb-3 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <div className="overflow-y-auto flex-1 flex flex-col gap-1">
              {pickerList
                .filter(p => p.name.toLowerCase().includes(pickerSearch.toLowerCase()))
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => handlePick(p.id)}
                    className="text-left rounded-lg px-3 py-2.5 text-sm hover:bg-zinc-800 transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
