import { Fragment } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDistanceToNow } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";

export default async function Home() {
  const [listings, ads] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "APPROVED", deletedAt: null } as any,
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, verified: true } } },
    }),
    prisma.advertisement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 2,
    }),
  ]);

  return (
    <div className="bg-surface text-on-surface mb-24 md:mb-0">
      <Navbar active="accueil" />

      {/* Hero / Search Section */}
      <header className="pt-28 pb-12 px-6 max-w-7xl mx-auto">
        <div className="relative bg-primary-container bg-gradient-to-br from-primary to-primary-container rounded-[2rem] p-8 md:p-16 overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-white text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
              Trouvez tout ce que <br /> vous cherchez.
            </h2>
            {/* Search Bar */}
            <form action="/search" method="get">
              <div className="flex items-center bg-surface-container-lowest rounded-full p-2 shadow-[0_16px_32px_rgba(21,21,125,0.1)]">
                <span className="material-symbols-outlined text-primary ml-4">search</span>
                <input name="q" className="w-full border-none focus:ring-0 bg-transparent px-4 py-2 text-on-surface outline-none" placeholder="Rechercher voitures, logements, emplois..." type="text" />
                <button type="submit" className="bg-primary text-white px-8 py-3 rounded-full font-bold active:scale-95 transition-transform">
                  Rechercher
                </button>
              </div>
            </form>
          </div>
          {/* Decorative Grain/Abstract */}
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-tertiary-fixed to-transparent"></div>
        </div>
      </header>

      {/* Categories: Bento Style */}
      <section className="px-6 py-8 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-primary font-bold uppercase tracking-[0.1em] text-[11px]">Explorer par</span>
            <h3 className="text-2xl font-bold text-on-surface">Catégories populaires</h3>
          </div>
          <Link href="/search" className="text-primary font-semibold flex items-center gap-1 group">
            Toutes les catégories <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { id: "vehicules", label: "Véhicules", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBGMEyVAsY5RW4Yei9LtUSa92B7hQ2kPt8EdekXCUM9h3j7ZcDyUJHYxwJ0mb-4-QamClSjIg8RnjpAANyCePb3fhrOjVA2L0t5k7Rl3D1zh6oYexSNqqbyLW3pygORjeicNryZ6it1mEzuPhOT9zAeXaCTu5mBWuZdsI4wF9V7YBu95kW25E51BN9CKmlsBigwQeS7x3AW_HBzZZDo3E9aFdI4Xl__Vd5xAMJ4H80ljzvlZ4am1kTbfj1f9v50sst7_ApbhRtCnY2_" },
            { id: "immobilier", label: "Immobilier", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuAt-0kv_wITShSbU9nfI_E9TtW5TdTuw5hn_DluMsuR3tQbQXBkRXA_3FBmkrVgkDc8gTKQ1a89eMsiiBKwJxpvOKkhcmV_H7p9ZpIMBiBgqmp93hWzAhg7HuozYI-hBs3Ycm7STGtp47eGoFUKE07MF0yIyk5imrhRUSZCamG0oTX8XMTGnyOmk-FzCXAyd7HtUr0xNdYhIzFbIW1IXlxk3hmdApYxJterZ5B0mTXD2XP_tLbDOOCjpOdUcAh0wwGojhYLc87qf7gA" },
            { id: "mode", label: "Mode", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuAh42sdJERo4cvL_P118M-1bQmxaifGrDge0kVugUyS1msBPe9uUPNjGiudAk-iSrL6diy7aBN4uFtaj6ea6MQFDkIo-hWfZwPERRBiCuufUuwTxxepEdU0QBfPd6-bNEoZRYOQQ2ODh0y_oonMoVOSHBjU0lK919C1te5WXVUGifu1THI8gsk3RzG3uWmsPndQWKiGiiqcQiCvef7rsybA6lB5Eapf7xHk136aU_wkfWgUQmF1zmjeUC6CSIyCqdFTy7g0efbSr6tX" },
            { id: "maison", label: "Maison", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDehjPQkD8W1LqpDimsNIHT7WdfP5bacI12ZLl_bUlBKVRylknSR6MIo5dG_EqzV7od-W1K_MFzzzS3UbNrS6-9F4imbBf8nRLoI2fz7MG7p9Z78krgNFQPX_QVTHFOlPxpYN68i7ymEOIb-__QT9EQLIjWeDEfH4GQWrk06l14FW2VkRGJsknjV1WU0tlIKwPiyZdVXlUalsjoeJ534KwCfcBq5W_mmR6IQY4BCofwKeBxYGvsI3FZY8FgEyydmevYRNC-9aQhAuJ3" },
            { id: "services", label: "Services", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuAYdVk-G5r5SmBtZ1pOtrpJm3G6Hsse-MXy8DtbqFnGoYHOp-7w6mUzsyHxu8i49twEP5pjql6vTgWL4q6ZOsDtYogK8itEB2nIPvTaeDfD7V3vlTcYH9ClSubLCcQ4qnTNHt2aXlAzy_-I-UKEB_2tPB3EazYvwK3LqeH4V-CkYszESDT9lzZJs68F0ue6ZZZ7FrvmZt1vXxzsjnSjmUYH6IFR-0hRJExugJz4chy6oP6zlh1lsO0ks_T0wpW996uJWqkyn9-n5KyR" },
          ].map(({ id, label, src }) => (
            <Link key={id} href={`/search?category=${encodeURIComponent(label)}`} className="group relative aspect-square md:aspect-auto md:h-64 rounded-xl overflow-hidden bg-surface-container-low flex flex-col justify-end p-4">
              <img className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={label} src={src} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="relative z-10">
                <p className="text-white font-bold text-lg">{label}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Listings Section */}
      <section className="py-10 max-w-7xl mx-auto bg-surface-container-low rounded-t-[3rem]">
        <div className="flex items-center justify-between mb-5 px-6">
          <h3 className="text-xl font-extrabold text-on-surface tracking-tight">Annonces récentes</h3>
          <Link href="/search" className="text-primary text-sm font-semibold flex items-center gap-1 group">
            Voir tout <span className="material-symbols-outlined text-base group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
          </Link>
        </div>
        {/* Horizontal scroll on mobile, grid on desktop */}
        <div className="flex gap-3 overflow-x-auto pb-3 px-6 no-scrollbar md:grid md:grid-cols-4 lg:grid-cols-5 md:gap-4 md:overflow-visible md:pb-0">
          {listings.map((listing, i) => {
            const images = JSON.parse(listing.images) as string[];
            const img = images[0] || "";
            const ad = i === 1 ? ads[0] : i === 5 ? ads[1] : null;
            return (
              <Fragment key={listing.id}>
                {ad && (
                  <a
                    key={`ad-${ad.id}`}
                    href={ad.destinationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 w-44 md:w-auto group flex flex-col bg-white rounded-xl overflow-hidden border border-[#c7c5d4] hover:shadow-md transition-all duration-200"
                  >
                    <div className="relative aspect-square overflow-hidden bg-surface-container-low">
                      <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt={ad.title} src={ad.imageUrl} />
                      <span className="absolute top-2 left-2 bg-[#15157d] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Publicité
                      </span>
                    </div>
                    <div className="p-2.5 flex flex-col gap-0.5">
                      <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-2">{ad.title}</p>
                      <p className="text-outline text-xs line-clamp-2">{ad.description}</p>
                    </div>
                  </a>
                )}
                <Link
                  href={`/listing/${listing.id}`}
                  className="flex-shrink-0 w-44 md:w-auto group flex flex-col bg-white rounded-xl overflow-hidden border border-surface-container hover:shadow-md transition-all duration-200"
                >
                  <div className="relative aspect-square overflow-hidden bg-surface-container-low">
                    <img
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      alt={listing.title}
                      src={img}
                    />
                    {listing.isPremium && (
                      <span className="absolute top-2 left-2 bg-secondary-container text-on-secondary-container text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Premium
                      </span>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col gap-0.5">
                    <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-2">{listing.title}</p>
                    <p className="text-primary font-bold text-base mt-1">{listing.price.toLocaleString("fr-FR")} €</p>
                    <p className="text-outline text-xs truncate">{listing.location}</p>
                    <p className="text-outline/70 text-[10px]">{formatDistanceToNow(listing.createdAt)}</p>
                  </div>
                </Link>
              </Fragment>
            );
          })}
        </div>
        <div className="mt-8 flex justify-center px-6">
          <Link href="/search" className="px-8 py-3 bg-primary text-white rounded-full font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-transform">
            Voir plus d'annonces
          </Link>
        </div>
      </section>

      <BottomNav active="accueil" />

      {/* FAB for Desktop Post */}
      <Link href="/post" className="hidden md:flex fixed bottom-8 right-8 bg-tertiary-fixed text-on-tertiary-fixed px-6 py-4 rounded-full font-bold shadow-xl items-center gap-2 active:scale-95 transition-transform z-50">
        <span className="material-symbols-outlined">add</span>
        Déposer une annonce
      </Link>
    </div>
  );
}
