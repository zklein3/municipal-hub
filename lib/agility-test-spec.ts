// Fremont Fire Department's Physical Agility Test — hardcoded per the
// department's actual paper form (candidate-physical-agility.pdf, Feb 2025),
// same idiom as lib/vehicle-check-items.ts's default checklist: this is a
// specific department's sheet, built on request, not a generic form builder.
// If a second department wants their own agility test, give it its own spec
// object here rather than trying to generalize this one — the evolutions,
// cutoffs, and sub-checks are unlikely to line up between two departments'
// actual paper forms.

export type AgilitySubCheck = {
  key: string
  label: string
  type: 'boolean' | 'number'
}

export type AgilityEvolutionSpec = {
  number: number
  name: string
  description: string
  cutoffSeconds: number
  cutoffLabel: string
  timeLabel: string
  subChecks: AgilitySubCheck[]
}

export const FREMONT_AGILITY_TEST: AgilityEvolutionSpec[] = [
  {
    number: 1,
    name: 'Stair Climb + Hose Hoist',
    description:
      'Weighted vest (~30 lbs) + weight belt (~20 lbs). Stairmaster: 20-second warm-up at 50 steps/min, then 60 steps/min for 3 minutes (dismounting early fails the evolution). Then climb the hose tower, pull up and place two hose rolls on the catwalk (a dropped roll must be re-raised until it stays), then proceed to the ventilation drill. Up to a 2-minute rest is allowed before the ventilation simulator, during which the weight belt comes off and the SCBA goes on.',
    cutoffSeconds: 202, // 3:22
    cutoffLabel: '3:22 or less',
    timeLabel: 'Time at ventilation simulator',
    subChecks: [
      { key: 'stairmaster_completed', label: 'Completed the full 3-minute Stairmaster phase without dismounting', type: 'boolean' },
      { key: 'hose_roll_1_placed', label: 'Hose Roll 1 placed and stayed on the catwalk', type: 'boolean' },
      { key: 'hose_roll_2_placed', label: 'Hose Roll 2 placed and stayed on the catwalk', type: 'boolean' },
    ],
  },
  {
    number: 2,
    name: 'Forcible Entry Test',
    description: 'Use a sledgehammer to drive an I-beam a distance of 5 feet, simulating forcible entry/ventilation access.',
    cutoffSeconds: 55,
    cutoffLabel: '55 seconds or less',
    timeLabel: 'Time',
    subChecks: [
      { key: 'number_of_hits', label: 'Number of Hits', type: 'number' },
    ],
  },
  {
    number: 3,
    name: 'Hose Advance',
    description: 'Drag a charged 1-3/4" handline a distance of 75 feet.',
    cutoffSeconds: 33,
    cutoffLabel: '33 seconds or less',
    timeLabel: 'Time',
    subChecks: [],
  },
  {
    number: 4,
    name: 'Victim Rescue',
    description: 'Drag or carry a 175-pound dummy a distance of 100 feet.',
    cutoffSeconds: 45,
    cutoffLabel: '45 seconds or less',
    timeLabel: 'Time',
    subChecks: [],
  },
]

export function evaluateEvolution(
  spec: AgilityEvolutionSpec,
  timeSeconds: number,
  subCheckValues: Record<string, boolean | number>,
): 'pass' | 'fail' {
  if (timeSeconds > spec.cutoffSeconds) return 'fail'
  for (const sc of spec.subChecks) {
    if (sc.type === 'boolean' && subCheckValues[sc.key] === false) return 'fail'
  }
  return 'pass'
}

export function formatSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.round(totalSeconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
