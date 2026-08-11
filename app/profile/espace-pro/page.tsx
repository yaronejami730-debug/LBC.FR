import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import ProfileEditor from "./ProfileEditor";
import ProNav from "./ProNav";
import { resolveProContext } from "@/lib/pro/access";

export const metadata = { title: "Mon espace professionnel" };
export const dynamic = "force-dynamic";

/**
 * Édition de la fiche d'établissement et de sa carte.
 *
 * Réservée aux comptes dont l'habilitation est APPROVED : une fiche publique
 * est précisément ce qu'un faux SIRET cherchait à obtenir.
 */
export default async function EspaceProPage({
  searchParams,
}: {
  // `?etab=` prime sur le cookie : un lien envoyé à un associé doit ouvrir la
  // bonne boutique, pas la dernière que lui a consultée.
  searchParams: Promise<{ etab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/profile/espace-pro");

  const { etab } = await searchParams;
  const context = await resolveProContext(undefined, etab ?? null).catch(() => null);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { companyName: true, professionalStatus: true, avatar: true },
  });

  if (user?.professionalStatus !== "APPROVED") {
    return (
      <div className="bg-surface min-h-screen">
        <Navbar />
        <main className="pt-32 pb-16 px-6 max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h1 className="text-xl font-extrabold font-['Manrope']">Espace professionnel</h1>
            <p className="text-sm text-outline mt-2 leading-relaxed">
              {user?.professionalStatus === "PENDING" || user?.professionalStatus === "INFO_REQUESTED"
                ? "Votre demande est en cours de vérification. Votre espace s'ouvrira dès sa validation."
                : user?.professionalStatus === "SUSPENDED"
                  ? "Votre habilitation professionnelle est suspendue. Contactez l'équipe pour la rétablir."
                  : "L'espace professionnel est réservé aux comptes professionnels vérifiés."}
            </p>
            <Link
              href="/profile"
              title="Retour au profil"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white"
            >
              Retour au profil
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // La fiche courante vient du contexte : établissement actif résolu depuis
  // `?etab=`, le cookie, ou à défaut le premier accessible.
  const profile = context?.establishment ?? null;
  const services = profile
    ? await prisma.proService.findMany({ where: { profileId: profile.id }, orderBy: { position: "asc" } })
    : [];
  const memberCount = profile
    ? await prisma.proMember.count({ where: { profileId: profile.id, isActive: true } })
    : 0;

  return (
    <div className="bg-surface min-h-screen">
      <Navbar />
      <main className="pt-28 md:pt-36 pb-16 px-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope'] mb-4">
          Mon espace professionnel
        </h1>
        <ProNav
          current="/profile/espace-pro"
          slug={profile?.slug}
          modules={context?.modules ?? []}
          establishments={context?.establishments ?? []}
          activeEstablishmentId={profile?.id}
          canBook={context?.capabilities.includes("bookings") ?? false}
        />

        {profile && memberCount === 0 && context?.capabilities.includes("bookings") && (
          // Sans équipe, le moteur n'a personne à qui attribuer un rendez-vous :
          // la fiche reste une vitrine et le bouton « Réserver » n'apparaît pas.
          <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Votre carte est en ligne, mais la réservation est fermée : ajoutez au moins une personne
            dans <Link href="/profile/espace-pro/equipe" title="Équipe et horaires" className="font-bold underline">Équipe et horaires</Link>.
          </div>
        )}

        <ProfileEditor
          initial={{
            name: profile?.name ?? user.companyName ?? "",
            slug: profile?.slug ?? null,
            description: profile?.description ?? "",
            addressLine: profile?.addressLine ?? "",
            city: profile?.city ?? "",
            postalCode: profile?.postalCode ?? "",
            phone: profile?.phone ?? "",
            website: profile?.website ?? "",
            isPublished: profile?.isPublished ?? true,
            coverImage: profile?.coverImage ?? null,
            avatar: user.avatar ?? null,
            coverX: profile?.coverX ?? 50,
            coverY: profile?.coverY ?? 50,
            coverZoom: profile?.coverZoom ?? 1,
            services:
              services.map((s) => ({
                section: s.section,
                label: s.label,
                durationMin: s.durationMin ? String(s.durationMin) : "",
                price: String(s.price),
              })),
          }}
        />
      </main>
    </div>
  );
}
