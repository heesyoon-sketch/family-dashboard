function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/10 ${className}`} />;
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <SkeletonBox className="h-4 w-28" />
            <SkeletonBox className="h-10 w-72 max-w-full" />
            <SkeletonBox className="h-5 w-96 max-w-full" />
          </div>
          <SkeletonBox className="h-11 w-36" />
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <SkeletonBox className="mb-5 h-8 w-8" />
              <SkeletonBox className="mb-3 h-3 w-24" />
              <SkeletonBox className="h-9 w-28" />
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
          <SkeletonBox className="mb-6 h-7 w-48" />
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, index) => (
              <SkeletonBox key={index} className="h-12 w-full" />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
