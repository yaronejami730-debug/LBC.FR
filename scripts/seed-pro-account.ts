/**
 * Compte professionnel de test — « Salon de coiffure Paris 17ème ».
 *
 *   npm run seed:pro
 *
 * Crée un professionnel complet et cohérent : compte habilité, dossier de
 * vérification approuvé, fiche publiée avec sa carte de prestations. Sans le
 * dossier, `postingCapabilities()` ne saurait pas si le compte peut publier en
 * particulier — un pro « nu » n'est pas un cas réaliste à tester.
 *
 * Idempotent : relancer le script met à jour le compte existant plutôt que de
 * le dupliquer. Le SIRET est marqué comme fictif dans les notes internes pour
 * qu'un modérateur ne le prenne pas pour un vrai dossier.
 *
 * Suppression : `npx tsx scripts/seed-pro-account.ts --delete`
 */

import "./load-env";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

const EMAIL = "salon-paris17@dealandco.test";
const PASSWORD = "Test1234!";
const COMPANY = "Salon de coiffure Paris 17ème";
const SLUG = "salon-de-coiffure-paris-17eme";
/** SIRET fictif : la séquence 000 00000 n'est attribuée à aucune entreprise. */
const SIRET = "90000000000017";
const TEST_NOTE = "COMPTE DE TEST — créé par scripts/seed-pro-account.ts. SIRET fictif.";

/** Carte du salon. Prix parisiens plausibles, pour que les tests aient du sens. */
const SERVICES: { section: string; label: string; durationMin: number | null; price: number; priceNote?: string }[] = [
  { section: "Coupe", label: "Coupe femme + brushing", durationMin: 60, price: 55 },
  { section: "Coupe", label: "Coupe homme", durationMin: 30, price: 32 },
  { section: "Coupe", label: "Coupe enfant (-12 ans)", durationMin: 30, price: 22 },
  { section: "Couleur", label: "Couleur racines", durationMin: 90, price: 68 },
  { section: "Couleur", label: "Balayage", durationMin: 150, price: 130, priceNote: "à partir de" },
  { section: "Couleur", label: "Patine / gloss", durationMin: 45, price: 40 },
  { section: "Soins", label: "Soin profond kératine", durationMin: 45, price: 45 },
  { section: "Soins", label: "Brushing seul", durationMin: 30, price: 30 },
  { section: "Coiffage", label: "Chignon de mariée", durationMin: 90, price: 120, priceNote: "sur devis" },
];

/**
 * L'équipe. Sans membre, `canBook` est faux sur la fiche et aucun bouton
 * « Réserver » n'apparaît : le moteur de créneaux a besoin de savoir *qui*
 * travaille, pas seulement que le salon est ouvert.
 *
 * Les sections servent à répartir la carte : Karim ne fait que la coupe, les
 * deux autres font tout. Un salon où tout le monde fait tout ne teste rien.
 */
const MEMBERS: { displayName: string; role: string; color: string; sections: string[] | null }[] = [
  { displayName: "Corinne", role: "Coloriste", color: "#2f6fb8", sections: null },
  { displayName: "Nathalie", role: "Coiffeuse", color: "#7c3aed", sections: null },
  { displayName: "Karim", role: "Barbier", color: "#059669", sections: ["Coupe"] },
];

/** Horaires de travail, alignés sur l'ouverture du salon. 0 = dimanche. */
const WORKING_HOURS: { weekday: number; startMin: number; endMin: number }[] = [
  { weekday: 2, startMin: 10 * 60, endMin: 19 * 60 }, // mardi
  { weekday: 3, startMin: 10 * 60, endMin: 19 * 60 }, // mercredi
  { weekday: 4, startMin: 10 * 60, endMin: 20 * 60 }, // jeudi
  { weekday: 5, startMin: 10 * 60, endMin: 20 * 60 }, // vendredi
  { weekday: 6, startMin: 9 * 60, endMin: 19 * 60 }, // samedi
];

/** Coupure déjeuner, tous les jours travaillés — un trou dans la grille. */
const LUNCH = { startMin: 13 * 60, endMin: 14 * 60, label: "Déjeuner" };

