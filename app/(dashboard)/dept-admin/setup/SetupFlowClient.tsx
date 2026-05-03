'use client'

import { useState, useEffect } from 'react'
import StationsStep from './StationsStep'
import ApparatusStep from './ApparatusStep'
import PersonnelStep from './PersonnelStep'
import CompartmentsStep from './CompartmentsStep'
import ItemsStep from './ItemsStep'
import HelpPrompt from './HelpPrompt'

const STEPS = [
  { id: 'stations',     label: 'Stations',      description: 'Physical station locations' },
  { id: 'apparatus',    label: 'Apparatus',      description: 'Vehicles and units' },
  { id: 'personnel',    label: 'Personnel',      description: 'Department members' },
  { id: 'compartments', label: 'Compartments',   description: 'Compartment templates' },
  { id: 'items',        label: 'Items & Assets', description: 'Equipment and tracking' },
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
}) {
  const [activeStep, setActiveStep] = useState('stations')
  const [showHelp, setShowHelp] = useState(true)
  const [helpResetKey, setHelpResetKey] = useState(0)
  const [helpMounted, setHelpMounted] = useState(false)

  // Load persisted help preference on mount
  useEffect(() => {
    setHelpMounted(true)
    const saved = localStorage.getItem('setup_show_help')
    if (saved === 'false') setShowHelp(false)
  }, [])

  function toggleHelp() {
    const next = !showHelp
    setShowHelp(next)
    localStorage.setItem('setup_show_help', next ? 'true' : 'false')
    if (next) {
      // Re-enabling help — clear all individual dismissals so prompts reappear
      Object.keys(localStorage)
        .filter(k => k.startsWith('setup_help_dismissed_'))
        .forEach(k => localStorage.removeItem(k))
      setHelpResetKey(k => k + 1)
    }
  }

  const counts: Record<string, number> = {
    stations:     stations.filter(s => s.active).length,
    apparatus:    apparatus.filter(a => a.active).length,
    personnel:    personnel.filter(p => p.active).length,
    compartments: compartments.filter(c => c.active).length,
    items:        items.filter(i => i.active).length,
  }

  const helpProps = { showHelp: helpMounted && showHelp, helpResetKey }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{department.name}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Department Setup</p>
        </div>
        <button
          onClick={toggleHelp}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            helpMounted && showHelp
              ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
              : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
          }`}
        >
          <span>?</span>
          <span>{helpMounted && showHelp ? 'Hide Help' : 'Show Help'}</span>
        </button>
      </div>

      {/* Page-level help prompt */}
      <HelpPrompt id="page-intro" {...helpProps}>
        Work through each step in order — Stations → Apparatus → Personnel → Compartments → Items. Each step builds on the one before it.
      </HelpPrompt>

      {/* Mobile tabs */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2 mb-4">
        {STEPS.map(step => (
          <button
            key={step.id}
            onClick={() => setActiveStep(step.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeStep === step.id
                ? 'bg-red-700 text-white'
                : 'bg-white border border-zinc-200 text-zinc-600 hover:border-red-300'
            }`}
          >
            {step.label}
          </button>
        ))}
      </div>

      <div className="flex gap-6 items-start">
        {/* Left step rail — desktop only */}
        <div className="hidden md:flex flex-col w-52 shrink-0 gap-1.5">
          {STEPS.map((step, index) => {
            const count = counts[step.id] ?? 0
            const isActive = activeStep === step.id
            const hasData = count > 0

            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${
                  isActive
                    ? 'bg-red-700 shadow-sm'
                    : 'bg-white border border-zinc-200 hover:border-red-200 hover:shadow-sm'
                }`}
              >
                <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive    ? 'bg-white/20 text-white' :
                  hasData     ? 'bg-green-100 text-green-700' :
                                'bg-zinc-100 text-zinc-500'
                }`}>
                  {hasData && !isActive ? '✓' : index + 1}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${isActive ? 'text-white' : 'text-zinc-900'}`}>
                    {step.label}
                  </p>
                  <p className={`text-xs mt-0.5 ${isActive ? 'text-red-200' : 'text-zinc-400'}`}>
                    {count === 0 ? 'None added' : `${count} added`}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Step content */}
        <div className="flex-1 min-w-0">
          {activeStep === 'stations' && (
            <StationsStep stations={stations} departmentId={departmentId} {...helpProps} />
          )}
          {activeStep === 'apparatus' && (
            <ApparatusStep
              apparatus={apparatus}
              stations={stations}
              apparatusTypes={apparatusTypes}
              departmentId={departmentId}
              {...helpProps}
            />
          )}
          {activeStep === 'personnel' && (
            <PersonnelStep personnel={personnel} roles={roles} departmentId={departmentId} {...helpProps} />
          )}
          {activeStep === 'compartments' && (
            <CompartmentsStep
              compartments={compartments}
              usageMap={usageMap}
              assignmentMap={assignmentMap}
              apparatus={apparatusForCompartments}
              departmentId={departmentId}
              {...helpProps}
            />
          )}
          {activeStep === 'items' && (
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
        </div>
      </div>
    </div>
  )
}
