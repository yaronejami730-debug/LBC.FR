export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-8 w-36 bg-[#eceef0] rounded-xl" />
        <div className="h-4 w-56 bg-[#eceef0] rounded-lg mt-2" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-[#eceef0]">
            <div className="w-10 h-10 rounded-xl bg-[#f2f4f6]" />
            <div className="h-8 w-12 bg-[#f2f4f6] rounded-lg mt-4" />
            <div className="h-3 w-28 bg-[#f2f4f6] rounded mt-2" />
          </div>
        ))}
      </div>

      {/* Two col */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#eceef0]">
            <div className="h-5 w-48 bg-[#f2f4f6] rounded" />
          </div>
          <div className="divide-y divide-[#f2f4f6]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-3">
                <div className="w-10 h-10 rounded-lg bg-[#f2f4f6] flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-40 bg-[#f2f4f6] rounded" />
                  <div className="h-3 w-24 bg-[#f2f4f6] rounded" />
                </div>
                <div className="h-6 w-16 rounded-full bg-[#f2f4f6]" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#eceef0] p-6 space-y-4">
          <div className="h-5 w-24 bg-[#f2f4f6] rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <div className="h-3 w-20 bg-[#f2f4f6] rounded" />
                <div className="h-3 w-6 bg-[#f2f4f6] rounded" />
              </div>
              <div className="h-1.5 bg-[#f2f4f6] rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
