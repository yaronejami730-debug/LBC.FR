"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AGE_RANGES, OBJECTIVES, PLACEMENTS } from "@/lib/ads/placements";
import { COLORS, PRIMARY_GRADIENT, PRIMARY_SHADOW } from "@/lib/ads/theme";

const STEPS = ["Objectif", "Audience", "Localisation", "Budget", "Publicité", "Récapitulatif"];

const field = "w-full rounded-xl bg-white px-3.5 py-2.5 text-[14px] outline-none";
const fieldStyle = { border: `1px solid ${COLORS.line}` };
const legend = "text-[11.5px] font-bold uppercase tracking-wide";
const legendStyle = { color: COLORS.muted };
/** Carte : le motif répété de tout l'espace annonceur. */
const cardStyle = { background: "#fff", border: `1px solid ${COLORS.line}` };

const euros = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

type Zone = { label: string; radiusKm: number };

/**
 * Assistant de création de campagne.
 *
 * Six étapes plutôt qu'un formulaire unique : personne ne remplit dix-huit
 * champs d'affilée pour un essai à 20 €. Chaque étape pose une question en
 * français, et l'aperçu reste visible en permanence — c'est la seule façon de
 * répondre à « où va apparaître ma publicité » sans faire un cours d'AdTech.
 *
 * Aucune règle n'est décidée ici : le serveur revalide tout. Ce qui suit ne
 * fait qu'empêcher d'avancer avec un écran vide.
 */
