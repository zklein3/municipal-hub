'use client'

import { useRouter } from 'next/navigation'

export default function BackButton({ className }: { className?: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      className={className ?? 'text-sm text-zinc-500 hover:text-zinc-700'}
    >
      ← Back
    </button>
  )
}
