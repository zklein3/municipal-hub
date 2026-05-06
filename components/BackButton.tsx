'use client'

import { useRouter } from 'next/navigation'

export default function BackButton({ className, href }: { className?: string; href?: string }) {
  const router = useRouter()
  const isCard = className?.includes('rounded-lg')
  return (
    <button
      onClick={() => href ? router.push(href) : router.back()}
      className={className ?? 'text-sm text-zinc-500 hover:text-zinc-700'}
    >
      {isCard && <span className="block text-base mb-0.5">←</span>}
      Back
    </button>
  )
}
