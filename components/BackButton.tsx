'use client'

import { useRouter } from 'next/navigation'

export default function BackButton({ className }: { className?: string }) {
  const router = useRouter()
  const isCard = className?.includes('rounded-lg')
  return (
    <button
      onClick={() => router.back()}
      className={className ?? 'text-sm text-zinc-500 hover:text-zinc-700'}
    >
      {isCard && <span className="block text-base mb-0.5">←</span>}
      Back
    </button>
  )
}