export default function CampaignWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [objective, setObjective] = useState<string>("VISITES");
  const [ages, setAges] = useState<string[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneInput, setZoneInput] = useState("");
  const [zoneRadius, setZoneRadius] = useState(10);
  const [placements, setPlacements] = useState<string[]>(["HOME_TOP"]);
  const [dailyEuros, setDailyEuros] = useState(20);
  const [startAt, setStartAt] = useState(inDays(0));
  const [endAt, setEndAt] = useState(inDays(30));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("En savoir plus");
  const [destinationUrl, setDestinationUrl] = useState("");

  /**
   * Estimation renvoyée par le serveur.
   *
   * Recalculée à chaque changement d'emplacement, de zone ou de budget — c'est
   * ce que demande le cahier des charges, et c'est aussi la seule façon de
   * rendre un budget compréhensible : « 20 € » ne veut rien dire, « 20 € →
   * 900 à 1 700 impressions » se décide.
   */
  const [estimate, setEstimate] = useState<
    | { available: false; reason: string }
    | {
        available: true;
        dailyImpressions: { low: number; high: number };
        dailyClicks: { low: number; high: number };
        observedCtr: number;
        cpcCents: number;
        inventoryFill: number;
        note: string;
      }
    | null
  >(null);

  const zonesKey = zones.map((z) => `${z.label}:${z.radiusKm}`).join("|");
  const placementsKey = placements.join("|");

  useEffect(() => {
    // Seules les étapes budget et récapitulatif en ont besoin : pas la peine
    // d'interroger le serveur pendant qu'on choisit un objectif.
    if (step < 3) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/advertiser/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placements,
          zones,
          dailyBudgetCents: Math.round(dailyEuros * 100),
        }),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((d) => setEstimate(d.estimate ?? null))
        .catch(() => {});
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, placementsKey, zonesKey, dailyEuros]);

  const days = useMemo(() => {
    const d = Math.ceil(
      (new Date(endAt).getTime() - new Date(startAt).getTime()) / 86_400_000,
    );
    return Number.isFinite(d) && d > 0 ? d : 0;
  }, [startAt, endAt]);
  const totalCents = Math.round(dailyEuros * 100) * Math.max(days, 1);

  const canContinue = [
    Boolean(objective) && name.trim().length >= 3,
    true, // l'audience est facultative : « tout le monde » est un choix valable
    true, // pas de zone = France entière
    dailyEuros >= 2 && days > 0,
    title.trim().length >= 3 && imageUrl.trim().length > 0 && destinationUrl.trim().length > 0,
    true,
  ][step];

  function toggle(list: string[], value: string, set: (v: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function addZone() {
    const label = zoneInput.trim();
    if (!label || zones.length >= 10) return;
    setZones([...zones, { label, radiusKm: zoneRadius }]);
    setZoneInput("");
  }

  async function submit(sendForReview: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/advertiser/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          objective,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          dailyBudgetCents: Math.round(dailyEuros * 100),
          totalBudgetCents: totalCents,
          placements,
          zones,
          audienceAges: ages,
          creative: { title, description, imageUrl, ctaLabel, destinationUrl },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Création impossible");
        return;
      }

      if (sendForReview) {
        const sub = await fetch(`/api/advertiser/campaigns/${data.campaign.id}/submit`, {
          method: "POST",
        });
        if (!sub.ok) {
          const payload = await sub.json().catch(() => ({}));
          setError(payload.error ?? "Soumission impossible");
          return;
        }
      }
      router.push("/annonceur/campagnes");
      router.refresh();
    } catch {
      setError("Connexion interrompue, réessayez");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      <div className="space-y-5">
        {/* Progression : on doit toujours savoir où l'on en est et ce qui reste. */}
        <ol className="flex flex-wrap gap-1.5 text-[11px] font-bold">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className="rounded-full px-3 py-1"
              style={
                i === step
                  ? { background: PRIMARY_GRADIENT, color: "#fff" }
                  : i < step
                    ? { background: COLORS.tint, color: COLORS.blue }
                    : { background: COLORS.tint, color: COLORS.muted }
              }
            >
              {i + 1}. {s}
            </li>
          ))}
        </ol>

        <div className="rounded-[18px] p-5 space-y-4" style={cardStyle}>
          {step === 0 && (
            <>
              <h2 className="text-lg font-extrabold font-['Manrope']">Que souhaitez-vous obtenir ?</h2>
              <div className="grid sm:grid-cols-2 gap-2">
                {OBJECTIVES.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => {
                      setObjective(o.key);
                      setCtaLabel(o.defaultCta);
                    }}
                    className="text-left rounded-xl p-3 transition-colors"
                    style={
                      objective === o.key
                        ? { border: `1px solid ${COLORS.blue}`, background: COLORS.tint }
                        : { border: `1px solid ${COLORS.line}`, background: "#fff" }
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ color: COLORS.blue }}>{o.icon}</span>
                    <span className="block font-bold text-sm mt-1">{o.label}</span>
                    <span className="block text-xs text-[#94A3B8] mt-0.5">{o.description}</span>
                  </button>
                ))}
              </div>
              <div>
                <label className={legend} style={legendStyle} htmlFor="name">Nom de la campagne</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ouverture boutique — septembre"
                  className={field + " mt-1"} style={fieldStyle}
                />
                <p className="text-[11px] text-[#94A3B8] mt-1">Interne : vos clients ne le voient pas.</p>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-lg font-extrabold font-['Manrope']">Qui souhaitez-vous toucher ?</h2>
              <p className="text-sm text-[#94A3B8]">
                Sans sélection, votre publicité s&apos;adresse à tout le monde — c&apos;est le
                réglage le plus courant, et souvent le plus efficace au démarrage.
              </p>
              <div className="flex flex-wrap gap-2">
                {AGE_RANGES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggle(ages, a, setAges)}
                    className="rounded-full px-4 py-2 text-[13.5px] font-bold"
                    style={
                      ages.includes(a)
                        ? { border: `1px solid ${COLORS.blue}`, background: COLORS.tint, color: COLORS.blue }
                        : { border: `1px solid ${COLORS.line}`, color: COLORS.soft, background: "#fff" }
                    }
                  >
                    {a} ans
                  </button>
                ))}
              </div>
              {ages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAges([])}
                  className="text-xs font-bold text-[#94A3B8] underline"
                >
                  Revenir à « tout le monde »
                </button>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-extrabold font-['Manrope']">Où diffuser ?</h2>
              <p className="text-sm text-[#94A3B8]">
                Ajoutez une ville, et le rayon autour d&apos;elle. Sans zone, votre publicité est
                diffusée dans toute la France.
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[180px]">
                  <label className={legend} style={legendStyle} htmlFor="zone">Ville</label>
                  <input
                    id="zone"
                    value={zoneInput}
                    onChange={(e) => setZoneInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addZone();
                      }
                    }}
                    placeholder="Paris"
                    className={field + " mt-1"} style={fieldStyle}
                  />
                </div>
                <div className="w-32">
                  <label className={legend} style={legendStyle} htmlFor="radius">Rayon</label>
                  <select
                    id="radius"
                    value={zoneRadius}
                    onChange={(e) => setZoneRadius(Number(e.target.value))}
                    className={field + " mt-1"} style={fieldStyle}
                  >
                    <option value={0}>La ville seule</option>
                    <option value={5}>5 km</option>
                    <option value={10}>10 km</option>
                    <option value={25}>25 km</option>
                    <option value={50}>50 km</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={addZone}
                  className="rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-white"
                  style={{ background: PRIMARY_GRADIENT }}
                >
                  Ajouter
                </button>
              </div>

              {zones.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {zones.map((z, i) => (
                    <li
                      key={`${z.label}-${i}`}
                      className="inline-flex items-center gap-2 rounded-full bg-[#F1F5FC] px-3 py-1.5 text-sm font-bold"
                    >
                      {z.label}
                      {z.radiusKm > 0 && <span className="text-[#94A3B8]">+ {z.radiusKm} km</span>}
                      <button
                        type="button"
                        onClick={() => setZones(zones.filter((_, x) => x !== i))}
                        aria-label={`Retirer ${z.label}`}
                        className="text-[#94A3B8] hover:text-[#ba1a1a]"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="text-sm font-bold pt-2">Où votre publicité doit-elle apparaître ?</h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {PLACEMENTS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => toggle(placements, p.key, setPlacements)}
                    className="text-left rounded-xl p-3"
                    style={
                      placements.includes(p.key)
                        ? { border: `1px solid ${COLORS.blue}`, background: COLORS.tint }
                        : { border: `1px solid ${COLORS.line}`, background: "#fff" }
                    }
                  >
                    <span className="block font-bold text-sm">{p.label}</span>
                    <span className="block text-xs text-[#94A3B8] mt-0.5">{p.description}</span>
                    <span className="block text-[11px] text-[#94A3B8] mt-1">{p.format}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-lg font-extrabold font-['Manrope']">Combien souhaitez-vous investir ?</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className={legend} style={legendStyle} htmlFor="daily">Budget par jour (€)</label>
                  <input
                    id="daily"
                    type="number"
                    min={2}
                    step={1}
                    value={dailyEuros}
                    onChange={(e) => setDailyEuros(Number(e.target.value))}
                    className={field + " mt-1 tabular-nums"} style={fieldStyle}
                  />
                </div>
                <div>
                  <label className={legend} style={legendStyle} htmlFor="start">Début</label>
                  <input
                    id="start"
                    type="date"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className={field + " mt-1"} style={fieldStyle}
                  />
                </div>
                <div>
                  <label className={legend} style={legendStyle} htmlFor="end">Fin</label>
                  <input
                    id="end"
                    type="date"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className={field + " mt-1"} style={fieldStyle}
                  />
                </div>
              </div>
              <p className="rounded-xl bg-[#F1F5FC] px-4 py-3 text-sm">
                <strong>{euros(totalCents)}</strong> au maximum sur {days} jour{days > 1 ? "s" : ""}.
                Vous ne pouvez jamais être débité au-delà.
              </p>
              <EstimateBlock estimate={estimate} />
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-lg font-extrabold font-['Manrope']">Créez votre publicité</h2>
              <div>
                <label className={legend} style={legendStyle} htmlFor="title">Titre</label>
                <input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  placeholder="Restaurant Le Marais"
                  className={field + " mt-1"} style={fieldStyle}
                />
              </div>
              <div>
                <label className={legend} style={legendStyle} htmlFor="desc">Description</label>
                <textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="Découvrez notre nouveau menu d'automne."
                  className={field + " mt-1 resize-none"} style={fieldStyle}
                />
              </div>
              <div>
                <label className={legend} style={legendStyle} htmlFor="image">Adresse du visuel</label>
                <input
                  id="image"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…/visuel.jpg"
                  className={field + " mt-1"} style={fieldStyle}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={legend} style={legendStyle} htmlFor="cta">Bouton</label>
                  <input
                    id="cta"
                    value={ctaLabel}
                    onChange={(e) => setCtaLabel(e.target.value)}
                    maxLength={30}
                    className={field + " mt-1"} style={fieldStyle}
                  />
                </div>
                <div>
                  <label className={legend} style={legendStyle} htmlFor="dest">Destination</label>
                  <input
                    id="dest"
                    value={destinationUrl}
                    onChange={(e) => setDestinationUrl(e.target.value)}
                    placeholder="https://votre-site.fr"
                    className={field + " mt-1"} style={fieldStyle}
                  />
                </div>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="text-lg font-extrabold font-['Manrope']">Votre campagne</h2>
              <dl className="text-sm divide-y divide-slate-100">
                {[
                  ["Objectif", OBJECTIVES.find((o) => o.key === objective)?.label ?? objective],
                  ["Audience", ages.length ? `${ages.join(", ")} ans` : "Tout le monde"],
                  [
                    "Localisation",
                    zones.length
                      ? zones.map((z) => (z.radiusKm ? `${z.label} + ${z.radiusKm} km` : z.label)).join(" · ")
                      : "France entière",
                  ],
                  [
                    "Emplacements",
                    placements.map((p) => PLACEMENTS.find((x) => x.key === p)?.label ?? p).join(", "),
                  ],
                  ["Budget", `${euros(dailyEuros * 100)}/jour · ${euros(totalCents)} au total`],
                  ["Durée", `${days} jour${days > 1 ? "s" : ""}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-4 py-2">
                    <dt className="w-32 shrink-0 text-[#94A3B8]">{k}</dt>
                    <dd className="font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <EstimateBlock estimate={estimate} />
              <p className="text-xs text-[#94A3B8]">
                Votre campagne est relue par l&apos;équipe Deal&amp;Co avant diffusion. Vous êtes
                prévenu dès la décision, et vous pouvez la modifier à tout moment d&apos;ici là.
              </p>
            </>
          )}

          {error && <p className="text-sm font-semibold text-[#ba1a1a]">{error}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="rounded-xl px-5 py-2.5 text-[13.5px] font-bold"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.soft, background: "#fff" }}
              >
                Retour
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canContinue}
                className="rounded-xl px-6 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-40"
                style={{ background: PRIMARY_GRADIENT, boxShadow: PRIMARY_SHADOW }}
              >
                Continuer
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => submit(true)}
                  disabled={busy}
                  className="rounded-xl px-6 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
                  style={{ background: PRIMARY_GRADIENT, boxShadow: PRIMARY_SHADOW }}
                >
                  {busy ? "Envoi…" : "Soumettre la campagne"}
                </button>
                <button
                  type="button"
                  onClick={() => submit(false)}
                  disabled={busy}
                  className="text-sm font-bold text-[#94A3B8] underline"
                >
                  Enregistrer comme brouillon
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Aperçu permanent : la réponse à « où va apparaître ma publicité ». */}
      <aside className="lg:sticky lg:top-6 space-y-3">
        <p className={legend} style={legendStyle}>Voici votre publicité</p>
        <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
          <div className="aspect-[16/9] bg-[#F1F5FC] grid place-items-center overflow-hidden">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-[#94A3B8]">Votre visuel</span>
            )}
          </div>
          <div className="p-4">
            <p className="font-bold">{title || "Titre de votre publicité"}</p>
            <p className="text-sm text-[#94A3B8] mt-1 line-clamp-2">
              {description || "Votre message en une phrase."}
            </p>
            <span className="mt-3 inline-block rounded-full px-4 py-1.5 text-xs font-bold text-white">
              {ctaLabel || "En savoir plus"}
            </span>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Sponsorisé
            </p>
          </div>
        </div>
        <ul className="text-xs text-[#94A3B8] space-y-1">
          <li>📍 {zones.length ? zones.map((z) => z.label).join(", ") : "France entière"}</li>
          <li>👥 {ages.length ? `${ages.join(", ")} ans` : "Tout le monde"}</li>
          <li>💰 {euros(dailyEuros * 100)} par jour</li>
          <li>
            📱 {placements.map((p) => PLACEMENTS.find((x) => x.key === p)?.surface ?? p).join(" · ") || "—"}
          </li>
        </ul>
      </aside>
    </div>
  );
}

/**
 * Bloc d'estimation.
 *
 * Il dit toujours quelque chose : une fourchette quand les données existent,
 * la raison de son absence sinon. Un espace vide laisserait croire à un bug.
 */
function EstimateBlock({
  estimate,
}: {
  estimate:
    | { available: false; reason: string }
    | {
        available: true;
        dailyImpressions: { low: number; high: number };
        dailyClicks: { low: number; high: number };
        observedCtr: number;
        cpcCents: number;
        inventoryFill: number;
        note: string;
      }
    | null;
}) {
  if (!estimate) {
    return (
      <p className="rounded-xl px-4 py-3 text-[12.5px]" style={{ background: COLORS.tint, color: COLORS.muted }}>
        Calcul de l&apos;estimation…
      </p>
    );
  }

  if (!estimate.available) {
    return (
      <p className="rounded-xl px-4 py-3 text-[12.5px] leading-relaxed" style={{ background: COLORS.tint, color: COLORS.soft }}>
        {estimate.reason}
      </p>
    );
  }

  const nb = (n: number) => n.toLocaleString("fr-FR");

  return (
    <div className="rounded-xl px-4 py-3.5" style={{ background: COLORS.tint }}>
      <p className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.muted }}>
        Estimation quotidienne
      </p>
      <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
        <div>
          <dt style={{ color: COLORS.muted }}>Impressions</dt>
          <dd className="font-bold tabular-nums">
            {nb(estimate.dailyImpressions.low)} – {nb(estimate.dailyImpressions.high)}
          </dd>
        </div>
        <div>
          <dt style={{ color: COLORS.muted }}>Clics</dt>
          <dd className="font-bold tabular-nums">
            {nb(estimate.dailyClicks.low)} – {nb(estimate.dailyClicks.high)}
          </dd>
        </div>
        <div>
          <dt style={{ color: COLORS.muted }}>Taux de clic observé</dt>
          <dd className="font-bold tabular-nums">{estimate.observedCtr.toFixed(2).replace(".", ",")} %</dd>
        </div>
        <div>
          <dt style={{ color: COLORS.muted }}>Coût par clic</dt>
          <dd className="font-bold tabular-nums">
            {(estimate.cpcCents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
          </dd>
        </div>
      </dl>

      {/* Budget supérieur à l'inventaire : le dire franchement vaut mieux que
          de laisser l'annonceur constater qu'il n'a pas tout dépensé. */}
      {estimate.inventoryFill < 0.9 && (
        <p className="mt-2 text-[12px] font-semibold" style={{ color: "#B45309" }}>
          À ce budget, l&apos;inventaire disponible ne permet d&apos;absorber qu&apos;environ{" "}
          {Math.round(estimate.inventoryFill * 100)} % de votre budget quotidien. Élargissez vos
          zones ou vos emplacements pour le dépenser entièrement.
        </p>
      )}

      <p className="mt-2 text-[11.5px] leading-relaxed" style={{ color: COLORS.muted }}>
        {estimate.note} Ces chiffres sont indicatifs : ils dépendent de la demande réelle et des
        performances de votre publicité.
      </p>
    </div>
  );
}
