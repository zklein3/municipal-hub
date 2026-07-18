// Converts an entered "Amount Administered" value to the volume (in volumeUnit) the backend
// stores. When the lot has concentration data, the field collects a dose (e.g. mcg) since
// that's how a dose is actually documented — mL is not something anyone administering a
// controlled substance is thinking in.
export function administeredDoseToVolume(form: { doseUnit: string | null; concentrationAmount: number | null }, entered: number): number {
  if (form.doseUnit && form.concentrationAmount) return entered / form.concentrationAmount
  return entered
}
