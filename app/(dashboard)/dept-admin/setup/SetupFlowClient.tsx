'use client'

import { useState } from 'react'
import Link from 'next/link'
import StationsStep from './StationsStep'
import ApparatusStep from './ApparatusStep'
import CompartmentsStep from './CompartmentsStep'
import ItemsStep from './ItemsStep'

const TABS = [
  { id: 'stations',     label: 'Stations'      },
  { id: 'apparatus',    label: 'Apparatus'     },
  { id: 'compartments', label: 'Compartments'  },
  { id: 'items',        label: 'Items'         },
  { id: 'assets',       label: 'Assets'        },
]

const STATUS_STYLES: Record<string, string> = {
  'IN SERVICE':      'bg-green-100 text-green-700',
  'OUT OF SERVICE':  'bg-yellow-100 text-yellow-700',
  'RETIRED':         'bg-zinc-100 text-zinc-500',
}

export default function SetupFlowClient({
  department,
  stations,
  apparatus,
  apparatusTypes,
  personnel,
  roles,
  compartments,
  usageMap,
  assignmentMap,
  apparatusForCompartments,
  categories,
  items,
  assets,
  templates,
  steps,
  departmentId,
  moduleIso,
}: {
  department: { id: string; name: string }
  stations: any[]
  apparatus: any[]
  apparatusTypes: any[]
  personnel: any[]
  roles: any[]
  compartments: any[]
  usageMap: Record<string, number>
  assignmentMap: Record<string, string[]>
  apparatusForCompartments: any[]
  categories: any[]
  items: any[]
  assets: any[]
  templates: any[]
  steps: any[]
  departmentId: string
  moduleIso: boolean
}) {
  const [activeTab, setActiveTab] = useState('stations')

  const helpProps = { showHelp: false, helpResetKey: 0 }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Equipment</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{department.name}</p>
        </div>
        <Link href="/equipment/storage" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors shadow-sm">
          Inventory Storage →
        </Link>
      </div>

      {/* Tabs — mobile: horizontal scroll, desktop: left rail */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2 mb-4">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-red-700 text-white'
                : 'bg-white border border-zinc-200 text-zinc-600 hover:border-red-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-6 items-start">
        {/* Left tab rail — desktop */}
        <div className="hidden md:flex flex-col w-44 shrink-0 gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-red-700 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'stations' && (
            <StationsStep stations={stations} departmentId={departmentId} {...helpProps} />
          )}
          {activeTab === 'apparatus' && (
            <ApparatusStep
              apparatus={apparatus}
              stations={stations}
              apparatusTypes={apparatusTypes}
              departmentId={departmentId}
              {...helpProps}
            />
          )}
          {activeTab === 'compartments' && (
            <CompartmentsStep
              compartments={compartments}
              usageMap={usageMap}
              assignmentMap={assignmentMap}
              apparatus={apparatusForCompartments}
              departmentId={departmentId}
              {...helpProps}
            />
          )}
          {activeTab === 'items' && (
            <ItemsStep
              categories={categories}
              items={items}
              assets={assets}
              templates={templates}
              steps={steps}
              departmentId={departmentId}
              {...helpProps}
            />
          )}
          {activeTab === 'assets' && (() => {
            const itemMap = Object.fromEntries(items.map(i => [i.id, i.item_name]))
            const apparatusMap = Object.fromEntries(apparatus.map(a => [a.id, a.unit_number + (a.apparatus_name ? ` — ${a.apparatus_name}` : '')]))
            const activeAssets = assets.filter(a => a.active)
            return (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900">Assets</h2>
                    <p className="text-sm text-zinc-500">{activeAssets.length} active asset{activeAssets.length !== 1 ? 's' : ''}</p>
                  </div>
                  <Link
                    href="/equipment/assets"
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    Full Roster →
                  </Link>
                </div>
                {activeAssets.length === 0 ? (
                  <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
                    No assets found. Add assets under the Items tab.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeAssets.map(asset => (
                      <div key={asset.id} className="rounded-xl bg-white border border-zinc-200 shadow-sm p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-900 font-mono">{asset.asset_tag ?? '—'}</p>
                            <p className="text-xs text-zinc-500 truncate">{itemMap[asset.item_id] ?? '—'}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[asset.status] ?? 'bg-zinc-100 text-zinc-500'}`}>
                            {asset.status ?? 'Unknown'}
                          </span>
                        </div>
                        {asset.apparatus_id && (
                          <p className="text-xs text-zinc-400 mt-1">📍 {apparatusMap[asset.apparatus_id] ?? '—'}</p>
                        )}
                        {asset.serial_number && (
                          <p className="text-xs text-zinc-400">S/N: {asset.serial_number}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
