import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import { buildPrivateMetadata } from "@/lib/seo/metadata";
import { CATEGORIES } from "@/lib/categories";
import { DRAFT_KEEP_DAYS } from "@/lib/drafts";
import DeleteDraftButton from "./DeleteDraftButton";

/**
 * Brouillon de dépôt du compte connecté.
 *
 * Le formulaire s'enregistre tout seul, mais tant que cet enregistrement
 * n'avait pas de page à lui, le vendeur n'avait aucun moyen de vérifier que sa
 * saisie existait encore — les emails de relance annonçaient un brouillon
 * qu'aucun écran ne montrait.
 *
 * Un seul brouillon par compte (`Draft.userId` est unique) : commencer une
 * nouvelle annonce écrase la précédente, ce que la page dit explicitement.
 */
export const metadata = buildPrivateMetadata(
  "Mes brouillons",
  "Reprenez l'annonce que vous n'avez pas terminé de publier.",
);
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default async function BrouillonsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/brouillons");

  const draft = await prisma.draft.findUnique({
    where: { userId: session.user.id as string },
    select: { payload: true, category: true, completeness: true, updatedAt: true },
  });

  /**
   * Ce qu'on relit d'un brouillon.
   *
   * La fiche n'affichait qu'un titre et un pourcentage. Or ce qu'on cherche en
   * revenant sur une annonce laissée en plan, c'est **de quoi il s'agissait** —
   * et la photo le dit plus vite que n'importe quel titre. Le reste sert à
   * savoir ce qui manque encore.
   */
  let title: string | null = null;
  let images: string[] = [];
  let price: number | null = null;
  let location: string | null = null;
  let description: string | null = null;

  if (draft) {
    try {
      const parsed = JSON.parse(draft.payload) as Record<string, unknown>;
      if (typeof parsed.title === "string" && parsed.title.trim()) title = parsed.title.trim();
      if (typeof parsed.description === "string" && parsed.description.trim()) {
        description = parsed.description.trim();
      }
      if (typeof parsed.location === "string" && parsed.location.trim()) {
        location = parsed.location.trim();
      }
      if (typeof parsed.price === "string" && parsed.price.trim()) {
        const n = Number(parsed.price);
        if (Number.isFinite(n) && n > 0) price = n;
      } else if (typeof parsed.price === "number" && parsed.price > 0) {
        price = parsed.price;
      }
      if (Array.isArray(parsed.images)) {
        images = parsed.images.filter((x): x is string => typeof x === "string" && x.length > 0);
      }
    } catch {
      /* brouillon illisible — on affiche la fiche sans titre */
    }
  }

  // Ce qui bloque la publication, dit en toutes lettres. Un pourcentage seul
  // laisse deviner : « 60 % » ne dit pas s'il manque le prix ou les photos.
  const missing: string[] = [];
  if (!title) missing.push("le titre");
  if (!description) missing.push("la description");
  if (price === null) missing.push("le prix");
  if (images.length === 0) missing.push("au moins une photo");
  if (!location) missing.push("la localisation");

  const category = draft ? CATEGORIES.find((c) => c.id === draft.category) ?? null : null;
  const deleteOn = draft ? new Date(draft.updatedAt.getTime() + DRAFT_KEEP_DAYS * DAY_MS) : null;

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <Navbar />

      {/* Même dégagement que partout ailleurs : le bandeau de navigation est
          fixe, un `pt-8` faisait passer le titre dessous. */}
      <main className="mx-auto w-full max-w-2xl px-5 pt-28 md:pt-36 pb-24">
        <h1 className="text-2xl font-extrabold text-on-surface">Mes brouillons</h1>
        <p className="mt-1 text-sm text-outline">
          Une annonce commencée mais non publiée est conservée ici {DRAFT_KEEP_DAYS} jours.
        </p>

        {!draft ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300">draft</span>
            <p className="mt-2 font-bold text-on-surface">Aucun brouillon en cours</p>
            <p className="mt-1 text-sm text-outline">
              Vos annonces non terminées apparaîtront ici automatiquement.
            </p>
            <Link href="/post"
              className="mt-5 inline-block rounded-full bg-primary px-6 py-3 text-sm font-bold text-white">
              Déposer une annonce
            </Link>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_2px_16px_rgba(21,21,125,0.05)]">
            {/* Aperçu : la première photo en grand, les suivantes en pastilles.
                Sans photo, une zone qui dit clairement ce qui manque plutôt
                qu'un rectangle gris muet. */}
            {images.length > 0 ? (
              <div className="relative aspect-[16/10] bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={images[0]} alt="" className="h-full w-full object-cover" />
                <span className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-sm">
                  Brouillon
                </span>
                {images.length > 1 && (
                  <span className="absolute bottom-4 right-4 inline-flex items-center gap-1 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                    <span className="material-symbols-outlined text-[15px]">photo_library</span>
                    {images.length}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 bg-gradient-to-b from-slate-50 to-slate-100">
                <span className="material-symbols-outlined text-4xl text-slate-300">add_a_photo</span>
                <p className="text-sm font-bold text-slate-400">Aucune photo pour l&apos;instant</p>
                <p className="text-xs text-slate-400">Une annonce avec photo part bien plus vite</p>
              </div>
            )}

            <div className="p-6">
              <p className="text-xl font-extrabold leading-tight text-on-surface">
                {title ?? <span className="italic text-outline">Annonce sans titre</span>}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                {price !== null && (
                  <span className="text-lg font-extrabold tabular-nums text-primary">
                    {price.toLocaleString("fr-FR")} €
                  </span>
                )}
                {category && (
                  <span className="inline-flex items-center gap-1.5 text-outline">
                    <span className="material-symbols-outlined text-base text-primary">
                      {category.icon}
                    </span>
                    {category.label}
                  </span>
                )}
                {location && (
                  <span className="inline-flex items-center gap-1 text-outline">
                    <span className="material-symbols-outlined text-base">location_on</span>
                    {location}
                  </span>
                )}
              </div>

              {description && (
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-outline">
                  {description}
                </p>
              )}

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-outline">Complété</span>
                  <span className="tabular-nums text-primary">{draft.completeness} %</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, draft.completeness))}%` }}
                  />
                </div>
              </div>

              {missing.length > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Il manque encore
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-amber-900">
                    {missing.length === 1
                      ? missing[0].charAt(0).toUpperCase() + missing[0].slice(1)
                      : `${missing.slice(0, -1).join(", ")} et ${missing[missing.length - 1]}`}
                    .
                  </p>
                </div>
              )}

              <p className="mt-4 text-xs text-outline">
                Enregistré le {formatDate(draft.updatedAt)} · supprimé automatiquement le{" "}
                {deleteOn ? formatDate(deleteOn) : "—"}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href="/post"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition-transform active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  Reprendre mon annonce
                </Link>
                <DeleteDraftButton />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
