// Converts an entered "Amount Administered" value to the volume (in volumeUnit) the backend
// stores. When the lot has concentration data, the field collects a dose (e.g. mcg) since
// that's how a dose is actually documented — mL is not something anyone administering a
// controlled substance is thinking in.
// "Given 4 mg / Waste 6 mg" for a logged administration. Prefers the dose snapshot taken at
// administration time; falls back to volume ("Given 0.4 / Waste 0.6 mL") for rows with no
// concentration on file.
export function formatAdministration(tx: {
  administered_dose?: number | string | null
  waste_dose?: number | string | null
  dose_unit?: string | null
  administered_amount: number | string | null
  waste_amount: number | string | null
  volume_unit?: string | null
}): string {
  if (tx.dose_unit && tx.administered_dose != null && tx.waste_dose != null) {
    return `Given ${Number(tx.administered_dose)} / Waste ${Number(tx.waste_dose)} ${tx.dose_unit}`
  }
  return `Given ${tx.administered_amount} / Waste ${tx.waste_amount} ${tx.volume_unit ?? ''}`.trim()
}

export function administeredDoseToVolume(form: { doseUnit: string | null; concentrationAmount: number | null }, entered: number): number {
  if (form.doseUnit && form.concentrationAmount) return entered / form.concentrationAmount
  return entered
}
