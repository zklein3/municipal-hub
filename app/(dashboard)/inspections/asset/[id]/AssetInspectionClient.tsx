'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitInspection } from '@/app/actions/inspections'

type Step = {
  id: string
  step_text: string
  step_type: string
  required: boolean
  fail_if_negative: boolean
}

type Template = {
  id: string
  template_name: string
  template_description: string | null
  steps: Step[]
}

type StepResponse = {
  step_id: string
  boolean_value?: boolean
  numeric_value?: number
  text_value?: string
}

const inputCls = 'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'

export default function AssetInspectionClient({
  asset,
  item,
  templates,
  inspectorName,
  personnelId,
  departmentId,
}: {
  asset: { id: string; asset_tag: string; serial_number: string | null; apparatus_id: string | null; status: string }
  item: { id: string; item_name: string }
  templates: Template[]
  inspectorName: string
  personnelId: string
  departmentId: string
}) {
  const router = useRouter()
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? '')
  const [responses, setResponses] = useState<Record<string, StepResponse>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const template = templates.find(t => t.id === selectedTemplateId) ?? templates[0]

  function setResponse(stepId: string, field: keyof StepResponse, value: unknown) {
    setResponses(prev => ({
      ...prev,
      [stepId]: { ...(prev[stepId] ?? { step_id: stepId }), [field]: value },
    }))
  }

  function isComplete(): boolean {
    if (!template) return false
    for (const step of template.steps) {
      if (!step.required) continue
      const resp = responses[step.id]
      if (!resp) return false
      if (step.step_type === 'BOOLEAN' && resp.boolean_value === undefined) return false
      if (step.step_type === 'BOOLEAN' && resp.boolean_value === false && step.fail_if_negative && !resp.text_value?.trim()) return false
      if (step.step_type === 'NUMERIC' && resp.numeric_value === undefined) return false
    }
    return true
  }

  async function handleSubmit() {
    if (!template) return
    setError(null)
    setSubmitting(true)

    const result = await submitInspection({
      apparatus_id: asset.apparatus_id ?? '',
      compartment_id: '',
      personnel_id: personnelId,
      department_id: departmentId,
      inspector_name: inspectorName,
      asset_inspections: [{
        asset_id: asset.id,
        template_id: template.id,
        responses: Object.values(responses),
      }],
      presence_checks: [],
    })

    setSubmitting(false)
    if (result?.error) { setError(result.error); return }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="rounded-xl bg-white border border-green-200 p-8 text-center shadow-sm">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-zinc-900 mb-1">Inspection Complete</h2>
          <p className="text-sm text-zinc-500 mb-6">{asset.asset_tag} — {item.item_name}</p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/inspections')}
              className="flex-1 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800"
            >
              Inspections
            </button>
            <button
              onClick={() => { setSubmitted(false); setResponses({}) }}
              className="flex-1 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Inspect Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <div className="mb-4">
        <button onClick={() => router.back()} className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors">
          ← Back
        </button>
        <h1 className="text-xl font-bold text-zinc-900 mt-2 font-mono">{asset.asset_tag}</h1>
        <p className="text-sm text-zinc-500">{item.item_name}{asset.serial_number ? ` · S/N: ${asset.serial_number}` : ''}</p>
        <p className="text-xs text-zinc-400 mt-0.5">Inspector: {inspectorName}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {templates.length > 1 && (
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-zinc-600">Inspection Type</label>
          <select
            value={selectedTemplateId}
            onChange={e => { setSelectedTemplateId(e.target.value); setResponses({}) }}
            className={inputCls}
          >
            {templates.map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}
          </select>
        </div>
      )}

      {template && (
        <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden mb-4">
          <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-200">
            <p className="text-sm font-semibold text-zinc-900">{template.template_name}</p>
            {template.template_description && (
              <p className="text-xs text-zinc-500 mt-0.5">{template.template_description}</p>
            )}
          </div>
          <div className="divide-y divide-zinc-100">
            {template.steps.map((step, idx) => {
              const resp = responses[step.id] ?? {}
              return (
                <div key={step.id} className="px-5 py-4">
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-xs font-mono text-zinc-400 mt-0.5 w-5 shrink-0">{idx + 1}.</span>
                    <div className="flex-1">
                      <p className="text-sm text-zinc-800">{step.step_text}</p>
                      {step.fail_if_negative && (
                        <p className="text-xs text-red-500 mt-0.5">⚠ Fail if No</p>
                      )}
                    </div>
                  </div>

                  {step.step_type === 'BOOLEAN' && (
                    <div className="ml-7">
                      <div className="flex gap-3">
                        <button
                          onClick={() => setResponse(step.id, 'boolean_value', true)}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                            resp.boolean_value === true
                              ? 'bg-green-600 border-green-600 text-white'
                              : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                          }`}
                        >Yes</button>
                        <button
                          onClick={() => setResponse(step.id, 'boolean_value', false)}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                            resp.boolean_value === false
                              ? step.fail_if_negative ? 'bg-red-600 border-red-600 text-white' : 'bg-zinc-600 border-zinc-600 text-white'
                              : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                          }`}
                        >No</button>
                      </div>
                      {resp.boolean_value === false && (
                        <div className="mt-2">
                          <textarea
                            rows={2}
                            value={resp.text_value ?? ''}
                            onChange={e => setResponse(step.id, 'text_value', e.target.value)}
                            placeholder={step.fail_if_negative ? 'Required — describe the issue…' : 'Notes (optional)…'}
                            className={`${inputCls} resize-none ${step.fail_if_negative && !resp.text_value?.trim() ? 'border-red-400' : ''}`}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {step.step_type === 'NUMERIC' && (
                    <div className="ml-7">
                      <input
                        type="number"
                        value={resp.numeric_value ?? ''}
                        onChange={e => setResponse(step.id, 'numeric_value', parseFloat(e.target.value))}
                        placeholder="Enter value…"
                        className={inputCls}
                      />
                    </div>
                  )}

                  {(step.step_type === 'TEXT' || step.step_type === 'LONG_TEXT') && (
                    <div className="ml-7">
                      <textarea
                        rows={step.step_type === 'LONG_TEXT' ? 3 : 1}
                        value={resp.text_value ?? ''}
                        onChange={e => setResponse(step.id, 'text_value', e.target.value)}
                        placeholder="Enter notes…"
                        className={`${inputCls} resize-none`}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="pb-8">
        <button
          onClick={handleSubmit}
          disabled={submitting || !isComplete()}
          className="w-full rounded-xl bg-red-700 px-4 py-3 text-base font-bold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting…' : isComplete() ? 'Submit Inspection' : 'Complete All Required Steps'}
        </button>
      </div>
    </div>
  )
}
