"use client";

/**
 * Questionnaire de satisfaction.
 *
 * Une seule réponse est obligatoire : la note. Tout le reste est facultatif, et
 * le bouton d'envoi s'active dès qu'un visage est choisi. Un formulaire qui
 * exige cinq réponses avant d'accepter la première se fait fermer.
 *
 * La note peut arriver pré-remplie depuis l'email : le destinataire a déjà
 * cliqué sur un visage, on ne le lui redemande pas. Il peut en changer.
 */

import { useState } from "react";

const FACES = [
  { rating: 5, emoji: "😀", label: "Très satisfait" },
  { rating: 4, emoji: "🙂", label: "Satisfait" },
  { rating: 3, emoji: "😐", label: "Moyen" },
  { rating: 2, emoji: "🙁", label: "Insatisfait" },
  { rating: 1, emoji: "😞", label: "Très insatisfait" },
];

export default function SatisfactionForm({
  token,
  initialRating,
}: {
  token: string;
  initialRating: number | null;
}) {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [nps, setNps] = useState<number | null>(null);
  const [likes, setLikes] = useState("");
  const [improvements, setImprovements] = useState("");
  const [wishedFeature, setWishedFeature] = useState("");

  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === null) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/satisfaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rating, nps, likes, improvements, wishedFeature }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Envoi impossible");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="bg-white border border-[#eceef0] rounded-2xl p-8 text-center">
        <p className="text-4xl mb-3" aria-hidden>
          🙏
        </p>
        <h2 className="text-xl font-extrabold text-[#191c1e] mb-2">Merci beaucoup</h2>
        <p className="text-sm text-[#777683] max-w-md mx-auto">
          Votre retour est lu, vraiment. C&apos;est ce qui nous dit quoi améliorer en priorité.
        </p>
        <a
          href="/"
          className="inline-block mt-6 rounded-full bg-[#2f6fb8] px-6 py-3 text-sm font-bold text-white"
        >
          Retour à Deal &amp; Co
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-7">
      <fieldset className="bg-white border border-[#eceef0] rounded-2xl p-6">
        <legend className="font-bold text-[#191c1e] px-1">
          Globalement, êtes-vous satisfait de Deal&nbsp;&amp;&nbsp;Co&nbsp;?
        </legend>
        <div role="radiogroup" aria-label="Note globale" className="flex flex-wrap gap-2 mt-4">
          {FACES.map((f) => {
            const active = rating === f.rating;
            return (
              <button
                key={f.rating}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setRating(f.rating)}
                className={`flex-1 min-w-[92px] rounded-xl border px-3 py-4 transition-all focus-visible:ring-2 focus-visible:ring-[#2f6fb8]/40 outline-none ${
                  active
                    ? "border-[#2f6fb8] bg-[#2f6fb8]/[0.05] ring-1 ring-[#2f6fb8]/20"
                    : "border-[#eceef0] hover:border-[#c3cecd]"
                }`}
              >
                <span className="block text-[26px] leading-none" aria-hidden>
                  {f.emoji}
                </span>
                <span className="block text-[11px] text-[#5a5b6e] mt-2">{f.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label={<>Qu&apos;est-ce que vous aimez le plus&nbsp;?</>} optional>
        <textarea
          value={likes}
          onChange={(e) => setLikes(e.target.value)}
          rows={3}
          maxLength={2000}
          className={textarea}
          placeholder="Ce qui vous plaît, même en une phrase"
        />
      </Field>

      <Field label={<>Qu&apos;est-ce qui pourrait être amélioré&nbsp;?</>} optional>
        <textarea
          value={improvements}
          onChange={(e) => setImprovements(e.target.value)}
          rows={3}
          maxLength={2000}
          className={textarea}
          placeholder="Ce qui vous a gêné, agacé, ralenti"
        />
      </Field>

      <Field label={<>Une fonctionnalité que vous aimeriez voir&nbsp;?</>} optional>
        <textarea
          value={wishedFeature}
          onChange={(e) => setWishedFeature(e.target.value)}
          rows={2}
          maxLength={2000}
          className={textarea}
          placeholder="Ce qui vous manque aujourd'hui"
        />
      </Field>

      <fieldset className="bg-white border border-[#eceef0] rounded-2xl p-6">
        <legend className="font-bold text-[#191c1e] px-1">
          Recommanderiez-vous Deal&nbsp;&amp;&nbsp;Co&nbsp;?
          <span className="ml-2 text-xs font-normal text-[#9ea4a9]">facultatif</span>
        </legend>
        <div
          role="radiogroup"
          aria-label="De 0 à 10"
          className="flex flex-wrap gap-1.5 mt-4"
        >
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={nps === n}
              onClick={() => setNps(n)}
              className={`w-10 h-10 rounded-lg border text-sm font-bold tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-[#2f6fb8]/40 outline-none ${
                nps === n
                  ? "border-[#2f6fb8] bg-[#2f6fb8] text-white"
                  : "border-[#eceef0] text-[#5a5b6e] hover:border-[#c3cecd]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-[#9ea4a9] mt-2">
          <span>Pas du tout</span>
          <span>Sans hésiter</span>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="bg-[#fdf2f3] border border-[#f4d3d6] text-[#99303a] rounded-xl px-4 py-3 text-sm">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={rating === null || sending}
          className="rounded-full bg-[#2f6fb8] px-7 py-3.5 text-sm font-bold text-white disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {sending ? "Envoi…" : "Envoyer mon avis"}
        </button>
        {rating === null && (
          <span className="text-xs text-[#9ea4a9]">Choisissez une note pour envoyer</span>
        )}
      </div>
    </form>
  );
}

const textarea =
  "w-full mt-3 rounded-xl border border-[#dfe4e8] px-4 py-3 text-[15px] text-[#191c1e] placeholder:text-[#a9b0b6] focus:border-[#2f6fb8] focus:ring-2 focus:ring-[#2f6fb8]/20 outline-none transition-colors resize-y";

function Field({
  label,
  optional,
  children,
}: {
  label: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block bg-white border border-[#eceef0] rounded-2xl p-6">
      <span className="font-bold text-[#191c1e]">{label}</span>
      {optional && <span className="ml-2 text-xs font-normal text-[#9ea4a9]">facultatif</span>}
      {children}
    </label>
  );
}
