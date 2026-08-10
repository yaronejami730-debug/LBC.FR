/**
 * Compte professionnel de démonstration — Salon de coiffure Paris 17e.
 *
 * Sert à montrer le module de réservation à un professionnel en démarchage :
 * équipe, carte de prestations, horaires, pauses, absence, et un agenda déjà
 * rempli. Un salon vide ne démontre rien — les rendez-vous fictifs sont ce qui
 * rend visibles les trous, les conflits et le mode « peu importe ».
 *
 *   npx tsx -r ./scripts/load-env.ts scripts/seed-pro-booking.ts
 *
 * Idempotent : relancer réinitialise le salon sans toucher au reste de la base.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { addDays, dayKey, instantFromLocal } from "../lib/booking/time";

const DEMO_EMAIL = "salon.paris17@demo.dealandco.fr";
const DEMO_PASSWORD = "demo1234!";
const SLUG = "salon-de-coiffure-paris-17e";

/** Lundi fermé, comme la plupart des salons. Mardi → samedi, 10h → 19h. */
const OPEN_WEEKDAYS = [2, 3, 4, 5, 6];
const OPEN_START = 10 * 60;
const OPEN_END = 19 * 60;
const LUNCH_START = 12 * 60 + 30;
const LUNCH_END = 13 * 60 + 30;

const SERVICES = [
  { section: "Coiffure", label: "Brushing", durationMin: 30, price: 25 },
  { section: "Coiffure", label: "Coupe femme", durationMin: 45, price: 35 },
  { section: "Coiffure", label: "Coupe homme", durationMin: 20, price: 20 },
  { section: "Coiffure", label: "Coupe + brushing", durationMin: 60, price: 50 },
  { section: "Couleur", label: "Coloration", durationMin: 90, price: 70 },
  { section: "Esthétique", label: "Épilation sourcils", durationMin: 15, price: 12 },
];

