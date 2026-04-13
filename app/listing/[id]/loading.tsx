export default function ListingLoading() {
  return (
    <div className="bg-surface text-on-surface mb-24 md:mb-12 animate-pulse">
      {/* Navbar placeholder */}
      <div className="h-[120px] bg-surface" />

      <main className="pt-4 max-w-7xl mx-auto pb-12 px-4 md:px-6">
        {/* Photo gallery skeleton */}
        <div className="grid grid-cols-3 gap-2 h-[260px] md:h-[440px] rounded-2xl overflow-hidden">
          <div className="bg-slate-200 rounded-xl col-span-1" />
          <div className="bg-slate-200 rounded-xl col-span-1" />
          <div className="bg-slate-200 rounded-xl col-span-1" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {/* Left column */}
          <div className="md:col-span-2 space-y-4">
            {/* Title */}
            <div className="h-8 bg-slate-200 rounded-xl w-3/4" />
            <div className="h-6 bg-slate-200 rounded-xl w-1/4" />

            {/* Description */}
            <div className="bg-white rounded-2xl p-5 space-y-3">
              <div className="h-4 bg-slate-200 rounded w-full" />
              <div className="h-4 bg-slate-200 rounded w-5/6" />
              <div className="h-4 bg-slate-200 rounded w-4/6" />
              <div className="h-4 bg-slate-200 rounded w-5/6" />
            </div>

            {/* Details */}
            <div className="bg-white rounded-2xl p-5 grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-200 rounded-xl" />
              ))}
            </div>
          </div>

          {/* Right column — seller card */}
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
              <div className="h-11 bg-slate-200 rounded-xl" />
              <div className="h-11 bg-slate-200 rounded-xl" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
