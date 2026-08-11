import { prisma } from "@/lib/prisma";

(async () => {
  const profiles = await prisma.proProfile.findMany({
    select: {
      id: true, slug: true, name: true, isPublished: true,
      user: { select: { email: true, professionalStatus: true } },
      _count: { select: { members: true, services: true } },
    },
    take: 10,
  });
  console.log(JSON.stringify(profiles, null, 1));
  await prisma.$disconnect();
})();
