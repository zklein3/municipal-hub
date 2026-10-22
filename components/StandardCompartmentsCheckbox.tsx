// New-apparatus forms: on by default. createApparatus reads `add_standard_compartments` and
// deploys every compartment preset tagged with the chosen apparatus type.
export default function StandardCompartmentsCheckbox() {
  return (
    <label className="flex items-start gap-2 rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2.5 cursor-pointer">
      <input type="checkbox" name="add_standard_compartments" value="true" defaultChecked
        className="mt-0.5 rounded border-zinc-300 text-red-600 focus:ring-red-500" />
      <span className="text-sm text-zinc-700">
        Add standard compartments for this type
        <span className="block text-xs text-zinc-500">
          Creates the compartments and starter items your department has set as standard for the selected type
          (Setup → Presets). You can rename or change them afterward.
        </span>
      </span>
    </label>
  )
}
