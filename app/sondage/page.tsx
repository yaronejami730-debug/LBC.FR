import { verifyEmailPrefToken } from "@/lib/email-token";
import { attributionOf, isAttributionSource } from "@/lib/attribution";
import SondageForm from "./SondageForm";

export const metadata = {
  title: "Comment nous avez-vous connus ? — Deal & Co",
  // Une page personnelle, ouverte par un lien signé : rien à faire dans un index.
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Page de réponse au sondage d'acquisition.
 *
 * Le jeton est vérifié avant tout affichage : un lien périmé obtient une phrase
 * claire plutôt qu'un formulaire qui échouerait à l'envoi. Il est aussi la seule
 * source d'identité — la page ne demande pas de se connecter, et n'accepte pas
 * d'identifiant venu de l'URL.
 */
export default async function SondagePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; s?: string }>;
}) {
  const { t, s } = await searchParams;
  const claim = t ? verifyEmailPrefToken(t) : null;

  return (
    <main className="min-h-screen bg-[#f7f9fb] px-6 py-16">
      <div className="mx-auto w-full max-w-lg">
        {!claim ? (
          <div className="rounded-2xl border border-[#eceef0] bg-white p-8 text-center">
            <h1 className="text-xl font-extrabold text-[#191c1e]">Ce lien n&apos;est plus valide</h1>
            <p className="mt-2 text-sm text-[#777683]">
              Il a peut-être expiré. Écrivez-nous depuis le site si vous souhaitez répondre.
            </p>
            <a
              href="/"
              className="mt-6 inline-block rounded-full bg-[#2f6fb8] px-6 py-3 text-sm font-bold text-white"
            >
              Retour à Deal &amp; Co
            </a>
          </div>
        ) : (
          <SondageForm
            token={t!}
            preselected={isAttributionSource(s) ? s : null}
            alreadyAnswered={(await attributionOf(claim.userId))?.source ?? null}
          />
        )}
      </div>
    </main>
  );
}
