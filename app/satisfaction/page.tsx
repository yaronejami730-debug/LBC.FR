import { prisma } from "@/lib/prisma";
import { verifySatisfactionToken } from "@/lib/satisfaction/token";
import SatisfactionForm from "./SatisfactionForm";

export const metadata = {
  title: "Votre avis — Deal & Co",
  // Un questionnaire personnel n'a rien à faire dans un index de recherche.
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Page de réponse au questionnaire.
 *
 * Le jeton est vérifié côté serveur avant d'afficher quoi que ce soit : un lien
 * périmé ou trafiqué obtient un message clair plutôt qu'un formulaire qui
 * échouera à l'envoi.
 *
 * L'ouverture est notée sur la campagne. C'est une mesure utile — combien de
 * personnes ouvrent sans répondre — et elle ne coûte rien puisqu'on a déjà la
 * ligne sous la main.
 */
export default async function SatisfactionPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; r?: string }>;
}) {
  const { t, r } = await searchParams;
  const claim = t ? verifySatisfactionToken(t) : null;

  const campaign = claim
    ? await prisma.satisfactionCampaign.findUnique({
        where: { id: claim.campaignId },
        select: { id: true, openedAt: true, response: { select: { id: true } } },
      })
    : null;

  if (!claim || !campaign) {
    return (
      <Shell>
        <div className="bg-white border border-[#eceef0] rounded-2xl p-8 text-center">
          <h1 className="text-xl font-extrabold text-[#191c1e] mb-2">Ce lien n&apos;est plus valide</h1>
          <p className="text-sm text-[#777683]">
            Il a peut-être expiré. Vous pouvez toujours nous écrire directement depuis le site.
          </p>
          <a
            href="/"
            className="inline-block mt-6 rounded-full bg-[#2f6fb8] px-6 py-3 text-sm font-bold text-white"
          >
            Retour à Deal &amp; Co
          </a>
        </div>
      </Shell>
    );
  }

  if (!campaign.openedAt) {
    await prisma.satisfactionCampaign
      .update({ where: { id: campaign.id }, data: { openedAt: new Date() } })
      .catch(() => {
        /* la mesure ne doit jamais empêcher d'afficher le formulaire */
      });
  }

  // Note pré-sélectionnée depuis le visage cliqué dans l'email.
  const parsed = Number(r);
  const initialRating = Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;

  return (
    <Shell>
      <header className="mb-7">
        <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">
          Votre avis nous intéresse
        </h1>
        <p className="text-sm text-[#777683] mt-1.5 max-w-xl">
          {campaign.response
            ? "Vous avez déjà répondu — merci. Vous pouvez modifier vos réponses ci-dessous."
            : "Une note suffit. Le reste est facultatif, répondez à ce qui vous parle."}
        </p>
      </header>

      <SatisfactionForm token={t!} initialRating={initialRating} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f9fb] px-4 py-12">
      <div className="max-w-2xl mx-auto">{children}</div>
    </main>
  );
}
