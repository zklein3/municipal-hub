'use client'

import { useState } from 'react'
import { submitMembershipInterest } from '@/app/actions/public-site'

const INTEREST_OPTIONS = [
  { value: 'firefighting', label: 'Firefighting' },
  { value: 'ems', label: 'EMS / EMT' },
  { value: 'both', label: 'Both firefighting and EMS' },
  { value: 'junior_cadet', label: 'Junior Cadet program' },
  { value: 'learn_more', label: "I'd like to learn more before deciding" },
]

const EMS_CERT_OPTIONS = [
  { value: 'certified_emt', label: 'Currently certified EMT' },
  { value: 'certified_other', label: 'Certified at another EMS level' },
  { value: 'lapsed', label: 'Previously certified; may need to renew' },
  { value: 'not_certified', label: 'Not certified, but interested in becoming an EMT' },
  { value: 'discuss', label: "I'd like to discuss my options" },
]

const EXPERIENCE_OPTIONS = [
  { value: 'fire', label: 'Fire department experience' },
  { value: 'ems', label: 'EMT / EMS experience' },
  { value: 'other_response', label: 'Other emergency-response experience' },
  { value: 'military', label: 'Military experience' },
  { value: 'none', label: 'No previous experience' },
  { value: 'other', label: 'Other' },
]

const AVAILABILITY_OPTIONS = [
  { value: 'weekday_mornings', label: 'Weekday mornings (6 AM–noon)' },
  { value: 'weekday_afternoons', label: 'Weekday afternoons (noon–5 PM)' },
  { value: 'weekday_evenings', label: 'Weekday evenings (5 PM–10 PM)' },
  { value: 'overnight', label: 'Overnight hours' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'varies', label: 'My availability varies' },
]

const DAYTIME_COVERAGE_OPTIONS = [
  { value: 'yes_regularly', label: 'Yes, regularly' },
  { value: 'yes_occasionally', label: 'Yes, occasionally' },
  { value: 'possibly', label: 'Possibly, depending on the schedule' },
  { value: 'no', label: 'No, evenings or weekends work better for me' },
  { value: 'not_sure', label: "I'm not sure yet" },
]

const WORK_SCHEDULE_OPTIONS = [
  'Flexible / self-employed', 'Farm or agricultural work', 'Work from home', 'Retired',
  'Part-time employment', 'Full-time employment with a flexible employer',
  'Full-time employment with limited flexibility', 'Student', 'Other',
]

const INVOLVEMENT_OPTIONS = [
  { value: 'regular', label: 'I can participate regularly' },
  { value: 'as_able', label: 'I can help when my schedule allows' },
  { value: 'need_info', label: "I'm interested but need to understand the commitment" },
  { value: 'exploring', label: "I'm just exploring the opportunity" },
]

const TRAINING_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: "Maybe; I'd like more information" },
  { value: 'no', label: 'No, I already have the training I need for my intended role' },
]

const CONTACT_PREF_OPTIONS = [
  { value: 'phone', label: 'Phone call' },
  { value: 'text', label: 'Text message' },
  { value: 'email', label: 'Email' },
]

function CheckboxGroup({
  name, options, selected, onChange,
}: {
  name: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(opt => {
        const checked = selected.includes(opt.value)
        return (
          <label
            key={opt.value}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
              checked ? 'border-red-400 bg-red-50' : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <input
              type="checkbox"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(checked ? selected.filter(v => v !== opt.value) : [...selected, opt.value])}
              className="mt-0.5 h-4 w-4 rounded text-red-700 focus:ring-red-500"
            />
            <p className="text-sm text-zinc-800">{opt.label}</p>
          </label>
        )
      })}
    </div>
  )
}

function RadioGroup({
  name, options, value, onChange,
}: {
  name: string
  options: { value: string; label: string }[]
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(opt => (
        <label
          key={opt.value}
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
            value === opt.value ? 'border-red-400 bg-red-50' : 'border-zinc-200 hover:border-zinc-300'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            required
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="mt-0.5 h-4 w-4 text-red-700 focus:ring-red-500"
          />
          <p className="text-sm text-zinc-800">{opt.label}</p>
        </label>
      ))}
    </div>
  )
}

