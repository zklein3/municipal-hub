import { redirect } from 'next/navigation'

// Some scanners/apps open the code as a path (/scan/BAG-1234) instead of a query string.
export default async function ScanCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  redirect(`/scan?code=${encodeURIComponent(decodeURIComponent(code))}`)
}
