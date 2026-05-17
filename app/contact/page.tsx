import type { Metadata } from "next";
import Link from "next/link";

const SUPPORT_EMAIL = "support@dealandcompany.fr";

export const metadata: Metadata = {
  title: "Contact — Deal&Co",
  description:
    "Contactez l'équipe Deal&Co : support utilisateurs, signalement d'annonces, partenariats, presse, demandes juridiques. Réponse sous 48 h.",
  alternates: { canonical: "https://www.dealandcompany.fr/contact" },
};

export default function ContactPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl md:text-4xl font-extrabold text-on-surface font-['Manrope']">
        Nous contacter
      </h1>
      <p className="mt-3 text-slate-600 leading-relaxed">
        L&apos;équipe Deal&amp;Co est à votre disposition pour toute question, demande
        d&apos;assistance ou signalement. Nous répondons généralement sous 48 heures
        ouvrées.
      </p>

      <section className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
        <article className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-on-surface">Support utilisateurs</h2>
          <p className="text-sm text-slate-600 mt-2">
            Problème avec une annonce, un compte, un paiement, ou une question d&apos;utilisation
            du site.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Support%20utilisateur`}
            className="inline-flex items-center gap-2 mt-4 text-sm font-bold text-[#2f6fb8] hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </article>

        <article className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-on-surface">Signaler une annonce</h2>
          <p className="text-sm text-slate-600 mt-2">
            Annonce frauduleuse, contenu inapproprié, contrefaçon, escroquerie. Utilisez de
            préférence le bouton « Signaler » présent sur chaque annonce.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Signalement%20d'une%20annonce`}
            className="inline-flex items-center gap-2 mt-4 text-sm font-bold text-[#2f6fb8] hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </article>

        <article className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-on-surface">Partenariats &amp; presse</h2>
          <p className="text-sm text-slate-600 mt-2">
            Propositions de partenariat commercial, demandes presse, communication.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Partenariat`}
            className="inline-flex items-center gap-2 mt-4 text-sm font-bold text-[#2f6fb8] hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </article>

        <article className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-on-surface">Données personnelles &amp; RGPD</h2>
          <p className="text-sm text-slate-600 mt-2">
            Exercer vos droits RGPD (accès, rectification, suppression). Pour plus de détails,
            consultez notre{" "}
            <Link href="/confidentialite" className="text-[#2f6fb8] hover:underline">
              politique de confidentialité
            </Link>
            .
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=RGPD`}
            className="inline-flex items-center gap-2 mt-4 text-sm font-bold text-[#2f6fb8] hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </article>
      </section>

      <section className="mt-10 bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-on-surface">Coordonnées</h2>
        <p className="text-sm text-slate-600 mt-2">
          Deal&amp;Co — Plateforme de petites annonces entre particuliers et professionnels en France.
        </p>
        <p className="text-sm text-slate-600 mt-1">
          Email principal :{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#2f6fb8] hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p className="text-xs text-slate-500 mt-4">
          Pour les questions juridiques ou administratives, consultez nos{" "}
          <Link href="/mentions-legales" className="underline hover:text-[#2f6fb8]">
            mentions légales
          </Link>{" "}
          et nos{" "}
          <Link href="/cgu" className="underline hover:text-[#2f6fb8]">
            conditions générales d&apos;utilisation
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