async function main() {
  console.log("→ Compte de démonstration");
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { isPro: true, professionalStatus: "APPROVED", proVerifiedAt: new Date() },
    create: {
      email: DEMO_EMAIL,
      password: await bcrypt.hash(DEMO_PASSWORD, 12),
      name: "Salon Paris 17e",
      companyName: "Salon de coiffure Paris 17e",
      isPro: true,
      professionalStatus: "APPROVED",
      proVerifiedAt: new Date(),
      emailVerified: true,
      verified: true,
    },
  });

  console.log("→ Entreprise");
  // Un compte professionnel porte désormais une entreprise, qui porte un ou
  // plusieurs établissements. L'indépendant n'en voit rien, mais le modèle
  // doit être juste dès le seed.
  const company = await prisma.proCompany.upsert({
    where: { id: `cmp_demo_${user.id}` },
    update: {},
    create: {
      id: `cmp_demo_${user.id}`,
      legalName: "SARL Salon Paris 17",
      tradeName: "Salon de coiffure Paris 17e",
      legalForm: "SARL",
    },
  });
  await prisma.proAccess.upsert({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    update: { role: "OWNER" },
    create: { userId: user.id, companyId: company.id, role: "OWNER" },
  });

  console.log("→ Fiche établissement");
  // `userId` n'est plus unique : on cible la fiche par son slug, qui l'est.
  const profile = await prisma.proProfile.upsert({
    where: { slug: SLUG },
    update: { isPublished: true, companyId: company.id, activityType: "beaute" },
    create: {
      userId: user.id,
      companyId: company.id,
      activityType: "beaute",
      name: "Salon de coiffure Paris 17e",
      slug: SLUG,
      categories: JSON.stringify(["beaute-bien-etre"]),
      description:
        "Salon de quartier aux Batignolles. Coupe, couleur et brushing, " +
        "sur rendez-vous du mardi au samedi.",
      addressLine: "24 rue des Batignolles",
      city: "Paris",
      postalCode: "75017",
      phone: "01 42 00 00 17",
      hours: JSON.stringify({
        lundi: "Fermé",
        mardi: "10:00-19:00",
        mercredi: "10:00-19:00",
        jeudi: "10:00-19:00",
        vendredi: "10:00-19:00",
        samedi: "10:00-19:00",
        dimanche: "Fermé",
      }),
      photos: JSON.stringify([]),
      isPublished: true,
    },
  });

  // Remise à plat : le seed doit être rejouable sans empiler les doublons.
  // L'ordre suit les dépendances — les rendez-vous d'abord, ils référencent
  // membres et prestations.
  await prisma.proBooking.deleteMany({ where: { profileId: profile.id } });
  await prisma.proMember.deleteMany({ where: { profileId: profile.id } });
  await prisma.proService.deleteMany({ where: { profileId: profile.id } });

  console.log("→ Carte des prestations");
  const services = [];
  for (const [index, s] of SERVICES.entries()) {
    services.push(
      await prisma.proService.create({
        data: { profileId: profile.id, position: index, ...s },
      }),
    );
  }
  const byLabel = new Map(services.map((s) => [s.label, s]));

  console.log("→ Équipe");
  const corinne = await prisma.proMember.create({
    data: { profileId: profile.id, displayName: "Corinne", role: "Coiffeuse coloriste", color: "#c2410c", position: 0 },
  });
  const nathalie = await prisma.proMember.create({
    data: { profileId: profile.id, displayName: "Nathalie", role: "Coiffeuse", color: "#2f6fb8", position: 1 },
  });

  // Rattachement aux établissements où chacune travaille. Un seul salon ici,
  // mais la table existe pour que Nathalie puisse demain officier à Paris et à
  // Neuilly sans être dupliquée — la dupliquer casserait la garantie
  // anti-double-booking, qui porte sur `memberId`.
  await prisma.proMemberEstablishment.createMany({
    data: [corinne, nathalie].map((m) => ({ memberId: m.id, profileId: profile.id })),
    skipDuplicates: true,
  });

  // Nathalie ne fait pas la coloration : sans cette asymétrie, l'étape
  // « choisir le professionnel » proposerait toujours les deux et on ne
  // verrait jamais le filtrage à l'œuvre.
  const nathalieServices = services.filter((s) => s.label !== "Coloration");

  await prisma.proMemberService.createMany({
    data: [
      ...services.map((s) => ({ memberId: corinne.id, serviceId: s.id })),
      ...nathalieServices.map((s) => ({ memberId: nathalie.id, serviceId: s.id })),
    ],
  });

  console.log("→ Horaires et pauses");
  for (const member of [corinne, nathalie]) {
    // `profileId` est porté par chaque ligne : les horaires appartiennent au
    // couple (membre, établissement), pas au membre seul.
    await prisma.proWorkingHours.createMany({
      data: OPEN_WEEKDAYS.map((weekday) => ({
        memberId: member.id,
        profileId: profile.id,
        weekday,
        startMin: OPEN_START,
        endMin: OPEN_END,
      })),
    });
    await prisma.proBreak.createMany({
      data: OPEN_WEEKDAYS.map((weekday) => ({
        memberId: member.id,
        profileId: profile.id,
        weekday,
        startMin: LUNCH_START,
        endMin: LUNCH_END,
        label: "Déjeuner",
      })),
    });
  }

  console.log("→ Règles de réservation");
  await prisma.proBookingSettings.upsert({
    where: { profileId: profile.id },
    update: {},
    create: {
      profileId: profile.id,
      slotGranularityMin: 15,
      bufferMin: 0,
      minNoticeMin: 120,
      maxAdvanceDays: 60,
      autoConfirm: true,
    },
  });

  console.log("→ Absence");
  // Corinne absente une après-midi : c'est ce qui fait basculer les créneaux
  // « peu importe » sur Nathalie ce jour-là.
  const offDay = nextOpenDay(3);
  await prisma.proTimeOff.deleteMany({ where: { memberId: corinne.id } });
  await prisma.proTimeOff.create({
    data: {
      memberId: corinne.id,
      startAt: instantFromLocal(offDay, 16 * 60),
      endAt: instantFromLocal(offDay, 17 * 60),
      reason: "Rendez-vous personnel",
    },
  });

  console.log("→ Rendez-vous de démonstration");
  const planned: {
    member: typeof corinne;
    label: string;
    day: string;
    startMin: number;
    client: [string, string];
  }[] = [
    { member: corinne, label: "Coupe femme", day: nextOpenDay(1), startMin: 10 * 60, client: ["Julie", "Marchand"] },
    { member: corinne, label: "Coloration", day: nextOpenDay(1), startMin: 14 * 60, client: ["Sonia", "Berger"] },
    { member: nathalie, label: "Coupe homme", day: nextOpenDay(1), startMin: 11 * 60, client: ["Marc", "Delaunay"] },
    { member: nathalie, label: "Brushing", day: nextOpenDay(1), startMin: 15 * 60, client: ["Inès", "Roux"] },
    // Même heure, deux praticiennes : le créneau reste proposable en « peu
    // importe » tant qu'il reste quelqu'un de libre.
    { member: corinne, label: "Coupe + brushing", day: nextOpenDay(2), startMin: 11 * 60, client: ["Claire", "Fontaine"] },
    { member: nathalie, label: "Coupe femme", day: nextOpenDay(2), startMin: 11 * 60, client: ["Léa", "Nguyen"] },
    { member: nathalie, label: "Épilation sourcils", day: nextOpenDay(3), startMin: 16 * 60, client: ["Fatou", "Diallo"] },
  ];

  for (const rdv of planned) {
    const service = byLabel.get(rdv.label);
    if (!service?.durationMin) continue;
    await prisma.proBooking.create({
      data: {
        profileId: profile.id,
        memberId: rdv.member.id,
        serviceId: service.id,
        startAt: instantFromLocal(rdv.day, rdv.startMin),
        endAt: instantFromLocal(rdv.day, rdv.startMin + service.durationMin),
        firstName: rdv.client[0],
        lastName: rdv.client[1],
        phone: "06 12 34 56 78",
        email: `${rdv.client[0].toLowerCase()}@example.com`,
        priceSnapshot: service.price,
        durationSnapshot: service.durationMin,
        labelSnapshot: service.label,
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });
  }

  console.log("\n✅ Salon de démonstration prêt");
  console.log(`   Fiche      /pro/${SLUG}`);
  console.log(`   API        /api/booking/pro/${SLUG}`);
  console.log(`   Connexion  ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`   Équipe     Corinne (toutes prestations) · Nathalie (sauf coloration)`);
  console.log(`   Absence    Corinne le ${offDay} de 16:00 à 17:00`);
}

/** N-ième jour d'ouverture à venir, en partant de demain. */
function nextOpenDay(n: number): string {
  let day = dayKey(new Date());
  let found = 0;
  for (let i = 1; i <= 30; i++) {
    const candidate = addDays(day, i);
    const [y, m, d] = candidate.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
    if (OPEN_WEEKDAYS.includes(weekday)) {
      found += 1;
      if (found === n) return candidate;
    }
  }
  return addDays(day, n);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
