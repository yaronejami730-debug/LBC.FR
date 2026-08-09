import { formatDuration } from "@/lib/wellness/classify";

type Service = { label: string; durationMin: number | null; price: number };

export type WellnessMeta = {
  type?: string | null;
  offerKind?: string | null;
  audience?: string | null;
  formats?: string[];
  place?: string | null;
  durationMin?: number | null;
  capacity?: number | null;
  tariffType?: string | null;
  pricePerPerson?: number | null;
  services?: Service[];
};

const TARIFF_LABELS: Record<string, string> = {
  fixe: "Prix fixe",
  par_heure: "Prix / heure",
  par_personne: "Prix / personne",
  par_seance: "Prix / séance",
  a_partir_de: "À partir de",
  forfait: "Forfait",
};

/**
 * Encart « prestation » d'une annonce Beauté & Bien-être.
 *
 * Répond aux trois questions qu'un acheteur se pose avant d'écrire : ce que le
 * prix couvre, pour combien de temps, pour combien de personnes. Et, quand le
 * praticien l'a renseignée, la carte complète des tarifs — sans quoi il devrait
 * publier une annonce par prestation.
 */
export default function WellnessCard({
  meta,
  price,
}: {
  meta: WellnessMeta;
  price: number;
}) {
  const services = (meta.services ?? []).filter((s) => s && s.price > 0);
  const hasSummary =
    meta.durationMin || meta.capacity || meta.place || (meta.formats?.length ?? 0) > 0;

  if (!hasSummary && services.length === 0 && !meta.type) return null;

  const isRental = meta.offerKind === "location_espace";

  return (
    <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_8px_24px_rgba(21,21,125,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-extrabold tracking-tight text-on-surface font-['Manrope']">
          {isRental ? "L'espace proposé" : "La prestation"}
        </h2>
        {isRental && (
          <span className="rounded-full bg-[#d5e3fc] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#2f6fb8]">
            Entre professionnels
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {meta.type && <Cell icon="spa" label="Prestation" value={meta.type} />}
        {meta.durationMin ? (
          <Cell icon="schedule" label="Durée" value={formatDuration(meta.durationMin)} />
        ) : null}
        {meta.capacity ? (
          <Cell
            icon="group"
            label="Personnes"
            value={`${meta.capacity} personne${meta.capacity > 1 ? "s" : ""}`}
          />
        ) : null}
        <Cell
          icon="payments"
          label={TARIFF_LABELS[meta.tariffType ?? "fixe"] ?? "Tarif"}
          value={`${price.toLocaleString("fr-FR")} €`}
          highlight
        />
      </div>

      {meta.pricePerPerson ? (
        <p className="mt-3 text-sm font-semibold text-[#216b4d]">
          Soit {meta.pricePerPerson.toLocaleString("fr-FR")} € par personne
        </p>
      ) : null}

      {(meta.place || (meta.formats?.length ?? 0) > 0) && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {meta.place && <Tag>{meta.place}</Tag>}
          {(meta.formats ?? []).map((f) => (
            <Tag key={f}>{f}</Tag>
          ))}
        </div>
      )}

      {services.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-outline mb-2">
            Carte des prestations
          </h3>
          <ul className="divide-y divide-slate-100">
            {services.map((s, i) => (
              <li key={`${s.label}-${i}`} className="flex items-baseline gap-3 py-2.5">
                <span className="font-semibold text-on-surface">{s.label}</span>
                {s.durationMin ? (
                  <span className="text-xs text-outline shrink-0">{formatDuration(s.durationMin)}</span>
                ) : null}
                <span
                  className="flex-1 border-b border-dotted border-slate-200 translate-y-[-3px]"
                  aria-hidden
                />
                <span className="font-extrabold text-primary shrink-0">
                  {s.price.toLocaleString("fr-FR")} €
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Cell({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-xl ${highlight ? "bg-primary/10" : "bg-slate-50"}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-outline font-semibold">
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        {label}
      </div>
      <div className={`font-bold mt-0.5 ${highlight ? "text-primary" : "text-on-surface"} text-sm`}>
        {value}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant ring-1 ring-inset ring-slate-100">
      {children}
    </span>
  );
}
