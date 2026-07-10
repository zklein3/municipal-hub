export async function lookupZip(zip: string): Promise<{ city: string; state: string } | null> {
  if (!/^\d{5}$/.test(zip)) return null
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!res.ok) return null
    const data = await res.json()
    const place = data?.places?.[0]
    if (!place) return null
    return { city: place['place name'], state: place['state abbreviation'] }
  } catch {
    return null
  }
}
