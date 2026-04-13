export default function UsersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-40 bg-[#eceef0] rounded-xl" />
        <div className="h-4 w-52 bg-[#eceef0] rounded-lg mt-2" />
      </div>
      <div className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#eceef0] flex items-center justify-between">
          <div className="h-5 w-32 bg-[#f2f4f6] rounded" />
          <div className="h-4 w-24 bg-[#f2f4f6] rounded" />
        </div>
        <div className="divide-y divide-[#f2f4f6]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="w-10 h-10 rounded-full bg-[#f2f4f6] flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-36 bg-[#f2f4f6] rounded" />
                <div className="h-3 w-48 bg-[#f2f4f6] rounded" />
              </div>
              <div className="h-6 w-20 rounded-full bg-[#f2f4f6]" />
              <div className="h-8 w-8 rounded-full bg-[#f2f4f6]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
