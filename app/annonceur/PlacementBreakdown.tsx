import Link from "next/link";
import {
  placement as placementDef,
  placementLabel,
  placementPreviewPath,
} from "@/lib/ads/placements";
import type { PlacementRow } from "@/lib/ads/stats";
import { COLORS } from "@/lib/ads/theme";

/**
 * Ventilation par emplacement — « quelle bannière a marché ».
 *
 * Le tableau de bord donnait un total et une carte de France. Aucun des deux
 * ne répond à la question que l'annonceur se pose vraiment : sur quoi remettre
 * de l'argent, et quoi couper. Ici, une ligne par emplacement, avec le taux de
 * clic et le coût par clic côte à côte — ce sont eux qui départagent deux
 * bannières que le volume d'impressions ferait paraître équivalentes.
 *
 * Chaque ligne porte un bouton d'aperçu vers la page où la bannière s'affiche.
 * « Bandeau du profil » ne veut rien dire tant qu'on n'a pas vu l'écran ; un
 * annonceur qui ne sait pas où il achète n'arbitre pas, il subit.
 *
 * Rien n'est estimé : chaque colonne vient des événements réels. Une case sans
 * donnée affiche un tiret plutôt qu'un zéro, parce que « 0 % de clics » et
 * « pas encore de clic » ne se décident pas pareil.
 */

const euros = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const nombre = (n: number) => n.toLocaleString("fr-FR");

const pourcent = (v: number | null) => (v === null ? "—" : `${v.toFixed(2).replace(".", ",")} %`);

/**
 * Largeurs de colonnes, définies une seule fois.
 *
 * L'en-tête et les lignes lisent le même tableau : c'est la seule façon de
 * garantir qu'un chiffre reste sous son intitulé. Deux listes de largeurs
 * finissent toujours par diverger d'un pixel, puis d'une colonne.
 */
const COLUMNS = [
  { key: "impressions", label: "Impressions", width: "w-[104px]" },
  { key: "clicks", label: "Clics", width: "w-[72px]" },
  { key: "ctr", label: "Taux de clic", width: "w-[104px]" },
  { key: "cpc", label: "Coût par clic", width: "w-[104px]" },
  { key: "cost", label: "Dépense", width: "w-[96px]" },
] as const;

function Value({
  children,
  strong,
  width,
}: {
  children: React.ReactNode;
  strong?: boolean;
  width: string;
}) {
  return (
    <div
      className={`${width} shrink-0 text-right text-[13px] tabular-nums ${
        strong ? "font-extrabold" : "font-semibold"
      }`}
      style={strong ? undefined : { color: COLORS.soft }}
    >
      {children}
    </div>
  );
}

/**
 * Carré d'aperçu : ouvre la page où la bannière s'affiche, dans un onglet neuf.
 *
 * Muet — sans lien — pour les surfaces qui n'ont pas d'URL : l'application et
 * la boîte mail du destinataire. Un bouton qui ne mène nulle part vaut moins
 * qu'un bouton absent.
 */
function PreviewButton({ href, label }: { href: string | null; label: string }) {
  if (!href) return <span className="w-8 shrink-0" aria-hidden />;
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`Voir où s'affiche « ${label} »`}
      aria-label={`Voir où s'affiche ${label}`}
      className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-colors"
      style={{ border: `1px solid ${COLORS.line}`, background: "#fff", color: COLORS.blue }}
    >
      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
    </Link>
  );
}

