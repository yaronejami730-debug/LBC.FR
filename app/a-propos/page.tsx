import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";
import { CATEGORIES } from "@/lib/categories";

const BASE = "https://www.dealandcompany.fr";

export const metadata: Metadata = {
  title: "À propos de Deal&Co — Site de petites annonces entre particuliers",
  description:
    "Deal&Co est un site français de petites annonces gratuites entre particuliers et professionnels. Découvrez notre mission, notre fonctionnement et nos catégories.",
  alternates: { canonical: `${BASE}/a-propos` },
  openGraph: {
    title: "À propos de Deal&Co",
    description:
      "Site français de petites annonces gratuites entre particuliers et professionnels — mission, fonctionnement, catégories.",
    url: `${BASE}/a-propos`,
    siteName: "Deal&Co",
    type: "website",
    locale: "fr_FR",
  },
};

const FAQ = [
  {
    q: "Qu'est-ce que Deal&Co ?",
    a: "Deal&Co (dealandcompany.fr) est un site français de petites annonces gratuites permettant aux particuliers et aux professionnels d'acheter et de vendre directement, sans commission ni intermédiaire, partout en France.",
  },
  {
    q: "Comment publier une annonce sur Deal&Co ?",
    a: "Créez un compte gratuit, cliquez sur « Publier une annonce », sélectionnez la catégorie correspondante, ajoutez un titre, une description, des photos et un prix. Votre annonce est mise en ligne après une rapide modération.",
  },
  {
    q: "La publication est-elle vraiment gratuite ?",
    a: "Oui, la publication d'annonces entre particuliers est entièrement gratuite. Des options de mise en avant payantes (annonce premium, remontée en haut de liste) existent pour les vendeurs qui souhaitent gagner en visibilité.",
  },
  {
    q: "Comment Deal&Co se distingue-t-il des autres sites d'annonces ?",
    a: "Deal&Co met l'accent sur la simplicité, la gratuité totale pour les particuliers et un modèle sans commission. Le site couvre 14 catégories majeures, dispose d'une API publique pour les professionnels et publie des guides pratiques pour sécuriser les transactions.",
  },
  {
    q: "Dans quelles villes peut-on consulter ou publier des annonces ?",
    a: "Deal&Co couvre l'ensemble du territoire français métropolitain et d'outre-mer. Plus de 150 villes principales disposent de pages dédiées par catégorie pour faciliter la recherche locale.",
  },
  {
    q: "Comment Deal&Co lutte-t-il contre les arnaques ?",
    a: "Toutes les annonces passent par une modération avant publication. Le site fournit des conseils de sécurité (rendez-vous en lieu public, paiement instantané SEPA, vérification du chèque de banque) et permet aux utilisateurs de signaler les annonces suspectes en un clic.",
  },
  {
    q: "Qui peut utiliser Deal&Co ?",
    a: "Tout particulier majeur résidant en France ainsi que les professionnels disposant d'un SIRET valide peuvent créer un compte. Les professionnels bénéficient d'options dédiées : profil pro, badge de confiance, accès API.",
  },
];

