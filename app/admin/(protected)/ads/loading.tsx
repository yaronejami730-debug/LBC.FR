export default function AdsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-40 bg-[#eceef0] rounded-xl" />
        <div className="h-4 w-52 bg-[#eceef0] rounded-lg mt-2" />
      </div>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 bg-[#f2f4f6] rounded" />
        <div className="h-9 w-40 rounded-xl bg-[#f2f4f6]" />
      </div>
      {/* Ad cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
            <div className="aspect-video bg-[#f2f4f6]" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-40 bg-[#f2f4f6] rounded" />
              <div className="h-3 w-full bg-[#f2f4f6] rounded" />
              <div className="h-3 w-3/4 bg-[#f2f4f6] rounded" />
            </div>
            <div className="px-4 pb-4 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 h-9 rounded-xl bg-[#f2f4f6]" />
                <div className="flex-1 h-9 rounded-xl bg-[#f2f4f6]" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 h-9 rounded-xl bg-[#f2f4f6]" />
                <div className="flex-1 h-9 rounded-xl bg-[#f2f4f6]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