export default function PlacementBreakdown({
  rows,
  totalImpressions,
  listingHref,
}: {
  rows: PlacementRow[];
  totalImpressions: number;
  /** Annonce en ligne servant d'aperçu à l'encart de fiche annonce. */
  listingHref?: string | null;
}) {
  if (rows.length === 0) return null;

  // Total du tableau, recalculé ici plutôt que reçu : si la ventilation et le
  // total ne venaient pas des mêmes lignes, ils pourraient se contredire.
  const sommeImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const sommeClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const sommeCost = rows.reduce((s, r) => s + r.costCents, 0);
  const somme = {
    impressions: sommeImpressions,
    clicks: sommeClicks,
    costCents: sommeCost,
    ctr: sommeImpressions > 0 ? (sommeClicks / sommeImpressions) * 100 : null,
    cpcCents: sommeClicks > 0 ? Math.round(sommeCost / sommeClicks) : null,
  };

  // Meilleur taux de clic de la période : distingué, mais seulement s'il
  // repose sur assez d'affichages pour vouloir dire quelque chose.
  const solides = rows.filter((r) => r.impressions >= 100 && r.ctr !== null);
  const meilleur =
    solides.length > 0 ? solides.reduce((best, r) => (r.ctr! > best.ctr! ? r : best)) : null;

  const vues = rows.map((r) => {
    const def = placementDef(r.placement);
    const href =
      r.placement === "LISTING_ROTATOR" ? (listingHref ?? null) : placementPreviewPath(r.placement);
    return {
      ...r,
      label: placementLabel(r.placement),
      surface: def?.surface ?? "Autre",
      description: def?.description ?? "",
      href,
      part: totalImpressions > 0 ? (r.impressions / totalImpressions) * 100 : 0,
      meilleur: meilleur?.placement === r.placement,
    };
  });

  return (
    <section
      className="rounded-[18px] bg-white overflow-hidden"
      style={{ border: `1px solid ${COLORS.line}` }}
    >
      <div className="px-[18px] py-4" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
        <h2 className="font-extrabold text-[15px]">Par emplacement</h2>
        <p className="text-[12.5px]" style={{ color: COLORS.muted }}>
          Ce que chaque bannière a produit sur 30 jours. La flèche ouvre la page où elle
          s&apos;affiche.
        </p>
      </div>

      {/* ── Large : un vrai tableau, une colonne par indicateur ───────────── */}
      <div className="hidden lg:block">
        <div
          className="flex items-center gap-4 px-[18px] py-2.5"
          style={{ color: COLORS.muted, borderBottom: `1px solid ${COLORS.line}` }}
        >
          <div className="flex-1 min-w-0 text-[11px] font-bold uppercase tracking-wide">
            Emplacement
          </div>
          {COLUMNS.map((c) => (
            <div
              key={c.key}
              className={`${c.width} shrink-0 text-right text-[11px] font-bold uppercase tracking-wide leading-tight`}
            >
              {c.label}
            </div>
          ))}
        </div>

        <ul className="divide-y" style={{ borderColor: COLORS.line }}>
          {vues.map((r) => (
            <li key={r.placement} className="flex items-center gap-4 px-[18px] py-3.5">
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <PreviewButton href={r.href} label={r.label} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[13.5px] truncate">{r.label}</span>
                    {r.meilleur && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ background: "#DCFCE7", color: "#15803D" }}
                      >
                        Meilleur taux
                      </span>
                    )}
                  </div>
                  {/* Part d'affichage : sans elle, « 4 200 impressions » ne dit
                      pas si l'emplacement porte la campagne ou l'accompagne. */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span
                      className="h-1.5 w-[132px] rounded-full overflow-hidden shrink-0"
                      style={{ background: COLORS.tint }}
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${r.part}%`, background: COLORS.blueLight }}
                      />
                    </span>
                    <span className="text-[11.5px] tabular-nums" style={{ color: COLORS.muted }}>
                      {r.part.toFixed(1).replace(".", ",")} % des vues · {r.surface}
                    </span>
                  </div>
                </div>
              </div>

              <Value width={COLUMNS[0].width} strong>
                {nombre(r.impressions)}
              </Value>
              <Value width={COLUMNS[1].width} strong>
                {nombre(r.clicks)}
              </Value>
              <Value width={COLUMNS[2].width}>{pourcent(r.ctr)}</Value>
              <Value width={COLUMNS[3].width}>
                {r.cpcCents === null ? "—" : euros(r.cpcCents)}
              </Value>
              <Value width={COLUMNS[4].width} strong>
                {euros(r.costCents)}
              </Value>
            </li>
          ))}
        </ul>

        {/* Ligne de total : elle doit retrouver, au chiffre près, les cartes du
            haut de page. C'est le contrôle que l'annonceur fait en premier. */}
        <div
          className="flex items-center gap-4 px-[18px] py-3.5"
          style={{ borderTop: `2px solid ${COLORS.line}`, background: COLORS.tint }}
        >
          <div className="flex-1 min-w-0 font-extrabold text-[13px]">
            Total · {rows.length} emplacement{rows.length > 1 ? "s" : ""}
          </div>
          <Value width={COLUMNS[0].width} strong>
            {nombre(somme.impressions)}
          </Value>
          <Value width={COLUMNS[1].width} strong>
            {nombre(somme.clicks)}
          </Value>
          <Value width={COLUMNS[2].width} strong>
            {pourcent(somme.ctr)}
          </Value>
          <Value width={COLUMNS[3].width} strong>
            {somme.cpcCents === null ? "—" : euros(somme.cpcCents)}
          </Value>
          <Value width={COLUMNS[4].width} strong>
            {euros(somme.costCents)}
          </Value>
        </div>
      </div>

      {/* ── Étroit : une fiche par emplacement, chaque chiffre sous son nom ─
          Un tableau de six colonnes réduit à la largeur d'un téléphone ne se
          lit pas : il se devine. Chaque indicateur reprend donc son intitulé. */}
      <ul className="lg:hidden divide-y" style={{ borderColor: COLORS.line }}>
        {vues.map((r) => (
          <li key={r.placement} className="px-[18px] py-4">
            <div className="flex items-start gap-3">
              <PreviewButton href={r.href} label={r.label} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[14px]">{r.label}</span>
                  {r.meilleur && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: "#DCFCE7", color: "#15803D" }}
                    >
                      Meilleur taux
                    </span>
                  )}
                </div>
                <p className="text-[12px] mt-0.5" style={{ color: COLORS.muted }}>
                  {r.surface} · {r.part.toFixed(1).replace(".", ",")} % des vues
                </p>
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-3 gap-y-3 gap-x-2">
              {[
                { label: "Impressions", value: nombre(r.impressions) },
                { label: "Clics", value: nombre(r.clicks) },
                { label: "Taux de clic", value: pourcent(r.ctr) },
                { label: "Coût par clic", value: r.cpcCents === null ? "—" : euros(r.cpcCents) },
                { label: "Dépense", value: euros(r.costCents) },
              ].map((m) => (
                <div key={m.label}>
                  <dt
                    className="text-[10.5px] font-bold uppercase tracking-wide"
                    style={{ color: COLORS.muted }}
                  >
                    {m.label}
                  </dt>
                  <dd className="text-[15px] font-extrabold tabular-nums mt-0.5">{m.value}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}

        <li className="px-[18px] py-4" style={{ background: COLORS.tint }}>
          <p className="font-extrabold text-[13px]">
            Total · {rows.length} emplacement{rows.length > 1 ? "s" : ""}
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-y-3 gap-x-2">
            {[
              { label: "Impressions", value: nombre(somme.impressions) },
              { label: "Clics", value: nombre(somme.clicks) },
              { label: "Taux de clic", value: pourcent(somme.ctr) },
              { label: "Coût par clic", value: somme.cpcCents === null ? "—" : euros(somme.cpcCents) },
              { label: "Dépense", value: euros(somme.costCents) },
            ].map((m) => (
              <div key={m.label}>
                <dt
                  className="text-[10.5px] font-bold uppercase tracking-wide"
                  style={{ color: COLORS.muted }}
                >
                  {m.label}
                </dt>
                <dd className="text-[15px] font-extrabold tabular-nums mt-0.5">{m.value}</dd>
              </div>
            ))}
          </dl>
        </li>
      </ul>
    </section>
  );
}