export default function AProposPage() {
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE}/#org`,
    name: "Deal&Co",
    alternateName: ["Deal and Co", "Dealandcompany"],
    url: BASE,
    logo: `${BASE}/logo-dealco.png`,
    description:
      "Deal&Co est un site français de petites annonces gratuites entre particuliers et professionnels, couvrant véhicules, immobilier, mode, électronique, mobilier et plus de 14 catégories principales.",
    foundingDate: "2024",
    areaServed: { "@type": "Country", name: "France" },
    knowsLanguage: ["fr"],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
      { "@type": "ListItem", position: 2, name: "À propos", item: `${BASE}/a-propos` },
    ],
  };

  return (
    <div className="bg-surface text-on-surface mb-24 md:mb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-3xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">À propos</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface leading-tight">
          À propos de Deal&amp;Co
        </h1>

        <p className="text-lg text-on-surface mt-4 leading-relaxed">
          Deal&amp;Co (dealandcompany.fr) est un site français de petites annonces gratuites entre
          particuliers et professionnels. Le site permet la publication, la consultation et la mise
          en relation directe pour l&apos;achat, la vente et l&apos;échange de biens et services
          partout en France, sans commission ni frais cachés.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold tracking-tight mb-3">Notre mission</h2>
          <p className="leading-relaxed text-on-surface">
            Faciliter les transactions directes entre particuliers en France en proposant un site
            simple, gratuit et efficace, indépendant des grandes plateformes commissionnées. Chaque
            annonce permet à un vendeur d&apos;atteindre des acheteurs locaux sans intermédiaire et
            à un acheteur de trouver des biens d&apos;occasion à des prix justes près de chez lui.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold tracking-tight mb-3">Comment fonctionne Deal&amp;Co</h2>
          <ol className="list-decimal list-outside pl-6 space-y-2 text-on-surface leading-relaxed">
            <li>
              Vous créez un compte gratuit en quelques secondes (email + mot de passe).
            </li>
            <li>
              Vous publiez votre annonce en sélectionnant la catégorie, en ajoutant des photos et
              une description précise. La modération est rapide.
            </li>
            <li>
              Les acheteurs intéressés vous contactent directement via la messagerie interne ou par
              téléphone si vous avez choisi de l&apos;afficher.
            </li>
            <li>
              Vous convenez du rendez-vous, vérifiez le bien, encaissez le paiement et finalisez la
              transaction. Aucune commission n&apos;est prélevée.
            </li>
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold tracking-tight mb-3">Catégories couvertes</h2>
          <p className="leading-relaxed text-on-surface mb-3">
            Deal&amp;Co couvre 14 catégories principales, organisées en sous-catégories pour faciliter
            la recherche locale :
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <Link
                key={c.id}
                href={`/annonces/${c.id}`}
                className="text-sm font-semibold text-primary hover:underline"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold tracking-tight mb-3">Pour les professionnels</h2>
          <p className="leading-relaxed text-on-surface">
            Les professionnels disposant d&apos;un SIRET valide peuvent créer un compte pro avec un
            badge dédié, des fonctionnalités d&apos;automatisation et un accès à une API publique
            pour publier des annonces depuis leur logiciel métier (concessions auto, agences
            immobilières, brocanteurs). Documentation disponible sur la{" "}
            <Link href="/api-doc" className="text-primary font-semibold hover:underline">
              page API
            </Link>
            .
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold tracking-tight mb-3">Sécurité et confiance</h2>
          <p className="leading-relaxed text-on-surface">
            Toute annonce est modérée avant publication. Les utilisateurs peuvent signaler les
            annonces frauduleuses ou inappropriées. Le{" "}
            <Link href="/blog" className="text-primary font-semibold hover:underline">
              blog Deal&amp;Co
            </Link>{" "}
            publie régulièrement des guides pratiques sur la sécurité des transactions, les
            paiements à privilégier et les arnaques courantes à reconnaître.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight mb-5">Questions fréquentes</h2>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <details key={i} className="bg-white rounded-xl border border-surface-container p-4 group">
                <summary className="cursor-pointer font-semibold text-on-surface flex justify-between items-center list-none">
                  {item.q}
                  <span className="material-symbols-outlined text-outline group-open:rotate-180 transition-transform">
                    expand_more
                  </span>
                </summary>
                <p className="mt-3 text-on-surface-variant leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-12 bg-primary/5 rounded-2xl p-6 border border-primary/10 text-center">
          <h2 className="text-xl font-bold text-on-surface mb-2">Prêt à publier votre première annonce ?</h2>
          <p className="text-outline text-sm mb-4">
            Création de compte en 30 secondes. Mise en ligne en 2 minutes. Aucune commission.
          </p>
          <Link
            href="/login?callbackUrl=/post"
            className="inline-flex items-center gap-2 px-7 py-3 bg-primary text-white rounded-full font-bold shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            Publier mon annonce gratuitement
          </Link>
        </section>
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}
