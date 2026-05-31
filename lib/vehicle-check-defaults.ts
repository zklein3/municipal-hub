export interface VehicleCheckDefault {
  label: string
  group_name: string
  sort_order: number
  has_amount_field: boolean
  requires_air_brakes: boolean
  instructions?: string
}

export const VEHICLE_CHECK_DEFAULTS: VehicleCheckDefault[] = [
  // Fluids
  {
    group_name: 'Fluids', label: 'Engine Oil Level', sort_order: 1,
    has_amount_field: true, requires_air_brakes: false,
    instructions: `With engine off and cool, pull the dipstick, wipe clean, reinsert fully, pull again and check the level.

Look for: Oil level between MIN and MAX marks. Color should be amber to dark brown — black is acceptable. Milky or foamy oil indicates coolant contamination.

Pass: Level at or above MIN mark. No milky or foamy appearance.

Fail: Level below MIN — add oil to bring to MAX. Milky or foamy oil — remove from service and notify maintenance.`,
  },
  {
    group_name: 'Fluids', label: 'Coolant Level', sort_order: 2,
    has_amount_field: true, requires_air_brakes: false,
    instructions: `Check the coolant overflow reservoir — do NOT open the radiator cap on a hot engine.

Look for: Level between MIN and MAX on the reservoir. Coolant should be green, orange, or pink — not brown or rusty.

Pass: Level within marked range. No visible contamination or strong odor.

Fail: Level below MIN — top off with the correct coolant type. Brown or rusty coolant indicates corrosion — notify maintenance.`,
  },
  {
    group_name: 'Fluids', label: 'Power Steering Fluid', sort_order: 3,
    has_amount_field: true, requires_air_brakes: false,
    instructions: `With engine off, locate the power steering reservoir and check the dipstick or sight line.

Look for: Fluid level between MIN and MAX. Fluid should be clear to light amber — not dark or burnt-smelling.

Pass: Level within range. No burning smell or dark discoloration.

Fail: Level below MIN — add fluid. Dark or burnt-smelling fluid indicates overheating — notify maintenance.`,
  },
  {
    group_name: 'Fluids', label: 'Wiper Fluid Level', sort_order: 4,
    has_amount_field: true, requires_air_brakes: false,
    instructions: `Locate the windshield washer fluid reservoir and check level visually. Test the sprayers while you're in the cab.

Look for: Sufficient fluid for use. In cold weather, verify the fluid is rated for current temperatures.

Pass: Reservoir has sufficient fluid and sprayers function when tested.

Fail: Empty or near-empty — fill with appropriate washer fluid before placing apparatus in service.`,
  },
  {
    group_name: 'Fluids', label: 'Fuel Level', sort_order: 5,
    has_amount_field: true, requires_air_brakes: false,
    instructions: `Check the fuel gauge with ignition in the ON or RUN position. Do not rely on memory from the last shift.

Look for: Fuel at or above the department minimum — typically 3/4 tank or full. Note the actual level regardless.

Pass: At or above department minimum.

Fail: Below minimum — fuel the apparatus before placing back in service. Do not wait until after a call.`,
  },

  // Mechanical
  {
    group_name: 'Mechanical', label: 'Gauge Operation', sort_order: 10,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `Start the engine and observe all gauges as they come online. Allow 1–2 minutes to stabilize.

Look for: Oil pressure rising to normal range (typically 40–80 PSI), temperature climbing to operating range, voltage in normal range, no warning lights remaining illuminated after startup.

Pass: All gauges read within normal ranges and no persistent warning lights after warm-up.

Fail: Any gauge outside normal range, or any warning light remaining on — do not assume it will clear on its own. Notify maintenance.`,
  },
  {
    group_name: 'Mechanical', label: 'Alternator Charge', sort_order: 11,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `With engine running, check the voltmeter gauge or battery/charge indicator on the dash.

Look for: Voltage reading between 13.5 and 14.5 volts. Below 12.5V suggests the alternator is not charging. Above 15V can damage electronics.

Pass: Voltmeter shows 13.5–14.5V at idle with standard loads on.

Fail: Voltage outside that range — notify maintenance. Low voltage can mean alternator failure; high voltage can damage radios and electronics.`,
  },
  {
    group_name: 'Mechanical', label: 'Inspect Fan Belt', sort_order: 12,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `With engine OFF, visually inspect the fan belt(s) for condition. Never touch belts with the engine running.

Look for: Cracks, fraying, glazing (shiny or slick surface), missing chunks, or excessive wear on belt edges.

Pass: Belt appears intact with no cracking, fraying, or glazing. Minimal deflection when pressed.

Fail: Any cracking, fraying, or glazing visible — notify maintenance before next dispatch. A failed belt will leave you without power steering, charging, and cooling.`,
  },
  {
    group_name: 'Mechanical', label: 'Tire Pressure', sort_order: 13,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `Check all tires with a calibrated gauge. Check when tires are cold (driven less than 1 mile) for accurate readings.

Look for: Pressure matching the placard on the door jamb or apparatus spec sheet. Fire apparatus tires are typically 90–120 PSI depending on axle rating.

Pass: All tires within 5 PSI of required pressure.

Fail: Any tire 5 PSI or more below required — inflate to spec. Any tire showing visible damage, bulging, or sidewall cracking — remove from service immediately.`,
  },
  {
    group_name: 'Mechanical', label: 'Tire Tread Depth', sort_order: 14,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `Visually inspect all tires for tread depth and condition. Use a tread depth gauge if available.

Look for: Adequate tread depth across the full width of the tire. No cuts, bulges, embedded objects, or uneven wear patterns.

Pass: All tires have adequate tread and show no structural damage. Minimum 4/32" on steer tires, 2/32" on drive/trailer.

Fail: Any tire at or below minimum tread depth or showing structural damage — remove from service and notify maintenance.`,
  },
  {
    group_name: 'Mechanical', label: 'Battery Appearance', sort_order: 15,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `With engine off, visually inspect the battery or battery bank, terminals, and cables.

Look for: Corrosion (white or blue-green buildup) on terminals, loose or damaged cables, cracks in the battery case, or any swelling of the case.

Pass: Terminals clean and tight. Case intact with no swelling or cracks. Cables firmly attached.

Fail: Significant corrosion — clean and treat with terminal protector. Cracked case or swollen battery — replace before next dispatch. Loose cables — tighten and report.`,
  },
  {
    group_name: 'Mechanical', label: 'Test Drive', sort_order: 16,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `Take the apparatus on a short test drive — at minimum around the station block. Test steering, acceleration, and braking at low speed.

Look for: Smooth steering without pulling to either side, normal braking response, no unusual noises (grinding, squealing, knocking), and smooth transmission shifts.

Pass: Apparatus drives straight, brakes evenly, and no unusual noises or vibrations under normal operation.

Fail: Any pulling, unusual noise, rough shifting, brake irregularity, or vibration — note specifically what you heard or felt and notify maintenance.`,
  },

  // Lights
  {
    group_name: 'Lights', label: 'Park Lights', sort_order: 20,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `Turn on parking lights and walk completely around the apparatus checking all lights.

Look for: All parking lights illuminated front, rear, and sides. No cracked, broken, or moisture-filled lenses.

Pass: All parking lights operational and lenses intact.

Fail: Any light out or lens damaged — note which location and notify maintenance.`,
  },
  {
    group_name: 'Lights', label: 'Head Lights', sort_order: 21,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `Activate headlights and check both low beam and high beam from the front of the apparatus.

Look for: Both low beams operational and aimed straight ahead. High beams activate on switch. No cracked or yellowed lenses reducing output.

Pass: Low and high beams operational on both sides. No lens damage.

Fail: Any headlight out or lens cracked — notify maintenance. Apparatus should not run night calls with a headlight out.`,
  },
  {
    group_name: 'Lights', label: 'Stop & Turn Signals', sort_order: 22,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `With a second person or using reflections, test brake lights by pressing the pedal. Test all four turn signals and hazard flashers.

Look for: All lights illuminating correctly. Signals flashing at a normal rate — too fast or too slow indicates a bad bulb in that circuit.

Pass: Brake lights and all turn signals (front, rear, side markers) operating correctly at normal flash rate.

Fail: Any signal out or flash rate abnormal — notify maintenance. Non-functional signals are a safety and legal issue.`,
  },

  // Communications
  {
    group_name: 'Communications', label: 'Radio - TX/RX', sort_order: 30,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `Turn on the vehicle radio. Conduct a radio check with dispatch or another unit. Verify both transmit and receive.

Look for: Clear audio on receive with no static or squelch issues. Confirmation from dispatch or another unit that your transmission is clear and readable.

Pass: Radio receives clearly and transmit is confirmed clear by another party.

Fail: No receive, distorted audio, or no confirmation of transmit — switch to a portable and notify communications/maintenance before going in service.`,
  },
  {
    group_name: 'Communications', label: 'Cell Phone', sort_order: 31,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `Locate the department cell phone in its assigned location. Check the charge level and verify it powers on and shows signal.

Look for: Phone present, battery at or above 50%, signal bars showing, no cracked screen affecting function.

Pass: Phone present, adequately charged, and shows active signal.

Fail: Phone missing — report immediately to officer. Dead battery — place on charger and note. No signal — test in a known coverage area.`,
  },

  // Emergency Equipment
  {
    group_name: 'Emergency Equipment', label: 'Emergency Lights', sort_order: 40,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `Activate the full emergency light system and walk around the apparatus to verify all warning lights are functioning.

Look for: All warning lights operating — LED bars, corner lights, grille lights, and any intersection or alley lights. No dark, flickering, or incorrect-color units.

Pass: All emergency lights operating correctly. No dark or malfunctioning units.

Fail: Any unit out or not functioning correctly — note the location and notify maintenance. Emergency lighting is a safety system — do not ignore or suppress faults.`,
  },
  {
    group_name: 'Emergency Equipment', label: 'Emergency Siren', sort_order: 41,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `Activate the siren briefly and cycle through available tones (wail, yelp, manual horn). Keep the test short to minimize noise impact on the station.

Look for: All programmed tones activating. Speaker output sounds full and undistorted. Manual air horn (if equipped) functioning.

Pass: All siren tones activate and sound clear with full volume output.

Fail: No sound, distorted or weak output, or tone control malfunction — notify maintenance before going in service.`,
  },
  {
    group_name: 'Emergency Equipment', label: 'Operate Scene Lights/Outlets', sort_order: 42,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `Activate scene lights (side, rear, and any mast-mounted lights). Test any 120V outlets if the apparatus is so equipped.

Look for: All scene lights illuminate at full brightness. Mast deploys and retracts smoothly if equipped. Outlets provide power when tested.

Pass: All scene lights functional and outlets provide correct voltage.

Fail: Any scene light out or outlet non-functional — note which one and notify maintenance.`,
  },
  {
    group_name: 'Emergency Equipment', label: 'Compartment Lights', sort_order: 43,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `Open each compartment door and verify the compartment light activates automatically. Close the door and verify it extinguishes.

Look for: Light activates immediately when door opens. Light extinguishes when door is fully closed. No stuck-on lights that could drain the battery.

Pass: All compartment lights activate on door open and extinguish on close.

Fail: Any compartment light out — note which compartment. Any light that stays on when door is closed — notify maintenance immediately to prevent battery drain.`,
  },

  // Cleaning
  {
    group_name: 'Cleaning', label: 'Clean Interior', sort_order: 50,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `Remove any personal items, food, wrappers, or debris from the cab. Wipe down high-touch surfaces with a disinfectant wipe.

Look for: Clean floor mats, no debris in SCBA harness areas or around pedals, all cab storage organized, and seat belts free of obstruction.

Pass: Cab interior clean and all occupant areas ready for response.

Fail: Note any damage to interior surfaces, broken cab hardware, or damaged seat belts — report to officer.`,
  },
  {
    group_name: 'Cleaning', label: 'Clean Exterior', sort_order: 51,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `Wash the exterior of the apparatus. While washing, inspect the body for any new damage since the last check.

Look for: Clean reflective striping and light lenses (dirty lenses reduce output significantly). No new dents, scratches, or broken components. No fluid leaks visible under the apparatus.

Pass: Exterior clean. No new damage to report.

Fail: Any new damage observed — document with a photo if possible and report to officer immediately, even if minor. Unreported damage becomes your responsibility.`,
  },
  {
    group_name: 'Cleaning', label: 'Clean Compartments', sort_order: 52,
    has_amount_field: false, requires_air_brakes: false,
    instructions: `Open each compartment. Remove any loose debris. Verify all equipment is in its assigned location and properly secured.

Look for: Equipment in assigned positions and secured against movement. No water pooling, dirt buildup, or corrosion on compartment floors or equipment.

Pass: All compartments clean, organized, and all equipment properly secured in assigned locations.

Fail: Missing equipment — report to officer before going in service. Equipment found unsecured — re-secure. Damage or corrosion on compartment interior — report to maintenance.`,
  },

  // Air Brakes (only shown when apparatus.has_air_brakes = true)
  {
    group_name: 'Air Brakes', label: 'Air Pressure Buildup', sort_order: 60,
    has_amount_field: false, requires_air_brakes: true,
    instructions: `Drain tanks fully before this test. Start engine and watch both primary and secondary pressure gauges climb.

Listen for: Steady compressor cycling and consistent pressure rise on both gauges.

Pass: Pressure builds from 50 to 90 PSI in under 3 minutes and reaches governor cutoff (120–130 PSI).

Fail: Takes more than 3 minutes to build from 50–90 PSI, or system never reaches governor cutoff.`,
  },
  {
    group_name: 'Air Brakes', label: 'Low Air Warning Test', sort_order: 61,
    has_amount_field: false, requires_air_brakes: true,
    instructions: `Build to governor cutoff, then turn engine OFF. Fan the service brakes (apply and release repeatedly) to draw down pressure. Watch the pressure gauge.

Listen for: Low-air warning buzzer and/or warning light activating.

Pass: Warning activates at 60 PSI or higher.

Fail: No warning before pressure drops below 60 PSI.`,
  },
  {
    group_name: 'Air Brakes', label: 'Air Leakage Rate (Engine Off)', sort_order: 62,
    has_amount_field: false, requires_air_brakes: true,
    instructions: `With tanks at governor cutoff, turn engine OFF. Hold the service brake pedal fully depressed for 1 minute while watching the pressure gauge.

Listen for: Any hissing from lines, fittings, or brake chambers indicating a leak.

Pass: Pressure drop is 3 PSI or less in 1 minute with brake applied; 2 PSI or less with brake released.

Fail: Drop exceeds 3 PSI in 1 minute — identify and note the leak location before continuing.`,
  },
  {
    group_name: 'Air Brakes', label: 'Spring Brake Test', sort_order: 63,
    has_amount_field: false, requires_air_brakes: true,
    instructions: `After the low-air warning activates, continue fanning the brakes to draw pressure down further. Do NOT move the vehicle — remain parked with wheels chocked.

Listen for: A sharp snap or thud as the spring brakes apply automatically.

Pass: Spring brakes apply automatically before pressure drops to 20 PSI (typically 20–45 PSI range).

Fail: Spring brakes do not apply automatically, or apply after pressure drops below 20 PSI.`,
  },
  {
    group_name: 'Air Brakes', label: 'Service Brake Test', sort_order: 64,
    has_amount_field: false, requires_air_brakes: true,
    instructions: `Rebuild pressure to governor cutoff. Release the parking brake. Move vehicle slowly (5 mph or less) and apply the service brakes firmly to a full stop.

Listen for: Clean, even air release and firm brake engagement at all wheels.

Pass: Vehicle stops promptly in a straight line without pulling to either side.

Fail: Vehicle pulls to one side, brakes feel spongy or delayed, or stopping distance is excessive.`,
  },
  {
    group_name: 'Air Brakes', label: 'Drain Air Tanks', sort_order: 65,
    has_amount_field: false, requires_air_brakes: true,
    instructions: `Locate the drain valve (petcock) at the bottom of each air tank — typically 2 or 3 tanks on a fire apparatus. Open each fully and allow to drain completely before closing.

Listen for: Air and moisture discharging freely; draining is complete when only dry air exits.

Pass: Tanks drain freely with minimal moisture or light condensation (normal condensation is acceptable).

Fail: Heavy oil in discharge indicates compressor contamination — note and notify maintenance before placing apparatus back in service.`,
  },
]