const HOURS = {
  lundi: "Fermé",
  mardi: "10:00-19:00",
  mercredi: "10:00-19:00",
  jeudi: "10:00-20:00",
  vendredi: "10:00-20:00",
  samedi: "09:00-19:00",
  dimanche: "Fermé",
};

async function remove() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  if (!user) {
    console.log("Aucun compte à supprimer.");
    return;
  }
  // ProProfile, ProService et ProVerification tombent en cascade sur User.
  await prisma.user.delete({ where: { id: user.id } });
  console.log(`Compte ${EMAIL} supprimé (fiche et dossier compris).`);
}

async function seed() {
  const hashed = await bcrypt.hash(PASSWORD, 12);
  const now = new Date();

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      email: EMAIL,
      password: hashed,
      name: COMPANY,
      companyName: COMPANY,
      siret: SIRET,
      isPro: true,
      // APPROVED : le dossier a été instruit. C'est ce que lit
      // postingCapabilities() pour autoriser la publication sous casquette pro.
      professionalStatus: "APPROVED",
      proVerifiedAt: now,
      emailVerified: true,
      verified: true,
      badgeRequestedAt: now,
      badgeGrantedAt: now,
      memberSince: now.getFullYear(),
      consentGivenAt: now,
      marketingConsent: false,
      trustScore: 75,
      adminNote: TEST_NOTE,
      addressLine: "18 rue de Lévis",
      addressCity: "Paris",
      addressPostal: "75017",
      firstName: "Corinne",
      lastName: "Berthier",
      civility: "Mme",
    },
    update: {
      password: hashed,
      companyName: COMPANY,
      isPro: true,
      professionalStatus: "APPROVED",
      proVerifiedAt: now,
      emailVerified: true,
      verified: true,
      adminNote: TEST_NOTE,
    },
  });

  // ── Dossier de vérification, approuvé ────────────────────────────────
  //
  // requestType DIRECT_PROFESSIONAL : inscription pro d'emblée, donc le compte
  // publie toujours sous casquette professionnelle et ne peut pas basculer en
  // particulier. C'est le cas le plus tranché à tester.
  const existingVerif = await prisma.proVerification.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!existingVerif) {
    await prisma.proVerification.create({
      data: {
        userId: user.id,
        status: "APPROVED",
        requestType: "DIRECT_PROFESSIONAL",
        siret: SIRET,
        siren: SIRET.slice(0, 9),
        companyName: COMPANY,
        commercialName: COMPANY,
        businessAddress: "18 rue de Lévis, 75017 Paris",
        businessActivity: "Coiffure",
        businessCategory: "beaute-bien-etre",
        responsibleFirstName: "Corinne",
        responsibleLastName: "Berthier",
        professionalPhone: "0600000017",
        professionalEmail: EMAIL,
        // Chemins volontairement explicites : aucun document réel n'existe, et
        // un modérateur doit le voir immédiatement s'il ouvre le dossier.
        idDocumentType: "CNI",
        idDocumentPath: "TEST/aucun-document-fourni",
        idDocumentBackPath: "TEST/aucun-document-fourni",
        companyDocType: "KBIS",
        companyDocPath: "TEST/aucun-document-fourni",
        submittedAt: now,
        reviewedAt: now,
        approvedAt: now,
        adminNote: TEST_NOTE,
      },
    });
  }

  // ── Entreprise ───────────────────────────────────────────────────────
  const company = await prisma.proCompany.upsert({
    where: { id: `cmp_seed_${user.id}` },
    update: {},
    create: { id: `cmp_seed_${user.id}`, legalName: COMPANY, tradeName: COMPANY },
  });
  await prisma.proAccess.upsert({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    update: { role: "OWNER" },
    create: { userId: user.id, companyId: company.id, role: "OWNER" },
  });

  // ── Fiche professionnelle publiée ────────────────────────────────────
  // Ciblée par son slug : `userId` n'est plus unique depuis le passage au
  // multi-établissement.
  const profile = await prisma.proProfile.upsert({
    where: { slug: SLUG },
    create: {
      userId: user.id,
      companyId: company.id,
      activityType: "beaute",
      name: COMPANY,
      slug: SLUG,
      categories: JSON.stringify(["beaute-bien-etre"]),
      description:
        "Salon de coiffure mixte aux Batignolles. Coupe, couleur, balayage et soins. " +
        "Équipe de quatre coiffeuses, sur rendez-vous du mardi au samedi.",
      addressLine: "18 rue de Lévis",
      city: "Paris",
      postalCode: "75017",
      phone: "0600000017",
      hours: JSON.stringify(HOURS),
      isPublished: true,
    },
    update: {
      name: COMPANY,
      categories: JSON.stringify(["beaute-bien-etre"]),
      hours: JSON.stringify(HOURS),
      isPublished: true,
    },
  });

  // Carte reconstruite à chaque exécution : c'est la seule façon de garantir
  // qu'une relance ne laisse pas de lignes orphelines d'une version antérieure.
  await prisma.proService.deleteMany({ where: { profileId: profile.id } });
  await prisma.proService.createMany({
    data: SERVICES.map((s, i) => ({
      profileId: profile.id,
      section: s.section,
      label: s.label,
      durationMin: s.durationMin,
      price: s.price,
      priceNote: s.priceNote ?? null,
      position: i,
      isActive: true,
      // « Sur devis » reste affiché mais ne produit aucun créneau : sans durée
      // ferme, le moteur de réservation ne sait pas combien de temps bloquer.
      isBookable: s.priceNote !== "sur devis",
    })),
  });

  // ── Équipe, horaires, réglages de réservation ────────────────────────
  //
  // Reconstruits à chaque exécution, comme la carte : les liens
  // membre↔prestation pointent sur des identifiants de prestations qui viennent
  // d'être recréés, les conserver produirait des liens morts.
  await prisma.proMember.deleteMany({ where: { profileId: profile.id } });

  const createdServices = await prisma.proService.findMany({
    where: { profileId: profile.id },
    select: { id: true, section: true, isBookable: true, durationMin: true },
  });

  for (const [i, m] of MEMBERS.entries()) {
    const member = await prisma.proMember.create({
      data: {
        profileId: profile.id,
        displayName: m.displayName,
        role: m.role,
        color: m.color,
        position: i,
        isActive: true,
        workingHours: { create: WORKING_HOURS },
        breaks: {
          create: WORKING_HOURS.map((h) => ({
            weekday: h.weekday,
            startMin: LUNCH.startMin,
            endMin: LUNCH.endMin,
            label: LUNCH.label,
          })),
        },
      },
    });

    // Seules les prestations réellement réservables sont rattachées : une ligne
    // « sur devis » n'a pas de durée, donc pas de créneau à proposer.
    const assigned = createdServices.filter(
      (s) =>
        s.isBookable &&
        s.durationMin &&
        s.durationMin > 0 &&
        (m.sections === null || m.sections.includes(s.section)),
    );
    await prisma.proMemberService.createMany({
      data: assigned.map((s) => ({ memberId: member.id, serviceId: s.id })),
    });
  }

  await prisma.proBookingSettings.upsert({
    where: { profileId: profile.id },
    create: {
      profileId: profile.id,
      slotGranularityMin: 15,
      bufferMin: 10,
      minNoticeMin: 120,
      maxAdvanceDays: 60,
      autoConfirm: true,
      allowCancel: true,
      allowReschedule: true,
      cancelDeadlineMin: 1440,
    },
    update: { bufferMin: 10, autoConfirm: true },
  });

  console.log("Compte professionnel de test prêt.\n");
  console.log(`  Email      ${EMAIL}`);
  console.log(`  Mot de passe ${PASSWORD}`);
  console.log(`  Raison sociale ${COMPANY}`);
  console.log(`  SIRET      ${SIRET} (fictif)`);
  console.log(`  Statut     isPro=true · professionalStatus=APPROVED · badge vérifié`);
  console.log(`  Publication  toujours sous casquette PRO (DIRECT_PROFESSIONAL)`);
  console.log(`  Fiche      /pro/${SLUG} — publiée, ${SERVICES.length} prestations`);
  console.log(`  Équipe     ${MEMBERS.map((m) => m.displayName).join(", ")} — mar-sam, coupure 13h-14h`);
  console.log(`  Réservation créneaux de 15 min, battement 10 min, préavis 2 h, horizon 60 j`);
  console.log(`  userId     ${user.id}`);
}

const run = process.argv.includes("--delete") ? remove : seed;
run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
