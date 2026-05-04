export default function DeptNotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">🚒</div>
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Department Not Found</h1>
        <p className="text-sm text-zinc-500">
          This department&apos;s public site isn&apos;t available. The link may be incorrect or the site hasn&apos;t been activated yet.
        </p>
      </div>
    </div>
  )
}
