import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { getUserResponseTime } from "@/lib/user-stats";

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = (await prisma.user.findUnique({
    where: { id },
    include: {
      listings: {
        where: { deletedAt: null, status: "APPROVED" } as any,
        orderBy: { createdAt: "desc" },
      },
    },
  })) as any;

  if (!user) notFound();

  const responseTime = await getUserResponseTime(user.id);

  const initials = (user.name as string)
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="bg-surface text-on-surface min-h-screen mb-24 md:mb-0">
      <Navbar active="" />

      <main className="pt-24 pb-10 px-6 max-w-3xl mx-auto">
        <div className="bg-white rounded-3xl p-8 shadow-[0_16px_48px_rgba(21,21,125,0.08)] mb-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-surface-container flex items-center justify-center mb-4 border-4 border-white shadow-lg">
              {user.avatar ? (
                <img className="w-full h-full object-cover" alt={user.name} src={user.avatar} />
              ) : (
                <span className="text-2xl font-bold text-outline">{initials}</span>
              )}
            </div>
            <h2 className="text-2xl font-extrabold text-[#15157d] font-['Manrope']">{user.name}</h2>
            {user.verified && (
              <div className="flex items-center gap-1.5 text-[#00a67e] font-bold text-xs mt-2 bg-[#e6fcf5] px-3 py-1 rounded-full uppercase tracking-wider">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                Vendeur vérifié
              </div>
            )}
            
            <div className={`grid ${responseTime ? "grid-cols-2" : "grid-cols-1"} gap-4 w-full mt-8`}>
              {responseTime && (
                <div className="bg-slate-50 p-4 rounded-2xl text-center">
                  <span className="block text-outline text-[10px] uppercase font-bold tracking-widest mb-1">Temps de réponse</span>
                  <span className="text-[#15157d] font-bold text-lg">{responseTime}</span>
                </div>
              )}
              <div className="bg-slate-50 p-4 rounded-2xl text-center">
                <span className="block text-outline text-[10px] uppercase font-bold tracking-widest mb-1">Membre depuis</span>
                <span className="text-[#15157d] font-bold text-lg">{user.memberSince}</span>
              </div>
            </div>
          </div>
        </div>

        <h3 className="text-xl font-extrabold text-[#15157d] font-['Manrope'] mb-6 flex items-center gap-2">
          Annonces en ligne
          <span className="text-sm font-medium text-outline">({user.listings.length})</span>
        </h3>

        {user.listings.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-12 text-center border-2 border-dashed border-slate-200">
            <span className="material-symbols-outlined text-4xl text-outline/30 block mb-3">inventory_2</span>
            <p className="text-on-surface-variant font-medium">Aucune annonce en ligne pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {user.listings.map((listing: any) => {
              const images = JSON.parse(listing.images) as string[];
              const img = images[0] || "";
              return (
                <Link
                  key={listing.id}
                  href={`/listing/${listing.id}`}
                  className="group flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100"
                >
                  <div className="relative aspect-square overflow-hidden">
                    {img ? (
                      <img
                        src={img}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100">
                        <span className="material-symbols-outlined text-3xl text-outline/30">image</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-[#15157d] font-bold text-sm leading-tight line-clamp-2 h-10">{listing.title}</p>
                    <p className="text-primary font-black text-lg mt-2">{listing.price.toLocaleString("fr-FR")} €</p>
                    <div className="flex items-center gap-1.5 mt-2 text-outline text-[11px] font-medium">
                      <span className="material-symbols-outlined text-xs">location_on</span>
                      {listing.location}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav active="" />
    </div>
  );
}
