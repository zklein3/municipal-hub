import Link from 'next/link'

interface HubCardProps {
  title: string
  description: string
  href: string
  stat?: number | string | null
  statLabel?: string
  alert?: boolean
}

export default function HubCard({ title, description, href, stat, statLabel, alert }: HubCardProps) {
  return (
    <Link
      href={href}
      className={`rounded-xl bg-white border shadow-sm p-5 hover:shadow-md transition-all group flex flex-col justify-between min-h-[100px] ${
        alert ? 'border-orange-200 hover:border-orange-400' : 'border-zinc-200 hover:border-red-300'
      }`}
    >
      <div>
        <p className={`font-semibold text-base leading-snug transition-colors ${
          alert ? 'text-orange-700 group-hover:text-orange-800' : 'text-zinc-900 group-hover:text-red-700'
        }`}>
          {title}
        </p>
        <p className="text-xs text-zinc-400 mt-1 leading-snug">{description}</p>
      </div>
      {stat != null && (
        <div className={`mt-4 rounded-lg px-3 py-2 flex items-center justify-between ${
          alert ? 'bg-orange-50' : 'bg-zinc-50'
        }`}>
          <p className="text-xs text-zinc-500">{statLabel ?? 'Total'}</p>
          <p className={`text-lg font-bold ${alert ? 'text-orange-700' : 'text-zinc-900'}`}>{stat}</p>
        </div>
      )}
    </Link>
  )
}
