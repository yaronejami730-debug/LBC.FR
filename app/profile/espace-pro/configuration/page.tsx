import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import ProNav from "../ProNav";
import AdminViewBanner from "../AdminViewBanner";
import { resolveProContext, canManageEstablishments } from "@/lib/pro/access";
import { configSectionsFor, type ConfigSectionId } from "@/lib/pro/configuration";
import { CAPABILITY_LABELS, prerequisitesFor } from "@/lib/pro/capabilities";
import EnableCapability from "./EnableCapability";

export const metadata = { title: "Configuration" };
export const dynamic = "force-dynamic";

/**
 * Le hub de configuration : une seule porte pour tout ce qui se règle.
 *
 * Avant, chaque réglage était un onglet de plus dans la barre — l'équipe ici,
 * les règles de réservation là, les horaires nulle part. Le professionnel
 * devait savoir dans quel onglet vivait quoi. Ici, il n'a qu'à ouvrir
 * « Configuration » : les sections viennent de `configSectionsFor()`, donc de
 * ses capacités et de son rôle, et chacune annonce son état.
 */
export default async function ConfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string; activer?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/profile/espace-pro/configuration");

  const { etab, activer } = await searchParams;
  const context = await resolveProContext(undefined, etab ?? null).catch(() => null);
  if (!context) redirect("/profile/espace-pro");

  const profile = context.establishment;
  const sections = configSectionsFor(context.capabilities, context.lexicon, context.role);

  const [memberCount, serviceCount, bookableCount, settings, accessCount] = await Promise.all([
    prisma.proMember.count({ where: { profileId: profile.id, isActive: true } }),
    prisma.proService.count({ where: { profileId: profile.id, isActive: true } }),
    prisma.proService.count({
      where: { profileId: profile.id, isActive: true, isBookable: true, durationMin: { not: null } },
    }),
    prisma.proBookingSettings.findUnique({ where: { profileId: profile.id } }),
    profile.companyId
      ? prisma.proAccess.count({ where: { companyId: profile.companyId } })
      : Promise.resolve(0),
  ]);

  const openDays = Object.values(parseHours(profile.hours)).filter(Boolean).length;

  /**
   * État de chaque section, en une phrase.
   *
   * Un réglage vide n'est pas une erreur, mais il a des conséquences visibles
   * côté client — c'est ce qu'on écrit ici, plutôt qu'une pastille « incomplet »
   * qui n'apprend rien.
   */
  const status: Record<ConfigSectionId, { text: string; warn: boolean }> = {
    fiche: {
      text: serviceCount > 0 ? `${serviceCount} ligne${plural(serviceCount)} au catalogue` : "Catalogue vide",
      warn: serviceCount === 0,
    },
    horaires: {
      text: openDays > 0 ? `${openDays} jour${plural(openDays)} renseigné${plural(openDays)}` : "Aucun horaire affiché",
      warn: openDays === 0,
    },
    equipe: {
      text: memberCount > 0 ? `${memberCount} personne${plural(memberCount)}` : "Personne dans l'équipe",
      warn: memberCount === 0,
    },
    reservation: {
      text:
        memberCount === 0 || bookableCount === 0
          ? "Réservation fermée"
          : settings
            ? `Créneaux de ${settings.slotGranularityMin} min · ${settings.autoConfirm ? "confirmation automatique" : "confirmation manuelle"}`
            : "Réglages par défaut",
      warn: memberCount === 0 || bookableCount === 0,
    },
    acces: {
      text:
        accessCount > 0
          ? `${accessCount} compte${plural(accessCount)} autorisé${plural(accessCount)}`
          : "Vous seul",
      warn: false,
    },
    etablissements: {
      text: `${context.establishments.length} établissement${plural(context.establishments.length)}`,
      warn: false,
    },
  };

  return (
    <div className="bg-surface min-h-screen">
      <Navbar />
      <main className="pt-28 md:pt-36 pb-16 px-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope'] mb-1">Configuration</h1>
        <p className="text-sm text-outline mb-4">
          Tous les réglages de {profile.name} : identité, horaires, équipe, plannings et réservation.
        </p>

        <ProNav
          current="/profile/espace-pro/configuration"
          slug={profile.slug}
          modules={context.modules}
          establishments={context.establishments}
          activeEstablishmentId={profile.id}
          canBook={context.capabilities.includes("bookings")}
        />

        {context.isPlatformAdmin && <AdminViewBanner establishmentName={profile.name} />}

        {/* On arrive ici depuis « Agenda » quand la réservation n'est pas
            activée : il faut dire pourquoi, sinon le clic ressemble à un bug. */}
        {activer === "bookings" && !context.capabilities.includes("bookings") && (
          <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong className="font-bold">L&apos;agenda n&apos;est pas encore ouvert</strong> pour{" "}
            {profile.name}. Activez la réservation en ligne ci-dessous pour y accéder.
          </div>
        )}

        {/* L'état de la vitrine se lit avant d'entrer dans les réglages : une
            fiche hors ligne rend la plupart d'entre eux sans effet visible. */}
        <div
          className={`mb-5 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
            profile.isPublished
              ? "border-emerald-100 bg-emerald-50 text-emerald-800"
              : "border-slate-100 bg-white text-on-surface-variant"
          }`}
        >
          <span
            aria-hidden
            className={`w-2 h-2 rounded-full ${profile.isPublished ? "bg-emerald-500" : "bg-slate-300"}`}
          />
          <span className="font-bold">{profile.isPublished ? "Fiche en ligne" : "Fiche hors ligne"}</span>
          <Link
            href="/profile/espace-pro"
            title="Gérer la mise en ligne de la fiche"
            className="ml-auto font-bold underline"
          >
            {profile.isPublished ? "Mettre hors ligne" : "Mettre en ligne"}
          </Link>
        </div>

        <ul className="space-y-2.5">
          {sections.map((section) => {
            const state = status[section.id];

            // Section verrouillée : elle reste visible et dit ce qui lui manque.
            // Un responsable peut l'ouvrir sur place ; un MANAGER lit pourquoi
            // il ne le peut pas, plutôt que de chercher un onglet absent.
            if (!section.available) {
              return (
                <li
                  key={section.id}
                  className="rounded-2xl border border-dashed border-slate-200 bg-surface-container-low/40 p-5"
                >
                  <div className="flex items-start gap-4">
                    <span className="material-symbols-outlined text-outline text-[26px] shrink-0">
                      {section.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold font-['Manrope'] text-on-surface-variant">
                        {section.title}
                      </p>
                      <p className="text-sm text-outline mt-0.5 leading-relaxed">
                        {section.description}
                      </p>
                      {canManageEstablishments(context.role) ? (
                        <EnableCapability
                          capability={section.missing[0]}
                          establishmentId={profile.id}
                          labels={section.missing.map((c) => CAPABILITY_LABELS[c])}
                          // La réservation en ligne ne tient pas debout sans
                          // catalogue : on annonce ce que le clic ouvrira en
                          // plus, plutôt que de le faire dans le dos.
                          alsoEnables={prerequisitesFor(section.missing[0], context.capabilities).map(
                            (c) => CAPABILITY_LABELS[c],
                          )}
                        />
                      ) : (
                        <p className="mt-3 text-xs text-outline">
                          Non activé pour cet établissement — demandez-le au responsable.
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            }

            return (
              <li key={section.id}>
                <Link
                  href={section.href}
                  title={section.title}
                  className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-5 hover:border-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-primary text-[26px] shrink-0">
                    {section.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-extrabold font-['Manrope'] block">{section.title}</span>
                    <span className="text-sm text-outline block mt-0.5 leading-relaxed">
                      {section.description}
                    </span>
                    <span
                      className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        state.warn ? "bg-amber-50 text-amber-800" : "bg-surface-container-low text-on-surface-variant"
                      }`}
                    >
                      {state.text}
                    </span>
                  </span>
                  <span className="material-symbols-outlined text-outline text-[20px] shrink-0">
                    chevron_right
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}

const plural = (n: number) => (n > 1 ? "s" : "");

function parseHours(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}
