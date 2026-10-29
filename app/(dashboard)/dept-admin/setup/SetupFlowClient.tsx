'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import StationsStep from './StationsStep'
import ApparatusStep from './ApparatusStep'
import CompartmentsStep from './CompartmentsStep'
import ItemsStep from './ItemsStep'
import PresetsStep from './PresetsStep'
import HelpText from '@/components/HelpText'

const DEPT_SETUP_TABS = [
  { id: 'stations',     label: 'Stations'      },
  { id: 'apparatus',    label: 'Apparatus'     },
  { id: 'compartments', label: 'Compartments'  },
  { id: 'items',        label: 'Items'         },
  { id: 'presets',      label: 'Equipment Presets' },
]


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
  customFieldDefs,
  medicalSupplyTypes,
  presetData,
  canManageDeptSetup,
  moduleMedical,
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
  customFieldDefs: Record<string, { id: string; item_id: string; field_label: string; field_order: number }[]>
  medicalSupplyTypes: { id: string; name: string; category: string; unit_of_measure: string }[]
  presetData: {
    presets: { id: string; name: string; default_code: string; description: string | null; sort_order: number | null; active: boolean }[]
    presetItems: { preset_id: string; item_id: string; expected_quantity: number; minimum_quantity: number | null }[]
    presetMeds: { preset_id: string; supply_type_id: string; par_level: number | null }[]
    presetTypes: { preset_id: string; apparatus_type_id: string }[]
    truckCompartments: { id: string; apparatus_id: string; code: string; name: string | null }[]
  }
  canManageDeptSetup: boolean
  moduleMedical: boolean
}) {
  const searchParams = useSearchParams()

  // Medical setup (types, storerooms, bags) lives on the Medical page now (/medical, mode buttons).
  const TABS = canManageDeptSetup ? DEPT_SETUP_TABS : []

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') ?? TABS[0]?.id ?? 'stations')
  const effectiveTab = TABS.some(t => t.id === activeTab) ? activeTab : (TABS[0]?.id ?? 'stations')

  const helpProps = { showHelp: false, helpResetKey: 0 }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Apparatus &amp; Equipment
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">{department.name}</p>
        </div>
      </div>

      <HelpText className="mb-4">
        Set these up roughly in order: Stations, then Apparatus (assigned to a station), then Compartments (on an
        apparatus), then Items (load the starter library here), then Equipment Presets — each step depends on the one before it existing first.
      </HelpText>

      {/* Tabs — mobile: horizontal scroll, desktop: left rail */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2 mb-4">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              effectiveTab === tab.id
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
                effectiveTab === tab.id
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
          {effectiveTab === 'stations' && (
            <StationsStep stations={stations} departmentId={departmentId} {...helpProps} />
          )}
          {effectiveTab === 'apparatus' && (
            <ApparatusStep
              apparatus={apparatus}
              stations={stations}
              apparatusTypes={apparatusTypes}
              departmentId={departmentId}
              {...helpProps}
            />
          )}
          {effectiveTab === 'compartments' && (
            <CompartmentsStep
              compartments={compartments}
              usageMap={usageMap}
              assignmentMap={assignmentMap}
              apparatus={apparatusForCompartments}
              departmentId={departmentId}
              {...helpProps}
            />
          )}
          {effectiveTab === 'presets' && (
            <PresetsStep
              presets={presetData.presets}
              presetItems={presetData.presetItems}
              presetMeds={presetData.presetMeds}
              presetTypes={presetData.presetTypes}
              apparatusTypes={apparatusTypes}
              apparatus={apparatus}
              truckCompartments={presetData.truckCompartments}
              items={items}
              categories={categories}
              medicalSupplyTypes={medicalSupplyTypes}
              moduleMedical={moduleMedical}
              {...helpProps}
            />
          )}
          {effectiveTab === 'items' && (
            <ItemsStep
              categories={categories}
              items={items}
              assets={assets}
              templates={templates}
              steps={steps}
              departmentId={departmentId}
              apparatusOptions={apparatusForCompartments.map(a => ({
                id: a.id,
                label: a.unit_number + (a.apparatus_name ? ` — ${a.apparatus_name}` : ''),
              }))}
              customFieldDefs={customFieldDefs}
              initialSubTab={searchParams.get('sub') ?? undefined}
              moduleMedical={moduleMedical}
              {...helpProps}
            />
          )}
        </div>
      </div>
    </div>
  )
}
