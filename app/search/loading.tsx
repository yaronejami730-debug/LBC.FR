export default function SearchLoading() {
  return (
    <div className="bg-background text-on-surface animate-pulse">
      <div className="h-[128px] bg-background" />

      <main className="pt-8 pb-32 px-6 max-w-7xl mx-auto">
        {/* Filter bar skeleton */}
        <div className="mb-10 flex flex-col gap-4">
          <div className="flex justify-between items-end">
            <div className="space-y-2">
              <div className="h-3 w-28 bg-slate-200 rounded" />
              <div className="h-8 w-56 bg-slate-200 rounded-xl" />
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-64 bg-slate-200 rounded-xl" />
              <div className="h-10 w-24 bg-slate-200 rounded-xl" />
            </div>
          </div>
          {/* Category chips */}
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 w-24 bg-slate-200 rounded-full" />
            ))}
          </div>
        </div>

        {/* Listing grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex flex-col bg-white rounded-xl overflow-hidden border border-slate-100">
              <div className="aspect-square bg-slate-200" />
              <div className="p-2.5 space-y-1.5">
                <div className="h-4 bg-slate-200 rounded w-full" />
                <div className="h-4 bg-slate-200 rounded w-2/3" />
                <div className="h-5 bg-slate-200 rounded w-1/2 mt-1" />
                <div className="h-3 bg-slate-200 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