export default function JoinForm({ departmentId, departmentName, slug }: { departmentId: string; departmentName: string; slug: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null)

  const [interests, setInterests] = useState<string[]>([])
  const [priorExperience, setPriorExperience] = useState<string[]>([])
  const [availability, setAvailability] = useState<string[]>([])
  const [daytimeCoverage, setDaytimeCoverage] = useState('')
  const [involvementLevel, setInvolvementLevel] = useState('')
  const [trainingInterest, setTrainingInterest] = useState('')
  const [contactPreference, setContactPreference] = useState('')

  const showEmsCert = interests.includes('ems') || interests.includes('both')

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    formData.set('department_id', departmentId)
    const result = await submitMembershipInterest(formData)
    if (result.error) setError(result.error)
    else if (result.confirmationCode) setConfirmationCode(result.confirmationCode)
    setLoading(false)
  }

  if (confirmationCode) {
    return (
      <div className="rounded-xl bg-white border border-zinc-200 p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Thank You for Considering {departmentName}</h2>
        <p className="text-sm text-zinc-500 mb-6">
          Every person who is willing to serve can make a difference. A department representative will follow up with you
          to discuss your interests, availability, and next steps.
        </p>
        <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-6 py-4 inline-block mb-6">
          <p className="text-xs text-zinc-400 mb-1 font-medium uppercase tracking-wide">Confirmation Code</p>
          <p className="text-2xl font-bold text-zinc-900 font-mono tracking-widest">{confirmationCode}</p>
        </div>
        <p className="text-xs text-zinc-400 mb-6">Save this code for your records.</p>
        <a
          href={`/dept/${slug}`}
          className="inline-block rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          Back to Home
        </a>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="rounded-xl bg-white border border-zinc-200 p-6 flex flex-col gap-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Section 1 — About You */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-zinc-700 mb-1">About You</legend>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input name="full_name" type="text" required autoComplete="name"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input name="phone" type="tel" required autoComplete="tel"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Email Address</label>
            <input name="email" type="email" autoComplete="email"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">What town or community do you live in?</label>
          <input name="community" type="text"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
        </div>
      </fieldset>

      <hr className="border-zinc-100" />

      {/* Section 2 — How Would You Like to Serve */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-zinc-700 mb-1">How Would You Like to Serve?</legend>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Which opportunities interest you? <span className="text-red-500">*</span>
          </label>
          <CheckboxGroup name="interests" options={INTEREST_OPTIONS} selected={interests} onChange={setInterests} />
        </div>

        {showEmsCert && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">What best describes your current EMS certification?</label>
            <select name="ems_cert_level" defaultValue=""
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
              <option value="">Select one</option>
              {EMS_CERT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Do you have previous fire, EMS, military, or emergency-response experience?
          </label>
          <CheckboxGroup name="prior_experience" options={EXPERIENCE_OPTIONS} selected={priorExperience} onChange={setPriorExperience} />
        </div>
      </fieldset>

      <hr className="border-zinc-100" />

      {/* Section 3 — Availability */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-zinc-700 mb-1">Availability</legend>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            When could you typically participate or respond to calls? <span className="text-red-500">*</span>
          </label>
          <CheckboxGroup name="availability" options={AVAILABILITY_OPTIONS} selected={availability} onChange={setAvailability} />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Could you realistically help provide weekday daytime coverage? <span className="text-red-500">*</span>
          </label>
          <RadioGroup name="daytime_coverage" options={DAYTIME_COVERAGE_OPTIONS} value={daytimeCoverage} onChange={setDaytimeCoverage} />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">What best describes your work or daily schedule?</label>
          <select name="work_schedule" defaultValue=""
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
            <option value="">Select one</option>
            {WORK_SCHEDULE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            What level of involvement are you considering? <span className="text-red-500">*</span>
          </label>
          <RadioGroup name="involvement_level" options={INVOLVEMENT_OPTIONS} value={involvementLevel} onChange={setInvolvementLevel} />
        </div>
      </fieldset>

      <hr className="border-zinc-100" />

      {/* Section 4 — Next Steps */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-zinc-700 mb-1">Next Steps</legend>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Would you be interested in training or learning new skills? <span className="text-red-500">*</span>
          </label>
          <RadioGroup name="training_interest" options={TRAINING_OPTIONS} value={trainingInterest} onChange={setTrainingInterest} />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Is there anything else you&apos;d like us to know about your availability, experience, or interests?
          </label>
          <textarea name="additional_info" rows={3}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-y" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            How would you prefer we contact you? <span className="text-red-500">*</span>
          </label>
          <RadioGroup name="contact_preference" options={CONTACT_PREF_OPTIONS} value={contactPreference} onChange={setContactPreference} />
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Submitting...' : 'Submit Interest Form'}
      </button>

      <p className="text-xs text-zinc-400 text-center">
        Submitting this form expresses interest only. Membership, training, qualifications, and authorization to respond
        to emergencies are subject to department requirements.
      </p>
    </form>
  )
}
