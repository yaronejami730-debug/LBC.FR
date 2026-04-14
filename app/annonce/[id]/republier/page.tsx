import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import RepublishButton from "./RepublishButton";

export default async function RepublierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/annonce/${id}/republier`);

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      price: true,
      images: true,
      userId: true,
      createdAt: true,
      expiryNotifiedAt: true,
    },
  });

  if (!listing || listing.userId !== session.user.id) notFound();

  const imgs = (() => { try { return JSON.parse(listing.images) as string[]; } catch { return []; } })();
  const expiresAt = new Date(listing.createdAt.getTime() + 90 * 24 * 60 * 60 * 1000);
  const msLeft = expiresAt.getTime() - Date.now();
  const expired = msLeft <= 0;

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Deal & Co" className="h-14 w-auto mx-auto mb-4" />
        </div>

        <div className="bg-white rounded-3xl shadow-[0_16px_32px_rgba(21,21,125,0.07)] overflow-hidden">
          {/* Photo */}
          {imgs[0] && (
            <div className="h-48 overflow-hidden">
              <img src={imgs[0]} alt={listing.title} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="p-6">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4 ${
              expired ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
            }`}>
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              {expired ? "Annonce expirée" : "Annonce expirante bientôt"}
            </div>

            <h1 className="text-xl font-extrabold text-on-surface font-['Manrope'] mb-1 leading-tight">
              {listing.title}
            </h1>
            <p className="text-2xl font-black text-primary mb-5">
              {listing.price.toLocaleString("fr-FR")} €
            </p>

            <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
              {expired
                ? "Cette annonce a atteint sa durée de vie de 90 jours. En la republiant, elle sera remise en ligne pour 90 jours supplémentaires."
                : "Votre annonce arrive à expiration. Republiez-la maintenant pour la maintenir en ligne 90 jours de plus."}
            </p>

            <RepublishButton listingId={listing.id} />

            <p className="text-xs text-outline text-center mt-4">
              Si vous ne republiez pas, l'annonce sera définitivement supprimée de nos serveurs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
