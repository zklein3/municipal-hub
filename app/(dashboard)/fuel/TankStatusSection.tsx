'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReceiveDeliveryForm from '@/app/(dashboard)/dept-admin/fuel-tanks/ReceiveDeliveryForm'

type Tank = {
  id: string
  name: string
  fuel_type: 'diesel' | 'gasoline' | 'other'
  capacity_gallons: number
  low_level_threshold_gallons: number
  current_gallons: number
}

const FUEL_COLORS: Record<string, string> = {
  diesel: 'bg-blue-100 text-blue-700',
  gasoline: 'bg-amber-100 text-amber-700',
  other: 'bg-zinc-100 text-zinc-600',
}
const FUEL_LABELS: Record<string, string> = { diesel: 'Diesel', gasoline: 'Gasoline', other: 'Other' }

export default function TankStatusSection({ tanks }: { tanks: Tank[] }) {
  const router = useRouter()
  const [receivingTankId, setReceivingTankId] = useState<string | null>(null)

  return (
    <div>
      <h2 className="text-sm font-semibold text-zinc-700 mb-3">On-Site Fuel Storage</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tanks.map(tank => {
          const levelPct = tank.capacity_gallons > 0
            ? Math.min(100, (tank.current_gallons / tank.capacity_gallons) * 100)
            : 0
          const threshPct = tank.capacity_gallons > 0
            ? Math.min(100, (tank.low_level_threshold_gallons / tank.capacity_gallons) * 100)
            : 0
          const isEmpty = tank.current_gallons <= 0
          const isLow = !isEmpty && tank.current_gallons <= tank.low_level_threshold_gallons
          const barColor = isEmpty ? 'bg-red-400' : isLow ? 'bg-amber-400' : 'bg-green-500'
          const isReceiving = receivingTankId === tank.id

          return (
            <div
              key={tank.id}
              className={`rounded-xl border bg-white p-4 ${(isEmpty || isLow) ? 'border-amber-200' : 'border-zinc-200'}`}
            >
              {/* Name + badges row */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-sm font-semibold text-zinc-900 truncate">{tank.name}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${FUEL_COLORS[tank.fuel_type]}`}>
                    {FUEL_LABELS[tank.fuel_type]}
                  </span>
                  {isEmpty && (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Empty</span>
                  )}
                  {isLow && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Low Fuel</span>
                  )}
                </div>
              </div>

              {/* Level bar */}
              <div className="relative mb-1.5">
                <div className="h-2.5 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${levelPct}%` }}
                  />
                </div>
                {tank.low_level_threshold_gallons > 0 && (
                  <div
                    className="absolute top-0 h-2.5 w-0.5 bg-zinc-400 rounded"
                    style={{ left: `${threshPct}%` }}
                    title={`Alert threshold: ${tank.low_level_threshold_gallons} gal`}
                  />
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-500 mb-3">
                <span>
                  <span className={`font-semibold ${isEmpty ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-zinc-900'}`}>
                    {tank.current_gallons.toFixed(1)} gal
                  </span>
                  {' '}/ {tank.capacity_gallons.toLocaleString()} gal
                </span>
                <span>{levelPct.toFixed(0)}%</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReceivingTankId(isReceiving ? null : tank.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isReceiving
                      ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {isReceiving ? 'Cancel' : '+ Receive Delivery'}
                </button>
                <Link
                  href={`/fuel/tanks/${tank.id}`}
                  className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-200 transition-colors"
                >
                  Details →
                </Link>
              </div>

              {isReceiving && (
                <ReceiveDeliveryForm
                  tankId={tank.id}
                  tankName={tank.name}
                  fuelType={tank.fuel_type}
                  onClose={() => setReceivingTankId(null)}
                  onSuccess={() => {
                    setReceivingTankId(null)
                    router.refresh()
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
